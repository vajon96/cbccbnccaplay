/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  auth,
  db,
  storage,
  storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  reportFirestoreListenerError,
  OperationType,
} from "../firebase";
import { CMSBackupData } from "../types/cms";
import { getServerAuthHeaders } from "../lib/auth";
import { apiFetch, assetUrl } from "../lib/api";

export type MediaVisibility = "public" | "private";
export type MediaStorageLocation = "firebase_storage" | "server_vault" | "public_assets" | "external";

export interface MediaAsset {
  id: string;
  fileName: string;
  storedFileName?: string;
  title: string;
  altText: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  tags: string[];
  visibility: MediaVisibility;
  storageLocation: MediaStorageLocation;
  storagePath: string;
  url: string;
  sha256?: string;
  isPrivateCandidateAsset?: boolean;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const ALLOWED_MEDIA_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
]);

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024; // 8MB safe limit

const LS_MEDIA_KEY = "cbcc_bncc_media_cache_v1";

function saveLocalCache(items: MediaAsset[]) {
  try {
    localStorage.setItem(LS_MEDIA_KEY, JSON.stringify(items.slice(0, 1000)));
  } catch {
    // ignore storage quota errors
  }
}

function readLocalCache(): MediaAsset[] {
  try {
    const raw = localStorage.getItem(LS_MEDIA_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function validateMediaFile(file: File): string | null {
  const mime = (file.type || "").toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (mime === "image/svg+xml" || ext === "svg" || ext === "html" || ext === "js") {
    return "সিকিউরিটির কারণে SVG বা স্ক্রিপ্ট ফাইল সরাসরি আপলোড অনুমোদিত নয়। অনুগ্রহ করে PNG, JPG, WebP বা PDF ব্যবহার করুন।";
  }
  if (!ALLOWED_MEDIA_MIMES.has(mime)) {
    return `অসমর্থিত ফাইল ফরম্যাট (${mime || ext})। অনুমোদিত: JPG, PNG, WebP, GIF, PDF, MP4, WebM, MP3, WAV।`;
  }
  if (file.size <= 0 || file.size > MAX_MEDIA_BYTES) {
    return "ফাইলের আকার ১ বাইট থেকে ৮ মেগাবাইটের মধ্যে হতে হবে।";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("ফাইল রিড করতে সমস্যা হয়েছে।"));
    reader.readAsDataURL(file);
  });
}

async function computeSha256(file: Blob): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "";
  }
}

async function getMediaAuthHeaders(): Promise<Record<string, string>> {
  return await getServerAuthHeaders();
}

export async function listMediaAssets(): Promise<MediaAsset[]> {
  const map = new Map<string, MediaAsset>();
  const authHeaders = await getMediaAuthHeaders();

  // 1. Load authenticated server vault + public_assets records
  try {
    let res = await apiFetch("/api/media/list", {
      credentials: "include",
      headers: authHeaders,
      cache: "no-store",
    });
    if (res.status === 401 && auth.currentUser) {
      const idToken = await auth.currentUser.getIdToken(true).catch(() => "");
      if (idToken) {
        await apiFetch("/api/auth/firebase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ idToken }),
        }).catch(() => {});
        res = await apiFetch("/api/media/list", {
          credentials: "include",
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
      }
    }
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.items)) {
        for (const item of data.items) {
          map.set(item.id, item);
        }
      }
    }
  } catch {
    // Ignore transient server fetch issues
  }

  // 2. Always ensure all public/assets & root branding assets are indexed (even if vault auth cookie wasn't attached)
  let publicLoaded = false;
  try {
    const pubRes = await apiFetch("/api/media/public-assets", {
      credentials: "include",
      cache: "no-store",
    });
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      if (Array.isArray(pubData?.items)) {
        publicLoaded = true;
        for (const item of pubData.items) {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
        }
      }
    }
  } catch {
    // Fallback to static manifest below
  }

  if (!publicLoaded) {
    try {
      const manifestRes = await fetch(assetUrl("/assets-manifest.json"), { cache: "no-store" });
      if (manifestRes.ok) {
        const manifestData = await manifestRes.json();
        if (Array.isArray(manifestData?.items)) {
          for (const item of manifestData.items) {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          }
        }
      }
    } catch {
      // Ignore missing static manifest
    }
  }

  // 3. Load Firestore media_assets if authenticated with Firebase account
  if (auth.currentUser) {
    try {
      const q = query(collection(db, "media_assets"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as MediaAsset;
        map.set(d.id, { ...data, id: d.id });
      });
    } catch (err) {
      reportFirestoreListenerError(err, OperationType.LIST, "media_assets");
    }
  }

  if (map.size === 0) {
    return readLocalCache();
  }

  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  saveLocalCache(merged);
  return merged;
}

