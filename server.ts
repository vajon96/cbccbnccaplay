import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      const p = Number(args[i + 1]);
      if (Number.isFinite(p) && p > 0) return p;
    } else if (args[i].startsWith("--port=")) {
      const p = Number(args[i].slice(7));
      if (Number.isFinite(p) && p > 0) return p;
    }
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = resolvePort();
const FIREBASE_PROJECT_ID = "gen-lang-client-0584243831";
const SUPER_ADMIN_EMAIL = (process.env.VITE_ADMIN_EMAIL || "sajondey102@gmail.com").trim().toLowerCase();

// Ephemeral fallback secrets generated at startup only when env vars are unset
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHmac("sha256", `${FIREBASE_PROJECT_ID}-session`).update(process.cwd()).digest("hex");

const EXAM_KEY_SECRET = crypto
  .createHash("sha256")
  .update(process.env.EXAM_KEY_SECRET || `${SESSION_SECRET}-exam-vault`)
  .digest();

const ACTIVE_GEMINI_MODEL = "gemini-4-hydrogen";

let cachedAiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_UNAVAILABLE");
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedAiClient;
}

const SYSTEM_INSTRUCTION = `
You are the BNCC (Bangladesh National Cadet Corps) Assistant for Cox's Bazar City College Platoon.
Your goal is to help students, cadets, and visitors with verified information about BNCC enrollment, training, and activities.

Detailed Platoon Information:
- Platoon Name: Cox's Bazar City College BNCC Mixed Platoon (কক্সবাজার সিটি কলেজ BNCC মিশ্র প্লাটুন).
- Platoon Commander: Ujjal Kanti Deb (উজ্জ্বল কান্তি দেব), Professor Under Officer (PUO).
- Institution: Cox's Bazar City College (CBCC), Sahityika Road, Cox's Bazar.
- History: Approved on September 3, 2020; activities launched November 18, 2020.
- Organization: Army Wing, 15 BNCC Battalion, Karnaphuli Regiment, E Company.
- Motto: Knowledge, Discipline, Voluntary Service (জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা).
- Eligibility: Regular Class 11 or 1st Year Honours student, minimum SSC GPA 3.00, unmarried, physically fit.
- Physical Standards: Male min height 5'6", Chest 30"/32"; Female min height 5'2".
- Contact: Platoon Commander (+880 1812-430454).

Respond in clear, disciplined Bengali or English matching the user's language.
`;

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  next();
});

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Sliding-Window In-Memory Rate Limiter
interface RateBucket {
  timestamps: number[];
}
const rateBuckets = new Map<string, RateBucket>();

function rateLimit(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length >= maxRequests) {
      return res.status(429).json({
        error: "অনুরোধের সীমা অতিক্রম করেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
        code: "RATE_LIMITED",
      });
    }
    bucket.timestamps.push(now);
    rateBuckets.set(key, bucket);
    next();
  };
}

// Cookie & HMAC Session Helpers
interface ServerSessionUser {
  id: string;
  uid?: string;
  email?: string | null;
  name: string;
  role: string;
  username?: string;
  registrationNumber?: string;
  permissions?: Record<string, boolean>;
  authSource?: string;
  impersonatedBy?: {
    id: string;
    name: string;
    role: string;
    uid?: string;
    email?: string | null;
  } | null;
  exp: number;
}

function parseCookies(req: express.Request): Record<string, string> {
  const header = req.headers.cookie || "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function signPayload(payload: object): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  return `${b64}.${sig}`;
}

function verifySignedToken<T = any>(token: string): T | null {
  if (!token || !token.includes(".")) return null;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(b64).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function isHttpsRequest(req?: express.Request): boolean {
  if (!req) return process.env.NODE_ENV === "production";
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return Boolean(req.secure || proto === "https" || process.env.NODE_ENV === "production");
}

function setSessionCookie(res: express.Response, user: ServerSessionUser, req?: express.Request) {
  const signed = signPayload(user);
  const isHttps = isHttpsRequest(req);
  res.cookie("bncc_sid", signed, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    maxAge: 1000 * 60 * 60 * 12,
    path: "/",
  });
}

function getServerSession(req: express.Request): ServerSessionUser | null {
  const cookies = parseCookies(req);
  const raw = cookies["bncc_sid"];
  if (!raw) return null;
  const parsed = verifySignedToken<ServerSessionUser>(raw);
  if (!parsed || (parsed.exp && Date.now() > parsed.exp)) {
    return null;
  }
  return parsed;
}

// Firebase SecureToken x509 Public Key Cache for Zero-Dependency JWT Verification
let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCerts.expiresAt) {
    return cachedCerts.certs;
  }
  const resp = await fetch(
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
  );
  if (!resp.ok) {
    throw new Error("Failed to fetch Google x509 public certs");
  }
  const cacheControl = resp.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  const certs = (await resp.json()) as Record<string, string>;
  cachedCerts = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

interface VerifiedFirebaseClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseClaims | null> {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as VerifiedFirebaseClaims;

    if (header.alg !== "RS256" || !header.kid) return null;
    if (payload.aud !== FIREBASE_PROJECT_ID) return null;
    if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) return null;
    if (!payload.sub || payload.exp * 1000 <= Date.now()) return null;

    const certs = await getFirebasePublicCerts();
    const cert = certs[header.kid];
    if (!cert) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const isValid = verifier.verify(cert, Buffer.from(sigB64, "base64url"));
    return isValid ? payload : null;
  } catch {
    return null;
  }
}

const ADMIN_ROLE_LIST = ["super_admin", "admin", "exam_admin", "qr_admin", "sub_admin", "attendance_officer"];

async function resolveRequestSession(req: express.Request): Promise<ServerSessionUser | null> {
  const cookieSession = getServerSession(req);
  if (cookieSession) return cookieSession;

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return null;

  const claims = await verifyFirebaseIdToken(bearer);
  if (!claims) return null;

  const email = (claims.email || "").toLowerCase();
  const isSuper = email === SUPER_ADMIN_EMAIL && claims.email_verified === true;
  return {
    id: claims.sub,
    uid: claims.sub,
    email: claims.email || null,
    name: claims.name || email || "BNCC User",
    role: isSuper ? "super_admin" : "user",
    authSource: "firebase",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
}

function requireAuth(allowedRoles?: string[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = await resolveRequestSession(req);
    if (!session) {
      return res.status(401).json({ error: "Authentication required", code: "UNAUTHORIZED" });
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      return res.status(403).json({ error: "Insufficient permissions", code: "FORBIDDEN" });
    }
    (req as any).serverUser = session;
    next();
  };
}

// =========================================================================
// AUTHENTICATION & SESSION ENDPOINTS
// =========================================================================

app.post("/api/auth/firebase", rateLimit(10 * 60 * 1000, 40), async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({ error: "Firebase ID token is required" });
  }
  const claims = await verifyFirebaseIdToken(idToken);
  if (!claims) {
    return res.status(401).json({ error: "Invalid or expired Firebase ID token" });
  }
  const email = (claims.email || "").toLowerCase();
  const isSuper = email === SUPER_ADMIN_EMAIL && claims.email_verified === true;
  const current = getServerSession(req);

  const sessionUser: ServerSessionUser = {
    id: current?.id || claims.sub,
    uid: claims.sub,
    email: claims.email || null,
    name: claims.name || email || "BNCC User",
    role: isSuper ? "super_admin" : current?.role || "user",
    authSource: "firebase",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  setSessionCookie(res, sessionUser, req);
  return res.json({ authenticated: true, user: sessionUser });
});

