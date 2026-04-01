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
    studyStatus: "এইচএসসি ১ম বর্ষ",
    subject: "",
    classRoll: "",
    section: "",
    session: "",
    emisId: "",
    collegeName: "Cox's Bazar City College",
    photo: ""
  });

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

  const compressImage = (base64Str: string, maxWidth = 800, maxHeight = 800): Promise<string> => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.7));
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
      };
      reader.readAsDataURL(file);
    }
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
      console.error("Submission error:", error);
      alert("আবেদন জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন অথবা আপনার ইন্টারনেট সংযোগ চেক করুন।");
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">ক্যাডেট ভর্তি আবেদন ফরম</h1>
        <p className="text-slate-500">সঠিক তথ্য দিয়ে নিচের ধাপগুলো পূরণ করুন</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
        {steps.map((s) => (
          <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              step >= s.id ? "bg-primary text-white" : "bg-slate-100 border border-slate-200 text-slate-400"
            }`}>
              <s.icon className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              step >= s.id ? "text-primary" : "text-slate-400"
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
                <label className="text-sm font-semibold text-slate-600">নিজের নাম (বাংলা - ইউনিকোড)</label>
                <input
                  type="text"
                  name="fullNameBangla"
                  value={formData.fullNameBangla}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                  placeholder="বাংলায় নাম লিখুন"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">নিজের নাম (English)</label>
                <input
                  type="text"
                  name="fullNameEnglish"
                  value={formData.fullNameEnglish}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                  placeholder="Name in English"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">পিতার নাম (বাংলা - ইউনিকোড)</label>
                <input
                  type="text"
                  name="fatherNameBangla"
                  value={formData.fatherNameBangla}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">পিতার নাম (English)</label>
                <input
                  type="text"
                  name="fatherNameEnglish"
                  value={formData.fatherNameEnglish}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">মাতার নাম (বাংলা - ইউনিকোড)</label>
                <input
                  type="text"
                  name="motherNameBangla"
                  value={formData.motherNameBangla}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">মাতার নাম (English)</label>
                <input
                  type="text"
                  name="motherNameEnglish"
                  value={formData.motherNameEnglish}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">জন্ম তারিখ</label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">NID / জন্ম নিবন্ধন নম্বর</label>
                <input
                  type="text"
                  name="nidBirthReg"
                  value={formData.nidBirthReg}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">লিঙ্গ (Gender)</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">ধর্ম (Religion)</label>
                <select
                  name="religion"
                  value={formData.religion}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                >
                  <option value="Islam">Islam</option>
                  <option value="Hinduism">Hinduism</option>
                  <option value="Buddhism">Buddhism</option>
                  <option value="Christianity">Christianity</option>
                  <option value="Others">Others</option>
                </select>
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
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-slate-600">বর্তমান ঠিকানা (গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা)</label>
                <textarea
                  name="presentAddress"
                  value={formData.presentAddress}
                  onChange={handleChange}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors resize-none"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-semibold text-slate-600">স্থায়ী ঠিকানা (গ্রাম/মহল্লা, ডাকঘর, থানা, জেলা)</label>
                <textarea
                  name="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={handleChange}
                  rows={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors resize-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">শিক্ষার্থীর মোবাইল নম্বর</label>
                <input
                  type="tel"
                  name="studentPhone"
                  value={formData.studentPhone}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">শিক্ষার্থীর ইমেইল (ঐচ্ছিক)</label>
                <input
                  type="email"
                  name="studentEmail"
                  value={formData.studentEmail}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">উচ্চতা (ফুট)</label>
                  <input
                    type="number"
                    name="heightFeet"
                    value={formData.heightFeet}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-600">ইঞ্চি</label>
                  <input
                    type="number"
                    name="heightInches"
                    value={formData.heightInches}
                    onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">ওজন (কেজি)</label>
                <input
                  type="number"
                  name="weightKg"
                  value={formData.weightKg}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">রক্তের গ্রুপ</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
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
              className="space-y-8"
            >
              <div className="space-y-4">
                <h3 className="text-primary font-bold text-sm uppercase tracking-wider">এসএসসি তথ্য</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">জিপিএ</label>
                    <input type="text" name="sscGpa" value={formData.sscGpa} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">বিভাগ</label>
                    <select name="sscGroup" value={formData.sscGroup} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary">
                      <option value="বিজ্ঞান">বিজ্ঞান</option>
                      <option value="মানবিক">মানবিক</option>
                      <option value="ব্যবসায় শিক্ষা">ব্যবসায় শিক্ষা</option>
                      <option value="টেকনিক্যাল">টেকনিক্যাল</option>
                      <option value="মাদ্রাসা">মাদ্রাসা</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">পাসের সন</label>
                    <input type="text" name="sscYear" value={formData.sscYear} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">বোর্ড</label>
                    <input type="text" name="sscBoard" value={formData.sscBoard} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-primary font-bold text-sm uppercase tracking-wider">এইচএসসি তথ্য (যদি থাকে)</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">জিপিএ</label>
                    <input type="text" name="hscGpa" value={formData.hscGpa} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">বিভাগ</label>
                    <select name="hscGroup" value={formData.hscGroup} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary">
                      <option value="বিজ্ঞান">বিজ্ঞান</option>
                      <option value="মানবিক">মানবিক</option>
                      <option value="ব্যবসায় শিক্ষা">ব্যবসায় শিক্ষা</option>
                      <option value="টেকনিক্যাল">টেকনিক্যাল</option>
                      <option value="মাদ্রাসা">মাদ্রাসা</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">পাসের সন</label>
                    <input type="text" name="hscYear" value={formData.hscYear} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500">বোর্ড</label>
                    <input type="text" name="hscBoard" value={formData.hscBoard} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-primary font-bold text-sm uppercase tracking-wider">বর্তমান পড়াশোনার তথ্য</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">বর্তমান শ্রেণি</label>
                    <select name="studyStatus" value={formData.studyStatus} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary">
                      {["এইচএসসি ১ম বর্ষ", "স্নাতক ১ম বর্ষ", "ডিগ্রি ১ম বর্ষ"].map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">বিষয়</label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">শ্রেণি রোল</label>
                    <input type="text" name="classRoll" value={formData.classRoll} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">শাখা (যদি থাকে)</label>
                    <input type="text" name="section" value={formData.section} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">সেশন</label>
                    <input type="text" name="session" value={formData.session} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary" placeholder="যেমন: ২০২৪-২৫" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-600">ইএমআইএস (EMIS) আইডি/পেমেন্ট ইউনিক কোড (যার মাধ্যমে কলেজে টাকা প্রদান করা হয়)</label>
                    <input type="text" name="emisId" value={formData.emisId} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 outline-none focus:border-primary" />
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
              className="space-y-8"
            >
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-600">কলেজের নাম</label>
                <input
                  type="text"
                  name="collegeName"
                  value={formData.collegeName}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:border-primary outline-none transition-colors"
                />
              </div>

              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="relative w-64 h-64 rounded-3xl overflow-hidden glass border-2 border-dashed border-slate-200 flex items-center justify-center">
                  {formData.photo ? (
                    <img src={formData.photo} className="w-full h-full object-cover" alt="Captured" />
                  ) : (
                    <div className="text-center p-4">
                      <Camera className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">ছবি তুলুন অথবা আপলোড করুন</p>
                    </div>
                  )}
                  <video ref={videoRef} autoPlay className={`absolute inset-0 w-full h-full object-cover ${formData.photo ? 'hidden' : 'block'}`} />
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={startCamera}
                    className="px-6 py-2 glass rounded-xl text-sm font-bold hover:bg-slate-100"
                  >
                    ক্যামেরা চালু করুন
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90"
                  >
                    ছবি তুলুন
                  </button>
                  <label className="px-6 py-2 glass rounded-xl text-sm font-bold hover:bg-slate-100 cursor-pointer">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-primary font-bold uppercase tracking-widest text-xs">ব্যক্তিগত তথ্য</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">নাম (বাংলা):</span> {formData.fullNameBangla}</p>
                    <p><span className="text-slate-500">নাম (English):</span> {formData.fullNameEnglish}</p>
                    <p><span className="text-slate-500">পিতা:</span> {formData.fatherNameEnglish}</p>
                    <p><span className="text-slate-500">মাতা:</span> {formData.motherNameEnglish}</p>
                    <p><span className="text-slate-500">জন্ম তারিখ:</span> {formData.dob}</p>
                    <p><span className="text-slate-500">লিঙ্গ:</span> {formData.gender}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-primary font-bold uppercase tracking-widest text-xs">একাডেমিক তথ্য</h3>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-slate-500">শ্রেণি:</span> {formData.studyStatus}</p>
                    <p><span className="text-slate-500">রোল:</span> {formData.classRoll}</p>
                    <p><span className="text-slate-500">সেশন:</span> {formData.session}</p>
                    <p><span className="text-slate-500">ইএমআইএস আইডি:</span> {formData.emisId}</p>
                    <p><span className="text-slate-500">কলেজ:</span> {formData.collegeName}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-start gap-3">
                <Shield className="w-5 h-5 text-primary shrink-0" />
                <p className="text-xs text-slate-500">আমি অঙ্গীকার করছি যে উপরে প্রদত্ত সকল তথ্য সত্য। কোনো তথ্য মিথ্যা প্রমাণিত হলে আমার আবেদন বাতিল বলে গণ্য হবে।</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-12 flex justify-between">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-6 py-3 glass rounded-xl text-slate-700 font-bold hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" /> পূর্ববর্তী
            </button>
          )}
          <div className="ml-auto">
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                পরবর্তী <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
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
