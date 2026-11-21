import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  Lock,
  ArrowRight,
  AlertCircle,
  Key,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Loader2,
} from "lucide-react";
import {
  centralAuthenticate,
  setSession,
  getSession,
  clearSession,
  isAuthorizedAdmin,
  logoutEverywhere,
} from "../lib/auth";
import { getDefaultLandingRoute } from "../lib/rbac";
import { ExamNavbar } from "../components/exam/ExamNavbar";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useAuth } from "../context/AuthContext";

export function ExamAdminLogin() {
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const activeSession = getSession();

  const handleGoToDashboard = () => {
    if (!activeSession) return;
    navigate(getDefaultLandingRoute(activeSession.role));
  };

  const handleLogoutExisting = async () => {
    await logoutEverywhere();
    clearSession();
    window.location.reload();
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !password.trim()) {
      setError("অ্যাডমিন আইডি / ইমেইল ও পাসওয়ার্ড প্রবেশ করান।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await centralAuthenticate(adminId, password);
      if (!res.success || !res.user) {
        setError(res.error || "অ্যাডমিন অ্যাক্সেস অনুমোদিত নয় বা ভুল ক্রেডেনশিয়াল।");
        return;
      }
      setSession(res.user);
      navigate(isAuthorizedAdmin(res.user.role) ? "/exam/admin" : "/exam/dashboard");
    } catch (err: any) {
      setError("অ্যাডমিন লগইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await loginWithGoogle();
      if (!res.success || !res.user) {
        setError(res.error || "Google সাইন-ইন সম্পন্ন করা যায়নি।");
        return;
      }
      if (!isAuthorizedAdmin(res.user.role)) {
        setError("এই Google অ্যাকাউন্টে Exam Admin / Super Admin অনুমোদন নেই। অনুমোদিত ইমেইল ব্যবহার করুন।");
        return;
      }
      setSession(res.user);
      navigate("/exam/admin");
    } catch (err: any) {
      setError("Google অ্যাডমিন লগইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020B18] text-white font-sans flex flex-col">
      <ExamNavbar />

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="bg-[#061830] border border-white/10 rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center mx-auto mb-3">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight font-display">
              Exam Controller Access
            </h2>
            <p className="text-slate-300 text-xs font-medium">
              পরীক্ষা নিয়ন্ত্রক ও সুপার অ্যাডমিন লগইন (Username বা Email)
            </p>
          </div>

          {activeSession && (
            <div className="p-4 bg-[#C5A059]/10 border border-[#C5A059]/25 rounded-2xl space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-[#dfc07c] font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>
                  Logged in as <strong className="text-white">{activeSession.name}</strong> ({activeSession.role})
                </span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={handleGoToDashboard}
                  className="px-4 py-2 bg-[#C5A059] text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <LayoutDashboard size={14} />
                  Open Panel
                </button>
                <button
                  onClick={handleLogoutExisting}
                  className="px-4 py-2 bg-white/10 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-2xl text-xs font-bold flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="exam-admin-id" className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Exam Admin Username or Email
              </label>
              <div className="relative">
                <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="exam-admin-id"
                  type="text"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  placeholder="admin or officer email"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-[#C5A059] font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="exam-admin-pw" className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="exam-admin-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-[#C5A059] font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-3.5 bg-[#C5A059] hover:bg-[#d6b36c] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              <span>{loading ? "Authenticating..." : "Access Exam Console"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/10 w-full" />
              <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-[#061830] shrink-0">
                OR
              </span>
              <div className="border-t border-white/10 w-full" />
            </div>
            <GoogleSignInButton
              onClick={() => void handleGoogleLogin()}
              loading={googleLoading}
              disabled={loading}
              label="Google দিয়ে অ্যাডমিন লগইন"
            />
          </div>

          <div className="pt-3 border-t border-white/10 text-center text-xs text-slate-400 flex items-center justify-center gap-4 font-bold">
            <Link to="/login" className="text-[#C5A059] hover:underline">
              Central Portal Login
            </Link>
            <span>•</span>
            <Link to="/admin/dashboard" className="text-slate-300 hover:underline">
              Main Admin Dashboard →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
