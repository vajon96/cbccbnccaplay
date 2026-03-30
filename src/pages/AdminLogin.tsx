import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { auth, googleProvider, signInWithPopup } from "../firebase";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // The requested password from env
    const adminPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "BNCC@Admin#2026!Secure").trim();
    if (password.trim() === adminPassword) {
      localStorage.setItem("adminPasswordVerified", "true");
      navigate("/admin/dashboard");
    } else {
      setError("ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass-card p-10 rounded-[2.5rem] space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white">অ্যাডমিন লগইন</h1>
          <p className="text-slate-400 text-sm">ড্যাশবোর্ড অ্যাক্সেস করতে পাসওয়ার্ড দিন</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="space-y-2">
              <p className="text-red-400 text-xs text-center font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>
              <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest">Hint: BNCC@Admin#2026!Secure</p>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-12 py-4 text-white focus:border-accent outline-none transition-colors"
                placeholder="পাসওয়ার্ড লিখুন"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-accent text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white transition-all disabled:opacity-50"
            >
              {loading ? "যাচাই হচ্ছে..." : "পাসওয়ার্ড দিয়ে এগিয়ে যান"} <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
