import { useState, useEffect } from "react";
import { 
  Award, Search, Download, CheckCircle, XCircle, 
  Clock, FileSpreadsheet, RefreshCw, User, FileText
} from "lucide-react";
import * as XLSX from "xlsx";
import { fetchAllExamResults, fetchExams } from "../../services/examService";
import { ExamResult, ExamModel } from "../../types";
import { MarksheetViewer } from "./MarksheetViewer";

interface ResultsTableProps {
  initialExamId?: string;
}

export function ResultsTable({ initialExamId }: ResultsTableProps) {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingMarksheetAttemptId, setViewingMarksheetAttemptId] = useState<string | null>(null);

  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || "ALL");
  const [search, setSearch] = useState("");
  const [passFilter, setPassFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, eData] = await Promise.all([
        fetchAllExamResults(selectedExamId),
        fetchExams()
      ]);
      setResults(rData);
      setExams(eData);
    } catch (err) {
      console.error("Error loading exam results:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedExamId]);

  const filtered = results.filter(r => {
    if (passFilter === "PASSED" && !r.isPassed) return false;
    if (passFilter === "FAILED" && r.isPassed) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        r.candidateName.toLowerCase().includes(s) ||
        r.registrationNumber.toLowerCase().includes(s) ||
        r.userId.toLowerCase().includes(s) ||
        r.examTitle.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const exportToExcel = () => {
    const exportData = filtered.map((r, idx) => ({
      "SL": idx + 1,
      "Exam Title": r.examTitle,
      "Registration No": r.registrationNumber,
      "Candidate Name": r.candidateName,
      "User ID": r.userId,
      "Score": r.score,
      "Total Marks": r.totalMarks,
      "Percentage (%)": `${r.percentage}%`,
      "Correct Answers": r.correctCount,
      "Wrong Answers": r.wrongCount,
      "Unanswered": r.unansweredCount,
      "Result": r.isPassed ? "PASSED" : "FAILED",
      "Submitted At": new Date(r.submittedAt).toLocaleString("bn-BD")
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Exam_Results");
    XLSX.writeFile(workbook, `BNCC_Exam_Results_${selectedExamId}_${Date.now()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Candidate Results & Marks Sheet</h2>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">
            View detailed scores, pass/fail status, and export marks sheets to Excel
          </p>
        </div>

        <button
          onClick={exportToExcel}
          disabled={filtered.length === 0}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet size={16} />
          Export to Excel ({filtered.length})
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
        
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, reg no..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white outline-none focus:border-primary"
          />
        </div>

        <div>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Exams (সকল পরীক্ষা)</option>
            {exams.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={passFilter}
            onChange={(e) => setPassFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-primary"
          >
            <option value="ALL">All Status (সকল ফলাফল)</option>
            <option value="PASSED">Passed Only (উত্তীর্ণ)</option>
            <option value="FAILED">Failed Only (অনুত্তীর্ণ)</option>
          </select>
        </div>

      </div>

      {/* Results Table */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4">#</th>
                <th className="py-4 px-4">Candidate</th>
                <th className="py-4 px-4">Registration No</th>
                <th className="py-4 px-4">Exam Title</th>
                <th className="py-4 px-4 text-center">Score / Total</th>
                <th className="py-4 px-4 text-center">% Percentage</th>
                <th className="py-4 px-4 text-center">Correct / Wrong</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                    Loading exam results...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <Award size={32} className="mx-auto mb-2 text-slate-600" />
                    কোনো পরীক্ষার ফলাফল পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-500">{idx + 1}</td>
                    
                    <td className="py-4 px-4">
                      <span className="font-bold text-white block">{r.candidateName}</span>
                      <span className="text-[10px] text-slate-400">ID: {r.userId}</span>
                    </td>

                    <td className="py-4 px-4 font-mono font-bold text-amber-400">
                      {r.registrationNumber || "N/A"}
                    </td>

                    <td className="py-4 px-4 font-semibold text-slate-200 truncate max-w-xs">
                      {r.examTitle}
                    </td>

                    <td className="py-4 px-4 text-center font-black text-white">
                      {r.score} / <span className="text-slate-400">{r.totalMarks}</span>
                    </td>

                    <td className="py-4 px-4 text-center font-bold text-white">
                      {r.percentage}%
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className="text-emerald-400 font-bold">{r.correctCount}</span> / <span className="text-rose-400 font-bold">{r.wrongCount}</span>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                        r.isPassed
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      }`}>
                        {r.isPassed ? "PASSED" : "FAILED"}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => setViewingMarksheetAttemptId(r.attemptId)}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                        title="View Complete Read-Only Marksheet"
                      >
                        <FileText size={13} />
                        View Marksheet
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
