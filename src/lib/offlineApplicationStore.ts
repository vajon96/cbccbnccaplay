import { OfflineApplication, OfflineSyncStatus } from "../types/offlineApplication";
import { auth, db, collection, doc, setDoc, deleteDoc, getDocs, query, where } from "../firebase";

const STORAGE_KEY = "bncc_offline_applications_v1";

function buildFirestorePayload(app: OfflineApplication): Record<string, any> {
  const uid = auth.currentUser?.uid || app.ownerUid || "admin";
  return {
    ...app,
    applicationNumber: app.applicationNumber || app.id,
    syncStatus: "Synced" as OfflineSyncStatus,
    ownerUid: uid,
    lastSyncedAt: new Date().toISOString(),
  };
}

function updateLocalRecordSyncState(id: string, syncStatus: OfflineSyncStatus, extra?: Partial<OfflineApplication>) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const all = JSON.parse(raw) as OfflineApplication[];
    const idx = all.findIndex(item => item.id.toUpperCase() === id.toUpperCase());
    if (idx >= 0) {
      all[idx] = { ...all[idx], syncStatus, ...extra };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("offline_apps_changed"));
    }
  } catch {
    // Ignore localStorage update error
  }
}

export async function syncOfflineApplicationToCloud(app: OfflineApplication): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    updateLocalRecordSyncState(app.id, "Pending Sync");
    return false;
  }
  if (!auth.currentUser) {
    updateLocalRecordSyncState(app.id, "Pending Sync", {
      syncError: "Authentication required for cloud sync",
    });
    return false;
  }

  updateLocalRecordSyncState(app.id, "Syncing", { syncError: undefined });
  try {
    const payload = buildFirestorePayload(app);
    await setDoc(doc(db, "offline_applications", app.id.toUpperCase()), payload, { merge: true });
    updateLocalRecordSyncState(app.id, "Synced", {
      applicationNumber: payload.applicationNumber,
      ownerUid: payload.ownerUid,
      lastSyncedAt: payload.lastSyncedAt,
      syncError: undefined,
    });
    return true;
  } catch (err: any) {
    updateLocalRecordSyncState(app.id, "Sync Failed", {
      syncError: err?.message || "Firestore sync failed",
    });
    return false;
  }
}

export async function syncAllPendingOfflineApplications(): Promise<{ synced: number; failed: number }> {
  const all = getOfflineApplications();
  let synced = 0;
  let failed = 0;
  for (const app of all) {
    if (app.syncStatus === "Synced") continue;
    const ok = await syncOfflineApplicationToCloud(app);
    if (ok) synced++;
    else failed++;
  }
  return { synced, failed };
}

export async function fetchAndMergeCloudOfflineApplications(isAdminUser: boolean): Promise<OfflineApplication[]> {
  const localApps = getOfflineApplications();
  if (!auth.currentUser || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return localApps;
  }

  try {
    const ref = collection(db, "offline_applications");
    const q = isAdminUser ? ref : query(ref, where("ownerUid", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    if (snap.empty) return localApps;

    const map = new Map<string, OfflineApplication>();
    localApps.forEach(a => map.set(a.id.toUpperCase(), a));

    snap.docs.forEach(d => {
      const cloudApp = { ...d.data(), id: d.id } as OfflineApplication;
      const key = cloudApp.id.toUpperCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...cloudApp, syncStatus: "Synced" });
      } else if (existing.syncStatus === "Pending Sync" || existing.syncStatus === "Sync Failed") {
        // Keep local unsynced changes unless cloud is strictly newer, flag if conflict exists
        const cloudTime = new Date(cloudApp.updatedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime > localTime) {
          map.set(key, { ...existing, syncStatus: "Requires Review" });
        }
      } else {
        const cloudTime = new Date(cloudApp.updatedAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || 0).getTime();
        if (cloudTime >= localTime) {
          map.set(key, { ...cloudApp, syncStatus: "Synced" });
        }
      }
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("offline_apps_changed"));
    return merged;
  } catch (err) {
    console.warn("Could not fetch cloud offline applications:", err);
    return localApps;
  }
}

