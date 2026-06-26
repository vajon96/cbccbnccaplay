import { useState, useEffect, useRef } from "react";
import { 
  FileText, Calendar, Sparkles, RefreshCw, Save, CheckCircle, 
  X, AlertCircle, Loader2, Download, Trash2, Edit2, ShieldAlert,
  ShieldCheck, Eye, Copy, Power, Settings as SettingsIcon, Archive
} from "lucide-react";
import { db, collection, query, orderBy, getDocs, doc, addDoc, updateDoc, deleteDoc, Timestamp, onSnapshot } from "../../firebase";
import { generateAICircular } from "../../services/geminiService";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface CircularContent {
  title: string;
  introduction: string;
  purpose: string;
  eligibility: string;
  requiredDocuments: string;
  applicationProcedure: string;
  importantDates: string;
  verificationProcess: string;
  rulesAndConditions: string;
  contactInfo: string;
  footer: string;
  category: string;
}

interface AICircularManagerProps {
  adminSession: any;
  onLogActivity: (type: string, details: string) => Promise<any>;
}

export function AICircularManager({ adminSession, onLogActivity }: AICircularManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"generate" | "archive" | "settings">("generate");
  const [startDate, setStartDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [circularData, setCircularData] = useState<CircularContent | null>(null);
  const [refNumber, setRefNumber] = useState("");
  const [circulars, setCirculars] = useState<any[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [savingCircular, setSavingCircular] = useState(false);
  const [editingCircularId, setEditingCircularId] = useState<string | null>(null);
  
  // Settings State
  const [publicAccessEnabled, setPublicAccessEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  
  // PDF Printing Target Ref
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Load baseline values (Archive & Settings)
  useEffect(() => {
    setLoadingArchive(true);
    const q = query(collection(db, "circulars"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snap) => {
      const items = snap.docs.map(docDoc => ({
        id: docDoc.id,
        ...docDoc.data()
      }));
      setCirculars(items);
      setLoadingArchive(false);
    }, (err) => {
      console.error("Error loading circulars in real-time:", err);
      setLoadingArchive(false);
    });

    fetchSettings();

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchSettings = async () => {
    try {
      const snap = await getDocs(collection(db, "circular_settings"));
      const settingsMap = snap.docs.reduce((acc: any, docDoc) => {
        const d = docDoc.data();
        acc[d.key] = d.value;
        return acc;
      }, {});
      
      if (settingsMap.public_access !== undefined) {
        setPublicAccessEnabled(settingsMap.public_access);
      } else {
        // Initialize if empty
        await addDoc(collection(db, "circular_settings"), {
          key: "public_access",
          value: true
        });
      }
    } catch (e) {
      console.error("Error loading circular settings:", e);
    }
  };

  const saveSettings = async (enabled: boolean) => {
    setSavingSettings(true);
    try {
      setPublicAccessEnabled(enabled);
      const snap = await getDocs(collection(db, "circular_settings"));
      const settingDoc = snap.docs.find(d => d.data().key === "public_access");
      if (settingDoc) {
        await updateDoc(doc(db, "circular_settings", settingDoc.id), {
          value: enabled
        });
      } else {
        await addDoc(collection(db, "circular_settings"), {
          key: "public_access",
          value: enabled
        });
      }
      await onLogActivity("CIRCULAR_SETTINGS_UPDATED", `Super Admin toggled Public Circular Access to ${enabled ? "ON" : "OFF"}`);
      alert("Settings updated successfully!");
    } catch (e) {
      console.error("Failed to save settings:", e);
      alert("Failed to update settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchArchive = async () => {
    // Handled in real-time by onSnapshot subscription
  };

  const generateReferenceNumber = (count: number) => {
    const year = new Date().getFullYear();
    const formattedCount = String(count + 1).padStart(4, "0");
    return `ENR-${year}-${formattedCount}`;
  };

  const generateAI = async () => {
    if (!startDate || !deadlineDate) {
      alert("Please provide both Start Date and Application Deadline.");
      return;
    }
    setIsGenerating(true);
    try {
      const draftRef = generateReferenceNumber(circulars.length);
      setRefNumber(draftRef);
      const data = await generateAICircular(startDate, deadlineDate, draftRef);
      setCircularData(data);
      setEditingCircularId(null); // Reset since this is a newly generated AI circular
      await onLogActivity("CIRCULAR_AI_GENERATED", `Super Admin generated an AI Enrollment Circular with Ref: ${draftRef}`);
    } catch (e) {
      console.error(e);
      alert("AI Generation failed. Please check Gemini API configuration or retry.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (status: "draft" | "published") => {
    if (!circularData) return;
    setSavingCircular(true);
    try {
      // If we are publishing, we must unpublish any other active ones first
      if (status === "published") {
        const activePublished = circulars.filter(c => c.status === "published" && c.id !== editingCircularId);
        for (const active of activePublished) {
          await updateDoc(doc(db, "circulars", active.id), {
            status: "unpublished",
            updatedAt: Timestamp.now()
          });
        }
      }

      const payload = {
        ...circularData,
        referenceNumber: refNumber,
        startDate,
        deadlineDate,
        status,
        updatedAt: Timestamp.now()
      };

      if (editingCircularId) {
        // Edit existing document
        await updateDoc(doc(db, "circulars", editingCircularId), payload);
        await onLogActivity(`CIRCULAR_UPDATED_${status.toUpperCase()}`, `Updated enrollment circular with Ref: ${refNumber} as ${status}`);
        alert(`Circular successfully updated as ${status}!`);
      } else {
        // Create new document
        const fullPayload = {
          ...payload,
          publicationDate: new Date().toISOString(),
          createdAt: Timestamp.now()
        };
        await addDoc(collection(db, "circulars"), fullPayload);
        await onLogActivity(`CIRCULAR_SAVED_${status.toUpperCase()}`, `Saved enrollment circular as ${status} with Ref: ${refNumber}`);
        alert(`Circular successfully saved as ${status}!`);
      }

      setCircularData(null);
      setEditingCircularId(null);
      setStartDate("");
      setDeadlineDate("");
    } catch (e) {
      console.error(e);
      alert("Failed to save circular to database.");
    } finally {
      setSavingCircular(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: "draft" | "published" | "unpublished") => {
    try {
      if (newStatus === "published") {
        const activePublished = circulars.filter(c => c.status === "published" && c.id !== id);
        for (const active of activePublished) {
          await updateDoc(doc(db, "circulars", active.id), {
            status: "unpublished",
            updatedAt: Timestamp.now()
          });
        }
      }

      await updateDoc(doc(db, "circulars", id), {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      await onLogActivity("CIRCULAR_STATUS_CHANGED", `Changed state of circular ${id} to ${newStatus}`);
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this circular?")) return;
    try {
      await deleteDoc(doc(db, "circulars", id));
      await onLogActivity("CIRCULAR_DELETED", `Super Admin deleted circular document: ${id}`);
      alert("Circular removed successfully.");
    } catch (e) {
      console.error(e);
      alert("Failed to delete circular.");
    }
  };

  const handleDuplicate = (item: any) => {
    setCircularData({
      title: item.title,
      introduction: item.introduction,
      purpose: item.purpose,
      eligibility: item.eligibility,
      requiredDocuments: item.requiredDocuments,
      applicationProcedure: item.applicationProcedure,
      importantDates: item.importantDates,
      verificationProcess: item.verificationProcess,
      rulesAndConditions: item.rulesAndConditions,
      contactInfo: item.contactInfo,
      footer: item.footer,
      category: item.category || "Admission / Membership"
    });
    setStartDate(item.startDate || "");
    setDeadlineDate(item.deadlineDate || "");
    setRefNumber(generateReferenceNumber(circulars.length));
    setEditingCircularId(null); // Duplicating creates a new document, so reset this
    setActiveSubTab("generate");
  };

  const handleEdit = (item: any) => {
    setCircularData({
      title: item.title,
      introduction: item.introduction,
      purpose: item.purpose,
      eligibility: item.eligibility,
      requiredDocuments: item.requiredDocuments,
      applicationProcedure: item.applicationProcedure,
      importantDates: item.importantDates,
      verificationProcess: item.verificationProcess,
      rulesAndConditions: item.rulesAndConditions,
      contactInfo: item.contactInfo,
      footer: item.footer,
      category: item.category || "Admission / Membership"
    });
    setStartDate(item.startDate || "");
    setDeadlineDate(item.deadlineDate || "");
    setRefNumber(item.referenceNumber);
    setEditingCircularId(item.id);
    setActiveSubTab("generate");
  };

  const handleFieldChange = (key: keyof CircularContent, value: string) => {
    if (!circularData) return;
    setCircularData({
      ...circularData,
      [key]: value
    });
  };

  const triggerDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsPrinting(true);
    try {
      // Small pause for layout adjustment
      await new Promise(r => setTimeout(r, 600));

      const canvas = await html2canvas(printRef.current, {
        scale: 2, // High resolution crisp image render
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Official_Circular_${refNumber || "BNCC"}.pdf`);
      await onLogActivity("CIRCULAR_PDF_DOWNLOADED", `Downloaded Official PDF with Ref: ${refNumber || "N/A"}`);
    } catch (e) {
      console.error("PDF Export Crash:", e);
      alert("Failed to export high-fidelity A4 PDF. Try again.");
    } finally {
      setIsPrinting(false);
    }
  };

  // Auth Protection Check
  if (adminSession?.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 max-w-lg mx-auto bg-slate-900/40 p-12 rounded-[2rem] border border-red-500/20">
        <ShieldAlert className="w-16 h-16 text-primary animate-pulse" />
        <h2 className="text-xl font-bold text-white">অ্যাক্সেস প্রত্যাখ্যান করা হয়েছে (Access Denied)</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          এই বিভাগটি শুধুমাত্র সুপার অ্যাডমিনদের জন্য উন্মুক্ত। আপনার বর্তমান ক্ষমতা এই মডিউলটি দেখার অনুমতি দেয় না।
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Dynamic Sub-items Sidebar */}
      <div className="lg:col-span-1 space-y-3 bg-slate-950/40 p-6 rounded-[2rem] border border-white/5 h-fit shadow-2xl">
        <div className="border-b border-white/5 pb-4 mb-4">
          <span className="text-[10px] uppercase font-black tracking-[0.25em] text-primary block">Circular Command</span>
          <h4 className="text-sm font-bold text-slate-300 mt-1">AI Circular Generator</h4>
        </div>
        
        {[
          { id: "generate", label: editingCircularId ? "Edit Circular" : "Generate & Edit", icon: Sparkles, badge: editingCircularId ? "Editing" : circularData ? "Draft" : undefined },
          { id: "archive", label: "Circular Archive", icon: Archive, badge: circulars.length > 0 ? `${circulars.length}` : undefined },
          { id: "settings", label: "Settings", icon: SettingsIcon }
        ].map((sub) => (
          <button
            key={sub.id}
            onClick={() => {
              setActiveSubTab(sub.id as any);
              if (sub.id !== "generate") {
                // Keep draft context but switch focus safely
              }
            }}
            className={`w-full flex items-center justify-between p-4 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === sub.id 
                ? "bg-primary text-white shadow-lg shadow-primary/25" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <sub.icon size={16} />
              <span>{sub.label}</span>
            </div>
            {sub.badge && (
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                activeSubTab === sub.id ? "bg-white text-primary" : "bg-primary/20 text-primary"
              }`}>
                {sub.badge}
              </span>
            )}
          </button>
        ))}

        {circularData && (
          <div className="pt-6 mt-6 border-t border-white/5 text-center">
            <button
              onClick={() => {
                if (confirm(editingCircularId ? "Cancel editing and lose changes?" : "Cancel draft and lose changes?")) {
                  setCircularData(null);
                  setEditingCircularId(null);
                  setStartDate("");
                  setDeadlineDate("");
                }
              }}
              className="px-4 py-2 border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all"
            >
              {editingCircularId ? "Cancel Editing" : "Clear Current Draft"}
            </button>
          </div>
        )}
      </div>

      {/* Main Feature Content Outlet */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* TAB 1: GENERATE & EDIT PANEL */}
        {activeSubTab === "generate" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {!circularData ? (
              <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">নতুন সার্কুলার স্লট তৈরি করুন</h3>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Specify start and end dates below. AI will automatically model Platoon records, requirements, processes, and categories to generate a beautiful, official Bangla circular document.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">ঐচ্ছিক শুরুর তারিখ (Start Date)</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">আবেদনের শেষ তারিখ (Deadline Date)</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                      <input 
                        type="date"
                        value={deadlineDate}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={generateAI}
                  disabled={isGenerating || !startDate || !deadlineDate}
                  className="w-full py-5 bg-primary text-white font-black uppercase tracking-[0.25em] text-xs rounded-2xl flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-2xl disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Analyzing Platoon Ecosystem & Modeling AI Circular...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Official Circular with AI
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Draft Edit Mode with Real-Time Print Template Preview */
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Editable Left Form */}
                <div className="md:col-span-5 bg-slate-950/30 p-6 rounded-[2rem] border border-white/5 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary">Edit Document Fields</h4>
                    <span className="text-[9px] font-bold text-slate-500 font-mono">{refNumber}</span>
                  </div>

                  {[
                    { key: "title", label: "সার্কুলার শিরোনাম (Title)", type: "input" },
                    { key: "introduction", label: "ভূমিকা (Introduction)", type: "textarea" },
                    { key: "purpose", label: "উদ্দেশ্য (Purpose)", type: "textarea" },
                    { key: "eligibility", label: "ভর্তির যোগ্যতা (Eligibility Requirements)", type: "textarea" },
                    { key: "requiredDocuments", label: "প্রয়োজনীয় কাগজপত্র (Required Documents)", type: "textarea" },
                    { key: "applicationProcedure", label: "আবেদন পদ্ধতি (Application Process)", type: "textarea" },
                    { key: "importantDates", label: "গুরুত্বপূর্ণ তারিখসমূহ (Important Dates Table)", type: "textarea" },
                    { key: "verificationProcess", label: "নির্বাচন ও যাচাই পরীক্ষা (Selection Phases)", type: "textarea" },
                    { key: "rulesAndConditions", label: "শর্তাবলী ও সাধারণ নিয়মাবলী (Rules & Conditions)", type: "textarea" },
                    { key: "contactInfo", label: "যোগাযোগ (Contact Information)", type: "textarea" },
                    { key: "footer", label: "স্বাক্ষর দাতা ও সমাপ্তি (Footer & Sign-Off)", type: "textarea" }
                  ].map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider ml-1">{field.label}</label>
                      {field.type === "input" ? (
                        <input 
                          type="text"
                          value={(circularData as any)[field.key] || ""}
                          onChange={(e) => handleFieldChange(field.key as any, e.target.value)}
                          className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-primary"
                        />
                      ) : (
                        <textarea 
                          value={(circularData as any)[field.key] || ""}
                          onChange={(e) => handleFieldChange(field.key as any, e.target.value)}
                          className="w-full bg-slate-900 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-primary min-h-[100px] resize-none"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Printable Live-Updated A4 Aethetic Preview Panel (Centered on Right) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="flex gap-2 justify-end mb-1">
                    <button
                      onClick={triggerDownloadPDF}
                      disabled={isPrinting}
                      className="px-4 py-2 bg-accent text-white font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-accent/90 transition-all flex items-center gap-1.5 shadow-md"
                    >
                      {isPrinting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Export to PDF
                    </button>
                    <button
                      onClick={() => handleSave("draft")}
                      disabled={savingCircular}
                      className="px-4 py-2 bg-slate-800 text-slate-200 font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-slate-700 transition-all flex items-center gap-1.5"
                    >
                      <Save size={12} />
                      Save Draft
                    </button>
                    <button
                      onClick={() => handleSave("published")}
                      disabled={savingCircular}
                      className="px-5 py-2 bg-primary text-white font-black uppercase tracking-widest text-[9px] rounded-lg hover:bg-primary/95 transition-all flex items-center gap-1.5 shadow-md shadow-primary/20"
                    >
                      <CheckCircle size={12} />
                      Publish Now
                    </button>
                  </div>

                  {/* HIGH CONFIDENCE PHYSICAL A4 RATIO CONTAINER */}
                  <div className="overflow-x-auto border border-white/10 rounded-2xl shadow-2xl bg-white p-2">
                    <div 
                      ref={printRef}
                      className="relative bg-white text-black p-12 mx-auto font-sans w-[794px] h-[1123px] flex flex-col justify-between overflow-hidden shadow-inner select-none"
                      style={{ letterSpacing: "-0.015em" }}
                    >
                      {/* SUBTLE TRANSPARENT OFFICIAL WATERMARK */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-[1]">
                        <img 
                          src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                          alt="BNCC Logo Watermark" 
                          className="w-[450px] h-[450px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      {/* DOCUMENT BODY */}
                      <div className="relative z-10 flex-grow space-y-4">
                        {/* HEADER PORTAL */}
                        <div className="flex items-center justify-between border-b-2 border-black pb-4">
                          <img 
                            src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                            alt="College Logo" 
                            className="h-14 w-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="text-center font-bold">
                            <h1 className="text-base font-black text-slate-900 mt-0.5">কক্সবাজার সিটি কলেজ বিএনপি মিশ্র প্লাটুন</h1>
                            <p className="text-[10px] text-slate-700 mt-0.5 uppercase">১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট</p>
                          </div>
                          <img 
                            src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                            alt="BNCC Logo" 
                            className="h-14 w-auto object-contain"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        {/* REFERENCE ROW */}
                        <div className="flex justify-between text-[11px] font-bold text-slate-800 border-b border-dashed border-slate-300 pb-2">
                          <span>স্মারক নং: {refNumber}</span>
                          <span>তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>

                        {/* DISCIPLINED BANGLA CONTENT SCROLL */}
                        <div className="text-slate-900 space-y-4 text-[11px] leading-relaxed select-text">
                          <h3 className="text-sm font-black text-center text-black border-y border-black py-1 tracking-tight">
                            {circularData.title}
                          </h3>

                          {/* 1. Introductory Speech */}
                          <p className="text-justify indent-8 text-slate-800">
                            {circularData.introduction}
                          </p>

                          <div className="grid grid-cols-2 gap-6 items-start">
                            {/* Left Pane */}
                            <div className="space-y-3">
                              <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                                <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">১. আমাদের উদ্দেশ্য (Purpose)</h4>
                                <p className="text-[10px] text-slate-700">{circularData.purpose}</p>
                              </div>
                              <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                                <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">২. আবেদনের যোগ্যতা (Eligibility)</h4>
                                <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.eligibility}</p>
                              </div>
                            </div>

                            {/* Right Pane */}
                            <div className="space-y-3">
                              <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                                <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৩. প্রয়োজনীয় কাগজপত্র (Documents)</h4>
                                <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.requiredDocuments}</p>
                              </div>
                              <div className="border-l-2 border-primary bg-slate-50 p-2 rounded">
                                <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৪. অনলাইন আবেদন পদ্ধতি (Application Guideline)</h4>
                                <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.applicationProcedure}</p>
                              </div>
                            </div>
                          </div>

                          {/* 5. Additional Information */}
                          <div className="border-t border-slate-200 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-extrabold text-black uppercase tracking-tight ml-1 text-[11px] mb-1">৫. নির্বাচন প্রক্রিয়া (Selection Process)</h4>
                              <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.verificationProcess}</p>
                            </div>
                            <div>
                              <h4 className="font-extrabold text-black uppercase tracking-tight ml-1 text-[11px] mb-1">৬. গুরুত্বপূর্ণ তথ্য ও শেষ তারিখ (Key Dates)</h4>
                              <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.importantDates}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-200 pt-3">
                            <h4 className="font-extrabold text-black uppercase tracking-tight text-[11px] mb-1">৭. সাধারণ নিয়ামাবলী (Rules & Regulations)</h4>
                            <p className="text-[10px] text-slate-700 whitespace-pre-line">{circularData.rulesAndConditions}</p>
                          </div>
                        </div>
                      </div>

                      {/* SIGNATURE FOOTER */}
                      <div className="flex justify-between items-end border-t border-black pt-4 z-10 relative">
                        <div>
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Platoon Commander Signature</p>
                          <p className="text-[10px] font-black">{circularData.contactInfo}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800 text-[10px] whitespace-pre-line">{circularData.footer}</p>
                          <p className="text-[9px] text-slate-500 mt-1 uppercase font-mono">ENR OFFICIAL COPY</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: ARCHIVE GRID */}
        {activeSubTab === "archive" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">সার্কুলার আর্কাইভ (Circular Archive)</h3>
                <p className="text-xs text-slate-500 mt-1">Manage draft, active, and past enrollment circulars. Only one circular can be published at a time.</p>
              </div>
              <button 
                onClick={fetchArchive} 
                disabled={loadingArchive}
                className="p-3 bg-white/5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all border border-white/5"
                title="Refresh"
              >
                <RefreshCw size={18} className={loadingArchive ? "animate-spin text-primary" : ""} />
              </button>
            </div>

            {loadingArchive ? (
              <div className="text-center py-20 text-slate-400 font-bold flex items-center justify-center gap-3">
                <Loader2 size={24} className="animate-spin text-primary" />
                আর্কাইভ লোড হচ্ছে...
              </div>
            ) : circulars.length === 0 ? (
              <div className="p-16 text-center border-2 border-white/5 border-dashed rounded-[2.5rem] bg-slate-950/20">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h4 className="text-slate-400 font-bold mb-1">কোনো সার্কুলার পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-500">শুরু করতে "Generate & Edit" অপশন থেকে একটি সার্কুলার তৈরি করুন।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {circulars.map((item) => (
                  <div key={item.id} className="glass-card p-6 rounded-2xl border border-white/5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all hover:bg-white/[0.01]">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          item.status === "published" 
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-md shadow-emerald-500/5" 
                            : item.status === "draft" 
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest font-black leading-none">{item.referenceNumber}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white line-clamp-1">{item.title}</h4>
                      <p className="text-[10px] text-slate-500 font-bold">
                        Duration: {item.startDate} to {item.deadlineDate} • Generated: {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : new Date(item.publicationDate).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status !== "published" ? (
                        <button
                          onClick={() => handleStatusChange(item.id, "published")}
                          className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-bold uppercase rounded-lg transition-all"
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(item.id, "unpublished")}
                          className="px-3 py-1.5 bg-slate-800 text-slate-400 border border-white/5 hover:bg-slate-700 hover:text-white text-[10px] font-bold uppercase rounded-lg transition-all"
                        >
                          Unpublish
                        </button>
                      )}

                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all border border-white/5"
                        title="Edit Circular"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => handleDuplicate(item)}
                        className="p-2.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all border border-white/5"
                        title="Duplicate & Edit"
                      >
                        <Copy size={16} />
                      </button>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-white/5"
                        title="Delete Permanently"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SETTINGS PANEL */}
        {activeSubTab === "settings" && (
          <div className="glass-card p-10 rounded-[3rem] border border-white/5 shadow-2xl space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <div className="w-16 h-16 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Power className="text-primary" size={28} />
              </div>
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Public Access Settings</h2>
              <p className="text-xs text-slate-500">Configure circular visibility and general accessibility parameters on the landing homepage.</p>
            </div>

            <div className="max-w-xl mx-auto bg-slate-900/40 p-6 rounded-[2rem] border border-white/5 space-y-6">
              <div className="flex items-center justify-between gap-6 pb-2">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">Public Circular Access</h4>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">When enabled, any visitor can click "Download Circular" to view and download the published PDF copy on the landing page.</p>
                </div>
                <button
                  onClick={() => saveSettings(!publicAccessEnabled)}
                  disabled={savingSettings}
                  className={`relative p-1.5 w-14 h-8 rounded-full transition-all shrink-0 border ${
                    publicAccessEnabled 
                      ? "bg-primary/20 border-primary shadow-lg" 
                      : "bg-slate-800 border-white/10"
                  }`}
                >
                  <span className={`block w-4.5 h-4.5 rounded-full transition-all ${
                    publicAccessEnabled ? "bg-primary translate-x-6" : "bg-slate-500 translate-x-0"
                  }`} />
                </button>
              </div>
            </div>
            
            <div className="max-w-xl mx-auto p-4 border border-white/5 bg-slate-950/20 rounded-2xl flex items-start gap-3">
              <ShieldCheck className="text-primary w-5 h-5 shrink-0" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Security Policy: All circular document modification, generation, status updating, and settings toggling require high-privilege Super Admin parameters. Sub-administrators cannot read or edit these.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
