import { X, CheckCircle2, HelpCircle, Award, Tag } from "lucide-react";
import { QuestionBankItem } from "../../types";

interface QuestionPreviewModalProps {
  question: QuestionBankItem | null;
  onClose: () => void;
}

export function QuestionPreviewModal({ question, onClose }: QuestionPreviewModalProps) {
  if (!question) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-primary/20 text-primary rounded-full border border-primary/30">
              {question.subject}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
              {question.questionType}
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {question.marks} Mark{question.marks > 1 ? "s" : ""}
            </span>
          </div>

          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg bg-white/5">
            <X size={18} />
          </button>
        </div>

        {/* Question Content */}
        <div className="space-y-4">
          <div className="bg-slate-950 p-4 rounded-xl border border-white/5">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Candidate Question View:</span>
            <h4 className="text-base font-bold text-white leading-relaxed">{question.question}</h4>
          </div>

          {/* Options for MCQ */}
          {question.questionType === "mcq" && question.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {["A", "B", "C", "D"].map((key) => {
                const optText = question.options?.[key as keyof typeof question.options];
                const isCorrectKey = question.correctAnswer === key;
                return (
                  <div
                    key={key}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                      isCorrectKey
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold"
                        : "bg-slate-950 border-slate-800 text-slate-300"
                    }`}
                  >
                    <span>
                      <strong className="text-white mr-2">{key}.</strong> {optText || "N/A"}
                    </span>
                    {isCorrectKey && (
                      <span className="text-[10px] bg-emerald-500 text-white font-black px-2 py-0.5 rounded uppercase">
                        Correct
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* True / False */}
          {question.questionType === "true_false" && (
            <div className="grid grid-cols-2 gap-3">
              {["True", "False"].map((val) => {
                const isCorrect = question.correctAnswer === val;
                return (
                  <div
                    key={val}
                    className={`p-3 rounded-xl border text-center text-xs font-bold ${
                      isCorrect
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    {val} {isCorrect && " (Correct Answer)"}
                  </div>
                );
              })}
            </div>
          )}

          {/* Non MCQ */}
          {question.questionType !== "mcq" && question.questionType !== "true_false" && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-1">
              <span className="text-[10px] font-bold text-emerald-400 uppercase block">Correct Key / Expected Answer:</span>
              <p className="text-xs font-black text-white">
                {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(" / ") : question.correctAnswer}
              </p>
            </div>
          )}

          {/* Explanation if exists */}
          {question.explanation && (
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-white/5 text-xs text-slate-400 space-y-1">
              <span className="font-bold text-amber-400 block text-[11px] uppercase">Explanation / সচিত্র ব্যাখ্যা:</span>
              <p>{question.explanation}</p>
            </div>
          )}

          {/* Tags */}
          {question.tags && question.tags.length > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <Tag size={12} className="text-slate-500" />
              <div className="flex flex-wrap gap-1">
                {question.tags.map((tag, idx) => (
                  <span key={idx} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-white/5">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase rounded-xl transition-all"
          >
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
}
