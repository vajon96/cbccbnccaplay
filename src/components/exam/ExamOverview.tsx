import { useEffect, useState } from "react";
import { 
  FileQuestion, Award, CheckCircle, Clock, 
  Users, BarChart3, TrendingUp, AlertCircle, RefreshCw 
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import { fetchQuestions, fetchExams, fetchAllExamResults } from "../../services/examService";
import { QuestionBankItem, ExamModel, ExamResult } from "../../types";

export function ExamOverview() {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [qData, eData, rData] = await Promise.all([
        fetchQuestions(),
        fetchExams(),
        fetchAllExamResults()
      ]);
      setQuestions(qData);
      setExams(eData);
      setResults(rData);
    } catch (err) {
      console.error("Error loading exam overview data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalQuestions = questions.length;
  const totalExams = exams.length;
  const publishedExams = exams.filter(e => e.status === "published" || e.status === "live").length;
  const liveExams = exams.filter(e => e.status === "live").length;
  const totalSubmissions = results.length;
  const passedCount = results.filter(r => r.isPassed).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

  const avgScore = totalSubmissions > 0 
    ? Math.round(results.reduce((acc, r) => acc + r.percentage, 0) / totalSubmissions)
    : 0;

  // Chart data 1: Subject distribution of questions
  const subjectMap: Record<string, number> = {};
  questions.forEach(q => {
    subjectMap[q.subject] = (subjectMap[q.subject] || 0) + 1;
  });
  const subjectChartData = Object.keys(subjectMap).map(subj => ({
    name: subj,
    count: subjectMap[subj]
  }));

  // Chart data 2: Pass vs Fail pie
  const pieData = [
    { name: "Passed", value: passedCount, color: "#10b981" },
    { name: "Failed", value: totalSubmissions - passedCount, color: "#ef4444" }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
            <BarChart3 className="text-amber-400" size={24} />
            Exam Analytics & System Overview
          </h2>
          <p className="text-slate-400 text-xs font-semibold mt-1">
            Real-time examination metrics, question bank distribution, and candidate performance.
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl border border-white/10 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Stats
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Questions</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FileQuestion size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{totalQuestions}</div>
          <p className="text-[10px] text-slate-500 font-semibold">Active in Question Bank</p>
        </div>

        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Exams</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Award size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{totalExams}</div>
          <p className="text-[10px] text-emerald-400 font-semibold">{publishedExams} Published / Live</p>
        </div>

        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Submissions</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{totalSubmissions}</div>
          <p className="text-[10px] text-slate-500 font-semibold">Submitted attempts</p>
        </div>

        <div className="bg-slate-900 border border-white/10 p-5 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Pass Rate</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{passRate}%</div>
          <p className="text-[10px] text-slate-500 font-semibold">Avg score: {avgScore}%</p>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Subject Breakdown Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <FileQuestion size={16} className="text-primary" />
            Question Bank Subject Distribution
          </h3>
          {subjectChartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">No questions available in Question Bank</div>
          )}
        </div>

        {/* Pass / Fail Distribution */}
        <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-400" />
            Overall Pass / Fail Ratio
          </h3>
          {totalSubmissions > 0 ? (
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "12px", color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">No exam submissions yet</div>
          )}
          <div className="flex justify-center gap-6 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-xs font-bold text-slate-300">Passed ({passedCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
              <span className="text-xs font-bold text-slate-300">Failed ({totalSubmissions - passedCount})</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
