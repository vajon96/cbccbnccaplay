import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scan,
  LogOut,
  Shield,
  QrCode,
  Camera,
  FileSpreadsheet,
  CheckCircle,
  User,
  Clock,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Html5QrcodeScanner } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import {
  db,
  doc,
  updateDoc,
  getDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
} from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getServerAuthHeaders } from "../lib/auth";
import { isQrInspectorRole, getRoleLabel } from "../lib/rbac";
import { apiFetch, appRouteUrl } from "../lib/api";

export function Admin2Dashboard() {
  const { user: authUser, firebaseUser, loading: authLoading, logout } = useAuth();
  const [scanning, setScanning] = useState(true);
  const [scannerNonce, setScannerNonce] = useState(0);
  const [scannedApplicant, setScannedApplicant] = useState<any>(null);
  const [manualIdInput, setManualIdInput] = useState("");
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const navigate = useNavigate();

  const authorized = Boolean(authUser && isQrInspectorRole(authUser.role));

  useEffect(() => {
    if (authLoading) return;
    if (!authorized) {
      navigate("/admin2", { replace: true });
    }
  }, [authLoading, authorized, navigate]);

  useEffect(() => {
    if (authLoading || !authorized || !scanning || scannedApplicant) return;

    let isActive = true;
    let scanner: Html5QrcodeScanner | null = null;

    const initScanner = () => {
      if (!isActive) return;
      const targetElement = document.getElementById("reader-admin2");
      if (!targetElement) {
        setTimeout(initScanner, 60);
        return;
      }

      try {
        scanner = new Html5QrcodeScanner(
          "reader-admin2",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scanner.render(
          async (decodedText) => {
            if (!isActive) return;
            await processAttendanceScan(decodedText);
          },
          () => {
            // Ignore per-frame decode misses
          }
        );
      } catch (err) {
        console.error("Scanner initialization failed in Admin2Dashboard:", err);
      }
    };

    const timer = setTimeout(initScanner, 120);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (scanner) {
        try {
          scanner.clear().catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [authLoading, authorized, scanning, scannedApplicant, scannerNonce]);

  const processAttendanceScan = async (decodedText: string) => {
    let id = "";
    try {
      const data = JSON.parse(decodedText);
      id = String(data.id || data.registrationNumber || "").trim();
    } catch {
      id = String(decodedText || "").trim();
    }

    if (!id) return;
    setError(null);

    // 1. If Firebase Auth session is active, update Firestore directly first
    if (firebaseUser) {
      try {
        const docRef = doc(db, "applicants", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const applicant = docSnap.data();
          if (applicant.attendanceStatus === "Present") {
            setScannedApplicant({ ...applicant, id, alreadyPresent: true });
            return;
          }
          await updateDoc(docRef, {
            attendanceStatus: "Present",
            attendanceTime: Timestamp.now(),
          });
          // Best-effort mirror to server store
          const headers = await getServerAuthHeaders({ "Content-Type": "application/json" });
          void apiFetch("/api/qr/attendance", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ id, attendanceStatus: "Present" }),
          }).catch(() => {});

          setScannedApplicant({
            ...applicant,
            id,
            attendanceStatus: "Present",
            attendanceTime: new Date(),
          });
          return;
        }
      } catch {
        // Fall through to server endpoint if Firestore rule/network fails
      }
    }

    // 2. Server-verified attendance endpoint (works for credential & QR-token officers too)
    try {
      const headers = await getServerAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/api/qr/attendance", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ id, attendanceStatus: "Present" }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.applicant) {
        setScannedApplicant({
          ...data.applicant,
          id: data.applicant.id || id,
          alreadyPresent: Boolean(data.alreadyPresent),
          attendanceStatus: "Present",
          attendanceTime: data.applicant.attendanceTime || new Date(),
        });
        return;
      }
      setError(data?.error || `আবেদনকারী পাওয়া যায়নি! (ID: ${id})`);
    } catch {
      setError("উপস্থিতি যাচাই করতে সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।");
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIdInput.trim()) return;
    setManualSubmitting(true);
    try {
      await processAttendanceScan(manualIdInput.trim());
      setManualIdInput("");
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/admin2");
  };

  const exportAttendance = async () => {
    setExporting(true);
    setExportNotice("");
    try {
      let attendanceData: Array<Record<string, string>> = [];

      if (firebaseUser) {
        try {
          const q = query(
            collection(db, "applicants"),
            where("attendanceStatus", "==", "Present")
          );
          const querySnapshot = await getDocs(q);
          attendanceData = querySnapshot.docs.map((snap) => {
            const data = snap.data();
            const admitCardUrl = appRouteUrl(`/admit-card/${data.id || snap.id}`);
            return {
              Name: data.fullNameEnglish || data.fullNameBangla || "",
              "ID / Roll": `${data.id || snap.id} / ${data.classRoll || "N/A"}`,
              "উপস্থিতির সময়": data.attendanceTime
                ? data.attendanceTime.toDate
                  ? data.attendanceTime.toDate().toLocaleString()
                  : new Date(data.attendanceTime).toLocaleString()
                : "N/A",
              "Photo (Link)": admitCardUrl,
            };
          });
        } catch {
          // Fall back to server endpoint below
        }
      }

      if (attendanceData.length === 0) {
        const headers = await getServerAuthHeaders();
        const res = await apiFetch("/api/qr/attendance-report", {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const records = Array.isArray(data?.records) ? data.records : [];
          attendanceData = records.map((r: any) => ({
            Name: r.fullNameEnglish || r.fullNameBangla || "",
            "ID / Roll": `${r.id} / ${r.classRoll || "N/A"}`,
            "উপস্থিতির সময়": r.attendanceTime
              ? new Date(r.attendanceTime).toLocaleString()
              : "N/A",
            "Photo (Link)": appRouteUrl(`/admit-card/${r.id}`),
          }));
        }
      }

      if (attendanceData.length === 0) {
        setExportNotice("কোনো উপস্থিত শিক্ষার্থী পাওয়া যায়নি।");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(attendanceData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");
      worksheet["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }, { wch: 40 }];
      XLSX.writeFile(
        workbook,
        `BNCC_Attendance_Report_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    } catch {
      setExportNotice("এক্সপোর্ট করতে সমস্যা হয়েছে।");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || !authorized) {
    return (
      <div className="min-h-screen bg-[#020B18] flex items-center justify-center text-slate-200">
        <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {exportNotice && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-sm font-semibold"
          >
            {exportNotice}
          </div>
        )}

        {/* Institutional Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-[#002147] p-6 md:p-8 rounded-3xl text-white shadow-xl border border-[#C5A059]/30 text-center lg:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-14 h-14 bg-[#C5A059]/20 rounded-2xl flex items-center justify-center border border-[#C5A059]/40 text-[#C5A059] shrink-0">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#C5A059]">
                {getRoleLabel(authUser?.role)} • {authUser?.name}
              </p>
              <h1 className="text-2xl font-bold">অ্যাডমিন ২ (এটেনডেন্স প্যানেল)</h1>
              <p className="text-slate-300 text-sm">QR স্ক্যানিং এবং উপস্থিতি ব্যবস্থাপনা</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-2 sm:gap-3">
            <button
              type="button"
              onClick={exportAttendance}
              disabled={exporting}
              className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 bg-[#C5A059] text-[#002147] font-black text-sm rounded-xl hover:bg-[#d4b06a] transition-all disabled:opacity-50 shadow-lg cursor-pointer"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              রিপোর্ট ডাউনলোড
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="min-h-[44px] px-4 py-2.5 bg-white/10 text-white rounded-xl hover:bg-rose-600 transition-all border border-white/20 flex items-center gap-2 text-xs font-bold cursor-pointer"
              title="লগআউট"
            >
              <LogOut className="w-4 h-4" />
              <span>লগআউট</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scanner & Manual ID Section */}
          <div className="bg-white p-6 md:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#002147]/10 rounded-xl flex items-center justify-center">
                  <Camera className="w-5 h-5 text-[#002147]" />
                </div>
                <h2 className="text-lg font-bold text-[#002147]">QR স্ক্যানার</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setScanning(true);
                  setScannedApplicant(null);
                  setScannerNonce((n) => n + 1);
                }}
                className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                রিস্টার্ট
              </button>
            </div>

            <div className="relative">
              <div
                id="reader-admin2"
                className="overflow-hidden rounded-2xl border-2 border-[#002147] bg-slate-950 min-h-[220px]"
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-[#002147] font-bold bg-[#002147]/5 py-2.5 px-3 rounded-xl border border-[#002147]/10">
              <QrCode className="w-4 h-4 text-[#C5A059]" />
              <p className="text-xs">ক্যামেরার সামনে প্রার্থীর Admit Card QR কোড ধরুন</p>
            </div>

            {/* Manual ID Fallback */}
            <form onSubmit={handleManualCheckIn} className="pt-2 border-t border-slate-200 space-y-2">
              <label
                htmlFor="manual-checkin-id"
                className="block text-xs font-bold text-slate-700"
              >
                ম্যানুয়াল আইডি চেক-ইন (ক্যামেরা না থাকলে)
              </label>
              <div className="flex gap-2">
                <input
                  id="manual-checkin-id"
                  type="text"
                  value={manualIdInput}
                  onChange={(e) => setManualIdInput(e.target.value)}
                  placeholder="Applicant ID বা Reg. No. লিখুন"
                  className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-[#002147]"
                />
                <button
                  type="submit"
                  disabled={manualSubmitting || !manualIdInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-[#002147] hover:bg-[#061830] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {manualSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  যাচাই
                </button>
              </div>
            </form>

            {error && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold text-center"
              >
                {error}
              </div>
            )}
          </div>

          {/* Result Section */}
          <div className="flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {!scannedApplicant ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[340px] flex flex-col items-center justify-center p-10 text-center space-y-4 bg-white rounded-3xl border border-dashed border-slate-300"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-700">
                      স্ক্যান করার জন্য অপেক্ষা করছি...
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      সফল স্ক্যান বা আইডি যাচাই হলে এখানে তথ্য প্রদর্শিত হবে
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -12 }}
                  className="p-7 rounded-3xl bg-white shadow-lg border border-slate-200 relative overflow-hidden"
                >
                  <div className="flex justify-end mb-3">
                    <div
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                        scannedApplicant.alreadyPresent
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {scannedApplicant.alreadyPresent ? "ইতিমধ্যেই উপস্থিত" : "উপস্থিত নিশ্চিত"}
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center space-y-5">
                    <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-[#002147] shadow-md bg-slate-100">
                      {scannedApplicant.photo && scannedApplicant.photo.trim() !== "" ? (
                        <img
                          src={scannedApplicant.photo}
                          className="w-full h-full object-cover"
                          alt={scannedApplicant.fullNameEnglish || "Applicant"}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <User className="w-10 h-10 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-[#002147]">
                        {scannedApplicant.fullNameEnglish || scannedApplicant.fullNameBangla}
                      </h3>
                      <p className="text-xs font-mono font-bold text-[#C5A059] uppercase tracking-wider">
                        ID: {scannedApplicant.id}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full">
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                          Class / Group
                        </p>
                        <p className="text-sm text-slate-900 font-bold">
                          {scannedApplicant.studyStatus || "N/A"}
                        </p>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">
                          Roll Number
                        </p>
                        <p className="text-sm text-slate-900 font-bold">
                          {scannedApplicant.classRoll || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="w-full p-3 bg-slate-50 rounded-xl flex items-center justify-center gap-2 text-slate-600 text-xs font-medium">
                      <Clock className="w-4 h-4 text-[#002147]" />
                      <span>
                        সময়:{" "}
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setScannedApplicant(null)}
                      className="w-full min-h-[44px] py-3 bg-[#002147] text-white font-bold rounded-xl hover:bg-[#061830] transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
                    >
                      <Scan className="w-4 h-4 text-[#C5A059]" /> পরবর্তী স্ক্যান করুন
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
