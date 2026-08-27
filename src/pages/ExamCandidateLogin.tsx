import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, ArrowRight, Shield, AlertCircle, CheckCircle2, LayoutDashboard, LogOut } from "lucide-react";
import { centralAuthenticate, setSession, getSession, clearSession, isAuthorizedAdmin } from "../lib/auth";
import { ExamNavbar } from "../components/exam/ExamNavbar";

export function ExamCandidateLogin() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const activeSession = getSession();

  const handleGoToDashboard = () => {
    if (!activeSession) return;
    if (isAuthorizedAdmin(activeSession.role)) {
      navigate("/exam/admin");
    } else {
      navigate("/exam/dashboard");
    }
  };

  const handleLogoutExisting = () => {
    clearSession();
    window.location.reload();
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError("ইউজার আইডি ও পাসওয়ার্ড প্রবেশ করান।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await centralAuthenticate(userId, password);

      if (!res.success || !res.user) {
        setError(res.error || "উক্ত ইউজার আইডি সংবলিত প্রোফাইল পাওয়া যায়নি বা পাসওয়ার্ড ভুল।");
        setLoading(false);
        return;
      }

      // Set central auth session
      setSession(res.user);

      if (isAuthorizedAdmin(res.user.role)) {
        navigate("/exam/admin");
      } else {
        navigate("/exam/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("লগইন করতে সমস্যা হয়েছে: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar />

      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full p-8 space-y-6 shadow-2xl relative">
          
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center mx-auto mb-3">
              <Shield size={28} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight font-display">
              Examination Portal Access
            </h2>
            <p className="text-slate-400 text-xs font-semibold">
              ইউজার আইডি / অ্যাডমিন আইডি ও পাসওয়ার্ড ব্যবহার করে লগইন করুন
            </p>
          </div>

          {/* Active Session Card */}
          {activeSession && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 size={16} />
                <span>You are currently logged in as <strong className="text-white">{activeSession.name}</strong></span>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={handleGoToDashboard}
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer"
                >
                  <LayoutDashboard size={14} />
                  Enter Exam Dashboard
                </button>
                <button
                  onClick={handleLogoutExisting}
                  className="px-4 py-2 bg-white/10 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">User ID / Username (ইউজার বা অ্যাডমিন আইডি)</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="e.g. BNCC2026-XXXX or admin"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-primary font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Password (পাসওয়ার্ড)</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-xs text-white outline-none focus:border-primary font-mono"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? "Authenticating Credentials..." : "Access Examination Portal"}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="pt-4 border-t border-white/5 text-center text-xs text-slate-500 font-semibold space-y-2">
            <p>একটি সেন্ট্রাল পাসওয়ার্ড দিয়ে সব সার্ভিস এক্সেস করুন</p>
            <div className="flex items-center justify-center gap-4 text-[11px] font-bold uppercase">
              <Link to="/login" className="text-primary hover:underline">
                Central Portal Login
              </Link>
              <span>•</span>
              <Link to="/exam/admin/login" className="text-amber-400 hover:underline">
                Exam Admin Login →
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