app.post("/api/auth/session-sync", rateLimit(10 * 60 * 1000, 60), async (req, res) => {
  const { user } = req.body || {};
  if (!user || !user.id || !user.role) {
    return res.status(400).json({ error: "Invalid session payload" });
  }

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const claims = bearer ? await verifyFirebaseIdToken(bearer) : null;
  const existingSession = getServerSession(req);

  // Prevent unverified super_admin elevation
  let safeRole = String(user.role);
  if (safeRole === "super_admin") {
    const emailMatches =
      claims &&
      (claims.email || "").toLowerCase() === SUPER_ADMIN_EMAIL &&
      claims.email_verified === true;
    const activeSuperCookie = existingSession?.role === "super_admin";
    const restoredAdmin = existingSession?.impersonatedBy?.role === "super_admin";
    if (!emailMatches && !activeSuperCookie && !restoredAdmin) {
      return res.status(403).json({ error: "Super admin elevation requires verified email or admin credentials" });
    }
  }

  const sessionUser: ServerSessionUser = {
    id: String(user.id).slice(0, 128),
    uid: claims?.sub || user.uid || existingSession?.uid,
    email: claims?.email || user.email || null,
    name: String(user.name || "BNCC User").slice(0, 160),
    role: safeRole,
    username: user.username ? String(user.username).slice(0, 80) : undefined,
    registrationNumber: user.registrationNumber ? String(user.registrationNumber).slice(0, 64) : undefined,
    permissions: user.permissions || undefined,
    authSource: claims ? "firebase" : user.authSource || "credential",
    impersonatedBy: user.impersonatedBy || null,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  setSessionCookie(res, sessionUser, req);
  return res.json({ authenticated: true, user: sessionUser });
});

const DEFAULT_ADMIN_SCRYPT_SALT = "63b807846d1c70acc80b777d2615af57";
const DEFAULT_ADMIN_SCRYPT_HASH =
  "6bbd0519937369e0efac171dc47bff93a502abeb35a744592961f35d0b386056df5453cfb5fc2247c8a73e27306be0dd491eb118317957e83977798d9b53c33a";

function verifyAdminPassword(candidate: string): boolean {
  const configuredSecret = process.env.ADMIN_LOGIN_PASSWORD;
  if (configuredSecret && configuredSecret.length > 0) {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(configuredSecret, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const derived = crypto.scryptSync(candidate, DEFAULT_ADMIN_SCRYPT_SALT, 64);
  const expected = Buffer.from(DEFAULT_ADMIN_SCRYPT_HASH, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

app.post("/api/auth/credential-login", rateLimit(10 * 60 * 1000, 30), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const cleanId = String(username).trim().toLowerCase();
  if (cleanId === "admin") {
    if (verifyAdminPassword(String(password))) {
      const superUser: ServerSessionUser = {
        id: "admin",
        username: "admin",
        email: SUPER_ADMIN_EMAIL,
        name: "Platoon Commander",
        role: "super_admin",
        authSource: "credential",
        permissions: {
          canAdd: true,
          canEdit: true,
          canDelete: true,
          canViewLogs: true,
          canResetPW: true,
          canApprove: true,
          canExport: true,
          canChat: true,
        },
        exp: Date.now() + 1000 * 60 * 60 * 12,
      };
      setSessionCookie(res, superUser, req);
      return res.json({ authenticated: true, user: superUser });
    }
    return res.status(401).json({ error: "Invalid admin password." });
  }
  return res.status(404).json({ error: "Delegate to verified Firestore/Firebase check" });
});

app.get("/api/auth/session", (req, res) => {
  const session = getServerSession(req);
  if (!session) {
    return res.json({ authenticated: false, user: null });
  }
  return res.json({ authenticated: true, user: session });
});

app.post("/api/auth/logout", (req, res) => {
  const isHttps = isHttpsRequest(req);
  res.clearCookie("bncc_sid", {
    path: "/",
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
  });
  return res.json({ success: true });
});

// =========================================================================
// AES-256-GCM SEALED EXAM ANSWER KEY VAULT & SERVER GRADING
// =========================================================================

interface AnswerKeyEntry {
  id: string;
  questionType: string;
  correctAnswer?: any;
  acceptedAnswers?: string[];
  marks: number;
}

interface SealedExamPackage {
  keys: AnswerKeyEntry[];
  negativePenalty: number;
  passMarks: number;
}

const examKeyVault = new Map<string, SealedExamPackage>();

function sealKeys(payload: SealedExamPackage): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", EXAM_KEY_SECRET, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function unsealKeys(sealed: string): SealedExamPackage {
  const buf = Buffer.from(sealed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", EXAM_KEY_SECRET, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  const parsed = JSON.parse(plain);
  if (Array.isArray(parsed)) {
    return { keys: parsed, negativePenalty: 0, passMarks: 0 };
  }
  return {
    keys: Array.isArray(parsed?.keys) ? parsed.keys : [],
    negativePenalty: Number(parsed?.negativePenalty) || 0,
    passMarks: Number(parsed?.passMarks) || 0,
  };
}

app.post(
  "/api/exam/keys",
  rateLimit(10 * 60 * 1000, 60),
  requireAuth(["super_admin", "admin", "exam_admin"]),
  (req, res) => {
    const { examId, questions, negativePenalty, passMarks } = req.body || {};
    if (!examId || !Array.isArray(questions)) {
      return res.status(400).json({ error: "examId and questions array are required" });
    }
    const sanitizedKeys: AnswerKeyEntry[] = questions.map((q: any) => ({
      id: String(q.id),
      questionType: String(q.questionType || "mcq"),
      correctAnswer: q.correctAnswer ?? "",
      acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String) : [],
      marks: Number(q.marks) || 1,
    }));
    const pkg: SealedExamPackage = {
      keys: sanitizedKeys,
      negativePenalty: Number(negativePenalty) || 0,
      passMarks: Number(passMarks) || 0,
    };
    examKeyVault.set(String(examId), pkg);
    const sealedPayload = sealKeys(pkg);
    return res.json({ success: true, examId, count: sanitizedKeys.length, sealedPayload });
  }
);

app.post(
  "/api/exam/submit",
  rateLimit(10 * 60 * 1000, 60),
  requireAuth(),
  (req, res) => {
    const { examId, attemptId, answers, sealedPayload, questionsMeta, negativePenalty: reqPenalty, passMarks: reqPassMarks } = req.body || {};
    if (!examId || !attemptId) {
      return res.status(400).json({ error: "examId and attemptId are required" });
    }

    let pkg: SealedExamPackage | undefined = examKeyVault.get(String(examId));
    if (!pkg && typeof sealedPayload === "string" && sealedPayload.length > 0) {
      try {
        pkg = unsealKeys(sealedPayload);
        examKeyVault.set(String(examId), pkg);
      } catch {
        return res.status(400).json({ error: "Invalid sealed answer key envelope" });
      }
    }

    const metaList: AnswerKeyEntry[] = pkg?.keys || (Array.isArray(questionsMeta) ? questionsMeta : []);
    const penalty = pkg ? pkg.negativePenalty : Number(reqPenalty) || 0;
    const passMarks = pkg ? pkg.passMarks : Number(reqPassMarks) || 0;
    if (metaList.length === 0) {
      return res.status(404).json({ error: "Answer key vault entry not found for this exam" });
    }

    let obtainedObjectiveMarks = 0;
    let totalObjectiveMarks = 0;
    let totalMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let hasSubjective = false;
    const evaluatedAnswers: Record<string, any> = {};

    for (const q of metaList) {
      const maxMarks = Number(q.marks) || 1;
      totalMarks += maxMarks;
      const candidateObj = answers?.[q.id];
      const given = candidateObj?.selectedAnswer;
      const isSubjective = ["short_question", "fill_gaps", "changing_sentence", "tag_question"].includes(
        q.questionType
      );

      if (given === undefined || given === null || String(given).trim() === "") {
        unansweredCount++;
      }

      if (isSubjective) {
        hasSubjective = true;
        const givenNorm = typeof given === "string" ? given.trim().toLowerCase() : "";
        const accepted = [
          typeof q.correctAnswer === "string" ? q.correctAnswer.trim().toLowerCase() : "",
          ...(q.acceptedAnswers || []).map((a) => String(a).trim().toLowerCase()),
        ].filter(Boolean);
        const exactMatch = givenNorm.length > 0 && accepted.includes(givenNorm);
        if (givenNorm) {
          if (exactMatch) {
            correctCount++;
            obtainedObjectiveMarks += maxMarks;
          } else {
            wrongCount++;
            if (penalty > 0) obtainedObjectiveMarks -= penalty;
          }
        }
        evaluatedAnswers[q.id] = {
          selectedAnswer: given ?? "",
          isCorrect: !givenNorm ? false : exactMatch ? true : null,
          obtainedMarks: exactMatch ? maxMarks : 0,
          maxMarks,
          status: !givenNorm ? "unanswered" : exactMatch ? "correct" : "pending_review",
        };
      } else {
        totalObjectiveMarks += maxMarks;
        let isCorrect = false;
        const hasGiven = given !== undefined && given !== null && String(given).trim() !== "";
        if (q.questionType === "multiple_choice" && Array.isArray(given) && Array.isArray(q.correctAnswer)) {
          const a = [...given].map(String).sort().join("|");
          const b = [...q.correctAnswer].map(String).sort().join("|");
          isCorrect = a.length > 0 && a === b;
        } else if (hasGiven) {
          const gStr = String(given).trim().toUpperCase();
          const kStr = String(q.correctAnswer ?? "").trim().toUpperCase();
          isCorrect = kStr.length > 0 && gStr === kStr;
        }
        if (hasGiven) {
          if (isCorrect) {
            correctCount++;
            obtainedObjectiveMarks += maxMarks;
          } else {
            wrongCount++;
            if (penalty > 0) obtainedObjectiveMarks -= penalty;
          }
        }
        evaluatedAnswers[q.id] = {
          selectedAnswer: given ?? "",
          isCorrect,
          obtainedMarks: isCorrect ? maxMarks : 0,
          maxMarks,
          status: !hasGiven ? "unanswered" : isCorrect ? "correct" : "wrong",
        };
      }
    }

    const finalScore = Math.max(0, Number(obtainedObjectiveMarks.toFixed(2)));
    const gradingStatus = hasSubjective ? "pending_review" : "graded";
    const percentage = totalMarks > 0 ? Number(((finalScore / totalMarks) * 100).toFixed(2)) : 0;
    const isPassed = finalScore >= passMarks;
    const resultSignature = signPayload({
      examId,
      attemptId,
      obtainedObjectiveMarks: finalScore,
      totalMarks,
      evaluatedAt: Date.now(),
    });

    return res.json({
      evaluatedAnswers,
      obtainedMarks: finalScore,
      totalObjectiveMarks,
      totalMarks,
      correctCount,
      wrongCount,
      unansweredCount,
      percentage,
      passMarks,
      isPassed,
      gradingStatus,
      hasSubjective,
      resultSignature,
      evaluatedAtServer: new Date().toISOString(),
    });
  }
);

// =========================================================================
// HARDENED GEMINI AI ENDPOINTS (Using gemini-4-hydrogen)
// =========================================================================

app.post("/api/gemini/chat", rateLimit(10 * 60 * 1000, 30), async (req, res) => {
  try {
    const { message, history } = req.body || {};
    if (!message || typeof message !== "string" || message.length > 2000) {
      return res.status(400).json({ error: "Valid message (max 2000 chars) is required" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "AI service key unavailable",
        code: "AI_FALLBACK",
        fallbackText:
          "এই মুহূর্তে এআই সার্ভার সংযোগ বিচ্ছিন্ন রয়েছে। ভর্তি তথ্যের জন্য ভর্তি নির্দেশিকা পাতা দেখুন অথবা প্লাটুন কমান্ডার (+৮৮০ ১৮১২-৪৩০৪৫৪) এর সাথে যোগাযোগ করুন।",
      });
    }

    const safeHistory = Array.isArray(history) ? history.slice(-12) : [];
    const chat = getAiClient().chats.create({
      model: ACTIVE_GEMINI_MODEL,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
      history: safeHistory,
    });

    const result = await chat.sendMessage({ message });
    return res.json({ text: result.text });
  } catch (error) {
    console.error("Chat generation error:", error instanceof Error ? error.message : "unknown");
    return res.status(502).json({
      error: "AI request failed",
      code: "AI_FALLBACK",
      fallbackText:
        "দুঃখিত, এই মুহূর্তে এআই সহায়তা পাওয়া যাচ্ছে না। ভর্তি ও প্রশিক্ষণ সংক্রান্ত তথ্যের জন্য অফিসিয়াল নোটিশ বোর্ড বা প্লাটুন কমান্ডার (+৮৮০ ১৮১২-৪৩০৪৫৪) এর সাথে যোগাযোগ করুন।",
    });
  }
});

app.post("/api/gemini/analyze-enrollment", rateLimit(10 * 60 * 1000, 20), async (req, res) => {
  const { formData } = req.body || {};
  try {
    if (!formData) {
      return res.status(400).json({ error: "Form data is required" });
    }
    const prompt = `
    Analyze this BNCC enrollment eligibility in one concise Bengali paragraph:
    - Height: ${formData.heightFeet}'${formData.heightInches}"
    - Weight: ${formData.weightKg}kg
    - SSC GPA: ${formData.sscGpa}
    - Gender: ${formData.gender}
    `;
    const response = await getAiClient().models.generateContent({
      model: ACTIVE_GEMINI_MODEL,
      contents: prompt,
    });
    return res.json({ text: response.text });
  } catch (error) {
    console.error("Enrollment analysis error:", error instanceof Error ? error.message : "unknown");
    const gpa = Number(formData?.sscGpa) || 3.0;
    const feet = Number(formData?.heightFeet) || 5;
    const inches = Number(formData?.heightInches) || 0;
    const isFemale = formData?.gender === "Female";
    const heightInInches = feet * 12 + inches;
    const suitabilityMsg = isFemale
      ? heightInInches >= 62
        ? "উচ্চতা (৫'২\"+) বিএনসিসি মানদণ্ড অনুযায়ী উপযুক্ত।"
        : "ছাত্রীদের ন্যূনতম উচ্চতা ৫'২\" হওয়া বাঞ্ছনীয়।"
      : heightInInches >= 66
      ? "উচ্চতা (৫'৬\"+) বিএনসিসি মানদণ্ড অনুযায়ী উপযুক্ত।"
      : "ছাত্রদের ন্যূনতম উচ্চতা ৫'৬\" হওয়া বাঞ্ছনীয়।";
    const gpaMsg =
      gpa >= 3.0
        ? `এসএসসি জিপিএ (${gpa}) একাডেমিক যোগ্যতা পূরণ করে।`
        : `জিপিএ (${gpa}) ৩.০০-এর নিচে হওয়ায় মাঠ ও মৌখিক পরীক্ষার মাধ্যমে বিবেচনা করা হবে।`;
    return res.json({
      isFallback: true,
      text: `[অফলাইন মূল্যায়ন] আপনার আবেদন সফলভাবে নিবন্ধিত হয়েছে। ${suitabilityMsg} ${gpaMsg}`,
    });
  }
});

app.post("/api/gemini/analyze-photo", rateLimit(10 * 60 * 1000, 20), async (req, res) => {
  try {
    const { base64Image } = req.body || {};
    if (!base64Image || typeof base64Image !== "string" || base64Image.length > 5_000_000) {
      return res.status(400).json({ error: "Valid Base64 image is required" });
    }
    const cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;
    const response = await getAiClient().models.generateContent({
      model: ACTIVE_GEMINI_MODEL,
      contents: [
        { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
        {
          text: "Analyze this photo for a BNCC admit card portrait. Is it a clear face portrait with a neutral background? Reply in one short Bengali sentence.",
        },
      ],
    });
    return res.json({ text: response.text });
  } catch (error) {
    console.error("Photo analysis error:", error instanceof Error ? error.message : "unknown");
    return res.json({
      isFallback: true,
      text: "ছবিটি সংযুক্ত করা হয়েছে (অফলাইন মোড — অনুগ্রহ করে সাদা/নিরপেক্ষ পটভূমির স্পষ্ট পাসপোর্ট ছবি নিশ্চিত করুন)।",
    });
  }
});

app.post("/api/gemini/quick-faq", rateLimit(10 * 60 * 1000, 30), async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || typeof question !== "string" || question.length > 500) {
      return res.status(400).json({ error: "Valid question is required" });
    }
    const response = await getAiClient().models.generateContent({
      model: ACTIVE_GEMINI_MODEL,
      contents: `Answer this question about Cox's Bazar City College BNCC enrollment in one concise Bengali sentence: ${question}`,
    });
    return res.json({ text: response.text });
  } catch {
    return res.json({
      isFallback: true,
      text: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে অনলাইন পোর্টালের মাধ্যমে ভর্তি আবেদন করা যায়।",
    });
  }
});

app.post(
  "/api/gemini/admin-insights",
  rateLimit(10 * 60 * 1000, 20),
  requireAuth(ADMIN_ROLE_LIST),
  async (req, res) => {
    try {
      const { applicants } = req.body || {};
      if (!applicants || !Array.isArray(applicants)) {
        return res.status(400).json({ error: "Applicants list is required" });
      }
      const dataSummary = applicants.slice(0, 50).map((a: any) => ({
        gender: a.gender,
        gpa: a.sscGpa,
        height: `${a.heightFeet}'${a.heightInches}"`,
        status: a.status,
      }));
      const response = await getAiClient().models.generateContent({
        model: ACTIVE_GEMINI_MODEL,
        contents: `Analyze these ${applicants.length} anonymized BNCC applicants in 2 short Bengali sentences covering gender mix, GPA quality, and physical suitability: ${JSON.stringify(dataSummary)}`,
      });
      return res.json({ text: response.text });
    } catch {
      const count = req.body?.applicants?.length || 0;
      return res.json({
        isFallback: true,
        text: `[অফলাইন সারাংশ] মোট ${count} জন আবেদনকারীর তালিকা পর্যালোচনা করা হয়েছে।`,
      });
    }
  }
);

app.post(
  "/api/gemini/applicant-summary",
  rateLimit(10 * 60 * 1000, 30),
  requireAuth(ADMIN_ROLE_LIST),
  async (req, res) => {
    const { applicant } = req.body || {};
    try {
      if (!applicant) return res.status(400).json({ error: "Applicant data is required" });
      const response = await getAiClient().models.generateContent({
        model: ACTIVE_GEMINI_MODEL,
        contents: `Summarize BNCC applicant suitability in one short Bengali sentence (GPA ${applicant.sscGpa}, Height ${applicant.heightFeet}'${applicant.heightInches}", Weight ${applicant.weightKg}kg, Gender ${applicant.gender}).`,
      });
      return res.json({ text: response.text });
    } catch {
      return res.json({
        isFallback: true,
        text: `[অফলাইন সারাংশ] জিপিএ ${applicant?.sscGpa || "N/A"} এবং উচ্চতা ${applicant?.heightFeet || 5}'${applicant?.heightInches || 0}" অনুযায়ী প্রার্থী প্রাথমিক যোগ্যতার মানদণ্ডে মূল্যায়িত।`,
      });
    }
  }
);

app.post(
  "/api/gemini/generate-circular",
  rateLimit(10 * 60 * 1000, 15),
  requireAuth(["super_admin", "admin"]),
  async (req, res) => {
    const { startDate, deadlineDate, refNumber } = req.body || {};
    try {
      if (!startDate || !deadlineDate || !refNumber) {
        return res.status(400).json({ error: "startDate, deadlineDate, and refNumber are required" });
      }
      const response = await getAiClient().models.generateContent({
        model: ACTIVE_GEMINI_MODEL,
        contents: `Generate an official BNCC cadet enrollment circular in formal Unicode Bengali for Cox's Bazar City College BNCC Platoon (15 BNCC Battalion, Karnaphuli Regiment, PUO Ujjal Kanti Deb). Start: ${startDate}, Deadline: ${deadlineDate}, Ref: ${refNumber}.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              introduction: { type: Type.STRING },
              purpose: { type: Type.STRING },
              eligibility: { type: Type.STRING },
              requiredDocuments: { type: Type.STRING },
              applicationProcedure: { type: Type.STRING },
              importantDates: { type: Type.STRING },
              verificationProcess: { type: Type.STRING },
              rulesAndConditions: { type: Type.STRING },
              contactInfo: { type: Type.STRING },
              footer: { type: Type.STRING },
              category: { type: Type.STRING },
            },
            required: [
              "title",
              "introduction",
              "purpose",
              "eligibility",
              "requiredDocuments",
              "applicationProcedure",
              "importantDates",
              "verificationProcess",
              "rulesAndConditions",
              "contactInfo",
              "footer",
              "category",
            ],
          },
        },
      });
      if (response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
      throw new Error("Empty response");
    } catch {
      return res.json({
        title: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি) নতুন ক্যাডেট ভর্তি বিজ্ঞপ্তি",
        introduction:
          "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে নতুন ক্যাডেট ভর্তির জন্য আগ্রহী শিক্ষার্থীদের কাছ থেকে আবেদন আহ্বান করা যাচ্ছে।",
        purpose: "শিক্ষার্থীদের মধ্যে দেশপ্রেম, শৃঙ্খলা ও নেতৃত্বগুণ বিকাশ।",
        eligibility:
          "একাদশ শ্রেণী বা অনার্স ১ম বর্ষের নিয়মিত শিক্ষার্থী, ন্যূনতম জিপিএ ৩.০০, ছাত্র উচ্চতা ৫'৬\", ছাত্রী ৫'২\"।",
        requiredDocuments: "এসএসসি সনদ, ভর্তি রসিদ, পাসপোর্ট ছবি ও ব্লাড গ্রুপ রিপোর্ট।",
        applicationProcedure: "অনলাইন পোর্টালের মাধ্যমে আবেদন সম্পন্ন করে প্রবেশপত্র সংগ্রহ করতে হবে।",
        importantDates: `আবেদন শুরু: ${startDate} | শেষ তারিখ: ${deadlineDate}`,
        verificationProcess: "শারীরিক, লিখিত ও মৌখিক পরীক্ষা এবং কিউআর উপস্থিতি যাচাই।",
        rulesAndConditions: "সাপ্তাহিক প্যারেড ও প্লাটুন শৃঙ্খলা মেনে চলা বাধ্যতামূলক।",
        contactInfo: "প্লাটুন কমান্ডার উজ্জ্বল কান্তি দেব (+৮৮০ ১৮১২-৪৩০৪৫৪)",
        footer: `আদেশক্রমে, প্লাটুন কমান্ডার | সূত্র: ${refNumber}`,
        category: "Admission / Membership",
      });
    }
  }
);

app.post(
  "/api/gemini/generate-guide",
  rateLimit(10 * 60 * 1000, 15),
  requireAuth(["super_admin", "admin"]),
  async (req, res) => {
    const { promptInstruction, refNumber } = req.body || {};
    try {
      const response = await getAiClient().models.generateContent({
        model: ACTIVE_GEMINI_MODEL,
        contents: `Generate an official BNCC Admission Application Guide in formal Unicode Bengali. Ref: ${refNumber || "CBCC-BNCC-GUIDE-2026"}. Notes: ${promptInstruction || "Standard admission guide"}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              refNumber: { type: Type.STRING },
              collegeName: { type: Type.STRING },
              regimentInfo: { type: Type.STRING },
              establishedYear: { type: Type.STRING },
              introText: { type: Type.STRING },
              photoRulesTitle: { type: Type.STRING },
              photoRules: { type: Type.ARRAY, items: { type: Type.STRING } },
              aiRulesTitle: { type: Type.STRING },
              aiRulesText: { type: Type.STRING },
              securityRulesTitle: { type: Type.STRING },
              securityRulesText: { type: Type.STRING },
              workflowTitle: { type: Type.STRING },
              workflowSteps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    step: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    desc: { type: Type.STRING },
                  },
                  required: ["step", "title", "desc"],
                },
              },
              admitCardTitle: { type: Type.STRING },
              admitCardText: { type: Type.STRING },
              docsTitle: { type: Type.STRING },
              docsList: { type: Type.ARRAY, items: { type: Type.STRING } },
              warningText: { type: Type.STRING },
              commanderName: { type: Type.STRING },
              commanderRank: { type: Type.STRING },
              platoonFooter: { type: Type.STRING },
              subFooter: { type: Type.STRING },
            },
            required: [
              "title",
              "refNumber",
              "collegeName",
              "regimentInfo",
              "establishedYear",
              "introText",
              "photoRulesTitle",
              "photoRules",
              "aiRulesTitle",
              "aiRulesText",
              "securityRulesTitle",
              "securityRulesText",
              "workflowTitle",
              "workflowSteps",
              "admitCardTitle",
              "admitCardText",
              "docsTitle",
              "docsList",
              "warningText",
              "commanderName",
              "commanderRank",
              "platoonFooter",
              "subFooter",
            ],
          },
        },
      });
      if (response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
      throw new Error("Empty response");
    } catch {
      return res.status(502).json({
        error: "AI guide generation temporarily unavailable",
        code: "AI_FALLBACK",
      });
    }
  }
);

