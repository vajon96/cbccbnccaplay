/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  Timestamp,
  reportFirestoreListenerError,
  OperationType,
} from "../firebase";
import { getServerAuthHeaders } from "../lib/auth";
import { apiFetch, assetUrl } from "../lib/api";
import { CMSService, sanitizeCmsDocId } from "./cmsService";
import { seedDefaultQuestionsIfEmpty } from "./examService";
import { DEFAULT_GUIDE_DATA } from "../components/modular/AIGuideManager";
import { getOfflineApplications } from "../lib/offlineApplicationStore";

export interface DatabaseSyncResult {
  syncedAt: string;
  totalWritten: number;
  collections: Record<string, number>;
  warnings: string[];
}

export interface CollectionStat {
  collection: string;
  label: string;
  count: number;
}

export const MONITORED_DB_COLLECTIONS: Array<{ name: string; label: string }> = [
  { name: "system_settings", label: "System Settings" },
  { name: "cms_settings", label: "CMS Settings" },
  { name: "cms_commander", label: "Commander Profile" },
  { name: "cms_content", label: "CMS Text Content" },
  { name: "cms_sections", label: "CMS Sections" },
  { name: "cms_cadets", label: "CMS Cadets" },
  { name: "cms_incharges", label: "CMS In-Charges" },
  { name: "cms_notices", label: "CMS Notices" },
  { name: "cms_activities", label: "CMS Activities" },
  { name: "cms_gallery", label: "CMS Gallery" },
  { name: "guides", label: "Admission Guides" },
  { name: "guide_settings", label: "Guide Settings" },
  { name: "circulars", label: "Circulars" },
  { name: "circular_settings", label: "Circular Settings" },
  { name: "question_bank", label: "Exam Questions" },
  { name: "exams", label: "Exams" },
  { name: "exam_settings", label: "Exam Settings" },
  { name: "media_assets", label: "Media Assets" },
  { name: "offline_applications", label: "Offline Apps" },
  { name: "applicants", label: "Applicants" },
  { name: "admissions", label: "Admissions" },
  { name: "contact_messages", label: "Contact Inquiries" },
  { name: "messages", label: "Platoon Messages" },
  { name: "users", label: "Users (UID)" },
  { name: "admins", label: "Admins" },
  { name: "notifications", label: "Notifications" },
  { name: "counters", label: "ID Counters" },
];

async function commitInChunks(
  writes: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }>
): Promise<void> {
  const CHUNK_SIZE = 350;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    const chunk = writes.slice(i, i + CHUNK_SIZE);
    chunk.forEach(({ ref, data }) => {
      batch.set(ref, data, { merge: true });
    });
    await batch.commit();
  }
}

export async function getDatabaseCollectionCounts(): Promise<CollectionStat[]> {
  if (!auth.currentUser) return [];

  const results = await Promise.all(
    MONITORED_DB_COLLECTIONS.map(async (item) => {
      try {
        const snap = await getDocs(collection(db, item.name));
        return {
          collection: item.name,
          label: item.label,
          count: snap.size,
        };
      } catch {
        return {
          collection: item.name,
          label: item.label,
          count: -1,
        };
      }
    })
  );
  return results;
}

function safeTimestamp(val: any): Timestamp {
  if (val instanceof Timestamp) return val;
  if (typeof val === "number" && Number.isFinite(val) && val > 0) {
    return Timestamp.fromMillis(val);
  }
  if (val) {
    const parsed = new Date(val);
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }
  return Timestamp.now();
}

export async function isPortalDatabaseSeeded(): Promise<boolean> {
  if (!auth.currentUser) return true;
  try {
    const [sysSnap, contentSnap, mediaSnap, examSettingSnap] = await Promise.all([
      getDoc(doc(db, "system_settings", "portal_config")),
      getDocs(collection(db, "cms_content")),
      getDocs(collection(db, "media_assets")),
      getDoc(doc(db, "exam_settings", "global")),
    ]);
    return (
      sysSnap.exists() &&
      !contentSnap.empty &&
      !mediaSnap.empty &&
      examSettingSnap.exists()
    );
  } catch {
    return false;
  }
}

