import { motion } from "framer-motion";
import {
  Trophy, Medal, Calendar, Star,
  Phone, Mail, ChevronRight, UserCheck
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCMS } from "../context/CMSContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { resolveMediaUrl } from "../lib/api";

export function HallOfInchargesPage() {
  useDocumentMeta({
    title: "Hall of Incharges | Cox's Bazar City College BNCC Platoon",
    description: "Leadership record of the Platoon Commander and batch-wise Cadet In-Charges at Cox's Bazar City College BNCC Platoon.",
  });

  const cms = useCMS();
  const commander = cms.commander;
  const incharges = cms.incharges;

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto relative z-10 space-y-14">
        {/* Banner Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <Trophy size={14} />
            <span>Hall of Platoon In-Charges</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display uppercase text-balance">
            হল অব <span className="text-[#C5A059]">ইন-চার্জেস</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Honoring the Vanguard of Leadership · কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন (আর্মি উইং)। শৃঙ্খলা, আত্মত্যাগ এবং নেতৃত্বের অনুপ্রেরণামূলক ঐতিহ্য।
          </p>
        </div>

        {/* Platoon Commander Featured Card */}
        <div className="rounded-2xl bg-[#002147] border border-[#C5A059]/35 p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center gap-8 lg:gap-12">
            <div className="shrink-0 space-y-3 text-center">
              <div className="w-44 h-52 sm:w-52 sm:h-64 rounded-xl overflow-hidden border-2 border-[#C5A059] shadow-2xl bg-[#00152e] mx-auto">
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
              <span className="inline-block text-xs font-extrabold uppercase tracking-widest text-[#C5A059]">
                প্লাটুন কমান্ডার
              </span>
            </div>

            <div className="space-y-4 text-center md:text-left flex-grow">
              <div className="space-y-1">
                <div className="text-xs font-extrabold uppercase tracking-widest text-[#C5A059]">
                  {commander.rank}
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display">
                  {commander.name}
                </h2>
                <p className="text-sm font-semibold text-slate-200">
                  {commander.banglaName} · {commander.institution}
                </p>
                <p className="text-xs text-slate-300">
                  {commander.regiment}
                </p>
              </div>

              <blockquote className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                &ldquo;{commander.message}&rdquo;
              </blockquote>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2 text-xs">
                <a
                  href={`tel:${commander.phone}`}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#020B18] border border-white/15 rounded-xl text-slate-200 hover:text-white hover:border-[#C5A059] transition-colors tabular-nums"
                >
                  <Phone size={14} className="text-[#C5A059]" />
                  <span>{commander.phone}</span>
                </a>
                <a
                  href={`mailto:${commander.email}`}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#020B18] border border-white/15 rounded-xl text-slate-200 hover:text-white hover:border-[#C5A059] transition-colors"
                >
                  <Mail size={14} className="text-[#C5A059]" />
                  <span>{commander.email}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* In-Charges History Grid */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2 font-display">
              <Medal className="text-[#C5A059]" size={24} />
              <span>প্লাটুন ইন-চার্জ ইতিহাস (ব্যাচভিত্তিক)</span>
            </h2>
            <p className="text-xs text-slate-400">
              ব্যাচ ১ থেকে বর্তমান ব্যাচ পর্যন্ত দায়িত্ব পালনকারী সকল প্লাটুন ইন-চার্জের তালিকা।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {incharges.map((record, index) => (
              <motion.div
                key={record.batch}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                className="bg-[#061830] rounded-2xl border border-white/10 p-6 flex flex-col justify-between space-y-5 hover:border-[#C5A059]/45 transition-colors shadow-xl group"
              >
                <div className="space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
                    <span className="font-extrabold uppercase tracking-wider text-[#C5A059]">
                      {record.batch}
                    </span>
                    {record.term && (
                      <span className="text-slate-300 flex items-center gap-1.5 font-medium tabular-nums">
                        <Calendar size={13} className="text-[#C5A059]" />
                        {record.term}
                      </span>
                    )}
                  </div>

                  {/* Leader Info */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-3 shrink-0">
                      <div className="w-20 h-24 rounded-xl overflow-hidden border-2 border-[#C5A059]/70 shadow-lg bg-[#020B18]">
                        <img
                          src={resolveMediaUrl(record.photoUrl || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png")}
                          alt={record.name || "In-Charge"}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-top"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                          }}
                        />
                      </div>
                      {Boolean(record.coPhotoUrl && record.coPhotoUrl.trim() !== "") && (
                        <div className="w-20 h-24 rounded-xl overflow-hidden border-2 border-white/40 shadow-lg bg-[#020B18]">
                          <img
                            src={resolveMediaUrl(record.coPhotoUrl)}
                            alt="Co-In-Charge"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-top"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 flex-grow">
                      <h3 className="text-lg font-bold text-white group-hover:text-[#C5A059] transition-colors">
                        {record.name}
                      </h3>
                      {record.banglaName && (
                        <p className="text-xs font-medium text-slate-300">
                          {record.banglaName}
                        </p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        {Boolean(record.rankBadgeUrl && record.rankBadgeUrl.trim() !== "") && (
                          <img
                            src={resolveMediaUrl(record.rankBadgeUrl)}
                            alt="Rank Badge"
                            referrerPolicy="no-referrer"
                            className="h-6 w-auto object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <span className="text-xs font-semibold text-slate-300">
                          {record.rankTitle}
                        </span>
                      </div>
                    </div>
                  </div>

                  {record.awards && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#002147] border border-[#C5A059]/30 rounded-lg text-[#e5c784] text-xs font-bold">
                      <Star size={13} className="text-[#C5A059]" />
                      <span>{record.awards}</span>
                    </div>
                  )}

                  {record.bio && (
                    <p className="text-xs text-slate-300 leading-relaxed pt-1">
                      {record.bio}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span>কক্সবাজার সিটি কলেজ প্লাটুন</span>
                  <span className="text-[#C5A059] font-semibold">আর্মি উইং</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="p-8 rounded-2xl bg-[#061830] border border-white/10 text-center space-y-4">
          <UserCheck size={36} className="mx-auto text-[#C5A059]" />
          <h3 className="text-xl font-bold text-white font-display">
            ক্যাডেটদের সম্পূর্ণ তালিকা দেখতে চান?
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto">
            আমাদের সকল ব্যাচের রেজিস্টার্ড ক্যাডেটদের প্রোফাইল, রক্তের গ্রুপ, বিভাগ ও ছবি দেখতে ক্যাডেট ডিরেক্টরিতে যান।
          </p>
          <div className="pt-2">
            <Link
              to="/cadets"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg"
            >
              <span>ক্যাডেট ডিরেক্টরি দেখুন</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
