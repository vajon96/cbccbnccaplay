import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scan, LogOut, Shield, QrCode, Camera, X, 
  FileSpreadsheet, CheckCircle, User, Clock, Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import { Html5QrcodeScanner } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import { db, doc, updateDoc, getDoc, Timestamp, handleFirestoreError, OperationType, collection, query, where, getDocs } from "../firebase";

export function Admin2Dashboard() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [scannedApplicant, setScannedApplicant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const passwordVerified = localStorage.getItem("admin2PasswordVerified");
    if (!passwordVerified) {
      navigate("/admin2");
      return;
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    if (!loading && scanning && !scannedApplicant) {
      const scanner = new Html5QrcodeScanner(
        "reader-admin2",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [loading, scanning, scannedApplicant]);

  const onScanSuccess = async (decodedText: string) => {
    let id = "";
    try {
      const data = JSON.parse(decodedText);
      id = data.id;
    } catch (e) {
      id = decodedText;
    }

    if (!id) return;

    const path = `applicants/${id}`;
    try {
      const docRef = doc(db, "applicants", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const applicant = docSnap.data();
        
        // Check if already present to avoid duplicate scans
        if (applicant.attendanceStatus === "Present") {
          setScannedApplicant({ ...applicant, id, alreadyPresent: true });
          return;
        }

        await updateDoc(docRef, {
          attendanceStatus: "Present",
          attendanceTime: Timestamp.now()
        });
        
        setScannedApplicant({ ...applicant, id, attendanceStatus: "Present", attendanceTime: new Date() });
      } else {
        setError("আবেদনকারী পাওয়া যায়নি! (ID: " + id + ")");
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("admin2PasswordVerified");
    navigate("/admin2");
  };

  const exportAttendance = async () => {
    setExporting(true);
    try {
      const q = query(collection(db, "applicants"), where("attendanceStatus", "==", "Present"));
      const querySnapshot = await getDocs(q);
      
      const attendanceData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const admitCardUrl = `${window.location.origin}/admit-card/${data.id}`;
        return {
          "Name": data.fullNameEnglish || data.fullNameBangla,
          "ID / Roll": `${data.id} / ${data.classRoll || "N/A"}`,
          "উপস্থিতির সময়": data.attendanceTime ? (data.attendanceTime.toDate ? data.attendanceTime.toDate().toLocaleString() : new Date(data.attendanceTime).toLocaleString()) : "N/A",
          "Photo (Link)": admitCardUrl
        };
      });

      if (attendanceData.length === 0) {
        alert("কোনো উপস্থিত শিক্ষার্থী পাওয়া যায়নি।");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(attendanceData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
      
      // Formatting
      const wscols = [
        { wch: 30 }, // Name
        { wch: 20 }, // ID / Roll
        { wch: 25 }, // Time
        { wch: 40 }, // Photo Link
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `BNCC_Attendance_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("এক্সপোর্ট করতে সমস্যা হয়েছে।");
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-900">অপেক্ষা করুন...</div>;

  return (
    <div className="min-h-screen bg-sand py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-primary p-8 rounded-[2rem] text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">অ্যাডমিন ২ (এটেনডেন্স)</h1>
              <p className="text-white/70 text-sm">QR স্ক্যানিং এবং উপস্থিতি ব্যবস্থাপনা</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportAttendance}
              disabled={exporting}
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              রিপোর্ট ডাউনলোড
            </button>
            <button
              onClick={handleLogout}
              className="p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/20"
              title="লগআউট"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Scanner Section */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-sand shadow-xl space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-black">QR স্ক্যানার</h2>
            </div>
            
            <div className="relative">
              <div id="reader-admin2" className="overflow-hidden rounded-3xl border-4 border-primary bg-black shadow-inner"></div>
              <div className="absolute inset-0 pointer-events-none border-[16px] border-transparent rounded-3xl">
                <div className="w-full h-full border-2 border-white/20 rounded-xl"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-primary font-bold bg-primary/10 py-3 rounded-xl">
              <QrCode className="w-5 h-5" />
              <p className="text-sm">ক্যামেরার সামনে QR কোডটি ধরুন</p>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm font-bold text-center"
              >
                {error}
              </motion.div>
            )}
          </div>

          {/* Result Section */}
          <div className="flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!scannedApplicant ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white/60 rounded-[2.5rem] border border-sand border-dashed"
                >
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-10 h-10 text-primary/30" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-black/40">স্ক্যান করার জন্য অপেক্ষা করছি...</h3>
                    <p className="text-sm text-black/30">সফল স্ক্যান হলে এখানে তথ্য প্রদর্শিত হবে</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  className="p-8 rounded-[2.5rem] bg-white shadow-2xl border border-sand relative overflow-hidden"
                >
                  {/* Success Badge */}
                  <div className="absolute top-6 right-6">
                    <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${
                      scannedApplicant.alreadyPresent ? 'bg-amber-100 text-amber-700' : 'bg-primary/20 text-primary'
                    }`}>
                      <CheckCircle className="w-4 h-4" />
                      {scannedApplicant.alreadyPresent ? 'ইতিমধ্যেই উপস্থিত' : 'উপস্থিত'}
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-primary shadow-lg">
                        {scannedApplicant.photo ? (
                          <img src={scannedApplicant.photo} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full bg-sand/20 flex items-center justify-center">
                            <User className="w-12 h-12 text-black/20" />
                          </div>
                        )}
                      </div>
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </motion.div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-black">{scannedApplicant.fullNameEnglish || scannedApplicant.fullNameBangla}</h3>
                      <p className="text-primary font-bold text-sm tracking-widest uppercase">ID: {scannedApplicant.id}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full">
                      <div className="p-4 bg-sand/30 rounded-2xl border border-sand">
                        <p className="text-[10px] uppercase text-black/40 font-bold mb-1">Class / Group</p>
                        <p className="text-black font-bold">{scannedApplicant.studyStatus}</p>
                      </div>
                      <div className="p-4 bg-sand/30 rounded-2xl border border-sand">
                        <p className="text-[10px] uppercase text-black/40 font-bold mb-1">Roll Number</p>
                        <p className="text-black font-bold">{scannedApplicant.classRoll || "N/A"}</p>
                      </div>
                    </div>

                    <div className="w-full p-4 bg-sand/20 rounded-2xl flex items-center justify-center gap-3 text-black/50">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        সময়: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    <button 
                      onClick={() => setScannedApplicant(null)}
                      className="w-full py-4 bg-accent text-white font-bold rounded-2xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                    >
                      <Scan className="w-5 h-5" /> পরবর্তী স্ক্যান করুন
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