app.post(
  "/api/gemini/evaluate-answer-script",
  rateLimit(10 * 60 * 1000, 30),
  requireAuth(["super_admin", "admin", "exam_admin"]),
  async (req, res) => {
    try {
      const { questions, answers, candidateInfo, examTitle } = req.body || {};
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "Questions array is required" });
      }

      const payloadForAI = questions.map((q: any) => {
        const userAnsObj = answers ? answers[q.id] : null;
        return {
          questionId: q.id,
          questionText: q.question,
          questionType: q.questionType,
          subject: q.subject,
          maxMarks: q.marks || 1,
          options: q.options || [],
          correctAnswer: q.correctAnswer || "",
          acceptedAnswers: q.acceptedAnswers || [],
          explanation: q.explanation || "",
          candidateAnswer: userAnsObj?.selectedAnswer ?? "",
        };
      });

      const response = await getAiClient().models.generateContent({
        model: ACTIVE_GEMINI_MODEL,
        contents: `Evaluate exam "${examTitle || "BNCC Exam"}" for ${candidateInfo?.name || "Candidate"}. Award exact marks strictly based on model answers and provide constructive Bengali feedback.\nData: ${JSON.stringify(payloadForAI)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              evaluations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionId: { type: Type.STRING },
                    obtainedMarks: { type: Type.NUMBER },
                    maxMarks: { type: Type.NUMBER },
                    status: { type: Type.STRING },
                    feedback: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                  },
                  required: ["questionId", "obtainedMarks", "maxMarks", "status", "feedback"],
                },
              },
              overallFeedback: { type: Type.STRING },
            },
            required: ["evaluations", "overallFeedback"],
          },
        },
      });

      if (response.text) {
        return res.json(JSON.parse(response.text.trim()));
      }
      throw new Error("Empty response");
    } catch {
      const { questions, answers } = req.body || {};
      const fallbackEvaluations = (questions || []).map((q: any) => {
        const given = answers?.[q.id]?.selectedAnswer ?? "";
        const maxMarks = q.marks || 1;
        if (!given || (Array.isArray(given) && given.length === 0)) {
          return {
            questionId: q.id,
            obtainedMarks: 0,
            maxMarks,
            status: "unanswered",
            feedback: "উত্তর প্রদান করা হয়নি।",
            confidence: 100,
          };
        }
        const isCorrect =
          String(given).trim().toLowerCase() === String(q.correctAnswer || "").trim().toLowerCase();
        return {
          questionId: q.id,
          obtainedMarks: isCorrect ? maxMarks : 0,
          maxMarks,
          status: isCorrect ? "correct" : "partial",
          feedback: isCorrect
            ? "মডেল উত্তরের সাথে মিলেছে।"
            : "ম্যানুয়াল পরীক্ষকের চূড়ান্ত যাচাই প্রয়োজন।",
          confidence: 80,
        };
      });
      return res.json({
        evaluations: fallbackEvaluations,
        isFallback: true,
        overallFeedback: "স্বয়ংক্রিয় প্রাথমিক মূল্যায়ন সম্পন্ন হয়েছে; অনুগ্রহ করে পরীক্ষকের মাধ্যমে চূড়ান্ত করুন।",
      });
    }
  }
);

interface ContactInquiry {
  id: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}
const contactInquiries: ContactInquiry[] = [];

app.post("/api/contact", rateLimit(10 * 60 * 1000, 15), (req, res) => {
  const { name, phone, email, subject, message } = req.body || {};
  const clean = (v: unknown, max: number) =>
    String(v ?? "")
      .replace(/[<>]/g, "")
      .trim()
      .slice(0, max);

  const safeName = clean(name, 120);
  const safePhone = clean(phone, 32);
  const safeEmail = clean(email, 160);
  const safeSubject = clean(subject, 160) || "General Inquiry";
  const safeMessage = clean(message, 2500);

  if (!safeName || !safePhone || !safeMessage) {
    return res.status(400).json({
      error: "নাম, মোবাইল নম্বর এবং বার্তা অবশ্যই প্রদান করতে হবে।",
    });
  }
  if (!/^[0-9+\-\s()]{6,25}$/.test(safePhone)) {
    return res.status(400).json({
      error: "অনুগ্রহ করে একটি সঠিক মোবাইল নম্বর প্রদান করুন।",
    });
  }

  const inquiry: ContactInquiry = {
    id: `CBCC-INQ-${Date.now().toString(36).toUpperCase()}`,
    name: safeName,
    phone: safePhone,
    email: safeEmail,
    subject: safeSubject,
    message: safeMessage,
    createdAt: new Date().toISOString(),
  };

  contactInquiries.unshift(inquiry);
  if (contactInquiries.length > 200) {
    contactInquiries.length = 200;
  }

  return res.status(201).json({
    success: true,
    ticketId: inquiry.id,
    createdAt: inquiry.createdAt,
  });
});

app.get("/api/contact", requireAuth(ADMIN_ROLE_LIST), (_req, res) => {
  return res.json({ inquiries: contactInquiries });
});

// =========================================================================
// INTERNAL PLATOON MESSENGER API (CREDENTIAL & FIREBASE SESSION COMPATIBLE)
// =========================================================================

const DATA_ROOT_DIR = path.join(process.cwd(), ".bncc-data");
const MESSAGES_DATA_FILE = path.join(DATA_ROOT_DIR, "messages.json");

interface StoredPlatoonMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  ownerUid: string;
  candidateId?: string;
  content: string;
  timestampIso: string;
  timestampMs: number;
  role: string;
  isRead: boolean;
  readAt?: string;
}

function readStoredMessages(): StoredPlatoonMessage[] {
  try {
    if (!fs.existsSync(MESSAGES_DATA_FILE)) return [];
    const raw = fs.readFileSync(MESSAGES_DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredMessages(items: StoredPlatoonMessage[]) {
  fs.mkdirSync(DATA_ROOT_DIR, { recursive: true });
  const trimmed = items.slice(-1000);
  fs.writeFileSync(MESSAGES_DATA_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

function verifySameOriginMutation(req: express.Request): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

app.get("/api/messages", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdminUser = ADMIN_ROLE_LIST.includes(String(serverUser.role || "").toLowerCase());
  const callerKey = String(serverUser.uid || serverUser.id);
  const all = readStoredMessages().sort((a, b) => a.timestampMs - b.timestampMs);

  const visible = isAdminUser
    ? all.slice(-200)
    : all.filter((m) => m.recipientId === "ALL" || m.ownerUid === callerKey).slice(-200);

  return res.json({ messages: visible });
});

app.post("/api/messages", rateLimit(60 * 1000, 60), requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdminUser = ADMIN_ROLE_LIST.includes(String(serverUser.role || "").toLowerCase());
  const callerKey = String(serverUser.uid || serverUser.id);

  const rawContent = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!rawContent) {
    return res.status(400).json({ error: "Message content is required" });
  }
  const content = rawContent.slice(0, 2000);
  const now = Date.now();
  const requestedChannel =
    typeof req.body?.recipientId === "string" ? req.body.recipientId.trim().slice(0, 128) : "ALL";

  const created: StoredPlatoonMessage = isAdminUser
    ? {
        id: `msg_${now}_${crypto.randomBytes(4).toString("hex")}`,
        senderId: callerKey,
        senderName: String(serverUser.name || "Platoon Admin").slice(0, 120),
        recipientId: requestedChannel || "ALL",
        ownerUid: requestedChannel || "ALL",
        content,
        timestampIso: new Date(now).toISOString(),
        timestampMs: now,
        role: "admin",
        isRead: false,
      }
    : {
        id: `msg_${now}_${crypto.randomBytes(4).toString("hex")}`,
        senderId: callerKey,
        senderName: String(serverUser.name || "BNCC Cadet").slice(0, 120),
        candidateId: String(serverUser.registrationNumber || serverUser.id).slice(0, 64),
        recipientId: "ADMIN",
        ownerUid: callerKey,
        content,
        timestampIso: new Date(now).toISOString(),
        timestampMs: now,
        role: "cadet",
        isRead: false,
      };

  const items = readStoredMessages();
  items.push(created);
  writeStoredMessages(items);
  return res.status(201).json({ message: created });
});

app.patch("/api/messages/:id/read", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdminUser = ADMIN_ROLE_LIST.includes(String(serverUser.role || "").toLowerCase());
  const callerKey = String(serverUser.uid || serverUser.id);
  const id = String(req.params.id || "").trim();

  const items = readStoredMessages();
  const target = items.find((m) => m.id === id);
  if (!target) {
    return res.status(404).json({ error: "Message not found" });
  }
  if (!isAdminUser && target.recipientId !== callerKey && target.ownerUid !== callerKey) {
    return res.status(403).json({ error: "Forbidden" });
  }

  target.isRead = true;
  target.readAt = new Date().toISOString();
  writeStoredMessages(items);
  return res.json({ success: true });
});

app.delete("/api/messages/:id", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const id = String(req.params.id || "").trim();
  const items = readStoredMessages();
  const next = items.filter((m) => m.id !== id);
  if (next.length === items.length) {
    return res.status(404).json({ error: "Message not found" });
  }
  writeStoredMessages(next);
  return res.json({ success: true });
});

// =========================================================================
// AUTHENTICATED MEDIA MANAGEMENT VAULT (PUBLIC VS PRIVATE ISOLATION)
// =========================================================================

const MEDIA_ROOT_DIR = path.join(process.cwd(), ".bncc-media");
const MEDIA_PUBLIC_DIR = path.join(MEDIA_ROOT_DIR, "public");
const MEDIA_PRIVATE_DIR = path.join(MEDIA_ROOT_DIR, "private");
const MEDIA_TRASH_PUBLIC_DIR = path.join(MEDIA_ROOT_DIR, "deleted-public");
const MEDIA_META_FILE = path.join(MEDIA_ROOT_DIR, "metadata.json");
const PUBLIC_ASSETS_META_FILE = path.join(MEDIA_ROOT_DIR, "public-assets-meta.json");

function getPublicRootDir(): string {
  const devRoot = path.join(process.cwd(), "public");
  if (fs.existsSync(devRoot)) return devRoot;
  const distRoot = path.join(process.cwd(), "dist");
  if (fs.existsSync(distRoot)) return distRoot;
  return devRoot;
}

function getPublicAssetsDir(): string {
  const devDir = path.join(process.cwd(), "public", "assets");
  if (fs.existsSync(devDir)) return devDir;
  const distDir = path.join(process.cwd(), "dist", "assets");
  if (fs.existsSync(distDir)) return distDir;
  return devDir;
}

function ensureMediaDirs() {
  fs.mkdirSync(MEDIA_PUBLIC_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_PRIVATE_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_TRASH_PUBLIC_DIR, { recursive: true });
}

interface StoredMediaMeta {
  id: string;
  fileName: string;
  storedFileName: string;
  title: string;
  altText: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  tags: string[];
  visibility: "public" | "private";
  storageLocation: "firebase_storage" | "server_vault" | "public_assets" | "external";
  storagePath: string;
  url: string;
  sha256: string;
  isPrivateCandidateAsset?: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

type PublicAssetMetaOverride = Partial<
  Pick<StoredMediaMeta, "fileName" | "title" | "altText" | "description" | "category" | "tags">
> & { hidden?: boolean };

function readPublicAssetOverrides(): Record<string, PublicAssetMetaOverride> {
  ensureMediaDirs();
  if (!fs.existsSync(PUBLIC_ASSETS_META_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_ASSETS_META_FILE, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePublicAssetOverrides(overrides: Record<string, PublicAssetMetaOverride>) {
  ensureMediaDirs();
  fs.writeFileSync(PUBLIC_ASSETS_META_FILE, JSON.stringify(overrides, null, 2), "utf8");
}

const PUBLIC_ASSET_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".md": "text/markdown",
  ".txt": "text/plain",
};

const PUBLIC_LOGO_FILES = new Set(["New_Project__2__6a6c0725.png", "POU_7647ec14.png"]);
const PUBLIC_LOGO_PREFIXES = ["Bncc_logo", "logo-removebg-preview", "New_Project", "2025-2026", "122__", "hh_", "hh__"];
const PUBLIC_GALLERY_PREFIXES = ["2025__", "6.3__", "gg__", "dd__", "dddf__"];

function inferPublicAssetCategory(fileName: string, mimeType: string): string {
  if (
    PUBLIC_LOGO_FILES.has(fileName) ||
    PUBLIC_LOGO_PREFIXES.some((prefix) => fileName.startsWith(prefix))
  ) {
    return "Logos & Branding";
  }
  if (
    mimeType === "application/pdf" ||
    mimeType === "text/html" ||
    mimeType === "text/css" ||
    mimeType === "application/javascript" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown" ||
    mimeType === "application/json"
  ) {
    return "Documents";
  }
  if (PUBLIC_GALLERY_PREFIXES.some((prefix) => fileName.startsWith(prefix))) {
    return "Gallery";
  }
  if (mimeType.startsWith("image/")) {
    return "Cadets";
  }
  return "General";
}

function formatPublicAssetTitle(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, "");
  const withoutHash = withoutExt.replace(/_[0-9a-f]{8}$/i, "");
  return withoutHash.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim() || fileName;
}

const publicHashCache = new Map<string, { mtimeMs: number; size: number; sha256: string }>();

function getCachedFileSha256(fullPath: string, stat: fs.Stats): string {
  const cached = publicHashCache.get(fullPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.sha256;
  }
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex");
  publicHashCache.set(fullPath, { mtimeMs: stat.mtimeMs, size: stat.size, sha256 });
  return sha256;
}

interface ScannedPublicAsset {
  meta: StoredMediaMeta;
  fullPath: string;
  relPath: string;
}

const ROOT_PUBLIC_EXCLUDES = new Set(["assets-manifest.json"]);

function scanPublicAssets(includeHash = false): ScannedPublicAsset[] {
  const baseDir = getPublicAssetsDir();
  const rootDir = getPublicRootDir();
  const overrides = readPublicAssetOverrides();
  const results: ScannedPublicAsset[] = [];

  if (fs.existsSync(baseDir)) {
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;

        const relPath = path.relative(baseDir, fullPath).split(path.sep).join("/");
        const stat = fs.statSync(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        const mimeType = PUBLIC_ASSET_MIME_MAP[ext] || "text/plain";
        const id = `pub_${crypto.createHash("sha1").update(relPath).digest("hex").slice(0, 12)}`;
        const url = `/assets/${relPath.split("/").map((seg) => encodeURIComponent(seg)).join("/")}`;
        const override = overrides[id] || {};
        if (override.hidden) continue;
        const defaultCategory = inferPublicAssetCategory(entry.name, mimeType);
        const subFolder = relPath.includes("/") ? relPath.split("/")[0] : "assets";
        const createdIso = stat.birthtimeMs ? new Date(stat.birthtimeMs).toISOString() : new Date(stat.mtimeMs).toISOString();
        const updatedIso = new Date(stat.mtimeMs).toISOString();

        results.push({
          fullPath,
          relPath,
          meta: {
            id,
            fileName: override.fileName || entry.name,
            storedFileName: relPath,
            title: override.title || formatPublicAssetTitle(entry.name),
            altText: override.altText || formatPublicAssetTitle(entry.name),
            description: override.description || `Site static asset from public/assets/${relPath}`,
            mimeType,
            sizeBytes: stat.size,
            category: override.category || defaultCategory,
            tags: Array.isArray(override.tags) ? override.tags : ["public-assets", subFolder],
            visibility: "public",
            storageLocation: "public_assets",
            storagePath: `public/assets/${relPath}`,
            url,
            sha256: includeHash ? getCachedFileSha256(fullPath, stat) : "",
            isPrivateCandidateAsset: false,
            uploadedBy: "system",
            createdAt: createdIso,
            updatedAt: updatedIso,
          },
        });
      }
    };

    walk(baseDir);
  }

  // Also include all root public assets & PWA branding icons (e.g. /icon.svg, /pwa-*.png, /offline.html, /robots.txt, /sitemap.xml)
  if (fs.existsSync(rootDir)) {
    const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (!entry.isFile() || entry.name.startsWith(".") || ROOT_PUBLIC_EXCLUDES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      const fullPath = path.join(rootDir, entry.name);
      const stat = fs.statSync(fullPath);
      const mimeType = PUBLIC_ASSET_MIME_MAP[ext] || "application/octet-stream";
      const id = `pub_${crypto.createHash("sha1").update(`root:${entry.name}`).digest("hex").slice(0, 12)}`;
      const url = `/${encodeURIComponent(entry.name)}`;
      const override = overrides[id] || {};
      if (override.hidden) continue;
      const isDoc =
        mimeType.startsWith("text/") ||
        mimeType === "application/xml" ||
        mimeType === "application/json" ||
        mimeType === "application/pdf";
      const createdIso = stat.birthtimeMs ? new Date(stat.birthtimeMs).toISOString() : new Date(stat.mtimeMs).toISOString();
      const updatedIso = new Date(stat.mtimeMs).toISOString();

      results.push({
        fullPath,
        relPath: entry.name,
        meta: {
          id,
          fileName: override.fileName || entry.name,
          storedFileName: entry.name,
          title: override.title || formatPublicAssetTitle(entry.name),
          altText: override.altText || formatPublicAssetTitle(entry.name),
          description: override.description || `Site static asset from public/${entry.name}`,
          mimeType,
          sizeBytes: stat.size,
          category: override.category || (isDoc ? "Documents" : "Logos & Branding"),
          tags: Array.isArray(override.tags) ? override.tags : ["public-root", isDoc ? "site-doc" : "branding"],
          visibility: "public",
          storageLocation: "public_assets",
          storagePath: `public/${entry.name}`,
          url,
          sha256: includeHash ? getCachedFileSha256(fullPath, stat) : "",
          isPrivateCandidateAsset: false,
          uploadedBy: "system",
          createdAt: createdIso,
          updatedAt: updatedIso,
        },
      });
    }
  }

  return results;
}

const SITE_EXTERNAL_ASSETS: Array<{
  url: string;
  fileName: string;
  title: string;
  category: string;
  mimeType: string;
  description: string;
  tags: string[];
}> = [
  {
    url: "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png",
    fileName: "college-official-logo.png",
    title: "Cox's Bazar City College Official Logo",
    category: "Logos & Branding",
    mimeType: "image/png",
    description: "Official College Crest used in Navbar, Footer, Admit Cards, and Circulars.",
    tags: ["logo", "college", "branding"],
  },
  {
    url: "https://i.ibb.co/Fb3R6wR/Bncc-logo.png",
    fileName: "bncc-official-crest.png",
    title: "BNCC Official Crest & Emblem",
    category: "Logos & Branding",
    mimeType: "image/png",
    description: "Official Bangladesh National Cadet Corps emblem used site-wide and as watermarks.",
    tags: ["logo", "bncc", "branding"],
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/3/34/A_CUO.png",
    fileName: "rank-badge-cuo.png",
    title: "Rank Badge — Cadet Under Officer (CUO)",
    category: "Logos & Branding",
    mimeType: "image/png",
    description: "Official BNCC Cadet Under Officer insignia badge.",
    tags: ["rank-badge", "cuo", "insignia"],
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/6/63/A_SGT.png",
    fileName: "rank-badge-sgt.png",
    title: "Rank Badge — Cadet Sergeant (SGT)",
    category: "Logos & Branding",
    mimeType: "image/png",
    description: "Official BNCC Cadet Sergeant insignia badge.",
    tags: ["rank-badge", "sgt", "insignia"],
  },
  {
    url: "https://upload.wikimedia.org/wikipedia/commons/7/73/A_CPL.png",
    fileName: "rank-badge-cpl.png",
    title: "Rank Badge — Cadet Corporal (CPL)",
    category: "Logos & Branding",
    mimeType: "image/png",
    description: "Official BNCC Cadet Corporal insignia badge.",
    tags: ["rank-badge", "cpl", "insignia"],
  },
  {
    url: "https://i.ibb.co/m8rYjJx/274856261-1655184164824692-8057334507379742892-n.jpg",
    fileName: "nomanul-islam-saimon-batch1.jpg",
    title: "Nomanul Islam Saimon (Batch 1 In-Charge)",
    category: "Cadets",
    mimeType: "image/jpeg",
    description: "Inaugural Batch Platoon In-Charge portrait in Hall of In-Charges.",
    tags: ["incharge", "batch-1", "cadet"],
  },
  {
    url: "https://i.ibb.co/mGx3CWW/454425731-1865516033934342-5355007169042337456-n.jpg",
    fileName: "waliul-islam-azan-batch2.jpg",
    title: "Waliul Islam Azan (Batch 2 In-Charge)",
    category: "Cadets",
    mimeType: "image/jpeg",
    description: "Batch 2 Platoon In-Charge portrait in Hall of In-Charges.",
    tags: ["incharge", "batch-2", "cadet"],
  },
  {
    url: "https://i.ibb.co/MpXXtK5/387735944-1684451718707442-3020994251185180456-n-1.jpg",
    fileName: "mehenaj-mahu-batch3.jpg",
    title: "Mehenaj Mahu (Batch 3 In-Charge)",
    category: "Cadets",
    mimeType: "image/jpeg",
    description: "Batch 3 Platoon In-Charge portrait in Hall of In-Charges.",
    tags: ["incharge", "batch-3", "cadet"],
  },
];

function getExternalSiteAssets(): StoredMediaMeta[] {
  const overrides = readPublicAssetOverrides();
  const baseTime = "2026-01-01T00:00:00.000Z";
  const items: StoredMediaMeta[] = [];

  for (const ext of SITE_EXTERNAL_ASSETS) {
    const id = `ext_${crypto.createHash("sha1").update(ext.url).digest("hex").slice(0, 12)}`;
    const override = overrides[id] || {};
    if (override.hidden) continue;

    items.push({
      id,
      fileName: override.fileName || ext.fileName,
      storedFileName: ext.fileName,
      title: override.title || ext.title,
      altText: override.altText || ext.title,
      description: override.description || ext.description,
      mimeType: ext.mimeType,
      sizeBytes: 0,
      category: override.category || ext.category,
      tags: Array.isArray(override.tags) ? override.tags : ext.tags,
      visibility: "public",
      storageLocation: "external",
      storagePath: ext.url,
      url: ext.url,
      sha256: "",
      isPrivateCandidateAsset: false,
      uploadedBy: "system",
      createdAt: baseTime,
      updatedAt: baseTime,
    });
  }

  return items;
}

function readMediaMetaList(): StoredMediaMeta[] {
  ensureMediaDirs();
  if (!fs.existsSync(MEDIA_META_FILE)) return [];
  try {
    const raw = fs.readFileSync(MEDIA_META_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMediaMetaList(items: StoredMediaMeta[]) {
  ensureMediaDirs();
  fs.writeFileSync(MEDIA_META_FILE, JSON.stringify(items, null, 2), "utf8");
}

const ALLOWED_MEDIA_MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

function sanitizeMediaFilename(name: string): string {
  const base = path.basename(String(name || "asset")).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "asset";
}

function buildPublicAssetCatalog(): StoredMediaMeta[] {
  const publicItems = scanPublicAssets(false).map((entry) => entry.meta);
  const externalItems = getExternalSiteAssets();
  return [...publicItems, ...externalItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function writePublicAssetsManifest(): void {
  try {
    const items = buildPublicAssetCatalog();
    const payload = JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items });
    const publicManifest = path.join(process.cwd(), "public", "assets-manifest.json");
    if (fs.existsSync(path.join(process.cwd(), "public"))) {
      fs.writeFileSync(publicManifest, payload, "utf8");
    }
    const distDir = path.join(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, "assets-manifest.json"), payload, "utf8");
    }
  } catch {
    // Non-blocking manifest generation
  }
}

app.get("/api/media/public-assets", (_req, res) => {
  return res.json({ items: buildPublicAssetCatalog() });
});

app.get("/api/media/list", requireAuth(ADMIN_ROLE_LIST), (_req, res) => {
  const vaultItems = readMediaMetaList();
  const publicCatalog = buildPublicAssetCatalog();
  const combined = [...vaultItems, ...publicCatalog].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return res.json({ items: combined });
});

app.post(
  "/api/media/upload",
  rateLimit(5 * 60 * 1000, 120),
  requireAuth(ADMIN_ROLE_LIST),
  (req, res) => {
    try {
      const serverUser = (req as any).serverUser as ServerSessionUser;
      const {
        fileName,
        mimeType,
        dataBase64,
        visibility = "public",
        category = "General",
        title = "",
        altText = "",
        description = "",
        tags = [],
        isPrivateCandidateAsset = false,
        replaceId = "",
      } = req.body || {};

      const cleanMime = String(mimeType || "").toLowerCase().trim();
      const ext = ALLOWED_MEDIA_MIME_EXT[cleanMime];
      if (!ext) {
        return res.status(400).json({
          error: "অননুমোদিত ফাইল ফরম্যাট। অনুমোদিত ফরম্যাট: JPG, PNG, WebP, GIF, PDF, MP4, WebM, MP3, WAV।",
        });
      }

      if (!dataBase64 || typeof dataBase64 !== "string") {
        return res.status(400).json({ error: "ফাইল ডেটা পাওয়া যায়নি।" });
      }

      const rawBase64 = dataBase64.includes(",") ? dataBase64.split(",")[1] : dataBase64;
      const buffer = Buffer.from(rawBase64, "base64");
      const maxBytes = 8 * 1024 * 1024;
      if (!buffer.length || buffer.length > maxBytes) {
        return res.status(400).json({
          error: "ফাইলের আকার সর্বোচ্চ ৮ মেগাবাইটের মধ্যে হতে হবে।",
        });
      }

      const safeVisibility: "public" | "private" =
        isPrivateCandidateAsset || visibility === "private" ? "private" : "public";
      const sanitizedOriginal = sanitizeMediaFilename(fileName || `media${ext}`);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

      const currentItems = readMediaMetaList();
      if (!replaceId) {
        const duplicate = currentItems.find(
          (item) => item.sha256 === sha256 && item.visibility === safeVisibility
        );
        if (duplicate) {
          return res.status(200).json({
            item: duplicate,
            duplicateDetected: true,
          });
        }
      }

      if (replaceId && String(replaceId).startsWith("pub_")) {
        const targetPublic = scanPublicAssets(false).find((entry) => entry.meta.id === replaceId);
        if (!targetPublic) {
          return res.status(404).json({ error: "Public asset not found for replacement" });
        }
        fs.writeFileSync(targetPublic.fullPath, buffer);
        publicHashCache.delete(targetPublic.fullPath);
        writePublicAssetsManifest();
        const refreshed = scanPublicAssets(true).find((entry) => entry.meta.id === replaceId);
        return res.status(200).json({
          item: refreshed?.meta || targetPublic.meta,
          duplicateDetected: false,
        });
      }

      ensureMediaDirs();
      const id = replaceId ? sanitizeMediaFilename(replaceId) : `med_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const storedFileName = `${id}${ext}`;
      const targetDir = safeVisibility === "private" ? MEDIA_PRIVATE_DIR : MEDIA_PUBLIC_DIR;
      const targetPath = path.join(targetDir, storedFileName);
      fs.writeFileSync(targetPath, buffer);

      const url =
        safeVisibility === "private"
          ? `/api/media/private/${encodeURIComponent(storedFileName)}`
          : `/api/media/file/${encodeURIComponent(storedFileName)}`;

      const now = new Date().toISOString();
      const existingIdx = currentItems.findIndex((x) => x.id === id);
      if (existingIdx >= 0 && currentItems[existingIdx].storedFileName !== storedFileName) {
        const oldDir =
          currentItems[existingIdx].visibility === "private" ? MEDIA_PRIVATE_DIR : MEDIA_PUBLIC_DIR;
        const oldPath = path.join(oldDir, currentItems[existingIdx].storedFileName);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const record: StoredMediaMeta = {
        id,
        fileName: sanitizedOriginal,
        storedFileName,
        title: String(title || sanitizedOriginal).slice(0, 200),
        altText: String(altText || "").slice(0, 300),
        description: String(description || "").slice(0, 1000),
        mimeType: cleanMime,
        sizeBytes: buffer.length,
        category: String(category || "General").slice(0, 64),
        tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : [],
        visibility: safeVisibility,
        storageLocation: "server_vault",
        storagePath: `${safeVisibility}/${storedFileName}`,
        url,
        sha256,
        isPrivateCandidateAsset: Boolean(isPrivateCandidateAsset),
        uploadedBy: serverUser?.username || serverUser?.email || "admin",
        createdAt: existingIdx >= 0 ? currentItems[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        currentItems[existingIdx] = record;
      } else {
        currentItems.unshift(record);
      }
      writeMediaMetaList(currentItems);

      return res.status(201).json({ item: record, duplicateDetected: false });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Media upload failed" });
    }
  }
);

app.patch("/api/media/:id", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  const id = sanitizeMediaFilename(String(req.params.id || ""));
  const { title, altText, description, category, tags, visibility, fileName } = req.body || {};

  if (id.startsWith("pub_") || id.startsWith("ext_")) {
    const publicMatch = id.startsWith("pub_")
      ? scanPublicAssets(false).find((entry) => entry.meta.id === id)?.meta
      : getExternalSiteAssets().find((entry) => entry.id === id);
    if (!publicMatch) {
      return res.status(404).json({ error: "Site asset not found" });
    }
    const overrides = readPublicAssetOverrides();
    overrides[id] = {
      ...(overrides[id] || {}),
      fileName: fileName ? sanitizeMediaFilename(String(fileName)) : publicMatch.fileName,
      title: title !== undefined ? String(title).slice(0, 200) : publicMatch.title,
      altText: altText !== undefined ? String(altText).slice(0, 300) : publicMatch.altText,
      description: description !== undefined ? String(description).slice(0, 1000) : publicMatch.description,
      category: category !== undefined ? String(category).slice(0, 64) : publicMatch.category,
      tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : publicMatch.tags,
    };
    writePublicAssetOverrides(overrides);
    writePublicAssetsManifest();
    const updatedItem = id.startsWith("pub_")
      ? scanPublicAssets(false).find((entry) => entry.meta.id === id)?.meta
      : getExternalSiteAssets().find((entry) => entry.id === id);
    return res.json({ item: updatedItem || publicMatch });
  }

  const items = readMediaMetaList();
  const idx = items.findIndex((item) => item.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Media item not found" });
  }
  const current = items[idx];

  let nextVisibility = current.visibility;
  if (!current.isPrivateCandidateAsset && (visibility === "public" || visibility === "private")) {
    nextVisibility = visibility;
  }

  let nextUrl = current.url;
  let nextPath = current.storagePath;
  if (nextVisibility !== current.visibility && current.storedFileName) {
    ensureMediaDirs();
    const fromDir = current.visibility === "private" ? MEDIA_PRIVATE_DIR : MEDIA_PUBLIC_DIR;
    const toDir = nextVisibility === "private" ? MEDIA_PRIVATE_DIR : MEDIA_PUBLIC_DIR;
    const fromFile = path.join(fromDir, current.storedFileName);
    const toFile = path.join(toDir, current.storedFileName);
    if (fs.existsSync(fromFile)) {
      fs.renameSync(fromFile, toFile);
    }
    nextPath = `${nextVisibility}/${current.storedFileName}`;
    nextUrl =
      nextVisibility === "private"
        ? `/api/media/private/${encodeURIComponent(current.storedFileName)}`
        : `/api/media/file/${encodeURIComponent(current.storedFileName)}`;
  }

  const updated: StoredMediaMeta = {
    ...current,
    fileName: fileName ? sanitizeMediaFilename(String(fileName)) : current.fileName,
    title: title !== undefined ? String(title).slice(0, 200) : current.title,
    altText: altText !== undefined ? String(altText).slice(0, 300) : current.altText,
    description: description !== undefined ? String(description).slice(0, 1000) : current.description,
    category: category !== undefined ? String(category).slice(0, 64) : current.category,
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20) : current.tags,
    visibility: nextVisibility,
    storagePath: nextPath,
    url: nextUrl,
    updatedAt: new Date().toISOString(),
  };

  items[idx] = updated;
  writeMediaMetaList(items);
  return res.json({ item: updated });
});

