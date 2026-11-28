/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, LayoutDashboard, Type, Layout, Users, 
  Medal, Bell, Activity, Image as ImageIcon, Palette, 
  Database, Search, Plus, Edit3, Trash2, CheckCircle2, 
  AlertCircle, RefreshCw, Download, Upload, ExternalLink, 
  Eye, Save, X, RotateCcw, Shield, Check, Info, 
  Sparkles, Sliders, ChevronRight, Layers, FileText
} from "lucide-react";
import { useCMS } from "../../context/CMSContext";
import { syncAllPortalDataToDatabase } from "../../services/databaseSyncService";
import { resolveMediaUrl } from "../../lib/api";
import { 
  CMSContentItem, 
  CMSCadetProfile, 
  CMSInchargeRecord, 
  CMSNoticeItem, 
  CMSActivityItem, 
  CMSGalleryMediaItem, 
  CMSSectionConfig, 
  CMSSiteSettings 
} from "../../types/cms";

type CMSTab = 
  | "overview" 
  | "text" 
  | "homepage" 
  | "cadets" 
  | "incharges" 
  | "notices" 
  | "activities" 
  | "gallery" 
  | "appearance" 
  | "backup";

export function CMSControlCenter() {
  const cms = useCMS();
  const [activeTab, setActiveTab] = useState<CMSTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncingDb, setIsSyncingDb] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const handlePushAllToDatabase = async () => {
    setIsSyncingDb(true);
    try {
      const res = await syncAllPortalDataToDatabase({ overwrite: false });
      await cms.refreshAll();
      showNotification(`Cloud Firestore ডাটাবেসে ${res.totalWritten}টি রেকর্ড সংরক্ষণ করা হয়েছে!`, "success");
    } catch (err: any) {
      showNotification(err?.message || "ডাটাবেস সিঙ্ক করতে সমস্যা হয়েছে", "error");
    } finally {
      setIsSyncingDb(false);
    }
  };

  const showNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // Pre-calculated stats
  const stats = useMemo(() => {
    return {
      totalTextItems: cms.contentItems.length,
      totalPages: 8,
      totalSections: cms.sections.length,
      totalCadets: cms.cadets.length,
      totalIncharges: cms.incharges.length,
      totalNotices: cms.notices.length,
      totalActivities: cms.activities.length,
      totalGallery: cms.gallery.length,
      lastUpdated: cms.settings.lastUpdated ? new Date(cms.settings.lastUpdated).toLocaleString("bn-BD") : "এখনই"
    };
  }, [cms]);

  // Tab definitions
  const tabs = [
    { id: "overview", label: "কন্ট্রোল ওভারভিউ", enLabel: "Overview", icon: LayoutDashboard },
    { id: "text", label: "সার্বজনীন টেক্সট এডিটর", enLabel: "Universal Text", icon: Type },
    { id: "homepage", label: "হোমপেজ ও সেকশন বিল্ডার", enLabel: "Homepage CMS", icon: Layout },
    { id: "cadets", label: "ক্যাডেট ডিরেক্টরি", enLabel: "Cadets", icon: Users },
    { id: "incharges", label: "হল অব ইন-চার্জেস ও নেতৃত্ব", enLabel: "In-Charges", icon: Medal },
    { id: "notices", label: "নোটিশ বোর্ড ও সার্কুলার", enLabel: "Notices", icon: Bell },
    { id: "activities", label: "ইভেন্টস ও কার্যক্রম", enLabel: "Activities", icon: Activity },
    { id: "gallery", label: "মিডিয়া ও ফটো গ্যালারি", enLabel: "Gallery", icon: ImageIcon },
    { id: "appearance", label: "থিম ও ব্র্যান্ডিং কন্ট্রোল", enLabel: "Theme & Branding", icon: Palette },
    { id: "backup", label: "ব্যাকআপ ও রিস্টোর", enLabel: "Backup & Restore", icon: Database },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100">
      {/* 1. TOP HEADER & STATUS BAR */}
      <div className="bg-gradient-to-r from-slate-950 via-[#002147] to-slate-950 p-6 sm:p-8 border-b border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-400/20 border border-amber-400/30 rounded-2xl text-amber-300">
                <Globe size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white font-montserrat tracking-tight">
                    Website Control Center
                  </h1>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    cms.syncError
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  }`}>
                    {cms.syncError ? "Local Draft Mode" : "Cloud Synced"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  সম্পূর্ণ ওয়েবসাইটের টেক্সট, ক্যাডেট তথ্য, নোটিশ, ছবি ও কনফিগারেশন সরাসরি ম্যানেজ করুন
                </p>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={() => void handlePushAllToDatabase()}
              disabled={isSyncingDb}
              className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              title="Seed & sync all missing CMS and website records into Cloud Firestore"
            >
              <Database size={14} className={isSyncingDb ? "animate-pulse" : ""} />
              <span>{isSyncingDb ? "সিঙ্ক হচ্ছে..." : "ডাটাবেসে সব সংরক্ষণ করুন"}</span>
            </button>

            <button
              onClick={() => {
                cms.refreshAll();
                showNotification("ক্লাউড ডাটাবেজ থেকে সর্বশেষ তথ্য লোড করা হয়েছে", "info");
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Sync with cloud database"
            >
              <RefreshCw size={14} className={cms.loading ? "animate-spin text-amber-400" : ""} />
              <span>রিফ্রেশ</span>
            </button>

            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Eye size={14} />
              <span>লাইভ সাইট দেখুন</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
        </div>

        {cms.syncError && (
          <div className="mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 bg-amber-950/90 border border-amber-500/40 text-amber-200">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-400 shrink-0" />
              <span>{cms.syncError}</span>
            </div>
            <button onClick={cms.clearSyncError} className="text-amber-300 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Global Notifications Toast */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border ${
                notification.type === "success" 
                  ? "bg-emerald-950/80 border-emerald-600/50 text-emerald-200" 
                  : notification.type === "error" 
                  ? "bg-rose-950/80 border-rose-600/50 text-rose-200"
                  : "bg-blue-950/80 border-blue-600/50 text-blue-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 sm:px-6 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CMSTab)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer relative ${
                isActive 
                  ? "bg-[#002147] text-amber-300 border border-amber-400/30 shadow-lg shadow-black/40" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Icon size={15} className={isActive ? "text-amber-400" : "text-slate-500"} />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeCmsTabPill"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT PANELS */}
      <div className="p-4 sm:p-6 lg:p-8 min-h-[600px] bg-slate-900/60">
        {activeTab === "overview" && (
          <CMSOverviewTab 
            stats={stats} 
            setActiveTab={setActiveTab} 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showNotification={showNotification}
          />
        )}

        {activeTab === "text" && (
          <CMSTextEditorTab showNotification={showNotification} />
        )}

        {activeTab === "homepage" && (
          <CMSHomepageTab showNotification={showNotification} />
        )}

        {activeTab === "cadets" && (
          <CMSCadetsTab showNotification={showNotification} />
        )}

        {activeTab === "incharges" && (
          <CMSInchargesTab showNotification={showNotification} />
        )}

        {activeTab === "notices" && (
          <CMSNoticesTab showNotification={showNotification} />
        )}

        {activeTab === "activities" && (
          <CMSActivitiesTab showNotification={showNotification} />
        )}

        {activeTab === "gallery" && (
          <CMSGalleryTab showNotification={showNotification} />
        )}

        {activeTab === "appearance" && (
          <CMSAppearanceTab showNotification={showNotification} />
        )}

        {activeTab === "backup" && (
          <CMSBackupTab showNotification={showNotification} />
        )}
      </div>
    </div>
  );
}

// ==========================================
// 1. OVERVIEW TAB
// ==========================================
function CMSOverviewTab({ 
  stats, 
  setActiveTab, 
  searchQuery, 
  setSearchQuery,
  showNotification 
}: { 
  stats: any; 
  setActiveTab: (tab: CMSTab) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showNotification: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const cms = useCMS();

  // Search matches across universal text, cadets, and notices
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();

    const textMatches = cms.contentItems.filter(item => 
      item.content.toLowerCase().includes(q) || 
      (item.contentEn && item.contentEn.toLowerCase().includes(q)) ||
      item.id.toLowerCase().includes(q) ||
      item.field.toLowerCase().includes(q)
    ).map(item => ({
      type: "Text Item",
      title: `${item.page} → ${item.field}`,
      snippet: item.content,
      action: () => setActiveTab("text")
    }));

    const cadetMatches = cms.cadets.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.banglaName && c.banglaName.toLowerCase().includes(q)) ||
      c.cadetNumber.includes(q)
    ).map(c => ({
      type: "Cadet Profile",
      title: `${c.name} (${c.cadetNumber})`,
      snippet: `${c.rank} • Batch ${c.batch} • ${c.department}`,
      action: () => setActiveTab("cadets")
    }));

    const noticeMatches = cms.notices.filter(n => 
      n.title.toLowerCase().includes(q) || 
      (n.titleEnglish && n.titleEnglish.toLowerCase().includes(q))
    ).map(n => ({
      type: "Notice",
      title: n.title,
      snippet: n.summary,
      action: () => setActiveTab("notices")
    }));

    return [...textMatches, ...cadetMatches, ...noticeMatches].slice(0, 8);
  }, [searchQuery, cms, setActiveTab]);

  return (
    <div className="space-y-8">
      {/* Global Quick Search Box */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ওয়েবসাইটের যেকোনো টেক্সট, ক্যাডেট নাম, নোটিশ বা তথ্য খুঁজুন..."
            className="w-full pl-12 pr-4 py-3.5 bg-slate-950/80 border border-slate-700 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.trim() && (
          <div className="absolute z-20 left-0 right-0 mt-2 bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl p-3 space-y-2 max-h-80 overflow-y-auto">
            <div className="text-[11px] font-bold text-slate-400 px-2 uppercase tracking-wider">
              অনুসন্ধানের ফলাফল ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">কোনো তথ্য পাওয়া যায়নি</div>
            ) : (
              searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={res.action}
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300">
                        {res.type}
                      </span>
                      <h4 className="text-xs font-bold text-white">{res.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{res.snippet}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveTab("text")}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 hover:border-amber-400/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <Type size={18} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] uppercase font-bold text-slate-500">টেক্সট এলিমেন্ট</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.totalTextItems}</div>
          <div className="text-[11px] text-slate-400 mt-1">সার্বজনীন টেক্সট এডিটর</div>
        </div>

        <div 
          onClick={() => setActiveTab("cadets")}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 hover:border-amber-400/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <Users size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] uppercase font-bold text-slate-500">ক্যাডেট প্রোফাইল</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.totalCadets}</div>
          <div className="text-[11px] text-slate-400 mt-1">নিয়মিত ও সিনিয়র ক্যাডেট</div>
        </div>

        <div 
          onClick={() => setActiveTab("notices")}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 hover:border-amber-400/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <Bell size={18} className="text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] uppercase font-bold text-slate-500">প্রকাশিত নোটিশ</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.totalNotices}</div>
          <div className="text-[11px] text-slate-400 mt-1">সার্কুলার ও জরুরি বিজ্ঞপ্তি</div>
        </div>

        <div 
          onClick={() => setActiveTab("gallery")}
          className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 hover:border-amber-400/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <ImageIcon size={18} className="text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] uppercase font-bold text-slate-500">গ্যালারি ছবি</span>
          </div>
          <div className="text-2xl font-black text-white">{stats.totalGallery}</div>
          <div className="text-[11px] text-slate-400 mt-1">ইভেন্ট ও প্যারেড ফটো</div>
        </div>
      </div>

      {/* Section Quick Jump Tiles */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Layers size={16} className="text-amber-400" />
          <span>ওয়েবসাইট ম্যানেজমেন্ট সেকশনসমূহ</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div 
            onClick={() => setActiveTab("text")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-amber-400/10 rounded-xl text-amber-300 shrink-0">
              <Type size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">সার্বজনীন টেক্সট এডিটর</h4>
              <p className="text-xs text-slate-400">ওয়েবসাইটের যেকোনো হেডলাইন, অনুচ্ছেদ, বাটন বা বিবরণ সম্পাদনা করুন।</p>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("homepage")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
              <Layout size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">হোমপেজ ও সেকশন বিল্ডার</h4>
              <p className="text-xs text-slate-400">হিরো ব্যানার, পরিসংখ্যান কাউন্টার, কমান্ডারের বাণী এবং সেকশন টগল।</p>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("cadets")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
              <Users size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">ক্যাডেট প্রোফাইল কন্ট্রোল</h4>
              <p className="text-xs text-slate-400">নতুন ক্যাডেট যোগ করুন, ছবি পরিবর্তন করুন, পদবি ও ব্যাচ আপডেট করুন।</p>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("incharges")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
              <Medal size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">হল অব ইন-চার্জেস</h4>
              <p className="text-xs text-slate-400">১ম ব্যাচ থেকে বর্তমান ৫ম ব্যাচের ইন-চার্জ ও সহ-ইনচার্জদের তথ্য ও ফটো।</p>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("notices")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 shrink-0">
              <Bell size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">নোটিশ ও সার্কুলার</h4>
              <p className="text-xs text-slate-400">নতুন ভর্তি বিজ্ঞপ্তি প্রকাশ, জরুরি নোটিশ পিন করা ও পিডিএফ সংযুক্তি।</p>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab("appearance")}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/80 transition-all cursor-pointer flex items-start gap-4"
          >
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
              <Palette size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">থিম, লোগো ও ব্র্যান্ডিং</h4>
              <p className="text-xs text-slate-400">নেভি ব্লু ও গোল্ডেন থিম, কলেজের লোগো, ফোন, ইমেইল ও সোশ্যাল লিংক।</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 2. UNIVERSAL TEXT EDITOR TAB
// ==========================================
function CMSTextEditorTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [selectedPage, setSelectedPage] = useState("All");
  const [textSearch, setTextSearch] = useState("");
  const [editingItem, setEditingItem] = useState<CMSContentItem | null>(null);

  // Available pages for filter
  const pages = ["All", "Home", "About", "Cadets", "Incharges", "Activities", "Notices", "Contact", "Global"];

  const filteredItems = useMemo(() => {
    return cms.contentItems.filter((item) => {
      const matchPage = selectedPage === "All" || item.page === selectedPage;
      const matchSearch = 
        !textSearch.trim() ||
        item.content.toLowerCase().includes(textSearch.toLowerCase()) ||
        (item.contentEn && item.contentEn.toLowerCase().includes(textSearch.toLowerCase())) ||
        item.field.toLowerCase().includes(textSearch.toLowerCase()) ||
        item.id.toLowerCase().includes(textSearch.toLowerCase());
      return matchPage && matchSearch;
    });
  }, [cms.contentItems, selectedPage, textSearch]);

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await cms.saveContentItem(editingItem);
      showNotification(`"${editingItem.field}" সফলভাবে আপডেট ও পাবলিশ করা হয়েছে!`);
      setEditingItem(null);
    } catch (e) {
      showNotification("টেক্সট সংরক্ষণ করতে সমস্যা হয়েছে", "error");
    }
  };

  const handleRevert = async (item: CMSContentItem) => {
    if (confirm(`আপনি কি "${item.field}" এর টেক্সট ডিফল্ট মানে ফিরিয়ে আনতে চান?`)) {
      const reverted: CMSContentItem = {
        ...item,
        content: item.defaultValue,
        lastModified: new Date().toISOString()
      };
      await cms.saveContentItem(reverted);
      showNotification(`"${item.field}" ডিফল্ট মানে ফিরিয়ে আনা হয়েছে`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Type size={20} className="text-amber-400" />
            <span>সার্বজনীন টেক্সট এডিটর (Universal Text Editor)</span>
          </h2>
          <p className="text-xs text-slate-400">
            ওয়েবসাইটের যেকোনো পেজের যেকোনো টেক্সট এলিমেন্ট পরিবর্তন করুন। পরিবর্তনটি সাথে সাথে লাইভ সাইটে দেখা যাবে।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            placeholder="কীওয়ার্ড বা ফিল্ড নাম খুঁজুন..."
            className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Page Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPage(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedPage === p 
                ? "bg-amber-400 text-slate-950 font-black shadow-md" 
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {p === "All" ? "সকল পেজ" : p}
          </button>
        ))}
      </div>

      {/* Text Items Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">ফিল্ড ও লোকেশন</th>
                <th className="py-3 px-4">বর্তমান টেক্সট (বাংলা)</th>
                <th className="py-3 px-4">ইংরেজি ভার্সন</th>
                <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-white">{item.field}</div>
                    <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                      {item.page} → {item.section}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-slate-200 line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="text-slate-400 line-clamp-2 italic">
                      {item.contentEn || "—"}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      লাইভ
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditingItem({ ...item })}
                        className="px-2.5 py-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 border border-amber-400/30 transition-all cursor-pointer"
                        title="Edit text"
                      >
                        <Edit3 size={13} />
                        <span>এডিট</span>
                      </button>
                      {item.content !== item.defaultValue && (
                        <button
                          onClick={() => handleRevert(item)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                          title="Revert to Default"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Edit3 size={16} className="text-amber-400" />
                    <span>টেক্সট সম্পাদনা: {editingItem.field}</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{editingItem.id}</p>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">বাংলা টেক্সট (মূল বিষয়বস্তু)</label>
                  <textarea
                    rows={4}
                    value={editingItem.content}
                    onChange={(e) => setEditingItem({ ...editingItem, content: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">ইংরেজি ভার্সন (ঐচ্ছিক)</label>
                  <textarea
                    rows={3}
                    value={editingItem.contentEn || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, contentEn: e.target.value })}
                    className="w-full p-3 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-sans"
                  />
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">ডিফল্ট মান:</span>
                    <button
                      onClick={() => setEditingItem({ ...editingItem, content: editingItem.defaultValue })}
                      className="text-amber-400 hover:underline font-bold"
                    >
                      ডিফল্ট ব্যবহার করুন
                    </button>
                  </div>
                  <p className="text-slate-500 italic">{editingItem.defaultValue}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-5 py-2 bg-[#C5A059] hover:bg-[#b59048] text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Save size={14} />
                  <span>সংরক্ষণ ও পাবলিশ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 3. HOMEPAGE MANAGEMENT TAB
// ==========================================
function CMSHomepageTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const heroSection = cms.sections.find(s => s.id === "home.hero");

  const [heroForm, setHeroForm] = useState({
    titlePre: cms.getText("home.hero.title_pre", "কক্সবাজার সিটি কলেজ"),
    titlePost: cms.getText("home.hero.title_post", "বিএনসিসি প্লাটুন"),
    subtitle: cms.getText("home.hero.subtitle", "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service."),
    description: cms.getText("home.hero.description", "আত্মপ্রত্যয়ী তরুণ নেতৃত্ব এবং দ্বিতীয় প্রতিরক্ষা স্তর গড়ে তোলাই আমাদের লক্ষ্য।"),
    bgImage: heroSection?.customData?.bgImage || "/assets/aistudio/dddf__1__7ebcab35.jpg",
    showTicker: heroSection?.customData?.showTicker ?? true,
    ctaOnline: cms.getText("home.hero.cta_online", "অনলাইনে আবেদন করুন"),
    ctaOffline: cms.getText("home.hero.cta_offline", "অফলাইন ফর্ম ডাউনলোড"),
    ctaCircular: cms.getText("home.hero.cta_circular", "ভর্তি সার্কুলার"),
  });

  const [commanderForm, setCommanderForm] = useState({
    ...cms.commander
  });

  const handleSaveHero = async () => {
    try {
      // Save text overrides
      await cms.saveContentItem({
        id: "home.hero.title_pre",
        page: "Home",
        section: "Hero",
        field: "Hero College Name",
        content: heroForm.titlePre,
        defaultValue: "কক্সবাজার সিটি কলেজ",
        language: "both",
        lastModified: new Date().toISOString(),
        modifiedBy: "Super Admin",
        status: "published"
      });
      await cms.saveContentItem({
        id: "home.hero.title_post",
        page: "Home",
        section: "Hero",
        field: "Hero Platoon Highlight",
        content: heroForm.titlePost,
        defaultValue: "বিএনসিসি প্লাটুন",
        language: "both",
        lastModified: new Date().toISOString(),
        modifiedBy: "Super Admin",
        status: "published"
      });
      await cms.saveContentItem({
        id: "home.hero.subtitle",
        page: "Home",
        section: "Hero",
        field: "Hero Subtitle",
        content: heroForm.subtitle,
        defaultValue: "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service.",
        language: "both",
        lastModified: new Date().toISOString(),
        modifiedBy: "Super Admin",
        status: "published"
      });
      await cms.saveContentItem({
        id: "home.hero.description",
        page: "Home",
        section: "Hero",
        field: "Hero Mission Statement",
        content: heroForm.description,
        defaultValue: "আত্মপ্রত্যয়ী তরুণ নেতৃত্ব এবং দ্বিতীয় প্রতিরক্ষা স্তর গড়ে তোলাই আমাদের লক্ষ্য।",
        language: "both",
        lastModified: new Date().toISOString(),
        modifiedBy: "Super Admin",
        status: "published"
      });

      // Save hero section custom data
      if (heroSection) {
        await cms.saveSection({
          ...heroSection,
          customData: {
            ...heroSection.customData,
            bgImage: heroForm.bgImage,
            showTicker: heroForm.showTicker
          }
        });
      }

      showNotification("হোমপেজ হিরো সেকশন সফলভাবে আপডেট করা হয়েছে!");
    } catch (e) {
      showNotification("হিরো সেকশন সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  const handleSaveCommander = async () => {
    try {
      await cms.saveCommander(commanderForm);
      showNotification("প্লাটুন কমান্ডারের বার্তা ও তথ্য আপডেট করা হয়েছে!");
    } catch (e) {
      showNotification("কমান্ডারের তথ্য সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Layout size={20} className="text-amber-400" />
          <span>হোমপেজ ম্যানেজমেন্ট সেন্টার (Homepage Management Center)</span>
        </h2>
        <p className="text-xs text-slate-400">
          হোমপেজের ব্যানার, কমান্ডারের বাণী, পরিসংখ্যান এবং প্রধান সেকশনসমূহের তথ্য ও ছবি পরিচালনা করুন।
        </p>
      </div>

      {/* 1. HERO BANNER CONFIG */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={16} />
            <span>১. হিরো ব্যানার ও হেডার (Hero Banner & Header)</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">home.hero</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1">কলেজ শিরোনাম (Title Pre)</label>
            <input
              type="text"
              value={heroForm.titlePre}
              onChange={(e) => setHeroForm({ ...heroForm, titlePre: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">প্লাটুন শিরোনাম (Title Post Highlight)</label>
            <input
              type="text"
              value={heroForm.titlePost}
              onChange={(e) => setHeroForm({ ...heroForm, titlePost: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-1">সাবটাইটেল / নীতিবাক্য (Subtitle)</label>
            <input
              type="text"
              value={heroForm.subtitle}
              onChange={(e) => setHeroForm({ ...heroForm, subtitle: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-1">মূল লক্ষ্য ও পরিচিতি বক্তব্য (Description)</label>
            <textarea
              rows={2}
              value={heroForm.description}
              onChange={(e) => setHeroForm({ ...heroForm, description: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">হিরো ব্যাকগ্রাউন্ড ইমেজ URL</label>
            <input
              type="text"
              value={heroForm.bgImage}
              onChange={(e) => setHeroForm({ ...heroForm, bgImage: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono text-[11px]"
            />
          </div>

          <div className="flex items-center gap-3 pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={heroForm.showTicker}
                onChange={(e) => setHeroForm({ ...heroForm, showTicker: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="text-slate-300 font-bold">নোটিশ বার টিকার (Notice Ticker) প্রদর্শন চালু রাখুন</span>
            </label>
          </div>
        </div>

        {/* Hero Background Preview */}
        {heroForm.bgImage && (
          <div className="relative h-24 rounded-2xl overflow-hidden border border-slate-700 bg-slate-900">
            <img 
              src={resolveMediaUrl(heroForm.bgImage)} 
              alt="Hero Preview" 
              className="w-full h-full object-cover opacity-60" 
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#002147] to-transparent flex items-center px-4">
              <span className="text-xs font-bold text-amber-300">ব্যাকগ্রাউন্ড প্রিভিউ</span>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveHero}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Save size={15} />
            <span>হিরো সেকশন সেভ করুন</span>
          </button>
        </div>
      </div>

      {/* 2. PLATOON COMMANDER ADDRESS CONFIG */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <Medal size={16} />
            <span>২. প্লাটুন কমান্ডারের বাণী ও প্রোফাইল (Platoon Commander's Message)</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">PUO Ujjwal Kanti Deb</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-bold mb-1">কমান্ডারের নাম (বাংলা)</label>
            <input
              type="text"
              value={commanderForm.banglaName}
              onChange={(e) => setCommanderForm({ ...commanderForm, banglaName: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">কমান্ডারের নাম (English)</label>
            <input
              type="text"
              value={commanderForm.name}
              onChange={(e) => setCommanderForm({ ...commanderForm, name: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">সামরিক পদবি ও পদবী (Rank & Designation)</label>
            <input
              type="text"
              value={commanderForm.rank}
              onChange={(e) => setCommanderForm({ ...commanderForm, rank: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">ছবি URL (Photo URL)</label>
            <input
              type="text"
              value={commanderForm.photoUrl}
              onChange={(e) => setCommanderForm({ ...commanderForm, photoUrl: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">যোগাযোগ ফোন (Phone)</label>
            <input
              type="text"
              value={commanderForm.phone}
              onChange={(e) => setCommanderForm({ ...commanderForm, phone: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">ইমেইল (Email)</label>
            <input
              type="text"
              value={commanderForm.email}
              onChange={(e) => setCommanderForm({ ...commanderForm, email: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-1">কমান্ডারের উদ্ধৃতি ও বাণী (Message Content)</label>
            <textarea
              rows={3}
              value={commanderForm.message}
              onChange={(e) => setCommanderForm({ ...commanderForm, message: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Commander Photo & Quote Live Preview */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <img
            src={resolveMediaUrl(commanderForm.photoUrl || "/assets/aistudio/POU_7647ec14.png")}
            alt={commanderForm.name || "Commander"}
            className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/POU_7647ec14.png");
            }}
          />
          <div className="space-y-0.5">
            <div className="font-bold text-white text-xs">{commanderForm.banglaName} ({commanderForm.name})</div>
            <div className="text-[11px] text-amber-300">{commanderForm.rank} • {commanderForm.designation}</div>
            <p className="text-[11px] text-slate-400 italic line-clamp-1">"{commanderForm.message}"</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveCommander}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Save size={15} />
            <span>কমান্ডারের তথ্য সেভ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. CADET DIRECTORY MANAGEMENT TAB
// ==========================================
function CMSCadetsTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [cadetSearch, setCadetSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("All");
  const [editingCadet, setEditingCadet] = useState<CMSCadetProfile | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const ranks = ["All", "In-Charge", "CUO", "Sergeant", "Corporal", "Lance Corporal", "Cadet"];

  const filteredCadets = useMemo(() => {
    return cms.cadets.filter((c) => {
      const matchRank = rankFilter === "All" || c.rank === rankFilter || (rankFilter === "In-Charge" && c.status === "In-Charge");
      const matchSearch = 
        !cadetSearch.trim() ||
        c.name.toLowerCase().includes(cadetSearch.toLowerCase()) ||
        (c.banglaName && c.banglaName.toLowerCase().includes(cadetSearch.toLowerCase())) ||
        c.cadetNumber.includes(cadetSearch) ||
        c.batch.includes(cadetSearch) ||
        (c.department && c.department.toLowerCase().includes(cadetSearch.toLowerCase()));
      return matchRank && matchSearch;
    });
  }, [cms.cadets, rankFilter, cadetSearch]);

  const handleCreateNew = () => {
    const newCadet: CMSCadetProfile = {
      id: `cadet-${Date.now()}`,
      name: "",
      banglaName: "",
      cadetNumber: `2615${Math.floor(1000 + Math.random() * 9000)}`,
      rank: "Cadet",
      rankFull: "Cadet",
      batch: "2026",
      department: "HSC (Science / Arts / Commerce)",
      institution: "Cox's Bazar City College",
      bloodGroup: "O+",
      photo: "/assets/aistudio/dddf__1__7ebcab35.jpg",
      status: "Active",
      isFeatured: false,
      role: "Regular Cadet",
      bio: "Committed cadet of Cox's Bazar City College BNCC Platoon."
    };
    setEditingCadet(newCadet);
    setIsAddingNew(true);
  };

  const handleSaveCadet = async () => {
    if (!editingCadet || !editingCadet.name.trim() || !editingCadet.cadetNumber.trim()) {
      showNotification("ক্যাডেটের নাম ও ক্যাডেট নম্বর প্রদান বাধ্যতামূলক", "error");
      return;
    }
    try {
      await cms.saveCadet(editingCadet);
      showNotification(isAddingNew ? "নতুন ক্যাডেট প্রোফাইল যোগ করা হয়েছে!" : "ক্যাডেট প্রোফাইল আপডেট করা হয়েছে!");
      setEditingCadet(null);
      setIsAddingNew(false);
    } catch (e) {
      showNotification("ক্যাডেট তথ্য সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  const handleDeleteCadet = async (id: string, name: string) => {
    if (confirm(`আপনি কি ক্যাডেট "${name}" এর প্রোফাইল স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      await cms.deleteCadet(id);
      showNotification(`ক্যাডেট "${name}" মুছে ফেলা হয়েছে`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-amber-400" />
            <span>ক্যাডেট ডিরেক্টরি ম্যানেজমেন্ট ({cms.cadets.length} ক্যাডেট)</span>
          </h2>
          <p className="text-xs text-slate-400">
            নিয়মিত, সিনিয়র ও ইন-চার্জ ক্যাডেটদের তালিকা, পদবি, ছবি ও তথ্য ব্যবস্থাপনা করুন।
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={cadetSearch}
            onChange={(e) => setCadetSearch(e.target.value)}
            placeholder="ক্যাডেট নাম বা নম্বর খুঁজুন..."
            className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
          />
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>নতুন ক্যাডেট যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Rank Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {ranks.map((r) => (
          <button
            key={r}
            onClick={() => setRankFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              rankFilter === r 
                ? "bg-amber-400 text-slate-950 font-black" 
                : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {r === "All" ? "সকল পদবি" : r}
          </button>
        ))}
      </div>

      {/* Cadets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCadets.map((c) => (
          <div
            key={c.id}
            className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
          >
            <div className="flex items-start gap-3.5">
              <img
                src={resolveMediaUrl(c.photo || "/assets/aistudio/dddf__1__7ebcab35.jpg")}
                alt={c.name}
                className="w-14 h-14 rounded-2xl object-cover object-top border border-slate-700 shrink-0 bg-slate-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/dddf__1__7ebcab35.jpg");
                }}
              />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {c.rank}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Batch {c.batch}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                {c.banglaName && (
                  <p className="text-[11px] text-slate-400 truncate">{c.banglaName}</p>
                )}
                <p className="text-[10px] text-amber-400/90 font-mono">ID: {c.cadetNumber}</p>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 border-t border-slate-900 pt-2">
              <div className="flex justify-between">
                <span>বিভাগ:</span>
                <span className="text-slate-300 font-medium truncate max-w-[150px]">{c.department || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>রক্তের গ্রুপ:</span>
                <span className="text-rose-400 font-bold">{c.bloodGroup || "—"}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-900 pt-2">
              <button
                onClick={() => {
                  setEditingCadet({ ...c });
                  setIsAddingNew(false);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Edit3 size={13} />
                <span>এডিট</span>
              </button>
              <button
                onClick={() => handleDeleteCadet(c.id, c.name)}
                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all"
                title="Delete Cadet"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Cadet Modal */}
      <AnimatePresence>
        {editingCadet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users size={16} className="text-amber-400" />
                  <span>{isAddingNew ? "নতুন ক্যাডেট প্রোফাইল যোগ করুন" : "ক্যাডেট প্রোফাইল সম্পাদনা"}</span>
                </h3>
                <button onClick={() => setEditingCadet(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাডেটের নাম (English) *</label>
                  <input
                    type="text"
                    value={editingCadet.name}
                    onChange={(e) => setEditingCadet({ ...editingCadet, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g. Mohammad Sakib"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাডেটের নাম (বাংলা)</label>
                  <input
                    type="text"
                    value={editingCadet.banglaName || ""}
                    onChange={(e) => setEditingCadet({ ...editingCadet, banglaName: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g. মোহাম্মদ সাকিব"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাডেট নম্বর (ID) *</label>
                  <input
                    type="text"
                    value={editingCadet.cadetNumber}
                    onChange={(e) => setEditingCadet({ ...editingCadet, cadetNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono"
                    placeholder="e.g. 24154353"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">পদবি (Rank)</label>
                  <select
                    value={editingCadet.rank}
                    onChange={(e) => {
                      const r = e.target.value as any;
                      setEditingCadet({ 
                        ...editingCadet, 
                        rank: r,
                        rankFull: `Cadet ${r}`
                      });
                    }}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Cadet">Cadet</option>
                    <option value="Lance Corporal">Lance Corporal</option>
                    <option value="Corporal">Corporal</option>
                    <option value="Sergeant">Sergeant</option>
                    <option value="CUO">Cadet Under Officer (CUO)</option>
                    <option value="In-Charge">Platoon In-Charge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ব্যাচ (Batch)</label>
                  <input
                    type="text"
                    value={editingCadet.batch}
                    onChange={(e) => setEditingCadet({ ...editingCadet, batch: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono"
                    placeholder="e.g. 2024 or 2025"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">রক্তের গ্রুপ (Blood Group)</label>
                  <select
                    value={editingCadet.bloodGroup || "O+"}
                    onChange={(e) => setEditingCadet({ ...editingCadet, bloodGroup: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">বিভাগ / শ্রেণি (Department)</label>
                  <input
                    type="text"
                    value={editingCadet.department}
                    onChange={(e) => setEditingCadet({ ...editingCadet, department: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g. Business Studies / Science"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">মোবাইল ফোন (Phone)</label>
                  <input
                    type="text"
                    value={editingCadet.contact || ""}
                    onChange={(e) => setEditingCadet({ ...editingCadet, contact: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">প্রোফাইল ছবি URL (Photo URL)</label>
                  <input
                    type="text"
                    value={editingCadet.photo}
                    onChange={(e) => setEditingCadet({ ...editingCadet, photo: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono text-[11px]"
                    placeholder="/assets/aistudio/... or https://..."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">দায়িত্ব বা অর্জন (Role & Achievements)</label>
                  <input
                    type="text"
                    value={editingCadet.role || ""}
                    onChange={(e) => setEditingCadet({ ...editingCadet, role: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                    placeholder="e.g. Best Shooter / Squad Commander"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingCadet(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveCadet}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20 cursor-pointer"
                >
                  <Save size={14} />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 5. INCHARGES & LEADERSHIP TAB
// ==========================================
function CMSInchargesTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [editingIncharge, setEditingIncharge] = useState<CMSInchargeRecord | null>(null);

  const handleSaveIncharge = async () => {
    if (!editingIncharge) return;
    try {
      await cms.saveIncharge(editingIncharge);
      showNotification("ইন-চার্জ তথ্য সফলভাবে আপডেট করা হয়েছে!");
      setEditingIncharge(null);
    } catch (e) {
      showNotification("সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Medal size={20} className="text-amber-400" />
            <span>হল অব ইন-চার্জেস (Hall of In-Charges Leadership)</span>
          </h2>
          <p className="text-xs text-slate-400">
            ১ম ব্যাচ থেকে বর্তমান ৫ম ব্যাচ পর্যন্ত সকল প্লাটুন ইন-চার্জদের নাম, ছবি, পদবি ও নেতৃত্বকাল।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cms.incharges.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-4"
          >
            <div className="flex items-start justify-between">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                {item.batch}
              </span>
              <button
                onClick={() => setEditingIncharge({ ...item })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Edit3 size={13} />
                <span>এডিট</span>
              </button>
            </div>

            <div className="flex items-center gap-4">
              <img
                src={resolveMediaUrl(item.photoUrl || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png")}
                alt={item.name || "In-Charge"}
                className="w-16 h-16 rounded-2xl object-cover object-top border-2 border-amber-400/60 shrink-0 bg-slate-900"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                }}
              />
              {Boolean(item.coPhotoUrl && item.coPhotoUrl.trim() !== "") && (
                <img
                  src={resolveMediaUrl(item.coPhotoUrl)}
                  alt="Co-In-Charge"
                  className="w-16 h-16 rounded-2xl object-cover object-top border-2 border-amber-400/60 shrink-0 bg-slate-900"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
                  }}
                />
              )}
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">{item.name}</h4>
                {item.banglaName && (
                  <p className="text-xs text-slate-400">{item.banglaName}</p>
                )}
                <p className="text-[11px] text-amber-400 font-bold">{item.rankTitle}</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">কার্যকাল:</span>
                <span className="text-slate-300 font-medium">{item.term || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">স্বীকৃতি:</span>
                <span className="text-amber-300 font-medium">{item.awards || "—"}</span>
              </div>
              <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800 line-clamp-2">
                "{item.bio}"
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Incharge Modal */}
      <AnimatePresence>
        {editingIncharge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Medal size={16} className="text-amber-400" />
                  <span>ইন-চার্জ তথ্য সম্পাদনা: {editingIncharge.batch}</span>
                </h3>
                <button onClick={() => setEditingIncharge(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ইন-চার্জের নাম (English)</label>
                  <input
                    type="text"
                    value={editingIncharge.name}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ইন-চার্জের নাম (বাংলা)</label>
                  <input
                    type="text"
                    value={editingIncharge.banglaName || ""}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, banglaName: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">পদবি (Rank Title)</label>
                  <input
                    type="text"
                    value={editingIncharge.rankTitle}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, rankTitle: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">কার্যকাল (Tenure Term)</label>
                  <input
                    type="text"
                    value={editingIncharge.term || ""}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, term: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ছবি URL (Photo URL)</label>
                  <input
                    type="text"
                    value={editingIncharge.photoUrl}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, photoUrl: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">সহ-ইনচার্জ ছবি URL (Co-Photo URL)</label>
                  <input
                    type="text"
                    value={editingIncharge.coPhotoUrl || ""}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, coPhotoUrl: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">সংক্ষিপ্ত পরিচিতি ও অবদান (Bio)</label>
                  <textarea
                    rows={2}
                    value={editingIncharge.bio || ""}
                    onChange={(e) => setEditingIncharge({ ...editingIncharge, bio: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingIncharge(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveIncharge}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Save size={14} />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 6. NOTICE BOARD & CIRCULARS TAB
// ==========================================
function CMSNoticesTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [editingNotice, setEditingNotice] = useState<CMSNoticeItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleCreateNew = () => {
    const newNotice: CMSNoticeItem = {
      id: `notc-${Date.now()}`,
      refNumber: `CBCC-BNCC/PUB-2026/${Math.floor(10 + Math.random() * 90)}`,
      title: "",
      titleEnglish: "",
      category: "General",
      publishDate: new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" }),
      isImportant: true,
      status: "Active",
      summary: "",
      content: "",
      signedBy: cms.commander.banglaName || "উজ্জ্বল কান্তি দেব",
      designation: "প্রফেসর আন্ডার অফিসার (PUO) ও প্লাটুন কমান্ডার",
      attachmentUrl: "",
      attachmentName: "Notice.pdf",
      isPinned: false
    };
    setEditingNotice(newNotice);
    setIsAddingNew(true);
  };

  const handleSaveNotice = async () => {
    if (!editingNotice || !editingNotice.title.trim()) {
      showNotification("বিজ্ঞপ্তির শিরোনাম আবশ্যক", "error");
      return;
    }
    try {
      await cms.saveNotice(editingNotice);
      showNotification(isAddingNew ? "নতুন নোটিশ প্রকাশিত হয়েছে!" : "নোটিশ আপডেট করা হয়েছে!");
      setEditingNotice(null);
      setIsAddingNew(false);
    } catch (e) {
      showNotification("নোটিশ প্রকাশে সমস্যা হয়েছে", "error");
    }
  };

  const handleDeleteNotice = async (id: string, title: string) => {
    if (confirm(`আপনি কি "${title}" নোটিশটি স্থায়ীভাবে মুছে ফেলতে চান?`)) {
      await cms.deleteNotice(id);
      showNotification("নোটিশ মুছে ফেলা হয়েছে");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            <span>অফিসিয়াল নোটিশ বোর্ড ও সার্কুলার ম্যানেজমেন্ট</span>
          </h2>
          <p className="text-xs text-slate-400">
            নতুন ভর্তি বিজ্ঞপ্তি, প্যারেড আদেশ, ক্যাম্প শিডিউল প্রকাশ করুন এবং পিডিএফ এটাচমেন্ট যোগ করুন।
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20 cursor-pointer"
        >
          <Plus size={15} />
          <span>নতুন নোটিশ প্রকাশ করুন</span>
        </button>
      </div>

      <div className="space-y-3">
        {cms.notices.map((n) => (
          <div
            key={n.id}
            className="p-5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {n.category}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{n.refNumber}</span>
                <span className="text-[10px] text-slate-500">&bull; {n.publishDate}</span>
                {n.isImportant && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    জরুরি
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white leading-snug">{n.title}</h4>
              <p className="text-xs text-slate-400 line-clamp-2">{n.summary}</p>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                onClick={() => {
                  setEditingNotice({ ...n });
                  setIsAddingNew(false);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Edit3 size={13} />
                <span>এডিট</span>
              </button>
              <button
                onClick={() => handleDeleteNotice(n.id, n.title)}
                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg transition-all"
                title="Delete Notice"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Notice Modal */}
      <AnimatePresence>
        {editingNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Bell size={16} className="text-amber-400" />
                  <span>{isAddingNew ? "নতুন নোটিশ প্রকাশ" : "নোটিশ সম্পাদনা"}</span>
                </h3>
                <button onClick={() => setEditingNotice(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">স্মারক নম্বর (Ref Number)</label>
                  <input
                    type="text"
                    value={editingNotice.refNumber}
                    onChange={(e) => setEditingNotice({ ...editingNotice, refNumber: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">বিজ্ঞপ্তির শিরোনাম (বাংলা) *</label>
                  <input
                    type="text"
                    value={editingNotice.title}
                    onChange={(e) => setEditingNotice({ ...editingNotice, title: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-sans"
                    placeholder="e.g. নতুন ক্যাডেট ভর্তি বিজ্ঞপ্তি ২০২৬"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাটাগরি</label>
                  <select
                    value={editingNotice.category}
                    onChange={(e) => setEditingNotice({ ...editingNotice, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Recruitment">Recruitment (ভর্তি)</option>
                    <option value="Parade">Parade (প্যারেড)</option>
                    <option value="Training">Training (প্রশিক্ষণ)</option>
                    <option value="Orders">Orders (আদেশ)</option>
                    <option value="Exam">Exam (পরীক্ষা)</option>
                    <option value="General">General (সাধারণ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">সারসংক্ষেপ (Summary)</label>
                  <textarea
                    rows={2}
                    value={editingNotice.summary}
                    onChange={(e) => setEditingNotice({ ...editingNotice, summary: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">পূর্ণ বিবরণ (Full Content)</label>
                  <textarea
                    rows={5}
                    value={editingNotice.content}
                    onChange={(e) => setEditingNotice({ ...editingNotice, content: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">সংযুক্তি ফাইল লিংক (Attachment PDF URL)</label>
                  <input
                    type="text"
                    value={editingNotice.attachmentUrl || ""}
                    onChange={(e) => setEditingNotice({ ...editingNotice, attachmentUrl: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
                    placeholder="https://..."
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingNotice.isImportant}
                      onChange={(e) => setEditingNotice({ ...editingNotice, isImportant: e.target.checked })}
                      className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                    />
                    <span className="text-slate-300 font-bold">জরুরি / গুরুত্বপূর্ণ বিজ্ঞপ্তি হিসেবে মার্ক করুন</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingNotice(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveNotice}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Save size={14} />
                  <span>পাবলিশ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 7. ACTIVITIES & EVENTS TAB
// ==========================================
function CMSActivitiesTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [editingActivity, setEditingActivity] = useState<CMSActivityItem | null>(null);

  const handleSaveActivity = async () => {
    if (!editingActivity || !editingActivity.title.trim()) return;
    try {
      await cms.saveActivity(editingActivity);
      showNotification("কার্যক্রম সফলভাবে সংরক্ষণ করা হয়েছে!");
      setEditingActivity(null);
    } catch (e) {
      showNotification("সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-amber-400" />
            <span>প্রশিক্ষণ ও সামাজিক কার্যক্রম (Activities & Events CMS)</span>
          </h2>
          <p className="text-xs text-slate-400">
            নিয়মিত সামরিক ড্রিল, অস্ত্র প্রশিক্ষণ, জাতীয় দিবস কুচকাওয়াজ ও জনকল্যাণমূলক ইভেন্ট পরিচালনা করুন।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cms.activities.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="relative h-36 bg-slate-900">
              <img
                src={resolveMediaUrl(a.image || "/assets/aistudio/dddf__1__7ebcab35.jpg")}
                alt={a.title || "Activity"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/dddf__1__7ebcab35.jpg");
                }}
              />
              <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-950/80 text-amber-300 backdrop-blur-sm border border-amber-400/30">
                {a.category}
              </span>
            </div>

            <div className="p-4 space-y-2 flex-grow">
              <h4 className="text-xs font-bold text-white line-clamp-1">{a.title}</h4>
              <p className="text-[11px] text-slate-400 line-clamp-2">{a.desc}</p>
            </div>

            <div className="p-4 pt-0 flex justify-end">
              <button
                onClick={() => setEditingActivity({ ...a })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
              >
                <Edit3 size={13} />
                <span>এডিট</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Activity Modal */}
      <AnimatePresence>
        {editingActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity size={16} className="text-amber-400" />
                  <span>কার্যক্রম সম্পাদনা: {editingActivity.title}</span>
                </h3>
                <button onClick={() => setEditingActivity(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">শিরোনাম (Title)</label>
                  <input
                    type="text"
                    value={editingActivity.title}
                    onChange={(e) => setEditingActivity({ ...editingActivity, title: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাটাগরি</label>
                  <input
                    type="text"
                    value={editingActivity.category}
                    onChange={(e) => setEditingActivity({ ...editingActivity, category: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ছবি URL (Cover Image URL)</label>
                  <input
                    type="text"
                    value={editingActivity.image}
                    onChange={(e) => setEditingActivity({ ...editingActivity, image: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">বিবরণ (Description)</label>
                  <textarea
                    rows={3}
                    value={editingActivity.desc}
                    onChange={(e) => setEditingActivity({ ...editingActivity, desc: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingActivity(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveActivity}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Save size={14} />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 8. GALLERY TAB
// ==========================================
function CMSGalleryTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [editingImage, setEditingImage] = useState<CMSGalleryMediaItem | null>(null);

  const handleAddNew = () => {
    const newItem: CMSGalleryMediaItem = {
      id: `g-${Date.now()}`,
      url: "/assets/aistudio/dddf__1__7ebcab35.jpg",
      title: "নতুন আলোকচিত্র",
      category: "Parade",
      tags: ["BNCC", "Parade"],
      date: "২০২৬",
      location: "কক্সবাজার সিটি কলেজ",
      isFeatured: true
    };
    setEditingImage(newItem);
  };

  const handleSaveImage = async () => {
    if (!editingImage || !editingImage.url.trim()) return;
    try {
      await cms.saveGalleryItem(editingImage);
      showNotification("গ্যালারি ছবি সংরক্ষিত হয়েছে!");
      setEditingImage(null);
    } catch (e) {
      showNotification("ছবি সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  const handleDeleteImage = async (id: string) => {
    if (confirm("আপনি কি এই ছবিটি গ্যালারি থেকে মুছে ফেলতে চান?")) {
      await cms.deleteGalleryItem(id);
      showNotification("ছবিটি মুছে ফেলা হয়েছে");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ImageIcon size={20} className="text-amber-400" />
            <span>মিডিয়া ও ফটো গ্যালারি ম্যানেজমেন্ট</span>
          </h2>
          <p className="text-xs text-slate-400">
            প্যারেড, ক্যাম্প ও অনুষ্ঠানের আসল ছবি আপলোড ও ম্যানেজ করুন।
          </p>
        </div>

        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20 cursor-pointer"
        >
          <Plus size={15} />
          <span>নতুন ছবি যোগ করুন</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {cms.gallery.map((g) => (
          <div
            key={g.id}
            className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between"
          >
            <div className="relative aspect-video bg-slate-900">
              <img
                src={resolveMediaUrl(g.url || "/assets/aistudio/dddf__1__7ebcab35.jpg")}
                alt={g.title || "Gallery image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = resolveMediaUrl("/assets/aistudio/dddf__1__7ebcab35.jpg");
                }}
              />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[9px] font-bold bg-slate-950/80 text-amber-300">
                {g.category}
              </span>
            </div>

            <div className="p-3 space-y-1">
              <h4 className="text-xs font-bold text-white line-clamp-1">{g.title}</h4>
              <p className="text-[10px] text-slate-500">{g.date} • {g.location}</p>
            </div>

            <div className="p-3 pt-0 flex justify-end gap-1.5 border-t border-slate-900">
              <button
                onClick={() => setEditingImage({ ...g })}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={() => handleDeleteImage(g.id)}
                className="p-1.5 text-rose-400 hover:bg-rose-950/60 rounded-lg text-xs"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Gallery Modal */}
      <AnimatePresence>
        {editingImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white">ছবি তথ্য সম্পাদনা</h3>
                <button onClick={() => setEditingImage(null)} className="text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">ছবির শিরোনাম</label>
                  <input
                    type="text"
                    value={editingImage.title}
                    onChange={(e) => setEditingImage({ ...editingImage, title: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ইমেজ URL</label>
                  <input
                    type="text"
                    value={editingImage.url}
                    onChange={(e) => setEditingImage({ ...editingImage, url: e.target.value })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">ক্যাটাগরি</label>
                  <select
                    value={editingImage.category}
                    onChange={(e) => setEditingImage({ ...editingImage, category: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="Parade">Parade</option>
                    <option value="Training">Training</option>
                    <option value="Social">Social</option>
                    <option value="Ceremony">Ceremony</option>
                    <option value="Cadets">Cadets</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setEditingImage(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  বাতিল
                </button>
                <button
                  onClick={handleSaveImage}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-400/20"
                >
                  <Save size={14} />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// 9. APPEARANCE & BRANDING TAB
// ==========================================
function CMSAppearanceTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [form, setForm] = useState<CMSSiteSettings>({ ...cms.settings });

  const handleSave = async () => {
    try {
      await cms.saveSettings(form);
      showNotification("ব্র্যান্ডিং ও সাইট সেটিংস সফলভাবে আপডেট করা হয়েছে!");
    } catch (e) {
      showNotification("সেটিংস সংরক্ষণ ব্যর্থ হয়েছে", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Palette size={20} className="text-amber-400" />
          <span>থিম, ব্র্যান্ডিং ও যোগাযোগ সেটিংস</span>
        </h2>
        <p className="text-xs text-slate-400">
          প্রাতিষ্ঠানিক নেভি ব্লু ও গোল্ডেন কালার, লোগো, হেল্পলাইন ও সামাজিক যোগাযোগ মাধ্যম কনফিগার করুন।
        </p>
      </div>

      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-5 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-300 font-bold mb-1">সাইটের নাম (Site Title)</label>
            <input
              type="text"
              value={form.siteTitle}
              onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">রেজিমেন্টাল ব্যাজ ও পরিচিতি</label>
            <input
              type="text"
              value={form.regimentInfo}
              onChange={(e) => setForm({ ...form, regimentInfo: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">প্লাটুন নীতিবাক্য (Motto - বাংলা)</label>
            <input
              type="text"
              value={form.motto}
              onChange={(e) => setForm({ ...form, motto: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-sans"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">প্লাটুন নীতিবাক্য (Motto - English)</label>
            <input
              type="text"
              value={form.mottoEn}
              onChange={(e) => setForm({ ...form, mottoEn: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">সিটি কলেজ লোগো URL</label>
            <input
              type="text"
              value={form.collegeLogoUrl}
              onChange={(e) => setForm({ ...form, collegeLogoUrl: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">বিএনসিসি লোগো URL</label>
            <input
              type="text"
              value={form.bnccLogoUrl}
              onChange={(e) => setForm({ ...form, bnccLogoUrl: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">হটলাইন ফোন নম্বর</label>
            <input
              type="text"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">অফিসিয়াল ইমেইল</label>
            <input
              type="text"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-slate-300 font-bold mb-1">প্লাটুন হেডকোয়ার্টার ঠিকানা</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white"
            />
          </div>
        </div>

        {/* System Features Switches */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">সিস্টেম ফিচারস ও মডিউল নিয়ন্ত্রণ</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enrollmentOpen}
                onChange={(e) => setForm({ ...form, enrollmentOpen: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-200">অনলাইন ভর্তি চালু</span>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.offlineFormOpen}
                onChange={(e) => setForm({ ...form, offlineFormOpen: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-200">অফলাইন ফর্ম ডাউনলোড চালু</span>
            </label>

            <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.examPortalOpen}
                onChange={(e) => setForm({ ...form, examPortalOpen: e.target.checked })}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="font-bold text-slate-200">CBT এক্সাম পোর্টাল চালু</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
          >
            <Save size={15} />
            <span>ব্র্যান্ডিং সেটিংস সেভ করুন</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 10. BACKUP & RESTORE TAB
// ==========================================
function CMSBackupTab({ showNotification }: { showNotification: (msg: string, type?: "success" | "error" | "info") => void }) {
  const cms = useCMS();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const backup = await cms.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cbcc_bncc_website_cms_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification("ওয়েবসাইটের সম্পূর্ণ ব্যাকআপ JSON ফাইল ডাউনলোড সম্পন্ন হয়েছে!");
    } catch (e) {
      showNotification("ব্যাকআপ তৈরি করতে সমস্যা হয়েছে", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.version) {
        throw new Error("Invalid backup format");
      }
      await cms.importBackup(parsed);
      showNotification("ব্যাকআপ ফাইল থেকে সফলভাবে সমস্ত ডাটা রিস্টোর করা হয়েছে!");
    } catch (err) {
      showNotification("অবৈধ ব্যাকআপ ফাইল অথবা রিস্টোর ব্যর্থ হয়েছে", "error");
    } finally {
      setIsImporting(false);
    }
  };

  const handleFactoryReset = async () => {
    if (confirm("সতর্কতা: আপনি কি নিশ্চিত যে পুরো ওয়েবসাইটের ডাটা ফ্যাক্টরি ডিফল্টে রিসেট করতে চান? এই প্রক্রিয়া অপরিবর্তনযোগ্য!")) {
      await cms.resetToDefault();
      showNotification("ওয়েবসাইট ফ্যাক্টরি ডিফল্টে রিসেট করা হয়েছে", "info");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Database size={20} className="text-amber-400" />
          <span>ওয়েবসাইট ব্যাকআপ, রিস্টোর ও ফ্যাক্টরি রিসেট</span>
        </h2>
        <p className="text-xs text-slate-400">
          ওয়েবসাইটের সমস্ত টেক্সট, ক্যাডেট ডাটা, নোটিশ ও সেটিংস এক ক্লিকে ব্যাকআপ ফাইল হিসেবে এক্সপোর্ট বা রিস্টোর করুন।
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Export Card */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl w-fit">
              <Download size={22} />
            </div>
            <h3 className="text-sm font-bold text-white">সম্পূর্ণ ব্যাকআপ ডাউনলোড (JSON)</h3>
            <p className="text-xs text-slate-400">
              সমস্ত পেজের টেক্সট, ক্যাডেট প্রোফাইল, নোটিশ, ইন-চার্জ ও সেটিংসের একটি কমপ্লিট স্ন্যাপশট ডাউনলোড করুন।
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <Download size={15} />
            <span>{isExporting ? "এক্সপোর্ট হচ্ছে..." : "ব্যাকআপ ডাউনলোড করুন"}</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl w-fit">
              <Upload size={22} />
            </div>
            <h3 className="text-sm font-bold text-white">ব্যাকআপ ফাইল রিস্টোর (Import JSON)</h3>
            <p className="text-xs text-slate-400">
              পূর্বে ডাউনলোডকৃত JSON ব্যাকআপ ফাইল নির্বাচন করে ওয়েবসাইট আগের অবস্থায় ফিরিয়ে আনুন।
            </p>
          </div>
          <label className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-600/20 text-center">
            <Upload size={15} />
            <span>{isImporting ? "রিস্টোর হচ্ছে..." : "JSON ফাইল আপলোড করুন"}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        </div>

        {/* Reset Card */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl w-fit">
              <RotateCcw size={22} />
            </div>
            <h3 className="text-sm font-bold text-white">ফ্যাক্টরি ডিফল্ট রিসেট</h3>
            <p className="text-xs text-slate-400">
              সকল কাস্টম পরিবর্তন মুছে ফেলে কোডবেসের মূল ডিফল্ট অবস্থায় ওয়েবসাইটকে ফিরিয়ে আনুন।
            </p>
          </div>
          <button
            onClick={handleFactoryReset}
            className="w-full py-2.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-rose-700/50"
          >
            <RotateCcw size={15} />
            <span>ফ্যাক্টরি রিসেট করুন</span>
          </button>
        </div>
      </div>

      <div className="p-5 rounded-3xl bg-slate-950 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database size={16} className="text-emerald-400" />
            <span>Cloud Firestore সম্পূর্ণ ডাটাবেস সিঙ্ক (Sync All CMS & Website Data)</span>
          </h3>
          <p className="text-xs text-slate-400">
            সমস্ত পেজের টেক্সট, ক্যাডেট প্রোফাইল, ইন-চার্জ, নোটিশ, গ্যালারি ও ব্র্যান্ডিং ডিফল্টসমূহ ক্লাউড ডাটাবেসে সংরক্ষণ করুন।
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              const res = await syncAllPortalDataToDatabase({ overwrite: false });
              await cms.refreshAll();
              showNotification(`Cloud Firestore-এ ${res.totalWritten}টি রেকর্ড সফলভাবে সিঙ্ক হয়েছে!`);
            } catch (e: any) {
              showNotification(e?.message || "ডাটাবেস সিঙ্ক ব্যর্থ হয়েছে", "error");
            }
          }}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Database size={15} />
          <span>ডাটাবেসে সব পুশ করুন</span>
        </button>
      </div>
    </div>
  );
}
