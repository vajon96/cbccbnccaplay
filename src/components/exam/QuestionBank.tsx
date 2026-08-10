import { useState, useEffect } from "react";
import { 
  Plus, Search, Filter, Edit3, Trash2, Copy, 
  Eye, FileSpreadsheet, RefreshCw, CheckCircle, AlertCircle 
} from "lucide-react";
import { 
  fetchQuestions, deleteQuestion, duplicateQuestion, 
  seedDefaultQuestionsIfEmpty 
} from "../../services/examService";
import { QuestionBankItem } from "../../types";
import { AddQuestionForm } from "./AddQuestionForm";
import { ImportQuestionsModal } from "./ImportQuestionsModal";
import { QuestionPreviewModal } from "./QuestionPreviewModal";

interface QuestionBankProps {
  actorId?: string;
}

export function QuestionBank({ actorId = "admin" }: QuestionBankProps) {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");

  // Sub-views / Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<QuestionBankItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [previewItem, setPreviewItem] = useState<QuestionBankItem | null>(null);

  const [notification, setNotification] = useState("");

  const loadQuestions = async () => {
    setLoading(true);
    try {
      await seedDefaultQuestionsIfEmpty(actorId);
      const data = await fetchQuestions({
        search,
        subject: subjectFilter,
        questionType: typeFilter,
        difficulty: difficultyFilter,
        isActiveOnly: true
      });
      setQuestions(data);
    } catch (err) {
      console.error("Error loading question bank:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [search, subjectFilter, typeFilter, difficultyFilter]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই প্রশ্নটি মুছে ফেলতে চান?")) return;
    try {
      await deleteQuestion(id, actorId, true);
      showNotice("প্রশ্নটি সফলভাবে মুছে ফেলা হয়েছে।");
      loadQuestions();
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateQuestion(id, actorId);
      showNotice("প্রশ্নটির কপি তৈরি করা হয়েছে।");
      loadQuestions();
    } catch (err) {
      console.error("Error duplicating question:", err);
    }
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  if (showAddForm || editingItem) {
    return (
      <AddQuestionForm
        editItem={editingItem}
        actorId={actorId}
        onSuccess={() => {
          setShowAddForm(false);
          setEditingItem(null);
          showNotice("প্রশ্ন সফলভাবে সংরক্ষণ করা হয়েছে!");
          loadQuestions();
        }}
        onCancel={() => {
          setShowAddForm(false);
          setEditingItem(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Question Bank Repository</h2>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">
            Create, manage, categorize, import and preview exam questions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            Import Questions
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setShowAddForm(true);
            }}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            Add New Question
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or tags..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white outline-none focus:border-primary"
          />
        </div>

        <div>
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Subjects (সকল বিষয়)</option>
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Question Types (সকল ধরন)</option>
            <option value="mcq">MCQ (বহুনির্বাচনী)</option>
            <option value="fill_gaps">Fill in the Gaps (শূন্যস্থান)</option>
            <option value="tag_question">Tag Question</option>
            <option value="changing_sentence">Changing Sentence</option>
            <option value="short_question">Short Question (সংক্ষিপ্ত)</option>
            <option value="true_false">True / False (সত্য/মিথ্যা)</option>
          </select>
        </div>

        <div>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Difficulties (সকল মান)</option>
            <option value="easy">Easy (সহজ)</option>
            <option value="medium">Medium (মাঝারি)</option>
            <option value="hard">Hard (কঠিন)</option>
          </select>
        </div>

      </div>

      {/* Questions Data Table */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4">#</th>
                <th className="py-4 px-4">Subject</th>
                <th className="py-4 px-4">Type</th>
                <th className="py-4 px-4">Question Statement</th>
                <th className="py-4 px-4 text-center">Marks</th>
                <th className="py-4 px-4 text-center">Difficulty</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                    Loading question bank items...
                  </td>
                </tr>
              ) : questions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <AlertCircle size={28} className="mx-auto mb-2 text-slate-600" />
                    কোনো প্রশ্ন পাওয়া যায়নি। "Add New Question" অথবা "Import Questions" বাটনে ক্লিক করুন।
                  </td>
                </tr>
              ) : (
                questions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-500">{idx + 1}</td>
                    
                    <td className="py-4 px-4">
                      <span className="font-bold text-white bg-slate-800 px-2.5 py-1 rounded-md border border-white/5 inline-block">
                        {q.subject}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {q.questionType}
                      </span>
                    </td>

                    <td className="py-4 px-4 max-w-xs sm:max-w-md truncate">
                      <span className="text-white font-semibold">{q.question}</span>
                      {q.tags && q.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {q.tags.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[9px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center font-bold text-white">
                      {q.marks}
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        q.difficulty === "easy" ? "bg-emerald-500/10 text-emerald-400" :
                        q.difficulty === "medium" ? "bg-amber-500/10 text-amber-400" :
                        "bg-rose-500/10 text-rose-400"
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewItem(q)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all"
                          title="Preview Question"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => setEditingItem(q)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-all"
                          title="Edit Question"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          onClick={() => handleDuplicate(q.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition-all"
                          title="Duplicate Question"
                        >
                          <Copy size={15} />
                        </button>

                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-all"
                          title="Delete Question"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ImportQuestionsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        actorId={actorId}
        onSuccess={() => {
          showNotice("প্রশ্ন সফলভাবে Import করা হয়েছে!");
          loadQuestions();
        }}
      />

      <QuestionPreviewModal
        question={previewItem}
        onClose={() => setPreviewItem(null)}
      />

    </div>
  );
}
