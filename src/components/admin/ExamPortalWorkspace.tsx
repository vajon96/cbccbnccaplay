import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  FileQuestion,
  Award,
  FileText,
  CheckCircle2,
  Trophy,
  Settings,
  ExternalLink,
  Power,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useCMS } from "../../context/CMSContext";
import { auth, db, doc, setDoc, Timestamp } from "../../firebase";
import { ExamOverview } from "../exam/ExamOverview";
import { QuestionBank } from "../exam/QuestionBank";
import { ExamManager } from "../exam/ExamManager";
import { ResultsTable } from "../exam/ResultsTable";
import { RankingTable } from "../exam/RankingTable";
import { ExamSettingsComponent } from "../exam/ExamSettingsComponent";
import { AnswerScriptsList } from "../exam/AnswerScriptsList";
import { AnswerScriptViewer } from "../exam/AnswerScriptViewer";

interface ExamPortalWorkspaceProps {
  actorId: string;
  actorName: string;
  isSuperAdmin: boolean;
  onNotify?: (msg: string, type?: "success" | "error") => void;
}

export function ExamPortalWorkspace({
  actorId,
  actorName,
  isSuperAdmin,
  onNotify,
}: ExamPortalWorkspaceProps) {
  const { settings, saveSettings } = useCMS();
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "overview" | "question_bank" | "exams" | "answer_scripts" | "results" | "ranking" | "settings"
  >("overview");
  const [selectedExamForResults, setSelectedExamForResults] = useState<string>("ALL");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const isPublicOpen = settings.examPortalOpen !== false;

  const setPublicVisibility = async (enabled: boolean) => {
    setUpdatingVisibility(true);
    try {
      await saveSettings({
        ...settings,
        examPortalOpen: enabled,
        lastUpdated: new Date().toISOString(),
        updatedBy: actorName || "Main Admin",
      });
      if (auth.currentUser) {
        await setDoc(
          doc(db, "exam_settings", "portal_visibility"),
          {
            examPortalOpen: enabled,
            updatedBy: actorId,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        ).catch(() => {});
      }
      onNotify?.(
        enabled
          ? "পাবলিক Exam Portal এখন সকল পরীক্ষার্থী ও ভিজিটরের জন্য সক্রিয় করা হয়েছে।"
          : "পাবলিক Exam Portal বন্ধ করা হয়েছে। কেবল মেইন অ্যাডমিন অ্যাক্সেস চালু রয়েছে।",
        "success"
      );
    } catch (err: any) {
      onNotify?.(err?.message || "Exam Portal স্ট্যাটাস পরিবর্তন করা যায়নি।", "error");
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const tabs: Array<{ id: typeof activeTab; label: string; icon: any }> = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "question_bank", label: "Question Bank", icon: FileQuestion },
    { id: "exams", label: "Exams Lifecycle", icon: Award },
    { id: "answer_scripts", label: "Answer Scripts", icon: FileText },
    { id: "results", label: "Results Sheet", icon: CheckCircle2 },
    { id: "ranking", label: "Leaderboard", icon: Trophy },
    { id: "settings", label: "Exam Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Top EXAM PORTAL STATUS Control Bar */}
      <div className="bg-[#061830] border border-[#C5A059]/35 rounded-2xl p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <ShieldCheck size={18} className="text-[#C5A059]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              EXAM PORTAL STATUS
            </h2>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-lg border ${
                isPublicOpen
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                  : "bg-rose-500/15 border-rose-500/35 text-rose-300"
              }`}
            >
              {isPublicOpen ? "PUBLICLY ENABLED" : "DISABLED FOR VISITORS"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Single Main Admin session active (no second login required). Disabling hides /exam links from visitors while keeping Admin control 100% open.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={updatingVisibility || isPublicOpen}
            onClick={() => void setPublicVisibility(true)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {updatingVisibility ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            ENABLE PUBLIC EXAM PORTAL
          </button>

          <button
            type="button"
            disabled={updatingVisibility || !isPublicOpen}
            onClick={() => void setPublicVisibility(false)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {updatingVisibility ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
            DISABLE PUBLIC EXAM PORTAL
          </button>

          <Link
            to="/exam"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center gap-1.5 whitespace-nowrap"
          >
            <ExternalLink size={13} /> Candidate View
          </Link>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedAttemptId(null);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#C5A059] text-[#002147] font-black"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Embedded Exam Portal Components */}
      <div className="min-h-[420px]">
        {activeTab === "overview" && <ExamOverview />}
        {activeTab === "question_bank" && <QuestionBank actorId={actorId} />}
        {activeTab === "exams" && (
          <ExamManager
            actorId={actorId}
            onViewResults={(examId) => {
              setSelectedExamForResults(examId);
              setActiveTab("results");
            }}
          />
        )}
        {activeTab === "answer_scripts" &&
          (selectedAttemptId ? (
            <AnswerScriptViewer
              attemptId={selectedAttemptId}
              onBack={() => setSelectedAttemptId(null)}
              actorId={actorId}
              actorName={actorName || "Examiner"}
              isSuperAdmin={isSuperAdmin}
            />
          ) : (
            <AnswerScriptsList
              onSelectAttempt={(attId) => setSelectedAttemptId(attId)}
              onViewResult={(attId) => setSelectedAttemptId(attId)}
            />
          ))}
        {activeTab === "results" && <ResultsTable initialExamId={selectedExamForResults} />}
        {activeTab === "ranking" && <RankingTable />}
        {activeTab === "settings" && <ExamSettingsComponent actorId={actorId} />}
      </div>
    </div>
  );
}
