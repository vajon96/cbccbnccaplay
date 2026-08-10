import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  Award, Clock, CheckCircle2, ShieldAlert, 
  ArrowRight, ArrowLeft, RefreshCw, AlertCircle 
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getSession } from "../lib/auth";
import { getExamById, startExamAttempt } from "../services/examService";
import { ExamModel } from "../types";
import { ExamNavbar } from "../components/exam/ExamNavbar";

export function ExamInstructions() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const session = getSession();

  const [exam, setExam] = useState<ExamModel | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/exam/login");
      return;
    }

    if (!examId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [eData, profileSnap] = await Promise.all([
          getExamById(examId),
          getDoc(doc(db, "applicants", session.id))
        ]);

        if (!eData) {
          setError("পরীক্ষাটি ওয়েবসাইট থেকে সড়িয়ে নেওয়া হয়েছে অথবা পাওয়া যায়নি।");
        } else {
          setExam(eData);
        }

        if (profileSnap.exists()) {
          setCandidateProfile(profileSnap.data());
        }
      } catch (err: any) {
        console.error("Error loading exam instructions:", err);
        setError("Error: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [examId, session?.id]);

  const handleBeginExam = async () => {
    if (!agreed) {
      setError("পরীক্ষায় অংশ নিতে হলে নির্দেশনা সমূহে সম্মতি দিন।");
      return;
    }

    if (!exam || !session) return;

    setStarting(true);
    setError("");

    try {
      const attempt = await startExamAttempt({
        examId: exam.id,
        candidateId: session.id,
        userId: session.id,
        registrationNumber: candidateProfile?.registrationNumber || session.registrationNumber || "REG-0000",
        candidateName: candidateProfile?.fullName || session.name || "Candidate",
        candidatePhoto: candidateProfile?.passportPhoto || "",
        session: candidateProfile?.session || "2025-2026",
        collegeName: candidateProfile?.collegeName || "Cox's Bazar City College"
      });

      // Redirect to live exam environment
      navigate(`/exam/take/${exam.id}`);
    } catch (err: any) {
      console.error("Error starting exam:", err);
      setError("পরীক্ষা শুরু করতে ব্যর্থ হয়েছে: " + err.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
          <AlertCircle size={40} className="mx-auto text-rose-500" />
          <h2 className="text-xl font-bold">{error}</h2>
          <Link to="/exam/dashboard" className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs uppercase block">
            Return to Candidate Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const qCount = exam?.questionSnapshots?.length || exam?.selectedQuestionIds?.length || 20;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col selection:bg-primary selection:text-white">
      <ExamNavbar title="Exam Instructions" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        {/* Back Link */}
        <Link to="/exam/dashboard" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>

        {/* Exam Title Banner */}
        <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-4 shadow-xl">
          <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-block">
            Official Written Test
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-white font-display leading-tight">{exam?.title}</h1>
          <p className="text-xs text-slate-400 font-medium leading-relaxed">{exam?.description}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/5 text-center">
            <div className="bg-slate-950 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Duration</span>
              <strong className="text-sm font-black text-white">{exam?.durationMinutes} Minutes</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Questions</span>
              <strong className="text-sm font-black text-amber-400">{qCount} Questions</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Total Marks</span>
              <strong className="text-sm font-black text-white">{exam?.totalMarks} Marks</strong>
            </div>

            <div className="bg-slate-950 p-3 rounded-2xl border border-white/5">
              <span className="text-[10px] text-slate-500 uppercase block font-bold">Pass Marks</span>
              <strong className="text-sm font-black text-emerald-400">{exam?.passMarks} Marks</strong>
            </div>
          </div>
        </div>

        {/* Detailed Instructions */}
        <div className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl">
          <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-amber-400" size={20} />
            পরীক্ষার্থীদের সাধারণ নিয়মাবলী ও নির্দেশনাবলী
          </h3>

          <div className="bg-slate-950 p-5 rounded-2xl border border-white/5 space-y-3 text-xs text-slate-300 font-medium whitespace-pre-line leading-relaxed">
            {exam?.instructions || "১. নির্ধারিত সময়ের মধ্যে সকল উত্তর সম্পন্ন করে 'Submit Exam' বাটনে ক্লিক করুন।\n২. সময় শেষ হয়ে গেলে উত্তরপত্র স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।\n৩. ট্যাব সুইচিং বন্ধ থাকবে।"}
          </div>

          {exam?.negativeMarking?.enabled && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>
                সতর্কতা: এই পরীক্ষায় নেগেটিভ মার্কিং কার্যকর আছে। প্রতি ভুল উত্তরের জন্য <strong>-{exam.negativeMarking.marksPerWrongAnswer}</strong> নম্বর কাটা যাবে।
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Agreement Checkbox */}
          <div className="pt-2">
            <label className="flex items-start gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer hover:border-primary transition-all">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-5 h-5 rounded text-primary mt-0.5"
              />
              <span className="text-xs text-white font-bold leading-relaxed">
                আমি সকল নিয়মাবলী ও নির্দেশনাবলী সতর্কতার সাথে পড়েছি এবং পরীক্ষায় অংশ নিতে সম্মত হয়েছি।
              </span>
            </label>
          </div>

          <button
            onClick={handleBeginExam}
            disabled={!agreed || starting}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {starting ? "Initializing Secure Exam Environment..." : "Start Exam Now"}
            <ArrowRight size={18} />
          </button>
        </div>

      </main>
    </div>
  );
}
