import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  FileSpreadsheet,
  Archive,
  Download,
  Search,
  Sparkles,
  BrainCircuit,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Key,
  Trash2,
  FileText,
  HelpCircle,
  ShieldCheck,
  Award,
  Sliders,
  Loader2,
  X,
} from "lucide-react";
import { useCMS } from "../../context/CMSContext";
import { db, collection, addDoc, Timestamp } from "../../firebase";
import { BulkActions } from "../modular/BulkActions";
import { OfflineApplicationManager } from "../offline/OfflineApplicationManager";
import { AICircularManager } from "../modular/AICircularManager";
import { AIGuideManager } from "../modular/AIGuideManager";
import { PendingProfileApprovals } from "../cadet/PendingProfileApprovals";

interface AdmissionPortalWorkspaceProps {
  applicants: any[];
  adminSession: any;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onToggleActivation: (applicant: any) => Promise<void>;
  onDeleteApplicant: (id: string) => Promise<void>;
  onBulkAction: (ids: string[], action: "Approve" | "Reject" | "Delete") => Promise<void>;
  onOpenPasswordReset: (applicantId: string) => void;
  onLoginAsUser: (applicant: any) => Promise<void>;
  onExportExcel: () => void;
  onExportJson: () => void;
  onDownloadPhotosZip: () => Promise<void>;
  onRunAiInsights: () => Promise<void>;
  aiInsights: string;
  onClearAiInsights: () => void;
  isAnalyzingInsights: boolean;
  onRunApplicantSummary: (applicant: any) => Promise<void>;
  applicantSummaries: Record<string, string>;
  loadingSummaryId: string | null;
  onNotify?: (msg: string, type?: "success" | "error") => void;
}

