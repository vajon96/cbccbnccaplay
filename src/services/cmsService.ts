/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  db, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  writeBatch,
  reportFirestoreListenerError,
  OperationType
} from "../firebase";
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

const LS_SETTINGS_KEY = "cbcc_cms_settings";
const LS_CONTENT_KEY = "cbcc_cms_content";
const LS_SECTIONS_KEY = "cbcc_cms_sections";
const LS_CADETS_KEY = "cbcc_cms_cadets";
const LS_INCHARGES_KEY = "cbcc_cms_incharges";
const LS_COMMANDER_KEY = "cbcc_cms_commander";
const LS_NOTICES_KEY = "cbcc_cms_notices";
const LS_ACTIVITIES_KEY = "cbcc_cms_activities";
const LS_GALLERY_KEY = "cbcc_cms_gallery";

export function sanitizeCmsDocId(rawId: string, fallbackPrefix: string = "doc"): string {
  const cleaned = String(rawId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) {
    return `${fallbackPrefix}_${Date.now()}`;
  }
  return cleaned.slice(0, 128);
}

export class CMSService {
  private static syncListener: ((error: string | null) => void) | null = null;

  static setSyncListener(listener: ((error: string | null) => void) | null) {
    this.syncListener = listener;
  }

  private static notifySyncOk() {
    this.syncListener?.(null);
  }

  private static notifySyncError(op: string, e: any, path?: string) {
    reportFirestoreListenerError(e, OperationType.WRITE, path || op);
    const reason = e?.code === "permission-denied"
      ? "ক্লাউড সিঙ্ক অনুমতি নেই — গুগল অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন। লোকাল ড্রাফট সংরক্ষিত রয়েছে।"
      : `ক্লাউড সিঙ্ক ব্যর্থ হয়েছে (${op})। লোকাল ড্রাফট সংরক্ষিত রয়েছে।`;
    console.warn(`CMS ${op} Firestore error:`, e);
    this.syncListener?.(reason);
  }