async function uploadToFirebaseStorageFallback(params: {
  file: File;
  title: string;
  altText?: string;
  description?: string;
  category: string;
  tags?: string[];
  visibility: MediaVisibility;
  isPrivateCandidateAsset?: boolean;
  uploadedBy?: string;
  replaceAsset?: MediaAsset | null;
  sha256: string;
  onProgress?: (percent: number) => void;
}): Promise<MediaAsset> {
  if (!auth.currentUser) {
    throw new Error("FIREBASE_USER_REQUIRED");
  }
  const cleanName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const assetId =
    params.replaceAsset?.id || `med_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safeCat = params.category.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const storagePath =
    params.visibility === "private"
      ? `private_media/${auth.currentUser.uid}/${safeCat}/${assetId}_${cleanName}`
      : `public_media/${safeCat}/${assetId}_${cleanName}`;
  const refObj = storageRef(storage, storagePath);

  const downloadUrl = await new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error("FIREBASE_STORAGE_TIMEOUT")), 9000);
    const task = uploadBytesResumable(refObj, params.file, {
      contentType: params.file.type,
    });
    task.on(
      "state_changed",
      (snap) => {
        if (snap.totalBytes > 0) {
          params.onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 90));
        }
      },
      (err) => {
        window.clearTimeout(timeoutId);
        reject(err);
      },
      async () => {
        window.clearTimeout(timeoutId);
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });

  const now = new Date().toISOString();
  const asset: MediaAsset = {
    id: assetId,
    fileName: params.file.name,
    title: params.title,
    altText: params.altText || "",
    description: params.description || "",
    mimeType: params.file.type,
    sizeBytes: params.file.size,
    category: params.category,
    tags: params.tags || [],
    visibility: params.visibility,
    storageLocation: "firebase_storage",
    storagePath,
    url: downloadUrl,
    sha256: params.sha256,
    isPrivateCandidateAsset: Boolean(params.isPrivateCandidateAsset),
    uploadedBy: params.uploadedBy || auth.currentUser.email || "admin",
    createdAt: params.replaceAsset?.createdAt || now,
    updatedAt: now,
  };

  await setDoc(doc(db, "media_assets", assetId), asset);
  params.onProgress?.(100);
  return asset;
}

export async function uploadMediaAsset(params: {
  file: File;
  title?: string;
  altText?: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: MediaVisibility;
  isPrivateCandidateAsset?: boolean;
  uploadedBy?: string;
  replaceAsset?: MediaAsset | null;
  onProgress?: (percent: number) => void;
}): Promise<{ asset: MediaAsset; duplicateDetected: boolean }> {
  const validationError = validateMediaFile(params.file);
  if (validationError) {
    throw new Error(validationError);
  }

  const visibility: MediaVisibility =
    params.isPrivateCandidateAsset || params.visibility === "private" ? "private" : "public";
  const category = (params.category || "General").trim() || "General";
  const title = (params.title || params.file.name).trim();
  const sha256 = await computeSha256(params.file);

  // Attempt Firebase Storage direct upload first when public visibility & verified Firebase user
  // (Public assets replacements stay on disk; private candidate docs prefer /api/media/private when available)
  if (
    visibility === "public" &&
    auth.currentUser &&
    params.replaceAsset?.storageLocation !== "public_assets"
  ) {
    try {
      const asset = await uploadToFirebaseStorageFallback({
        file: params.file,
        title,
        altText: params.altText,
        description: params.description,
        category,
        tags: params.tags,
        visibility,
        isPrivateCandidateAsset: false,
        uploadedBy: params.uploadedBy,
        replaceAsset: params.replaceAsset,
        sha256,
        onProgress: params.onProgress,
      });
      return { asset, duplicateDetected: false };
    } catch {
      // Seamless fallback to authenticated server vault
    }
  }

  // Authenticated server vault path with Firebase Storage fallback when MEDIA_DIR / server storage is unavailable
  params.onProgress?.(25);
  const dataBase64 = await fileToBase64(params.file);
  params.onProgress?.(55);

  try {
    const authHeaders = await getMediaAuthHeaders();
    const res = await apiFetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify({
        fileName: params.file.name,
        mimeType: params.file.type,
        dataBase64,
        visibility,
        category,
        title,
        altText: params.altText || "",
        description: params.description || "",
        tags: params.tags || [],
        isPrivateCandidateAsset: Boolean(params.isPrivateCandidateAsset),
        replaceId: params.replaceAsset?.id || "",
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.item) {
      params.onProgress?.(90);
      const uploadedAsset = data.item as MediaAsset;
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, "media_assets", uploadedAsset.id), uploadedAsset);
        } catch {
          // Non-blocking Firestore mirror sync
        }
      }
      params.onProgress?.(100);
      return {
        asset: uploadedAsset,
        duplicateDetected: Boolean(data.duplicateDetected),
      };
    }

    if (res.status < 500 || !auth.currentUser || params.replaceAsset?.storageLocation === "public_assets") {
      throw new Error(data?.error || "মিডিয়া আপলোড ব্যর্থ হয়েছে।");
    }
  } catch (err: any) {
    if (!auth.currentUser || params.replaceAsset?.storageLocation === "public_assets") {
      throw err instanceof Error ? err : new Error("মিডিয়া আপলোড ব্যর্থ হয়েছে।");
    }
    // Fall through to Firebase Storage fallback if network / 5xx server storage error occurred
    if (err?.message && !String(err.message).includes("Failed to fetch") && !String(err.message).includes("NetworkError")) {
      // If it was an explicit 4xx validation/auth message thrown above, rethrow it
      if (!String(err.message).includes("মিডিয়া আপলোড ব্যর্থ")) {
        throw err;
      }
    }
  }

  const fallbackAsset = await uploadToFirebaseStorageFallback({
    file: params.file,
    title,
    altText: params.altText,
    description: params.description,
    category,
    tags: params.tags,
    visibility,
    isPrivateCandidateAsset: params.isPrivateCandidateAsset,
    uploadedBy: params.uploadedBy,
    replaceAsset: params.replaceAsset,
    sha256,
    onProgress: params.onProgress,
  });
  return { asset: fallbackAsset, duplicateDetected: false };
}

export async function updateMediaAssetMetadata(
  asset: MediaAsset,
  updates: Partial<Pick<MediaAsset, "fileName" | "title" | "altText" | "description" | "category" | "tags" | "visibility">>
): Promise<MediaAsset> {
  const safeVisibility: MediaVisibility =
    asset.isPrivateCandidateAsset ? "private" : (updates.visibility || asset.visibility);

  let updatedAsset: MediaAsset = {
    ...asset,
    ...updates,
    visibility: safeVisibility,
    updatedAt: new Date().toISOString(),
  };

  if (
    asset.storageLocation === "server_vault" ||
    asset.storageLocation === "public_assets" ||
    (asset.storageLocation === "external" && asset.id.startsWith("ext_"))
  ) {
    const authHeaders = await getMediaAuthHeaders();
    const res = await apiFetch(`/api/media/${encodeURIComponent(asset.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "include",
      body: JSON.stringify({
        ...updates,
        visibility:
          asset.storageLocation === "public_assets" || asset.storageLocation === "external"
            ? "public"
            : safeVisibility,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.item) updatedAsset = data.item;
    }
  }

  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, "media_assets", asset.id), {
        fileName: updatedAsset.fileName,
        title: updatedAsset.title,
        altText: updatedAsset.altText,
        description: updatedAsset.description,
        category: updatedAsset.category,
        tags: updatedAsset.tags,
        visibility: updatedAsset.visibility,
        url: updatedAsset.url,
        storagePath: updatedAsset.storagePath,
        updatedAt: updatedAsset.updatedAt,
      });
    } catch {
      // ignore if asset wasn't stored in Firestore yet
    }
  }

  return updatedAsset;
}

