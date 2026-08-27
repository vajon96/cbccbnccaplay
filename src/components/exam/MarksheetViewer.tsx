import { useState, useEffect } from "react";
import { 
  FileText, CheckCircle2, XCircle, AlertTriangle, Clock, 
  Printer, Lock, ShieldCheck, Award, X, Sparkles, 
  Bot, User, Calendar, BookOpen, Check, AlertCircle, RefreshCw
} from "lucide-react";
import { getAttemptById, getExamById, fetchQuestions } from "../../services/examService";
import { ExamAttempt, ExamModel, QuestionBankItem } from "../../types";

interface MarksheetViewerProps {
  attemptId: string;
  onClose: () => void;
  isCandidateView?: boolean;
  currentCandidateId?: string;
  currentCandidateReg?: string;
}

export function MarksheetViewer({
  attemptId,
  onClose,
  isCandidateView = false,
  currentCandidateId,
  currentCandidateReg
}: MarksheetViewerProps) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [exam, setExam] = useState<ExamModel | null>(null);
  const [allQuestionsMap, setAllQuestionsMap] = useState<Map<string, QuestionBankItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadScriptData = async () => {
      setLoading(true);
      setError(null);
      try {
        const attData = await getAttemptById(attemptId);
        if (!attData) {
          if (isMounted) setError("Answer script attempt not found.");
          return;
        }

        // STRICT SECURITY / DATA ISOLATION CHECK FOR CANDIDATES
        if (isCandidateView) {
          const validId = currentCandidateId && (attData.candidateId === currentCandidateId || attData.userId === currentCandidateId);
          const validReg = currentCandidateReg && attData.registrationNumber && attData.registrationNumber.trim().toLowerCase() === currentCandidateReg.trim().toLowerCase();
          
          if (!validId && !validReg) {
            if (isMounted) {
              setError("Unauthorized access: You do not have permission to view another candidate's answer script.");
            }
            return;
          }
        }

        const [examData, questionsList] = await Promise.all([
          getExamById(attData.examId),
          fetchQuestions()
        ]);

        const qMap = new Map<string, QuestionBankItem>();
        // First populate from exam snapshots
        if (examData?.questionSnapshots) {
          examData.questionSnapshots.forEach(q => qMap.set(q.id, q));
        }
        // Enrich with Question Bank data
        questionsList.forEach(q => {
          if (qMap.has(q.id) || attData.questionSnapshot?.some(qs => qs.id === q.id)) {
            qMap.set(q.id, q);
          }
        });

        if (isMounted) {
          setAttempt(attData);
          setExam(examData);
          setAllQuestionsMap(qMap);
        }
      } catch (err: any) {
        console.error("Error loading marksheet:", err);
        if (isMounted) setError(err.message || "Failed to load answer script.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadScriptData();
    return () => {
      isMounted = false;
    };
  }, [attemptId, isCandidateView, currentCandidateId, currentCandidateReg]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4 max-w-sm w-full shadow-2xl">
          <RefreshCw size={36} className="animate-spin text-amber-400 mx-auto" />
          <p className="text-sm font-black text-white">Loading Complete Marksheet...</p>
          <p className="text-xs text-slate-400">Fetching candidate answers, evaluation notes & marks</p>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/30 p-8 rounded-3xl text-center space-y-4 max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
            <AlertTriangle size={28} />
          </div>
          <h3 className="text-base font-black text-white">Access Warning</h3>
          <p className="text-xs text-rose-300/90 leading-relaxed font-medium">{error || "Unable to display marksheet."}</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    );
  }

  // If candidate view and evaluation is still pending/unfinalized without instant review permitted
  const isEvaluationFinalized = attempt.evaluationStatus === "finalized" || attempt.evaluationStatus === "fully_evaluated";
  const allowCandidateReview = exam?.allowAnswerReview ?? true;

  if (isCandidateView && !isEvaluationFinalized && !allowCandidateReview) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-amber-500/30 p-8 rounded-3xl text-center space-y-4 max-w-md w-full shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/40">
            <Clock size={28} />
          </div>
          <h3 className="text-base font-black text-white">Evaluation in Progress</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            আপনার উত্তরপত্রটির চূড়ান্ত মূল্যায়ন বর্তমানে প্রক্রিয়াধীন রয়েছে। মূল্যায়ন চূড়ান্ত হওয়ার পর সম্পূর্ণ উত্তরপত্র ও নম্বর দেখতে পাবেন।
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const questions = attempt.questionSnapshot || [];
  const totalQuestionsCount = questions.length;
  const totalExamMarks = attempt.markingSummary?.totalMarks || exam?.totalMarks || 100;
  const finalObtainedMarks = attempt.finalScore ?? attempt.score ?? 0;
  const finalPercentage = attempt.percentage ?? (totalExamMarks > 0 ? Number(((finalObtainedMarks / totalExamMarks) * 100).toFixed(1)) : 0);
  const isPassed = attempt.isPassed ?? (finalObtainedMarks >= (exam?.passMarks || 40));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md overflow-y-auto flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static">
      
      {/* Main Container Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl my-auto shadow-2xl overflow-hidden flex flex-col print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Top Header Bar (Action buttons) */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {isCandidateView ? "Candidate Answer Script & Marksheet" : "Official Candidate Marksheet (Read-Only)"}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  Read-Only View
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {attempt.examTitle || exam?.title || "BNCC Examination"} • Attempt ID: {attempt.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={14} />
              Print Marksheet
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Close Marksheet Viewer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Official Header */}
        <div className="p-6 sm:p-8 space-y-6 print:p-4 print:text-black">
          
          {/* Institutional Branding / Title Block */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 print:border print:border-black/20 print:bg-slate-50 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 print:border-black/10">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 print:text-slate-800">
                  15 BNCC Battalion • Karnaphuli Regiment • Cox's Bazar City College Platoon
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-white print:text-black">
                  {attempt.examTitle || exam?.title || "Recruitment & Assessment Examination"}
                </h1>
                <p className="text-xs text-slate-400 print:text-slate-700">
                  Official Examination Marksheet & Complete Answer Script Evaluation Report
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex flex-col sm:items-end gap-1">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border inline-flex items-center gap-1.5 ${
                  isPassed
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 print:border-black print:text-black"
                    : "bg-rose-500/20 text-rose-400 border-rose-500/30 print:border-black print:text-black"
                }`}>
                  {isPassed ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                  {isPassed ? "PASSED (উত্তীর্ণ)" : "FAILED (অনুত্তীর্ণ)"}
                </span>
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-medium">
                  Evaluation: <strong className="text-slate-200 print:text-black uppercase">{attempt.evaluationStatus || "Submitted"}</strong>
                </span>
              </div>
            </div>

            {/* Candidate & Examination Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-bold uppercase block">Candidate Name</span>
                <strong className="text-white print:text-black text-sm block font-black">{attempt.candidateName}</strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-bold uppercase block">Roll / Reg Number</span>
                <strong className="text-amber-400 print:text-black font-mono font-bold block">{attempt.registrationNumber || "N/A"}</strong>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-bold uppercase block">Session / College</span>
                <span className="text-slate-200 print:text-black font-medium block">
                  {attempt.session || "2025-2026"} • {attempt.collegeName || "Cox's Bazar City College"}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 print:text-slate-600 font-bold uppercase block">Exam Date & Duration</span>
                <span className="text-slate-200 print:text-black font-medium block">
                  {new Date(attempt.startedAt || attempt.createdAt).toLocaleDateString("bn-BD")} • {exam?.durationMinutes || 60} Mins
                </span>
              </div>
            </div>

            {/* Score Summary Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800 print:border-black/10">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 print:border print:border-black/10 print:bg-white text-center">
                <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold block">Total Questions</span>
                <strong className="text-base font-black text-white print:text-black">{totalQuestionsCount}</strong>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 print:border print:border-black/10 print:bg-white text-center">
                <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold block">Total Marks</span>
                <strong className="text-base font-black text-slate-300 print:text-black">{totalExamMarks}</strong>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-amber-500/30 print:border print:border-black/10 print:bg-white text-center">
                <span className="text-[10px] text-amber-400 print:text-slate-600 uppercase font-bold block">Obtained Marks</span>
                <strong className="text-base font-black text-amber-400 print:text-black">{finalObtainedMarks}</strong>
              </div>

              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 print:border print:border-black/10 print:bg-white text-center">
                <span className="text-[10px] text-slate-400 print:text-slate-600 uppercase font-bold block">Percentage</span>
                <strong className="text-base font-black text-white print:text-black">{finalPercentage}%</strong>
              </div>
            </div>

            {/* Submission Time Info */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 print:text-slate-600 pt-1">
              <span>Started At: <strong className="text-slate-300 print:text-black">{new Date(attempt.startedAt).toLocaleString("en-GB")}</strong></span>
              <span>Submitted At: <strong className="text-slate-300 print:text-black">{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString("en-GB") : "Auto-Submitted on Timeout"}</strong></span>
            </div>

          </div>

          {/* Section Divider */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="text-sm font-black text-white print:text-black uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={16} className="text-amber-400 print:text-black" />
              Complete Question-by-Question Answer Script ({questions.length} Questions)
            </h3>
            <span className="text-xs text-slate-400 print:text-slate-600 font-semibold">
              Original Sequential Order
            </span>
          </div>

          {/* Questions & Candidate Answers List */}
          <div className="space-y-6">
            {questions.map((qItem, index) => {
              const fullQ = allQuestionsMap.get(qItem.id) || qItem;
              const userAnsObj = attempt.answers ? attempt.answers[qItem.id] : undefined;
              const candidateAnswer = userAnsObj?.selectedAnswer;
              const hasAnswered = candidateAnswer !== undefined && candidateAnswer !== null && candidateAnswer !== "";
              
              // Evaluation marks & override details
              const manualEval = attempt.manualEvaluations ? attempt.manualEvaluations[qItem.id] : undefined;
              const maxQMarks = qItem.marks || fullQ.marks || 1;
              const isCorrectObjective = typeof candidateAnswer === "string" && typeof fullQ.correctAnswer === "string" && candidateAnswer.trim().toUpperCase() === fullQ.correctAnswer.trim().toUpperCase();
              const obtainedQMarks = manualEval?.obtainedMarks ?? (isCorrectObjective ? maxQMarks : 0);

              const qType = qItem.questionType || fullQ.questionType || "mcq";
              const isMCQ = qType === "mcq" || qType === "true_false";

              return (
                <div 
                  key={qItem.id || index}
                  className="bg-slate-950 p-6 rounded-2xl border border-slate-800 print:border print:border-black/20 print:bg-white space-y-4"
                >
                  {/* Question Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80 print:border-black/10">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30 print:border-black print:text-black">
                        {index + 1}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700 print:border-black/10 print:text-black">
                        {qItem.subject || fullQ.subject || "General"}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-800 print:hidden">
                        Type: {qType}
                      </span>
                    </div>

                    {/* Marks Pill */}
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${
                        obtainedQMarks > 0 
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 print:text-black print:border-black"
                          : hasAnswered 
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/30 print:text-black print:border-black"
                            : "bg-slate-800 text-slate-400 border-slate-700 print:text-black print:border-black"
                      }`}>
                        Marks: {obtainedQMarks} / {maxQMarks}
                      </span>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm sm:text-base font-bold text-white print:text-black leading-relaxed">
                    {qItem.question || fullQ.question || "Question text unavailable"}
                  </p>

                  {/* Options Display for MCQ / True-False */}
                  {isMCQ && fullQ.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {Array.isArray(fullQ.options) ? (
                        fullQ.options.map((opt: string, optIdx: number) => {
                          const optKey = String.fromCharCode(65 + optIdx);
                          const isSelected = candidateAnswer === optKey || candidateAnswer === opt;
                          const isKey = !isCandidateView && (fullQ.correctAnswer === optKey || fullQ.correctAnswer === opt);

                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                isSelected
                                  ? isCorrectObjective
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 print:bg-slate-100 print:border-black font-bold"
                                    : "bg-rose-500/15 border-rose-500/40 text-rose-200 print:bg-slate-100 print:border-black font-bold"
                                  : isKey
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-300 print:bg-slate-50 print:border-black"
                                    : "bg-slate-900/60 border-slate-800 text-slate-300 print:bg-white print:border-black/10"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center font-black text-[10px] text-slate-300 print:text-black">
                                  {optKey}
                                </span>
                                <span>{opt}</span>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 border border-slate-700 print:border-black text-white print:text-black">
                                  Candidate's Choice
                                </span>
                              )}
                              {!isCandidateView && isKey && !isSelected && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 print:border-black print:text-black">
                                  Correct Key
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        Object.entries(fullQ.options).map(([optKey, optVal]) => {
                          const isSelected = candidateAnswer === optKey || candidateAnswer === optVal;
                          const isKey = !isCandidateView && (fullQ.correctAnswer === optKey || fullQ.correctAnswer === optVal);

                          return (
                            <div
                              key={optKey}
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                                isSelected
                                  ? isCorrectObjective
                                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200 print:bg-slate-100 print:border-black font-bold"
                                    : "bg-rose-500/15 border-rose-500/40 text-rose-200 print:bg-slate-100 print:border-black font-bold"
                                  : isKey
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-300 print:bg-slate-50 print:border-black"
                                    : "bg-slate-900/60 border-slate-800 text-slate-300 print:bg-white print:border-black/10"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center font-black text-[10px] text-slate-300 print:text-black">
                                  {optKey}
                                </span>
                                <span>{String(optVal)}</span>
                              </div>
                              {isSelected && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 border border-slate-700 print:border-black text-white print:text-black">
                                  Candidate's Choice
                                </span>
                              )}
                              {!isCandidateView && isKey && !isSelected && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 print:border-black print:text-black">
                                  Correct Key
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Written / Subjective Answer Display */}
                  {!isMCQ && (
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 print:text-slate-700 uppercase block">
                        Candidate's Submitted Answer:
                      </span>
                      <div className={`p-4 rounded-xl border text-xs font-mono whitespace-pre-wrap ${
                        hasAnswered
                          ? "bg-slate-900 border-slate-700 text-slate-200 print:bg-slate-50 print:border-black/20 print:text-black"
                          : "bg-rose-500/5 border-rose-500/20 text-rose-400 italic"
                      }`}>
                        {hasAnswered ? String(candidateAnswer) : "No answer written (উত্তর প্রদান করা হয়নি)"}
                      </div>

                      {/* Correct / Model Answer (Visible to Admin or when allowed) */}
                      {(!isCandidateView || allowCandidateReview) && fullQ.correctAnswer && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs space-y-1 print:bg-slate-50 print:border-black/10">
                          <span className="text-[10px] font-bold text-blue-400 print:text-black uppercase block">
                            Model / Correct Answer Key:
                          </span>
                          <p className="text-slate-300 print:text-black font-mono">
                            {Array.isArray(fullQ.correctAnswer) ? fullQ.correctAnswer.join(" / ") : String(fullQ.correctAnswer)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Evaluation & Feedback Block */}
                  {(manualEval?.comment || manualEval?.aiJustification || fullQ.explanation) && (
                    <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1.5 print:bg-slate-50 print:border-black/10">
                      {manualEval?.comment && (
                        <div className="flex items-start gap-2 text-amber-300 print:text-black">
                          <span className="text-[10px] font-black uppercase text-amber-400 print:text-black shrink-0">
                            Examiner Note:
                          </span>
                          <span>{manualEval.comment}</span>
                        </div>
                      )}

                      {manualEval?.aiJustification && (
                        <div className="flex items-start gap-2 text-indigo-300 print:text-black">
                          <span className="text-[10px] font-black uppercase text-indigo-400 print:text-black shrink-0 flex items-center gap-1">
                            <Bot size={12} /> AI Evaluation:
                          </span>
                          <span>{manualEval.aiJustification}</span>
                        </div>
                      )}

                      {fullQ.explanation && (
                        <div className="flex items-start gap-2 text-slate-400 print:text-black">
                          <span className="text-[10px] font-black uppercase text-slate-500 print:text-black shrink-0">
                            Explanation:
                          </span>
                          <span>{fullQ.explanation}</span>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* Bottom Examiner Signature Block (for Official Printing) */}
          <div className="hidden print:flex items-end justify-between pt-12 text-xs text-black border-t border-black/20 mt-8">
            <div className="text-center space-y-1">
              <div className="w-48 border-b border-black"></div>
              <p className="font-bold">Candidate Signature</p>
            </div>
            <div className="text-center space-y-1">
              <div className="w-48 border-b border-black"></div>
              <p className="font-bold">Examiner / Evaluator</p>
            </div>
            <div className="text-center space-y-1">
              <div className="w-48 border-b border-black"></div>
              <p className="font-bold">Platoon Commander Seal</p>
            </div>
          </div>

        </div>

        {/* Bottom Footer Bar */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-400">
            Cox's Bazar City College BNCC Platoon Online Examination Portal
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Close Marksheet
          </button>
        </div>

      </div>

    </div>
  );
}