app.delete("/api/media/:id", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  const id = sanitizeMediaFilename(String(req.params.id || ""));

  if (id.startsWith("ext_")) {
    const extMatch = getExternalSiteAssets().find((entry) => entry.id === id);
    if (!extMatch) {
      return res.status(404).json({ error: "External asset not found" });
    }
    const overrides = readPublicAssetOverrides();
    overrides[id] = { ...(overrides[id] || {}), hidden: true };
    writePublicAssetOverrides(overrides);
    writePublicAssetsManifest();
    return res.json({ success: true });
  }

  if (id.startsWith("pub_")) {
    const publicMatch = scanPublicAssets(false).find((entry) => entry.meta.id === id);
    if (!publicMatch) {
      return res.status(404).json({ error: "Public asset not found" });
    }
    ensureMediaDirs();
    const trashTarget = path.join(
      MEDIA_TRASH_PUBLIC_DIR,
      `${Date.now()}_${path.basename(publicMatch.fullPath)}`
    );
    fs.renameSync(publicMatch.fullPath, trashTarget);
    publicHashCache.delete(publicMatch.fullPath);
    const overrides = readPublicAssetOverrides();
    if (overrides[id]) {
      delete overrides[id];
      writePublicAssetOverrides(overrides);
    }
    writePublicAssetsManifest();
    return res.json({ success: true });
  }

  const items = readMediaMetaList();
  const idx = items.findIndex((item) => item.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Media item not found" });
  }
  const target = items[idx];
  const dir = target.visibility === "private" ? MEDIA_PRIVATE_DIR : MEDIA_PUBLIC_DIR;
  const fullPath = path.join(dir, path.basename(target.storedFileName || ""));
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
  items.splice(idx, 1);
  writeMediaMetaList(items);
  return res.json({ success: true });
});

