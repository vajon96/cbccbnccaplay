import { useState, useEffect, useRef } from "react";
import { X, Download, Loader2, Sparkles, Camera, User, CheckCircle, Shield, Award, HelpCircle } from "lucide-react";
import { downloadElementAsPdf } from "../lib/pdfUtils";
import { db, doc, onSnapshot } from "../firebase";

interface AdmissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_GUIDE = {
  title: "অনলাইন ভর্তি আবেদন নির্দেশিকা ও নিয়মাবলী (OFFICIAL APPLICANT GUIDE)",
  refNumber: "CBCC-BNCC-GUIDE-2026",
  collegeName: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
  regimentInfo: "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট",
  establishedYear: "ESTD. 2020 • COX'S BAZAR CITY COLLEGE",
  introText: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC) কক্সবাজার সিটি কলেজ প্লাটুনে যোগদানে ইচ্ছুক সকল ভর্তিচ্ছু শিক্ষার্থীর সুবিধার্থে অনলাইন আবেদন প্রক্রিয়া সহজতর করতে এই নির্দেশিকা প্রকাশ করা হলো। আবেদন করার পূর্বে নিয়মাবলীসমূহ অত্যন্ত সতর্কতার সাথে পাঠ করার জন্য নির্দেশ প্রদান করা যাচ্ছে।",
  photoRulesTitle: "১. ছবি আপলোডের সঠিক নিয়মাবলী (Photo Rules)",
  photoRules: [
    "ব্যাকগ্রাউন্ড: অবশ্যই এক রঙের (সাদা অথবা হালকা নীল) ব্যাকগ্রাউন্ড হতে হবে। কোনো প্রাকৃতিক দৃশ্য বা ঘরের আসবাবপত্র পেছনে থাকা যাবে না।",
    "পোশাক: কলারযুক্ত মার্জিত ফরমাল পোশাক পরিহিত হতে হবে। চশমা, টুপি বা ক্যাপ পরা ছবি গ্রহণযোগ্য নয়।",
    "পোজ ও অবস্থান: সরাসরি ক্যামেরার দিকে সোজা হয়ে তাকাতে হবে (Military aligned)। দুই কান ও কাঁধ সমানভাবে স্পষ্ট দেখা যেতে হবে।",
    "আলো ও স্পষ্টতা: ছবিতে পর্যাপ্ত আলো থাকতে হবে। কোনো অস্পষ্ট, ঘোলাটে, বা অতিরিক্ত ফিল্টার করা সেলফি আপলোড করা যাবে না।"
  ],
  aiRulesTitle: "২. আর্টিফিশিয়াল ইন্টেলিজেন্স (AI) ফটো চেকিং",
  aiRulesText: "আবেদন ফর্মে যুক্ত রয়েছে Gemini AI Integration। আপনি যখনই ছবি আপলোড করবেন, এআই স্বয়ংক্রিয়ভাবে ছবির ব্যাকগ্রাউন্ড, চশমা, টুপি, ছবির গুণমান এবং পোজ বিশ্লেষণ করবে। ছবি নিয়ম বহির্ভূত হলে পোর্টাল আপনাকে সতর্কবার্তা দেবে এবং সংশোধন করতে বলবে।",
  securityRulesTitle: "৩. সুরক্ষিত পাসওয়ার্ড সংরক্ষণ (Password Guard)",
  securityRulesText: "আবেদনপত্রটি সফলভাবে সাবমিট করার সাথে সাথে স্ক্রিনে একটি অটো-জেনারেটেড সুরক্ষিত পাসওয়ার্ড (Auto-generated Password) প্রদর্শিত হবে। আপনার নিবন্ধিত মোবাইল নম্বর এবং এই পাসওয়ার্ডটি অত্যন্ত যত্নসহকারে লিখে রাখুন। আপনার ড্যাশবোর্ডে প্রবেশের একমাত্র চাবিকাঠি এটি।",
  workflowTitle: "৪. আবেদন প্রক্রিয়া (Application Workflow)",
  workflowSteps: [
    { step: 1, title: "ধাপ ১ (রেজিস্ট্রেশন)", desc: "ফর্মে ব্যক্তিগত বিবরণ, নাম (বাংলা ও ইংরেজিতে), এবং এসএসসি জিপিএ টাইপ করুন।" },
    { step: 2, title: "ধাপ ২ (ছবি আপলোড)", desc: "সঠিক নিয়ম মেনে ছবি আপলোড করুন এবং এআই সনাক্তকরণ সম্পন্ন করুন।" },
    { step: 3, title: "ধাপ ৩ (শারীরিক বিবরণ)", desc: "আপনার সঠিক উচ্চতা, ওজন এবং রক্তের গ্রুপ ইনপুট করুন।" },
    { step: 4, title: "ধাপ ৪ (সাবমিশন)", desc: "ফর্ম সাবমিট করে পাসওয়ার্ড লিখে রাখুন।" }
  ],
  admitCardTitle: "৫. প্রবেশপত্র (Admit Card) সংগ্রহ প্রক্রিয়া",
  admitCardText: "আবেদনটি জমা হওয়ার পর আমাদের পিইউও এবং প্লাটুন অ্যাডমিনগণ আবেদনপত্রের সকল তথ্য ও ছবি গভীরভাবে নিরীক্ষণ করবেন। সবকিছু নির্ভুল থাকলে আবেদনটি অনুমোদন (Approved) করা হবে। অনুমোদন সম্পন্ন হওয়া মাত্রই আপনি ড্যাশবোর্ডে লগইন করে অফিশিয়াল কিউআর ও বারকোড সম্বলিত প্রবেশপত্র ডাউনলোড করতে পারবেন।",
  docsTitle: "৬. প্রয়োজনীয় কাগজপত্র (সংগে আনতে হবে)",
  docsList: [
    "এসএসসি ও এইচএসসি সনদপত্রের ফটোকপি (২ কপি)",
    "কলেজে ভর্তির রশিদ/রশিদ কপি (১ কপি)",
    "পাসপোর্ট সাইজ রঙিন ছবি (২ কপি)",
    "ব্লাড গ্রুপ রিপোর্টের ফটোকপি",
    "জাতীয় পরিচয়পত্র অথবা জন্ম সনদের ফটোকপি"
  ],
  warningText: "সতর্কতা: ভুল বা মিথ্যা তথ্য এবং জালিয়াতিপূর্ণ ছবি প্রদান করলে আবেদনপত্র সরাসরি বাতিল বলে গণ্য হবে।",
  commanderName: "উজ্জ্বল কান্তি দেব",
  commanderRank: "প্রফেসর আন্ডার অফিসার ও প্লাটুন কমান্ডার",
  platoonFooter: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
  subFooter: "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট"
};

