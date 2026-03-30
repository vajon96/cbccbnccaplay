import { useState, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, GraduationCap, Camera, CheckCircle, ArrowRight, ArrowLeft, Upload, Shield } from "lucide-react";
import { db, collection, setDoc, doc, Timestamp, handleFirestoreError, OperationType } from "../firebase";

export function EnrollmentForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    fatherName: "",
    motherName: "",
    dob: "",
    gender: "Male",
    bloodGroup: "A+",
    collegeId: "",
    class: "Class 11",
    roll: "",
    session: "2024-25",
    mobile: "",
    email: "",
    photo: ""
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg");
        setFormData({ ...formData, photo: photoData });
        
        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const id = `BNCC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const path = `applicants/${id}`;
    try {
      const applicantData = {
        ...formData,
        id,
        status: "Pending",
        attendanceStatus: "Absent",
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, "applicants", id), applicantData);
      navigate(`/admit-card/${id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "ব্যক্তিগত তথ্য", icon: User },
    { id: 2, title: "একাডেমিক তথ্য", icon: GraduationCap },
    { id: 3, title: "ছবি আপলোড", icon: Camera },
    { id: 4, title: "পর্যালোচনা", icon: CheckCircle }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-white mb-2">ক্যাডেট ভর্তি আবেদন ফরম</h1>
        <p className="text-slate-400">সঠিক তথ্য দিয়ে নিচের ধাপগুলো পূরণ করুন</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0" />
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              step >= s.id ? "bg-accent text-primary" : "bg-primary border border-white/10 text-slate-500"
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              step >= s.id ? "text-accent" : "text-slate-500"
            }`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-card p-8 md:p-12 rounded-[2rem]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">পূর্ণ নাম (বাংলায়/ইংরেজিতে)</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                  placeholder="আপনার নাম লিখুন"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">পিতার নাম</label>
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">মাতার নাম</label>
                <input
                  type="text"
                  name="motherName"
                  value={formData.motherName}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">জন্ম তারিখ</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">লিঙ্গ</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                >
                  <option value="Male">পুরুষ</option>
                  <option value="Female">মহিলা</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">রক্তের গ্রুপ</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                >
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">মোবাইল নম্বর (ঐচ্ছিক)</label>
                <input
                  type="tel"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">ইমেইল (ঐচ্ছিক)</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">কলেজ আইডি</label>
                <input
                  type="text"
                  name="collegeId"
                  value={formData.collegeId}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">শ্রেণি</label>
                <select
                  name="class"
                  value={formData.class}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                >
                  <option value="Class 11">একাদশ</option>
                  <option value="Class 12">দ্বাদশ</option>
                  <option value="Honors 1st Year">স্নাতক ১ম বর্ষ</option>
                  <option value="Honors 2nd Year">স্নাতক ২য় বর্ষ</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">রোল নম্বর</label>
                <input
                  type="text"
                  name="roll"
                  value={formData.roll}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300">সেশন</label>
                <input
                  type="text"
                  name="session"
                  value={formData.session}
                  onChange={handleChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none transition-colors"
                  placeholder="যেমন: ২০২৪-২৫"
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative w-64 h-64 rounded-3xl overflow-hidden glass border-2 border-dashed border-white/20 flex items-center justify-center">
                  {formData.photo ? (
                    <img src={formData.photo} className="w-full h-full object-cover" alt="Captured" />
                  ) : (
                    <div className="text-center p-4">
                      <Camera className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">ছবি তুলুন অথবা আপলোড করুন</p>
                    </div>
                  )}
                  <video ref={videoRef} autoPlay className={`absolute inset-0 w-full h-full object-cover ${formData.photo ? 'hidden' : 'block'}`} />
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 glass rounded-xl text-sm font-bold hover:bg-white/10"
                  >
                    ক্যামেরা চালু করুন
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-2 bg-accent text-primary rounded-xl text-sm font-bold hover:bg-white"
                  >
                    ছবি তুলুন
                  </button>
                  <label className="px-6 py-2 glass rounded-xl text-sm font-bold hover:bg-white/10 cursor-pointer">
                    আপলোড করুন
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-accent font-bold uppercase tracking-widest text-xs">ব্যক্তিগত তথ্য</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">নাম:</span> {formData.fullName}</p>
                    <p><span className="text-slate-500">পিতা:</span> {formData.fatherName}</p>
                    <p><span className="text-slate-500">মাতা:</span> {formData.motherName}</p>
                    <p><span className="text-slate-500">জন্ম তারিখ:</span> {formData.dob}</p>
                    <p><span className="text-slate-500">রক্তের গ্রুপ:</span> {formData.bloodGroup}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-accent font-bold uppercase tracking-widest text-xs">একাডেমিক তথ্য</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">আইডি:</span> {formData.collegeId}</p>
                    <p><span className="text-slate-500">শ্রেণি:</span> {formData.class}</p>
                    <p><span className="text-slate-500">রোল:</span> {formData.roll}</p>
                    <p><span className="text-slate-500">সেশন:</span> {formData.session}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-accent/5 rounded-xl border border-accent/20 flex items-start gap-3">
                <Shield className="w-5 h-5 text-accent shrink-0" />
                <p className="text-xs text-slate-400">আমি অঙ্গীকার করছি যে উপরে প্রদত্ত সকল তথ্য সত্য। কোনো তথ্য মিথ্যা প্রমাণিত হলে আমার আবেদন বাতিল বলে গণ্য হবে।</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-6 py-3 glass rounded-xl text-white font-bold hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" /> পূর্ববর্তী
            </button>
          )}
          <div className="ml-auto">
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-8 py-3 bg-accent text-primary rounded-xl font-bold hover:bg-white transition-all"
              >
                পরবর্তী <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-accent text-primary rounded-xl font-bold hover:bg-white transition-all disabled:opacity-50"
              >
                {loading ? "প্রসেসিং..." : "আবেদন জমা দিন"} <CheckCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
