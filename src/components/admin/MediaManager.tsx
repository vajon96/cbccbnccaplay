import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload,
  Search,
  Grid,
  List,
  Copy,
  Check,
  Download,
  ExternalLink,
  Trash2,
  Edit3,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Lock,
  Globe,
  X,
  AlertTriangle,
  Crop,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  MediaAsset,
  MediaVisibility,
  deleteMediaAsset,
  findMediaUsagePlaces,
  formatFileSize,
  listMediaAssets,
  updateMediaAssetMetadata,
  uploadMediaAsset,
  validateMediaFile,
} from "../../services/mediaService";
import { useCMS } from "../../context/CMSContext";

interface MediaManagerProps {
  applicants?: any[];
  uploadedBy?: string;
  onNotify?: (msg: string, type?: "success" | "error") => void;
}

const CATEGORIES = [
  "General",
  "Logos & Branding",
  "Cadets",
  "Activities",
  "Notices",
  "Gallery",
  "Exam",
  "Documents",
  "Private Candidate Docs",
];

function getAssetKind(mime: string): "image" | "pdf" | "video" | "audio" | "other" {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "other";
}

function getStorageLabel(loc: MediaAsset["storageLocation"]): string {
  if (loc === "firebase_storage") return "Firebase Storage";
  if (loc === "public_assets") return "Site Public Assets";
  if (loc === "external") return "External URL";
  return "Server Vault";
}

