import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Clock, CheckCircle, AlertTriangle, Bookmark, 
  ChevronLeft, ChevronRight, Send, HelpCircle, Shield, RefreshCw 
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const currentQ = questions[currentIndex];
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Stats for navigator
  const totalQ = questions.length;
  const answeredCount = Object.keys(answersMap).filter(k => answersMap[k].selectedAnswer !== "" && answersMap[k].selectedAnswer !== undefined).length;
  const reviewCount = Object.keys(answersMap).filter(k => answersMap[k].isMarkedForReview).length;
  const unansweredCount = totalQ - answeredCount;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col select-none">
      
      {/* Top Fixed Exam Banner Header */}
      <header className="bg-slate-900 border-b border-white/10 sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-2xl">
        <div>
          <h1 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">{exam.title}</h1>
          <span className="text-[10px] text-amber-400 font-bold block uppercase">
            Candidate: {session?.name || attempt.candidateName} (Reg: {attempt.registrationNumber})
          </span>
        </div>

        {/* Live Timer */}
        <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 shadow-lg transition-colors ${
          timeLeftSeconds < 300
            ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse"
            : "bg-slate-950 border-white/10 text-emerald-400"
        }`}>
          <Clock size={18} />
          <div className="text-right">
            <span className="text-[9px] text-slate-400 font-bold uppercase block leading-none">Time Remaining</span>
            <span className="text-base font-mono font-black">{formatTime(timeLeftSeconds)}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left 3 cols: Active Question Component */}
        <div className="lg:col-span-3 space-y-6 flex flex-col justify-between">
          
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl flex-1">
            
            {/* Question Bar Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
                  Question {currentIndex + 1} of {totalQ}
                </span>
                <span className="text-xs font-bold uppercase text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  {currentQ.subject}
                </span>
              </div>

              <button
                onClick={() => toggleMarkForReview(currentQ.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer ${
                  answersMap[currentQ.id]?.isMarkedForReview
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-black"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                }`}
              >
                <Bookmark size={14} />
                {answersMap[currentQ.id]?.isMarkedForReview ? "Marked for Review" : "Mark for Review"}
              </button>
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase block">
                {currentQ.questionType.replace("_", " ").toUpperCase()} ({currentQ.marks} Mark{currentQ.marks > 1 ? "s" : ""})
              </span>
              <h2 className="text-base sm:text-xl font-bold text-white leading-relaxed">
                {currentQ.question}
              </h2>
            </div>

            {/* Render Options / Input based on Type */}
            <div className="pt-4">
              
              {/* MCQ Options */}
              {currentQ.questionType === "mcq" && currentQ.options && (
                <div className="space-y-3">
                  {["A", "B", "C", "D"].map((key) => {
                    const optText = currentQ.options?.[key as keyof typeof currentQ.options];
                    const selected = answersMap[currentQ.id]?.selectedAnswer === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectAnswer(currentQ.id, key)}
                        className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-between ${
                          selected
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.01]"
                            : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs uppercase ${
                            selected ? "bg-white text-primary" : "bg-slate-800 text-slate-300"
                          }`}>
                            {key}
                          </span>
                          <span>{optText}</span>
                        </div>
                        {selected && <CheckCircle size={18} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* True / False */}
              {currentQ.questionType === "true_false" && (
                <div className="grid grid-cols-2 gap-4">
                  {["True", "False"].map((val) => {
                    const selected = answersMap[currentQ.id]?.selectedAnswer === val;
                    return (
                      <button
                        key={val}
                        onClick={() => handleSelectAnswer(currentQ.id, val)}
                        className={`p-6 rounded-2xl border text-center text-sm font-black uppercase tracking-wider transition-all cursor-pointer ${
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

              {/* Fill in gaps / Tag Question / Changing Sentence / Short Question */}
              {(currentQ.questionType === "fill_gaps" || 
                currentQ.questionType === "tag_question" || 
                currentQ.questionType === "changing_sentence" || 
                currentQ.questionType === "short_question") && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-300 uppercase">
                    আপনার উত্তর টাইপ করুন (Type Your Answer):
                  </label>
                  <input
                    type="text"
                    value={(answersMap[currentQ.id]?.selectedAnswer as string) || ""}
                    onChange={(e) => handleSelectAnswer(currentQ.id, e.target.value)}
                    placeholder="এখানে উত্তর লিখুন..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-primary font-medium"
                  />
                </div>
              )}

            </div>

          </div>

          {/* Nav Buttons Footer */}
          <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
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

        {/* Right 1 col: Question Palette Navigator */}
        <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl h-fit">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Question Navigator</h3>
            <p className="text-[10px] text-slate-400 font-semibold">Click any number to jump directly</p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase">
            <div className="bg-slate-950 p-2 rounded-xl text-emerald-400 border border-white/5">
              Answered: {answeredCount}
            </div>
            <div className="bg-slate-950 p-2 rounded-xl text-rose-400 border border-white/5">
              Unanswered: {unansweredCount}
            </div>
            <div className="bg-slate-950 p-2 rounded-xl text-amber-400 border border-white/5 col-span-2">
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
                  key={q.id}
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

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl max-w-md w-full space-y-6 text-center shadow-2xl">
            <Send size={40} className="mx-auto text-emerald-400" />
            
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">
                Confirm Exam Submission
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                আপনি কি পরীক্ষাটি সাবমিট করার জন্য নিশ্চিত?
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
