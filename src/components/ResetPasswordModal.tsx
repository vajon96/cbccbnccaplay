import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, ShieldAlert, Key, CheckCircle, AlertCircle, 
  MapPin, Globe, Loader2, ArrowRight, Camera, Upload, 
  RotateCcw, Check, RefreshCw
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

  // Step 2: Photo Capture / Upload & Compression
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Background Geolocation & IP tracking for security audit trails
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [ipAddress, setIpAddress] = useState<string>("Retrieving...");
  const [locatingState, setLocatingState] = useState<"idle" | "fetching" | "success" | "denied">("idle");

  // Step 3: Password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Retrieve geolocation and IP in background when modal is open
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen]);

  // Handle Camera activation on Step 2
  useEffect(() => {
    if (isOpen && step === 2 && !photo) {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, step, photo]);

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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      let stream: MediaStream;
      try {
        // Strictly prioritize and force the front camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (err) {
        console.warn("Retrying camera with alternative constraints:", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
          });
        } catch (innerErr) {
          console.warn("Falling back to basic video stream:", innerErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.error("Video element play failed:", playErr);
        }
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error("Camera capture failed completely:", err);
      setError("ক্যামেরা অন করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ক্যামেরার পারমিশন দিন অথবা আপনার ডিভাইস ক্যামেরা সচল রাখুন।");
    }
  };

  // Automatic Image Compression and Optimization
  const compressAndSetPhoto = (dataUrl: string) => {
    setIsCompressing(true);
    setError(null);

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      try {
        const maxDim = 600; // Target resolution boundary for optimal file size
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback to original Base64 if 2D context isn't supported
          setPhoto(dataUrl);
          setIsCompressing(false);
          return;
        }

        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        // Optimize using JPEG quality 0.6 to significantly reduce storage consumption while preserving clarity
        const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.6);
        setPhoto(optimizedBase64);
        stopCamera();
      } catch (compressErr) {
        console.error("Compression failed:", compressErr);
        setPhoto(dataUrl); // fallback
      } finally {
        setIsCompressing(false);
      }
    };

    img.onerror = () => {
      setError("ছবিটি অপ্টিমাইজ করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      setIsCompressing(false);
    };
  };

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !cameraActive) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Mirror horizontally when capturing from front camera to preserve natural preview
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const capturedDataUrl = canvas.toDataURL("image/jpeg");
        compressAndSetPhoto(capturedDataUrl);
      }
    } catch (err) {
      console.error("Capture image failed:", err);
      setError("ছবি তুলতে ব্যর্থ হয়েছে। অনুগ্রহ করে ফাইল আপলোড অপশনটি ব্যবহার করুন।");
    }
  };

  // Handle uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("দয়া করে শুধুমাত্র ছবি (.jpg, .jpeg, .png) আপলোড করুন।");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        compressAndSetPhoto(event.target.result as string);
      }
    };
    reader.onerror = () => {
      setError("ফাইলটি পড়া সম্ভব হয়নি। পুনরায় চেষ্টা করুন।");
    };
    reader.readAsDataURL(file);
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
        setSuccess("১ম ধাপ তথ্য ভেরিফিকেশন সফল হয়েছে। এবার ২য় ধাপে আপনার লাইভ ভেরিফিকেশন ছবি দিন।");
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

  // Step 3: Password Update and Secure Logging
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!photo) {
      setError("নিরাপত্তার স্বার্থে লাইভ ভেরিফিকেশন ছবি প্রদান করা বাধ্যতামূলক।");
      setLoading(false);
      return;
    }

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

      // 2. Upload/Save Reset Event Log with optimized photo
      await setDoc(doc(db, "password_resets", resetId), {
        id: resetId,
        applicantId: verifiedApplicant.id,
        name: verifiedApplicant.fullNameEnglish || verifiedApplicant.fullNameBangla,
        mobile: verifiedApplicant.studentPhone,
        createdAt: Timestamp.now(),
        photo: photo,
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
        photo: photo,
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
        details: `${verifiedApplicant.fullNameEnglish} (${verifiedApplicant.id}) has successfully updated their portal password with live verification photo tracking.`
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
        setPhoto(null);
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
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Step {step} of 3: Verification Flow</p>
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
                <div className="space-y-4">
                  <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-rose-400 leading-relaxed font-bold">
                      📸 নিরাপত্তা নিশ্চিত করতে আপনার একটি লাইভ ছবি প্রদান করুন। এটি পাসওয়ার্ড পরিবর্তনের জন্য বাধ্যতামূলক।
                    </p>
                  </div>

                  {/* Camera Box */}
                  <div className="relative aspect-video bg-slate-950 rounded-[2rem] overflow-hidden border border-white/5 flex flex-col items-center justify-center">
                    {photo ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={photo} 
                          alt="Captured" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                        <div className="absolute top-3 left-3 bg-emerald-500/90 text-slate-950 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm shadow-lg">
                          <Check className="w-3.5 h-3.5" /> ছবি কম্প্রেস ও অপ্টিমাইজড
                        </div>
                      </div>
                    ) : (
                      <>
                        <video
                          ref={videoRef}
                          playsInline
                          muted
                          autoPlay
                          className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? "block" : "hidden"}`}
                        />
                        {!cameraActive && !isCompressing && (
                          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                            <Camera className="w-12 h-12 text-zinc-600 animate-pulse" />
                            <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest">ক্যামেরা নিষ্ক্রিয়</p>
                          </div>
                        )}
                        {isCompressing && (
                          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                            <RefreshCw className="w-10 h-10 text-rose-500 animate-spin" />
                            <p className="text-rose-400 text-[11px] font-black uppercase tracking-widest animate-pulse">ছবিটি কম্প্রেস ও অপ্টিমাইজ করা হচ্ছে...</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="flex gap-3">
                    {photo ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setTimeout(() => startCamera(), 100);
                        }}
                        className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/5"
                      >
                        <RotateCcw size={14} /> পুনরায় ছবি তুলুন
                      </button>
                    ) : (
                      <>
                        {cameraActive ? (
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-rose-600/15"
                          >
                            <Camera size={14} /> ছবি তুলুন (Capture)
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-zinc-300 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/5"
                          >
                            <Camera size={14} /> ক্যামেরা চালু করুন
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {/* Next Step Control */}
                  <button
                    type="button"
                    disabled={!photo || isCompressing}
                    onClick={() => {
                      if (photo) setStep(3);
                    }}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-rose-600 to-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-40 cursor-pointer"
                  >
                    পরবর্তী ধাপে যান
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {step === 3 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                    <p className="text-[11px] text-emerald-400 font-bold leading-relaxed">
                      🔒 আপনার ছবি ও সিকিউরিটি ভ্যালিডেশন সম্পন্ন হয়েছে। অনুগ্রহ করে আপনার নতুন পাসওয়ার্ড সেট করুন।
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
