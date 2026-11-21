/**
 * Centralized Role-Based Access Control (RBAC) Permission Matrix
 * Covers all 8 portal roles and route/action permissions.
 */

export type UserRole =
  | "super_admin"
  | "admin"
  | "exam_admin"
  | "qr_admin"
  | "sub_admin"
  | "attendance_officer"
  | "cadet"
  | "user";

export type PermissionKey =
  | "view_admin_dashboard"
  | "manage_applicants"
  | "approve_applicants"
  | "delete_applicants"
  | "manage_admins"
  | "manage_cms"
  | "manage_qr_attendance"
  | "manage_exams"
  | "grade_exams"
  | "view_audit_logs"
  | "reset_passwords"
  | "export_data"
  | "manage_messenger"
  | "view_cadet_dashboard"
  | "take_exams";

export const ADMIN_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "exam_admin",
  "qr_admin",
  "sub_admin",
  "attendance_officer",
];

export const CADET_ROLES: UserRole[] = ["cadet", "user"];

export const ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  super_admin: [
    "view_admin_dashboard",
    "manage_applicants",
    "approve_applicants",
    "delete_applicants",
    "manage_admins",
    "manage_cms",
    "manage_qr_attendance",
    "manage_exams",
    "grade_exams",
    "view_audit_logs",
    "reset_passwords",
    "export_data",
    "manage_messenger",
    "view_cadet_dashboard",
    "take_exams",
  ],
  admin: [
    "view_admin_dashboard",
    "manage_applicants",
    "approve_applicants",
    "manage_cms",
    "manage_qr_attendance",
    "manage_exams",
    "grade_exams",
    "view_audit_logs",
    "reset_passwords",
    "export_data",
    "manage_messenger",
  ],
  sub_admin: [
    "view_admin_dashboard",
    "manage_applicants",
    "approve_applicants",
    "view_audit_logs",
    "manage_messenger",
  ],
  exam_admin: [
    "manage_exams",
    "grade_exams",
    "export_data",
    "view_audit_logs",
  ],
  qr_admin: [
    "manage_qr_attendance",
    "view_audit_logs",
  ],
  attendance_officer: [
    "manage_qr_attendance",
  ],
  cadet: [
    "view_cadet_dashboard",
    "take_exams",
  ],
  user: [
    "view_cadet_dashboard",
    "take_exams",
  ],
};

export const ROLE_LABELS: Record<UserRole, { en: string; bn: string }> = {
  super_admin: { en: "Platoon Commander (Super Admin)", bn: "প্লাটুন কমান্ডার (সুপার অ্যাডমিন)" },
  admin: { en: "System Admin", bn: "সিস্টেম অ্যাডমিন" },
  sub_admin: { en: "Sub Admin", bn: "সাব-অ্যাডমিন" },
  exam_admin: { en: "Exam Controller", bn: "পরীক্ষা নিয়ন্ত্রক" },
  qr_admin: { en: "QR Attendance Admin", bn: "কিউআর অ্যাডমিন" },
  attendance_officer: { en: "Attendance Officer", bn: "উপস্থিতি কর্মকর্তা" },
  cadet: { en: "BNCC Cadet", bn: "বিএনসিসি ক্যাডেট" },
  user: { en: "Applicant", bn: "আবেদনকারী" },
};

export function normalizeRole(role?: string | null): UserRole {
  const valid: UserRole[] = [
    "super_admin",
    "admin",
    "exam_admin",
    "qr_admin",
    "sub_admin",
    "attendance_officer",
    "cadet",
    "user",
  ];
  if (role && (valid as string[]).includes(role)) {
    return role as UserRole;
  }
  return "user";
}

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.includes(normalizeRole(role));
}

export function isCadetRole(role?: string | null): boolean {
  return CADET_ROLES.includes(normalizeRole(role));
}

export function hasPermission(
  role: string | undefined | null,
  permission: PermissionKey,
  customPermissions?: Record<string, boolean>
): boolean {
  const normalized = normalizeRole(role);
  if (normalized === "super_admin") return true;
  if (customPermissions && typeof customPermissions[permission] === "boolean") {
    return customPermissions[permission];
  }
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function getDefaultLandingRoute(role?: string | null): string {
  const normalized = normalizeRole(role);
  switch (normalized) {
    case "super_admin":
    case "admin":
    case "sub_admin":
      return "/admin/dashboard";
    case "exam_admin":
      return "/exam/admin";
    case "qr_admin":
    case "attendance_officer":
      return "/admin/qr-dashboard";
    case "cadet":
    case "user":
    default:
      return "/dashboard";
  }
}

export function canAccessRoute(role: string | undefined | null, pathname: string): boolean {
  const normalized = normalizeRole(role);
  if (normalized === "super_admin") return true;

  if (pathname.startsWith("/admin/cms")) {
    return ["super_admin", "admin"].includes(normalized);
  }
  if (pathname.startsWith("/admin/qr-dashboard")) {
    return ["super_admin", "admin", "qr_admin", "attendance_officer"].includes(normalized);
  }
  if (pathname.startsWith("/admin/dashboard")) {
    return ["super_admin", "admin", "sub_admin"].includes(normalized);
  }
  if (pathname.startsWith("/admin2/dashboard")) {
    return ["super_admin", "admin", "qr_admin", "attendance_officer"].includes(normalized);
  }
  if (pathname.startsWith("/exam/admin")) {
    return ["super_admin", "admin", "exam_admin"].includes(normalized);
  }
  if (pathname.startsWith("/exam/dashboard") || pathname.startsWith("/exam/instructions") || pathname.startsWith("/exam/take") || pathname.startsWith("/exam/result")) {
    return ["cadet", "user", "super_admin", "admin", "exam_admin"].includes(normalized);
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/messenger")) {
    return true;
  }
  return true;
}
