import { Navigate } from "react-router-dom";

/**
 * Legacy AdminLogin route consolidated into centralized verified Login.
 */
export function AdminLogin() {
  return <Navigate to="/login" replace />;
}
