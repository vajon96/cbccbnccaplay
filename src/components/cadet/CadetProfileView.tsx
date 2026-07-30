import React, { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Shield, Edit3, Save, X, Key, CheckCircle2, AlertCircle, 
  Loader2, Camera, FileText, Calendar, Mail, Phone, MapPin, Droplets, 
  Ruler, Weight, Download, MessageSquare, Clock, History, Printer, 
  ChevronDown, ChevronUp, Sun, Moon, AlertTriangle, Info, Award, 
  BookOpen, Users, Sparkles, Lock, ShieldAlert, Heart, ExternalLink, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CadetProfile } from "../../types";
import { db, doc, updateDoc, Timestamp, collection, addDoc, handleFirestoreError, OperationType } from "../../firebase";
import { hashPassword } from "../../lib/auth";
import { 
  SENSITIVE_FIELDS, 
  FIELD_LABELS, 
  calculateProfileCompletion, 
  validatePhone, 
  validateEmail, 
  validateEmisId, 
  validateNidOrBirthReg, 
  checkDuplicateField 
} from "../../lib/profileUtils";
import { ChangeHistoryModal } from "./ChangeHistoryModal";

interface CadetProfileViewProps {
  user: CadetProfile;
  onProfileUpdated: (updatedUser: CadetProfile) => void;
  isAdminView?: boolean;
}

