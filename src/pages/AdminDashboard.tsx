import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, CheckCircle, XCircle, Clock, Download, Trash2, 
  Search, Filter, FileSpreadsheet, Archive, LogOut, Shield,
  QrCode, Scan, Calendar, Camera, X
} from "lucide-react";
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

  if (loading) return <div className="flex items-center justify-center h-screen text-white">তথ্য লোড হচ্ছে...</div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white p-4 text-center space-y-4">
        <XCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-bold">ত্রুটি ঘটেছে!</h2>
        <p className="text-slate-400 max-w-md">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-accent text-primary font-bold rounded-xl hover:bg-white transition-all"
        >
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white">অ্যাডমিন ড্যাশবোর্ড</h1>
          <p className="text-slate-400">সকল আবেদনকারী এবং তাদের স্ট্যাটাস পরিচালনা করুন</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-5 py-2.5 glass rounded-xl text-sm font-bold hover:bg-white/10"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-400" /> Excel এক্সপোর্ট
          </button>
          <button
            onClick={downloadPhotosZip}
            className="flex items-center gap-2 px-5 py-2.5 glass rounded-xl text-sm font-bold hover:bg-white/10"
          >
            <Archive className="w-4 h-4 text-accent" /> ফটো জিপ (ZIP)
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-sm font-bold hover:bg-red-500/20"
          >
            <LogOut className="w-4 h-4" /> লগআউট
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "মোট আবেদন", value: stats.total, icon: Users, color: "text-blue-400" },
          { label: "পেন্ডিং", value: stats.pending, icon: Clock, color: "text-yellow-400" },
          { label: "অনুমোদিত", value: stats.approved, icon: CheckCircle, color: "text-green-400" },
          { label: "উপস্থিত", value: stats.present, icon: Scan, color: "text-accent" }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="নাম অথবা কলেজ আইডি দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-accent outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-5 py-3 bg-accent text-primary rounded-xl text-sm font-bold hover:bg-white transition-all"
          >
            <QrCode className="w-4 h-4" /> QR স্ক্যানার
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none text-sm"
          >
            <option value="All">সকল স্ট্যাটাস</option>
            <option value="Pending">পেন্ডিং</option>
            <option value="Approved">অনুমোদিত</option>
            <option value="Rejected">বাতিল</option>
          </select>
          <select
            value={attendanceFilter}
            onChange={(e) => setAttendanceFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-accent outline-none text-sm"
          >
            <option value="All">উপস্থিতি (সকল)</option>
            <option value="Present">উপস্থিত (Present)</option>
            <option value="Absent">অনুপস্থিত (Absent)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">আবেদনকারী</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">শ্রেণি ও রোল</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">স্ট্যাটাস</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">উপস্থিতি</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredApplicants.map((app) => (
                <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                        {app.photo ? (
                          <img src={app.photo} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Users className="w-full h-full p-2 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">{app.fullNameEnglish || app.fullNameBangla}</p>
                          <button 
                            onClick={() => window.open(`/admit-card/${app.id}?download=true`, '_blank')}
                            className="text-accent hover:text-white transition-colors"
                            title="Download Admit Card"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">{app.studentPhone || "No Mobile"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-300">{app.studyStatus} | Roll: {app.classRoll}</p>
                    <p className="text-xs text-slate-500">ID: {app.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'Approved' ? 'bg-green-500/10 text-green-400' :
                      app.status === 'Rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`inline-flex items-center gap-1.5 font-bold text-[10px] uppercase ${
                        app.attendanceStatus === 'Present' ? 'text-accent' : 'text-slate-500'
                      }`}>
                        {app.attendanceStatus === 'Present' ? (
                          <><CheckCircle className="w-3 h-3" /> Present</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Absent</>
                        )}
                      </span>
                      {app.attendanceTime && (
                        <span className="text-[9px] text-slate-600 mt-0.5">
                          {new Date(app.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => window.open(`/admit-card/${app.id}?download=true`, '_blank')}
                        className="p-2 hover:bg-accent/10 text-slate-500 hover:text-accent rounded-lg transition-colors"
                        title="Download Admit Card"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, undefined as any, app.attendanceStatus === 'Present' ? 'Absent' : 'Present')}
                        className={`p-2 rounded-lg transition-colors ${
                          app.attendanceStatus === 'Present' ? 'text-accent hover:bg-accent/10' : 'text-slate-500 hover:bg-white/5'
                        }`}
                        title={app.attendanceStatus === 'Present' ? "Mark Absent" : "Mark Present"}
                      >
                        <Scan className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'Approved')}
                        className="p-2 hover:bg-green-500/10 text-slate-500 hover:text-green-400 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'Rejected')}
                        className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteApplicant(app.id)}
                        className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
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
        {filteredApplicants.length === 0 && (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500">কোনো আবেদনকারী পাওয়া যায়নি।</p>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#000814] border border-white/10 w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                  <Camera className="w-5 h-5 text-accent" />
                </div>
                <h2 className="text-xl font-bold text-white">QR এটেনডেন্স স্ক্যানার</h2>
              </div>
              <button 
                onClick={() => {
                  setShowScanner(false);
                  setScannedApplicant(null);
                }}
                className="p-2 hover:bg-white/5 rounded-full text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!scannedApplicant ? (
                <div className="space-y-4">
                  <div id="reader" className="overflow-hidden rounded-2xl border-2 border-accent/20"></div>
                  <p className="text-center text-sm text-slate-400">প্রবেশপত্রের QR কোডটি ক্যামেরার সামনে ধরুন</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-4 p-4 bg-accent/10 border border-accent/20 rounded-2xl">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-accent">
                      <img src={scannedApplicant.photo} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{scannedApplicant.fullNameEnglish || scannedApplicant.fullNameBangla}</h3>
                      <p className="text-accent font-bold text-sm uppercase tracking-wider">উপস্থিতি সফল!</p>
                      <p className="text-xs text-slate-400 mt-1">ID: {scannedApplicant.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-[10px] uppercase text-slate-500 font-bold">Class</p>
                      <p className="text-white font-bold">{scannedApplicant.studyStatus}</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-xl">
                      <p className="text-[10px] uppercase text-slate-500 font-bold">Roll</p>
                      <p className="text-white font-bold">{scannedApplicant.classRoll}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setScannedApplicant(null)}
                    className="w-full py-4 bg-accent text-primary font-bold rounded-xl hover:bg-white transition-all"
                  >
                    পরবর্তী স্ক্যান করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
