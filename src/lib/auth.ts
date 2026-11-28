import bcrypt from "bcryptjs";
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
  updateDoc,
  Timestamp,
} from "../firebase";
import {
  UserRole,
  isAdminRole,
  isCadetRole,
  normalizeRole,
} from "./rbac";
import { apiFetch } from "./api";

export interface AuthUser {
  id: string;
  uid?: string;
  applicantId?: string;
  email?: string | null;
  emailVerified?: boolean;
  name: string;
  role: UserRole;
  username?: string;
  registrationNumber?: string;
  permissions?: Record<string, boolean>;
  authSource?: "firebase" | "credential" | "qr_token";
  impersonatedBy?: {
    id: string;
    name: string;
    role: UserRole;
    uid?: string;
    email?: string | null;
  } | null;
  expiry?: number;
}

const SESSION_KEY = "bncc_session";
const LOGIN_RATE_KEY = "bncc_login_attempts";
export const SUPER_ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || "sajondey102@gmail.com"
)
  .trim()
  .toLowerCase();

export const generatePassword = (length = 10) => {
  const charset =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const bytes = new Uint8Array(length);
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let retVal = "";
  for (let i = 0; i < length; ++i) {
    retVal += charset.charAt(bytes[i] % charset.length);
  }
  return retVal;
};

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string) => {
  if (!hash) return false;
  return await bcrypt.compare(password, hash);
};

// Client-side brute-force throttle guard (complemented by server IP rate limiting)
export function checkLoginRateLimit(): { blocked: boolean; remainingSeconds: number } {
  try {
    const raw = sessionStorage.getItem(LOGIN_RATE_KEY);
    if (!raw) return { blocked: false, remainingSeconds: 0 };
    const parsed = JSON.parse(raw) as { count: number; lockUntil?: number };
    if (parsed.lockUntil && Date.now() < parsed.lockUntil) {
      return {
        blocked: true,
        remainingSeconds: Math.ceil((parsed.lockUntil - Date.now()) / 1000),
      };
    }
    return { blocked: false, remainingSeconds: 0 };
  } catch {
    return { blocked: false, remainingSeconds: 0 };
  }
}

export function recordFailedLoginAttempt() {
  try {
    const raw = sessionStorage.getItem(LOGIN_RATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { count: number; lockUntil?: number }) : { count: 0 };
    const nextCount = (parsed.count || 0) + 1;
    const lockUntil = nextCount >= 5 ? Date.now() + 60 * 1000 : undefined;
    sessionStorage.setItem(LOGIN_RATE_KEY, JSON.stringify({ count: nextCount, lockUntil }));
  } catch {
    // Ignore storage errors
  }
}

