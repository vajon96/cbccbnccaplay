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

// ============================================================================
// EXAMINATION MODULE TYPES
// ============================================================================

export type QuestionType = "mcq" | "fill_gaps" | "tag_question" | "changing_sentence" | "short_question" | "true_false";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionBankItem {
  id: string;
  subject: string; // e.g., "বাংলা", "English", "গণিত", "সাধারণ বিজ্ঞান", "বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি", "BNCC", "IQ"
  questionType: QuestionType;
  question: string;
  options?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctAnswer: string | string[]; // Answer key (hidden from candidates during exam)
  acceptedAnswers?: string[]; // Optional alternative accepted spellings/strings for fill gaps / short question
  expectedAnswer?: string; // Reference text for subjective questions / short questions
  marks: number;
  difficulty: QuestionDifficulty;
  tags?: string[];
  explanation?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type ExamStatus = "draft" | "published" | "scheduled" | "live" | "completed" | "archived";

export interface RandomQuestionRule {
  subject: string;
  questionType?: QuestionType;
  count: number;
  marksPerQuestion?: number;
}

export interface ExamEligibility {
  type: "all_approved" | "specific_batches" | "specific_sessions" | "specific_users";
  allowedSessions?: string[];
  allowedUserIds?: string[];
  allowedRegistrationNumbers?: string[];
}

export interface ExamModel {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  status: ExamStatus;
  startAt: any; // Date/string or Firestore Timestamp
  endAt: any;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  questionSelectionMode: "manual" | "random";
  selectedQuestionIds?: string[];
  randomRules?: RandomQuestionRule[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  maxAttempts: number;
  negativeMarking?: {
    enabled: boolean;
    marksPerWrongAnswer: number;
  };
  showResultImmediately: boolean;
  allowAnswerReview: boolean;
  allowQuestionNavigation: boolean;
  autoSubmit: boolean;
  eligibility?: ExamEligibility;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  questionSnapshots?: QuestionBankItem[]; // Snapshot of questions bound to this exam
}

export type AttemptStatus = "not_started" | "in_progress" | "submitted" | "auto_submitted" | "expired";

export type EvaluationStatus = "pending" | "in_progress" | "partially_evaluated" | "fully_evaluated" | "finalized" | "reopened";

export interface ManualQuestionEvaluation {
  questionId: string;
  obtainedMarks: number;
  maxMarks: number;
  comment?: string;
  isManuallyOverridden?: boolean;
  originalAutoScore?: number;
  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: string;
  overrideReason?: string;
  // AI Examiner Evaluation
  aiEvaluated?: boolean;
  aiSuggestedMarks?: number;
  aiJustification?: string;
  aiConfidence?: number;
}

export interface MarksHistoryEntry {
  id: string;
  questionId: string;
  previousMarks: number;
  newMarks: number;
  changedBy: string;
  changedByName?: string;
  reason?: string;
  timestamp: string;
}

export interface AnswerScriptAuditLog {
  id: string;
  attemptId: string;
  questionId?: string;
  action: string;
  actorId: string;
  actorName?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  timestamp: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  candidateId: string; // User ID in applicants collection
  userId: string;
  registrationNumber: string;
  candidateName?: string;
  candidatePhoto?: string;
  session?: string;
  collegeName?: string;
  startedAt: any;
  submittedAt?: any;
  status: AttemptStatus;
  score?: number;
  percentage?: number;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  isPassed?: boolean;
  questionSnapshot?: QuestionBankItem[]; // Frozen question set for this attempt
  answers?: Record<string, {
    questionId: string;
    selectedAnswer?: string | string[];
    answeredAt?: any;
    isMarkedForReview?: boolean;
  }>;
  // Evaluation & Manual Marking Module
  evaluationStatus?: EvaluationStatus;
  assignedExaminerId?: string;
  assignedExaminerName?: string;
  evaluatedAt?: string;
  evaluatedBy?: string;
  evaluatedByName?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  finalizedByName?: string;
  autoScore?: number;
  manualMarks?: number;
  finalScore?: number;
  aiEvaluatedAt?: string;
  aiEvaluatedBy?: string;
  aiOverallFeedback?: string;
  manualEvaluations?: Record<string, ManualQuestionEvaluation>;
  marksHistory?: MarksHistoryEntry[];
  markingSummary?: {
    totalQuestions: number;
    attempted: number;
    unanswered: number;
    autoEvaluatedMarks: number;
    manualMarks: number;
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    isPassed: boolean;
  };
  createdAt: any;
  updatedAt: any;
}

export interface ExamAnswer {
  attemptId: string;
  questionId: string;
  selectedAnswer?: string | string[];
  answeredAt: any;
  isMarkedForReview?: boolean;
}

export interface ExamResult {
  id: string;
  examId: string;
  examTitle: string;
  attemptId: string;
  candidateId: string;
  userId: string;
  registrationNumber: string;
  candidateName: string;
  candidatePhoto?: string;
  score: number;
  totalMarks: number;
  percentage: number;
  passMarks: number;
  isPassed: boolean;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeTakenSeconds?: number;
  submittedAt: any;
  rank?: number;
}

export interface ExamSetting {
  id: string;
  defaultDurationMinutes: number;
  defaultPassPercentage: number;
  enableNegativeMarkingDefault: boolean;
  defaultWrongPenalty: number;
  allowStudentReviewAnswers: boolean;
  showLeaderboardToStudents: boolean;
  autoSubmitOnTimeExpiry: boolean;
  preventTabSwitching: boolean;
  updatedAt: any;
  updatedBy: string;
}

export interface ExamActivityLog {
  id: string;
  action: "EXAM_CREATED" | "EXAM_UPDATED" | "EXAM_DELETED" | "SCRIPT_DELETED" | "EXAM_PUBLISHED" | "EXAM_STARTED" | "EXAM_STOPPED" | "QUESTION_CREATED" | "QUESTION_UPDATED" | "QUESTION_DELETED" | "QUESTION_IMPORTED" | "RESULT_EXPORTED" | "EXAM_SETTINGS_UPDATED";
  targetId: string;
  actorId: string;
  actorName?: string;
  timestamp: any;
  details: string;
  meta?: any;
}

