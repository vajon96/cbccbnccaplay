import { useState, useEffect, useRef } from "react";
import { X, Download, Loader2, Sparkles, AlertTriangle, FileText } from "lucide-react";
import { db, collection, getDocs, query, where, limit, onSnapshot } from "../../firebase";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface CircularViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CircularViewerModal({ isOpen, onClose }: CircularViewerModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [circular, setCircular] = useState<any | null>(null);
  const [publicAccessAllowed, setPublicAccessAllowed] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeCirculars: (() => void) | null = null;

    if (isOpen) {
      setLoading(true);
      setErrorMsg(null);
      setCircular(null);

      // 1. Listen to settings
      const settingsRef = collection(db, "circular_settings");
      unsubscribeSettings = onSnapshot(settingsRef, (settingsSnap) => {
        const publicAccessDoc = settingsSnap.docs.find(d => d.data().key === "public_access");
        const isAllowed = publicAccessDoc ? publicAccessDoc.data().value : true;
        setPublicAccessAllowed(isAllowed);

        if (!isAllowed) {
          setErrorMsg("দুঃখিত, অ্যাডমিন কর্তৃক সার্কুলার অ্যাক্সেস এই মুহূর্তে নিষ্ক্রিয় করা আছে।");
          setCircular(null);
          setLoading(false);
          return;
        }

        // If public access is allowed, listen to the active published circular
        if (!unsubscribeCirculars) {
          const q = query(
            collection(db, "circulars"), 
            where("status", "==", "published"),
            limit(1)
          );
          unsubscribeCirculars = onSnapshot(q, (circularSnap) => {
            if (circularSnap.empty) {
              setCircular(null);
              setErrorMsg("দুঃখিত, এই মুহূর্তে কোনো সার্কুলার উপলব্ধ নেই। (No circular is currently available)");
            } else {
              setCircular(circularSnap.docs[0].data());
              setErrorMsg(null);
            }
            setLoading(false);
          }, (err) => {
            console.error("Real-time circular fetch error:", err);
            setErrorMsg("সার্কুলার তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
            setLoading(false);
          });
        }
      }, (err) => {
        console.error("Real-time settings fetch error:", err);
        setErrorMsg("সার্কুলার তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
        setLoading(false);
      });
    }

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeCirculars) unsubscribeCirculars();
    };
  }, [isOpen]);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BNCC_Circular_${circular?.referenceNumber || "Official"}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF ডাউনলোড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl bg-white rounded-[2.5rem] p-8 shadow-2xl flex flex-col max-h-[92vh] border border-slate-100 z-10 text-black">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div className="flex items-center gap-2.5 text-primary">
            <FileText className="w-6 h-6" />
            <h3 className="text-lg font-black uppercase tracking-tight">অফিসিয়াল সার্কুলার পোর্টাল</h3>
          </div>
          <div className="flex items-center gap-4">
            {circular && (
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="px-5 py-2.5 bg-primary text-white font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-primary/95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download size={14} />}
                PDF ডাউনলোড করুন
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-grow overflow-y-auto pr-2 no-scrollbar flex justify-center bg-slate-50 p-6 rounded-2xl border border-slate-100">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 font-bold gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <span>সার্কুলার তথ্য যাচাই করা হচ্ছে...</span>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="text-amber-500 w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-800">কমান্ড বার্তা (Not Found)</h4>
              <p className="text-sm text-slate-500 leading-relaxed font-bold">
                {errorMsg}
              </p>
              <button 
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 text-white font-bold text-xs rounded-full uppercase hover:bg-slate-900 transition-all"
              >
                বন্ধ করুন
              </button>
            </div>
          ) : circular ? (
            
            /* Sized Document view */
            <div className="border border-slate-200 bg-white p-2 shadow-xl rounded-2xl h-fit">
              <div 
                ref={printRef}
                className="relative bg-white text-black p-12 w-[790px] h-[1118px] flex flex-col justify-between overflow-hidden select-none"
                style={{ letterSpacing: "-0.015em" }}
              >
                {/* WATERMARK */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-[1]">
                  <img 
                    src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                    alt="BNCC Logo Watermark" 
                    className="w-[450px] h-[450px]"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* BODY CONTENT */}
                <div className="relative z-10 flex-grow space-y-4">
                  {/* LETTERHEAD HEAD */}
                  <div className="flex items-center justify-between border-b-2 border-black pb-4">
                    <img 
                      src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                      alt="College Logo" 
                      className="h-14 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="text-center font-bold">
                      <h1 className="text-base font-black text-slate-900 mt-0.5">কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন</h1>
                      <p className="text-[10px] text-slate-700 mt-0.5 uppercase">১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট</p>
                    </div>
                    <img 
                      src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                      alt="BNCC Logo" 
                      className="h-14 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* REFERENCE */}
                  <div className="flex justify-between text-[11px] font-bold text-slate-800 border-b border-dashed border-slate-300 pb-2">
                    <span>স্মারক নং: {circular.referenceNumber || "ENR-2026-0001"}</span>
                    <span>তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>

                  {/* DETAILS SHEET */}
                  <div className="text-slate-900 space-y-4 text-[11px] leading-relaxed">
                    <h3 className="text-sm font-black text-center text-black border-y border-black py-1 tracking-tight">
                      {circular.title}
                    </h3>

                    {/* Intro */}
                    <p className="text-justify indent-8 text-slate-800">
                      {circular.introduction}
                    </p>

                    <div className="grid grid-cols-2 gap-6 items-start">
                      {/* Left Side */}
                      <div className="space-y-3">
                        <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                          <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">১. আমাদের উদ্দেশ্য (Purpose)</h4>
                          <p className="text-[10px] text-slate-700">{circular.purpose}</p>
                        </div>
                        <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                          <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">২. আবেদনের যোগ্যতা (Eligibility)</h4>
                          <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.eligibility}</p>
                        </div>
                      </div>

                      {/* Right Side */}
                      <div className="space-y-3">
                        <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                          <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৩. প্রয়োজনীয় কাগজপত্র (Documents)</h4>
                          <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.requiredDocuments}</p>
                        </div>
                        <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                          <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৪. অনলাইন আবেদন পদ্ধতি (Application Guideline)</h4>
                          <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.applicationProcedure}</p>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="border-t border-slate-200 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-extrabold text-black uppercase tracking-tight ml-1 text-[11px] mb-1">৫. নির্বাচন প্রক্রিয়া (Selection Process)</h4>
                        <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.verificationProcess}</p>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-black uppercase tracking-tight ml-1 text-[11px] mb-1">৬. গুরুত্বপূর্ণ তথ্য ও শেষ তারিখ (Key Dates)</h4>
                        <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.importantDates}</p>
                      </div>
                    </div>

                    {/* Term Conditions */}
                    <div className="border-t border-slate-200 pt-3">
                      <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৭. সাধারণ নিয়ামাবলী (Rules & Regulations)</h4>
                      <p className="text-[10px] text-slate-700 whitespace-pre-line">{circular.rulesAndConditions}</p>
                    </div>
                  </div>
                </div>

                {/* LETTER SIGNATURE */}
                <div className="flex justify-between items-end border-t border-black pt-4 z-10 relative">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Platoon Commander Signature</p>
                    <p className="text-[10px] font-black">{circular.contactInfo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 text-[10px] whitespace-pre-line">{circular.footer}</p>
                    <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">ENR OFFICIAL COPY</p>
                  </div>
                </div>

              </div>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );
}
