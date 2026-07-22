import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Scan, LogOut, Shield, QrCode, Camera, CheckCircle, XCircle, 
  User, Clock, Loader2, Award, Calendar, AlertCircle, Edit, Save, Plus,
  Zap, ZapOff, Volume2, VolumeX, RotateCw, Check, Sliders, Search, Download,
  FileSpreadsheet, FileText, Printer, History, Settings, ChevronRight, Home,
  Filter, Trash2, Eye, RefreshCw, Layers, Sparkles, MapPin, Phone, Mail, Droplets
} from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  db, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, collection, Timestamp,
  onSnapshot, handleFirestoreError, OperationType, orderBy 
} from "../firebase";
import { getSession, clearSession } from "../lib/auth";

export function AdminQrDashboard() {
  const [adminSession, setAdminSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Active Module View Navigation
  // Views: "dashboard" | "scan" | "search" | "profile" | "excel" | "history" | "settings"
  const [activeTab, setActiveTab] = useState<"dashboard" | "scan" | "search" | "profile" | "excel" | "history" | "settings">("dashboard");

  // Search & Scanned Data
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingDatabase, setSearchingDatabase] = useState(false);
  const [scannedCadet, setScannedCadet] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Independent Measurement & Snapshot Edit Form State
  const [isEditing, setIsEditing] = useState(false);
  const [heightFeet, setHeightFeet] = useState<string>("5");
  const [heightInches, setHeightInches] = useState<string>("8");
  const [weightKg, setWeightKg] = useState<string>("64");
  const [attendance, setAttendance] = useState<"Present" | "Absent" | "Late">("Present");
  const [statusTag, setStatusTag] = useState<string>("Active");
  const [remarks, setRemarks] = useState<string>("");
  const [medicalNotes, setMedicalNotes] = useState<string>("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Firestore Collections State
  const [qrRecords, setQrRecords] = useState<any[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [cadetSnapshotHistory, setCadetSnapshotHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Excel Storage Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterBattalion, setFilterBattalion] = useState("All");
  const [filterAttendance, setFilterAttendance] = useState("All");
  const [filterRank, setFilterRank] = useState("All");
  const [filterSearch, setFilterSearch] = useState("");

  // Snapshot Detail Modal
  const [selectedSnapshotModal, setSelectedSnapshotModal] = useState<any>(null);

  // Notifications
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Camera & Scanner Experience
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [flashlightActive, setFlashlightActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(5);
  const [supportTorch, setSupportTorch] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"initializing" | "ready" | "scanning" | "error">("initializing");
  const [scanSuccessTrigger, setScanSuccessTrigger] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const navigate = useNavigate();
  const todayStr = new Date().toISOString().split("T")[0];

  // Auth Verification
  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "super_admin" && session.role !== "sub_admin" && session.role !== "attendance_officer" && session.role !== "qr_admin")) {
      navigate("/login");
      return;
    }
    setAdminSession(session);
    setLoading(false);
  }, [navigate]);

  // Real-time listener for `qr_records` (Independent QR Snapshot Storage)
  useEffect(() => {
    if (loading || !adminSession) return;

    try {
      const qrRef = collection(db, "qr_records");
      const unsub = onSnapshot(qrRef, (snap) => {
        const recordsList: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        recordsList.sort((a, b) => {
          const tA = a.scanTime?.seconds || a.editedTime?.seconds || 0;
          const tB = b.scanTime?.seconds || b.editedTime?.seconds || 0;
          return tB - tA;
        });
        setQrRecords(recordsList);
        setRecentScans(recordsList.slice(0, 10));
      }, (err) => {
        console.error("qr_records listener error:", err);
      });

      return () => unsub();
    } catch (err) {
      console.error("Setup listener error:", err);
    }
  }, [loading, adminSession]);

  // Fetch individual student snapshot history when cadet is selected
  useEffect(() => {
    if (!scannedCadet) {
      setCadetSnapshotHistory([]);
      return;
    }

    const studentId = scannedCadet.id;
    const studentHistory = qrRecords.filter(r => r.studentId === studentId || r.uniqueId === studentId);
    setCadetSnapshotHistory(studentHistory);
  }, [scannedCadet, qrRecords]);

  // Sound feedback on scan
  const playSuccessSound = () => {
    if (!audioEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.warn("Audio synthesis error:", err);
    }
  };

  // Camera Flashlight Control
  const handleToggleFlashlight = async () => {
    if (!qrCodeRef.current || !qrCodeRef.current.isScanning) return;
    try {
      const capabilities = qrCodeRef.current.getRunningTrackCapabilities() as any;
      if (capabilities && "torch" in capabilities) {
        const nextState = !flashlightActive;
        await qrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setFlashlightActive(nextState);
      }
    } catch (err) {
      console.warn("Torch failed:", err);
    }
  };

  // Camera Zoom Control
  const handleZoomChange = async (val: number) => {
    if (!qrCodeRef.current || !qrCodeRef.current.isScanning) return;
    try {
      const capabilities = qrCodeRef.current.getRunningTrackCapabilities() as any;
      if (capabilities && "zoom" in capabilities) {
        const min = capabilities.zoom.min || 1;
        const max = capabilities.zoom.max || 5;
        const nextZoom = Math.max(min, Math.min(val, max));
        await qrCodeRef.current.applyVideoConstraints({
          advanced: [{ zoom: nextZoom } as any]
        });
        setZoomLevel(nextZoom);
      }
    } catch (err) {
      console.warn("Zoom failed:", err);
    }
  };

  // Switch Front / Rear Camera
  const toggleFrontBackCamera = () => {
    if (cameras.length < 2) return;
    const currentCamera = cameras.find(c => c.id === selectedCameraId);
    if (!currentCamera) return;

    const lbl = currentCamera.label.toLowerCase();
    const isCurrentBack = lbl.includes("back") || lbl.includes("rear") || lbl.includes("environment") || lbl.includes("wide");

    let nextCamera = cameras.find(c => {
      const l = c.label.toLowerCase();
      return isCurrentBack ? (l.includes("front") || l.includes("user")) : (l.includes("back") || l.includes("rear") || l.includes("environment"));
    }) || cameras.find(c => c.id !== selectedCameraId);

    if (nextCamera) {
      setSelectedCameraId(nextCamera.id);
      setFlashlightActive(false);
      setZoomLevel(1);
    }
  };

  // Initialize Camera Scanner when tab is "scan"
  useEffect(() => {
    if (loading || activeTab !== "scan" || scannedCadet) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isActive = true;

    const startScanner = async (cameraId: string) => {
      if (!isActive) return;
      const target = document.getElementById("reader-qr-admin");
      if (!target) {
        setTimeout(() => startScanner(cameraId), 100);
        return;
      }

      try {
        setCameraStatus("initializing");
        if (!html5QrCode) {
          html5QrCode = new Html5Qrcode("reader-qr-admin");
          qrCodeRef.current = html5QrCode;
        }

        const onScanSuccess = async (decodedText: string) => {
          if (!isActive) return;
          setScanSuccessTrigger(true);
          setTimeout(() => setScanSuccessTrigger(false), 800);

          if (window.navigator?.vibrate) {
            window.navigator.vibrate(150);
          }
          playSuccessSound();

          let targetId = decodedText;
          try {
            const data = JSON.parse(decodedText);
            targetId = data.id || data.uniqueId || data.roll || decodedText;
          } catch (e) {
            targetId = decodedText;
          }

          if (!targetId) return;
          await handleSearchById(targetId);
        };

        const config = {
          fps: 24,
          qrbox: (w: number, h: number) => {
            const size = Math.min(w, h) * 0.72;
            return { width: size, height: size };
          },
          aspectRatio: 1.333333
        };

        const cameraSelector = (cameraId === "environment" || cameraId === "user") ? { facingMode: cameraId } : cameraId;

        await html5QrCode.start(cameraSelector as any, config, onScanSuccess, () => {});
        setCameraStatus("scanning");
        setCameraPermissionError(null);

        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
          setSupportTorch(capabilities && "torch" in capabilities);
          if (capabilities?.zoom) {
            setMaxZoom(capabilities.zoom.max || 5);
          }
        } catch (capError) {
          console.warn("Camera capabilities check warning:", capError);
        }
      } catch (err: any) {
        console.error("Scanner startup failed:", err);
        setCameraStatus("error");
        let msg = "ক্যামেরা চালুর অনুমতি পাওয়া যায়নি।";
        if (err?.name === "NotAllowedError" || String(err).includes("NotAllowedError") || String(err).includes("Permission")) {
          msg = "ব্রাউজার/আইফ্রেম বা প্রিভিউতে ক্যামেরা অ্যাক্সেস ব্লক করা আছে। দয়া করে নিচে 'QR ছবি আপলোড করুন' অথবা ম্যানুয়ালি ID টাইপ করে সার্চ করুন।";
        }
        setCameraPermissionError(msg);
      }
    };

    const initializeDevices = async () => {
      try {
        setCameraStatus("initializing");
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          setCameraPermissionError(null);
          let defaultCam = devices.find(d => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")) || devices[0];
          setSelectedCameraId(defaultCam.id);
          startScanner(defaultCam.id);
        } else {
          const fallbacks = [{ id: "environment", label: "Rear Camera" }, { id: "user", label: "Front Camera" }];
          setCameras(fallbacks);
          setSelectedCameraId("environment");
          startScanner("environment");
        }
      } catch (err: any) {
        console.warn("Camera init warning:", err);
        setCameraStatus("error");
        setCameraPermissionError("ক্যামেরা চালুর অনুমতি নেই বা ক্যামেরা ডিটেক্ট হয়নি। আপনি নিচে 'QR ছবি আপলোড করুন' বা ID টাইপ করে তথ্য দেখতে পারেন।");
      }
    };

    const timer = setTimeout(initializeDevices, 150);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (html5QrCode?.isScanning) {
        html5QrCode.stop().catch(err => console.error("Scanner stop error:", err));
      }
    };
  }, [loading, activeTab, scannedCadet, selectedCameraId]);

  // QR Image File Scan Upload Handler
  const handleQrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSearchingDatabase(true);
      const tempScanner = new Html5Qrcode("qr-file-reader-temp");
      const decodedText = await tempScanner.scanFile(file, true);
      playSuccessSound();

      let targetId = decodedText;
      try {
        const data = JSON.parse(decodedText);
        targetId = data.id || data.uniqueId || data.roll || decodedText;
      } catch (err) {
        targetId = decodedText;
      }

      if (targetId) {
        await handleSearchById(targetId);
      } else {
        setError("QR Code থেকে কোনো বৈধ ID পাওয়া যায়নি।");
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error("QR File scan error:", err);
      setError("ছবি থেকে QR Code পড়া যায়নি। দয়া করে পরিষ্কার QR Code ছবি আপলোড করুন অথবা ID টাইপ করুন।");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSearchingDatabase(false);
      e.target.value = "";
    }
  };

  // Clean and extract valid query or ID from input (raw text, JSON, or URL)
  const cleanSearchQuery = (input: string): string => {
    let cleaned = (input || "").trim();
    if (!cleaned) return "";

    // 1. JSON
    if ((cleaned.startsWith("{") && cleaned.endsWith("}")) || (cleaned.startsWith("[") && cleaned.endsWith("]"))) {
      try {
        const parsed = JSON.parse(cleaned);
        const possible = parsed.id || parsed.uniqueId || parsed.cadetId || parsed.roll || parsed.emisId;
        if (possible) return String(possible).trim();
      } catch {
        // ignore
      }
    }

    // 2. URL
    if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
      try {
        const url = new URL(cleaned);
        const searchParams = new URLSearchParams(url.search);
        const possibleId = searchParams.get("id") || searchParams.get("uniqueId") || searchParams.get("cadetId") || searchParams.get("emisId") || searchParams.get("roll");
        if (possibleId) {
          return possibleId.trim();
        }
        const pathSegments = url.pathname.split("/").filter(Boolean);
        if (pathSegments.length > 0) {
          const lastSeg = pathSegments[pathSegments.length - 1];
          if (lastSeg && !lastSeg.includes(".") && lastSeg.length > 1) {
            return lastSeg.trim();
          }
        }
      } catch {
        // ignore
      }
    }

    return cleaned;
  };

  // Main Search Handler for Main Database (`applicants`) - READ ONLY
  const handleSearchById = async (idOrQuery: string) => {
    const queryTerm = cleanSearchQuery(idOrQuery);
    if (!queryTerm) return;

    setSearchingDatabase(true);
    setError(null);
    setSearchResults([]);

    try {
      // 1. Direct Doc Lookup by ID (ONLY if queryTerm does NOT contain slashes)
      if (!queryTerm.includes("/") && !queryTerm.includes("\\")) {
        const directDocRef = doc(db, "applicants", queryTerm);
        const directSnap = await getDoc(directDocRef);

        if (directSnap.exists()) {
          const cadetData = { id: directSnap.id, ...directSnap.data() };
          selectStudentForProfile(cadetData);
          setSuccess("শিক্ষার্থী/ক্যাডেট প্রোফাইল সফলভাবে পাওয়া গেছে!");
          setTimeout(() => setSuccess(null), 3000);
          return;
        }
      }

      // 2. Query Search across applicants by studentPhone, emisId, fullNameEnglish, uniqueId, etc.
      const collRef = collection(db, "applicants");
      const phoneQ = query(collRef, where("studentPhone", "==", queryTerm));
      const emisQ = query(collRef, where("emisId", "==", queryTerm));
      const uniqueQ = query(collRef, where("uniqueId", "==", queryTerm));
      
      const [phoneSnap, emisSnap, uniqueSnap] = await Promise.all([
        getDocs(phoneQ),
        getDocs(emisQ),
        getDocs(uniqueQ)
      ]);

      let matches: any[] = [];
      phoneSnap.forEach(d => matches.push({ id: d.id, ...d.data() }));
      emisSnap.forEach(d => {
        if (!matches.some(m => m.id === d.id)) matches.push({ id: d.id, ...d.data() });
      });
      uniqueSnap.forEach(d => {
        if (!matches.some(m => m.id === d.id)) matches.push({ id: d.id, ...d.data() });
      });

      // 3. Fallback: Search all local loaded records for text substring match
      if (matches.length === 0) {
        const allSnap = await getDocs(collRef);
        const searchLower = queryTerm.toLowerCase();
        allSnap.forEach(d => {
          const data: any = d.data();
          const searchHaystack = `${d.id} ${data.fullNameEnglish || ''} ${data.fullNameBangla || ''} ${data.studentPhone || ''} ${data.emisId || ''} ${data.nidBirthReg || ''} ${data.uniqueId || ''}`.toLowerCase();
          if (searchHaystack.includes(searchLower)) {
            matches.push({ id: d.id, ...data });
          }
        });
      }

      if (matches.length === 1) {
        selectStudentForProfile(matches[0]);
        setSuccess("শিক্ষার্থী রেকর্ড পাওয়া গেছে!");
        setTimeout(() => setSuccess(null), 3000);
      } else if (matches.length > 1) {
        setSearchResults(matches);
        setActiveTab("search");
      } else {
        setError(`"${queryTerm}" আইডি বা তথ্য ডাটাবেজে পাওয়া যায়নি!`);
        setTimeout(() => setError(null), 4000);
      }

    } catch (err) {
      console.error("Search failed:", err);
      setError("ডাটাবেজ সার্চ করতে সমস্যা হয়েছে।");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSearchingDatabase(false);
    }
  };

  // Populate selected student into form and open Medical Profile
  const selectStudentForProfile = (student: any) => {
    setScannedCadet(student);
    
    // Parse height (e.g. 5'8" or 172cm or heightFeet/heightInches)
    if (student.heightFeet !== undefined) setHeightFeet(String(student.heightFeet));
    else if (student.height?.includes("'")) setHeightFeet(student.height.split("'")[0] || "5");
    else setHeightFeet("5");

    if (student.heightInches !== undefined) setHeightInches(String(student.heightInches));
    else if (student.height?.includes("'")) setHeightInches(student.height.split("'")[1]?.replace('"', '') || "8");
    else setHeightInches("8");

    setWeightKg(String(student.weightKg || student.weight || "64"));
    setAttendance("Present");
    setStatusTag(student.status || "Active");
    setRemarks("");
    setMedicalNotes("");

    setActiveTab("profile");
  };

  // SAVE SNAPSHOT RECORD TO `qr_records` (Main database remains untouched!)
  const handleSaveSnapshot = async () => {
    if (!scannedCadet) return;
    setSavingSnapshot(true);
    setError(null);

    try {
      const recordId = `QR_${Date.now()}_${scannedCadet.id}`;
      const recordRef = doc(db, "qr_records", recordId);

      const heightFormatted = `${heightFeet}'${heightInches}" (${Math.round((parseInt(heightFeet || "0") * 30.48) + (parseInt(heightInches || "0") * 2.54))} cm)`;
      const weightFormatted = `${weightKg} kg`;

      const snapshotPayload = {
        id: recordId,
        studentId: scannedCadet.id,
        uniqueId: scannedCadet.uniqueId || scannedCadet.id || scannedCadet.emisId || "N/A",
        registrationNumber: scannedCadet.nidBirthReg || scannedCadet.registrationNumber || "N/A",
        emisId: scannedCadet.emisId || "N/A",
        studentName: scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla || "N/A",
        fullNameBangla: scannedCadet.fullNameBangla || "",
        fullNameEnglish: scannedCadet.fullNameEnglish || "",
        fatherName: scannedCadet.fatherNameEnglish || scannedCadet.fatherNameBangla || "N/A",
        motherName: scannedCadet.motherNameEnglish || scannedCadet.motherNameBangla || "N/A",
        scanTime: Timestamp.now(),
        editedTime: Timestamp.now(),
        editedBy: adminSession?.name || adminSession?.username || "QR Admin",
        height: heightFormatted,
        heightFeet: parseInt(heightFeet || "0"),
        heightInches: parseInt(heightInches || "0"),
        weight: weightFormatted,
        weightKg: parseFloat(weightKg || "0"),
        attendance: attendance,
        status: statusTag,
        remarks: remarks.trim() || "Normal Inspection",
        medicalNotes: medicalNotes.trim() || "Fit",
        profilePhoto: scannedCadet.photo || null,
        collegeName: scannedCadet.collegeName || "Cox's Bazar City College",
        battalion: scannedCadet.battalion || "BNCC Platoon",
        rank: scannedCadet.rank || scannedCadet.previousRank || "Cadet",
        bloodGroup: scannedCadet.bloodGroup || "N/A",
        religion: scannedCadet.religion || "N/A",
        gender: scannedCadet.gender || "N/A",
        phone: scannedCadet.studentPhone || scannedCadet.phone || "N/A",
        email: scannedCadet.studentEmail || scannedCadet.email || "N/A",
        presentAddress: scannedCadet.presentAddress || "N/A",
        permanentAddress: scannedCadet.permanentAddress || "N/A",
        dob: scannedCadet.dob || "N/A",
        session: scannedCadet.session || scannedCadet.academicYear || "N/A",
        sscGpa: scannedCadet.sscGpa || "N/A",
        hscGpa: scannedCadet.hscGpa || "N/A",
        
        // Full Original Snapshot Copy
        snapshotData: {
          profilePhoto: scannedCadet.photo || scannedCadet.profilePhoto || null,
          id: scannedCadet.id || "N/A",
          emisId: scannedCadet.emisId || "N/A",
          role: scannedCadet.role || "student",
          status: statusTag || scannedCadet.status || "Active",
          createdAt: scannedCadet.createdAt || null,
          updatedAt: scannedCadet.updatedAt || null,

          fullNameEnglish: scannedCadet.fullNameEnglish || "N/A",
          fullNameBangla: scannedCadet.fullNameBangla || "N/A",
          gender: scannedCadet.gender || "N/A",
          dob: scannedCadet.dob || "N/A",
          nidBirthReg: scannedCadet.nidBirthReg || "N/A",
          religion: scannedCadet.religion || "N/A",
          bloodGroup: scannedCadet.bloodGroup || "N/A",
          specialCategory: scannedCadet.specialCategory || scannedCadet.specialQuota || (scannedCadet.isEthnicMinority ? "Ethnic Minority (ক্ষুদ্র নৃ-গোষ্ঠী)" : "None"),
          isEthnicMinority: scannedCadet.isEthnicMinority ? "Yes" : "No",

          fatherNameEnglish: scannedCadet.fatherNameEnglish || "N/A",
          fatherNameBangla: scannedCadet.fatherNameBangla || "N/A",
          motherNameEnglish: scannedCadet.motherNameEnglish || "N/A",
          motherNameBangla: scannedCadet.motherNameBangla || "N/A",

          studentPhone: scannedCadet.studentPhone || scannedCadet.phone || "N/A",
          studentEmail: scannedCadet.studentEmail || scannedCadet.email || "N/A",
          presentAddress: scannedCadet.presentAddress || "N/A",
          permanentAddress: scannedCadet.permanentAddress || "N/A",

          collegeName: scannedCadet.collegeName || "Cox's Bazar City College",
          registrationNumber: scannedCadet.registrationNumber || scannedCadet.nidBirthReg || "N/A",
          classRoll: scannedCadet.classRoll || "N/A",
          section: scannedCadet.section || "N/A",
          session: scannedCadet.session || scannedCadet.academicYear || "N/A",
          studyStatus: scannedCadet.studyStatus || "Regular",
          attendanceStatus: attendance,

          sscYear: scannedCadet.sscYear || "N/A",
          sscBoard: scannedCadet.sscBoard || "N/A",
          sscGroup: scannedCadet.sscGroup || "N/A",
          sscGpa: scannedCadet.sscGpa || "N/A",
          previousInstitution: scannedCadet.previousInstitution || "N/A",

          hscYear: scannedCadet.hscYear || "N/A",
          hscBoard: scannedCadet.hscBoard || "N/A",
          hscGroup: scannedCadet.hscGroup || "N/A",
          hscOptionalSubject: scannedCadet.hscOptionalSubject || "N/A",
          hscGpa: scannedCadet.hscGpa || "N/A",

          heightFeet: heightFeet,
          heightInches: heightInches,
          height: heightFormatted,
          weightKg: weightKg,

          coCurricularActivities: scannedCadet.coCurricularActivities || [],
          otherCoCurricularActivity: scannedCadet.otherCoCurricularActivity || "N/A",

          previousBNCC: scannedCadet.previousBNCC ? "Yes" : "No",
          previousBattalionRegiment: scannedCadet.previousBattalionRegiment || scannedCadet.battalion || "N/A",
          previousRank: scannedCadet.previousRank || scannedCadet.rank || "N/A",
          previousRankOther: scannedCadet.previousRankOther || "N/A",
          serviceDuration: scannedCadet.serviceDuration || "N/A",

          subject: scannedCadet.subject || "N/A",
          password: scannedCadet.password || "N/A",

          ...scannedCadet,
          editedHeight: heightFormatted,
          editedWeight: weightFormatted,
          editedAttendance: attendance,
          editedRemarks: remarks.trim(),
          editedMedicalNotes: medicalNotes.trim(),
          editedStatus: statusTag,
          snapshotSavedAt: new Date().toISOString()
        }
      };

      await setDoc(recordRef, snapshotPayload);

      setSuccess(`Snapshot record stored successfully in QR Excel Storage! (${scannedCadet.fullNameEnglish || scannedCadet.id})`);
      setIsEditing(false);
      setTimeout(() => setSuccess(null), 4000);

    } catch (err) {
      console.error("Save snapshot error:", err);
      setError("Snapshot ডাটাবেজে রেকর্ড সংরক্ষণ করতে সমস্যা হয়েছে।");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSavingSnapshot(false);
    }
  };

  // Export Filtered Table to XLSX Spreadsheet
  const handleExportExcel = () => {
    const filteredList = getFilteredQrRecords();
    if (filteredList.length === 0) {
      setError("ডাউনলোড করার মত কোনো রেকর্ড পাওয়া যায়নি।");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const exportRows = filteredList.map((rec, index) => {
      const snap = rec.snapshotData || rec;
      return {
        "SL": index + 1,
        "Scan Time": rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleString() : rec.scanTime || "",
        "Edited Time": rec.editedTime?.toDate ? rec.editedTime.toDate().toLocaleString() : rec.editedTime || "",
        "Edited By (QR Admin)": rec.editedBy || snap.editedBy || "QR Admin",
        "Student ID": rec.studentId || snap.id || "",
        "Unique ID": rec.uniqueId || snap.uniqueId || snap.id || "",
        "EMIS ID": rec.emisId || snap.emisId || "",
        "Role": snap.role || "student",
        "Status": rec.status || snap.status || "Active",
        "Created At": snap.createdAt || "",
        "Updated At": snap.updatedAt || "",
        "Student Name (English)": snap.fullNameEnglish || rec.studentName || "",
        "Student Name (Bangla)": snap.fullNameBangla || "",
        "Gender": snap.gender || "",
        "Date of Birth": snap.dob || "",
        "NID / Birth Reg": snap.nidBirthReg || "",
        "Religion": snap.religion || "",
        "Blood Group": snap.bloodGroup || "",
        "Special Category / Ethnic Minority": snap.specialCategory || (snap.isEthnicMinority ? "Ethnic Minority" : "None"),
        "Father's Name (EN)": snap.fatherNameEnglish || "",
        "Father's Name (BN)": snap.fatherNameBangla || "",
        "Mother's Name (EN)": snap.motherNameEnglish || "",
        "Mother's Name (BN)": snap.motherNameBangla || "",
        "Phone": snap.studentPhone || rec.phone || "",
        "Email": snap.studentEmail || "",
        "Present Address": snap.presentAddress || "",
        "Permanent Address": snap.permanentAddress || "",
        "College": snap.collegeName || rec.collegeName || "Cox's Bazar City College",
        "Registration No": snap.registrationNumber || rec.registrationNumber || "",
        "Class Roll": snap.classRoll || "",
        "Section": snap.section || "",
        "Session": snap.session || "",
        "Study Status": snap.studyStatus || "",
        "Attendance": rec.attendance || snap.attendanceStatus || snap.attendance || "",
        "SSC Year": snap.sscYear || "",
        "SSC Board": snap.sscBoard || "",
        "SSC Group": snap.sscGroup || "",
        "SSC GPA": snap.sscGpa || "",
        "Previous Institution": snap.previousInstitution || "",
        "HSC Year": snap.hscYear || "",
        "HSC Board": snap.hscBoard || "",
        "HSC Group": snap.hscGroup || "",
        "HSC Optional Subject": snap.hscOptionalSubject || "",
        "HSC GPA": snap.hscGpa || "",
        "Height Feet": snap.heightFeet || "",
        "Height Inches": snap.heightInches || "",
        "Height (Formatted)": rec.height || snap.height || "",
        "Weight (Kg)": rec.weight || snap.weightKg || snap.weight || "",
        "Co-Curricular Activities": Array.isArray(snap.coCurricularActivities) ? snap.coCurricularActivities.join(", ") : snap.coCurricularActivities || "",
        "Other Activities": snap.otherCoCurricularActivity || "",
        "Previous BNCC": snap.previousBNCC || "",
        "Previous Battalion / Regiment": snap.previousBattalionRegiment || "",
        "Previous Rank": snap.previousRank || "",
        "Previous Rank Other": snap.previousRankOther || "",
        "Service Duration": snap.serviceDuration || "",
        "Subject": snap.subject || "",
        "Remarks": rec.remarks || snap.remarks || "",
        "Medical Notes": rec.medicalNotes || snap.medicalNotes || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "QR_Excel_Storage");
    XLSX.writeFile(workbook, `QR_Admin_Excel_Records_${new Date().toISOString().split("T")[0]}.xlsx`);

    setSuccess("Excel Spreadsheet file generated and downloaded successfully!");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Export Filtered Table to CSV
  const handleExportCSV = () => {
    const filteredList = getFilteredQrRecords();
    if (filteredList.length === 0) return;

    const exportRows = filteredList.map((rec, idx) => {
      const snap = rec.snapshotData || rec;
      return {
        "SL": idx + 1,
        "Scan Time": rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleString() : rec.scanTime || "",
        "Edited Time": rec.editedTime?.toDate ? rec.editedTime.toDate().toLocaleString() : rec.editedTime || "",
        "Edited By": rec.editedBy || snap.editedBy || "QR Admin",
        "Student ID": rec.studentId || snap.id || "",
        "Name": snap.fullNameEnglish || rec.studentName || "",
        "Full Name (BN)": snap.fullNameBangla || "",
        "Phone": snap.studentPhone || rec.phone || "",
        "Height": rec.height || snap.height || "",
        "Weight": rec.weight || snap.weightKg || "",
        "Attendance": rec.attendance || snap.attendanceStatus || "",
        "Status": rec.status || snap.status || "",
        "Co-Curricular": Array.isArray(snap.coCurricularActivities) ? snap.coCurricularActivities.join(", ") : snap.coCurricularActivities || "",
        "Subject": snap.subject || "",
        "Remarks": rec.remarks || snap.remarks || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `QR_Records_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Single Cadet PDF Medical Sheet
  const handleExportPdf = (cadet: any) => {
    if (!cadet) return;
    const docPdf = new jsPDF();

    docPdf.setFillColor(0, 33, 71); // Oxford Navy
    docPdf.rect(0, 0, 210, 24, "F");

    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(14);
    docPdf.text("COX'S BAZAR CITY COLLEGE BNCC PLATOON", 14, 12);
    docPdf.setFontSize(10);
    docPdf.text("QR ADMIN SNAPSHOT MEDICAL & PHYSICAL RECORD FILE", 14, 18);

    docPdf.setTextColor(15, 23, 42);
    docPdf.setFontSize(9);
    docPdf.text(`Report Date: ${new Date().toLocaleString()} | QR Admin Inspector: ${adminSession?.name || "Officer"}`, 14, 30);

    const tableRows = [
      ["Student / Cadet ID", cadet.studentId || cadet.id || "N/A"],
      ["Unique / EMIS ID", cadet.uniqueId || cadet.emisId || "N/A"],
      ["Full Name (English)", cadet.fullNameEnglish || cadet.studentName || "N/A"],
      ["Full Name (Bangla)", cadet.fullNameBangla || "N/A"],
      ["Father's Name", cadet.fatherName || cadet.fatherNameEnglish || "N/A"],
      ["Mother's Name", cadet.motherName || cadet.motherNameEnglish || "N/A"],
      ["Phone Number", cadet.phone || cadet.studentPhone || "N/A"],
      ["Email Address", cadet.email || cadet.studentEmail || "N/A"],
      ["College / Platoon", cadet.collegeName || "Cox's Bazar City College"],
      ["Rank / Position", cadet.rank || "Cadet"],
      ["Blood Group", cadet.bloodGroup || "N/A"],
      ["Gender / Religion", `${cadet.gender || "N/A"} / ${cadet.religion || "N/A"}`],
      ["Height (Feet/Inches)", cadet.height || `${heightFeet}'${heightInches}"`],
      ["Weight (Kg)", cadet.weight || `${weightKg} kg`],
      ["Attendance Status", cadet.attendance || attendance],
      ["Approval / Service Status", cadet.status || statusTag],
      ["Remarks", cadet.remarks || remarks || "Normal"],
      ["Medical Inspection Notes", cadet.medicalNotes || medicalNotes || "Fit"]
    ];

    autoTable(docPdf, {
      startY: 35,
      head: [["Specification Field", "Inspection Value"]],
      body: tableRows,
      theme: "striped",
      headStyles: { fillColor: [0, 33, 71], textColor: [197, 160, 89] },
      styles: { fontSize: 9 }
    });

    docPdf.save(`Medical_Snapshot_${cadet.studentId || cadet.id || "Record"}.pdf`);
    setSuccess("PDF Medical File exported successfully!");
    setTimeout(() => setSuccess(null), 3000);
  };

  // Delete Snapshot from QR Records
  const handleDeleteSnapshot = async (id: string) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে এই Snapshot রেকর্ডটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, "qr_records", id));
      setSuccess("Snapshot রেকর্ড সফলভাবে ডিলিট করা হয়েছে।");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Delete snapshot error:", err);
      setError("ডিলিট করতে ব্যর্থ হয়েছে।");
    }
  };

  // Filter Helper for Excel Storage
  const getFilteredQrRecords = () => {
    return qrRecords.filter(rec => {
      if (filterDate) {
        const recDate = rec.scanTime?.toDate ? rec.scanTime.toDate().toISOString().split("T")[0] : rec.scanDateStr || "";
        if (recDate !== filterDate) return false;
      }
      if (filterBattalion !== "All" && rec.battalion !== filterBattalion) return false;
      if (filterAttendance !== "All" && rec.attendance !== filterAttendance) return false;
      if (filterRank !== "All" && rec.rank !== filterRank) return false;
      if (filterSearch) {
        const queryL = filterSearch.toLowerCase();
        const searchStr = `${rec.studentId} ${rec.uniqueId} ${rec.studentName} ${rec.fullNameBangla} ${rec.phone} ${rec.remarks}`.toLowerCase();
        if (!searchStr.includes(queryL)) return false;
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#002147] text-white flex-col space-y-4">
        <Loader2 className="w-12 h-12 text-[#C5A059] animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#C5A059]">QR Admin Workspace Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col lg:flex-row font-sans">
      
      {/* Sidebar Navigation - Desktop */}
      <aside className="w-full lg:w-72 bg-[#002147] text-white flex-shrink-0 flex flex-col justify-between shadow-2xl border-r border-[#C5A059]/20">
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-[#C5A059]/20 border border-[#C5A059] rounded-2xl flex items-center justify-center shadow-lg">
                <QrCode className="w-6 h-6 text-[#C5A059]" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tight text-white">QR ADMIN</h1>
                <p className="text-[9px] text-[#C5A059] font-bold uppercase tracking-widest">Independent Workspace</p>
              </div>
            </div>
            <span className="px-2 py-0.5 bg-[#C5A059] text-[#002147] text-[8px] font-black uppercase rounded-md tracking-wider">
              PRO
            </span>
          </div>

          {/* User Badge */}
          <div className="p-4 bg-white/5 mx-4 my-4 rounded-2xl border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C5A059] text-[#002147] font-black text-sm flex items-center justify-center shadow-md">
              {adminSession?.name?.[0]?.toUpperCase() || "Q"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{adminSession?.name || "QR Admin"}</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-mono truncate">{adminSession?.role || "Inspector"}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-4 space-y-1.5">
            {[
              { id: "dashboard", label: "Dashboard", icon: Home, badge: null },
              { id: "scan", label: "Scan QR", icon: Scan, badge: "LIVE" },
              { id: "search", label: "Search by ID", icon: Search, badge: null },
              { id: "profile", label: "Medical Profile", icon: User, badge: scannedCadet ? "1" : null },
              { id: "excel", label: "Excel Storage", icon: FileSpreadsheet, badge: qrRecords.length },
              { id: "history", label: "Student History", icon: History, badge: null },
              { id: "settings", label: "Settings", icon: Settings, badge: null }
            ].map((nav) => {
              const Icon = nav.icon;
              const active = activeTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveTab(nav.id as any)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    active 
                      ? "bg-[#C5A059] text-[#002147] shadow-lg shadow-[#C5A059]/20 font-black" 
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${active ? "text-[#002147]" : "text-[#C5A059]"}`} />
                    <span>{nav.label}</span>
                  </div>
                  {nav.badge && (
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full ${
                      active ? "bg-[#002147] text-[#C5A059]" : "bg-[#C5A059]/20 text-[#C5A059]"
                    }`}>
                      {nav.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
            className="w-full py-3 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Exit QR Workspace
          </button>
        </div>
      </aside>

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="lg:hidden w-9 h-9 bg-[#002147] text-[#C5A059] rounded-xl flex items-center justify-center font-bold">
              QR
            </div>
            <div>
              <h2 className="text-base font-black text-[#002147] uppercase tracking-tight flex items-center gap-2">
                {activeTab === "dashboard" && "Workspace Dashboard"}
                {activeTab === "scan" && "Scanner & Verification"}
                {activeTab === "search" && "Student Record Lookup"}
                {activeTab === "profile" && "Medical & Physical Profile File"}
                {activeTab === "excel" && "Independent Excel Storage (qr_records)"}
                {activeTab === "history" && "Snapshot History Timeline"}
                {activeTab === "settings" && "QR Workspace Settings"}
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Main Database: <span className="text-emerald-600 font-mono">Protected (Read-Only)</span> • QR Database: <span className="text-[#002147] font-mono">qr_records (Isolated)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("scan")}
              className="px-4 py-2 bg-[#002147] hover:bg-[#001530] text-[#C5A059] font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Scan QR Code</span>
            </button>
          </div>
        </header>

        {/* Global Toast Alerts */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="m-4 p-4 bg-emerald-500 text-white rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
              <button onClick={() => setSuccess(null)} className="text-white hover:opacity-75">✕</button>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="m-4 p-4 bg-rose-600 text-white rounded-2xl text-xs font-bold shadow-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-white hover:opacity-75">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Tab Content */}
        <div className="p-4 md:p-8 flex-1 overflow-y-auto">

          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Snapshots Stored</p>
                      <p className="text-3xl font-black text-[#002147] mt-1">{qrRecords.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-[#002147]/5 text-[#002147] rounded-2xl flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
                    Stored in Firestore <code className="text-[#002147]">qr_records</code>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Scans & Edits</p>
                      <p className="text-3xl font-black text-emerald-600 mt-1">
                        {qrRecords.filter(r => (r.scanDateStr || r.scanTime?.toDate?.()?.toISOString().split("T")[0]) === todayStr).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
                    Active date: {todayStr}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Present Today</p>
                      <p className="text-3xl font-black text-blue-600 mt-1">
                        {qrRecords.filter(r => r.attendance === "Present").length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
                    Verified physically by QR Admin
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Export Format</p>
                      <p className="text-lg font-black text-[#C5A059] mt-1">XLSX / CSV / PDF</p>
                    </div>
                    <div className="w-12 h-12 bg-[#C5A059]/10 text-[#C5A059] rounded-2xl flex items-center justify-center">
                      <Download className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-bold">
                    Ready for Excel Spreadsheet
                  </div>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-[#002147] uppercase tracking-wider">Quick Action Buttons</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab("scan")}
                    className="p-4 bg-[#002147] text-white rounded-2xl flex items-center justify-between font-bold text-xs hover:bg-[#001530] transition-all cursor-pointer shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <Scan className="w-5 h-5 text-[#C5A059]" />
                      <span>Start Camera QR Scan</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C5A059]" />
                  </button>

                  <button
                    onClick={() => setActiveTab("search")}
                    className="p-4 bg-slate-100 text-slate-800 rounded-2xl flex items-center justify-between font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Search className="w-5 h-5 text-[#002147]" />
                      <span>Search Student by ID / Name</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => setActiveTab("excel")}
                    className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl flex items-center justify-between font-bold text-xs hover:bg-emerald-100 transition-all cursor-pointer border border-emerald-200"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <span>Export Excel Storage</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>

              {/* Recent Scans Table */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#C5A059]" /> Recent Snapshot Records
                  </h3>
                  <button 
                    onClick={() => setActiveTab("excel")}
                    className="text-xs font-bold text-[#002147] hover:underline cursor-pointer"
                  >
                    View All in Excel Storage →
                  </button>
                </div>

                {recentScans.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-xs font-bold">
                    No snapshot records saved yet. Scan a QR code or search a student to save snapshots.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3">Time</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">ID</th>
                          <th className="p-3">Height</th>
                          <th className="p-3">Weight</th>
                          <th className="p-3">Attendance</th>
                          <th className="p-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold">
                        {recentScans.map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3 text-slate-400 font-mono text-[11px]">
                              {rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                            </td>
                            <td className="p-3 font-bold text-[#002147]">{rec.studentName || rec.fullNameEnglish}</td>
                            <td className="p-3 text-slate-600 font-mono">{rec.studentId || rec.uniqueId}</td>
                            <td className="p-3 text-slate-700">{rec.height || "N/A"}</td>
                            <td className="p-3 text-slate-700">{rec.weight || "N/A"}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase ${
                                rec.attendance === "Present" ? "bg-emerald-100 text-emerald-800" :
                                rec.attendance === "Late" ? "bg-amber-100 text-amber-800" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {rec.attendance}
                              </span>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => setSelectedSnapshotModal(rec)}
                                className="px-3 py-1 bg-slate-100 hover:bg-[#002147] hover:text-white text-[#002147] rounded-lg font-bold text-[10px] transition-all cursor-pointer"
                              >
                                View Snapshot
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: LIVE QR SCANNER */}
          {activeTab === "scan" && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#002147] text-[#C5A059] rounded-2xl flex items-center justify-center">
                      <Camera className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-[#002147] uppercase tracking-tight">Camera QR Scanner</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto Focus & Instant ID Lookup</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full animate-pulse">
                    ● READY
                  </span>
                </div>

                {/* Scanner Camera Box */}
                <div className="relative overflow-hidden rounded-3xl border-4 border-[#002147] bg-black aspect-[4/3] w-full flex items-center justify-center shadow-2xl">
                  <div id="reader-qr-admin" className="absolute inset-0 w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />

                  {/* Corner Targets */}
                  <div className="absolute inset-10 pointer-events-none z-10">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#C5A059] rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#C5A059] rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#C5A059] rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#C5A059] rounded-br-xl" />
                  </div>

                  {cameraStatus === "initializing" && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center space-y-3 z-20 text-white">
                      <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-widest">Starting Camera Lens...</p>
                    </div>
                  )}

                  {cameraPermissionError && (
                    <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center space-y-4 z-20 text-white">
                      <XCircle className="w-12 h-12 text-amber-500" />
                      <p className="text-xs font-bold leading-relaxed">{cameraPermissionError}</p>
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button 
                          onClick={() => window.location.reload()}
                          className="px-4 py-2 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold text-xs rounded-xl uppercase transition-all"
                        >
                          Retry Camera
                        </button>
                        <label className="px-4 py-2 bg-[#C5A059] text-[#002147] hover:bg-[#b08e4d] font-black text-xs rounded-xl uppercase transition-all cursor-pointer flex items-center gap-2">
                          <Download className="w-4 h-4 rotate-180" /> QR Image Upload
                          <input type="file" accept="image/*" onChange={handleQrImageUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden Temp Container for File Scan */}
                <div id="qr-file-reader-temp" className="hidden" />

                {/* Camera Controls & File Upload */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="flex-1 min-w-[140px]">
                    <select
                      value={selectedCameraId}
                      onChange={(e) => setSelectedCameraId(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer"
                    >
                      {cameras.map((c, i) => (
                        <option key={c.id} value={c.id}>{c.label || `Camera ${i + 1}`}</option>
                      ))}
                    </select>
                  </div>

                  <label className="px-4 py-2.5 bg-[#C5A059] text-[#002147] hover:bg-[#b08e4d] rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm">
                    <Download className="w-4 h-4 rotate-180" /> Upload QR Image
                    <input type="file" accept="image/*" onChange={handleQrImageUpload} className="hidden" />
                  </label>

                  <button
                    onClick={handleToggleFlashlight}
                    disabled={!supportTorch}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      flashlightActive ? "bg-amber-500 text-white border-amber-600" : "bg-slate-100 border-slate-200 text-slate-700"
                    } disabled:opacity-30`}
                  >
                    <Zap className="w-4 h-4" /> Torch
                  </button>

                  <button
                    onClick={toggleFrontBackCamera}
                    className="px-3 py-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-slate-200"
                  >
                    <RotateCw className="w-4 h-4" /> Flip
                  </button>

                  <button
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      audioEnabled ? "bg-[#002147] text-[#C5A059] border-[#002147]" : "bg-slate-100 text-slate-400 border-slate-200"
                    }`}
                  >
                    {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} Audio
                  </button>
                </div>

                {/* Direct Manual Search Input Box on Scan Page */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-[#002147] uppercase tracking-wider flex items-center gap-2">
                    <Search className="w-4 h-4 text-[#C5A059]" /> Quick Manual Student Search
                  </p>
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSearchById(searchQuery);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Enter Student ID, EMIS, Phone, or Registration No..."
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#002147]"
                    />
                    <button
                      type="submit"
                      disabled={searchingDatabase || !searchQuery.trim()}
                      className="px-5 py-2.5 bg-[#002147] text-[#C5A059] font-black text-xs uppercase tracking-wider rounded-xl hover:bg-[#001530] transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1"
                    >
                      {searchingDatabase ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
                    </button>
                  </form>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: SEARCH BY ID */}
          {activeTab === "search" && (
            <div className="max-w-2xl mx-auto space-y-6">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                <h3 className="text-sm font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#C5A059]" /> Search Main Student Database
                </h3>
                <p className="text-xs text-slate-500">
                  Enter Unique ID, Registration Number, EMIS ID, Phone Number, or Full Name to inspect.
                </p>

                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchById(searchQuery);
                }} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter ID, EMIS, Phone, or Name..."
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#002147]"
                  />
                  <button
                    type="submit"
                    disabled={searchingDatabase}
                    className="px-6 py-3.5 bg-[#002147] text-[#C5A059] font-black text-xs uppercase tracking-wider rounded-2xl hover:bg-[#001530] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {searchingDatabase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Search
                  </button>
                </form>
              </div>

              {/* Multiple Search Results list */}
              {searchResults.length > 0 && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                  <h4 className="text-xs font-black text-[#002147] uppercase tracking-wider">Select Student from Results ({searchResults.length})</h4>
                  <div className="divide-y divide-slate-100">
                    {searchResults.map((st) => (
                      <div key={st.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#002147]">{st.fullNameEnglish || st.fullNameBangla}</p>
                          <p className="text-[10px] text-slate-500 font-mono">ID: {st.id} | Phone: {st.studentPhone || "N/A"}</p>
                        </div>
                        <button
                          onClick={() => selectStudentForProfile(st)}
                          className="px-4 py-2 bg-[#002147] text-[#C5A059] font-bold text-xs rounded-xl hover:bg-[#001530] cursor-pointer"
                        >
                          Select Profile
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: MEDICAL PROFILE / INSPECTION FILE */}
          {activeTab === "profile" && scannedCadet && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Back Bar */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ← Back to Dashboard
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportPdf(scannedCadet)}
                    className="px-4 py-2 bg-[#002147] text-[#C5A059] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Export PDF
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print Sheet
                  </button>
                </div>
              </div>

              {/* Main Medical File Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                
                {/* Header Banner */}
                <div className="bg-[#002147] text-white p-6 flex flex-col sm:flex-row items-center gap-6 relative">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-[#C5A059] overflow-hidden bg-slate-900 shadow-2xl shrink-0 flex items-center justify-center">
                    {scannedCadet.photo ? (
                      <img src={scannedCadet.photo} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <User className="w-16 h-16 text-slate-600" />
                    )}
                  </div>

                  <div className="text-center sm:text-left space-y-1">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="px-3 py-1 bg-[#C5A059] text-[#002147] text-[9px] font-black uppercase tracking-widest rounded-full inline-block">
                        {scannedCadet.status || "ACTIVE CADET"}
                      </span>
                      {(scannedCadet.isEthnicMinority || scannedCadet.specialCategory || scannedCadet.specialQuota) && (
                        <span className="px-3 py-1 bg-amber-500 text-slate-950 text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 shadow-sm">
                          ⭐ Special Category: {scannedCadet.specialCategory || scannedCadet.specialQuota || "Ethnic Minority (ক্ষুদ্র নৃ-গোষ্ঠী)"}
                        </span>
                      )}
                      {((Array.isArray(scannedCadet.coCurricularActivities) && scannedCadet.coCurricularActivities.length > 0) || scannedCadet.otherCoCurricularActivity) && (
                        <span className="px-3 py-1 bg-teal-500 text-slate-950 text-[9px] font-black uppercase tracking-widest rounded-full inline-flex items-center gap-1 shadow-sm">
                          🎯 Co-Curricular: {Array.isArray(scannedCadet.coCurricularActivities) ? scannedCadet.coCurricularActivities.join(", ") : scannedCadet.coCurricularActivities} {scannedCadet.otherCoCurricularActivity ? `(${scannedCadet.otherCoCurricularActivity})` : ""}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-white">{scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla}</h2>
                    <p className="text-xs text-[#C5A059] font-bold font-mono">Unique ID / Cad No: {scannedCadet.id}</p>
                    <p className="text-xs text-slate-300 font-bold">{scannedCadet.collegeName || "Cox's Bazar City College"}</p>
                  </div>
                </div>

                {/* Edit & Save Snapshot Action Bar */}
                <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-black text-[#002147] uppercase tracking-wider">Measurement & Physical Inspection</h3>
                    <p className="text-[10px] text-slate-500">Edit fields below and click "Save Snapshot" to record into <code className="text-[#002147]">qr_records</code>.</p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit className="w-4 h-4" /> {isEditing ? "Close Edit" : "Edit Measurements"}
                    </button>

                    <button
                      onClick={handleSaveSnapshot}
                      disabled={savingSnapshot}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-[#002147] hover:bg-[#001530] text-[#C5A059] font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {savingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Snapshot
                    </button>
                  </div>
                </div>

                {/* Measurement Fields Form */}
                <div className="p-6 bg-amber-50/50 border-b border-amber-100 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* Height Feet & Inches */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Height (Feet & Inches)</label>
                      <div className="flex gap-2">
                        <select
                          value={heightFeet}
                          onChange={(e) => setHeightFeet(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                        >
                          {["4", "5", "6", "7"].map(f => (
                            <option key={f} value={f}>{f} Feet</option>
                          ))}
                        </select>
                        <select
                          value={heightInches}
                          onChange={(e) => setHeightInches(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                        >
                          {Array.from({ length: 12 }, (_, i) => String(i)).map(i => (
                            <option key={i} value={i}>{i} Inches</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Weight Kg */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Weight (Kg)</label>
                      <input
                        type="number"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                        placeholder="e.g. 64"
                      />
                    </div>

                    {/* Attendance */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Attendance Status</label>
                      <select
                        value={attendance}
                        onChange={(e) => setAttendance(e.target.value as any)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="Present">Present</option>
                        <option value="Late">Late</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </div>

                    {/* Service Status */}
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Cadet Status</label>
                      <select
                        value={statusTag}
                        onChange={(e) => setStatusTag(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="Active">Active 🟢</option>
                        <option value="Approved">Approved</option>
                        <option value="Pending">Pending</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>

                  </div>

                  {/* Remarks & Medical Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Remarks</label>
                      <input
                        type="text"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter inspection remarks..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1">Medical Notes</label>
                      <input
                        type="text"
                        value={medicalNotes}
                        onChange={(e) => setMedicalNotes(e.target.value)}
                        placeholder="Enter medical / physical notes..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Detailed Information Grid */}
                <div className="p-6 space-y-6">
                  <h3 className="text-xs font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4 text-[#C5A059]" /> Complete Student Profile Sheet
                  </h3>

                  {/* Category 1: Personal & Identification */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      1. Personal & Identification
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Full Name (English)</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.fullNameEnglish || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Full Name (Bangla)</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.fullNameBangla || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Unique Cadet ID</span>
                        <p className="text-slate-900 font-mono mt-1">{scannedCadet.id || scannedCadet.uniqueId || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">EMIS ID</span>
                        <p className="text-slate-900 font-mono mt-1">{scannedCadet.emisId || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Registration / NID No</span>
                        <p className="text-slate-900 font-mono mt-1">{scannedCadet.nidBirthReg || scannedCadet.registrationNumber || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Date of Birth</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.dob || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Gender / Religion</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.gender || "N/A"} | {scannedCadet.religion || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Blood Group</span>
                        <p className="text-rose-600 font-black mt-1">{scannedCadet.bloodGroup || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Ethnic Minority</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.isEthnicMinority ? "Yes (হ্যাঁ)" : "No (না)"}</p>
                      </div>
                      {(scannedCadet.isEthnicMinority || scannedCadet.specialCategory || scannedCadet.specialQuota) && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-300">
                          <span className="text-[10px] text-amber-800 uppercase font-black block flex items-center gap-1">
                            ⭐ Special Category
                          </span>
                          <p className="text-amber-950 font-black mt-1">
                            {scannedCadet.specialCategory || scannedCadet.specialQuota || "Ethnic Minority (ক্ষুদ্র নৃ-গোষ্ঠী)"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category 2: Family Information */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      2. Family Information
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Father's Name (EN / BN)</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.fatherNameEnglish || "N/A"} {scannedCadet.fatherNameBangla ? `(${scannedCadet.fatherNameBangla})` : ""}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Mother's Name (EN / BN)</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.motherNameEnglish || "N/A"} {scannedCadet.motherNameBangla ? `(${scannedCadet.motherNameBangla})` : ""}</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 3: Contact Details */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      3. Contact Information
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Student Phone</span>
                        <p className="text-[#002147] font-mono mt-1">{scannedCadet.studentPhone || scannedCadet.phone || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Student Email</span>
                        <p className="text-slate-900 font-mono mt-1">{scannedCadet.studentEmail || scannedCadet.email || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Present Address</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.presentAddress || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Permanent Address</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.permanentAddress || "N/A"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 4: Academic Information */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      4. Academic Information
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">College Name</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.collegeName || "Cox's Bazar City College"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Class Roll / Section</span>
                        <p className="text-slate-900 mt-1">Roll: {scannedCadet.classRoll || "N/A"} | Sec: {scannedCadet.section || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Session / Study Status</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.session || scannedCadet.academicYear || "N/A"} ({scannedCadet.studyStatus || "Regular"})</p>
                      </div>
                      {scannedCadet.subject && (
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 md:col-span-2">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">Subject (বিষয়)</span>
                          <p className="text-[#002147] font-black mt-1">{scannedCadet.subject}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category 5: SSC & HSC Record */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      5. Educational History (SSC & HSC)
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] text-[#002147] uppercase font-black block border-b pb-1">SSC Record</span>
                        <p>Year: {scannedCadet.sscYear || "N/A"} | Board: {scannedCadet.sscBoard || "N/A"}</p>
                        <p>Group: {scannedCadet.sscGroup || "N/A"} | GPA: <span className="text-emerald-700 font-black">{scannedCadet.sscGpa || "N/A"}</span></p>
                        <p className="text-[10px] text-slate-500">Prev Inst: {scannedCadet.previousInstitution || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] text-[#002147] uppercase font-black block border-b pb-1">HSC Record</span>
                        <p>Year: {scannedCadet.hscYear || "N/A"} | Board: {scannedCadet.hscBoard || "N/A"}</p>
                        <p>Group: {scannedCadet.hscGroup || "N/A"} | Optional: {scannedCadet.hscOptionalSubject || "N/A"}</p>
                        <p>GPA: <span className="text-emerald-700 font-black">{scannedCadet.hscGpa || "N/A"}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Category 6: BNCC & Military Service */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      6. BNCC & Military History
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold text-slate-700">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Previous BNCC Experience</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.previousBNCC ? "Yes" : "No"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Battalion / Regiment</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.previousBattalionRegiment || scannedCadet.battalion || "N/A"}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase font-black block">Rank & Duration</span>
                        <p className="text-slate-900 mt-1">{scannedCadet.previousRank || scannedCadet.rank || "Cadet"} ({scannedCadet.serviceDuration || "N/A"})</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 7: Co-Curricular Activities */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-[#002147] uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                      7. Co-Curricular Activities (সহ-শিক্ষা কার্যক্রম)
                    </p>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                      {((Array.isArray(scannedCadet.coCurricularActivities) && scannedCadet.coCurricularActivities.length > 0) || (typeof scannedCadet.coCurricularActivities === "string" && scannedCadet.coCurricularActivities.trim()) || scannedCadet.otherCoCurricularActivity) ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(scannedCadet.coCurricularActivities) ? (
                              scannedCadet.coCurricularActivities.map((act: string, idx: number) => (
                                <span key={idx} className="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-200 rounded-lg text-[11px] font-black inline-flex items-center gap-1">
                                  🎯 {act}
                                </span>
                              ))
                            ) : typeof scannedCadet.coCurricularActivities === "string" && scannedCadet.coCurricularActivities.trim() ? (
                              scannedCadet.coCurricularActivities.split(",").map((act: string, idx: number) => (
                                <span key={idx} className="px-2.5 py-1 bg-teal-100 text-teal-900 border border-teal-200 rounded-lg text-[11px] font-black inline-flex items-center gap-1">
                                  🎯 {act.trim()}
                                </span>
                              ))
                            ) : null}
                          </div>
                          {scannedCadet.otherCoCurricularActivity && (
                            <p className="text-slate-600 font-semibold text-[11px] mt-1">
                              <span className="font-bold text-slate-800">Other Activities:</span> {scannedCadet.otherCoCurricularActivity}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic">No co-curricular activities recorded (প্রযোজ্য নয়)</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* History Section for this Student */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
                  <h3 className="text-xs font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-[#C5A059]" /> Saved Snapshot History for this Student ({cadetSnapshotHistory.length})
                  </h3>

                  {cadetSnapshotHistory.length === 0 ? (
                    <p className="text-xs text-slate-400 font-bold italic">No snapshots saved yet for this student.</p>
                  ) : (
                    <div className="space-y-2">
                      {cadetSnapshotHistory.map((h) => (
                        <div key={h.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-center justify-between font-bold">
                          <div>
                            <span className="text-[#002147] font-mono">{h.scanTime?.toDate ? h.scanTime.toDate().toLocaleString() : h.id}</span>
                            <p className="text-[10px] text-slate-500">Height: {h.height} | Weight: {h.weight} | Attendance: {h.attendance}</p>
                          </div>
                          <button
                            onClick={() => setSelectedSnapshotModal(h)}
                            className="px-3 py-1 bg-slate-100 hover:bg-[#002147] hover:text-white rounded-lg text-[10px] text-[#002147]"
                          >
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 5: EXCEL STORAGE PAGE (`qr_records`) */}
          {activeTab === "excel" && (
            <div className="space-y-6">
              
              {/* Header & Export Bar */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-[#002147] uppercase tracking-tight flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" /> Independent QR Excel Database
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    All snapshot records saved from scans or manual edits. Exportable to Excel (.xlsx).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={handleExportExcel}
                    className="flex-1 md:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4" /> Export Excel (.xlsx)
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="flex-1 md:flex-none px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#C5A059]" /> CSV
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="flex-1 md:flex-none px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print
                  </button>
                </div>
              </div>

              {/* Filter Controls Bar */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-black text-[#002147] uppercase tracking-wider">
                  <Filter className="w-4 h-4 text-[#C5A059]" /> Filter Records
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Search Keyword</label>
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Name, ID, Phone..."
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date</label>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Attendance</label>
                    <select
                      value={filterAttendance}
                      onChange={(e) => setFilterAttendance(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="All">All Attendance</option>
                      <option value="Present">Present</option>
                      <option value="Late">Late</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
                    <select
                      value={filterRank}
                      onChange={(e) => setFilterRank(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setFilterSearch("");
                        setFilterDate("");
                        setFilterAttendance("All");
                        setFilterRank("All");
                      }}
                      className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Showing {getFilteredQrRecords().length} Snapshot Records</span>
                  <span className="font-mono text-[#002147]">Table: qr_records</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3">Scan Time</th>
                        <th className="p-3">Edited By</th>
                        <th className="p-3">Student ID</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Height</th>
                        <th className="p-3">Weight</th>
                        <th className="p-3">Attendance</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Remarks</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {getFilteredQrRecords().length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                            No snapshot records found matching your filter criteria.
                          </td>
                        </tr>
                      ) : (
                        getFilteredQrRecords().map((rec) => (
                          <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {rec.scanTime?.toDate ? rec.scanTime.toDate().toLocaleString() : rec.id}
                            </td>
                            <td className="p-3 font-bold text-[#002147]">{rec.editedBy || "QR Admin"}</td>
                            <td className="p-3 font-mono text-slate-600">{rec.studentId || rec.uniqueId}</td>
                            <td className="p-3 font-bold">{rec.studentName || rec.fullNameEnglish}</td>
                            <td className="p-3 text-slate-700">{rec.height || "N/A"}</td>
                            <td className="p-3 text-slate-700">{rec.weight || "N/A"}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                                rec.attendance === "Present" ? "bg-emerald-100 text-emerald-800" :
                                rec.attendance === "Late" ? "bg-amber-100 text-amber-800" :
                                "bg-rose-100 text-rose-800"
                              }`}>
                                {rec.attendance}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]">
                                {rec.status || "Active"}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 truncate max-w-[150px]">{rec.remarks || "-"}</td>
                            <td className="p-3 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={() => setSelectedSnapshotModal(rec)}
                                className="px-2.5 py-1 bg-[#002147] text-[#C5A059] rounded-lg text-[10px] font-bold hover:bg-[#001530] cursor-pointer"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleDeleteSnapshot(rec.id)}
                                className="px-2.5 py-1 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 6: STUDENT SNAPSHOT HISTORY */}
          {activeTab === "history" && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
                <h3 className="text-sm font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-[#C5A059]" /> Student Snapshot Timeline History
                </h3>
                <p className="text-xs text-slate-500">
                  Select or search a student to view all saved historical physical snapshots over time.
                </p>

                {scannedCadet ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#002147]">{scannedCadet.fullNameEnglish || scannedCadet.fullNameBangla}</p>
                      <p className="text-[10px] text-slate-500 font-mono">ID: {scannedCadet.id}</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("search")}
                      className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                    >
                      Change Student
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveTab("search")}
                    className="w-full py-4 bg-[#002147] text-[#C5A059] font-bold text-xs uppercase tracking-wider rounded-2xl cursor-pointer"
                  >
                    Click Here to Search & Select Student
                  </button>
                )}

                {/* Timeline list */}
                {cadetSnapshotHistory.length > 0 && (
                  <div className="space-y-4 pt-4">
                    {cadetSnapshotHistory.map((snap, idx) => (
                      <div key={snap.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 relative">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#002147] font-mono">
                            {snap.scanTime?.toDate ? snap.scanTime.toDate().toLocaleString() : snap.id}
                          </span>
                          <span className="px-2 py-0.5 bg-[#C5A059]/20 text-[#002147] font-black text-[10px] rounded-full">
                            Snapshot #{cadetSnapshotHistory.length - idx}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-50 rounded-xl">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block">Height</span>
                            <span className="text-xs font-bold text-slate-800">{snap.height}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block">Weight</span>
                            <span className="text-xs font-bold text-slate-800">{snap.weight}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block">Attendance</span>
                            <span className="text-xs font-bold text-emerald-600">{snap.attendance}</span>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 flex justify-between">
                          <span>Inspector: {snap.editedBy || "QR Admin"}</span>
                          <span>Remarks: {snap.remarks || "None"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-xl mx-auto space-y-6">
              
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6">
                <h3 className="text-sm font-black text-[#002147] uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#C5A059]" /> QR Workspace Preferences
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-[#002147]">Audio Feedback Beep</p>
                      <p className="text-[10px] text-slate-500">Play sound chime when QR code is scanned successfully</p>
                    </div>
                    <button
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                        audioEnabled ? "bg-[#002147] text-[#C5A059]" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {audioEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-[#002147]">Target Collection</p>
                      <p className="text-[10px] text-slate-500">Snapshots saved to independent Firestore storage</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      qr_records
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <p className="text-xs font-bold text-[#002147]">Main Database Protection</p>
                      <p className="text-[10px] text-slate-500">Original student data is protected from modification</p>
                    </div>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                      READ ONLY
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden bg-[#002147] text-white border-t border-[#C5A059]/30 fixed bottom-0 left-0 right-0 z-40 px-2 py-2 flex items-center justify-around shadow-2xl">
          {[
            { id: "dashboard", label: "Home", icon: Home },
            { id: "scan", label: "Scan", icon: Camera },
            { id: "excel", label: "Excel", icon: FileSpreadsheet },
            { id: "profile", label: "Profile", icon: User }
          ].map((nav) => {
            const Icon = nav.icon;
            const active = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id as any)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                  active ? "text-[#C5A059] bg-white/10 font-black" : "text-slate-300"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "text-[#C5A059]" : "text-slate-300"}`} />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </nav>

      </main>

      {/* Snapshot Detail Modal View */}
      <AnimatePresence>
        {selectedSnapshotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#002147] text-[#C5A059] rounded-2xl flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#002147] uppercase">Snapshot Record Details</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {selectedSnapshotModal.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSnapshotModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Student Name</span>
                    <span className="text-[#002147] font-bold text-sm">{selectedSnapshotModal.studentName || selectedSnapshotModal.fullNameEnglish}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Student / Cad ID</span>
                    <span className="text-slate-800 font-mono">{selectedSnapshotModal.studentId || selectedSnapshotModal.uniqueId}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Height</span>
                    <span className="text-slate-800">{selectedSnapshotModal.height || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Weight</span>
                    <span className="text-slate-800">{selectedSnapshotModal.weight || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Attendance</span>
                    <span className="text-emerald-600">{selectedSnapshotModal.attendance || "Present"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 uppercase font-black block">Saved By (Admin)</span>
                    <span className="text-[#002147]">{selectedSnapshotModal.editedBy || "QR Admin"}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl space-y-2">
                  <span className="text-[9px] text-slate-400 uppercase font-black block">Remarks / Notes</span>
                  <p className="text-slate-700 font-normal">{selectedSnapshotModal.remarks || "No remarks noted."}</p>
                </div>

                {/* Raw JSON Snapshot Preview */}
                <div className="p-4 bg-slate-900 text-slate-300 rounded-2xl space-y-2 font-mono text-[10px]">
                  <span className="text-[#C5A059] font-bold uppercase block">Raw JSON Snapshot Copy</span>
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedSnapshotModal.snapshotData || selectedSnapshotModal, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleExportPdf(selectedSnapshotModal)}
                  className="flex-1 py-3 bg-[#002147] text-[#C5A059] font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Export PDF
                </button>
                <button
                  onClick={() => setSelectedSnapshotModal(null)}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
