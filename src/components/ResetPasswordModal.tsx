import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Send,
  Shield,
} from "lucide-react";
import {
  auth,
  db,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  collection,
  Timestamp,
} from "../firebase";
import { requestEmailPasswordReset, hashPassword } from "../lib/auth";

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
}

/**
 * Privacy-Preserving Password Recovery Flow (Email Reset + Officer-Assisted Request)
 * Zero Google OAuth dependencies.
 */
export function ResetPasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ResetPasswordModalProps) {
  const [tab, setTab] = useState<"email" | "officer">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [applicantId, setApplicantId] = useState("");
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reasonNote, setReasonNote] = useState("");

  const handleSendEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await requestEmailPasswordReset(resetEmail);
    setLoading(false);
    if (!res.success) {
      setError(res.error || "রিসেট ইমেইল পাঠানো যায়নি।");
      return;
    }
    setSuccess(
      "পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে। ইনবক্স ও স্প্যাম ফোল্ডার পরীক্ষা করুন।"
    );
    setTimeout(() => {
      onSuccess(resetEmail.trim());
      onClose();
    }, 2200);
  };

  const handleSubmitOfficerRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const cleanId = applicantId.trim();
    if (!cleanId) {
      setError("ক্যাডেট / আবেদন আইডি লিখুন।");
      return;
    }

    if (!auth.currentUser) {
      setError(
        "অফিসার-সহায়তা বা সরাসরি পাসওয়ার্ড পরিবর্তনের জন্য অনুগ্রহ করে প্রথমে আপনার ইমেইল দিয়ে সাইন-ইন করুন অথবা উপরের 'ইমেইল রিসেট লিংক' ব্যবহার করুন।"
      );
      return;
    }

    setLoading(true);
    try {
      let updatedDirectly = false;
      try {
        const snap = await getDoc(doc(db, "applicants", cleanId));
        if (snap.exists() && snap.data().ownerUid === auth.currentUser.uid) {
          if (newPassword.length < 6) {
            setError("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।");
            setLoading(false);
            return;
          }
          if (newPassword !== confirmPassword) {
            setError("পাসওয়ার্ড দুটি মেলেনি।");
            setLoading(false);
            return;
          }
          const hashed = await hashPassword(newPassword);
          await updateDoc(doc(db, "applicants", cleanId), {
            passwordHash: hashed,
            updatedAt: Timestamp.now(),
          });
          await addDoc(collection(db, "activity_logs"), {
            type: "PASSWORD_CHANGED",
            targetId: cleanId,
            actorId: auth.currentUser.uid,
            timestamp: Timestamp.now(),
            details: `Authenticated owner ${auth.currentUser.email || auth.currentUser.uid} updated password.`,
          });
          updatedDirectly = true;
          setSuccess("আপনার পাসওয়ার্ড সফলভাবে আপডেট হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
          setTimeout(() => {
            onSuccess(cleanId);
            onClose();
          }, 1800);
          return;
        }
      } catch {
        // Fall through to officer-assisted reset request
      }

      if (!updatedDirectly) {
        if (!registeredPhone.trim()) {
          setError("অফিসার-সহায়তা রিকোয়েস্টের জন্য নিবন্ধিত মোবাইল নম্বর প্রদান করুন।");
          setLoading(false);
          return;
        }
        const resetId = `${cleanId}_${Date.now()}`;
        await setDoc(doc(db, "password_resets", resetId), {
          id: resetId,
          applicantId: cleanId,
          ownerUid: auth.currentUser.uid,
          requesterEmail: auth.currentUser.email || "",
          mobile: registeredPhone.trim(),
          note: reasonNote.trim() || "Applicant requested officer-assisted password reset.",
          status: "Pending",
          createdAt: Timestamp.now(),
        });

        setSuccess(
          "নিরাপদ রিকভারি অনুরোধ অ্যাডমিন প্যানেলে পাঠানো হয়েছে। প্লাটুন অ্যাডমিন যাচাই করে নতুন পাসওয়ার্ড প্রদান করবেন।"
        );
        setTimeout(() => {
          onSuccess(cleanId);
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setError("রিকভারি অনুরোধ জমা দেওয়া যায়নি: " + (err?.message || "Permission error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            className="relative w-full max-w-md bg-[#061830] border border-white/15 rounded-3xl shadow-2xl p-6 md:p-8 z-10"
          >
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#C5A059]/15 rounded-xl flex items-center justify-center border border-[#C5A059]/30">
                  <Key className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h3 id="reset-modal-title" className="text-lg font-bold text-white">নিরাপদ পাসওয়ার্ড রিকভারি</h3>
                  <p className="text-xs text-slate-400">
                    Email Reset Link &amp; Officer Assistance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950/70 border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  setTab("email");
                  setError(null);
                  setSuccess(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tab === "email" ? "bg-[#C5A059] text-[#00152e]" : "text-slate-300 hover:text-white"
                }`}
              >
                <Mail size={14} />
                <span>ইমেইল লিংক</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("officer");
                  setError(null);
                  setSuccess(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  tab === "officer" ? "bg-[#C5A059] text-[#00152e]" : "text-slate-300 hover:text-white"
                }`}
              >
                <Shield size={14} />
                <span>অফিসার সহায়তা</span>
              </button>
            </div>

            {error && (
              <div role="alert" className="mb-4 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-200 font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            {success && (
              <div role="status" className="mb-4 p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-200 font-semibold leading-relaxed">{success}</p>
              </div>
            )}

            {tab === "email" ? (
              <form onSubmit={handleSendEmailReset} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  আপনার নিবন্ধিত ইমেইল ঠিকানা লিখুন। আমরা পাসওয়ার্ড রিসেট করার নিরাপদ লিংক পাঠিয়ে দেব।
                </p>
                <div>
                  <label htmlFor="reset-email-input" className="block text-xs font-bold text-slate-300 mb-1.5">
                    নিবন্ধিত ইমেইল ঠিকানা *
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="reset-email-input"
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="cadet@example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-[#C5A059] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#C5A059] hover:bg-[#d6b36c] text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={16} />}
                  রিসেট লিংক পাঠান
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmitOfficerRecovery} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ক্যাডেট / আবেদন আইডি *
                  </label>
                  <input
                    type="text"
                    required
                    value={applicantId}
                    onChange={(e) => setApplicantId(e.target.value)}
                    placeholder="যেমন: 1111"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-[#C5A059] outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    নিবন্ধিত মোবাইল নম্বর *
                  </label>
                  <input
                    type="text"
                    required
                    value={registeredPhone}
                    onChange={(e) => setRegisteredPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-[#C5A059] outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      নতুন পাসওয়ার্ড (মালিক হলে)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="ন্যূতম ৬ অক্ষর"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#C5A059] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      নিশ্চিত করুন
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="পুনরায় দিন"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#C5A059] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    মন্তব্য (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    placeholder="অফিসারের জন্য বার্তা"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-[#C5A059] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#C5A059] hover:bg-[#d6b36c] text-slate-950 font-bold text-sm rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={16} />}
                  রিকভারি সম্পন্ন / অনুরোধ পাঠান
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
