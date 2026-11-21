import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bell, FileText, Search, Calendar, Filter, 
  Download, Printer, X, ChevronRight, CheckCircle,
  AlertCircle, Shield, ArrowUpRight, Archive
} from "lucide-react";
import { useCMS } from "../context/CMSContext";
import { CMSNoticeItem } from "../types/cms";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function NoticeBoardPage() {
  useDocumentMeta({
    title: "Notice Board | Cox's Bazar City College BNCC Platoon",
    description: "Official dispatches, parade orders, recruitment notices, and training schedules from CBCC BNCC Platoon.",
  });
  const cms = useCMS();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [viewStatus, setViewStatus] = useState<"Active" | "Archived">("Active");
  const [selectedNotice, setSelectedNotice] = useState<CMSNoticeItem | null>(null);

  const categories = ["All", "Recruitment", "Parade", "Training", "Orders", "Welfare", "Exam", "General"];

  const filteredNotices = useMemo(() => {
    return cms.notices.filter(notice => {
      const matchStatus = notice.status === viewStatus;
      const matchCat = selectedCategory === "All" || notice.category === selectedCategory;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || 
        notice.title.toLowerCase().includes(term) ||
        (notice.titleEnglish && notice.titleEnglish.toLowerCase().includes(term)) ||
        notice.refNumber.toLowerCase().includes(term) ||
        notice.summary.toLowerCase().includes(term);

      return matchStatus && matchCat && matchSearch;
    });
  }, [cms.notices, searchTerm, selectedCategory, viewStatus]);

  const handlePrint = (_notice: CMSNoticeItem) => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172033] py-12 md:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Institutional Header */}
        <div className="bg-[#002147] text-white rounded-2xl p-8 sm:p-12 shadow-2xl relative overflow-hidden border border-[#C5A059]/30">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-3 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
                <Bell size={14} />
                <span>অফিসিয়াল ডিজিটাল নোটিশ বোর্ড</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-display text-white">
                বিজ্ঞপ্তি ও আদেশমালা <span className="text-[#C5A059]">· Notice Board</span>
              </h1>
              <p className="text-slate-200 text-sm max-w-2xl leading-relaxed">
                কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের ভর্তি, প্যারেড শিডিউল, বাৎসরিক ক্যাম্প ও বিশেষ আদেশ সংক্রান্ত সর্বশেষ আনুষ্ঠানিক নির্দেশনাসমূহ।
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#0B2545] p-1.5 rounded-2xl border border-white/10 shrink-0">
              <button
                onClick={() => setViewStatus("Active")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  viewStatus === "Active" 
                    ? "bg-[#C5A059] text-[#002147] shadow-lg" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                চলতি নোটিশ
              </button>
              <button
                onClick={() => setViewStatus("Archived")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewStatus === "Archived" 
                    ? "bg-[#C5A059] text-[#002147] shadow-lg" 
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Archive size={13} />
                <span>আর্কাইভ</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter and Search Console */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="বিজ্ঞপ্তির শিরোনাম বা স্মারক নম্বর দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#002147] transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
              <Filter size={14} className="text-[#C5A059] shrink-0 mr-1 hidden sm:block" />
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#002147] text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat === "All" ? "সকল ক্যাটাগরি" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notices List */}
        {filteredNotices.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 space-y-3">
            <FileText size={48} className="mx-auto text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">কোনো বিজ্ঞপ্তি পাওয়া যায়নি</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              আপনার নির্বাচিত ফিল্টার বা অনুসন্ধান শব্দের সাথে কোনো নোটিশ মিলছে না।
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotices.map((notice, idx) => (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedNotice(notice)}
                className="bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-[#002147]/40 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-5 group"
              >
                <div className="space-y-2 flex-grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#002147]/10 text-[#002147]">
                      {notice.category}
                    </span>
                    <span className="font-mono text-[11px] text-[#8d6b26] font-bold">
                      {notice.refNumber}
                    </span>
                    {notice.isImportant && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                        জরুরি
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#002147] group-hover:text-[#8d6b26] transition-colors leading-snug">
                    {notice.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {notice.summary}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1 font-medium tabular-nums">
                      <Calendar size={13} className="text-[#C5A059]" />
                      {notice.publishDate}
                    </span>
                    <span>·</span>
                    <span>স্বাক্ষরকারী: <strong className="text-slate-700">{notice.signedBy}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  <button className="px-4 py-2 bg-[#F5F7FA] hover:bg-[#002147] text-[#002147] hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <span>পূর্ণাঙ্গ নোটিশ</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Notice View Modal */}
        <AnimatePresence>
          {selectedNotice && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedNotice(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="bg-[#002147] text-white p-6 border-b border-[#C5A059]/30 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-[#C5A059] tracking-widest">
                      স্মারক: {selectedNotice.refNumber}
                    </span>
                    <h2 className="text-lg font-bold text-white line-clamp-1">
                      {selectedNotice.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedNotice(null)}
                    aria-label="Close notice"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Content & Safe Print Area */}
                <div className="p-8 overflow-y-auto space-y-6 text-[#172033] print-area">
                  <div className="hidden print:block text-center border-b-2 border-[#002147] pb-4 mb-4">
                    <h1 className="text-xl font-bold text-[#002147]">কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন</h1>
                    <p className="text-xs text-slate-600">১৫ বিএনসিসি ব্যাটালিয়ন · কর্ণফুলী রেজিমেন্ট (আর্মি উইং)</p>
                    <p className="text-sm font-bold text-[#002147] mt-2">{selectedNotice.title}</p>
                  </div>
                  {/* Notice Metadata Strip */}
                  <div className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">প্রকাশের তারিখ</span>
                      <span className="font-bold text-[#002147]">{selectedNotice.publishDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">ক্যাটাগরি</span>
                      <span className="font-bold text-[#002147]">{selectedNotice.category}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">স্বাক্ষরিত</span>
                      <span className="font-bold text-[#002147]">{selectedNotice.signedBy} ({selectedNotice.designation})</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="space-y-4 text-sm leading-relaxed whitespace-pre-line text-slate-800">
                    {selectedNotice.content}
                  </div>

                  {/* Attachment Section if any */}
                  {selectedNotice.attachmentName && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <FileText className="text-[#C5A059]" size={24} />
                        <div>
                          <p className="text-xs font-bold text-[#002147]">{selectedNotice.attachmentName}</p>
                          <span className="text-[10px] text-slate-500">সংযুক্তি ডকুমেন্ট (Official Attachment)</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePrint(selectedNotice)}
                        className="px-4 py-2 bg-[#002147] hover:bg-[#0B2545] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Download size={13} />
                        <span>ডাউনলোড / প্রিন্ট</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-[#F5F7FA] border-t border-slate-200 flex items-center justify-between">
                  <button
                    onClick={() => handlePrint(selectedNotice)}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>প্রিন্ট করুন</span>
                  </button>

                  <button
                    onClick={() => setSelectedNotice(null)}
                    className="px-6 py-2.5 bg-[#002147] hover:bg-[#0B2545] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
