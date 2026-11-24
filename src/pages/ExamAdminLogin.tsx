import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight, Key, HelpCircle, ShieldCheck } from "lucide-react";
import { setSession } from "../lib/auth";
import { getDefaultLandingRoute, isExamAdminRole } from "../lib/rbac";
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

export function ExamAdminLogin() {
  useDocumentMeta({
    title: "Exam Controller Login | Cox's Bazar City College BNCC Platoon",
    description:
      "Authorized access for BNCC Exam Controllers, System Admins, and the Platoon Commander.",
  });

  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const { user: activeSession, loginWithCredentials, logout } = useAuth();
  const navigate = useNavigate();

  const handleGoToDashboard = () => {
    if (!activeSession) return;
    navigate(getDefaultLandingRoute(activeSession.role));
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !password.trim()) {
      setError("অফিসার ইউজারনেম / ইমেইল ও পাসওয়ার্ড প্রবেশ করান।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await loginWithCredentials(adminId, password, { requireAdmin: true });
      if (!res.success || !res.user) {
        setError(res.error || "অ্যাডমিন অ্যাক্সেস অনুমোদিত নয় বা ভুল ক্রেডেনশিয়াল।");
        return;
      }
      if (!isExamAdminRole(res.user.role)) {
        await logout();
        setError(
          "এই অ্যাকাউন্টে Exam Controller অনুমোদন নেই। শুধুমাত্র Exam Admin, Admin বা Super Admin প্রবেশ করতে পারবেন।"
        );
        return;
      }
      setSession(res.user);
      navigate("/exam/admin");
    } catch (err: any) {
      setError("অ্যাডমিন লগইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
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
          asideHeading="Examination Controller Console"
          asideDescription="Manage question banks, sealed answer keys, live exam publishing, and AI-assisted script moderation."
          highlights={[
            {
              title: "Role-Restricted Access",
              detail: "Permitted strictly for Exam Controllers (exam_admin), System Admins, and Super Admin.",
            },
            {
              title: "Sealed Answer Key Vault",
              detail: "AES-256-GCM server-side grading keys never exposed to examinee browsers.",
            },
            {
              title: "Unified Staff Credentials",
              detail: "Authenticate with your Officer Username or registered Official Email.",
            },
          ]}
        >
          <AuthCard>
            <AuthHeader
              badgeText="Exam Controller Console"
              title="পরীক্ষা নিয়ন্ত্রক লগইন"
              subtitle="Sign in with your Exam Controller Username or Official Email"
            />

            {activeSession && isExamAdminRole(activeSession.role) && (
              <SessionResumeCard
                session={activeSession}
                continueLabel="Open Exam Controller Panel"
                onContinue={handleGoToDashboard}
                onLogout={() => void logout()}
              />
            )}

            <AuthErrorMessage message={error} />

            <form onSubmit={handleLogin} className="space-y-4">
              <AuthInput
                id="exam-admin-id"
                type="text"
                label="এক্সাম অ্যাডমিন ইউজারনেম বা ইমেইল *"
                icon={<Key size={16} />}
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="admin or controller@domain.com"
                autoComplete="username"
                required
              />

              <PasswordInput
                id="exam-admin-pw"
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
                  <ShieldCheck size={13} className="text-[#C5A059]" />
                  <span>Exam Admin / Super Admin</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs font-bold text-[#002147] hover:text-[#C5A059] transition-colors inline-flex items-center gap-1 cursor-pointer min-h-[32px]"
                >
                  <HelpCircle size={13} />
                  <span>পাসওয়ার্ড রিকভারি</span>
                </button>
              </div>

              <AuthLoadingButton
                type="submit"
                loading={loading}
                loadingText="যাচাই করা হচ্ছে..."
                icon={<ArrowRight size={16} />}
              >
                কন্ট্রোল প্যানেলে প্রবেশ করুন
              </AuthLoadingButton>
            </form>

            <SecurityNotice>
              পরীক্ষার্থীরা এই পোর্টালে প্রবেশ করতে পারবেন না। পরীক্ষার্থী হিসেবে পরীক্ষা দিতে{" "}
              <a href="/exam/login" className="font-bold text-[#002147] underline">
                Exam Candidate Portal
              </a>{" "}
              ব্যবহার করুন।
            </SecurityNotice>

            <AuthFooter portalType="exam_admin" />
          </AuthCard>
        </AuthLayout>
      </div>

      <ForgotPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(uid) => setAdminId(uid)}
      />
    </div>
  );
}