const INITIAL_SEED_DATA: OfflineApplication[] = [
  {
    id: "OFF-2026-0001",
    applicationNumber: "OFF-2026-0001",
    syncStatus: "Pending Sync",
    formNumber: "258",
    cadetNumber: "CDT-1042",
    applicationDate: "2026-09-10",
    status: "Uploaded",
    fullNameBangla: "মোঃ তানভীর হাসান",
    fullNameEnglish: "MD. TANVIR HASAN",
    email: "tanvir.hasan@example.com",
    fatherNameBangla: "মোঃ আনোয়ার হোসেন",
    fatherNameEnglish: "MD. ANWAR HOSSAIN",
    fatherName: "MD. ANWAR HOSSAIN",
    motherNameBangla: "সালমা বেগম",
    motherNameEnglish: "SALMA BEGUM",
    motherName: "SALMA BEGUM",
    classDepartment: "দ্বাদশ শ্রেণি / বিজ্ঞান",
    classYear: "HSC 1st Year (Science)",
    classRoll: "1042",
    academicYear: "2026-2027",
    addressPresent: "ঝাউতলা, কক্সবাজার সদর, কক্সবাজার",
    addressPermanent: "ঝাউতলা, কক্সবাজার সদর, কক্সবাজার",
    dob: "2007-04-12",
    religion: "ইসলাম",
    nationality: "বাংলাদেশী",
    heightFeet: "5",
    heightInches: "8",
    weightKg: "62",
    eyesight: "৬/৬",
    chestNormal: "৩২ ইঞ্চি",
    chestExpanded: "৩৪ ইঞ্চি",
    identificationMark: "ডান কানের নিচে তিল",
    previousBnccMember: "না",
    previousBnccRank: "",
    bloodGroup: "B+",
    skills: ["বক্তৃতা", "বিতর্ক", "ফুটবল"],
    ssc: {
      exam: "এসএসসি/সমমান",
      board: "চট্টগ্রাম",
      gpa: "5.00",
      institution: "কক্সবাজার সরকারি উচ্চ বিদ্যালয়",
      passingYear: "2024"
    },
    hsc: {
      exam: "এইচএসসি/সমমান",
      board: "চট্টগ্রাম",
      gpa: "",
      institution: "কক্সবাজার সিটি কলেজ",
      passingYear: "2026"
    },
    studentPhone: "01812345678",
    guardianPhone: "01711223344",
    institution: "কক্সবাজার সিটি কলেজ",
    gender: "Male",
    district: "Cox's Bazar",
    thana: "Sadar",
    studyStatus: "Science",
    isEthnicMinority: false,
    examDate: "2026-10-18",
    examTime: "09:00 AM",
    examVenue: "কক্সবাজার সিটি কলেজ বিএনসিসি হেডকোয়ার্টার্স ও প্যারেড গ্রাউন্ড",
    admitInstructions: "১. মূল মার্কশিট ও অ্যাডমিট কার্ড সাথে আনতে হবে। ২. শারীরিক পরীক্ষার জন্য উপযুক্ত পোশাক পরিধান করতে হবে। ৩. মোবাইল ফোন সম্পূর্ণ নিষিদ্ধ।",
    uploadedFiles: {
      scannedForm: {
        name: "OFF-2026-0001_Scanned_Form.pdf",
        size: 1420500,
        type: "application/pdf",
        dataUrl: "",
        uploadedAt: "2026-09-12T10:30:00Z"
      }
    },
    notes: "Physical copy received by office staff. All certificates verified.",
    formGeneratedDate: "2026-09-10",
    createdAt: "2026-09-10T08:00:00Z",
    updatedAt: "2026-09-12T10:30:00Z"
  },
  {
    id: "OFF-2026-0002",
    applicationNumber: "OFF-2026-0002",
    syncStatus: "Pending Sync",
    formNumber: "258",
    cadetNumber: "CDT-2105",
    applicationDate: "2026-09-11",
    status: "Approved",
    fullNameBangla: "নুসরাত জাহান নীলা",
    fullNameEnglish: "NUSRAT JAHAN NILA",
    email: "nusrat.nila@example.com",
    fatherNameBangla: "আব্দুল মতিন",
    fatherNameEnglish: "ABDUL MOTIN",
    fatherName: "ABDUL MOTIN",
    motherNameBangla: "শাহানা আক্তার",
    motherNameEnglish: "SHAHANA AKTER",
    motherName: "SHAHANA AKTER",
    classDepartment: "একাদশ শ্রেণি / মানবিক",
    classYear: "HSC 1st Year (Humanities)",
    classRoll: "2105",
    academicYear: "2026-2027",
    addressPresent: "কলাতলী রোড, কক্সবাজার",
    addressPermanent: "রামু, কক্সবাজার",
    dob: "2007-09-20",
    religion: "ইসলাম",
    nationality: "বাংলাদেশী",
    heightFeet: "5",
    heightInches: "3",
    weightKg: "51",
    eyesight: "৬/৬",
    chestNormal: "৩০ ইঞ্চি",
    chestExpanded: "৩২ ইঞ্চি",
    identificationMark: "বাম হাতে তিল",
    previousBnccMember: "হ্যাঁ",
    previousBnccRank: "ক্যাডেট",
    bloodGroup: "O+",
    skills: ["গান", "আবৃত্তি", "বিতর্ক"],
    ssc: {
      exam: "এসএসসি/সমমান",
      board: "চট্টগ্রাম",
      gpa: "4.83",
      institution: "কক্সবাজার সরকারি বালিকা উচ্চ বিদ্যালয়",
      passingYear: "2024"
    },
    studentPhone: "01688776655",
    guardianPhone: "01822334455",
    institution: "কক্সবাজার সিটি কলেজ",
    gender: "Female",
    district: "Cox's Bazar",
    thana: "Ramu",
    studyStatus: "Humanities",
    isEthnicMinority: false,
    examDate: "2026-10-18",
    examTime: "09:00 AM",
    examVenue: "কক্সবাজার সিটি কলেজ বিএনসিসি হেডকোয়ার্টার্স ও প্যারেড গ্রাউন্ড",
    admitInstructions: "১. মূল মার্কশিট ও অ্যাডমিট কার্ড সাথে আনতে হবে। ২. শারীরিক পরীক্ষার জন্য উপযুক্ত পোশাক পরিধান করতে হবে। ৩. মোবাইল ফোন সম্পূর্ণ নিষিদ্ধ।",
    uploadedFiles: {
      scannedForm: {
        name: "OFF-2026-0002_Physical_Form.pdf",
        size: 980400,
        type: "application/pdf",
        dataUrl: "",
        uploadedAt: "2026-09-13T11:15:00Z"
      }
    },
    notes: "Admit card issued. Eligible for physical & viva test.",
    formGeneratedDate: "2026-09-11",
    createdAt: "2026-09-11T09:15:00Z",
    updatedAt: "2026-09-14T14:20:00Z"
  }
];

