import "dotenv/config";
import express from "express";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
app.set("trust proxy", 1);
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

function loadBundledFirebaseProjectId(): string {
  try {
    const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (typeof parsed?.projectId === "string" && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // Fallback below
  }
  return "gen-lang-client-0584243831";
}

const FIREBASE_PROJECT_ID = (
  process.env.FIREBASE_PROJECT_ID ||
  process.env.VITE_FIREBASE_PROJECT_ID ||
  loadBundledFirebaseProjectId()
).trim();
const SUPER_ADMIN_EMAIL = (process.env.VITE_ADMIN_EMAIL || "sajondey102@gmail.com").trim().toLowerCase();

type StorageDirMode = "configured" | "local" | "ephemeral_tmp";
interface ResolvedStorageDir {
  dir: string;
  mode: StorageDirMode;
  persistent: boolean;
}

function resolveWritableStorageDir(
  envValue: string | undefined,
  defaultSubdir: string,
  tmpFallbackName: string
): ResolvedStorageDir {
  const trimmed = (envValue || "").trim();
  const primary = path.resolve(trimmed || path.join(process.cwd(), defaultSubdir));
  const primaryMode: StorageDirMode = trimmed ? "configured" : "local";
  const probeWritable = (dir: string): boolean => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probeFile = path.join(dir, `.probe-${process.pid}-${Date.now()}`);
      fs.writeFileSync(probeFile, "ok", "utf8");
      fs.unlinkSync(probeFile);
      return true;
    } catch {
      return false;
    }
  };
  if (probeWritable(primary)) {
    return { dir: primary, mode: primaryMode, persistent: true };
  }
  const tmpFallback = path.join(os.tmpdir(), tmpFallbackName);
  probeWritable(tmpFallback);
  console.warn(
    `[STORAGE WARNING] Target directory "${primary}" is not writable; falling back to ephemeral directory "${tmpFallback}".`
  );
  return { dir: tmpFallback, mode: "ephemeral_tmp", persistent: false };
}

const DATA_STORAGE = resolveWritableStorageDir(
  process.env.DATA_DIR,
  ".bncc-data",
  "cbcc-bncc-data"
);
const MEDIA_STORAGE = resolveWritableStorageDir(
  process.env.MEDIA_DIR,
  ".bncc-media",
  "cbcc-bncc-media"
);

const DATA_ROOT_DIR = DATA_STORAGE.dir;
const STAFF_AUTH_FILE = path.join(DATA_ROOT_DIR, "staff-auth.json");
const QR_TOKENS_FILE = path.join(DATA_ROOT_DIR, "qr-tokens.json");
const PASSWORD_RESETS_FILE = path.join(DATA_ROOT_DIR, "password-resets.json");
const SECURITY_AUDIT_FILE = path.join(DATA_ROOT_DIR, "security-audit.json");

// Ephemeral cryptographic secret generated per process boot when SESSION_SECRET env var is unset
const EPHEMERAL_SESSION_SECRET = crypto.randomBytes(32).toString("hex");
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  console.warn(
    "[SECURITY WARNING] SESSION_SECRET is unset in production; using ephemeral startup secret (sessions will reset on restart)."
  );
}
const SESSION_SECRET = process.env.SESSION_SECRET || EPHEMERAL_SESSION_SECRET;

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

// Strict CORS Allowlist Middleware for Static Frontend + External API Deployments
function normalizeOriginEntry(entry: string): string {
  const trimmed = entry.trim().replace(/\/+$/, "");
  if (!trimmed || trimmed === "*") return "";
  if (!trimmed.includes("*")) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return "";
    }
  }
  const match = trimmed.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : "";
}

function parseAllowedOriginPatterns(): string[] {
  const raw = [
    process.env.ALLOWED_ORIGINS || "",
    process.env.CORS_ORIGINS || "",
    process.env.FRONTEND_URL || "",
  ]
    .filter(Boolean)
    .join(",");
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((entry) => normalizeOriginEntry(entry))
        .filter((entry) => entry.length > 0)
    )
  );
}

const configuredOriginPatterns = parseAllowedOriginPatterns();

function matchesConfiguredOrigin(origin: string): boolean {
  let normalized = "";
  try {
    normalized = new URL(origin).origin;
  } catch {
    return false;
  }
  for (const pattern of configuredOriginPatterns) {
    if (!pattern.includes("*")) {
      if (normalized === pattern) return true;
      continue;
    }
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[a-zA-Z0-9.-]+");
    if (new RegExp(`^${escaped}$`).test(normalized)) {
      return true;
    }
  }
  return false;
}