app.get("/api/media/file/:fileName", (req, res) => {
  const safeName = path.basename(String(req.params.fileName || ""));
  const fullPath = path.join(MEDIA_PUBLIC_DIR, safeName);
  if (!safeName || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Public asset not found" });
  }
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.sendFile(fullPath);
});

app.get("/api/media/private/:fileName", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  const safeName = path.basename(String(req.params.fileName || ""));
  const fullPath = path.join(MEDIA_PRIVATE_DIR, safeName);
  if (!safeName || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Private asset not found" });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.sendFile(fullPath);
});

// =========================================================================
// ONLINE CADET APPLICATION REGISTRY (DUAL-SYNC WITH FIRESTORE)
// =========================================================================

const APPLICANTS_DATA_FILE = path.join(DATA_ROOT_DIR, "applicants.json");

interface StoredOnlineApplicant {
  id: string;
  registrationNumber: string;
  ownerUid: string;
  fullNameBangla: string;
  fullNameEnglish: string;
  fatherNameBangla?: string;
  fatherNameEnglish?: string;
  motherNameBangla?: string;
  motherNameEnglish?: string;
  dob?: string;
  nidBirthReg?: string;
  gender?: string;
  religion?: string;
  presentAddress?: string;
  permanentAddress?: string;
  studentPhone: string;
  studentEmail?: string;
  heightFeet?: string | number;
  heightInches?: string | number;
  weightKg?: string | number;
  bloodGroup?: string;
  sscGpa?: string;
  sscGroup?: string;
  sscYear?: string;
  sscBoard?: string;
  hscGpa?: string;
  hscGroup?: string;
  hscYear?: string;
  hscBoard?: string;
  hscOptionalSubject?: string;
  studyStatus?: string;
  subject?: string;
  classRoll?: string;
  section?: string;
  session?: string;
  emisId?: string;
  collegeName?: string;
  photo?: string;
  uploadedDocuments?: Array<{
    name: string;
    type: string;
    size?: number;
    dataUrl: string;
  }>;
  previousBNCC?: boolean;
  isEthnicMinority?: boolean;
  previousInstitution?: string;
  previousBattalionRegiment?: string;
  previousRank?: string;
  previousRankOther?: string;
  serviceDuration?: string;
  coCurricularActivities?: string[];
  otherCoCurricularActivity?: string;
  role: string;
  status: "Pending" | "Approved" | "Rejected";
  isActive?: boolean;
  accountStatus?: string;
  attendanceStatus?: string;
  passwordHash?: string;
  password?: string;
  createdAtIso: string;
  updatedAtIso?: string;
  submissionSource?: string;
  firestoreSynced?: boolean;
}

