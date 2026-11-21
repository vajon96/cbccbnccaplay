/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { 
  CMSContentItem, 
  CMSSectionConfig, 
  CMSCadetProfile, 
  CMSInchargeRecord, 
  CMSCommanderProfile, 
  CMSNoticeItem, 
  CMSActivityItem, 
  CMSGalleryMediaItem, 
  CMSSiteSettings, 
  CMSBackupData 
} from "../types/cms";
import { CMSService } from "../services/cmsService";
import { 
  DEFAULT_CMS_SETTINGS, 
  DEFAULT_UNIVERSAL_TEXT_ITEMS, 
  DEFAULT_CMS_SECTIONS, 
  DEFAULT_CMS_CADETS, 
  DEFAULT_CMS_INCHARGES, 
  DEFAULT_CMS_COMMANDER, 
  DEFAULT_CMS_NOTICES, 
  DEFAULT_CMS_ACTIVITIES, 
  DEFAULT_CMS_GALLERY 
} from "../data/cmsDefaults";

interface CMSContextType {
  loading: boolean;
  syncError: string | null;
  clearSyncError: () => void;
  settings: CMSSiteSettings;
  contentItems: CMSContentItem[];
  sections: CMSSectionConfig[];
  cadets: CMSCadetProfile[];
  incharges: CMSInchargeRecord[];
  commander: CMSCommanderProfile;
  notices: CMSNoticeItem[];
  activities: CMSActivityItem[];
  gallery: CMSGalleryMediaItem[];
  
  // Fast helper for UI components
  getText: (id: string, defaultValue?: string, lang?: "bn" | "en") => string;
  getContentItem: (id: string) => CMSContentItem | undefined;

