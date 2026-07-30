import { CadetProfile } from "../types";
import { db, collection, query, where, getDocs } from "../firebase";

// Fields that require Admin Approval when modified by a cadet
export const SENSITIVE_FIELDS: (keyof CadetProfile)[] = [
  "fullNameBangla",
  "fullNameEnglish",
  "dob",
  "nidBirthReg",
  "registrationNumber",
  "collegeName",
  "previousBattalionRegiment",
  "currentRank",
  "sscBoard",
  "sscGroup",
  "sscGpa",
  "sscYear",
  "hscBoard",
  "hscGroup",
  "hscGpa",
  "emisId"
];

// Display labels for sensitive fields
export const FIELD_LABELS: Record<string, string> = {
  fullNameBangla: "Full Name (Bangla)",
  fullNameEnglish: "Full Name (English)",
  dob: "Date of Birth",
  gender: "Gender",
  religion: "Religion",
  bloodGroup: "Blood Group",
  heightFeet: "Height (Feet)",
  heightInches: "Height (Inches)",
  weightKg: "Weight (KG)",
  isEthnicMinority: "Ethnic Minority Status",
  fatherNameBangla: "Father's Name (Bangla)",
  fatherNameEnglish: "Father's Name (English)",
  motherNameBangla: "Mother's Name (Bangla)",
  motherNameEnglish: "Mother's Name (English)",
  studentPhone: "Student Phone Number",
  studentEmail: "Student Email Address",
  presentAddress: "Present Address",
  permanentAddress: "Permanent Address",
  emergencyContactName: "Emergency Contact Person",
  emergencyContactPhone: "Emergency Contact Phone",
  collegeName: "College Name",
  emisId: "EMIS ID",
  classRoll: "Class Roll",
  section: "Section",
  session: "Session",
  subject: "Subject",
  studyStatus: "Study Status",
  sscBoard: "SSC Board",
  sscGroup: "SSC Group",
  sscGpa: "SSC GPA",
  sscYear: "SSC Year",
  hscBoard: "HSC Board",
  hscGroup: "HSC Group",
  hscGpa: "HSC GPA",
  hscOptionalSubject: "HSC Optional Subject",
  hscYear: "HSC Year",
  registrationNumber: "BNCC Registration Number",
  currentRank: "Current Rank",
  previousRank: "Previous Rank",
  previousRankOther: "Previous Rank (Other)",
  previousBNCC: "Previous BNCC Status",
  previousBattalionRegiment: "Battalion / Regiment",
  serviceDuration: "Service Duration",
  attendanceStatus: "Attendance Status",
  nidBirthReg: "NID / Birth Registration No",
  coCurricularActivities: "Co-Curricular Activities",
  otherCoCurricularActivity: "Other Co-Curricular Activities",
  photo: "Profile Photo"
};

// Required fields for profile completion calculation
const WEIGHTED_PROFILE_FIELDS: { key: keyof CadetProfile; label: string; section: string; weight: number }[] = [
  { key: "fullNameEnglish", label: "Full Name (English)", section: "Personal", weight: 5 },
  { key: "fullNameBangla", label: "Full Name (Bangla)", section: "Personal", weight: 5 },
  { key: "dob", label: "Date of Birth", section: "Personal", weight: 5 },
  { key: "gender", label: "Gender", section: "Personal", weight: 4 },
  { key: "bloodGroup", label: "Blood Group", section: "Personal", weight: 4 },
  { key: "heightFeet", label: "Height", section: "Personal", weight: 3 },
  { key: "weightKg", label: "Weight", section: "Personal", weight: 3 },
  
  { key: "fatherNameEnglish", label: "Father's Name", section: "Family", weight: 4 },
  { key: "motherNameEnglish", label: "Mother's Name", section: "Family", weight: 4 },

  { key: "studentPhone", label: "Phone Number", section: "Contact", weight: 6 },
  { key: "studentEmail", label: "Email Address", section: "Contact", weight: 5 },
  { key: "presentAddress", label: "Present Address", section: "Contact", weight: 5 },
  { key: "permanentAddress", label: "Permanent Address", section: "Contact", weight: 4 },

  { key: "collegeName", label: "College Name", section: "Academic", weight: 5 },
  { key: "emisId", label: "EMIS ID", section: "Academic", weight: 4 },
  { key: "session", label: "Session", section: "Academic", weight: 4 },
  { key: "subject", label: "Subject", section: "Academic", weight: 4 },
  { key: "sscGpa", label: "SSC GPA", section: "Academic", weight: 4 },
  { key: "hscGpa", label: "HSC GPA", section: "Academic", weight: 4 },

  { key: "registrationNumber", label: "BNCC Registration Number", section: "BNCC", weight: 7 },
  { key: "currentRank", label: "Current Rank", section: "BNCC", weight: 5 },

  { key: "nidBirthReg", label: "NID / Birth Registration", section: "Identity", weight: 5 },
  { key: "photo", label: "Profile Photo", section: "Photo", weight: 5 }
];

