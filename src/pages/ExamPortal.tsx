import { Link } from "react-router-dom";
import { 
  BookOpen, UserCheck, ShieldCheck, Award, 
  Clock, FileText, ArrowRight, CheckCircle2 
} from "lucide-react";
import { ExamNavbar } from "../components/exam/ExamNavbar";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function ExamPortal() {
  useDocumentMeta({
    title: "Online Examination Portal | Cox's Bazar City College BNCC Platoon",
    description: "Timed online written & MCQ recruitment examination hub for Cox's Bazar City College BNCC applicants.",
  });
  return (
    <div className="min-h-screen bg-[#020B18] text-white font-sans flex flex-col selection:bg-[#002147] selection:text-white">
      <ExamNavbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <Award size={14} /> Official BNCC Cadet Recruitment Portal
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display leading-tight text-balance">
            কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের <span className="text-[#C5A059]">অনলাইন ভর্তি পরীক্ষা</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base font-medium leading-relaxed">
            স্বাগতম! আপনি যদি পূর্বে বিএনসিসি ক্যাডেট পদের জন্য আবেদন সম্পন্ন করে থাকেন, তবে আপনার প্রাপ্ত ইউজার আইডি ও পাসওয়ার্ড ব্যবহার করে অনলাইন লিখিত পরীক্ষায় অংশগ্রহণ করুন।
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/exam/login"
              className="w-full sm:w-auto px-8 py-4 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-sm uppercase tracking-wider rounded-xl transition-all shadow-xl flex items-center justify-center gap-2 group cursor-pointer"
            >
              <UserCheck size={18} />
              Unified Examination Portal Login
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div className="bg-[#061830] border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#002147] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <Clock size={22} />
            </div>
            <h3 className="text-base font-extrabold text-white uppercase tracking-tight font-display">Time-Bound &amp; Auto-Submit</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              নির্ধারিত সময়ের মধ্যে উত্তর সম্পন্ন করুন। সময় অতিক্রম হলে সিস্টেম স্বয়ংক্রিয়ভাবে পরীক্ষা সাবমিট করে নেবে।
            </p>
          </div>

          <div className="bg-[#061830] border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#002147] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <Award size={22} />
            </div>
            <h3 className="text-base font-extrabold text-white uppercase tracking-tight font-display">Instant Trusted Evaluation</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              পরীক্ষা সম্পন্ন করার সাথে সাথে স্বয়ংক্রিয় মেধা মূল্যায়ন ও স্কোরশিট প্রস্তুত করা হয়।
            </p>
          </div>

          <div className="bg-[#061830] border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#002147] text-[#C5A059] border border-[#C5A059]/30 flex items-center justify-center">
              <FileText size={22} />
            </div>
            <h3 className="text-base font-extrabold text-white uppercase tracking-tight font-display">Multi-Type Questions</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              MCQ, শূন্যস্থান পূরণ, ট্যাগ কোয়েশ্চেন, বাক্য পরিবর্তন, সংক্ষিপ্ত ও সত্য/মিথ্যা প্রশ্ন অন্তর্ভুক্ত।
            </p>
          </div>
        </div>

        {/* Instructions Card */}
        <div className="bg-[#061830] border border-white/10 p-8 rounded-2xl space-y-4 max-w-4xl mx-auto">
          <h3 className="text-lg font-extrabold text-white uppercase tracking-tight flex items-center gap-2 font-display">
            <CheckCircle2 className="text-[#C5A059]" size={20} />
            <span>পরীক্ষার্থীদের জন্য বিশেষ নির্দেশনা</span>
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-[#C5A059] font-bold">·</span>
              <span>পরীক্ষায় অংশ নেওয়ার পূর্বে স্থিতিশীল ইন্টারনেট সংযোগ নিশ্চিত করুন।</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C5A059] font-bold">·</span>
              <span>পরীক্ষা চলাকালীন কোনো অবস্থাতেই ব্রাউজার ট্যাব বা উইন্ডো পরিবর্তন অথবা রিফ্রেশ করবেন না।</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#C5A059] font-bold">·</span>
              <span>পরীক্ষা শেষে অবিলম্বে আপনার ফলাফল দেখতে পাবেন ও মেধা তালিকায় আপনার অবস্থান যাচাই করতে পারবেন।</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
