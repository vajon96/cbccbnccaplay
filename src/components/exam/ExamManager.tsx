import { useState, useEffect } from "react";
import { 
  Plus, Award, PlayCircle, StopCircle, Edit3, 
  Trash2, Copy, Eye, CheckCircle2, Clock, AlertCircle, RefreshCw 
} from "lucide-react";
import { fetchExams, publishExam, deleteExam, duplicateExam, updateExam } from "../../services/examService";
import { ExamModel, ExamStatus } from "../../types";
import { CreateExamForm } from "./CreateExamForm";

interface ExamManagerProps {
  actorId?: string;
  onViewResults?: (examId: string) => void;
}

export function ExamManager({ actorId = "admin", onViewResults }: ExamManagerProps) {
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamModel | null>(null);
  const [notification, setNotification] = useState("");

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await fetchExams();
      setExams(data);
    } catch (err) {
      console.error("Error loading exams:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handlePublish = async (id: string) => {
    try {
      await publishExam(id, actorId);
      showNotice("পরীক্ষাটি সফলভাবে Publish করা হয়েছে। পরীক্ষার্থীরা এখন অংশগ্রহণ করতে পারবে।");
      loadExams();
    } catch (err: any) {
      alert("Error publishing exam: " + err.message);
    }
  };

  const handleUnpublish = async (id: string) => {
    try {
      await updateExam(id, { status: "draft" }, actorId);
      showNotice("পরীক্ষাটি Draft অবস্থায় নেওয়া হয়েছে।");
      loadExams();
    } catch (err: any) {
      alert("Error unpublishing exam: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই পরীক্ষাটি মুছে ফেলতে চান?")) return;
    try {
      await deleteExam(id, actorId);
      showNotice("পরীক্ষাটি মুছে ফেলা হয়েছে।");
      loadExams();
    } catch (err: any) {
      alert("Error deleting exam: " + err.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateExam(id, actorId);
      showNotice("পরীক্ষার কপি তৈরি করা হয়েছে।");
      loadExams();
    } catch (err: any) {
      alert("Error duplicating exam: " + err.message);
    }
  };

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  };

  if (showCreateForm || editingExam) {
    return (
      <CreateExamForm
        editExam={editingExam}
        actorId={actorId}
        onSuccess={() => {
          setShowCreateForm(false);
          setEditingExam(null);
          showNotice("পরীক্ষা সংরক্ষণ করা হয়েছে!");
          loadExams();
        }}
        onCancel={() => {
          setShowCreateForm(false);
          setEditingExam(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Exam Management & Scheduling</h2>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">
            Configure exam sets, schedule time windows, publish live exams & view results
          </p>
        </div>

        <button
          onClick={() => {
            setEditingExam(null);
            setShowCreateForm(true);
          }}
          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          Create New Exam
        </button>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{notification}</span>
        </div>
      )}

      {/* Exam List Table */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4">Exam Title</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-center">Duration</th>
                <th className="py-4 px-4 text-center">Questions</th>
                <th className="py-4 px-4 text-center">Total / Pass Marks</th>
                <th className="py-4 px-4 text-center">Negative Marking</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                    Loading exam configurations...
                  </td>
                </tr>
              ) : exams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Award size={32} className="mx-auto mb-2 text-slate-600" />
                    কোনো পরীক্ষা তৈরি করা হয়নি। "Create New Exam" বাটনে ক্লিক করে প্রথম পরীক্ষা সেটআপ করুন।
                  </td>
                </tr>
              ) : (
                exams.map((e) => {
                  const qCount = e.questionSnapshots?.length || e.selectedQuestionIds?.length || 0;
                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-bold text-white block text-sm">{e.title}</span>
                        {e.description && (
                          <span className="text-[11px] text-slate-400 block truncate max-w-xs">{e.description}</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                          e.status === "published" || e.status === "live"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border-white/5"
                        }`}>
                          {e.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-white">
                        {e.durationMinutes} Mins
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-amber-400">
                        {qCount} Qs
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-white">
                        {e.totalMarks} / <span className="text-emerald-400">{e.passMarks}</span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {e.negativeMarking?.enabled ? (
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2 py-0.5 rounded border border-rose-500/20">
                            -{e.negativeMarking.marksPerWrongAnswer}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Disabled</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {e.status === "published" || e.status === "live" ? (
                            <button
                              onClick={() => handleUnpublish(e.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-all"
                              title="Unpublish (Move to Draft)"
                            >
                              <StopCircle size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePublish(e.id)}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-all"
                              title="Publish Exam Live"
                            >
                              <PlayCircle size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => setEditingExam(e)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-all"
                            title="Edit Exam Setup"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => handleDuplicate(e.id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-purple-400 rounded-lg transition-all"
                            title="Duplicate Exam"
                          >
                            <Copy size={15} />
                          </button>

                          {onViewResults && (
                            <button
                              onClick={() => onViewResults(e.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all"
                              title="View Exam Results"
                            >
                              <Award size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(e.id)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 rounded-lg transition-all"
                            title="Delete Exam"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
