import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Shield, LogOut, Loader2, Download, MessageSquare, AlertCircle, Info, Megaphone
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, doc, onSnapshot, collection, query, where, orderBy, handleFirestoreError, OperationType } from "../firebase";
import { getSession, clearSession } from "../lib/auth";
import { NotificationCenter } from "../components/modular/NotificationCenter";
import { CadetProfileView } from "../components/cadet/CadetProfileView";
import { CadetProfile } from "../types";

export function UserDashboard() {
  const [user, setUser] = useState<CadetProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "user") {
      navigate("/login");
      return;
    }

    // Real-time listener for Cadet User document
    const docRef = doc(db, "applicants", session.id);
    const unsubUser = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as CadetProfile;
        setUser(data);
      } else {
        clearSession();
        navigate("/login");
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `applicants/${session.id}`);
      setLoading(false);
    });

    // Real-time notifications
    const notifQ = query(
      collection(db, "notifications"), 
      where("targetId", "in", [session.id, "ALL"]),
      orderBy("timestamp", "desc")
    );
    const unsubNotif = onSnapshot(notifQ, (snap) => {
      setNotifications(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubUser();
      unsubNotif();
    };
  }, [navigate]);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  if (loading) return (
    <div className="min-h-screen bg-[#020813] flex flex-col items-center justify-center space-y-4">
      <Loader2 className="w-12 h-12 text-amber-400 animate-spin" />
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Cadet Portal...</p>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#020813] text-slate-200">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-amber-500/20 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400">
              <Shield size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight text-white">BNCC Cadet Portal</h1>
              <p className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">Cadet Management & Profile System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/messenger")}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-2"
              title="Open Messenger"
            >
              <MessageSquare size={18} className="text-amber-400" />
              <span className="hidden sm:inline">Messenger</span>
            </button>

            <NotificationCenter notifications={notifications} />

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-red-500/20 group"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Broadcast Announcements Bar */}
      <AnimatePresence>
        {notifications.filter(n => n.type === "Announcement" || n.type === "Alert").length > 0 && (
          <div className="max-w-7xl mx-auto px-4 pt-6">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                <Megaphone size={16} />
                <span>Admin Announcements & Notices</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notifications.filter(n => n.type === "Announcement" || n.type === "Alert").slice(0, 2).map((notif: any) => (
                  <div 
                    key={notif.id} 
                    className={`p-4 rounded-2xl border ${
                      notif.type === 'Alert' 
                        ? 'bg-red-500/10 border-red-500/30 text-red-200' 
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-100'
                    } relative overflow-hidden`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <h4 className={`text-xs font-black uppercase tracking-tight ${notif.type === 'Alert' ? 'text-red-400' : 'text-amber-400'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {notif.timestamp?.toDate ? notif.timestamp.toDate().toLocaleDateString() : "Notice"}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">{notif.message}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Cadet Profile Dashboard View */}
      <main className="py-6">
        <CadetProfileView
          user={user}
          onProfileUpdated={(updated) => setUser(updated)}
        />
      </main>
    </div>
  );
}