  // Actions
  saveContentItem: (item: CMSContentItem) => Promise<void>;
  saveSettings: (settings: CMSSiteSettings) => Promise<void>;
  saveSection: (section: CMSSectionConfig) => Promise<void>;
  saveCadet: (cadet: CMSCadetProfile) => Promise<void>;
  deleteCadet: (id: string) => Promise<void>;
  saveIncharge: (incharge: CMSInchargeRecord) => Promise<void>;
  deleteIncharge: (id: string) => Promise<void>;
  saveCommander: (commander: CMSCommanderProfile) => Promise<void>;
  saveNotice: (notice: CMSNoticeItem) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
  saveActivity: (activity: CMSActivityItem) => Promise<void>;
  deleteActivity: (id: string) => Promise<void>;
  saveGalleryItem: (item: CMSGalleryMediaItem) => Promise<void>;
  deleteGalleryItem: (id: string) => Promise<void>;
  exportBackup: () => Promise<CMSBackupData>;
  importBackup: (backup: CMSBackupData) => Promise<void>;
  resetToDefault: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const CMSContext = createContext<CMSContextType | null>(null);

export const CMSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CMSSiteSettings>(DEFAULT_CMS_SETTINGS);
  const [contentItems, setContentItems] = useState<CMSContentItem[]>(DEFAULT_UNIVERSAL_TEXT_ITEMS);
  const [sections, setSections] = useState<CMSSectionConfig[]>(DEFAULT_CMS_SECTIONS);
  const [cadets, setCadets] = useState<CMSCadetProfile[]>(DEFAULT_CMS_CADETS);
  const [incharges, setIncharges] = useState<CMSInchargeRecord[]>(DEFAULT_CMS_INCHARGES);
  const [commander, setCommander] = useState<CMSCommanderProfile>(DEFAULT_CMS_COMMANDER);
  const [notices, setNotices] = useState<CMSNoticeItem[]>(DEFAULT_CMS_NOTICES);
  const [activities, setActivities] = useState<CMSActivityItem[]>(DEFAULT_CMS_ACTIVITIES);
  const [gallery, setGallery] = useState<CMSGalleryMediaItem[]>(DEFAULT_CMS_GALLERY);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  useEffect(() => {
    CMSService.setSyncListener((err) => setSyncError(err));
    return () => CMSService.setSyncListener(null);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [
        s,
        ci,
        sec,
        cad,
        inc,
        cmd,
        notc,
        act,
        gal
      ] = await Promise.all([
        CMSService.getSettings(),
        CMSService.getContentItems(),
        CMSService.getSections(),
        CMSService.getCadets(),
        CMSService.getIncharges(),
        CMSService.getCommander(),
        CMSService.getNotices(),
        CMSService.getActivities(),
        CMSService.getGallery()
      ]);

      if (s) setSettings(s);
      if (ci && ci.length) setContentItems(ci);
      if (sec && sec.length) setSections(sec);
      if (cad && cad.length) setCadets(cad);
      if (inc && inc.length) setIncharges(inc);
      if (cmd) setCommander(cmd);
      if (notc && notc.length) setNotices(notc);
      if (act && act.length) setActivities(act);
      if (gal && gal.length) setGallery(gal);
    } catch (e) {
      console.warn("CMS initialization fallback:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Index text items by id for O(1) lookup
  const contentMap = useMemo(() => {
    const map = new Map<string, CMSContentItem>();
    contentItems.forEach(item => {
      map.set(item.id, item);
    });
    return map;
  }, [contentItems]);

  const getContentItem = useCallback((id: string) => {
    return contentMap.get(id);
  }, [contentMap]);

  const getText = useCallback((id: string, defaultValue = "", lang: "bn" | "en" = "bn"): string => {
    const item = contentMap.get(id);
    if (!item) return defaultValue;
    if (lang === "en" && item.contentEn) {
      return item.contentEn;
    }
    return item.content || item.defaultValue || defaultValue;
  }, [contentMap]);

  // Mutations
  const saveContentItem = async (item: CMSContentItem) => {
    setContentItems(prev => {
      const idx = prev.findIndex(p => p.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [...prev, item];
    });
    await CMSService.saveContentItem(item);
  };

  const saveSettings = async (newSettings: CMSSiteSettings) => {
    setSettings(newSettings);
    await CMSService.saveSettings(newSettings);
  };

  const saveSection = async (section: CMSSectionConfig) => {
    setSections(prev => {
      const idx = prev.findIndex(p => p.id === section.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = section;
        return copy;
      }
      return [...prev, section];
    });
    await CMSService.saveSection(section);
  };

  const saveCadet = async (cadet: CMSCadetProfile) => {
    setCadets(prev => {
      const idx = prev.findIndex(c => c.id === cadet.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = cadet;
        return copy;
      }
      return [cadet, ...prev];
    });
    await CMSService.saveCadet(cadet);
  };

  const deleteCadet = async (id: string) => {
    setCadets(prev => prev.filter(c => c.id !== id));
    await CMSService.deleteCadet(id);
  };

  const saveIncharge = async (incharge: CMSInchargeRecord) => {
    setIncharges(prev => {
      const idx = prev.findIndex(i => i.id === incharge.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = incharge;
        return copy;
      }
      return [...prev, incharge];
    });
    await CMSService.saveIncharge(incharge);
  };

  const deleteIncharge = async (id: string) => {
    setIncharges(prev => prev.filter(i => i.id !== id));
    await CMSService.deleteIncharge(id);
  };

  const saveCommander = async (newCommander: CMSCommanderProfile) => {
    setCommander(newCommander);
    await CMSService.saveCommander(newCommander);
  };

  const saveNotice = async (notice: CMSNoticeItem) => {
    setNotices(prev => {
      const idx = prev.findIndex(n => n.id === notice.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = notice;
        return copy;
      }
      return [notice, ...prev];
    });
    await CMSService.saveNotice(notice);
  };

  const deleteNotice = async (id: string) => {
    setNotices(prev => prev.filter(n => n.id !== id));
    await CMSService.deleteNotice(id);
  };

  const saveActivity = async (activity: CMSActivityItem) => {
    setActivities(prev => {
      const idx = prev.findIndex(a => a.id === activity.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = activity;
        return copy;
      }
      return [...prev, activity];
    });
    await CMSService.saveActivity(activity);
  };

  const deleteActivity = async (id: string) => {
    setActivities(prev => prev.filter(a => a.id !== id));
    await CMSService.deleteActivity(id);
  };

  const saveGalleryItem = async (item: CMSGalleryMediaItem) => {
    setGallery(prev => {
      const idx = prev.findIndex(g => g.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
    await CMSService.saveGalleryItem(item);
  };

  const deleteGalleryItem = async (id: string) => {
    setGallery(prev => prev.filter(g => g.id !== id));
    await CMSService.deleteGalleryItem(id);
  };

  const exportBackup = async () => {
    return await CMSService.exportBackup();
  };

  const importBackup = async (backup: CMSBackupData) => {
    await CMSService.importBackup(backup);
    await refreshAll();
  };

  const resetToDefault = async () => {
    await CMSService.resetToDefault();
    setSettings(DEFAULT_CMS_SETTINGS);
    setContentItems(DEFAULT_UNIVERSAL_TEXT_ITEMS);
    setSections(DEFAULT_CMS_SECTIONS);
    setCadets(DEFAULT_CMS_CADETS);
    setIncharges(DEFAULT_CMS_INCHARGES);
    setCommander(DEFAULT_CMS_COMMANDER);
    setNotices(DEFAULT_CMS_NOTICES);
    setActivities(DEFAULT_CMS_ACTIVITIES);
    setGallery(DEFAULT_CMS_GALLERY);
  };

  const value = {
    loading,
    syncError,
    clearSyncError,
    settings,
    contentItems,
    sections,
    cadets,
    incharges,
    commander,
    notices,
    activities,
    gallery,
    getText,
    getContentItem,
    saveContentItem,
    saveSettings,
    saveSection,
    saveCadet,
    deleteCadet,
    saveIncharge,
    deleteIncharge,
    saveCommander,
    saveNotice,
    deleteNotice,
    saveActivity,
    deleteActivity,
    saveGalleryItem,
    deleteGalleryItem,
    exportBackup,
    importBackup,
    resetToDefault,
    refreshAll
  };

  return <CMSContext.Provider value={value}>{children}</CMSContext.Provider>;
};

export function useCMS(): CMSContextType {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error("useCMS must be used within a CMSProvider");
  }
  return context;
}
