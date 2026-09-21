import { useState, useEffect, useRef } from "react";
import { 
  HelpCircle, Sparkles, RefreshCw, Save, CheckCircle, 
  X, AlertCircle, Loader2, Download, Trash2, Edit2, Shield,
  Eye, Power, Settings as SettingsIcon, FileText, Camera, User, Award, Plus, Trash
} from "lucide-react";
import { db, collection, query, orderBy, doc, setDoc, addDoc, updateDoc, deleteDoc, Timestamp, onSnapshot, getDocs } from "../../firebase";
import { generateAIGuide } from "../../services/geminiService";
import { downloadElementAsPdf } from "../../lib/pdfUtils";

export interface GuideContent {
  id?: string;
  title: string;
  refNumber: string;
  publishDate?: string;
  collegeName: string;
  regimentInfo: string;
  establishedYear: string;
  introText: string;
  
  photoRulesTitle: string;
  photoRules: string[];
  
  aiRulesTitle: string;
  aiRulesText: string;
  
  securityRulesTitle: string;
  securityRulesText: string;
  
  workflowTitle: string;
  workflowSteps: { step: number; title: string; desc: string }[];
  
  admitCardTitle: string;
  admitCardText: string;
  docsTitle: string;
  docsList: string[];
  
  warningText: string;
  commanderName: string;
  commanderRank: string;
  platoonFooter: string;
  subFooter: string;
  
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

const DEFAULT_GUIDE_DATA: GuideContent = {
  title: "অনলাইন ভর্তি আবেদন নির্দেশিকা ও নিয়মাবলী (OFFICIAL APPLICANT GUIDE)",
  refNumber: "CBCC-BNCC-GUIDE-2026",
  publishDate: "",
  collegeName: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
  regimentInfo: "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট",
  establishedYear: "ESTD. 2020 • COX'S BAZAR CITY COLLEGE",
  introText: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC) কক্সবাজার সিটি কলেজ প্লাটুনে যোগদানে ইচ্ছুক সকল ভর্তিচ্ছু শিক্ষার্থীর সুবিধার্থে অনলাইন আবেদন প্রক্রিয়া সহজতর করতে এই নির্দেশিকা প্রকাশ করা হলো। আবেদন করার পূর্বে নিয়মাবলীসমূহ অত্যন্ত সতর্কতার সাথে পাঠ করার জন্য নির্দেশ প্রদান করা যাচ্ছে।",
  photoRulesTitle: "১. ছবি আপলোডের সঠিক নিয়মাবলী (Photo Rules)",
  photoRules: [
    "ব্যাকগ্রাউন্ড: অবশ্যই এক রঙের (সাদা অথবা হালকা নীল) ব্যাকগ্রাউন্ড হতে হবে। কোনো প্রাকৃতিক দৃশ্য বা ঘরের আসবাবপত্র পেছনে থাকা যাবে না।",
    "পোশাক: কলারযুক্ত মার্জিত ফরমাল পোশাক পরিহিত হতে হবে। চশমা, টুপি বা ক্যাপ পরা ছবি গ্রহণযোগ্য নয়।",
    "পোজ ও অবস্থান: সরাসরি ক্যামেরার দিকে সোজা হয়ে তাকাতে হবে (Military aligned)। দুই কান ও কাঁধ সমানভাবে স্পষ্ট দেখা যেতে হবে।",
    "আলো ও স্পষ্টতা: ছবিতে পর্যাপ্ত আলো থাকতে হবে। কোনো অস্পষ্ট, ঘোলাটে, বা অতিরিক্ত ফিল্টার করা সেলফি আপলোড করা যাবে না।"
  ],
  aiRulesTitle: "২. আর্টিফিশিয়াল ইন্টেলিজেন্স (AI) ফটো চেকিং",
  aiRulesText: "আবেদন ফর্মে যুক্ত রয়েছে Gemini AI Integration। আপনি যখনই ছবি আপলোড করবেন, এআই স্বয়ংক্রিয়ভাবে ছবির ব্যাকগ্রাউন্ড, চশমা, টুপি, ছবির গুণমান এবং পোজ বিশ্লেষণ করবে। ছবি নিয়ম বহির্ভূত হলে পোর্টাল আপনাকে সতর্কবার্তা দেবে এবং সংশোধন করতে বলবে।",
  securityRulesTitle: "৩. সুরক্ষিত পাসওয়ার্ড সংরক্ষণ (Password Guard)",
  securityRulesText: "আবেদনপত্রটি সফলভাবে সাবমিট করার সাথে সাথে স্ক্রিনে একটি অটো-জেনারেটেড সুরক্ষিত পাসওয়ার্ড (Auto-generated Password) প্রদর্শিত হবে। আপনার নিবন্ধিত মোবাইল নম্বর এবং এই পাসওয়ার্ডটি অত্যন্ত যত্নসহকারে লিখে রাখুন। আপনার ড্যাশবোর্ডে প্রবেশের একমাত্র চাবিকাঠি এটি।",
  workflowTitle: "৪. আবেদন প্রক্রিয়া (Application Workflow)",
  workflowSteps: [
    { step: 1, title: "ধাপ ১ (রেজিস্ট্রেশন)", desc: "ফর্মে ব্যক্তিগত বিবরণ, নাম (বাংলা ও ইংরেজিতে), এবং এসএসসি জিপিএ টাইপ করুন।" },
    { step: 2, title: "ধাপ ২ (ছবি আপলোড)", desc: "সঠিক নিয়ম মেনে ছবি আপলোড করুন এবং এআই সনাক্তকরণ সম্পন্ন করুন।" },
    { step: 3, title: "ধাপ ৩ (শারীরিক বিবরণ)", desc: "আপনার সঠিক উচ্চতা, ওজন এবং রক্তের গ্রুপ ইনপুট করুন।" },
    { step: 4, title: "ধাপ ৪ (সাবমিশন)", desc: "ফর্ম সাবমিট করে পাসওয়ার্ড লিখে রাখুন।" }
  ],
  admitCardTitle: "৫. প্রবেশপত্র (Admit Card) সংগ্রহ প্রক্রিয়া",
  admitCardText: "আবেদনটি জমা হওয়ার পর আমাদের পিইউও এবং প্লাটুন অ্যাডমিনগণ আবেদনপত্রের সকল তথ্য ও ছবি গভীরভাবে নিরীক্ষণ করবেন। সবকিছু নির্ভুল থাকলে আবেদনটি অনুমোদন (Approved) করা হবে। অনুমোদন সম্পন্ন হওয়া মাত্রই আপনি ড্যাশবোর্ডে লগইন করে অফিশিয়াল কিউআর ও বারকোড সম্বলিত প্রবেশপত্র ডাউনলোড করতে পারবেন।",
  docsTitle: "৬. প্রয়োজনীয় কাগজপত্র (সংগে আনতে হবে)",
  docsList: [
    "এসএসসি ও এইচএসসি সনদপত্রের ফটোকপি (২ কপি)",
    "কলেজে ভর্তির রশিদ/রশিদ কপি (১ কপি)",
    "পাসপোর্ট সাইজ রঙিন ছবি (২ কপি)",
    "ব্লাড গ্রুপ রিপোর্টের ফটোকপি",
    "জাতীয় পরিচয়পত্র অথবা জন্ম সনদের ফটোকপি"
  ],
  warningText: "সতর্কতা: ভুল বা মিথ্যা তথ্য এবং জালিয়াতিপূর্ণ ছবি প্রদান করলে আবেদনপত্র সরাসরি বাতিল বলে গণ্য হবে।",
  commanderName: "উজ্জ্বল কান্তি দেব",
  commanderRank: "প্রফেসর আন্ডার অফিসার ও প্লাটুন কমান্ডার",
  platoonFooter: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
  subFooter: "১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট"
};

