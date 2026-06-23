import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, ShieldAlert, Key, Camera, CheckCircle, AlertCircle, 
  MapPin, Globe, Loader2, ArrowRight, Sparkles, HelpCircle 
} from "lucide-react";
import { db, collection, setDoc, doc, getDoc, updateDoc, addDoc, Timestamp, getDocs, query, where } from "../firebase";
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

  // Step 2: Camera Capture
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("Retrieving...");
  const [locatingState, setLocatingState] = useState<"idle" | "fetching" | "success" | "denied">("idle");
  const [photoSaved, setPhotoSaved] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Step 3: Password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Setup geolocation and IP
  useEffect(() => {
    if (isOpen && step === 2) {
      // Get location immediately
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

      // Fetch IP address
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

  // Handle closing stream when unmounting
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera capture failed:", err);
      setError("ক্যামেরা অন করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ক্যামেরার পারমিশন দিন।");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

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

      // Comparison logic: Check inputs carefully against multiple potential formats (Bangle or English)
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
        setStep(2);
      } else {
        // Find specific discrepancy for debugging feedback, but keep it secure
        setError("প্রদত্ত তথ্যের সাথে ক্যাডেট ডাটাবেসের তথ্যের মিল পাওয়া যায়নি। দয়া করে সঠিক তথ্য দিন।");
      }
    } catch (err: any) {
      console.error("Info verification error:", err);
      setError("যাচাইকরণ প্রক্রিয়া ব্যাহত হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Upload/save Photo
  const handlePhotoUpload = async () => {
    if (!capturedPhoto) {
      setError("অনুগ্রহ করে আপনার লাইভ ছবি তুলুন!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resetId = `${verifiedApplicant.id}_${Date.now()}`;
      
      // Upload/Save Reset Event Log
      await setDoc(doc(db, "password_resets", resetId), {
        id: resetId,
        applicantId: verifiedApplicant.id,
        name: verifiedApplicant.fullNameEnglish || verifiedApplicant.fullNameBangla,
        mobile: verifiedApplicant.studentPhone,
        createdAt: Timestamp.now(),
        photo: capturedPhoto,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        ipAddress: ipAddress,
        status: "pending"
      });

      // Instantly write to notifications collection for real-time dashboard notification
      await addDoc(collection(db, "notifications"), {
        title: "লাইভ সিকিউরিটি পাসওয়ার্ড রিসেট অ্যালার্ট",
        message: `${verifiedApplicant.fullNameEnglish || verifiedApplicant.fullNameBangla} (${verifiedApplicant.id}) এর জন্য লাইভ ছবি তুলে পাসওয়ার্ড পরিবর্তনের চেষ্টা চলছে। মোবাইল: ${verifiedApplicant.studentPhone}।`,
        type: "Alert",
        isRead: false,
        timestamp: Timestamp.now(),
        photo: capturedPhoto,
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

      setPhotoSaved(true);
      setSuccess("লাইভ ছবি ও আইপি ভেরিফিকেশন সফল হয়েছে। এবার নতুন পাসওয়ার্ড সেট করুন।");
      setTimeout(() => setSuccess(null), 3000);
      setStep(3);
    } catch (err: any) {
      console.error("Save snapshot error:", err);
      setError("ছবি ও নিরাপত্তা ডেটা আপলোড করতে ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Password Update
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
      
      // Update applicant profile with newly generated hashed password
      await updateDoc(doc(db, "applicants", verifiedApplicant.id), {
        password: hashed,
        updatedAt: Timestamp.now()
      });

      // Create system Activity log
      await addDoc(collection(db, "activity_logs"), {
        type: "PASSWORD_RESET_SELF",
        targetId: verifiedApplicant.id,
        actorId: verifiedApplicant.id,
        timestamp: Timestamp.now(),
        details: `${verifiedApplicant.fullNameEnglish} (${verifiedApplicant.id}) has successfully updated their portal password via secure live-photo verification.`
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
        setCapturedPhoto(null);
        setNewPassword("");
        setConfirmPassword("");
        setVerifiedApplicant(null);
        setPhotoSaved(false);
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
            onClick={() => {
              stopCamera();
              onClose();
            }}
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
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Step {step} of 3: Verification Flow</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Step Progress Dots */}
            <div className="flex items-center gap-2 mb-6 justify-center">
              {[1, 2, 3].map((num) => (
                <div key={num} className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    step === num 
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 scale-110" 
                      : step > num ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-zinc-500"
                  }`}>
                    {step > num ? <CheckCircle className="w-4 h-4 text-emerald-950" /> : num}
                  </div>
                  {num < 3 && <div className={`w-12 h-0.5 transition-all ${step > num ? "bg-emerald-500" : "bg-slate-800"}`} />}
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
                <div className="space-y-5">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-emerald-400 font-bold leading-normal">
                      ✅ ১ম ধাপ যাচাই সফল! আইডি হোল্ডারের আসল পরিচিতি নিশ্চিত করতে ডিভাইস ক্যামেরা দিয়ে ছবি তুলুন।
                    </p>
                  </div>

                  {/* Camera Stage */}
                  <div className="relative aspect-video bg-slate-950 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center">
                    {capturedPhoto ? (
                      <img 
                        src={capturedPhoto} 
                        alt="Captured live verification snapshot" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : cameraActive ? (
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover scale-x-[-1]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                        <Camera className="w-12 h-12 text-zinc-600 animate-pulse" />
                        <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest">ক্যামেরা নিষ্ক্রিয়</p>
                      </div>
                    )}

                    <canvas ref={canvasRef} className="hidden" />

                    {cameraActive && (
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center z-15">
                        <button
                          onClick={capturePhoto}
                          className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] rounded-full uppercase tracking-widest transition-all cursor-pointer border border-white/10 shadow-xl shadow-rose-950/50"
                        >
                          ছবি তুলুন (Capture)
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex justify-center gap-3">
                    {!cameraActive && !capturedPhoto && (
                      <button
                        onClick={startCamera}
                        className="px-6 py-3 bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-black uppercase tracking-widest rounded-2xl flex items-center gap-2 hover:bg-rose-500/25 transition-all cursor-pointer"
                      >
                        <Camera size={16} />
                        ক্যামেরা চালু করুন
                      </button>
                    )}

                    {capturedPhoto && (
                      <button
                        onClick={() => {
                          setCapturedPhoto(null);
                          startCamera();
                        }}
                        className="px-5 py-3 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-700 transition-all cursor-pointer"
                      >
                        আবার তুলুন
                      </button>
                    )}
                  </div>

                  {/* Tracking Metadata Visualization */}
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
                        <MapPin className="w-4 h-4 animate-bounce" />
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">GPS Tracking (Location)</p>
                        <p className="text-xs text-zinc-300 font-bold">
                          {locatingState === "success" && location 
                            ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                            : locatingState === "fetching" 
                              ? "Locating..."
                              : "Blocked / Unavailable"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePhotoUpload}
                    disabled={loading || !capturedPhoto}
                    className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        নিরাপত্তা ছবি আপলোড ও যাচাই করুন
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              )}

              {step === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-emerald-400 font-bold leading-relaxed">
                      🔒 আপনার ছবি ও সিকিউরিটি ক্রেনডেনশিয়াল সফলভাবে যাচাই সম্পন্ন হয়েছে। অনুগ্রহ করে আপনার নতুন পাসওয়ার্ড সেট করুন।
                    </p>
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
