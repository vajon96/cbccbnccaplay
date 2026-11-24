/**
 * Centralized Role-Based Access Control (RBAC) Permission Matrix
 * Strictly separates Applicants (user), Official Cadets (cadet),
 * Specialized Officers (exam_admin, qr_admin, attendance_officer), and Admins.
 */

export type UserRole =
  | "super_admin"
  | "admin"
  | "moderator"
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
  | "view_applicant_dashboard"
  | "view_cadet_id_card"
  | "edit_cadet_profile"
  | "submit_enrollment"
  | "take_exams";

export const ADMIN_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "moderator",
  "exam_admin",
  "qr_admin",
  "sub_admin",
  "attendance_officer",
];

export const FULL_ADMIN_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "moderator",
  "sub_admin",
];

export const QR_INSPECTOR_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "qr_admin",
  "attendance_officer",
];

export const EXAM_ADMIN_ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "exam_admin",
];

export const OFFICIAL_CADET_ROLES: UserRole[] = ["cadet"];
export const APPLICANT_ROLES: UserRole[] = ["user"];
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
    "view_applicant_dashboard",
    "view_cadet_id_card",
    "edit_cadet_profile",
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
  moderator: [
    "view_admin_dashboard",
    "manage_applicants",
    "approve_applicants",
    "view_audit_logs",
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
    "view_cadet_id_card",
    "edit_cadet_profile",
    "take_exams",
  ],
  user: [
    "view_applicant_dashboard",
    "submit_enrollment",
    "take_exams",
  ],
};

export const ROLE_LABELS: Record<UserRole, { en: string; bn: string }> = {
  super_admin: { en: "Platoon Commander (Super Admin)", bn: "প্লাটুন কমান্ডার (সুপার অ্যাডমিন)" },
  admin: { en: "System Admin", bn: "সিস্টেম অ্যাডমিন" },
  moderator: { en: "Moderator", bn: "মডারেটর" },
  sub_admin: { en: "Sub Admin", bn: "সাব-অ্যাডমিন" },
  exam_admin: { en: "Exam Controller", bn: "পরীক্ষা নিয়ন্ত্রক" },
  qr_admin: { en: "QR Attendance Admin", bn: "কিউআর অ্যাডমিন" },
  attendance_officer: { en: "Attendance Officer", bn: "উপস্থিতি কর্মকর্তা" },
  cadet: { en: "Inducted BNCC Cadet", bn: "অনুমোদিত বিএনসিসি ক্যাডেট" },
  user: { en: "Applicant / Portal Member", bn: "আবেদনকারী / পোর্টাল সদস্য" },
};

export function getRoleLabel(role?: string | null, lang: "en" | "bn" = "bn"): string {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized][lang];
}

export function normalizeRole(role?: string | null): UserRole {
  const valid: UserRole[] = [
    "super_admin",
    "admin",
    "moderator",
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

export function isFullAdminRole(role?: string | null): boolean {
  return FULL_ADMIN_ROLES.includes(normalizeRole(role));
}

export function isQrInspectorRole(role?: string | null): boolean {
  return QR_INSPECTOR_ROLES.includes(normalizeRole(role));
}

export function isExamAdminRole(role?: string | null): boolean {
  return EXAM_ADMIN_ROLES.includes(normalizeRole(role));
}

export function isOfficialCadet(role?: string | null): boolean {
  return normalizeRole(role) === "cadet";
}

export function isApplicantAccount(role?: string | null): boolean {
  return normalizeRole(role) === "user";
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
    case "moderator":
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
    return ["super_admin", "admin", "moderator", "sub_admin"].includes(normalized);
  }
  if (pathname.startsWith("/admin2/dashboard")) {
    return ["super_admin", "admin", "qr_admin", "attendance_officer"].includes(normalized);
  }
  if (pathname.startsWith("/exam/admin")) {
    return ["super_admin", "admin", "exam_admin"].includes(normalized);
  }
  if (
    pathname.startsWith("/exam/dashboard") ||
    pathname.startsWith("/exam/instructions") ||
    pathname.startsWith("/exam/take") ||
    pathname.startsWith("/exam/result")
  ) {
    return ["cadet", "user", "super_admin", "admin", "exam_admin"].includes(normalized);
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/messenger")) {
    return true;
  }
  return true;
}
