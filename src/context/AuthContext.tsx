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
  centralAuthenticate,
  syncServerSession,
  authenticateWithGoogle,
} from "../lib/auth";
import { isAdminRole, isCadetRole, normalizeRole, hasPermission, PermissionKey } from "../lib/rbac";

interface AuthContextValue {
  user: AuthUser | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCadet: boolean;
  isImpersonating: boolean;
  hasPermission: (perm: PermissionKey) => boolean;
  refreshSession: () => Promise<void>;
  loginWithEmail: (email: string, pw: string) => ReturnType<typeof authenticateWithEmailPassword>;
  registerWithEmail: (email: string, pw: string, name?: string) => ReturnType<typeof registerWithEmailPassword>;
  sendPasswordReset: (email: string) => ReturnType<typeof requestEmailPasswordReset>;
  loginWithCredentials: (id: string, pw: string) => ReturnType<typeof centralAuthenticate>;
  loginWithGoogle: () => ReturnType<typeof authenticateWithGoogle>;
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
    setFirebaseUser(auth.currentUser);
    const local = getSession();
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated && data.user) {
          const merged: AuthUser = {
            ...data.user,
            role: normalizeRole(data.user.role),
          };
          setSession(merged);
          setUser(merged);
          return;
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

  const loginWithEmail = async (email: string, pw: string) => {
    const res = await authenticateWithEmailPassword(email, pw);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const registerWithEmail = async (email: string, pw: string, name?: string) => {
    const res = await registerWithEmailPassword(email, pw, name);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const loginWithCredentials = async (id: string, pw: string) => {
    const res = await centralAuthenticate(id, pw);
    if (res.success && res.user) {
      setSession(res.user);
      setUser(res.user);
    }
    return res;
  };

  const loginWithGoogle = async () => {
    const res = await authenticateWithGoogle();
    setFirebaseUser(auth.currentUser);
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
      authSource: "firebase",
      impersonatedBy: null,
    };
    await syncServerSession(restored);
    setSession(restored);
    setUser(restored);
  };

  const logout = async () => {
    await logoutEverywhere();
    setUser(null);
  };

  const value: AuthContextValue = {
    user,
    firebaseUser,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: Boolean(user && isAdminRole(user.role)),
    isSuperAdmin: Boolean(user && user.role === "super_admin"),
    isCadet: Boolean(user && isCadetRole(user.role)),
    isImpersonating: Boolean(user?.impersonatedBy),
    hasPermission: (perm: PermissionKey) =>
      Boolean(user && hasPermission(user.role, perm, user.permissions)),
    refreshSession,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset: requestEmailPasswordReset,
    loginWithCredentials,
    loginWithGoogle,
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
