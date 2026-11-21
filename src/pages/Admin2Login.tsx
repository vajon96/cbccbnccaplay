import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Shield,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  QrCode,
  Keyboard,
  Camera,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, collection, query, where, getDocs } from "../firebase";
import {
  setSession,
  centralAuthenticate,
  authenticateWithGoogle,
  syncServerSession,
} from "../lib/auth";
import { isAdminRole } from "../lib/rbac";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function Admin2Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isQrMode, setIsQrMode] = useState(false);
  const navigate = useNavigate();

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await centralAuthenticate(username || "officer", password);
      if (res.success && res.user && isAdminRole(res.user.role)) {
        setSession(res.user);
        navigate("/admin2/dashboard");
      } else {
        setError(res.error || "ভুল ইউজারনেম / ইমেইল বা পাসওয়ার্ড।");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await authenticateWithGoogle({ requireAdmin: true });
      if (res.success && res.user && isAdminRole(res.user.role)) {
        setSession(res.user);
        navigate("/admin2/dashboard");
      } else {
        setError(res.error || "এই Google অ্যাকাউন্টে অফিসার বা অ্যাডমিন অনুমোদন নেই।");
      }
    } catch (err: any) {
      setError("Google সাইন-ইন করতে সমস্যা হয়েছে: " + (err?.message || ""));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleQrScan = async (decodedText: string) => {
    let token = "";
    try {
      const data = JSON.parse(decodedText);
      token = data.qrToken || data.token || decodedText;
    } catch {
      token = decodedText;
    }

    if (!token || !token.startsWith("adm_qr_")) {
      setError("অবৈধ অ্যাডমিন QR কোড। এটি ক্যাডেট কিউআর কোড হতে পারে।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const q = query(collection(db, "adminTokens"), where("qrToken", "==", token));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docData = snap.docs[0].data();
        if (docData.expiresAt && Date.now() > docData.expiresAt.toMillis()) {
          setError("এই QR কোডের মেয়াদ শেষ হয়ে গেছে।");
          setLoading(false);
          return;
        }

        const roleName = docData.role || "attendance_officer";
        const qrUser = {
          id: snap.docs[0].id,
          role: roleName,
          name: docData.name || "Attendance Officer",
          username: docData.username,
          authSource: "qr_token" as const,
          permissions: docData.permissions || {},
        };
        await syncServerSession(qrUser);
        setSession(qrUser);
        navigate("/admin/qr-dashboard");
      } else {
        setError("অবৈধ অ্যাডমিন QR কোড।");
      }
    } catch {
      setError("অফিসার QR যাচাই করতে অ্যাডমিন ইমেইল সাইন-ইন প্রয়োজন বা সার্ভার ত্রুটি ঘটেছে।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    let scanner: Html5QrcodeScanner | null = null;

    if (isQrMode) {
      const initScanner = () => {
        if (!isActive) return;
        const targetElement = document.getElementById("reader-admin-login-2");
        if (!targetElement) {
          setTimeout(initScanner, 50);
          return;
        }

        try {
          scanner = new Html5QrcodeScanner(
            "reader-admin-login-2",
            { fps: 15, qrbox: { width: 250, height: 250 } },
            false
          );

          scanner.render(
            async (decodedText) => {
              if (!isActive) return;
              await handleQrScan(decodedText);
              if (scanner) {
                scanner.clear().catch(() => {});
              }
              setIsQrMode(false);
            },
            () => {}
          );
        } catch (err) {
          console.error("Scanner initialization failed in Admin2Login:", err);
        }
      };

      const timer = setTimeout(initScanner, 100);
      return () => {
        isActive = false;
        clearTimeout(timer);
        if (scanner) {
          scanner.clear().catch(() => {});
        }
      };
    }
  }, [isQrMode]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f8fafc] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#002147]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-8 md:p-10 rounded-3xl space-y-6 border border-slate-200 shadow-2xl z-10"
      >
        <div className="text-center space-y-2.5">
          <div className="w-16 h-16 bg-[#002147] rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <Shield className="w-8 h-8 text-[#C5A059]" />
          </div>
          <h1 className="text-2xl font-black text-[#002147] font-display">অ্যাডমিন ২ / উপস্থিতি পোর্টাল</h1>
          <p className="text-slate-600 text-sm">
            {isQrMode ? "অ্যাডমিন QR কোড স্ক্যান করুন" : "অফিসার ইমেইল বা ইউজারনেম দিয়ে লগইন করুন"}
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!isQrMode ? (
            <motion.div
              key="auth2-keyboard"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-4 py-3 text-slate-900 focus:border-[#002147] outline-none text-sm"
                    placeholder="Officer Username or Email"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl pl-11 pr-11 py-3 text-slate-900 focus:border-[#002147] outline-none text-sm"
                    placeholder="Password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-3.5 bg-[#002147] hover:bg-[#0B2545] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer text-sm shadow-md"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "অফিসার লগইন"}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white shrink-0">
                  অথবা
                </span>
                <div className="border-t border-slate-200 w-full" />
              </div>

              <GoogleSignInButton
                variant="light"
                onClick={() => void handleGoogleLogin()}
                loading={googleLoading}
                disabled={loading}
                label="Google দিয়ে অফিসার লগইন"
              />

              <button
                type="button"
                onClick={() => setIsQrMode(true)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <QrCode size={15} /> QR কোড অ্যাডমিন লগইন
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="auth2-camera"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-5"
            >
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div id="reader-admin-login-2" className="overflow-hidden rounded-xl bg-black border border-slate-300" />
                <div className="flex items-center justify-center gap-2 text-[#002147] font-bold text-xs bg-slate-200/70 py-2.5 rounded-xl">
                  <Camera className="w-4 h-4" />
                  <span>ক্যামেরার সামনে অ্যাডমিন QR কোড ধরুন</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQrMode(false)}
                className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <Keyboard size={15} /> কীবোর্ড লগইনে ফিরে যান
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
