import { motion } from "framer-motion";
import { Award, Shield, Users, Zap, Heart } from "lucide-react";

interface Badge {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  unlocked: boolean;
}

interface BadgeSystemProps {
  badges: Badge[];
}

export function BadgeSystem({ badges }: BadgeSystemProps) {
  return (
    <div className="glass-card p-6 rounded-3xl space-y-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/5 blur-3xl -mr-16 -mt-16 group-hover:bg-amber-400/10 transition-colors" />
      
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
          <Award size={16} className="text-amber-400" />
          Achievement Badges
        </h3>
        <span className="text-[10px] font-black uppercase text-amber-400 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
          {badges.filter(b => b.unlocked).length} / {badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {badges.map((badge, idx) => (
          <motion.div
            key={badge.id}
            whileHover={{ y: -5 }}
            className="flex flex-col items-center gap-2 group/badge relative"
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
              badge.unlocked 
                ? `${badge.color} bg-white/5 border-current` 
                : "text-slate-700 bg-slate-900/40 border-slate-800 grayscale"
            }`}>
              <badge.icon size={24} className={badge.unlocked ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" : ""} />
            </div>
            
            {/* Tooltip */}
            <div className="absolute bottom-full mb-3 hidden group-hover/badge:block w-32 p-2 bg-slate-900 border border-white/10 rounded-xl text-center z-20 shadow-2xl">
              <p className="text-[10px] font-black uppercase text-white mb-1">{badge.name}</p>
              <p className="text-[8px] text-slate-400 leading-tight">{badge.description}</p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <Zap size={12} className="text-amber-400" />
          Recent Achievement
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
             <Shield size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-white">Discipline Master</p>
            <p className="text-[10px] text-slate-400">Awarded for 10 consecutive parades.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