export const CadetProfileView: React.FC<CadetProfileViewProps> = ({ 
  user, 
  onProfileUpdated,
  isAdminView = false 
}) => {
  const navigate = useNavigate();

  // Dark/Light Theme toggle state
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  // Edit Mode state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CadetProfile>({ ...user });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Collapsible accordion section states (all open by default or toggleable)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    personal: true,
    family: true,
    contact: true,
    academic: true,
    bncc: true,
    identity: true,
    activities: true,
    system: false
  });

  // Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Photo Upload state
  const [photoPreview, setPhotoPreview] = useState<string>(user.photo || "");

  // Profile completion calculation
  const completion = calculateProfileCompletion(editing ? formData : user);

  useEffect(() => {
    setFormData({ ...user });
    setPhotoPreview(user.photo || "");
  }, [user]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto compute total height if feet or inches changed
      if (name === "heightFeet" || name === "heightInches") {
        const feet = name === "heightFeet" ? value : prev.heightFeet || 0;
        const inches = name === "heightInches" ? value : prev.heightInches || 0;
        updated.height = `${feet}'${inches}"`;
      }
      return updated;
    });

    // Clear error for field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert("ছবি সাইজ সর্বোচ্চ 3MB হতে পারবে।");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPhotoPreview(result);
        setFormData(prev => ({ ...prev, photo: result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateAllFields = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    // Validate Phone
    if (formData.studentPhone && !validatePhone(formData.studentPhone)) {
      newErrors.studentPhone = "সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন (যেমন: 017XXXXXXXX)";
    }

    // Validate Email
    if (formData.studentEmail && !validateEmail(formData.studentEmail)) {
      newErrors.studentEmail = "সঠিক ইমেইল ফরম্যাট প্রদান করুন (যেমন: cadet@example.com)";
    }

    // Validate EMIS ID
    if (formData.emisId && !validateEmisId(formData.emisId)) {
      newErrors.emisId = "EMIS ID সংখ্যায় হতে হবে (৪ থেকে ১২ ডিজিট)";
    }

    // Validate NID / Birth Reg
    if (formData.nidBirthReg && !validateNidOrBirthReg(formData.nidBirthReg)) {
      newErrors.nidBirthReg = "NID / জন্ম নিবন্ধন ১০, ১৩ বা ১৭ ডিজিটের হতে হবে";
    }

    // Check duplicate Phone
    if (formData.studentPhone && formData.studentPhone !== user.studentPhone) {
      const isDup = await checkDuplicateField("studentPhone", formData.studentPhone, user.id);
      if (isDup) newErrors.studentPhone = "এই মোবাইল নম্বরটি অন্য একজন ক্যাডেটের প্রোফাইলে ইতিমধ্যে ব্যবহৃত হচ্ছে";
    }

    // Check duplicate Email
    if (formData.studentEmail && formData.studentEmail !== user.studentEmail) {
      const isDup = await checkDuplicateField("studentEmail", formData.studentEmail, user.id);
      if (isDup) newErrors.studentEmail = "এই ইমেইল এড্রেসটি অন্য একজন ক্যাডেটের প্রোফাইলে ইতিমধ্যে ব্যবহৃত হচ্ছে";
    }

    // Check duplicate Reg Number
    if (formData.registrationNumber && formData.registrationNumber !== user.registrationNumber) {
      const isDup = await checkDuplicateField("registrationNumber", formData.registrationNumber, user.id);
      if (isDup) newErrors.registrationNumber = "এই বিএনসিসি রেজিস্ট্রেশন নম্বরটি অন্য ক্যাডেটের নামে নিবন্ধিত";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const isValid = await validateAllFields();
      if (!isValid) {
        setSaving(false);
        alert("দয়া করে লাল চিহ্নিত ফিল্ডগুলোর ভুল সংশোধন করুন।");
        return;
      }

      const docRef = doc(db, "applicants", user.id);

      // Separate directly editable fields from sensitive fields
      const sensitiveDeltas: Record<string, { old: any; new: any }> = {};
      const directUpdates: Record<string, any> = {};
      const directDeltas: Record<string, { old: any; new: any }> = {};

      Object.keys(formData).forEach((key) => {
        const k = key as keyof CadetProfile;
        const oldVal = user[k];
        const newVal = formData[k];

        if (oldVal !== newVal && k !== "password") {
          if (SENSITIVE_FIELDS.includes(k) && !isAdminView) {
            sensitiveDeltas[k] = { old: oldVal ?? "", new: newVal ?? "" };
          } else {
            directUpdates[k] = newVal;
            directDeltas[k] = { old: oldVal ?? "", new: newVal ?? "" };
          }
        }
      });

      let updatedUserObj = { ...user, ...directUpdates };

      // 1. If there are direct updates, write them to Firestore immediately
      if (Object.keys(directUpdates).length > 0) {
        directUpdates.updatedAt = Timestamp.now();
        await updateDoc(docRef, directUpdates);

        // Log direct activity
        await addDoc(collection(db, "activity_logs"), {
          type: "PROFILE_UPDATED",
          targetId: user.id,
          actorId: user.id,
          actorName: user.fullNameEnglish || user.id,
          timestamp: Timestamp.now(),
          details: `Directly updated profile fields: ${Object.keys(directUpdates).join(", ")}`,
          changes: directDeltas
        });
      }

      // 2. If sensitive fields were edited by a cadet, submit a pending change request for Admin approval!
      if (Object.keys(sensitiveDeltas).length > 0 && !isAdminView) {
        const pendingDoc = await addDoc(collection(db, "pending_profile_changes"), {
          cadetId: user.id,
          cadetName: user.fullNameEnglish || user.fullNameBangla,
          registrationNumber: user.registrationNumber || user.id,
          changes: sensitiveDeltas,
          directlyUpdatedFields: directDeltas,
          status: "pending",
          requestedAt: Timestamp.now()
        });

        // Set pending flag on cadet doc
        await updateDoc(docRef, {
          hasPendingEdits: true,
          pendingEditsId: pendingDoc.id
        });

        updatedUserObj.hasPendingEdits = true;
        updatedUserObj.pendingEditsId = pendingDoc.id;

        // Notify Admins
        await addDoc(collection(db, "notifications"), {
          targetId: "ALL",
          type: "Alert",
          title: "Sensitive Profile Edits Pending Approval",
          message: `Cadet ${user.fullNameEnglish} (${user.registrationNumber || user.id}) requested changes to sensitive profile information.`,
          timestamp: Timestamp.now()
        });

        alert("আপনার কিছু সংবেদনশীল তথ্য (যেমন নাম, জন্ম তারিখ, রেজিস্ট্রেশন ইত্যাদি) অ্যাডমিন অনুমোদনের জন্য পেন্ডিং রিকোয়েস্ট হিসেবে পাঠানো হয়েছে। অনুমোদিত হলে প্রোফাইলে হালনাগাদ হবে।");
      } else if (isAdminView && Object.keys(sensitiveDeltas).length > 0) {
        // If Admin is editing, save everything directly!
        const allUpdates: Record<string, any> = {};
        Object.entries(sensitiveDeltas).forEach(([k, delta]) => {
          allUpdates[k] = delta.new;
        });
        allUpdates.updatedAt = Timestamp.now();
        await updateDoc(docRef, allUpdates);
        updatedUserObj = { ...updatedUserObj, ...allUpdates };
      }

      onProfileUpdated(updatedUserObj);
      setEditing(false);
      alert("প্রোফাইল সফলভাবে সংরক্ষণ করা হয়েছে!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${user.id}`);
    } fontally: {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("পাসওয়ার্ড দুটি মিলছে না");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }

    setSaving(true);
    try {
      const hashedPassword = await hashPassword(newPassword);
      const docRef = doc(db, "applicants", user.id);
      await updateDoc(docRef, { password: hashedPassword, updatedAt: Timestamp.now() });

      await addDoc(collection(db, "activity_logs"), {
        type: "PASSWORD_CHANGED",
        targetId: user.id,
        actorId: user.id,
        timestamp: Timestamp.now(),
        details: "Cadet updated account password"
      });

      setPasswordSuccess("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!");
      setTimeout(() => {
        setShowPasswordModal(false);
        setNewPassword("");
        setConfirmPassword("");
        setPasswordSuccess("");
      }, 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${user.id}`);
    } finally {
      setSaving(false);
    }
  };

  // Color classes depending on theme mode (Military Dark vs Military Light)
  const isDark = themeMode === "dark";

  const cardBg = isDark 
    ? "bg-slate-900/80 border-amber-500/10 text-white backdrop-blur-xl shadow-2xl" 
    : "bg-white border-slate-200 text-slate-900 shadow-xl";

  const headerBg = isDark
    ? "bg-gradient-to-r from-slate-950 via-[#002147] to-slate-950 border-amber-500/20"
    : "bg-gradient-to-r from-slate-900 via-[#002147] to-slate-900 border-slate-300 text-white";

  const inputBg = isDark
    ? "bg-slate-950 border-white/10 text-white focus:border-amber-400"
    : "bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-600";

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#020813] text-slate-100" : "bg-slate-100 text-slate-900"} transition-colors duration-300 pb-20`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Top Control Bar with Theme Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-amber-500/20 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 text-amber-400">
              <Shield size={22} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">BNCC Cadet Profile System</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital Cadet Management Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setThemeMode(isDark ? "light" : "dark")}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-amber-400 transition-all"
              title="Toggle Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>

            {/* Audit Trail / History */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-all"
            >
              <History size={16} />
              <span>Audit Log</span>
            </button>
          </div>
        </div>

        {/* Pending Edit Alert Banner */}
        {user.hasPendingEdits && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <h4 className="font-black uppercase tracking-wider text-amber-400">অ্যাডমিন অনুমোদনের জন্য অপেক্ষমান (Pending Approval)</h4>
              <p className="mt-0.5">আপনার প্রোফাইলের কিছু গুরুত্বপূর্ণ তথ্য সংশোধনের আবেদন প্লাটুন কমান্ডারের নিকট পেন্ডিং আছে। অনুমোদন হলে স্বয়ংক্রিয়ভাবে আপডেট হবে।</p>
            </div>
          </motion.div>
        )}

        {/* Main Header Hero Card */}
        <div className={`p-6 md:p-8 rounded-3xl border ${headerBg} shadow-2xl relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Cadet Photo & Upload Controls */}
            <div className="lg:col-span-4 flex flex-col items-center text-center space-y-4">
              <div className="relative group w-36 h-40 rounded-3xl border-4 border-amber-500/30 overflow-hidden bg-slate-950 shadow-2xl">
                {photoPreview ? (
                  <img src={photoPreview} alt="Cadet Photo" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2">
                    <User size={48} />
                    <span className="text-[10px] uppercase font-bold mt-1">No Photo</span>
                  </div>
                )}

                {editing && (
                  <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs font-bold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="mb-1 text-amber-400" />
                    <span>ছবি আপলোড</span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>

              {editing && (
                <p className="text-[10px] text-amber-400/80 font-semibold max-w-xs">
                  ছবি পরিবর্তন করতে ছবির উপরে ক্লিক করুন (সর্বোচ্চ 3MB)
                </p>
              )}

              <div>
                <h1 className="text-2xl font-black text-white uppercase tracking-tight">
                  {user.fullNameEnglish || user.fullNameBangla || "BNCC CADET"}
                </h1>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mt-0.5">
                  {user.fullNameBangla}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                    Rank: {user.currentRank || user.previousRank || "Cadet"}
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
                    {user.status || "Active"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics & Actions */}
            <div className="lg:col-span-8 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">BNCC Reg No</span>
                  <p className="text-sm font-black text-amber-400 truncate">{user.registrationNumber || "N/A"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Cadet ID</span>
                  <p className="text-sm font-black text-white truncate">{user.id}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">College</span>
                  <p className="text-xs font-bold text-slate-200 truncate">{user.collegeName || "Cox's Bazar City College"}</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Battalion</span>
                  <p className="text-xs font-bold text-slate-200 truncate">{user.previousBattalionRegiment || "15 BNCC Battalion"}</p>
                </div>
              </div>

              {/* Profile Completion Progress Bar */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                    <Sparkles size={14} className="text-amber-400" />
                    Profile Completion Progress
                  </span>
                  <span className="text-amber-400 font-black text-sm">{completion.percentage}%</span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completion.percentage}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-full rounded-full ${
                      completion.percentage >= 80 
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400" 
                        : completion.percentage >= 50 
                        ? "bg-gradient-to-r from-amber-500 to-amber-400" 
                        : "bg-gradient-to-r from-red-500 to-amber-500"
                    }`}
                  />
                </div>

                {completion.missingFields.length > 0 && (
                  <div className="pt-2">
                    <details className="text-xs text-amber-300/90 cursor-pointer">
                      <summary className="font-bold text-[11px] hover:underline flex items-center gap-1">
                        <Info size={13} />
                        {completion.missingFields.length} টি অসম্পূর্ণ ফিল্ড রয়েছে (ক্লিক করে দেখুন)
                      </summary>
                      <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-white/10 grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px]">
                        {completion.missingFields.map(f => (
                          <div key={f.key} className="text-slate-300 flex items-center gap-1">
                            <span className="text-amber-400">•</span> {f.label} ({f.section})
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Main Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xl shadow-amber-500/20"
                  >
                    <Edit3 size={16} />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setEditing(false); setFormData({ ...user }); setErrors({}); }}
                      className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                    >
                      <X size={16} />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center gap-2 px-7 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save Profile
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
                >
                  <Key size={16} className="text-amber-400" />
                  Password Reset
                </button>

                <button
                  onClick={() => navigate(`/admit-card/${user.id}?download=true`)}
                  className="flex items-center gap-2 px-5 py-3 bg-emerald-900/40 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all"
                >
                  <Download size={16} />
                  Admit Card
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 8 Collapsible Sections */}
        <div className="space-y-6">

          {/* Section 1: Personal Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("personal")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <User size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">১. ব্যক্তিগত তথ্য (Personal Information)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Name, DOB, Height, Weight, Blood Group</p>
                </div>
              </div>
              {openSections.personal ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.personal && (
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Full Name Bangla */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    Full Name (Bangla)
                    {SENSITIVE_FIELDS.includes("fullNameBangla") && <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="fullNameBangla"
                      value={formData.fullNameBangla || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      placeholder="নাম বাংলায়"
                    />
                  ) : (
                    <p className="text-sm font-extrabold text-amber-300">{user.fullNameBangla || "—"}</p>
                  )}
                </div>

                {/* Full Name English */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    Full Name (English)
                    {SENSITIVE_FIELDS.includes("fullNameEnglish") && <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="fullNameEnglish"
                      value={formData.fullNameEnglish || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      placeholder="Full Name in English"
                    />
                  ) : (
                    <p className="text-sm font-extrabold uppercase">{user.fullNameEnglish || "—"}</p>
                  )}
                </div>

                {/* Date of Birth */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    Date of Birth
                    {SENSITIVE_FIELDS.includes("dob") && <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>}
                  </label>
                  {editing ? (
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.dob || "—"}</p>
                  )}
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Gender</label>
                  {editing ? (
                    <select
                      name="gender"
                      value={formData.gender || "Male"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold">{user.gender || "—"}</p>
                  )}
                </div>

                {/* Religion */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Religion</label>
                  {editing ? (
                    <select
                      name="religion"
                      value={formData.religion || "Islam"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="Islam">Islam</option>
                      <option value="Hinduism">Hinduism</option>
                      <option value="Buddhism">Buddhism</option>
                      <option value="Christianity">Christianity</option>
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold">{user.religion || "—"}</p>
                  )}
                </div>

                {/* Blood Group */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Blood Group</label>
                  {editing ? (
                    <select
                      name="bloodGroup"
                      value={formData.bloodGroup || "A+"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-extrabold text-red-400">{user.bloodGroup || "—"}</p>
                  )}
                </div>

                {/* Height Feet & Inches */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Height (Feet & Inches)</label>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        name="heightFeet"
                        placeholder="Feet"
                        value={formData.heightFeet ?? ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                      />
                      <input
                        type="number"
                        name="heightInches"
                        placeholder="Inches"
                        value={formData.heightInches ?? ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                      />
                    </div>
                  ) : (
                    <p className="text-sm font-bold">
                      {user.heightFeet ? `${user.heightFeet}' ${user.heightInches || 0}" (${user.height || ""})` : user.height || "—"}
                    </p>
                  )}
                </div>

                {/* Weight KG */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Weight (KG)</label>
                  {editing ? (
                    <input
                      type="number"
                      name="weightKg"
                      value={formData.weightKg ?? ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      placeholder="e.g. 62"
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.weightKg ? `${user.weightKg} KG` : "—"}</p>
                  )}
                </div>

                {/* Ethnic Minority */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ethnic Minority Status</label>
                  {editing ? (
                    <select
                      name="isEthnicMinority"
                      value={String(formData.isEthnicMinority ?? "No")}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="No">No (সাধারণ প্রার্থী)</option>
                      <option value="Yes">Yes (ক্ষুদ্র নৃ-গোষ্ঠী)</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold">{user.isEthnicMinority || "No"}</p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Section 2: Family Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("family")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Users size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">২. পারিবারিক তথ্য (Family Information)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Father's Name, Mother's Name in Bangla and English</p>
                </div>
              </div>
              {openSections.family ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.family && (
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Father Name (Bangla)</label>
                  {editing ? (
                    <input
                      type="text"
                      name="fatherNameBangla"
                      value={formData.fatherNameBangla || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.fatherNameBangla || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Father Name (English)</label>
                  {editing ? (
                    <input
                      type="text"
                      name="fatherNameEnglish"
                      value={formData.fatherNameEnglish || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold uppercase">{user.fatherNameEnglish || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mother Name (Bangla)</label>
                  {editing ? (
                    <input
                      type="text"
                      name="motherNameBangla"
                      value={formData.motherNameBangla || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.motherNameBangla || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Mother Name (English)</label>
                  {editing ? (
                    <input
                      type="text"
                      name="motherNameEnglish"
                      value={formData.motherNameEnglish || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold uppercase">{user.motherNameEnglish || "—"}</p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Section 3: Contact Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("contact")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Phone size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">৩. যোগাযোগের তথ্য (Contact Information)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Student Phone, Email, Present & Permanent Address, Emergency Contact</p>
                </div>
              </div>
              {openSections.contact ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.contact && (
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Student Phone */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Student Phone Number</label>
                  {editing ? (
                    <div>
                      <input
                        type="text"
                        name="studentPhone"
                        value={formData.studentPhone || ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                        placeholder="017XXXXXXXX"
                      />
                      {errors.studentPhone && <p className="text-[10px] text-red-400 mt-1 font-bold">{errors.studentPhone}</p>}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-amber-300">{user.studentPhone || "—"}</p>
                  )}
                </div>

                {/* Student Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Student Email Address</label>
                  {editing ? (
                    <div>
                      <input
                        type="email"
                        name="studentEmail"
                        value={formData.studentEmail || ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      />
                      {errors.studentEmail && <p className="text-[10px] text-red-400 mt-1 font-bold">{errors.studentEmail}</p>}
                    </div>
                  ) : (
                    <p className="text-sm font-bold">{user.studentEmail || "—"}</p>
                  )}
                </div>

                {/* Present Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Present Address</label>
                  {editing ? (
                    <textarea
                      name="presentAddress"
                      rows={2}
                      value={formData.presentAddress || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl p-4 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.presentAddress || "—"}</p>
                  )}
                </div>

                {/* Permanent Address */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Permanent Address</label>
                  {editing ? (
                    <textarea
                      name="permanentAddress"
                      rows={2}
                      value={formData.permanentAddress || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl p-4 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.permanentAddress || "—"}</p>
                  )}
                </div>

                {/* Emergency Contact */}
                <div className="md:col-span-2 p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                  <h4 className="text-xs font-black uppercase text-amber-400">Emergency Contact Person (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Contact Name</label>
                      {editing ? (
                        <input
                          type="text"
                          name="emergencyContactName"
                          value={formData.emergencyContactName || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${inputBg}`}
                        />
                      ) : (
                        <p className="text-xs font-bold">{user.emergencyContactName || "—"}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Relation</label>
                      {editing ? (
                        <input
                          type="text"
                          name="emergencyContactRelation"
                          value={formData.emergencyContactRelation || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${inputBg}`}
                        />
                      ) : (
                        <p className="text-xs font-bold">{user.emergencyContactRelation || "—"}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-400">Contact Phone</label>
                      {editing ? (
                        <input
                          type="text"
                          name="emergencyContactPhone"
                          value={formData.emergencyContactPhone || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-xl px-3 py-2 text-xs outline-none ${inputBg}`}
                        />
                      ) : (
                        <p className="text-xs font-bold text-amber-300">{user.emergencyContactPhone || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Section 4: Academic Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("academic")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <BookOpen size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">৪. শিক্ষাগত তথ্য (Academic Records)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">College, EMIS ID, SSC and HSC Record Summary</p>
                </div>
              </div>
              {openSections.academic ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.academic && (
              <div className="p-6 md:p-8 space-y-6">
                
                {/* College & Class Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      College Name
                      {SENSITIVE_FIELDS.includes("collegeName") && <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>}
                    </label>
                    {editing ? (
                      <input
                        type="text"
                        name="collegeName"
                        value={formData.collegeName || ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      />
                    ) : (
                      <p className="text-sm font-bold">{user.collegeName || "—"}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                      EMIS ID
                      {SENSITIVE_FIELDS.includes("emisId") && <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>}
                    </label>
                    {editing ? (
                      <div>
                        <input
                          type="text"
                          name="emisId"
                          value={formData.emisId || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                        />
                        {errors.emisId && <p className="text-[10px] text-red-400 mt-1 font-bold">{errors.emisId}</p>}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-amber-300">{user.emisId || "—"}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Class Roll / Section</label>
                    {editing ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          name="classRoll"
                          placeholder="Roll"
                          value={formData.classRoll || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                        />
                        <input
                          type="text"
                          name="section"
                          placeholder="Sec"
                          value={formData.section || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-bold">Roll: {user.classRoll || "—"} / Sec: {user.section || "—"}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Session & Subject</label>
                    {editing ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          name="session"
                          placeholder="Session"
                          value={formData.session || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                        />
                        <input
                          type="text"
                          name="subject"
                          placeholder="Subject"
                          value={formData.subject || ""}
                          onChange={handleInputChange}
                          className={`w-full rounded-2xl px-3 py-3 text-xs outline-none ${inputBg}`}
                        />
                      </div>
                    ) : (
                      <p className="text-sm font-bold">{user.session || "—"} ({user.subject || "—"})</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Study Status</label>
                    {editing ? (
                      <select
                        name="studyStatus"
                        value={formData.studyStatus || "Regular"}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      >
                        <option value="Regular">Regular (নিয়মিত)</option>
                        <option value="Irregular">Irregular (অনিয়মিত)</option>
                        <option value="Graduated">Graduated (উত্তীর্ণ)</option>
                        <option value="Dropped">Dropped</option>
                      </select>
                    ) : (
                      <p className="text-sm font-bold text-emerald-400">{user.studyStatus || "Regular"}</p>
                    )}
                  </div>
                </div>

                {/* SSC & HSC Grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
                  
                  {/* SSC Box */}
                  <div className="p-5 rounded-2xl bg-black/30 border border-white/10 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
                      <span>SSC / সমমান তথ্য</span>
                      <span title="Requires Admin Approval on Edit"><Lock size={12} /></span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Board</label>
                        {editing ? (
                          <input type="text" name="sscBoard" value={formData.sscBoard || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.sscBoard || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Group</label>
                        {editing ? (
                          <input type="text" name="sscGroup" value={formData.sscGroup || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.sscGroup || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">GPA</label>
                        {editing ? (
                          <input type="text" name="sscGpa" value={formData.sscGpa || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-extrabold text-emerald-400">{user.sscGpa || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Passing Year</label>
                        {editing ? (
                          <input type="text" name="sscYear" value={formData.sscYear || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.sscYear || "—"}</p>}
                      </div>
                    </div>
                  </div>

                  {/* HSC Box */}
                  <div className="p-5 rounded-2xl bg-black/30 border border-white/10 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center justify-between">
                      <span>HSC / সমমান তথ্য</span>
                      <span title="Requires Admin Approval on Edit"><Lock size={12} /></span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Board</label>
                        {editing ? (
                          <input type="text" name="hscBoard" value={formData.hscBoard || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.hscBoard || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Group</label>
                        {editing ? (
                          <input type="text" name="hscGroup" value={formData.hscGroup || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.hscGroup || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">GPA</label>
                        {editing ? (
                          <input type="text" name="hscGpa" value={formData.hscGpa || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-extrabold text-emerald-400">{user.hscGpa || "—"}</p>}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Passing Year</label>
                        {editing ? (
                          <input type="text" name="hscYear" value={formData.hscYear || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold">{user.hscYear || "—"}</p>}
                      </div>
                      <div className="col-span-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Optional Subject</label>
                        {editing ? (
                          <input type="text" name="hscOptionalSubject" value={formData.hscOptionalSubject || ""} onChange={handleInputChange} className={`w-full rounded-xl px-3 py-2 ${inputBg}`} />
                        ) : <p className="font-bold text-amber-300">{user.hscOptionalSubject || "—"}</p>}
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>

          {/* Section 5: BNCC Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("bncc")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Shield size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">৫. বিএনসিসি সার্ভিস সংক্রান্ত তথ্য (BNCC Service Records)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">BNCC Reg No, Rank, Battalion, Service Duration, Attendance</p>
                </div>
              </div>
              {openSections.bncc ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.bncc && (
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    BNCC Registration Number
                    <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>
                  </label>
                  {editing ? (
                    <div>
                      <input
                        type="text"
                        name="registrationNumber"
                        value={formData.registrationNumber || ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                      />
                      {errors.registrationNumber && <p className="text-[10px] text-red-400 mt-1 font-bold">{errors.registrationNumber}</p>}
                    </div>
                  ) : (
                    <p className="text-sm font-black text-amber-400">{user.registrationNumber || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    Current Rank
                    <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>
                  </label>
                  {editing ? (
                    <select
                      name="currentRank"
                      value={formData.currentRank || user.previousRank || "Cadet"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="Cadet">Cadet (ক্যাডেট)</option>
                      <option value="Lance Corporal">Lance Corporal (ল্যান্স কর্পোরাল)</option>
                      <option value="Corporal">Corporal (কর্পোরাল)</option>
                      <option value="Sergeant">Sergeant (সার্জেন্ট)</option>
                      <option value="CUO">Cadet Under Officer (CUO)</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold text-amber-300">{user.currentRank || user.previousRank || "Cadet"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Previous BNCC Experience</label>
                  {editing ? (
                    <select
                      name="previousBNCC"
                      value={formData.previousBNCC || "No"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="No">No (পূর্বে বিএনসিসি করেনি)</option>
                      <option value="Junior Division">Junior Division (স্কুল বিএনসিসি)</option>
                      <option value="Senior Division">Senior Division</option>
                      <option value="Yes">Yes (পূর্বে বিএনসিসি করেছি)</option>
                    </select>
                  ) : (
                    <p className="text-sm font-bold">{user.previousBNCC || "No"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    Battalion & Regiment
                    <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      name="previousBattalionRegiment"
                      value={formData.previousBattalionRegiment || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.previousBattalionRegiment || "15 BNCC Battalion, Karnafully Regiment"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Service Duration</label>
                  {editing ? (
                    <input
                      type="text"
                      name="serviceDuration"
                      placeholder="e.g. 1 Year 6 Months"
                      value={formData.serviceDuration || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    />
                  ) : (
                    <p className="text-sm font-bold">{user.serviceDuration || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Attendance Status</label>
                  {editing ? (
                    <select
                      name="attendanceStatus"
                      value={formData.attendanceStatus || "Present"}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                    >
                      <option value="Present">Present (নিয়মিত উপস্থিত)</option>
                      <option value="Absent">Absent</option>
                      <option value="On Leave">On Leave (ছুটিতে)</option>
                    </select>
                  ) : (
                    <p className="text-sm font-extrabold text-emerald-400">{user.attendanceStatus || "Present"}</p>
                  )}
                </div>

                {/* Conditional Section: Shown if Previous BNCC Experience is selected or present */}
                {((editing ? formData.previousBNCC : user.previousBNCC) &&
                  (editing ? formData.previousBNCC : user.previousBNCC) !== "No" &&
                  (editing ? formData.previousBNCC : user.previousBNCC) !== "false") && (
                  <div className="col-span-full p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-4 my-2 transition-all">
                    <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                      <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                        পূর্ববর্তী বিএনসিসি অভিজ্ঞতা তথ্য (Previous BNCC Experience Details)
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Previous Rank / Position (পূর্ববর্তী পদবি)
                        </label>
                        {editing ? (
                          <select
                            name="previousRank"
                            value={formData.previousRank || "Cadet"}
                            onChange={handleInputChange}
                            className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                          >
                            <option value="Cadet">Cadet (ক্যাডেট)</option>
                            <option value="Lance Corporal">Lance Corporal (ল্যান্স কর্পোরাল)</option>
                            <option value="Corporal">Corporal (কর্পোরাল)</option>
                            <option value="Sergeant">Sergeant (সার্জেন্ট)</option>
                            <option value="Under Officer">Cadet Under Officer (CUO)</option>
                            <option value="Cadet Captain">Cadet Captain</option>
                            <option value="Other">Other (অন্যান্য)</option>
                          </select>
                        ) : (
                          <p className="text-sm font-bold text-amber-300">{user.previousRank || "—"}</p>
                        )}
                      </div>

                      {((editing ? formData.previousRank : user.previousRank) === "Other") && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Specify Other Rank (অন্যান্য পদবি)
                          </label>
                          {editing ? (
                            <input
                              type="text"
                              name="previousRankOther"
                              value={formData.previousRankOther || ""}
                              onChange={handleInputChange}
                              placeholder="e.g. Band Cadet"
                              className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                            />
                          ) : (
                            <p className="text-sm font-bold text-amber-300">{user.previousRankOther || "—"}</p>
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Previous Institution (পূর্ববর্তী শিক্ষাপ্রতিষ্ঠান)
                        </label>
                        {editing ? (
                          <input
                            type="text"
                            name="previousInstitution"
                            value={formData.previousInstitution || ""}
                            onChange={handleInputChange}
                            placeholder="e.g. School / College Name"
                            className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                          />
                        ) : (
                          <p className="text-sm font-bold">{user.previousInstitution || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Section 6: Identity Information */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("identity")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Lock size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">৬. পরিচয়পত্র সংক্রান্ত তথ্য (Identity Verification)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">NID or Birth Registration Number</p>
                </div>
              </div>
              {openSections.identity ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.identity && (
              <div className="p-6 md:p-8 space-y-4">
                <div className="space-y-1.5 max-w-md">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    NID / Birth Registration Number
                    <span title="Admin Approval Required"><Lock size={10} className="text-amber-400" /></span>
                  </label>
                  {editing ? (
                    <div>
                      <input
                        type="text"
                        name="nidBirthReg"
                        value={formData.nidBirthReg || ""}
                        onChange={handleInputChange}
                        className={`w-full rounded-2xl px-4 py-3 text-xs outline-none ${inputBg}`}
                        placeholder="10, 13, or 17 digit number"
                      />
                      {errors.nidBirthReg && <p className="text-[10px] text-red-400 mt-1 font-bold">{errors.nidBirthReg}</p>}
                    </div>
                  ) : (
                    <p className="text-base font-black tracking-widest text-amber-400">{user.nidBirthReg || "—"}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 7: Activities */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all`}>
            <button
              onClick={() => toggleSection("activities")}
              className="w-full px-6 py-5 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Award size={20} />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black uppercase tracking-tight">৭. সহ-শিক্ষা ও অতিরিক্ত কার্যক্রম (Activities)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Sports, Cultural, Scouting, Debate, Volunteer work</p>
                </div>
              </div>
              {openSections.activities ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>

            {openSections.activities && (
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Co-Curricular Activities</label>
                  {editing ? (
                    <textarea
                      name="coCurricularActivities"
                      rows={3}
                      value={formData.coCurricularActivities || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl p-4 text-xs outline-none ${inputBg}`}
                      placeholder="e.g. Sports, Debate, Red Crescent, Cultural performance"
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.coCurricularActivities || "—"}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Other Special Achievements</label>
                  {editing ? (
                    <textarea
                      name="otherCoCurricularActivity"
                      rows={3}
                      value={formData.otherCoCurricularActivity || ""}
                      onChange={handleInputChange}
                      className={`w-full rounded-2xl p-4 text-xs outline-none ${inputBg}`}
                      placeholder="Any additional honors, awards, or volunteer history"
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.otherCoCurricularActivity || "—"}</p>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Section 8: System Information (Read-Only) */}
          <div className={`rounded-3xl border ${cardBg} overflow-hidden transition-all opacity-80`}>
            <button
              onClick={() => toggleSection("system")}
              className="w-full px-6 py-4 flex items-center justify-between border-b border-white/10 hover:bg-white/5 transition-all text-xs"
            >
              <div className="flex items-center gap-3">
                <Info size={16} className="text-amber-400" />
                <span className="font-bold uppercase tracking-wider text-slate-400">৮. সিস্টেম তথ্য (System Information - Read Only)</span>
              </div>
              {openSections.system ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {openSections.system && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="block text-[9px] uppercase text-slate-500 font-bold">User System ID</span>
                  <p className="text-slate-300">{user.id}</p>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-500 font-bold">Account Created At</span>
                  <p className="text-slate-300">
                    {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleString() : "System Record"}
                  </p>
                </div>
                <div>
                  <span className="block text-[9px] uppercase text-slate-500 font-bold">Last Profile Update</span>
                  <p className="text-slate-300">
                    {user.updatedAt?.toDate ? user.updatedAt.toDate().toLocaleString() : "Recently"}
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-slate-900 border border-amber-500/20 text-white p-8 rounded-3xl space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                  <Key size={24} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight">Security Password Reset</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Update account access password</p>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} />
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">নতুন পাসওয়ার্ড (New Password)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">পাসওয়ার্ড নিশ্চিত করুন (Confirm Password)</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-amber-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : "সংরক্ষণ (Save)"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audit History Modal */}
      {showHistoryModal && (
        <ChangeHistoryModal
          cadetId={user.id}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

    </div>
  );
};
