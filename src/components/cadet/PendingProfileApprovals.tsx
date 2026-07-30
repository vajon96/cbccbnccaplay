import React, { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Clock, User, Eye, Loader2, RefreshCw } from "lucide-react";
import { db, collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, handleFirestoreError, OperationType } from "../../firebase";
import { PendingProfileChange } from "../../types";
import { FIELD_LABELS } from "../../lib/profileUtils";

interface PendingProfileApprovalsProps {
  adminSession: any;
}

export const PendingProfileApprovals: React.FC<PendingProfileApprovalsProps> = ({ adminSession }) => {
  const [requests, setRequests] = useState<PendingProfileChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [showRejectModalId, setShowRejectModalId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "pending_profile_changes"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as PendingProfileChange));
      setRequests(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching pending profile requests:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleApprove = async (req: PendingProfileChange) => {
    setProcessingId(req.id);
    try {
      // 1. Build update payload for cadet's profile document
      const approvedUpdates: Record<string, any> = {};
      Object.entries(req.changes).forEach(([key, val]) => {
        approvedUpdates[key] = val.new;
      });
      approvedUpdates.hasPendingEdits = false;
      approvedUpdates.pendingEditsId = null;
      approvedUpdates.updatedAt = Timestamp.now();

      // Update applicant document
      await updateDoc(doc(db, "applicants", req.cadetId), approvedUpdates);

      // 2. Mark pending request as approved
      await updateDoc(doc(db, "pending_profile_changes", req.id), {
        status: "approved",
        reviewedAt: Timestamp.now(),
        reviewedBy: adminSession.username || adminSession.name || "Admin"
      });

      // 3. Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "PROFILE_CHANGE_APPROVED",
        targetId: req.cadetId,
        actorId: adminSession.id || "admin",
        actorName: adminSession.username || adminSession.name || "Admin",
        timestamp: Timestamp.now(),
        details: `Approved sensitive profile changes for Cadet ${req.cadetName} (${req.registrationNumber})`,
        changes: req.changes
      });

      // 4. Send notification to Cadet
      await addDoc(collection(db, "notifications"), {
        targetId: req.cadetId,
        type: "Announcement",
        title: "Profile Changes Approved",
        message: "Your sensitive profile information update request has been approved by the Platoon Commander.",
        timestamp: Timestamp.now()
      });

      alert(`Sensitive changes for ${req.cadetName} have been successfully approved!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${req.cadetId}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (req: PendingProfileChange) => {
    const reason = rejectReason[req.id] || "Request rejected by Admin.";
    setProcessingId(req.id);
    try {
      // 1. Clear pending flag on applicant
      await updateDoc(doc(db, "applicants", req.cadetId), {
        hasPendingEdits: false,
        pendingEditsId: null
      });

      // 2. Mark request as rejected
      await updateDoc(doc(db, "pending_profile_changes", req.id), {
        status: "rejected",
        rejectReason: reason,
        reviewedAt: Timestamp.now(),
        reviewedBy: adminSession.username || adminSession.name || "Admin"
      });

      // 3. Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "PROFILE_CHANGE_REJECTED",
        targetId: req.cadetId,
        actorId: adminSession.id || "admin",
        actorName: adminSession.username || adminSession.name || "Admin",
        timestamp: Timestamp.now(),
        details: `Rejected profile change request for Cadet ${req.cadetName}. Reason: ${reason}`
      });

      // 4. Notify Cadet
      await addDoc(collection(db, "notifications"), {
        targetId: req.cadetId,
        type: "Alert",
        title: "Profile Changes Declined",
        message: `Your requested profile changes were not approved. Reason: ${reason}`,
        timestamp: Timestamp.now()
      });

      setShowRejectModalId(null);
      alert(`Request rejected for ${req.cadetName}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pending_profile_changes/${req.id}`);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/80 p-6 rounded-3xl border border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Sensitive Profile Approval Queue</h2>
            <p className="text-xs text-slate-400 font-medium">Review and verify sensitive cadet field updates before publishing</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-xs font-black uppercase tracking-widest">
          Pending: {requests.length} Requests
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-3xl space-y-3">
          <CheckCircle2 size={48} className="mx-auto text-emerald-400 opacity-60" />
          <h3 className="text-lg font-black text-white uppercase tracking-tight">All Profile Requests Clear</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">There are no pending sensitive cadet profile edit requests awaiting review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {requests.map((req) => (
            <div
              key={req.id}
              className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 space-y-6 relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary font-black">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">{req.cadetName}</h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Reg No: <span className="text-amber-400 font-bold">{req.registrationNumber || req.cadetId}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <Clock size={14} className="text-amber-400" />
                  <span>
                    Requested: {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString("en-GB") : "Recently"}
                  </span>
                </div>
              </div>

              {/* Changes comparison table */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">Requested Sensitive Field Changes:</h4>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(req.changes).map(([field, delta]) => (
                    <div key={field} className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs">
                      <span className="font-bold text-white uppercase tracking-wide block">
                        {FIELD_LABELS[field] || field}
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Current / Old Value:</span>
                          <p className="font-semibold line-through">{String(delta.old ?? "—")}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested New Value:</span>
                          <p className="font-bold">{String(delta.new ?? "—")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
                <button
                  onClick={() => setShowRejectModalId(req.id)}
                  disabled={processingId === req.id}
                  className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-red-500/20 disabled:opacity-50"
                >
                  <XCircle size={16} />
                  Decline / Reject
                </button>
                <button
                  onClick={() => handleApprove(req)}
                  disabled={processingId === req.id}
                  className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50"
                >
                  {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Approve Sensitive Changes
                </button>
              </div>

              {/* Reject Modal */}
              {showRejectModalId === req.id && (
                <div className="p-4 bg-red-950/60 border border-red-500/30 rounded-2xl space-y-3 mt-4">
                  <label className="text-xs font-bold text-red-300 block">Reason for rejection:</label>
                  <input
                    type="text"
                    value={rejectReason[req.id] || ""}
                    onChange={(e) => setRejectReason({ ...rejectReason, [req.id]: e.target.value })}
                    placeholder="Enter reason e.g. Invalid NID document or Registration Number mismatch"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRejectModalId(null)}
                      className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReject(req)}
                      disabled={processingId === req.id}
                      className="px-5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-500"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
