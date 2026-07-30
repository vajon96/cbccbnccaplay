import React, { useEffect, useState } from "react";
import { History, X, Clock, ShieldCheck, UserCheck, AlertCircle, Loader2 } from "lucide-react";
import { db, collection, query, where, orderBy, getDocs } from "../../firebase";
import { FIELD_LABELS } from "../../lib/profileUtils";

interface ChangeHistoryModalProps {
  cadetId: string;
  onClose: () => void;
}

export const ChangeHistoryModal: React.FC<ChangeHistoryModalProps> = ({ cadetId, onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(
          collection(db, "activity_logs"),
          where("targetId", "==", cadetId),
          orderBy("timestamp", "desc")
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setLogs(data);
      } catch (err) {
        console.error("Error loading activity logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [cadetId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-amber-500/20 text-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Profile Audit Trail</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">History of updates and changes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-surface hover:bg-white/10 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto space-y-4 flex-1 pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Clock size={40} className="mx-auto opacity-30 text-amber-400" />
              <p className="text-sm font-bold">No profile change history recorded yet.</p>
            </div>
          ) : (
            logs.map((log) => {
              const dateStr = log.timestamp?.toDate
                ? log.timestamp.toDate().toLocaleString("en-GB")
                : new Date(log.timestamp).toLocaleString("en-GB");

              return (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-black uppercase tracking-wider text-amber-400">
                      <ShieldCheck size={14} />
                      {log.type || "PROFILE_UPDATED"}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{dateStr}</span>
                  </div>

                  <p className="text-xs text-slate-300 font-medium">{log.details}</p>

                  {/* Changes diff if available */}
                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div className="bg-black/40 rounded-xl p-3 space-y-2 text-[11px] font-mono border border-white/5">
                      {Object.entries(log.changes).map(([field, delta]: [string, any]) => (
                        <div key={field} className="grid grid-cols-1 md:grid-cols-3 gap-1">
                          <span className="font-bold text-amber-300">
                            {FIELD_LABELS[field] || field}:
                          </span>
                          <span className="text-red-400 line-through truncate">
                            Old: {String(delta.old ?? "—")}
                          </span>
                          <span className="text-emerald-400 font-bold truncate">
                            New: {String(delta.new ?? "—")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
