export type OfflineApplicationStatus = 
  | "Draft"
  | "Form Generated"
  | "Submitted Offline"
  | "Uploaded"
  | "Under Review"
  | "Approved"
  | "Rejected";

export type OfflineSyncStatus =
  | "Draft"
  | "Pending Sync"
  | "Syncing"
  | "Synced"
  | "Sync Failed"
  | "Requires Review";

export interface UploadedFileRecord {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface ExamRecord {
  exam: string; // e.g. "এসএসসি/সমমান" or "এইচএসসি/সমমান"
  board: string;
  gpa: string;
  institution: string;
  passingYear: string;
}

export interface OfflineApplication {
  // Identifiers & Meta
  id: string; // e.g. "OFF-2026-0001"
  applicationNumber?: string; // Firestore rule verification mirror of id
  syncStatus?: OfflineSyncStatus;
  ownerUid?: string;
  lastSyncedAt?: string;
  syncError?: string;
  formNumber?: string; // e.g. "258"
  cadetNumber?: string; // editable cadet no
  applicationDate?: string; // e.g. "2026-09-24" or 6-box format
  status: OfflineApplicationStatus;

  // ১. আবেদনকারীর নাম
  fullNameBangla: string; // আবেদনকারীর নাম (বাংলায়)
  fullNameEnglish: string; // Block Letter
  email?: string; // E-mail

  // ২. পিতার নাম
  fatherNameBangla?: string; // পিতার নাম (বাংলায়)
  fatherNameEnglish?: string; // English Block Letter
  fatherName: string; // backward compat

  // ৩. মাতার নাম
  motherNameBangla?: string; // মাতার নাম (বাংলায়)
  motherNameEnglish?: string; // English Block Letter
  motherName: string; // backward compat

  // ৪. শিক্ষাগত তথ্য
  classDepartment?: string; // শ্রেণি/বিভাগ
  classYear: string; // e.g. "HSC 1st Year" (or classDepartment)
  classRoll: string; // রোল
  academicYear?: string; // শিক্ষাবর্ষ e.g. "2026-2027"

  // ৫. বর্তমান ঠিকানা
  addressPresent: string; // Large editable field

  // ৬. স্থায়ী ঠিকানা
  addressPermanent: string; // Large editable field

  // ৭. ব্যক্তিগত তথ্য
  dob: string; // জন্ম তারিখ
  religion: string; // ধর্ম
  nationality?: string; // জাতীয়তা e.g. "বাংলাদেশী"

  // ৮. শারীরিক তথ্য
  heightFeet: string; // উচ্চতা
  heightInches: string;
  weightKg: string; // ওজন
  eyesight?: string; // দৃষ্টি শক্তি (e.g. "৬/৬" or "6/6")

  // ৯. শারীরিক মাপ
  chestNormal?: string; // বুকের মাপ — স্বাভাবিক
  chestExpanded?: string; // বুকের মাপ — প্রসারিত
  identificationMark?: string; // সনাক্তকরণ চিহ্ন

  // ১০. পূর্ববর্তী BNCC তথ্য
  previousBnccMember?: "হ্যাঁ" | "না" | "Yes" | "No" | string; // অতীতে কখনো বিএনসিসির সদস্য ছিলেন কি?
  previousBnccRank?: string; // থাকলে পদবী
  bloodGroup: string; // রক্তের গ্রুপ

  // ১১. দক্ষতা (কোন বিষয়ে পারদর্শী—)
  skills?: string[]; // গান, নৃত্য, কৌতুক, আবৃত্তি, বক্তৃতা, বিতর্ক, ফুটবল, ক্রিকেট, হ্যান্ডবল, দাবা

  // ১২. শিক্ষাগত যোগ্যতা
  ssc: ExamRecord;
  hsc?: ExamRecord;

  // Backward compatibility fields
  sscBoard?: string;
  sscRoll?: string;
  sscReg?: string;
  sscGroup?: string;
  sscYear?: string;
  sscGpa?: string;

  // Additional contact / institution
  studentPhone: string;
  guardianPhone: string;
  institution: string;
  gender: "Male" | "Female" | "Other" | string;
  district?: string;
  thana?: string;
  studyStatus?: string;
  isEthnicMinority?: boolean;

  // Admit Card specifics
  applicantPhoto?: string; // Photo Data URL / URL
  admitInstructions?: string; // দীর্ঘ নির্দেশাবলী
  examDate?: string;
  examTime?: string;
  examVenue?: string;

  // Signatures / Platoon
  guardianSignature?: string;
  applicantSignature?: string;
  platoonComment?: string;
  platoonRecommendation?: "উপযুক্ত" | "অনুপযুক্ত" | string;

  // Uploaded physical / scanned documents
  uploadedFiles?: {
    scannedForm?: UploadedFileRecord;
    admitCard?: UploadedFileRecord;
    applicantPhoto?: UploadedFileRecord;
    supportingDocs?: UploadedFileRecord[];
    otherDocs?: UploadedFileRecord[];
  };

  notes?: string;
  formGeneratedDate?: string;
  createdAt: string;
  updatedAt: string;
}
