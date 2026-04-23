import { motion } from "framer-motion";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

interface AttendanceStatsProps {
  percentage: number;
  totalParades: number;
  attended: number;
}

export function AttendanceStats({ percentage, totalParades, attended }: AttendanceStatsProps) {
  const getStatusColor = () => {
    if (percentage >= 85) return "text-emerald-400";
    if (percentage >= 70) return "text-amber-400";
    return "text-red-400";
  };

  const getStatusText = () => {
    if (percentage >= 85) return "Excellent";
    if (percentage >= 70) return "Good";
    return "Action Required";
  };

  return (
    <div className="glass-card p-6 rounded-3xl space-y-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          Attendance Tracker
        </h3>
        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full bg-slate-900/50 border border-white/5 ${getStatusColor()}`}>
          {getStatusText()}
        </span>
      </div>

      <div className="flex items-end gap-4">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-white/5"
            />
            <motion.circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={251.2}
              initial={{ strokeDashoffset: 251.2 }}
              animate={{ strokeDashoffset: 251.2 - (251.2 * percentage) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="text-primary"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-white">{Math.round(percentage)}%</span>
          </div>
        </div>

        <div className="flex-grow space-y-3 pb-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-tighter">Total Sessions</span>
            <span className="text-slate-200 font-black">{totalParades}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-tighter">Present</span>
            <span className="text-emerald-400 font-black">{attended}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold uppercase tracking-tighter">Absent</span>
            <span className="text-red-400 font-black">{totalParades - attended}</span>
          </div>
        </div>
      </div>

      <div className="p-3 bg-white/5 rounded-2xl flex items-center gap-3">
        {percentage < 75 ? (
          <AlertCircle size={16} className="text-amber-400 shrink-0" />
        ) : (
          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
        )}
        <p className="text-[10px] text-slate-400 font-medium leading-tight">
          {percentage < 75 
            ? "Your attendance is below the 75% requirement for certification." 
            : "Maintaining high attendance qualifies you for leadership badges."}
        </p>
      </div>
    </div>
  );
}
