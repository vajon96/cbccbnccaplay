import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Shield,
  LogOut,
  Loader2,
  MessageSquare,
  Megaphone,
  UserPlus,
  ArrowRight,
  FileText,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Award,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  auth,
  db,
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  reportFirestoreListenerError,
  OperationType,
} from "../firebase";
import { getSession, setSession, logoutEverywhere } from "../lib/auth";
import { isCadetRole, normalizeRole } from "../lib/rbac";
import { useAuth } from "../context/AuthContext";
import { NotificationCenter } from "../components/modular/NotificationCenter";
import { CadetProfileView } from "../components/cadet/CadetProfileView";
import { CadetProfile } from "../types";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function UserDashboard() {
  useDocumentMeta({
    title: "Cadet Dashboard | Cox's Bazar City College BNCC Platoon",
    description: "Manage cadet profile, QR identification, admit card, and platoon notifications.",
  });
  const [user, setUser] = useState<CadetProfile | null>(null);
  const [portalProfile, setPortalProfile] = useState<{
    displayName?: string;
    email?: string;
    role?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationFeedback, setVerificationFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const {
    user: authUser,
    firebaseUser,
    loading: authLoading,
    emailVerified,
    isOfficialCadet,
    isImpersonating,
    resendVerificationEmail,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    const session = authUser || getSession();
    if (!session || (!isCadetRole(session.role) && !isImpersonating)) {
      navigate("/login");
      return;
    }

    if (!firebaseUser) {
      setDbError(
        "ডেটাবেজ প্রোফাইল লোড করতে অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন।"
      );
      setLoading(false);
      return;
    }

    setDbError(null);

    const uid = firebaseUser.uid || auth.currentUser?.uid || "";
    const targetApplicantId = isImpersonating
      ? session.id
      : session.applicantId || (session.id && session.id !== uid ? session.id : "");

    if (!isImpersonating && uid) {
      void getDoc(doc(db, "users", uid))
        .then((uSnap) => {
          if (uSnap.exists()) {
            setPortalProfile(uSnap.data() as any);
          } else {
            setPortalProfile({
              displayName: session.name || firebaseUser.displayName || "BNCC Portal User",
              email: session.email || firebaseUser.email || "",
              role: session.role || "user",
            });
          }
        })
        .catch(() => {
          setPortalProfile({
            displayName: session.name || firebaseUser.displayName || "BNCC Portal User",
            email: session.email || firebaseUser.email || "",
            role: session.role || "user",
          });
        });
    }

    let unsubUser = () => {};

    if (targetApplicantId && targetApplicantId !== uid) {
      const docRef = doc(db, "applicants", targetApplicantId);
      unsubUser = onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() } as CadetProfile;
            setUser(data);
          } else if (isImpersonating) {
            void logoutEverywhere().then(() => navigate("/login"));
          } else {
            setUser(null);
          }
          setLoading(false);
        },
        (err) => {
          reportFirestoreListenerError(err, OperationType.GET, `applicants/${targetApplicantId}`);
          setDbError("ক্যাডেট প্রোফাইল লোড করতে অনুমতি বা নেটওয়ার্ক সমস্যা হয়েছে।");
          setLoading(false);
        }
      );
    } else if (uid) {
      const ownedQ = query(collection(db, "applicants"), where("ownerUid", "==", uid));
      unsubUser = onSnapshot(
        ownedQ,
        (snap) => {
          if (!snap.empty) {
            const docSnap = snap.docs[0];
            const data = { id: docSnap.id, ...docSnap.data() } as CadetProfile;
            setUser(data);
            const appSt = String(data.status || "").toLowerCase();
            const derivedRole =
              appSt === "approved" || appSt === "joined" || data.role === "cadet"
                ? "cadet"
                : "user";
            if (
              session.id !== docSnap.id ||
              session.applicantId !== docSnap.id ||
              session.role !== derivedRole
            ) {
              setSession({
                ...session,
                id: docSnap.id,
                uid,
                applicantId: docSnap.id,
                registrationNumber: data.registrationNumber || docSnap.id,
                role: normalizeRole(derivedRole),
              });
            }
          } else {
            setUser(null);
          }
          setLoading(false);
        },
        (err) => {
          reportFirestoreListenerError(err, OperationType.LIST, "applicants");
          setDbError("ক্যাডেট প্রোফাইল লোড করতে অনুমতি বা নেটওয়ার্ক সমস্যা হয়েছে।");
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }

    let globalNotifs: any[] = [];
    let personalNotifs: any[] = [];

    const mergeAndSortNotifs = () => {
      const mergedMap = new Map<string, any>();
      [...globalNotifs, ...personalNotifs].forEach((n) => mergedMap.set(n.id, n));
      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const ta = a.timestamp?.toMillis?.() || 0;
        const tb = b.timestamp?.toMillis?.() || 0;
        return tb - ta;
      });
      setNotifications(sorted);
    };

    const globalQ = query(collection(db, "notifications"), where("targetId", "==", "ALL"));
    const unsubGlobal = onSnapshot(
      globalQ,
      (snap) => {
        globalNotifs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        mergeAndSortNotifs();
      },
      (err) => {
        reportFirestoreListenerError(err, OperationType.LIST, "notifications");
      }
    );

    let unsubPersonal = () => {};
    if (uid) {
      const personalQ = query(collection(db, "notifications"), where("ownerUid", "==", uid));
      unsubPersonal = onSnapshot(
        personalQ,
        (snap) => {
          personalNotifs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          mergeAndSortNotifs();
        },
        (err) => {
          reportFirestoreListenerError(err, OperationType.LIST, "notifications");
        }
      );
    }

    return () => {
      unsubUser();
      unsubGlobal();
      unsubPersonal();
    };
  }, [authLoading, firebaseUser?.uid, authUser?.id, authUser?.applicantId, isImpersonating, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    setVerificationFeedback(null);
    try {
      const res = await resendVerificationEmail();
      if (res.success) {
        setVerificationFeedback({
          type: "success",
          text: "ভেরিফিকেশন ইমেইল পাঠানো হয়েছে। ইনবক্স বা স্প্যাম ফোল্ডার যাচাই করুন।",
        });
      } else {
        setVerificationFeedback({
          type: "error",
          text: res.error || "ভেরিফিকেশন ইমেইল পাঠানো যায়নি।",
        });
      }
    } finally {
      setResendingVerification(false);
    }
  };

  const showEmailVerifyBanner = Boolean(firebaseUser && !emailVerified && !isImpersonating);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020B18] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-12 h-12 text-[#C5A059] animate-spin" />
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
          Loading Cadet Portal...
        </p>
      </div>
    );
  }

  if (dbError && !user) {
    return (
      <div className="min-h-screen bg-[#020B18] flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-16 h-16 bg-[#C5A059]/20 border border-[#C5A059]/40 rounded-2xl flex items-center justify-center text-[#C5A059]">
          <Shield size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">প্রবেশাধিকার যাচাই প্রয়োজন</h2>
        <p className="text-sm text-slate-300 max-w-md">{dbError}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="min-h-[44px] px-6 py-2.5 bg-[#C5A059] text-[#002147] font-black rounded-xl hover:bg-[#b59048] transition-all cursor-pointer"
          >
            লগইন পেজে যান
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-6 py-2.5 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/15 cursor-pointer"
          >
            লগআউট
          </button>
        </div>
      </div>
    );
  }

  const EmailVerificationNotice = showEmailVerifyBanner ? (
    <div className="max-w-7xl mx-auto px-4 pt-5">
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs">
            <p className="font-bold text-amber-200">
              আপনার ইমেইল এখনো যাচাই (Verified) হয়নি ({firebaseUser?.email})
            </p>
            <p className="text-amber-100/80">
              অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করতে আপনার ইনবক্সের ভেরিফিকেশন লিংকে ক্লিক করুন।
            </p>
            {verificationFeedback && (
              <p
                className={`pt-1 font-bold ${
                  verificationFeedback.type === "success" ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {verificationFeedback.text}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleResendVerification()}
          disabled={resendingVerification}
          className="min-h-[40px] px-4 py-2 bg-[#C5A059] hover:bg-[#d6b36c] text-[#002147] font-black text-xs rounded-xl shrink-0 disabled:opacity-50 cursor-pointer"
        >
          {resendingVerification ? "পাঠানো হচ্ছে..." : "ভেরিফিকেশন ইমেইল পুনরায় পাঠান"}
        </button>
      </div>
    </div>
  ) : null;

  if (!user) {
    const activeSession = authUser || getSession();
    const displayName =
      portalProfile?.displayName ||
      activeSession?.name ||
      firebaseUser?.displayName ||
      "BNCC Portal Member";
    const displayEmail =
      portalProfile?.email || activeSession?.email || firebaseUser?.email || "";

    return (
      <div className="min-h-screen bg-[#020B18] text-slate-200">
        <header className="bg-[#002147]/95 border-b border-[#C5A059]/30 sticky top-0 z-30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-[#C5A059]/20 border border-[#C5A059]/40 rounded-2xl flex items-center justify-center text-[#C5A059]">
                <Shield size={22} />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight text-white">
                  BNCC Applicant Portal
                </h1>
                <p className="text-[10px] text-[#C5A059] font-extrabold uppercase tracking-widest">
                  Portal Member Account • Unlinked
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/messenger")}
                className="min-h-[44px] p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold text-slate-100 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
                title="Open Messenger"
              >
                <MessageSquare size={18} className="text-[#C5A059]" />
                <span className="hidden sm:inline">Messenger</span>
              </button>

              <NotificationCenter notifications={notifications} />

              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 bg-red-500/15 text-red-300 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-red-500/30 group cursor-pointer"
              >
                <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </header>

        {EmailVerificationNotice}

        <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-[#061830] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Applicant Portal Account • Enrollment Pending
                </span>
                <h2 className="text-2xl font-black text-white pt-1">{displayName}</h2>
                {displayEmail && (
                  <p className="text-xs text-slate-300 flex items-center gap-1.5">
                    <Mail size={13} className="text-[#C5A059]" />
                    <span>{displayEmail}</span>
                  </p>
                )}
              </div>
              <Link
                to="/enroll"
                className="min-h-[44px] px-5 py-3 bg-[#C5A059] hover:bg-[#d6b36c] text-[#002147] font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all"
              >
                <UserPlus size={16} />
                <span>নতুন ভর্তি আবেদন করুন</span>
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="p-5 rounded-2xl bg-[#020B18] border border-white/10 space-y-2 text-sm text-slate-300">
              <p className="font-bold text-white flex items-center gap-2">
                <FileText size={16} className="text-[#C5A059]" />
                আপনার পোর্টাল অ্যাকাউন্টের সাথে এখনো কোনো ক্যাডেট/ভর্তি আবেদন যুক্ত নেই
              </p>
              <p className="text-xs leading-relaxed text-slate-400">
                নতুন ক্যাডেট হিসেবে আবেদন করতে উপরের{" "}
                <strong className="text-white">&ldquo;নতুন ভর্তি আবেদন করুন&rdquo;</strong> বাটনে
                ক্লিক করুন। ইতিমধ্যে আবেদন করে থাকলে আপনার লগইন পেজ থেকে Cadet / Applicant ID
                লিঙ্ক করতে পারবেন।
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                to="/exam/dashboard"
                className="min-h-[44px] inline-flex items-center px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-bold text-white transition-all"
              >
                Exam Portal
              </Link>
              <Link
                to="/notices"
                className="min-h-[44px] inline-flex items-center px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-xs font-bold text-white transition-all"
              >
                Notice Board
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const appStatusLower = String(user.status || "").toLowerCase();
  const isApprovedCadet =
    isOfficialCadet ||
    appStatusLower === "approved" ||
    appStatusLower === "joined" ||
    user.role === "cadet";

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-200">
      {/* Top Header */}
      <header className="bg-[#002147]/95 border-b border-[#C5A059]/30 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#C5A059]/20 border border-[#C5A059]/40 rounded-2xl flex items-center justify-center text-[#C5A059]">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight text-white">
                {isApprovedCadet ? "BNCC Cadet Portal" : "BNCC Applicant Portal"}
              </h1>
              <p className="text-[10px] text-[#C5A059] font-extrabold uppercase tracking-widest">
                {isApprovedCadet
                  ? "Official Inducted Cadet Profile"
                  : "Admission Applicant Profile"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/messenger")}
              className="min-h-[44px] p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold text-slate-100 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              title="Open Messenger"
            >
              <MessageSquare size={18} className="text-[#C5A059]" />
              <span className="hidden sm:inline">Messenger</span>
            </button>

            <NotificationCenter notifications={notifications} />

            <button
              type="button"
              onClick={handleLogout}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 bg-red-500/15 text-red-300 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-red-500/30 group cursor-pointer"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {EmailVerificationNotice}

      {/* Account Classification Banner (Applicant vs Inducted Cadet) */}
      <div className="max-w-7xl mx-auto px-4 pt-5">
        <div
          className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
            isApprovedCadet
              ? "bg-emerald-500/10 border-emerald-500/30"
              : appStatusLower === "rejected"
              ? "bg-rose-500/10 border-rose-500/30"
              : "bg-sky-500/10 border-sky-500/30"
          }`}
        >
          <div className="flex items-center gap-3">
            {isApprovedCadet ? (
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            ) : (
              <Award size={20} className="text-[#C5A059] shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-bold text-white">
                {isApprovedCadet
                  ? "অনুমোদিত ক্যাডেট স্ট্যাটাস (Official BNCC Cadet)"
                  : appStatusLower === "rejected"
                  ? "আবেদন স্ট্যাটাস: বাতিলকৃত (Applicant Account)"
                  : "আবেদনকারী স্ট্যাটাস: যাচাইয়ের অপেক্ষায় (Pending Applicant)"}
              </p>
              <p className="text-slate-300 mt-0.5">
                {isApprovedCadet
                  ? "আপনার ভর্তি আবেদন অনুমোদিত হয়েছে; পূর্ণাঙ্গ ক্যাডেট প্রোফাইল, QR আইডি ও মেসেঞ্জার সক্রিয় রয়েছে।"
                  : "আপনার আবেদন এখনো অ্যাডমিন অনুমোদনের অপেক্ষায় রয়েছে। অনুমোদন সম্পন্ন হলে ক্যাডেট রোল ও পূর্ণাঙ্গ সুযোগ সক্রিয় হবে।"}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider ${
              isApprovedCadet
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : appStatusLower === "rejected"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}
          >
            {isApprovedCadet ? "CADET • APPROVED" : `APPLICANT • ${user.status || "Pending"}`}
          </span>
        </div>
      </div>

      {/* Admin Broadcast Announcements Bar */}
      <AnimatePresence>
        {notifications.filter((n) => n.type === "Announcement" || n.type === "Alert").length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pt-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-[#C5A059] text-xs font-black uppercase tracking-wider">
                <Megaphone size={16} />
                <span>Admin Announcements &amp; Notices</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notifications
                  .filter((n) => n.type === "Announcement" || n.type === "Alert")
                  .slice(0, 2)
                  .map((notif: any) => (
                    <div
                      key={notif.id}
                      className={`p-4 rounded-2xl border ${
                        notif.type === "Alert"
                          ? "bg-red-500/10 border-red-500/30 text-red-200"
                          : "bg-[#C5A059]/10 border-[#C5A059]/30 text-amber-100"
                      } relative overflow-hidden`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <h4
                          className={`text-xs font-black uppercase tracking-tight ${
                            notif.type === "Alert" ? "text-red-300" : "text-[#C5A059]"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-slate-300 font-bold tabular-nums">
                          {notif.timestamp?.toDate
                            ? notif.timestamp.toDate().toLocaleDateString()
                            : "Notice"}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-200">{notif.message}</p>
                    </div>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Cadet Profile Dashboard View */}
      <div className="py-6">
        <CadetProfileView user={user} onProfileUpdated={(updated) => setUser(updated)} />
      </div>
    </div>
  );
}
