import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, ArrowRight, HelpCircle, GraduationCap } from "lucide-react";
import { setSession } from "../lib/auth";
import { isAdminRole } from "../lib/rbac";
import { ExamNavbar } from "../components/exam/ExamNavbar";
import { useAuth } from "../context/AuthContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import {
  AuthLayout,
  AuthCard,
  AuthHeader,
  AuthFooter,
  AuthInput,
  PasswordInput,
  AuthLoadingButton,
  AuthErrorMessage,
  SecurityNotice,
  SessionResumeCard,
  ForgotPasswordModal,
} from "../components/auth";

export function ExamCandidateLogin() {
  useDocumentMeta({
    title: "Exam Candidate Login | Cox's Bazar City College BNCC Platoon",
    description:
      "Online examination portal login for BNCC admission applicants and inducted cadets.",
  });

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const { user: activeSession, loginWithCredentials, logout } = useAuth();
  const navigate = useNavigate();

  const handleGoToDashboard = () => {
    if (!activeSession) return;
    navigate(isAdminRole(activeSession.role) ? "/exam/admin" : "/exam/dashboard");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("ইউজার আইডি / ইমেইল ও পাসওয়ার্ড প্রবেশ করান।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await loginWithCredentials(userId, password);
      if (!res.success || !res.user) {
        setError(res.error || "উক্ত ইউজার আইডি সংবলিত প্রোফাইল পাওয়া যায়নি বা পাসওয়ার্ড ভুল।");
        return;
      }

      setSession(res.user);
      navigate(isAdminRole(res.user.role) ? "/exam/admin" : "/exam/dashboard");
    } catch (err: any) {
      setError("লগইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#061830] flex flex-col">
      <ExamNavbar />

      <div className="flex-1">
        <AuthLayout
          showBackHome={false}
          asideHeading="BNCC Online Examination System"
          asideDescription="Verified admission written assessment and cadet evaluation portal under 15 BNCC Battalion."
          highlights={[
            {
              title: "Eligible Examinees",
              detail: "Both Pending Applicants (admission test) and Approved Cadets (unit exams) sign in here.",
            },
            {
              title: "Credentials Supported",
              detail: "Use your registered Email & Password, Applicant ID, or Cadet Registration Number.",
            },
            {
              title: "Timed Assessment Integrity",
              detail: "Server-sealed question evaluation and automated attendance validation.",
            },
          ]}
        >
          <AuthCard>
            <AuthHeader
              badgeText="Exam Candidate Access"
              title="পরীক্ষার্থী লগইন পোর্টাল"
              subtitle="Sign in with your Email or Cadet / Applicant ID to access scheduled examinations"
            />

            {activeSession && (
              <SessionResumeCard
                session={activeSession}
                continueLabel="Enter Exam Dashboard"
                onContinue={handleGoToDashboard}
                onLogout={() => void logout()}
              />
            )}

            <AuthErrorMessage message={error} />

            <form onSubmit={handleLogin} className="space-y-4">
              <AuthInput
                id="exam-cand-id"
                type="text"
                label="ইমেইল অথবা ক্যাডেট / আবেদন আইডি *"
                icon={<User size={16} />}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="cadet@example.com or 1111"
                autoComplete="username"
                required
              />

              <PasswordInput
                id="exam-cand-pw"
                label="পাসওয়ার্ড *"
                icon={<Lock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#64748B] inline-flex items-center gap-1">
                  <GraduationCap size={13} className="text-[#C5A059]" />
                  <span>Applicants &amp; Cadets</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs font-bold text-[#002147] hover:text-[#C5A059] transition-colors inline-flex items-center gap-1 cursor-pointer min-h-[32px]"
                >
                  <HelpCircle size={13} />
                  <span>পাসওয়ার্ড ভুলে গেছেন?</span>
                </button>
              </div>

              <AuthLoadingButton
                type="submit"
                loading={loading}
                loadingText="যাচাই করা হচ্ছে..."
                icon={<ArrowRight size={16} />}
              >
                পরীক্ষা ড্যাশবোর্ডে প্রবেশ করুন
              </AuthLoadingButton>
            </form>

            <SecurityNotice>
              ভর্তি পরীক্ষার প্রবেশপত্র বা আইডি হারিয়ে গেলে পাসওয়ার্ড রিকভারির মাধ্যমে অথবা নতুন করে{" "}
              <Link to="/enroll" className="font-bold text-[#002147] underline">
                ভর্তি আবেদন পেজ
              </Link>{" "}
              থেকে তথ্য যাচাই করুন।
            </SecurityNotice>

            <AuthFooter portalType="exam_candidate" />
          </AuthCard>
        </AuthLayout>
      </div>

      <ForgotPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(uid) => setUserId(uid)}
      />
    </div>
  );
}
