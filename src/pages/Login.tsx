import { useState, FormEvent, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { 
  Shield, Lock, ArrowRight, Eye, EyeOff, 
  User as UserIcon, Loader2, HelpCircle, CheckCircle2, LogOut, LayoutDashboard
} from "lucide-react";
import { motion } from "framer-motion";
import { handleFirestoreError, OperationType } from "../firebase";
import { centralAuthenticate, setSession, getSession, clearSession, isAuthorizedAdmin } from "../lib/auth";
import { ResetPasswordModal } from "../components/ResetPasswordModal";

export function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const activeSession = getSession();

  // If user is already logged in, show status or allow fast redirect
  const handleGoToDashboard = () => {
    if (!activeSession) return;
    if (isAuthorizedAdmin(activeSession.role)) {
      navigate("/admin/dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  const handleLogoutExisting = () => {
    clearSession();
    window.location.reload();
  };

  // Handle standard centralized login
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await centralAuthenticate(userId, password);
      
      if (!res.success || !res.user) {
        setError(res.error || "লগইন করতে ব্যর্থ হয়েছেন।");
        setLoading(false);
        return;
      }

      // Store central session
      setSession(res.user);

      // Check if there was a target route in location state
      const targetPath = (location.state as any)?.from;
      if (targetPath) {
        navigate(targetPath);
        return;
      }

      // Navigate based on role
      if (isAuthorizedAdmin(res.user.role)) {
        if (res.user.role === "qr_admin") {
          navigate("/admin/qr-dashboard");
        } else {
          navigate("/admin/dashboard");
        }
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("লগইন সিস্টেমে সমস্যা দেখা দিয়েছে: " + (err.message || ""));
      handleFirestoreError(err, OperationType.GET, `applicants/${userId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950 relative overflow-hidden">
      {/* Background decorations conforming to strict styling rules */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-rose-500 to-accent" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-10 rounded-3xl space-y-8 border border-white/5 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] z-10"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-primary/20">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter font-display">BNCC Central Login</h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Single Sign-On for Admin & Cadet Portals
          </p>
        </div>

        {/* Existing Session Active Notice */}
        {activeSession && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
              <CheckCircle2 size={16} />
              <span>You are logged in as <strong className="text-white">{activeSession.name}</strong> ({activeSession.role})</span>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={handleGoToDashboard}
                className="px-4 py-2 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-1.5 hover:bg-emerald-400 transition-all cursor-pointer"
              >
                <LayoutDashboard size={14} />
                Dashboard
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
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center"
          >
            <p className="text-red-400 text-xs font-bold">{error}</p>
          </motion.div>
        )}

        <motion.form
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleLogin}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="login-username-input"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-primary outline-none transition-all font-mono font-bold"
                placeholder="User ID / Admin Username (e.g. admin or 1234)"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                id="login-password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-12 py-4 text-white focus:border-primary outline-none transition-all"
                placeholder="Password"
                required
              />
              <button
                id="login-toggle-password-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex justify-end pr-1">
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer tracking-wider"
              >
                <HelpCircle size={12} />
                পাসওয়ার্ড ভুলে গেছেন? / Forgot Password?
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Central Login"}
              {!loading && <ArrowRight size={18} />}
            </button>
          </div>
        </motion.form>

        <div className="text-center pt-2 border-t border-white/5 space-y-1">
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            One Account for Admin Dashboard, Examination & Cadet Services
          </p>
          <p className="text-slate-600 text-[9px] uppercase font-bold tracking-widest">
            Cox's Bazar City College BNCC Platoon
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

