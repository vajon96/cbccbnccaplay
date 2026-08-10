import bcrypt from "bcryptjs";
import { db, doc, getDoc, getDocs, collection, query, where } from "../firebase";

export interface AuthUser {
  id: string;
  name: string;
  role: "super_admin" | "admin" | "exam_admin" | "qr_admin" | "cadet" | "user";
  username?: string;
  registrationNumber?: string;
  permissions?: Record<string, boolean>;
  expiry?: number;
}

export const generatePassword = (length = 8) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
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

export const setSession = (user: AuthUser) => {
  const sessionData: AuthUser = {
    ...user,
    expiry: Date.now() + 1000 * 60 * 60 * 12 // 12 hours central session
  };
  localStorage.setItem("bncc_session", JSON.stringify(sessionData));
  // Keep admin2 legacy flag in sync for backwards compatibility
  if (["super_admin", "admin", "exam_admin", "qr_admin"].includes(user.role)) {
    localStorage.setItem("admin2PasswordVerified", "true");
  }
};

export const getSession = (): AuthUser | null => {
  const sessionStr = localStorage.getItem("bncc_session");
  if (!sessionStr) return null;
  
  try {
    const session: AuthUser = JSON.parse(sessionStr);
    if (session.expiry && Date.now() > session.expiry) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem("bncc_session");
  localStorage.removeItem("admin2PasswordVerified");
};

export const isAuthorizedAdmin = (role?: string): boolean => {
  return ["super_admin", "admin", "exam_admin", "qr_admin"].includes(role || "");
};

export const isAuthorizedCadet = (role?: string): boolean => {
  return ["cadet", "user"].includes(role || "");
};

/**
 * Centralized Single Authentication Engine
 * Validates credentials against Admin or Cadet/User records.
 */
export async function centralAuthenticate(
  userIdOrUsername: string,
  plainPassword: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const cleanId = userIdOrUsername.trim();
  const cleanPassword = plainPassword.trim();

  if (!cleanId || !cleanPassword) {
    return { success: false, error: "ইউজার আইডি ও পাসওয়ার্ড প্রবেশ করান।" };
  }

  // 1. Static Super Admin Check
  const envPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "").trim();
  const fallbackPassword = "BNCC@Admin#2026!Secure";

  if (cleanId.toLowerCase() === "admin") {
    if (cleanPassword === fallbackPassword || (envPassword && cleanPassword === envPassword)) {
      const superAdminUser: AuthUser = {
        id: "admin",
        username: "admin",
        name: "Platoon Commander",
        role: "super_admin",
        permissions: {
          canAdd: true,
          canEdit: true,
          canDelete: true,
          canViewLogs: true,
          canResetPW: true,
          canApprove: true,
          canExport: true,
          canChat: true
        }
      };
      return { success: true, user: superAdminUser };
    } else {
      return { success: false, error: "ভুল অ্যাডমিন পাসওয়ার্ড।" };
    }
  }

  // 2. Dynamic Admin Check (admins collection)
  try {
    const adminsRef = collection(db, "admins");
    const adminQuery = query(adminsRef, where("username", "==", cleanId.toLowerCase()));
    const adminSnapshot = await getDocs(adminQuery);

    if (!adminSnapshot.empty) {
      const adminDoc = adminSnapshot.docs[0];
      const adminData = adminDoc.data();
      const isMatch = await comparePassword(cleanPassword, adminData.password || adminData.passwordHash || "");

      if (isMatch) {
        const adminRole = adminData.role || "admin";
        const adminUser: AuthUser = {
          id: adminDoc.id,
          username: adminData.username || cleanId,
          name: adminData.name || "BNCC Admin",
          role: adminRole,
          permissions: adminData.permissions || {
            canAdd: adminRole !== "qr_admin",
            canEdit: true,
            canDelete: false,
            canViewLogs: true,
            canResetPW: false,
            canApprove: true,
            canExport: false,
            canChat: true
          }
        };
        return { success: true, user: adminUser };
      } else {
        return { success: false, error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" };
      }
    }
  } catch (err) {
    console.error("Central Auth - Admin check error:", err);
  }

  // 3. User / Cadet Check (applicants collection by ID)
  try {
    const docRef = doc(db, "applicants", cleanId);
    const docSnap = await getDoc(docRef);

    let userData: any = null;
    let userIdFound = cleanId;

    if (docSnap.exists()) {
      userData = docSnap.data();
    } else {
      // Check applicants collection by registrationNumber or phone
      const appRef = collection(db, "applicants");
      const regQuery = query(appRef, where("registrationNumber", "==", cleanId));
      const regSnap = await getDocs(regQuery);

      if (!regSnap.empty) {
        userData = regSnap.docs[0].data();
        userIdFound = regSnap.docs[0].id;
      }
    }

    if (userData) {
      const isMatch = await comparePassword(
        cleanPassword,
        userData.password || userData.passwordHash || ""
      );

      if (isMatch) {
        const cadetUser: AuthUser = {
          id: userIdFound,
          name: userData.fullNameEnglish || userData.fullName || "BNCC Cadet",
          role: userData.role || "cadet",
          registrationNumber: userData.registrationNumber || userIdFound
        };
        return { success: true, user: cadetUser };
      } else {
        return { success: false, error: "ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।" };
      }
    }
  } catch (err) {
    console.error("Central Auth - User check error:", err);
  }

  return { success: false, error: "ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়।" };
}

