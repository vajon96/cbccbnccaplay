import { motion } from "framer-motion";
import {
  BookOpen, CheckCircle, Award, UserPlus,
  Download, Activity, Target, AlertCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function HowToBecomeCadetPage() {
  useDocumentMeta({
    title: "How to Become a BNCC Cadet | Cox's Bazar City College BNCC Platoon",
    description: "Eligibility criteria, physical standards, required documents, and 5-step selection process to join Cox's Bazar City College BNCC Platoon.",
  });

  const steps = [
    {
      step: "01",
      title: "আবেদন ফর্ম পূরণ (Application Submission)",
      desc: "কক্সবাজার সিটি কলেজের একাদশ বা ডিগ্রি/অনার্স ১ম বর্ষের শিক্ষার্থীরা ওয়েবসাইটে অনলাইনে অথবা প্রিন্ট করা অফলাইন ফর্ম পূরণ করে জমা দিতে পারবেন।",
    },
    {
      step: "02",
      title: "শারীরিক ও প্রাথমিক স্বাস্থ্য পরীক্ষা",
      desc: "নির্ধারিত তারিখে উচ্চতা, ওজন, বুকের মাপ এবং সাধারণ দৃষ্টিশক্তি ও স্বাস্থ্যগত সুস্থতা যাচাই করা হয়।",
    },
    {
      step: "03",
      title: "লিখিত পরীক্ষা (Admission Test)",
      desc: "সাধারণ জ্ঞান, বাংলাদেশ ও মুক্তিযুদ্ধ, সমসাময়িক বিষয়াবলি এবং সাধারণ বুদ্ধিমত্তার ওপর লিখিত ও MCQ পরীক্ষা অনুষ্ঠিত হয়।",
    },
    {
      step: "04",
      title: "মৌখিক পরীক্ষা (Viva Voce)",
      desc: "প্লাটুন কমান্ডার ও সিলেকশন বোর্ডের উপস্থিতিতে ব্যক্তিত্ব, নেতৃত্বগুণ, দেশপ্রেম এবং মানসিক দৃঢ়তা মূল্যায়ন করা হয়।",
    },
    {
      step: "05",
      title: "চূড়ান্ত নির্বাচন ও শপথ গ্রহণ",
      desc: "মেধাতালিকা ও স্বাস্থ্য পরীক্ষার ভিত্তিতে নির্বাচিত ক্যাডেটদের আনুষ্ঠানিকভাবে শপথ পাঠ করিয়ে প্লাটুনে অন্তর্ভুক্ত করা হয়।",
    },
  ];

  const requirements = [
    {
      label: "শিক্ষাগত যোগ্যতা",
      val: "কক্সবাজার সিটি কলেজের একাদশ শ্রেণি অথবা স্নাতক (ডিগ্রি/অনার্স) ১ম বর্ষে অধ্যয়নরত নিয়মিত শিক্ষার্থী।",
    },
    { label: "উচ্চতা (পুরুষ)", val: "ন্যূনতম ৫ ফুট ৪ ইঞ্চি (১৬২.৫ সেমি)" },
    { label: "উচ্চতা (নারী)", val: "ন্যূনতম ৫ ফুট ০ ইঞ্চি (১৫২.৪ সেমি)" },
    { label: "বুকের মাপ (পুরুষ)", val: "স্বাভাবিক অবস্থায় ৩০ ইঞ্চি, সম্প্রসারিত অবস্থায় ৩২ ইঞ্চি" },
    { label: "স্বাস্থ্য ও দৃষ্টি", val: "শারীরিক ও মানসিকভাবে সম্পূর্ণ সুস্থ, চোখের দৃষ্টি ৬/৬ (অথবা অনুমোদিত চশমাযোগ্য)" },
    { label: "জাতীয়তা", val: "জন্মসূত্রে বাংলাদেশি নাগরিক এবং অবিবাহিত" },
  ];

  const benefits = [
    "বাংলাদেশ সেনা, নৌ ও বিমানবাহিনীতে অফিসার নিয়োগ পরীক্ষায় বিশেষ অগ্রাধিকার ও কোটা সুবিধা।",
    "সামরিক প্যারেড, ড্রিল, অস্ত্র চালনা (রাইফেল শুটিং) ও ফিল্ড ক্রাফট প্রশিক্ষণের সুবর্ণ সুযোগ।",
    "বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC) এবং সম্মিলিত সেন্ট্রাল ক্যাম্পে অংশগ্রহণের অভিজ্ঞতা।",
    "ইয়ুথ এক্সচেঞ্জ প্রোগ্রামের (YEP) মাধ্যমে ভারত, শ্রীলঙ্কা, মালদ্বীপসহ বিভিন্ন দেশে রাষ্ট্রীয় সফরের সুযোগ।",
    "শৃঙ্খলা, সময়ানুবর্তিতা, নেতৃত্ব ও মানসিক আত্মবিশ্বাস বৃদ্ধির অবারিত সুযোগ।",
    "দুর্যোগ ব্যবস্থাপনা, সামাজিক নিরাপত্তা এবং রক্তদান কার্যক্রমে সক্রিয় অংশগ্রহণের গৌরব।",
  ];

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto relative z-10 space-y-14">
        {/* Header Banner */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <BookOpen size={14} />
            <span>ভর্তি নির্দেশিকা ও তথ্য · Recruitment Guide</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display uppercase text-balance">
            কীভাবে হবেন <span className="text-[#C5A059]">বিএনসিসি ক্যাডেট?</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন (আর্মি উইং) · ২০২৫–২০২৬ শিক্ষাবর্ষে ক্যাডেট ভর্তি সংক্রান্ত যাবতীয় নিয়মাবলি, শারীরিক যোগ্যতা ও নির্বাচন প্রক্রিয়া।
          </p>
        </div>

        {/* Requirements Box */}
        <div className="bg-[#061830] rounded-2xl border border-white/10 p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <Activity className="text-[#C5A059]" size={22} />
            <div>
              <h2 className="text-xl font-bold text-white font-display">আবেদনের যোগ্যতা ও শারীরিক মানদণ্ড</h2>
              <p className="text-xs text-slate-400">বিএনসিসি প্লাটুনে যোগদানের জন্য প্রয়োজনীয় শারীরিক ও শিক্ষাগত যোগ্যতা</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map((req, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#020B18] border border-white/10 space-y-1">
                <span className="text-xs font-bold uppercase text-[#C5A059] tracking-wider flex items-center gap-2">
                  <CheckCircle size={14} />
                  {req.label}
                </span>
                <p className="text-sm text-slate-200 font-medium pl-6">
                  {req.val}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* 5-Step Selection Process */}
        <div className="space-y-6">
          <div className="text-center md:text-left space-y-1">
            <h2 className="text-2xl font-extrabold text-white uppercase tracking-tight flex items-center justify-center md:justify-start gap-2 font-display">
              <Target className="text-[#C5A059]" size={22} />
              <span>নির্বাচন প্রক্রিয়া (পর্যায়ক্রমিক ধাপ)</span>
            </h2>
            <p className="text-xs text-slate-400">
              চূড়ান্তভাবে ক্যাডেট হিসেবে নির্বাচিত হতে ৫টি নির্ধারিত ধাপ সফলভাবে সম্পন্ন করতে হয়।
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((st, i) => (
              <motion.div
                key={st.step}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="p-6 rounded-2xl bg-[#061830] border border-white/10 hover:border-[#C5A059]/45 transition-colors flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-lg group"
              >
                <div className="w-14 h-14 rounded-xl bg-[#002147] border border-[#C5A059]/50 text-[#C5A059] font-extrabold text-xl flex items-center justify-center shrink-0 font-mono tabular-nums">
                  {st.step}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white group-hover:text-[#C5A059] transition-colors">
                    {st.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {st.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Benefits & Perks */}
        <div className="bg-[#002147] rounded-2xl border border-[#C5A059]/30 p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/15">
            <Award className="text-[#C5A059]" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white font-display">বিএনসিসি ক্যাডেট হওয়ার সুযোগ-সুবিধা</h2>
              <p className="text-xs text-slate-300">একজন সফল ক্যাডেট হিসেবে আপনি যা অর্জন করবেন</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {benefits.map((b, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-[#020B18]/60 border border-white/10">
                <CheckCircle size={16} className="text-[#C5A059] shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {b}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Required Documents */}
        <div className="bg-[#061830] rounded-2xl border border-white/10 p-6 space-y-4">
          <div className="flex items-center gap-2 text-[#C5A059] font-bold text-sm">
            <AlertCircle size={18} />
            <span>আবেদনের সময় প্রয়োজনীয় কাগজপত্র</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
            <li className="flex items-center gap-2">· পাসপোর্ট সাইজের রঙিন ছবি (২ কপি)</li>
            <li className="flex items-center gap-2">· এস.এস.সি পাশের নম্বরপত্র ও সনদের ফটোকপি</li>
            <li className="flex items-center gap-2">· সিটি কলেজ ভর্তির রশিদ / আইডি কার্ডের কপি</li>
            <li className="flex items-center gap-2">· জাতীয় পরিচয়পত্র অথবা জন্ম সনদের ফটোকপি</li>
          </ul>
        </div>

        {/* Action CTA */}
        <div className="p-8 sm:p-10 rounded-2xl bg-[#061830] border border-[#C5A059]/30 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-white font-display">
              প্রস্তুত তো দেশের সেবায় নিজেকে যুক্ত করতে?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
              দেরি না করে এখনই অনলাইনে আবেদন করুন অথবা আমাদের অফলাইন আবেদন ফর্মটি ডাউনলোড ও প্রিন্ট করে জমা দিন।
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/enroll"
              className="px-7 py-3.5 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-lg flex items-center gap-2"
            >
              <UserPlus size={16} />
              <span>অনলাইনে আবেদন করুন</span>
            </Link>

            <Link
              to="/offline-application"
              className="px-7 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors border border-white/15 flex items-center gap-2"
            >
              <Download size={16} />
              <span>অফলাইন ফর্ম ডাউনলোড করুন</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
