import { useState, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { User, GraduationCap, Camera, CheckCircle, ArrowRight, ArrowLeft, Upload, Shield, Sparkles, BrainCircuit, BookOpen, AlertCircle, Lock, FileText, Trash2 } from "lucide-react";
import { auth, db, collection, setDoc, updateDoc, doc, Timestamp, serverTimestamp, reportFirestoreListenerError, OperationType, addDoc, runTransaction } from "../firebase";
import { analyzeEnrollment, analyzePhoto } from "../services/geminiService";
import { generatePassword, hashPassword, setSession, syncServerSession, getSession } from "../lib/auth";
import { isAdminRole } from "../lib/rbac";
import { useCMS } from "../context/CMSContext";
import { apiFetch } from "../lib/api";

export function EnrollmentForm() {
  const { settings: cmsSettings, loading: cmsLoading } = useCMS();
  const [adminPreviewAnyway, setAdminPreviewAnyway] = useState(false);
  const currentSession = getSession();
  const isAdminSession = Boolean(currentSession && isAdminRole(currentSession.role));
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    photo: "",
    previousBNCC: false,
    isEthnicMinority: false,
    previousInstitution: "",
    previousBattalionRegiment: "",
    previousRank: "Cadet",
    previousRankOther: "",
    serviceDuration: "",
    registrationNumber: "",
    coCurricularActivities: [] as string[],
    otherCoCurricularActivity: "",
    uploadedDocuments: [] as Array<{ name: string; type: string; size: number; dataUrl: string }>
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
      console.warn("Camera access note:", err);
    }
  };

  const compressImage = (base64Str: string, maxWidth = 520, maxHeight = 520): Promise<string> => {
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
        resolve(canvas.toDataURL('image/jpeg', 0.65));
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
        if (compressedPhoto.length > 350000) {
          setSubmitError("কম্প্রেস করার পরও ছবির আকার বেশি; অনুগ্রহ করে আবার ছবি তুলুন বা ছোট ছবি আপলোড করুন।");
          return;
        }
        setSubmitError(null);
        setFormData({ ...formData, photo: compressedPhoto });
        
        // AI Photo Check
        setAiPhotoFeedback("AI analyzing photo...");
        const feedback = await analyzePhoto(compressedPhoto);
        setAiPhotoFeedback(feedback);

        // Stop camera
        const stream = videoRef.current.srcObject as MediaStream | null;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setSubmitError("শুধুমাত্র JPG, PNG অথবা WEBP ছবি আপলোড করুন।");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError("ছবির সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।");
        return;
      }
      setSubmitError(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressedPhoto = await compressImage(reader.result as string);
        if (compressedPhoto.length > 350000) {
          setSubmitError("কম্প্রেস করার পরও ছবির আকার বেশি; অনুগ্রহ করে ছোট ছবি নির্বাচন করুন।");
          return;
        }
        setFormData({ ...formData, photo: compressedPhoto });
        
        // AI Photo Check
        setAiPhotoFeedback("AI analyzing photo...");
        const feedback = await analyzePhoto(compressedPhoto);
        setAiPhotoFeedback(feedback);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSupportingDocUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setSubmitError("ডকুমেন্টের জন্য শুধুমাত্র JPG, PNG, WEBP অথবা PDF ফাইল আপলোড করুন।");
      return;
    }
    if (formData.uploadedDocuments.length >= 3) {
      setSubmitError("সর্বোচ্চ ৩টি সহায়ক ডকুমেন্ট সংযুক্ত করা যাবে।");
      return;
    }
    setSubmitError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      let dataUrl = String(reader.result || "");
      if (file.type.startsWith("image/")) {
        dataUrl = await compressImage(dataUrl, 900, 900);
      }
      if (dataUrl.length > 260000) {
        setSubmitError("ফাইলটির আকার খুব বেশি (সর্বোচ্চ ~২০০ কেবি)। অনুগ্রহ করে ছোট ছবি বা সংকুচিত PDF দিন।");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        uploadedDocuments: [
          ...prev.uploadedDocuments,
          { name: file.name, type: file.type, size: dataUrl.length, dataUrl },
        ],
      }));
    };
    reader.readAsDataURL(file);
  };

  const runAiReview = async () => {
    setIsAiAnalyzing(true);
    const feedback = await analyzeEnrollment(formData);
    setAiFormFeedback(feedback);
    setIsAiAnalyzing(false);
  };

  const handleSubmit = async () => {
    if (loading) return;
    setSubmitError(null);
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
      setSubmitError(`অনুগ্রহ করে সকল প্রয়োজনীয় তথ্য এবং ছবি প্রদান করুন। বাকি আছে: ${missingLabels}`);
      return;
    }

    if (formData.studentPhone.trim().length < 6) {
      setSubmitError("অনুগ্রহ করে কমপক্ষে ৬ সংখ্যার সঠিক মোবাইল নম্বর প্রদান করুন।");
      return;
    }

    if (formData.photo.length > 480000) {
      setSubmitError("ছবির আকার সীমার চেয়ে বেশি। অনুগ্রহ করে পুনরায় ছবি আপলোড করুন।");
      return;
    }

    setLoading(true);
    try {
      const hasFirebaseUser = Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
      const ownerUid = hasFirebaseUser && auth.currentUser ? auth.currentUser.uid : "public_applicant";

      const generateFallbackUniqueId = () =>
        `CBCC-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

      let id = "";
      try {
        // Sequential ID Generation starting from 1111
        id = await runTransaction(db, async (transaction) => {
          const counterDocRef = doc(db, "counters", "applicant_id");
          const counterDoc = await transaction.get(counterDocRef);

          let nextId = 1111;
          if (counterDoc.exists()) {
            nextId = (counterDoc.data().currentId || 1110) + 1;
            transaction.update(counterDocRef, { currentId: nextId });
          } else {
            transaction.set(counterDocRef, { currentId: nextId });
          }
          return nextId.toString();
        });
      } catch (counterErr) {
        reportFirestoreListenerError(counterErr, OperationType.WRITE, "counters/applicant_id");
        id = generateFallbackUniqueId();
      }

      const rawPassword = generatePassword();
      const hashedPassword = await hashPassword(rawPassword);
      const createdAtIso = new Date().toISOString();

      const buildApplicantPayload = (targetId: string, useServerTs: boolean) => {
        const rawDocs = Array.isArray(formData.uploadedDocuments) ? formData.uploadedDocuments : [];
        const approxTotalLen =
          (formData.photo?.length || 0) +
          rawDocs.reduce((acc, d) => acc + (d.dataUrl?.length || 0), 0);
        const safeFirestoreDocs =
          approxTotalLen > 650000
            ? rawDocs.map((d) => ({
                name: d.name,
                type: d.type,
                size: d.size,
                storedOnServer: true,
              }))
            : rawDocs;

        return {
          ...formData,
          uploadedDocuments: safeFirestoreDocs,
          id: targetId,
          registrationNumber: formData.registrationNumber.trim() || targetId,
          ownerUid,
          studentEmail: formData.studentEmail.trim() || (hasFirebaseUser ? auth.currentUser?.email || "" : ""),
          passwordHash: hashedPassword,
          role: "user",
          status: "Pending",
          isActive: true,
          accountStatus: "Active",
          attendanceStatus: "Absent",
          createdAtIso,
          createdAt: useServerTs ? serverTimestamp() : Timestamp.now(),
        };
      };

      let firestoreSaved = false;
      let lastFirestoreError: any = null;

      try {
        await setDoc(doc(db, "applicants", id), buildApplicantPayload(id, true));
        firestoreSaved = true;
      } catch (firstWriteErr: any) {
        lastFirestoreError = firstWriteErr;
        // Counter might have collided with an existing legacy applicant ID -> retry once with guaranteed unique ID
        const retryId = generateFallbackUniqueId();
        try {
          await setDoc(doc(db, "applicants", retryId), buildApplicantPayload(retryId, true));
          id = retryId;
          firestoreSaved = true;
          lastFirestoreError = null;
        } catch (retryErr: any) {
          lastFirestoreError = retryErr;
          reportFirestoreListenerError(retryErr, OperationType.WRITE, `applicants/${retryId}`);
        }
      }

      // Mirror / fallback persistence on Express registry so credential-only admins also see every submission immediately
      let serverSaved = false;
      let serverErrorMsg = "";
      try {
        const serverPayload = {
          ...formData,
          id,
          registrationNumber: formData.registrationNumber.trim() || id,
          ownerUid,
          studentEmail: formData.studentEmail.trim() || (hasFirebaseUser ? auth.currentUser?.email || "" : ""),
          passwordHash: hashedPassword,
          createdAtIso,
          firestoreSynced: firestoreSaved,
        };
        const apiRes = await apiFetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(serverPayload),
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (!firestoreSaved && data?.application?.id) {
            id = data.application.id;
          }
          serverSaved = true;
        } else {
          const errData = await apiRes.json().catch(() => ({}));
          serverErrorMsg = errData?.error || `Server status ${apiRes.status}`;
        }
      } catch (netErr: any) {
        serverErrorMsg = netErr?.message || "Network unavailable";
      }

      if (!firestoreSaved && !serverSaved) {
        const reason = lastFirestoreError?.message || serverErrorMsg || "ডাটাবেজ সংযোগ বিচ্ছিন্ন রয়েছে।";
        setSubmitError(`আবেদন জমা দেওয়া যায়নি! অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করুন। (${reason})`);
        return;
      }

      // Non-PII public QR card projection, structured admission tracking record, and UID profile link
      if (firestoreSaved) {
        const regNumber = formData.registrationNumber.trim() || id;

        await setDoc(doc(db, "public_qr_cards", id), {
          id,
          cadetId: id,
          registrationNumber: regNumber,
          session: formData.session,
          ownerUid,
          fullNameEnglish: formData.fullNameEnglish,
          fullNameBangla: formData.fullNameBangla,
          studyStatus: formData.studyStatus,
          collegeName: formData.collegeName,
          platoonName: "Cox's Bazar City College BNCC Platoon",
          status: "Pending",
          isValidCadet: false,
          photo: formData.photo || "",
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        await setDoc(doc(db, "admissions", id), {
          id,
          applicantId: id,
          registrationNumber: regNumber,
          ownerUid,
          fullNameEnglish: formData.fullNameEnglish,
          fullNameBangla: formData.fullNameBangla,
          session: formData.session,
          studyStatus: formData.studyStatus,
          admissionStatus: "Pending",
          createdAtIso,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        if (hasFirebaseUser) {
          await updateDoc(doc(db, "users", ownerUid), {
            applicantId: id,
            registrationNumber: regNumber,
            updatedAt: serverTimestamp(),
          }).catch(() => {});

          await addDoc(collection(db, "activity_logs"), {
            type: "ACCOUNT_CREATED",
            targetId: id,
            actorId: ownerUid,
            ownerUid,
            timestamp: serverTimestamp(),
            details: "New applicant submitted via enrollment form",
          }).catch(() => {});
        }
      }

      const applicantEmail =
        formData.studentEmail.trim() || (hasFirebaseUser ? auth.currentUser?.email || "" : "");

      const sessionUser = {
        id,
        applicantId: id,
        ...(hasFirebaseUser ? { uid: ownerUid } : {}),
        email: applicantEmail || undefined,
        name: formData.fullNameEnglish || formData.fullNameBangla,
        role: "user" as const,
        registrationNumber: id,
        authSource: (hasFirebaseUser ? "firebase" : "credential") as "firebase" | "credential",
      };
      setSession(sessionUser);
      await syncServerSession(sessionUser);

      const previewApplicant = {
        ...formData,
        id,
        registrationNumber: formData.registrationNumber.trim() || id,
        ownerUid,
        studentEmail: applicantEmail,
        role: "user",
        status: "Pending",
        attendanceStatus: "Absent",
        createdAtIso,
      };
      try {
        sessionStorage.setItem(`bncc_admit_preview_${id}`, JSON.stringify(previewApplicant));
      } catch {
        // Ignore storage quota errors if photo is large; router state still carries it
      }

      navigate(`/admit-card/${id}`, {
        state: {
          generatedPassword: rawPassword,
          applicantData: previewApplicant,
          submittedJustNow: true,
        },
      });
    } catch (error: any) {
      console.error("Submission error:", error);
      setSubmitError(`আবেদন জমা দিতে সমস্যা হয়েছে: ${error?.message || "অনুগ্রহ করে পুনরায় চেষ্টা করুন।"}`);
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

  if (!cmsLoading && cmsSettings.enrollmentOpen === false && !adminPreviewAnyway) {
    return (
      <div className="min-h-[75vh] bg-[#F5F7FA] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#002147] text-[#C5A059] flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Admission Status
            </p>
            <h1 className="text-2xl font-black text-[#002147] font-display">
              অনলাইন ক্যাডেট ভর্তি বর্তমানে বন্ধ রয়েছে
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের নতুন ক্যাডেট অনলাইন ভর্তি আবেদন সাময়িকভাবে স্থগিত করা হয়েছে। পরবর্তী ভর্তি বিজ্ঞপ্তির জন্য নোটিশ বোর্ড দেখুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-5 py-2.5 bg-[#002147] text-white text-xs font-bold rounded-xl hover:bg-[#003366] transition-colors"
            >
              হোমপেজে ফিরে যান
            </Link>
            <Link
              to="/notices"
              className="px-5 py-2.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              নোটিশ বোর্ড
            </Link>
            {isAdminSession && (
              <button
                type="button"
                onClick={() => setAdminPreviewAnyway(true)}
                className="px-5 py-2.5 bg-[#C5A059] text-[#002147] text-xs font-black rounded-xl hover:bg-[#b59048] transition-colors cursor-pointer"
              >
                Admin Preview Form
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[#002147] mb-2 font-display">ক্যাডেট ভর্তি আবেদন ফরম</h1>
        <p className="text-slate-600">সঠিক তথ্য দিয়ে নিচের ধাপগুলো পূরণ করুন</p>
      </div>

      {submitError && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm font-semibold flex items-start gap-2.5">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{submitError}</span>
        </div>
      )}

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
            <span className={`text-[10px] font-bold uppercase tracking-wider hidden md:block ${
              step >= s.id ? "text-primary" : "text-black/30"
            }`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile Step Indicator */}
      <div className="md:hidden text-center mb-6">
        <p className="text-xs font-black uppercase text-primary tracking-widest bg-primary/10 py-2.5 px-4 rounded-xl inline-block">
          ধাপ {step} / ৫: {steps[step - 1].title}
        </p>
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
                    value={formData[field.name as keyof typeof formData] as string}
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
                    value={formData[field.name as keyof typeof formData] as string}
                    onChange={handleChange}
                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none transition-all duration-200 cursor-pointer shadow-sm"
                  >
                    {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}

              <div className="space-y-2 md:col-span-2">
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">আপনি কি নৃতাত্ত্বিক (ক্ষুদ্র) জনগোষ্ঠীর সদস্য?</label>
                <div className="flex gap-4">
                  {[
                    { label: "হ্যাঁ", value: true },
                    { label: "না", value: false }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, isEthnicMinority: opt.value })}
                      className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 border-2 ${
                        formData.isEthnicMinority === opt.value
                          ? "bg-primary text-white border-primary shadow-md shadow-primary/10"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
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
                    value={formData[field.name as keyof typeof formData] as string}
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
                      value={formData[field.name as keyof typeof formData] as any}
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
                          value={formData[field.name as keyof typeof formData] as string}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-primary/50 outline-none transition-all shadow-sm"
                        >
                          {field.options?.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          name={field.name}
                          value={formData[field.name as keyof typeof formData] as string}
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
                          value={formData[field.name as keyof typeof formData] as string}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 font-bold focus:border-accent/50 outline-none transition-all shadow-sm"
                        >
                          {field.options?.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          name={field.name}
                          value={formData[field.name as keyof typeof formData] as string}
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

              {/* Previous BNCC Experience Section */}
              <div className="group space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-slate-50">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/20">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-black font-extrabold text-lg tracking-tight">পূর্ববর্তী বিএনসিসি অভিজ্ঞতা (Previous BNCC Experience)</h3>
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest leading-none mt-1">Previous BNCC History</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">আপনি কি পূর্বে বিএনসিসি ক্যাডেট ছিলেন? (Have you previously been a BNCC Cadet?)</label>
                    <div className="flex gap-4">
                      {[
                        { label: "হ্যাঁ (Yes)", value: true },
                        { label: "না (No)", value: false }
                      ].map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setFormData({ ...formData, previousBNCC: opt.value })}
                          className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 border-2 ${
                            formData.previousBNCC === opt.value
                              ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/10"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {formData.previousBNCC && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/60"
                    >
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">পূর্ববর্তী শিক্ষাপ্রতিষ্ঠানের নাম (Institution Name)</label>
                        <input
                          type="text"
                          name="previousInstitution"
                          value={formData.previousInstitution}
                          onChange={handleChange}
                          placeholder="স্কুল/কলেজের নাম"
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">ব্যাটালিয়ন / রেজিমেন্ট (Battalion/Regiment - Optional)</label>
                        <input
                          type="text"
                          name="previousBattalionRegiment"
                          value={formData.previousBattalionRegiment}
                          onChange={handleChange}
                          placeholder="যেমন- কর্ণফুলী রেজিমেন্ট"
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">পূর্ববর্তী পদবি (Previous Rank/Position)</label>
                        <select
                          name="previousRank"
                          value={formData.previousRank}
                          onChange={handleChange}
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                        >
                          {["Cadet", "Lance Corporal", "Corporal", "Sergeant", "Under Officer", "Cadet Captain", "Other"].map((rank) => (
                            <option key={rank} value={rank}>{rank}</option>
                          ))}
                        </select>
                      </div>

                      {formData.previousRank === "Other" && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">অন্যান্য পদবি লিখুন (Specify Rank)</label>
                          <input
                            type="text"
                            name="previousRankOther"
                            value={formData.previousRankOther}
                            onChange={handleChange}
                            placeholder="Specify Other Rank"
                            className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">বিএনসিসি সেবাকাল (Service Duration)</label>
                        <input
                          type="text"
                          name="serviceDuration"
                          value={formData.serviceDuration}
                          onChange={handleChange}
                          placeholder="যেমন- ১ বছর / ২ বছর"
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">বিএনসিসি রেজিস্ট্রেশন নম্বর (Registration No. - Optional)</label>
                        <input
                          type="text"
                          name="registrationNumber"
                          value={formData.registrationNumber}
                          onChange={handleChange}
                          placeholder="যদি থাকে"
                          className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-rose-500 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Co-Curricular Activities Section */}
              <div className="group space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-slate-50">
                <div className="flex items-center gap-4 border-b border-slate-200 pb-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-black font-extrabold text-lg tracking-tight">সহ-শিক্ষা কার্যক্রম (Co-Curricular Activities)</h3>
                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest leading-none mt-1">Select and check all that apply to you</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-2 border border-slate-100 rounded-xl bg-white/70">
                    {[
                      "Debate", "Public Speaking", "Scouting", "Rover Scouting", "Red Crescent",
                      "Cultural Activities", "Singing", "Music", "Dance", "Acting", "Photography",
                      "Videography", "Graphic Design", "Sports", "Football", "Cricket", "Volleyball",
                      "Basketball", "Badminton", "Athletics", "Martial Arts", "Karate", "Taekwondo",
                      "Swimming", "Hiking", "Mountaineering", "Social Work", "Volunteering",
                      "Community Service", "Blood Donation Activities", "Disaster Management",
                      "First Aid Training", "Leadership Programs", "Event Management", "Anchoring",
                      "Content Creation", "Journalism", "Computer Skills", "Programming", "Robotics",
                      "Science Club", "Language Club", "Environmental Activities", "Youth Development Programs"
                    ].map((activity) => {
                      const isSelected = formData.coCurricularActivities.includes(activity);
                      return (
                        <label
                          key={activity}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                            isSelected
                              ? "bg-orange-50 border-orange-500 text-orange-700 font-extrabold"
                              : "bg-white border-slate-100 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            className="accent-orange-500 rounded h-4 w-4 shrink-0"
                            onChange={() => {
                              const updated = isSelected
                                ? formData.coCurricularActivities.filter(a => a !== activity)
                                : [...formData.coCurricularActivities, activity];
                              setFormData({ ...formData, coCurricularActivities: updated });
                            }}
                          />
                          <span className="truncate">{activity}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider ml-1">অন্যান্য কার্যক্রম (Other Activity)</label>
                    <input
                      type="text"
                      name="otherCoCurricularActivity"
                      value={formData.otherCoCurricularActivity}
                      onChange={handleChange}
                      placeholder="যেমন- বিতর্ক প্রতিযোগিতা বা কোনো নির্দিষ্ট দক্ষতা"
                      className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold focus:border-orange-500 outline-none transition-all shadow-sm"
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
                    type="button"
                    onClick={startCamera}
                    className="px-6 py-2 bg-white border border-sand rounded-xl text-sm font-bold hover:bg-sand/10 cursor-pointer"
                  >
                    ক্যামেরা চালু করুন
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 cursor-pointer"
                  >
                    ছবি তুলুন
                  </button>
                  <label className="px-6 py-2 bg-white border border-sand rounded-xl text-sm font-bold hover:bg-sand/10 cursor-pointer">
                    আপলোড করুন
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              {/* Optional Supporting Documents Upload */}
              <div className="bg-slate-50/60 border border-slate-200 rounded-3xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">সহায়ক ডকুমেন্ট সংযুক্তি (ঐচ্ছিক)</h3>
                      <p className="text-[11px] text-slate-500">এসএসসি মার্কশিট / জন্ম নিবন্ধন / কলেজ আইডি কার্ড (JPG/PNG/PDF, সর্বোচ্চ ৩টি)</p>
                    </div>
                  </div>
                  <label className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 hover:bg-slate-100 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-4 h-4" /> ফাইল যুক্ত করুন
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleSupportingDocUpload}
                    />
                  </label>
                </div>
                {formData.uploadedDocuments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {formData.uploadedDocuments.map((docItem, idx) => (
                      <div
                        key={`${docItem.name}-${idx}`}
                        className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-bold text-slate-800 truncate">{docItem.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              uploadedDocuments: prev.uploadedDocuments.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                          aria-label="Remove document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">নৃতাত্ত্বিক (ক্ষুদ্র) জনগোষ্ঠী</span> <span className="text-slate-800 font-bold">{formData.isEthnicMinority ? "হ্যাঁ" : "না"}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">উচ্চতা</span> <span className="text-slate-800 font-bold">{formData.heightFeet}'{formData.heightInches}" ({formData.heightFeet} feet {formData.heightInches} inches)</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">ওজন</span> <span className="text-slate-800 font-bold">{formData.weightKg} Kg</span></p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="text-slate-800 font-extrabold uppercase tracking-tight text-xs">একাডেমিক ও অন্যান্য তথ্য</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">শ্রেণি</span> <span className="text-slate-800 font-bold">{formData.studyStatus}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">রোল</span> <span className="text-slate-800 font-bold">{formData.classRoll}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">সেশন</span> <span className="text-slate-800 font-bold">{formData.session}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">কলেজ</span> <span className="text-slate-800 font-bold">{formData.collegeName}</span></p>
                    <p className="flex flex-col"><span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">পূর্ববর্তী বিএনসিসি অভিজ্ঞতা</span> <span className="text-slate-800 font-bold">{formData.previousBNCC ? `হ্যাঁ (${formData.previousInstitution} - ${formData.previousRank})` : "না"}</span></p>
                    {formData.coCurricularActivities.length > 0 && (
                      <p className="flex flex-col">
                        <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-0.5">সহ-শিক্ষা কার্যক্রম (Co-Curricular)</span>
                        <span className="text-slate-800 font-bold text-xs">{formData.coCurricularActivities.join(", ")}</span>
                      </p>
                    )}
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