export function AdmissionGuideModal({ isOpen, onClose }: AdmissionGuideModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [guide, setGuide] = useState<any>(DEFAULT_GUIDE);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen to active guide document in real-time
    const unsub = onSnapshot(doc(db, "guides", "active_guide"), (snap) => {
      if (snap.exists()) {
        setGuide(snap.data());
      }
    }, (err) => {
      console.error("Error listening to active_guide:", err);
    });

    return () => unsub();
  }, []);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      await downloadElementAsPdf(
        printRef.current,
        `BNCC_Admission_Guide_${guide.refNumber || "2026"}.pdf`
      );
    } catch (e) {
      console.error(e);
      alert("PDF ডাউনলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
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
        className="absolute inset-0 bg-slate-900/85 backdrop-blur-md"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl bg-slate-950 text-white rounded-[2.5rem] p-6 md:p-8 shadow-2xl flex flex-col max-h-[92vh] border border-white/10 z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="flex items-center gap-2.5 text-primary">
            <HelpCircle className="w-6 h-6" />
            <h3 className="text-lg font-black uppercase tracking-tight">আবেদন নির্দেশিকা ও তথ্য সহায়িকা (Guide)</h3>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="px-5 py-2.5 bg-primary text-white font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-primary/95 transition-all flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download size={14} />}
              ডাউনলোড করুন (PDF)
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-grow overflow-y-auto pr-2 no-scrollbar flex justify-center bg-slate-900 p-2 md:p-6 rounded-2xl border border-white/5">
          
          {/* Printable Document (Target for html2canvas) */}
          <div className="border border-slate-200 bg-white p-2 shadow-2xl rounded-2xl h-fit overflow-x-auto max-w-full">
            <div 
              ref={printRef}
              className="relative bg-white text-black p-10 w-[790px] h-[1118px] flex flex-col justify-between overflow-hidden select-none"
              style={{ letterSpacing: "-0.015em", fontFamily: "system-ui, -apple-system, sans-serif" }}
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
              <div className="relative z-10 flex-grow space-y-5">
                
                {/* LETTERHEAD HEAD */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <img 
                    src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                    alt="College Logo" 
                    className="h-14 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-center">
                    <h1 className="text-md font-black text-slate-900 tracking-tight leading-none">{guide.collegeName || "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন"}</h1>
                    <p className="text-[10px] text-slate-600 font-bold mt-1 uppercase">{guide.regimentInfo || "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট"}</p>
                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">{guide.establishedYear || "ESTD. 2020 • COX'S BAZAR CITY COLLEGE"}</p>
                  </div>
                  <img 
                    src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                    alt="BNCC Logo" 
                    className="h-14 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* REFERENCE */}
                <div className="flex justify-between text-[10px] font-bold text-slate-800 border-b border-dashed border-slate-300 pb-1.5">
                  <span>স্মারক নং: {guide.refNumber || "CBCC-BNCC-GUIDE-2026"}</span>
                  <span>তারিখ: {guide.publishDate || (new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) + " বঙ্গাব্দ/খ্রিস্টাব্দ")}</span>
                </div>

                {/* DETAILS SHEET */}
                <div className="text-slate-900 space-y-4 text-[11px] leading-relaxed">
                  <h3 className="text-xs font-black text-center text-white bg-slate-900 py-1.5 rounded uppercase tracking-wide">
                    {guide.title || "অনলাইন ভর্তি আবেদন নির্দেশিকা ও নিয়মাবলী"}
                  </h3>

                  <p className="text-justify text-slate-700 leading-normal text-[10.5px]">
                    {guide.introText}
                  </p>

                  {/* Grid of Steps */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    
                    {/* Left Column: Photo & AI Guidelines */}
                    <div className="space-y-3">
                      
                      {/* Photo guidelines */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Camera className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guide.photoRulesTitle || "১. ছবি আপলোডের সঠিক নিয়মাবলী (Photo Rules)"}</h4>
                        </div>
                        <ul className="space-y-1 text-[9.5px] text-slate-700 list-disc pl-3">
                          {Array.isArray(guide.photoRules) ? guide.photoRules.map((rule: string, idx: number) => (
                            <li key={idx}>{rule}</li>
                          )) : (
                            <li>ছবির তথ্য লোড হচ্ছে...</li>
                          )}
                        </ul>
                      </div>

                      {/* AI Verification */}
                      <div className="border border-red-200 bg-red-50/40 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-red-200 pb-1 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                          <h4 className="font-extrabold text-red-950 text-[11px]">{guide.aiRulesTitle || "২. আর্টিফিশিয়াল ইন্টেলিজেন্স (AI) ফটো চেকিং"}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guide.aiRulesText}
                        </p>
                      </div>

                      {/* Credentials */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Shield className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guide.securityRulesTitle || "৩. সুরক্ষিত পাসওয়ার্ড সংরক্ষণ (Password Guard)"}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guide.securityRulesText}
                        </p>
                      </div>

                    </div>

                    {/* Right Column: Dynamic steps & Flow */}
                    <div className="space-y-3">
                      
                      {/* Step by Step application workflow */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <User className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guide.workflowTitle || "৪. আবেদন প্রক্রিয়া (Application Workflow)"}</h4>
                        </div>
                        <div className="space-y-2 text-[9.5px] text-slate-700">
                          {Array.isArray(guide.workflowSteps) ? guide.workflowSteps.map((st: any, idx: number) => (
                            <div key={idx} className="flex gap-1.5 items-start">
                              <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">{st.step || idx + 1}</span>
                              <span><strong>{st.title}:</strong> {st.desc}</span>
                            </div>
                          )) : null}
                        </div>
                      </div>

                      {/* Approval and Admit Card */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Award className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guide.admitCardTitle || "৫. প্রবেশপত্র (Admit Card) সংগ্রহ প্রক্রিয়া"}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guide.admitCardText}
                        </p>
                      </div>

                      {/* Required Documents Table */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <CheckCircle className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guide.docsTitle || "৬. প্রয়োজনীয় কাগজপত্র (সংগে আনতে হবে)"}</h4>
                        </div>
                        <ul className="space-y-0.5 text-[9px] text-slate-700 list-disc pl-3">
                          {Array.isArray(guide.docsList) ? guide.docsList.map((item: string, idx: number) => (
                            <li key={idx}>{item}</li>
                          )) : null}
                        </ul>
                      </div>

                    </div>
                  </div>

                  {/* Summary Footer Warning */}
                  <div className="border border-amber-200 bg-amber-50/30 p-3 rounded-xl text-center space-y-1 mt-1">
                    <p className="text-[10px] font-black text-amber-950">
                      {guide.warningText}
                    </p>
                    <p className="text-[8px] text-slate-500 font-mono uppercase">
                      WARNING: PROVIDING FALSE INFORMATION OR FORGED PHOTOGRAPHS WILL LEAD TO IMMEDIATE DISQUALIFICATION.
                    </p>
                  </div>

                </div>
              </div>

              {/* LETTER SIGNATURE */}
              <div className="flex justify-between items-end border-t border-slate-900 pt-3 z-10 relative">
                <div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">প্লাটুন কম্যান্ডের স্বাক্ষর ও সীল</p>
                  <p className="text-[9.5px] font-black text-slate-950">{guide.commanderName || "উজ্জ্বল কান্তি দেব"}</p>
                  <p className="text-[8px] text-slate-600">{guide.commanderRank || "প্রফেসর আন্ডার অফিসার ও প্লাটুন কমান্ডার"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-600">{guide.platoonFooter || "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন"}</p>
                  <p className="text-[8px] text-slate-400">{guide.subFooter || "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট"}</p>
                  <p className="text-[8px] text-slate-500 font-mono uppercase mt-0.5">{guide.refNumber || "ENR-GUIDE-2026"} OFFICIAL DOCUMENT</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
