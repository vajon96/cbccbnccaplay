import { useState, useEffect } from "react";
import {
  Plus,
  Award,
  PlayCircle,
  StopCircle,
  Edit3,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Radio,
  CalendarClock,
  Archive,
  CheckSquare,
} from "lucide-react";
import {
  fetchExams,
  publishExam,
  deleteExam,
  duplicateExam,
  updateExam,
} from "../../services/examService";
import { ExamModel, ExamStatus } from "../../types";
import { CreateExamForm } from "./CreateExamForm";

interface ExamManagerProps {
  actorId?: string;
  onViewResults?: (examId: string) => void;
}

const STATUS_META: Record<
  ExamStatus,
  { label: string; bnLabel: string; badgeClass: string }
> = {
  draft: {
    label: "Draft",
    bnLabel: "খসড়া",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-600/40",
  },
  scheduled: {
    label: "Scheduled",
    bnLabel: "সময় নির্ধারিত",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  published: {
    label: "Published",
    bnLabel: "প্রকাশিত",
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  live: {
    label: "Active / Live",
    bnLabel: "চলমান লাইভ",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  completed: {
    label: "Completed",
    bnLabel: "সমাপ্ত",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  archived: {
    label: "Archived",
    bnLabel: "আর্কাইভড",
    badgeClass: "bg-slate-900 text-slate-400 border-slate-700",
  },
};

const ALL_STATUSES: ExamStatus[] = [
  "draft",
  "scheduled",
  "published",
  "live",
  "completed",
  "archived",
];

export function ExamManager({ actorId = "admin", onViewResults }: ExamManagerProps) {
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"ALL" | ExamStatus>("ALL");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamModel | null>(null);
  const [notification, setNotification] = useState("");
  const [errorBanner, setErrorBanner] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadExams = async () => {
    setLoading(true);
    try {
      const data = await fetchExams();
      setExams(data);
    } catch (err) {
      console.error("Error loading exams:", err);
      setErrorBanner("পরীক্ষার তালিকা লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const showNotice = (msg: string) => {
    setErrorBanner("");
    setNotification(msg);
    window.setTimeout(() => setNotification((prev) => (prev === msg ? "" : prev)), 4000);
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    window.setTimeout(() => setErrorBanner((prev) => (prev === msg ? "" : prev)), 5000);
  };

  const handleStatusChange = async (exam: ExamModel, nextStatus: ExamStatus) => {
    setBusyId(exam.id);
    setErrorBanner("");
    try {
      if (nextStatus === "published") {
        await publishExam(exam.id, actorId);
        showNotice(`'${exam.title}' সফলভাবে Published করা হয়েছে।`);
      } else {
        if (nextStatus === "live" && (!exam.questionSnapshots || exam.questionSnapshots.length === 0)) {
          showError("লাইভ করার আগে পরীক্ষায় কমপক্ষে একটি প্রশ্ন সংযুক্ত করুন।");
          return;
        }
        await updateExam(exam.id, { status: nextStatus }, actorId);
        showNotice(`'${exam.title}' এর অবস্থা '${STATUS_META[nextStatus].label}' করা হয়েছে।`);
      }
      await loadExams();
    } catch (err: any) {
      showError("স্ট্যাটাস পরিবর্তন করা যায়নি: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteExam(id, actorId);
      setConfirmDeleteId(null);
      showNotice("পরীক্ষাটি স্থায়ীভাবে মুছে ফেলা হয়েছে।");
      await loadExams();
    } catch (err: any) {
      showError("পরীক্ষা মুছে ফেলা যায়নি: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setBusyId(id);
    try {
      await duplicateExam(id, actorId);
      showNotice("পরীক্ষার কপি তৈরি করা হয়েছে।");
      await loadExams();
    } catch (err: any) {
      showError("কপি তৈরি করা যায়নি: " + (err?.message || "Unknown error"));
    } finally {
      setBusyId(null);
    }
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

  const filteredExams =
    statusFilter === "ALL" ? exams : exams.filter((e) => e.status === statusFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#061830] p-5 sm:p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
            Exam Management &amp; Lifecycle Scheduling
          </h2>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">
            Draft, schedule, publish, activate live exams, mark completed, or archive past exam papers
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingExam(null);
            setShowCreateForm(true);
          }}
          className="px-5 py-2.5 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] text-xs font-black uppercase tracking-wider rounded-xl transition-colors shadow-lg flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus size={16} />
          Create New Exam
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
            statusFilter === "ALL"
              ? "bg-[#C5A059] text-[#00152e] border-[#C5A059]"
              : "bg-[#061830] text-slate-300 border-white/10 hover:bg-white/5"
          }`}
        >
          All ({exams.length})
        </button>
        {ALL_STATUSES.map((st) => {
          const count = exams.filter((e) => e.status === st).length;
          return (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                statusFilter === st
                  ? "bg-[#C5A059] text-[#00152e] border-[#C5A059]"
                  : "bg-[#061830] text-slate-300 border-white/10 hover:bg-white/5"
              }`}
            >
              {STATUS_META[st].label} ({count})
            </button>
          );
        })}
      </div>

      {notification && (
        <div role="status" className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {errorBanner && (
        <div role="alert" className="p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button type="button" onClick={() => setErrorBanner("")} className="underline text-white cursor-pointer">
            Close
          </button>
        </div>
      )}

      {/* Exam List Table */}
      <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#020B18] border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4">Exam Title</th>
                <th className="py-4 px-4 text-center">Lifecycle Status</th>
                <th className="py-4 px-4 text-center">Duration</th>
                <th className="py-4 px-4 text-center">Questions</th>
                <th className="py-4 px-4 text-center">Total / Pass</th>
                <th className="py-4 px-4 text-center">Negative</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#C5A059]" />
                    Loading exam configurations...
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Award size={32} className="mx-auto mb-2 text-slate-600" />
                    নির্বাচিত ফিল্টারে কোনো পরীক্ষা পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredExams.map((e) => {
                  const qCount = e.questionSnapshots?.length || e.selectedQuestionIds?.length || 0;
                  const meta = STATUS_META[e.status] || STATUS_META.draft;
                  const isBusy = busyId === e.id;
                  const isDeletingConfirm = confirmDeleteId === e.id;

                  return (
                    <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-bold text-white block text-sm">{e.title}</span>
                        {e.description && (
                          <span className="text-[11px] text-slate-400 block truncate max-w-xs">
                            {e.description}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex flex-col items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${meta.badgeClass}`}
                          >
                            {meta.label}
                          </span>
                          <select
                            aria-label={`Change status for ${e.title}`}
                            disabled={isBusy}
                            value={e.status}
                            onChange={(ev) => handleStatusChange(e, ev.target.value as ExamStatus)}
                            className="bg-[#020B18] border border-white/15 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-200 outline-none focus:border-[#C5A059] cursor-pointer"
                          >
                            {ALL_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {STATUS_META[st].label} ({STATUS_META[st].bnLabel})
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-white tabular-nums">
                        {e.durationMinutes} Mins
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-amber-400 tabular-nums">
                        {qCount} Qs
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-white tabular-nums">
                        {e.totalMarks} / <span className="text-emerald-400">{e.passMarks}</span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {e.negativeMarking?.enabled ? (
                          <span className="text-[10px] bg-rose-500/15 text-rose-300 font-bold px-2 py-0.5 rounded border border-rose-500/25 tabular-nums">
                            -{e.negativeMarking.marksPerWrongAnswer}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Disabled</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        {isDeletingConfirm ? (
                          <div className="inline-flex items-center gap-1.5 bg-rose-950/70 border border-rose-500/40 rounded-lg p-1">
                            <span className="text-[10px] font-bold text-rose-200 px-1.5">Delete?</span>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(e.id)}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {e.status === "published" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "live")}
                                className="p-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg transition-colors cursor-pointer"
                                title="Activate Live Exam"
                              >
                                <Radio size={15} />
                              </button>
                            ) : e.status === "live" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "completed")}
                                className="p-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 rounded-lg transition-colors cursor-pointer"
                                title="Mark Completed"
                              >
                                <CheckSquare size={15} />
                              </button>
                            ) : e.status === "completed" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "archived")}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                                title="Archive Exam"
                              >
                                <Archive size={15} />
                              </button>
                            ) : e.status === "scheduled" ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "published")}
                                className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                                title="Publish Exam Now"
                              >
                                <PlayCircle size={15} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "published")}
                                className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-lg transition-colors cursor-pointer"
                                title="Publish Exam"
                              >
                                <PlayCircle size={15} />
                              </button>
                            )}

                            {(e.status === "published" || e.status === "live") && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "draft")}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                                title="Move to Draft"
                              >
                                <StopCircle size={15} />
                              </button>
                            )}

                            {e.status === "draft" && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(e, "scheduled")}
                                className="p-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 rounded-lg transition-colors cursor-pointer"
                                title="Mark Scheduled"
                              >
                                <CalendarClock size={15} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setEditingExam(e)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer"
                              title="Edit Exam Setup"
                            >
                              <Edit3 size={15} />
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDuplicate(e.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded-lg transition-colors cursor-pointer"
                              title="Duplicate Exam"
                            >
                              <Copy size={15} />
                            </button>

                            {onViewResults && (
                              <button
                                type="button"
                                onClick={() => onViewResults(e.id)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg transition-colors cursor-pointer"
                                title="View Exam Results"
                              >
                                <Award size={15} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(e.id)}
                              className="p-1.5 bg-slate-800 hover:bg-rose-600/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="Delete Exam"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
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
