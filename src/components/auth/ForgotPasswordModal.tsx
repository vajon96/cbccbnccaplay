import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, Mail, Shield, Send, User, Phone } from "lucide-react";
import {
  auth,
  db,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  Timestamp,
} from "../../firebase";
import {
  requestEmailPasswordReset,
  submitOfficerPasswordResetRequest,
  hashPassword,
} from "../../lib/auth";
import { AuthInput, PasswordInput, AuthLoadingButton } from "./AuthInputs";
import { AuthErrorMessage, AuthSuccessMessage, SecurityNotice } from "./AuthFeedback";

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userId: string) => void;
  initialTab?: "email" | "officer";
}

/**
 * Dual-mode Password Recovery Modal:
 * 1. Email Password Reset Link (supports Email+Password accounts and legacy Google-created accounts setting a password)
 * 2. Officer-Assisted Recovery Request (works both authenticated and unauthenticated via backend rate-limited queue)
 */
export function ForgotPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  initialTab = "email",
}: ForgotPasswordModalProps) {
  const [tab, setTab] = useState<"email" | "officer">(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [resetEmail, setResetEmail] = useState("");
  const [applicantId, setApplicantId] = useState("");
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reasonNote, setReasonNote] = useState("");

  const isSignedInOwner = Boolean(auth.currentUser);

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
      "যদি এই ইমেইল ঠিকানায় অ্যাকাউন্ট নিবন্ধিত থাকে, তবে পাসওয়ার্ড রিসেট / সেটআপ লিংক পাঠানো হয়েছে। অনুগ্রহ করে ইনবক্স ও স্প্যাম ফোল্ডার পরীক্ষা করুন।"
    );
    setTimeout(() => {
      onSuccess(resetEmail.trim());
      onClose();
    }, 2400);
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

    setLoading(true);
    try {
      // Authenticated owner can directly update password if desired
      if (auth.currentUser && newPassword.length > 0) {
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
        try {
          const snap = await getDoc(doc(db, "applicants", cleanId));
          if (snap.exists() && snap.data().ownerUid === auth.currentUser.uid) {
            const hashed = await hashPassword(newPassword);
            await updateDoc(doc(db, "applicants", cleanId), {
              passwordHash: hashed,
              updatedAt: Timestamp.now(),
            });
            await addDoc(collection(db, "activity_logs"), {
              type: "PASSWORD_CHANGED",
              targetId: cleanId,
              actorId: auth.currentUser.uid,
              ownerUid: auth.currentUser.uid,
              timestamp: Timestamp.now(),
              details: `Authenticated owner ${auth.currentUser.email || auth.currentUser.uid} updated password.`,
            }).catch(() => {});
            setSuccess("আপনার পাসওয়ার্ড সফলভাবে আপডেট হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
            setTimeout(() => {
              onSuccess(cleanId);
              onClose();
            }, 1800);
            return;
          }
        } catch {
          // Fall through to officer-assisted queue submission
        }
      }

      if (!registeredPhone.trim() || registeredPhone.trim().length < 6) {
        setError("অফিসার-সহায়তা রিকোয়েস্টের জন্য নিবন্ধিত মোবাইল নম্বর প্রদান করুন।");
        setLoading(false);
        return;
      }

      // Unauthenticated or non-owner safe backend submission (never requires login, never leaks PII)
      const apiRes = await submitOfficerPasswordResetRequest({
        identifier: cleanId,
        mobile: registeredPhone.trim(),
        note: reasonNote.trim(),
      });

      if (!apiRes.success) {
        setError(apiRes.error || "রিকভারি অনুরোধ জমা দেওয়া যায়নি।");
        return;
      }

      setSuccess(
        "নিরাপদ রিকভারি অনুরোধ অ্যাডমিন প্যানেলে পাঠানো হয়েছে। প্লাটুন অফিসার আপনার মোবাইল নম্বর যাচাই করে নতুন অস্থায়ী পাসওয়ার্ড প্রদান করবেন।"
      );
      setTimeout(() => {
        onSuccess(cleanId);
        onClose();
      }, 2400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-modal-title"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#020B18]/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden z-10"
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#002147] via-[#C5A059] to-[#002147]" />

            <div className="p-6 sm:p-7 space-y-5">
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#002147] rounded-xl flex items-center justify-center shrink-0">
                    <Key className="w-5 h-5 text-[#C5A059]" />
                  </div>
                  <div>
                    <h3 id="forgot-modal-title" className="text-lg font-extrabold text-[#002147]">
                      পাসওয়ার্ড রিকভারি
                    </h3>
                    <p className="text-xs text-[#64748B]">
                      Email Reset Link &amp; Officer Assistance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#64748B] hover:text-[#002147] hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                  aria-label="Close password recovery modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Recovery method"
                className="grid grid-cols-2 p-1 rounded-xl bg-[#F5F7FA] border border-slate-200 gap-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "email"}
                  onClick={() => {
                    setTab("email");
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`min-h-[40px] py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === "email"
                      ? "bg-[#002147] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#002147]"
                  }`}
                >
                  <Mail size={14} />
                  <span>ইমেইল লিংক</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "officer"}
                  onClick={() => {
                    setTab("officer");
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`min-h-[40px] py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    tab === "officer"
                      ? "bg-[#002147] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#002147]"
                  }`}
                >
                  <Shield size={14} />
                  <span>অফিসার সহায়তা</span>
                </button>
              </div>

              <AuthErrorMessage message={error} />
              <AuthSuccessMessage message={success} />

              {tab === "email" ? (
                <form onSubmit={handleSendEmailReset} className="space-y-4">
                  <SecurityNotice title="Legacy Google Account Migration">
                    পূর্বে Google দিয়ে অ্যাকাউন্ট খুলে থাকলে, আপনার সেই একই ইমেইল দিয়ে এখানে পাসওয়ার্ড সেটআপ/রিসেট লিংক পাঠিয়ে নতুন পাসওয়ার্ড সেট করে সরাসরি সাইন-ইন করতে পারবেন।
                  </SecurityNotice>

                  <AuthInput
                    id="forgot-email-input"
                    type="email"
                    label="নিবন্ধিত ইমেইল ঠিকানা *"
                    icon={<Mail size={16} />}
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="cadet@example.com"
                    autoComplete="email"
                    required
                  />

                  <AuthLoadingButton
                    type="submit"
                    loading={loading}
                    loadingText="পাঠানো হচ্ছে..."
                    icon={<Send size={15} />}
                  >
                    রিসেট লিংক পাঠান
                  </AuthLoadingButton>
                </form>
              ) : (
                <form onSubmit={handleSubmitOfficerRecovery} className="space-y-3.5">
                  <AuthInput
                    id="forgot-cadet-id"
                    type="text"
                    label="ক্যাডেট / আবেদন আইডি অথবা রেজিস্ট্রেশন নম্বর *"
                    icon={<User size={16} />}
                    value={applicantId}
                    onChange={(e) => setApplicantId(e.target.value)}
                    placeholder="যেমন: 1111"
                    required
                  />

                  <AuthInput
                    id="forgot-mobile-input"
                    type="tel"
                    label="নিবন্ধিত মোবাইল নম্বর *"
                    icon={<Phone size={16} />}
                    value={registeredPhone}
                    onChange={(e) => setRegisteredPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    required
                  />

                  {isSignedInOwner && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <PasswordInput
                        id="forgot-new-pw"
                        label="নতুন পাসওয়ার্ড (ঐচ্ছিক)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="ন্যূনতম ৬ অক্ষর"
                        autoComplete="new-password"
                      />
                      <PasswordInput
                        id="forgot-confirm-pw"
                        label="পাসওয়ার্ড নিশ্চিত করুন"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="পুনরায় দিন"
                        autoComplete="new-password"
                      />
                    </div>
                  )}

                  <AuthInput
                    id="forgot-note-input"
                    type="text"
                    label="মন্তব্য / সহায়তার তথ্য (ঐচ্ছিক)"
                    value={reasonNote}
                    onChange={(e) => setReasonNote(e.target.value)}
                    placeholder="অফিসারের জন্য সংক্ষিপ্ত বার্তা"
                  />

                  <AuthLoadingButton
                    type="submit"
                    loading={loading}
                    loadingText="জমা দেওয়া হচ্ছে..."
                    icon={<Send size={15} />}
                  >
                    অফিসারের কাছে অনুরোধ পাঠান
                  </AuthLoadingButton>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
