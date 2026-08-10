import { useState, FormEvent } from "react";
import { 
  Plus, CheckCircle, ArrowLeft, Save, 
  HelpCircle, Tag, BookOpen, AlertCircle 
} from "lucide-react";
import { addQuestion, updateQuestion } from "../../services/examService";
import { QuestionBankItem, QuestionType, QuestionDifficulty } from "../../types";

interface AddQuestionFormProps {
  editItem?: QuestionBankItem | null;
  onSuccess: () => void;
  onCancel: () => void;
  actorId?: string;
}

export function AddQuestionForm({ editItem, onSuccess, onCancel, actorId = "admin" }: AddQuestionFormProps) {
  const [subject, setSubject] = useState(editItem?.subject || "বাংলা");
  const [questionType, setQuestionType] = useState<QuestionType>(editItem?.questionType || "mcq");
  const [question, setQuestion] = useState(editItem?.question || "");
  
  // MCQ options
  const [optA, setOptA] = useState(editItem?.options?.A || "");
  const [optB, setOptB] = useState(editItem?.options?.B || "");
  const [optC, setOptC] = useState(editItem?.options?.C || "");
  const [optD, setOptD] = useState(editItem?.options?.D || "");
  const [correctMcq, setCorrectMcq] = useState<string>(typeof editItem?.correctAnswer === "string" ? editItem.correctAnswer : "A");

  // Non-MCQ answer fields
  const [textAnswer, setTextAnswer] = useState<string>(typeof editItem?.correctAnswer === "string" ? editItem.correctAnswer : "");
  const [expectedAnswer, setExpectedAnswer] = useState<string>(editItem?.expectedAnswer || "");

  const [marks, setMarks] = useState<number>(editItem?.marks || 1);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(editItem?.difficulty || "medium");
  const [tagsInput, setTagsInput] = useState<string>(editItem?.tags ? editItem.tags.join(", ") : "");
  const [explanation, setExplanation] = useState<string>(editItem?.explanation || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setError("প্রশ্নের বিবরণ পূরণ করা আবশ্যক।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const parsedTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);

      let optionsObj: { A?: string; B?: string; C?: string; D?: string } | undefined = undefined;
      let finalCorrectAnswer: string | string[] = textAnswer;

      if (questionType === "mcq") {
        if (!optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
          setError("MCQ প্রশ্নের চারটি অপশনই (Option A, B, C, D) দেওয়া বাধ্যতামূলক।");
          setLoading(false);
          return;
        }
        optionsObj = { A: optA, B: optB, C: optC, D: optD };
        finalCorrectAnswer = correctMcq;
      } else if (questionType === "true_false") {
        optionsObj = { A: "True", B: "False" };
        finalCorrectAnswer = textAnswer || "True";
      }

      if (editItem) {
        await updateQuestion(editItem.id, {
          subject,
          questionType,
          question,
          options: optionsObj,
          correctAnswer: finalCorrectAnswer,
          acceptedAnswers: textAnswer ? [textAnswer] : [],
          expectedAnswer: expectedAnswer || textAnswer,
          marks: Number(marks) || 1,
          difficulty,
          tags: parsedTags,
          explanation
        }, actorId);
      } else {
        await addQuestion({
          subject,
          questionType,
          question,
          options: optionsObj,
          correctAnswer: finalCorrectAnswer,
          acceptedAnswers: textAnswer ? [textAnswer] : [],
          expectedAnswer: expectedAnswer || textAnswer,
          marks: Number(marks) || 1,
          difficulty,
          tags: parsedTags,
          explanation,
          isActive: true,
          createdBy: actorId
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error saving question:", err);
      setError("প্রশ্ন সংরক্ষণ করতে সমস্যা হয়েছে: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-2xl space-y-6 max-w-4xl mx-auto shadow-2xl">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            type="button"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">
              {editItem ? "Edit Question" : "Add New Question"}
            </h2>
            <p className="text-slate-400 text-xs font-semibold">
              Question Bank / {editItem ? `Edit ID: ${editItem.id}` : "Create Question"}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
          {questionType.toUpperCase()}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Row 1: Subject, Question Type, Difficulty, Marks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Subject (বিষয়)</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            >
              <option value="বাংলা">বাংলা</option>
              <option value="English">English</option>
              <option value="গণিত">গণিত</option>
              <option value="সাধারণ বিজ্ঞান">সাধারণ বিজ্ঞান</option>
              <option value="বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি">বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি</option>
              <option value="BNCC">BNCC</option>
              <option value="IQ">IQ / Mental Ability</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Question Type (ধরন)</label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            >
              <option value="mcq">MCQ (বহুনির্বাচনী)</option>
              <option value="fill_gaps">Fill in the Gaps (শূন্যস্থান পূরণ)</option>
              <option value="tag_question">Tag Question</option>
              <option value="changing_sentence">Changing Sentence</option>
              <option value="short_question">Short Question (সংক্ষিপ্ত প্রশ্ন)</option>
              <option value="true_false">True / False (সত্য/মিথ্যা)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Difficulty (মান)</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            >
              <option value="easy">Easy (সহজ)</option>
              <option value="medium">Medium (মাঝারি)</option>
              <option value="hard">Hard (কঠিন)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Marks (নম্বর)</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={marks}
              onChange={(e) => setMarks(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
              required
            />
          </div>

        </div>

        {/* Question Text */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
            Question Statement (প্রশ্নাবলি)
          </label>
          <textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="এখানে প্রশ্ন লিখুন (e.g. অগ্নিবীণার রচয়িতা কে?)"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            required
          />
        </div>

        {/* Dynamic Fields Based on Question Type */}
        {questionType === "mcq" && (
          <div className="space-y-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5">
            <span className="text-xs font-black uppercase text-amber-400 block tracking-wider">
              MCQ Options & Correct Answer
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Option A</label>
                <input
                  type="text"
                  value={optA}
                  onChange={(e) => setOptA(e.target.value)}
                  placeholder="অপশন A"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Option B</label>
                <input
                  type="text"
                  value={optB}
                  onChange={(e) => setOptB(e.target.value)}
                  placeholder="অপশন B"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Option C</label>
                <input
                  type="text"
                  value={optC}
                  onChange={(e) => setOptC(e.target.value)}
                  placeholder="অপশন C"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Option D</label>
                <input
                  type="text"
                  value={optD}
                  onChange={(e) => setOptD(e.target.value)}
                  placeholder="অপশন D"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                Correct Answer (সঠিক উত্তর নির্বাচন করুন)
              </label>
              <div className="grid grid-cols-4 gap-3">
                {["A", "B", "C", "D"].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCorrectMcq(opt)}
                    className={`py-2.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                      correctMcq === opt
                        ? "bg-emerald-500 text-white border-emerald-400 shadow-lg"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    Option {opt}
                  </button>
                ))}
              </div>
            </div>

          </div>
        )}

        {questionType === "true_false" && (
          <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 space-y-3">
            <label className="block text-xs font-bold text-slate-300 uppercase">Correct True/False Answer</label>
            <div className="grid grid-cols-2 gap-4">
              {["True", "False"].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTextAnswer(val)}
                  className={`py-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer border ${
                    (textAnswer || "True") === val
                      ? "bg-emerald-500 text-white border-emerald-400"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {val === "True" ? "True (সত্য)" : "False (মিথ্যা)"}
                </button>
              ))}
            </div>
          </div>
        )}

        {(questionType === "fill_gaps" || questionType === "tag_question" || questionType === "changing_sentence" || questionType === "short_question") && (
          <div className="bg-slate-950/50 p-5 rounded-2xl border border-white/5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                Expected Answer (সঠিক বা প্রত্যাশিত উত্তর)
              </label>
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="উত্তর এখানে লিখুন (e.g. shall we / to / কাজী নজরুল ইসলাম)"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                required
              />
            </div>

            {questionType === "short_question" && (
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-2">
                  Reference Answer Details (মূল্যায়ন সহায়িকা - Optional)
                </label>
                <textarea
                  rows={2}
                  value={expectedAnswer}
                  onChange={(e) => setExpectedAnswer(e.target.value)}
                  placeholder="উত্তর মেলানোর সংক্ষেপ ব্যাখ্যা"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Tags & Explanation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Tags (কমা দিয়ে আলাদা করুন)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. grammar, bncc, admission"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Explanation (ব্যাখ্যা - Optional)</label>
            <input
              type="text"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="পরীক্ষার্থীর উত্তর পর্যালোচনায় প্রদর্শিত ব্যাখ্যা"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? "Saving..." : editItem ? "Update Question" : "Save Question"}
          </button>
        </div>

      </form>

    </div>
  );
}