function isSameHostOrigin(req: express.Request, origin: string): boolean {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function isOriginAllowed(req: express.Request, origin: string): boolean {
  if (isSameHostOrigin(req, origin)) return true;
  if (matchesConfiguredOrigin(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(origin);
      if (
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        (parsed.protocol === "http:" || parsed.protocol === "https:")
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

app.use("/api", (req, res, next) => {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (origin) {
    res.setHeader("Vary", "Origin");
    if (!isOriginAllowed(req, origin)) {
      if (req.method === "OPTIONS") {
        return res.status(403).json({ error: "Origin not allowed by CORS policy" });
      }
      return res.status(403).json({ error: "Cross-origin request rejected" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  return next();
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

function setSessionCookie(res: express.Response, user: ServerSessionUser, req?: express.Request): string {
  const signed = signPayload(user);
  const isHttps = isHttpsRequest(req);
  res.cookie("bncc_sid", signed, {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    partitioned: isHttps,
    maxAge: 1000 * 60 * 60 * 12,
    path: "/",
  });
  return signed;
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

const FULL_ADMIN_ROLES = ["super_admin", "admin", "moderator", "sub_admin"];
const QR_INSPECTOR_ROLES = ["super_admin", "admin", "qr_admin", "attendance_officer"];
const ADMIN_ROLE_LIST = [
  "super_admin",
  "admin",
  "moderator",
  "exam_admin",
  "qr_admin",
  "sub_admin",
  "attendance_officer",
];

interface StoredStaffCredential {
  id: string;
  uid?: string;
  username: string;
  email?: string;
  name: string;
  role: string;
  passwordHash?: string;
  permissions?: Record<string, boolean>;
  isActive?: boolean;
  updatedAt: string;
}

interface StoredQrToken {
  id: string;
  qrToken: string;
  username: string;
  name: string;
  role: string;
  permissions?: Record<string, boolean>;
  expiresAtMs: number | null;
  createdAt: string;
}

interface StoredPasswordReset {
  id: string;
  applicantId: string;
  identifier: string;
  name: string;
  mobile: string;
  note: string;
  status: "pending" | "resolved";
  matchedApplicant: boolean;
  ipAddress: string;
  createdAtIso: string;
  resolvedAtIso?: string;
  resolvedBy?: string;
}

function readJsonArrayFile<T>(filePath: string): T[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArrayFile<T>(filePath: string, items: T[]): void {
  fs.mkdirSync(DATA_ROOT_DIR, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}

function appendSecurityAudit(entry: {
  event: string;
  actorId?: string;
  targetId?: string;
  role?: string;
  details: string;
}) {
  try {
    const existing = readJsonArrayFile<any>(SECURITY_AUDIT_FILE);
    existing.unshift({
      id: `sec_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      ...entry,
      timestamp: new Date().toISOString(),
    });
    writeJsonArrayFile(SECURITY_AUDIT_FILE, existing.slice(0, 500));
  } catch {
    // Non-blocking audit log
  }
}

async function resolveRequestSession(req: express.Request): Promise<ServerSessionUser | null> {
  const cookieSession = getServerSession(req);
  if (cookieSession) return cookieSession;

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return null;

  // Accept server-signed session Bearer token (ensures auth works inside cross-site iframes even if 3P cookies are restricted)
  const signedSession = verifySignedToken<ServerSessionUser>(bearer);
  if (signedSession && (!signedSession.exp || Date.now() <= signedSession.exp)) {
    return signedSession;
  }

  const claims = await verifyFirebaseIdToken(bearer);
  if (!claims) return null;

  const email = (claims.email || "").toLowerCase();
  const isSuper = email === SUPER_ADMIN_EMAIL && claims.email_verified === true;
  const staffMatch = !isSuper
    ? readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE).find(
        (s) =>
          s.isActive !== false &&
          ((s.uid && s.uid === claims.sub) || (s.email && s.email.toLowerCase() === email))
      )
    : undefined;

  let resolvedRole = "user";
  let resolvedName = claims.name || email || "BNCC User";
  let resolvedPermissions: Record<string, boolean> | undefined;
  let resolvedReg: string | undefined;

  if (isSuper) {
    resolvedRole = "super_admin";
  } else if (staffMatch) {
    resolvedRole = staffMatch.role || "admin";
    resolvedName = staffMatch.name || resolvedName;
    resolvedPermissions = staffMatch.permissions;
  } else {
    const matchedApp = readStoredApplicants().find((a) => a.ownerUid === claims.sub);
    if (matchedApp) {
      const st = String(matchedApp.status || "").toLowerCase();
      resolvedRole = st === "approved" || st === "joined" || matchedApp.role === "cadet" ? "cadet" : "user";
      resolvedName = matchedApp.fullNameEnglish || matchedApp.fullNameBangla || resolvedName;
      resolvedReg = matchedApp.registrationNumber || matchedApp.id;
    }
  }

  return {
    id: claims.sub,
    uid: claims.sub,
    email: claims.email || null,
    name: resolvedName,
    role: resolvedRole,
    registrationNumber: resolvedReg,
    permissions: resolvedPermissions,
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
  const current = await resolveRequestSession(req);

  let derivedRole = "user";
  let derivedName = claims.name || email || "BNCC User";
  let derivedId = claims.sub;
  let derivedPermissions: Record<string, boolean> | undefined;
  let derivedReg: string | undefined;

  if (isSuper) {
    derivedRole = "super_admin";
  } else {
    const staffMatch = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE).find(
      (s) =>
        s.isActive !== false &&
        ((s.uid && s.uid === claims.sub) || (s.email && s.email.toLowerCase() === email))
    );
    if (staffMatch) {
      derivedRole = staffMatch.role || "admin";
      derivedName = staffMatch.name || derivedName;
      derivedPermissions = staffMatch.permissions;
    } else {
      const matchedApp = readStoredApplicants().find((a) => a.ownerUid === claims.sub);
      if (matchedApp) {
        const st = String(matchedApp.status || "").toLowerCase();
        derivedRole = st === "approved" || st === "joined" || matchedApp.role === "cadet" ? "cadet" : "user";
        derivedId = matchedApp.id;
        derivedName = matchedApp.fullNameEnglish || matchedApp.fullNameBangla || derivedName;
        derivedReg = matchedApp.registrationNumber || matchedApp.id;
      } else if (current && current.uid === claims.sub && current.role) {
        derivedRole = current.role;
      }
    }
  }

  const sessionUser: ServerSessionUser = {
    id: derivedId,
    uid: claims.sub,
    email: claims.email || null,
    name: derivedName,
    role: derivedRole,
    registrationNumber: derivedReg,
    permissions: derivedPermissions,
    authSource: "firebase",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const token = setSessionCookie(res, sessionUser, req);
  return res.json({ authenticated: true, user: sessionUser, token });
});

app.post("/api/auth/session-sync", rateLimit(10 * 60 * 1000, 60), async (req, res) => {
  const { user } = req.body || {};
  if (!user || !user.id) {
    return res.status(400).json({ error: "Invalid session payload" });
  }

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const bearerServerSession = bearer ? verifySignedToken<ServerSessionUser>(bearer) : null;
  const claims =
    bearer && (!bearerServerSession || (bearerServerSession.exp && Date.now() > bearerServerSession.exp))
      ? await verifyFirebaseIdToken(bearer)
      : null;
  const existingSession = await resolveRequestSession(req);

  // Require an active verified Firebase token or active server session (never allow unauthenticated role minting)
  if (!claims && !existingSession) {
    appendSecurityAudit({
      event: "SESSION_SYNC_REJECTED",
      targetId: String(user.id).slice(0, 128),
      details: "Rejected unauthenticated session-sync request.",
    });
    return res.status(401).json({ error: "Verified authentication token or active session required" });
  }

  let safeRole = "user";
  let safeId = String(user.id).slice(0, 128);
  let safeName = String(user.name || "BNCC User").slice(0, 160);
  let safePermissions = existingSession?.permissions;
  let safeImpersonatedBy = existingSession?.impersonatedBy || null;
  let safeReg = user.registrationNumber ? String(user.registrationNumber).slice(0, 64) : undefined;
  let safeUsername = existingSession?.username;

  // 1. Handle admin impersonation start / restore cleanly for already-verified admin sessions
  if (existingSession && ADMIN_ROLE_LIST.includes(existingSession.role) && user.impersonatedBy) {
    // Admin starting impersonation of a cadet/applicant view
    safeRole = String(user.role) === "user" ? "user" : "cadet";
    safeImpersonatedBy = {
      id: existingSession.id,
      name: existingSession.name,
      role: existingSession.role,
      uid: existingSession.uid,
      email: existingSession.email || null,
    };
    safePermissions = undefined;
  } else if (existingSession?.impersonatedBy && !user.impersonatedBy) {
    // Admin restoring original verified admin role from server-held impersonatedBy
    safeRole = existingSession.impersonatedBy.role;
    safeId = existingSession.impersonatedBy.id;
    safeName = existingSession.impersonatedBy.name;
    safeImpersonatedBy = null;
  } else if (claims) {
    // 2. Derive role strictly server-side from verified Firebase claims + server registries
    const emailLower = (claims.email || "").toLowerCase();
    const isSuper = emailLower === SUPER_ADMIN_EMAIL && claims.email_verified === true;
    const staffMatch = !isSuper
      ? readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE).find(
          (s) =>
            s.isActive !== false &&
            ((s.uid && s.uid === claims.sub) || (s.email && s.email.toLowerCase() === emailLower))
        )
      : undefined;

    if (isSuper) {
      safeRole = "super_admin";
      safeUsername = "admin";
      safePermissions = {
        canAdd: true,
        canEdit: true,
        canDelete: true,
        canViewLogs: true,
        canResetPW: true,
        canApprove: true,
        canExport: true,
        canChat: true,
      };
    } else if (staffMatch) {
      safeRole = staffMatch.role;
      safeUsername = staffMatch.username;
      safePermissions = staffMatch.permissions;
    } else if (existingSession && existingSession.uid === claims.sub && ADMIN_ROLE_LIST.includes(existingSession.role)) {
      safeRole = existingSession.role;
      safePermissions = existingSession.permissions;
    } else {
      const matchedApp = readStoredApplicants().find((a) => a.ownerUid === claims.sub);
      if (matchedApp) {
        const st = String(matchedApp.status || "").toLowerCase();
        safeRole = st === "approved" || st === "joined" || matchedApp.role === "cadet" ? "cadet" : "user";
        safeId = matchedApp.id;
        safeReg = matchedApp.registrationNumber || matchedApp.id;
      } else {
        safeRole = "user";
      }
    }
  } else if (existingSession) {
    // 3. Preserve already-verified server session role (prevent lateral/upward escalation from client body)
    safeRole = existingSession.role;
    safeId = existingSession.id;
    safeReg = existingSession.registrationNumber;
  }

  const sessionUser: ServerSessionUser = {
    id: safeId,
    uid: claims?.sub || existingSession?.uid,
    email: claims?.email || existingSession?.email || null,
    name: safeName,
    role: safeRole,
    username: safeUsername,
    registrationNumber: safeReg,
    permissions: safePermissions,
    authSource: claims ? "firebase" : existingSession?.authSource || "credential",
    impersonatedBy: safeImpersonatedBy,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };

  appendSecurityAudit({
    event: "SESSION_SYNC",
    actorId: sessionUser.uid || sessionUser.id,
    role: sessionUser.role,
    details: `Verified session sync (${sessionUser.authSource})`,
  });

  const token = setSessionCookie(res, sessionUser, req);
  return res.json({ authenticated: true, user: sessionUser, token });
});

function timingSafeComparePlaintext(aStr: string, bStr: string): boolean {
  const hashA = crypto.createHash("sha256").update(aStr, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(bStr, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

async function verifyAdminPassword(candidate: string): Promise<{ valid: boolean; configured: boolean }> {
  const configuredSecret = (process.env.ADMIN_LOGIN_PASSWORD || "").trim();
  if (configuredSecret.length > 0) {
    return {
      valid: timingSafeComparePlaintext(candidate, configuredSecret),
      configured: true,
    };
  }
  const staff = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE);
  const adminEntry = staff.find((s) => s.username.toLowerCase() === "admin" && s.passwordHash);
  if (adminEntry?.passwordHash) {
    const valid = await bcrypt.compare(candidate, adminEntry.passwordHash);
    return { valid, configured: true };
  }
  return { valid: false, configured: false };
}

app.post("/api/auth/credential-login", rateLimit(10 * 60 * 1000, 30), async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const cleanId = String(username).trim().toLowerCase();
  const cleanPw = String(password);

  if (cleanId === "admin") {
    const check = await verifyAdminPassword(cleanPw);
    if (!check.configured) {
      return res.status(401).json({
        error:
          "সার্ভার অ্যাডমিন পাসওয়ার্ড কনফিগার করা হয়নি। অনুগ্রহ করে সুপার অ্যাডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন অথবা .env-এ ADMIN_LOGIN_PASSWORD সেট করুন।",
      });
    }
    if (check.valid) {
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
      appendSecurityAudit({
        event: "CREDENTIAL_LOGIN_SUCCESS",
        actorId: "admin",
        role: "super_admin",
        details: "Super admin credential login succeeded.",
      });
      const token = setSessionCookie(res, superUser, req);
      return res.json({ authenticated: true, user: superUser, token });
    }
    appendSecurityAudit({
      event: "CREDENTIAL_LOGIN_FAILED",
      actorId: "admin",
      details: "Invalid super admin password attempt.",
    });
    return res.status(401).json({ error: "Invalid admin password." });
  }

  // Check synced staff credentials in .bncc-data/staff-auth.json
  const staff = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE);
  const staffMatch = staff.find(
    (s) => s.username.toLowerCase() === cleanId || (s.email && s.email.toLowerCase() === cleanId)
  );
  if (staffMatch) {
    if (staffMatch.isActive === false) {
      return res.status(403).json({ error: "এই অফিসার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে।" });
    }
    if (!staffMatch.passwordHash || !(await bcrypt.compare(cleanPw, staffMatch.passwordHash))) {
      appendSecurityAudit({
        event: "STAFF_LOGIN_FAILED",
        actorId: cleanId,
        details: "Invalid officer password attempt.",
      });
      return res.status(401).json({ error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" });
    }
    const staffUser: ServerSessionUser = {
      id: staffMatch.id || staffMatch.username,
      uid: staffMatch.uid,
      email: staffMatch.email || null,
      username: staffMatch.username,
      name: staffMatch.name || "BNCC Officer",
      role: staffMatch.role || "admin",
      authSource: "credential",
      permissions: staffMatch.permissions || {},
      exp: Date.now() + 1000 * 60 * 60 * 12,
    };
    const token = setSessionCookie(res, staffUser, req);
    return res.json({ authenticated: true, user: staffUser, token });
  }

  return res.status(404).json({ error: "Delegate to verified Firestore/Firebase check" });
});

app.post("/api/auth/staff", requireAuth(["super_admin"]), async (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const { id, uid, username, email, name, role, passwordHash, plainPassword, permissions, isActive } =
    req.body || {};
  const cleanUsername = safeCleanText(username, 80).toLowerCase();
  if (!cleanUsername) {
    return res.status(400).json({ error: "Username is required" });
  }
  let finalHash = typeof passwordHash === "string" ? passwordHash.slice(0, 200) : "";
  if (!finalHash && typeof plainPassword === "string" && plainPassword.length >= 6) {
    finalHash = await bcrypt.hash(plainPassword, 10);
  }
  const staff = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE);
  const idx = staff.findIndex((s) => s.username.toLowerCase() === cleanUsername);
  const record: StoredStaffCredential = {
    id: safeCleanText(id || (idx >= 0 ? staff[idx].id : `staff_${Date.now()}`), 128),
    uid: uid ? safeCleanText(uid, 128) : idx >= 0 ? staff[idx].uid : undefined,
    username: cleanUsername,
    email: email ? safeCleanText(email, 160).toLowerCase() : idx >= 0 ? staff[idx].email : undefined,
    name: safeCleanText(name || (idx >= 0 ? staff[idx].name : cleanUsername), 160),
    role: safeCleanText(role || (idx >= 0 ? staff[idx].role : "admin"), 40),
    passwordHash: finalHash || (idx >= 0 ? staff[idx].passwordHash : undefined),
    permissions: permissions || (idx >= 0 ? staff[idx].permissions : {}),
    isActive: typeof isActive === "boolean" ? isActive : idx >= 0 ? staff[idx].isActive !== false : true,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    staff[idx] = record;
  } else {
    staff.push(record);
  }
  writeJsonArrayFile(STAFF_AUTH_FILE, staff);
  return res.json({ success: true, username: cleanUsername });
});

app.post("/api/auth/staff/sync-batch", requireAuth(["super_admin"]), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const items = Array.isArray(req.body?.staff) ? req.body.staff : [];
  const staff = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE);
  const byUsername = new Map<string, StoredStaffCredential>();
  for (const s of staff) {
    if (s.username) byUsername.set(s.username.toLowerCase(), s);
  }
  for (const raw of items.slice(0, 100)) {
    const cleanUser = safeCleanText(raw?.username, 80).toLowerCase();
    if (!cleanUser) continue;
    const prev = byUsername.get(cleanUser);
    byUsername.set(cleanUser, {
      id: safeCleanText(raw.id || prev?.id || cleanUser, 128),
      uid: raw.uid ? safeCleanText(raw.uid, 128) : prev?.uid,
      username: cleanUser,
      email: raw.email ? safeCleanText(raw.email, 160).toLowerCase() : prev?.email,
      name: safeCleanText(raw.name || prev?.name || cleanUser, 160),
      role: safeCleanText(raw.role || prev?.role || "admin", 40),
      passwordHash:
        typeof raw.password === "string" && raw.password.startsWith("$2")
          ? raw.password
          : typeof raw.passwordHash === "string" && raw.passwordHash.startsWith("$2")
          ? raw.passwordHash
          : prev?.passwordHash,
      permissions: raw.permissions || prev?.permissions || {},
      isActive: typeof raw.isActive === "boolean" ? raw.isActive : prev?.isActive !== false,
      updatedAt: new Date().toISOString(),
    });
  }
  writeJsonArrayFile(STAFF_AUTH_FILE, Array.from(byUsername.values()));
  return res.json({ success: true });
});

app.delete("/api/auth/staff/:idOrUsername", requireAuth(["super_admin"]), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const target = String(req.params.idOrUsername || "").trim().toLowerCase();
  const staff = readJsonArrayFile<StoredStaffCredential>(STAFF_AUTH_FILE);
  const next = staff.filter((s) => s.id.toLowerCase() !== target && s.username.toLowerCase() !== target);
  writeJsonArrayFile(STAFF_AUTH_FILE, next);
  return res.json({ success: true });
});

app.post("/api/auth/qr-token", requireAuth(QR_INSPECTOR_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const { qrToken, username, name, role, expiresAtMs, permissions } = req.body || {};
  const cleanToken = safeCleanText(qrToken, 200);
  const cleanUser = safeCleanText(username, 80).toLowerCase();
  if (!cleanToken.startsWith("adm_qr_") || !cleanUser) {
    return res.status(400).json({ error: "Valid adm_qr_ token and username required" });
  }
  const tokens = readJsonArrayFile<StoredQrToken>(QR_TOKENS_FILE).filter(
    (t) => t.username.toLowerCase() !== cleanUser
  );
  const record: StoredQrToken = {
    id: `qr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    qrToken: cleanToken,
    username: cleanUser,
    name: safeCleanText(name || cleanUser, 160),
    role: safeCleanText(role || "qr_admin", 40),
    permissions: permissions || {},
    expiresAtMs: typeof expiresAtMs === "number" ? expiresAtMs : null,
    createdAt: new Date().toISOString(),
  };
  tokens.unshift(record);
  writeJsonArrayFile(QR_TOKENS_FILE, tokens);
  return res.json({ success: true, id: record.id });
});

app.post("/api/auth/qr-login", rateLimit(10 * 60 * 1000, 30), (req, res) => {
  const cleanToken = safeCleanText(req.body?.qrToken, 200);
  if (!cleanToken || !cleanToken.startsWith("adm_qr_")) {
    return res.status(400).json({ error: "অবৈধ অ্যাডমিন QR কোড ফরম্যাট।" });
  }
  const tokens = readJsonArrayFile<StoredQrToken>(QR_TOKENS_FILE);
  const match = tokens.find((t) => t.qrToken === cleanToken);
  if (!match) {
    appendSecurityAudit({
      event: "QR_LOGIN_FAILED",
      details: "Invalid admin QR token presented.",
    });
    return res.status(401).json({ error: "অবৈধ বা অনিবন্ধিত অ্যাডমিন QR কোড।" });
  }
  if (match.expiresAtMs && Date.now() > match.expiresAtMs) {
    return res.status(401).json({ error: "এই অ্যাডমিন QR কোডের মেয়াদ শেষ হয়ে গেছে।" });
  }
  const safeRole = QR_INSPECTOR_ROLES.includes(match.role) ? match.role : "attendance_officer";
  const qrUser: ServerSessionUser = {
    id: match.id,
    username: match.username,
    name: match.name || "Attendance Officer",
    role: safeRole,
    authSource: "qr_token",
    permissions: match.permissions || {},
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  appendSecurityAudit({
    event: "QR_LOGIN_SUCCESS",
    actorId: match.username,
    role: safeRole,
    details: "QR token login verified by server vault.",
  });
  const token = setSessionCookie(res, qrUser, req);
  return res.json({ authenticated: true, user: qrUser, token });
});

app.post("/api/auth/link-applicant", rateLimit(10 * 60 * 1000, 20), async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const claims = bearer ? await verifyFirebaseIdToken(bearer) : null;
  if (!claims) {
    return res.status(401).json({ error: "প্রথমে ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন।" });
  }

  const applicantId = safeCleanText(req.body?.applicantId, 128);
  const plainPw = safeCleanText(req.body?.password, 200);
  if (!applicantId || !plainPw) {
    return res.status(400).json({ error: "ক্যাডেট / আবেদন আইডি এবং পাসওয়ার্ড দিন।" });
  }

  const all = readStoredApplicants();
  const idx = all.findIndex(
    (a) => a.id === applicantId || a.registrationNumber === applicantId
  );
  if (idx < 0) {
    return res.status(404).json({ error: "উক্ত আইডি সংবলিত কোনো আবেদন পাওয়া যায়নি।" });
  }
  const match = all[idx];
  if (match.ownerUid && match.ownerUid !== "public_applicant" && match.ownerUid !== claims.sub) {
    appendSecurityAudit({
      event: "LINK_APPLICANT_CONFLICT",
      actorId: claims.sub,
      targetId: match.id,
      details: "Attempted to link applicant already owned by another UID.",
    });
    return res.status(409).json({
      error: "এই ক্যাডেট / আবেদন আইডি ইতিমধ্যেই অন্য একটি ইমেইল অ্যাকাউন্টের সাথে যুক্ত রয়েছে।",
    });
  }

  const storedHash = match.passwordHash || match.password || "";
  if (!storedHash || !(await bcrypt.compare(plainPw, storedHash))) {
    return res.status(401).json({ error: "ক্যাডেট আইডি বা পাসওয়ার্ড সঠিক নয়।" });
  }

  const st = String(match.status || "").toLowerCase();
  const derivedRole = st === "approved" || st === "joined" || match.role === "cadet" ? "cadet" : "user";
  all[idx] = {
    ...match,
    ownerUid: claims.sub,
    role: derivedRole,
    updatedAtIso: new Date().toISOString(),
  };
  writeStoredApplicants(all);

  const linkedUser: ServerSessionUser = {
    id: match.id,
    uid: claims.sub,
    email: claims.email || match.studentEmail || null,
    name: match.fullNameEnglish || match.fullNameBangla || claims.name || "BNCC Member",
    role: derivedRole,
    registrationNumber: match.registrationNumber || match.id,
    authSource: "firebase",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  (linkedUser as any).applicantId = match.id;

  appendSecurityAudit({
    event: "APPLICANT_LINKED",
    actorId: claims.sub,
    targetId: match.id,
    role: derivedRole,
    details: `Linked applicant ${match.id} to UID ${claims.sub}`,
  });

  const token = setSessionCookie(res, linkedUser, req);
  return res.json({ authenticated: true, user: linkedUser, token });
});

app.post("/api/auth/password-reset-request", rateLimit(15 * 60 * 1000, 10), (req, res) => {
  const identifier = safeCleanText(req.body?.identifier, 128);
  const mobile = safeCleanText(req.body?.mobile, 32);
  const note = safeCleanText(req.body?.note, 400);
  if (!identifier || !mobile || mobile.length < 6) {
    return res.status(400).json({
      error: "ক্যাডেট / আবেদন আইডি এবং সঠিক মোবাইল নম্বর প্রদান করুন।",
    });
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const match = readStoredApplicants().find(
    (a) =>
      a.id === identifier ||
      a.registrationNumber === identifier ||
      (a.studentEmail && a.studentEmail.toLowerCase() === identifier.toLowerCase())
  );

  const resetRecord: StoredPasswordReset = {
    id: `pwr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    applicantId: match?.id || identifier,
    identifier,
    name: match?.fullNameEnglish || match?.fullNameBangla || `Request (${identifier})`,
    mobile,
    note: note || "Officer-assisted password reset request submitted from portal.",
    status: "pending",
    matchedApplicant: Boolean(match),
    ipAddress: ip,
    createdAtIso: new Date().toISOString(),
  };

  const resets = readJsonArrayFile<StoredPasswordReset>(PASSWORD_RESETS_FILE);
  resets.unshift(resetRecord);
  writeJsonArrayFile(PASSWORD_RESETS_FILE, resets.slice(0, 300));

  appendSecurityAudit({
    event: "PASSWORD_RESET_REQUESTED",
    targetId: resetRecord.applicantId,
    details: `Officer-assisted reset request submitted from IP ${ip}`,
  });

  // Always return uniform confirmation without leaking account existence
  return res.status(201).json({
    success: true,
    id: resetRecord.id,
    message:
      "আপনার রিকভারি অনুরোধটি নিরাপদে প্লাটুন অ্যাডমিন প্যানেলে জমা হয়েছে। যাচাই সম্পন্ন হলে প্লাটুন অফিসার সহায়তা করবেন।",
  });
});

app.get("/api/auth/password-resets", requireAuth(FULL_ADMIN_ROLES), (_req, res) => {
  const resets = readJsonArrayFile<StoredPasswordReset>(PASSWORD_RESETS_FILE);
  return res.json({ resets });
});

app.patch("/api/auth/password-resets/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const status = req.body?.status === "resolved" ? "resolved" : "pending";
  const resets = readJsonArrayFile<StoredPasswordReset>(PASSWORD_RESETS_FILE);
  const idx = resets.findIndex((r) => r.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Reset request not found" });
  }
  resets[idx] = {
    ...resets[idx],
    status,
    resolvedAtIso: status === "resolved" ? new Date().toISOString() : undefined,
    resolvedBy: serverUser.username || serverUser.id,
  };
  writeJsonArrayFile(PASSWORD_RESETS_FILE, resets);
  return res.json({ success: true, reset: resets[idx] });
});

app.delete("/api/auth/password-resets/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const id = String(req.params.id || "").trim();
  const resets = readJsonArrayFile<StoredPasswordReset>(PASSWORD_RESETS_FILE);
  const next = resets.filter((r) => r.id !== id);
  if (next.length === resets.length) {
    return res.status(404).json({ error: "Reset request not found" });
  }
  writeJsonArrayFile(PASSWORD_RESETS_FILE, next);
  return res.json({ success: true });
});

app.get("/api/qr/applicant/:id", requireAuth(QR_INSPECTOR_ROLES), (req, res) => {
  const id = String(req.params.id || "").trim();
  const match = readStoredApplicants().find((a) => a.id === id || a.registrationNumber === id);
  if (!match) {
    return res.status(404).json({ error: "আবেদনকারী পাওয়া যায়নি।" });
  }
  const { passwordHash: _ph, password: _pw, uploadedDocuments: _docs, ...safeQrProfile } = match;
  return res.json({ applicant: safeQrProfile });
});

app.post("/api/qr/attendance", requireAuth(QR_INSPECTOR_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const id = safeCleanText(req.body?.id, 128);
  const status = safeCleanText(req.body?.attendanceStatus || "Present", 32);
  if (!id) {
    return res.status(400).json({ error: "Applicant ID is required" });
  }
  const all = readStoredApplicants();
  const idx = all.findIndex((a) => a.id === id || a.registrationNumber === id);
  if (idx < 0) {
    return res.status(404).json({ error: "আবেদনকারী পাওয়া যায়নি।" });
  }
  const alreadyPresent = all[idx].attendanceStatus === "Present";
  if (!alreadyPresent) {
    all[idx] = {
      ...all[idx],
      attendanceStatus: status || "Present",
      attendanceTime: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };
    writeStoredApplicants(all);
  }
  const { passwordHash: _ph, password: _pw, uploadedDocuments: _docs, ...safeQrProfile } = all[idx];
  return res.json({ success: true, alreadyPresent, applicant: safeQrProfile });
});

app.get("/api/qr/attendance-report", requireAuth(QR_INSPECTOR_ROLES), (_req, res) => {
  const presentRecords = readStoredApplicants()
    .filter((a) => a.attendanceStatus === "Present")
    .map((a) => ({
      id: a.id,
      registrationNumber: a.registrationNumber || a.id,
      fullNameEnglish: a.fullNameEnglish || "",
      fullNameBangla: a.fullNameBangla || "",
      classRoll: a.classRoll || "N/A",
      studyStatus: a.studyStatus || "",
      attendanceStatus: a.attendanceStatus || "Present",
      attendanceTime: a.attendanceTime || a.updatedAtIso || "",
    }));
  return res.json({ records: presentRecords });
});

app.get("/api/auth/session", async (req, res) => {
  const session = await resolveRequestSession(req);
  if (!session) {
    return res.json({ authenticated: false, user: null, token: null });
  }
  const token = signPayload(session);
  return res.json({ authenticated: true, user: session, token });
});

app.post("/api/auth/logout", (req, res) => {
  const isHttps = isHttpsRequest(req);
  res.clearCookie("bncc_sid", {
    path: "/",
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    partitioned: isHttps,
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

const EXAM_ADMIN_ROLES = ["super_admin", "admin", "exam_admin"];
const EXAM_STORE_DATA_DIR = DATA_ROOT_DIR;
const EXAM_STORE_FILE = path.join(EXAM_STORE_DATA_DIR, "exam-store.json");

interface StoredExamData {
  questions: any[];
  exams: any[];
  attempts: any[];
  results: any[];
  settings: any;
  activityLogs: any[];
  auditLogs: any[];
}

function getDefaultExamSettings() {
  return {
    id: "global",
    defaultDurationMinutes: 60,
    defaultPassPercentage: 40,
    enableNegativeMarkingDefault: false,
    defaultWrongPenalty: 0.25,
    allowStudentReviewAnswers: false,
    showLeaderboardToStudents: true,
    autoSubmitOnTimeExpiry: true,
    preventTabSwitching: false,
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  };
}

function readExamStore(): StoredExamData {
  try {
    if (!fs.existsSync(EXAM_STORE_FILE)) {
      return {
        questions: [],
        exams: [],
        attempts: [],
        results: [],
        settings: getDefaultExamSettings(),
        activityLogs: [],
        auditLogs: [],
      };
    }
    const raw = fs.readFileSync(EXAM_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      questions: Array.isArray(parsed?.questions) ? parsed.questions : [],
      exams: Array.isArray(parsed?.exams) ? parsed.exams : [],
      attempts: Array.isArray(parsed?.attempts) ? parsed.attempts : [],
      results: Array.isArray(parsed?.results) ? parsed.results : [],
      settings: parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : getDefaultExamSettings(),
      activityLogs: Array.isArray(parsed?.activityLogs) ? parsed.activityLogs : [],
      auditLogs: Array.isArray(parsed?.auditLogs) ? parsed.auditLogs : [],
    };
  } catch {
    return {
      questions: [],
      exams: [],
      attempts: [],
      results: [],
      settings: getDefaultExamSettings(),
      activityLogs: [],
      auditLogs: [],
    };
  }
}

function writeExamStore(data: StoredExamData): void {
  fs.mkdirSync(EXAM_STORE_DATA_DIR, { recursive: true });
  const trimmed: StoredExamData = {
    ...data,
    activityLogs: (data.activityLogs || []).slice(-500),
    auditLogs: (data.auditLogs || []).slice(-1000),
  };
  fs.writeFileSync(EXAM_STORE_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

function stripExamQuestionKeysServer(q: any) {
  if (!q || typeof q !== "object") return q;
  const { correctAnswer: _c, acceptedAnswers: _a, expectedAnswer: _e, explanation: _ex, ...safeQ } = q;
  return safeQ;
}

function sanitizeExamForCaller(exam: any, isAdmin: boolean) {
  if (!exam || typeof exam !== "object") return exam;
  if (isAdmin) return exam;
  return {
    ...exam,
    questionSnapshots: Array.isArray(exam.questionSnapshots)
      ? exam.questionSnapshots.map(stripExamQuestionKeysServer)
      : [],
  };
}

function resolveExamPackageFromStore(examId: string, attemptId?: string): SealedExamPackage | undefined {
  const store = readExamStore();
  const exam = store.exams.find((e) => e.id === examId);
  if (!exam) return undefined;

  const qMap = new Map<string, any>();
  for (const q of store.questions) {
    if (q?.id) qMap.set(String(q.id), q);
  }

  const attempt = attemptId ? store.attempts.find((a) => a.id === attemptId) : undefined;
  const sourceList: any[] =
    Array.isArray(exam.questionSnapshots) && exam.questionSnapshots.length > 0
      ? exam.questionSnapshots
      : Array.isArray(attempt?.questionSnapshot) && attempt.questionSnapshot.length > 0
      ? attempt.questionSnapshot
      : Array.isArray(exam.selectedQuestionIds)
      ? exam.selectedQuestionIds.map((id: string) => ({ id }))
      : [];

  const keys: AnswerKeyEntry[] = [];
  for (const snap of sourceList) {
    const id = String(snap?.id || "");
    if (!id) continue;
    const full = qMap.get(id);
    if (!full && snap?.correctAnswer === undefined && !snap?.acceptedAnswers) continue;
    keys.push({
      id,
      questionType: String(full?.questionType || snap?.questionType || "mcq"),
      correctAnswer: full?.correctAnswer ?? snap?.correctAnswer ?? "",
      acceptedAnswers: Array.isArray(full?.acceptedAnswers)
        ? full.acceptedAnswers.map(String)
        : Array.isArray(snap?.acceptedAnswers)
        ? snap.acceptedAnswers.map(String)
        : [],
      marks: Number(full?.marks || snap?.marks) || 1,
    });
  }

  if (keys.length === 0) return undefined;
  const negativePenalty =
    exam.negativeMarking?.enabled && Number(exam.negativeMarking.marksPerWrongAnswer) > 0
      ? Number(exam.negativeMarking.marksPerWrongAnswer)
      : 0;
  return {
    keys,
    negativePenalty,
    passMarks: Number(exam.passMarks) || 0,
  };
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

    const serverUser = (req as any).serverUser as ServerSessionUser;
    const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser?.role || "").toLowerCase());
    let pkg: SealedExamPackage | undefined = examKeyVault.get(String(examId));
    if (!pkg && typeof sealedPayload === "string" && sealedPayload.length > 0) {
      try {
        pkg = unsealKeys(sealedPayload);
        examKeyVault.set(String(examId), pkg);
      } catch {
        return res.status(400).json({ error: "Invalid sealed answer key envelope" });
      }
    }
    if (!pkg) {
      pkg = resolveExamPackageFromStore(String(examId), String(attemptId));
      if (pkg) {
        examKeyVault.set(String(examId), pkg);
      }
    }

    const metaList: AnswerKeyEntry[] =
      pkg?.keys || (isAdmin && Array.isArray(questionsMeta) ? questionsMeta : []);
    const penalty = pkg ? pkg.negativePenalty : isAdmin ? Number(reqPenalty) || 0 : 0;
    const passMarks = pkg ? pkg.passMarks : isAdmin ? Number(reqPassMarks) || 0 : 0;
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
  requireAuth(FULL_ADMIN_ROLES),
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
  requireAuth(FULL_ADMIN_ROLES),
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
  const { name, phone, email, subject, message, ticketId } = req.body || {};
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
  const safeId = clean(ticketId, 64) || `CBCC-INQ-${Date.now().toString(36).toUpperCase()}`;

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
    id: safeId,
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

app.get("/api/contact", requireAuth(FULL_ADMIN_ROLES), (_req, res) => {
  return res.json({ inquiries: contactInquiries });
});

// =========================================================================
// INTERNAL PLATOON MESSENGER API (CREDENTIAL & FIREBASE SESSION COMPATIBLE)
// =========================================================================

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
  const origin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  if (!origin) return true;
  if (isSameHostOrigin(req, origin)) return true;
  if (!isOriginAllowed(req, origin)) return false;

  // Cross-origin mutations from allowlisted hosts require an explicit JS/API header
  // so plain HTML form submissions cannot bypass CSRF checks.
  const xRequestedWith = String(req.headers["x-requested-with"] || "").trim().toLowerCase();
  const authHeader = String(req.headers.authorization || "").trim();
  const contentType = String(req.headers["content-type"] || "").trim().toLowerCase();
  return (
    xRequestedWith === "xmlhttprequest" ||
    authHeader.startsWith("Bearer ") ||
    contentType.includes("application/json")
  );
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

app.delete("/api/messages/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
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

const MEDIA_ROOT_DIR = MEDIA_STORAGE.dir;
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

app.get("/api/media/list", requireAuth(FULL_ADMIN_ROLES), (_req, res) => {
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
  requireAuth(FULL_ADMIN_ROLES),
  (req, res) => {
    if (!verifySameOriginMutation(req)) {
      return res.status(403).json({ error: "Cross-origin request rejected" });
    }
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

      return res.status(201).json({
        item: record,
        duplicateDetected: false,
        ephemeralStorageWarning: !MEDIA_STORAGE.persistent,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || "Media upload failed" });
    }
  }
);

app.patch("/api/media/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
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

app.delete("/api/media/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
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

app.get("/api/media/private/:fileName", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
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
  attendanceTime?: string;
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

app.get("/api/applications", requireAuth(FULL_ADMIN_ROLES), (_req, res) => {
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
  const callerRole = String(serverUser.role || "").toLowerCase();
  const isAdminUser = FULL_ADMIN_ROLES.includes(callerRole) || QR_INSPECTOR_ROLES.includes(callerRole);
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
  requireAuth(FULL_ADMIN_ROLES),
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
      const normStatus = normalizeApplicantStatus(raw.status ?? existing?.status);
      const derivedRole =
        normStatus === "Approved" || raw.role === "cadet" ? "cadet" : raw.role || existing?.role || "user";
      const merged: StoredOnlineApplicant = {
        ...(existing || {}),
        ...raw,
        id,
        registrationNumber: safeCleanText(raw.registrationNumber || existing?.registrationNumber, 80) || id,
        ownerUid: safeCleanText(raw.ownerUid || existing?.ownerUid, 128) || "public_applicant",
        fullNameEnglish: safeCleanText(raw.fullNameEnglish || existing?.fullNameEnglish || raw.fullNameBangla, 200),
        fullNameBangla: safeCleanText(raw.fullNameBangla || existing?.fullNameBangla || raw.fullNameEnglish, 200),
        studentPhone: safeCleanText(raw.studentPhone || existing?.studentPhone, 32),
        role: derivedRole,
        status: normStatus,
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

app.patch("/api/applications/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
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
    const normStatus = normalizeApplicantStatus(status);
    next.status = normStatus;
    next.role = normStatus === "Approved" ? "cadet" : "user";
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

app.post("/api/applications/bulk", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
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
    const nextRole = action === "Approve" ? "cadet" : "user";
    const nowIso = new Date().toISOString();
    all = all.map((a) =>
      idSet.has(a.id) ? { ...a, status: nextStatus, role: nextRole, updatedAtIso: nowIso } : a
    );
  }
  writeStoredApplicants(all);
  return res.json({ success: true });
});

app.delete("/api/applications/:id", requireAuth(FULL_ADMIN_ROLES), (req, res) => {
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

app.post("/api/applicants/check-duplicate", rateLimit(5 * 60 * 1000, 60), (req, res) => {
  const field = String(req.body?.field || "").trim();
  const value = safeCleanText(req.body?.value, 160);
  const excludeId = safeCleanText(req.body?.excludeId, 128);
  const allowedFields = new Set(["studentPhone", "studentEmail", "registrationNumber", "emisId"]);
  if (!allowedFields.has(field) || !value) {
    return res.status(400).json({ error: "Invalid field or empty value", duplicate: false });
  }
  const normalizedVal = field === "studentEmail" ? value.toLowerCase() : value;
  const all = readStoredApplicants();
  const duplicate = all.some((app) => {
    if (excludeId && app.id === excludeId) return false;
    const raw = (app as any)[field];
    if (!raw) return false;
    const cand = field === "studentEmail" ? String(raw).trim().toLowerCase() : String(raw).trim();
    return cand === normalizedVal;
  });
  return res.json({ duplicate });
});

app.post("/api/security-log", rateLimit(5 * 60 * 1000, 40), async (req, res) => {
  const session = await resolveRequestSession(req);
  const attemptType = safeCleanText(req.body?.attemptType || "SECURITY_EVENT", 80);
  const reason = safeCleanText(req.body?.reason || "", 300);
  const attemptedId = safeCleanText(req.body?.attemptedId || "", 128);
  appendSecurityAudit({
    event: attemptType,
    actorId: session?.uid || session?.id || "anonymous",
    targetId: attemptedId || undefined,
    role: session?.role || "public_user",
    details: reason || `Security event recorded (${attemptType})`,
  });
  return res.status(201).json({ success: true });
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
    return res.status(403).json({ error: "আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।" });
  }
  const storedHash = match.passwordHash || match.password || "";
  if (!storedHash || !(await bcrypt.compare(cleanPw, storedHash))) {
    return res.status(401).json({ error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" });
  }

  const st = String(match.status || "").toLowerCase();
  const derivedRole = st === "approved" || st === "joined" || match.role === "cadet" ? "cadet" : "user";

  const cadetUser: ServerSessionUser = {
    id: match.id,
    uid: match.ownerUid && match.ownerUid !== "public_applicant" ? match.ownerUid : undefined,
    email: match.studentEmail || null,
    name: match.fullNameEnglish || match.fullNameBangla || "BNCC Member",
    role: derivedRole,
    registrationNumber: match.registrationNumber || match.id,
    authSource: "credential",
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  (cadetUser as any).applicantId = match.id;
  const token = setSessionCookie(res, cadetUser, req);
  return res.json({ authenticated: true, user: cadetUser, token });
});

// =========================================================================
// EXAMINATION SUBSYSTEM SERVER API (CREDENTIAL & FIREBASE DUAL-SYNC)
// =========================================================================

function isExamAttemptOwner(attempt: any, user: ServerSessionUser): boolean {
  const callerKeys = new Set(
    [user.uid, user.id, user.registrationNumber].filter(Boolean).map(String)
  );
  return Boolean(
    (attempt?.ownerUid && callerKeys.has(String(attempt.ownerUid))) ||
      (attempt?.userId && callerKeys.has(String(attempt.userId))) ||
      (attempt?.candidateId && callerKeys.has(String(attempt.candidateId)))
  );
}

function appendExamActivityInternal(
  store: StoredExamData,
  log: { action: string; targetId: string; actorId: string; details: string }
) {
  store.activityLogs.unshift({
    id: `log_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    ...log,
    timestamp: new Date().toISOString(),
  });
}

// --- Question Bank (Admin Only) ---
app.get("/api/exam/questions", requireAuth(EXAM_ADMIN_ROLES), (_req, res) => {
  const store = readExamStore();
  const questions = [...store.questions].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  return res.json({ questions });
});

app.post("/api/exam/questions", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const body = req.body || {};
  if (!body.question || !body.subject) {
    return res.status(400).json({ error: "Subject and question are required" });
  }
  const store = readExamStore();
  const now = new Date().toISOString();
  const id =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim().slice(0, 128)
      : `q_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  const item = {
    ...body,
    id,
    isActive: body.isActive ?? true,
    createdBy: body.createdBy || serverUser.username || serverUser.id || "admin",
    createdAt: body.createdAt || now,
    updatedAt: now,
  };
  const existingIdx = store.questions.findIndex((q) => q.id === id);
  if (existingIdx >= 0) {
    store.questions[existingIdx] = item;
  } else {
    store.questions.unshift(item);
    appendExamActivityInternal(store, {
      action: "QUESTION_CREATED",
      targetId: id,
      actorId: String(item.createdBy),
      details: `Created question: ${String(item.question).substring(0, 40)}... (${item.subject} - ${item.questionType || "mcq"})`,
    });
  }
  writeExamStore(store);
  return res.status(201).json({ id, question: item });
});

app.post("/api/exam/questions/bulk", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "Questions items array is required" });
  }
  const store = readExamStore();
  const now = new Date().toISOString();
  const actorId = String(req.body?.actorId || serverUser.username || serverUser.id || "admin");
  const existingMap = new Map<string, number>();
  store.questions.forEach((q, idx) => existingMap.set(q.id, idx));

  const insertedIds: string[] = [];
  for (const raw of items.slice(0, 1000)) {
    if (!raw || typeof raw !== "object" || !raw.question) continue;
    const id =
      typeof raw.id === "string" && raw.id.trim().length > 0
        ? raw.id.trim().slice(0, 128)
        : `q_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const record = {
      ...raw,
      id,
      isActive: raw.isActive ?? true,
      createdAt: raw.createdAt || now,
      updatedAt: now,
    };
    const idx = existingMap.get(id);
    if (idx !== undefined) {
      store.questions[idx] = record;
    } else {
      store.questions.unshift(record);
      existingMap.set(id, store.questions.length - 1);
    }
    insertedIds.push(id);
  }
  appendExamActivityInternal(store, {
    action: "QUESTION_IMPORTED",
    targetId: "bulk",
    actorId,
    details: `Successfully bulk imported ${insertedIds.length} questions into Question Bank.`,
  });
  writeExamStore(store);
  return res.status(201).json({ count: insertedIds.length, ids: insertedIds });
});

app.patch("/api/exam/questions/:id", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const idx = store.questions.findIndex((q) => q.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Question not found" });
  }
  const updates = { ...(req.body || {}) };
  delete updates.id;
  const now = new Date().toISOString();
  store.questions[idx] = {
    ...store.questions[idx],
    ...updates,
    id,
    updatedAt: now,
  };
  appendExamActivityInternal(store, {
    action: "QUESTION_UPDATED",
    targetId: id,
    actorId: String(updates.actorId || serverUser.username || serverUser.id || "admin"),
    details: `Updated question ID ${id}`,
  });
  writeExamStore(store);
  return res.json({ question: store.questions[idx] });
});

app.delete("/api/exam/questions/:id", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const soft = req.query.soft !== "false";
  const store = readExamStore();
  const idx = store.questions.findIndex((q) => q.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Question not found" });
  }
  if (soft) {
    store.questions[idx] = {
      ...store.questions[idx],
      isActive: false,
      updatedAt: new Date().toISOString(),
    };
  } else {
    store.questions.splice(idx, 1);
  }
  appendExamActivityInternal(store, {
    action: "QUESTION_DELETED",
    targetId: id,
    actorId: String(serverUser.username || serverUser.id || "admin"),
    details: `${soft ? "Soft deleted" : "Permanently deleted"} question ID ${id}`,
  });
  writeExamStore(store);
  return res.json({ success: true });
});

// --- Exams Lifecycle ---
app.get("/api/exam/exams", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const store = readExamStore();
  let items = [...store.exams].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  if (!isAdmin) {
    items = items.filter((e) => e.status === "published" || e.status === "live");
  }
  return res.json({ exams: items.map((e) => sanitizeExamForCaller(e, isAdmin)) });
});

app.get("/api/exam/exams/:id", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const exam = store.exams.find((e) => e.id === id);
  if (!exam) {
    return res.status(404).json({ error: "Exam not found" });
  }
  if (!isAdmin && exam.status !== "published" && exam.status !== "live") {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json({ exam: sanitizeExamForCaller(exam, isAdmin) });
});

app.post("/api/exam/exams", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const body = req.body || {};
  if (!body.title) {
    return res.status(400).json({ error: "Exam title is required" });
  }
  const store = readExamStore();
  const now = new Date().toISOString();
  const id =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim().slice(0, 128)
      : `exam_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  let rawSnapshots: any[] = Array.isArray(body.questionSnapshots) ? body.questionSnapshots : [];
  if (rawSnapshots.length === 0 && Array.isArray(body.selectedQuestionIds) && body.selectedQuestionIds.length > 0) {
    const idSet = new Set(body.selectedQuestionIds.map(String));
    rawSnapshots = store.questions.filter((q) => idSet.has(String(q.id)));
  }

  const totalMarks =
    rawSnapshots.length > 0
      ? rawSnapshots.reduce((acc, q) => acc + (Number(q.marks) || 1), 0)
      : Number(body.totalMarks) || 100;
  const negativePenalty =
    body.negativeMarking?.enabled && Number(body.negativeMarking.marksPerWrongAnswer) > 0
      ? Number(body.negativeMarking.marksPerWrongAnswer)
      : 0;
  const passMarks = Number(body.passMarks) || 0;

  let sealedKeyEnvelope = body.sealedKeyEnvelope;
  if (rawSnapshots.length > 0 && rawSnapshots.some((q) => q.correctAnswer !== undefined)) {
    const keyEntries: AnswerKeyEntry[] = rawSnapshots.map((q) => ({
      id: String(q.id),
      questionType: String(q.questionType || "mcq"),
      correctAnswer: q.correctAnswer ?? "",
      acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String) : [],
      marks: Number(q.marks) || 1,
    }));
    const pkg: SealedExamPackage = { keys: keyEntries, negativePenalty, passMarks };
    examKeyVault.set(id, pkg);
    sealedKeyEnvelope = sealKeys(pkg);
  }

  const exam = {
    ...body,
    id,
    totalMarks,
    questionSnapshots: rawSnapshots.map(stripExamQuestionKeysServer),
    ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
    createdBy: body.createdBy || serverUser.username || serverUser.id || "admin",
    createdAt: body.createdAt || now,
    updatedAt: now,
  };

  const idx = store.exams.findIndex((e) => e.id === id);
  if (idx >= 0) {
    store.exams[idx] = exam;
  } else {
    store.exams.unshift(exam);
    appendExamActivityInternal(store, {
      action: "EXAM_CREATED",
      targetId: id,
      actorId: String(exam.createdBy),
      details: `Created exam '${exam.title}' (${rawSnapshots.length} questions, Total Marks: ${totalMarks})`,
    });
  }
  writeExamStore(store);
  return res.status(201).json({ id, exam });
});

app.patch("/api/exam/exams/:id", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const idx = store.exams.findIndex((e) => e.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Exam not found" });
  }
  const existing = store.exams[idx];
  const updates = { ...(req.body || {}) };
  delete updates.id;

  let snapshots: any[] = Array.isArray(updates.questionSnapshots)
    ? updates.questionSnapshots
    : Array.isArray(existing.questionSnapshots)
    ? existing.questionSnapshots
    : [];
  if (updates.questionSelectionMode === "manual" && Array.isArray(updates.selectedQuestionIds)) {
    const idSet = new Set(updates.selectedQuestionIds.map(String));
    snapshots = store.questions.filter((q) => idSet.has(String(q.id)));
  } else if (snapshots.length > 0) {
    const qMap = new Map(store.questions.map((q) => [String(q.id), q]));
    snapshots = snapshots.map((q) => qMap.get(String(q.id)) || q);
  }

  const totalMarks =
    snapshots.length > 0
      ? snapshots.reduce((acc, q) => acc + (Number(q.marks) || 1), 0)
      : Number(updates.totalMarks ?? existing.totalMarks) || 100;
  const negConfig = updates.negativeMarking ?? existing.negativeMarking;
  const negativePenalty =
    negConfig?.enabled && Number(negConfig.marksPerWrongAnswer) > 0
      ? Number(negConfig.marksPerWrongAnswer)
      : 0;
  const passMarks = Number(updates.passMarks ?? existing.passMarks) || 0;

  let sealedKeyEnvelope = updates.sealedKeyEnvelope || existing.sealedKeyEnvelope;
  if (snapshots.length > 0 && snapshots.some((q) => q.correctAnswer !== undefined)) {
    const keyEntries: AnswerKeyEntry[] = snapshots.map((q) => ({
      id: String(q.id),
      questionType: String(q.questionType || "mcq"),
      correctAnswer: q.correctAnswer ?? "",
      acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers.map(String) : [],
      marks: Number(q.marks) || 1,
    }));
    const pkg: SealedExamPackage = { keys: keyEntries, negativePenalty, passMarks };
    examKeyVault.set(id, pkg);
    sealedKeyEnvelope = sealKeys(pkg);
  }

  const nextExam = {
    ...existing,
    ...updates,
    id,
    totalMarks,
    questionSnapshots: snapshots.map(stripExamQuestionKeysServer),
    ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
    updatedAt: new Date().toISOString(),
  };
  store.exams[idx] = nextExam;
  appendExamActivityInternal(store, {
    action: updates.status === "published" && existing.status !== "published" ? "EXAM_PUBLISHED" : "EXAM_UPDATED",
    targetId: id,
    actorId: String(serverUser.username || serverUser.id || "admin"),
    details:
      updates.status === "published" && existing.status !== "published"
        ? `Published exam '${nextExam.title}'`
        : `Updated exam '${nextExam.title}'`,
  });
  writeExamStore(store);
  return res.json({ exam: nextExam });
});

app.delete("/api/exam/exams/:id", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const next = store.exams.filter((e) => e.id !== id);
  if (next.length === store.exams.length) {
    return res.status(404).json({ error: "Exam not found" });
  }
  store.exams = next;
  appendExamActivityInternal(store, {
    action: "EXAM_UPDATED",
    targetId: id,
    actorId: String(serverUser.username || serverUser.id || "admin"),
    details: `Deleted exam ID ${id}`,
  });
  writeExamStore(store);
  return res.json({ success: true });
});

// --- Attempts & Answer Scripts ---
app.get("/api/exam/attempts", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const examIdFilter = req.query.examId ? String(req.query.examId) : undefined;
  const store = readExamStore();
  let items = [...store.attempts].sort(
    (a, b) => new Date(b.createdAt || b.startedAt || 0).getTime() - new Date(a.createdAt || a.startedAt || 0).getTime()
  );
  if (!isAdmin) {
    items = items.filter((a) => isExamAttemptOwner(a, serverUser));
  }
  if (examIdFilter && examIdFilter !== "ALL") {
    items = items.filter((a) => a.examId === examIdFilter);
  }
  return res.json({ attempts: items });
});

app.get("/api/exam/attempts/:id", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const attempt = store.attempts.find((a) => a.id === id);
  if (!attempt) {
    return res.status(404).json({ error: "Attempt not found" });
  }
  if (!isAdmin && !isExamAttemptOwner(attempt, serverUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return res.json({ attempt });
});

app.post("/api/exam/attempts", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const body = req.body || {};
  const examId = String(body.examId || "").trim();
  if (!examId) {
    return res.status(400).json({ error: "examId is required" });
  }

  const store = readExamStore();
  const callerOwnerUid = String(serverUser.uid || serverUser.id);
  const callerUserId = String(body.userId || serverUser.id);
  const callerCandidateId = String(body.candidateId || serverUser.id);

  // If mirroring an already-created Firestore attempt (matching id), store safely
  if (typeof body.id === "string" && body.id.trim().length > 0) {
    const mirrorId = body.id.trim().slice(0, 128);
    const existingIdx = store.attempts.findIndex((a) => a.id === mirrorId);
    const sanitizedSnapshot = Array.isArray(body.questionSnapshot)
      ? body.questionSnapshot.map(stripExamQuestionKeysServer)
      : [];
    const mirrored = {
      ...body,
      id: mirrorId,
      ownerUid: isAdmin ? body.ownerUid || callerOwnerUid : callerOwnerUid,
      questionSnapshot: sanitizedSnapshot,
    };
    if (existingIdx >= 0) {
      store.attempts[existingIdx] = mirrored;
    } else {
      store.attempts.unshift(mirrored);
    }
    writeExamStore(store);
    return res.status(201).json({ attempt: mirrored });
  }

  const exam = store.exams.find((e) => e.id === examId);
  if (!exam) {
    return res.status(404).json({ error: "পরীক্ষাটি পাওয়া যায়নি (Exam not found)." });
  }
  if (exam.status !== "published" && exam.status !== "live") {
    return res.status(400).json({ error: "পরীক্ষাটি বর্তমানে সক্রিয় নয় (Exam is not active)." });
  }

  const callerAttempts = store.attempts.filter(
    (a) => a.examId === examId && isExamAttemptOwner(a, serverUser)
  );
  const inProgress = callerAttempts.find((a) => a.status === "in_progress");
  if (inProgress) {
    return res.json({ attempt: inProgress });
  }

  const completedCount = callerAttempts.filter(
    (a) => a.status === "submitted" || a.status === "auto_submitted" || a.status === "expired"
  ).length;
  if (exam.maxAttempts > 0 && completedCount >= exam.maxAttempts) {
    return res.status(400).json({
      error: `আপনার সর্বোচ্চ Attempt (${exam.maxAttempts} টি) পূর্ণ হয়ে গেছে।`,
    });
  }

  let questions: any[] = Array.isArray(exam.questionSnapshots) ? [...exam.questionSnapshots] : [];
  if (questions.length === 0 && Array.isArray(exam.selectedQuestionIds) && exam.selectedQuestionIds.length > 0) {
    const idSet = new Set(exam.selectedQuestionIds.map(String));
    questions = store.questions.filter((q) => idSet.has(String(q.id)));
  }
  if (questions.length === 0 && Array.isArray(exam.randomRules) && exam.randomRules.length > 0) {
    const usedIds = new Set<string>();
    const activeQ = store.questions.filter((q) => q.isActive !== false);
    for (const rule of exam.randomRules) {
      let pool = activeQ.filter((q) => q.subject === rule.subject && !usedIds.has(q.id));
      if (rule.questionType) pool = pool.filter((q) => q.questionType === rule.questionType);
      const shuffled = [...pool].sort(() => 0.5 - Math.random());
      const take = Math.min(Number(rule.count) || 0, shuffled.length);
      for (let i = 0; i < take; i++) {
        questions.push(shuffled[i]);
        usedIds.add(shuffled[i].id);
      }
    }
  }
  if (questions.length === 0) {
    return res.status(400).json({
      error: "পরীক্ষায় কোনো প্রশ্ন যুক্ত করা হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।",
    });
  }

  const normalizedQuestions = questions.map((q) => ({
    ...stripExamQuestionKeysServer(q),
    question:
      q.question || q.questionText || q.question_text || q.text || q.title || q.content || q.name || "Question text unavailable",
  }));
  if (exam.shuffleQuestions) {
    normalizedQuestions.sort(() => 0.5 - Math.random());
  }

  const now = new Date().toISOString();
  const attemptId = `att_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const attempt = {
    id: attemptId,
    examId,
    examTitle: exam.title,
    candidateId: callerCandidateId,
    userId: callerUserId,
    ownerUid: callerOwnerUid,
    registrationNumber: String(body.registrationNumber || serverUser.registrationNumber || callerCandidateId),
    candidateName: String(body.candidateName || serverUser.name || "Candidate"),
    candidatePhoto: String(body.candidatePhoto || ""),
    session: String(body.session || ""),
    collegeName: String(body.collegeName || ""),
    startedAt: now,
    status: "in_progress",
    questionSnapshot: normalizedQuestions,
    answers: {},
    createdAt: now,
    updatedAt: now,
  };

  store.attempts.unshift(attempt);
  appendExamActivityInternal(store, {
    action: "EXAM_STARTED",
    targetId: examId,
    actorId: callerUserId,
    details: `Candidate '${attempt.candidateName}' (${callerUserId}) started attempt on '${exam.title}'`,
  });
  writeExamStore(store);
  return res.status(201).json({ attempt });
});

app.post("/api/exam/attempts/:id/answers", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const id = String(req.params.id || "").trim();
  const { questionId, selectedAnswer, isMarkedForReview } = req.body || {};
  if (!questionId) {
    return res.status(400).json({ error: "questionId is required" });
  }

  const store = readExamStore();
  const idx = store.attempts.findIndex((a) => a.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Attempt not found" });
  }
  const attempt = store.attempts[idx];
  if (!isAdmin && !isExamAttemptOwner(attempt, serverUser)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (!isAdmin && attempt.status !== "in_progress") {
    return res.status(400).json({ error: "Attempt is already submitted" });
  }

  const now = new Date().toISOString();
  store.attempts[idx] = {
    ...attempt,
    answers: {
      ...(attempt.answers || {}),
      [String(questionId)]: {
        questionId: String(questionId),
        selectedAnswer,
        answeredAt: now,
        isMarkedForReview: Boolean(isMarkedForReview),
      },
    },
    updatedAt: now,
  };
  writeExamStore(store);
  return res.json({ success: true });
});

app.patch("/api/exam/attempts/:id", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const idx = store.attempts.findIndex((a) => a.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: "Attempt not found" });
  }
  const existing = store.attempts[idx];
  const updates = { ...(req.body || {}) };
  delete updates.id;

  if (!isAdmin) {
    if (!isExamAttemptOwner(existing, serverUser)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (existing.status !== "in_progress") {
      return res.status(400).json({ error: "Submitted attempt cannot be modified by candidate" });
    }
    if (updates.status && updates.status !== "in_progress") {
      if (updates.status !== "submitted") {
        return res.status(403).json({ error: "Invalid status transition" });
      }
      const sigData = updates.resultSignature ? verifySignedToken<any>(String(updates.resultSignature)) : null;
      if (
        !sigData ||
        sigData.examId !== existing.examId ||
        sigData.attemptId !== existing.id ||
        Number(sigData.obtainedObjectiveMarks) !== Number(updates.score)
      ) {
        return res.status(403).json({ error: "Valid server grading signature is required to submit attempt score" });
      }
      store.attempts[idx] = {
        ...existing,
        status: "submitted",
        isAutoSubmitted: Boolean(updates.isAutoSubmitted),
        gradingStatus: updates.gradingStatus || "graded",
        resultSignature: updates.resultSignature,
        submittedAt: updates.submittedAt || new Date().toISOString(),
        score: Number(sigData.obtainedObjectiveMarks),
        percentage: Number(updates.percentage) || 0,
        correctCount: Number(updates.correctCount) || 0,
        wrongCount: Number(updates.wrongCount) || 0,
        unansweredCount: Number(updates.unansweredCount) || 0,
        isPassed: Boolean(updates.isPassed),
        updatedAt: new Date().toISOString(),
      };
    } else if (updates.answers && typeof updates.answers === "object") {
      store.attempts[idx] = {
        ...existing,
        answers: updates.answers,
        updatedAt: new Date().toISOString(),
      };
    } else {
      return res.status(403).json({ error: "Insufficient permissions for requested update" });
    }
  } else {
    store.attempts[idx] = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
  }

  writeExamStore(store);
  return res.json({ attempt: store.attempts[idx] });
});

app.delete("/api/exam/attempts/:id", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const id = String(req.params.id || "").trim();
  const store = readExamStore();
  const target = store.attempts.find((a) => a.id === id);
  if (!target) {
    return res.status(404).json({ error: "Attempt not found" });
  }
  store.attempts = store.attempts.filter((a) => a.id !== id);
  store.results = store.results.filter((r) => r.attemptId !== id);
  appendExamActivityInternal(store, {
    action: "EXAM_DELETED",
    targetId: String(target.examId || id),
    actorId: String(serverUser.username || serverUser.id || "admin"),
    details: `Deleted answer script / attempt ${id} for candidate ${target.candidateName || target.candidateId}`,
  });
  writeExamStore(store);
  return res.json({ success: true });
});

// --- Exam Results ---
app.get("/api/exam/results", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const examIdFilter = req.query.examId ? String(req.query.examId) : undefined;
  const attemptIdFilter = req.query.attemptId ? String(req.query.attemptId) : undefined;
  const isLeaderboard = req.query.leaderboard === "true";

  const store = readExamStore();
  let items = [...store.results].sort(
    (a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
  );

  if (attemptIdFilter) {
    items = items.filter((r) => r.attemptId === attemptIdFilter);
    if (!isAdmin) {
      items = items.filter((r) => isExamAttemptOwner(r, serverUser));
    }
    return res.json({ results: items });
  }

  if (examIdFilter && examIdFilter !== "ALL") {
    items = items.filter((r) => r.examId === examIdFilter);
  }

  if (isAdmin) {
    return res.json({ results: items });
  }

  if (isLeaderboard && store.settings?.showLeaderboardToStudents !== false) {
    const publicBoard = items.map((r) => ({
      id: r.id,
      examId: r.examId,
      examTitle: r.examTitle,
      attemptId: r.attemptId,
      registrationNumber: r.registrationNumber,
      candidateName: r.candidateName,
      score: r.score,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      passMarks: r.passMarks,
      isPassed: r.isPassed,
      timeTakenSeconds: r.timeTakenSeconds,
      submittedAt: r.submittedAt,
    }));
    return res.json({ results: publicBoard });
  }

  return res.json({ results: items.filter((r) => isExamAttemptOwner(r, serverUser)) });
});

app.post("/api/exam/results", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const body = req.body || {};
  if (!body.attemptId || !body.examId) {
    return res.status(400).json({ error: "attemptId and examId are required" });
  }

  if (!isAdmin) {
    const sigData = body.resultSignature ? verifySignedToken<any>(String(body.resultSignature)) : null;
    if (
      !sigData ||
      sigData.examId !== body.examId ||
      sigData.attemptId !== body.attemptId ||
      Number(sigData.obtainedObjectiveMarks) !== Number(body.score)
    ) {
      return res.status(403).json({ error: "Valid server grading signature is required" });
    }
  }

  const store = readExamStore();
  const id =
    typeof body.id === "string" && body.id.trim().length > 0
      ? body.id.trim().slice(0, 128)
      : `res_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const callerOwner = String(serverUser.uid || serverUser.id);
  const record = {
    ...body,
    id,
    ownerUid: isAdmin ? body.ownerUid || callerOwner : callerOwner,
    submittedAt: body.submittedAt || new Date().toISOString(),
  };

  const idx = store.results.findIndex((r) => r.attemptId === record.attemptId || r.id === id);
  if (idx >= 0) {
    store.results[idx] = { ...store.results[idx], ...record, id: store.results[idx].id };
  } else {
    store.results.unshift(record);
  }
  appendExamActivityInternal(store, {
    action: "EXAM_STOPPED",
    targetId: String(record.examId),
    actorId: String(record.userId || callerOwner),
    details: `Candidate '${record.candidateName || "Candidate"}' submitted attempt for '${record.examTitle || record.examId}' (Score: ${record.score}/${record.totalMarks}, ${record.isPassed ? "PASSED" : "FAILED"})`,
  });
  writeExamStore(store);
  return res.status(201).json({ result: idx >= 0 ? store.results[idx] : record });
});

// --- Exam Settings & Logs ---
app.get("/api/exam/settings", requireAuth(), (_req, res) => {
  const store = readExamStore();
  return res.json({ settings: store.settings || getDefaultExamSettings() });
});

app.put("/api/exam/settings", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const store = readExamStore();
  const next = {
    ...(store.settings || getDefaultExamSettings()),
    ...(req.body || {}),
    id: "global",
    updatedAt: new Date().toISOString(),
    updatedBy: String(req.body?.updatedBy || serverUser.username || serverUser.id || "admin"),
  };
  store.settings = next;
  appendExamActivityInternal(store, {
    action: "EXAM_SETTINGS_UPDATED",
    targetId: "global",
    actorId: String(next.updatedBy),
    details: "Updated global examination system settings.",
  });
  writeExamStore(store);
  return res.json({ settings: next });
});

app.get("/api/exam/logs", requireAuth(EXAM_ADMIN_ROLES), (_req, res) => {
  const store = readExamStore();
  return res.json({ logs: store.activityLogs.slice(0, 100) });
});

app.post("/api/exam/logs", requireAuth(), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const { action, targetId, actorId, details } = req.body || {};
  if (!action || !details) {
    return res.status(400).json({ error: "action and details are required" });
  }
  const store = readExamStore();
  appendExamActivityInternal(store, {
    action: String(action).slice(0, 80),
    targetId: String(targetId || "global").slice(0, 128),
    actorId: String(actorId || serverUser.id || "user").slice(0, 128),
    details: String(details).slice(0, 500),
  });
  writeExamStore(store);
  return res.status(201).json({ success: true });
});

app.get("/api/exam/audit-logs", requireAuth(), (req, res) => {
  const serverUser = (req as any).serverUser as ServerSessionUser;
  const isAdmin = EXAM_ADMIN_ROLES.includes(String(serverUser.role || "").toLowerCase());
  const attemptId = String(req.query.attemptId || "").trim();
  const store = readExamStore();

  if (!isAdmin) {
    if (!attemptId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const attempt = store.attempts.find((a) => a.id === attemptId);
    if (!attempt || !isExamAttemptOwner(attempt, serverUser)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  let logs = store.auditLogs;
  if (attemptId) {
    logs = logs.filter((l) => l.attemptId === attemptId);
  }
  return res.json({
    logs: [...logs].sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
    ),
  });
});

app.post("/api/exam/audit-logs", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const body = req.body || {};
  const store = readExamStore();
  const entry = {
    ...body,
    id: body.id || `audit_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    timestamp: body.timestamp || new Date().toISOString(),
  };
  store.auditLogs.unshift(entry);
  writeExamStore(store);
  return res.status(201).json({ log: entry });
});

// --- Batch Mirror from Firebase-Authenticated Admin to Server Store ---
app.post("/api/exam/sync-batch", requireAuth(EXAM_ADMIN_ROLES), (req, res) => {
  if (!verifySameOriginMutation(req)) {
    return res.status(403).json({ error: "Cross-origin request rejected" });
  }
  const { questions, exams, attempts, results, settings } = req.body || {};
  const store = readExamStore();

  const mergeById = (existing: any[], incoming: any[], sanitizeSnap = false) => {
    const map = new Map<string, any>();
    for (const item of existing) {
      if (item?.id) map.set(String(item.id), item);
    }
    for (const item of incoming) {
      if (!item?.id) continue;
      const nextItem = sanitizeSnap && Array.isArray(item.questionSnapshots)
        ? { ...item, questionSnapshots: item.questionSnapshots.map(stripExamQuestionKeysServer) }
        : item;
      map.set(String(item.id), { ...(map.get(String(item.id)) || {}), ...nextItem });
    }
    return Array.from(map.values());
  };

  if (Array.isArray(questions)) store.questions = mergeById(store.questions, questions);
  if (Array.isArray(exams)) store.exams = mergeById(store.exams, exams, true);
  if (Array.isArray(attempts)) store.attempts = mergeById(store.attempts, attempts);
  if (Array.isArray(results)) store.results = mergeById(store.results, results);
  if (settings && typeof settings === "object") {
    store.settings = { ...(store.settings || getDefaultExamSettings()), ...settings, id: "global" };
  }

  writeExamStore(store);
  return res.json({ success: true });
});

app.get("/api/exam/health", (_req, res) => {
  res.json({ status: "ok", module: "Examination System", timestamp: new Date().toISOString() });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "CBCC BNCC Platoon Portal",
    firebaseProjectId: FIREBASE_PROJECT_ID,
    corsConfigured: configuredOriginPatterns.length > 0,
    allowedOriginCount: configuredOriginPatterns.length,
    storageConfigured: {
      dataDir: Boolean((process.env.DATA_DIR || "").trim()),
      mediaDir: Boolean((process.env.MEDIA_DIR || "").trim()),
      dataMode: DATA_STORAGE.mode,
      mediaMode: MEDIA_STORAGE.mode,
      persistentDataStorage: DATA_STORAGE.persistent,
      persistentMediaStorage: MEDIA_STORAGE.persistent,
    },
    timestamp: new Date().toISOString(),
  });
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
    if (!DATA_STORAGE.persistent || !MEDIA_STORAGE.persistent) {
      console.warn(
        "[STORAGE WARNING] Running with ephemeral /tmp storage fallback because DATA_DIR or MEDIA_DIR was not writable."
      );
    } else if (!(process.env.DATA_DIR || "").trim() || !(process.env.MEDIA_DIR || "").trim()) {
      console.warn(
        "[STORAGE INFO] DATA_DIR or MEDIA_DIR is not explicitly set in production; mount persistent volumes for server-local JSON/media files or rely on Firebase Firestore & Storage."
      );
    }
    const distPath = path.join(process.cwd(), "dist");
    const distIndexPath = path.join(distPath, "index.html");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
    }
    app.use("/api", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found" });
    });
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return next();
      }
      if (fs.existsSync(distIndexPath)) {
        return res.sendFile(distIndexPath);
      }
      return res.json({
        status: "ok",
        service: "CBCC BNCC Platoon Backend API",
        health: "/api/health",
      });
    });
  }

  writePublicAssetsManifest();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
