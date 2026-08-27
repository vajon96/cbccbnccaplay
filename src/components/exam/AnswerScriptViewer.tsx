import { useState, useEffect } from "react";
import { 
  ArrowLeft, FileText, CheckCircle2, XCircle, AlertTriangle, HelpCircle, 
  Clock, Save, Lock, Unlock, RefreshCw, Printer, ShieldCheck, History, 
  Bookmark, Award, ChevronLeft, ChevronRight, MessageSquare, Edit3, RotateCcw, Check, Sparkles,
  Bot, BrainCircuit, ThumbsUp, AlertCircle, Trash2
} from "lucide-react";
import { 
  getAttemptById, getExamById, saveQuestionEvaluation, saveBulkEvaluations, 
  recalculateAttemptResult, finalizeAttemptEvaluation, reopenAttemptEvaluation, 
  recheckExamQuestionKey, fetchAttemptAuditLogs, deleteAttemptById 
} from "../../services/examService";
import { 
  ExamAttempt, ExamModel, QuestionBankItem, ManualQuestionEvaluation, 
  AnswerScriptAuditLog, EvaluationStatus 
} from "../../types";

interface AnswerScriptViewerProps {
  attemptId: string;
  onBack: () => void;
  actorId?: string;
  actorName?: string;
  isSuperAdmin?: boolean;
}

