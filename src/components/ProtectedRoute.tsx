import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  PermissionKey,
  canAccessRoute,
  getDefaultLandingRoute,
  hasPermission,
  isAdminRole,
  isCadetRole,
} from "../lib/rbac";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireAdmin?: boolean;
  requireCadet?: boolean;
  requiredPermission?: PermissionKey;
}

function getContextualLoginRoute(pathname: string): string {
  if (pathname.startsWith("/admin2")) return "/admin2";
  if (pathname.startsWith("/exam/admin")) return "/exam/admin/login";
  if (pathname.startsWith("/exam")) return "/exam/login";
  return "/login";
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAdmin,
  requireCadet,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user: session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center bg-[#020B18] text-slate-200 gap-3">
        <div className="w-12 h-12 rounded-2xl bg-[#002147] border border-[#C5A059]/30 flex items-center justify-center">
          <Shield className="w-6 h-6 text-[#C5A059]" />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 tracking-wide">
          <Loader2 className="w-4 h-4 animate-spin text-[#C5A059]" />
          <span>সেশন যাচাই করা হচ্ছে...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to={getContextualLoginRoute(location.pathname)}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (requireAdmin && !isAdminRole(session.role)) {
    return <Navigate to={getDefaultLandingRoute(session.role)} replace />;
  }

  if (requireCadet && !isCadetRole(session.role)) {
    return <Navigate to={getDefaultLandingRoute(session.role)} replace />;
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(session.role)
  ) {
    return <Navigate to={getDefaultLandingRoute(session.role)} replace />;
  }

  if (
    requiredPermission &&
    !hasPermission(session.role, requiredPermission, session.permissions)
  ) {
    return <Navigate to={getDefaultLandingRoute(session.role)} replace />;
  }

  if (!canAccessRoute(session.role, location.pathname)) {
    return <Navigate to={getDefaultLandingRoute(session.role)} replace />;
  }

  return <>{children}</>;
}