interface AIGuideManagerProps {
  adminSession?: any;
  onLogActivity?: (type: string, details: string) => Promise<any>;
}

export function AIGuideManager({ adminSession, onLogActivity }: AIGuideManagerProps) {
  const [activeTab, setActiveTab] = useState<"builder" | "preview" | "archive" | "settings">("builder");
  const [guideData, setGuideData] = useState<GuideContent>(DEFAULT_GUIDE_DATA);
  const [promptInstruction, setPromptInstruction] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [savedGuides, setSavedGuides] = useState<GuideContent[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [publicGuideEnabled, setPublicGuideEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Load guides from Firestore in real-time
  useEffect(() => {
    setIsLoadingArchive(true);
    const q = query(collection(db, "guides"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: GuideContent[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as GuideContent));
      setSavedGuides(items);
      
      // If there is an active guide, load it as initial guideData if editingId is null
      const activeGuide = items.find(g => g.isActive);
      if (activeGuide && !editingId) {
        setGuideData(activeGuide);
        setEditingId(activeGuide.id || null);
      }
      setIsLoadingArchive(false);
    }, (err) => {
      console.error("Error loading guides from Firestore:", err);
      setIsLoadingArchive(false);
    });

    // Load settings
    fetchSettings();

    return () => unsubscribe();
  }, []);

  const fetchSettings = async () => {
    try {
      const snap = await getDocs(collection(db, "guide_settings"));
      const settingsMap = snap.docs.reduce((acc: any, d) => {
        const data = d.data();
        acc[data.key] = data.value;
        return acc;
      }, {});
      if (settingsMap.public_guide !== undefined) {
        setPublicGuideEnabled(settingsMap.public_guide);
      }
    } catch (e) {
      console.error("Error fetching guide_settings:", e);
    }
  };

  // Generate with AI
  const handleAIGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await generateAIGuide(promptInstruction, guideData.refNumber);
      if (result) {
        setGuideData(prev => ({
          ...prev,
          ...result
        }));
        alert("✨ এআই সফলভাবে নির্দেশিকার তথ্য জেনারেট করেছে!");
      }
    } catch (e) {
      console.error("AI Generation error:", e);
      alert("এআই রেসপন্স তৈরিতে সমস্যা হয়েছে। পূর্ব নির্ধারিত টেমপ্লেট লোড করা হলো।");
    } finally {
      setIsGenerating(false);
    }
  };

  // Preset Loaders
  const loadPreset = (presetType: "standard" | "strict" | "concise") => {
    if (presetType === "standard") {
      setGuideData(DEFAULT_GUIDE_DATA);
    } else if (presetType === "strict") {
      setGuideData({
        ...DEFAULT_GUIDE_DATA,
        title: "ক্যাডেট ভর্তি ও শৃঙ্খলা সংক্রান্ত বিশেষ নির্দেশিকা ২০২৬ (SPECIAL DISCIPLINE GUIDE)",
        photoRules: [
          "ব্যাকগ্রাউন্ড: ১০০% প্লেন সাদা ব্যাকগ্রাউন্ড। কোনো শ্যাডো বা প্রাকৃতিক ব্যাকগ্রাউন্ড নিষিদ্ধ।",
          "পোশাক: ফরমাল ফুলহাতা শার্ট ও কলারসহ পোশাক পরিহিত হতে হবে। টুপি, রোদচশমা, বা কানের দুল গ্রহণযোগ্য নয়।",
          "পোজ: সঠিক মিলিটারী পোজ (সোজা হয়ে সামনে তাকানো), দুই কান ও ঘাড় সম্পূর্ণ দৃশ্যমান।",
          "গুণমান: এইচডি হাই রেজোলিউশন ছবি, কোনো এডিটিং সফটওয়্যার বা ফিল্টার দিয়ে প্রস্তুতকৃত হতে পারবে না।"
        ],
        warningText: "বিশেষ সতর্কতা: জালিয়াতি, ভুয়া সনদ বা ছবি জালিয়াতি প্রমাণিত হলে ক্যাডেট প্রার্থীর বিরুদ্ধে কলেজের শৃঙ্খলা কমিটি আইনানুগ ব্যবস্থা গ্রহণ করবে।"
      });
    } else if (presetType === "concise") {
      setGuideData({
        ...DEFAULT_GUIDE_DATA,
        title: "সংক্ষিপ্ত মোবাইল ই-ভর্তি নির্দেশিকা ২০২৬ (QUICK MOBILE GUIDE)",
        introText: "মোবাইল ও পিসি থেকে দ্রুত আবেদন জমা ও ড্যাশবোর্ডে প্রবেশের জরুরি নির্দেশিকা নিচে প্রদান করা হলো।",
        docsList: [
          "এসএসসি মার্কশীটের ফটোকপি (১ কপি)",
          "পাসপোর্ট সাইজ ছবি (২ কপি)",
          "ব্লাড গ্রুপ কার্ড কপি"
        ]
      });
    }
  };

  // Save to Firestore (as Draft or Active)
  const handleSaveToFirestore = async (asActive: boolean = false) => {
    setIsSaving(true);
    try {
      const now = Timestamp.now();
      const payload = {
        ...guideData,
        isActive: asActive,
        updatedAt: now,
        updatedBy: adminSession?.username || "admin"
      };

      if (asActive) {
        // First unset isActive for all other saved guides
        const activeGuidesQuery = savedGuides.filter(g => g.isActive && g.id !== editingId);
        for (const ag of activeGuidesQuery) {
          if (ag.id) {
            await updateDoc(doc(db, "guides", ag.id), { isActive: false });
          }
        }
      }

      let docId = editingId;
      if (docId) {
        await updateDoc(doc(db, "guides", docId), payload);
      } else {
        const docRef = await addDoc(collection(db, "guides"), {
          ...payload,
          createdAt: now
        });
        docId = docRef.id;
        setEditingId(docId);
      }

      // Also set to active_guide doc for instant lookup
      if (asActive) {
        await setDoc(doc(db, "guides", "active_guide"), {
          ...payload,
          createdAt: now
        });
      }

      if (onLogActivity) {
        await onLogActivity("GUIDE_SAVED", `Saved guide "${guideData.title}" (Active: ${asActive})`);
      }

      alert(asActive ? "🚀 নির্দেশিকাটি সফলভাবে পোর্টালে সক্রিয় ও প্রকাশ করা হয়েছে!" : "💾 নির্দেশিকার খসড়া সফলভাবে সংরক্ষণ করা হয়েছে।");
    } catch (e) {
      console.error("Save error:", e);
      alert("সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Guide
  const handleDeleteGuide = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই নির্দেশিকাটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, "guides", id));
      if (editingId === id) {
        setEditingId(null);
        setGuideData(DEFAULT_GUIDE_DATA);
      }
      alert("মুছে ফেলা হয়েছে।");
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // Set active published guide
  const handleSetActive = async (guide: GuideContent) => {
    if (!guide.id) return;
    try {
      // Unset all active
      for (const g of savedGuides) {
        if (g.id) {
          await updateDoc(doc(db, "guides", g.id), { isActive: false });
        }
      }
      await updateDoc(doc(db, "guides", guide.id), { isActive: true, updatedAt: Timestamp.now() });
      await setDoc(doc(db, "guides", "active_guide"), {
        ...guide,
        isActive: true,
        updatedAt: Timestamp.now()
      });
      setGuideData(guide);
      setEditingId(guide.id);
      alert("🎉 এই নির্দেশিকাটি পোর্টালে সক্রিয় করা হয়েছে!");
    } catch (e) {
      console.error("Set active error:", e);
    }
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      await downloadElementAsPdf(
        printRef.current,
        `BNCC_Admission_Guide_${guideData.refNumber || "2026"}.pdf`
      );
    } catch (e) {
      console.error(e);
      alert("PDF তৈরি করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setIsDownloading(false);
    }
  };

  // Dynamic Item Helpers for lists
  const addPhotoRule = () => {
    setGuideData(p => ({ ...p, photoRules: [...p.photoRules, "নতুন নিয়মাবলী..."] }));
  };
  const updatePhotoRule = (idx: number, val: string) => {
    setGuideData(p => {
      const arr = [...p.photoRules];
      arr[idx] = val;
      return { ...p, photoRules: arr };
    });
  };
  const removePhotoRule = (idx: number) => {
    setGuideData(p => ({ ...p, photoRules: p.photoRules.filter((_, i) => i !== idx) }));
  };

  const addDocList = () => {
    setGuideData(p => ({ ...p, docsList: [...p.docsList, "নতুন সনদ/কাগজপত্র..."] }));
  };
  const updateDocList = (idx: number, val: string) => {
    setGuideData(p => {
      const arr = [...p.docsList];
      arr[idx] = val;
      return { ...p, docsList: arr };
    });
  };
  const removeDocList = (idx: number) => {
    setGuideData(p => ({ ...p, docsList: p.docsList.filter((_, i) => i !== idx) }));
  };

  const addWorkflowStep = () => {
    setGuideData(p => {
      const nextStep = p.workflowSteps.length + 1;
      return {
        ...p,
        workflowSteps: [
          ...p.workflowSteps,
          { step: nextStep, title: `ধাপ ${nextStep}`, desc: "ধাপের বিবরণ লিখুন..." }
        ]
      };
    });
  };
  const updateWorkflowStep = (idx: number, field: "title" | "desc", val: string) => {
    setGuideData(p => {
      const steps = [...p.workflowSteps];
      steps[idx] = { ...steps[idx], [field]: val };
      return { ...p, workflowSteps: steps };
    });
  };
  const removeWorkflowStep = (idx: number) => {
    setGuideData(p => {
      const steps = p.workflowSteps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
      return { ...p, workflowSteps: steps };
    });
  };

  return (
    <div className="space-y-6 text-white font-sans pb-10">
      
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-primary mb-1">
            <HelpCircle className="w-6 h-6" />
            <h2 className="text-xl font-black uppercase tracking-tight">আবেদন নির্দেশিকা ও তথ্য সহায়িকা (Guide) মেকার</h2>
          </div>
          <p className="text-xs text-slate-400">
            এআই পাওয়ারড ও কাস্টম গাইড বিল্ডার, A4 প্রিন্ট প্রিভিউ এবং রিয়েলটাইম পোর্টাল পাবলিশার
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleSaveToFirestore(false)}
            disabled={isSaving}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-white/10 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />}
            খসড়া সংরক্ষণ (Draft)
          </button>
          
          <button
            onClick={() => handleSaveToFirestore(true)}
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle size={15} />}
            সক্রিয় হিসেবে প্রকাশ করুন
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={15} />}
            PDF ডাউনলোড
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("builder")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === "builder" ? "border-primary text-primary bg-white/5 rounded-t-xl" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Edit2 size={15} />
          গাইড বিল্ডার ও এআই এডিটর
        </button>

        <button
          onClick={() => setActiveTab("preview")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === "preview" ? "border-primary text-primary bg-white/5 rounded-t-xl" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Eye size={15} />
          রিয়েলটাইম A4 প্রিন্ট প্রিভিউ
        </button>

        <button
          onClick={() => setActiveTab("archive")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === "archive" ? "border-primary text-primary bg-white/5 rounded-t-xl" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText size={15} />
          সংরক্ষিত নির্দেশিকা (আর্কাইভ) ({savedGuides.length})
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 cursor-pointer whitespace-nowrap ${
            activeTab === "settings" ? "border-primary text-primary bg-white/5 rounded-t-xl" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <SettingsIcon size={15} />
          সেটিংস
        </button>
      </div>

      {/* TAB 1: BUILDER & EDITOR */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Controls (Form & AI Controls) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* AI Generator Box */}
            <div className="bg-slate-900 border border-primary/30 p-5 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-black text-sm uppercase">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                  এআই গাইড জেনারেটর (Gemini AI Assistant)
                </div>
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => loadPreset("standard")}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg border border-white/10 text-slate-300"
                  >
                    মানক টেমপ্লেট
                  </button>
                  <button 
                    onClick={() => loadPreset("strict")}
                    className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900/80 text-[10px] font-bold rounded-lg border border-amber-500/30 text-amber-300"
                  >
                    কড়া শৃঙ্খলামূলক
                  </button>
                  <button 
                    onClick={() => loadPreset("concise")}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded-lg border border-white/10 text-slate-300"
                  >
                    সংক্ষিপ্ত ই-গাইড
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-medium block">
                  এআই এর জন্য কাস্টম নির্দেশনা লিখুন (যেমন: "ছবি ও ফি প্রদান সংক্রান্ত রুলস সহজ বাংলা ভাষায় যুক্ত করো"):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptInstruction}
                    onChange={(e) => setPromptInstruction(e.target.value)}
                    placeholder="উদাহরণ: একাদশ ও অনার্সের আবেদনকারীদের জন্য নতুন নিয়ম ও সনদের রুলস বানাও..."
                    className="flex-grow bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating}
                    className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={14} />}
                    এআই জেনারেট
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields Accordion Sections */}
            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl">
              
              {/* Section 1: Header Details */}
              <div className="space-y-4 border-b border-white/10 pb-6">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" /> ১. হেডার, স্মারক ও শিরোনাম
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">স্মারক নম্বর (Reference No):</label>
                    <input
                      type="text"
                      value={guideData.refNumber}
                      onChange={e => setGuideData({ ...guideData, refNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">প্রকাশের তারিখ (Publish Date):</label>
                    <input
                      type="text"
                      placeholder="e.g. ২৯ জুলাই ২০২৬ / 29 July 2026"
                      value={guideData.publishDate || ""}
                      onChange={e => setGuideData({ ...guideData, publishDate: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">প্লাটুন ও কলেজ নাম:</label>
                    <input
                      type="text"
                      value={guideData.collegeName}
                      onChange={e => setGuideData({ ...guideData, collegeName: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">রেজিমেন্ট ও ব্যাটালিয়ন তথ্য:</label>
                    <input
                      type="text"
                      value={guideData.regimentInfo}
                      onChange={e => setGuideData({ ...guideData, regimentInfo: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">প্রতিষ্ঠা সাল/ট্যাগলাইন:</label>
                    <input
                      type="text"
                      value={guideData.establishedYear}
                      onChange={e => setGuideData({ ...guideData, establishedYear: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-400 block mb-1 font-bold">গাইডের মূল শিরোনাম:</label>
                    <input
                      type="text"
                      value={guideData.title}
                      onChange={e => setGuideData({ ...guideData, title: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Intro & Photo Rules */}
              <div className="space-y-4 border-b border-white/10 pb-6">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <Camera className="w-4 h-4" /> ২. ভূমিকা ও ছবি আপলোডের নিয়মাবলী
                </h3>

                <div>
                  <label className="text-slate-400 block mb-1 text-xs font-bold">মূল ভূমিকা বিবরণী:</label>
                  <textarea
                    rows={3}
                    value={guideData.introText}
                    onChange={e => setGuideData({ ...guideData, introText: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300 font-black uppercase">ছবি আপলোডের নির্দিষ্ট রুলস (Photo Rules List):</label>
                    <button
                      onClick={addPhotoRule}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-primary rounded-lg flex items-center gap-1 border border-primary/20"
                    >
                      <Plus size={13} /> নিয়ম যোগ করুন
                    </button>
                  </div>

                  {guideData.photoRules.map((rule, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs font-mono text-slate-500 shrink-0 w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        value={rule}
                        onChange={e => updatePhotoRule(idx, e.target.value)}
                        className="flex-grow bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => removePhotoRule(idx)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg shrink-0"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: AI & Security Password */}
              <div className="space-y-4 border-b border-white/10 pb-6">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" /> ৩. এআই ফটো চেকিং ও পাসওয়ার্ড নিরাপত্তা
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">এআই ফটো চেকিং বিবরণ:</label>
                    <textarea
                      rows={4}
                      value={guideData.aiRulesText}
                      onChange={e => setGuideData({ ...guideData, aiRulesText: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">পাসওয়ার্ড রুলস বিবরণ:</label>
                    <textarea
                      rows={4}
                      value={guideData.securityRulesText}
                      onChange={e => setGuideData({ ...guideData, securityRulesText: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Workflow Steps */}
              <div className="space-y-4 border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" /> ৪. আবেদন প্রক্রিয়ার ধাপসমূহ (Workflow Steps)
                  </h3>
                  <button
                    onClick={addWorkflowStep}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-primary rounded-lg flex items-center gap-1 border border-primary/20"
                  >
                    <Plus size={13} /> ধাপ যুক্ত করুন
                  </button>
                </div>

                <div className="space-y-3">
                  {guideData.workflowSteps.map((step, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-white/10 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-primary font-mono">ধাপ {step.step}</span>
                        <button
                          onClick={() => removeWorkflowStep(idx)}
                          className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <input
                          type="text"
                          value={step.title}
                          onChange={e => updateWorkflowStep(idx, "title", e.target.value)}
                          placeholder="ধাপের শিরোনাম"
                          className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-primary font-bold"
                        />
                        <input
                          type="text"
                          value={step.desc}
                          onChange={e => updateWorkflowStep(idx, "desc", e.target.value)}
                          placeholder="ধাপের কাজের সংক্ষেপ বিবরণ"
                          className="sm:col-span-2 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: Admit Card & Documents */}
              <div className="space-y-4 border-b border-white/10 pb-6">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4" /> ৫. প্রবেশপত্র ও প্রয়োজনীয় কাগজপত্র
                </h3>

                <div>
                  <label className="text-slate-400 block mb-1 text-xs font-bold">প্রবেশপত্র সংগ্রহ বিবরণ:</label>
                  <textarea
                    rows={3}
                    value={guideData.admitCardText}
                    onChange={e => setGuideData({ ...guideData, admitCardText: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300 font-black uppercase">প্রয়োজনীয় কাগজপত্র সংগে আনার তালিকা:</label>
                    <button
                      onClick={addDocList}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-primary rounded-lg flex items-center gap-1 border border-primary/20"
                    >
                      <Plus size={13} /> কাগজপত্র যোগ করুন
                    </button>
                  </div>

                  {guideData.docsList.map((docItem, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-xs font-mono text-slate-500 shrink-0 w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        value={docItem}
                        onChange={e => updateDocList(idx, e.target.value)}
                        className="flex-grow bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => removeDocList(idx)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg shrink-0"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 6: Warning & Commander Signature */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> ৬. সতর্কতা ও কর্মকর্তা স্বাক্ষর
                </h3>

                <div>
                  <label className="text-slate-400 block mb-1 text-xs font-bold">সতর্ক বার্তা (Warning Notice):</label>
                  <input
                    type="text"
                    value={guideData.warningText}
                    onChange={e => setGuideData({ ...guideData, warningText: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-amber-300 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">প্লাটুন কম্যান্ডার নাম:</label>
                    <input
                      type="text"
                      value={guideData.commanderName}
                      onChange={e => setGuideData({ ...guideData, commanderName: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-bold">পদবী ও পদমর্যাদা:</label>
                    <input
                      type="text"
                      value={guideData.commanderRank}
                      onChange={e => setGuideData({ ...guideData, commanderRank: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Live Side-by-side Visual Preview */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 rounded-2xl border border-white/10">
              <span className="text-xs font-black text-primary uppercase tracking-wider flex items-center gap-2">
                <Eye size={14} /> লাইভ A4 ডকুমেন্ট প্রিভিউ
              </span>
              <button
                onClick={() => setActiveTab("preview")}
                className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
              >
                পূর্ণাঙ্গ প্রিভিউতে দেখুন →
              </button>
            </div>

            {/* A4 Mini Preview Box */}
            <div className="bg-slate-950 p-2 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex justify-center">
              <div className="scale-[0.55] sm:scale-[0.65] origin-top bg-white text-black p-8 w-[790px] h-[1118px] flex flex-col justify-between rounded shadow-2xl relative select-none">
                
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-[1]">
                  <img src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" alt="Watermark" className="w-[450px] h-[450px]" referrerPolicy="no-referrer" />
                </div>

                {/* Body Content */}
                <div className="relative z-10 space-y-4 text-[11px] leading-relaxed">
                  
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                    <img src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" alt="Logo" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
                    <div className="text-center">
                      <h1 className="text-sm font-black text-slate-900 leading-none">{guideData.collegeName}</h1>
                      <p className="text-[9px] text-slate-600 font-bold mt-1 uppercase">{guideData.regimentInfo}</p>
                      <p className="text-[7px] text-slate-400 font-mono mt-0.5">{guideData.establishedYear}</p>
                    </div>
                    <img src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" alt="BNCC" className="h-12 w-auto object-contain" referrerPolicy="no-referrer" />
                  </div>

                  {/* Ref & Date */}
                  <div className="flex justify-between text-[9px] font-bold text-slate-800 border-b border-dashed border-slate-300 pb-1">
                    <span>স্মারক নং: {guideData.refNumber}</span>
                    <span>তারিখ: {new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>

                  <h3 className="text-[11px] font-black text-center text-white bg-slate-900 py-1 rounded uppercase">
                    {guideData.title}
                  </h3>

                  <p className="text-justify text-slate-700 text-[10px] leading-snug">
                    {guideData.introText}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-[9px]">
                    <div className="border border-slate-200 bg-slate-50 p-2 rounded-lg">
                      <h4 className="font-extrabold text-slate-950 border-b pb-1 mb-1">{guideData.photoRulesTitle}</h4>
                      <ul className="list-disc pl-3 space-y-0.5 text-slate-700">
                        {guideData.photoRules.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <div className="border border-red-200 bg-red-50/40 p-2 rounded-lg">
                        <h4 className="font-extrabold text-red-950 border-b border-red-200 pb-1 mb-1">{guideData.aiRulesTitle}</h4>
                        <p className="text-slate-700">{guideData.aiRulesText}</p>
                      </div>

                      <div className="border border-slate-200 bg-slate-50 p-2 rounded-lg">
                        <h4 className="font-extrabold text-slate-950 border-b pb-1 mb-1">{guideData.securityRulesTitle}</h4>
                        <p className="text-slate-700">{guideData.securityRulesText}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[9px]">
                    <div className="border border-slate-200 bg-slate-50 p-2 rounded-lg">
                      <h4 className="font-extrabold text-slate-950 border-b pb-1 mb-1">{guideData.workflowTitle}</h4>
                      <div className="space-y-1">
                        {guideData.workflowSteps.map((st, i) => (
                          <p key={i}><strong>{st.title}:</strong> {st.desc}</p>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="border border-slate-200 bg-slate-50 p-2 rounded-lg">
                        <h4 className="font-extrabold text-slate-950 border-b pb-1 mb-1">{guideData.admitCardTitle}</h4>
                        <p className="text-slate-700">{guideData.admitCardText}</p>
                      </div>

                      <div className="border border-slate-200 bg-slate-50 p-2 rounded-lg">
                        <h4 className="font-extrabold text-slate-950 border-b pb-1 mb-1">{guideData.docsTitle}</h4>
                        <ul className="list-disc pl-3 space-y-0.5 text-slate-700">
                          {guideData.docsList.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="border border-amber-200 bg-amber-50/40 p-2 rounded-lg text-center">
                    <p className="text-[9px] font-black text-amber-950">{guideData.warningText}</p>
                  </div>
                </div>

                {/* Signature */}
                <div className="flex justify-between items-end border-t border-slate-900 pt-2 relative z-10 text-[8px]">
                  <div>
                    <p className="font-bold text-slate-500 uppercase">প্লাটুন কম্যান্ডের স্বাক্ষর ও সীল</p>
                    <p className="font-black text-slate-950 text-[9px]">{guideData.commanderName}</p>
                    <p className="text-slate-600">{guideData.commanderRank}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-700">{guideData.platoonFooter}</p>
                    <p className="text-slate-500">{guideData.subFooter}</p>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: LIVE PRINTABLE A4 PREVIEW */}
      {activeTab === "preview" && (
        <div className="space-y-6 flex flex-col items-center">
          <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-white/10 w-full max-w-4xl justify-between">
            <div>
              <h3 className="text-sm font-black text-primary uppercase">A4 স্ট্যান্ডার্ড প্রিন্ট ও ডাউনলোড প্রিভিউ</h3>
              <p className="text-xs text-slate-400">এই ডকুমেন্টটি হুবহু অফিশিয়াল পেপারে যেভাবে প্রিন্ট হবে তা নিচে দৃশ্যমান:</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={15} />}
                ডাউনলোড A4 PDF
              </button>
            </div>
          </div>

          <div className="border border-slate-700 bg-white p-4 shadow-2xl rounded-2xl h-fit overflow-x-auto max-w-full">
            <div 
              ref={printRef}
              className="relative bg-white text-black p-10 w-[790px] h-[1118px] flex flex-col justify-between overflow-hidden select-none"
              style={{ letterSpacing: "-0.015em", fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              {/* WATERMARK */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-[1]">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="BNCC Logo Watermark" 
                  className="w-[450px] h-[450px]"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* BODY CONTENT */}
              <div className="relative z-10 flex-grow space-y-5">
                
                {/* LETTERHEAD HEAD */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <img 
                    src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                    alt="College Logo" 
                    className="h-14 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="text-center">
                    <h1 className="text-md font-black text-slate-900 tracking-tight leading-none">{guideData.collegeName}</h1>
                    <p className="text-[10px] text-slate-600 font-bold mt-1 uppercase">{guideData.regimentInfo}</p>
                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">{guideData.establishedYear}</p>
                  </div>
                  <img 
                    src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                    alt="BNCC Logo" 
                    className="h-14 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* REFERENCE */}
                <div className="flex justify-between text-[10px] font-bold text-slate-800 border-b border-dashed border-slate-300 pb-1.5">
                  <span>স্মারক নং: {guideData.refNumber}</span>
                  <span>তারিখ: {guideData.publishDate || (new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) + " বঙ্গাব্দ/খ্রিস্টাব্দ")}</span>
                </div>

                {/* DETAILS SHEET */}
                <div className="text-slate-900 space-y-4 text-[11px] leading-relaxed">
                  <h3 className="text-xs font-black text-center text-white bg-slate-900 py-1.5 rounded uppercase tracking-wide">
                    {guideData.title}
                  </h3>

                  <p className="text-justify text-slate-700 leading-normal text-[10.5px]">
                    {guideData.introText}
                  </p>

                  {/* Grid of Steps */}
                  <div className="grid grid-cols-2 gap-4 items-start">
                    
                    {/* Left Column */}
                    <div className="space-y-3">
                      
                      {/* Photo guidelines */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Camera className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guideData.photoRulesTitle}</h4>
                        </div>
                        <ul className="space-y-1 text-[9.5px] text-slate-700 list-disc pl-3">
                          {guideData.photoRules.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* AI Verification */}
                      <div className="border border-red-200 bg-red-50/40 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-red-200 pb-1 mb-2">
                          <Sparkles className="w-3.5 h-3.5 text-red-600 animate-pulse" />
                          <h4 className="font-extrabold text-red-950 text-[11px]">{guideData.aiRulesTitle}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guideData.aiRulesText}
                        </p>
                      </div>

                      {/* Credentials */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Shield className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guideData.securityRulesTitle}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guideData.securityRulesText}
                        </p>
                      </div>

                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      
                      {/* Step by Step application workflow */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <User className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guideData.workflowTitle}</h4>
                        </div>
                        <div className="space-y-2 text-[9.5px] text-slate-700">
                          {guideData.workflowSteps.map((st, i) => (
                            <div key={i} className="flex gap-1.5 items-start">
                              <span className="bg-slate-950 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono text-[8px] shrink-0 mt-0.5">{st.step}</span>
                              <span><strong>{st.title}:</strong> {st.desc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Approval and Admit Card */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <Award className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guideData.admitCardTitle}</h4>
                        </div>
                        <p className="text-[9.5px] text-slate-700 leading-normal">
                          {guideData.admitCardText}
                        </p>
                      </div>

                      {/* Required Documents Table */}
                      <div className="border border-slate-200 bg-slate-50 p-3 rounded-xl">
                        <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-2">
                          <CheckCircle className="w-3.5 h-3.5 text-slate-900" />
                          <h4 className="font-extrabold text-slate-950 text-[11px]">{guideData.docsTitle}</h4>
                        </div>
                        <ul className="space-y-0.5 text-[9px] text-slate-700 list-disc pl-3">
                          {guideData.docsList.map((docItem, i) => (
                            <li key={i}>{docItem}</li>
                          ))}
                        </ul>
                      </div>

                    </div>
                  </div>

                  {/* Summary Footer Warning */}
                  <div className="border border-amber-200 bg-amber-50/30 p-3 rounded-xl text-center space-y-1 mt-1">
                    <p className="text-[10px] font-black text-amber-950">
                      {guideData.warningText}
                    </p>
                    <p className="text-[8px] text-slate-500 font-mono uppercase">
                      WARNING: PROVIDING FALSE INFORMATION OR FORGED PHOTOGRAPHS WILL LEAD TO IMMEDIATE DISQUALIFICATION.
                    </p>
                  </div>

                </div>
              </div>

              {/* LETTER SIGNATURE */}
              <div className="flex justify-between items-end border-t border-slate-900 pt-3 z-10 relative">
                <div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">প্লাটুন কম্যান্ডের স্বাক্ষর ও সীল</p>
                  <p className="text-[9.5px] font-black text-slate-950">{guideData.commanderName}</p>
                  <p className="text-[8px] text-slate-600">{guideData.commanderRank}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-600">{guideData.platoonFooter}</p>
                  <p className="text-[8px] text-slate-400">{guideData.subFooter}</p>
                  <p className="text-[8px] text-slate-500 font-mono uppercase mt-0.5">{guideData.refNumber} OFFICIAL DOCUMENT</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ARCHIVE & SAVED GUIDES */}
      {activeTab === "archive" && (
        <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5" /> সংরক্ষিত ও প্রকাশিত নির্দেশিকা আর্কাইভ
            </h3>
            {isLoadingArchive && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          </div>

          {savedGuides.length === 0 ? (
            <div className="p-8 text-center bg-slate-950 rounded-2xl border border-dashed border-white/10 text-slate-400 text-xs">
              এখনো কোনো কাস্টম নির্দেশিকা সংরক্ষণ বা প্রকাশ করা হয়নি।
            </div>
          ) : (
            <div className="space-y-3">
              {savedGuides.map((guide, idx) => (
                <div 
                  key={guide.id || idx}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    guide.isActive 
                      ? "bg-emerald-950/30 border-emerald-500/50" 
                      : "bg-slate-950 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-bold">{guide.refNumber}</span>
                      {guide.isActive ? (
                        <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black rounded-full uppercase tracking-wider">
                          ✓ পোর্টালে সক্রিয়
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-full uppercase">
                          খসড়া / পুরোনো
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-black text-white">{guide.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-1">{guide.introText}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!guide.isActive && (
                      <button
                        onClick={() => handleSetActive(guide)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle size={13} />
                        সক্রিয় করুন
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setGuideData(guide);
                        setEditingId(guide.id || null);
                        setActiveTab("builder");
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 border border-white/10 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      সম্পাদনা
                    </button>

                    <button
                      onClick={() => handleDeleteGuide(guide.id!)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-xl cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SETTINGS */}
      {activeTab === "settings" && (
        <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl space-y-6 shadow-xl max-w-2xl">
          <h3 className="text-sm font-black text-primary uppercase tracking-wider flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" /> নির্দেশিকা পোর্টাল সেটিংস
          </h3>

          <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-white">পোর্টালে নির্দেশিকা দৃশ্যমান রাখা (Public Guide Modal)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">হোমপেজ ও আবেদন পোর্টালে "ভর্তি সহায়িকা" দেখার বাটন সচল থাকবে কিনা।</p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !publicGuideEnabled;
                  setPublicGuideEnabled(newVal);
                  try {
                    await setDoc(doc(db, "guide_settings", "public_guide"), {
                      key: "public_guide",
                      value: newVal,
                      updatedAt: Timestamp.now()
                    });
                  } catch (e) {
                    console.error("Save settings error:", e);
                  }
                }}
                className={`p-2 rounded-xl transition-all cursor-pointer ${
                  publicGuideEnabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-800 text-slate-400"
                }`}
              >
                <Power size={18} />
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-white/10 space-y-2">
            <p className="text-xs font-black text-white">ডিফল্ট ফ্যাক্টরি রিসেট</p>
            <p className="text-[11px] text-slate-400">এডিটরে থাকা তথ্য সম্পূর্ণ রিসেট করে অফিসিয়াল মূল টেমপ্লেট নিয়ে আসুন।</p>
            <button
              onClick={() => {
                if (confirm("আপনি কি রিসেট করে অফিসিয়াল মূল টেমপ্লেট লোড করতে চান?")) {
                  setGuideData(DEFAULT_GUIDE_DATA);
                  setEditingId(null);
                  alert("মূল টেমপ্লেট লোড করা হয়েছে।");
                }
              }}
              className="px-3.5 py-1.5 bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 cursor-pointer"
            >
              ফ্যাক্টরি রিসেট টেমপ্লেট
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
