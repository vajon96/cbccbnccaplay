import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { 
  Scan, Camera, ShieldCheck, ShieldAlert, User, 
  Award, RefreshCw, Loader2, ArrowLeft 
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db, doc, getDoc } from "../firebase";

export function PublicQrScan() {
  const [loading, setLoading] = useState(false);
  const [cadetData, setCadetData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeScanner, setActiveScanner] = useState(true);

  // Init public scanner with safe DOM checking
  useEffect(() => {
    if (!activeScanner || cadetData) return;

    let isActive = true;
    let scanner: Html5QrcodeScanner | null = null;

    const initScanner = () => {
      if (!isActive) return;
      const targetElement = document.getElementById("public-qr-reader");
      if (!targetElement) {
        // Retry shortly if the element isn't in the DOM yet
        setTimeout(initScanner, 50);
        return;
      }

      try {
        scanner = new Html5QrcodeScanner(
          "public-qr-reader",
          { fps: 15, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        const onScanSuccess = async (decodedText: string) => {
          if (!isActive) return;
          let cadetId = "";
          try {
            const parsed = JSON.parse(decodedText);
            cadetId = parsed.id || parsed.roll || decodedText;
          } catch {
            cadetId = decodedText;
          }

          if (!cadetId) return;

          // Prevent scans of admin QR codes in public mode
          if (cadetId.startsWith("adm_qr_")) {
            setError("এটি একটি সুরক্ষিত অ্যাডমিন টোকেন! সাধারণ স্ক্যানার দিয়ে স্ক্যান করা যাবে না।");
            setTimeout(() => setError(null), 5000);
            return;
          }

          setLoading(true);
          setError(null);

          try {
            const docRef = doc(db, "applicants", cadetId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const rawData = docSnap.data();
              
              // STRICT SEPARATION: filter out secret/sensitive fields before state update to ensure zero leakage
              const approvedStatus = rawData.status === "Approved" || rawData.status === "Joined";
              
              // Whitelisting only safe public tracking parameters
              const publicProfile = {
                id: cadetId,
                fullNameEnglish: rawData.fullNameEnglish,
                fullNameBangla: rawData.fullNameBangla,
                academicYear: rawData.academicYear,
                studyStatus: rawData.studyStatus,
                photo: rawData.photo,
                status: rawData.status,
                isValidCadet: approvedStatus
              };

              setCadetData(publicProfile);

              // Digital ping noise
              const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-600.wav");
              audio.play().catch(() => {});
            } else {
              setError("ক্যাডেট তথ্য পাওয়া যায়নি! সঠিক কিউআর কোড স্ক্যান করুন।");
              setTimeout(() => setError(null), 4000);
            }
          } catch (err) {
            console.error("Public lookup error:", err);
            setError("তথ্য ভেরিফাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
          } finally {
            setLoading(false);
          }
        };

        scanner.render(onScanSuccess, () => {});
      } catch (err) {
        console.error("Scanner initialization failed in PublicQrScan:", err);
      }
    };

    // Slight initial deferral for transitions
    const timer = setTimeout(initScanner, 100);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (scanner) {
        try {
          scanner.clear().catch(error => console.error("Error clearing public scanner", error));
        } catch (e) {
          console.error("Error during public scanner cleanup:", e);
        }
      }
    };
  }, [activeScanner, cadetData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4 relative overflow-hidden flex flex-col justify-between">
      {/* Visual Header */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      
      <div className="max-w-md w-full mx-auto space-y-8 my-auto">
        
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> হোমপেজে
          </Link>
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            PUBLIC VERIFIER
          </span>
        </div>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <Scan className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">ক্যাডেট কার্ড ভেরিফায়ার</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Scan QR Code on Cadet Admit Card to verify status
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center"
          >
            <p className="text-red-400 text-xs font-bold">{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!cadetData ? (
            <motion.div
              key="scanner-layout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {loading ? (
                <div className="h-64 rounded-3xl bg-slate-900 border border-white/5 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">যাচাই হচ্ছে...</p>
                </div>
              ) : (
                <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 space-y-4">
                  <div id="public-qr-reader" className="overflow-hidden rounded-2xl bg-black border-2 border-emerald-500 shadow-inner" />
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs bg-emerald-500/10 py-3 rounded-xl border border-emerald-500/20">
                    <Camera className="w-4 h-4 animate-pulse" />
                    <span>ক্যামেরার সামনে ক্যাডেট কোড ধরুন</span>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results-layout"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-3xl bg-slate-900 border border-white/5 shadow-2xl space-y-6 text-center"
            >
              {/* Cadet validation alert */}
              {cadetData.isValidCadet ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <ShieldCheck className="w-6 h-6 text-emerald-400 animate-bounce" />
                  </div>
                  <h3 className="text-emerald-400 font-black text-sm uppercase tracking-wider">VERIFIED CADET</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Cox's Bazar City College</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/30">
                    <ShieldAlert className="w-6 h-6 text-amber-400 animate-bounce" />
                  </div>
                  <h3 className="text-amber-400 font-black text-sm uppercase tracking-wider">PENDING VERIFICATION</h3>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">Cox's Bazar City College</p>
                </div>
              )}

              {/* Limited Profile Data Only */}
              <div className="space-y-4 p-5 bg-slate-950 rounded-2xl border border-white/5">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 mx-auto shadow-xl bg-slate-900">
                  {cadetData.photo ? (
                    <img src={cadetData.photo} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-slate-700" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-black text-white">{cadetData.fullNameEnglish}</h4>
                  <p className="text-sm font-bold text-slate-400 font-bengali">{cadetData.fullNameBangla}</p>
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black">CADET ID</span>
                    <p className="text-xs font-mono font-bold text-emerald-400">{cadetData.id}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black">SESSION</span>
                    <p className="text-xs font-bold text-white">{cadetData.academicYear || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black">GROUP / PLATOON branch</span>
                    <p className="text-xs font-bold text-white uppercase">{cadetData.studyStatus || "N/A"}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCadetData(null)}
                className="w-full py-4 bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <RefreshCw size={14} /> আরেকটি কোড স্ক্যান করুন
              </button>

            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center">
          <p className="text-slate-700 text-[8px] tracking-widest uppercase font-bold">
            Cox's Bazar City College BNCC Platoon • QR Verifier
          </p>
        </div>

      </div>
    </div>
  );
}
