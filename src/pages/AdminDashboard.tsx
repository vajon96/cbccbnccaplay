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

  if (loading) return <div className="flex items-center justify-center h-screen text-black">তথ্য লোড হচ্ছে...</div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-black p-4 text-center space-y-4">
        <XCircle className="w-16 h-16 text-primary" />
        <h2 className="text-xl font-bold">ত্রুটি ঘটেছে!</h2>
        <p className="text-black/70 max-w-md">{error}</p>
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
    <div className="min-h-screen bg-sand">
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
          { label: "মোট আবেদন", value: stats.total, icon: Users, color: "text-black/70" },
          { label: "পেন্ডিং", value: stats.pending, icon: Clock, color: "text-amber-600" },
          { label: "অনুমোদিত", value: stats.approved, icon: CheckCircle, color: "text-primary" },
          { label: "উপস্থিত", value: stats.present, icon: Scan, color: "text-accent" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-sand shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-xs font-bold text-black/30 uppercase tracking-widest">Stats</span>
            </div>
            <p className="text-2xl font-bold text-black">{stat.value}</p>
            <p className="text-xs text-black/70">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
          <input
            type="text"
            placeholder="নাম অথবা কলেজ আইডি দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-sand rounded-xl pl-12 pr-4 py-3 text-black focus:border-accent outline-none transition-colors"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            <QrCode className="w-4 h-4" /> QR স্ক্যানার
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-sand rounded-xl px-4 py-3 text-black focus:border-accent outline-none text-sm cursor-pointer"
          >
            <option value="All">সকল স্ট্যাটাস</option>
            <option value="Pending">পেন্ডিং</option>
            <option value="Approved">অনুমোদিত</option>
            <option value="Rejected">বাতিল</option>
          </select>
          <select
            value={attendanceFilter}
            onChange={(e) => setAttendanceFilter(e.target.value)}
            className="bg-white border border-sand rounded-xl px-4 py-3 text-black focus:border-accent outline-none text-sm cursor-pointer"
          >
            <option value="All">উপস্থিতি (সকল)</option>
            <option value="Present">উপস্থিত (Present)</option>
            <option value="Absent">অনুপস্থিত (Absent)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-sand shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-white border-b border-sand">
                <th className="px-6 py-4 text-xs font-bold uppercase">আবেদনকারী</th>
                <th className="px-6 py-4 text-xs font-bold uppercase">শ্রেণি ও রোল</th>
                <th className="px-6 py-4 text-xs font-bold uppercase">স্ট্যাটাস</th>
                <th className="px-6 py-4 text-xs font-bold uppercase">উপস্থিতি</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand/20">
              {filteredApplicants.map((app) => (
                <tr key={app.id} className="hover:bg-sand/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-sand/10 overflow-hidden border border-sand">
                        {app.photo ? (
                          <img src={app.photo} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <Users className="w-full h-full p-2 text-black/20" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-black">{app.fullNameEnglish || app.fullNameBangla}</p>
                          <button 
                            onClick={() => window.open(`/admit-card/${app.id}?download=true`, '_blank')}
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="Download Admit Card"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs text-black/50">{app.studentPhone || "No Mobile"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-black/70">{app.studyStatus} | Roll: {app.classRoll}</p>
                    <p className="text-xs text-black/40">ID: {app.id}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      app.status === 'Approved' ? 'bg-primary/20 text-primary' :
                      app.status === 'Rejected' ? 'bg-accent/20 text-accent' :
                      'bg-amber-200 text-amber-800'
                    }`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className={`inline-flex items-center gap-1.5 font-bold text-[10px] uppercase ${
                        app.attendanceStatus === 'Present' ? 'text-primary' : 'text-black/30'
                      }`}>
                        {app.attendanceStatus === 'Present' ? (
                          <><CheckCircle className="w-3 h-3" /> Present</>
                        ) : (
                          <><Clock className="w-3 h-3" /> Absent</>
                        )}
                      </span>
                      {app.attendanceTime && (
                        <span className="text-[9px] text-black/40 mt-0.5">
                          {new Date(app.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => window.open(`/admit-card/${app.id}?download=true`, '_blank')}
                        className="p-2 hover:bg-primary/10 text-black/30 hover:text-primary rounded-lg transition-colors"
                        title="Download Admit Card"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, undefined as any, app.attendanceStatus === 'Present' ? 'Absent' : 'Present')}
                        className={`p-2 rounded-lg transition-colors ${
                          app.attendanceStatus === 'Present' ? 'text-primary hover:bg-primary/10' : 'text-black/30 hover:bg-sand/10'
                        }`}
                        title={app.attendanceStatus === 'Present' ? "Mark Absent" : "Mark Present"}
                      >
                        <Scan className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'Approved')}
                        className="p-2 hover:bg-primary/10 text-black/30 hover:text-primary rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => updateStatus(app.id, 'Rejected')}
                        className="p-2 hover:bg-accent/10 text-black/30 hover:text-accent rounded-lg transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteApplicant(app.id)}
                        className="p-2 hover:bg-accent/10 text-black/30 hover:text-accent rounded-lg transition-colors"
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
            <Users className="w-12 h-12 text-black/10 mx-auto mb-4" />
            <p className="text-black/30">কোনো আবেদনকারী পাওয়া যায়নি।</p>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white border border-sand w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-6 bg-primary text-white border-b border-sand flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">QR এটেনডেন্স স্ক্যানার</h2>
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

            <div className="p-6 space-y-6">
              {!scannedApplicant ? (
                <div className="space-y-4">
                  <div id="reader" className="overflow-hidden rounded-2xl border-2 border-primary/20"></div>
                  <p className="text-center text-sm text-black/50 font-medium">প্রবেশপত্রের QR কোডটি ক্যামেরার সামনে ধরুন</p>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                    <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-primary">
                      <img src={scannedApplicant.photo} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-black">{scannedApplicant.fullNameEnglish || scannedApplicant.fullNameBangla}</h3>
                      <p className="text-primary font-bold text-sm uppercase tracking-wider">উপস্থিতি সফল!</p>
                      <p className="text-xs text-black/40 mt-1">ID: {scannedApplicant.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-sand/10 rounded-xl border border-sand">
                      <p className="text-[10px] uppercase text-black/40 font-bold">Class</p>
                      <p className="text-black font-bold">{scannedApplicant.studyStatus}</p>
                    </div>
                    <div className="p-4 bg-sand/10 rounded-xl border border-sand">
                      <p className="text-[10px] uppercase text-black/40 font-bold">Roll</p>
                      <p className="text-black font-bold">{scannedApplicant.classRoll}</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setScannedApplicant(null)}
                    className="w-full py-4 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
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
    </div>
  );
}