export function resetLoginAttempts() {
  try {
    sessionStorage.removeItem(LOGIN_RATE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export const notifySessionChange = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bncc-session-changed"));
  }
};

export const setSession = (user: AuthUser) => {
  const sessionData: AuthUser = {
    ...user,
    role: normalizeRole(user.role),
    expiry: Date.now() + 1000 * 60 * 60 * 12,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  localStorage.removeItem("admin2PasswordVerified");
  notifySessionChange();
};

export const getSession = (): AuthUser | null => {
  const sessionStr = localStorage.getItem(SESSION_KEY);
  if (!sessionStr) return null;

  try {
    const session: AuthUser = JSON.parse(sessionStr);
    if (session.expiry && Date.now() > session.expiry) {
      clearSession();
      return null;
    }
    session.role = normalizeRole(session.role);
    return session;
  } catch {
    clearSession();
    return null;
  }
};

// In-memory-only server session bearer token (never stored in localStorage/sessionStorage)
let inMemoryServerToken: string | null = null;

export function setServerAuthToken(token: string | null | undefined) {
  inMemoryServerToken = token && typeof token === "string" ? token : null;
}

export function getServerAuthToken(): string | null {
  return inMemoryServerToken;
}

export async function getServerAuthHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (inMemoryServerToken) {
    headers.Authorization = `Bearer ${inMemoryServerToken}`;
  } else if (auth.currentUser) {
    const fbToken = await auth.currentUser.getIdToken().catch(() => null);
    if (fbToken) {
      headers.Authorization = `Bearer ${fbToken}`;
    }
  }
  return headers;
}

export const clearSession = () => {
  inMemoryServerToken = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("admin2PasswordVerified");
  notifySessionChange();
};

export const isAuthorizedAdmin = (role?: string): boolean => {
  return isAdminRole(role);
};

export const isAuthorizedCadet = (role?: string): boolean => {
  return isCadetRole(role);
};

/**
 * Synchronizes verified client/Firebase session into Express HttpOnly signed cookie.
 */
export async function syncServerSession(
  user: AuthUser,
  firebaseIdToken?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (firebaseIdToken) {
      headers.Authorization = `Bearer ${firebaseIdToken}`;
    } else if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } else if (inMemoryServerToken) {
      headers.Authorization = `Bearer ${inMemoryServerToken}`;
    }

    const res = await apiFetch("/api/auth/session-sync", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ user }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.token) {
        setServerAuthToken(data.token);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function logoutEverywhere(): Promise<void> {
  clearSession();
  try {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore network errors during logout cleanup
  }
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Ignore Firebase sign-out errors
  }
}

function mapFirebaseAuthError(err: any): string {
  const code = err?.code || "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "ইমেইল বা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে পুনরায় যাচাই করুন।";
    case "auth/email-already-in-use":
      return "এই ইমেইল দিয়ে ইতিমধ্যেই একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে। অনুগ্রহ করে সাইন-ইন করুন অথবা পাসওয়ার্ড রিসেট করুন।";
    case "auth/weak-password":
      return "পাসওয়ার্ডটি অত্যন্ত দুর্বল। কমপক্ষে ৬ অক্ষরের শক্তিশালী পাসওয়ার্ড দিন।";
    case "auth/invalid-email":
      return "অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।";
    case "auth/too-many-requests":
      return "অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।";
    case "auth/operation-not-allowed":
      return "Firebase Console-এ Email/Password Sign-In চালু করুন অথবা আপনার Cadet ID / Officer Username দিয়ে লগইন করুন।";
    case "auth/unauthorized-domain":
      return "এই ডোমেইনটি Firebase Authentication Authorized Domains-এ যুক্ত করা নেই।";
    default:
      return err?.message || "লগইন বা নিবন্ধন সম্পন্ন করা যায়নি।";
  }
}

function resolveApplicantAccountRole(data: Record<string, any> | undefined): UserRole {
  if (!data) return "user";
  const status = String(data.status || "").trim().toLowerCase();
  if (status === "approved" || status === "joined" || data.role === "cadet") {
    return "cadet";
  }
  return "user";
}

/**
 * Ensures every Firebase authenticated user is linked to their Firestore /users/{uid} document.
 * Preserves server/admin-assigned roles and avoids touching protected fields for regular users.
 */
