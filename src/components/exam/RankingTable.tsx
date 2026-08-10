import { useState, useEffect } from "react";
import { 
  Trophy, Medal, Award, Search, Download, 
  FileSpreadsheet, RefreshCw 
} from "lucide-react";
import * as XLSX from "xlsx";
import { generateRankings, fetchExams } from "../../services/examService";
import { ExamResult, ExamModel } from "../../types";

export function RankingTable() {
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [rankings, setRankings] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadExams = async () => {
      const eData = await fetchExams();
      setExams(eData);
      if (eData.length > 0) {
        setSelectedExamId(eData[0].id);
      }
    };
    loadExams();
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    const loadRankings = async () => {
      setLoading(true);
      const data = await generateRankings(selectedExamId);
      setRankings(data);
      setLoading(false);
    };
    loadRankings();
  }, [selectedExamId]);

  const exportMeritList = () => {
    const exportData = rankings.map((r) => ({
      "Merit Rank": r.rank,
      "Registration No": r.registrationNumber,
      "Candidate Name": r.candidateName,
      "Score": r.score,
      "Total Marks": r.totalMarks,
      "Percentage": `${r.percentage}%`,
      "Completion Time (Sec)": r.timeTakenSeconds || 0,
      "Status": r.isPassed ? "PASSED" : "FAILED"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Merit_List");
    XLSX.writeFile(workbook, `BNCC_Exam_Merit_List_${selectedExamId}.xlsx`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Trophy className="text-amber-400" size={24} />
            Exam Leaderboard & Merit List
          </h2>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">
            Auto-ranked candidate merit positions based on score and completion time tie-breaker
          </p>
        </div>

        <button
          onClick={exportMeritList}
          disabled={rankings.length === 0}
          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 self-start sm:self-auto cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet size={16} />
          Export Merit List ({rankings.length})
        </button>
      </div>

      {/* Exam Selector */}
      <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl">
        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Select Exam for Leaderboard</label>
        <select
          value={selectedExamId}
          onChange={(e) => setSelectedExamId(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
        >
          {exams.map(e => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
      </div>

      {/* Ranking List */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-4 px-4 text-center">Rank</th>
                <th className="py-4 px-4">Candidate Name</th>
                <th className="py-4 px-4">Registration No</th>
                <th className="py-4 px-4 text-center">Score</th>
                <th className="py-4 px-4 text-center">Percentage</th>
                <th className="py-4 px-4 text-center">Time Taken</th>
                <th className="py-4 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-400" />
                    Generating merit list rankings...
                  </td>
                </tr>
              ) : rankings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Trophy size={32} className="mx-auto mb-2 text-slate-600" />
                    এই পরীক্ষার কোনো মেধা তালিকা তথ্য এখনও তৈরি হয়নি।
                  </td>
                </tr>
              ) : (
                rankings.map((r) => {
                  const isTop3 = (r.rank || 0) <= 3;
                  return (
                    <tr 
                      key={r.id} 
                      className={`hover:bg-white/[0.02] transition-colors ${
                        r.rank === 1 ? "bg-amber-500/5" :
                        r.rank === 2 ? "bg-slate-400/5" :
                        r.rank === 3 ? "bg-orange-500/5" : ""
                      }`}
                    >
                      <td className="py-4 px-4 text-center">
                        {r.rank === 1 && (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-black text-sm shadow-md">
                            1
                          </span>
                        )}
                        {r.rank === 2 && (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300 text-slate-950 font-black text-sm shadow-md">
                            2
                          </span>
                        )}
                        {r.rank === 3 && (
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700 text-white font-black text-sm shadow-md">
                            3
                          </span>
                        )}
                        {r.rank && r.rank > 3 && (
                          <span className="font-bold text-slate-400">#{r.rank}</span>
                        )}
                      </td>

                      <td className="py-4 px-4 font-bold text-white">
                        {r.candidateName}
                      </td>

                      <td className="py-4 px-4 font-mono font-bold text-amber-400">
                        {r.registrationNumber || "N/A"}
                      </td>

                      <td className="py-4 px-4 text-center font-black text-emerald-400 text-sm">
                        {r.score} <span className="text-xs text-slate-500 font-normal">/ {r.totalMarks}</span>
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-white">
                        {r.percentage}%
                      </td>

                      <td className="py-4 px-4 text-center font-mono text-slate-400">
                        {r.timeTakenSeconds ? `${Math.floor(r.timeTakenSeconds / 60)}m ${r.timeTakenSeconds % 60}s` : "N/A"}
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
