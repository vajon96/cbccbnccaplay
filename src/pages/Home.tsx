import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users, Award, ArrowRight, FileText, Phone,
  Sparkles, Send, Loader2, BookOpen, Camera,
  Shield, CheckCircle, Bell, Scan, ChevronRight, HelpCircle
} from "lucide-react";
import { getQuickFAQ } from "../services/geminiService";
import { CircularViewerModal } from "../components/modular/CircularViewerModal";
import { AdmissionGuideModal } from "../components/AdmissionGuideModal";
import { useCMS } from "../context/CMSContext";
import { useLanguage } from "../context/LanguageContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { resolveMediaUrl } from "../lib/api";

export function Home() {
  const cms = useCMS();
  const { lang, t } = useLanguage();

  useDocumentMeta({
    title:
      lang === "bn"
        ? "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন | অফিসিয়াল পোর্টাল"
        : "Cox's Bazar City College BNCC Platoon | Official Portal",
    description:
      "Official digital command portal of Cox's Bazar City College BNCC Platoon (Army Wing, 15 BNCC Battalion, Karnaphuli Regiment, E Company).",
  });

  const heroSection = cms.sections.find((s) => s.id === "home.hero");
  const bgImage = heroSection?.customData?.bgImage || "/assets/aistudio/dddf__1__7ebcab35.jpg";
  const titlePre = cms.getText(
    "home.hero.title_pre",
    lang === "bn" ? "কক্সবাজার সিটি কলেজ" : "Cox's Bazar City College",
    lang
  );
  const titlePost = cms.getText(
    "home.hero.title_post",
    lang === "bn" ? "বিএনসিসি প্লাটুন" : "BNCC Platoon",
    lang
  );
  const heroSubtitle = cms.getText("home.hero.subtitle", "DISCIPLINE. LEADERSHIP. SERVICE.", lang);
  const heroDesc = cms.getText("home.hero.description", t("heroSubtitle"), lang);
  const latestNotice = cms.notices.find((n) => n.status === "Active") || cms.notices[0];
  const commander = cms.commander;

  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [isFaqLoading, setIsFaqLoading] = useState(false);
  const [isCircularOpen, setIsCircularOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleFaqSubmit = async () => {
    if (!faqQuestion.trim() || isFaqLoading) return;
    setIsFaqLoading(true);
    const answer = await getQuickFAQ(faqQuestion);
    setFaqAnswer(answer);
    setIsFaqLoading(false);
  };

  const verifiedStats = [
    {
      label: t("statsFounded"),
      value: lang === "bn" ? "২০২০" : "2020",
      desc: "ESTD. 03 Sep 2020 · Official Approval",
    },
    {
      label: lang === "bn" ? "রেজিমেন্ট" : "Regiment",
      value: lang === "bn" ? "কর্ণফুলী" : "Karnaphuli",
      desc: "Karnaphuli Regiment HQ",
    },
    {
      label: t("statsBattalion"),
      value: lang === "bn" ? "১৫ বিএনসিসি" : "15 BNCC",
      desc: "15 BNCC Battalion · Army Wing",
    },
    {
      label: lang === "bn" ? "কোম্পানি ও উইং" : "Company & Wing",
      value: lang === "bn" ? "ই কোম্পানি" : "E Company",
      desc: "Army Wing · Mixed Platoon",
    },
  ];

  const portalServices = [
    {
      to: "/cadets",
      icon: Users,
      title: lang === "bn" ? "ক্যাডেট ডিরেক্টরি" : t("serviceDirectoryTitle"),
      desc:
        lang === "bn"
          ? "ব্যাচভিত্তিক ক্যাডেট প্রোফাইল, রক্তের গ্রুপ ও একাডেমিক বিভাগ।"
          : t("serviceDirectoryDesc"),
      cta: lang === "bn" ? "ডিরেক্টরি দেখুন" : "View Roster",
    },
    {
      to: "/hall-of-incharges",
      icon: Award,
      title: lang === "bn" ? "হল অব ইন-চার্জেস" : t("navIncharges"),
      desc:
        lang === "bn"
          ? "ব্যাচ ১ থেকে বর্তমান পর্যন্ত সকল প্লাটুন ইন-চার্জদের নেতৃত্বের ইতিহাস।"
          : "Chronicle of Cadet In-Charges and platoon commanders from Batch 1 onward.",
      cta: lang === "bn" ? "ইতিহাস দেখুন" : "View Archive",
    },
    {
      to: "/notices",
      icon: Bell,
      title: t("serviceNoticesTitle"),
      desc: t("serviceNoticesDesc"),
      cta: lang === "bn" ? "বিজ্ঞপ্তি দেখুন" : "Read Dispatches",
    },
    {
      to: "/qr-scan",
      icon: Scan,
      title: t("serviceQrTitle"),
      desc: t("serviceQrDesc"),
      cta: lang === "bn" ? "স্ক্যান শুরু করুন" : "Launch Scanner",
    },
    ...(cms.settings.examPortalOpen !== false
      ? [
          {
            to: "/exam",
            icon: BookOpen,
            title: t("serviceExamTitle"),
            desc: t("serviceExamDesc"),
            cta: lang === "bn" ? "পরীক্ষা পোর্টালে যান" : "Enter Exam Hub",
          },
        ]
      : []),
    {
      to: "/gallery",
      icon: Camera,
      title: t("navGallery"),
      desc:
        lang === "bn"
          ? "প্যারেড, ড্রিল, বাৎসরিক প্রশিক্ষণ ক্যাম্প ও ক্যাডেটদের আলোকচিত্র সম্ভার।"
          : "Curated parade ground photography, battalion camps, and national observances.",
      cta: lang === "bn" ? "গ্যালারি দেখুন" : "Browse Archive",
    },
    {
      to: "/offline-application",
      icon: FileText,
      title: t("serviceOfflineTitle"),
      desc: t("serviceOfflineDesc"),
      cta: lang === "bn" ? "ফর্ম প্রিন্ট করুন" : "Print Forms",
    },
    {
      to: "/how-to-become-cadet",
      icon: HelpCircle,
      title: t("navGuide"),
      desc:
        lang === "bn"
          ? "শারীরিক পরিমাপ, শিক্ষাগত যোগ্যতা ও ৫ ধাপের নির্বাচন প্রক্রিয়া।"
          : "Physical standards, academic eligibility, and step-by-step selection protocol.",
      cta: lang === "bn" ? "নির্দেশিকা দেখুন" : "Read Guide",
    },
  ];

  return (
    <div className="space-y-20 pb-24 bg-[#F5F7FA] text-[#172033]">
      {/* 1. ASYMMETRIC INSTITUTIONAL EDITORIAL HERO */}
      <section className="relative overflow-hidden bg-[#002147] border-b border-[#C5A059]/25">
        <div className="absolute inset-0 z-0">
          <img
            src={resolveMediaUrl(bgImage)}
            className="w-full h-full object-cover object-center opacity-20 filter brightness-75"
            alt="Cox's Bazar City College BNCC Platoon in Parade"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#00152e] via-[#002147]/92 to-[#002147]/80" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Editorial Copy Column */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-7 space-y-6 text-left"
            >
              {/* Crisp unboxed typographic eyebrow (zero pill clutter) */}
              <div className="flex items-center gap-3 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
                <span className="h-px w-8 bg-[#C5A059]" aria-hidden="true" />
                <span>{cms.settings.regimentInfo || t("heroKicker")}</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold text-white leading-[1.12] font-display tracking-tight text-balance">
                {titlePre}{" "}
                <span className="text-[#C5A059] block sm:inline">{titlePost}</span>
              </h1>

              <p className="text-xs sm:text-sm font-bold text-[#e5c784] tracking-[0.18em] uppercase font-mono">
                {heroSubtitle} · {cms.settings.motto || "জ্ঞান ও শৃঙ্খলা"}
              </p>

              <p className="text-sm sm:text-base text-slate-200 max-w-2xl leading-relaxed">
                {heroDesc}
              </p>

              {/* High-contrast CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/enroll"
                  className="px-7 py-3.5 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition-colors shadow-xl"
                >
                  <span>{cms.getText("home.hero.cta_online", t("ctaEnroll"), lang)}</span>
                  <ArrowRight size={16} />
                </Link>

                {cms.settings.examPortalOpen !== false && (
                  <Link
                    to="/exam"
                    className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/20 flex items-center gap-2 transition-colors"
                  >
                    <BookOpen size={16} className="text-[#C5A059]" />
                    <span>{t("ctaExamPortal")}</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setIsCircularOpen(true)}
                  className="px-5 py-3.5 bg-[#00152e]/80 hover:bg-[#00152e] text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/15 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText size={16} className="text-[#C5A059]" />
                  <span>{cms.getText("home.hero.cta_circular", t("navCircular"), lang)}</span>
                </button>
              </div>

              {/* Latest Dispatch Strip */}
              {latestNotice && (
                <div className="mt-6 p-3.5 bg-[#00152e]/80 rounded-xl border border-white/15 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="px-2.5 py-1 bg-[#C5A059] text-[#00152e] rounded-md text-[10px] font-black uppercase tracking-wider shrink-0">
                      {lang === "bn" ? "সর্বশেষ নোটিশ" : "Latest Notice"}
                    </span>
                    <span className="text-xs text-slate-100 truncate font-medium">
                      {latestNotice.title}
                    </span>
                  </div>
                  <Link
                    to="/notices"
                    className="text-xs font-bold text-[#C5A059] hover:underline shrink-0 flex items-center gap-1"
                  >
                    <span>{lang === "bn" ? "সব দেখুন" : "View all"}</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}
            </motion.div>

            {/* Right Photographic Institutional Dossier Frame */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="lg:col-span-5"
            >
              <div className="rounded-2xl overflow-hidden border border-[#C5A059]/35 bg-[#061830] shadow-2xl">
                <div className="relative h-64 sm:h-72 overflow-hidden bg-[#00152e]">
                  <img
                    src={resolveMediaUrl("/assets/aistudio/dd__1__02ef1095.jpg")}
                    alt="Cox's Bazar City College BNCC Platoon Parade Drill"
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#061830] via-transparent to-transparent" />
                </div>
                <div className="p-6 space-y-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-[#C5A059]">
                    <span>{lang === "bn" ? "প্যারেড গ্রাউন্ড · কক্সবাজার" : "Parade Square · Cox's Bazar"}</span>
                    <span className="tabular-nums text-slate-300">Fri &amp; Sat · 07:00 AM</span>
                  </div>
                  <h2 className="text-base font-bold text-white font-display">
                    {lang === "bn"
                      ? "সাপ্তাহিক ড্রিল, শৃঙ্খলা ও গার্ড অব অনার"
                      : "Weekly Ceremonial Drill & Guard of Honour"}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {lang === "bn"
                      ? "প্রতি শুক্রবার ও শনিবার সকাল ৭:০০ টায় কলেজ প্যারেড গ্রাউন্ডে নিয়মিত সামরিক ড্রিল, পিটি ও ক্যাডেট প্রশিক্ষণ অনুষ্ঠিত হয়।"
                      : "Regular foot drill, physical training, and platoon leadership exercises take place every Friday and Saturday at 07:00 AM."}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 2. VERIFIED STATISTICS STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {verifiedStats.map((st, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-xl shadow-md border border-slate-200 text-left space-y-1.5 hover:border-[#C5A059] transition-colors"
            >
              <span className="text-[11px] uppercase font-bold text-slate-500 tracking-wider block">
                {st.label}
              </span>
              <h3 className="text-2xl font-extrabold text-[#002147] font-display tabular-nums">
                {st.value}
              </h3>
              <p className="text-xs text-slate-600 font-medium">{st.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. CORE PILLARS & INSTITUTIONAL INTRODUCTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3 text-[#002147] text-xs font-bold uppercase tracking-[0.18em]">
              <span className="h-px w-6 bg-[#C5A059]" aria-hidden="true" />
              <span>{t("pillarsHeading")}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002147] leading-tight font-display text-balance">
              {lang === "bn"
                ? "শৃঙ্খলা ও দেশপ্রেমের অনন্য বিদ্যাপীঠ"
                : "A Distinguished Corps of Discipline & Service"}
            </h2>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              {lang === "bn"
                ? "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC) দেশের সর্বোচ্চ বিদ্যাপীঠসমূহের শিক্ষার্থীদের সামরিক প্রশিক্ষণ, শারীরিক কসরত, শৃঙ্খলা ও নেতৃত্বের গুণাবলি অর্জনের জন্য প্রস্তুত করে।"
                : "The Bangladesh National Cadet Corps (BNCC) trains college students in military drill, endurance, leadership, and responsible citizenship as a disciplined second line of defence."}
            </p>

            <p className="text-slate-600 text-sm leading-relaxed">
              {lang === "bn"
                ? "কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন (আর্মি উইং) কর্ণফুলী রেজিমেন্টের অধীনস্থ ১৫ বিএনসিসি ব্যাটালিয়নের অন্যতম সুশৃঙ্খল দল। নিয়মিত ড্রিল, অস্ত্র চালনা, বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC), জাতীয় দিবসের কুচকাওয়াজ এবং মানবিক দুর্যোগে স্বেচ্ছাসেবা প্রদানের মাধ্যমে আমাদের ক্যাডেটরা দেশের সুনাগরিক হিসেবে নিজেদের প্রতিষ্ঠিত করছে।"
                : "Our mixed Army Wing Platoon operates under 15 BNCC Battalion, Karnaphuli Regiment, excelling in annual training camps (ATC), national parades, and coastal disaster response."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                {
                  title: lang === "bn" ? "সামরিক প্রশিক্ষণ ও শুটিং" : "Drill & Small Arms Training",
                  desc:
                    lang === "bn"
                      ? "ফুট ড্রিল, অস্ত্র প্রশিক্ষণ ও রেজিমেন্টাল ফায়ারিং ক্যাম্প।"
                      : "Foot drill, ceremonial parades, and regimental firing camps.",
                },
                {
                  title: lang === "bn" ? "সশস্ত্র বাহিনীতে অগ্রাধিকার" : "Armed Forces Pathway",
                  desc:
                    lang === "bn"
                      ? "সেনা, নৌ ও বিমানবাহিনীতে অফিসার নিয়োগ পরীক্ষায় বিশেষ সুবিধা।"
                      : "Merit recognition and preparation for officer selection boards.",
                },
                {
                  title: lang === "bn" ? "আন্তর্জাতিক পরিভ্রমণ (YEP)" : "Youth Exchange Program",
                  desc:
                    lang === "bn"
                      ? "ইয়ুথ এক্সচেঞ্জ প্রোগ্রামে রাষ্ট্রীয় সফরে বিভিন্ন দেশ ভ্রমণ।"
                      : "Opportunities to represent Bangladesh in bilateral cadet delegations.",
                },
                {
                  title: lang === "bn" ? "দুর্যোগ ব্যবস্থাপনা ও রক্তদান" : "Disaster Relief & Blood Drives",
                  desc:
                    lang === "bn"
                      ? "উপকূলীয় উদ্ধারকাজ ও মানবকল্যাণে আত্মনিয়োগ।"
                      : "Coastal cyclone preparedness, first aid, and humanitarian service.",
                },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start gap-3"
                >
                  <CheckCircle className="text-[#002147] shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-xs font-bold text-[#002147]">{pillar.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{pillar.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-white">
              <img
                src={resolveMediaUrl("/assets/aistudio/dddf__1__7ebcab35.jpg")}
                alt="Cox's Bazar City College BNCC Platoon Formation"
                className="w-full h-80 object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="p-6 bg-[#002147] text-white space-y-2">
                <span className="text-[11px] font-bold uppercase text-[#C5A059] tracking-widest block">
                  {lang === "bn" ? "বাৎসরিক প্রশিক্ষণ ও সামাজিক দায়িত্ব" : "Annual Training & Civic Duty"}
                </span>
                <h4 className="text-base font-bold font-display">
                  {lang === "bn"
                    ? "১৫ বিএনসিসি ব্যাটালিয়ন · ই কোম্পানি"
                    : "15 BNCC Battalion · E Company"}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t("pillarsSubheading")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DIGITAL PORTAL SERVICES GRID (Disciplined Navy / Brass Palette — Zero Rainbow Slop) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-2 mb-10 max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#C5A059] block">
            CBCC BNCC Digital Command Hub
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#002147] font-display text-balance">
            {t("servicesHeading")}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">{t("servicesSubheading")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {portalServices.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="p-6 bg-white rounded-xl border border-slate-200 hover:border-[#002147] shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-lg bg-[#002147]/8 border border-[#002147]/15 text-[#002147] flex items-center justify-center group-hover:bg-[#002147] group-hover:text-[#C5A059] transition-colors">
                  <item.icon size={20} />
                </div>
                <h3 className="text-base font-bold text-[#002147] font-display">{item.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#002147] group-hover:text-[#C5A059]">
                <span>{item.cta}</span>
                <ChevronRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 5. PLATOON COMMANDER SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#002147] text-white rounded-2xl p-8 md:p-12 border border-[#C5A059]/30 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-4 flex justify-center">
              <div className="w-48 h-60 rounded-xl overflow-hidden border-2 border-[#C5A059] shadow-2xl bg-[#00152e]">
                <img
                  src={resolveMediaUrl(commander.photoUrl || "/assets/aistudio/POU_7647ec14.png")}
                  alt={commander.name || "Platoon Commander"}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/POU_7647ec14.png");
                  }}
                />
              </div>
            </div>

            <div className="md:col-span-8 space-y-4 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2.5 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
                <span className="h-px w-6 bg-[#C5A059]" aria-hidden="true" />
                <span>{t("commanderKicker")}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white font-display">
                {commander.name} ({commander.banglaName})
              </h3>

              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {commander.rank} · {commander.designation}
              </p>

              <blockquote className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                &ldquo;{commander.message || t("commanderBody")}&rdquo;
              </blockquote>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1 text-xs">
                <a
                  href={`tel:${commander.phone}`}
                  className="px-4 py-2.5 bg-white/10 hover:bg-[#C5A059] hover:text-[#00152e] rounded-lg font-bold transition-colors flex items-center gap-2 tabular-nums"
                >
                  <Phone size={14} />
                  <span>{commander.phone}</span>
                </a>

                <Link
                  to="/hall-of-incharges"
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                  <Award size={14} className="text-[#C5A059]" />
                  <span>{t("commanderBtn")}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. INTERACTIVE FAQ ASSISTANT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 text-[#002147] text-xs font-bold uppercase tracking-[0.18em]">
              <Sparkles size={14} className="text-[#C5A059]" />
              <span>BNCC Information Assistant</span>
            </div>
            <h3 className="text-2xl font-extrabold text-[#002147] font-display">{t("faqTitle")}</h3>
            <p className="text-xs sm:text-sm text-slate-600">{t("faqSubheading")}</p>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            <div className="relative">
              <input
                type="text"
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFaqSubmit()}
                aria-label="Ask a question about BNCC enrollment"
                placeholder={
                  lang === "bn"
                    ? "যেমন: আবেদনের জন্য নূন্যতম উচ্চতা কত? বা কী কী সুবিধা পাওয়া যায়?"
                    : "e.g., What are the height & academic requirements for BNCC enrollment?"
                }
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-xl px-5 py-4 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-[#002147] pr-14"
              />
              <button
                type="button"
                onClick={handleFaqSubmit}
                disabled={!faqQuestion.trim() || isFaqLoading}
                aria-label="Submit FAQ question"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-[#002147] text-white rounded-lg hover:bg-[#0B2545] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isFaqLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {faqAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[#002147] font-bold">
                    <Shield size={14} className="text-[#C5A059]" />
                    <span>{lang === "bn" ? "তথ্য সহায়িকা উত্তর:" : "Platoon Assistant Response:"}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{faqAnswer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* 7. INSTITUTIONAL PARTNERS BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-12 opacity-85 hover:opacity-100 transition-opacity">
          <a
            href={cms.settings.collegeWebsite || "https://cbcc.edu.bd/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3"
          >
            <img
              src={resolveMediaUrl(cms.settings.collegeLogoUrl || "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png")}
              alt="Cox's Bazar City College"
              className="h-14 w-auto"
              referrerPolicy="no-referrer"
            />
            <div className="text-left">
              <span className="text-xs font-bold text-[#002147] block font-display">
                Cox's Bazar City College
              </span>
              <span className="text-[11px] text-slate-600">কক্সবাজার সিটি কলেজ (স্থাপিত ১৯৯৩)</span>
            </div>
          </a>

          <div className="hidden sm:block w-px h-8 bg-slate-300" />

          <a
            href={cms.settings.bnccCentralWebsite || "https://bncc.info/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3"
          >
            <img
              src={resolveMediaUrl(cms.settings.bnccLogoUrl || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png")}
              alt="BNCC"
              className="h-14 w-auto"
              referrerPolicy="no-referrer"
            />
            <div className="text-left">
              <span className="text-xs font-bold text-[#002147] block font-display">
                Bangladesh National Cadet Corps
              </span>
              <span className="text-[11px] text-slate-600">বাংলাদেশ ন্যাশনাল ক্যাডেট কোর</span>
            </div>
          </a>
        </div>
      </section>

      {/* Modals */}
      <CircularViewerModal isOpen={isCircularOpen} onClose={() => setIsCircularOpen(false)} />

      <AdmissionGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
