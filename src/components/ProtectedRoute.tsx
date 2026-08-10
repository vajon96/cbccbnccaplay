import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession, isAuthorizedAdmin, isAuthorizedCadet } from "../lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireAdmin?: boolean;
  requireCadet?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAdmin,
  requireCadet
}: ProtectedRouteProps) {
  const session = getSession();
  const location = useLocation();

  if (!session) {
    // Redirect to central login, retaining attempted destination
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Check admin requirement
  if (requireAdmin && !isAuthorizedAdmin(session.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // Check cadet requirement
  if (requireCadet && !isAuthorizedCadet(session.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Check explicit role list if provided
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    if (isAuthorizedAdmin(session.role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
