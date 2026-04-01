import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, CheckCircle, XCircle, Clock, Download, Trash2, 
  Search, Filter, FileSpreadsheet, Archive, LogOut, Shield,
  QrCode, Scan, Calendar, Camera, X, Terminal
} from "lucide-react";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { Html5QrcodeScanner } from "html5-qrcode";
import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, Timestamp, handleFirestoreError, OperationType } from "../firebase";

export function AdminDashboard() {
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [attendanceFilter, setAttendanceFilter] = useState("All");
  const [showScanner, setShowScanner] = useState(false);
  const [scannedApplicant, setScannedApplicant] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const passwordVerified = localStorage.getItem("adminPasswordVerified");
    if (!passwordVerified) {
      navigate("/admin");
      return;
    }

    const q = query(collection(db, "applicants"), orderBy("createdAt", "desc"));
    const path = "applicants";
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
      setError("ডেটা লোড করতে সমস্যা হচ্ছে। অনুগ্রহ করে আপনার ইন্টারনেট সংযোগ অথবা ফায়ারবেস কনফিগারেশন চেক করুন।");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("adminPasswordVerified");
    navigate("/admin");
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

  const stats = {
    total: applicants.length,
    pending: applicants.filter(a => a.status === 'Pending').length,
    approved: applicants.filter(a => a.status === 'Approved').length,
    present: applicants.filter(a => a.attendanceStatus === 'Present').length,
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-900">তথ্য লোড হচ্ছে...</div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-slate-900 p-4 text-center space-y-4">
        <XCircle className="w-16 h-16 text-primary" />
        <h2 className="text-xl font-bold">ত্রুটি ঘটেছে!</h2>
        <p className="text-slate-600 max-w-md">{error}</p>
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
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-8 border-b-2 border-ink/5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="micro-label">Command Center</span>
            </div>
            <h1 className="text-4xl font-black text-ink uppercase tracking-tighter">Admin Dashboard</h1>
            <p className="text-ink/40 text-sm font-medium">Personnel Management & Operational Oversight</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-ink/5 text-ink font-bold text-xs uppercase tracking-widest hover:bg-ink hover:text-white transition-all duration-300 rounded-sm shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export Data
            </button>
            <button
              onClick={downloadPhotosZip}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-ink/5 text-ink font-bold text-xs uppercase tracking-widest hover:bg-ink hover:text-white transition-all duration-300 rounded-sm shadow-sm"
            >
              <Archive className="w-4 h-4" /> Archive Photos
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-accent/5 border-2 border-accent/20 text-accent font-bold text-xs uppercase tracking-widest hover:bg-accent hover:text-white transition-all duration-300 rounded-sm shadow-sm"
            >
              <LogOut className="w-4 h-4" /> Terminate Session
            </button>
          </div>
        </div>

        {/* Tactical Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Personnel", value: stats.total, icon: Users, color: "text-ink" },
            { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-600" },
            { label: "Authorized", value: stats.approved, icon: CheckCircle, color: "text-primary" },
            { label: "On-Site Presence", value: stats.present, icon: Scan, color: "text-olive" }
          ].map((stat, i) => (
            <div key={i} className="glass-card p-8 rounded-sm border-t-4 border-primary relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <stat.icon className="w-16 h-16" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="micro-label">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-ink tracking-tighter">{stat.value}</p>
                  <span className="text-[10px] font-bold text-ink/20 uppercase tracking-widest">Units</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Operational Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-5 space-y-2">
            <label className="micro-label">Personnel Search</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/20" />
              <input
                type="text"
                placeholder="SEARCH BY NAME, ROLL, OR ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border-b-2 border-ink/10 pl-12 pr-4 py-4 text-sm font-bold focus:border-primary outline-none transition-all placeholder:text-ink/20"
              />
            </div>
          </div>
          
          <div className="lg:col-span-7 flex flex-wrap items-center gap-4">
            <div className="flex-grow space-y-2 min-w-[160px]">
              <label className="micro-label">Status Filter</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-white border-b-2 border-ink/10 px-4 py-4 text-sm font-bold focus:border-primary outline-none cursor-pointer appearance-none"
              >
                <option value="All">ALL STATUSES</option>
                <option value="Pending">PENDING REVIEW</option>
                <option value="Approved">AUTHORIZED</option>
                <option value="Rejected">DENIED</option>
              </select>
            </div>

            <div className="flex-grow space-y-2 min-w-[160px]">
              <label className="micro-label">Presence Filter</label>
              <select
                value={attendanceFilter}
                onChange={(e) => setAttendanceFilter(e.target.value)}
                className="w-full bg-white border-b-2 border-ink/10 px-4 py-4 text-sm font-bold focus:border-primary outline-none cursor-pointer appearance-none"
              >
                <option value="All">ALL PERSONNEL</option>
                <option value="Present">PRESENT ON-SITE</option>
                <option value="Absent">ABSENT / OFF-SITE</option>
              </select>
            </div>

            <button
              onClick={() => setShowScanner(true)}
              className="px-8 py-4 bg-ink text-white font-black uppercase tracking-widest text-xs rounded-sm flex items-center gap-3 btn-hover shadow-xl shadow-ink/20 mt-auto"
            >
              <QrCode className="w-4 h-4" /> Initialize Scanner
            </button>
          </div>
        </div>

        {/* Personnel Registry Table */}
        <div className="glass-card rounded-sm overflow-hidden border-t-4 border-ink">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-ink/5 border-b-2 border-ink/10">
                  <th className="px-8 py-6"><span className="micro-label">Personnel Identity</span></th>
                  <th className="px-8 py-6"><span className="micro-label">Academic Profile</span></th>
                  <th className="px-8 py-6"><span className="micro-label">Authorization</span></th>
                  <th className="px-8 py-6"><span className="micro-label">Presence Log</span></th>
                  <th className="px-8 py-6 text-right"><span className="micro-label">Operations</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {filteredApplicants.map((app) => (
                  <tr key={app.id} className="hover:bg-ink/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-6">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-sm bg-ink/5 overflow-hidden border-2 border-ink/10 group-hover:border-primary transition-colors">
                            {app.photo ? (
                              <img src={app.photo} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Users className="w-full h-full p-3 text-ink/10" />
                            )}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                            app.attendanceStatus === 'Present' ? 'bg-olive' : 'bg-ink/20'
                          }`} />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-ink uppercase tracking-tight leading-none">
                              {app.fullNameEnglish || app.fullNameBangla}
                            </p>
                          </div>
                          <p className="font-mono text-[10px] text-ink/40 font-bold tracking-wider">
                            {app.studentPhone || "NO CONTACT DATA"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-ink uppercase tracking-tight">
                          {app.studyStatus} <span className="text-ink/20 mx-1">|</span> ROLL: {app.classRoll}
                        </p>
                        <p className="font-mono text-[9px] text-primary font-bold tracking-widest uppercase">
                          UID: {app.id.slice(0, 12)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border-2 ${
                        app.status === 'Approved' ? 'bg-primary/5 border-primary/20 text-primary' :
                        app.status === 'Rejected' ? 'bg-accent/5 border-accent/20 text-accent' :
                        'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {app.status === 'Approved' ? 'Authorized' : app.status === 'Rejected' ? 'Denied' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${
                          app.attendanceStatus === 'Present' ? 'text-olive' : 'text-ink/20'
                        }`}>
                          {app.attendanceStatus === 'Present' ? (
                            <><CheckCircle className="w-3 h-3" /> On-Site</>
                          ) : (
                            <><Clock className="w-3 h-3" /> Off-Site</>
                          )}
                        </div>
                        {app.attendanceTime && (
                          <p className="font-mono text-[9px] text-ink/40 font-bold">
                            LOGGED: {new Date(app.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => window.open(`/admit-card/${app.id}?download=true`, '_blank')}
                          className="p-2.5 hover:bg-ink hover:text-white text-ink/40 rounded-sm transition-all"
                          title="Download Credentials"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(app.id, undefined as any, app.attendanceStatus === 'Present' ? 'Absent' : 'Present')}
                          className={`p-2.5 rounded-sm transition-all ${
                            app.attendanceStatus === 'Present' ? 'bg-olive/10 text-olive hover:bg-olive hover:text-white' : 'text-ink/40 hover:bg-ink hover:text-white'
                          }`}
                          title={app.attendanceStatus === 'Present' ? "Log Departure" : "Log Arrival"}
                        >
                          <Scan className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(app.id, 'Approved')}
                          className="p-2.5 hover:bg-primary hover:text-white text-ink/40 rounded-sm transition-all"
                          title="Authorize"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(app.id, 'Rejected')}
                          className="p-2.5 hover:bg-accent hover:text-white text-ink/40 rounded-sm transition-all"
                          title="Deny"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteApplicant(app.id)}
                          className="p-2.5 hover:bg-accent hover:text-white text-ink/40 rounded-sm transition-all"
                          title="Purge Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredApplicants.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <Users className="w-16 h-16 text-ink/5 mx-auto" />
              <div className="space-y-1">
                <p className="text-ink/40 font-black uppercase tracking-widest text-xs">No Records Found</p>
                <p className="text-ink/20 text-[10px] font-bold">Query returned zero personnel units</p>
              </div>
            </div>
          )}
        </div>

        {/* System Footer */}
        <div className="pt-12 border-t border-ink/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-ink/20">
            <Terminal size={14} />
            <span className="text-[9px] font-black uppercase tracking-widest">Secure Command Interface v4.0.2-Stable</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[9px] font-black uppercase tracking-widest text-ink/20">Encryption: AES-256</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-ink/20">Status: Operational</span>
          </div>
        </div>
      </div>

      {/* Tactical Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-paper border-t-4 border-primary w-full max-w-lg rounded-sm overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-ink/5 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="micro-label">Optical Recognition</span>
                </div>
                <h2 className="text-2xl font-black text-ink uppercase tracking-tighter">QR Attendance Scanner</h2>
              </div>
              <button 
                onClick={() => {
                  setShowScanner(false);
                  setScannedApplicant(null);
                }}
                className="p-2 hover:bg-ink hover:text-white rounded-sm text-ink/20 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {!scannedApplicant ? (
                <div className="space-y-6">
                  <div id="reader" className="overflow-hidden rounded-sm border-2 border-ink/10 bg-ink/[0.02]"></div>
                  <div className="flex items-center justify-center gap-3 text-ink/40">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Awaiting Tactical Scan...</p>
                  </div>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-6 p-6 bg-primary/5 border-2 border-primary/20 rounded-sm">
                    <div className="w-24 h-24 rounded-sm overflow-hidden border-2 border-primary shadow-lg">
                      <img src={scannedApplicant.photo} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-ink uppercase tracking-tighter leading-tight">
                        {scannedApplicant.fullNameEnglish || scannedApplicant.fullNameBangla}
                      </h3>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <p className="text-primary font-black text-[10px] uppercase tracking-widest">Presence Verified</p>
                      </div>
                      <p className="font-mono text-[9px] text-ink/40 font-bold tracking-widest">ID: {scannedApplicant.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-ink/[0.02] rounded-sm border-2 border-ink/5">
                      <p className="micro-label mb-1">Assigned Class</p>
                      <p className="text-ink font-black uppercase tracking-tight">{scannedApplicant.studyStatus}</p>
                    </div>
                    <div className="p-6 bg-ink/[0.02] rounded-sm border-2 border-ink/5">
                      <p className="micro-label mb-1">Registry Roll</p>
                      <p className="text-ink font-black uppercase tracking-tight">{scannedApplicant.classRoll}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setScannedApplicant(null)}
                    className="w-full py-5 bg-ink text-white font-black uppercase tracking-widest text-xs rounded-sm hover:bg-primary transition-all duration-300 shadow-xl shadow-ink/20"
                  >
                    Reset Scanner for Next Unit
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>

  );
}
