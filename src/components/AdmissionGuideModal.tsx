import { useState, useRef } from "react";
import { X, Download, Loader2, Sparkles, FileText, Camera, User, CheckCircle, Shield, Award, HelpCircle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { handleHtml2CanvasClone } from "../lib/pdfUtils";

interface AdmissionGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdmissionGuideModal({ isOpen, onClose }: AdmissionGuideModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      await new Promise(r => setTimeout(r, 600));
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: handleHtml2CanvasClone
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("BNCC_Admission_Enrollment_Guide.pdf");
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
                    <h1 className="text-md font-black text-slate-900 tracking-tight leading-none">কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন</h1>
                    <p className="text-[10px] text-slate-600 font-bold mt-1 uppercase">১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট</p>
                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">ESTD. 2020 • COX'S BAZAR CITY COLLEGE</p>
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
                  <span>স্মারক নং: CBCC-BNCC-GUIDE-2026</span>
                  <span>তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })} বঙ্গাব্দ/খ্রিস্টাব্দ</span>
                </div>

                {/* DETAILS SHEET */}
                <div className="text-slate-900 space-y-4 text-[11px] leading-relaxed">
                  <h3 className="text-xs font-black text-center text-white bg-slate-900 py-1.5 rounded uppercase tracking-wide">
                    অনলাইন ভর্তি আবেদন নির্দেশিকা ও নিয়মাবলী (OFFICIAL APPLICANT GUIDE)
                  </h3>

                  <p className="text-justify text-slate-700 leading-normal text-[10.5px]">
                    বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC) কক্সবাজার সিটি কলেজ মিশ্র প্লাটুনে যোগদানে ইচ্ছুক সকল ভর্তিচ্ছু শিক্ষার্থীর সুবিধার্থে অনলাইন আবেদন প্রক্রিয়া সহজতর করতে এই নির্দেশিকা প্রকাশ করা হলো। আবেদন করার পূর্বে নিয়মাবলীসমূহ অত্যন্ত সতর্কতার সাথে পাঠ করার জন্য নির্দেশ প্রদান করা যাচ্ছে।
                  </p>

                  {/* Grid of Steps */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    
                    {/* Left Column: Photo & AI Guidelines */}
                    <div className="space-y-3">
                      
                      {/* Photo guidelines */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Camera className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">১. ছবি আপলোডের সঠিক নিয়মাবলী (Photo Rules)</h4>
                        </div>
                        <ul className="space-y-1 text-[9.5px] text-slate-700 list-disc pl-3">
                          <li><strong>ব্যাকগ্রাউন্ড:</strong> অবশ্যই এক রঙের (সাদা অথবা হালকা নীল) ব্যাকগ্রাউন্ড হতে হবে। কোনো প্রাকৃতিক দৃশ্য বা ঘরের আসবাবপত্র পেছনে থাকা যাবে না।</li>
                          <li><strong>পোশাক:</strong> কলারযুক্ত মার্জিত ফরমাল পোশাক পরিহিত হতে হবে। চশমা, টুপি বা ক্যাপ পরা ছবি গ্রহণযোগ্য নয়।</li>
                          <li><strong>পোজ ও অবস্থান:</strong> সরাসরি ক্যামেরার দিকে সোজা হয়ে তাকাতে হবে (Military aligned)। দুই কান ও কাঁধ সমানভাবে স্পষ্ট দেখা যেতে হবে।</li>
                          <li><strong>আলো ও স্পষ্টতা:</strong> ছবিতে পর্যাপ্ত আলো থাকতে হবে। কোনো অস্পষ্ট, ঘোলাটে, বা অতিরিক্ত ফিল্টার করা সেলফি আপলোড করা যাবে না।</li>
                        </ul>
                      </div>

                      {/* AI Verification */}
                      <div className="border border-red-200 bg-red-50/40 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-red-200 pb-1 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                          <h4 className="font-extrabold text-red-950 text-[11px]">২. আর্টিফিশিয়াল ইন্টেলিজেন্স (AI) ফটো চেকিং</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          আবেদন ফর্মে যুক্ত রয়েছে <strong>Gemini AI Integration</strong>। আপনি যখনই ছবি আপলোড করবেন, এআই স্বয়ংক্রিয়ভাবে ছবির ব্যাকগ্রাউন্ড, চশমা, টুপি, ছবির গুণমান এবং পোজ বিশ্লেষণ করবে। ছবি নিয়ম বহির্ভূত হলে পোর্টাল আপনাকে সতর্কবার্তা দেবে এবং সংশোধন করতে বলবে।
                        </p>
                      </div>

                      {/* Credentials */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Shield className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">৩. সুরক্ষিত পাসওয়ার্ড সংরক্ষণ (Password Guard)</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          আবেদনপত্রটি সফলভাবে সাবমিট করার সাথে সাথে স্ক্রিনে একটি <strong>অটো-জেনারেটেড সুরক্ষিত পাসওয়ার্ড (Auto-generated Password)</strong> প্রদর্শিত হবে। আপনার নিবন্ধিত মোবাইল নম্বর এবং এই পাসওয়ার্ডটি অত্যন্ত যত্নসহকারে লিখে রাখুন। আপনার ড্যাশবোর্ডে প্রবেশের একমাত্র চাবিকাঠি এটি।
                        </p>
                      </div>

                    </div>

                    {/* Right Column: Dynamic steps & Flow */}
                    <div className="space-y-3">
                      
                      {/* Step by Step application workflow */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <User className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">৪. আবেদন প্রক্রিয়া (Application Workflow)</h4>
                        </div>
                        <div className="space-y-2 text-[9.5px] text-slate-700">
                          <div className="flex gap-1.5 items-start">
                            <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">1</span>
                            <span><strong>ধাপ ১ (রেজিস্ট্রেশন):</strong> ফর্মে ব্যক্তিগত বিবরণ, নাম (বাংলা ও ইংরেজিতে), এবং এসএসসি জিপিএ টাইপ করুন।</span>
                          </div>
                          <div className="flex gap-1.5 items-start">
                            <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">2</span>
                            <span><strong>ধাপ ২ (ছবি আপলোড):</strong> সঠিক নিয়ম মেনে ছবি আপলোড করুন এবং এআই সনাক্তকরণ সম্পন্ন করুন।</span>
                          </div>
                          <div className="flex gap-1.5 items-start">
                            <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">3</span>
                            <span><strong>ধাপ ৩ (শারীরিক বিবরণ):</strong> আপনার সঠিক উচ্চতা, ওজন এবং রক্তের গ্রুপ ইনপুট করুন।</span>
                          </div>
                          <div className="flex gap-1.5 items-start">
                            <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">4</span>
                            <span><strong>ধাপ ৪ (সাবমিশন):</strong> ফর্ম সাবমিট করে পাসওয়ার্ড লিখে রাখুন।</span>
                          </div>
                        </div>
                      </div>

                      {/* Approval and Admit Card */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Award className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">৫. প্রবেশপত্র (Admit Card) সংগ্রহ প্রক্রিয়া</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          আবেদনটি জমা হওয়ার পর আমাদের পিইউও এবং প্লাটুন অ্যাডমিনগণ আবেদনপত্রের সকল তথ্য ও ছবি গভীরভাবে নিরীক্ষণ করবেন। সবকিছু নির্ভুল থাকলে আবেদনটি <strong>অনুমোদন (Approved)</strong> করা হবে। অনুমোদন সম্পন্ন হওয়া মাত্রই আপনি ড্যাশবোর্ডে লগইন করে অফিশিয়াল কিউআর ও বারকোড সম্বলিত প্রবেশপত্র ডাউনলোড করতে পারবেন।
                        </p>
                      </div>

                      {/* Required Documents Table */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <CheckCircle className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">৬. প্রয়োজনীয় কাগজপত্র (সংগে আনতে হবে)</h4>
                        </div>
                        <ul className="space-y-0.5 text-[9px] text-slate-700 list-disc pl-3">
                          <li>এসএসসি ও এইচএসসি সনদপত্রের ফটোকপি (২ কপি)</li>
                          <li>কলেজে ভর্তির রশিদ/রশিদ কপি (১ কপি)</li>
                          <li>পাসপোর্ট সাইজ রঙিন ছবি (২ কপি)</li>
                          <li>ব্লাড গ্রুপ রিপোর্টের ফটোকপি</li>
                          <li>জাতীয় পরিচয়পত্র অথবা জন্ম সনদের ফটোকপি</li>
                        </ul>
                      </div>

                    </div>
                  </div>

                  {/* Summary Footer Warning */}
                  <div className="border border-amber-200 bg-amber-50/30 p-3 rounded-xl text-center space-y-1 mt-1">
                    <p className="text-[10px] font-black text-amber-950">
                      সতর্কতা: ভুল বা মিথ্যা তথ্য এবং জালিয়াতিপূর্ণ ছবি প্রদান করলে আবেদনপত্র সরাসরি বাতিল বলে গণ্য হবে।
                    </p>
                    <p className="text-[8px] text-slate-500 font-mono">
                      WARNING: PROVIDING FALSE INFORMATION OR FORGED PHOTOGRAPHS WILL LEAD TO IMMEDIATE DISQUALIFICATION.
                    </p>
                  </div>

                </div>
              </div>

              {/* LETTER SIGNATURE */}
              <div className="flex justify-between items-end border-t border-slate-900 pt-3 z-10 relative">
                <div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">প্লাটুন কম্যান্ডের স্বাক্ষর ও সীল</p>
                  <p className="text-[9.5px] font-black text-slate-950">উজ্জ্বল কান্তি দেব</p>
                  <p className="text-[8px] text-slate-600">প্রফেসর আন্ডার অফিসার ও প্লাটুন কমান্ডার</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-600">কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন</p>
                  <p className="text-[8px] text-slate-400">১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট</p>
                  <p className="text-[8px] text-slate-500 font-mono uppercase mt-0.5">ENR-GUIDE-2026 OFFICIAL DOCUMENT</p>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
