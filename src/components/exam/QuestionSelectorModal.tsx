import { useState, useEffect } from "react";
import { Search, X, Check, FileQuestion, Plus } from "lucide-react";
import { fetchQuestions } from "../../services/examService";
import { QuestionBankItem } from "../../types";

interface QuestionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
}

export function QuestionSelectorModal({ isOpen, onClose, selectedIds, onSelect }: QuestionSelectorModalProps) {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);

  useEffect(() => {
    setLocalSelected(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoading(true);
      const data = await fetchQuestions({ isActiveOnly: true });
      setQuestions(data);
      setLoading(false);
    };
    load();
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    if (localSelected.includes(id)) {
      setLocalSelected(localSelected.filter(i => i !== id));
    } else {
      setLocalSelected([...localSelected, id]);
    }
  };

  const filtered = questions.filter(q => {
    if (subjectFilter !== "ALL" && q.subject !== subjectFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return q.question.toLowerCase().includes(s) || q.subject.toLowerCase().includes(s);
    }
    return true;
  });

  const handleConfirm = () => {
    onSelect(localSelected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Select Exam Questions</h3>
            <p className="text-slate-400 text-xs font-semibold">
              Selected: <span className="text-amber-400 font-bold">{localSelected.length}</span> questions
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg bg-white/5">
            <X size={18} />
          </button>
        </div>

        {/* Filter / Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none focus:border-primary"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Subjects</option>
            <option value="বাংলা">বাংলা</option>
            <option value="English">English</option>
            <option value="গণিত">গণিত</option>
            <option value="সাধারণ বিজ্ঞান">সাধারণ বিজ্ঞান</option>
            <option value="বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি">বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি</option>
            <option value="BNCC">BNCC</option>
            <option value="IQ">IQ</option>
          </select>
        </div>

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Loading question bank...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">No questions matched filter</div>
          ) : (
            filtered.map((q) => {
              const isSelected = localSelected.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => toggleSelect(q.id)}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-primary/10 border-primary/40 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? "bg-primary text-white border-primary" : "border-slate-700 bg-slate-900"
                  }`}>
                    {isSelected && <Check size={14} />}
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400 text-[10px] uppercase bg-amber-500/10 px-2 py-0.5 rounded">
                        {q.subject}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">{q.questionType}</span>
                      <span className="text-[10px] text-slate-500 ml-auto">{q.marks} Mark{q.marks > 1 ? "s" : ""}</span>
                    </div>
                    <p className="font-semibold">{q.question}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
          <span className="text-xs text-slate-400">Total selected: <strong className="text-white">{localSelected.length}</strong></span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20"
            >
              Confirm Selection
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
