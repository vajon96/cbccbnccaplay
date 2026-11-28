import { useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode,
  Scan,
  Search,
  FileSpreadsheet,
  Download,
  Printer,
  Camera,
  Zap,
  RotateCw,
  Volume2,
  VolumeX,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  X,
  ExternalLink,
  Copy,
  Check,
  History,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";
import { appRouteUrl } from "../../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  reportFirestoreListenerError,
  OperationType,
} from "../../firebase";

interface AdmissionQrWorkspaceProps {
  applicants: any[];
  adminSession: any;
  onNotify?: (msg: string, type?: "success" | "error") => void;
}

type QrCardType = "application" | "candidate" | "admit";

export function AdmissionQrWorkspace({
  applicants,
  adminSession,
  onNotify,
}: AdmissionQrWorkspaceProps) {
  const [subTab, setSubTab] = useState<"generator" | "scanner" | "records">("generator");

  // Generator & Revocation state
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [qrMode, setQrMode] = useState<QrCardType>("application");
  const [qrCardDocs, setQrCardDocs] = useState<Record<string, any>>({});
  const [revokeReason, setRevokeReason] = useState("");
  const [updatingQrCard, setUpdatingQrCard] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  // Live Scanner & Inspection state (`qr_records`)
  const [qrRecords, setQrRecords] = useState<any[]>([]);
  const [scannedCadet, setScannedCadet] = useState<any>(null);
  const [lookupInput, setLookupInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("8");
  const [weightKg, setWeightKg] = useState("64");
  const [attendance, setAttendance] = useState<"Present" | "Absent" | "Late">("Present");
  const [remarks, setRemarks] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = useState<string | null>(null);
  const [recordFilter, setRecordFilter] = useState("");

  // Camera Hardware controls
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "initializing" | "scanning" | "error">("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchActive, setTorchActive] = useState(false);
  const [supportTorch, setSupportTorch] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const notify = (msg: string, type: "success" | "error" = "success") => {
    onNotify?.(msg, type);
  };

  // Real-time listeners for `qr_records` and `public_qr_cards` when signed into Firebase
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubRecords = onSnapshot(
      collection(db, "qr_records"),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => (b.scanTime?.seconds || 0) - (a.scanTime?.seconds || 0));
        setQrRecords(list);
      },
      (err) => reportFirestoreListenerError(err, OperationType.LIST, "qr_records")
    );

    const unsubCards = onSnapshot(
      collection(db, "public_qr_cards"),
      (snap) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d) => {
          map[d.id] = { id: d.id, ...d.data() };
        });
        setQrCardDocs(map);
      },
      (err) => reportFirestoreListenerError(err, OperationType.LIST, "public_qr_cards")
    );

    return () => {
      unsubRecords();
      unsubCards();
    };
  }, [auth.currentUser?.uid]);

  // Auto-select first applicant if none chosen
  useEffect(() => {
    if (!selectedCandidateId && applicants.length > 0) {
      setSelectedCandidateId(applicants[0].id);
    }
  }, [applicants, selectedCandidateId]);

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return applicants.slice(0, 60);
    return applicants
      .filter((a) =>
        `${a.id} ${a.fullNameEnglish || ""} ${a.fullNameBangla || ""} ${a.registrationNumber || ""} ${a.classRoll || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 60);
  }, [applicants, candidateSearch]);

  const selectedCandidate = useMemo(
    () => applicants.find((a) => a.id === selectedCandidateId) || null,
    [applicants, selectedCandidateId]
  );

  const selectedCardState = selectedCandidate ? qrCardDocs[selectedCandidate.id] || {} : {};
  const isSelectedRevoked =
    selectedCardState?.qrStatus === "revoked" || Boolean(selectedCardState?.qrRevoked);
  const currentVersion = Number(selectedCardState?.qrTokenVersion || 1);

  const qrPayloadUrl = useMemo(() => {
    if (!selectedCandidate) return "";
    if (qrMode === "admit") {
      return appRouteUrl(`/admit-card/${selectedCandidate.id}?v=${currentVersion}`);
    }
    return appRouteUrl(`/qr-scan?id=${encodeURIComponent(selectedCandidate.id)}&type=${qrMode}&v=${currentVersion}`);
  }, [selectedCandidate, qrMode, currentVersion]);

  const handleDownloadSvg = () => {
    const svg = qrWrapperRef.current?.querySelector("svg");
    if (!svg || !selectedCandidate) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BNCC_QR_${selectedCandidate.id}_${qrMode}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = () => {
    const svg = qrWrapperRef.current?.querySelector("svg");
    if (!svg || !selectedCandidate) return;
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 40, 40, 640, 640);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `BNCC_QR_${selectedCandidate.id}_${qrMode}.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const updatePublicQrLifecycle = async (action: "revoke" | "revalidate" | "rotate") => {
    if (!selectedCandidate) return;
    setUpdatingQrCard(true);
    try {
      const nextVersion = action === "rotate" ? currentVersion + 1 : currentVersion;
      const revoked = action === "revoke";
      const safePayload: Record<string, any> = {
        fullNameEnglish: selectedCandidate.fullNameEnglish || "",
        fullNameBangla: selectedCandidate.fullNameBangla || "",
        academicYear: selectedCandidate.session || selectedCandidate.academicYear || "2026",
        studyStatus: selectedCandidate.studyStatus || "Regular",
        photo: selectedCandidate.photo || "",
        status: selectedCandidate.status || "Pending",
        registrationNumber: selectedCandidate.registrationNumber || selectedCandidate.id,
        isValidCadet:
          !revoked &&
          (selectedCandidate.status === "Approved" || selectedCandidate.status === "Joined"),
        qrStatus: revoked ? "revoked" : "active",
        qrRevoked: revoked,
        qrRevokedReason: revoked
          ? revokeReason.trim() || "Revoked by Main Admin"
          : "",
        qrTokenVersion: nextVersion,
        qrType: qrMode,
        qrUpdatedAt: Timestamp.now(),
      };

      await setDoc(doc(db, "public_qr_cards", selectedCandidate.id), safePayload, { merge: true });
      await addDoc(collection(db, "activity_logs"), {
        type: `QR_${action.toUpperCase()}`,
        targetId: selectedCandidate.id,
        actorId: adminSession?.id || adminSession?.username || "main_admin",
        timestamp: Timestamp.now(),
        details: `Admin performed QR ${action} (v${nextVersion}) for ${selectedCandidate.id}`,
      }).catch(() => {});

      setRevokeReason("");
      notify(
        action === "revoke"
          ? `QR কোড (${selectedCandidate.id}) বাতিল (Revoked) করা হয়েছে।`
          : action === "rotate"
          ? `নতুন QR টোকেন সংস্করণ v${nextVersion} ইস্যু করা হয়েছে।`
          : `QR কোড (${selectedCandidate.id}) পুনরায় সক্রিয় (Active) করা হয়েছে।`,
        "success"
      );
    } catch (err: any) {
      notify(err?.message || "QR স্ট্যাটাস আপডেট করা যায়নি।", "error");
    } finally {
      setUpdatingQrCard(false);
    }
  };

  const handleCopyQrUrl = async () => {
    if (!qrPayloadUrl) return;
    try {
      await navigator.clipboard.writeText(qrPayloadUrl);
      setCopiedPayload(true);
      notify("QR লিংক কপি হয়েছে।");
      window.setTimeout(() => setCopiedPayload(false), 2000);
    } catch {
      notify("কপি করা যায়নি।", "error");
    }
  };

  // --- Camera Scanner Effects ---
  useEffect(() => {
    if (subTab !== "scanner" || scannedCadet) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isActive = true;

    const startScanner = async (cameraId: string) => {
      if (!isActive) return;
      const target = document.getElementById("unified-qr-reader");
      if (!target) {
        setTimeout(() => startScanner(cameraId), 120);
        return;
      }

      try {
        setCameraStatus("initializing");
        if (!html5QrCode) {
          html5QrCode = new Html5Qrcode("unified-qr-reader");
          qrCodeRef.current = html5QrCode;
        }
        const selector =
          cameraId === "environment" || cameraId === "user"
            ? { facingMode: cameraId }
            : cameraId;
        await html5QrCode.start(
          selector as any,
          {
            fps: 20,
            qrbox: (w: number, h: number) => {
              const s = Math.min(w, h) * 0.72;
              return { width: s, height: s };
            },
          },
          async (decodedText) => {
            if (!isActive) return;
            if (audioEnabled) {
              try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                  const ctx = new AudioCtx();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.frequency.setValueAtTime(880, ctx.currentTime);
                  gain.gain.setValueAtTime(0.08, ctx.currentTime);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.18);
                }
              } catch {
                // ignore
              }
            }
            await handleLookupCadet(decodedText);
          },
          () => {}
        );
        setCameraStatus("scanning");
        setCameraError(null);
        try {
          const caps = html5QrCode.getRunningTrackCapabilities() as any;
          setSupportTorch(Boolean(caps && "torch" in caps));
        } catch {
          setSupportTorch(false);
        }
      } catch (err: any) {
        setCameraStatus("error");
        setCameraError("ক্যামেরা চালু করা যায়নি। ম্যানুয়াল সার্চ অথবা ছবি আপলোড ব্যবহার করুন।");
      }
    };

    const init = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          const preferred =
            selectedCameraId && devices.some((d) => d.id === selectedCameraId)
              ? selectedCameraId
              : (devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0]).id;
          setSelectedCameraId(preferred);
          await startScanner(preferred);
        } else {
          setCameras([
            { id: "environment", label: "Rear Camera" },
            { id: "user", label: "Front Camera" },
          ]);
          setSelectedCameraId("environment");
          await startScanner("environment");
        }
      } catch {
        setCameraStatus("error");
        setCameraError("ক্যামেরা অ্যাক্সেস পাওয়া যায়নি।");
      }
    };

    const timer = window.setTimeout(() => void init(), 150);
    return () => {
      isActive = false;
      window.clearTimeout(timer);
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [subTab, scannedCadet, selectedCameraId]);

  const extractCleanId = (raw: string): string => {
    const cleaned = (raw || "").trim();
    if (!cleaned) return "";
    if (cleaned.startsWith("{")) {
      try {
        const parsed = JSON.parse(cleaned);
        return String(parsed.id || parsed.uniqueId || parsed.roll || cleaned).trim();
      } catch {
        // ignore
      }
    }
    if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
      try {
        const url = new URL(cleaned);
        const paramId =
          url.searchParams.get("id") ||
          url.searchParams.get("uniqueId") ||
          url.searchParams.get("emisId");
        if (paramId) return paramId.trim();
        const segs = url.pathname.split("/").filter(Boolean);
        if (segs.length > 0) return segs[segs.length - 1].trim();
      } catch {
        // ignore
      }
    }
    return cleaned;
  };

  const handleLookupCadet = async (queryText: string) => {
    const clean = extractCleanId(queryText);
    if (!clean) return;
    setSearching(true);
    try {
      // Search local applicants cache first for speed
      const localMatch = applicants.find(
        (a) =>
          a.id === clean ||
          a.registrationNumber === clean ||
          a.emisId === clean ||
          a.studentPhone === clean
      );
      if (localMatch) {
        populateInspection(localMatch);
        return;
      }

      if (!clean.includes("/") && !clean.includes("\\")) {
        const snap = await getDoc(doc(db, "applicants", clean));
        if (snap.exists()) {
          populateInspection({ id: snap.id, ...snap.data() });
          return;
        }
      }

      const qPhone = await getDocs(query(collection(db, "applicants"), where("studentPhone", "==", clean)));
      if (!qPhone.empty) {
        const first = qPhone.docs[0];
        populateInspection({ id: first.id, ...first.data() });
        return;
      }

      notify(`"${clean}" আইডির কোনো প্রার্থী পাওয়া যায়নি।`, "error");
    } finally {
      setSearching(false);
    }
  };

  const populateInspection = (cand: any) => {
    setScannedCadet(cand);
    setHeightFeet(String(cand.heightFeet || "5"));
    setHeightInches(String(cand.heightInches || "8"));
    setWeightKg(String(cand.weightKg || cand.weight || "64"));
    setAttendance("Present");
    setRemarks("");
    setMedicalNotes("");
  };

  const handleSaveSnapshot = async () => {
    if (!scannedCadet) return;
    setSavingSnapshot(true);
    try {
      const recordId = `QR_${Date.now()}_${scannedCadet.id}`;
      const cm = Math.round(
        Number(heightFeet || 0) * 30.48 + Number(heightInches || 0) * 2.54
      );
      await setDoc(doc(db, "qr_records", recordId), {
        id: recordId,
        studentId: scannedCadet.id,
        uniqueId: scannedCadet.uniqueId || scannedCadet.id,
        registrationNumber: scannedCadet.registrationNumber || scannedCadet.id,
        studentName: scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla || "Candidate",
        fullNameBangla: scannedCadet.fullNameBangla || "",
        fullNameEnglish: scannedCadet.fullNameEnglish || "",
        phone: scannedCadet.studentPhone || "N/A",
        scanTime: Timestamp.now(),
        editedTime: Timestamp.now(),
        editedBy: adminSession?.name || adminSession?.username || "Main Admin",
        height: `${heightFeet}'${heightInches}" (${cm} cm)`,
        weight: `${weightKg} kg`,
        attendance,
        status: scannedCadet.status || "Pending",
        remarks: remarks.trim() || "Verified in Field Inspection",
        medicalNotes: medicalNotes.trim() || "Fit",
      });
      notify(`'${scannedCadet.fullNameEnglish || scannedCadet.id}' এর QR উপস্থিতি ও ফিজিক্যাল স্ন্যাপশট সংরক্ষিত হয়েছে।`);
      setScannedCadet(null);
      setSubTab("records");
    } catch (err: any) {
      notify(err?.message || "স্ন্যাপশট সংরক্ষণ ব্যর্থ হয়েছে।", "error");
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleQrImageFile = async (file?: File) => {
    if (!file) return;
    try {
      const scanner = new Html5Qrcode("qr-temp-file-decode");
      const text = await scanner.scanFile(file, true);
      await handleLookupCadet(text);
    } catch {
      notify("ছবি থেকে বৈধ QR কোড পড়া যায়নি।", "error");
    }
  };

  const filteredRecords = useMemo(() => {
    const q = recordFilter.trim().toLowerCase();
    if (!q) return qrRecords;
    return qrRecords.filter((r) =>
      `${r.studentId} ${r.studentName} ${r.phone} ${r.attendance} ${r.remarks}`
        .toLowerCase()
        .includes(q)
    );
  }, [qrRecords, recordFilter]);

  const exportQrExcel = () => {
    if (filteredRecords.length === 0) {
      notify("এক্সপোর্ট করার মতো কোনো QR রেকর্ড নেই।", "error");
      return;
    }
    const rows = filteredRecords.map((rec, i) => ({
      SL: i + 1,
      "Student ID": rec.studentId || rec.uniqueId || "",
      "Student Name": rec.studentName || rec.fullNameEnglish || "",
      Phone: rec.phone || "",
      Height: rec.height || "",
      Weight: rec.weight || "",
      Attendance: rec.attendance || "",
      Status: rec.status || "",
      "Medical Notes": rec.medicalNotes || "",
      Remarks: rec.remarks || "",
      "Inspected By": rec.editedBy || "",
      "Scan Time": rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleString() : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QR_Records");
    XLSX.writeFile(wb, `BNCC_QR_Attendance_${new Date().toISOString().split("T")[0]}.xlsx`);
    notify("QR Attendance Excel ডাউনলোড শুরু হয়েছে।");
  };

  const exportCadetPdf = (cand: any) => {
    const docPdf = new jsPDF();
    docPdf.setFillColor(0, 33, 71);
    docPdf.rect(0, 0, 210, 22, "F");
    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(13);
    docPdf.text("COX'S BAZAR CITY COLLEGE BNCC PLATOON — QR VERIFICATION", 14, 14);
    autoTable(docPdf, {
      startY: 28,
      head: [["Field", "Value"]],
      body: [
        ["Candidate ID", cand.id || ""],
        ["Name (EN)", cand.fullNameEnglish || ""],
        ["Name (BN)", cand.fullNameBangla || ""],
        ["Height", `${heightFeet}'${heightInches}"`],
        ["Weight", `${weightKg} kg`],
        ["Attendance", attendance],
        ["Remarks", remarks || "Normal"],
        ["Medical Notes", medicalNotes || "Fit"],
      ],
      headStyles: { fillColor: [0, 33, 71], textColor: [197, 160, 89] },
    });
    docPdf.save(`BNCC_Inspection_${cand.id}.pdf`);
  };

  const activeQrCount = Object.values(qrCardDocs).filter((d) => !d.qrRevoked && d.qrStatus !== "revoked").length;
  const revokedQrCount = Object.values(qrCardDocs).filter((d) => d.qrRevoked || d.qrStatus === "revoked").length;

  return (
    <div className="space-y-6">
      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Stored Scan Snapshots</p>
          <p className="text-2xl font-black font-mono tabular-nums text-white mt-1">{qrRecords.length}</p>
        </div>
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Active QR Cards</p>
          <p className="text-2xl font-black font-mono tabular-nums text-emerald-400 mt-1">{activeQrCount || applicants.length}</p>
        </div>
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Revoked QRs</p>
          <p className="text-2xl font-black font-mono tabular-nums text-rose-400 mt-1">{revokedQrCount}</p>
        </div>
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-400">Present Logged</p>
          <p className="text-2xl font-black font-mono tabular-nums text-[#C5A059] mt-1">
            {qrRecords.filter((r) => r.attendance === "Present").length}
          </p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "generator", label: "QR Card Control & Revocation", icon: QrCode },
            { id: "scanner", label: "Live QR Scanner & Inspection", icon: Scan },
            { id: "records", label: "Scan Logs & Excel Vault", icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id as any)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#C5A059] text-[#002147] font-black"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <a
          href="/admin/qr-dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/15 flex items-center gap-1.5"
        >
          <ExternalLink size={13} /> Standalone QR Inspector
        </a>
      </div>

      {/* TAB 1: QR GENERATOR & REVOCATION */}
      {subTab === "generator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Candidate Selector */}
          <div className="lg:col-span-5 bg-[#061830] border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white">Select Applicant / Cadet</h3>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                placeholder="Search ID, name, roll..."
                className="w-full bg-[#020B18] border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-[#C5A059]"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-white/10 pr-1">
              {filteredCandidates.map((cand) => {
                const docState = qrCardDocs[cand.id];
                const rev = docState?.qrRevoked || docState?.qrStatus === "revoked";
                const active = selectedCandidateId === cand.id;
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setSelectedCandidateId(cand.id)}
                    className={`w-full text-left py-3 px-3 rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      active ? "bg-[#C5A059]/15 border border-[#C5A059]/40" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {cand.fullNameEnglish || cand.fullNameBangla}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 truncate">
                        {cand.id} · {cand.status || "Pending"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        rev
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-emerald-500/15 text-emerald-300"
                      }`}
                    >
                      {rev ? "REVOKED" : "ACTIVE"}
                    </span>
                  </button>
                );
              })}
              {filteredCandidates.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-400">No candidates matched your search.</p>
              )}
            </div>
          </div>

          {/* Right: Live QR Preview, Export & Revocation Controls */}
          <div className="lg:col-span-7 bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-6">
            {selectedCandidate ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {selectedCandidate.fullNameEnglish || selectedCandidate.fullNameBangla}
                    </h3>
                    <p className="text-xs font-mono text-[#C5A059]">
                      ID: {selectedCandidate.id} · Token v{currentVersion}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#020B18] p-1 rounded-xl border border-white/10">
                    {[
                      { id: "application", label: "Application QR" },
                      { id: "candidate", label: "Candidate QR" },
                      { id: "admit", label: "Admit Card QR" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setQrMode(mode.id as QrCardType)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                          qrMode === mode.id
                            ? "bg-[#C5A059] text-[#002147]"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div
                    ref={qrWrapperRef}
                    className={`p-5 bg-white rounded-2xl border-4 shrink-0 ${
                      isSelectedRevoked ? "border-rose-500 opacity-75" : "border-[#C5A059]"
                    }`}
                  >
                    <QRCodeSVG
                      value={qrPayloadUrl}
                      size={196}
                      level="H"
                      includeMargin={false}
                      fgColor="#002147"
                      bgColor="#ffffff"
                    />
                  </div>

                  <div className="flex-1 space-y-4 w-full">
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-bold ${
                        isSelectedRevoked
                          ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
                          : "bg-emerald-950/50 border-emerald-500/35 text-emerald-200"
                      }`}
                    >
                      {isSelectedRevoked ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                      <span>
                        {isSelectedRevoked
                          ? `REVOKED: ${selectedCardState?.qrRevokedReason || "Public verifier rejects this QR"}`
                          : "ACTIVE & VERIFIABLE via Public QR Verifier"}
                      </span>
                    </div>

                    <div className="bg-[#020B18] border border-white/10 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Encoded Verification URL</span>
                        <button
                          type="button"
                          onClick={() => void handleCopyQrUrl()}
                          className="text-[#C5A059] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPayload ? <Check size={12} /> : <Copy size={12} />}
                          {copiedPayload ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-[11px] font-mono text-slate-200 break-all select-all">
                        {qrPayloadUrl}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadPng}
                        className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} /> Download PNG
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadSvg}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} /> Download SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer size={14} /> Print Card
                      </button>
                    </div>
                  </div>
                </div>

                {/* Revoke / Revalidate / Rotate Section */}
                <div className="bg-[#020B18] border border-white/10 rounded-2xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    QR Lifecycle Security Control
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={revokeReason}
                      onChange={(e) => setRevokeReason(e.target.value)}
                      placeholder="Optional revocation reason (e.g., Replaced card, Lost admit card)..."
                      className="flex-1 bg-[#061830] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#C5A059]"
                    />
                    {isSelectedRevoked ? (
                      <button
                        type="button"
                        disabled={updatingQrCard}
                        onClick={() => void updatePublicQrLifecycle("revalidate")}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        Revalidate & Restore QR
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingQrCard}
                        onClick={() => void updatePublicQrLifecycle("revoke")}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        Revoke QR Code
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={updatingQrCard}
                      onClick={() => void updatePublicQrLifecycle("rotate")}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-[#C5A059] border border-[#C5A059]/35 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      <RefreshCw size={13} className={updatingQrCard ? "animate-spin" : ""} />
                      Rotate Token (v{currentVersion + 1})
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-xs text-slate-400">
                Select an applicant on the left to generate, download, revoke, or rotate QR verification cards.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SCANNER & PHYSICAL INSPECTION */}
      {subTab === "scanner" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div id="qr-temp-file-decode" className="hidden" />

          {!scannedCadet ? (
            <div className="bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">Live Camera & Image QR Scanner</h3>
                  <p className="text-xs text-slate-400">
                    Scan any cadet card or look up by ID / Phone / EMIS for physical inspection & attendance.
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-300 font-bold">
                  {cameraStatus === "scanning" ? "CAMERA ACTIVE" : cameraStatus.toUpperCase()}
                </span>
              </div>

              <div className="relative overflow-hidden rounded-2xl border-2 border-[#C5A059]/40 bg-black aspect-[4/3] w-full flex items-center justify-center">
                <div id="unified-qr-reader" className="w-full h-full" />
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                    <Camera size={32} className="text-amber-400" />
                    <p className="text-xs text-slate-200 max-w-sm">{cameraError}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  className="bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none"
                >
                  {cameras.map((c, idx) => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>

                <label className="px-4 py-2 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer">
                  Upload QR Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      void handleQrImageFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  disabled={!supportTorch}
                  onClick={async () => {
                    if (!qrCodeRef.current?.isScanning) return;
                    const next = !torchActive;
                    await qrCodeRef.current.applyVideoConstraints({
                      advanced: [{ torch: next } as any],
                    });
                    setTorchActive(next);
                  }}
                  className="px-3 py-2 bg-white/10 text-white rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <Zap size={14} /> Torch
                </button>

                <button
                  type="button"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className="px-3 py-2 bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} Sound
                </button>

                <button
                  type="button"
                  disabled={cameras.length < 2}
                  onClick={() => {
                    const next = cameras.find((c) => c.id !== selectedCameraId);
                    if (next) setSelectedCameraId(next.id);
                  }}
                  className="px-3 py-2 bg-white/10 text-white rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <RotateCw size={14} /> Flip
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleLookupCadet(lookupInput);
                }}
                className="flex gap-2 pt-2 border-t border-white/10"
              >
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="Enter Candidate ID, Phone, Registration No, or paste scanned QR URL..."
                  className="flex-1 bg-[#020B18] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#C5A059]"
                />
                <button
                  type="submit"
                  disabled={searching || !lookupInput.trim()}
                  className="px-5 py-2.5 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {searching ? "Searching..." : "Verify ID"}
                </button>
              </form>
            </div>
          ) : (
            /* Physical & Medical Inspection Sheet */
            <div className="bg-[#061830] border border-[#C5A059]/35 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla}
                  </h3>
                  <p className="text-xs font-mono text-[#C5A059]">
                    ID: {scannedCadet.id} · Status: {scannedCadet.status || "Pending"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportCadetPdf(scannedCadet)}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannedCadet(null)}
                    className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Scan Another
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Height (Feet / Inches)</label>
                  <div className="flex gap-2">
                    <select
                      value={heightFeet}
                      onChange={(e) => setHeightFeet(e.target.value)}
                      className="flex-1 bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white"
                    >
                      {["4", "5", "6", "7"].map((f) => (
                        <option key={f} value={f}>{f} ft</option>
                      ))}
                    </select>
                    <select
                      value={heightInches}
                      onChange={(e) => setHeightInches(e.target.value)}
                      className="flex-1 bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => String(i)).map((inch) => (
                        <option key={inch} value={inch}>{inch} in</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Attendance</label>
                  <select
                    value={attendance}
                    onChange={(e) => setAttendance(e.target.value as any)}
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Remarks</label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Field verification remarks..."
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Medical Notes</label>
                  <input
                    type="text"
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    placeholder="Medical fit / observation..."
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingSnapshot}
                  onClick={() => void handleSaveSnapshot()}
                  className="px-6 py-2.5 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingSnapshot ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Snapshot to qr_records
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QR RECORDS & EXCEL STORAGE */}
      {subTab === "records" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={recordFilter}
                onChange={(e) => setRecordFilter(e.target.value)}
                placeholder="Filter scan logs by ID, name, phone, attendance..."
                className="w-full bg-[#061830] border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-[#C5A059]"
              />
            </div>

            <button
              type="button"
              onClick={exportQrExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <FileSpreadsheet size={15} /> Export QR Records (.xlsx)
            </button>
          </div>

          <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                    <th className="py-3 px-4 font-bold uppercase">Time</th>
                    <th className="py-3 px-4 font-bold uppercase">Student</th>
                    <th className="py-3 px-4 font-bold uppercase">Measurements</th>
                    <th className="py-3 px-4 font-bold uppercase">Attendance</th>
                    <th className="py-3 px-4 font-bold uppercase">Inspector</th>
                    <th className="py-3 px-4 font-bold uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleString() : rec.id}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-white">{rec.studentName || rec.fullNameEnglish}</p>
                        <p className="text-[11px] font-mono text-slate-400">{rec.studentId || rec.uniqueId}</p>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-300">
                        {rec.height || "-"} · {rec.weight || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-bold ${
                            rec.attendance === "Present"
                              ? "text-emerald-400"
                              : rec.attendance === "Late"
                              ? "text-amber-300"
                              : "text-rose-400"
                          }`}
                        >
                          {rec.attendance || "Present"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{rec.editedBy || "Admin"}</td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteRecordId === rec.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteDoc(doc(db, "qr_records", rec.id));
                                setConfirmDeleteRecordId(null);
                                notify("স্ন্যাপশট রেকর্ড মুছে ফেলা হয়েছে।");
                              }}
                              className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteRecordId(null)}
                              className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRecordId(rec.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRecords.length === 0 && (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <History size={26} className="mx-auto text-slate-500" />
                <p>No QR verification snapshots stored yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
