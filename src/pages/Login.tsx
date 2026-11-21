import { useState, FormEvent } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Shield,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  User as UserIcon,
  Loader2,
  HelpCircle,
  CheckCircle2,
  LogOut,
  LayoutDashboard,
  Link2,
  Mail,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  centralAuthenticate,
  registerWithEmailPassword,
  linkEmailSessionToApplicant,
  setSession,
  getSession,
  clearSession,
  logoutEverywhere,
} from "../lib/auth";
import { getDefaultLandingRoute } from "../lib/rbac";
import { ResetPasswordModal } from "../components/ResetPasswordModal";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function Login() {
  const { lang } = useLanguage();
  useDocumentMeta({
    title: "Portal Login | Cox's Bazar City College BNCC Platoon",
    description: "Secure sign in and account registration for cadets, applicants, and platoon officers.",
  });

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [needsCadetLink, setNeedsCadetLink] = useState(false);
  const [linkEmail, setLinkEmail] = useState<string | null>(null);

  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSession = getSession();

  const navigateByRole = (role?: string) => {
    const targetPath = (location.state as any)?.from;
    if (targetPath && typeof targetPath === "string") {
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
    await logoutEverywhere();
    clearSession();
    window.location.reload();
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setInfoMsg("");
    try {
      const res = await loginWithGoogle();
      if (!res.success || !res.user) {
        setError(res.error || (lang === "bn" ? "Google লগইন সম্পন্ন করা যায়নি।" : "Google sign-in failed."));
        return;
      }
      setSession(res.user);
      if (res.needsCadetLink && res.user.role === "user") {
        setNeedsCadetLink(true);
        setLinkEmail(res.user.email || null);
        return;
      }
      navigateByRole(res.user.role);
    } catch (err: any) {
      setError("Google সাইন-ইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfoMsg("");

    try {
      if (needsCadetLink) {
        const linked = await linkEmailSessionToApplicant(userId, password);
        if (linked.success && linked.user) {
          setSession(linked.user);
          navigateByRole(linked.user.role);
          return;
        }
        setError(linked.error || "ক্যাডেট অ্যাকাউন্ট লিংক করা যায়নি।");
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
        const regRes = await registerWithEmailPassword(email, password, fullName);
        if (!regRes.success || !regRes.user) {
          setError(regRes.error || "অ্যাকাউন্ট তৈরি করা যায়নি।");
          return;
        }
        setSession(regRes.user);
        setInfoMsg(
          lang === "bn"
            ? "অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে! এখন পূর্বের ক্যাডেট আইডি লিংক করুন অথবা নতুন ভর্তি আবেদন করুন।"
            : "Account created successfully! Link your existing Cadet ID or submit a new enrollment application."
        );
        setNeedsCadetLink(true);
        setLinkEmail(regRes.user.email || email);
        return;
      }

      const res = await centralAuthenticate(userId, password);
      if (!res.success || !res.user) {
        setError(res.error || "লগইন করতে ব্যর্থ হয়েছেন।");
        return;
      }

      setSession(res.user);
      if (res.needsCadetLink && res.user.role === "user") {
        setNeedsCadetLink(true);
        setLinkEmail(res.user.email || null);
        return;
      }

      navigateByRole(res.user.role);
    } catch (err: any) {
      setError("সিস্টেমে সমস্যা দেখা দিয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#020B18] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-[#C5A059]" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#061830] p-8 md:p-10 rounded-3xl space-y-6 border border-white/10 shadow-2xl z-10"
      >
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 bg-[#002147] rounded-2xl flex items-center justify-center mx-auto border border-[#C5A059]/40">
            <Shield className="w-7 h-7 text-[#C5A059]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-display">
            {mode === "register"
              ? lang === "bn"
                ? "নতুন পোর্টাল অ্যাকাউন্ট"
                : "Create Portal Account"
              : lang === "bn"
              ? "বিএনসিসি পোর্টাল লগইন"
              : "BNCC Central Portal"}
          </h1>
          <p className="text-slate-300 text-xs font-medium">
            Cox&apos;s Bazar City College BNCC Platoon • 15 BNCC Battalion
          </p>
        </div>

        {/* Mode Switcher */}
        {!needsCadetLink && (
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="grid grid-cols-2 p-1 rounded-xl bg-slate-950/70 border border-white/10"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              onClick={() => {
                setMode("signin");
                setError("");
                setInfoMsg("");
              }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "signin"
                  ? "bg-[#C5A059] text-[#00152e]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Lock size={14} />
              <span>{lang === "bn" ? "সাইন ইন" : "Sign In"}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => {
                setMode("register");
                setError("");
                setInfoMsg("");
              }}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "register"
                  ? "bg-[#C5A059] text-[#00152e]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <UserPlus size={14} />
              <span>{lang === "bn" ? "নতুন অ্যাকাউন্ট" : "Register"}</span>
            </button>
          </div>
        )}

        {activeSession && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-300 font-semibold text-xs">
              <CheckCircle2 size={16} />
              <span>
                Signed in as <strong className="text-white">{activeSession.name}</strong> ({activeSession.role})
              </span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleGoToDashboard}
                className="px-4 py-2 bg-[#C5A059] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-[#d6b36c] transition-all cursor-pointer"
              >
                <LayoutDashboard size={14} />
                Open Dashboard
              </button>
              <button
                type="button"
                onClick={handleLogoutExisting}
                className="px-4 py-2 bg-white/10 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 hover:bg-white/20 transition-all cursor-pointer"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>
        )}

        {needsCadetLink && (
          <div className="p-4 bg-amber-500/10 border border-amber-400/30 rounded-2xl text-xs text-amber-200 space-y-2">
            <p className="font-bold flex items-center gap-1.5 text-amber-300">
              <Link2 size={14} /> Portal Account Signed In ({linkEmail})
            </p>
            <p>
              আপনার পূর্বের ক্যাডেট/আবেদন আইডি (যেমন: 1111) এবং পাসওয়ার্ড দিয়ে লিংক করুন, অথবা নতুন আবেদন করতে Enroll পেজে যান।
            </p>
            <div className="flex gap-2 pt-1">
              <Link
                to="/enroll"
                className="px-3 py-1.5 bg-[#C5A059] text-[#00152e] font-bold rounded-lg text-[11px]"
              >
                নতুন ভর্তি আবেদন করুন →
              </Link>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="px-3 py-1.5 bg-white/10 text-white font-semibold rounded-lg text-[11px] cursor-pointer"
              >
                ড্যাশবোর্ড
              </button>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="bg-rose-500/15 border border-rose-500/30 p-3.5 rounded-2xl flex items-start gap-2.5 text-left">
            <AlertCircle size={16} className="text-rose-300 shrink-0 mt-0.5" />
            <p className="text-rose-200 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {infoMsg && (
          <div role="status" className="bg-emerald-500/15 border border-emerald-500/30 p-3.5 rounded-2xl flex items-start gap-2.5 text-left">
            <CheckCircle2 size={16} className="text-emerald-300 shrink-0 mt-0.5" />
            <p className="text-emerald-200 text-xs font-semibold leading-relaxed">{infoMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && !needsCadetLink ? (
            <>
              <div>
                <label htmlFor="reg-name-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {lang === "bn" ? "পূর্ণ নাম" : "Full Name"}
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="reg-name-input"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-slate-400 focus:border-[#C5A059] outline-none transition-all text-sm"
                    placeholder="Md. Abdullah"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  {lang === "bn" ? "ইমেইল ঠিকানা" : "Email Address"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="reg-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-slate-400 focus:border-[#C5A059] outline-none transition-all text-sm"
                    placeholder="cadet@example.com"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="login-username-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {needsCadetLink
                  ? lang === "bn"
                    ? "ক্যাডেট / আবেদন আইডি"
                    : "Cadet / Applicant ID"
                  : lang === "bn"
                  ? "ইমেইল / ক্যাডেট আইডি / অফিসার ইউজারনেম"
                  : "Email / Cadet ID / Officer Username"}
              </label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="login-username-input"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-slate-400 focus:border-[#C5A059] outline-none transition-all font-semibold text-sm"
                  placeholder={needsCadetLink ? "e.g. 1111" : "email@domain.com, 1111, or admin"}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="login-password-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              {lang === "bn" ? "পাসওয়ার্ড" : "Password"}
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder:text-slate-400 focus:border-[#C5A059] outline-none transition-all text-sm"
                placeholder="••••••••"
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                required
              />
              <button
                id="login-toggle-password-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#C5A059] transition-colors cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === "register" && !needsCadetLink && (
            <div>
              <label htmlFor="reg-confirm-input" className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                {lang === "bn" ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm Password"}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="reg-confirm-input"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-slate-400 focus:border-[#C5A059] outline-none transition-all text-sm"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          )}

          {mode === "signin" && !needsCadetLink && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-xs font-semibold text-[#C5A059] hover:text-[#dfc07c] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle size={13} />
                পাসওয়ার্ড ভুলে গেছেন? / Reset Password
              </button>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3.5 bg-[#C5A059] hover:bg-[#d6b36c] text-[#00152e] font-black text-sm rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg cursor-pointer"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : needsCadetLink ? (
              "Link Cadet Account"
            ) : mode === "register" ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        {!needsCadetLink && (
          <div className="space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-[#061830] shrink-0">
                {lang === "bn" ? "অথবা" : "OR"}
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>
            <GoogleSignInButton
              onClick={() => void handleGoogleLogin()}
              loading={googleLoading}
              disabled={loading}
              label={
                lang === "bn"
                  ? "Google দিয়ে চালিয়ে যান / Sign in with Google"
                  : "Continue with Google"
              }
            />
          </div>
        )}

        <div className="text-center pt-4 border-t border-white/10 space-y-2">
          <p className="text-slate-300 text-xs">
            নতুন ক্যাডেট হতে চান?{" "}
            <Link to="/enroll" className="text-[#C5A059] font-bold hover:underline">
              অনলাইন ভর্তি ফরম পূরণ করুন →
            </Link>
          </p>
        </div>
      </motion.div>

      <ResetPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(uid) => setUserId(uid)}
      />
    </div>
  );
}
