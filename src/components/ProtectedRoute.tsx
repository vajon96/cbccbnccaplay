import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getSession } from "../lib/auth";
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

export function ProtectedRoute({
  children,
  allowedRoles,
  requireAdmin,
  requireCadet,
  requiredPermission,
}: ProtectedRouteProps) {
  const session = getSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
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