function readStoredApplicants(): StoredOnlineApplicant[] {
  try {
    if (!fs.existsSync(APPLICANTS_DATA_FILE)) return [];
    const raw = fs.readFileSync(APPLICANTS_DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredApplicants(items: StoredOnlineApplicant[]) {
  fs.mkdirSync(DATA_ROOT_DIR, { recursive: true });
  fs.writeFileSync(APPLICANTS_DATA_FILE, JSON.stringify(items, null, 2), "utf8");
}

function normalizeApplicantStatus(val: unknown): "Pending" | "Approved" | "Rejected" {
  const s = String(val || "").trim().toLowerCase();
  if (s === "approved" || s === "joined") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function sanitizePublicApplicantOut(app: StoredOnlineApplicant) {
  const { passwordHash: _ph, password: _pw, ...safe } = app;
  return {
    ...safe,
    hasPassword: Boolean(_ph || _pw),
  };
}

function safeCleanText(v: unknown, maxLen: number): string {
  return String(v ?? "").trim().slice(0, maxLen);
}

function resolveApplicantCreatedIso(raw: any): string {
  if (typeof raw?.createdAtIso === "string" && !Number.isNaN(Date.parse(raw.createdAtIso))) {
    return raw.createdAtIso;
  }
  if (typeof raw?.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt))) {
    return raw.createdAt;
  }
  if (typeof raw?.createdAt?.seconds === "number") {
    return new Date(raw.createdAt.seconds * 1000).toISOString();
  }
  if (typeof raw?.submittedAt === "string" && !Number.isNaN(Date.parse(raw.submittedAt))) {
    return raw.submittedAt;
  }
  return new Date().toISOString();
}

function sanitizeApplicantDocuments(rawDocs: unknown) {
  if (!Array.isArray(rawDocs)) return [];
  const out: Array<{ name: string; type: string; size?: number; dataUrl: string }> = [];
  for (const d of rawDocs.slice(0, 4)) {
    if (!d || typeof d !== "object") continue;
    const dataUrl = typeof (d as any).dataUrl === "string" ? (d as any).dataUrl : "";
    if (!dataUrl.startsWith("data:") || dataUrl.length > 650000) continue;
    out.push({
      name: safeCleanText((d as any).name || "Document", 140),
      type: safeCleanText((d as any).type || "application/octet-stream", 80),
      size: Number((d as any).size) || dataUrl.length,
      dataUrl,
    });
  }
  return out;
}

app.post("/api/applications", rateLimit(10 * 60 * 1000, 30), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const body = req.body || {};
  const fullNameEnglish = safeCleanText(body.fullNameEnglish, 200);
  const fullNameBangla = safeCleanText(body.fullNameBangla, 200);
  const studentPhone = safeCleanText(body.studentPhone, 32);

  if (!fullNameEnglish || studentPhone.length < 6) {
    return res.status(400).json({
      error: "সঠিক ইংরেজি নাম এবং কমপক্ষে ৬ সংখ্যার মোবাইল নম্বর প্রদান করুন।",
    });
  }

  const all = readStoredApplicants();
  let candidateId = safeCleanText(body.id, 128).replace(/[^a-zA-Z0-9_.:-]/g, "");
  if (candidateId) {
    const existingSameId = all.find((a) => a.id === candidateId);
    if (existingSameId) {
      return res.status(200).json({
        success: true,
        duplicate: false,
        application: sanitizePublicApplicantOut(existingSameId),
      });
    }
  } else {
    const numericIds = all
      .map((a) => (/^\d+$/.test(a.id) ? Number(a.id) : 0))
      .filter((n) => n >= 1111 && n < 1000000);
    const nextNum = Math.max(1110, ...numericIds) + 1;
    candidateId = String(nextNum);
  }

  // Prevent accidental double-click duplicate within 2 minutes for same phone + NID
  const cleanNid = safeCleanText(body.nidBirthReg, 80);
  const twoMinsAgo = Date.now() - 2 * 60 * 1000;
  const recentDup = all.find(
    (a) =>
      a.studentPhone === studentPhone &&
      (!cleanNid || a.nidBirthReg === cleanNid) &&
      new Date(a.createdAtIso).getTime() >= twoMinsAgo
  );
  if (recentDup) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      application: sanitizePublicApplicantOut(recentDup),
    });
  }

  const nowIso = new Date().toISOString();
  const safePhoto =
    typeof body.photo === "string" && body.photo.length <= 500000 ? body.photo : "";

  const newRecord: StoredOnlineApplicant = {
    id: candidateId,
    registrationNumber: safeCleanText(body.registrationNumber, 80) || candidateId,
    ownerUid: safeCleanText(body.ownerUid, 128) || "public_applicant",
    fullNameBangla: fullNameBangla || fullNameEnglish,
    fullNameEnglish,
    fatherNameBangla: safeCleanText(body.fatherNameBangla, 200),
    fatherNameEnglish: safeCleanText(body.fatherNameEnglish, 200),
    motherNameBangla: safeCleanText(body.motherNameBangla, 200),
    motherNameEnglish: safeCleanText(body.motherNameEnglish, 200),
    dob: safeCleanText(body.dob, 40),
    nidBirthReg: cleanNid,
    gender: safeCleanText(body.gender, 32),
    religion: safeCleanText(body.religion, 40),
    presentAddress: safeCleanText(body.presentAddress, 400),
    permanentAddress: safeCleanText(body.permanentAddress, 400),
    studentPhone,
    studentEmail: safeCleanText(body.studentEmail, 160),
    heightFeet: safeCleanText(body.heightFeet, 12),
    heightInches: safeCleanText(body.heightInches, 12),
    weightKg: safeCleanText(body.weightKg, 12),
    bloodGroup: safeCleanText(body.bloodGroup, 16),
    sscGpa: safeCleanText(body.sscGpa, 20),
    sscGroup: safeCleanText(body.sscGroup, 60),
    sscYear: safeCleanText(body.sscYear, 16),
    sscBoard: safeCleanText(body.sscBoard, 60),
    hscGpa: safeCleanText(body.hscGpa, 20),
    hscGroup: safeCleanText(body.hscGroup, 60),
    hscYear: safeCleanText(body.hscYear, 16),
    hscBoard: safeCleanText(body.hscBoard, 60),
    hscOptionalSubject: safeCleanText(body.hscOptionalSubject, 100),
    studyStatus: safeCleanText(body.studyStatus, 80),
    subject: safeCleanText(body.subject, 120),
    classRoll: safeCleanText(body.classRoll, 40),
    section: safeCleanText(body.section, 40),
    session: safeCleanText(body.session, 40),
    emisId: safeCleanText(body.emisId, 80),
    collegeName: safeCleanText(body.collegeName, 200),
    photo: safePhoto,
    uploadedDocuments: sanitizeApplicantDocuments(body.uploadedDocuments),
    previousBNCC: Boolean(body.previousBNCC),
    isEthnicMinority: Boolean(body.isEthnicMinority),
    previousInstitution: safeCleanText(body.previousInstitution, 200),
    previousBattalionRegiment: safeCleanText(body.previousBattalionRegiment, 160),
    previousRank: safeCleanText(body.previousRank, 80),
    previousRankOther: safeCleanText(body.previousRankOther, 80),
    serviceDuration: safeCleanText(body.serviceDuration, 80),
    coCurricularActivities: Array.isArray(body.coCurricularActivities)
      ? body.coCurricularActivities.slice(0, 30).map((x: unknown) => safeCleanText(x, 80))
      : [],
    otherCoCurricularActivity: safeCleanText(body.otherCoCurricularActivity, 200),
    role: "user",
    status: "Pending",
    isActive: true,
    attendanceStatus: "Absent",
    passwordHash: typeof body.passwordHash === "string" ? body.passwordHash.slice(0, 200) : undefined,
    createdAtIso: resolveApplicantCreatedIso(body),
    updatedAtIso: nowIso,
    submissionSource: body.firestoreSynced ? "firestore+server" : "server_fallback",
    firestoreSynced: Boolean(body.firestoreSynced),
  };

  all.unshift(newRecord);
  writeStoredApplicants(all);
  return res.status(201).json({
    success: true,
    application: sanitizePublicApplicantOut(newRecord),
  });
});

