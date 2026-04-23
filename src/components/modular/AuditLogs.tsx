import { motion } from "framer-motion";
import { History, User, Settings, ShieldAlert, CheckCircle2 } from "lucide-react";

interface AuditLog {
  id: string;
  type: string;
  details: string;
  timestamp: string;
  actorName: string;
  severity: "info" | "warning" | "error";
}

export function AuditLogs({ logs }: { logs: AuditLog[] }) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "error": return "text-red-400 border-red-400/20 bg-red-400/5";
      case "warning": return "text-amber-400 border-amber-400/20 bg-amber-400/5";
      default: return "text-cyan-400 border-cyan-400/20 bg-cyan-400/5";
    }
  };

  const getIcon = (type: string) => {
    if (type.includes("CREATE")) return CheckCircle2;
    if (type.includes("DELETE")) return ShieldAlert;
    if (type.includes("UPDATE")) return Settings;
    return User;
  };

  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5 flex flex-col h-full">
      <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History size={20} className="text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">System Audit Trail</h3>
        </div>
        <button className="text-[10px] font-black uppercase px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
          Live Updates
        </button>
      </div>

      <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-4">
        {logs.map((log, idx) => {
          const Icon = getIcon(log.type);
          return (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={log.id}
              className={`p-4 rounded-2xl border flex items-start gap-4 group transition-colors hover:bg-white/5 ${getSeverityStyles(log.severity)}`}
            >
              <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                <Icon size={18} />
              </div>
              <div className="flex-grow space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase tracking-widest">{log.type}</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-xs font-bold text-white leading-relaxed">{log.details}</p>
                <div className="flex items-center gap-2 pt-1 opacity-60">
                   <User size={10} />
                   <span className="text-[10px] font-bold">Performed by: {log.actorName}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="p-6 bg-white/5 border-t border-white/5">
         <button className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2">
            <History size={14} />
            Download Full Audit Report
         </button>
      </div>
    </div>
  );
}
