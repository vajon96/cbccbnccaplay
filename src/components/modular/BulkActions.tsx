import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Trash2, FileSpreadsheet, X, Loader2 } from "lucide-react";

interface BulkActionsProps {
  selectedCount: number;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onExport: () => void;
  onClear: () => void;
  isProcessing: boolean;
}

export function BulkActions({ selectedCount, onApprove, onReject, onDelete, onExport, onClear, isProcessing }: BulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
    >
      <div className="glass-card bg-slate-900/80 border border-primary/20 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-cyan-400 to-primary animate-gradient-x" />
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-black text-lg">
            {selectedCount}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Candidates</p>
            <p className="text-sm font-black text-white italic">Selected for Command</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className="p-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl hover:bg-emerald-500 hover:text-white transition-all group"
            title="Bulk Approve"
          >
            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
          </button>
          
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl hover:bg-amber-500 hover:text-white transition-all group"
            title="Bulk Reject"
          >
             {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
          </button>

          <button
            onClick={onExport}
            className="p-3 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-xl hover:bg-cyan-500 hover:text-white transition-all group"
            title="Export Selected"
          >
             <FileSpreadsheet size={20} />
          </button>

          <button
            onClick={onDelete}
            disabled={isProcessing}
            className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white transition-all group"
            title="Bulk Delete"
          >
             {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
          </button>

          <div className="w-px h-10 bg-white/10 mx-2" />

          <button
            onClick={onClear}
            className="p-3 text-slate-500 hover:text-white transition-colors"
            title="Clear Selection"
          >
             <X size={24} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
