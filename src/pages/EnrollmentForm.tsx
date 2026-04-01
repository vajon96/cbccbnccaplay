import { useState, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, GraduationCap, Camera, CheckCircle, ArrowRight, ArrowLeft, Upload, Shield, Info, FileText, Activity, MapPin } from "lucide-react";
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
        
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB.");
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
      alert(`Please provide all required information and photo.`);
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
      alert("Submission failed. Please check your connection.");
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: "Identity", icon: User },
    { id: 2, title: "Physical", icon: Activity },
    { id: 3, title: "Academic", icon: GraduationCap },
    { id: 4, title: "Credentials", icon: Camera },
    { id: 5, title: "Review", icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Header Banner */}
      <div className="bg-ink py-16 mb-12 border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Shield className="text-primary" size={24} />
            <span className="micro-label !text-white/60">Official Enrollment Portal</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">Cadet Application</h1>
          <p className="text-white/40 font-light max-w-2xl mx-auto">Please provide accurate information for your official BNCC enrollment record. All data is securely processed.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-16 relative">
          <div className="absolute top-1/2 left-0 w-full h-px bg-ink/5 -translate-y-1/2 z-0" />
          {steps.map((s) => (
            <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-sm flex items-center justify-center transition-all duration-500 ${
                step >= s.id ? "bg-primary text-white shadow-lg shadow-primary/20 scale-110" : "bg-white border border-ink/5 text-ink/20"
              }`}>
                <s.icon size={20} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-500 ${
                step >= s.id ? "text-primary" : "text-ink/20"
              }`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        <div className="glass-card p-8 md:p-12 rounded-sm border-l-4 border-primary">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <User className="text-primary" size={20} />
                  <h3 className="text-xl font-black uppercase tracking-tight">Personal Identity</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { label: "Full Name (English)", name: "fullNameEnglish", placeholder: "JOHN DOE" },
                    { label: "Full Name (Bangla)", name: "fullNameBangla", placeholder: "জন ডো" },
                    { label: "Father's Name (English)", name: "fatherNameEnglish", placeholder: "FATHER NAME" },
                    { label: "Father's Name (Bangla)", name: "fatherNameBangla", placeholder: "পিতার নাম" },
                    { label: "Mother's Name (English)", name: "motherNameEnglish", placeholder: "MOTHER NAME" },
                    { label: "Mother's Name (Bangla)", name: "motherNameBangla", placeholder: "মাতার নাম" },
                  ].map((field) => (
                    <div key={field.name} className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">{field.label}</label>
                      <input
                        type="text"
                        name={field.name}
                        value={formData[field.name as keyof typeof formData]}
                        onChange={handleChange}
                        className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-ink/20"
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Date of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">NID / Birth Reg</label>
                    <input
                      type="text"
                      name="nidBirthReg"
                      value={formData.nidBirthReg}
                      onChange={handleChange}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="text-primary" size={20} />
                  <h3 className="text-xl font-black uppercase tracking-tight">Physical & Contact</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Mobile Number</label>
                    <input
                      type="tel"
                      name="studentPhone"
                      value={formData.studentPhone}
                      onChange={handleChange}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Email Address</label>
                    <input
                      type="email"
                      name="studentEmail"
                      value={formData.studentEmail}
                      onChange={handleChange}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Height (Feet)</label>
                      <input
                        type="number"
                        name="heightFeet"
                        value={formData.heightFeet}
                        onChange={handleChange}
                        className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Inches</label>
                      <input
                        type="number"
                        name="heightInches"
                        value={formData.heightInches}
                        onChange={handleChange}
                        className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Weight (KG)</label>
                    <input
                      type="number"
                      name="weightKg"
                      value={formData.weightKg}
                      onChange={handleChange}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Present Address</label>
                    <textarea
                      name="presentAddress"
                      value={formData.presentAddress}
                      onChange={handleChange}
                      rows={2}
                      className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <GraduationCap className="text-primary" size={20} />
                  <h3 className="text-xl font-black uppercase tracking-tight">Academic Records</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Current Class</label>
                    <select name="studyStatus" value={formData.studyStatus} onChange={handleChange} className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all">
                      {["এইচএসসি ১ম বর্ষ", "স্নাতক ১ম বর্ষ", "ডিগ্রি ১ম বর্ষ"].map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Subject / Group</label>
                    <input type="text" name="subject" value={formData.subject} onChange={handleChange} className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Class Roll</label>
                    <input type="text" name="classRoll" value={formData.classRoll} onChange={handleChange} className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">Session</label>
                    <input type="text" name="session" value={formData.session} onChange={handleChange} className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all" placeholder="2024-25" />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink/40">EMIS ID / Payment Code</label>
                    <input type="text" name="emisId" value={formData.emisId} onChange={handleChange} className="w-full bg-ink/5 border-b-2 border-ink/10 px-4 py-3 text-sm font-bold focus:border-primary outline-none transition-all" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Camera className="text-primary" size={20} />
                  <h3 className="text-xl font-black uppercase tracking-tight">Official Credentials</h3>
                </div>
                
                <div className="flex flex-col items-center justify-center space-y-8">
                  <div className="relative w-72 h-72 rounded-sm overflow-hidden bg-ink/5 border-2 border-dashed border-ink/10 flex items-center justify-center">
                    {formData.photo ? (
                      <img src={formData.photo} className="w-full h-full object-cover" alt="Captured" />
                    ) : (
                      <div className="text-center p-8 space-y-4">
                        <Camera className="w-12 h-12 text-ink/10 mx-auto" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-ink/20">Live Capture Required</p>
                      </div>
                    )}
                    <video ref={videoRef} autoPlay className={`absolute inset-0 w-full h-full object-cover ${formData.photo ? 'hidden' : 'block'}`} />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>

                  <div className="flex flex-wrap justify-center gap-4">
                    <button
                      onClick={startCamera}
                      className="px-6 py-3 border border-ink/10 text-ink/60 font-black uppercase tracking-widest text-[10px] rounded-sm hover:bg-ink hover:text-white transition-all"
                    >
                      Initialize Camera
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="px-6 py-3 bg-primary text-white font-black uppercase tracking-widest text-[10px] rounded-sm btn-hover"
                    >
                      Capture Frame
                    </button>
                    <label className="px-6 py-3 border border-ink/10 text-ink/60 font-black uppercase tracking-widest text-[10px] rounded-sm hover:bg-ink hover:text-white transition-all cursor-pointer">
                      Manual Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="text-primary" size={20} />
                  <h3 className="text-xl font-black uppercase tracking-tight">Final Review</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="w-32 h-40 bg-ink/5 border border-ink/10 rounded-sm overflow-hidden">
                      {formData.photo && <img src={formData.photo} className="w-full h-full object-cover" alt="Review" />}
                    </div>
                    <div className="space-y-4">
                      <h4 className="micro-label">Identity Summary</h4>
                      <div className="space-y-2">
                        <p className="text-sm font-bold">{formData.fullNameEnglish}</p>
                        <p className="text-xs text-ink/40 font-medium tracking-tight">ID: {formData.nidBirthReg}</p>
                        <p className="text-xs text-ink/40 font-medium tracking-tight">DOB: {formData.dob}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="micro-label">Academic Summary</h4>
                      <div className="space-y-2">
                        <p className="text-sm font-bold">{formData.studyStatus}</p>
                        <p className="text-xs text-ink/40 font-medium tracking-tight">Roll: {formData.classRoll}</p>
                        <p className="text-xs text-ink/40 font-medium tracking-tight">Subject: {formData.subject}</p>
                      </div>
                    </div>
                    <div className="p-6 bg-primary/5 border border-primary/10 space-y-3">
                      <div className="flex items-center gap-2 text-primary">
                        <Shield size={16} />
                        <span className="font-black uppercase text-[10px] tracking-widest">Declaration</span>
                      </div>
                      <p className="text-[10px] text-ink/60 leading-relaxed font-medium italic">
                        I hereby declare that the information provided is true and accurate to the best of my knowledge. Any false information may lead to disqualification.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-16 pt-8 border-t border-ink/5 flex justify-between">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-3 px-8 py-4 border border-ink/10 text-ink/60 font-black uppercase tracking-widest text-xs rounded-sm hover:bg-ink hover:text-white transition-all"
              >
                <ArrowLeft size={18} /> Back
              </button>
            )}
            <div className="ml-auto">
              {step < 5 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-3 px-10 py-4 bg-ink text-white font-black uppercase tracking-widest text-xs rounded-sm btn-hover"
                >
                  Continue <ArrowRight size={18} />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex items-center gap-3 px-10 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-sm btn-hover disabled:opacity-50"
                >
                  {loading ? "Processing..." : "Submit Application"} <CheckCircle size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