async function syncFirebaseUserProfileDoc(
  fbUser: NonNullable<typeof auth.currentUser>,
  options: {
    emailLower: string;
    displayName: string;
    initialRole: UserRole;
    applicantId?: string;
    registrationNumber?: string;
    isSuperBootstrap?: boolean;
  }
): Promise<{ role: UserRole; isSuspended: boolean; data?: Record<string, any> }> {
  const userDocRef = doc(db, "users", fbUser.uid);
  const nowIso = new Date().toISOString();

  try {
    const existingSnap = await getDoc(userDocRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (existingData.isActive === false || existingData.accountStatus === "Suspended") {
        return { role: normalizeRole(existingData.role), isSuspended: true, data: existingData };
      }

      const updateFields: Record<string, any> = {
        displayName: options.displayName || existingData.displayName || "",
        email: options.emailLower || existingData.email || "",
        emailVerified: Boolean(fbUser.emailVerified),
        provider: "password",
        lastLoginAt: nowIso,
        updatedAt: Timestamp.now(),
      };
      if (options.applicantId) updateFields.applicantId = options.applicantId;
      if (options.registrationNumber) updateFields.registrationNumber = options.registrationNumber;
      if (options.isSuperBootstrap) {
        updateFields.role = "super_admin";
        updateFields.accountStatus = "Active";
        updateFields.isActive = true;
      }

      await updateDoc(userDocRef, updateFields).catch(() => {});
      return {
        role: options.isSuperBootstrap ? "super_admin" : normalizeRole(existingData.role || options.initialRole),
        isSuspended: false,
        data: existingData,
      };
    }

    const createRole: UserRole = options.isSuperBootstrap ? "super_admin" : "user";
    await setDoc(userDocRef, {
      uid: fbUser.uid,
      email: options.emailLower,
      emailVerified: Boolean(fbUser.emailVerified),
      displayName: options.displayName,
      role: createRole,
      ...(options.applicantId ? { applicantId: options.applicantId } : {}),
      ...(options.registrationNumber ? { registrationNumber: options.registrationNumber } : {}),
      provider: "password",
      accountStatus: "Active",
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      lastLoginAt: nowIso,
    }).catch(() => {});

    return { role: options.isSuperBootstrap ? "super_admin" : options.initialRole, isSuspended: false };
  } catch {
    return { role: options.initialRole, isSuspended: false };
  }
}

/**
 * Resolves Firebase authenticated user claims & role from Firestore /admins, /users/{uid}, or /applicants.
 */
