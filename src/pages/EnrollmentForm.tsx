import { useState, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, GraduationCap, Camera, CheckCircle, ArrowRight, ArrowLeft, Upload, Shield, Sparkles, BrainCircuit, BookOpen } from "lucide-react";
import { db, collection, setDoc, doc, Timestamp, handleFirestoreError, OperationType, addDoc } from "../firebase";
import { analyzeEnrollment, analyzePhoto } from "../services/geminiService";
import { generatePassword, hashPassword } from "../lib/auth";

export function EnrollmentForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [formData, setFormData] = useState({
    fullNameBangla: "",
    fullNameEnglish: "",
    fatherNameBangla: "",
    fatherNameEnglish: "",
    motherNameBangla: "",
    motherNameEnglish: "",
    dob: "",
    nidBirthReg: "",
    gender: "Male",
    religion: "Islam",
    presentAddress: "",
    permanentAddress: "",
    studentPhone: "",
    studentEmail: "",
    heightFeet: "",
    heightInches: "",
    weightKg: "",
    bloodGroup: "A+",
    sscGpa: "",
    sscGroup: "বিজ্ঞান",
    sscYear: "",
    sscBoard: "Chattogram",
    hscGpa: "",
    hscGroup: "বিজ্ঞান",
    hscYear: "",
    hscBoard: "Chattogram",
    hscOptionalSubject: "",
    studyStatus: "এইচএসসি ১ম বর্ষ",
    subject: "",
    classRoll: "",
    section: "",
    session: "",
    emisId: "",
    collegeName: "Cox's Bazar City College",
    photo: ""
  });

  const [aiPhotoFeedback, setAiPhotoFeedback] = useState("");
  const [aiFormFeedback, setAiFormFeedback] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const photoData = canvasRef.current.toDataURL("image/jpeg", 0.9);
        const compressedPhoto = await compressImage(photoData);
        setFormData({ ...formData, photo: compressedPhoto });
        
        // AI Photo Check
        setAiPhotoFeedback("AI analyzing photo...");
        const feedback = await analyzePhoto(compressedPhoto);
        setAiPhotoFeedback(feedback);

        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("ছবির সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedPhoto = await compressImage(reader.result as string);
        setFormData({ ...formData, photo: compressedPhoto });
        
        // AI Photo Check
        setAiPhotoFeedback("AI analyzing photo...");
        const feedback = await analyzePhoto(compressedPhoto);
        setAiPhotoFeedback(feedback);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAiReview = async () => {
    setIsAiAnalyzing(true);
    const feedback = await analyzeEnrollment(formData);
    setAiFormFeedback(feedback);
    setIsAiAnalyzing(false);
  };

  const handleSubmit = async () => {
    // Basic validation
    const requiredFields = [
      'fullNameBangla', 'fullNameEnglish', 'fatherNameBangla', 'fatherNameEnglish', 
      'motherNameBangla', 'motherNameEnglish', 'dob', 'nidBirthReg', 'gender', 
      'religion', 'presentAddress', 'permanentAddress', 'studentPhone', 
      'heightFeet', 'heightInches', 'weightKg', 'bloodGroup', 'sscGpa', 'sscGroup', 
      'sscYear', 'sscBoard', 'studyStatus', 'subject', 'classRoll', 'session', 
      'emisId', 'collegeName', 'photo'
    ];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      const fieldLabels: { [key: string]: string } = {
        fullNameBangla: "নিজের নাম (বাংলা)",
        fullNameEnglish: "নিজের নাম (English)",
        fatherNameBangla: "পিতার নাম (বাংলা)",
        fatherNameEnglish: "পিতার নাম (English)",
        motherNameBangla: "মাতার নাম (বাংলা)",
        motherNameEnglish: "মাতার নাম (English)",
        dob: "জন্ম তারিখ",
        nidBirthReg: "NID / জন্ম নিবন্ধন নম্বর",
        gender: "লিঙ্গ",
        religion: "ধর্ম",
        presentAddress: "বর্তমান ঠিকানা",
        permanentAddress: "স্থায়ী ঠিকানা",
        studentPhone: "মোবাইল নম্বর",
        heightFeet: "উচ্চতা (ফুট)",
        heightInches: "উচ্চতা (ইঞ্চি)",
        weightKg: "ওজন",
        bloodGroup: "রক্তের গ্রুপ",
        sscGpa: "এসএসসি জিপিএ",
        sscGroup: "এসএসসি বিভাগ",
        sscYear: "এসএসসি পাসের সন",
        sscBoard: "এসএসসি বোর্ড",
        studyStatus: "বর্তমান শ্রেণি",
        subject: "বিষয়",
        classRoll: "শ্রেণি রোল",
        session: "সেশন",
        emisId: "ইএমআইএস আইডি",
        collegeName: "কলেজের নাম",
        photo: "ছবি"
      };
      const missingLabels = missingFields.map(field => fieldLabels[field] || field).join(", ");
      alert(`অনুগ্রহ করে সকল প্রয়োজনীয় তথ্য এবং ছবি প্রদান করুন।\n\nবাকি আছে: ${missingLabels}`);
      return;
    }

    setLoading(true);
    const id = `BNCC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const rawPassword = generatePassword();
    const path = `applicants/${id}`;
    
    try {
      const hashedPassword = await hashPassword(rawPassword);
      const applicantData = {
        ...formData,
        id,
        password: hashedPassword,
        role: "user",
        status: "Pending",
        attendanceStatus: "Absent",
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, "applicants", id), applicantData);
      
      // Log the creation (wrapped in try-catch to prevent blocking submission)
      try {
        await addDoc(collection(db, "activity_logs"), {
          type: "ACCOUNT_CREATED",
          targetId: id,
          actorId: "SYSTEM",
          timestamp: Timestamp.now(),
          details: "New applicant account created via enrollment form"
        });
      } catch (logError) {
        console.error("Logging error:", logError);
        // Don't alert here, as the main submission succeeded
      }

      navigate(`/admit-card/${id}?pw=${encodeURIComponent(rawPassword)}`);
    } catch (error: any) {
      console.error("Submission error:", error);
      const errorMessage = error?.message || "Unknown error";
      alert(`আবেদন জমা দিতে সমস্যা হয়েছে।\nত্রুটি: ${errorMessage}\n\nঅনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা আপনার ইন্টারনেট সংযোগ চেক করুন।`);
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "ব্যক্তিগত তথ্য", icon: User },
    { id: 2, title: "যোগাযোগ ও শারীরিক", icon: User },
    { id: 3, title: "শিক্ষাগত ও বর্তমান", icon: GraduationCap },
    { id: 4, title: "ছবি ও কলেজ", icon: Camera },
    { id: 5, title: "পর্যালোচনা", icon: CheckCircle }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-black mb-2 font-display">ক্যাডেট ভর্তি আবেদন ফরম</h1>
        <p className="text-black/50">সঠিক তথ্য দিয়ে নিচের ধাপগুলো পূরণ করুন</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-sand -translate-y-1/2 z-0" />
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              step >= s.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white border border-sand text-black/30"
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              step >= s.id ? "text-primary" : "text-black/30"
            }`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(15,23,42,0.1)] border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8"
            >
              {[
                { label: "নিজের নাম (বাংলা - ইউনিকোড)", name: "fullNameBangla", placeholder: "বাংলায় নাম লিখুন" },
                { label: "নিজের নাম (English)", name: "fullNameEnglish", placeholder: "Name in English" },
                { label: "পিতার নাম (বাংলা - ইউনিকোড)", name: "fatherNameBangla", placeholder: "" },
                { label: "পিতার নাম (English)", name: "fatherNameEnglish", placeholder: "" },
                { label: "মাতার নাম (বাংলা - ইউনিকোড)", name: "motherNameBangla", placeholder: "" },
                { label: "মাতার নাম (English)", name: "motherNameEnglish", placeholder: "" },
              ].map((field) => (
                <div key={field.name} className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                  <input
                    type="text"
                    name={field.name}
                    value={formData[field.name as keyof typeof formData]}
                    onChange={handleChange}
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 placeholder:text-slate-300 shadow-sm"
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
              
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">জন্ম তারিখ</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                />
              </div>
              
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">NID / জন্ম নিবন্ধন নম্বর</label>
                <input
                  type="text"
                  name="nidBirthReg"
                  value={formData.nidBirthReg}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                />
              </div>

              {[
                { label: "লিঙ্গ (Gender)", name: "gender", options: ["Male", "Female", "Others"] },
                { label: "ধর্ম (Religion)", name: "religion", options: ["Islam", "Hinduism", "Buddhism", "Christianity", "Others"] },
              ].map((field) => (
                <div key={field.name} className="space-y-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                  <select
                    name={field.name}
                    value={formData[field.name as keyof typeof formData]}
                    onChange={handleChange}
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 cursor-pointer shadow-sm"
                  >
                    {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8"
            >
              {[
                { label: "বর্তমান ঠিকানা (গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা)", name: "presentAddress" },
                { label: "স্থায়ী ঠিকানা (গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা)", name: "permanentAddress" },
              ].map((field) => (
                <div key={field.name} className="md:col-span-2 space-y-2">
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                  <textarea
                    name={field.name}
                    value={formData[field.name as keyof typeof formData]}
                    onChange={handleChange}
                    rows={2}
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 resize-none shadow-sm"
                  />
                </div>
              ))}
              
              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">শিক্ষার্থীর মোবাইল নম্বর</label>
                <input
                  type="tel"
                  name="studentPhone"
                  value={formData.studentPhone}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">শিক্ষার্থীর ইমেইল (ঐচ্ছিক)</label>
                <input
                  type="email"
                  name="studentEmail"
                  value={formData.studentEmail}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "উচ্চতা (ফুট)", name: "heightFeet" },
                  { label: "ইঞ্চি", name: "heightInches" },
                ].map((field) => (
                  <div key={field.name} className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                    <input
                      type="number"
                      name={field.name}
                      value={formData[field.name as keyof typeof formData]}
                      onChange={handleChange}
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">ওজন (কেজি)</label>
                <input
                  type="number"
                  name="weightKg"
                  value={formData.weightKg}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">রক্তের গ্রুপ</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 cursor-pointer shadow-sm"
                >
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              {/* SSC Section Highlights */}
              <div className="group space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-slate-50">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-black font-extrabold text-lg tracking-tight">এসএসসি তথ্য</h3>
                    <p className="text-[10px] text-primary/60 font-bold uppercase tracking-widest leading-none mt-1">SSC Educational Details</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: "জিপিএ (GPA)", name: "sscGpa", placeholder: "5.00" },
                    { label: "বিভাগ (Group)", name: "sscGroup", type: "select", options: [
                      { val: "বিজ্ঞান", label: "বিজ্ঞান (Science)" },
                      { val: "মানবিক", label: "মানবিক (Humanities)" },
                      { val: "ব্যবসায় শিক্ষা", label: "ব্যবসায় শিক্ষা (Commerce)" },
                      { val: "টেকনিক্যাল", label: "টেকনিক্যাল" },
                      { val: "মাদ্রাসা", label: "মাদ্রাসা" }
                    ]},
                    { label: "পাসের সন (Year)", name: "sscYear", placeholder: "2022" },
                    { label: "বোর্ড (Board)", name: "sscBoard", placeholder: "Chattogram" }
                  ].map((field) => (
                    <div key={field.name} className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                      {field.type === "select" ? (
                        <select
                          name={field.name}
                          value={formData[field.name as keyof typeof formData]}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm"
                        >
                          {field.options?.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          name={field.name}
                          value={formData[field.name as keyof typeof formData]}
                          onChange={handleChange}
                          placeholder={field.placeholder}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-300 shadow-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* HSC Section Highlights */}
              <div className="group space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-slate-50">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-black font-extrabold text-lg tracking-tight">এইচএসসি তথ্য (ঐচ্ছিক)</h3>
                    <p className="text-[10px] text-accent/60 font-bold uppercase tracking-widest leading-none mt-1">HSC Optional Details</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {[
                    { label: "জিপিএ (GPA)", name: "hscGpa" },
                    { label: "বিভাগ (Group)", name: "hscGroup", type: "select", options: [
                      { val: "বিজ্ঞান", label: "বিজ্ঞান" },
                      { val: "মানবিক", label: "মানবিক" },
                      { val: "ব্যবসায় শিক্ষা", label: "ব্যবসায় শিক্ষা" },
                      { val: "টেকনিক্যাল", label: "টেকনিক্যাল" },
                      { val: "মাদ্রাসা", label: "মাদ্রাসা" }
                    ]},
                    { label: "পাসের সন (Year)", name: "hscYear" },
                    { label: "বোর্ড (Board)", name: "hscBoard" }
                  ].map((field) => (
                    <div key={field.name} className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">{field.label}</label>
                      {field.type === "select" ? (
                        <select
                          name={field.name}
                          value={formData[field.name as keyof typeof formData]}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-accent/50 outline-none transition-all shadow-sm"
                        >
                          {field.options?.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          name={field.name}
                          value={formData[field.name as keyof typeof formData]}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-accent/50 outline-none transition-all shadow-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Current Status Highlights */}
              <div className="group space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-slate-50">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-lg shadow-black/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-black font-extrabold text-lg tracking-tight">বর্তমান পড়াশোনার তথ্য</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Current Academic Status</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">বর্তমান শ্রেণি</label>
                    <select 
                      name="studyStatus" 
                      value={formData.studyStatus} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm"
                    >
                      {["এইচএসসি ১ম বর্ষ", "স্নাতক ১ম বর্ষ", "ডিগ্রি ১ম বর্ষ"].map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">বিষয়</label>
                    <input 
                      type="text" 
                      name="subject" 
                      value={formData.subject} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">শ্রেণি রোল</label>
                    <input 
                      type="text" 
                      name="classRoll" 
                      value={formData.classRoll} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">শাখা (যদি থাকে)</label>
                    <input 
                      type="text" 
                      name="section" 
                      value={formData.section} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">সেশন</label>
                    <input 
                      type="text" 
                      name="session" 
                      value={formData.session} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm" 
                      placeholder="যেমন: ২০২৪-২৫" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1 leading-tight">ইএমআইএস (EMIS) আইডি / পেমেন্ট ইউনিক কোড</label>
                    <input 
                      type="text" 
                      name="emisId" 
                      value={formData.emisId} 
                      onChange={handleChange} 
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm" 
                    />
                  </div>
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
              className="space-y-10"
            >
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">কলেজের নাম</label>
                <input
                  type="text"
                  name="collegeName"
                  value={formData.collegeName}
                  onChange={handleChange}
                  className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm"
                />
              </div>

              <div className="flex flex-col items-center justify-center space-y-8 bg-slate-50/50 p-10 rounded-[2rem] border-2 border-slate-100 border-dashed">
                <div className="relative w-72 h-72 rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-white flex items-center justify-center group">
                  {formData.photo ? (
                    <>
                      <img src={formData.photo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt="Captured" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Upload className="text-white w-10 h-10" />
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-8">
                      <Camera className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Capture Portrait</p>
                    </div>
                  )}
                  <video ref={videoRef} autoPlay className={`absolute inset-0 w-full h-full object-cover ${formData.photo ? 'hidden' : 'block'}`} />
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {aiPhotoFeedback && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 p-3 rounded-xl flex items-center gap-2 max-w-xs"
                  >
                    <Sparkles className="w-4 h-4 text-primary shrink-0" />
                    <p className="text-[10px] font-medium text-primary italic">{aiPhotoFeedback}</p>
                  </motion.div>
                )}

                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 bg-white border border-sand rounded-xl text-sm font-bold hover:bg-sand/10"
                  >
                    ক্যামেরা চালু করুন
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90"
                  >
                    ছবি তুলুন
                  </button>
                  <label className="px-6 py-2 bg-white border border-sand rounded-xl text-sm font-bold hover:bg-sand/10 cursor-pointer">
                    আপলোড করুন
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-primary/5 border border-primary/10 p-6 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BrainCircuit size={80} className="text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="text-primary" size={20} />
                    <h3 className="font-bold text-primary uppercase tracking-widest text-xs">AI Smart Review</h3>
                  </div>
                  
                  {!aiFormFeedback ? (
                    <button 
                      onClick={runAiReview}
                      disabled={isAiAnalyzing}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                      {isAiAnalyzing ? "Analyzing..." : "Run AI Analysis"}
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-black/80 leading-relaxed italic">"{aiFormFeedback}"</p>
                      <button 
                        onClick={() => setAiFormFeedback("")}
                        className="text-[10px] text-primary font-bold uppercase hover:underline"
                      >
                        Re-analyze
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-slate-800 font-extrabold uppercase tracking-tight text-xs">ব্যক্তিগত তথ্য</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">নাম (বাংলা)</span> <span className="text-slate-800 font-bold">{formData.fullNameBangla}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">নাম (English)</span> <span className="text-slate-800 font-bold">{formData.fullNameEnglish}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">পিতা</span> <span className="text-slate-800 font-bold">{formData.fatherNameEnglish}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">মাতা</span> <span className="text-slate-800 font-bold">{formData.motherNameEnglish}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">জন্ম তারিখ</span> <span className="text-slate-800 font-bold">{formData.dob}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">লিঙ্গ</span> <span className="text-slate-800 font-bold">{formData.gender}</span></p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="text-slate-800 font-extrabold uppercase tracking-tight text-xs">একাডেমিক তথ্য</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">শ্রেণি</span> <span className="text-slate-800 font-bold">{formData.studyStatus}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">রোল</span> <span className="text-slate-800 font-bold">{formData.classRoll}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">সেশন</span> <span className="text-slate-800 font-bold">{formData.session}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">কলেজ</span> <span className="text-slate-800 font-bold">{formData.collegeName}</span></p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-black/50">আমি অঙ্গীকার করছি যে উপরে প্রদত্ত সকল তথ্য সত্য। কোনো তথ্য মিথ্যা প্রমাণিত হলে আমার আবেদন বাতিল বলে গণ্য হবে।</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-16 flex justify-between items-center bg-slate-50 -mx-8 -mb-12 p-8 md:p-12 border-t-2 border-slate-100">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" /> পূর্ববর্তী
            </button>
          )}
          <div className="ml-auto">
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-3 px-10 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 group"
              >
                পরবর্তী <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-3 px-12 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 shadow-xl shadow-accent/20 active:scale-95"
              >
                {loading ? "প্রসেসিং..." : "আবেদন জমা দিন"} <CheckCircle className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
