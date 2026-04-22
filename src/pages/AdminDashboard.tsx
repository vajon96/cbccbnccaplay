import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, CheckCircle, XCircle, Clock, Download, Trash2, 
  Search, Filter, FileSpreadsheet, Archive, LogOut, Shield,
  QrCode, Scan, Calendar, Camera, X, Sparkles, BrainCircuit, Info,
  History, Key, Edit, Save, AlertCircle, Loader2, Eye, EyeOff, ExternalLink,
  MessageSquare, UserPlus
} from "lucide-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { Html5QrcodeScanner } from "html5-qrcode";
import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, Timestamp, handleFirestoreError, OperationType, addDoc, where, getDocs } from "../firebase";
import { getAdminInsights, getApplicantSummary } from "../services/geminiService";
import { getSession, clearSession, hashPassword } from "../lib/auth";

export function AdminDashboard() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [attendanceFilter, setAttendanceFilter] = useState("All");
  const [showScanner, setShowScanner] = useState(false);
  const [scannedApplicant, setScannedApplicant] = useState<any>(null);
  const [aiInsights, setAiInsights] = useState("");
  const [isAnalyzingInsights, setIsAnalyzingInsights] = useState(false);
  const [applicantSummaries, setApplicantSummaries] = useState<{[key: string]: string}>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"applicants" | "logs" | "admins">("applicants");
  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminSession, setAdminSession] = useState<any>(null);
  
  // Create Admin State
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
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

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    }
  }, [showScanner]);

  const onScanSuccess = async (decodedText: string) => {
    let id = "";
    try {
      // Try to parse as JSON first (new format)
      const data = JSON.parse(decodedText);
      id = data.id;
    } catch (e) {
      // Fallback to old format or raw ID
      id = decodedText;
    }

    if (!id) return;

    const path = `applicants/${id}`;
    try {
      const docRef = doc(db, "applicants", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const applicant = docSnap.data();
        await updateDoc(docRef, {
          attendanceStatus: "Present",
          attendanceTime: Timestamp.now()
        });
        setScannedApplicant({ ...applicant, id });
      } else {
        alert("আবেদনকারী পাওয়া যায়নি! (ID: " + id + ")");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const onScanFailure = (error: any) => {
    // console.warn(`Code scan error = ${error}`);
  };

  const handleResetPassword = async () => {
    if (!showPasswordReset || !newPassword) return;
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

  const updateStatus = async (id: string, status?: string, attendanceStatus?: string) => {
    const path = `applicants/${id}`;
    try {
      const docRef = doc(db, "applicants", id);
      const updates: any = {};
      if (status) updates.status = status;
      if (attendanceStatus) {
        updates.attendanceStatus = attendanceStatus;
        if (attendanceStatus === "Present") {
          updates.attendanceTime = Timestamp.now();
        } else {
          updates.attendanceTime = null;
        }
      }
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteApplicant = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?")) return;
    const path = `applicants/${id}`;
    try {
      await deleteDoc(doc(db, "applicants", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const exportToExcel = () => {
    const dataToExport = applicants.map(({ photo, ...rest }) => ({
      ...rest,
      attendanceTime: rest.attendanceTime ? new Date(rest.attendanceTime).toLocaleString() : "N/A",
      createdAt: new Date(rest.createdAt).toLocaleString()
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applicants_Attendance");
    XLSX.writeFile(workbook, `BNCC_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
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
    const matchesAttendance = attendanceFilter === "All" || app.attendanceStatus === attendanceFilter;
    return matchesSearch && matchesStatus && matchesAttendance;
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
    present: applicants.filter(a => a.attendanceStatus === 'Present').length,
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
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel এক্সপোর্ট
            </button>
            <button
              onClick={downloadPhotosZip}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg"
            >
              <Archive className="w-4 h-4" /> ফটো জিপ (ZIP)
            </button>
            <button
              onClick={() => navigate("/messenger")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20"
            >
              <MessageSquare className="w-4 h-4" /> Messenger
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
          { label: "পেন্ডিং", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "অনুমোদিত", value: stats.approved, icon: CheckCircle, color: "text-primary" },
          { label: "উপস্থিত", value: stats.present, icon: Scan, color: "text-emerald-500" }
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
          className={`px-6 py-3 text-sm font-black uppercase tracking-widest transition-all relative ${
            activeTab === "logs" ? "text-primary" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <History size={18} />
            Activity Logs
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
      </div>

      {activeTab === "applicants" ? (
        <>
          <div className="space-y-6">
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
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-6 py-4 bg-accent text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-xl shadow-accent/20"
          >
            <QrCode className="w-4 h-4" /> QR স্ক্যানার
          </button>
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
          <select
            value={attendanceFilter}
            onChange={(e) => setAttendanceFilter(e.target.value)}
            className="bg-surface border border-white/10 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-white focus:border-primary outline-none cursor-pointer shadow-xl appearance-none"
          >
            <option value="All">উপস্থিতি (সকল)</option>
            <option value="Present">উপস্থিত</option>
            <option value="Absent">অনুপস্থিত</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">নথিভুক্ত ক্যাডেট</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">শ্রেণি ও রোল</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">স্ট্যাটাস</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-center">উপস্থিতি</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredApplicants.map((app) => (
                <tr key={app.id} className="hover:bg-white/[0.02] transition-colors group">
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
                  <td className="px-8 py-6">
                    <div className="flex flex-col items-center">
                      <span className={`inline-flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest ${
                        app.attendanceStatus === 'Present' ? 'text-emerald-500' : 'text-slate-500'
                      }`}>
                        {app.attendanceStatus === 'Present' ? (
                          <><CheckCircle className="w-3 h-3" /> Present</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Absent</>
                        )}
                      </span>
                      {app.attendanceTime && (
                        <span className="text-[8px] font-bold text-slate-600 mt-1">
                          {new Date(app.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
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
                        className="p-2.5 hover:bg-white/5 text-slate-500 hover:text-white rounded-xl transition-all"
                        title="Login as User"
                      >
                        <ExternalLink className="w-5 h-5" />
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
                        onClick={() => updateStatus(app.id, undefined as any, app.attendanceStatus === 'Present' ? 'Absent' : 'Present')}
                        className={`p-2.5 rounded-xl transition-all ${
                          app.attendanceStatus === 'Present' ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-500 hover:bg-white/5'
                        }`}
                        title="Attendance"
                      >
                        <Scan className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'Approved')}
                        className="p-2.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 rounded-xl transition-all"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowPasswordReset(app.id)}
                        className="p-2.5 hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 rounded-xl transition-all"
                        title="Reset PW"
                      >
                        <Key className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteApplicant(app.id)}
                        className="p-2.5 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-xl transition-all"
                        title="Delete"
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
        {filteredApplicants.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/30">কোনো আবেদনকারী পাওয়া যায়নি।</p>
          </div>
        )}
      </div>
    </>
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
                    <button
                      onClick={() => deleteAdmin(admin.id)}
                      className="p-2.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
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
          <div className="bg-white p-8 rounded-[2rem] border border-sand shadow-xl">
            <h3 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
              <History className="text-primary" />
              System Activity Logs
            </h3>
            <div className="space-y-4">
              {logs.length === 0 ? (
                <p className="text-center py-12 text-black/30 italic">No activity logs found.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-4 bg-sand/10 border border-sand/20 rounded-2xl flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${
                      log.type === 'PASSWORD_CHANGED' || log.type === 'PASSWORD_RESET_BY_ADMIN' ? 'bg-red-100 text-red-600' :
                      log.type === 'ACCOUNT_CREATED' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {log.type === 'PASSWORD_CHANGED' || log.type === 'PASSWORD_RESET_BY_ADMIN' ? <Key size={16} /> :
                       log.type === 'ACCOUNT_CREATED' ? <CheckCircle size={16} /> : <Edit size={16} />}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/40">{log.type}</span>
                        <span className="text-[10px] text-black/30">{log.timestamp?.toDate().toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium text-black/80">{log.details}</p>
                      <div className="mt-2 flex items-center gap-4">
                        <span className="text-[10px] font-bold text-black/40">Target: <span className="text-black/70">{log.targetId}</span></span>
                        <span className="text-[10px] font-bold text-black/40">Actor: <span className="text-black/70">{log.actorId}</span></span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-light/80 backdrop-blur-md">
          <div className="glass-card border border-white/10 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-6 bg-primary text-white border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Attendance QR</h2>
              </div>
              <button 
                onClick={() => {
                  setShowScanner(false);
                  setScannedApplicant(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full text-white/60 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6 bg-slate-900/50">
              {!scannedApplicant ? (
                <div className="space-y-4">
                  <div id="reader" className="overflow-hidden rounded-[2rem] border-4 border-primary/20 shadow-2xl"></div>
                  <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-widest">Point camera at Admit Card QR</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-5 p-6 bg-primary/5 border border-primary/10 rounded-3xl">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-slate-900 shadow-2xl">
                      <img src={scannedApplicant.photo} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">{scannedApplicant.fullNameEnglish}</h3>
                      <p className="text-primary font-black text-xs uppercase tracking-widest mt-1">Verification Success!</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">ID: {scannedApplicant.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Class</p>
                      <p className="text-white font-black text-sm">{scannedApplicant.studyStatus}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Roll</p>
                      <p className="text-white font-black text-sm">{scannedApplicant.classRoll}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setScannedApplicant(null)}
                    className="w-full py-4 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    Scan Next Cadet
                  </button>
                </div>
              )}
            </div>
          </div>
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
    </div>
  </div>
);
}
