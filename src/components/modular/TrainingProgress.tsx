import { motion } from "framer-motion";
import { Shield, Target, Award } from "lucide-react";

interface TrainingProgressProps {
  level: "Beginner" | "Intermediate" | "Advanced" | "Certified";
  progress: number; // 0 to 100
}

export function TrainingProgress({ level, progress }: TrainingProgressProps) {
  const levels = ["Beginner", "Intermediate", "Advanced", "Certified"];
  const currentIdx = levels.indexOf(level);

  return (
    <div className="glass-card p-6 rounded-3xl space-y-6 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-400/5 blur-3xl -ml-16 -mt-16 group-hover:bg-cyan-400/10 transition-colors" />
      
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Target size={16} className="text-cyan-400" />
          Training Status
        </h3>
        <span className="text-[10px] font-black uppercase text-cyan-400 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/20">
          Rank: {level}
        </span>
      </div>

      <div className="space-y-4">
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-cyan-400"
          />
        </div>

        <div className="flex justify-between">
          {levels.map((l, i) => (
            <div key={l} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                i <= currentIdx 
                  ? "border-cyan-400 bg-cyan-400/20 text-cyan-400" 
                  : "border-white/10 bg-white/5 text-slate-600"
              }`}>
                {i < currentIdx ? (
                  <Shield size={14} fill="currentColor" fillOpacity={0.5} />
                ) : i === currentIdx ? (
                  <Target size={14} className="animate-pulse" />
                ) : (
                  <Award size={14} />
                )}
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ${
                i <= currentIdx ? "text-cyan-400" : "text-slate-600"
              }`}>
                {l}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Next Milestone</p>
          <p className="text-xs font-black text-white">
            {currentIdx < 3 ? levels[currentIdx + 1] : "Fully Certified"}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overall Completion</p>
          <p className="text-xs font-black text-white">{progress}%</p>
        </div>
      </div>
    </div>
  );
}
