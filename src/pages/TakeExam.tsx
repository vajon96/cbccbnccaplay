import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Clock, CheckCircle, Bookmark, ChevronLeft, ChevronRight, 
  Send, RefreshCw, Grid, X 
} from "lucide-react";
import { getSession } from "../lib/auth";
import { 
  getExamById, getUserAttempts, saveAttemptAnswer, 
  submitExamAttempt 
} from "../services/examService";
import { ExamModel, ExamAttempt, QuestionBankItem, ExamResult } from "../types";

export function TakeExam() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [exam, setExam] = useState<ExamModel | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Answers state local cache
  const [answersMap, setAnswersMap] = useState<Record<string, { selectedAnswer: string | string[]; isMarkedForReview: boolean }>>({});

  // Countdown timer state
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showMobileNavDrawer, setShowMobileNavDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to safely extract question text from any property variation
  const getQuestionText = (q: any): string => {
    if (!q) return "Question text unavailable";
    if (typeof q === "string") return q;
    const val = q.question ?? q.questionText ?? q.question_text ?? q.text ?? q.title ?? q.content ?? q.name;
    if (typeof val === "string" && val.trim().length > 0) return val;
    if (typeof val === "object" && val !== null) return JSON.stringify(val);
    return String(val || "Question text unavailable");
  };

  // Helper function to safely extract option text for MCQ
  const getOptionText = (options: any, key: string): string => {
    if (!options) return "";
    if (typeof options === "object") {
      const val = options[key] ?? options[key.toLowerCase()] ?? options[`option${key}`] ?? options[`Option ${key}`] ?? options[`Option_${key}`];
      if (val !== undefined && val !== null) return String(val);
    }
    if (Array.isArray(options)) {
      const idx = key === "A" ? 0 : key === "B" ? 1 : key === "C" ? 2 : 3;
      return options[idx] ? String(options[idx]) : "";
    }
    return "";
  };

  useEffect(() => {
    if (!session) {
      navigate("/exam/login");
      return;
    }

    if (!examId) return;

    const initExam = async () => {
      setLoading(true);
      try {
        const eData = await getExamById(examId);
        if (!eData) {
          alert("Exam not found");
          navigate("/exam/dashboard");
          return;
        }
        setExam(eData);

        const myAtts = await getUserAttempts(session.id);
        const activeAttempt = myAtts.find(a => a.examId === examId && a.status === "in_progress");

        if (!activeAttempt) {
          alert("Active attempt session not found. Please start exam from dashboard.");
          navigate("/exam/dashboard");
          return;
        }

        setAttempt(activeAttempt);
        const qList = activeAttempt.questionSnapshot || [];
        setQuestions(qList);

        // Pre-fill local answers map
        if (activeAttempt.answers) {
          const map: Record<string, { selectedAnswer: string | string[]; isMarkedForReview: boolean }> = {};
          Object.keys(activeAttempt.answers).forEach(qId => {
            const item = activeAttempt.answers![qId];
            map[qId] = {
              selectedAnswer: item.selectedAnswer || "",
              isMarkedForReview: item.isMarkedForReview || false
            };
          });
          setAnswersMap(map);
        }

        // Compute remaining seconds based on duration and startedAt
        const startedTime = new Date(activeAttempt.startedAt).getTime();
        const durationMs = (eData.durationMinutes || 30) * 60 * 1000;
        const endTime = startedTime + durationMs;
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

        setTimeLeftSeconds(remaining);

      } catch (err) {
        console.error("Error initializing exam:", err);
      } finally {
        setLoading(false);
      }
    };

    initExam();
  }, [examId, session?.id]);

  // Timer Tick
  useEffect(() => {
    if (timeLeftSeconds <= 0 || !attempt) return;

    timerRef.current = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Trigger Auto-Submit
          handleFinalSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeftSeconds, attempt?.id]);

  // Auto-Save Answer when modified
  const handleSelectAnswer = async (qId: string, answerVal: string | string[]) => {
    const updated = {
      selectedAnswer: answerVal,
      isMarkedForReview: answersMap[qId]?.isMarkedForReview || false
    };

    setAnswersMap(prev => ({ ...prev, [qId]: updated }));

    if (attempt) {
      await saveAttemptAnswer({
        attemptId: attempt.id,
        questionId: qId,
        selectedAnswer: answerVal,
        isMarkedForReview: updated.isMarkedForReview
      });
    }
  };

  const toggleMarkForReview = async (qId: string) => {
    const current = answersMap[qId] || { selectedAnswer: "", isMarkedForReview: false };
    const updated = { ...current, isMarkedForReview: !current.isMarkedForReview };

    setAnswersMap(prev => ({ ...prev, [qId]: updated }));

    if (attempt) {
      await saveAttemptAnswer({
        attemptId: attempt.id,
        questionId: qId,
        selectedAnswer: updated.selectedAnswer,
        isMarkedForReview: updated.isMarkedForReview
      });
    }
  };

  const handleFinalSubmit = async (autoSubmitted = false) => {
    if (!attempt || submitting) return;
    setSubmitting(true);
    try {
      const result: ExamResult = await submitExamAttempt(attempt.id, autoSubmitted);
      navigate(`/exam/result/${attempt.id}`);
    } catch (err: any) {
      console.error("Submission failed:", err);
      alert("Submission error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !attempt || !exam) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center space-y-4">
        <RefreshCw size={36} className="animate-spin text-primary" />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Loading Secure Examination Room...
        </span>
      </div>
    );
  }

  const currentQ = (questions[currentIndex] || {}) as Partial<QuestionBankItem>;
  const qId = currentQ.id || "";
  const questionText = getQuestionText(currentQ);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Stats for navigator
  const totalQ = questions.length;
  const answeredCount = Object.keys(answersMap).filter(k => answersMap[k]?.selectedAnswer !== "" && answersMap[k]?.selectedAnswer !== undefined).length;
  const reviewCount = Object.keys(answersMap).filter(k => answersMap[k]?.isMarkedForReview).length;
  const unansweredCount = totalQ - answeredCount;

  return (
    <div className="min-h-screen bg-[#0b1329] text-white font-sans flex flex-col selection:bg-primary selection:text-white pb-20 lg:pb-0">
      
      {/* Top Fixed Exam Banner Header */}
      <header className="bg-[#131f3d] border-b border-slate-700/60 sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">{exam.title}</h1>
            <span className="text-[10px] text-amber-400 font-bold block uppercase">
              Candidate: {session?.name || attempt.candidateName} (Reg: {attempt.registrationNumber})
            </span>
          </div>

          <div className="sm:hidden">
            <h1 className="text-xs font-black text-white truncate max-w-[180px]">{exam.title}</h1>
            <span className="text-[9px] text-amber-400 font-bold block">Reg: {attempt.registrationNumber}</span>
          </div>
        </div>

        {/* Live Timer */}
        <div className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border flex items-center gap-2 shadow-lg transition-colors ${
          timeLeftSeconds < 300
            ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
            : "bg-[#0b1329] border-slate-700 text-emerald-400"
        }`}>
          <Clock size={16} />
          <div className="text-right">
            <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase block leading-none">Time Remaining</span>
            <span className="text-sm sm:text-base font-mono font-black">{formatTime(timeLeftSeconds)}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left 3 cols: Active Question Component */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6 flex flex-col justify-between">
          
          <div className="bg-[#131f3d] border border-slate-700/60 p-5 sm:p-8 rounded-3xl space-y-5 shadow-xl flex-1">
            
            {/* Question Bar Header */}
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30">
                  Question {currentIndex + 1} of {totalQ}
                </span>
                {currentQ.subject && (
                  <span className="text-xs font-bold uppercase text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    {currentQ.subject}
                  </span>
                )}
                {currentQ.marks && (
                  <span className="text-xs font-semibold text-slate-300 bg-[#0b1329] px-2.5 py-1 rounded-full border border-slate-700/60">
                    {currentQ.marks} Mark{currentQ.marks > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <button
                onClick={() => qId && toggleMarkForReview(qId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer ${
                  answersMap[qId]?.isMarkedForReview
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-black"
                    : "bg-[#0b1329] text-slate-300 border-slate-700 hover:text-white hover:border-slate-600"
                }`}
              >
                <Bookmark size={14} />
                <span className="hidden sm:inline">
                  {answersMap[qId]?.isMarkedForReview ? "Marked for Review" : "Mark for Review"}
                </span>
              </button>
            </div>

            {/* Question Text Component */}
            <div className="space-y-2 bg-[#1a294c] p-4 sm:p-6 rounded-2xl border border-blue-500/20 text-white">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">
                {(currentQ.questionType || "MCQ").replace("_", " ").toUpperCase()}
              </span>
              <h2 className="text-base sm:text-xl font-bold text-white leading-relaxed font-sans">
                {questionText}
              </h2>
            </div>

            {/* Render Options / Input based on Question Type */}
            <div className="pt-2">
              
              {/* MCQ Options */}
              {(currentQ.questionType === "mcq" || !currentQ.questionType) && (
                <div className="space-y-3">
                  {["A", "B", "C", "D"].map((key) => {
                    const optText = getOptionText(currentQ.options, key);
                    const selected = answersMap[qId]?.selectedAnswer === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectAnswer(qId, key)}
                        className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-between min-h-[52px] ${
                          selected
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.005]"
                            : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 pr-2">
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 ${
                            selected ? "bg-white text-primary" : "bg-slate-800 text-slate-300"
                          }`}>
                            {key}
                          </span>
                          <span className="leading-snug">{optText || `Option ${key}`}</span>
                        </div>
                        {selected && <CheckCircle size={20} className="shrink-0 text-white" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True / False */}
              {currentQ.questionType === "true_false" && (
                <div className="grid grid-cols-2 gap-4">
                  {["True", "False"].map((val) => {
                    const selected = answersMap[qId]?.selectedAnswer === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleSelectAnswer(qId, val)}
                        className={`p-6 rounded-2xl border text-center text-sm font-black uppercase tracking-wider transition-all cursor-pointer min-h-[60px] ${
                          selected
                            ? "bg-primary text-white border-primary shadow-lg scale-[1.01]"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        {val === "True" ? "True (সত্য)" : "False (মিথ্যা)"}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text Input Questions (fill_gaps, short_question, etc.) */}
              {currentQ.questionType && currentQ.questionType !== "mcq" && currentQ.questionType !== "true_false" && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase">
                    আপনার উত্তর টাইপ করুন (Type Your Answer):
                  </label>
                  <input
                    type="text"
                    value={(answersMap[qId]?.selectedAnswer as string) || ""}
                    onChange={(e) => handleSelectAnswer(qId, e.target.value)}
                    placeholder="এখানে উত্তর লিখুন..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary font-medium"
                  />
                </div>
              )}

            </div>

          </div>

          {/* Desktop Nav Buttons Footer */}
          <div className="hidden lg:flex bg-[#131f3d] border border-slate-700/60 p-4 rounded-2xl items-center justify-between">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-all disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={16} /> Previous
            </button>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
            >
              <Send size={16} /> Submit Exam
            </button>

            <button
              onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-all disabled:opacity-30 cursor-pointer"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

        </div>

        {/* Right 1 col: Desktop Question Palette Navigator */}
        <div className="hidden lg:block bg-[#131f3d] border border-slate-700/60 p-6 rounded-3xl space-y-6 shadow-xl h-fit">
          <div className="border-b border-slate-700/60 pb-3">
            <h3 className="text-xs font-bold not-italic text-blue-300 uppercase tracking-wider text-center border-[#ffffff]">Question Navigator</h3>
            <p className="text-[10px] text-slate-300 font-semibold">Click any number to jump directly</p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
            <div className="bg-[#0b1329] p-2 rounded-xl text-emerald-400 border border-slate-700/60">
              Answered: {answeredCount}
            </div>
            <div className="bg-[#0b1329] p-2 rounded-xl text-rose-400 border border-slate-700/60">
              Unanswered: {unansweredCount}
            </div>
            <div className="bg-[#0b1329] p-2 rounded-xl text-amber-400 border border-slate-700/60 col-span-2">
              Marked for Review: {reviewCount}
            </div>
          </div>

          {/* Number Grid */}
          <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const ansObj = answersMap[q.id];
              const isAnswered = ansObj?.selectedAnswer !== "" && ansObj?.selectedAnswer !== undefined;
              const isReview = ansObj?.isMarkedForReview;

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    isCurrent
                      ? "ring-2 ring-primary bg-primary text-white border-white"
                      : isReview
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                      : isAnswered
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

        </div>

      </main>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2 shadow-2xl">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="p-3 bg-slate-800 disabled:opacity-30 text-white rounded-xl text-xs font-bold"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={() => setShowMobileNavDrawer(true)}
          className="flex-1 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs font-bold text-slate-200 flex items-center justify-center gap-2"
        >
          <Grid size={16} className="text-primary" />
          <span>Questions ({answeredCount}/{totalQ})</span>
        </button>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="px-3 py-2.5 bg-emerald-500 text-white font-black text-xs uppercase rounded-xl shadow-lg shadow-emerald-500/20"
        >
          Submit
        </button>

        <button
          onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
          disabled={currentIndex === questions.length - 1}
          className="p-3 bg-slate-800 disabled:opacity-30 text-white rounded-xl text-xs font-bold"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {showMobileNavDrawer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-white/10 p-6 rounded-t-3xl sm:rounded-3xl max-w-md w-full space-y-5 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Grid size={18} className="text-primary" />
                Question Palette
              </h3>
              <button onClick={() => setShowMobileNavDrawer(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase">
              <div className="bg-slate-950 p-2 rounded-xl text-emerald-400 border border-white/5 text-center">
                Answered: {answeredCount}
              </div>
              <div className="bg-slate-950 p-2 rounded-xl text-rose-400 border border-white/5 text-center">
                Unanswered: {unansweredCount}
              </div>
              <div className="bg-slate-950 p-2 rounded-xl text-amber-400 border border-white/5 text-center">
                Review: {reviewCount}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 overflow-y-auto p-1 flex-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const ansObj = answersMap[q.id];
                const isAnswered = ansObj?.selectedAnswer !== "" && ansObj?.selectedAnswer !== undefined;
                const isReview = ansObj?.isMarkedForReview;

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobileNavDrawer(false);
                    }}
                    className={`h-11 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      isCurrent
                        ? "ring-2 ring-primary bg-primary text-white border-white"
                        : isReview
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : isAnswered
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "bg-slate-950 text-slate-400 border-slate-800"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-center shadow-2xl">
            <Send size={40} className="mx-auto text-emerald-400" />
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Confirm Exam Submission
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                আপনি কি পরীক্ষাটি চূড়ান্তভাবে সাবমিট করতে চান?
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 grid grid-cols-3 gap-2 text-xs font-bold">
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Total</span>
                <span className="text-white text-base font-black">{totalQ}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Answered</span>
                <span className="text-emerald-400 text-base font-black">{answeredCount}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] uppercase">Unanswered</span>
                <span className="text-rose-400 text-base font-black">{unansweredCount}</span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Return to Exam
              </button>

              <button
                onClick={() => handleFinalSubmit(false)}
                disabled={submitting}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Evaluating..." : "Yes, Submit"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
