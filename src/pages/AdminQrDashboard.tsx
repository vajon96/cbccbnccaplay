import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scan, LogOut, Shield, QrCode, Camera, CheckCircle, XCircle, 
  User, Clock, Loader2, Award, Calendar, AlertCircle, Edit, Save, Plus, HelpCircle
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { 
  db, doc, updateDoc, getDoc, getDocs, setDoc, query, where, collection, Timestamp,
  onSnapshot, handleFirestoreError, OperationType 
} from "../firebase";
import { getSession, clearSession } from "../lib/auth";

export function AdminQrDashboard() {
  const [adminSession, setAdminSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(true);
  const [scannedCadet, setScannedCadet] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Daily attendance statistics state
  const [cadets, setCadets] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<{[key: string]: any}>({});
  const [batchFilter, setBatchFilter] = useState("All");
  
  // Physical editing fields
  const [editingPhysical, setEditingPhysical] = useState(false);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [updatingPhysical, setUpdatingPhysical] = useState(false);
  
  // Cadet verification extra fields state
  const [cadetHistory, setCadetHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Verifying session on load
  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "super_admin" && session.role !== "sub_admin" && session.role !== "attendance_officer" && session.role !== "qr_admin")) {
      navigate("/login");
      return;
    }
    setAdminSession(session);
    setLoading(false);
  }, [navigate]);

  // Load cadet attendance history on scan
  useEffect(() => {
    if (!scannedCadet) {
      setCadetHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const historyList: any[] = [];
        const subRef = collection(db, "applicants", scannedCadet.id, "attendance_history");
        const snap = await getDocs(subRef);
        snap.forEach(doc => {
          historyList.push({ id: doc.id, ...doc.data() });
        });
        
        historyList.sort((a, b) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
        setCadetHistory(historyList);
      } catch (err) {
        console.error("Fetch history query failure:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [scannedCadet]);

  // Real-time listener for cadets (applicants) and daily attendance records
  useEffect(() => {
    if (loading || !adminSession) return;

    // Listen to cadets
    const cadetsRef = collection(db, "applicants");
    const unsubCadets = onSnapshot(cadetsRef, (snap) => {
      const cadetsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCadets(cadetsList);
    });

    // Listen to today's attendance logs
    // Path matches: attendance/{date}/records/{cadetId}
    const attendanceRef = collection(db, "attendance", todayStr, "records");
    const unsubAttendance = onSnapshot(attendanceRef, (snap) => {
      const attMap: {[key: string]: any} = {};
      snap.docs.forEach(doc => {
        attMap[doc.id] = doc.data();
      });
      setTodayAttendance(attMap);
    });

    return () => {
      unsubCadets();
      unsubAttendance();
    };
  }, [loading, adminSession, todayStr]);

  // Initializing the camera scanner with safe DOM checking
  useEffect(() => {
    if (loading || !scannerActive || scannedCadet) return;

    let isActive = true;
    let scanner: Html5QrcodeScanner | null = null;

    const initScanner = () => {
      if (!isActive) return;
      const targetElement = document.getElementById("reader-admin-dashboard");
      if (!targetElement) {
        // Retry shortly if the element isn't in the DOM yet
        setTimeout(initScanner, 50);
        return;
      }

      try {
        scanner = new Html5QrcodeScanner(
          "reader-admin-dashboard",
          { fps: 15, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        const onScanSuccess = async (decodedText: string) => {
          if (!isActive) return;
          let cadetId = "";
          try {
            // Handle JSON or raw text
            const data = JSON.parse(decodedText);
            cadetId = data.id || data.roll || decodedText;
          } catch (e) {
            cadetId = decodedText;
          }

          if (!cadetId) return;

          try {
            // Fetch cadet details from applicants
            const docRef = doc(db, "applicants", cadetId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const cadetData = docSnap.data();
              setScannedCadet({ id: cadetId, ...cadetData });
              
              // Pre-populate physical fields
              setHeight(cadetData.height || "");
              setWeight(cadetData.weight || "");
              
              setSuccess("ক্যাডেট তথ্য সফলভাবে পাওয়া গেছে!");
              setTimeout(() => setSuccess(null), 3000);
              
              // Audio alert
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav");
              audio.play().catch(() => {});
            } else {
              setError(`ক্যাডেট আইডি ${cadetId} পাওয়া যায়নি!`);
              setTimeout(() => setError(null), 4000);
            }
          } catch (err) {
            console.error("Scan profile lookup failed:", err);
          }
        };

        scanner.render(onScanSuccess, () => {});
      } catch (err) {
        console.error("Scanner initialization failed in AdminQrDashboard:", err);
      }
    };

    // Slight initial deferral to ensure elements are mounted in the browser render tree
    const timer = setTimeout(initScanner, 100);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (scanner) {
        try {
          scanner.clear().catch(error => console.error("Scanner clear on AdminQrDashboard error", error));
        } catch (e) {
          console.error("Error during scanner cleanup:", e);
        }
      }
    };
  }, [loading, scannerActive, scannedCadet]);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const handleMarkAttendance = async (status: "Present" | "Absent" | "Late") => {
    if (!scannedCadet) return;
    const path = `attendance/${todayStr}/records/${scannedCadet.id}`;
    
    try {
      // Save in attendance sub-collection for structured querying
      const attDocRef = doc(db, "attendance", todayStr, "records", scannedCadet.id);
      await setDoc(attDocRef, {
        cadetName: scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla,
        status,
        timestamp: Timestamp.now()
      });

      // Also update overall quick status inside cadet's main document as a fallback reference
      const cadetRef = doc(db, "applicants", scannedCadet.id);
      await updateDoc(cadetRef, {
        attendanceStatus: status,
        attendanceTime: Timestamp.now()
      });

      // Save into student personal history collection
      const histDocRef = doc(db, "applicants", scannedCadet.id, "attendance_history", todayStr);
      await setDoc(histDocRef, {
        date: todayStr,
        status,
        timestamp: Timestamp.now()
      });

      setSuccess(`ক্যাডেট ${scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla} কে "${status}" হিসেবে চিহ্নিত করা হয়েছে।`);
      setScannedCadet(null);
      setEditingPhysical(false);
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Mark attendance error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleUpdatePhysical = async () => {
    if (!scannedCadet) return;
    setUpdatingPhysical(true);

    try {
      const cadetRef = doc(db, "applicants", scannedCadet.id);
      await updateDoc(cadetRef, {
        height: height.trim() || null,
        weight: weight.trim() || null
      });

      // Update scanned cadet local state as well
      setScannedCadet(prev => ({
        ...prev,
        height: height.trim() || null,
        weight: weight.trim() || null
      }));

      setSuccess("শারীরিক তথ্য সফলভাবে আপডেট করা হয়েছে!");
      setEditingPhysical(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Update physical measurements failed:", err);
      setError("শারীরিক তথ্য আপডেট করতে সমস্যা হয়েছে।");
    } finally {
      setUpdatingPhysical(false);
    }
  };

  // Compute stats based on the batch filter
  const filteredCadets = cadets.filter(c => {
    if (batchFilter === "All") return true;
    return c.academicYear === batchFilter || c.studyStatus === batchFilter;
  });

  const totalCadetsCount = filteredCadets.length;
  const presentTodayCount = filteredCadets.filter(c => todayAttendance[c.id]?.status === "Present" || todayAttendance[c.id]?.status === "Late").length;
  const absentTodayCount = totalCadetsCount - presentTodayCount;

  // Extract unique batches and groups for the batch-filter dropdown
  const batches = Array.from(new Set(cadets.map(c => c.academicYear || c.studyStatus).filter(Boolean)));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white space-y-4 flex-col">
        <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">লোডিং হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Ribbon */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-slate-900 border border-white/5 p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-inner">
              <Award className="w-8 h-8 text-rose-500 animate-bounce" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
                QR অ্যাডমিন ড্যাশবোর্ড <span className="bg-rose-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">ACTIVE</span>
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                Cox's Bazar City College BNCC Platoon • Role: {adminSession?.role?.replace("_", " ")}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">ব্যবহারকারী</p>
              <p className="text-sm font-bold text-white">{adminSession?.name || "QR Admin"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-3 bg-red-500/10 text-red-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all border border-red-500/20 flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer shadow-lg"
              title="লগআউট"
            >
              <LogOut className="w-4 h-4" /> লগআউট
            </button>
          </div>
        </div>

        {/* Real-time Statistics Counter Grid */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-black uppercase tracking-widest text-xs text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-rose-500" /> আজকের এটেনডেন্স স্থিতি ({todayStr})
            </h3>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-400">ব্যাচ ফিল্টার:</span>
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-300 font-bold text-xs rounded-xl px-4 py-2 outline-none cursor-pointer focus:border-rose-500"
              >
                <option value="All">সকল ক্যাডেট</option>
                {batches.map((batch) => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 bg-slate-950 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute right-4 top-4 text-slate-800 font-black text-6xl select-none pointer-events-none">T</div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">মোট ক্যাডেট</p>
              <p className="text-3xl font-black text-white">{totalCadetsCount}</p>
            </div>
            <div className="p-5 bg-slate-950 rounded-2xl border border-emerald-500/10 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute right-4 top-4 text-emerald-950 font-black text-6xl select-none pointer-events-none">P</div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">আজ উপস্থিত</p>
              <p className="text-3xl font-black text-emerald-400">{presentTodayCount}</p>
            </div>
            <div className="p-5 bg-slate-950 rounded-2xl border border-rose-500/10 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute right-4 top-4 text-rose-950 font-black text-6xl select-none pointer-events-none">A</div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">আজ অনুপস্থিত</p>
              <p className="text-3xl font-black text-rose-400">{absentTodayCount}</p>
            </div>
            <div className="p-5 bg-slate-950 rounded-2xl border border-violet-500/10 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute right-4 top-4 text-violet-950 font-black text-6xl select-none pointer-events-none">%</div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">উপস্থিতির হার</p>
              <p className="text-3xl font-black text-violet-400">
                {totalCadetsCount > 0 ? Math.round((presentTodayCount / totalCadetsCount) * 100) : 0}%
              </p>
            </div>
          </div>
        </div>

        {/* Toast Notification for scanning results */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2"
            >
              <CheckCircle size={15} /> {success}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center text-red-400 text-xs font-bold flex items-center justify-center gap-2"
            >
              <AlertCircle size={15} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Camera Scanner & Quick View Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Scanner view */}
          <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 space-y-6 flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30">
                <Camera className="w-5 h-5 text-rose-500 animate-pulse" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">লাইভ এটেনডেন্স স্ক্যানার</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto Detects Cadet QR Admit Cards</p>
              </div>
            </div>
            
            <div className="relative">
              {!scannedCadet ? (
                <div className="overflow-hidden rounded-3xl border-4 border-rose-500 bg-black shadow-2xl relative">
                  <div id="reader-admin-dashboard" className="w-full" />
                </div>
              ) : (
                <div className="h-64 rounded-3xl border-2 border-slate-800 bg-slate-950 flex flex-col items-center justify-center space-y-4">
                  <QrCode className="w-16 h-16 text-slate-600 animate-pulse" />
                  <p className="text-xs text-slate-500 font-bold">স্ক্যান্ড ক্যাডেট বর্তমানে প্রসেস করা হচ্ছে</p>
                  <button 
                    onClick={() => {
                      setScannedCadet(null);
                      setEditingPhysical(false);
                    }}
                    className="px-6 py-2.5 bg-rose-500 text-white font-bold text-xs rounded-xl uppercase hover:bg-rose-600 transition-all shadow-lg cursor-pointer"
                  >
                    নতুন ক্যাডেট স্ক্যান করুন
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-center gap-2.5 text-rose-400 font-bold bg-rose-500/5 border border-rose-500/15 py-3.5 rounded-2xl">
              <Scan className="w-4 h-4 animate-spin" />
              <p className="text-xs uppercase tracking-wider">ক্যামেরা অথবা বারকোড রিডারে ধরুন</p>
            </div>
          </div>

          {/* Quick profile info results & and physical configuration adjustments */}
          <div className="flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!scannedCadet ? (
                <motion.div
                  key="empty-cadet"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-900/40 rounded-[2.5rem] border border-white/5 border-dashed space-y-4 min-h-[350px]"
                >
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border border-white/5">
                    <User className="w-10 h-10 text-slate-800" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-400 uppercase tracking-tight">অপেক্ষমাণ স্থিতি</h3>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-1">প্রোফাইল ফেচ করতে দয়া করে কোড স্ক্যান করুন</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="active-cadet"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="p-8 rounded-[2.5rem] bg-slate-900 border border-white/5 space-y-6 relative overflow-hidden"
                >
                  {/* Status Tag */}
                  <div className="absolute top-6 right-6">
                    <span className="px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                      CADET
                    </span>
                  </div>

                  {/* Profile Info Details */}
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden border-4 border-rose-500 shrink-0 shadow-xl bg-slate-950">
                      {scannedCadet.photo ? (
                        <img src={scannedCadet.photo} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-12 h-12 text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="text-center sm:text-left space-y-1">
                      <h3 className="text-xl font-black text-white">{scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla}</h3>
                      <p className="text-xs font-bold text-slate-500">ক্যাডেট আইডি: <span className="font-mono text-rose-500">{scannedCadet.id}</span></p>
                      <p className="text-xs font-bold text-slate-400">শ্রেণি রোল: {scannedCadet.classRoll || "N/A"}</p>
                    </div>
                  </div>

                  {/* Academic info grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">গ্রুপ / বিভাগ</p>
                      <p className="text-sm font-bold text-white">{scannedCadet.studyStatus || "N/A"}</p>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-1">
                      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">শিক্ষাবর্ষ (Session)</p>
                      <p className="text-sm font-bold text-white">{scannedCadet.academicYear || "N/A"}</p>
                    </div>
                  </div>

                  {/* Optional Physical Fields */}
                  <div className="p-5 bg-slate-950 rounded-3xl border border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase text-rose-500 font-black tracking-widest">শারীরিক পরিমাপ (Physical Measurements)</h4>
                      {adminSession?.role !== "attendance_officer" && (
                        <button
                          onClick={() => setEditingPhysical(!editingPhysical)}
                          className="flex items-center gap-1 text-[10px] uppercase font-black text-rose-400 hover:text-rose-300 transition-colors bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 cursor-pointer"
                        >
                          <Edit size={11} /> {editingPhysical ? "বাতিল" : "এডিট করুন"}
                        </button>
                      )}
                    </div>

                    {!editingPhysical ? (
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                          <p className="text-[9px] uppercase text-slate-500 font-bold">উচ্চতা / Height</p>
                          <p className="text-base font-bold text-white mt-1">{scannedCadet.height ? `${scannedCadet.height} cm` : "N/A"}</p>
                        </div>
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                          <p className="text-[9px] uppercase text-slate-500 font-bold">ওজন / Weight</p>
                          <p className="text-base font-bold text-white mt-1">{scannedCadet.weight ? `${scannedCadet.weight} kg` : "N/A"}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 items-end">
                        <div className="space-y-1.5 text-left">
                          <label className="text-[9px] uppercase text-slate-500 font-bold ml-1">উচ্চতা (cm)</label>
                          <input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500"
                            placeholder="যেমন: ১৭৫"
                          />
                        </div>
                        <div className="space-y-1.5 text-left">
                          <label className="text-[9px] uppercase text-slate-500 font-bold ml-1">ওজন (kg)</label>
                          <input
                            type="number"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-rose-500"
                            placeholder="যেমন: ৬৫"
                          />
                        </div>
                        <button
                          onClick={handleUpdatePhysical}
                          disabled={updatingPhysical}
                          className="col-span-2 py-3 bg-rose-500 hover:bg-rose-600 border border-rose-500/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-500/10"
                        >
                          {updatingPhysical ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                          পরিমাপ সংরক্ষণ করুন
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Attendance Controls */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase text-slate-400 font-black tracking-widest ml-1">ক্যাডেট এটেনডেন্স নির্ধারণ</h4>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { label: "PRESENT (উপস্থিত)", status: "Present" as const, color: "bg-emerald-500 shadow-emerald-500/15" },
                        { label: "LATE (বিলম্বিত)", status: "Late" as const, color: "bg-amber-500 shadow-amber-500/15" },
                        { label: "ABSENT (অনুপস্থিত)", status: "Absent" as const, color: "bg-rose-500 shadow-rose-500/15" }
                      ].map((btn) => (
                        <button
                          key={btn.status}
                          onClick={() => handleMarkAttendance(btn.status)}
                          className={`py-3.5 px-2 text-[10px] font-black uppercase tracking-wider rounded-xl text-white transition-all shadow-lg hover:brightness-110 active:scale-95 cursor-pointer ${btn.color}`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Cadet Verification Sheet */}
                  <div className="p-5 bg-slate-950 rounded-3xl border border-white/5 space-y-4">
                    <h4 className="text-[10px] uppercase text-rose-500 font-black tracking-widest">ক্যাডেট প্রোফাইল ও ভেরিফিকেশন ফাইল (Full Profile Sheet)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-300">
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">বাবার নাম (Father's Name)</p>
                        <p className="text-white font-normal">{scannedCadet.fatherNameEnglish || scannedCadet.fatherNameBangla || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">মায়ের নাম (Mother's Name)</p>
                        <p className="text-white font-normal">{scannedCadet.motherNameEnglish || scannedCadet.motherNameBangla || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">মোবাইল নম্বর (Student Phone)</p>
                        <p className="text-rose-500 font-mono font-medium">{scannedCadet.studentPhone || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">ইমেইল (Student Email)</p>
                        <p className="text-white select-all font-mono font-medium">{scannedCadet.studentEmail || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">রক্তের গ্রুপ (Blood Group)</p>
                        <p className="text-rose-500 font-black uppercase text-sm">{scannedCadet.bloodGroup || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">জন্ম তারিখ (Date of Birth)</p>
                        <p className="text-white font-mono font-medium">{scannedCadet.dob || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">বর্তমান ঠিকানা (Present Address)</p>
                        <p className="text-white leading-relaxed text-[11px] font-normal">{scannedCadet.presentAddress || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">স্থায়ী ঠিকানা (Permanent Address)</p>
                        <p className="text-white leading-relaxed text-[11px] font-normal">{scannedCadet.permanentAddress || "N/A"}</p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">আবেদনের স্থিতি (Status)</p>
                        <p className="text-white font-black uppercase">
                          <span className={`px-2.5 py-1 text-[9px] rounded-full text-white ${scannedCadet.approvalStatus === "Approved" || scannedCadet.status === "Approved" ? "bg-emerald-500 animate-pulse" : "bg-amber-600"}`}>
                            {scannedCadet.approvalStatus || scannedCadet.status || "Pending"}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-2 p-3 bg-slate-900 rounded-xl border border-white/5">
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">ধর্ম ও লিঙ্গ</p>
                        <p className="text-white text-xs">{scannedCadet.religion || "N/A"} | {scannedCadet.gender || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Attendance History Section */}
                  <div className="p-5 bg-slate-950 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] uppercase text-rose-500 font-black tracking-widest">এটেনডেন্স ইতিহাস ও পরিসংখ্যান (Attendance Ledger)</h4>
                      <span className="px-2.5 py-1 text-[9px] font-black text-rose-400 bg-rose-500/10 rounded-full border border-rose-500/10">
                        মোট উপস্থিত: {cadetHistory.filter(h => h.status === "Present" || h.status === "Late").length} দিন
                      </span>
                    </div>

                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="animate-spin text-rose-500 w-6 h-6" />
                      </div>
                    ) : cadetHistory.length === 0 ? (
                      <p className="text-center text-[11px] font-bold text-slate-600 py-4">কোন এটেনডেন্স রেকর্ড পাওয়া যায়নি।</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto divide-y divide-white/5 pr-1.5 no-scrollbar space-y-1">
                        {cadetHistory.map((hist) => (
                          <div key={hist.id || hist.date} className="flex items-center justify-between py-2 text-xs">
                            <div className="flex items-center gap-2">
                              <Calendar size={13} className="text-slate-600" />
                              <span className="font-bold font-mono text-slate-400">{hist.date}</span>
                            </div>
                            <span className={`px-2.5 py-0.5 text-[9px] rounded-full font-black uppercase ${
                              hist.status === "Present" ? "bg-emerald-500/25 text-emerald-400" :
                              hist.status === "Late" ? "bg-amber-500/25 text-amber-400" :
                              "bg-rose-500/25 text-rose-400"
                            }`}>
                              {hist.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Skip Button */}
                  <button
                    onClick={() => {
                      setScannedCadet(null);
                      setEditingPhysical(false);
                    }}
                    className="w-full py-3.5 bg-slate-950 border border-white/5 text-slate-500 font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    স্ক্যান বাতিল করূন / পরবর্তী ক্যাডেট
                  </button>

                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </div>
  );
}