export function getOfflineApplications(): OfflineApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEED_DATA));
      return INITIAL_SEED_DATA;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SEED_DATA;
  } catch (e) {
    console.error("Error reading offline applications from localStorage:", e);
    return INITIAL_SEED_DATA;
  }
}

export function getOfflineApplicationById(id: string): OfflineApplication | undefined {
  const all = getOfflineApplications();
  return all.find(app => app.id.toUpperCase() === id.toUpperCase());
}

export function saveOfflineApplication(app: OfflineApplication): void {
  const all = getOfflineApplications();
  const normalized: OfflineApplication = {
    ...app,
    id: app.id.toUpperCase(),
    applicationNumber: app.applicationNumber || app.id.toUpperCase(),
    ownerUid: app.ownerUid || auth.currentUser?.uid || "admin",
    syncStatus: "Pending Sync",
    createdAt: app.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const index = all.findIndex(item => item.id.toUpperCase() === normalized.id);
  if (index >= 0) {
    all[index] = normalized;
  } else {
    all.unshift(normalized);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("offline_apps_changed"));

  // Trigger non-blocking background cloud sync
  void syncOfflineApplicationToCloud(normalized);
}

export function updateOfflineApplication(id: string, updates: Partial<OfflineApplication>): void {
  const all = getOfflineApplications();
  const index = all.findIndex(item => item.id.toUpperCase() === id.toUpperCase());
  if (index >= 0) {
    const updated: OfflineApplication = {
      ...all[index],
      ...updates,
      applicationNumber: all[index].applicationNumber || all[index].id.toUpperCase(),
      syncStatus: updates.syncStatus || "Pending Sync",
      updatedAt: new Date().toISOString()
    };
    all[index] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("offline_apps_changed"));

    void syncOfflineApplicationToCloud(updated);
  }
}