async function resolveFirebaseSessionUser(
  fbUser: NonNullable<typeof auth.currentUser>,
  fallbackName?: string,
  requireAdmin = false
) {
  const emailLower = (fbUser.email || "").toLowerCase();
  const displayName = fbUser.displayName || fallbackName || emailLower || "BNCC Member";
  const idToken = await fbUser.getIdToken(true);

  if (!requireAdmin) {
    const fbRes = await apiFetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    }).catch(() => null);
    if (fbRes?.ok) {
      const fbData = await fbRes.json().catch(() => null);
      if (fbData?.token) setServerAuthToken(fbData.token);
    }
  }

  // 1. Bootstrapped Super Admin (requires verified email or pre-existing /admins/{uid} super_admin doc)
  if (emailLower === SUPER_ADMIN_EMAIL) {
    let hasAdminAccess = Boolean(fbUser.emailVerified);
    if (!hasAdminAccess) {
      const existingAdminSnap = await getDoc(doc(db, "admins", fbUser.uid)).catch(() => null);
      hasAdminAccess = Boolean(existingAdminSnap?.exists() && existingAdminSnap.data()?.role === "super_admin");
    }

    if (fbUser.emailVerified) {
      try {
        await setDoc(
          doc(db, "admins", fbUser.uid),
          {
            uid: fbUser.uid,
            name: fbUser.displayName || fallbackName || "Platoon Commander",
            username: "admin",
            email: emailLower,
            role: "super_admin",
            isActive: true,
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
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      } catch {
        // Rules authorize verified SUPER_ADMIN_EMAIL directly
      }
    }

    await syncFirebaseUserProfileDoc(fbUser, {
      emailLower,
      displayName: fbUser.displayName || fallbackName || "Platoon Commander",
      initialRole: hasAdminAccess ? "super_admin" : "user",
      isSuperBootstrap: hasAdminAccess,
    });

    if (!hasAdminAccess) {
      await sendEmailVerification(fbUser).catch(() => {});
      await logoutEverywhere();
      throw new Error(
        "সুপার অ্যাডমিন অ্যাক্সেসের জন্য আপনার ইমেইল ভেরিফাই করা আবশ্যক। ইনবক্সে পাঠানো ভেরিফিকেশন লিংকে ক্লিক করে আবার লগইন করুন।"
      );
    }

    const superAdmin: AuthUser = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: emailLower,
      emailVerified: Boolean(fbUser.emailVerified),
      username: "admin",
      name: fbUser.displayName || fallbackName || "Platoon Commander",
      role: "super_admin",
      authSource: "firebase",
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
    };
    await syncServerSession(superAdmin, idToken);
    return { user: superAdmin, needsCadetLink: false };
  }

  // 2. Check /admins/{uid}
  try {
    const adminDocSnap = await getDoc(doc(db, "admins", fbUser.uid));
    if (adminDocSnap.exists()) {
      const data = adminDocSnap.data();
      if (data.isActive === false || data.accountStatus === "Suspended") {
        await logoutEverywhere();
        throw new Error("আপনার অ্যাডমিন অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।");
      }
      const adminRole = normalizeRole(data.role || "admin");
      const userSync = await syncFirebaseUserProfileDoc(fbUser, {
        emailLower,
        displayName: data.name || displayName,
        initialRole: adminRole,
      });
      if (userSync.isSuspended) {
        await logoutEverywhere();
        throw new Error("আপনার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত করা হয়েছে।");
      }
      const adminUser: AuthUser = {
        id: adminDocSnap.id,
        uid: fbUser.uid,
        email: emailLower,
        emailVerified: Boolean(fbUser.emailVerified),
        username: data.username || emailLower,
        name: data.name || fbUser.displayName || fallbackName || "BNCC Officer",
        role: adminRole,
        authSource: "firebase",
        permissions: data.permissions || {},
      };
      await syncServerSession(adminUser, idToken);
      return { user: adminUser, needsCadetLink: false };
    }
  } catch (err: any) {
    if (err?.message?.includes("স্থগিত")) throw err;
  }

  // 2b. Sync and check /users/{uid} for admin or moderator role assignment
  const userProfileSync = await syncFirebaseUserProfileDoc(fbUser, {
    emailLower,
    displayName,
    initialRole: "user",
  });
  if (userProfileSync.isSuspended) {
    await logoutEverywhere();
    throw new Error("আপনার অ্যাকাউন্টটি সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে। প্লাটুন অফিসারের সাথে যোগাযোগ করুন।");
  }
  if (isAdminRole(userProfileSync.role)) {
    const staffUser: AuthUser = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: emailLower,
      emailVerified: Boolean(fbUser.emailVerified),
      username: emailLower,
      name: userProfileSync.data?.displayName || displayName,
      role: userProfileSync.role,
      authSource: "firebase",
      permissions:
        userProfileSync.role === "moderator"
          ? { canEdit: true, canApprove: true, canViewLogs: true, canChat: true }
          : { canAdd: true, canEdit: true, canApprove: true, canViewLogs: true, canExport: true, canChat: true },
    };
    await syncServerSession(staffUser, idToken);
    return { user: staffUser, needsCadetLink: false };
  }

  if (requireAdmin) {
    const nonAdminUser: AuthUser = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: emailLower,
      emailVerified: Boolean(fbUser.emailVerified),
      name: displayName,
      role: "user",
      authSource: "firebase",
    };
    return { user: nonAdminUser, needsCadetLink: false };
  }

  // 3. Check linked /applicants where ownerUid == fbUser.uid
  try {
    const appQ = query(
      collection(db, "applicants"),
      where("ownerUid", "==", fbUser.uid)
    );
    const appSnap = await getDocs(appQ);
    if (!appSnap.empty) {
      const docSnap = appSnap.docs[0];
      const data = docSnap.data();
      if (data.isActive === false || data.accountStatus === "Suspended") {
        await logoutEverywhere();
        throw new Error("আপনার অ্যাকাউন্টটি সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে। প্লাটুন অফিসারের সাথে যোগাযোগ করুন।");
      }
      const regNum = data.registrationNumber || docSnap.id;
      const derivedRole = resolveApplicantAccountRole(data);
      await syncFirebaseUserProfileDoc(fbUser, {
        emailLower,
        displayName: data.fullNameEnglish || data.fullNameBangla || displayName,
        initialRole: derivedRole,
        applicantId: docSnap.id,
        registrationNumber: regNum,
      });
      const cadetOrApplicant: AuthUser = {
        id: docSnap.id,
        uid: fbUser.uid,
        applicantId: docSnap.id,
        email: emailLower,
        emailVerified: Boolean(fbUser.emailVerified),
        name: data.fullNameEnglish || data.fullNameBangla || fbUser.displayName || "BNCC Member",
        role: derivedRole,
        registrationNumber: regNum,
        authSource: "firebase",
      };
      await syncServerSession(cadetOrApplicant, idToken);
      return { user: cadetOrApplicant, needsCadetLink: false };
    }
  } catch (err: any) {
    if (err?.message?.includes("নিষ্ক্রিয়")) throw err;
  }

  const visitorUser: AuthUser = {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: emailLower,
    emailVerified: Boolean(fbUser.emailVerified),
    name: displayName,
    role: "user",
    authSource: "firebase",
  };
  await syncServerSession(visitorUser, idToken);
  return { user: visitorUser, needsCadetLink: true };
}

