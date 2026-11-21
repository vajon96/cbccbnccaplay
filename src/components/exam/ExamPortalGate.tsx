/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldOff, ArrowLeft, Award, Lock } from "lucide-react";
import { useCMS } from "../../context/CMSContext";
import { useAuth } from "../../context/AuthContext";
import { isAuthorizedAdmin } from "../../lib/auth";
import { ExamNavbar } from "./ExamNavbar";

interface ExamPortalGateProps {
  children: ReactNode;
}

/**
 * Enforces Public Exam Portal visibility configured from Main Admin -> Exam Portal Status.
 * When `cms.settings.examPortalOpen === false`, public visitors & candidates see an official
 * maintenance notice without losing or exposing any examination records.
 * Authenticated Main Admins retain preview/management access inside Main Admin Dashboard.
 */
export function ExamPortalGate({ children }: ExamPortalGateProps) {
  const cms = useCMS();
  const { user } = useAuth();

  const isPortalOpen = cms.settings.examPortalOpen !== false;
  const isAdmin = isAuthorizedAdmin(user?.role);

  if (isPortalOpen) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#020B18] text-white font-sans flex flex-col">
      <ExamNavbar title="Examination Portal Status" />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-[#061830] border border-[#C5A059]/30 rounded-2xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-[#C5A059] flex items-center justify-center mx-auto">
            <ShieldOff size={32} />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C5A059]">
              Public Exam Portal Disabled
            </p>
            <h1 className="text-2xl font-extrabold text-white font-display">
              অনলাইন পরীক্ষা পোর্টাল বর্তমানে সাময়িকভাবে বন্ধ রয়েছে
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
              প্লাটুন প্রশাসনের নির্দেশনা অনুযায়ী পাবলিক অনলাইন পরীক্ষা পোর্টালটি বর্তমানে রক্ষণাবেক্ষণ বা নিয়ন্ত্রণাধীন অবস্থায় রয়েছে। পরীক্ষার নতুন সময়সূচি প্রকাশিত হলে নোটিশ বোর্ডে জানিয়ে দেওয়া হবে।
            </p>
          </div>

          <div className="bg-[#020B18] border border-white/10 rounded-xl p-4 text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-center gap-2 text-slate-300 font-bold">
              <Lock size={14} className="text-[#C5A059]" />
              <span>পরীক্ষার সকল প্রশ্ন ও ফলাফল সুরক্ষিত রয়েছে</span>
            </div>
            <p>Cox&apos;s Bazar City College BNCC Platoon · 15 BNCC Battalion</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft size={15} />
              <span>হোমপেজে ফিরে যান</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin/dashboard?module=suite-exam"
                className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/15 transition-colors flex items-center justify-center gap-2"
              >
                <Award size={15} className="text-[#C5A059]" />
                <span>Manage in Main Admin</span>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
