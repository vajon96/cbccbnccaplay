import bcrypt from "bcryptjs";
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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

export interface AuthUser {
  id: string;
  uid?: string;
  email?: string | null;
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
  if (isAdminRole(sessionData.role)) {
    localStorage.setItem("admin2PasswordVerified", "true");
  } else {
    localStorage.removeItem("admin2PasswordVerified");
  }
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

export const clearSession = () => {
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
    }

    const res = await fetch("/api/auth/session-sync", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ user }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logoutEverywhere(): Promise<void> {
  clearSession();
  try {
    await fetch("/api/auth/logout", {
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
      return "এই ইমেইল দিয়ে ইতিমধ্যেই একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে। অনুগ্রহ করে সাইন-ইন করুন।";
    case "auth/weak-password":
      return "পাসওয়ার্ডটি অত্যন্ত দুর্বল। কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।";
    case "auth/invalid-email":
      return "অনুগ্রহ করে একটি সঠিক ইমেইল ঠিকানা প্রদান করুন।";
    case "auth/too-many-requests":
      return "অতিরিক্ত চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। কিছুক্ষণ পর চেষ্টা করুন।";
    case "auth/operation-not-allowed":
      return "Firebase Console-এ অনুমোদিত Sign-In (Google / Email) চালু করুন অথবা আপনার Cadet ID / Admin Username দিয়ে লগইন করুন।";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google লগইন পপ-আপ বন্ধ করা হয়েছে। আবার চেষ্টা করুন।";
    case "auth/popup-blocked":
      return "ব্রাউজার পপ-আপ ব্লক করেছে। অনুগ্রহ করে পপ-আপ অনুমতি দিয়ে পুনরায় চেষ্টা করুন।";
    case "auth/unauthorized-domain":
      return "এই ডোমেইনটি Firebase Authentication Authorized Domains-এ যুক্ত করা নেই।";
    default:
      return err?.message || "লগইন বা নিবন্ধন সম্পন্ন করা যায়নি।";
  }
}

/**
 * Resolves Firebase authenticated user claims & role from Firestore /admins or /applicants.
 */
async function resolveFirebaseSessionUser(
  fbUser: NonNullable<typeof auth.currentUser>,
  fallbackName?: string,
  requireAdmin = false
) {
  const providerEmail = fbUser.providerData?.find((p) => p.email)?.email || "";
  const emailLower = (fbUser.email || providerEmail || "").toLowerCase();
  const idToken = await fbUser.getIdToken(true);

  if (!requireAdmin) {
    await fetch("/api/auth/firebase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken }),
    }).catch(() => {});
  }

  // 1. Bootstrapped Super Admin
  if (emailLower === SUPER_ADMIN_EMAIL) {
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
      // Rules authorize SUPER_ADMIN_EMAIL directly
    }

    const superAdmin: AuthUser = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: emailLower,
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
      const adminUser: AuthUser = {
        id: adminDocSnap.id,
        uid: fbUser.uid,
        email: emailLower,
        username: data.username || emailLower,
        name: data.name || fbUser.displayName || fallbackName || "BNCC Officer",
        role: normalizeRole(data.role || "admin"),
        authSource: "firebase",
        permissions: data.permissions || {},
      };
      await syncServerSession(adminUser, idToken);
      return { user: adminUser, needsCadetLink: false };
    }
  } catch (err: any) {
    if (err?.message?.includes("স্থগিত")) throw err;
  }

  if (requireAdmin) {
    const nonAdminUser: AuthUser = {
      id: fbUser.uid,
      uid: fbUser.uid,
      email: emailLower,
      name: fbUser.displayName || fallbackName || emailLower,
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
      const cadetUser: AuthUser = {
        id: docSnap.id,
        uid: fbUser.uid,
        email: emailLower,
        name: data.fullNameEnglish || data.fullNameBangla || fbUser.displayName || "BNCC Cadet",
        role: normalizeRole(data.role || "cadet"),
        registrationNumber: data.registrationNumber || docSnap.id,
        authSource: "firebase",
      };
      await syncServerSession(cadetUser, idToken);
      return { user: cadetUser, needsCadetLink: false };
    }
  } catch (err: any) {
    if (err?.message?.includes("নিষ্ক্রিয়")) throw err;
  }