export function AnswerScriptViewer({
  attemptId,
  onBack,
  actorId = "admin",
  actorName = "Examination Officer",
  isSuperAdmin = true
}: AnswerScriptViewerProps) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<ExamModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active Question Index in Question Palette
  const [currentIndex, setCurrentIndex] = useState(0);

  // View Mode: Question-by-Question vs Continuous Full Script View
  const [viewMode, setViewMode] = useState<"single" | "continuous">("single");

  // Local draft of manual evaluations to allow smooth editing & bulk save
  const [draftEvaluations, setDraftEvaluations] = useState<Record<string, { marks: number; comment: string; reason: string }>>({});

  // Audit Logs Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AnswerScriptAuditLog[]>([]);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  // Question Key Correction / Recheck Modal
  const [showRecheckModal, setShowRecheckModal] = useState(false);
  const [recheckTargetQ, setRecheckTargetQ] = useState<QuestionBankItem | null>(null);
  const [recheckAction, setRecheckAction] = useState<"change_key" | "cancel_question" | "full_marks_all">("full_marks_all");
  const [newCorrectAnswerInput, setNewCorrectAnswerInput] = useState("");
  const [recheckReasonInput, setRecheckReasonInput] = useState("");

  // AI Examiner State
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiFeedbackMap, setAiFeedbackMap] = useState<Record<string, { obtainedMarks: number; maxMarks: number; status: string; feedback: string; confidence?: number }>>({});
  const [aiOverallSummary, setAiOverallSummary] = useState<string>("");
  const [aiDraftActive, setAiDraftActive] = useState(false);

  // Script Deletion State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingScript, setIsDeletingScript] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const attData = await getAttemptById(attemptId);
      if (!attData) {
        setMessage({ type: "error", text: "Answer script attempt not found." });
        return;
      }
      setAttempt(attData);

      const examData = await getExamById(attData.examId);
      setExam(examData);

      // Populate draft evaluations
      const initialDraft: Record<string, { marks: number; comment: string; reason: string }> = {};
      const existing = attData.manualEvaluations || {};
      (attData.questionSnapshot || []).forEach(q => {
        if (existing[q.id]) {
          initialDraft[q.id] = {
            marks: existing[q.id].obtainedMarks,
            comment: existing[q.id].comment || "",
            reason: existing[q.id].overrideReason || ""
          };
        } else {
          initialDraft[q.id] = {
            marks: 0,
            comment: "",
            reason: ""
          };
        }
      });
      setDraftEvaluations(initialDraft);
    } catch (err) {
      console.error("Error loading script viewer:", err);
      setMessage({ type: "error", text: "Error loading answer script." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [attemptId]);

  if (loading || !attempt) {
    return (
      <div className="min-h-[400px] flex items-center justify-center bg-slate-900 rounded-3xl border border-white/10 p-12">
        <div className="text-center space-y-3">
          <RefreshCw size={32} className="animate-spin text-amber-400 mx-auto" />
          <p className="text-white font-bold text-sm">Loading complete candidate answer script...</p>
        </div>
      </div>
    );
  }

  const questions = attempt.questionSnapshot || [];
  const currentQ = questions[currentIndex] || questions[0];
  const answers = attempt.answers || {};

  // Check if finalized
  const isFinalized = attempt.evaluationStatus === "finalized";

  // Calculate stats for question palette
  const getQuestionPaletteStatus = (q: QuestionBankItem) => {
    const userAns = answers[q.id]?.selectedAnswer;
    const isSubjective = ["short_question", "fill_gaps", "changing_sentence", "tag_question"].includes(q.questionType);
    const hasManualEval = attempt.manualEvaluations?.[q.id] !== undefined;

    if (hasManualEval) {
      const mMarks = attempt.manualEvaluations![q.id].obtainedMarks;
      if (mMarks >= (q.marks || 1)) return "correct";
      if (mMarks > 0) return "partial";
      return "wrong";
    }

    if (!userAns || userAns === "") return "unanswered";

    if (isSubjective) return "manual_required";

    if (q.questionType === "mcq" || q.questionType === "true_false") {
      const given = typeof userAns === "string" ? userAns.trim().toUpperCase() : "";
      const key = typeof q.correctAnswer === "string" ? q.correctAnswer.trim().toUpperCase() : "";
      if (given === key) return "correct";
      return "wrong";
    }

    return "manual_required";
  };

  const handleSaveSingleQuestion = async (qId: string) => {
    const draft = draftEvaluations[qId];
    if (!draft) return;

    const targetQuestion = questions.find(q => q.id === qId);
    const maxMarks = targetQuestion?.marks || 1;

    if (draft.marks < 0 || draft.marks > maxMarks) {
      setMessage({ type: "error", text: `Marks must be between 0 and maximum marks (${maxMarks}).` });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const updated = await saveQuestionEvaluation({
        attemptId,
        questionId: qId,
        obtainedMarks: Number(draft.marks),
        maxMarks,
        comment: draft.comment,
        overrideReason: draft.reason,
        actorId,
        actorName,
        isManuallyOverridden: true
      });
      setAttempt(updated);
      setMessage({ type: "success", text: `Question evaluation saved successfully! ✓` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: "error", text: err.message || "Failed to save question evaluation." });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (isFinalized) return;
    setSaving(true);
    setMessage(null);
    try {
      const evalList = questions.map(q => {
        const d = draftEvaluations[q.id] || { marks: 0, comment: "" };
        return {
          questionId: q.id,
          obtainedMarks: Number(d.marks),
          maxMarks: q.marks || 1,
          comment: d.comment
        };
      });

      const updated = await saveBulkEvaluations({
        attemptId,
        evaluations: evalList,
        actorId,
        actorName
      });
      setAttempt(updated);
      setMessage({ type: "success", text: `All question evaluations saved and result recalculated! ✓` });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error saving all evaluations." });
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = async () => {
    setSaving(true);
    try {
      const updated = await recalculateAttemptResult(attemptId, actorId, actorName);
      setAttempt(updated);
      setMessage({ type: "success", text: "Final result recalculated and synced with database! ✓" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error recalculating result." });
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm("Are you sure you want to FINALIZE this evaluation? Normal editing will be locked.")) {
      return;
    }
    setSaving(true);
    try {
      const updated = await finalizeAttemptEvaluation(attemptId, actorId, actorName);
      setAttempt(updated);
      setMessage({ type: "success", text: "Evaluation FINALIZED and locked! ✓" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error finalizing evaluation." });
    } finally {
      setSaving(false);
    }
  };

  const handleReopenSubmit = async () => {
    if (!reopenReason.trim()) {
      alert("Please provide a mandatory reason for reopening this finalized evaluation.");
      return;
    }
    setSaving(true);
    try {
      const updated = await reopenAttemptEvaluation(attemptId, reopenReason, actorId, actorName);
      setAttempt(updated);
      setShowReopenModal(false);
      setReopenReason("");
      setMessage({ type: "success", text: "Evaluation script REOPENED for editing! ✓" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error reopening script." });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAuditModal = async () => {
    setShowAuditModal(true);
    const logs = await fetchAttemptAuditLogs(attemptId);
    setAuditLogs(logs);
  };

  const handleRecheckSubmit = async () => {
    if (!recheckTargetQ) return;
    setSaving(true);
    try {
      const affected = await recheckExamQuestionKey({
        examId: attempt.examId,
        questionId: recheckTargetQ.id,
        action: recheckAction,
        newCorrectAnswer: newCorrectAnswerInput,
        actorId,
        actorName,
        reason: recheckReasonInput
      });
      setShowRecheckModal(false);
      await loadData();
      setMessage({ type: "success", text: `Action applied successfully! Recalculated ${affected} candidate attempts.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error applying question key recheck." });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // AI EXAMINER EVALUATION HANDLER
  const handleRunAIEvaluation = async () => {
    if (isFinalized) {
      setMessage({ type: "error", text: "চূড়ান্তকৃত (Finalized) উত্তরপত্র এআই দিয়ে মূল্যায়ন করা যাবে না। প্রথমে খাতা Reopen করুন।" });
      return;
    }

    setAiEvaluating(true);
    setMessage(null);
    try {
      const questionsList = attempt.questionSnapshot || [];
      const res = await fetch("/api/gemini/evaluate-answer-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questionsList,
          answers: attempt.answers || {},
          candidateInfo: {
            name: attempt.candidateName,
            registrationNumber: attempt.registrationNumber,
            candidateId: attempt.candidateId
          },
          examTitle: attempt.examTitle || exam?.title || "BNCC Examination"
        })
      });

      if (!res.ok) {
        throw new Error("AI Examiner সার্ভারের সাথে যোগাযোগ করা সম্ভব হয়নি।");
      }

      const data = await res.json();
      const evals = data.evaluations || [];

      const newDraft = { ...draftEvaluations };
      const newAiMap: Record<string, any> = {};

      evals.forEach((ev: any) => {
        newAiMap[ev.questionId] = ev;
        newDraft[ev.questionId] = {
          marks: Number(ev.obtainedMarks),
          comment: ev.feedback || "AI Evaluated",
          reason: "AI Examiner suggested evaluation"
        };
      });

      setDraftEvaluations(newDraft);
      setAiFeedbackMap(newAiMap);
      setAiOverallSummary(data.overallFeedback || "এআই এক্সামিনারের মূল্যায়ন সম্পন্ন হয়েছে।");
      setAiDraftActive(true);

      setMessage({
        type: "success",
        text: "✨ AI Examiner-এর মূল্যায়ন সফলভাবে সম্পন্ন হয়েছে! নিচে এআই প্রস্তাবিত মার্কস ও ফিডব্যাক রিভিউ করুন এবং অনুমোদন করুন।"
      });
    } catch (err: any) {
      console.error("AI Evaluation error:", err);
      setMessage({ type: "error", text: err.message || "AI Examiner মূল্যায়নে ত্রুটি ঘটেছে।" });
    } finally {
      setAiEvaluating(false);
    }
  };

  // APPROVE AI MARKS & SAVE TO DATABASE
  const handleApproveAIMarks = async () => {
    if (isFinalized) return;
    setSaving(true);
    setMessage(null);
    try {
      const questionsList = attempt.questionSnapshot || [];
      const evalList = questionsList.map(q => {
        const d = draftEvaluations[q.id] || { marks: 0, comment: "" };
        return {
          questionId: q.id,
          obtainedMarks: Number(d.marks),
          maxMarks: q.marks || 1,
          comment: d.comment ? `[AI Examiner Approved] ${d.comment}` : "[AI Examiner Approved]"
        };
      });

      const updated = await saveBulkEvaluations({
        attemptId,
        evaluations: evalList,
        actorId,
        actorName: `${actorName} (AI Approved)`
      });

      setAttempt(updated);
      setAiDraftActive(false);
      setMessage({ type: "success", text: "✨ AI Examiner-এর মূল্যায়ন অ্যাডমিন হিসেবে সফলভাবে অনুমোদিত ও সংরক্ষিত হয়েছে! ফলাফল পুনর্গণনা করা হলো। ✓" });
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "AI মূল্যায়ন সংরক্ষণে সমস্যা হয়েছে।" });
    } finally {
      setSaving(false);
    }
  };

  // DISCARD AI DRAFT
  const handleDiscardAIDraft = () => {
    const resetDraft: Record<string, { marks: number; comment: string; reason: string }> = {};
    const existing = attempt.manualEvaluations || {};
    (attempt.questionSnapshot || []).forEach(q => {
      if (existing[q.id]) {
        resetDraft[q.id] = {
          marks: existing[q.id].obtainedMarks,
          comment: existing[q.id].comment || "",
          reason: existing[q.id].overrideReason || ""
        };
      } else {
        resetDraft[q.id] = { marks: 0, comment: "", reason: "" };
      }
    });
    setDraftEvaluations(resetDraft);
    setAiFeedbackMap({});
    setAiOverallSummary("");
    setAiDraftActive(false);
    setMessage({ type: "success", text: "এআই ড্রাফট বাতিল করা হয়েছে। পূর্বের মার্কস পুনঃস্থাপিত হলো।" });
    setTimeout(() => setMessage(null), 3000);
  };

  // DELETE SCRIPT HANDLER
  const handleDeleteScript = async () => {
    setIsDeletingScript(true);
    setMessage(null);
    try {
      await deleteAttemptById(attemptId, actorId, actorName);
      onBack();
    } catch (err: any) {
      console.error("Error deleting script:", err);
      setMessage({ type: "error", text: err.message || "উত্তরপত্রটি মোছা সম্ভব হয়নি।" });
    } finally {
      setIsDeletingScript(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Header Controls (Hidden on print) */}
      <div className="print:hidden bg-slate-900 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Answer Scripts List
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              onClick={() => setViewMode("single")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "single" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Question-by-Question Mode
            </button>
            <button
              onClick={() => setViewMode("continuous")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "continuous" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Full Script Mode
            </button>
          </div>

          <button
            onClick={handleRunAIEvaluation}
            disabled={aiEvaluating || isFinalized}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 border border-purple-400/30"
          >
            {aiEvaluating ? (
              <>
                <RefreshCw size={15} className="animate-spin text-purple-200" />
                <span>AI Analyzing Script...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-amber-300" />
                <span>AI Examiner</span>
              </>
            )}
          </button>

          <button
            onClick={handleOpenAuditModal}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <History size={15} /> Marks History
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer size={15} /> Print Script
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            title="Delete Answer Script"
            className="px-3 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/40 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Trash2 size={15} /> Delete Script
          </button>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`print:hidden p-4 rounded-2xl border flex items-center justify-between ${
          message.type === "success" 
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" 
            : "bg-rose-500/15 border-rose-500/30 text-rose-300"
        }`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs font-black cursor-pointer">✕</button>
        </div>
      )}

      {/* AI EXAMINER DRAFT REVIEW BANNER */}
      {(aiDraftActive || aiOverallSummary) && (
        <div className="print:hidden bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-2 border-purple-500/40 p-6 rounded-3xl shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-purple-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-600/30 border border-purple-400/50 flex items-center justify-center text-purple-300 shrink-0 shadow-lg">
                <BrainCircuit size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white flex items-center gap-1.5">
                    AI Examiner Draft Assessment Active
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full">
                    Mandatory Admin Review
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 font-medium mt-0.5">
                  এআই প্রতিটি প্রশ্নের উত্তর বিশ্লেষণ করে নম্বর ও ফিডব্যাক প্রস্তাব করেছে। অ্যাডমিন রিভিউ ও অনুমোদনের পর প্রাপ্ত নম্বর সংরক্ষণ করা হবে।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleDiscardAIDraft}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-rose-500/30 transition-all cursor-pointer"
              >
                Discard AI Draft
              </button>
              <button
                onClick={handleApproveAIMarks}
                disabled={saving}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <ThumbsUp size={16} /> Approve & Save AI Marks
              </button>
            </div>
          </div>

          {aiOverallSummary && (
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-purple-500/20 text-xs text-purple-100 space-y-1">
              <span className="text-[10px] text-amber-400 font-black uppercase tracking-widest block flex items-center gap-1.5">
                <Sparkles size={12} /> AI Overall Candidate Performance Justification
              </span>
              <p className="leading-relaxed font-medium">{aiOverallSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PRINT-HEADER (Visible only when printed)
         ========================================================================= */}
      <div className="hidden print:block text-slate-900 border-b-2 border-slate-900 pb-4 mb-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black uppercase">COX'S BAZAR CITY COLLEGE</h1>
          <h2 className="text-lg font-bold">BNCC PLATOON - ONLINE EXAMINATION ANSWER SCRIPT</h2>
          <p className="text-xs font-medium">Official Digital Evaluation Record • Cox's Bazar, Bangladesh</p>
        </div>
      </div>

      {/* =========================================================================
          CANDIDATE & EVALUATION SUMMARY HEADER
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Candidate Info Card */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-amber-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
            {attempt.candidatePhoto ? (
              <img src={attempt.candidatePhoto} alt={attempt.candidateName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-amber-400">
                {attempt.candidateName ? attempt.candidateName.substring(0, 2).toUpperCase() : "C"}
              </span>
            )}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">{attempt.candidateName || "Candidate Name"}</h2>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Roll: {attempt.registrationNumber || "N/A"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1 gap-x-4 text-xs text-slate-300 font-medium pt-1">
              <div><span className="text-slate-500">Candidate ID:</span> {attempt.userId}</div>
              <div><span className="text-slate-500">Exam:</span> {attempt.examTitle || "BNCC Exam"}</div>
              <div><span className="text-slate-500">Attempt ID:</span> <span className="font-mono text-[10px] text-amber-400">{attempt.id}</span></div>
              <div><span className="text-slate-500">Start Time:</span> {new Date(attempt.startedAt).toLocaleTimeString("bn-BD")}</div>
              <div><span className="text-slate-500">Submit Time:</span> {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleTimeString("bn-BD") : "N/A"}</div>
              <div><span className="text-slate-500">Status:</span> <strong className="text-emerald-400 uppercase text-[11px]">{attempt.status}</strong></div>
            </div>
          </div>
        </div>

        {/* Evaluation Summary Box */}
        <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
              <Award size={16} /> Evaluation Summary
            </h3>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
              isFinalized 
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
            }`}>
              {attempt.evaluationStatus ? attempt.evaluationStatus.replace("_", " ").toUpperCase() : "PENDING"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Auto Score</span>
              <span className="text-base font-black text-blue-400">{attempt.autoScore ?? attempt.score ?? 0}</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Manual Marks</span>
              <span className="text-base font-black text-amber-400">{attempt.manualMarks ?? 0}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-amber-500/30 text-center flex items-center justify-between px-4">
            <div className="text-left">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Score / Marks</span>
              <span className="text-xs text-slate-300">Passing: {exam?.passMarks || 0} Marks</span>
            </div>
            <div className="text-right">
              <span className="text-xl font-black text-white">
                {attempt.finalScore ?? attempt.score ?? 0} <span className="text-xs text-slate-500">/ {attempt.markingSummary?.totalMarks || exam?.totalMarks || 100}</span>
              </span>
              <span className={`text-[11px] font-black block ${attempt.isPassed ? "text-emerald-400" : "text-rose-400"}`}>
                {attempt.percentage}% ({attempt.isPassed ? "PASSED" : "FAILED"})
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          QUESTION PALETTE NAVIGATOR
         ========================================================================= */}
      <div className="print:hidden bg-slate-900 border border-white/10 p-5 rounded-3xl space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Question Palette Navigator</h3>
            <p className="text-[10px] text-slate-400 font-semibold">
              Click any question number to review and grade. Evaluated: {Object.keys(attempt.manualEvaluations || {}).length} / {questions.length} Questions
            </p>
          </div>

          {/* Palette Color Legends */}
          <div className="hidden md:flex items-center gap-3 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-emerald-400"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Correct</span>
            <span className="flex items-center gap-1 text-rose-400"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Wrong</span>
            <span className="flex items-center gap-1 text-amber-400"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Manual Review</span>
            <span className="flex items-center gap-1 text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span> Unanswered</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => {
            const status = getQuestionPaletteStatus(q);
            const isActive = currentIndex === idx;
            const isEvaluated = attempt.manualEvaluations?.[q.id] !== undefined;

            let bgColor = "bg-slate-800 text-slate-300 border-slate-700";
            if (status === "correct") bgColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
            if (status === "wrong") bgColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
            if (status === "manual_required") bgColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
            if (status === "unanswered") bgColor = "bg-slate-950 text-slate-500 border-slate-800";

            if (isActive) {
              bgColor = "bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/50 scale-105 font-black";
            }

            return (
              <button
                key={q.id}
                onClick={() => {
                  setCurrentIndex(idx);
                  if (viewMode === "continuous") {
                    const el = document.getElementById(`q_box_${q.id}`);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className={`w-9 h-9 rounded-xl border font-bold text-xs flex items-center justify-center transition-all cursor-pointer relative ${bgColor}`}
              >
                {idx + 1}
                {isEvaluated && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border border-slate-900 flex items-center justify-center text-[7px] font-black text-slate-950">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          SINGLE QUESTION REVIEW MODE vs FULL CONTINUOUS MODE
         ========================================================================= */}
      {viewMode === "single" ? (
        /* SINGLE QUESTION MODE */
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <RenderQuestionBox
            question={currentQ}
            index={currentIndex}
            attempt={attempt}
            exam={exam}
            draftEvaluations={draftEvaluations}
            setDraftEvaluations={setDraftEvaluations}
            aiFeedbackMap={aiFeedbackMap}
            onSaveSingle={() => handleSaveSingleQuestion(currentQ.id)}
            onOpenRecheck={() => {
              setRecheckTargetQ(currentQ);
              setShowRecheckModal(true);
            }}
            isFinalized={isFinalized}
            saving={saving}
          />

          {/* Navigation Controls */}
          <div className="print:hidden border-t border-white/10 pt-5 flex items-center justify-between gap-4">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Previous Question
            </button>

            <button
              onClick={async () => {
                await handleSaveSingleQuestion(currentQ.id);
                if (currentIndex < questions.length - 1) {
                  setCurrentIndex(currentIndex + 1);
                }
              }}
              disabled={isFinalized || saving}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} /> Save & Next
            </button>

            <button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-white/10 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            >
              Next Question <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* FULL CONTINUOUS SCRIPT MODE */
        <div className="space-y-6">
          {questions.map((q, idx) => (
            <div id={`q_box_${q.id}`} key={q.id} className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl print:bg-white print:text-slate-900 print:border-slate-300 print:p-4">
              <RenderQuestionBox
                question={q}
                index={idx}
                attempt={attempt}
                exam={exam}
                draftEvaluations={draftEvaluations}
                setDraftEvaluations={setDraftEvaluations}
                aiFeedbackMap={aiFeedbackMap}
                onSaveSingle={() => handleSaveSingleQuestion(q.id)}
                onOpenRecheck={() => {
                  setRecheckTargetQ(q);
                  setShowRecheckModal(true);
                }}
                isFinalized={isFinalized}
                saving={saving}
              />
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          BOTTOM GLOBAL ACTION TOOLBAR (Hidden on print)
         ========================================================================= */}
      <div className="print:hidden sticky bottom-6 z-30 bg-slate-900/95 backdrop-blur-md border border-amber-500/30 p-4 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAll}
            disabled={isFinalized || saving}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} /> Save All Evaluations
          </button>

          <button
            onClick={handleRecalculate}
            disabled={saving}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={16} /> Recalculate Result
          </button>
        </div>

        <div className="flex items-center gap-3">
          {isFinalized ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <Lock size={14} /> Evaluation Finalized
              </span>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  <Unlock size={14} /> Reopen Script
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Finalize Evaluation
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          AUDIT LOGS / MARKS HISTORY MODAL
         ========================================================================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <History className="text-amber-400" size={20} /> Evaluation Audit Trail & Marks History
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Immutable record of all mark changes and examiner comments</p>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              {auditLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-8 text-xs font-semibold">No audit records found for this answer script.</p>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                      <span>{new Date(log.timestamp).toLocaleString("bn-BD")}</span>
                      <span className="text-amber-400 font-bold">{log.actorName || log.actorId}</span>
                    </div>
                    <p className="text-white font-bold">{log.action.replace("_", " ")}</p>
                    {log.reason && <p className="text-slate-300 italic">" Reason: {log.reason} "</p>}
                    {(log.oldValue !== undefined || log.newValue !== undefined) && (
                      <div className="text-[11px] font-mono text-slate-400">
                        Score change: <span className="text-rose-400">{log.oldValue}</span> → <span className="text-emerald-400">{log.newValue}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="text-right border-t border-white/10 pt-4">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REOPEN EVALUATION MODAL
         ========================================================================= */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-purple-300 flex items-center gap-2">
                <Unlock size={20} /> Reopen Finalized Answer Script
              </h3>
              <button onClick={() => setShowReopenModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-slate-300">
              Reopening this finalized script will enable manual marking edits. You MUST state a valid audit reason.
            </p>

            <textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Provide mandatory reason for reopening (e.g. Question key corrected after appeal)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-purple-400 min-h-[100px]"
            />

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenSubmit}
                disabled={saving || !reopenReason.trim()}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Reopen Evaluation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          QUESTION RECHECK / ANSWER KEY CORRECTION MODAL
         ========================================================================= */}
      {showRecheckModal && recheckTargetQ && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black text-blue-300 flex items-center gap-2">
                <Edit3 size={20} /> Question Key Recheck & Recalibration
              </h3>
              <button onClick={() => setShowRecheckModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-amber-400 block">Question:</span>
              <p className="font-semibold text-white">{recheckTargetQ.question}</p>
              <span className="text-[10px] text-slate-400 block">Current Key: {String(recheckTargetQ.correctAnswer)}</span>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-bold text-white block">Select Recheck Action:</label>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="recheckAction"
                    checked={recheckAction === "full_marks_all"}
                    onChange={() => setRecheckAction("full_marks_all")}
                    className="accent-amber-400"
                  />
                  <span>Give Full Grace Marks ({recheckTargetQ.marks || 1}) to ALL Candidates</span>
                </label>

                <label className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="recheckAction"
                    checked={recheckAction === "cancel_question"}
                    onChange={() => setRecheckAction("cancel_question")}
                    className="accent-amber-400"
                  />
                  <span>Cancel Question & Award Grace Marks</span>
                </label>

                <label className="flex items-center gap-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800 cursor-pointer">
                  <input
                    type="radio"
                    name="recheckAction"
                    checked={recheckAction === "change_key"}
                    onChange={() => setRecheckAction("change_key")}
                    className="accent-amber-400"
                  />
                  <span>Change Answer Key & Recalculate All Attempts</span>
                </label>
              </div>

              {recheckAction === "change_key" && (
                <div>
                  <label className="font-bold text-slate-300 block mb-1">New Correct Answer Key:</label>
                  <input
                    type="text"
                    value={newCorrectAnswerInput}
                    onChange={(e) => setNewCorrectAnswerInput(e.target.value)}
                    placeholder="e.g. B or A or correct string..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-400"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-300 block mb-1">Reason / Notes:</label>
                <input
                  type="text"
                  value={recheckReasonInput}
                  onChange={(e) => setRecheckReasonInput(e.target.value)}
                  placeholder="e.g. Printing typo in options..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setShowRecheckModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecheckSubmit}
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
              >
                Apply Recheck & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Script Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/40 max-w-md w-full p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Delete Answer Script</h3>
                <p className="text-xs text-rose-300/80 font-medium">Permanently erase this candidate script</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p><strong>Candidate:</strong> {attempt.candidateName} ({attempt.registrationNumber || "N/A"})</p>
              <p><strong>Exam Title:</strong> {attempt.examTitle || exam?.title || "N/A"}</p>
              <p className="text-rose-400 text-[11px] font-bold mt-2 pt-2 border-t border-slate-800">
                ⚠️ Warning: Deleting this answer script cannot be undone. All recorded marks, AI evaluations, audit logs, and leaderboard ranks for this candidate will be permanently removed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeletingScript}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingScript}
                onClick={handleDeleteScript}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingScript ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: QUESTION ITEM BOX RENDERER
// =============================================================================

interface RenderQuestionBoxProps {
  question: QuestionBankItem;
  index: number;
  attempt: ExamAttempt;
  exam: ExamModel | null;
  draftEvaluations: Record<string, { marks: number; comment: string; reason: string }>;
  setDraftEvaluations: React.Dispatch<React.SetStateAction<Record<string, { marks: number; comment: string; reason: string }>>>;
  aiFeedbackMap?: Record<string, { obtainedMarks: number; maxMarks: number; status: string; feedback: string; confidence?: number }>;
  onSaveSingle: () => void;
  onOpenRecheck: () => void;
  isFinalized: boolean;
  saving: boolean;
}

function RenderQuestionBox({
  question,
  index,
  attempt,
  exam,
  draftEvaluations,
  setDraftEvaluations,
  aiFeedbackMap,
  onSaveSingle,
  onOpenRecheck,
  isFinalized,
  saving
}: RenderQuestionBoxProps) {
  const qId = question.id;
  const userAnsObj = attempt.answers?.[qId];
  const candidateSubmittedAnswer = userAnsObj?.selectedAnswer;

  const maxMarks = question.marks || 1;
  const draft = draftEvaluations[qId] || { marks: 0, comment: "", reason: "" };

  const savedEval = attempt.manualEvaluations?.[qId];

  // Answer key
  const key = question.correctAnswer;

  return (
    <div className="space-y-5">
      
      {/* Question Header Line */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3.5 print:border-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30 print:bg-slate-200 print:text-slate-800">
            Question {index + 1}
          </span>
          <span className="text-xs font-semibold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-full border border-slate-800 print:border-slate-300 print:text-slate-700">
            {question.subject || "General"}
          </span>
          <span className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
            Max Marks: {maxMarks}
          </span>
        </div>

        <button
          onClick={onOpenRecheck}
          title="Recheck / Change Answer Key / Grace Marks"
          className="print:hidden text-[11px] font-bold text-slate-400 hover:text-white bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw size={13} /> Recheck Key
        </button>
      </div>

      {/* Question Text */}
      <div className="bg-[#1a294c] p-4 sm:p-6 rounded-2xl border border-blue-500/20 text-white print:bg-slate-100 print:text-slate-900 print:border-slate-300">
        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block mb-1">
          {(question.questionType || "MCQ").replace("_", " ").toUpperCase()}
        </span>
        <h3 className="text-base sm:text-lg font-bold leading-relaxed">
          {question.question}
        </h3>
      </div>

      {/* MCQ / True False Options Display */}
      {question.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {Object.entries(question.options).map(([optKey, optVal]) => {
            if (!optVal) return null;
            const isSelected = String(candidateSubmittedAnswer).trim().toUpperCase() === optKey.toUpperCase();
            const isCorrectKey = String(key).trim().toUpperCase() === optKey.toUpperCase();

            let borderStyle = "border-slate-800 bg-slate-950/60 text-slate-300";
            if (isSelected) {
              borderStyle = "border-amber-500/80 bg-amber-500/10 text-white font-bold ring-1 ring-amber-500/40";
            }
            if (isCorrectKey) {
              borderStyle = "border-emerald-500/80 bg-emerald-500/10 text-emerald-300 font-bold";
            }

            return (
              <div key={optKey} className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${borderStyle}`}>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px]">
                    {optKey}
                  </span>
                  <span>{optVal}</span>
                </div>
                {isSelected && <span className="text-[9px] font-black uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded">Candidate Pick</span>}
                {isCorrectKey && <span className="text-[9px] font-black uppercase bg-emerald-500 text-slate-950 px-2 py-0.5 rounded">Correct Key</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CANDIDATE'S SUBMITTED ANSWER vs CORRECT ANSWER KEY (IMMUTABLE)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        
        {/* Candidate Submitted Answer Box */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 print:bg-slate-50 print:border-slate-300">
          <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider block flex items-center gap-1.5">
            <Bookmark size={13} /> Candidate's Original Submitted Answer (Immutable)
          </span>
          <div className="text-sm font-bold text-white min-h-[32px] flex items-center print:text-slate-900">
            {candidateSubmittedAnswer !== undefined && candidateSubmittedAnswer !== null && candidateSubmittedAnswer !== "" ? (
              <span className="font-mono bg-slate-900 px-3 py-1 rounded-xl border border-slate-700 text-amber-300">
                {Array.isArray(candidateSubmittedAnswer) ? candidateSubmittedAnswer.join(", ") : String(candidateSubmittedAnswer)}
              </span>
            ) : (
              <span className="text-slate-500 italic text-xs">Unanswered (কোনো উত্তর সাবমিট করা হয়নি)</span>
            )}
          </div>
        </div>

        {/* Correct Answer Key Box */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5 print:bg-slate-50 print:border-slate-300">
          <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider block flex items-center gap-1.5">
            <CheckCircle2 size={13} /> Correct Answer Key / Reference Solution
          </span>
          <div className="text-sm font-bold text-emerald-300 min-h-[32px] flex items-center print:text-emerald-700">
            <span className="font-mono bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
              {Array.isArray(key) ? key.join(", ") : String(key || question.expectedAnswer || "N/A")}
            </span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          AI EXAMINER QUESTION ASSESSMENT & FEEDBACK BOX
         ========================================================================= */}
      {aiFeedbackMap?.[qId] && (
        <div className="print:hidden bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 p-5 rounded-2xl border-2 border-purple-500/40 space-y-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-purple-400" />
              <span className="text-xs font-black uppercase text-purple-200 tracking-wider">
                AI Examiner Assessment & Justification
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className={`px-2.5 py-0.5 rounded-full uppercase text-[10px] font-black border ${
                aiFeedbackMap[qId].status === "correct" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                aiFeedbackMap[qId].status === "partial" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                aiFeedbackMap[qId].status === "wrong" ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
                {aiFeedbackMap[qId].status}
              </span>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-mono text-[11px]">
                AI Suggested: {aiFeedbackMap[qId].obtainedMarks} / {maxMarks} Marks
              </span>
            </div>
          </div>

          <div className="text-xs text-purple-100 font-medium space-y-1">
            <p className="leading-relaxed"><strong className="text-amber-300">AI Feedback:</strong> {aiFeedbackMap[qId].feedback}</p>
            {aiFeedbackMap[qId].confidence && (
              <span className="text-[10px] text-purple-300/70 font-mono block">
                AI Confidence Score: {aiFeedbackMap[qId].confidence}%
              </span>
            )}
          </div>

          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              disabled={isFinalized}
              onClick={() => setDraftEvaluations(prev => ({
                ...prev,
                [qId]: { ...draft, marks: aiFeedbackMap[qId].obtainedMarks, comment: aiFeedbackMap[qId].feedback }
              }))}
              className="px-3.5 py-1.5 bg-purple-600/40 hover:bg-purple-600 text-purple-100 font-bold text-xs rounded-xl border border-purple-400/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} className="text-amber-300" /> Apply AI Suggested Mark ({aiFeedbackMap[qId].obtainedMarks})
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MANUAL MARKING CONTROLS FOR EXAMINER
         ========================================================================= */}
      <div className="print:hidden bg-slate-950/80 p-5 rounded-2xl border border-amber-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
            <Sparkles size={16} /> Examiner Evaluation & Manual Marks Input
          </span>
          {savedEval && (
            <span className="text-[10px] text-slate-400 font-mono">
              Evaluated by: <strong className="text-amber-300">{savedEval.evaluatedByName || savedEval.evaluatedBy}</strong> at {new Date(savedEval.evaluatedAt!).toLocaleTimeString("bn-BD")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          
          {/* Obtained Marks Input */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 block">
              Obtained Marks (Max: {maxMarks}):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0"
                max={maxMarks}
                disabled={isFinalized}
                value={draft.marks}
                onChange={(e) => {
                  const val = Math.min(maxMarks, Math.max(0, Number(e.target.value)));
                  setDraftEvaluations(prev => ({
                    ...prev,
                    [qId]: { ...draft, marks: val }
                  }));
                }}
                className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-black text-amber-400 outline-none focus:border-amber-400"
              />
              <span className="text-xs font-bold text-slate-400">/ {maxMarks}</span>
            </div>
          </div>

          {/* Quick Mark Adjustment Buttons */}
          <div className="space-y-1 col-span-1 sm:col-span-2 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-300 block">Quick Marks Preset:</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isFinalized}
                onClick={() => setDraftEvaluations(prev => ({ ...prev, [qId]: { ...draft, marks: maxMarks } }))}
                className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 text-xs font-bold rounded-lg border border-emerald-500/30 transition-all cursor-pointer"
              >
                Full Marks ({maxMarks})
              </button>
              {maxMarks >= 2 && (
                <button
                  type="button"
                  disabled={isFinalized}
                  onClick={() => setDraftEvaluations(prev => ({ ...prev, [qId]: { ...draft, marks: Math.round((maxMarks / 2) * 10) / 10 } }))}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs font-bold rounded-lg border border-amber-500/30 transition-all cursor-pointer"
                >
                  Half ({maxMarks / 2})
                </button>
              )}
              <button
                type="button"
                disabled={isFinalized}
                onClick={() => setDraftEvaluations(prev => ({ ...prev, [qId]: { ...draft, marks: 0 } }))}
                className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-slate-950 text-xs font-bold rounded-lg border border-rose-500/30 transition-all cursor-pointer"
              >
                Zero Marks (0)
              </button>
            </div>
          </div>

          {/* Individual Save Button */}
          <div className="text-right">
            <button
              onClick={onSaveSingle}
              disabled={isFinalized || saving}
              className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40"
            >
              Save Question
            </button>
          </div>

        </div>

        {/* Examiner Comment Text Area */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-300 block flex items-center gap-1.5">
            <MessageSquare size={13} /> Examiner Remark / Comment:
          </label>
          <input
            type="text"
            disabled={isFinalized}
            value={draft.comment}
            onChange={(e) => setDraftEvaluations(prev => ({
              ...prev,
              [qId]: { ...draft, comment: e.target.value }
            }))}
            placeholder="e.g. Answer is partially correct. Good explanation of military strategy..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
          />
        </div>

      </div>

      {/* Printed Evaluation Output Block */}
      <div className="hidden print:block border-t border-slate-300 pt-2 text-xs text-slate-900 font-medium">
        <div><strong>Marks Awarded:</strong> {draft.marks} / {maxMarks}</div>
        {draft.comment && <div><strong>Examiner Comment:</strong> {draft.comment}</div>}
      </div>

    </div>
  );
}
