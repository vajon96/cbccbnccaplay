import { motion } from "framer-motion";
import { 
  Shield, Award, Compass, Flag, HeartHandshake, 
  Users, CheckCircle, ChevronRight, UserPlus, Phone, Mail 
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCMS } from "../context/CMSContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { resolveMediaUrl } from "../lib/api";

export function AboutPage() {
  useDocumentMeta({
    title: "About Us | Cox's Bazar City College BNCC Platoon",
    description: "Institutional mission, history, and regiment details of Cox's Bazar City College BNCC Platoon under 15 BNCC Battalion.",
  });
  const cms = useCMS();
  const commander = cms.commander;

  const pillars = [
    {
      title: "জ্ঞান ও শৃঙ্খলা (Knowledge & Discipline)",
      desc: "বিএনসিসির মূলমন্ত্র ধারণ করে অ্যাকাডেমিক শিক্ষার পাশাপাশি মানসিক দৃঢ়তা ও সামরিক শৃঙ্খলার সমন্বয় সাধন।"
    },
    {
      title: "স্বেচ্ছাসেবক চেতনা (Selfless Service)",
      desc: "বন্যা, ঘূর্ণিঝড়, মহামারী এবং যে কোনো জাতীয় দুর্যোগে সামনে থেকে সাধারণ মানুষের পাশে দাঁড়ানোর মানসিকতা।"
    },
    {
      title: "নেতৃত্ব ও সময়ানুবর্তিতা (Leadership)",
      desc: "ক্যাম্প ও প্যারেডের মাধ্যমে কমান্ড পরিচালনা, সিদ্ধান্ত গ্রহণ এবং প্রতিকূল পরিস্থিতিতে নেতৃত্ব দেওয়ার দক্ষতা অর্জন।"
    },
    {
      title: "দেশপ্রেম ও জাতীয় ঐক্য (Patriotism)",
      desc: "বাংলাদেশের স্বাধীনতা ও সার্বভৌমত্ব রক্ষায় সর্বদা প্রস্তুত থাকা দ্বিতীয় প্রতিরক্ষা স্তরের নির্ভীক প্রহরী।"
    }
  ];

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto relative z-10 space-y-16">
        {/* Banner Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <Shield size={14} />
            <span>আমাদের সম্পর্কে · About Us</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display uppercase text-balance">
            কক্সবাজার সিটি কলেজ <span className="text-[#C5A059]">বিএনসিসি প্লাটুন</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            ১৫ বিএনসিসি ব্যাটালিয়ন · কর্ণফুলী রেজিমেন্ট (আর্মি উইং)। দেশপ্রেম, শৃঙ্খলা ও আত্মত্যাগের মহান ব্রত নিয়ে গড়ে ওঠা এক অনন্য সামরিক যুব সংগঠন।
          </p>
        </div>

        {/* Flag Ribbon Graphic */}
        <div className="w-full flex justify-center py-2">
          <img 
            src={resolveMediaUrl("/assets/aistudio/New_Project__2__6a6c0725.png")} 
            alt="BNCC Flag Ribbon" 
            referrerPolicy="no-referrer"
            className="max-h-16 w-auto object-contain filter drop-shadow-lg"
          />
        </div>

        {/* Story & Mission Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
              <Compass size={16} />
              <span>আমাদের দর্শন ও ঐতিহ্য</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-montserrat leading-tight">
              জাতির সংকটে দ্বিতীয় প্রতিরক্ষা স্তর ও তারুণ্যের শক্তি
            </h2>
            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <p>
                বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC) দেশের শিক্ষার্থীদের সামরিক প্রশিক্ষণ প্রদান, জাতীয় প্রতিরক্ষা সহায়তা এবং যুব সমাজের চরিত্র গঠনের লক্ষ্যে পরিচালিত বাংলাদেশের একমাত্র ত্রি-মাত্রিক আধাসামরিক ছাত্র সংগঠন।
              </p>
              <p>
                কক্সবাজারের অন্যতম শীর্ষ বিদ্যাপীঠ <strong>কক্সবাজার সিটি কলেজে</strong> অবস্থিত এই প্লাটুনটি ১৫ বিএনসিসি ব্যাটালিয়নের অধীনে কর্ণফুলী রেজিমেন্টের অন্যতম সুশৃঙ্খল ও মর্যাদাপূর্ণ ইউনিট। প্রতি বছর এই প্লাটুন থেকে শত শত তরুণ শিক্ষার্থী শৃঙ্খলা, সামরিক ড্রিল, অস্ত্র প্রশিক্ষণ ও আত্মরক্ষার শিক্ষা নিয়ে সুনাগরিক হিসেবে আত্মপ্রকাশ করছে।
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
                <span className="text-2xl font-black text-amber-400 font-mono">15</span>
                <p className="text-xs text-slate-400 font-semibold mt-1">বিএনসিসি ব্যাটালিয়ন</p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-white/5">
                <span className="text-2xl font-black text-red-500 font-mono">Karnaphuli</span>
                <p className="text-xs text-slate-400 font-semibold mt-1">রেজিমেন্ট (আর্মি উইং)</p>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#061830]">
            <img 
              src={resolveMediaUrl("/assets/aistudio/dddf__1__7ebcab35.jpg")} 
              alt="Platoon in Parade"
              referrerPolicy="no-referrer"
              className="w-full h-80 object-cover object-center"
            />
            <div className="p-6 bg-[#061830] space-y-2">
              <span className="text-xs font-bold text-[#C5A059] uppercase tracking-widest">প্যারেড গ্রাউন্ড পরিদর্শন</span>
              <p className="text-xs text-slate-300 leading-relaxed">
                সিটি কলেজ ক্যাম্পাসে নিয়মিত সাপ্তাহিক ড্রিল, গার্ড অব অনার এবং জাতীয় দিবসসমূহে আনুষ্ঠানিক কুচকাওয়াজ প্রদর্শন।
              </p>
            </div>
          </div>
        </div>

        {/* 4 Pillars Grid */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-white uppercase tracking-tight font-display">
              প্লাটুনের মূল ভিত্তি ও আদর্শ
            </h2>
            <p className="text-xs text-slate-300">
              যে চারটি মূল স্তম্ভের ওপর আমাদের প্লাটুনের প্রশিক্ষণ ও চেতনা প্রতিষ্ঠিত
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((pil, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-2xl bg-[#061830] border border-white/10 hover:border-[#C5A059]/40 transition-all space-y-2 group shadow-xl"
              >
                <div className="w-10 h-10 rounded-lg bg-[#002147] border border-[#C5A059]/30 text-[#C5A059] flex items-center justify-center font-bold text-sm tabular-nums">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-[#C5A059] transition-colors">
                  {pil.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {pil.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Platoon Commander Section */}
        <div className="p-8 sm:p-12 rounded-2xl bg-[#002147] border border-[#C5A059]/30 shadow-2xl flex flex-col md:flex-row items-center gap-8">
          <div className="w-40 h-48 rounded-xl overflow-hidden border-2 border-[#C5A059] shadow-xl shrink-0 bg-[#00152e]">
            <img 
              src={resolveMediaUrl(commander.photoUrl || "/assets/aistudio/POU_7647ec14.png")} 
              alt={commander.name || "Platoon Commander"}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top"
              onError={(e) => {
                (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/POU_7647ec14.png");
              }}
            />
          </div>

          <div className="space-y-3 text-center md:text-left">
            <span className="text-xs font-bold text-[#C5A059] uppercase tracking-widest">
              প্লাটুন নেতৃত্ব ও নির্দেশনা
            </span>
            <h3 className="text-2xl font-bold text-white font-display">
              {commander.name} ({commander.banglaName})
            </h3>
            <p className="text-xs text-[#e5c784] font-bold uppercase tracking-wider">
              {commander.rank} · {commander.designation}
            </p>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
              &ldquo;{commander.message}&rdquo;
            </p>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs text-slate-300">
              <span className="flex items-center gap-1.5 tabular-nums">
                <Phone size={13} className="text-[#C5A059]" />
                {commander.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <Mail size={13} className="text-[#C5A059]" />
                {commander.email}
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-2xl bg-[#061830] border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">প্লাটুনের কার্যক্রম এবং ফটো গ্যালারি দেখুন</h3>
            <p className="text-xs text-slate-300">আমাদের ক্যাডেটদের বাৎসরিক ক্যাম্প, ড্রিল ও সমাজসেবামূলক কর্মকাণ্ডের ছবি</p>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/activities" 
              className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
            >
              কার্যক্রম
            </Link>
            <Link 
              to="/gallery" 
              className="px-5 py-2.5 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] rounded-xl text-xs font-extrabold transition-colors shadow-lg"
            >
              গ্যালারি
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