  const visitorUser: AuthUser = {
    id: fbUser.uid,
    uid: fbUser.uid,
    email: emailLower,
    name: fbUser.displayName || fallbackName || emailLower,
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
 * Google Sign-In via Firebase Auth Popup (recommended for AI Studio iframe).
 */
export async function authenticateWithGoogle(
  options?: { requireAdmin?: boolean }
): Promise<{
  success: boolean;
  user?: AuthUser;
  needsCadetLink?: boolean;
  error?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    const requireAdmin = Boolean(options?.requireAdmin);
    const resolved = await resolveFirebaseSessionUser(cred.user, undefined, requireAdmin);
    resetLoginAttempts();

    if (requireAdmin && !isAdminRole(resolved.user.role)) {
      await signOut(auth).catch(() => {});
      return {
        success: false,
        error: "এই Google অ্যাকাউন্টটি অনুমোদিত সুপার অ্যাডমিন বা অ্যাডমিন হিসেবে নিবন্ধিত নয়।",
      };
    }

    return {
      success: true,
      user: resolved.user,
      needsCadetLink: resolved.needsCadetLink,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapFirebaseAuthError(err),
    };
  }
}

/**
 * Creates a brand-new Email & Password account via Firebase Auth.
 */
export async function registerWithEmailPassword(
  email: string,
  plainPassword: string,
  displayName?: string
): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = plainPassword.trim();
  const cleanName = (displayName || "").trim();

  if (!cleanEmail || cleanPassword.length < 6) {
    return {
      success: false,
      error: "সঠিক ইমেইল ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড প্রদান করুন।",
    };
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
    }
    const resolved = await resolveFirebaseSessionUser(cred.user, cleanName);
    resetLoginAttempts();
    return { success: true, user: resolved.user };
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
    return { success: false, error: mapFirebaseAuthError(err) };
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
    const res = await fetch("/api/auth/link-applicant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await fbUser.getIdToken()}`,
      },
      credentials: "include",
      body: JSON.stringify({ applicantId: cleanId, password: cleanPw }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        setSession(data.user);
        return { success: true, user: data.user };
      }
    }
    const errBody = await res.json().catch(() => ({}));
    return {
      success: false,
      error: errBody.error || "অ্যাকাউন্ট লিংক করা যায়নি। ক্যাডেট আইডি ও পাসওয়ার্ড যাচাই করুন।",
    };
  } catch {
    return {
      success: false,
      error: "সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি। পরে চেষ্টা করুন।",
    };
  }
}

/**
 * Central Authentication Engine (Email+Password, Admin Credentials, Officer Username, Cadet ID/Reg).
 * Zero Google OAuth dependencies or hardcoded secrets in client bundle.
 */
export async function centralAuthenticate(
  userIdOrUsername: string,
  plainPassword: string
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
    return await authenticateWithEmailPassword(cleanId, cleanPassword);
  }

  // 1. Server-side credential verification endpoint (never exposes secrets in client bundle)
  try {
    const fbToken = auth.currentUser ? await auth.currentUser.getIdToken() : undefined;
    const serverRes = await fetch("/api/auth/credential-login", {
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
      if (data?.user) {
        resetLoginAttempts();
        return { success: true, user: data.user };
      }
    } else if (serverRes.status === 401 && cleanId.toLowerCase() === "admin") {
      recordFailedLoginAttempt();
      return {
        success: false,
        error: "ভুল অ্যাডমিন পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে আবার চেষ্টা করুন।",
      };
    }
  } catch {
    // Fall back to Firestore check when authenticated via Firebase session
  }

  if (cleanId.toLowerCase() === "admin") {
    return {
      success: false,
      error: "অ্যাডমিন সার্ভার যাচাই করা যায়নি। অনুগ্রহ করে সুপার অ্যাডমিন ইমেইল ও পাসওয়ার্ড ব্যবহার করুন।",
    };
  }

  // 2. Dynamic Admin / Officer Check
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

  // 3. Cadet / Applicant Check
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
          error: "আপনার ক্যাডেট অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।",
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
          email: userData.studentEmail || auth.currentUser?.email,
          name: userData.fullNameEnglish || userData.fullNameBangla || "BNCC Cadet",
          role: normalizeRole(userData.role || "cadet"),
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
    return {
      success: false,
      error: "ক্যাডেট প্রোফাইলে প্রবেশ করতে আপনার নিবন্ধিত ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন।",
    };
  }

  recordFailedLoginAttempt();
  return {
    success: false,
    error: "ইউজার আইডি / ইমেইল বা পাসওয়ার্ড সঠিক নয়।",
  };
}

