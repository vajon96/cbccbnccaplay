import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Shield, Lock, ArrowRight, Eye, EyeOff, QrCode, Keyboard, Camera, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, collection, query, where, getDocs } from "../firebase";
import { setSession } from "../lib/auth";

export function Admin2Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isQrMode, setIsQrMode] = useState(false);
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
      // Set default Admin session
      setSession({
        id: "super_admin",
        role: "super_admin",
        name: "Super Admin Support",
        username: "admin",
        permissions: {
          canAdd: true,
          canEdit: true,
          canDelete: true,
          canViewLogs: true,
          canResetPW: true,
          canApprove: true,
          canExport: true,
          canChat: true
        }
      });
      navigate("/admin2/dashboard");
    } else {
      setError("ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।");
    }
    setLoading(false);
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
      const q = query(
        collection(db, "adminTokens"),
        where("qrToken", "==", token)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docData = snap.docs[0].data();
        
        if (docData.expiresAt) {
          const expiresAtMs = docData.expiresAt.toMillis();
          if (Date.now() > expiresAtMs) {
            setError("এই QR কোডের মেয়াদ শেষ হয়ে গেছে।");
            setLoading(false);
            return;
          }
        }

        let roleName = docData.role || "sub_admin";
        let permissions = {
          canAdd: true,
          canEdit: true,
          canDelete: true,
          canViewLogs: true,
          canResetPW: true,
          canApprove: true,
          canExport: true,
          canChat: true
        };

        if (roleName === "sub_admin") {
          permissions = {
            canAdd: true,
            canEdit: true,
            canDelete: false,
            canViewLogs: true,
            canResetPW: false,
            canApprove: true,
            canExport: false,
            canChat: true
          };
        } else if (roleName === "attendance_officer") {
          permissions = {
            canAdd: false,
            canEdit: false,
            canDelete: false,
            canViewLogs: false,
            canResetPW: false,
            canApprove: false,
            canExport: false,
            canChat: false
          };
        }

        setSession({
          id: snap.docs[0].id,
          role: roleName,
          name: docData.name,
          username: docData.username,
          permissions
        });

        navigate("/admin/qr-dashboard");
      } else {
        setError("অবৈধ অ্যাডমিন QR কোড।");
      }
    } catch (err) {
      console.error("QR Code dynamic verification error:", err);
      setError("সার্ভার যাচাইকরণ ত্রুটি ঘটেছে।");
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
          // Retry shortly if the element isn't in the DOM yet due to layout animations
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
                scanner.clear().catch(e => console.error(e));
              }
              setIsQrMode(false);
            },
            () => {}
          );
        } catch (err) {
          console.error("Scanner initialization failed in Admin2Login:", err);
        }
      };

      // Slight initial deferral to wait for Framer Motion / AnimatePresence transitions
      const timer = setTimeout(initScanner, 100);

      return () => {
        isActive = false;
        clearTimeout(timer);
        if (scanner) {
          try {
            scanner.clear().catch(error => console.error("Scanner clear on Admin2 error", error));
          } catch (e) {
            console.error("Error during scanner cleanup:", e);
          }
        }
      };
    }
  }, [isQrMode]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-sand relative overflow-hidden">
      {/* Visual top bar theme sync */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary to-accent" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-[2.5rem] space-y-8 border border-sand shadow-2xl z-10"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-black">অ্যাডমিন ২ পোর্টাল</h1>
          <p className="text-black/60 text-sm">
            {isQrMode ? "অ্যাডমিন QR কোড স্ক্যান করুন" : "এটেনডেন্স প্যানেল অ্যাক্সেস করতে পাসওয়ার্ড দিন"}
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-accent/10 border border-accent/20 rounded-2xl text-accent text-xs font-bold text-center"
          >
            {error}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!isQrMode ? (
            <motion.form
              key="auth2-keyboard"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handlePasswordLogin}
              className="space-y-6"
            >
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

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20 cursor-pointer"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : "পাসওয়ার্ড দিয়ে এগিয়ে যান"} 
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrMode(true)}
                  className="w-full py-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-rose-500 font-bold uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <QrCode size={15} /> QR কোড অ্যাডমিন লগইন
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="auth2-camera"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4">
                <div id="reader-admin-login-2" className="overflow-hidden rounded-2xl bg-black border-2 border-primary shadow-inner" />
                <div className="flex items-center justify-center gap-2 text-primary font-bold text-xs bg-primary/10 py-3 rounded-xl border border-primary/20">
                  <Camera className="w-4 h-4 animate-pulse" />
                  <span>ক্যামেরার সামনে QR কোডটি ধরুন</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsQrMode(false)}
                className="w-full py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-500 font-bold uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Keyboard size={15} /> পাসওয়ার্ড দিয়ে লগইন করুন
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