/**
 * Independent Email & Password Authentication via Firebase Auth.
 */
export async function authenticateWithEmailPassword(
  email: string,
  plainPassword: string,
  options?: { requireAdmin?: boolean }
): Promise<{
  success: boolean;
  user?: AuthUser;
  needsCadetLink?: boolean;
  error?: string;
}> {
  const rate = checkLoginRateLimit();
  if (rate.blocked) {
    return {
      success: false,
      error: `অতিরিক্ত ভুল চেষ্টার কারণে ${rate.remainingSeconds} সেকেন্ড অপেক্ষা করুন।`,
    };
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = plainPassword.trim();
  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: "ইমেইল এবং পাসওয়ার্ড উভয়ই প্রবেশ করান।" };
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    const requireAdmin = Boolean(options?.requireAdmin);
    const resolved = await resolveFirebaseSessionUser(cred.user, undefined, requireAdmin);
    resetLoginAttempts();

    if (requireAdmin && !isAdminRole(resolved.user.role)) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: "এই ইমেইলটি অনুমোদিত সুপার অ্যাডমিন বা অ্যাডমিন হিসেবে নিবন্ধিত নয়।",
      };
    }

    return {
      success: true,
      user: resolved.user,
      needsCadetLink: resolved.needsCadetLink,
    };
  } catch (err: any) {
    recordFailedLoginAttempt();
    return {
      success: false,
      error: mapFirebaseAuthError(err),
    };
  }
}

/**
 * Creates a brand-new Email & Password account via Firebase Auth and sends verification email.
 */
export async function registerWithEmailPassword(
  email: string,
  plainPassword: string,
  displayName?: string
): Promise<{
  success: boolean;
  user?: AuthUser;
  verificationEmailSent?: boolean;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = plainPassword.trim();
  const cleanName = (displayName || "").trim();

  if (!cleanEmail || !cleanEmail.includes("@")) {
    return {
      success: false,
      error: "অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।",
    };
  }

  if (cleanPassword.length < 6) {
    return {
      success: false,
      error: "কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড প্রদান করুন।",
    };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
    }
    let verificationEmailSent = false;
    try {
      await sendEmailVerification(cred.user);
      verificationEmailSent = true;
    } catch {
      verificationEmailSent = false;
    }
    const resolved = await resolveFirebaseSessionUser(cred.user, cleanName);
    resetLoginAttempts();
    return { success: true, user: resolved.user, verificationEmailSent };
  } catch (err: any) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function sendVerificationEmailToCurrentUser(): Promise<{
  success: boolean;
  error?: string;
}> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    return { success: false, error: "প্রথমে ইমেইল দিয়ে সাইন-ইন করুন।" };
  }
  try {
    await sendEmailVerification(fbUser);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

export async function requestEmailPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "অনুগ্রহ করে সঠিক নিবন্ধিত ইমেইল ঠিকানা লিখুন।" };
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true };
  } catch (err: any) {
    // Prevent account enumeration while surfacing domain/config errors
    if (err?.code === "auth/user-not-found") {
      return { success: true };
    }
    return { success: false, error: mapFirebaseAuthError(err) };
  }
}