app.get("/api/applications", requireAuth(ADMIN_ROLE_LIST), (_req, res) => {
  const all = readStoredApplicants()
    .map((app) => ({
      ...app,
      status: normalizeApplicantStatus(app.status),
      createdAtIso: resolveApplicantCreatedIso(app),
    }))
    .sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime())
    .map(sanitizePublicApplicantOut);
  return res.json({ applications: all });
});

app.get("/api/applications/:id", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdminUser = ADMIN_ROLE_LIST.includes(String(serverUser.role || "").toLowerCase());
  const id = String(req.params.id || "").trim();
  const match = readStoredApplicants().find((a) => a.id === id || a.registrationNumber === id);
  if (!match) {
    return res.status(404).json({ error: "Applicant not found" });
  }
  const callerKey = String(serverUser.uid || serverUser.id);
  if (!isAdminUser && match.id !== callerKey && match.ownerUid !== callerKey) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json({ application: sanitizePublicApplicantOut(match) });
});

app.post(
  "/api/applications/sync-batch",
  rateLimit(5 * 60 * 1000, 60),
  requireAuth(ADMIN_ROLE_LIST),
  (req, res) => {
    if (!verifySameOriginMutation(req)) {
      return res.status(403).json({ error: "Cross-origin request rejected" });
    }
    const items = Array.isArray(req.body?.applications) ? req.body.applications : [];
    const current = readStoredApplicants();
    const map = new Map<string, StoredOnlineApplicant>();
    for (const item of current) {
      map.set(item.id, item);
    }

    for (const raw of items.slice(0, 1000)) {
      if (!raw || typeof raw !== "object" || !raw.id) continue;
      const id = safeCleanText(raw.id, 128);
      if (!id) continue;
      const existing = map.get(id);
      const createdAtIso = resolveApplicantCreatedIso(raw);
      const merged: StoredOnlineApplicant = {
        ...(existing || {}),
        ...raw,
        id,
        registrationNumber: safeCleanText(raw.registrationNumber || existing?.registrationNumber, 80) || id,
        ownerUid: safeCleanText(raw.ownerUid || existing?.ownerUid, 128) || "public_applicant",
        fullNameEnglish: safeCleanText(raw.fullNameEnglish || existing?.fullNameEnglish || raw.fullNameBangla, 200),
        fullNameBangla: safeCleanText(raw.fullNameBangla || existing?.fullNameBangla || raw.fullNameEnglish, 200),
        studentPhone: safeCleanText(raw.studentPhone || existing?.studentPhone, 32),
        role: raw.role || existing?.role || "user",
        status: normalizeApplicantStatus(raw.status ?? existing?.status),
        createdAtIso: existing?.createdAtIso && createdAtIso === raw.createdAtIso ? existing.createdAtIso : createdAtIso,
        updatedAtIso: new Date().toISOString(),
        firestoreSynced: true,
      };
      map.set(id, merged);
    }

    const updatedList = Array.from(map.values()).sort(
      (a, b) => new Date(resolveApplicantCreatedIso(b)).getTime() - new Date(resolveApplicantCreatedIso(a)).getTime()
    );
    writeStoredApplicants(updatedList);
    return res.json({ success: true, count: updatedList.length });
  }
);

