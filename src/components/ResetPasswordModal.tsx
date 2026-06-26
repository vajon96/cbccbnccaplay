import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, ShieldAlert, Key, CheckCircle, AlertCircle, 
  MapPin, Globe, Loader2, ArrowRight, HelpCircle 
} from "lucide-react";
import { db, collection, setDoc, doc, getDoc, updateDoc, addDoc, Timestamp } from "../firebase";
import { hashPassword } from "../lib/auth";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}

export function ResetPasswordModal({ isOpen, onClose, onSuccess }: ResetPasswordModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Step 1: Info Inputs
  const [applicantId, setApplicantId] = useState("");
  const [fullName, setFullName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [mobile, setMobile] = useState("");
  const [sscGpa, setSscGpa] = useState("");

  const [verifiedApplicant, setVerifiedApplicant] = useState<any>(null);

  // Background Geolocation & IP tracking for security audit trails
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("Retrieving...");
  const [locatingState, setLocatingState] = useState<"idle" | "fetching" | "success" | "denied">("idle");

  // Step 2: Password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Retrieve geolocation and IP in background when modal is open and on step 2
  useEffect(() => {
    if (isOpen && step === 2) {
      setLocatingState("fetching");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setLocatingState("success");
          },
          (err) => {
            console.warn("Geolocation error:", err);
            setLocatingState("denied");
          },
          { timeout: 7000 }
        );
      } else {
        setLocatingState("denied");
      }

      fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(data => {
          if (data && data.ip) {
            setIpAddress(data.ip);
          } else {
            setIpAddress("Unavailable");
          }
        })
        .catch(err => {
          console.warn("IP retrieve failed:", err);
          setIpAddress("Unavailable");
        });
    }
  }, [isOpen, step]);

  const clean = (str: string) => {
    return (str || "").trim().toLowerCase();
  };

  // Step 1: Info validation
  const handleVerifyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!applicantId.trim()) {
      setError("অনুগ্রহ করে আবেদন আইডি প্রদান করুন।");
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "applicants", applicantId.trim());
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setError("ভুল আবেদন আইডি! ক্যাডেট পাওয়া যায়নি।");
        setLoading(false);
        return;
      }

      const dbData = docSnap.data();

      // Comparison logic: Check inputs carefully against multiple potential formats (Bangla or English)
      const nameMatch = clean(dbData.fullNameEnglish) === clean(fullName) || clean(dbData.fullNameBangla) === clean(fullName);
      const fatherMatch = clean(dbData.fatherNameEnglish) === clean(fatherName) || clean(dbData.fatherNameBangla) === clean(fatherName);
      const motherMatch = clean(dbData.motherNameEnglish) === clean(motherName) || clean(dbData.motherNameBangla) === clean(motherName);
      
      // Clean phone numbers (remove characters and prefixes to align formats)
      const cleanPhone = (ph: string) => (ph || "").replace(/[^0-9]/g, "").slice(-10);
      const phoneMatch = cleanPhone(dbData.studentPhone) === cleanPhone(mobile);

      // Compare GPA as float string
      const cleanGpa = (gp: string) => parseFloat(gp || "0").toFixed(2);
      const gpaMatch = cleanGpa(dbData.sscGpa) === cleanGpa(sscGpa);

      if (nameMatch && fatherMatch && motherMatch && phoneMatch && gpaMatch) {
        // Success
        setVerifiedApplicant({ id: docSnap.id, ...dbData });
        setSuccess("১ম ধাপ তথ্য ভেরিফিকেশন সফল হয়েছে। এবার নতুন পাসওয়ার্ড সেট করুন।");
        setTimeout(() => setSuccess(null), 2500);
        setStep(2);
      } else {
        setError("প্রদত্ত তথ্যের সাথে ক্যাডেট ডাটাবেসের তথ্যের মিল পাওয়া যায়নি। দয়া করে সঠিক তথ্য দিন।");
      }
    } catch (err: any) {
      console.error("Info verification error:", err);
      setError("যাচাইকরণ প্রক্রিয়া ব্যাহত হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Password Update and Secure Logging
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (newPassword.length < 6) {
      setError("নিরাপত্তার স্বার্থে পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("পাসওয়ার্ড দুটি মেলেনি। পুনরায় চেক করুন।");
      setLoading(false);
      return;
    }

    try {
      const hashed = await hashPassword(newPassword);
      const resetId = `${verifiedApplicant.id}_${Date.now()}`;
      
      // 1. Update applicant profile with newly generated hashed password
      await updateDoc(doc(db, "applicants", verifiedApplicant.id), {
        password: hashed,
        updatedAt: Timestamp.now()
      });

      // 2. Upload/Save Reset Event Log
      await setDoc(doc(db, "password_resets", resetId), {
        id: resetId,
        applicantId: verifiedApplicant.id,
        name: verifiedApplicant.fullNameEnglish || verifiedApplicant.fullNameBangla,
        mobile: verifiedApplicant.studentPhone,
        createdAt: Timestamp.now(),
        photo: null,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        ipAddress: ipAddress,
        status: "resolved"
      });

      // 3. Instantly write to notifications collection for real-time dashboard notification
      await addDoc(collection(db, "notifications"), {
        title: "সিকিউরিটি পাসওয়ার্ড পরিবর্তন অ্যালার্ট",
        message: `${verifiedApplicant.fullNameEnglish || verifiedApplicant.fullNameBangla} (${verifiedApplicant.id}) এর পাসওয়ার্ড পরিবর্তিত হয়েছে। মোবাইল: ${verifiedApplicant.studentPhone}।`,
        type: "Alert",
        isRead: false,
        timestamp: Timestamp.now(),
        photo: null,
        applicantId: verifiedApplicant.id,
        ipAddress: ipAddress,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        metadata: {
          location: location ? `${location.latitude}, ${location.longitude}` : "Denied/Unknown",
          ip: ipAddress,
          time: new Date().toLocaleTimeString()
        }
      });

      // 4. Create system Activity log
      await addDoc(collection(db, "activity_logs"), {
        type: "PASSWORD_RESET_SELF",
        targetId: verifiedApplicant.id,
        actorId: verifiedApplicant.id,
        timestamp: Timestamp.now(),
        details: `${verifiedApplicant.fullNameEnglish} (${verifiedApplicant.id}) has successfully updated their portal password via secure portal verification.`
      });

      setSuccess("অভিনন্দন! আপনার পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে।");
      setTimeout(() => {
        onSuccess(verifiedApplicant.id);
        onClose();
        // Reset state
        setStep(1);
        setApplicantId("");
        setFullName("");
        setFatherName("");
        setMotherName("");
        setMobile("");
        setSscGpa("");
        setNewPassword("");
        setConfirmPassword("");
        setVerifiedApplicant(null);
      }, 3000);
    } catch (err: any) {
      console.error("Save password error:", err);
      setError("পাসওয়ার্ড সেভ করা যায়নি। সার্ভার ইন্টারাপশন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl p-6 md:p-8 overflow-hidden z-10"
          >
            {/* Top Bar Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-rose-500" />

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20">
                  <Key className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">পাসওয়ার্ড রিসেট সিস্টেম</h3>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Step {step} of 2: Verification Flow</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Progress Dots */}
            <div className="flex items-center gap-2 mb-6 justify-center">
              {[1, 2].map((num) => (
                <div key={num} className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    step === num 
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-110" 
                      : step > num ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-zinc-500"
                  }`}>
                    {step > num ? <CheckCircle className="w-4 h-4 text-emerald-950" /> : num}
                  </div>
                  {num < 2 && <div className={`w-12 h-0.5 transition-all ${step > num ? "bg-emerald-500" : "bg-slate-800"}`} />}
                </div>
              ))}
            </div>

            {/* Alerts */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-300 font-bold leading-relaxed">{error}</p>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3"
              >
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-300 font-bold leading-relaxed">{success}</p>
              </motion.div>
            )}

            {/* Step Content */}
            <div className="space-y-6">
              {step === 1 && (
                <form onSubmit={handleVerifyInfo} className="space-y-4">
                  <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-amber-400 leading-relaxed font-bold">
                      পাসওয়ার্ড পরিবর্তনের পূর্বে সিকিউরিটি ভ্যালিডেশনের জন্য নিচের তথ্যগুলো হুবহু আপনার আবেদন ফরমের মতো প্রদান করুন।
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">ইউজার/আবেদন আইডি </label>
                      <input
                        type="text"
                        required
                        value={applicantId}
                        onChange={(e) => setApplicantId(e.target.value)}
                        placeholder="উদাঃ 20261023"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">পূর্ণ নাম (ইংরেজি/বাংলা)</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="উদাঃ SAJON DEY"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">পিতার নাম (পিতা)</label>
                      <input
                        type="text"
                        required
                        value={fatherName}
                        onChange={(e) => setFatherName(e.target.value)}
                        placeholder="পিতার নাম"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">মাতার নাম (মাতা)</label>
                      <input
                        type="text"
                        required
                        value={motherName}
                        onChange={(e) => setMotherName(e.target.value)}
                        placeholder="মাতার নাম"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">মোবাইল নম্বর </label>
                      <input
                        type="text"
                        required
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">SSC GPA (যেমন: 5.00)</label>
                      <input
                        type="text"
                        required
                        value={sscGpa}
                        onChange={(e) => setSscGpa(e.target.value)}
                        placeholder="5.00"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none placeholder:text-zinc-600 transition-all font-bold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        তথ্য যাচাই করুন
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-emerald-400 font-bold leading-relaxed">
                      🔒 আপনার সিকিউরিটি ভ্যালিডেশন সফলভাবে সম্পন্ন হয়েছে। অনুগ্রহ করে আপনার নতুন পাসওয়ার্ড সেট করুন।
                    </p>
                  </div>

                  {/* Tracking Metadata Visualization (IP & Geolocation Logged for Security audits) */}
                  <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <Globe className="w-4 h-4 text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Public IP Address</p>
                        <p className="text-xs text-zinc-300 font-mono font-bold">{ipAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        locatingState === "success" 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : locatingState === "fetching" 
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                      }`}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">GPS Tracker</p>
                        <p className="text-xs text-zinc-300 font-bold">
                          {locatingState === "success" && location 
                            ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                            : locatingState === "fetching" 
                              ? "Locating..."
                              : "Blocked / Offline"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">নতুন পাসওয়ার্ড (New Password)</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-emerald-500 outline-none placeholder:text-zinc-600 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">পাসওয়ার্ড নিশ্চিত করুন (Confirm Password)</label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl px-4 py-4 text-sm text-white focus:border-emerald-500 outline-none placeholder:text-zinc-600 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-slate-950 text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <>
                        পাসওয়ার্ড পরিবর্তন ও সেভ করুন
                        <CheckCircle size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