/**
 * Unauthenticated or authenticated Officer-Assisted Password Reset submission via backend API.
 */
export async function submitOfficerPasswordResetRequest(payload: {
  identifier: string;
  mobile: string;
  note?: string;
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const cleanId = payload.identifier.trim();
  const cleanMobile = payload.mobile.trim();
  if (!cleanId || !cleanMobile) {
    return {
      success: false,
      error: "ক্যাডেট / আবেদন আইডি এবং নিবন্ধিত মোবাইল নম্বর উভয়ই দিন।",
    };
  }
  try {
    const res = await apiFetch("/api/auth/password-reset-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        identifier: cleanId,
        mobile: cleanMobile,
        note: (payload.note || "").trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data?.error || "রিকভারি অনুরোধ জমা দেওয়া যায়নি।",
      };
    }
    return { success: true, requestId: data?.id };
  } catch {
    return {
      success: false,
      error: "সার্ভারের সাথে সংযোগ করা যায়নি। পরে চেষ্টা করুন।",
    };
  }
}

/**
 * Links an authenticated Email/Password user to an existing Applicant/Cadet record.
 */
export async function linkEmailSessionToApplicant(
  applicantIdOrReg: string,
  plainPassword: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    return { success: false, error: "প্রথমে ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন।" };
  }
  const cleanId = applicantIdOrReg.trim();
  const cleanPw = plainPassword.trim();
  if (!cleanId || !cleanPw) {
    return { success: false, error: "ক্যাডেট আইডি এবং পাসওয়ার্ড উভয়ই দিন।" };
  }

  try {
    const idToken = await fbUser.getIdToken();
    const res = await apiFetch("/api/auth/link-applicant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ applicantId: cleanId, password: cleanPw }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.user) {
      if (data.token) {
        setServerAuthToken(data.token);
      }
      // Best-effort sync of Firestore ownerUid across linked collections and /users/{uid}
      try {
        const targetId = data.user.applicantId || data.user.id || cleanId;
        await updateDoc(doc(db, "applicants", targetId), {
          ownerUid: fbUser.uid,
          updatedAt: Timestamp.now(),
        }).catch(() => {});
        await updateDoc(doc(db, "admissions", targetId), {
          ownerUid: fbUser.uid,
          updatedAt: Timestamp.now(),
        }).catch(() => {});
        await updateDoc(doc(db, "public_qr_cards", targetId), {
          ownerUid: fbUser.uid,
          updatedAt: Timestamp.now(),
        }).catch(() => {});
        await updateDoc(doc(db, "users", fbUser.uid), {
          applicantId: targetId,
          registrationNumber: data.user.registrationNumber || targetId,
          updatedAt: Timestamp.now(),
        }).catch(() => {});
      } catch {
        // Non-blocking Firestore sync
      }
      setSession(data.user);
      return { success: true, user: data.user };
    }
    return {
      success: false,
      error: data?.error || "অ্যাকাউন্ট লিংক করা যায়নি। ক্যাডেট আইডি ও পাসওয়ার্ড যাচাই করুন।",
    };
  } catch {
    return {
      success: false,
      error: "সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। পরে চেষ্টা করুন।",
    };
  }
}

/**
 * Verifies an Admin/Officer QR Login token against the server token vault.
 */