export async function syncAllPortalDataToDatabase(options?: {
  overwrite?: boolean;
  actorId?: string;
  onProgress?: (step: string) => void;
}): Promise<DatabaseSyncResult> {
  if (!auth.currentUser) {
    throw new Error("Firebase Admin authentication is required to sync data to Cloud Firestore.");
  }

  const overwrite = Boolean(options?.overwrite);
  const actorId = options?.actorId || auth.currentUser.email || auth.currentUser.uid;
  const onProgress = options?.onProgress;
  const collections: Record<string, number> = {};
  const warnings: string[] = [];
  let totalWritten = 0;

  // 1. Seed all CMS collections & system_settings
  onProgress?.("Syncing Website CMS & System Settings...");
  try {
    const cmsRes = await CMSService.seedAllDefaultsToFirestore(overwrite);
    Object.assign(collections, cmsRes.collections);
    totalWritten += cmsRes.seededCount;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "cms_settings");
    warnings.push(`CMS sync warning: ${err?.message || "Permission or network error"}`);
  }

  // 2. Seed Guides, Guide Settings & Circular Settings
  onProgress?.("Syncing Guides & Circular Configurations...");
  try {
    const guideWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];
    const nowTs = Timestamp.now();

    const guideSettingsSnap = await getDocs(collection(db, "guide_settings"));
    if (overwrite || guideSettingsSnap.empty) {
      guideWrites.push({
        ref: doc(db, "guide_settings", "public_guide"),
        data: { key: "public_guide", value: true, updatedAt: nowTs },
      });
      collections["guide_settings"] = 1;
    } else {
      collections["guide_settings"] = 0;
    }

    const guidesSnap = await getDocs(collection(db, "guides"));
    const existingGuideIds = new Set(guidesSnap.docs.map((d) => d.id));
    let guideAdded = 0;
    if (overwrite || !existingGuideIds.has("active_guide")) {
      guideWrites.push({
        ref: doc(db, "guides", "active_guide"),
        data: {
          ...DEFAULT_GUIDE_DATA,
          isActive: true,
          createdAt: nowTs,
          updatedAt: nowTs,
          updatedBy: actorId,
        },
      });
      guideAdded++;
    }
    if (overwrite || !existingGuideIds.has("default_guide_2026")) {
      guideWrites.push({
        ref: doc(db, "guides", "default_guide_2026"),
        data: {
          ...DEFAULT_GUIDE_DATA,
          isActive: true,
          createdAt: nowTs,
          updatedAt: nowTs,
          updatedBy: actorId,
        },
      });
      guideAdded++;
    }
    collections["guides"] = guideAdded;

    const circSettingsSnap = await getDocs(collection(db, "circular_settings"));
    if (overwrite || circSettingsSnap.empty) {
      guideWrites.push({
        ref: doc(db, "circular_settings", "public_access"),
        data: { key: "public_access", value: true, updatedAt: nowTs },
      });
      collections["circular_settings"] = 1;
    } else {
      collections["circular_settings"] = 0;
    }

    if (guideWrites.length > 0) {
      await commitInChunks(guideWrites);
      totalWritten += guideWrites.length;
    }
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "guides");
    warnings.push(`Guides/Circular settings warning: ${err?.message || "Skipped"}`);
  }

  // 3. Seed Exam Settings, Question Bank & Server Exams
  onProgress?.("Syncing Exam Settings, Questions & Assessments...");
  try {
    const examSettingsRef = doc(db, "exam_settings", "global");
    const examSettingsSnap = await getDoc(examSettingsRef);
    if (overwrite || !examSettingsSnap.exists()) {
      await setDoc(
        examSettingsRef,
        {
          id: "global",
          defaultDurationMinutes: 60,
          defaultPassPercentage: 40,
          enableNegativeMarkingDefault: false,
          defaultWrongPenalty: 0.25,
          allowStudentReviewAnswers: false,
          showLeaderboardToStudents: true,
          autoSubmitOnTimeExpiry: true,
          preventTabSwitching: false,
          updatedAt: new Date().toISOString(),
          updatedBy: actorId,
        },
        { merge: true }
      );
      collections["exam_settings"] = 1;
      totalWritten += 1;
    } else {
      collections["exam_settings"] = 0;
    }

    const qSnapBefore = await getDocs(collection(db, "question_bank"));
    const existingQIds = new Set(qSnapBefore.docs.map((d) => d.id));
    if (qSnapBefore.empty) {
      await seedDefaultQuestionsIfEmpty(actorId);
    }

    const headers = await getServerAuthHeaders({ "Content-Type": "application/json" });
    const examWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];
    let qAdded = 0;
    let exAdded = 0;

    try {
      const qRes = await apiFetch("/api/exam/questions", { headers, credentials: "include" });
      if (qRes.ok) {
        const qJson = await qRes.json();
        const serverQuestions = Array.isArray(qJson?.questions) ? qJson.questions : [];
        serverQuestions.forEach((q: any) => {
          const safeId = sanitizeCmsDocId(String(q.id || ""), "q");
          if (overwrite || !existingQIds.has(safeId)) {
            examWrites.push({
              ref: doc(db, "question_bank", safeId),
              data: { ...q, id: safeId },
            });
            qAdded++;
          }
        });
      }
    } catch {
      // Optional server endpoint parity
    }

    try {
      const exSnap = await getDocs(collection(db, "exams"));
      const existingExIds = new Set(exSnap.docs.map((d) => d.id));
      const exRes = await apiFetch("/api/exam/exams", { headers, credentials: "include" });
      if (exRes.ok) {
        const exJson = await exRes.json();
        const serverExams = Array.isArray(exJson?.exams) ? exJson.exams : [];
        serverExams.forEach((ex: any) => {
          const safeId = sanitizeCmsDocId(String(ex.id || ""), "exam");
          if (overwrite || !existingExIds.has(safeId)) {
            examWrites.push({
              ref: doc(db, "exams", safeId),
              data: { ...ex, id: safeId },
            });
            exAdded++;
          }
        });
      }
    } catch {
      // Optional server endpoint parity
    }

    if (examWrites.length > 0) {
      await commitInChunks(examWrites);
      totalWritten += examWrites.length;
    }

    const qSnapAfter = await getDocs(collection(db, "question_bank"));
    collections["question_bank"] = Math.max(qAdded, qSnapAfter.size - qSnapBefore.size);
    collections["exams"] = exAdded;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "question_bank");
    warnings.push(`Exam sync warning: ${err?.message || "Skipped"}`);
  }

  // 4. Sync Media Assets (public/assets-manifest.json + /api/media/list)
  onProgress?.("Syncing Media Assets Catalog to Firestore...");
  try {
    const existingMediaSnap = await getDocs(collection(db, "media_assets"));
    const existingMediaIds = new Set(existingMediaSnap.docs.map((d) => d.id));
    const mediaMap = new Map<string, Record<string, any>>();

    try {
      const manifestRes = await fetch(assetUrl("/assets-manifest.json"));
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        const items = Array.isArray(manifest?.items) ? manifest.items : [];
        items.forEach((item: any) => {
          if (!item?.id) return;
          const safeId = sanitizeCmsDocId(item.id, "pub");
          mediaMap.set(safeId, {
            id: safeId,
            fileName: String(item.fileName || safeId),
            storedFileName: String(item.storedFileName || item.fileName || ""),
            title: String(item.title || item.fileName || "Media Asset"),
            altText: String(item.altText || item.title || ""),
            description: String(item.description || ""),
            mimeType: String(item.mimeType || "application/octet-stream"),
            sizeBytes: Number(item.sizeBytes || 0),
            category: String(item.category || "General"),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
            visibility: item.visibility === "private" ? "private" : "public",
            storageLocation: String(item.storageLocation || "public_assets"),
            storagePath: String(item.storagePath || ""),
            url: String(item.url || ""),
            isPrivateCandidateAsset: Boolean(item.isPrivateCandidateAsset),
            uploadedBy: String(item.uploadedBy || "system"),
            createdAt: String(item.createdAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || new Date().toISOString()),
          });
        });
      }
    } catch {
      // Manifest fetch fallback
    }

    try {
      const headers = await getServerAuthHeaders();
      const mediaListRes = await apiFetch("/api/media/list", { headers, credentials: "include" });
      if (mediaListRes.ok) {
        const listJson = await mediaListRes.json();
        const items = Array.isArray(listJson?.items) ? listJson.items : [];
        items.forEach((item: any) => {
          if (!item?.id) return;
          const safeId = sanitizeCmsDocId(item.id, "med");
          mediaMap.set(safeId, {
            id: safeId,
            fileName: String(item.fileName || safeId),
            storedFileName: String(item.storedFileName || item.fileName || ""),
            title: String(item.title || item.fileName || "Media Asset"),
            altText: String(item.altText || item.title || ""),
            description: String(item.description || ""),
            mimeType: String(item.mimeType || "application/octet-stream"),
            sizeBytes: Number(item.sizeBytes || 0),
            category: String(item.category || "General"),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
            visibility: item.visibility === "private" ? "private" : "public",
            storageLocation: String(item.storageLocation || "local_vault"),
            storagePath: String(item.storagePath || ""),
            url: String(item.url || ""),
            isPrivateCandidateAsset: Boolean(item.isPrivateCandidateAsset),
            uploadedBy: String(item.uploadedBy || "admin"),
            createdAt: String(item.createdAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || new Date().toISOString()),
          });
        });
      }
    } catch {
      // Optional vault endpoint
    }

    const mediaWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];
    mediaMap.forEach((payload, safeId) => {
      if (overwrite || !existingMediaIds.has(safeId)) {
        mediaWrites.push({
          ref: doc(db, "media_assets", safeId),
          data: payload,
        });
      }
    });

    if (mediaWrites.length > 0) {
      await commitInChunks(mediaWrites);
      totalWritten += mediaWrites.length;
    }
    collections["media_assets"] = mediaWrites.length;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "media_assets");
    warnings.push(`Media catalog sync warning: ${err?.message || "Skipped"}`);
  }

  // 5. Sync Offline Applications
  onProgress?.("Syncing Offline Applications...");
  try {
    const existingOfflineSnap = await getDocs(collection(db, "offline_applications"));
    const existingOfflineIds = new Set(existingOfflineSnap.docs.map((d) => d.id));
    const localOfflineApps = getOfflineApplications();
    const uid = auth.currentUser.uid;
    const offlineWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    localOfflineApps.forEach((app) => {
      const safeId = sanitizeCmsDocId(String(app.id || "").toUpperCase(), "OFF");
      if (overwrite || !existingOfflineIds.has(safeId)) {
        offlineWrites.push({
          ref: doc(db, "offline_applications", safeId),
          data: {
            ...app,
            id: safeId,
            applicationNumber: app.applicationNumber || safeId,
            syncStatus: "Synced",
            ownerUid: app.ownerUid || uid,
            lastSyncedAt: new Date().toISOString(),
          },
        });
      }
    });

    if (offlineWrites.length > 0) {
      await commitInChunks(offlineWrites);
      totalWritten += offlineWrites.length;
    }
    collections["offline_applications"] = offlineWrites.length;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "offline_applications");
    warnings.push(`Offline applications sync warning: ${err?.message || "Skipped"}`);
  }

  // 6. Server -> Firestore Parity for Applicants, Admissions, QR Cards & Counters
  onProgress?.("Syncing Server Records (Applicants, Admissions, Inquiries, Messages)...");
  try {
    const headers = await getServerAuthHeaders();
    const [existingApplicantsSnap, existingAdmissionsSnap, existingQrSnap, existingCounterSnap] = await Promise.all([
      getDocs(collection(db, "applicants")),
      getDocs(collection(db, "admissions")),
      getDocs(collection(db, "public_qr_cards")).catch(() => ({ docs: [] as any[] })),
      getDoc(doc(db, "counters", "applicant_id")),
    ]);

    const existingApplicantIds = new Set(existingApplicantsSnap.docs.map((d) => d.id));
    const existingAdmissionIds = new Set(existingAdmissionsSnap.docs.map((d) => d.id));
    const existingQrIds = new Set(existingQrSnap.docs.map((d: any) => d.id));

    let maxNumericId = existingCounterSnap.exists()
      ? Number(existingCounterSnap.data()?.currentId || 1110)
      : 1110;
    existingApplicantsSnap.docs.forEach((d) => {
      if (/^\d+$/.test(d.id)) {
        const n = Number(d.id);
        if (n >= 1111 && n < 1000000 && n > maxNumericId) {
          maxNumericId = n;
        }
      }
    });

    const parityWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];
    let appAdded = 0;
    let admAdded = 0;

    try {
      const appsRes = await apiFetch("/api/applications", { headers, credentials: "include" });
      if (appsRes.ok) {
        const appsJson = await appsRes.json();
        const serverApps = Array.isArray(appsJson?.applications) ? appsJson.applications : [];
        serverApps.forEach((app: any) => {
          const safeId = sanitizeCmsDocId(String(app.id || ""), "app");
          if (/^\d+$/.test(safeId)) {
            const n = Number(safeId);
            if (n >= 1111 && n < 1000000 && n > maxNumericId) {
              maxNumericId = n;
            }
          }

          const rawStatus = String(app.status || "Pending");
          const normalizedStatus =
            rawStatus === "Approved" || rawStatus === "Rejected" ? rawStatus : "Pending";
          const ownerUid = String(app.ownerUid || "public_applicant").slice(0, 128);
          const phone = String(app.studentPhone || "01800000000").slice(0, 32);
          const fullPhone = phone.length >= 6 ? phone : "01800000000";
          const fullName = String(
            app.fullNameEnglish || app.fullNameBangla || `Candidate ${safeId}`
          ).slice(0, 200);

          if (overwrite || !existingApplicantIds.has(safeId)) {
            const safeRole = app.role === "cadet" ? "cadet" : "user";
            const photoStr =
              typeof app.photo === "string" && app.photo.length <= 450000 ? app.photo : "";
            const { password: _pw, ...appWithoutPlaintextPw } = app;
            const rawDocs = Array.isArray(app.uploadedDocuments) ? app.uploadedDocuments : [];
            const sanitizedDocs = rawDocs.map((docItem: any) => {
              if (docItem && typeof docItem.dataUrl === "string" && docItem.dataUrl.length > 20000) {
                return {
                  name: docItem.name,
                  type: docItem.type,
                  size: docItem.size,
                  storedOnServer: true,
                };
              }
              return docItem;
            });

            parityWrites.push({
              ref: doc(db, "applicants", safeId),
              data: {
                ...appWithoutPlaintextPw,
                uploadedDocuments: sanitizedDocs,
                id: safeId,
                fullNameEnglish: fullName,
                studentPhone: fullPhone,
                status: normalizedStatus,
                ownerUid,
                role: safeRole,
                photo: photoStr,
                createdAt: safeTimestamp(app.createdAtIso || app.createdAt),
              },
            });
            appAdded++;
          }

          if (overwrite || !existingAdmissionIds.has(safeId)) {
            parityWrites.push({
              ref: doc(db, "admissions", safeId),
              data: {
                id: safeId,
                applicantId: safeId,
                registrationNumber: String(app.registrationNumber || safeId),
                fullNameEnglish: fullName,
                ownerUid,
                admissionStatus: normalizedStatus,
                updatedAt: Timestamp.now(),
              },
            });
            admAdded++;
          }

          if (overwrite || !existingQrIds.has(safeId)) {
            parityWrites.push({
              ref: doc(db, "public_qr_cards", safeId),
              data: {
                id: safeId,
                cadetId: safeId,
                registrationNumber: String(app.registrationNumber || safeId),
                fullNameEnglish: fullName,
                fullNameBangla: String(app.fullNameBangla || ""),
                studyStatus: String(app.studyStatus || ""),
                session: String(app.session || ""),
                collegeName: String(app.collegeName || "Cox's Bazar City College"),
                platoonName: "Cox's Bazar City College BNCC Platoon",
                bloodGroup: String(app.bloodGroup || ""),
                department: String(app.classYear || app.department || ""),
                status: normalizedStatus,
                isValidCadet: normalizedStatus === "Approved",
                ownerUid,
                photo: typeof app.photo === "string" && app.photo.length <= 450000 ? app.photo : "",
                updatedAt: Timestamp.now(),
              },
            });
          }
        });
      }
    } catch {
      // Optional server endpoint
    }

    if (
      !existingCounterSnap.exists() ||
      Number(existingCounterSnap.data()?.currentId || 0) < maxNumericId
    ) {
      parityWrites.push({
        ref: doc(db, "counters", "applicant_id"),
        data: { currentId: Math.max(1110, maxNumericId) },
      });
      collections["counters"] = 1;
    } else {
      collections["counters"] = 0;
    }

    if (parityWrites.length > 0) {
      await commitInChunks(parityWrites);
      totalWritten += parityWrites.length;
    }
    collections["applicants"] = appAdded;
    collections["admissions"] = admAdded;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "applicants");
    warnings.push(`Applicants parity sync warning: ${err?.message || "Skipped"}`);
  }

  // 7. Server Contact Inquiries -> Firestore contact_messages
  try {
    const headers = await getServerAuthHeaders();
    const [existingContactSnap, contactRes] = await Promise.all([
      getDocs(collection(db, "contact_messages")),
      apiFetch("/api/contact", { headers, credentials: "include" }),
    ]);
    const existingContactIds = new Set(existingContactSnap.docs.map((d) => d.id));
    let contactAdded = 0;

    if (contactRes.ok) {
      const contactJson = await contactRes.json();
      const serverInquiries = Array.isArray(contactJson?.inquiries) ? contactJson.inquiries : [];
      for (const inq of serverInquiries) {
        const safeId = sanitizeCmsDocId(String(inq.id || ""), "inq");
        if (!existingContactIds.has(safeId)) {
          const phone = String(inq.phone || "01800000000").slice(0, 32);
          const safePhone = phone.length >= 6 ? phone : "01800000000";
          const targetStatus =
            inq.status === "read" || inq.status === "replied" || inq.status === "resolved"
              ? inq.status
              : "unread";
          await setDoc(doc(db, "contact_messages", safeId), {
            id: safeId,
            name: String(inq.name || "Visitor").slice(0, 160),
            phone: safePhone,
            email: String(inq.email || "").slice(0, 160),
            subject: String(inq.subject || "Contact Inquiry").slice(0, 200),
            message: String(inq.message || "Contact message").slice(0, 5000),
            status: "unread",
            ownerUid: String(inq.ownerUid || "public_visitor").slice(0, 128),
            createdAt: safeTimestamp(inq.createdAtIso),
          });
          if (targetStatus !== "unread") {
            await updateDoc(doc(db, "contact_messages", safeId), {
              status: targetStatus,
              updatedAt: Timestamp.now(),
            });
          }
          contactAdded++;
          totalWritten++;
        }
      }
    }
    collections["contact_messages"] = contactAdded;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "contact_messages");
    warnings.push(`Contact messages sync warning: ${err?.message || "Skipped"}`);
  }

  // 8. Server Messages -> Firestore messages
  try {
    const headers = await getServerAuthHeaders();
    const [existingMsgSnap, msgRes] = await Promise.all([
      getDocs(collection(db, "messages")),
      apiFetch("/api/messages", { headers, credentials: "include" }),
    ]);
    const existingMsgIds = new Set(existingMsgSnap.docs.map((d) => d.id));
    const msgWrites: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any> }> = [];

    if (msgRes.ok) {
      const msgJson = await msgRes.json();
      const serverMsgs = Array.isArray(msgJson?.messages) ? msgJson.messages : [];
      serverMsgs.forEach((m: any) => {
        const safeId = sanitizeCmsDocId(String(m.id || ""), "msg");
        if ((overwrite || !existingMsgIds.has(safeId)) && m.content) {
          msgWrites.push({
            ref: doc(db, "messages", safeId),
            data: {
              senderId: String(m.senderId || auth.currentUser?.uid || "admin").slice(0, 128),
              senderName: String(m.senderName || "Platoon Member").slice(0, 160),
              recipientId: String(m.recipientId || "ALL"),
              ownerUid: String(m.ownerUid || "ALL"),
              ...(m.candidateId ? { candidateId: String(m.candidateId) } : {}),
              content: String(m.content).slice(0, 5000),
              timestamp:
                Number.isFinite(Number(m.timestampMs)) && Number(m.timestampMs) > 0
                  ? Timestamp.fromMillis(Number(m.timestampMs))
                  : safeTimestamp(m.timestampIso || m.timestamp),
              role: String(m.role || "admin"),
              isRead: Boolean(m.isRead),
            },
          });
        }
      });
    }

    if (msgWrites.length > 0) {
      await commitInChunks(msgWrites);
      totalWritten += msgWrites.length;
    }
    collections["messages"] = msgWrites.length;
  } catch (err: any) {
    reportFirestoreListenerError(err, OperationType.WRITE, "messages");
    warnings.push(`Messenger sync warning: ${err?.message || "Skipped"}`);
  }

  // 9. Record audit activity log
  try {
    await addDoc(collection(db, "activity_logs"), {
      type: "FULL_DATABASE_SYNC",
      targetId: "DATABASE_SYNC",
      actorId,
      ownerUid: auth.currentUser?.uid || actorId,
      details: `Synchronized ${totalWritten} portal records into Cloud Firestore (overwrite=${overwrite}).`,
      timestamp: Timestamp.now(),
      performedBy: actorId,
    });
  } catch {
    // Non-blocking audit log
  }

  onProgress?.("Database sync completed!");
  return {
    syncedAt: new Date().toISOString(),
    totalWritten,
    collections,
    warnings,
  };
}
