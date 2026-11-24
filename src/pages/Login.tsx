import { useState, FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Shield,
  Lock,
  ArrowRight,
  User as UserIcon,
  HelpCircle,
  Link2,
  Mail,
  UserPlus,
  BadgeCheck,
} from "lucide-react";
import {
  linkEmailSessionToApplicant,
  setSession,
} from "../lib/auth";
import { getDefaultLandingRoute } from "../lib/rbac";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
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
  AuthSuccessMessage,
  SecurityNotice,
  LoginMethodSelector,
  SessionResumeCard,
  ForgotPasswordModal,
} from "../components/auth";

type LoginMethodTab = "portal_email" | "cadet_id" | "officer_admin";

export function Login() {
  const { lang } = useLanguage();
  useDocumentMeta({
    title: "Portal Login | Cox's Bazar City College BNCC Platoon",
    description:
      "Secure sign in and account registration for applicants, inducted cadets, and platoon officers.",
  });

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [loginMethod, setLoginMethod] = useState<LoginMethodTab>("portal_email");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [needsCadetLink, setNeedsCadetLink] = useState(false);
  const [linkEmail, setLinkEmail] = useState<string | null>(null);

  const {
    user: activeSession,
    loginWithEmail,
    registerWithEmail,
    loginWithCredentials,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigateByRole = (role?: string) => {
    const targetPath = (location.state as any)?.from;
    if (targetPath && typeof targetPath === "string" && targetPath !== "/login") {
      navigate(targetPath);
      return;
    }
    navigate(getDefaultLandingRoute(role));
  };

  const handleGoToDashboard = () => {
    if (!activeSession) return;
    navigate(getDefaultLandingRoute(activeSession.role));
  };

  const handleLogoutExisting = async () => {
    await logout();
    setNeedsCadetLink(false);
    setError("");
    setInfoMsg("");
  };

  const handleMethodChange = (nextMethod: LoginMethodTab) => {
    setLoginMethod(nextMethod);
    setIdentifier("");
    setPassword("");
    setError("");
    setInfoMsg("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfoMsg("");

    try {
      if (needsCadetLink) {
        const linked = await linkEmailSessionToApplicant(identifier, password);
        if (linked.success && linked.user) {
          setSession(linked.user);
          navigateByRole(linked.user.role);
          return;
        }
        setError(linked.error || "ক্যাডেট / আবেদন অ্যাকাউন্ট লিংক করা যায়নি।");
        return;
      }

      if (mode === "register") {
        if (!fullName.trim()) {
          setError(lang === "bn" ? "আপনার পূর্ণ নাম লিখুন।" : "Please enter your full name.");
          return;
        }
        if (password.length < 6) {
          setError(
            lang === "bn"
              ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"
              : "Password must be at least 6 characters."
          );
          return;
        }
        if (password !== confirmPassword) {
          setError(lang === "bn" ? "পাসওয়ার্ড দুটি মেলেনি।" : "Passwords do not match.");
          return;
        }
        const regRes = await registerWithEmail(email, password, fullName);
        if (!regRes.success || !regRes.user) {
          setError(regRes.error || "অ্যাকাউন্ট তৈরি করা যায়নি।");
          return;
        }
        setSession(regRes.user);
        const verifyNote = regRes.verificationEmailSent
          ? lang === "bn"
            ? " আপনার ইমেইলে একটি ভেরিফিকেশন লিংক পাঠানো হয়েছে।"
            : " A verification link has been sent to your email."
          : "";
        setInfoMsg(
          (lang === "bn"
            ? "পোর্টাল অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! পূর্বের ক্যাডেট/আবেদন আইডি লিংক করুন অথবা ড্যাশবোর্ড থেকে ভর্তি ফরম পূরণ করুন।"
            : "Portal account created! Link an existing Cadet/Applicant ID below or continue to your dashboard.") +
            verifyNote
        );
        setNeedsCadetLink(true);
        setLinkEmail(regRes.user.email || email);
        setPassword("");
        return;
      }

      const res =
        loginMethod === "portal_email"
          ? await loginWithEmail(identifier, password)
          : loginMethod === "officer_admin"
          ? await loginWithCredentials(identifier, password, { requireAdmin: true })
          : await loginWithCredentials(identifier, password);

      if (!res.success || !res.user) {
        setError(res.error || "লগইন করতে ব্যর্থ হয়েছেন। তথ্য যাচাই করে আবার চেষ্টা করুন।");
        return;
      }

      setSession(res.user);
      if (res.needsCadetLink && res.user.role === "user") {
        setNeedsCadetLink(true);
        setLinkEmail(res.user.email || null);
        setIdentifier("");
        setPassword("");
        return;
      }

      navigateByRole(res.user.role);
    } catch (err: any) {
      setError("সিস্টেমে সমস্যা দেখা দিয়েছে: " + (err?.message || "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const identifierConfig: Record<
    LoginMethodTab,
    { label: string; placeholder: string; type: string; autoComplete: string; hint?: string }
  > = {
    portal_email: {
      label: lang === "bn" ? "নিবন্ধিত ইমেইল ঠিকানা" : "Registered Email Address",
      placeholder: "cadet@example.com",
      type: "email",
      autoComplete: "email",
      hint:
        lang === "bn"
          ? "ইমেইল ও পাসওয়ার্ড দিয়ে আবেদনকারী, ক্যাডেট বা অফিসার লগইন।"
          : "Sign in with your portal Email & Password.",
    },
    cadet_id: {
      label: lang === "bn" ? "ক্যাডেট / আবেদন আইডি বা রেজিস্ট্রেশন নম্বর" : "Cadet / Applicant ID or Reg. No",
      placeholder: "e.g. 1111",
      type: "text",
      autoComplete: "username",
      hint:
        lang === "bn"
          ? "ভর্তি আবেদনের পর প্রাপ্ত আইডি ও পাসওয়ার্ড ব্যবহার করুন।"
          : "Use the Applicant/Cadet ID and password issued during enrollment.",
    },
    officer_admin: {
      label: lang === "bn" ? "অফিসার ইউজারনেম বা অফিশিয়াল ইমেইল" : "Officer Username or Official Email",
      placeholder: "admin or officer@domain.com",
      type: "text",
      autoComplete: "username",
      hint:
        lang === "bn"
          ? "প্লাটুন কমান্ডার, অ্যাডমিন, মডারেটর ও বিশেষায়িত অফিসারের জন্য।"
          : "Restricted to Platoon Commander, Admins, and authorized Officers.",
    },
  };

  const activeIdCfg = identifierConfig[loginMethod];

  return (
    <AuthLayout
      asideHeading="Cox's Bazar City College BNCC Platoon Portal"
      asideDescription="Centralized authentication for Applicants, Inducted Cadets, and Battalion Officers under 15 BNCC Battalion."
    >
      <AuthCard>
        <AuthHeader
          badgeText="15 BNCC Battalion • Army Wing"
          title={
            needsCadetLink
              ? lang === "bn"
                ? "ক্যাডেট / আবেদন প্রোফাইল লিংক"
                : "Link Cadet / Applicant Profile"
              : mode === "register"
              ? lang === "bn"
                ? "নতুন পোর্টাল অ্যাকাউন্ট তৈরি"
                : "Create Portal Account"
              : lang === "bn"
              ? "বিএনসিসি কেন্দ্রীয় পোর্টাল লগইন"
              : "BNCC Central Portal"
          }
          subtitle={
            needsCadetLink
              ? "Connect your portal login to an existing Enrollment or Cadet record"
              : "Cox's Bazar City College BNCC Cadet & Admission System"
          }
        />

        {!needsCadetLink && (
          <LoginMethodSelector
            ariaLabel="Authentication mode"
            activeId={mode}
            onChange={(next) => {
              setMode(next);
              setError("");
              setInfoMsg("");
              setPassword("");
              setConfirmPassword("");
            }}
            options={[
              {
                id: "signin",
                label: lang === "bn" ? "সাইন ইন (Sign In)" : "Sign In",
                icon: <Lock size={14} />,
              },
              {
                id: "register",
                label: lang === "bn" ? "নতুন অ্যাকাউন্ট (Register)" : "Create Account",
                icon: <UserPlus size={14} />,
              },
            ]}
          />
        )}

        {activeSession && !needsCadetLink && (
          <SessionResumeCard
            session={activeSession}
            onContinue={handleGoToDashboard}
            onLogout={() => void handleLogoutExisting()}
          />
        )}

        {needsCadetLink && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs text-amber-950">
            <p className="font-bold flex items-center gap-1.5 text-[#002147]">
              <Link2 size={15} className="text-[#C5A059]" />
              <span>Portal Account Active ({linkEmail || activeSession?.email})</span>
            </p>
            <p className="leading-relaxed">
              আপনার পূর্বের ক্যাডেট বা আবেদন আইডি (যেমন: 1111) এবং সেই আবেদনের পাসওয়ার্ড দিয়ে লিংক করুন, অথবা নতুন আবেদন করতে Enroll পেজে যান।
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/enroll"
                className="min-h-[36px] px-3 py-1.5 bg-[#002147] text-white font-bold rounded-lg inline-flex items-center"
              >
                নতুন ভর্তি আবেদন করুন →
              </Link>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="min-h-[36px] px-3 py-1.5 bg-white border border-slate-300 text-[#002147] font-bold rounded-lg cursor-pointer"
              >
                পোর্টাল ড্যাশবোর্ড
              </button>
            </div>
          </div>
        )}

        <AuthErrorMessage message={error} />
        <AuthSuccessMessage message={infoMsg} />

        {mode === "signin" && !needsCadetLink && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              {lang === "bn" ? "লগইন ধরন নির্বাচন করুন" : "Select Account Type"}
            </p>
            <LoginMethodSelector
              ariaLabel="Account login method"
              activeId={loginMethod}
              onChange={handleMethodChange}
              options={[
                { id: "portal_email", label: "Email", icon: <Mail size={13} /> },
                { id: "cadet_id", label: "Cadet / App ID", icon: <BadgeCheck size={13} /> },
                { id: "officer_admin", label: "Officer / Admin", icon: <Shield size={13} /> },
              ]}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && !needsCadetLink ? (
            <>
              <AuthInput
                id="reg-name-input"
                type="text"
                label={lang === "bn" ? "পূর্ণ নাম *" : "Full Name *"}
                icon={<UserIcon size={16} />}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Md. Abdullah"
                autoComplete="name"
                required
              />

              <AuthInput
                id="reg-email-input"
                type="email"
                label={lang === "bn" ? "ইমেইল ঠিকানা *" : "Email Address *"}
                icon={<Mail size={16} />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cadet@example.com"
                autoComplete="email"
                required
              />
            </>
          ) : (
            <AuthInput
              id="login-username-input"
              type={needsCadetLink ? "text" : activeIdCfg.type}
              label={
                needsCadetLink
                  ? lang === "bn"
                    ? "ক্যাডেট / আবেদন আইডি *"
                    : "Cadet / Applicant ID *"
                  : `${activeIdCfg.label} *`
              }
              icon={
                loginMethod === "portal_email" && !needsCadetLink ? (
                  <Mail size={16} />
                ) : (
                  <UserIcon size={16} />
                )
              }
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={needsCadetLink ? "e.g. 1111" : activeIdCfg.placeholder}
              autoComplete={needsCadetLink ? "off" : activeIdCfg.autoComplete}
              hint={needsCadetLink ? undefined : activeIdCfg.hint}
              required
            />
          )}

          <PasswordInput
            id="login-password-input"
            label={
              needsCadetLink
                ? lang === "bn"
                  ? "আবেদনের পাসওয়ার্ড *"
                  : "Applicant Password *"
                : lang === "bn"
                ? "পাসওয়ার্ড *"
                : "Password *"
            }
            icon={<Lock size={16} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
          />

          {mode === "register" && !needsCadetLink && (
            <PasswordInput
              id="reg-confirm-input"
              label={lang === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন *" : "Confirm Password *"}
              icon={<Lock size={16} />}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          )}

          {mode === "signin" && !needsCadetLink && (
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <span className="text-[11px] text-[#64748B]">
                {loginMethod === "portal_email"
                  ? "Email & Password verified"
                  : loginMethod === "cadet_id"
                  ? "Applicant & Cadet IDs"
                  : "Authorized staff only"}
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
          )}

          <AuthLoadingButton
            id="login-submit-btn"
            type="submit"
            loading={loading}
            loadingText={
              needsCadetLink
                ? "লিংক করা হচ্ছে..."
                : mode === "register"
                ? "অ্যাকাউন্ট তৈরি হচ্ছে..."
                : "যাচাই করা হচ্ছে..."
            }
            icon={<ArrowRight size={17} />}
          >
            {needsCadetLink
              ? "Link Cadet Account"
              : mode === "register"
              ? lang === "bn"
                ? "নতুন অ্যাকাউন্ট তৈরি করুন"
                : "Create Portal Account"
              : lang === "bn"
              ? "নিরাপদ সাইন-ইন"
              : "Sign In"}
          </AuthLoadingButton>
        </form>

        {mode === "signin" && !needsCadetLink && (
          <SecurityNotice>
            পূর্বে Google দিয়ে সাইন-ইন করে থাকলে <strong>&ldquo;পাসওয়ার্ড ভুলে গেছেন?&rdquo;</strong> থেকে আপনার ইমেইলে রিসেট লিংক নিয়ে নতুন পাসওয়ার্ড সেট করুন। আপনার পূর্বের সকল তথ্য সুরক্ষিত থাকবে।
          </SecurityNotice>
        )}

        <div className="text-center text-xs text-[#64748B]">
          নতুন ক্যাডেট হিসেবে যোগ দিতে চান?{" "}
          <Link to="/enroll" className="text-[#002147] font-bold hover:text-[#C5A059] underline">
            অনলাইন ভর্তি ফরম পূরণ করুন →
          </Link>
        </div>

        <AuthFooter portalType="central" />
      </AuthCard>

      <ForgotPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(uid) => {
          if (uid.includes("@")) {
            setLoginMethod("portal_email");
          }
          setIdentifier(uid);
        }}
      />
    </AuthLayout>
  );
}