export async function authenticateWithQrToken(
  qrToken: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanToken = qrToken.trim();
  if (!cleanToken || !cleanToken.startsWith("adm_qr_")) {
    return {
      success: false,
      error: "অবৈধ অ্যাডমিন QR কোড। এটি ক্যাডেট কিউআর কোড হতে পারে।",
    };
  }
  try {
    const res = await apiFetch("/api/auth/qr-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ qrToken: cleanToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.user) {
      if (data.token) {
        setServerAuthToken(data.token);
      }
      const userObj: AuthUser = {
        ...data.user,
        role: normalizeRole(data.user.role),
        authSource: "qr_token",
      };
      setSession(userObj);
      resetLoginAttempts();
      return { success: true, user: userObj };
    }
    recordFailedLoginAttempt();
    return {
      success: false,
      error: data?.error || "অবৈধ বা মেয়াদোত্তীর্ণ অ্যাডমিন QR কোড।",
    };
  } catch {
    return {
      success: false,
      error: "সার্ভারের সাথে সংযোগ করা যায়নি। পরে আবার চেষ্টা করুন।",
    };
  }
}

/**
 * Central Authentication Engine (Email+Password, Admin Credentials, Officer Username, Cadet/Applicant ID/Reg).
 * Zero Google OAuth dependencies or hardcoded secrets in client bundle.
 */