export async function deleteMediaAsset(asset: MediaAsset): Promise<void> {
  if (
    asset.storageLocation === "server_vault" ||
    asset.storageLocation === "public_assets" ||
    (asset.storageLocation === "external" && asset.id.startsWith("ext_"))
  ) {
    const authHeaders = await getMediaAuthHeaders();
    const res = await apiFetch(`/api/media/${encodeURIComponent(asset.id)}`, {
      method: "DELETE",
      headers: authHeaders,
      credentials: "include",
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Failed to delete media file");
    }
  } else if (asset.storageLocation === "firebase_storage" && asset.storagePath && auth.currentUser) {
    try {
      await deleteObject(storageRef(storage, asset.storagePath));
    } catch {
      // Object might already be deleted in bucket
    }
  }

  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, "media_assets", asset.id));
    } catch {
      // Non-blocking doc cleanup
    }
  }
}

export function findMediaUsagePlaces(
  url: string,
  cmsData: Partial<CMSBackupData>,
  applicants: any[] = []
): string[] {
  if (!url) return [];
  const normUrl = url.trim();
  const usedIn: string[] = [];

  const settings = cmsData.settings;
  if (settings) {
    if (settings.collegeLogoUrl === normUrl) usedIn.push("Site Settings: College Logo");
    if (settings.bnccLogoUrl === normUrl) usedIn.push("Site Settings: BNCC Logo");
    if (settings.ribbonBannerUrl === normUrl) usedIn.push("Site Settings: Ribbon Banner");
  }

  cmsData.sections?.forEach((sec) => {
    if (sec.customData && JSON.stringify(sec.customData).includes(normUrl)) {
      usedIn.push(`Section: ${sec.name || sec.id}`);
    }
  });

  if (cmsData.commander?.photoUrl === normUrl) {
    usedIn.push(`Platoon Commander: ${cmsData.commander.name}`);
  }

  cmsData.cadets?.forEach((c) => {
    if (c.photo === normUrl) usedIn.push(`Cadet Showcase: ${c.name}`);
  });

  cmsData.incharges?.forEach((inc) => {
    if (inc.photoUrl === normUrl || inc.coPhotoUrl === normUrl || inc.rankBadgeUrl === normUrl) {
      usedIn.push(`Hall of In-Charges: ${inc.name}`);
    }
  });

  cmsData.activities?.forEach((act) => {
    if (act.image === normUrl) usedIn.push(`Activity: ${act.title}`);
  });

  cmsData.notices?.forEach((n) => {
    if (n.attachmentUrl === normUrl) usedIn.push(`Notice Attachment: ${n.title}`);
  });

  cmsData.gallery?.forEach((g) => {
    if (g.url === normUrl) usedIn.push(`Gallery: ${g.title}`);
  });

  applicants.forEach((a) => {
    if (a.photo === normUrl) {
      usedIn.push(`Applicant Photo: ${a.fullNameEnglish || a.id}`);
    }
  });

  return usedIn;
}
