import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Shield,
  Lock,
  ArrowRight,
  QrCode,
  Keyboard,
  Camera,
  User as UserIcon,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { setSession } from "../lib/auth";
import { getDefaultLandingRoute, isAdminRole } from "../lib/rbac";
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
  LoginMethodSelector,
  SessionResumeCard,
  ForgotPasswordModal,
} from "../components/auth";

export function Admin2Login() {
  useDocumentMeta({
    title: "Officer & QR Attendance Login | Cox's Bazar City College BNCC Platoon",
    description:
      "Authorized login for attendance officers and QR command staff using officer credentials or issued QR login tokens.",
  });

  const [authTab, setAuthTab] = useState<"credentials" | "qr">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [manualQrToken, setManualQrToken] = useState("");
  const [error, setError] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannerRetryKey, setScannerRetryKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const { user: activeSession, loginWithCredentials, loginWithQrToken, logout } = useAuth();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await loginWithCredentials(username, password, { requireAdmin: true });
      if (res.success && res.user && isAdminRole(res.user.role)) {
        setSession(res.user);
        navigate("/admin2/dashboard");
      } else {
        setError(res.error || "ভুল অফিসার ইউজারনেম / ইমেইল অথবা পাসওয়ার্ড।");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQrTokenVerification = async (rawText: string) => {
    let token = "";
    try {
      const parsed = JSON.parse(rawText);
      token = parsed.qrToken || parsed.token || rawText;
    } catch {
      token = rawText;
    }

    setLoading(true);
    setError("");
    try {
      const res = await loginWithQrToken(token);
      if (res.success && res.user) {
        setSession(res.user);
        navigate("/admin/qr-dashboard");
      } else {
        setError(res.error || "অবৈধ বা মেয়াদোত্তীর্ণ অ্যাডমিন QR কোড।");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualQrSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!manualQrToken.trim()) {
      setError("অ্যাডমিন QR টোকেন কোড প্রদান করুন।");
      return;
    }
    await handleQrTokenVerification(manualQrToken.trim());
  };

  useEffect(() => {
    let isActive = true;
    let scanner: Html5QrcodeScanner | null = null;
    setCameraError(null);

    if (authTab === "qr") {
      const initScanner = () => {
        if (!isActive) return;
        const targetElement = document.getElementById("reader-admin-login-2");
        if (!targetElement) {
          setTimeout(initScanner, 60);
          return;
        }

        try {
          scanner = new Html5QrcodeScanner(
            "reader-admin-login-2",
            { fps: 12, qrbox: { width: 230, height: 230 } },
            false
          );

          scanner.render(
            async (decodedText) => {
              if (!isActive) return;
              await handleQrTokenVerification(decodedText);
              if (scanner) {
                scanner.clear().catch(() => {});
              }
            },
            (errMsg) => {
              if (
                typeof errMsg === "string" &&
                (errMsg.toLowerCase().includes("permission") ||
                  errMsg.toLowerCase().includes("notallowed"))
              ) {
                setCameraError(
                  "ক্যামেরা অনুমতি পাওয়া যায়নি। ব্রাউজার থেকে ক্যামেরা পারমিশন দিন অথবা নিচে ম্যানুয়াল টোকেন লিখুন।"
                );
              }
            }
          );
        } catch {
          setCameraError(
            "ক্যামেরা স্ক্যানার চালু করা যায়নি। নিচের ম্যানুয়াল QR টোকেন ইনপুট ব্যবহার করুন।"
          );
        }
      };

      const timer = setTimeout(initScanner, 120);
      return () => {
        isActive = false;
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(() => {});
        }
      };
    }
  }, [authTab, scannerRetryKey]);

  return (
    <AuthLayout
      asideHeading="Attendance & QR Command Portal"
      asideDescription="Dedicated portal for Battalion Attendance Officers and QR Inspectors managing parade check-ins and cadet verification."
    >
      <AuthCard>
        <AuthHeader
          badgeText="Officer & Attendance Command"
          title="অ্যাডমিন ২ / উপস্থিতি পোর্টাল"
          subtitle="Officer Credential Sign-In or Issued Admin QR Token Verification"
        />

        {activeSession && isAdminRole(activeSession.role) && (
          <SessionResumeCard
            session={activeSession}
            continueLabel="Open Attendance Dashboard"
            onContinue={() =>
              navigate(
                activeSession.role === "qr_admin" || activeSession.role === "attendance_officer"
                  ? "/admin2/dashboard"
                  : getDefaultLandingRoute(activeSession.role)
              )
            }
            onLogout={() => void logout()}
          />
        )}

        <LoginMethodSelector
          ariaLabel="Officer login method"
          activeId={authTab}
          onChange={(tab) => {
            setAuthTab(tab);
            setError("");
          }}
          options={[
            {
              id: "credentials",
              label: "অফিসার পাসওয়ার্ড",
              icon: <Keyboard size={14} />,
            },
            {
              id: "qr",
              label: "অ্যাডমিন QR কোড",
              icon: <QrCode size={14} />,
            },
          ]}
        />

        <AuthErrorMessage message={error} />

        {authTab === "credentials" ? (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <AuthInput
              id="admin2-username"
              type="text"
              label="অফিসার ইউজারনেম বা ইমেইল *"
              icon={<UserIcon size={16} />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="qr_admin_1234 or officer@domain.com"
              autoComplete="username"
              required
            />

            <PasswordInput
              id="admin2-password"
              label="পাসওয়ার্ড *"
              icon={<Lock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#64748B]">Server-verified officer session</span>
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
              অফিসার ড্যাশবোর্ডে প্রবেশ করুন
            </AuthLoadingButton>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-[#F5F7FA] p-4 rounded-2xl border border-slate-200 space-y-3">
              <div
                id="reader-admin-login-2"
                className="overflow-hidden rounded-xl bg-slate-950 border border-slate-300 min-h-[200px]"
              />
              <div className="flex items-center justify-between gap-2 text-[#002147] font-bold text-xs bg-white px-3 py-2.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#C5A059] shrink-0" />
                  <span>সুপার অ্যাডমিন প্রদত্ত QR কোড ক্যামেরার সামনে ধরুন</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScannerRetryKey((k) => k + 1)}
                  className="text-[11px] font-bold text-[#002147] hover:text-[#C5A059] inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <RefreshCw size={12} />
                  <span>পুনরায় চালু</span>
                </button>
              </div>
              {cameraError && (
                <SecurityNotice title="Camera Notice">{cameraError}</SecurityNotice>
              )}
            </div>

            <form onSubmit={handleManualQrSubmit} className="space-y-3 pt-1">
              <AuthInput
                id="admin2-manual-qr"
                type="text"
                label="অথবা অ্যাডমিন QR টোকেন কোড লিখুন"
                icon={<Shield size={16} />}
                value={manualQrToken}
                onChange={(e) => setManualQrToken(e.target.value)}
                placeholder="adm_qr_..."
              />
              <AuthLoadingButton
                type="submit"
                variant="gold"
                loading={loading}
                loadingText="টোকেন যাচাই হচ্ছে..."
                icon={<ArrowRight size={16} />}
              >
                QR টোকেন দিয়ে লগইন করুন
              </AuthLoadingButton>
            </form>
          </div>
        )}

        <AuthFooter portalType="officer" />
      </AuthCard>

      <ForgotPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(uid) => setUsername(uid)}
      />
    </AuthLayout>
  );
}
