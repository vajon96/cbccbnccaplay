import { useState, useEffect } from "react";
import { 
  FileText, Search, Filter, RefreshCw, CheckCircle2, AlertCircle, 
  Clock, Award, Eye, Printer, ArrowUpDown, Lock, Unlock, UserCheck, ShieldCheck,
  Trash2, AlertTriangle
} from "lucide-react";
import { fetchAnswerScripts, fetchExams, deleteAttemptById } from "../../services/examService";
import { ExamAttempt, ExamModel, EvaluationStatus } from "../../types";
import { MarksheetViewer } from "./MarksheetViewer";

interface AnswerScriptsListProps {
  onSelectAttempt: (attemptId: string) => void;
  onViewResult?: (attemptId: string) => void;
}

export function AnswerScriptsList({ onSelectAttempt, onViewResult }: AnswerScriptsListProps) {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [loading, setLoading] = useState(true);

  // Read-only Marksheet Viewer State
  const [viewingMarksheetAttemptId, setViewingMarksheetAttemptId] = useState<string | null>(null);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState<string>("ALL");
  const [evaluationStatusFilter, setEvaluationStatusFilter] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("latest");

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<ExamAttempt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [scriptData, examData] = await Promise.all([
        fetchAnswerScripts({
          examId: selectedExamId,
          search: searchQuery,
          evaluationStatus: evaluationStatusFilter,
          sortBy,
          timeFilter,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }),
        fetchExams()
      ]);
      setAttempts(scriptData);
      setExams(examData);
    } catch (err) {
      console.error("Error loading answer scripts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedExamId, evaluationStatusFilter, sortBy, timeFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setActionMessage(null);
    try {
      await deleteAttemptById(deleteTarget.id, "admin", "Exam Admin");
      setActionMessage({ type: "success", text: "উত্তরের খাতাটি সফলভাবে মুছে ফেলা হয়েছে।" });
      setDeleteTarget(null);
      await loadData();
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "উত্তরপত্র মুছতে সমস্যা হয়েছে।" });
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status?: EvaluationStatus) => {
    switch (status) {
      case "finalized":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Lock size={12} /> Finalized
          </span>
        );
      case "fully_evaluated":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <CheckCircle2 size={12} /> Evaluated
          </span>
        );
      case "partially_evaluated":
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock size={12} /> In Progress
          </span>
        );
      case "reopened":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Unlock size={12} /> Reopened
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            <AlertCircle size={12} /> Pending Evaluation
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Banner */}
      <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-amber-400 text-xs font-black uppercase tracking-widest mb-1">
            <FileText size={18} />
            Answer Script Evaluation System
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            খাতা মূল্যায়ন ও ম্যানুয়াল মার্কিং
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Review candidate answer scripts, manually grade written questions, correct answer keys, and finalize marks.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh List
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, ID, Roll..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white outline-none focus:border-amber-500 transition-colors"
            />
          </form>

          {/* Filter Exam */}
          <div>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="ALL">All Exams (সকল পরীক্ষা)</option>
              {exams.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          {/* Filter Evaluation Status */}
          <div>
            <select
              value={evaluationStatusFilter}
              onChange={(e) => setEvaluationStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="ALL">All Evaluation Status</option>
              <option value="pending">Pending Evaluation</option>
              <option value="in_progress">In Progress</option>
              <option value="partially_evaluated">Partially Evaluated</option>
              <option value="fully_evaluated">Fully Evaluated</option>
              <option value="finalized">Finalized (Locked)</option>
              <option value="reopened">Reopened</option>
            </select>
          </div>

          {/* Submission Time Filter */}
          <div>
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                if (e.target.value !== "CUSTOM") {
                  setStartDate("");
                  setEndDate("");
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="ALL">All Submission Time (সকল সময়)</option>
              <option value="TODAY">Submitted Today (আজকের জমা)</option>
              <option value="YESTERDAY">Submitted Yesterday (গতকালের জমা)</option>
              <option value="THIS_WEEK">Submitted Last 7 Days (গত ৭ দিন)</option>
              <option value="CUSTOM">Custom Date Range (নির্দিষ্ট সময়)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="latest">Latest Submissions</option>
              <option value="highest_score">Highest Score</option>
              <option value="lowest_score">Lowest Score</option>
              <option value="oldest">Oldest First</option>
              <option value="candidate_name">Candidate Name</option>
              <option value="roll_number">Roll Number</option>
            </select>
          </div>

        </div>

        {/* Custom Date Range Picker */}
        {timeFilter === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-amber-400" />
              <span className="font-bold text-amber-400">Select Submission Date/Time Range:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg text-[11px] transition-colors"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
      </div>

      {/* Answer Scripts Table */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4">#</th>
                <th className="py-4 px-4">Candidate Information</th>
                <th className="py-4 px-4">Exam Title</th>
                <th className="py-4 px-4 text-center">Submission Info</th>
                <th className="py-4 px-4 text-center">Auto / Manual Marks</th>
                <th className="py-4 px-4 text-center">Final Score</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-amber-400" />
                    Loading candidate answer scripts...
                  </td>
                </tr>
              ) : attempts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-500">
                    <FileText size={36} className="mx-auto mb-3 text-slate-600" />
                    কোনো উত্তরপত্র (Answer Script) পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                attempts.map((att, idx) => {
                  const qCount = att.questionSnapshot?.length || 0;
                  const manualCount = att.manualEvaluations ? Object.keys(att.manualEvaluations).length : 0;
                  const evalPercent = qCount > 0 ? Math.round((manualCount / qCount) * 100) : 0;

                  return (
                    <tr key={att.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 font-bold text-slate-500">{idx + 1}</td>
                      
                      {/* Candidate */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-amber-400 overflow-hidden shrink-0">
                            {att.candidatePhoto ? (
                              <img src={att.candidatePhoto} alt={att.candidateName} className="w-full h-full object-cover" />
                            ) : (
                              att.candidateName ? att.candidateName.substring(0, 2).toUpperCase() : "C"
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-white block">{att.candidateName || "Candidate"}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span>Roll: <strong className="text-amber-400">{att.registrationNumber || "N/A"}</strong></span>
                              <span>•</span>
                              <span>ID: {att.userId}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Exam */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-slate-200 block truncate max-w-xs">{att.examTitle || "BNCC Exam"}</span>
                        <span className="text-[10px] text-slate-400">Attempt ID: {att.id.substring(0, 8)}...</span>
                      </td>

                      {/* Submission Date & Time */}
                      <td className="py-4 px-4 text-center">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border inline-block ${
                          att.status === "auto_submitted"
                            ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                            : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                        }`}>
                          {att.status === "auto_submitted" ? "Auto Submitted" : "Submitted"}
                        </span>
                        {att.submittedAt ? (
                          <div className="mt-1 text-[10px] text-slate-300 font-medium space-y-0.5">
                            <span className="block text-slate-200 font-bold">
                              {new Date(att.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            <span className="flex items-center justify-center gap-1 text-amber-400 font-mono">
                              <Clock size={11} />
                              {new Date(att.submittedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 block mt-1">N/A</span>
                        )}
                      </td>

                      {/* Auto / Manual */}
                      <td className="py-4 px-4 text-center">
                        <div className="text-[11px] font-semibold">
                          <span className="text-blue-400">Auto: {att.autoScore ?? att.score ?? 0}</span>
                          <span className="mx-1 text-slate-600">|</span>
                          <span className="text-amber-400">Manual: {att.manualMarks ?? 0}</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-24 bg-slate-800 rounded-full h-1.5 mx-auto mt-1.5 overflow-hidden border border-slate-700">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, evalPercent)}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{manualCount}/{qCount} Evaluated ({evalPercent}%)</span>
                      </td>

                      {/* Final Score */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-black text-white block">
                          {att.finalScore ?? att.score ?? 0}
                          <span className="text-slate-500 text-xs font-normal"> / {att.markingSummary?.totalMarks || 100}</span>
                        </span>
                        <span className={`text-[10px] font-bold ${att.isPassed ? "text-emerald-400" : "text-rose-400"}`}>
                          {att.isPassed ? "PASSED" : "FAILED"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {getStatusBadge(att.evaluationStatus)}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* View Marksheet (Read-Only) Button */}
                          <button
                            onClick={() => setViewingMarksheetAttemptId(att.id)}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                            title="View Complete Read-Only Marksheet / Answer Script"
                          >
                            <FileText size={14} className="text-blue-400" />
                            View Marksheet
                          </button>

                          {/* Existing Marking / Evaluate Button */}
                          <button
                            onClick={() => onSelectAttempt(att.id)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                            title="Evaluate / Manual Marking"
                          >
                            <Eye size={14} />
                            {att.evaluationStatus === "finalized" ? "Evaluate / Recheck" : "Evaluate"}
                          </button>

                          {onViewResult && (
                            <button
                              onClick={() => onViewResult(att.id)}
                              title="View Candidate Result"
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
                            >
                              <Award size={15} />
                            </button>
                          )}

                          {/* Delete Script Button */}
                          <button
                            onClick={() => setDeleteTarget(att)}
                            title="Delete Answer Script"
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
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

      {/* Action Message Alert */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between ${
          actionMessage.type === "success" 
            ? "bg-emerald-950/80 text-emerald-200 border-emerald-500/40" 
            : "bg-rose-950/80 text-rose-200 border-rose-500/40"
        }`}>
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/40 max-w-md w-full p-6 rounded-3xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Confirm Script Deletion</h3>
                <p className="text-xs text-rose-300/80 font-medium">Permanently delete answer script</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <p><strong>Candidate:</strong> {deleteTarget.candidateName} (Roll/Reg: {deleteTarget.registrationNumber || "N/A"})</p>
              <p><strong>Exam:</strong> {deleteTarget.examTitle || "N/A"}</p>
              <p><strong>Attempt ID:</strong> {deleteTarget.id}</p>
              <p className="text-rose-400 text-[11px] font-bold mt-2 pt-2 border-t border-slate-800">
                ⚠️ Warning: This action cannot be undone. All evaluation marks, feedback, and leaderboard entries for this script will be permanently erased.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Read-Only Marksheet Viewer Modal */}
      {viewingMarksheetAttemptId && (
        <MarksheetViewer
          attemptId={viewingMarksheetAttemptId}
          onClose={() => setViewingMarksheetAttemptId(null)}
          isCandidateView={false}
        />
      )}

    </div>

  );
}
