import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Download, Printer, FileText, HelpCircle, X, AlertTriangle, Lock
} from "lucide-react";
import { OfflineLegalDocument } from "../components/offline/OfflineLegalDocument";
import { getBlankOfflineApplication } from "../lib/offlineApplicationStore";
import { downloadElementAsPdf } from "../lib/pdfUtils";
import { OfflineApplication } from "../types/offlineApplication";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useCMS } from "../context/CMSContext";
import { getSession } from "../lib/auth";
import { isAdminRole } from "../lib/rbac";

export function OfflineApplicationPublicPage() {
  useDocumentMeta({
    title: "Offline Application Form | Cox's Bazar City College BNCC Platoon",
    description: "Download or print the official Legal-size BNCC enrollment form and detachable admit slip.",
  });

  const { settings: cmsSettings, loading: cmsLoading } = useCMS();
  const [adminPreviewAnyway, setAdminPreviewAnyway] = useState(false);
  const currentSession = getSession();
  const isAdminSession = Boolean(currentSession && isAdminRole(currentSession.role));

  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  // Default blank template with official Legal-size layout
  const [candidateData] = useState<OfflineApplication>(() => {
    const blank = getBlankOfflineApplication();
    blank.id = "OFF-2026-PRINT";
    return blank;
  });

  const handleDownload = async () => {
    if (!docRef.current) return;
    setPdfError("");
    try {
      setDownloading(true);
      await downloadElementAsPdf(docRef.current, "BNCC_Offline_Application_Form_Legal_2026.pdf", {
        pixelRatio: 2.5,
        orientation: "p",
        format: "legal", // 8.5in x 14in
      });
    } catch (err) {
      console.error("PDF download failed:", err);
      setPdfError("PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে সরাসরি 'ফর্ম প্রিন্ট করুন' বাটনটি ব্যবহার করুন।");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!cmsLoading && cmsSettings.offlineFormOpen === false && !adminPreviewAnyway) {
    return (
      <div className="min-h-[75vh] bg-[#F5F7FA] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-[#002147] text-[#C5A059] flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
              Offline Application Portal
            </p>
            <h1 className="text-2xl font-black text-[#002147] font-display">
              অফলাইন আবেদন ফর্ম ডাউনলোড বর্তমানে বন্ধ
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              অফলাইন প্রিন্টযোগ্য ভর্তি ফর্ম বর্তমানে প্রশাসনিকভাবে বন্ধ রাখা হয়েছে। পরবর্তী নির্দেশনার জন্য প্লাটুন অফিসে অথবা নোটিশ বোর্ডে যোগাযোগ করুন।
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="px-5 py-2.5 bg-[#002147] text-white text-xs font-bold rounded-xl hover:bg-[#003366] transition-colors"
            >
              হোমপেজে ফিরে যান
            </Link>
            <Link
              to="/notices"
              className="px-5 py-2.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              নোটিশ বোর্ড
            </Link>
            {isAdminSession && (
              <button
                type="button"
                onClick={() => setAdminPreviewAnyway(true)}
                className="px-5 py-2.5 bg-[#C5A059] text-[#002147] text-xs font-black rounded-xl hover:bg-[#b59048] transition-colors cursor-pointer"
              >
                Admin Preview Form
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-slate-800 pb-20">
      {/* Hero Section */}
      <section className="bg-[#002147] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#C5A059]/30 shadow-xl relative overflow-hidden">
        <div className="max-w-6xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <FileText size={14} />
            <span>বাংলাদেশ ন্যাশনাল ক্যাডেট কোর · অফলাইন ভর্তি পোর্টাল</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white">
            অফলাইন আবেদন ফর্ম
          </h1>

          <p className="max-w-3xl mx-auto text-sm sm:text-base text-slate-200 leading-relaxed font-medium">
            কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে অফলাইনে আবেদন করার জন্য নিচের ফর্মটি ডাউনলোড করে প্রিন্ট করুন। ফর্মটি যথাযথভাবে পূরণ করে নির্ধারিত স্থানে জমা দিন।
          </p>

          {pdfError && (
            <div
              role="alert"
              className="max-w-xl mx-auto p-3 rounded-xl bg-red-950/70 border border-red-400/40 text-red-200 text-xs flex items-center justify-center gap-2"
            >
              <AlertTriangle size={15} className="shrink-0 text-red-300" />
              <span>{pdfError}</span>
            </div>
          )}

          {/* Action Buttons as requested */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {/* ১. ফর্ম ডাউনলোড করুন */}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-7 py-3.5 bg-amber-400 hover:bg-amber-300 text-[#002147] font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-amber-400/20 flex items-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={18} />
              <span>{downloading ? "PDF তৈরি হচ্ছে..." : "ফর্ম ডাউনলোড করুন"}</span>
            </button>

            {/* ২. ফর্ম প্রিন্ট করুন */}
            <button
              onClick={handlePrint}
              className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/25 font-black text-sm uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2.5 cursor-pointer"
            >
              <Printer size={18} />
              <span>ফর্ম প্রিন্ট করুন</span>
            </button>

            {/* ৩. আবেদন নির্দেশিকা */}
            <button
              onClick={() => setShowGuidelinesModal(true)}
              className="px-6 py-3.5 bg-slate-900/70 hover:bg-slate-900 text-amber-300 border border-amber-400/30 font-bold text-sm uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <HelpCircle size={18} />
              <span>আবেদন নির্দেশিকা</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4-Step Instructions Banner */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-20">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "০১",
              title: "ফর্ম ডাউনলোড ও প্রিন্ট",
              desc: "লিগ্যাল সাইজ কাগজে (Legal 8.5 x 14 ইঞ্চি) ফর্মটি প্রিন্ট করে নিন।"
            },
            {
              step: "০২",
              title: "স্বহস্তে তথ্য পূরণ",
              desc: "আবেদনকারীর নাম, পিতার নাম, মাতার নাম, ঠিকানা ও শিক্ষাগত তথ্য সঠিক বানানে লিখুন।"
            },
            {
              step: "০৩",
              title: "ছবি ও সনদপত্র সংযুক্তি",
              desc: "সত্যায়িত পাসপোর্ট সাইজ ছবি ও প্রয়োজনীয় সনদের ফটোকপি সংযুক্ত করুন।"
            },
            {
              step: "০৪",
              title: "প্লাটুন অফিসে জমা",
              desc: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের দপ্তরে নির্ধারিত তারিখের মধ্যে জমা দিন।"
            }
          ].map((item, idx) => (
            <div key={idx} className="flex gap-4 items-start">
              <span className="text-2xl font-black text-amber-500 font-mono shrink-0">
                {item.step}
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Preview Container */}
      <section className="max-w-5xl mx-auto px-4 mt-12">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileText size={20} className="text-amber-400" />
                <span>অফিসিয়াল লিগ্যাল সাইজ আবেদন ফর্ম ও প্রবেশপত্র</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                একই পৃষ্ঠায় মূল আবেদন ফর্ম ও নিচের অংশে বিচ্ছিন্নযোগ্য (Detachable) প্রবেশপত্র সংযুক্ত
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <Printer size={15} />
                <span>প্রিন্ট করুন (Legal)</span>
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={15} />
                <span>{downloading ? "ডাউনলোড..." : "PDF সংরক্ষণ"}</span>
              </button>
            </div>
          </div>

          {/* Form Scroll Area for Mobile and Desktop Viewport */}
          <div className="p-4 sm:p-8 bg-slate-100/70 overflow-x-auto flex justify-center">
            <div className="min-w-[8.5in] my-4 shadow-2xl rounded-sm overflow-hidden bg-white">
              <OfflineLegalDocument
                ref={docRef}
                application={candidateData}
                isBlankTemplate={true}
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
            কাগজের সাইজ: <strong>Legal (8.5 × 14 ইঞ্চি)</strong> | প্রিন্ট করার সময় ব্রাউজার প্রিন্ট প্রিভিউতে Paper Size: <strong>Legal</strong> নির্বাচন করুন।
          </div>
        </div>
      </section>

      {/* Guidelines Modal */}
      {showGuidelinesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowGuidelinesModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-600 flex items-center justify-center font-bold">
                <HelpCircle size={22} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">অফলাইন আবেদন নির্দেশিকা</h3>
                <p className="text-xs text-slate-500">কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন</p>
              </div>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <strong>কাগজের সাইজ:</strong> ফর্মটি অবশ্যই লিগ্যাল সাইজ (Legal 8.5 x 14 ইঞ্চি) অফসেট কাগজে এক পৃষ্ঠায় প্রিন্ট করতে হবে।
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-900">ফর্ম পূরণের নিয়মাবলী:</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
                  <li>আবেদনকারীর নাম, পিতার নাম ও মাতার নাম এসএসসি সনদের হুবহু অনুযায়ী বাংলায় ও ইংরেজি ব্লক লেটারে লিখতে হবে।</li>
                  <li>রক্তের গ্রুপ, উচ্চতা, ওজন ও সনাক্তকরণ চিহ্নের তথ্য সঠিকভাবে পূরণ করুন।</li>
                  <li>শিক্ষাগত যোগ্যতার ঘরে এসএসসি/এইচএসসি পরীক্ষার রোল, বোর্ড, জিপিএ ও পাশের সন সতর্কতার সহিত লিখুন।</li>
                  <li>অঙ্গীকারনামার নিচে আবেদনকারী ও অভিভাবকের পূর্ণ স্বাক্ষর প্রদান করতে হবে।</li>
                  <li>নিচের অংশের প্রবেশপত্রটি আলাদা করবেন না; এটি জমা দেওয়ার পর প্লাটুন কর্তৃক সত্যায়িত ও স্বাক্ষর করে ফেরত দেওয়া হবে।</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-slate-900">জমাদানের সাথে যা যা সংযুক্ত করতে হবে:</h4>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-700">
                  <li>২ কপি সত্যায়িত রঙিন পাসপোর্ট সাইজের ছবি।</li>
                  <li>এসএসসি পরীক্ষার মার্কশিট ও মূল সনদের ফটোকপি।</li>
                  <li>জাতীয় পরিচয়পত্র অথবা অনলাইন জন্ম নিবন্ধন সনদের ফটোকপি।</li>
                  <li>কলেজ ভর্তির রসিদ বা আইডেন্টিটি কার্ডের ফটোকপি।</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowGuidelinesModal(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
