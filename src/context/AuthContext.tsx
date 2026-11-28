import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { auth, onAuthStateChanged } from "../firebase";
import {
  AuthUser,
  getSession,
  setSession,
  logoutEverywhere,
  authenticateWithEmailPassword,
  registerWithEmailPassword,
  requestEmailPasswordReset,
  sendVerificationEmailToCurrentUser,
  centralAuthenticate,
  authenticateWithQrToken,
  syncServerSession,
  setServerAuthToken,
  getServerAuthHeaders,
} from "../lib/auth";
import {
  isAdminRole,
  isCadetRole,
  isOfficialCadet,
  normalizeRole,
  hasPermission,
  PermissionKey,
} from "../lib/rbac";
import { apiFetch } from "../lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCadet: boolean;
  isOfficialCadet: boolean;
  isImpersonating: boolean;
  hasPermission: (perm: PermissionKey) => boolean;
  refreshSession: () => Promise<void>;
  loginWithEmail: (
    email: string,
    pw: string,
    options?: { requireAdmin?: boolean }
  ) => ReturnType<typeof authenticateWithEmailPassword>;
  registerWithEmail: (email: string, pw: string, name?: string) => ReturnType<typeof registerWithEmailPassword>;
  resendVerificationEmail: () => ReturnType<typeof sendVerificationEmailToCurrentUser>;
  sendPasswordReset: (email: string) => ReturnType<typeof requestEmailPasswordReset>;
  loginWithCredentials: (
    id: string,
    pw: string,
    options?: { requireAdmin?: boolean }
  ) => ReturnType<typeof centralAuthenticate>;
  loginWithQrToken: (qrToken: string) => ReturnType<typeof authenticateWithQrToken>;
  startImpersonation: (target: { id: string; name: string; registrationNumber?: string; email?: string }) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getSession());
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const fb = auth.currentUser;
    setFirebaseUser(fb);
    const local = getSession();
    try {
      const headers = await getServerAuthHeaders();
      const res = await apiFetch("/api/auth/session", { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated && data.user) {
          if (data.token) {
            setServerAuthToken(data.token);
          }
          const serverRole = normalizeRole(data.user.role);
          const hasLocalLinkedApplicant = Boolean(
            local && fb && local.uid === fb.uid && (local.applicantId || (local.id && local.id !== fb.uid))
          );
          if (
            local &&
            fb &&
            local.uid === fb.uid &&
            ((serverRole === "user" && local.role !== "user") || hasLocalLinkedApplicant)
          ) {
            await syncServerSession(local);
            setUser(local);
            return;
          }
          const merged: AuthUser = {
            ...data.user,
            emailVerified: fb ? Boolean(fb.emailVerified) : data.user.emailVerified,
            role: serverRole,
          };
          setSession(merged);
          setUser(merged);
          return;
        }
      }

      // Restore server token from active Firebase session if cookie/memory token cleared on reload
      if (fb) {
        const idToken = await fb.getIdToken().catch(() => null);
        if (idToken) {
          if (
            local &&
            local.uid === fb.uid &&
            (local.role !== "user" || local.applicantId || (local.id && local.id !== fb.uid))
          ) {
            const ok = await syncServerSession(local, idToken);
            if (ok) {
              setUser(local);
              return;
            }
          }
          const fbRes = await apiFetch("/api/auth/firebase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ idToken }),
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData?.token) setServerAuthToken(fbData.token);
            if (fbData?.user) {
              const merged: AuthUser = {
                ...fbData.user,
                emailVerified: Boolean(fb.emailVerified),
                role: normalizeRole(fbData.user.role),
              };
              setSession(merged);
              setUser(merged);
              return;
            }
          }
        }
      }
    } catch {
      // Offline fallback to validated local session
    }
    setUser(local);
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleSessionEvent = () => {
      if (mounted) {
        setUser(getSession());
      }
    };

    window.addEventListener("storage", handleSessionEvent);
    window.addEventListener("bncc-session-changed", handleSessionEvent);

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!mounted) return;
      setFirebaseUser(fbUser);
      await refreshSession();
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      window.removeEventListener("storage", handleSessionEvent);
      window.removeEventListener("bncc-session-changed", handleSessionEvent);
      unsubscribe();
    };
  }, [refreshSession]);

  const loginWithEmail = async (
    email: string,
    pw: string,
    options?: { requireAdmin?: boolean }
  ) => {
    const res = await authenticateWithEmailPassword(email, pw, options);
    setFirebaseUser(auth.currentUser);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const registerWithEmail = async (email: string, pw: string, name?: string) => {
    const res = await registerWithEmailPassword(email, pw, name);
    setFirebaseUser(auth.currentUser);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const loginWithCredentials = async (
    id: string,
    pw: string,
    options?: { requireAdmin?: boolean }
  ) => {
    const res = await centralAuthenticate(id, pw, options);
    setFirebaseUser(auth.currentUser);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const loginWithQrToken = async (qrToken: string) => {
    const res = await authenticateWithQrToken(qrToken);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const startImpersonation = async (target: {
    id: string;
    name: string;
    registrationNumber?: string;
    email?: string;
  }) => {
    if (!user || !isAdminRole(user.role)) return;
    const originalAdmin = user.impersonatedBy || {
      id: user.id,
      name: user.name,
      role: user.role,
      uid: user.uid,
      email: user.email,
    };
    const impersonated: AuthUser = {
      id: target.id,
      name: target.name,
      role: "cadet",
      registrationNumber: target.registrationNumber || target.id,
      email: target.email,
      authSource: user.authSource,
      impersonatedBy: originalAdmin,
    };
    await syncServerSession(impersonated);
    setSession(impersonated);
    setUser(impersonated);
  };

  const stopImpersonation = async () => {
    if (!user?.impersonatedBy) return;
    const restored: AuthUser = {
      id: user.impersonatedBy.id,
      uid: user.impersonatedBy.uid,
      email: user.impersonatedBy.email,
      name: user.impersonatedBy.name,
      role: user.impersonatedBy.role,
      authSource: user.authSource || "firebase",
      impersonatedBy: null,
    };
    await syncServerSession(restored);
    setSession(restored);
    setUser(restored);
  };

  const logout = async () => {
    await logoutEverywhere();
    setUser(null);
    setFirebaseUser(null);
  };

  const value: AuthContextValue = {
    user,
    firebaseUser,
    loading,
    isAuthenticated: Boolean(user),
    emailVerified: Boolean(firebaseUser?.emailVerified ?? user?.emailVerified),
    isAdmin: Boolean(user && isAdminRole(user.role)),
    isSuperAdmin: Boolean(user && user.role === "super_admin"),
    isCadet: Boolean(user && isCadetRole(user.role)),
    isOfficialCadet: Boolean(user && isOfficialCadet(user.role)),
    isImpersonating: Boolean(user?.impersonatedBy),
    hasPermission: (perm: PermissionKey) =>
      Boolean(user && hasPermission(user.role, perm, user.permissions)),
    refreshSession,
    loginWithEmail,
    registerWithEmail,
    resendVerificationEmail: sendVerificationEmailToCurrentUser,
    sendPasswordReset: requestEmailPasswordReset,
    loginWithCredentials,
    loginWithQrToken,
    startImpersonation,
    stopImpersonation,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