  // 1. Settings (reads system_settings/portal_config and cms_settings/global_config)
  static async getSettings(): Promise<CMSSiteSettings> {
    try {
      const sysSnap = await getDocs(collection(db, "system_settings"));
      if (!sysSnap.empty) {
        const data = sysSnap.docs[0].data() as CMSSiteSettings;
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(data));
        return { ...DEFAULT_CMS_SETTINGS, ...data };
      }
      const snap = await getDocs(collection(db, "cms_settings"));
      if (!snap.empty) {
        const data = snap.docs[0].data() as CMSSiteSettings;
        localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(data));
        return { ...DEFAULT_CMS_SETTINGS, ...data };
      }
    } catch (e) {
      console.warn("CMS getSettings firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_SETTINGS_KEY);
    if (cached) {
      try {
        return { ...DEFAULT_CMS_SETTINGS, ...JSON.parse(cached) };
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_SETTINGS;
  }

  static async saveSettings(settings: CMSSiteSettings): Promise<void> {
    const updated = {
      ...settings,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(updated));
    try {
      await Promise.all([
        setDoc(doc(db, "cms_settings", "global_config"), updated),
        setDoc(doc(db, "system_settings", "portal_config"), updated),
      ]);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveSettings", e);
    }
  }

  // 2. Universal Content Items
  static async getContentItems(): Promise<CMSContentItem[]> {
    try {
      const snap = await getDocs(collection(db, "cms_content"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSContentItem);
        // Merge with defaults so any new code-level defaults remain available
        const map = new Map<string, CMSContentItem>();
        DEFAULT_UNIVERSAL_TEXT_ITEMS.forEach(d => map.set(d.id, d));
        items.forEach(it => map.set(it.id, it));
        const merged = Array.from(map.values());
        localStorage.setItem(LS_CONTENT_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (e) {
      console.warn("CMS getContentItems Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_CONTENT_KEY);
    if (cached) {
      try {
        const items = JSON.parse(cached) as CMSContentItem[];
        const map = new Map<string, CMSContentItem>();
        DEFAULT_UNIVERSAL_TEXT_ITEMS.forEach(d => map.set(d.id, d));
        items.forEach(it => map.set(it.id, it));
        return Array.from(map.values());
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_UNIVERSAL_TEXT_ITEMS;
  }

  static async saveContentItem(item: CMSContentItem): Promise<void> {
    const updated = {
      ...item,
      lastModified: new Date().toISOString()
    };
    // update localStorage
    const current = await this.getContentItems();
    const idx = current.findIndex(c => c.id === item.id);
    if (idx >= 0) {
      current[idx] = updated;
    } else {
      current.push(updated);
    }
    localStorage.setItem(LS_CONTENT_KEY, JSON.stringify(current));

    try {
      const safeId = sanitizeCmsDocId(item.id, "content");
      await setDoc(doc(db, "cms_content", safeId), updated);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveContentItem", e, `cms_content/${item.id}`);
    }
  }

  // 3. Sections
  static async getSections(): Promise<CMSSectionConfig[]> {
    try {
      const snap = await getDocs(collection(db, "cms_sections"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSSectionConfig);
        const map = new Map<string, CMSSectionConfig>();
        DEFAULT_CMS_SECTIONS.forEach(s => map.set(s.id, s));
        items.forEach(s => map.set(s.id, s));
        const list = Array.from(map.values()).sort((a, b) => a.order - b.order);
        localStorage.setItem(LS_SECTIONS_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getSections Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_SECTIONS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_SECTIONS;
  }

  static async saveSection(section: CMSSectionConfig): Promise<void> {
    const sections = await this.getSections();
    const idx = sections.findIndex(s => s.id === section.id);
    if (idx >= 0) sections[idx] = section;
    else sections.push(section);
    localStorage.setItem(LS_SECTIONS_KEY, JSON.stringify(sections));

    try {
      const safeId = sanitizeCmsDocId(section.id, "section");
      await setDoc(doc(db, "cms_sections", safeId), section);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveSection", e, `cms_sections/${section.id}`);
    }
  }

  // 4. Cadets
  static async getCadets(): Promise<CMSCadetProfile[]> {
    try {
      const snap = await getDocs(collection(db, "cms_cadets"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSCadetProfile);
        const map = new Map<string, CMSCadetProfile>();
        DEFAULT_CMS_CADETS.forEach(c => map.set(c.id, c));
        items.forEach(c => map.set(c.id, c));
        const list = Array.from(map.values());
        localStorage.setItem(LS_CADETS_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getCadets Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_CADETS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_CADETS;
  }

  static async saveCadet(cadet: CMSCadetProfile): Promise<void> {
    const cadets = await this.getCadets();
    const idx = cadets.findIndex(c => c.id === cadet.id);
    const updated = {
      ...cadet,
      updatedAt: new Date().toISOString()
    };
    if (idx >= 0) cadets[idx] = updated;
    else cadets.unshift(updated);
    localStorage.setItem(LS_CADETS_KEY, JSON.stringify(cadets));

    try {
      const safeId = sanitizeCmsDocId(cadet.id, "cadet");
      await setDoc(doc(db, "cms_cadets", safeId), updated);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveCadet", e, `cms_cadets/${cadet.id}`);
    }
  }

  static async deleteCadet(id: string): Promise<void> {
    const cadets = await this.getCadets();
    const filtered = cadets.filter(c => c.id !== id);
    localStorage.setItem(LS_CADETS_KEY, JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, "cms_cadets", sanitizeCmsDocId(id, "cadet")));
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("deleteCadet", e, `cms_cadets/${id}`);
    }
  }

  // 5. In-charges & Commander
  static async getIncharges(): Promise<CMSInchargeRecord[]> {
    try {
      const snap = await getDocs(collection(db, "cms_incharges"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSInchargeRecord);
        const map = new Map<string, CMSInchargeRecord>();
        DEFAULT_CMS_INCHARGES.forEach(i => map.set(i.id, i));
        items.forEach(i => map.set(i.id, i));
        const list = Array.from(map.values()).sort((a, b) => a.order - b.order);
        localStorage.setItem(LS_INCHARGES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getIncharges Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_INCHARGES_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_INCHARGES;
  }

  static async saveIncharge(incharge: CMSInchargeRecord): Promise<void> {
    const list = await this.getIncharges();
    const idx = list.findIndex(i => i.id === incharge.id);
    if (idx >= 0) list[idx] = incharge;
    else list.push(incharge);
    localStorage.setItem(LS_INCHARGES_KEY, JSON.stringify(list));

    try {
      await setDoc(doc(db, "cms_incharges", sanitizeCmsDocId(incharge.id, "incharge")), incharge);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveIncharge", e, `cms_incharges/${incharge.id}`);
    }
  }

  static async deleteIncharge(id: string): Promise<void> {
    const list = await this.getIncharges();
    const filtered = list.filter(i => i.id !== id);
    localStorage.setItem(LS_INCHARGES_KEY, JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, "cms_incharges", sanitizeCmsDocId(id, "incharge")));
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("deleteIncharge", e, `cms_incharges/${id}`);
    }
  }

  static async getCommander(): Promise<CMSCommanderProfile> {
    try {
      const snap = await getDocs(collection(db, "cms_commander"));
      if (!snap.empty) {
        const data = snap.docs[0].data() as CMSCommanderProfile;
        localStorage.setItem(LS_COMMANDER_KEY, JSON.stringify(data));
        return { ...DEFAULT_CMS_COMMANDER, ...data };
      }
    } catch (e) {
      console.warn("CMS getCommander Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_COMMANDER_KEY);
    if (cached) {
      try {
        return { ...DEFAULT_CMS_COMMANDER, ...JSON.parse(cached) };
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_COMMANDER;
  }

  static async saveCommander(commander: CMSCommanderProfile): Promise<void> {
    localStorage.setItem(LS_COMMANDER_KEY, JSON.stringify(commander));
    try {
      await setDoc(doc(db, "cms_commander", "commander_profile"), commander);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveCommander", e);
    }
  }

  // 6. Notices
  static async getNotices(): Promise<CMSNoticeItem[]> {
    try {
      const snap = await getDocs(collection(db, "cms_notices"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSNoticeItem);
        const map = new Map<string, CMSNoticeItem>();
        DEFAULT_CMS_NOTICES.forEach(n => map.set(n.id, n));
        items.forEach(n => map.set(n.id, n));
        const list = Array.from(map.values());
        localStorage.setItem(LS_NOTICES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getNotices Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_NOTICES_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_NOTICES;
  }

  static async saveNotice(notice: CMSNoticeItem): Promise<void> {
    const notices = await this.getNotices();
    const idx = notices.findIndex(n => n.id === notice.id);
    if (idx >= 0) notices[idx] = notice;
    else notices.unshift(notice);
    localStorage.setItem(LS_NOTICES_KEY, JSON.stringify(notices));

    try {
      await setDoc(doc(db, "cms_notices", sanitizeCmsDocId(notice.id, "notice")), notice);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveNotice", e, `cms_notices/${notice.id}`);
    }
  }

  static async deleteNotice(id: string): Promise<void> {
    const notices = await this.getNotices();
    const filtered = notices.filter(n => n.id !== id);
    localStorage.setItem(LS_NOTICES_KEY, JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, "cms_notices", sanitizeCmsDocId(id, "notice")));
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("deleteNotice", e, `cms_notices/${id}`);
    }
  }

  // 7. Activities
  static async getActivities(): Promise<CMSActivityItem[]> {
    try {
      const snap = await getDocs(collection(db, "cms_activities"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSActivityItem);
        const map = new Map<string, CMSActivityItem>();
        DEFAULT_CMS_ACTIVITIES.forEach(a => map.set(a.id, a));
        items.forEach(a => map.set(a.id, a));
        const list = Array.from(map.values());
        localStorage.setItem(LS_ACTIVITIES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getActivities Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_ACTIVITIES_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_ACTIVITIES;
  }

  static async saveActivity(activity: CMSActivityItem): Promise<void> {
    const list = await this.getActivities();
    const idx = list.findIndex(a => a.id === activity.id);
    if (idx >= 0) list[idx] = activity;
    else list.push(activity);
    localStorage.setItem(LS_ACTIVITIES_KEY, JSON.stringify(list));

    try {
      await setDoc(doc(db, "cms_activities", sanitizeCmsDocId(activity.id, "activity")), activity);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveActivity", e, `cms_activities/${activity.id}`);
    }
  }

  static async deleteActivity(id: string): Promise<void> {
    const list = await this.getActivities();
    const filtered = list.filter(a => a.id !== id);
    localStorage.setItem(LS_ACTIVITIES_KEY, JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, "cms_activities", sanitizeCmsDocId(id, "activity")));
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("deleteActivity", e, `cms_activities/${id}`);
    }
  }

  // 8. Gallery
  static async getGallery(): Promise<CMSGalleryMediaItem[]> {
    try {
      const snap = await getDocs(collection(db, "cms_gallery"));
      if (!snap.empty) {
        const items = snap.docs.map(d => d.data() as CMSGalleryMediaItem);
        const map = new Map<string, CMSGalleryMediaItem>();
        DEFAULT_CMS_GALLERY.forEach(g => map.set(g.id, g));
        items.forEach(g => map.set(g.id, g));
        const list = Array.from(map.values());
        localStorage.setItem(LS_GALLERY_KEY, JSON.stringify(list));
        return list;
      }
    } catch (e) {
      console.warn("CMS getGallery Firestore fallback:", e);
    }

    const cached = localStorage.getItem(LS_GALLERY_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (err) {
        console.error(err);
      }
    }
    return DEFAULT_CMS_GALLERY;
  }

  static async saveGalleryItem(item: CMSGalleryMediaItem): Promise<void> {
    const list = await this.getGallery();
    const idx = list.findIndex(g => g.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    localStorage.setItem(LS_GALLERY_KEY, JSON.stringify(list));

    try {
      await setDoc(doc(db, "cms_gallery", sanitizeCmsDocId(item.id, "gallery")), item);
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("saveGalleryItem", e, `cms_gallery/${item.id}`);
    }
  }

  static async deleteGalleryItem(id: string): Promise<void> {
    const list = await this.getGallery();
    const filtered = list.filter(g => g.id !== id);
    localStorage.setItem(LS_GALLERY_KEY, JSON.stringify(filtered));

    try {
      await deleteDoc(doc(db, "cms_gallery", sanitizeCmsDocId(id, "gallery")));
      this.notifySyncOk();
    } catch (e) {
      this.notifySyncError("deleteGalleryItem", e, `cms_gallery/${id}`);
    }
  }

  // 9. Full Backup Export & Import
  static async exportBackup(): Promise<CMSBackupData> {
    const [
      settings,
      contentItems,
      sections,
      cadets,
      incharges,
      commander,
      notices,
      activities,
      gallery
    ] = await Promise.all([
      this.getSettings(),
      this.getContentItems(),
      this.getSections(),
      this.getCadets(),
      this.getIncharges(),
      this.getCommander(),
      this.getNotices(),
      this.getActivities(),
      this.getGallery()
    ]);

    return {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      exportedBy: "Super Admin",
      settings,
      contentItems,
      sections,
      cadets,
      incharges,
      commander,
      notices,
      activities,
      gallery
    };
  }

  static async importBackup(backup: CMSBackupData): Promise<void> {
    if (backup.settings) await this.saveSettings(backup.settings);
    if (backup.commander) await this.saveCommander(backup.commander);

    if (Array.isArray(backup.contentItems)) {
      localStorage.setItem(LS_CONTENT_KEY, JSON.stringify(backup.contentItems));
      for (const item of backup.contentItems) {
        await this.saveContentItem(item);
      }
    }

    if (Array.isArray(backup.sections)) {
      localStorage.setItem(LS_SECTIONS_KEY, JSON.stringify(backup.sections));
      for (const sec of backup.sections) {
        await this.saveSection(sec);
      }
    }

    if (Array.isArray(backup.cadets)) {
      localStorage.setItem(LS_CADETS_KEY, JSON.stringify(backup.cadets));
      for (const cadet of backup.cadets) {
        await this.saveCadet(cadet);
      }
    }

    if (Array.isArray(backup.incharges)) {
      localStorage.setItem(LS_INCHARGES_KEY, JSON.stringify(backup.incharges));
      for (const inc of backup.incharges) {
        await this.saveIncharge(inc);
      }
    }

    if (Array.isArray(backup.notices)) {
      localStorage.setItem(LS_NOTICES_KEY, JSON.stringify(backup.notices));
      for (const notc of backup.notices) {
        await this.saveNotice(notc);
      }
    }

    if (Array.isArray(backup.activities)) {
      localStorage.setItem(LS_ACTIVITIES_KEY, JSON.stringify(backup.activities));
      for (const act of backup.activities) {
        await this.saveActivity(act);
      }
    }

    if (Array.isArray(backup.gallery)) {
      localStorage.setItem(LS_GALLERY_KEY, JSON.stringify(backup.gallery));
      for (const gal of backup.gallery) {
        await this.saveGalleryItem(gal);
      }
    }
  }

  static async seedAllDefaultsToFirestore(
    overwrite: boolean = false
  ): Promise<{ seededCount: number; collections: Record<string, number> }> {
    const nowIso = new Date().toISOString();
    const collectionsReport: Record<string, number> = {};
    const pendingWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    const queueCollection = async <T extends Record<string, any>>(
      collectionName: string,
      items: Array<{ docId: string; payload: T }>
    ) => {
      let existingIds = new Set<string>();
      if (!overwrite) {
        const snap = await getDocs(collection(db, collectionName));
        existingIds = new Set(snap.docs.map((d) => d.id));
      }
      let added = 0;
      items.forEach(({ docId, payload }) => {
        const safeId = sanitizeCmsDocId(docId, collectionName);
        if (overwrite || !existingIds.has(safeId)) {
          pendingWrites.push({ ref: doc(db, collectionName, safeId), data: payload });
          added += 1;
        }
      });
      collectionsReport[collectionName] = added;
    };

    const settingsPayload = { ...DEFAULT_CMS_SETTINGS, lastUpdated: nowIso };
    await Promise.all([
      queueCollection("system_settings", [{ docId: "portal_config", payload: settingsPayload }]),
      queueCollection("cms_settings", [{ docId: "global_config", payload: settingsPayload }]),
      queueCollection("cms_commander", [{ docId: "commander_profile", payload: DEFAULT_CMS_COMMANDER }]),
      queueCollection(
        "cms_content",
        DEFAULT_UNIVERSAL_TEXT_ITEMS.map((item) => ({ docId: item.id, payload: item }))
      ),
      queueCollection(
        "cms_sections",
        DEFAULT_CMS_SECTIONS.map((sec) => ({ docId: sec.id, payload: sec }))
      ),
      queueCollection(
        "cms_cadets",
        DEFAULT_CMS_CADETS.map((c) => ({ docId: c.id, payload: c }))
      ),
      queueCollection(
        "cms_incharges",
        DEFAULT_CMS_INCHARGES.map((i) => ({ docId: i.id, payload: i }))
      ),
      queueCollection(
        "cms_notices",
        DEFAULT_CMS_NOTICES.map((n) => ({ docId: n.id, payload: n }))
      ),
      queueCollection(
        "cms_activities",
        DEFAULT_CMS_ACTIVITIES.map((a) => ({ docId: a.id, payload: a }))
      ),
      queueCollection(
        "cms_gallery",
        DEFAULT_CMS_GALLERY.map((g) => ({ docId: g.id, payload: g }))
      ),
    ]);

    const CHUNK_SIZE = 350;
    for (let i = 0; i < pendingWrites.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = pendingWrites.slice(i, i + CHUNK_SIZE);
      chunk.forEach(({ ref, data }) => {
        batch.set(ref, data, { merge: true });
      });
      await batch.commit();
    }

    this.notifySyncOk();
    return { seededCount: pendingWrites.length, collections: collectionsReport };
  }

  static async resetToDefault(): Promise<void> {
    localStorage.removeItem(LS_SETTINGS_KEY);
    localStorage.removeItem(LS_CONTENT_KEY);
    localStorage.removeItem(LS_SECTIONS_KEY);
    localStorage.removeItem(LS_CADETS_KEY);
    localStorage.removeItem(LS_INCHARGES_KEY);
    localStorage.removeItem(LS_COMMANDER_KEY);
    localStorage.removeItem(LS_NOTICES_KEY);
    localStorage.removeItem(LS_ACTIVITIES_KEY);
    localStorage.removeItem(LS_GALLERY_KEY);

    try {
      await this.seedAllDefaultsToFirestore(true);
    } catch (e) {
      this.notifySyncError("resetToDefault", e, "cms_settings/global_config");
    }
  }
}