export function MediaManager({
  applicants = [],
  uploadedBy = "admin",
  onNotify,
}: MediaManagerProps) {
  const {
    settings,
    sections,
    commander,
    cadets,
    incharges,
    activities,
    notices,
    gallery,
  } = useCMS();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState<"all" | "public_assets" | "vault" | "external">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "pdf" | "doc" | "video" | "audio">("all");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "largest">("newest");
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadVisibility, setUploadVisibility] = useState<MediaVisibility>("public");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [bannerAlert, setBannerAlert] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Preview, Edit Metadata, Delete & Crop Editor Modals
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const [editAsset, setEditAsset] = useState<MediaAsset | null>(null);
  const [editForm, setEditForm] = useState<{
    fileName: string;
    title: string;
    altText: string;
    description: string;
    category: string;
    tagsText: string;
    visibility: MediaVisibility;
  }>({
    fileName: "",
    title: "",
    altText: "",
    description: "",
    category: "General",
    tagsText: "",
    visibility: "public",
  });
  const [savingMeta, setSavingMeta] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Replace file input ref
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingAsset, setReplacingAsset] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-upload Image Crop & Resize Modal
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropDataUrl, setCropDataUrl] = useState<string>("");
  const [cropAspect, setCropAspect] = useState<"original" | "1:1" | "16:9" | "4:3">("original");
  const [cropMaxWidth, setCropMaxWidth] = useState<number>(1200);
  const [cropQuality, setCropQuality] = useState<number>(0.88);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const cropImgRef = useRef<HTMLImageElement>(null);

  const notify = (text: string, type: "success" | "error" = "success") => {
    setBannerAlert({ text, type });
    onNotify?.(text, type);
    window.setTimeout(() => {
      setBannerAlert((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const loadAssets = async () => {
    setLoading(true);
    try {
      const list = await listMediaAssets();
      setAssets(list);
    } catch (err: any) {
      notify(err?.message || "মিডিয়া তালিকা লোড করতে সমস্যা হয়েছে।", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssets();
  }, []);

  const allAssets = useMemo(() => {
    const seenUrls = new Set(assets.map((a) => (a.url || "").trim()));
    const dynamicExtras: MediaAsset[] = [];
    const nowIso = new Date().toISOString();

    const addExtra = (
      id: string,
      url: string | undefined,
      title: string,
      category: string,
      mimeType = "image/jpeg"
    ) => {
      const cleanUrl = (url || "").trim();
      if (!cleanUrl || seenUrls.has(cleanUrl)) return;
      seenUrls.add(cleanUrl);
      const isDataUrl = cleanUrl.startsWith("data:");
      const fileName = isDataUrl
        ? `${id}.jpg`
        : cleanUrl.split("?")[0].split("/").pop() || `${id}.png`;
      dynamicExtras.push({
        id,
        fileName,
        title,
        altText: title,
        description: `Referenced in ${category}`,
        mimeType: cleanUrl.toLowerCase().endsWith(".pdf") ? "application/pdf" : mimeType,
        sizeBytes: isDataUrl ? cleanUrl.length : 0,
        category,
        tags: ["cms-linked"],
        visibility: "public",
        storageLocation: "external",
        storagePath: isDataUrl ? "embedded-data-url" : cleanUrl,
        url: cleanUrl,
        isPrivateCandidateAsset: false,
        uploadedBy: "system",
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    };

    if (settings) {
      addExtra("cms_college_logo", settings.collegeLogoUrl, "Site College Logo", "Logos & Branding", "image/png");
      addExtra("cms_bncc_logo", settings.bnccLogoUrl, "Site BNCC Logo", "Logos & Branding", "image/png");
      addExtra("cms_ribbon_banner", settings.ribbonBannerUrl, "Site Ribbon Banner", "Logos & Branding", "image/png");
    }
    if (commander?.photoUrl) {
      addExtra("cms_commander_photo", commander.photoUrl, `Commander: ${commander.name}`, "Cadets");
    }
    cadets?.forEach((c) => addExtra(`cms_cadet_${c.id}`, c.photo, `Cadet: ${c.name}`, "Cadets"));
    incharges?.forEach((inc, idx) => {
      addExtra(`cms_inc_${idx}`, inc.photoUrl, `In-Charge: ${inc.name}`, "Cadets");
      addExtra(`cms_inc_co_${idx}`, inc.coPhotoUrl, `Co-In-Charge: ${inc.name}`, "Cadets");
      addExtra(`cms_inc_badge_${idx}`, inc.rankBadgeUrl, `Badge: ${inc.rankTitle}`, "Logos & Branding", "image/png");
    });
    activities?.forEach((act) => addExtra(`cms_act_${act.id}`, act.image, act.title, "Activities"));
    notices?.forEach((n) => addExtra(`cms_notice_${n.id}`, n.attachmentUrl, `Notice: ${n.title}`, "Notices", "application/pdf"));
    gallery?.forEach((g) => addExtra(`cms_gal_${g.id}`, g.url, g.title, "Gallery"));
    applicants?.forEach((a) => {
      if (a.photo && !a.photo.startsWith("data:")) {
        addExtra(`app_photo_${a.id}`, a.photo, `Applicant: ${a.fullNameEnglish || a.id}`, "Cadets");
      }
    });

    return [...assets, ...dynamicExtras];
  }, [assets, settings, commander, cadets, incharges, activities, notices, gallery, applicants]);

  const usageMap = useMemo(() => {
    const map = new Map<string, string[]>();
    const cmsData = {
      settings,
      sections,
      commander,
      cadets,
      incharges,
      activities,
      notices,
      gallery,
    };
    for (const item of allAssets) {
      map.set(item.id, findMediaUsagePlaces(item.url, cmsData, applicants));
    }
    return map;
  }, [allAssets, settings, sections, commander, cadets, incharges, activities, notices, gallery, applicants]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allAssets.filter((item) => {
      if (categoryFilter !== "All" && item.category !== categoryFilter) return false;
      if (sourceFilter === "public_assets" && item.storageLocation !== "public_assets") return false;
      if (
        sourceFilter === "vault" &&
        item.storageLocation !== "server_vault" &&
        item.storageLocation !== "firebase_storage"
      ) {
        return false;
      }
      if (sourceFilter === "external" && item.storageLocation !== "external") return false;
      if (visibilityFilter !== "all" && item.visibility !== visibilityFilter) return false;
      if (typeFilter !== "all") {
        const k = getAssetKind(item.mimeType);
        if (typeFilter === "doc") {
          if (k !== "other") return false;
        } else if (k !== typeFilter) {
          return false;
        }
      }
      if (q) {
        const hay = `${item.title} ${item.fileName} ${item.category} ${item.altText} ${(item.tags || []).join(" ")} ${item.url} ${item.storagePath || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "name") {
        return (a.title || a.fileName).localeCompare(b.title || b.fileName);
      }
      if (sortBy === "largest") {
        return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [allAssets, searchQuery, categoryFilter, sourceFilter, typeFilter, visibilityFilter, sortBy]);

  const uploadSingleFile = async (file: File, replaceAsset?: MediaAsset | null) => {
    const validationErr = validateMediaFile(file);
    if (validationErr) {
      notify(validationErr, "error");
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    setUploadStatusText(`Uploading ${file.name}...`);

    try {
      const isPrivateCat = uploadCategory === "Private Candidate Docs";
      const result = await uploadMediaAsset({
        file,
        category: replaceAsset?.category || uploadCategory,
        visibility: replaceAsset?.visibility || (isPrivateCat ? "private" : uploadVisibility),
        isPrivateCandidateAsset: replaceAsset?.isPrivateCandidateAsset || isPrivateCat,
        uploadedBy,
        replaceAsset: replaceAsset || null,
        onProgress: (p) => setUploadProgress(p),
      });

      setAssets((prev) => {
        const without = prev.filter((x) => x.id !== result.asset.id);
        return [result.asset, ...without];
      });

      notify(
        result.duplicateDetected
          ? `ফাইল '${result.asset.fileName}' ইতিমধ্যেই বিদ্যমান ছিল (SHA-256 ডুপ্লিকেট শনাক্ত) — বিদ্যমান লিংক পুনঃব্যবহার হয়েছে।`
          : replaceAsset
          ? `'${result.asset.fileName}' সফলভাবে প্রতিস্থাপিত হয়েছে।`
          : `'${result.asset.fileName}' সফলভাবে আপলোড হয়েছে।`,
        "success"
      );
    } catch (err: any) {
      notify(err?.message || "আপলোড ব্যর্থ হয়েছে।", "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatusText("");
    }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);

    // If single image selected and user can optionally crop/resize before upload
    if (arr.length === 1 && arr[0].type.startsWith("image/") && arr[0].type !== "image/gif") {
      const vErr = validateMediaFile(arr[0]);
      if (vErr) {
        notify(vErr, "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCropFile(arr[0]);
        setCropDataUrl(String(reader.result || ""));
        setCropAspect("original");
        setCropMaxWidth(1200);
      };
      reader.readAsDataURL(arr[0]);
      return;
    }

    for (const file of arr) {
      await uploadSingleFile(file);
    }
  };

  const handleCropAndUpload = async () => {
    if (!cropFile) return;
    const img = cropImgRef.current;
    if (!img || !naturalSize.w || !naturalSize.h) {
      await uploadSingleFile(cropFile);
      setCropFile(null);
      setCropDataUrl("");
      return;
    }

    let sx = 0;
    let sy = 0;
    let sw = naturalSize.w;
    let sh = naturalSize.h;

    if (cropAspect !== "original") {
      const targetRatio =
        cropAspect === "1:1" ? 1 : cropAspect === "16:9" ? 16 / 9 : 4 / 3;
      const currentRatio = sw / sh;
      if (currentRatio > targetRatio) {
        sw = Math.round(sh * targetRatio);
        sx = Math.round((naturalSize.w - sw) / 2);
      } else {
        sh = Math.round(sw / targetRatio);
        sy = Math.round((naturalSize.h - sh) / 2);
      }
    }

    const scale = sw > cropMaxWidth ? cropMaxWidth / sw : 1;
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      await uploadSingleFile(cropFile);
      setCropFile(null);
      setCropDataUrl("");
      return;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    const outMime = cropFile.type === "image/png" ? "image/png" : "image/webp";

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), outMime, cropQuality)
    );
    if (!blob) {
      await uploadSingleFile(cropFile);
    } else {
      const baseName = cropFile.name.replace(/\.[^.]+$/, "");
      const ext = outMime === "image/png" ? "png" : "webp";
      const processed = new File([blob], `${baseName}.${ext}`, { type: outMime });
      await uploadSingleFile(processed);
    }
    setCropFile(null);
    setCropDataUrl("");
  };

  const handleCopyUrl = async (asset: MediaAsset) => {
    const fullUrl = asset.url.startsWith("http")
      ? asset.url
      : `${window.location.origin}${asset.url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(asset.id);
      notify(`URL কপি হয়েছে: ${fullUrl}`);
      window.setTimeout(() => setCopiedId((prev) => (prev === asset.id ? null : prev)), 2500);
    } catch {
      notify("ক্লিপবোর্ডে কপি করা যায়নি।", "error");
    }
  };

  const openEditModal = (asset: MediaAsset) => {
    setEditAsset(asset);
    setEditForm({
      fileName: asset.fileName || "",
      title: asset.title || "",
      altText: asset.altText || "",
      description: asset.description || "",
      category: asset.category || "General",
      tagsText: (asset.tags || []).join(", "),
      visibility: asset.visibility || "public",
    });
  };

  const handleSaveMetadata = async () => {
    if (!editAsset) return;
    setSavingMeta(true);
    try {
      const updated = await updateMediaAssetMetadata(editAsset, {
        fileName: editForm.fileName.trim() || editAsset.fileName,
        title: editForm.title.trim() || editForm.fileName,
        altText: editForm.altText.trim(),
        description: editForm.description.trim(),
        category: editForm.category,
        tags: editForm.tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        visibility: editAsset.isPrivateCandidateAsset ? "private" : editForm.visibility,
      });
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setEditAsset(null);
      notify("মিডিয়া মেটাডাটা সফলভাবে সংরক্ষিত হয়েছে।");
    } catch (err: any) {
      notify(err?.message || "মেটাডাটা আপডেট ব্যর্থ হয়েছে।", "error");
    } finally {
      setSavingMeta(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMediaAsset(deleteTarget);
      setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      notify(`'${deleteTarget.fileName}' সফলভাবে মুছে ফেলা হয়েছে।`);
      setDeleteTarget(null);
    } catch (err: any) {
      notify(err?.message || "ফাইল ডিলিট ব্যর্থ হয়েছে।", "error");
    } finally {
      setDeleting(false);
    }
  };

  const totalSize = useMemo(
    () => allAssets.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    [allAssets]
  );

  const assetStats = useMemo(() => {
    let images = 0;
    let pdfs = 0;
    let docs = 0;
    let publicAssetsCount = 0;
    let vaultCount = 0;
    for (const item of allAssets) {
      const k = getAssetKind(item.mimeType);
      if (k === "image") images++;
      else if (k === "pdf") pdfs++;
      else if (k === "other") docs++;
      if (item.storageLocation === "public_assets") publicAssetsCount++;
      if (item.storageLocation === "server_vault" || item.storageLocation === "firebase_storage") vaultCount++;
    }
    return { images, pdfs, docs, publicAssetsCount, vaultCount };
  }, [allAssets]);

  return (
    <div className="space-y-6">
      {bannerAlert && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
            bannerAlert.type === "error"
              ? "bg-rose-950/60 border-rose-500/40 text-rose-200"
              : "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
          }`}
        >
          <span>{bannerAlert.text}</span>
          <button
            type="button"
            onClick={() => setBannerAlert(null)}
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Upload Dropzone & Quick Metrics */}
      <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 md:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">Media Vault & Optimization Center</h2>
            <p className="text-xs text-slate-400">
              {allAssets.length} assets indexed ({assetStats.publicAssetsCount} public/assets · {assetStats.images} images · {assetStats.pdfs} PDFs · {assetStats.docs} HTML/CSS/JS/Docs · {assetStats.vaultCount} vault) · {formatFileSize(totalSize)} total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={uploadCategory}
              onChange={(e) => {
                const nextCat = e.target.value;
                setUploadCategory(nextCat);
                if (nextCat === "Private Candidate Docs") setUploadVisibility("private");
              }}
              className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[#C5A059]"
              aria-label="Upload Category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={uploadCategory === "Private Candidate Docs" ? "private" : uploadVisibility}
              disabled={uploadCategory === "Private Candidate Docs"}
              onChange={(e) => setUploadVisibility(e.target.value as MediaVisibility)}
              className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-[#C5A059] disabled:opacity-60"
              aria-label="Upload Visibility"
            >
              <option value="public">Public (Site Assets)</option>
              <option value="private">Private (Admin Only)</option>
            </select>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Upload size={15} /> Upload Media
            </button>
          </div>
        </div>

        {/* Drag and Drop Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFilesSelected(e.dataTransfer.files);
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-[#C5A059] bg-[#C5A059]/10"
              : "border-white/15 hover:border-[#C5A059]/60 bg-[#020B18]/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,audio/mpeg,audio/wav"
            onChange={(e) => {
              void handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,audio/mpeg,audio/wav"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && replacingAsset) {
                void uploadSingleFile(f, replacingAsset);
              }
              setReplacingAsset(null);
              e.target.value = "";
            }}
            className="hidden"
          />

          {uploading ? (
            <div className="max-w-md mx-auto space-y-2.5">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#C5A059]">
                <Loader2 size={16} className="animate-spin" />
                <span>{uploadStatusText || "Uploading..."}</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#C5A059] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                Drag and drop files here, or click to select multiple files
              </p>
              <p className="text-xs text-slate-400">
                Single image selection opens the optional built-in crop & resize optimizer before upload.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Filter & View Bar */}
      <div className="bg-[#061830] border border-white/10 rounded-2xl p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filename, title, tag, or URL..."
            className="w-full bg-[#020B18] border border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-[#C5A059]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as any)}
            className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
            aria-label="Filter by Storage Source"
          >
            <option value="all">All Sources ({allAssets.length})</option>
            <option value="public_assets">public/assets ({assetStats.publicAssetsCount})</option>
            <option value="vault">Uploaded Vault ({assetStats.vaultCount})</option>
            <option value="external">External / CMS Links</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          >
            <option value="all">All Types</option>
            <option value="image">Images</option>
            <option value="pdf">PDF Documents</option>
            <option value="doc">HTML / CSS / JS / Docs</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>

          <select
            value={visibilityFilter}
            onChange={(e) => setVisibilityFilter(e.target.value as any)}
            className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          >
            <option value="all">All Access</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#020B18] border border-white/15 text-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Filename A–Z</option>
            <option value="largest">Largest First</option>
          </select>

          <div className="flex items-center bg-[#020B18] border border-white/15 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid View"
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewMode === "grid" ? "bg-[#C5A059] text-[#002147]" : "text-slate-400 hover:text-white"
              }`}
            >
              <Grid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List View"
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewMode === "list" ? "bg-[#C5A059] text-[#002147]" : "text-slate-400 hover:text-white"
              }`}
            >
              <List size={15} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadAssets()}
            className="p-2 bg-[#020B18] border border-white/15 text-slate-300 hover:text-white rounded-xl cursor-pointer"
            title="Refresh media list"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Media Content Grid / List */}
      {loading ? (
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-14 text-center text-slate-300 text-xs flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-[#C5A059]" />
          <span>Loading Media Vault...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="bg-[#061830] border border-white/10 rounded-2xl p-14 text-center space-y-3">
          <ImageIcon size={36} className="mx-auto text-slate-500" />
          <h3 className="text-sm font-bold text-white">No Media Assets Match Your Filters</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Upload your first image, official PDF notice, or platoon video above to manage URLs cleanly across the entire BNCC portal.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((item) => {
            const kind = getAssetKind(item.mimeType);
            const usedPlaces = usageMap.get(item.id) || [];
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between"
              >
                {/* Thumbnail Preview */}
                <button
                  type="button"
                  onClick={() => setPreviewAsset(item)}
                  className="aspect-[16/10] w-full bg-[#020B18] relative flex items-center justify-center overflow-hidden border-b border-white/10 cursor-pointer group"
                >
                  {kind === "image" && !failedImages[item.id] ? (
                    <img
                      src={item.url}
                      alt={item.altText || item.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : kind === "image" ? (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <ImageIcon size={30} />
                      <span className="text-[11px] font-mono">Image Preview</span>
                    </div>
                  ) : kind === "pdf" ? (
                    <div className="flex flex-col items-center gap-1.5 text-amber-300">
                      <FileText size={32} />
                      <span className="text-[11px] font-mono">PDF Document</span>
                    </div>
                  ) : kind === "video" ? (
                    <div className="flex flex-col items-center gap-1.5 text-cyan-300">
                      <Film size={32} />
                      <span className="text-[11px] font-mono">Video Clip</span>
                    </div>
                  ) : kind === "audio" ? (
                    <div className="flex flex-col items-center gap-1.5 text-emerald-300">
                      <Music size={32} />
                      <span className="text-[11px] font-mono">Audio Asset</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-sky-300">
                      <FileText size={32} />
                      <span className="text-[11px] font-mono">
                        {item.mimeType === "text/html"
                          ? "HTML Document"
                          : item.mimeType === "text/css"
                          ? "CSS Stylesheet"
                          : item.mimeType === "application/javascript"
                          ? "JavaScript"
                          : item.mimeType === "application/json"
                          ? "JSON Data"
                          : item.mimeType === "application/xml"
                          ? "XML Sitemap"
                          : "Text / Document"}
                      </span>
                    </div>
                  )}
                </button>

                {/* Metadata & Actions */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-white truncate" title={item.title || item.fileName}>
                      {item.title || item.fileName}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {item.sizeBytes > 0 ? formatFileSize(item.sizeBytes) : "External Link"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        {item.visibility === "private" ? <Lock size={11} /> : <Globe size={11} />}
                        {item.visibility === "private" ? "Private" : "Public"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {getStorageLabel(item.storageLocation)} ·{" "}
                      <span className={usedPlaces.length > 0 ? "text-amber-300 font-semibold" : ""}>
                        Used in {usedPlaces.length} place{usedPlaces.length === 1 ? "" : "s"}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => void handleCopyUrl(item)}
                      className={`w-full py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                        isCopied
                          ? "bg-emerald-600 text-white"
                          : "bg-[#C5A059] hover:bg-[#d4b068] text-[#002147]"
                      }`}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      {isCopied ? "COPIED MEDIA URL" : "COPY MEDIA URL"}
                    </button>

                    <div className="flex items-center justify-between gap-1.5">
                      <a
                        href={item.url}
                        download={item.fileName}
                        className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border border-white/10"
                        title="Download File"
                      >
                        <Download size={13} /> Save
                      </a>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg border border-white/10"
                        title="Open Direct URL"
                      >
                        <ExternalLink size={13} />
                      </a>
                      {!(item.id.startsWith("cms_") || item.id.startsWith("app_photo_")) && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg border border-white/10 cursor-pointer"
                            title="Edit Metadata"
                          >
                            <Edit3 size={13} />
                          </button>
                          {item.storageLocation !== "external" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplacingAsset(item);
                                replaceInputRef.current?.click();
                              }}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-lg border border-white/10 cursor-pointer"
                              title="Replace File"
                            >
                              <RefreshCw size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="p-1.5 bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg border border-rose-500/25 cursor-pointer"
                            title="Delete Media"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Asset</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Category & Access</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Size & Storage</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider">Used In</th>
                  <th className="py-3 px-4 font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredAssets.map((item) => {
                  const kind = getAssetKind(item.mimeType);
                  const usedPlaces = usageMap.get(item.id) || [];
                  const isCopied = copiedId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(item)}
                            className="w-11 h-11 rounded-lg bg-[#020B18] border border-white/10 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            {kind === "image" && !failedImages[item.id] ? (
                              <img
                                src={item.url}
                                alt={item.altText || item.title}
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FileText size={18} className="text-amber-300" />
                            )}
                          </button>
                          <div className="min-w-0 max-w-[260px]">
                            <p className="font-bold text-white truncate">{item.title || item.fileName}</p>
                            <p className="text-[11px] font-mono text-slate-400 truncate">{item.fileName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <p className="font-semibold">{item.category}</p>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          {item.visibility === "private" ? <Lock size={11} /> : <Globe size={11} />}
                          {item.visibility}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-mono tabular-nums text-white">
                          {item.sizeBytes > 0 ? formatFileSize(item.sizeBytes) : "External Link"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {getStorageLabel(item.storageLocation)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span className={usedPlaces.length > 0 ? "text-amber-300 font-semibold" : "text-slate-400"}>
                          {usedPlaces.length > 0 ? `${usedPlaces.length} active ref` : "Unused"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopyUrl(item)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                            isCopied ? "bg-emerald-600 text-white" : "bg-[#C5A059] text-[#002147]"
                          }`}
                        >
                          {isCopied ? "Copied" : "Copy URL"}
                        </button>
                        {!(item.id.startsWith("cms_") || item.id.startsWith("app_photo_")) && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pre-Upload Crop / Resize Modal */}
      {cropFile && cropDataUrl && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#061830] border border-white/15 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-white font-bold">
                <Crop size={18} className="text-[#C5A059]" />
                <span>Optimize & Resize Before Upload</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCropFile(null);
                  setCropDataUrl("");
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#020B18] border border-white/10 rounded-xl p-4 flex items-center justify-center max-h-[300px] overflow-hidden">
              <img
                ref={cropImgRef}
                src={cropDataUrl}
                alt="Crop preview"
                onLoad={(e) => {
                  const im = e.currentTarget;
                  setNaturalSize({ w: im.naturalWidth, h: im.naturalHeight });
                }}
                className="max-h-[260px] object-contain rounded"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Aspect Ratio Crop</label>
                <select
                  value={cropAspect}
                  onChange={(e) => setCropAspect(e.target.value as any)}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="original">Original ({naturalSize.w}×{naturalSize.h})</option>
                  <option value="1:1">Square (1:1 Avatar/Logo)</option>
                  <option value="16:9">Widescreen (16:9 Banner)</option>
                  <option value="4:3">Landscape (4:3 Gallery)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Max Width (px)</label>
                <select
                  value={cropMaxWidth}
                  onChange={(e) => setCropMaxWidth(Number(e.target.value))}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value={1920}>1920px (Full HD)</option>
                  <option value={1200}>1200px (Web Optimal)</option>
                  <option value={800}>800px (Medium Card)</option>
                  <option value={512}>512px (Avatar / Icon)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Compression Quality</label>
                <select
                  value={cropQuality}
                  onChange={(e) => setCropQuality(Number(e.target.value))}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value={0.95}>High (95%)</option>
                  <option value={0.88}>Balanced (88%)</option>
                  <option value={0.75}>Compact (75%)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={async () => {
                  const raw = cropFile;
                  setCropFile(null);
                  setCropDataUrl("");
                  await uploadSingleFile(raw);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Skip Optimization (Upload Original)
              </button>
              <button
                type="button"
                onClick={() => void handleCropAndUpload()}
                className="px-5 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black cursor-pointer"
              >
                Optimize & Upload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#061830] border border-white/15 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">{previewAsset.title || previewAsset.fileName}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {previewAsset.mimeType} · {formatFileSize(previewAsset.sizeBytes)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-[#020B18] border border-white/10 rounded-xl p-4 flex items-center justify-center min-h-[220px]">
              {getAssetKind(previewAsset.mimeType) === "image" ? (
                <img
                  src={previewAsset.url}
                  alt={previewAsset.altText || previewAsset.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[360px] object-contain rounded"
                />
              ) : getAssetKind(previewAsset.mimeType) === "video" ? (
                <video src={previewAsset.url} controls className="max-h-[360px] w-full rounded" />
              ) : getAssetKind(previewAsset.mimeType) === "audio" ? (
                <audio src={previewAsset.url} controls className="w-full" />
              ) : (
                <div className="text-center space-y-3 py-6">
                  <FileText size={48} className="mx-auto text-amber-300" />
                  <p className="text-xs text-slate-300">{previewAsset.fileName}</p>
                  <a
                    href={previewAsset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black"
                  >
                    <ExternalLink size={14} /> Open Document
                  </a>
                </div>
              )}
            </div>

            <div className="bg-[#020B18] border border-white/10 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400 font-semibold">Direct Media URL</span>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl(previewAsset)}
                  className="text-[#C5A059] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={12} /> Copy URL
                </button>
              </div>
              <p className="font-mono text-[11px] text-slate-300 break-all select-all">{previewAsset.url}</p>

              <div className="pt-2 border-t border-white/10">
                <p className="text-slate-400 font-semibold mb-1">Active Usage References:</p>
                {(usageMap.get(previewAsset.id) || []).length === 0 ? (
                  <p className="text-slate-500">Not currently referenced by CMS items or applicant records.</p>
                ) : (
                  <ul className="list-disc pl-5 text-amber-300 space-y-0.5">
                    {(usageMap.get(previewAsset.id) || []).map((place, idx) => (
                      <li key={idx}>{place}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editAsset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#061830] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white">Edit Media Metadata</h3>
              <button
                type="button"
                onClick={() => setEditAsset(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">File Name</label>
                <input
                  type="text"
                  value={editForm.fileName}
                  onChange={(e) => setEditForm((p) => ({ ...p, fileName: e.target.value }))}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#C5A059]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#C5A059]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Category</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Visibility</label>
                  <select
                    value={
                      editAsset.isPrivateCandidateAsset
                        ? "private"
                        : editAsset.storageLocation === "public_assets" || editAsset.storageLocation === "external"
                        ? "public"
                        : editForm.visibility
                    }
                    disabled={
                      Boolean(editAsset.isPrivateCandidateAsset) ||
                      editAsset.storageLocation === "public_assets" ||
                      editAsset.storageLocation === "external"
                    }
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, visibility: e.target.value as MediaVisibility }))
                    }
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none disabled:opacity-60"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Alt Text (Accessibility)</label>
                <input
                  type="text"
                  value={editForm.altText}
                  onChange={(e) => setEditForm((p) => ({ ...p, altText: e.target.value }))}
                  placeholder="Describe this asset for screen readers..."
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#C5A059]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.tagsText}
                  onChange={(e) => setEditForm((p) => ({ ...p, tagsText: e.target.value }))}
                  placeholder="parade, 2026, official"
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#C5A059]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-[#020B18] border border-white/15 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-[#C5A059] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditAsset(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingMeta}
                onClick={() => void handleSaveMetadata()}
                className="px-5 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Metadata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#061830] border border-rose-500/35 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Delete Media File?</h3>
                <p className="text-xs text-slate-300">
                  Are you sure you want to permanently remove <strong className="text-white">{deleteTarget.fileName}</strong>?
                </p>
              </div>
            </div>

            {(usageMap.get(deleteTarget.id) || []).length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 space-y-1">
                <p className="font-bold">Warning: Currently referenced in {(usageMap.get(deleteTarget.id) || []).length} place(s):</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {(usageMap.get(deleteTarget.id) || []).slice(0, 5).map((u, idx) => (
                    <li key={idx}>{u}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
