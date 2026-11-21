import { motion } from "framer-motion";
import { 
  Activity, Award, Shield, Flag, Heart, 
  Target, Users, Calendar, ArrowRight, CheckCircle 
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCMS } from "../context/CMSContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function ActivitiesPage() {
  useDocumentMeta({
    title: "Activities & Training | Cox's Bazar City College BNCC Platoon",
    description: "Weekly parade drills, annual training camps (ATC), disaster relief, and leadership missions of CBCC BNCC Platoon.",
  });
  const cms = useCMS();
  const activities = cms.activities;

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto relative z-10 space-y-16">
        {/* Banner Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <Activity size={14} />
            <span>প্লাটুন কার্যক্রম ও প্রশিক্ষণ · Activities</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display uppercase text-balance">
            ক্যাডেটদের <span className="text-[#C5A059]">নিয়মিত ও বাৎসরিক কার্যক্রম</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            শৃঙ্খলা, নেতৃত্ব ও সামরিক দক্ষতার সমন্বয়ে কক্সবাজার সিটি কলেজ প্লাটুনের ক্যাডেটরা বছরজুড়ে বিভিন্ন অ্যাকাডেমিক, রেজিমেন্টাল ও সমাজসেবামূলক কার্যক্রমে নিয়োজিত থাকে।
          </p>
        </div>

        {/* Activities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map((act, idx) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="bg-[#061830] rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between hover:border-[#C5A059]/45 transition-all shadow-xl group"
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-[#00152e]">
                  <img 
                    src={act.image || "/assets/aistudio/dddf__1__7ebcab35.jpg"} 
                    alt={act.title || "Activity"}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/aistudio/dddf__1__7ebcab35.jpg";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061830] via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#002147]/95 border border-[#C5A059]/40 text-[#C5A059] text-[10px] font-bold uppercase tracking-wider rounded-md shadow">
                    {act.category}
                  </span>
                </div>

                <div className="p-6 space-y-3">
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {act.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {act.desc}
                  </p>
                </div>
              </div>

              <div className="p-6 pt-0">
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                  {act.tags.map((tag, tIdx) => (
                    <span key={tIdx} className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-slate-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Highlights Banner */}
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <Award className="text-amber-400" size={28} />
            <div>
              <h2 className="text-xl font-bold text-white">বাৎসরিক প্রশিক্ষণ সূচি ও সময়সূচি</h2>
              <p className="text-xs text-slate-400">ক্যাম্পাসে প্রতি সপ্তাহের নিয়মিত কার্যক্রম</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">শুক্রবার ও শনিবার</span>
              <p className="font-semibold text-white">সকাল ৭:০০ টা - ৯:০০ টা</p>
              <p className="text-slate-400">কলেজ প্যারেড গ্রাউন্ডে নিয়মিত ড্রিল ও পিটি</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">তত্ত্বীয় ক্লাস</span>
              <p className="font-semibold text-white">মাসিক ২ দিন</p>
              <p className="text-slate-400">ম্যাপ রিডিং, সামরিক ইতিহাস ও প্রাথমিক চিকিৎসা</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-white/5 space-y-1">
              <span className="font-bold text-amber-400 uppercase tracking-wider block">রেজিমেন্ট ক্যাম্প</span>
              <p className="font-semibold text-white">শীতকালীন অবকাশ</p>
              <p className="text-slate-400">ক্যান্টনমেন্টে সম্মিলিত বাৎসরিক প্রশিক্ষণ ক্যাম্প</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-6 space-y-4">
          <h3 className="text-xl font-bold text-white">ক্যাডেট কার্যক্রমের আরও ছবি দেখতে চান?</h3>
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-lg"
          >
            <span>ফটো গ্যালারি দেখুন</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
