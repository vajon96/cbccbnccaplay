import { useState, FormEvent } from "react";
import { 
  ArrowLeft, Save, Plus, Trash2, 
  HelpCircle, Settings2, Shuffle, Shield, AlertCircle 
} from "lucide-react";
import { createExam, updateExam } from "../../services/examService";
import { ExamModel, ExamStatus, RandomQuestionRule } from "../../types";
import { QuestionSelectorModal } from "./QuestionSelectorModal";

interface CreateExamFormProps {
  editExam?: ExamModel | null;
  onSuccess: () => void;
  onCancel: () => void;
  actorId?: string;
}

export function CreateExamForm({ editExam, onSuccess, onCancel, actorId = "admin" }: CreateExamFormProps) {
  const [title, setTitle] = useState(editExam?.title || "");
  const [description, setDescription] = useState(editExam?.description || "");
  const [instructions, setInstructions] = useState(
    editExam?.instructions || "১. প্রতিটি প্রশ্নের উত্তর সঠিকভাবে প্রদান করুন।\n২. নির্ধারিত সময়ের পর পরীক্ষা স্বয়ংক্রিয়ভাবে সাবমিট হবে।\n৩. ট্যাব পরিবর্তন বা পেজ রিফ্রেশ করবেন না।"
  );

  const [durationMinutes, setDurationMinutes] = useState(editExam?.durationMinutes || 30);
  const [passMarks, setPassMarks] = useState(editExam?.passMarks || 10);
  const [maxAttempts, setMaxAttempts] = useState(editExam?.maxAttempts || 1);

  const [selectionMode, setSelectionMode] = useState<"manual" | "random">(editExam?.questionSelectionMode || "manual");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(editExam?.selectedQuestionIds || []);
  const [showQuestionModal, setShowQuestionModal] = useState(false);

  // Random Rules
  const [randomRules, setRandomRules] = useState<RandomQuestionRule[]>(
    editExam?.randomRules || [
      { subject: "BNCC", count: 10 },
      { subject: "বাংলা", count: 5 },
      { subject: "English", count: 5 }
    ]
  );

  // Toggle options
  const [shuffleQuestions, setShuffleQuestions] = useState(editExam?.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState(editExam?.shuffleOptions ?? true);
  const [enableNegative, setEnableNegative] = useState(editExam?.negativeMarking?.enabled ?? false);
  const [penaltyPerWrong, setPenaltyPerWrong] = useState(editExam?.negativeMarking?.marksPerWrongAnswer || 0.25);
  const [showResultImmediately, setShowResultImmediately] = useState(editExam?.showResultImmediately ?? true);
  const [allowAnswerReview, setAllowAnswerReview] = useState(editExam?.allowAnswerReview ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addRandomRule = () => {
    setRandomRules([...randomRules, { subject: "সাধারণ বিজ্ঞান", count: 5 }]);
  };

  const removeRandomRule = (index: number) => {
    setRandomRules(randomRules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof RandomQuestionRule, val: any) => {
    const updated = [...randomRules];
    updated[index] = { ...updated[index], [field]: val };
    setRandomRules(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("পরীক্ষার নাম লেখা বাধ্যতামূলক।");
      return;
    }

    if (selectionMode === "manual" && selectedQuestionIds.length === 0) {
      setError("কমপক্ষে একটি প্রশ্ন নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        title,
        description,
        instructions,
        status: editExam?.status || "draft" as ExamStatus,
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes: Number(durationMinutes) || 30,
        totalMarks: selectedQuestionIds.length || 20, // recalculated in service
        passMarks: Number(passMarks) || 8,
        questionSelectionMode: selectionMode,
        selectedQuestionIds,
        randomRules: selectionMode === "random" ? randomRules : [],
        shuffleQuestions,
        shuffleOptions,
        maxAttempts: Number(maxAttempts) || 1,
        negativeMarking: {
          enabled: enableNegative,
          marksPerWrongAnswer: Number(penaltyPerWrong) || 0.25
        },
        showResultImmediately,
        allowAnswerReview,
        allowQuestionNavigation: true,
        autoSubmit: true,
        createdBy: actorId
      };

      if (editExam) {
        await updateExam(editExam.id, payload, actorId);
      } else {
        await createExam(payload);
      }

      onSuccess();
    } catch (err: any) {
      console.error("Error saving exam:", err);
      setError("পরীক্ষা সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-2xl space-y-6 max-w-4xl mx-auto shadow-2xl">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} type="button" className="p-2 rounded-xl bg-slate-800 text-slate-300">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight">
              {editExam ? "Edit Exam Configuration" : "Create New Exam"}
            </h2>
            <p className="text-slate-400 text-xs font-semibold">Set up rules, time limit, pass marks & question rules</p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full uppercase">
          {editExam?.status || "Draft"}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Title & Description */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Exam Title (পরীক্ষার শিরোনাম)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BNCC Cadet Recruitment Written Test - 2026"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Description / বিবরণ</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের লিখিত ও অবজেক্টিভ পরীক্ষা"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Instructions (নির্দেশনাবলী)</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Duration & Marks Config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5">
          
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Duration (সময় - মিনিট)</label>
            <input
              type="number"
              min="5"
              max="180"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Pass Marks (পাশ নম্বর)</label>
            <input
              type="number"
              min="1"
              value={passMarks}
              onChange={(e) => setPassMarks(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Max Attempts Allowed</label>
            <input
              type="number"
              min="1"
              max="10"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>

        </div>

        {/* Question Selection Mode */}
        <div className="space-y-4">
          <label className="block text-xs font-bold text-slate-300 uppercase">Question Selection Mode</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectionMode("manual")}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                selectionMode === "manual"
                  ? "bg-primary/20 border-primary text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}
            >
              <strong className="block text-xs uppercase font-bold text-white mb-1">Manual Selection</strong>
              <span className="text-[11px] text-slate-400">Pick specific questions manually from Question Bank</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectionMode("random")}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                selectionMode === "random"
                  ? "bg-amber-500/20 border-amber-500 text-white"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}
            >
              <strong className="block text-xs uppercase font-bold text-amber-400 mb-1">Randomized Selection</strong>
              <span className="text-[11px] text-slate-400">Randomly assemble unique question set per candidate based on rules</span>
            </button>
          </div>

          {selectionMode === "manual" ? (
            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">
                  Questions Selected: <span className="text-amber-400 font-black">{selectedQuestionIds.length}</span>
                </span>
                <span className="text-[11px] text-slate-400">Manual picker bounds questions to this exam</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionModal(true)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold uppercase transition-all"
              >
                Select Questions
              </button>
            </div>
          ) : (
            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase">Subject-wise Random Pick Rules</span>
                <button
                  type="button"
                  onClick={addRandomRule}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-bold flex items-center gap-1"
                >
                  <Plus size={14} /> Add Rule
                </button>
              </div>

              {randomRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <select
                    value={rule.subject}
                    onChange={(e) => handleRuleChange(idx, "subject", e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                  >
                    <option value="বাংলা">বাংলা</option>
                    <option value="English">English</option>
                    <option value="গণিত">গণিত</option>
                    <option value="সাধারণ বিজ্ঞান">সাধারণ বিজ্ঞান</option>
                    <option value="বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি">বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি</option>
                    <option value="BNCC">BNCC</option>
                    <option value="IQ">IQ</option>
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={rule.count}
                    onChange={(e) => handleRuleChange(idx, "count", Number(e.target.value))}
                    className="w-24 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white"
                    placeholder="Count"
                  />

                  {randomRules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRandomRule(idx)}
                      className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 hover:bg-rose-500/20"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Negative Marking & Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5">
          
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 rounded text-primary"
              />
              Shuffle Questions per candidate
            </label>

            <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="w-4 h-4 rounded text-primary"
              />
              Shuffle MCQ Options per question
            </label>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-xs font-bold text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={enableNegative}
                onChange={(e) => setEnableNegative(e.target.checked)}
                className="w-4 h-4 rounded text-rose-500"
              />
              Enable Negative Marking
            </label>

            {enableNegative && (
              <div className="pl-7">
                <label className="block text-[10px] text-slate-400 mb-1">Deduction per wrong answer</label>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  value={penaltyPerWrong}
                  onChange={(e) => setPenaltyPerWrong(Number(e.target.value))}
                  className="w-32 bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                />
              </div>
            )}
          </div>

        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-xl"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? "Saving..." : editExam ? "Update Exam" : "Save Exam Draft"}
          </button>
        </div>

      </form>

      {/* Modal */}
      <QuestionSelectorModal
        isOpen={showQuestionModal}
        onClose={() => setShowQuestionModal(false)}
        selectedIds={selectedQuestionIds}
        onSelect={(ids) => setSelectedQuestionIds(ids)}
      />

    </div>
  );
}