export async function centralAuthenticate(
  userIdOrUsername: string,
  plainPassword: string,
  options?: { requireAdmin?: boolean }
): Promise<{ success: boolean; user?: AuthUser; needsCadetLink?: boolean; error?: string }> {
  const rate = checkLoginRateLimit();
  if (rate.blocked) {
    return {
      success: false,
      error: `অতিরিক্ত ভুল চেষ্টার কারণে ${rate.remainingSeconds} সেকেন্ড অপেক্ষা করুন।`,
    };
  }

  const cleanId = userIdOrUsername.trim();
  const cleanPassword = plainPassword.trim();

  if (!cleanId || !cleanPassword) {
    return { success: false, error: "ইউজার আইডি / ইমেইল ও পাসওয়ার্ড প্রবেশ করান।" };
  }

  // 0. If email provided, verify directly via Firebase Email/Password Auth
  if (cleanId.includes("@")) {
    return await authenticateWithEmailPassword(cleanId, cleanPassword, options);
  }

  // 1. Server-side credential verification endpoint (never exposes secrets in client bundle)
  try {
    const fbToken = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
    const serverRes = await apiFetch("/api/auth/credential-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(fbToken ? { Authorization: `Bearer ${fbToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ username: cleanId, password: cleanPassword }),
    });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data?.token) {
        setServerAuthToken(data.token);
      }
      if (data?.user) {
        if (options?.requireAdmin && !isAdminRole(data.user.role)) {
          return {
            success: false,
            error: "এই অ্যাকাউন্টটি অফিসার বা অ্যাডমিন হিসেবে অনুমোদিত নয়।",
          };
        }
        resetLoginAttempts();
        return { success: true, user: data.user };
      }
    } else if (serverRes.status === 401 || serverRes.status === 403) {
      const errBody = await serverRes.json().catch(() => ({}));
      recordFailedLoginAttempt();
      return {
        success: false,
        error:
          errBody?.error ||
          "ভুল ইউজারনেম বা পাসওয়ার্ড! সঠিক তথ্য দিয়ে আবার চেষ্টা করুন।",
      };
    }
  } catch {
    // Fall back to Firestore check when authenticated via Firebase session
  }

  if (cleanId.toLowerCase() === "admin") {
    return {
      success: false,
      error:
        "অ্যাডমিন সার্ভার যাচাই করা যায়নি। অনুগ্রহ করে সুপার অ্যাডমিন ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।",
    };
  }

  // 2. Dynamic Admin / Officer Check (when Firebase Auth is active or readable)
  try {
    const adminsRef = collection(db, "admins");
    const adminQuery = query(adminsRef, where("username", "==", cleanId.toLowerCase()));
    const adminSnapshot = await getDocs(adminQuery);

    if (!adminSnapshot.empty) {
      const adminDoc = adminSnapshot.docs[0];
      const adminData = adminDoc.data();
      if (adminData.isActive === false || adminData.accountStatus === "Suspended") {
        return {
          success: false,
          error: "এই অফিসার অ্যাকাউন্টটি সাময়িকভাবে স্থগিত রয়েছে।",
        };
      }
      const isMatch = await comparePassword(
        cleanPassword,
        adminData.password || adminData.passwordHash || ""
      );

      if (isMatch) {
        const adminRole = normalizeRole(adminData.role || "admin");
        const adminUser: AuthUser = {
          id: adminDoc.id,
          uid: auth.currentUser?.uid,
          username: adminData.username || cleanId,
          name: adminData.name || "BNCC Officer",
          role: adminRole,
          authSource: "credential",
          permissions: adminData.permissions || {},
        };
        await syncServerSession(adminUser);
        resetLoginAttempts();
        return { success: true, user: adminUser };
      }
      recordFailedLoginAttempt();
      return { success: false, error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" };
    }
  } catch {
    // Permission denied if unauthenticated in Firestore rules
  }

  if (options?.requireAdmin) {
    recordFailedLoginAttempt();
    return {
      success: false,
      error: "ভুল অফিসার ইউজারনেম / ইমেইল অথবা পাসওয়ার্ড।",
    };
  }

  // 3. Cadet / Applicant Check (Firestore first, then server fallback registry)
  try {
    const docRef = doc(db, "applicants", cleanId);
    const docSnap = await getDoc(docRef);

    let userData: any = null;
    let userIdFound = cleanId;

    if (docSnap.exists()) {
      userData = docSnap.data();
    } else if (auth.currentUser) {
      const appRef = collection(db, "applicants");
      const regQuery = query(
        appRef,
        where("ownerUid", "==", auth.currentUser.uid)
      );
      const regSnap = await getDocs(regQuery);
      const matched = regSnap.docs.find(
        (d) =>
          d.id === cleanId ||
          d.data().registrationNumber === cleanId ||
          d.data().studentPhone === cleanId
      );
      if (matched) {
        userData = matched.data();
        userIdFound = matched.id;
      }
    }

    if (userData) {
      if (userData.isActive === false || userData.accountStatus === "Suspended") {
        return {
          success: false,
          error: "আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।",
        };
      }
      const isMatch = await comparePassword(
        cleanPassword,
        userData.password || userData.passwordHash || ""
      );
      if (isMatch) {
        if (auth.currentUser && !userData.ownerUid) {
          await updateDoc(doc(db, "applicants", userIdFound), {
            ownerUid: auth.currentUser.uid,
          }).catch(() => {});
        }
        const cadetUser: AuthUser = {
          id: userIdFound,
          uid: userData.ownerUid || auth.currentUser?.uid,
          applicantId: userIdFound,
          email: userData.studentEmail || auth.currentUser?.email,
          name: userData.fullNameEnglish || userData.fullNameBangla || "BNCC Member",
          role: resolveApplicantAccountRole(userData),
          registrationNumber: userData.registrationNumber || userIdFound,
          authSource: "credential",
        };
        await syncServerSession(cadetUser);
        resetLoginAttempts();
        return { success: true, user: cadetUser };
      }
      recordFailedLoginAttempt();
      return { success: false, error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" };
    }
  } catch {
    // Fall through to server-verified cadet/applicant login
  }

  try {
    const cadetRes = await apiFetch("/api/auth/cadet-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ applicantId: cleanId, password: cleanPassword }),
    });
    if (cadetRes.ok) {
      const data = await cadetRes.json();
      if (data?.token) {
        setServerAuthToken(data.token);
      }
      if (data?.user) {
        resetLoginAttempts();
        return { success: true, user: data.user };
      }
    } else if (cadetRes.status === 401 || cadetRes.status === 403) {
      const errBody = await cadetRes.json().catch(() => ({}));
      recordFailedLoginAttempt();
      return {
        success: false,
        error: errBody?.error || "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।",
      };
    }
  } catch {
    // Network issue
  }

  recordFailedLoginAttempt();
  return {
    success: false,
    error: "ইউজার আইডি / ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
  };
}