export function deleteOfflineApplication(id: string): void {
  const all = getOfflineApplications();
  const filtered = all.filter(item => item.id.toUpperCase() !== id.toUpperCase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent("offline_apps_changed"));

  if (auth.currentUser && (typeof navigator === "undefined" || navigator.onLine)) {
    void deleteDoc(doc(db, "offline_applications", id.toUpperCase())).catch(err => {
      console.warn("Could not delete cloud offline application:", err);
    });
  }
}

export function generateNextOfflineId(): string {
  const all = getOfflineApplications();
  const year = new Date().getFullYear();
  let maxSeq = 0;

  all.forEach(app => {
    const parts = app.id.split("-");
    if (parts.length === 3 && parts[0] === "OFF") {
      const seq = parseInt(parts[2], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const padded = nextSeq.toString().padStart(4, "0");
  return `OFF-${year}-${padded}`;
}

export function getBlankOfflineApplication(): OfflineApplication {
  const id = generateNextOfflineId();
  const today = new Date().toISOString().split("T")[0];

  return {
    id,
    formNumber: "258",
    cadetNumber: "",
    applicationDate: today,
    status: "Draft",
    fullNameBangla: "",
    fullNameEnglish: "",
    email: "",
    fatherNameBangla: "",
    fatherNameEnglish: "",
    fatherName: "",
    motherNameBangla: "",
    motherNameEnglish: "",
    motherName: "",
    classDepartment: "",
    classYear: "HSC 1st Year",
    classRoll: "",
    academicYear: "2026-2027",
    addressPresent: "",
    addressPermanent: "",
    dob: "",
    religion: "ইসলাম",
    nationality: "বাংলাদেশী",
    heightFeet: "5",
    heightInches: "6",
    weightKg: "58",
    eyesight: "৬/৬",
    chestNormal: "৩২\"",
    chestExpanded: "৩৪\"",
    identificationMark: "",
    previousBnccMember: "না",
    previousBnccRank: "",
    bloodGroup: "A+",
    skills: [],
    ssc: {
      exam: "এসএসসি/সমমান",
      board: "চট্টগ্রাম",
      gpa: "",
      institution: "",
      passingYear: "2024"
    },
    hsc: {
      exam: "এইচএসসি/সমমান",
      board: "চট্টগ্রাম",
      gpa: "",
      institution: "কক্সবাজার সিটি কলেজ",
      passingYear: "2026"
    },
    studentPhone: "",
    guardianPhone: "",
    institution: "কক্সবাজার সিটি কলেজ",
    gender: "Male",
    district: "Cox's Bazar",
    thana: "Sadar",
    studyStatus: "Science",
    isEthnicMinority: false,
    examDate: "2026-10-18",
    examTime: "09:00 AM",
    examVenue: "কক্সবাজার সিটি কলেজ বিএনসিসি হেডকোয়ার্টার্স ও প্যারেড গ্রাউন্ড",
    admitInstructions: "১. মূল মার্কশিট, শিক্ষাগত সনদ এবং প্রবেশপত্র পরীক্ষার দিন সাথে আনতে হবে। ২. শারীরিক পরীক্ষার জন্য উপযুক্ত সাদা টি-শার্ট ও কেডস পরিধান করতে হবে। ৩. মোবাইল ফোন বা ইলেকট্রনিক ডিভাইস সম্পূর্ণ নিষিদ্ধ।",
    notes: "",
    formGeneratedDate: today,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
