import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, ArrowRight, Eye, EyeOff, User as UserIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { db, doc, getDoc, handleFirestoreError, OperationType, collection, query, where, getDocs } from "../firebase";
import { comparePassword, setSession } from "../lib/auth";

export function Login() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Static Admin Check (Super Admin fallback)
      const envPassword = (import.meta.env.VITE_ADMIN_PASSWORD || "").trim();
      const fallbackPassword = "BNCC@Admin#2026!Secure";
      
      const checkAdmin = userId.toLowerCase() === "admin";
      if (checkAdmin) {
        if (password === fallbackPassword || (envPassword && password === envPassword)) {
          setSession({ id: "super_admin", role: "super_admin", name: "Super Admin" });
          navigate("/admin/dashboard");
          return;
        } else {
          setError("ভুল অ্যাডমিন পাসওয়ার্ড।");
          setLoading(false);
          return;
        }
      }

      // Dynamic Admin Check (Secondary Admins)
      const adminsRef = collection(db, "admins");
      const adminQuery = query(adminsRef, where("username", "==", userId.toLowerCase()));
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data();
        const isMatch = await comparePassword(password, adminData.password);
        if (isMatch) {
          setSession({
            id: adminSnapshot.docs[0].id,
            role: adminData.role || "admin",
            name: adminData.name
          });
          navigate("/admin/dashboard");
          return;
        }
      }

      // User Login
      const docRef = doc(db, "applicants", userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        const isMatch = await comparePassword(password, userData.password);
        
        if (isMatch) {
          setSession({ 
            id: userData.id, 
            role: userData.role || "user", 
            name: userData.fullNameEnglish 
          });
          navigate("/dashboard");
        } else {
          setError("ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।");
        }
      } else {
        setError("ইউজার আইডি পাওয়া যায়নি।");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("লগইন করতে সমস্যা হয়েছে।");
      handleFirestoreError(err, OperationType.GET, `applicants/${userId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass-card p-10 rounded-3xl space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tighter">BNCC Portal Login</h1>
          <p className="text-slate-400 text-sm">Enter your credentials to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <p className="text-red-400 text-xs text-center font-bold">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-primary outline-none transition-all"
                placeholder="User ID (e.g. BNCC-123...)"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-12 py-4 text-white focus:border-primary outline-none transition-all"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : "Login to Dashboard"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div className="text-center">
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            Cox's Bazar City College BNCC Platoon
          </p>
        </div>
      </motion.div>
    </div>
  );
}
