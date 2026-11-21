import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  LogOut,
  Loader2,
  MessageSquare,
  Megaphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  auth,
  db,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  reportFirestoreListenerError,
  OperationType,
} from "../firebase";
import { getSession, logoutEverywhere } from "../lib/auth";
import { isCadetRole } from "../lib/rbac";
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
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { user: authUser, firebaseUser, loading: authLoading, isImpersonating, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;

    const session = authUser || getSession();
    if (!session || (!isCadetRole(session.role) && !isImpersonating)) {
      navigate("/login");
      return;
    }

    if (!firebaseUser) {
      setDbError("ডেটাবেজ প্রোফাইল লোড করতে অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল ও পাসওয়ার্ড দিয়ে সাইন-ইন করুন।");
      setLoading(false);
      return;
    }

    setDbError(null);

    // Real-time listener for Cadet User document
    const docRef = doc(db, "applicants", session.id);
    const unsubUser = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as CadetProfile;
          setUser(data);
        } else {
          logoutEverywhere().then(() => navigate("/login"));
        }
        setLoading(false);
      },
      (err) => {
        reportFirestoreListenerError(err, OperationType.GET, `applicants/${session.id}`);
        setDbError("ক্যাডেট প্রোফাইল লোড করতে অনুমতি বা নেটওয়ার্ক সমস্যা হয়েছে।");
        setLoading(false);
      }
    );

    // Composite-index-free notification listeners aligned with firestore.rules
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

    const globalQ = query(
      collection(db, "notifications"),
      where("targetId", "==", "ALL")
    );
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
    const uid = firebaseUser.uid || auth.currentUser?.uid;
    if (uid) {
      const personalQ = query(
        collection(db, "notifications"),
        where("ownerUid", "==", uid)
      );
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
  }, [authLoading, firebaseUser?.uid, authUser?.id, isImpersonating, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

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
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 bg-[#C5A059] text-[#002147] font-black rounded-xl hover:bg-[#b59048] transition-all cursor-pointer"
          >
            লগইন পেজে যান
          </button>
          <button
            onClick={handleLogout}
            className="px-6 py-2.5 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all border border-white/15 cursor-pointer"
          >
            লগআউট
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

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
                BNCC Cadet Portal
              </h1>
              <p className="text-[10px] text-[#C5A059] font-extrabold uppercase tracking-widest">
                Cadet Management &amp; Profile System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/messenger")}
              className="p-2.5 bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl text-xs font-bold text-slate-100 hover:text-white transition-all flex items-center gap-2 cursor-pointer"
              title="Open Messenger"
            >
              <MessageSquare size={18} className="text-[#C5A059]" />
              <span className="hidden sm:inline">Messenger</span>
            </button>

            <NotificationCenter notifications={notifications} />

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/15 text-red-300 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-red-500/30 group cursor-pointer"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

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
        <CadetProfileView
          user={user}
          onProfileUpdated={(updated) => setUser(updated)}
        />
      </div>
    </div>
  );
}
