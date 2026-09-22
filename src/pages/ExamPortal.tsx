import { Link } from "react-router-dom";
import { 
  BookOpen, UserCheck, ShieldCheck, Award, 
  Clock, FileText, ArrowRight, CheckCircle2 
} from "lucide-react";
import { ExamNavbar } from "../components/exam/ExamNavbar";

export function ExamPortal() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl mx-auto pt-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest">
            <Award size={14} /> Official BNCC Cadet Recruitment Portal
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#00e7ff] font-display leading-tight">
            কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের <span className="text-primary">অনলাইন ভর্তি পরীক্ষা</span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed">
            স্বাগতম! আপনি যদি পূর্বে বিএনসিসি ক্যাডেট পদের জন্য আবেদন সম্পন্ন করে থাকেন, তবে আপনার প্রাপ্ত ইউজার আইডি ও পাসওয়ার্ড ব্যবহার করে অনলাইন লিখিত পরীক্ষায় অংশগ্রহণ করুন।
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/exam/login"
              className="w-full sm:w-auto px-8 py-4 bg-primary hover:bg-primary/90 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-primary/25 flex items-center justify-center gap-2 group cursor-pointer"
            >
              <UserCheck size={18} />
              Unified Examination Portal Login
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Clock size={24} />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">Time-Bound & Auto-Submit</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              নির্ধারিত সময়ের মধ্যে উত্তর সম্পন্ন করুন। সময় অতিক্রম হলে সিস্টেম স্বয়ংক্রিয়ভাবে পরীক্ষা সাবমিট করে নেবে।
            </p>
          </div>

          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Award size={24} />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">Instant Trusted Evaluation</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              পরীক্ষা সম্পন্ন করার সাথে সাথে স্বয়ংক্রিয় মেধা মূল্যায়ন ও স্কোরশিট প্রস্তুত করা হয়।
            </p>
          </div>

          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <FileText size={24} />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight">Multi-Type Questions</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              MCQ, শূন্যস্থান পূরণ, ট্যাগ কোয়েশ্চেন, বাক্য পরিবর্তন, সংক্ষিপ্ত ও সত্য/মিথ্যা প্রশ্ন অন্তর্ভুক্ত।
            </p>
          </div>

        </div>

        {/* Instructions Card */}
        <div className="bg-slate-900/60 border border-white/10 p-8 rounded-3xl space-y-4 max-w-4xl mx-auto">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <CheckCircle2 className="text-emerald-400" size={20} />
            পরীক্ষার্থীদের জন্য বিশেষ নির্দেশনা
          </h3>
          <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              পরীক্ষায় অংশ নেওয়ার পূর্বে স্থিতিশীল ইন্টারনেট সংযোগ নিশ্চিত করুন।
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              পরীক্ষা চলাকালীন কোনো অবস্থাতেই ব্রাউজার ট্যাব বা উইন্ডো পরিবর্তন অথবা রিফ্রেশ করবেন না।
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-400 font-bold">•</span>
              পরীক্ষা শেষে অবিলম্বে আপনার ফলাফল দেখতে পাবেন ও মেধা তালিকায় আপনার অবস্থান যাচাই করতে পারবেন।
            </li>
          </ul>
        </div>

      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500 font-semibold">
        © 2026 Cox's Bazar City College BNCC Platoon. All rights reserved.
      </footer>
    </div>
  );
}
