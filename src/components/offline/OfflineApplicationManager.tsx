import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, Download, Printer, Plus, Search, Filter, Eye, Edit, Trash2, 
  Upload, CheckCircle, Clock, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
  FileSpreadsheet, Sparkles, User, Phone, MapPin, Building, ShieldCheck, 
  Layers, ArrowRight, X, ExternalLink, Paperclip, Check, FileCheck, Info,
  GraduationCap, Calendar, Heart, Award, HelpCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { OfflineApplication, OfflineApplicationStatus } from "../../types/offlineApplication";
import { 
  getOfflineApplications, 
  saveOfflineApplication, 
  updateOfflineApplication, 
  deleteOfflineApplication, 
  generateNextOfflineId, 
  getBlankOfflineApplication,
  syncAllPendingOfflineApplications,
  fetchAndMergeCloudOfflineApplications
} from "../../lib/offlineApplicationStore";
import { OfflineLegalDocument, SKILL_OPTIONS } from "./OfflineLegalDocument";
import { downloadElementAsPdf } from "../../lib/pdfUtils";

interface OfflineApplicationManagerProps {
  adminSession?: any;
  onLogActivity?: (type: string, targetId: string, details: string) => void;
}

export function OfflineApplicationManager({ adminSession, onLogActivity }: OfflineApplicationManagerProps) {
  // Navigation Sub-Tabs: "dashboard" | "generate" | "upload" | "list"
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "generate" | "upload" | "list">("dashboard");

  // Applications list
  const [applications, setApplications] = useState<OfflineApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Generator State
  const [formData, setFormData] = useState<OfflineApplication>(getBlankOfflineApplication());
  const [isBlankMode, setIsBlankMode] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<number>(0.75);

  // Ref for the Legal document in Generator
  const generatorDocRef = useRef<HTMLDivElement>(null);
  
  // Ref for the Legal document in Preview Modal
  const modalDocRef = useRef<HTMLDivElement>(null);
  const [modalApp, setModalApp] = useState<OfflineApplication | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Manual Upload State
  const [uploadAppId, setUploadAppId] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadFatherName, setUploadFatherName] = useState("");
  const [uploadMotherName, setUploadMotherName] = useState("");
  const [uploadPhone, setUploadPhone] = useState("");
  const [uploadInstitution, setUploadInstitution] = useState("Cox's Bazar City College");
  const [uploadClassDept, setUploadClassDept] = useState("HSC 1st Year (Science)");
  const [uploadAcademicYear, setUploadAcademicYear] = useState("2026-2027");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadStatus, setUploadStatus] = useState<OfflineApplicationStatus>("Uploaded");
  const [uploadNotes, setUploadNotes] = useState("");

  const [scannedFormFile, setScannedFormFile] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null);
  const [admitCardFile, setAdmitCardFile] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<{ name: string; size: number; type: string; dataUrl: string } | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<Array<{ name: string; size: number; type: string; dataUrl: string }>>([]);
  const [otherDocs, setOtherDocs] = useState<Array<{ name: string; size: number; type: string; dataUrl: string }>>([]);
  const [savingUpload, setSavingUpload] = useState(false);

  // Document Replace Modal state
  const [docModalApp, setDocModalApp] = useState<OfflineApplication | null>(null);
  const [docModalType, setDocModalType] = useState<"scannedForm" | "admitCard" | "applicantPhoto" | "supportingDocs">("scannedForm");

  // Table Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const [syncingCloud, setSyncingCloud] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load and listen for changes + trigger bidirectional Firestore cloud sync
  const reloadApplications = () => {
    setApplications(getOfflineApplications());
    setLoading(false);
  };

  const handleManualCloudSync = async () => {
    setSyncingCloud(true);
    try {
      const { synced, failed } = await syncAllPendingOfflineApplications();
      await fetchAndMergeCloudOfflineApplications(true);
      reloadApplications();
      if (failed > 0) {
        showToast(`সিঙ্ক সম্পন্ন (${synced} সফল, ${failed} অপেক্ষমাণ)`, "info");
      } else {
        showToast(`সকল অফলাইন আবেদন ক্লাউডে সিঙ্ক হয়েছে (${synced} নতুন)`, "success");
      }
    } finally {
      setSyncingCloud(false);
    }
  };

  useEffect(() => {
    reloadApplications();
    void fetchAndMergeCloudOfflineApplications(true);
    const handleStorageChange = () => reloadApplications();
    const handleOnline = () => {
      void syncAllPendingOfflineApplications().then(() => fetchAndMergeCloudOfflineApplications(true));
    };
    window.addEventListener("offline_apps_changed", handleStorageChange);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline_apps_changed", handleStorageChange);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Stats calculation
  const stats = {
    total: applications.length,
    generated: applications.filter(a => a.status === "Form Generated" || a.status === "Draft").length,
    uploaded: applications.filter(a => a.status === "Uploaded" || a.status === "Submitted Offline").length,
    underReview: applications.filter(a => a.status === "Under Review").length,
    approved: applications.filter(a => a.status === "Approved").length,
    rejected: applications.filter(a => a.status === "Rejected").length,
  };

  // Handle Form Input Changes
  const handleInputChange = (field: keyof OfflineApplication, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSscChange = (field: keyof OfflineApplication["ssc"], value: string) => {
    setFormData(prev => ({
      ...prev,
      ssc: {
        ...(prev.ssc || { exam: "এসএসসি/সমমান", board: "", gpa: "", institution: "", passingYear: "" }),
        [field]: value
      }
    }));
  };

  const handleHscChange = (field: keyof NonNullable<OfflineApplication["hsc"]>, value: string) => {
    setFormData(prev => ({
      ...prev,
      hsc: {
        ...(prev.hsc || { exam: "এইচএসসি/সমমান", board: "", gpa: "", institution: "", passingYear: "" }),
        [field]: value
      }
    }));
  };

  const toggleSkill = (skill: string) => {
    const current = formData.skills || [];
    if (current.includes(skill)) {
      handleInputChange("skills", current.filter(s => s !== skill));
    } else {
      handleInputChange("skills", [...current, skill]);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast("ছবির সাইজ ৩ মেগাবাইটের কম হতে হবে", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      handleInputChange("applicantPhoto", event.target?.result as string);
      showToast("ছবি সফলভাবে সংযুক্ত হয়েছে", "success");
    };
    reader.readAsDataURL(file);
  };

  // Generate / Save Form
  const handleSaveAndGenerate = () => {
    if (!isBlankMode && !formData.fullNameBangla && !formData.fullNameEnglish) {
      showToast("আবেদনকারীর নাম (বাংলা অথবা ইংরেজি) প্রদান করুন", "error");
      return;
    }

    const appToSave: OfflineApplication = {
      ...formData,
      status: formData.status === "Draft" ? "Form Generated" : formData.status,
      formGeneratedDate: formData.formGeneratedDate || new Date().toISOString().split("T")[0],
    };

    saveOfflineApplication(appToSave);
    showToast(`অফলাইন আবেদন ${appToSave.id} সফলভাবে তৈরি ও সংরক্ষিত হয়েছে`, "success");
    
    if (onLogActivity) {
      onLogActivity("OFFLINE_APP_GENERATE", appToSave.id, `Generated offline form for ${appToSave.fullNameBangla || appToSave.fullNameEnglish || "Blank"}`);
    }
  };

  // Reset Form
  const handleResetForm = () => {
    setFormData(getBlankOfflineApplication());
    setIsBlankMode(false);
    showToast("ফর্ম রিসেট করা হয়েছে", "info");
  };

  // Print Action
  const handlePrint = (targetRef?: React.RefObject<HTMLDivElement | null>) => {
    window.print();
  };

  // Download PDF Action (Legal Size 8.5 x 14 inches)
  const handleDownloadPdf = async (element: HTMLElement | null, fileName: string) => {
    if (!element) {
      showToast("ডকুমেন্ট এলিমেন্ট পাওয়া যায়নি", "error");
      return;
    }
    setGeneratingPdf(true);
    try {
      await downloadElementAsPdf(element, fileName, {
        orientation: "p",
        format: "legal", // 8.5in x 14in
        pixelRatio: 2.5
      });
      showToast("লিগ্যাল সাইজ PDF সফলভাবে ডাউনলোড হয়েছে", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showToast("PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে ব্রাউজার প্রিন্ট অপশনটি ব্যবহার করুন।", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // File Upload Helper (converts File to { name, size, type, dataUrl })
  const processUploadedFile = (file: File): Promise<{ name: string; size: number; type: string; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: (e.target?.result as string) || ""
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Submit Manual Upload Desk
  const handleSaveManualUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadAppId.trim()) {
      showToast("অনুগ্রহ করে আবেদন আইডি প্রদান করুন", "error");
      return;
    }
    if (!uploadName.trim()) {
      showToast("আবেদনকারীর নাম প্রদান করুন", "error");
      return;
    }

    setSavingUpload(true);
    try {
      const existing = applications.find(a => a.id.toUpperCase() === uploadAppId.trim().toUpperCase());
      const now = new Date().toISOString();

      const newRecord: OfflineApplication = {
        ...(existing || getBlankOfflineApplication()),
        id: uploadAppId.trim().toUpperCase(),
        fullNameBangla: existing?.fullNameBangla || uploadName.trim(),
        fullNameEnglish: existing?.fullNameEnglish || uploadName.trim(),
        fatherName: uploadFatherName.trim() || existing?.fatherName || "",
        fatherNameBangla: uploadFatherName.trim() || existing?.fatherNameBangla || "",
        fatherNameEnglish: uploadFatherName.trim() || existing?.fatherNameEnglish || "",
        motherName: uploadMotherName.trim() || existing?.motherName || "",
        motherNameBangla: uploadMotherName.trim() || existing?.motherNameBangla || "",
        motherNameEnglish: uploadMotherName.trim() || existing?.motherNameEnglish || "",
        studentPhone: uploadPhone.trim() || existing?.studentPhone || "",
        institution: uploadInstitution.trim() || existing?.institution || "Cox's Bazar City College",
        classDepartment: uploadClassDept.trim() || existing?.classDepartment || "",
        classYear: uploadClassDept.trim() || existing?.classYear || "HSC 1st Year",
        academicYear: uploadAcademicYear.trim() || existing?.academicYear || "2026-2027",
        applicationDate: uploadDate || existing?.applicationDate || now.split("T")[0],
        status: uploadStatus,
        notes: uploadNotes.trim(),
        applicantPhoto: photoFile ? photoFile.dataUrl : existing?.applicantPhoto,
        uploadedFiles: {
          scannedForm: scannedFormFile ? { ...scannedFormFile, uploadedAt: now } : existing?.uploadedFiles?.scannedForm,
          admitCard: admitCardFile ? { ...admitCardFile, uploadedAt: now } : existing?.uploadedFiles?.admitCard,
          applicantPhoto: photoFile ? { ...photoFile, uploadedAt: now } : existing?.uploadedFiles?.applicantPhoto,
          supportingDocs: supportingDocs.length > 0 
            ? supportingDocs.map(d => ({ ...d, uploadedAt: now }))
            : existing?.uploadedFiles?.supportingDocs || [],
          otherDocs: otherDocs.length > 0
            ? otherDocs.map(d => ({ ...d, uploadedAt: now }))
            : existing?.uploadedFiles?.otherDocs || []
        }
      };

      saveOfflineApplication(newRecord);
      showToast(`অফলাইন আবেদন ${newRecord.id} এর নথিপত্র সফলভাবে সংরক্ষিত হয়েছে`, "success");

      if (onLogActivity) {
        onLogActivity("OFFLINE_APP_UPLOAD", newRecord.id, `Uploaded physical documents for ${newRecord.fullNameBangla}`);
      }

      // Reset Upload fields
      setUploadAppId("");
      setUploadName("");
      setUploadFatherName("");
      setUploadMotherName("");
      setUploadPhone("");
      setUploadClassDept("HSC 1st Year (Science)");
      setUploadAcademicYear("2026-2027");
      setUploadNotes("");
      setScannedFormFile(null);
      setAdmitCardFile(null);
      setPhotoFile(null);
      setSupportingDocs([]);
      setOtherDocs([]);

      setActiveSubTab("list");
    } catch (err) {
      console.error("Upload error:", err);
      showToast("আপলোড সংরক্ষণ করতে সমস্যা হয়েছে", "error");
    } finally {
      setSavingUpload(false);
    }
  };

  // Quick Status Updater in List
  const handleStatusChange = (appId: string, newStatus: OfflineApplicationStatus) => {
    updateOfflineApplication(appId, { status: newStatus });
    showToast(`আবেদন ${appId} এর স্ট্যাটাস '${newStatus}' এ পরিবর্তন করা হয়েছে`, "success");
    if (onLogActivity) {
      onLogActivity("OFFLINE_STATUS_UPDATE", appId, `Status changed to ${newStatus}`);
    }
  };

  // Delete Record
  const handleDelete = (appId: string) => {
    deleteOfflineApplication(appId);
    setConfirmDeleteId(null);
    showToast(`আবেদন ${appId} মুছে ফেলা হয়েছে`, "info");
    if (onLogActivity) {
      onLogActivity("OFFLINE_APP_DELETE", appId, `Deleted application ${appId}`);
    }
  };

  // Filtered List
  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.fullNameBangla?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.fullNameEnglish?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.studentPhone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.classRoll?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.classDepartment?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "All" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredApplications.length / itemsPerPage) || 1;
  const paginatedApplications = filteredApplications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export to Excel
  const handleExportExcel = () => {
    const dataToExport = filteredApplications.map(app => ({
      "আবেদন আইডি": app.id,
      "ক্যাডেট নং": app.cadetNumber || "N/A",
      "নাম (বাংলা)": app.fullNameBangla,
      "নাম (ইংরেজি)": app.fullNameEnglish,
      "পিতার নাম": app.fatherNameBangla || app.fatherName,
      "মাতার নাম": app.motherNameBangla || app.motherName,
      "মোবাইল": app.studentPhone,
      "শ্রেণি/বিভাগ": app.classDepartment || app.classYear,
      "রোল": app.classRoll,
      "শিক্ষাবর্ষ": app.academicYear || "2026-2027",
      "জন্ম তারিখ": app.dob,
      "রক্তের গ্রুপ": app.bloodGroup,
      "স্ট্যাটাস": app.status,
      "আবেদনের তারিখ": app.applicationDate || app.createdAt.split("T")[0]
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Offline_Applications");
    XLSX.writeFile(workbook, `BNCC_Offline_Applications_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("এক্সেল ফাইল সফলভাবে ডাউনলোড হয়েছে", "success");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold transition-all duration-300 ${
          toastMessage.type === "success" 
            ? "bg-emerald-950/95 border-emerald-500/50 text-emerald-200"
            : toastMessage.type === "error"
            ? "bg-rose-950/95 border-rose-500/50 text-rose-200"
            : "bg-blue-950/95 border-blue-500/50 text-blue-200"
        }`}>
          {toastMessage.type === "success" && <CheckCircle size={18} className="text-emerald-400" />}
          {toastMessage.type === "error" && <AlertCircle size={18} className="text-rose-400" />}
          {toastMessage.type === "info" && <Info size={18} className="text-blue-400" />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Sub-Navigation Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                  অফলাইন আবেদন ম্যানেজমেন্ট
                  <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Legal 8.5 × 14" Format
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  কক্সবাজার সিটি কলেজ মিশ্র প্লাটুনের অফিসিয়াল লিগ্যাল সাইজ অফলাইন আবেদন ফর্ম ও প্রবেশপত্র সিস্টেম
                </p>
              </div>
            </div>
          </div>

          {/* Submenu Tabs + Cloud Sync Trigger */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={handleManualCloudSync}
              disabled={syncingCloud}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync pending local applications with Firestore"
            >
              <RefreshCw size={14} className={syncingCloud ? "animate-spin" : ""} />
              <span>{syncingCloud ? "সিঙ্ক হচ্ছে..." : "Cloud Sync"}</span>
            </button>
            <button
              onClick={() => setActiveSubTab("dashboard")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "dashboard"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Layers size={14} />
              <span>1. Offline Dashboard</span>
            </button>
            <button
              onClick={() => setActiveSubTab("generate")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "generate"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <FileText size={14} />
              <span>2. Generate Offline Form</span>
            </button>
            <button
              onClick={() => setActiveSubTab("upload")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "upload"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Upload size={14} />
              <span>3. Manual Upload</span>
            </button>
            <button
              onClick={() => setActiveSubTab("list")}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === "list"
                  ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>4. Offline Applications List</span>
              <span className="ml-1 px-1.5 py-0.2 bg-slate-900 text-amber-300 rounded text-[10px] font-mono">
                {applications.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. OFFLINE DASHBOARD TAB */}
      {/* ========================================================================= */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">মোট আবেদন</span>
              <div className="text-2xl font-black text-white mt-1 font-mono">{stats.total}</div>
              <div className="text-[10px] text-amber-400/80 mt-1">সব ক্যাটাগরি</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">ফর্ম তৈরি হয়েছে</span>
              <div className="text-2xl font-black text-sky-400 mt-1 font-mono">{stats.generated}</div>
              <div className="text-[10px] text-slate-500 mt-1">Draft & Generated</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">কপি জমা ও আপলোড</span>
              <div className="text-2xl font-black text-indigo-400 mt-1 font-mono">{stats.uploaded}</div>
              <div className="text-[10px] text-slate-500 mt-1">হার্ডকপি গৃহীত</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">যাচাইাধীন</span>
              <div className="text-2xl font-black text-amber-400 mt-1 font-mono">{stats.underReview}</div>
              <div className="text-[10px] text-slate-500 mt-1">Under Review</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">অনুমোদিত</span>
              <div className="text-2xl font-black text-emerald-400 mt-1 font-mono">{stats.approved}</div>
              <div className="text-[10px] text-slate-500 mt-1">যোগ্য ক্যাডেট</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400">বাতিলকৃত</span>
              <div className="text-2xl font-black text-rose-400 mt-1 font-mono">{stats.rejected}</div>
              <div className="text-[10px] text-slate-500 mt-1">অনুপযুক্ত</div>
            </div>
          </div>

          {/* Quick Actions & Recent Submissions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  দ্রুত অ্যাকশন
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  অফলাইনে আবেদনকারীদের জন্য লিগ্যাল সাইজ ফর্ম প্রস্তুত করুন, ফাঁকা ব্ল্যাঙ্ক টেমপ্লেট প্রিন্ট করুন অথবা ম্যানুয়াল আপলোড ডেস্কে ডকুমেন্ট এন্ট্রি করুন।
                </p>

                <div className="space-y-2.5">
                  <button
                    onClick={() => {
                      setFormData(getBlankOfflineApplication());
                      setIsBlankMode(false);
                      setActiveSubTab("generate");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-xs font-bold transition-all group"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText size={16} className="group-hover:scale-110 transition-transform" />
                      নতুন আবেদনকারীর ফর্ম তৈরি করুন
                    </span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setFormData(getBlankOfflineApplication());
                      setIsBlankMode(true);
                      setActiveSubTab("generate");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold transition-all group"
                  >
                    <span className="flex items-center gap-2.5">
                      <Printer size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
                      ফাঁকা ফর্ম প্রিন্ট করুন (Blank Template)
                    </span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => {
                      setUploadAppId(generateNextOfflineId());
                      setActiveSubTab("upload");
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold transition-all group"
                  >
                    <span className="flex items-center gap-2.5">
                      <Upload size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                      ম্যানুয়াল ফর্ম ও ডকুমেন্ট আপলোড
                    </span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>কাগজের আকার: Legal 8.5" × 14"</span>
                <span className="text-amber-400 font-mono">1-Page Print-Ready</span>
              </div>
            </div>

            {/* Recent Submissions List */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock size={16} className="text-indigo-400" />
                  সাম্প্রতিক অফলাইন আবেদনসমূহ
                </h3>
                <button
                  onClick={() => setActiveSubTab("list")}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  সবগুলো দেখুন ({applications.length})
                  <ArrowRight size={13} />
                </button>
              </div>

              {applications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  কোনো অফলাইন আবেদন পাওয়া যায়নি।
                </div>
              ) : (
                <div className="divide-y divide-slate-800/70">
                  {applications.slice(0, 5).map(app => (
                    <div key={app.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-mono text-xs font-bold shrink-0">
                          {app.bloodGroup || "BNCC"}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
                            <span>{app.fullNameBangla || app.fullNameEnglish}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                              {app.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">
                            {app.classDepartment || app.classYear} • {app.institution || "CBCC"} • {app.studentPhone}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          app.status === "Approved" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50" :
                          app.status === "Uploaded" ? "bg-indigo-950 text-indigo-400 border border-indigo-800/50" :
                          app.status === "Under Review" ? "bg-amber-950 text-amber-400 border border-amber-800/50" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {app.status}
                        </span>
                        <button
                          onClick={() => {
                            setModalApp(app);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          title="প্রিভিউ"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GENERATE OFFLINE FORM TAB (Legal 8.5" x 14") */}
      {/* ========================================================================= */}
      {activeSubTab === "generate" && (
        <div className="space-y-6">
          {/* Top Control Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  checked={isBlankMode}
                  onChange={(e) => setIsBlankMode(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4 bg-slate-900 border-slate-700"
                />
                <span className="text-xs font-bold text-amber-300">
                  ফাঁকা ফর্ম মোড (Blank Template Mode)
                </span>
              </label>
              <span className="text-xs text-slate-500 hidden sm:inline">
                {isBlankMode ? "• প্রিন্ট করার পর হাতে লেখার জন্য প্রস্তুত ফাঁকা ফর্ম প্রদর্শিত হবে" : "• তথ্য পূরণ করে প্রিন্ট করুন"}
              </span>
            </div>

            {/* Document Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleResetForm}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                রিসেট
              </button>
              <button
                onClick={handleSaveAndGenerate}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5"
              >
                <FileCheck size={14} />
                Generate & Save Form
              </button>
              <button
                onClick={() => handlePrint(generatorDocRef)}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Printer size={14} />
                প্রিন্ট ফর্ম (Legal)
              </button>
              <button
                onClick={() => handleDownloadPdf(generatorDocRef.current, `BNCC_Offline_Legal_${formData.id || "Form"}`)}
                disabled={generatingPdf}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Download size={14} />
                {generatingPdf ? "PDF তৈরি হচ্ছে..." : "PDF ডাউনলোড"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Input Form Column (5 Cols) */}
            <div className="xl:col-span-5 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl max-h-[820px] overflow-y-auto space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <User size={16} className="text-amber-400" />
                    আবেদনকারীর তথ্য পূরণ করুন
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                    {formData.id}
                  </span>
                </div>

                {/* Top Identifiers */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">ফরম নং</label>
                    <input
                      type="text"
                      value={formData.formNumber || "258"}
                      onChange={(e) => handleInputChange("formNumber", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">ক্যাডেট নং</label>
                    <input
                      type="text"
                      value={formData.cadetNumber || ""}
                      placeholder="e.g. CDT-1042"
                      onChange={(e) => handleInputChange("cadetNumber", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">তারিখ</label>
                    <input
                      type="date"
                      value={formData.applicationDate || ""}
                      onChange={(e) => handleInputChange("applicationDate", e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                {/* ১. আবেদনকারীর নাম */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">১. আবেদনকারীর নাম</h4>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">নাম (বাংলায়) *</label>
                    <input
                      type="text"
                      value={formData.fullNameBangla}
                      onChange={(e) => handleInputChange("fullNameBangla", e.target.value)}
                      placeholder="যেমন: মোঃ তানভীর হাসান"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Block Letter (English)</label>
                      <input
                        type="text"
                        value={formData.fullNameEnglish}
                        onChange={(e) => handleInputChange("fullNameEnglish", e.target.value.toUpperCase())}
                        placeholder="MD. TANVIR HASAN"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">E-mail</label>
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="applicant@example.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* ২ ও ৩. পিতা ও মাতার নাম */}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">২ ও ৩. অভিভাবকের নাম</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">পিতার নাম (বাংলায়)</label>
                      <input
                        type="text"
                        value={formData.fatherNameBangla || ""}
                        onChange={(e) => {
                          handleInputChange("fatherNameBangla", e.target.value);
                          handleInputChange("fatherName", e.target.value);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">পিতার নাম (Block Letter)</label>
                      <input
                        type="text"
                        value={formData.fatherNameEnglish || ""}
                        onChange={(e) => handleInputChange("fatherNameEnglish", e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">মাতার নাম (বাংলায়)</label>
                      <input
                        type="text"
                        value={formData.motherNameBangla || ""}
                        onChange={(e) => {
                          handleInputChange("motherNameBangla", e.target.value);
                          handleInputChange("motherName", e.target.value);
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">মাতার নাম (Block Letter)</label>
                      <input
                        type="text"
                        value={formData.motherNameEnglish || ""}
                        onChange={(e) => handleInputChange("motherNameEnglish", e.target.value.toUpperCase())}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white uppercase font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* ৪. শিক্ষাগত তথ্য */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">৪. শিক্ষাগত তথ্য</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">শ্রেণি/বিভাগ</label>
                      <input
                        type="text"
                        value={formData.classDepartment || formData.classYear || ""}
                        onChange={(e) => {
                          handleInputChange("classDepartment", e.target.value);
                          handleInputChange("classYear", e.target.value);
                        }}
                        placeholder="যেমন: দ্বাদশ / বিজ্ঞান"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">রোল</label>
                      <input
                        type="text"
                        value={formData.classRoll}
                        onChange={(e) => handleInputChange("classRoll", e.target.value)}
                        placeholder="1042"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">শিক্ষাবর্ষ</label>
                      <input
                        type="text"
                        value={formData.academicYear || "2026-2027"}
                        onChange={(e) => handleInputChange("academicYear", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* ৫ ও ৬. ঠিকানা */}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">৫ ও ৬. যোগাযোগের ঠিকানা</h4>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">বর্তমান ঠিকানা</label>
                    <textarea
                      rows={2}
                      value={formData.addressPresent}
                      onChange={(e) => handleInputChange("addressPresent", e.target.value)}
                      placeholder="গ্রাম/রোড, ডাকঘর, থানা, জেলা"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">স্থায়ী ঠিকানা</label>
                    <textarea
                      rows={2}
                      value={formData.addressPermanent}
                      onChange={(e) => handleInputChange("addressPermanent", e.target.value)}
                      placeholder="গ্রাম/রোড, ডাকঘর, থানা, জেলা"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>

                {/* ৭, ৮ ও ৯. ব্যক্তিগত ও শারীরিক মাপ */}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">৭, ৮ ও ৯. ব্যক্তিগত ও শারীরিক পরিমাপ</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">জন্ম তারিখ</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => handleInputChange("dob", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">ধর্ম</label>
                      <input
                        type="text"
                        value={formData.religion}
                        onChange={(e) => handleInputChange("religion", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">জাতীয়তা</label>
                      <input
                        type="text"
                        value={formData.nationality || "বাংলাদেশী"}
                        onChange={(e) => handleInputChange("nationality", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="flex-1">
                        <label className="text-[11px] text-slate-400 block mb-1">উচ্চতা (ফুট)</label>
                        <input
                          type="text"
                          value={formData.heightFeet}
                          onChange={(e) => handleInputChange("heightFeet", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] text-slate-400 block mb-1">(ইঞ্চি)</label>
                        <input
                          type="text"
                          value={formData.heightInches}
                          onChange={(e) => handleInputChange("heightInches", e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">ওজন (কেজি)</label>
                      <input
                        type="text"
                        value={formData.weightKg}
                        onChange={(e) => handleInputChange("weightKg", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">দৃষ্টি শক্তি</label>
                      <input
                        type="text"
                        value={formData.eyesight || "৬/৬"}
                        onChange={(e) => handleInputChange("eyesight", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">বুকের মাপ (স্বাভাবিক)</label>
                      <input
                        type="text"
                        value={formData.chestNormal || "৩২\""}
                        onChange={(e) => handleInputChange("chestNormal", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">প্রসারিত</label>
                      <input
                        type="text"
                        value={formData.chestExpanded || "৩৪\""}
                        onChange={(e) => handleInputChange("chestExpanded", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">সনাক্তকরণ চিহ্ন</label>
                      <input
                        type="text"
                        value={formData.identificationMark || ""}
                        onChange={(e) => handleInputChange("identificationMark", e.target.value)}
                        placeholder="যেমন: তিল"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* ১০. পূর্ববর্তী BNCC তথ্য ও রক্তের গ্রুপ */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">১০. পূর্ববর্তী BNCC তথ্য ও রক্তের গ্রুপ</h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">সদস্য ছিলেন কি?</label>
                      <select
                        value={formData.previousBnccMember || "না"}
                        onChange={(e) => handleInputChange("previousBnccMember", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      >
                        <option value="না">না</option>
                        <option value="হ্যাঁ">হ্যাঁ</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">থাকলে পদবী</label>
                      <input
                        type="text"
                        value={formData.previousBnccRank || ""}
                        onChange={(e) => handleInputChange("previousBnccRank", e.target.value)}
                        placeholder="যেমন: ক্যাডেট"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">রক্তের গ্রুপ</label>
                      <select
                        value={formData.bloodGroup}
                        onChange={(e) => handleInputChange("bloodGroup", e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                      >
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ১১. দক্ষতা (Skills Checkboxes) */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">১১. দক্ষতা (কোন বিষয়ে পারদর্শী)</h4>
                  <div className="grid grid-cols-5 gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                    {SKILL_OPTIONS.map(skill => (
                      <label key={skill} className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(formData.skills || []).includes(skill)}
                          onChange={() => toggleSkill(skill)}
                          className="rounded text-amber-500 focus:ring-amber-500 w-3.5 h-3.5 bg-slate-900 border-slate-700"
                        />
                        <span>{skill}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ১২. শিক্ষাগত যোগ্যতা টেবিল */}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">১২. শিক্ষাগত যোগ্যতা</h4>
                  <div className="space-y-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[11px] font-bold text-slate-300">ক. এসএসসি/সমমান</span>
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="বোর্ড (যেমন: চট্টগ্রাম)"
                        value={formData.ssc?.board || ""}
                        onChange={(e) => handleSscChange("board", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="জিপিএ (যেমন: 5.00)"
                        value={formData.ssc?.gpa || ""}
                        onChange={(e) => handleSscChange("gpa", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="শিক্ষা প্রতিষ্ঠান"
                        value={formData.ssc?.institution || ""}
                        onChange={(e) => handleSscChange("institution", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="পাশের সন (যেমন: 2024)"
                        value={formData.ssc?.passingYear || ""}
                        onChange={(e) => handleSscChange("passingYear", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>

                    <span className="text-[11px] font-bold text-slate-300 pt-1 block">খ. এইচএসসি/সমমান</span>
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="বোর্ড"
                        value={formData.hsc?.board || ""}
                        onChange={(e) => handleHscChange("board", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="জিপিএ"
                        value={formData.hsc?.gpa || ""}
                        onChange={(e) => handleHscChange("gpa", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                      <input
                        type="text"
                        placeholder="শিক্ষা প্রতিষ্ঠান"
                        value={formData.hsc?.institution || "কক্সবাজার সিটি কলেজ"}
                        onChange={(e) => handleHscChange("institution", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="পাশের সন"
                        value={formData.hsc?.passingYear || ""}
                        onChange={(e) => handleHscChange("passingYear", e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Candidate Photo Slot & Admit Card Specifics */}
                <div className="space-y-3 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-amber-400">প্রবেশপত্র ও ছবি সংক্রান্ত</h4>
                  <div className="flex items-center gap-4">
                    <label className="cursor-pointer px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-2">
                      <Upload size={14} />
                      পাসপোর্ট ছবি আপলোড করুন
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    {Boolean(formData.applicantPhoto && formData.applicantPhoto.trim() !== "") && (
                      <div className="flex items-center gap-2">
                        <img
                          src={formData.applicantPhoto}
                          alt="Thumbnail"
                          className="w-8 h-8 rounded border border-amber-400 object-cover"
                        />
                        <button
                          onClick={() => handleInputChange("applicantPhoto", undefined)}
                          className="text-xs text-rose-400 hover:text-rose-300"
                        >
                          মুছুন
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">প্রবেশপত্রের নির্দেশনা</label>
                    <textarea
                      rows={2}
                      value={formData.admitInstructions || ""}
                      onChange={(e) => handleInputChange("admitInstructions", e.target.value)}
                      placeholder="১. মূল মার্কশিট সাথে আনতে হবে..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Legal Document Preview Column (7 Cols) */}
            <div className="xl:col-span-7 space-y-3">
              <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-2">
                  <Eye size={14} className="text-amber-400" />
                  লাইভ লিগ্যাল সাইজ প্রিভিউ (Legal 8.5" × 14")
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">জুম:</span>
                  <button
                    onClick={() => setPreviewZoom(z => Math.max(0.45, z - 0.05))}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-mono text-amber-300 w-12 text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    onClick={() => setPreviewZoom(z => Math.min(1.2, z + 0.05))}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Scrollable Container with Zoomed Legal Document */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 overflow-auto max-h-[820px] flex justify-center">
                <div
                  style={{
                    transform: `scale(${previewZoom})`,
                    transformOrigin: "top center",
                    marginBottom: `${(1 - previewZoom) * -450}px`
                  }}
                  className="transition-transform duration-200"
                >
                  <OfflineLegalDocument
                    ref={generatorDocRef}
                    application={formData}
                    isBlankTemplate={isBlankMode}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MANUAL UPLOAD TAB */}
      {/* ========================================================================= */}
      {activeSubTab === "upload" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Upload size={18} className="text-emerald-400" />
              ম্যানুয়াল ফর্ম ও ডকুমেন্ট আপলোড ডেস্ক
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              অফলাইনে পূরণকৃত ও শারীরিকভাবে জমাকৃত ফর্ম, প্রবেশপত্র এবং অন্যান্য সহায়ক নথিপত্র স্ক্যান করে সংরক্ষণ করুন।
            </p>
          </div>

          <form onSubmit={handleSaveManualUpload} className="space-y-6">
            {/* Applicant Information Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                আবেদনকারীর তথ্য (Applicant Information)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    অফলাইন আবেদন আইডি (Offline Application ID) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. OFF-2026-0004"
                      value={uploadAppId}
                      onChange={(e) => setUploadAppId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadAppId(generateNextOfflineId())}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-bold shrink-0"
                      title="অটো আইডি জেনারেট"
                    >
                      অটো
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    আবেদনকারীর নাম (Applicant Name) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="নাম লিখুন"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    মোবাইল নম্বর (Mobile Number)
                  </label>
                  <input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={uploadPhone}
                    onChange={(e) => setUploadPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">পিতার নাম (Father's Name)</label>
                  <input
                    type="text"
                    placeholder="পিতার নাম"
                    value={uploadFatherName}
                    onChange={(e) => setUploadFatherName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">মাতার নাম (Mother's Name)</label>
                  <input
                    type="text"
                    placeholder="মাতার নাম"
                    value={uploadMotherName}
                    onChange={(e) => setUploadMotherName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">শিক্ষা প্রতিষ্ঠান (Institution)</label>
                  <input
                    type="text"
                    value={uploadInstitution}
                    onChange={(e) => setUploadInstitution(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">শ্রেণি / বিভাগ (Class / Department)</label>
                  <input
                    type="text"
                    placeholder="যেমন: HSC 1st Year (Science)"
                    value={uploadClassDept}
                    onChange={(e) => setUploadClassDept(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">শিক্ষাবর্ষ (Academic Year)</label>
                  <input
                    type="text"
                    placeholder="2026-2027"
                    value={uploadAcademicYear}
                    onChange={(e) => setUploadAcademicYear(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">আবেদনের তারিখ (Application Date)</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">স্ট্যাটাস (Status)</label>
                  <select
                    value={uploadStatus}
                    onChange={(e) => setUploadStatus(e.target.value as OfflineApplicationStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Form Generated">Form Generated</option>
                    <option value="Submitted Offline">Submitted Offline</option>
                    <option value="Uploaded">Uploaded</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Documents Upload Section */}
            <div className="space-y-4 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  নথিপত্র আপলোড (Documents: PDF, JPG, JPEG, PNG)
                </h4>
                <span className="text-[11px] text-slate-400">সর্বোচ্চ ফাইল সাইজ: ৫ মেগাবাইট প্রতি ফাইল</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Completed Offline Application Form */}
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-amber-400/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileText size={15} className="text-amber-400" />
                      Completed Offline Application Form *
                    </span>
                    {scannedFormFile && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={12} /> সিলেক্টেড
                      </span>
                    )}
                  </div>
                  
                  {scannedFormFile ? (
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{scannedFormFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(scannedFormFile.size / 1024).toFixed(1)} KB • {scannedFormFile.type}</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => setScannedFormFile(null)}
                          className="p-1 rounded hover:bg-slate-800 text-rose-400"
                          title="মুছুন"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-3 text-center">
                      <Upload size={18} className="text-slate-500 mb-1" />
                      <span className="text-xs text-slate-300 font-medium">স্ক্যান করা ফর্ম নির্বাচন করুন</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">PDF বা ছবি আপলোড করুন</span>
                      <input
                        type="file"
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const res = await processUploadedFile(file);
                            setScannedFormFile(res);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* 2. Admit Card / Related Document */}
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-amber-400/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCheck size={15} className="text-sky-400" />
                      Admit Card / Related Document
                    </span>
                    {admitCardFile && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={12} /> সিলেক্টেড
                      </span>
                    )}
                  </div>

                  {admitCardFile ? (
                    <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-white font-medium truncate">{admitCardFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(admitCardFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdmitCardFile(null)}
                        className="p-1 rounded hover:bg-slate-800 text-rose-400 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-3 text-center">
                      <Upload size={18} className="text-slate-500 mb-1" />
                      <span className="text-xs text-slate-300 font-medium">প্রবেশপত্র কপি আপলোড করুন</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">PDF বা ছবি</span>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const res = await processUploadedFile(file);
                            setAdmitCardFile(res);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* 3. Applicant Photo */}
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-amber-400/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <User size={15} className="text-indigo-400" />
                      Applicant Photo (পাসপোর্ট ছবি)
                    </span>
                    {photoFile && (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Check size={12} /> সিলেক্টেড
                      </span>
                    )}
                  </div>

                  {photoFile ? (
                    <div className="flex items-center gap-3 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <img src={photoFile.dataUrl} alt="Photo" className="w-10 h-10 rounded object-cover border border-slate-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white font-medium truncate">{photoFile.name}</p>
                        <p className="text-[10px] text-slate-400">{(photoFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPhotoFile(null)}
                        className="p-1 rounded hover:bg-slate-800 text-rose-400 shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-3 text-center">
                      <Upload size={18} className="text-slate-500 mb-1" />
                      <span className="text-xs text-slate-300 font-medium">আবেদনকারীর ছবি নির্বাচন করুন</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">JPG, JPEG, PNG</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const res = await processUploadedFile(file);
                            setPhotoFile(res);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>

                {/* 4. Supporting & Other Documents */}
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-amber-400/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Paperclip size={15} className="text-purple-400" />
                      Supporting & Other Documents
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {supportingDocs.length + otherDocs.length} ফাইল
                    </span>
                  </div>

                  <label className="cursor-pointer flex flex-col items-center justify-center p-3 text-center border-b border-slate-800 mb-2">
                    <Plus size={16} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-300 font-medium">সনদ বা প্রত্যয়নপত্র সংযুক্ত করুন</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">PDF বা ছবি</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        for (const file of files) {
                          const res = await processUploadedFile(file);
                          setSupportingDocs(prev => [...prev, res]);
                        }
                      }}
                    />
                  </label>

                  {supportingDocs.length > 0 && (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {supportingDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-900 px-2 py-1 rounded border border-slate-800">
                          <span className="text-slate-300 truncate max-w-[200px]">{doc.name}</span>
                          <button
                            type="button"
                            onClick={() => setSupportingDocs(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-400 hover:text-rose-300 ml-2"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Staff Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                স্টাফ মন্তব্য (Office Staff Notes)
              </label>
              <textarea
                rows={2}
                placeholder="যেমন: আবেদনপত্র শারীরিকভাবে যাচাই সম্পন্ন, জন্মসনদ ও মার্কশিট সঠিক।"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white"
              />
            </div>

            {/* Submit Action */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setUploadAppId("");
                  setUploadName("");
                  setScannedFormFile(null);
                  setAdmitCardFile(null);
                  setPhotoFile(null);
                  setSupportingDocs([]);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                রিসেট
              </button>
              <button
                type="submit"
                disabled={savingUpload}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={15} />
                {savingUpload ? "সংরক্ষণ করা হচ্ছে..." : "Save Offline Application"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. OFFLINE APPLICATIONS LIST TAB */}
      {/* ========================================================================= */}
      {activeSubTab === "list" && (
        <div className="space-y-4">
          {/* Controls: Search, Filter & Excel Export */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="আইডি, নাম, মোবাইল, রোল বা শ্রেণি দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="All">সকল স্ট্যাটাস (All)</option>
                <option value="Draft">Draft</option>
                <option value="Form Generated">Form Generated</option>
                <option value="Submitted Offline">Submitted Offline</option>
                <option value="Uploaded">Uploaded</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                <FileSpreadsheet size={14} />
                Excel এক্সপোর্ট
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Class/Department</th>
                    <th className="py-3 px-4">Academic Year</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Documents</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedApplications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                        কোনো অফলাইন আবেদন পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    paginatedApplications.map(app => (
                      <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Application ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                          {app.id}
                          {app.cadetNumber && (
                            <span className="block text-[10px] text-slate-500 font-sans">
                              ক্যাডেট: {app.cadetNumber}
                            </span>
                          )}
                        </td>

                        {/* Applicant */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white text-xs">
                            {app.fullNameBangla || app.fullNameEnglish}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{app.studentPhone || "মোবাইল নেই"}</span>
                            {app.bloodGroup && (
                              <span className="px-1 py-0.2 bg-rose-950 text-rose-300 rounded text-[9px] font-mono">
                                {app.bloodGroup}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Class / Department */}
                        <td className="py-3.5 px-4 text-slate-300">
                          <div>{app.classDepartment || app.classYear || "—"}</div>
                          {app.classRoll && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              রোল: {app.classRoll}
                            </span>
                          )}
                        </td>

                        {/* Academic Year */}
                        <td className="py-3.5 px-4 text-slate-300 font-mono">
                          {app.academicYear || "2026-2027"}
                        </td>

                        {/* Status Select */}
                        <td className="py-3.5 px-4">
                          <select
                            value={app.status}
                            onChange={(e) => handleStatusChange(app.id, e.target.value as OfflineApplicationStatus)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border focus:outline-none cursor-pointer ${
                              app.status === "Approved" ? "bg-emerald-950 text-emerald-300 border-emerald-700/50" :
                              app.status === "Uploaded" ? "bg-indigo-950 text-indigo-300 border-indigo-700/50" :
                              app.status === "Under Review" ? "bg-amber-950 text-amber-300 border-amber-700/50" :
                              app.status === "Rejected" ? "bg-rose-950 text-rose-300 border-rose-700/50" :
                              "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Form Generated">Form Generated</option>
                            <option value="Submitted Offline">Submitted Offline</option>
                            <option value="Uploaded">Uploaded</option>
                            <option value="Under Review">Under Review</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>

                        {/* Documents Indicator */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {app.uploadedFiles?.scannedForm ? (
                              <span className="w-6 h-6 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center text-[10px]" title="স্ক্যান ফর্ম সংযুক্ত">
                                <FileCheck size={12} />
                              </span>
                            ) : (
                              <span className="w-6 h-6 rounded bg-slate-800 text-slate-600 flex items-center justify-center text-[10px]" title="ফর্ম নেই">
                                <FileText size={12} />
                              </span>
                            )}
                            {app.applicantPhoto ? (
                              <span className="w-6 h-6 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 flex items-center justify-center text-[10px]" title="ছবি সংযুক্ত">
                                <User size={12} />
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View / Preview */}
                            <button
                              onClick={() => {
                                setModalApp(app);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                              title="প্রিভিউ ও প্রিন্ট"
                            >
                              <Eye size={13} />
                            </button>

                            {/* Edit in Generator */}
                            <button
                              onClick={() => {
                                setFormData(app);
                                setIsBlankMode(false);
                                setActiveSubTab("generate");
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300"
                              title="তথ্য সম্পাদনা করুন"
                            >
                              <Edit size={13} />
                            </button>

                            {/* Upload / Replace Document */}
                            <button
                              onClick={() => {
                                setUploadAppId(app.id);
                                setUploadName(app.fullNameBangla || app.fullNameEnglish);
                                setUploadPhone(app.studentPhone || "");
                                setUploadClassDept(app.classDepartment || app.classYear || "");
                                setUploadAcademicYear(app.academicYear || "2026-2027");
                                setActiveSubTab("upload");
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300"
                              title="ডকুমেন্ট আপলোড / পরিবর্তন"
                            >
                              <Upload size={13} />
                            </button>

                            {/* Delete */}
                            {confirmDeleteId === app.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(app.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  নিশ্চিত
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer"
                                >
                                  বাতিল
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(app.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 cursor-pointer"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                মোট {filteredApplications.length} টির মধ্যে {(currentPage - 1) * itemsPerPage + 1} থেকে {Math.min(currentPage * itemsPerPage, filteredApplications.length)} দেখানো হচ্ছে
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 font-mono text-amber-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PREVIEW & PRINT MODAL (Legal 8.5" x 14") */}
      {/* ========================================================================= */}
      {isModalOpen && modalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  লিগ্যাল সাইজ আবেদন ফর্ম ও প্রবেশপত্র — {modalApp.id}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrint(modalDocRef)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer size={13} />
                  প্রিন্ট
                </button>
                <button
                  onClick={() => handleDownloadPdf(modalDocRef.current, `BNCC_${modalApp.id}`)}
                  disabled={generatingPdf}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <Download size={13} />
                  PDF
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body with Zoomed Legal Document */}
            <div className="p-4 overflow-auto flex-1 bg-slate-950 flex justify-center">
              <div style={{ transform: "scale(0.8)", transformOrigin: "top center", marginBottom: "-200px" }}>
                <OfflineLegalDocument
                  ref={modalDocRef}
                  application={modalApp}
                  isBlankTemplate={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
