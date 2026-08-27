import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  BarChart3, FileQuestion, Award, Trophy, 
  Settings, LogOut, Shield, CheckCircle2, FileText
} from "lucide-react";
import { getSession, clearSession } from "../lib/auth";
import { ExamNavbar } from "../components/exam/ExamNavbar";
import { ExamOverview } from "../components/exam/ExamOverview";
import { QuestionBank } from "../components/exam/QuestionBank";
import { ExamManager } from "../components/exam/ExamManager";
import { ResultsTable } from "../components/exam/ResultsTable";
import { RankingTable } from "../components/exam/RankingTable";
import { ExamSettingsComponent } from "../components/exam/ExamSettingsComponent";
import { AnswerScriptsList } from "../components/exam/AnswerScriptsList";
import { AnswerScriptViewer } from "../components/exam/AnswerScriptViewer";

export function ExamAdminDashboard() {
  const session = getSession();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    "overview" | "question_bank" | "exams" | "answer_scripts" | "results" | "ranking" | "settings"
  >("overview");

  const [selectedExamForResults, setSelectedExamForResults] = useState<string>("ALL");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  useEffect(() => {
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      navigate("/exam/admin/login");
    }
  }, [session?.id, session?.role]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar title="Exam Admin Control Panel" />

      {/* Admin Tab Navigation Header */}
      <div className="bg-slate-900 border-b border-white/10 px-4 sm:px-8 py-3 sticky top-16 z-30 shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
          
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => { setActiveTab("overview"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "overview"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart3 size={16} />
              Overview
            </button>

            <button
              onClick={() => { setActiveTab("question_bank"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "question_bank"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileQuestion size={16} />
              Question Bank
            </button>

            <button
              onClick={() => { setActiveTab("exams"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "exams"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Award size={16} />
              Exams Setup
            </button>

            <button
              onClick={() => setActiveTab("answer_scripts")}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "answer_scripts"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileText size={16} />
              Answer Scripts
            </button>

            <button
              onClick={() => { setActiveTab("results"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "results"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <CheckCircle2 size={16} />
              Results Sheet
            </button>

            <button
              onClick={() => { setActiveTab("ranking"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "ranking"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Trophy size={16} />
              Leaderboard
            </button>

            <button
              onClick={() => { setActiveTab("settings"); setSelectedAttemptId(null); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === "settings"
                  ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings size={16} />
              Settings
            </button>
          </div>

        </div>
      </div>

      {/* Active Tab Main View */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && <ExamOverview />}
        {activeTab === "question_bank" && <QuestionBank actorId={session.id} />}
        {activeTab === "exams" && (
          <ExamManager
            actorId={session.id}
            onViewResults={(eId) => {
              setSelectedExamForResults(eId);
              setActiveTab("results");
            }}
          />
        )}
        {activeTab === "answer_scripts" && (
          selectedAttemptId ? (
            <AnswerScriptViewer
              attemptId={selectedAttemptId}
              onBack={() => setSelectedAttemptId(null)}
              actorId={session.id}
              actorName={session.name || "Examiner"}
              isSuperAdmin={session.role === "super_admin"}
            />
          ) : (
            <AnswerScriptsList
              onSelectAttempt={(attId) => setSelectedAttemptId(attId)}
              onViewResult={(attId) => {
                setSelectedAttemptId(attId);
              }}
            />
          )
        )}
        {activeTab === "results" && <ResultsTable initialExamId={selectedExamForResults} />}
        {activeTab === "ranking" && <RankingTable />}
        {activeTab === "settings" && <ExamSettingsComponent actorId={session.id} />}
      </main>

    </div>
  );
}
