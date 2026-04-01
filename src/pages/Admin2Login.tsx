import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export function Admin2Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Same password as admin
    const envPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "").trim();
    const fallbackPassword = "BNCC@Admin#2026!Secure";
    
    const inputPassword = password.trim();
    
    if (inputPassword === fallbackPassword || (envPassword && inputPassword === envPassword)) {
      localStorage.setItem("admin2PasswordVerified", "true");
      navigate("/admin2/dashboard");
    } else {
      setError("ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-sand">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] space-y-8 border border-sand shadow-2xl"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-black">অ্যাডমিন ২ লগইন</h1>
          <p className="text-black/70 text-sm">এটেনডেন্স প্যানেল অ্যাক্সেস করতে পাসওয়ার্ড দিন</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="space-y-2">
              <p className="text-accent text-xs text-center font-bold bg-accent/10 p-3 rounded-lg border border-accent/20">{error}</p>
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-sand rounded-xl pl-12 pr-12 py-4 text-black focus:border-accent outline-none transition-colors"
                placeholder="পাসওয়ার্ড লিখুন"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 hover:text-accent transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              {loading ? "যাচাই হচ্ছে..." : "পাসওয়ার্ড দিয়ে এগিয়ে যান"} <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
