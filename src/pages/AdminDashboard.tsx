import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, CheckCircle, XCircle, Download, Trash2, 
  Search, Filter, FileSpreadsheet, Archive, LogOut, Shield,
  X, Sparkles, BrainCircuit, Info,
  History, Key, Edit, Save, AlertCircle, Loader2, Eye, EyeOff, ExternalLink,
  MessageSquare, UserPlus, Settings, ShieldCheck, ShieldAlert, Lock, Unlock, ArrowRight,
  TrendingUp, PieChart as PieChartIcon, BarChart as BarChartIcon, Bell, Megaphone, Activity
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, Timestamp, handleFirestoreError, OperationType, addDoc, where, getDocs, writeBatch } from "../firebase";
import { getAdminInsights, getApplicantSummary } from "../services/geminiService";
import { getSession, clearSession, hashPassword } from "../lib/auth";
import { AuditLogs } from "../components/modular/AuditLogs";
import { BulkActions } from "../components/modular/BulkActions";
import { NotificationCenter } from "../components/modular/NotificationCenter";

export function AdminDashboard() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [aiInsights, setAiInsights] = useState("");
  const [isAnalyzingInsights, setIsAnalyzingInsights] = useState(false);
  const [applicantSummaries, setApplicantSummaries] = useState<{[key: string]: string}>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"applicants" | "logs" | "admins" | "analytics" | "broadcast" | "updates">("applicants");
  const [reviewingUpdateApplicant, setReviewingUpdateApplicant] = useState<any>(null);
  const [processingUpdate, setProcessingUpdate] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminSession, setAdminSession] = useState<any>(null);
  
  // Create Admin State
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPermissions, setAdminPermissions] = useState({
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canViewLogs: true,
    canResetPW: false,
    canApprove: true,
    canExport: false,
    canChat: true
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Edit Admin Permissions State
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<any>(null);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);

  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("Announcement");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "admin" && session.role !== "super_admin")) {
      navigate("/login");
      return;
    }
    setAdminSession(session);

    const q = query(collection(db, "applicants"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const applicantsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setApplicants(applicantsData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
      setError("ডেটা লোড করতে সমস্যা হচ্ছে।");
      setLoading(false);
    });

    // Fetch logs
    const logsQ = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"));
    const logsUnsubscribe = onSnapshot(logsQ, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      setLogs(logsData);
    });

    // Fetch admins (only for super admin)
    let adminsUnsubscribe = () => {};
    if (session.role === "super_admin") {
      const adminsQ = query(collection(db, "admins"), orderBy("createdAt", "desc"));
      adminsUnsubscribe = onSnapshot(adminsQ, (snapshot) => {
        const adminsData = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        setAdmins(adminsData);
      });
    }

    return () => {
      unsubscribe();
      logsUnsubscribe();
      adminsUnsubscribe();
    };
  }, [navigate]);

  const handleCreateAdmin = async () => {
    if (!adminName || !adminUsername || !adminPassword) return;
    setCreatingAdmin(true);
    try {
      // Check if username exists in admins
      const q = query(collection(db, "admins"), where("username", "==", adminUsername.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        alert("This username is already taken.");
        return;
      }

      const hashedPassword = await hashPassword(adminPassword);
      await addDoc(collection(db, "admins"), {
        name: adminName,
        username: adminUsername.toLowerCase(),
        password: hashedPassword,
        role: "admin",
        permissions: adminPermissions,
        createdAt: Timestamp.now()
      });

      // Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "ADMIN_CREATED",
        targetId: adminUsername,
        actorId: adminSession.id,
        timestamp: Timestamp.now(),
        details: `Super Admin created new admin: ${adminUsername}`
      });

      setShowAddAdmin(false);
      setAdminName("");
      setAdminUsername("");
      setAdminPassword("");
      alert("Admin created successfully!");
    } catch (err: any) {
      console.error("Create admin error:", err);
      const errorMessage = err?.message || "Unknown error";
      alert(`Failed to create admin: ${errorMessage}`);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const deleteAdmin = async (id: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;
    try {
      await deleteDoc(doc(db, "admins", id));
      alert("Admin removed.");
    } catch (err) {
      console.error("Delete admin error:", err);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingAdminId || !editPermissions) return;
    setUpdatingPermissions(true);
    try {
      await updateDoc(doc(db, "admins", editingAdminId), {
        permissions: editPermissions
      });
      
      // Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "ADMIN_PERMISSIONS_UPDATED",
        targetId: editingAdminId,
        actorId: adminSession.id,
        timestamp: Timestamp.now(),
        details: `Super Admin updated permissions for admin ID: ${editingAdminId}`
      });

      setEditingAdminId(null);
      alert("Permissions updated successfully!");
    } catch (err) {
      console.error("Update permissions error:", err);
      alert("Failed to update permissions.");
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const handleResetPassword = async () => {
    if (!showPasswordReset || !newPassword) return;
    
    // Check permission
    if (!adminSession?.permissions?.canResetPW) {
      alert("আপনার এই কাজটি করার অনুমতি নেই। (Permission Denied)");
      return;
    }

    setResetting(true);
    try {
      const hashedPassword = await hashPassword(newPassword);
      await updateDoc(doc(db, "applicants", showPasswordReset), {
        password: hashedPassword
      });

      // Log activity
      const session = getSession();
      await addDoc(collection(db, "activity_logs"), {
        type: "PASSWORD_RESET_BY_ADMIN",
        targetId: showPasswordReset,
        actorId: session.id,
        timestamp: Timestamp.now(),
        details: `Admin reset password for user ${showPasswordReset}`
      });

      setShowPasswordReset(null);
      setNewPassword("");
      alert("Password reset successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${showPasswordReset}`);
    } finally {
      setResetting(false);
    }
  };

  const handleAdminLoginAsUser = (applicant: any) => {
    // Set a temporary session that mimics the user but keeps admin context if needed
    // For simplicity, we'll just set the user session and redirect
    localStorage.setItem("bncc_session", JSON.stringify({
      id: applicant.id,
      role: "user",
      expiry: Date.now() + 1000 * 60 * 60 // 1 hour
    }));
    navigate("/dashboard");
  };

  const updateStatus = async (id: string, status?: string) => {
    // Check permission
    if (status && !adminSession?.permissions?.canApprove) {
      alert("আপনার আবেদন অনুমোদন করার অনুমতি নেই।");
      return;
    }

    const path = `applicants/${id}`;
    try {
      const docRef = doc(db, "applicants", id);
      const updates: any = {};
      if (status) updates.status = status;
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteApplicant = async (id: string) => {
    // Check permission
    if (!adminSession?.permissions?.canDelete) {
      alert("আপনার রেকর্ড মুছে ফেলার অনুমতি নেই।");
      return;
    }

    if (!confirm("আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?")) return;
    const path = `applicants/${id}`;
    try {
      await deleteDoc(doc(db, "applicants", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedApplicants(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: 'Approve' | 'Reject' | 'Delete') => {
    if (selectedApplicants.length === 0) return;
    if (!confirm(`Are you sure you want to ${action} ${selectedApplicants.length} candidates?`)) return;

    setIsBulkProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedApplicants.forEach(id => {
        const ref = doc(db, "applicants", id);
        if (action === 'Delete') {
          batch.delete(ref);
        } else {
          batch.update(ref, { status: action });
        }
      });
      await batch.commit();

      // Log bulk activity
      await addDoc(collection(db, "activity_logs"), {
        type: `BULK_${action.toUpperCase()}`,
        targetId: "MULTIPLE",
        actorId: adminSession.id,
        timestamp: Timestamp.now(),
        details: `Admin performed bulk ${action} on ${selectedApplicants.length} candidates.`
      });

      setSelectedApplicants([]);
      alert(`Bulk ${action} completed successfully.`);
    } catch (err) {
      console.error("Bulk action error:", err);
      alert("Bulk action failed.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !broadcastTitle.trim()) {
      alert("Please enter both title and message.");
      return;
    }
    setSendingBroadcast(true);
    try {
      await addDoc(collection(db, "notifications"), {
        title: broadcastTitle,
        message: broadcastMessage,
        type: broadcastType,
        targetId: "ALL", // Every cadet sees this
        isRead: false,
        timestamp: Timestamp.now(),
        actorId: adminSession.id
      });

      // Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "BROADCAST_SENT",
        targetId: "ALL_CADETS",
        actorId: adminSession.id,
        timestamp: Timestamp.now(),
        details: `Admin sent a broadcast message: ${broadcastTitle} - ${broadcastMessage.substring(0, 50)}...`
      });

      setBroadcastMessage("");
      setBroadcastTitle("");
      alert("Announcement sent to all cadets!");
    } catch (err) {
      console.error("Broadcast error:", err);
      alert("Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const exportToExcel = () => {
    const dataToExport = applicants.map(({ photo, ...rest }) => ({
      ...rest,
      height: `${rest.heightFeet}'${rest.heightInches}" (${rest.heightFeet} feet ${rest.heightInches} inches)`,
      createdAt: new Date(rest.createdAt).toLocaleString()
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applicants");
    XLSX.writeFile(workbook, `BNCC_Applicants_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPhotosZip = async () => {
    const zip = new JSZip();
    applicants.forEach((app) => {
      if (app.photo) {
        const base64Data = app.photo.split(",")[1];
        zip.file(`${app.fullNameEnglish || app.fullNameBangla}_${app.id}.jpg`, base64Data, { base64: true });
      }
    });
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "Applicant_Photos.zip";
    link.click();
  };

  const filteredApplicants = applicants.filter(app => {
    const fullName = `${app.fullNameEnglish || ""} ${app.fullNameBangla || ""}`.toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || 
                          (app.classRoll || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (app.emisId || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const runAiInsights = async () => {
    if (applicants.length === 0) return;
    setIsAnalyzingInsights(true);
    const insights = await getAdminInsights(applicants);
    setAiInsights(insights);
    setIsAnalyzingInsights(false);
  };

  const runApplicantSummary = async (app: any) => {
    setLoadingSummaryId(app.id);
    const summary = await getApplicantSummary(app);
    setApplicantSummaries(prev => ({ ...prev, [app.id]: summary }));
    setLoadingSummaryId(null);
  };

  const stats = {
    total: applicants.length,
    pending: applicants.filter(a => a.status === 'Pending').length,
    approved: applicants.filter(a => a.status === 'Approved').length,
    updates: applicants.filter(a => a.hasUpdatePending).length,
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-200 bg-bg-light font-bold">তথ্য লোড হচ্ছে...</div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-bg-light text-slate-200 p-4 text-center space-y-4">
        <XCircle className="w-16 h-16 text-primary" />
        <h2 className="text-xl font-bold">ত্রুটি ঘটেছে!</h2>
        <p className="text-slate-400 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-primary p-8 rounded-[2rem] text-white shadow-xl">
          <div>
            <h1 className="text-3xl font-bold text-white">অ্যাডমিন ড্যাশবোর্ড</h1>
            <p className="text-white/70">সকল আবেদনকারী এবং তাদের স্ট্যাটাস পরিচালনা করুন</p>
          </div>
          <div className="flex gap-3">
            <NotificationCenter notifications={notifications} />
            <button
              onClick={exportToExcel}
              disabled={!adminSession?.permissions?.canExport}
              className={`flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg ${!adminSession?.permissions?.canExport ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <FileSpreadsheet className="w-4 h-4" /> {adminSession?.permissions?.canExport ? "Excel এক্সপোর্ট" : <Lock size={14} />}
            </button>
            <button
              onClick={downloadPhotosZip}
              disabled={!adminSession?.permissions?.canExport}
              className={`flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg ${!adminSession?.permissions?.canExport ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <Archive className="w-4 h-4" /> {adminSession?.permissions?.canExport ? "ফটো জিপ (ZIP)" : <Lock size={14} />}
            </button>
            <button
              onClick={() => navigate("/messenger")}
              disabled={!adminSession?.permissions?.canChat}
              className={`flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20 ${!adminSession?.permissions?.canChat ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <MessageSquare className="w-4 h-4" /> {adminSession?.permissions?.canChat ? "Messenger" : <Lock size={14} />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20"
            >
              <LogOut className="w-4 h-4" /> লগআউট
            </button>
          </div>
        </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "মোট আবেদন", value: stats.total, icon: Users, color: "text-slate-400" },
          { label: "পেন্ডিং", value: stats.pending, icon: CheckCircle, color: "text-amber-500" },
          { label: "অনুমোদিত", value: stats.approved, icon: CheckCircle, color: "text-primary" },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-2xl border border-white/5 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-2xl font-black text-white">{stat.value}</p>
            <p className="text-xs font-bold text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-white/5 pb-1">
        <button
          onClick={() => setActiveTab("applicants")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "applicants" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={18} />
            Applicants
          </div>
          {activeTab === "applicants" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          disabled={!adminSession?.permissions?.canViewLogs}
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "logs" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          } ${!adminSession?.permissions?.canViewLogs ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
        >
          <div className="flex items-center gap-2">
            <History size={18} />
            Activity Logs
            {!adminSession?.permissions?.canViewLogs && <Lock size={12} className="text-red-500" />}
          </div>
          {activeTab === "logs" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
        </button>
        {adminSession?.role === "super_admin" && (
          <button
            onClick={() => setActiveTab("admins")}
            className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
              activeTab === "admins" ? "text-primary" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={18} />
              Manage Admins
            </div>
            {activeTab === "admins" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
          </button>
        )}
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "analytics" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={18} />
            Analytics
          </div>
          {activeTab === "analytics" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("broadcast")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "broadcast" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Megaphone size={18} />
            Broadcast
          </div>
          {activeTab === "broadcast" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("updates")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "updates" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Edit size={18} />
            Updates
            {stats.updates > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {stats.updates}
              </span>
            )}
          </div>
          {activeTab === "updates" && <motion.div layoutId="tab" className="absolute bottom-0 left-0 w-full h-1 bg-primary rounded-t-full" />}
        </button>
      </div>

      {activeTab === "applicants" ? (
        <>
          <div className="space-y-6">
            <BulkActions 
              selectedCount={selectedApplicants.length}
              onApprove={() => handleBulkAction('Approve')}
              onReject={() => handleBulkAction('Reject')}
              onDelete={() => handleBulkAction('Delete')}
              onExport={exportToExcel}
              onClear={() => setSelectedApplicants([])}
              isProcessing={isBulkProcessing}
            />
            {/* AI Insights Section */}
            <div className="glass-card p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5">
                <BrainCircuit size={120} className="text-primary" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-primary" size={20} />
                    <h3 className="font-black text-primary uppercase tracking-widest text-[10px]">AI Recruitment Insights</h3>
                  </div>
                  {!aiInsights && (
                    <button 
                      onClick={runAiInsights}
                      disabled={isAnalyzingInsights || applicants.length === 0}
                      className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase hover:bg-primary/20 transition-all disabled:opacity-50"
                    >
                      {isAnalyzingInsights ? "Analyzing..." : "Generate Insights"}
                    </button>
                  )}
                </div>
                
                {aiInsights ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{aiInsights}"</p>
                    <button 
                      onClick={() => setAiInsights("")}
                      className="text-[10px] text-primary font-bold uppercase hover:underline"
                    >
                      Refresh Insights
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Click the button to generate AI-powered recruitment insights based on current applicants.</p>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="নাম অথবা আইডি দিয়ে খুঁজুন..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white focus:border-primary outline-none transition-all shadow-xl"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-white focus:border-primary outline-none cursor-pointer shadow-xl appearance-none"
                >
                  <option value="All">সকল স্ট্যাটাস</option>
                  <option value="Pending">পেন্ডিং</option>
                  <option value="Approved">অনুমোদিত</option>
                  <option value="Rejected">বাতিল</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">
                        <input 
                          type="checkbox" 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedApplicants(filteredApplicants.map(a => a.id));
                            else setSelectedApplicants([]);
                          }}
                          checked={selectedApplicants.length === filteredApplicants.length && filteredApplicants.length > 0}
                          className="w-4 h-4 rounded border-white/10 bg-slate-800"
                        />
                      </th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">নথিভুক্ত ক্যাডেট</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">শ্রেণি ও রোল</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">স্ট্যাটাস</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">BMI</th>
                      <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredApplicants.map((app) => {
                      const heightInMeters = (Number(app.heightFeet || 0) * 0.3048) + (Number(app.heightInches || 0) * 0.0254);
                      const bmi = app.weight && heightInMeters > 0 ? (Number(app.weight) / (heightInMeters * heightInMeters)).toFixed(1) : null;
                      const isBmiHealthy = bmi && Number(bmi) >= 18.5 && Number(bmi) <= 24.9;

                      return (
                        <tr key={app.id} className={`hover:bg-white/[0.02] transition-colors group ${selectedApplicants.includes(app.id) ? 'bg-primary/5' : ''}`}>
                          <td className="px-8 py-6 text-center">
                          <input 
                            type="checkbox" 
                            checked={selectedApplicants.includes(app.id)}
                            onChange={() => toggleSelect(app.id)}
                            className="w-4 h-4 rounded border-white/10 bg-slate-800 accent-primary"
                          />
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[1.2rem] bg-slate-800 overflow-hidden border border-white/10 shadow-lg group-hover:scale-105 transition-transform">
                              {app.photo ? (
                                <img src={app.photo} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <Users className="w-full h-full p-3 text-slate-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-white text-sm">{app.fullNameEnglish || app.fullNameBangla}</p>
                                <button 
                                  onClick={() => runApplicantSummary(app)}
                                  disabled={loadingSummaryId === app.id}
                                  className="text-primary hover:text-primary/80 transition-colors"
                                  title="AI Summary"
                                >
                                  <Sparkles className={`w-3 h-3 ${loadingSummaryId === app.id ? 'animate-pulse' : ''}`} />
                                </button>
                              </div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{app.studentPhone || "No Mobile"}</p>
                              {applicantSummaries[app.id] && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="mt-2 p-2 bg-primary/5 border-l-2 border-primary rounded-r-lg max-w-xs"
                                >
                                  <p className="text-[9px] text-primary italic leading-tight">{applicantSummaries[app.id]}</p>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-slate-200">{app.studyStatus}</p>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Roll: {app.classRoll}</p>
                        </td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                              app.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                              app.status === 'Rejected' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                              'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            {bmi ? (
                              <div className="flex flex-col items-center">
                                <span className={`text-sm font-black ${isBmiHealthy ? 'text-emerald-500' : 'text-amber-500'}`}>
                                  {bmi}
                                </span>
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                  {isBmiHealthy ? 'Healthy' : 'Check'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 group-hover:scale-100 transition-transform">
                            {showPasswordId === app.id && (
                              <div className="mr-2 px-3 py-1.5 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-mono text-slate-400 animate-in fade-in slide-in-from-right-2">
                                {app.password?.substring(0, 15)}...
                              </div>
                            )}
                            <button
                              onClick={() => handleAdminLoginAsUser(app)}
                              disabled={!adminSession?.permissions?.canEdit}
                              className={`p-2.5 hover:bg-white/5 text-slate-500 hover:text-white rounded-xl transition-all ${!adminSession?.permissions?.canEdit ? 'opacity-30 cursor-not-allowed' : ''}`}
                              title="Login as User"
                            >
                              {adminSession?.permissions?.canEdit ? <ExternalLink className="w-5 h-5" /> : <Lock className="w-5 h-5 text-red-500/50" />}
                            </button>
                            <button
                              onClick={() => setShowPasswordId(showPasswordId === app.id ? null : app.id)}
                              className={`p-2.5 rounded-xl transition-all ${
                                showPasswordId === app.id ? 'text-primary bg-primary/10' : 'text-slate-500 hover:bg-white/5'
                              }`}
                              title="Verify Hash"
                            >
                              {showPasswordId === app.id ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => updateStatus(app.id, 'Approved')}
                              className={`p-2.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 rounded-xl transition-all ${!adminSession?.permissions?.canApprove ? 'opacity-30 cursor-not-allowed' : ''}`}
                              disabled={!adminSession?.permissions?.canApprove}
                              title="Approve"
                            >
                              {adminSession?.permissions?.canApprove ? <CheckCircle className="w-5 h-5" /> : <Lock className="w-5 h-5 text-red-500/50" />}
                            </button>
                            <button
                              onClick={() => setShowPasswordReset(app.id)}
                              className={`p-2.5 hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 rounded-xl transition-all ${!adminSession?.permissions?.canResetPW ? 'opacity-30 cursor-not-allowed' : ''}`}
                              disabled={!adminSession?.permissions?.canResetPW}
                              title="Reset PW"
                            >
                              {adminSession?.permissions?.canResetPW ? <Key className="w-5 h-5" /> : <Lock className="w-5 h-5 text-red-500/50" />}
                            </button>
                            <button
                              onClick={() => deleteApplicant(app.id)}
                              className={`p-2.5 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-xl transition-all ${!adminSession?.permissions?.canDelete ? 'opacity-30 cursor-not-allowed' : ''}`}
                              disabled={!adminSession?.permissions?.canDelete}
                              title="Delete"
                            >
                              {adminSession?.permissions?.canDelete ? <Trash2 className="w-5 h-5" /> : <Lock className="w-5 h-5 text-red-500/50" />}
                            </button>
                          </div>
                        </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredApplicants.length === 0 && (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-black/10 mx-auto mb-4" />
                <p className="text-black/30">কোনো আবেদনকারী পাওয়া যায়নি।</p>
              </div>
            )}
          </div>
        </>
      ) : activeTab === "updates" ? (
        <div className="space-y-8 pb-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
              <Edit className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">Pending Profile Updates</h2>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verify and approve candidate profile changes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applicants.filter(a => a.hasUpdatePending).map((app) => (
              <motion.div 
                key={app.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 rounded-3xl border border-white/5 space-y-4 hover:border-primary/30 transition-all cursor-pointer"
                onClick={() => setReviewingUpdateApplicant(app)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface overflow-hidden border border-white/10 shrink-0">
                    <img src={app.photo} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{app.fullNameEnglish}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{app.id}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Date Requested</span>
                    <span className="text-white">
                      {app.updateRequestedAt?.toDate ? app.updateRequestedAt.toDate().toLocaleDateString() : "Unknown"}
                    </span>
                  </div>
                </div>
                <button className="w-full py-3 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all">
                  Review Changes
                </button>
              </motion.div>
            ))}
            {applicants.filter(a => a.hasUpdatePending).length === 0 && (
              <div className="col-span-full py-32 text-center space-y-4">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto opacity-20">
                  <CheckCircle size={40} className="text-slate-500" />
                </div>
                <h3 className="text-lg font-black text-slate-600 uppercase italic">No Updates Pending</h3>
              </div>
            )}
          </div>

          <AnimatePresence>
            {reviewingUpdateApplicant && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setReviewingUpdateApplicant(null)}
                  className="absolute inset-0 bg-bg-light/95 backdrop-blur-xl"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-5xl glass-card rounded-[3rem] h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-white/10"
                >
                  {/* Modal Header */}
                  <div className="p-8 border-b border-white/5 flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 rounded-[2rem] bg-surface overflow-hidden border-2 border-primary/20 p-1">
                        <img src={reviewingUpdateApplicant.photo} alt="" className="w-full h-full object-cover rounded-[1.8rem]" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Review Profile Update</h3>
                        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                          {reviewingUpdateApplicant.fullNameEnglish} — {reviewingUpdateApplicant.id}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setReviewingUpdateApplicant(null)}
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-slate-500 hover:text-white transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {/* Modal Content - Scrollable */}
                  <div className="flex-grow overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Current Data */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">Old</div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">Current Profile</h4>
                        </div>
                        <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                          {Object.keys(reviewingUpdateApplicant.pendingData).map((key) => {
                            const val = reviewingUpdateApplicant[key];
                            const newVal = reviewingUpdateApplicant.pendingData[key];
                            if (key === 'photo' || key === 'id' || key === 'password' || key === 'pendingData' || key === 'hasUpdatePending' || key === 'updateRequestedAt' || key === 'status' || key === 'createdAt') return null;
                            
                            return (
                              <div key={key} className="space-y-1">
                                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                                <p className="text-sm font-bold text-slate-400">{val || "—"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* New Data (Pending) */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-[10px] font-black text-emerald-500 uppercase">New</div>
                          <h4 className="text-sm font-black text-white uppercase tracking-widest">Proposed Changes</h4>
                        </div>
                        <div className="glass-card p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.02] space-y-4">
                          {Object.keys(reviewingUpdateApplicant.pendingData).map((key) => {
                            const val = reviewingUpdateApplicant[key];
                            const newVal = reviewingUpdateApplicant.pendingData[key];
                            if (key === 'photo' || key === 'id' || key === 'password' || key === 'pendingData' || key === 'hasUpdatePending' || key === 'updateRequestedAt' || key === 'status' || key === 'createdAt') return null;
                            
                            const isChanged = val !== newVal;
                            
                            return (
                              <div key={key} className={`space-y-1 p-2 rounded-lg transition-colors ${isChanged ? 'bg-emerald-500/10 border-l-2 border-emerald-500' : ''}`}>
                                <p className={`text-[8px] font-black uppercase tracking-widest ${isChanged ? 'text-emerald-500' : 'text-slate-500'}`}>
                                  {key.replace(/([A-Z])/g, ' $1').trim()} {isChanged && "✨"}
                                </p>
                                <p className={`text-sm font-bold ${isChanged ? 'text-white' : 'text-slate-400'}`}>{newVal || "—"}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-8 border-t border-white/5 bg-surface/50 flex gap-4">
                    <button 
                      onClick={async () => {
                        if (!confirm("Are you sure you want to REJECT these changes? The user will have to resubmit.")) return;
                        setProcessingUpdate(true);
                        try {
                          await updateDoc(doc(db, "applicants", reviewingUpdateApplicant.id), {
                            hasUpdatePending: false,
                            pendingData: null
                          });
                          
                          // Notification to user
                          await addDoc(collection(db, "notifications"), {
                            title: "Update Request Rejected",
                            message: "Your profile update request was rejected by an administrator. Please check your details and try again.",
                            type: "Alert",
                            targetId: reviewingUpdateApplicant.id,
                            timestamp: Timestamp.now(),
                            isRead: false
                          });

                          setReviewingUpdateApplicant(null);
                          alert("Update rejected.");
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setProcessingUpdate(false);
                        }
                      }}
                      disabled={processingUpdate}
                      className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                    >
                      Reject Changes
                    </button>
                    <button 
                      onClick={async () => {
                        if (!confirm("Are you sure you want to APPROVE and MERGE these changes?")) return;
                        setProcessingUpdate(true);
                        try {
                          const { pendingData, ...rest } = reviewingUpdateApplicant;
                          const mergedData = {
                            ...pendingData,
                            hasUpdatePending: false,
                            pendingData: null,
                            updatedAt: Timestamp.now()
                          };

                          await updateDoc(doc(db, "applicants", reviewingUpdateApplicant.id), mergedData);
                          
                          // Log activity
                          await addDoc(collection(db, "activity_logs"), {
                            type: "PROFILE_UPDATE_APPROVED",
                            targetId: reviewingUpdateApplicant.id,
                            actorId: adminSession.id,
                            timestamp: Timestamp.now(),
                            details: "Admin approved profile update request."
                          });

                          // Notification to user
                          await addDoc(collection(db, "notifications"), {
                            title: "Update Request Approved",
                            message: "Your profile has been successfully updated after administrator review.",
                            type: "Announcement",
                            targetId: reviewingUpdateApplicant.id,
                            timestamp: Timestamp.now(),
                            isRead: false
                          });

                          setReviewingUpdateApplicant(null);
                          alert("Update approved and merged!");
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setProcessingUpdate(false);
                        }
                      }}
                      disabled={processingUpdate}
                      className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      {processingUpdate ? <Loader2 className="animate-spin" /> : <ShieldCheck size={18} />}
                      Approve & Update Profile
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === "analytics" ? (
        <div className="space-y-8 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Applicant Distribution by Status */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                <PieChartIcon className="text-primary" size={20} />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Status Distribution</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Pending', value: stats.pending },
                        { name: 'Approved', value: stats.approved },
                        { name: 'Rejected', value: applicants.length - stats.pending - stats.approved }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {[
                        <Cell key="cell-0" fill="#f59e0b" />, // amber-500
                        <Cell key="cell-1" fill="#10b981" />, // emerald-500
                        <Cell key="cell-2" fill="#ef4444" />  // red-500
                      ]}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Applicant Distribution by Gender */}
            <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                <Users className="text-primary" size={20} />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Gender Distribution</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Male', count: applicants.filter(a => a.gender === 'Male').length },
                    { name: 'Female', count: applicants.filter(a => a.gender === 'Female').length },
                    { name: 'Other', count: applicants.filter(a => a.gender === 'Other' || a.gender === 'Others').length }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                    <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    />
                    <Bar dataKey="count" fill="#4ade80" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Blood Group Analytics */}
            <div className="md:col-span-2 glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
              <div className="flex items-center gap-2 mb-8">
                <Activity className="text-primary" size={20} />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Blood Group Availability</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => ({
                    group: bg,
                    count: applicants.filter(a => a.bloodGroup === bg).length
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="group" stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                    <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "broadcast" ? (
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
          <div className="glass-card p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Megaphone size={120} className="text-primary" />
            </div>
            
            <div className="relative z-10 text-center space-y-2">
              <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Bell className="text-primary" size={40} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Broadcast Notice</h2>
              <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em]">Send announcement to all registered cadets</p>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-3">Notice Title</label>
                <input 
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. Mandatory Training Session"
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl px-8 py-5 text-slate-200 outline-none focus:border-primary transition-all shadow-2xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-3">Message Content</label>
                <textarea 
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Write your official notice here..."
                  className="w-full bg-slate-900 border border-white/10 rounded-[2rem] px-8 py-6 text-slate-200 outline-none focus:border-primary transition-all min-h-[160px] shadow-2xl resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { id: 'Announcement', label: 'General', color: 'bg-blue-500', icon: Info },
                  { id: 'Alert', label: 'Urgent', color: 'bg-amber-500', icon: AlertCircle },
                  { id: 'Message', label: 'Note', color: 'bg-green-500', icon: MessageSquare }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setBroadcastType(type.id)}
                    className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${
                      broadcastType === type.id 
                        ? `bg-slate-900 border-white/20 text-white shadow-xl` 
                        : `bg-slate-900/50 border-white/5 text-slate-500 opacity-60`
                    }`}
                  >
                    <type.icon size={16} className={broadcastType === type.id ? `text-white` : `text-slate-600`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBroadcast}
                disabled={sendingBroadcast || !broadcastMessage.trim() || !broadcastTitle.trim()}
                className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 group"
              >
                {sendingBroadcast ? <Loader2 className="animate-spin" size={20} /> : <Megaphone size={20} className="group-hover:rotate-12 transition-transform" />}
                Send Broadcast Message
              </button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-white/5 flex items-start gap-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shrink-0 border border-white/5">
              <Shield className="text-primary" size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-[10px] font-black uppercase text-white tracking-widest">Protocol Notice</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Broadcast messages are sent instantly and will appear in the candidate's personal notification center. All transmissions are logged in the system audit trail.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === "admins" ? (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-primary" />
            এডমিন ম্যানেজার
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Administrative User Access Control</p>
        </div>
        <button
          onClick={() => setShowAddAdmin(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20"
        >
          <UserPlus className="w-4 h-4" /> নতুন এডমিন যোগ করুন
        </button>
      </div>

      <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">এডমিনের নাম</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">ইউজারনেম</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">রোল (Role)</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">তৈরির তারিখ</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {/* Static Super Admin Row */}
              <tr className="bg-slate-50/30">
                <td className="px-8 py-6 font-bold text-slate-800">Super Admin</td>
                <td className="px-8 py-6 font-mono text-xs text-slate-500">admin</td>
                <td className="px-8 py-6">
                  <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                    SUPER_ADMIN
                  </span>
                </td>
                <td className="px-8 py-6 text-xs text-slate-500 font-bold uppercase">Permanent</td>
                <td className="px-8 py-6 text-right">
                  <Shield className="w-5 h-5 text-emerald-500 inline-block" />
                </td>
              </tr>
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3 font-bold text-slate-800">
                      {admin.name}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-slate-500 font-mono text-xs">{admin.username}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-primary/20 bg-primary/5 text-primary">
                      ADMIN
                    </span>
                  </td>
                  <td className="px-8 py-6 text-xs text-slate-500">
                    {admin.createdAt?.toDate ? admin.createdAt.toDate().toLocaleDateString() : new Date(admin.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingAdminId(admin.id);
                          setEditPermissions(admin.permissions || {
                            canAdd: false,
                            canEdit: true,
                            canDelete: false,
                            canViewLogs: true,
                            canResetPW: false,
                            canApprove: true,
                            canExport: false,
                            canChat: true
                          });
                        }}
                        className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-primary rounded-xl transition-all"
                        title="Edit Permissions"
                      >
                        <Settings size={18} />
                      </button>
                      <button
                        onClick={() => deleteAdmin(admin.id)}
                        className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                        title="Delete Admin"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  ) : (
    <div className="space-y-6">
      <AuditLogs logs={logs.map(l => ({
        id: l.id,
        type: l.type,
        details: l.details,
        timestamp: l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : new Date().toISOString(),
        actorName: l.actorId,
        severity: (l.type.includes("DELETE") || l.type.includes("REJECT") || l.type.includes("ERROR")) ? "error" : "info"
      }))} />
    </div>
  )}

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showPasswordReset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordReset(null)}
              className="absolute inset-0 bg-bg-light/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 rounded-[2.5rem] space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Key className="text-primary" size={28} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Reset</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID: {showPasswordReset}</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">New Password Key</label>
                  <input 
                    type="text" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-primary shadow-xl"
                    placeholder="Set temporary password"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowPasswordReset(null)}
                  className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetPassword}
                  disabled={resetting || !newPassword}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {resetting ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Update Now"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Admin Modal */}
      <AnimatePresence>
        {showAddAdmin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddAdmin(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white p-10 rounded-[2.5rem] space-y-8 shadow-2xl border border-white"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <UserPlus className="text-primary" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">নতুন এডমিন যুক্ত করুন</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Add Administrative Sub-user</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">পুরো নাম</label>
                  <input 
                    type="text" 
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm text-slate-800 outline-none focus:border-primary transition-all"
                    placeholder="নাম লিখুন"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">ইউজারনেম (Username)</label>
                  <input 
                    type="text" 
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm text-slate-800 outline-none focus:border-primary transition-all"
                    placeholder="username (লগইন এ ব্যবহৃত হবে)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">পাসওয়ার্ড</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm text-slate-800 outline-none focus:border-primary transition-all"
                    placeholder="নিরাপদ পাসওয়ার্ড দিন"
                  />
                </div>

                <div className="pt-2 space-y-3">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">কাজের অনুমতি (Permissions)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'canAdd', label: 'ডাটা যোগ' },
                      { key: 'canEdit', label: 'ডাটা এডিট' },
                      { key: 'canDelete', label: 'ডাটা ডিলিট' },
                      { key: 'canViewLogs', label: 'লগ দেখা' },
                      { key: 'canResetPW', label: 'পাসওয়ার্ড রিসেট' },
                      { key: 'canApprove', label: 'অনুমোদন (Approve)' },
                      { key: 'canExport', label: 'এক্সপোর্ট (Excel/ZIP)' },
                      { key: 'canChat', label: 'মেসেঞ্জার অ্যাক্সেস' }
                    ].map((pref) => (
                      <label key={pref.key} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-all">
                        <input 
                          type="checkbox" 
                          checked={(adminPermissions as any)[pref.key]}
                          onChange={(e) => setAdminPermissions(prev => ({ ...prev, [pref.key]: e.target.checked }))}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-[11px] font-bold text-slate-700">{pref.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowAddAdmin(false)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                >
                  বাতিল
                </button>
                <button 
                  onClick={handleCreateAdmin}
                  disabled={creatingAdmin || !adminName || !adminUsername || !adminPassword}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {creatingAdmin ? <Loader2 className="animate-spin mx-auto" size={18} /> : "তৈরি করুন"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Permissions Modal */}
      <AnimatePresence>
        {editingAdminId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingAdminId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white p-10 rounded-[2.5rem] space-y-8 shadow-2xl border border-white"
            >
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
                  <Settings className="text-primary" size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">পারমিশন পরিবর্তন করুন</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Modify Access Level</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-2">কাজের অনুমতি পরিবর্তন (Dynamic Control)</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'canAdd', label: 'ডাটা যোগ', icon: <UserPlus size={14} /> },
                    { key: 'canEdit', label: 'ডাটা এডিট', icon: <Edit size={14} /> },
                    { key: 'canDelete', label: 'ডাটা ডিলিট', icon: <Trash2 size={14} /> },
                    { key: 'canViewLogs', label: 'লগ দেখা', icon: <History size={14} /> },
                    { key: 'canResetPW', label: 'পাসওয়ার্ড রিসেট', icon: <Key size={14} /> },
                    { key: 'canApprove', label: 'অনুমোদন', icon: <CheckCircle size={14} /> },
                    { key: 'canExport', label: 'এক্সপোর্ট', icon: <Download size={14} /> },
                    { key: 'canChat', label: 'মেসেঞ্জার', icon: <MessageSquare size={14} /> }
                  ].map((pref) => (
                    <label key={pref.key} className={`flex items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                      editPermissions?.[pref.key] ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-slate-50 border-slate-100 text-slate-500'
                    }`}>
                      <input 
                        type="checkbox" 
                        checked={editPermissions?.[pref.key]}
                        onChange={(e) => setEditPermissions((prev: any) => ({ ...prev, [pref.key]: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <div className="flex items-center gap-1.5">
                        {pref.icon}
                        <span className="text-[11px] font-bold">{pref.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setEditingAdminId(null)}
                  className="flex-1 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                >
                  বাতিল
                </button>
                <button 
                  onClick={handleUpdatePermissions}
                  disabled={updatingPermissions}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {updatingPermissions ? <Loader2 className="animate-spin mx-auto" size={18} /> : "আপডেট করুন"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
}