export function AdmissionPortalWorkspace({
  applicants,
  adminSession,
  onUpdateStatus,
  onToggleActivation,
  onDeleteApplicant,
  onBulkAction,
  onOpenPasswordReset,
  onLoginAsUser,
  onExportExcel,
  onExportJson,
  onDownloadPhotosZip,
  onRunAiInsights,
  aiInsights,
  onClearAiInsights,
  isAnalyzingInsights,
  onRunApplicantSummary,
  applicantSummaries,
  loadingSummaryId,
  onNotify,
}: AdmissionPortalWorkspaceProps) {
  const { settings, saveSettings } = useCMS();
  const [activeTab, setActiveTab] = useState<
    "overview" | "applicants" | "offline" | "circular" | "guide" | "approvals" | "merit"
  >("applicants");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bnccFilter, setBnccFilter] = useState<"All" | "Previous" | "NonPrevious">("All");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState<"Approve" | "Reject" | "Delete" | null>(null);
  const [savingPortalToggle, setSavingPortalToggle] = useState(false);

  const stats = useMemo(
    () => ({
      total: applicants.length,
      pending: applicants.filter((a) => a.status === "Pending").length,
      approved: applicants.filter((a) => a.status === "Approved" || a.status === "Joined").length,
      rejected: applicants.filter((a) => a.status === "Rejected").length,
      previousBncc: applicants.filter((a) => Boolean(a.previousBNCC)).length,
    }),
    [applicants]
  );

  const filteredApplicants = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return applicants.filter((app) => {
      const fullName = `${app.fullNameEnglish || ""} ${app.fullNameBangla || ""} ${app.id || ""} ${app.registrationNumber || ""}`.toLowerCase();
      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        (app.classRoll || "").toLowerCase().includes(q) ||
        (app.emisId || "").toLowerCase().includes(q) ||
        (app.studentPhone || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "All" || app.status === statusFilter;
      const matchesBncc =
        bnccFilter === "All" ||
        (bnccFilter === "Previous" && app.previousBNCC === true) ||
        (bnccFilter === "NonPrevious" && !app.previousBNCC);
      return matchesSearch && matchesStatus && matchesBncc;
    });
  }, [applicants, searchTerm, statusFilter, bnccFilter]);

  const meritSorted = useMemo(() => {
    return [...applicants].sort((a, b) => {
      const gpaA = parseFloat(a.hscGpa || a.sscGpa || "0") || 0;
      const gpaB = parseFloat(b.hscGpa || b.sscGpa || "0") || 0;
      return gpaB - gpaA;
    });
  }, [applicants]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const executeBulk = async (action: "Approve" | "Reject" | "Delete") => {
    setIsBulkProcessing(true);
    try {
      await onBulkAction(selectedIds, action);
      setSelectedIds([]);
      setConfirmBulkAction(null);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleAdmissionGate = async (field: "enrollmentOpen" | "offlineFormOpen", nextValue: boolean) => {
    setSavingPortalToggle(true);
    try {
      await saveSettings({
        ...settings,
        [field]: nextValue,
        lastUpdated: new Date().toISOString(),
        updatedBy: adminSession?.name || adminSession?.username || "Main Admin",
      });
      onNotify?.(
        field === "enrollmentOpen"
          ? `অনলাইন ক্যাডেট ভর্তি আবেদন এখন ${nextValue ? "চালু (OPEN)" : "বন্ধ (CLOSED)"} করা হয়েছে।`
          : `অফলাইন আবেদন ফর্ম ডাউনলোড এখন ${nextValue ? "চালু (OPEN)" : "বন্ধ (CLOSED)"} করা হয়েছে।`,
        "success"
      );
    } catch (err: any) {
      onNotify?.(err?.message || "ভর্তি সেটিংস সংরক্ষণ ব্যর্থ হয়েছে।", "error");
    } finally {
      setSavingPortalToggle(false);
    }
  };

  const subTabs: Array<{ id: typeof activeTab; label: string; icon: any; count?: number }> = [
    { id: "overview", label: "Overview & Controls", icon: Sliders },
    { id: "applicants", label: "Online Applicants", icon: Users, count: stats.total },
    { id: "offline", label: "Offline Applications", icon: FileSpreadsheet },
    { id: "circular", label: "Circulars", icon: FileText },
    { id: "guide", label: "Admission Guide", icon: HelpCircle },
    { id: "approvals", label: "Profile Approvals", icon: ShieldCheck },
    { id: "merit", label: "Merit & Roll Roster", icon: Award },
  ];

  const canExport = Boolean(adminSession?.permissions?.canExport || adminSession?.role === "super_admin");
  const canApprove = Boolean(adminSession?.permissions?.canApprove || adminSession?.role === "super_admin");
  const canEdit = Boolean(adminSession?.permissions?.canEdit || adminSession?.role === "super_admin");
  const canResetPW = Boolean(adminSession?.permissions?.canResetPW || adminSession?.role === "super_admin");
  const canDelete = Boolean(adminSession?.permissions?.canDelete || adminSession?.role === "super_admin");

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-white/10">
        {subTabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 shrink-0 cursor-pointer transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#C5A059] text-[#002147] font-black"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={`font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded ${
                    active ? "bg-[#002147] text-[#C5A059]" : "bg-white/10 text-slate-300"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW & ADMISSION CONTROLS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "মোট আবেদনকারী", value: stats.total, tone: "text-white" },
              { label: "পেন্ডিং যাচাই", value: stats.pending, tone: "text-amber-300" },
              { label: "অনুমোদিত ক্যাডেট", value: stats.approved, tone: "text-emerald-300" },
              { label: "বাতিলকৃত", value: stats.rejected, tone: "text-rose-300" },
              { label: "পূর্বের BNCC অভিজ্ঞতা", value: stats.previousBncc, tone: "text-[#C5A059]" },
            ].map((kpi, i) => (
              <div
                key={i}
                className="bg-[#061830] border border-white/10 rounded-2xl p-5 space-y-1"
              >
                <p className="text-xs font-semibold text-slate-400">{kpi.label}</p>
                <p className={`text-2xl font-black font-mono tabular-nums ${kpi.tone}`}>
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>

          {/* Public Portal Gate Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Online Cadet Enrollment Form</h3>
                <p className="text-xs text-slate-400">
                  Controls public access to <span className="font-mono text-slate-300">/enroll</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingPortalToggle}
                  onClick={() => void toggleAdmissionGate("enrollmentOpen", !settings.enrollmentOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                    settings.enrollmentOpen
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {settings.enrollmentOpen ? "OPEN (Click to Close)" : "CLOSED (Click to Open)"}
                </button>
              </div>
            </div>

            <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Offline Application Form Download</h3>
                <p className="text-xs text-slate-400">
                  Controls public access to <span className="font-mono text-slate-300">/offline-application</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={savingPortalToggle}
                  onClick={() => void toggleAdmissionGate("offlineFormOpen", !settings.offlineFormOpen)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-colors whitespace-nowrap ${
                    settings.offlineFormOpen
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {settings.offlineFormOpen ? "OPEN (Click to Close)" : "CLOSED (Click to Open)"}
                </button>
              </div>
            </div>
          </div>

          {/* Export Center */}
          <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Admission Registry Exports & Archive</h3>
              <p className="text-xs text-slate-400">Download candidate rosters, photos archive, or full JSON dataset</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onExportExcel}
                disabled={!canExport}
                className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <FileSpreadsheet size={15} /> Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={onExportJson}
                disabled={!canExport}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Download size={15} /> JSON Backup
              </button>
              <button
                type="button"
                onClick={() => void onDownloadPhotosZip()}
                disabled={!canExport}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Archive size={15} /> Photos ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ONLINE APPLICANTS */}
      {activeTab === "applicants" && (
        <div className="space-y-5">
          {/* Bulk Actions & Inline Confirmation */}
          <BulkActions
            selectedCount={selectedIds.length}
            onApprove={() => setConfirmBulkAction("Approve")}
            onReject={() => setConfirmBulkAction("Reject")}
            onDelete={() => setConfirmBulkAction("Delete")}
            onExport={onExportExcel}
            onClear={() => setSelectedIds([])}
            isProcessing={isBulkProcessing}
          />

          {confirmBulkAction && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-amber-200">
                Confirm bulk <strong>{confirmBulkAction}</strong> on {selectedIds.length} selected applicant(s)?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmBulkAction(null)}
                  className="px-3.5 py-1.5 bg-white/10 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBulkProcessing}
                  onClick={() => void executeBulk(confirmBulkAction)}
                  className="px-4 py-1.5 bg-[#C5A059] text-[#002147] rounded-lg font-black cursor-pointer flex items-center gap-1.5"
                >
                  {isBulkProcessing && <Loader2 size={13} className="animate-spin" />}
                  Confirm {confirmBulkAction}
                </button>
              </div>
            </div>
          )}

          {/* AI Recruitment Insights */}
          <div className="bg-[#061830] p-5 rounded-2xl border border-white/10 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-[#C5A059]" size={18} />
                <h3 className="font-bold text-[#C5A059] text-xs uppercase tracking-wider">
                  AI Recruitment Insights
                </h3>
              </div>
              {!aiInsights ? (
                <button
                  type="button"
                  onClick={() => void onRunAiInsights()}
                  disabled={isAnalyzingInsights || applicants.length === 0}
                  className="px-4 py-1.5 bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 rounded-lg text-xs font-bold hover:bg-[#C5A059]/25 disabled:opacity-50 cursor-pointer"
                >
                  {isAnalyzingInsights ? "Analyzing..." : "Generate Insights"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClearAiInsights}
                  className="text-xs text-[#C5A059] font-bold hover:underline cursor-pointer"
                >
                  Clear & Refresh
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {aiInsights ||
                "Generate an AI analysis of applicant physical readiness, academic GPA distribution, and previous BNCC experience."}
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="নাম, রোল, ফোন বা আইডি দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#061830] border border-white/15 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-400 focus:border-[#C5A059] outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={bnccFilter}
                onChange={(e) => setBnccFilter(e.target.value as any)}
                className="bg-[#061830] border border-white/15 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#C5A059]"
              >
                <option value="All">All Experience</option>
                <option value="Previous">Previous BNCC</option>
                <option value="NonPrevious">Fresh Applicants</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#061830] border border-white/15 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#C5A059]"
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Applicants Table */}
          <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                    <th className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredApplicants.length > 0 &&
                          selectedIds.length === filteredApplicants.length
                        }
                        onChange={(e) =>
                          setSelectedIds(e.target.checked ? filteredApplicants.map((a) => a.id) : [])
                        }
                        aria-label="Select all applicants"
                        className="w-4 h-4 rounded accent-[#C5A059]"
                      />
                    </th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Applicant</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Academic</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider">Status</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-center">BMI</th>
                    <th className="py-3.5 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredApplicants.map((app) => {
                    const heightInMeters =
                      Number(app.heightFeet || 0) * 0.3048 + Number(app.heightInches || 0) * 0.0254;
                    const weightVal = Number(app.weightKg || app.weight || 0);
                    const bmi =
                      weightVal > 0 && heightInMeters > 0
                        ? (weightVal / (heightInMeters * heightInMeters)).toFixed(1)
                        : null;
                    const isBmiHealthy = bmi !== null && Number(bmi) >= 18.5 && Number(bmi) <= 24.9;

                    return (
                      <tr
                        key={app.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          selectedIds.includes(app.id) ? "bg-[#C5A059]/10" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(app.id)}
                            onChange={() => toggleSelect(app.id)}
                            aria-label={`Select ${app.fullNameEnglish || app.id}`}
                            className="w-4 h-4 rounded accent-[#C5A059]"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#020B18] overflow-hidden border border-white/10 shrink-0 flex items-center justify-center">
                              {app.photo ? (
                                <img
                                  src={app.photo}
                                  alt={app.fullNameEnglish || "Applicant"}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users size={18} className="text-slate-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white truncate">
                                  {app.fullNameEnglish || app.fullNameBangla}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => void onRunApplicantSummary(app)}
                                  disabled={loadingSummaryId === app.id}
                                  className="text-[#C5A059] hover:text-amber-300 cursor-pointer"
                                  title="AI Summary"
                                >
                                  <Sparkles
                                    size={13}
                                    className={loadingSummaryId === app.id ? "animate-spin" : ""}
                                  />
                                </button>
                              </div>
                              <p className="text-[11px] font-mono text-slate-400">
                                {app.studentPhone || "No Phone"} · {app.id}
                              </p>
                              {applicantSummaries[app.id] && (
                                <p className="mt-1.5 text-[11px] text-amber-200 bg-[#020B18] border border-[#C5A059]/25 rounded-lg p-2 max-w-xs">
                                  {applicantSummaries[app.id]}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-200">{app.studyStatus || "N/A"}</p>
                          <p className="text-[11px] font-mono text-slate-400">
                            Roll: {app.classRoll || "-"}
                            {app.previousBNCC ? ` · BNCC (${app.previousRank || "Cadet"})` : ""}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-xs font-bold ${
                              app.status === "Approved" || app.status === "Joined"
                                ? "text-emerald-400"
                                : app.status === "Rejected"
                                ? "text-rose-400"
                                : "text-amber-300"
                            }`}
                          >
                            {app.status || "Pending"}
                          </span>
                          {app.isActive === false && (
                            <p className="text-[10px] font-bold text-rose-300">Account Suspended</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums">
                          {bmi ? (
                            <span className={isBmiHealthy ? "text-emerald-400 font-bold" : "text-amber-300 font-bold"}>
                              {bmi}
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {showPasswordId === app.id && (
                              <span className="mr-1 px-2 py-1 bg-[#020B18] border border-white/10 rounded text-[10px] font-mono text-slate-400">
                                {app.password?.substring(0, 12) || "HASHED"}...
                              </span>
                            )}
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => void onLoginAsUser(app)}
                              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                              title="Login as Cadet"
                            >
                              <ExternalLink size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordId(showPasswordId === app.id ? null : app.id)
                              }
                              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                              title="Inspect Password Hash"
                            >
                              {showPasswordId === app.id ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                            <button
                              type="button"
                              disabled={!canApprove}
                              onClick={() => void onUpdateStatus(app.id, "Approved")}
                              className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30 cursor-pointer"
                              title="Approve"
                            >
                              <CheckCircle size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={!canApprove}
                              onClick={() => void onUpdateStatus(app.id, "Rejected")}
                              className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/15 disabled:opacity-30 cursor-pointer"
                              title="Reject"
                            >
                              <XCircle size={15} />
                            </button>
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => void onToggleActivation(app)}
                              className={`p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 cursor-pointer ${
                                app.isActive === false ? "text-rose-400" : "text-slate-400"
                              }`}
                              title={app.isActive === false ? "Activate Account" : "Suspend Account"}
                            >
                              {app.isActive === false ? <Unlock size={15} /> : <Lock size={15} />}
                            </button>
                            <button
                              type="button"
                              disabled={!canResetPW}
                              onClick={() => onOpenPasswordReset(app.id)}
                              className="p-2 rounded-lg text-amber-300 hover:bg-amber-500/15 disabled:opacity-30 cursor-pointer"
                              title="Reset Password"
                            >
                              <Key size={15} />
                            </button>
                            {confirmDeleteId === app.id ? (
                              <span className="inline-flex items-center gap-1 ml-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onDeleteApplicant(app.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={!canDelete}
                                onClick={() => setConfirmDeleteId(app.id)}
                                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-30 cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredApplicants.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs space-y-2">
                <Users size={28} className="mx-auto text-slate-500" />
                <p className="font-bold text-slate-300">কোনো আবেদনকারী পাওয়া যায়নি।</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: OFFLINE APPLICATIONS */}
      {activeTab === "offline" && (
        <OfflineApplicationManager
          adminSession={adminSession}
          onLogActivity={async (type: string, targetId: string, details: string) => {
            try {
              await addDoc(collection(db, "activity_logs"), {
                type,
                details,
                actorId: adminSession?.username || "super_admin",
                targetId,
                timestamp: Timestamp.now(),
              });
            } catch {
              // ignore non-fatal log error
            }
          }}
        />
      )}

      {/* TAB: CIRCULARS */}
      {activeTab === "circular" && (
        <AICircularManager
          adminSession={adminSession}
          onLogActivity={async (type: string, details: string) => {
            try {
              await addDoc(collection(db, "activity_logs"), {
                type,
                details,
                actorId: adminSession?.username || "super_admin",
                targetId: "CIRCULAR_SYSTEM",
                timestamp: Timestamp.now(),
              });
            } catch {
              // ignore
            }
          }}
        />
      )}

      {/* TAB: ADMISSION GUIDE */}
      {activeTab === "guide" && (
        <AIGuideManager
          adminSession={adminSession}
          onLogActivity={async (type: string, details: string) => {
            try {
              await addDoc(collection(db, "activity_logs"), {
                type,
                details,
                actorId: adminSession?.username || "super_admin",
                targetId: "GUIDE_SYSTEM",
                timestamp: Timestamp.now(),
              });
            } catch {
              // ignore
            }
          }}
        />
      )}

      {/* TAB: PROFILE APPROVALS */}
      {activeTab === "approvals" && <PendingProfileApprovals adminSession={adminSession} />}

      {/* TAB: MERIT & ROLL ROSTER */}
      {activeTab === "merit" && (
        <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Admission Merit & Roll Roster</h3>
              <p className="text-xs text-slate-400">Sorted by highest GPA for final BNCC selection board review</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#C5A059] font-bold">
              {meritSorted.length} Candidates Ranked
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                  <th className="py-3 px-4 font-bold uppercase">Rank</th>
                  <th className="py-3 px-4 font-bold uppercase">Candidate ID & Name</th>
                  <th className="py-3 px-4 font-bold uppercase">SSC / HSC GPA</th>
                  <th className="py-3 px-4 font-bold uppercase">BNCC Prior</th>
                  <th className="py-3 px-4 font-bold uppercase">Status</th>
                  <th className="py-3 px-4 font-bold uppercase text-right">Admit Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {meritSorted.map((cand, idx) => (
                  <tr key={cand.id} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#C5A059]">
                      #{idx + 1}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-white">{cand.fullNameEnglish || cand.fullNameBangla}</p>
                      <p className="text-[11px] font-mono text-slate-400">{cand.id}</p>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-200">
                      SSC: {cand.sscGpa || "-"} · HSC: {cand.hscGpa || "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {cand.previousBNCC ? cand.previousRank || "Yes" : "No"}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">{cand.status || "Pending"}</td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/admit-card/${cand.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-[#C5A059] hover:text-[#002147] text-white rounded-lg text-[11px] font-bold transition-colors"
                      >
                        <ExternalLink size={12} /> Admit Card
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
