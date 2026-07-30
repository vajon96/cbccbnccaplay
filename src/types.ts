export interface CadetProfile {
  id: string;
  registrationNumber: string;
  fullNameBangla: string;
  fullNameEnglish: string;
  fatherNameBangla?: string;
  fatherNameEnglish?: string;
  motherNameBangla?: string;
  motherNameEnglish?: string;
  dob?: string;
  gender?: "Male" | "Female" | "Other" | string;
  religion?: "Islam" | "Hinduism" | "Buddhism" | "Christianity" | "Other" | string;
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | string;
  heightFeet?: number | string;
  heightInches?: number | string;
  height?: string; // combined e.g. 5'8"
  weightKg?: number | string;
  isEthnicMinority?: "Yes" | "No" | boolean | string;

  studentPhone: string;
  studentEmail: string;
  presentAddress?: string;
  permanentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  collegeName: string;
  emisId?: string;
  classRoll?: string;
  section?: string;
  session?: string;
  subject?: string;
  studyStatus?: "Regular" | "Irregular" | "Graduated" | "Dropped" | string;

  // SSC
  sscBoard?: string;
  sscGroup?: string;
  sscGpa?: number | string;
  sscYear?: number | string;

  // HSC
  hscBoard?: string;
  hscGroup?: string;
  hscGpa?: number | string;
  hscOptionalSubject?: string;
  hscYear?: number | string;

  // BNCC
  currentRank?: string;
  previousRank?: string;
  previousRankOther?: string;
  previousBNCC?: string;
  previousInstitution?: string;
  previousBattalionRegiment?: string;
  serviceDuration?: string;
  attendanceStatus?: "Present" | "Absent" | "On Leave" | string;
  status: "Active" | "Inactive" | "Pending" | string;
  role: "user" | "admin" | "super_admin" | string;

  // Identity
  nidBirthReg?: string;

  // Activities
  coCurricularActivities?: string;
  otherCoCurricularActivity?: string;

  // Auth & System
  photo?: string;
  password?: string;
  createdAt?: any;
  updatedAt?: any;

  // Pending Changes status on profile
  hasPendingEdits?: boolean;
  pendingEditsId?: string;
}

export interface PendingProfileChange {
  id: string;
  cadetId: string;
  cadetName: string;
  registrationNumber: string;
  changes: Record<string, { old: any; new: any }>;
  directlyUpdatedFields?: Record<string, { old: any; new: any }>;
  status: "pending" | "approved" | "rejected";
  requestedAt: any;
  reviewedAt?: any;
  reviewedBy?: string;
  rejectReason?: string;
}

export interface ProfileAuditLog {
  id: string;
  type: string;
  targetId: string;
  actorId: string;
  actorName?: string;
  timestamp: any;
  details: string;
  changes?: Record<string, { old: any; new: any }>;
}