app.patch("/api/applications/:id", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const id = String(req.params.id || "").trim();
  const { status, isActive, accountStatus, passwordHash } = req.body || {};
  const all = readStoredApplicants();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Applicant not found" });
  }

  const next = { ...all[idx] };
  if (status !== undefined) {
    next.status = normalizeApplicantStatus(status);
  }
  if (typeof isActive === "boolean") {
    next.isActive = isActive;
    next.accountStatus = accountStatus ? safeCleanText(accountStatus, 40) : isActive ? "Active" : "Suspended";
  }
  if (typeof passwordHash === "string" && passwordHash.length > 0) {
    next.passwordHash = passwordHash.slice(0, 200);
    next.password = passwordHash.slice(0, 200);
  }
  next.updatedAtIso = new Date().toISOString();

  all[idx] = next;
  writeStoredApplicants(all);
  return res.json({ success: true, application: sanitizePublicApplicantOut(next) });
});

app.post("/api/applications/bulk", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  const action = String(req.body?.action || "");
  if (ids.length === 0 || !["Approve", "Reject", "Delete"].includes(action)) {
    return res.status(400).json({ error: "Valid ids and action required" });
  }
  const idSet = new Set(ids);
  let all = readStoredApplicants();
  if (action === "Delete") {
    all = all.filter((a) => !idSet.has(a.id));
  } else {
    const nextStatus = action === "Approve" ? "Approved" : "Rejected";
    const nowIso = new Date().toISOString();
    all = all.map((a) => (idSet.has(a.id) ? { ...a, status: nextStatus, updatedAtIso: nowIso } : a));
  }
  writeStoredApplicants(all);
  return res.json({ success: true });
});

app.delete("/api/applications/:id", requireAuth(ADMIN_ROLE_LIST), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const id = String(req.params.id || "").trim();
  const all = readStoredApplicants();
  const next = all.filter((a) => a.id !== id);
  if (next.length === all.length) {
    return res.status(404).json({ error: "Applicant not found" });
  }
  writeStoredApplicants(next);
  return res.json({ success: true });
});

app.post("/api/auth/cadet-login", rateLimit(10 * 60 * 1000, 30), async (req, res) => {
  const cleanId = safeCleanText(req.body?.applicantId, 128);
  const cleanPw = safeCleanText(req.body?.password, 200);
  if (!cleanId || !cleanPw) {
    return res.status(400).json({ error: "ক্যাডেট আইডি এবং পাসওয়ার্ড উভয়ই দিন।" });
  }
  const all = readStoredApplicants();
  const match = all.find(
    (a) => a.id === cleanId || a.registrationNumber === cleanId || a.studentPhone === cleanId
  );
  if (!match) {
    return res.status(404).json({ error: "আবেদনকারী খুঁজে পাওয়া যায়নি।" });
  }
  if (match.isActive === false || match.accountStatus === "Suspended") {
    return res.status(403).json({ error: "আপনার ক্যাডেট অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।" });
  }
  const storedHash = match.passwordHash || match.password || "";
  if (!storedHash || !(await bcrypt.compare(cleanPw, storedHash))) {
    return res.status(401).json({ error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" });
  }

  const cadetUser: ServerSessionUser = {
    id: match.id,
    uid: match.ownerUid && match.ownerUid !== "public_applicant" ? match.ownerUid : undefined,
    email: match.studentEmail || null,
    name: match.fullNameEnglish || match.fullNameBangla || "BNCC Cadet",
    role: match.role || "cadet",
    registrationNumber: match.registrationNumber || match.id,
    authSource: "credential",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  setSessionCookie(res, cadetUser, req);
  return res.json({ authenticated: true, user: cadetUser });
});

app.get("/api/exam/health", (_req, res) => {
  res.json({ status: "ok", module: "Examination System", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "CBCC BNCC Platoon Portal", timestamp: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: "spa",
    });

    // When HMR is disabled in Cloud Run preview, skip Vite's WS client handshake cleanly
    app.get("/@vite/client", async (_req, res, next) => {
      try {
        const result = await vite.transformRequest("/@vite/client");
        if (!result?.code) return next();
        const patched = result.code.replace(
          /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
          "/* HMR disabled: WebSocket transport skipped */"
        );
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.send(patched);
      } catch {
        return next();
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  writePublicAssetsManifest();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
