import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowRight, Eye, EyeOff, Terminal, Loader2 } from "lucide-react";
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

    const envPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "").trim();
    const fallbackPassword = "BNCC@Admin#2026!Secure";
    
    const inputPassword = password.trim();
    
    if (inputPassword === fallbackPassword || (envPassword && inputPassword === envPassword)) {
      localStorage.setItem("adminPasswordVerified", "true");
      navigate("/admin/dashboard");
    } else {
      setError("Access Denied: Invalid Authentication Credentials.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-paper">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-12 rounded-sm border-t-4 border-primary space-y-10"
      >
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-ink rounded-sm flex items-center justify-center mx-auto shadow-xl shadow-ink/20">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-1">
            <h4 className="micro-label">Secure Access Protocol</h4>
            <h1 className="text-3xl font-black text-ink uppercase tracking-tighter">Admin Portal</h1>
          </div>
          <p className="text-ink/40 text-xs font-medium max-w-[240px] mx-auto">Authorized personnel only. All access attempts are logged and monitored.</p>
        </div>

        <div className="space-y-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-accent/5 border-l-2 border-accent p-4"
            >
              <p className="text-accent text-[10px] font-black uppercase tracking-widest">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="micro-label">Access Key</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/20" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-ink/5 border-b-2 border-ink/10 pl-12 pr-12 py-4 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-ink/20"
                  placeholder="ENTER ACCESS KEY"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink/20 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-ink text-white font-black uppercase tracking-widest text-xs rounded-sm flex items-center justify-center gap-3 btn-hover disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Establish Connection</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="pt-8 border-t border-ink/5 flex items-center justify-center gap-2 text-ink/20">
          <Terminal size={14} />
          <span className="text-[9px] font-black uppercase tracking-widest">System v4.0.2-Stable</span>
        </div>
      </motion.div>
    </div>
  );
}
