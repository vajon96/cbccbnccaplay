import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, Search, Filter, Phone, Mail, 
  MapPin, Calendar, Award, Shield, X, 
  ChevronRight, ArrowRight, UserPlus, CheckCircle,
  ExternalLink, Download
} from "lucide-react";
import { useCMS } from "../context/CMSContext";
import { CMSCadetProfile } from "../types/cms";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { resolveMediaUrl } from "../lib/api";

export function CadetsPage() {
  useDocumentMeta({
    title: "Cadets Directory | Cox's Bazar City College BNCC Platoon",
    description: "Search and browse verified CBCC BNCC cadets by batch, rank, academic department, and blood group.",
  });
  const cms = useCMS();
  const [selectedBatch, setSelectedBatch] = useState<string>("All");
  const [selectedRank, setSelectedRank] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCadet, setSelectedCadet] = useState<CMSCadetProfile | null>(null);

  const batches = ["All", "2026", "2025", "2024", "2023"];
  const ranks = ["All", "Sergeant", "Lance Corporal", "Corporal", "CUO", "Cadet"];

  const filteredCadets = useMemo(() => {
    return cms.cadets.filter(cadet => {
      const matchBatch = selectedBatch === "All" || cadet.batch === selectedBatch;
      const matchRank = selectedRank === "All" || cadet.rank === selectedRank;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch = !term || 
        cadet.name.toLowerCase().includes(term) ||
        (cadet.banglaName && cadet.banglaName.includes(term)) ||
        cadet.cadetNumber.includes(term) ||
        (cadet.department && cadet.department.toLowerCase().includes(term)) ||
        (cadet.bloodGroup && cadet.bloodGroup.toLowerCase().includes(term));

      return matchBatch && matchRank && matchSearch;
    });
  }, [cms.cadets, selectedBatch, selectedRank, searchTerm]);

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-[#002147] border border-[#C5A059]/30 p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left max-w-2xl">
              <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
                <Users size={14} />
                <span>বাংলাদেশ ন্যাশনাল ক্যাডেট কোর</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display text-balance">
                ক্যাডেটবৃন্দ: <span className="text-[#C5A059]">জাতির ভবিষ্যৎ নেতৃত্ব</span>
              </h1>
              <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
                কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন (১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট)। শৃঙ্খলা, জ্ঞান ও সেবার আদর্শে উদ্বুদ্ধ হয়ে আত্মপ্রত্যয়ী ও নিষ্ঠাবান তরুণ নেতৃত্ব তৈরি করাই আমাদের লক্ষ্য।
              </p>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/15 text-xs font-medium text-slate-200 tabular-nums">
                  <Shield size={14} className="text-[#C5A059]" />
                  <span>মোট রেজিস্টার্ড ক্যাডেট: <strong className="text-white">{cms.cadets.length}+</strong></span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl border border-white/15 text-xs font-medium text-slate-200">
                  <Award size={14} className="text-[#C5A059]" />
                  <span>ব্যাচ: ২০২৩, ২০২৪, ২০২৫</span>
                </div>
              </div>
            </div>

            {/* Platoon Crest Graphic */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl bg-[#00152e] p-4 shadow-2xl border border-[#C5A059]/30">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="BNCC Platoon Crest"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-white/10 shadow-xl space-y-6 backdrop-blur-md">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                placeholder="ক্যাডেট নাম, নম্বর বা বিভাগ দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Batch Selector Tabs */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-center sm:justify-start">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mr-1">
                <Filter size={13} /> ব্যাচ:
              </span>
              {batches.map(batch => (
                <button
                  key={batch}
                  onClick={() => setSelectedBatch(batch)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedBatch === batch 
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105" 
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {batch === "All" ? "সকল ব্যাচ" : `${batch} ব্যাচ`}
                </button>
              ))}
            </div>

            {/* Rank Selector */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">পদবী:</span>
              <select
                value={selectedRank}
                onChange={(e) => setSelectedRank(e.target.value)}
                className="px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-slate-200 focus:outline-none focus:border-red-500"
              >
                <option value="All">সকল পদবী</option>
                <option value="Sergeant">সার্জেন্ট (Sergeant)</option>
                <option value="Lance Corporal">ল্যান্স কর্পোরাল</option>
                <option value="Corporal">কর্পোরাল (Corporal)</option>
                <option value="Cadet">ক্যাডেট (Cadet)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
            <span>প্রদর্শিত ক্যাডেট: <strong className="text-white">{filteredCadets.length}</strong> জন</span>
            {searchTerm && <span>অনুসন্ধান ফিল্টার সক্রিয়</span>}
          </div>
        </div>

        {/* Cadet Grid */}
        {filteredCadets.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/40 rounded-3xl border border-white/5 space-y-4">
            <Users size={48} className="mx-auto text-slate-600" />
            <h3 className="text-lg font-bold text-slate-300">কোন ক্যাডেট পাওয়া যায়নি</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              আপনার অনুসন্ধানের সাথে মিলে এমন কোনো ক্যাডেট খুঁজে পাওয়া যায়নি। অনুসন্ধান শব্দ পরিবর্তন করে আবার চেষ্টা করুন।
            </p>
            <button 
              onClick={() => { setSearchTerm(""); setSelectedBatch("All"); setSelectedRank("All"); }}
              className="px-5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors"
            >
              ফিল্টার রিসেট করুন
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredCadets.map((cadet) => (
              <motion.div
                key={cadet.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => setSelectedCadet(cadet)}
                className="group relative bg-slate-900/90 rounded-2xl overflow-hidden border border-white/10 hover:border-red-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-red-950/40 cursor-pointer flex flex-col"
              >
                {/* Photo Area */}
                <div className="relative h-60 w-full overflow-hidden bg-slate-950">
                  <img 
                    src={resolveMediaUrl(cadet.photo || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png")} 
                    alt={cadet.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      // Fallback image
                      (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                      (e.target as HTMLImageElement).className = "w-full h-full object-contain p-8 bg-slate-900 opacity-60";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  
                  {/* Batch Badge */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#00152e]/90 border border-white/15 rounded-md text-[10px] font-bold uppercase text-[#C5A059] tracking-wider">
                    {cadet.batch} ব্যাচ
                  </span>

                  {/* Rank Badge */}
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-[#002147]/95 border border-[#C5A059]/40 rounded-md text-[10px] font-bold uppercase text-white tracking-wider shadow-md">
                    {cadet.rank}
                  </span>

                  {/* Cadet Number overlay */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="bg-slate-950/80 px-2 py-0.5 rounded border border-white/10 text-[11px]">
                      #{cadet.cadetNumber}
                    </span>
                    {cadet.bloodGroup && (
                      <span className="bg-red-950/80 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-bold text-[11px]">
                        {cadet.bloodGroup}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cadet Info Body */}
                <div className="p-5 flex-grow flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                      {cadet.name}
                    </h3>
                    {cadet.banglaName && (
                      <p className="text-xs text-slate-400 font-medium">
                        {cadet.banglaName}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>বিভাগ:</span>
                      <span className="font-semibold text-slate-200">{cadet.department}</span>
                    </div>
                    {cadet.role && (
                      <div className="flex items-center justify-between text-amber-400 font-semibold">
                        <span>দায়িত্ব:</span>
                        <span className="line-clamp-1">{cadet.role}</span>
                      </div>
                    )}
                  </div>

                  <button className="w-full mt-2 py-2.5 px-3 bg-white/5 hover:bg-red-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 group-hover:shadow-lg">
                    <span>প্রোফাইল দেখুন</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Cadet Detail Modal */}
        <AnimatePresence>
          {selectedCadet && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setSelectedCadet(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex flex-col"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950">
                  <div className="flex items-center gap-3">
                    <Shield size={20} className="text-red-500" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-300">
                      অফিশিয়াল ক্যাডেট প্রোফাইল
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedCadet(null)}
                    className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                    <div className="relative w-36 h-44 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-xl bg-slate-950 shrink-0">
                      <img 
                        src={resolveMediaUrl(selectedCadet.photo || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png")} 
                        alt={selectedCadet.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                          (e.target as HTMLImageElement).className = "w-full h-full object-contain p-4 opacity-60";
                        }}
                      />
                    </div>

                    <div className="flex-grow space-y-2 text-center sm:text-left">
                      <div className="inline-block px-3 py-1 rounded-full bg-red-600/20 text-red-400 text-xs font-black uppercase tracking-wider border border-red-500/30">
                        {selectedCadet.rankFull}
                      </div>
                      <h2 className="text-2xl font-black text-white font-montserrat">
                        {selectedCadet.name}
                      </h2>
                      {selectedCadet.banglaName && (
                        <p className="text-sm font-semibold text-amber-400">
                          {selectedCadet.banglaName}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">
                        কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন &bull; কর্ণফুলী রেজিমেন্ট
                      </p>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-slate-300">
                          ক্যাডেট নং: <strong>{selectedCadet.cadetNumber}</strong>
                        </span>
                        <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-slate-300">
                          ব্যাচ: <strong>{selectedCadet.batch}</strong>
                        </span>
                        {selectedCadet.bloodGroup && (
                          <span className="px-3 py-1 bg-red-950/60 border border-red-500/40 text-red-300 rounded-lg text-xs font-bold">
                            রক্তের গ্রুপ: {selectedCadet.bloodGroup}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">শিক্ষাপ্রতিষ্ঠান</span>
                      <span className="text-sm font-semibold text-slate-200">{selectedCadet.institution}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">বিভাগ / শিক্ষাবর্ষ</span>
                      <span className="text-sm font-semibold text-slate-200">{selectedCadet.department}</span>
                    </div>
                    {selectedCadet.fatherName && (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">পিতার নাম</span>
                        <span className="text-sm font-semibold text-slate-200">{selectedCadet.fatherName}</span>
                      </div>
                    )}
                    {selectedCadet.motherName && (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">মাতার নাম</span>
                        <span className="text-sm font-semibold text-slate-200">{selectedCadet.motherName}</span>
                      </div>
                    )}
                    {selectedCadet.district && (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">জেলা</span>
                        <span className="text-sm font-semibold text-slate-200">{selectedCadet.district}</span>
                      </div>
                    )}
                    {selectedCadet.joinDate && (
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">যোগদানের তারিখ</span>
                        <span className="text-sm font-semibold text-slate-200">{selectedCadet.joinDate}</span>
                      </div>
                    )}
                  </div>

                  {selectedCadet.bio && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">সংক্ষিপ্ত বিবরণ</span>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {selectedCadet.bio}
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-950">
                  <span className="text-xs text-slate-500">
                    বাংলাদেশ ন্যাশনাল ক্যাডেট কোর
                  </span>
                  <button 
                    onClick={() => setSelectedCadet(null)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Join CTA Banner */}
        <div className="p-8 sm:p-10 rounded-2xl bg-[#002147] border border-[#C5A059]/30 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-white font-display">
              আপনিও হতে পারেন গর্বিত বিএনসিসি ক্যাডেট!
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl">
              কক্সবাজার সিটি কলেজের একাদশ ও ডিগ্রি ১ম বর্ষের শিক্ষার্থীরা অনলাইনে বা অফলাইন ফর্ম জমা দিয়ে বিএনসিসি প্লাটুনে যোগ দিতে পারেন।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link 
              to="/enroll" 
              className="px-6 py-3 rounded-xl bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center gap-2"
            >
              <UserPlus size={15} />
              <span>অনলাইনে আবেদন করুন</span>
            </Link>
            <Link 
              to="/offline-application" 
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors border border-white/15"
            >
              <span>অফলাইন ফর্ম</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
