import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  Award, CheckCircle2, XCircle, Clock, 
  Home, RefreshCw, Trophy, ArrowLeft, FileText 
} from "lucide-react";
import { getResultByAttemptId, getExamById } from "../services/examService";
import { getSession } from "../lib/auth";
import { ExamResult, ExamModel } from "../types";
import { ExamNavbar } from "../components/exam/ExamNavbar";
import { MarksheetViewer } from "../components/exam/MarksheetViewer";

export function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [result, setResult] = useState<ExamResult | null>(null);
  const [exam, setExam] = useState<ExamModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswerScript, setShowAnswerScript] = useState(false);

  useEffect(() => {
    if (!attemptId) return;

    const loadResult = async () => {
      setLoading(true);
      try {
        const res = await getResultByAttemptId(attemptId);
        if (res) {
          setResult(res);
          const e = await getExamById(res.examId);
          setExam(e);
        }
      } catch (err) {
        console.error("Error loading exam result:", err);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [attemptId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
          <Award size={40} className="mx-auto text-slate-500" />
          <h2 className="text-xl font-bold">ফলাফল পাওয়া যায়নি।</h2>
          <Link to="/exam/dashboard" className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs uppercase block">
            Return to Candidate Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar title="Exam Result & Scorecard" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Result Card Header */}
        <div className={`p-8 rounded-3xl border text-center space-y-6 shadow-2xl relative overflow-hidden ${
          result.isPassed
            ? "bg-gradient-to-b from-emerald-950/60 to-slate-900 border-emerald-500/30"
            : "bg-gradient-to-b from-rose-950/60 to-slate-900 border-rose-500/30"
        }`}>
          
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 shadow-xl shrink-0"
               style={{
                 backgroundColor: result.isPassed ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                 borderColor: result.isPassed ? "#10b981" : "#f43f5e"
               }}>
            {result.isPassed ? (
              <CheckCircle2 size={44} className="text-emerald-400" />
            ) : (
              <XCircle size={44} className="text-rose-400" />
            )}
          </div>

          <div className="space-y-1">
            <span className={`text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full border ${
              result.isPassed
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-rose-500/20 text-rose-400 border-rose-500/30"
            }`}>
              {result.isPassed ? "CONGRATULATIONS - PASSED (উত্তীর্ণ)" : "FAILED (অনুত্তীর্ণ)"}
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-white pt-2 font-display">{result.examTitle}</h1>
            <p className="text-xs text-slate-400 font-semibold">
              Candidate: <span className="text-white font-bold">{result.candidateName}</span> (Reg: <span className="font-mono text-amber-400">{result.registrationNumber}</span>)
            </p>
          </div>

          {/* Big Score Display */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-white/10 max-w-sm mx-auto space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Your Obtained Score</span>
            <div className="text-4xl sm:text-5xl font-black text-white">
              {result.score} <span className="text-lg text-slate-500 font-normal">/ {result.totalMarks}</span>
            </div>
            <span className="text-xs font-bold text-emerald-400 block pt-1">
              Percentage: {result.percentage}% (Pass Mark: {result.passMarks})
            </span>
          </div>

          {/* Breakdowns Grid */}
          <div className="grid grid-cols-3 gap-3 text-center pt-2">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Correct</span>
              <strong className="text-lg font-black text-emerald-400">{result.correctCount}</strong>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Wrong</span>
              <strong className="text-lg font-black text-rose-400">{result.wrongCount}</strong>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Unanswered</span>
              <strong className="text-lg font-black text-slate-400">{result.unansweredCount}</strong>
            </div>
          </div>

        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setShowAnswerScript(true)}
            className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText size={16} /> View My Answer Script
          </button>

          <Link
            to="/exam/dashboard"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all border border-slate-700 shadow-xl flex items-center justify-center gap-2"
          >
            <Home size={16} /> Candidate Dashboard
          </Link>
        </div>

      </main>

      {/* Read-Only Answer Script / Marksheet Viewer Modal */}
      {showAnswerScript && attemptId && (
        <MarksheetViewer
          attemptId={attemptId}
          onClose={() => setShowAnswerScript(false)}
          isCandidateView={session?.role !== "admin" && session?.role !== "super_admin"}
          currentCandidateId={session?.id}
          currentCandidateReg={session?.registrationNumber || session?.id}
        />
      )}
    </div>
  );
}
