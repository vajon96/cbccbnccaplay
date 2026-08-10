import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Award, Play, CheckCircle2, Clock, 
  FileText, User, ChevronRight, RefreshCw, AlertCircle 
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getSession } from "../lib/auth";
import { fetchExams, getUserAttempts, getResultByAttemptId } from "../services/examService";
import { ExamModel, ExamAttempt, ExamResult } from "../types";
import { ExamNavbar } from "../components/exam/ExamNavbar";

export function ExamCandidateDashboard() {
  const session = getSession();
  const navigate = useNavigate();

  const [candidateProfile, setCandidateProfile] = useState<any>(null);
  const [exams, setExams] = useState<ExamModel[]>([]);
  const [myAttempts, setMyAttempts] = useState<ExamAttempt[]>([]);
  const [myResultsMap, setMyResultsMap] = useState<Record<string, ExamResult>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      navigate("/exam/login");
      return;
    }

    const loadCandidateData = async () => {
      setLoading(true);
      try {
        // Load candidate doc
        const snap = await getDoc(doc(db, "applicants", session.id));
        if (snap.exists()) {
          setCandidateProfile(snap.data());
        }

        // Load exams
        const eList = await fetchExams("published");
        setExams(eList);

        // Load my attempts
        const attempts = await getUserAttempts(session.id);
        setMyAttempts(attempts);

        // Fetch results for finished attempts
        const resMap: Record<string, ExamResult> = {};
        for (const att of attempts) {
          if (att.status === "submitted" || att.status === "auto_submitted" || att.status === "expired") {
            const res = await getResultByAttemptId(att.id);
            if (res) resMap[att.id] = res;
          }
        }
        setMyResultsMap(resMap);

      } catch (err) {
        console.error("Error loading candidate dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    loadCandidateData();
  }, [session?.id]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar title="Candidate Dashboard" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Profile Card Header */}
        <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-primary overflow-hidden shrink-0 flex items-center justify-center">
              {candidateProfile?.passportPhoto ? (
                <img src={candidateProfile.passportPhoto} alt="Candidate" className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-slate-500" />
              )}
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-block">
                Cadet Applicant
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white">{candidateProfile?.fullName || session.name || session.id}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
                <span>Reg No: <strong className="text-white font-mono">{candidateProfile?.registrationNumber || session.registrationNumber || "N/A"}</strong></span>
                <span>•</span>
                <span>Session: <strong className="text-white">{candidateProfile?.session || "2025-2026"}</strong></span>
                <span>•</span>
                <span>College: <strong className="text-white">{candidateProfile?.collegeName || "Cox's Bazar City College"}</strong></span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-white/5 w-full md:w-auto flex items-center justify-around gap-6">
            <div className="text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Available Exams</span>
              <span className="text-xl font-black text-primary">{exams.length}</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Completed</span>
              <span className="text-xl font-black text-emerald-400">
                {myAttempts.filter(a => a.status === "submitted" || a.status === "auto_submitted").length}
              </span>
            </div>
          </div>
        </div>

        {/* Available Exams Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Play className="text-emerald-400" size={20} />
              Active Online Examinations
            </h2>
            <span className="text-xs text-slate-400 font-semibold">Published Exams</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                Loading available exams...
              </div>
            ) : exams.length === 0 ? (
              <div className="col-span-2 bg-slate-900 border border-white/10 p-8 rounded-2xl text-center text-slate-500 text-xs">
                <AlertCircle size={28} className="mx-auto mb-2 text-slate-600" />
                বর্তমানে আপনার জন্য কোনো অনলাইন পরীক্ষা নির্ধারিত নেই।
              </div>
            ) : (
              exams.map((e) => {
                const existingAttempts = myAttempts.filter(a => a.examId === e.id);
                const inProgress = existingAttempts.find(a => a.status === "in_progress");
                const completedCount = existingAttempts.filter(a => a.status === "submitted" || a.status === "auto_submitted" || a.status === "expired").length;
                const canTake = !e.maxAttempts || completedCount < e.maxAttempts || inProgress;

                return (
                  <div key={e.id} className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4 flex flex-col justify-between hover:border-primary/40 transition-all shadow-lg">
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {e.status}
                        </span>
                        <span className="text-xs font-bold text-amber-400">
                          Total Marks: {e.totalMarks}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-white">{e.title}</h3>
                      {e.description && (
                        <p className="text-xs text-slate-400 font-medium line-clamp-2">{e.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center text-[11px] font-semibold text-slate-300">
                      <div className="bg-slate-950 p-2 rounded-xl">
                        <span className="text-slate-500 block text-[9px]">Duration</span>
                        <strong>{e.durationMinutes} Mins</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-xl">
                        <span className="text-slate-500 block text-[9px]">Pass Marks</span>
                        <strong className="text-emerald-400">{e.passMarks}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-xl">
                        <span className="text-slate-500 block text-[9px]">Attempts</span>
                        <strong>{completedCount} / {e.maxAttempts || "∞"}</strong>
                      </div>
                    </div>

                    <div className="pt-2">
                      {inProgress ? (
                        <Link
                          to={`/exam/take/${e.id}`}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play size={16} /> Resume In-Progress Exam
                        </Link>
                      ) : canTake ? (
                        <Link
                          to={`/exam/instructions/${e.id}`}
                          className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play size={16} /> Start Exam
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="w-full py-3 bg-slate-800 text-slate-500 font-bold text-xs uppercase rounded-xl cursor-not-allowed text-center"
                        >
                          Maximum Attempts Completed
                        </button>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Completed Attempts & Results */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Award className="text-amber-400" size={20} />
              My Completed Exam Results
            </h2>
          </div>

          <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-white/10 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-4">Exam Title</th>
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4 text-center">Score</th>
                    <th className="py-4 px-4 text-center">Percentage</th>
                    <th className="py-4 px-4 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs font-medium text-slate-300">
                  {myAttempts.filter(a => a.status === "submitted" || a.status === "auto_submitted").length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        আপনি এখনও কোনো পরীক্ষা সম্পন্ন করেননি।
                      </td>
                    </tr>
                  ) : (
                    myAttempts
                      .filter(a => a.status === "submitted" || a.status === "auto_submitted")
                      .map((att) => {
                        const res = myResultsMap[att.id];
                        return (
                          <tr key={att.id} className="hover:bg-white/[0.02]">
                            <td className="py-4 px-4 font-bold text-white">
                              {att.examTitle || "BNCC Online Exam"}
                            </td>

                            <td className="py-4 px-4 text-slate-400">
                              {new Date(att.submittedAt || att.startedAt).toLocaleDateString("bn-BD")}
                            </td>

                            <td className="py-4 px-4 text-center font-black text-white">
                              {att.score ?? res?.score ?? 0}
                            </td>

                            <td className="py-4 px-4 text-center font-bold text-amber-400">
                              {att.percentage ?? res?.percentage ?? 0}%
                            </td>

                            <td className="py-4 px-4 text-center">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                att.isPassed || res?.isPassed
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              }`}>
                                {att.isPassed || res?.isPassed ? "PASSED" : "FAILED"}
                              </span>
                            </td>

                            <td className="py-4 px-4 text-right">
                              <Link
                                to={`/exam/result/${att.id}`}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1"
                              >
                                View Marksheet <ChevronRight size={14} />
                              </Link>
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

      </main>
    </div>
  );
}