export interface CompletionResult {
  percentage: number;
  filledWeight: number;
  totalWeight: number;
  missingFields: { key: string; label: string; section: string }[];
  sectionStats: Record<string, { filled: number; total: number; percentage: number }>;
}

export function calculateProfileCompletion(profile: Partial<CadetProfile>): CompletionResult {
  let filledWeight = 0;
  let totalWeight = 0;
  const missingFields: { key: string; label: string; section: string }[] = [];
  const sectionCounts: Record<string, { filledWeight: number; totalWeight: number }> = {};

  WEIGHTED_PROFILE_FIELDS.forEach(item => {
    const val = profile[item.key];
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val) !== "—";

    totalWeight += item.weight;
    if (!sectionCounts[item.section]) {
      sectionCounts[item.section] = { filledWeight: 0, totalWeight: 0 };
    }
    sectionCounts[item.section].totalWeight += item.weight;

    if (isFilled) {
      filledWeight += item.weight;
      sectionCounts[item.section].filledWeight += item.weight;
    } else {
      missingFields.push({ key: item.key, label: item.label, section: item.section });
    }
  });

  const percentage = Math.min(100, Math.round((filledWeight / totalWeight) * 100));

  const sectionStats: Record<string, { filled: number; total: number; percentage: number }> = {};
  Object.keys(sectionCounts).forEach(sec => {
    const { filledWeight: fw, totalWeight: tw } = sectionCounts[sec];
    sectionStats[sec] = {
      filled: fw,
      total: tw,
      percentage: tw > 0 ? Math.round((fw / tw) * 100) : 0
    };
  });

  return {
    percentage,
    filledWeight,
    totalWeight,
    missingFields,
    sectionStats
  };
}

// Field validation helpers
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  // Bangladesh phone number regex e.g. 01712345678 or +8801712345678
  const bdPhoneRegex = /^(?:\+88|88)?(01[3-9]\d{8})$/;
  return bdPhoneRegex.test(phone.trim());
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function validateEmisId(emisId: string): boolean {
  if (!emisId) return true; // optional unless provided
  return /^\d{4,12}$/.test(emisId.trim());
}

export function validateNidOrBirthReg(val: string): boolean {
  if (!val) return true;
  // NID / Birth Reg in BD is typically 10, 13, or 17 digits
  return /^\d{10,17}$/.test(val.trim());
}

// Check Firestore for duplicate field values
export async function checkDuplicateField(
  fieldName: "studentPhone" | "studentEmail" | "registrationNumber" | "emisId",
  value: string,
  excludeCadetId?: string
): Promise<boolean> {
  if (!value || !value.trim()) return false;
  try {
    const q = query(collection(db, "applicants"), where(fieldName, "==", value.trim()));
    const snapshot = await getDocs(q);
    
    // Filter out current user's document
    const duplicates = snapshot.docs.filter(d => d.id !== excludeCadetId);
    return duplicates.length > 0;
  } catch (err) {
    console.error(`Error checking duplicate for ${fieldName}:`, err);
    return false;
  }
}
