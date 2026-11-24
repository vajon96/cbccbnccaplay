import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Download,
  Trash2,
  FileSpreadsheet,
  Archive,
  Shield,
  X,
  FileText,
  Key,
  Edit,
  Loader2,
  ExternalLink,
  MessageSquare,
  UserPlus,
  Settings,
  TrendingUp,
  PieChart as PieChartIcon,
  Bell,
  Megaphone,
  Activity,
  QrCode,
  Camera,
  Globe,
  MapPin,
  Award,
  Mail,
  RefreshCw,
  Menu,
  FolderKanban,
  ArrowRight,
  Power,
  Database,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  db,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  Timestamp,
  reportFirestoreListenerError,
  OperationType,
  addDoc,
  where,
  getDocs,
  writeBatch,
} from "../firebase";
import { getAdminInsights, getApplicantSummary } from "../services/geminiService";
import {
  getSession,
  hashPassword,
  SUPER_ADMIN_EMAIL,
  getServerAuthHeaders,
  setServerAuthToken,
  syncServerSession,
  centralAuthenticate,
  setSession,
} from "../lib/auth";
import { useAuth } from "../context/AuthContext";
import { useCMS } from "../context/CMSContext";
import { isAdminRole, normalizeRole, UserRole } from "../lib/rbac";
import { AuditLogs } from "../components/modular/AuditLogs";
import { NotificationCenter } from "../components/modular/NotificationCenter";
import { AdminQrCodeModal } from "../components/AdminQrCodeModal";
import { PendingProfileApprovals } from "../components/cadet/PendingProfileApprovals";
import { CMSControlCenter } from "../components/cms/CMSControlCenter";
import {
  AdminSidebar,
  AdminModuleId,
  ADMIN_MODULE_LABELS,
} from "../components/admin/AdminSidebar";
import { MediaManager } from "../components/admin/MediaManager";
import { ExamPortalWorkspace } from "../components/admin/ExamPortalWorkspace";
import { AdmissionPortalWorkspace } from "../components/admin/AdmissionPortalWorkspace";
import { AdmissionQrWorkspace } from "../components/admin/AdmissionQrWorkspace";
import {
  syncAllPortalDataToDatabase,
  getDatabaseCollectionCounts,
  isPortalDatabaseSeeded,
  CollectionStat,
  DatabaseSyncResult,
} from "../services/databaseSyncService";

const MODULE_STORAGE_KEY = "cbcc_admin_active_module_v1";
const VALID_MODULES = new Set<AdminModuleId>([
  "overview",
  "website",
  "content",
  "users",
  "media",
  "suite-exam",
  "suite-admission",
  "suite-qr",
  "notifications",
  "logs",
  "settings",
  "security",
]);

function normalizeApplicantStatusValue(status: unknown): "Pending" | "Approved" | "Rejected" {
  const s = String(status || "").trim().toLowerCase();
  if (s === "approved" || s === "joined") return "Approved";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

function resolveApplicantCreatedMs(app: any): number {
  if (!app) return 0;
  if (typeof app._createdAtMs === "number" && Number.isFinite(app._createdAtMs)) {
    return app._createdAtMs;
  }
  if (typeof app.createdAt?.toMillis === "function") {
    return app.createdAt.toMillis();
  }
  if (typeof app.createdAt?.seconds === "number") {
    return app.createdAt.seconds * 1000;
  }
  if (typeof app.createdAtIso === "string") {
    const t = Date.parse(app.createdAtIso);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof app.createdAt === "string") {
    const t = Date.parse(app.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof app.submittedAt === "string") {
    const t = Date.parse(app.submittedAt);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof app.updatedAtIso === "string") {
    const t = Date.parse(app.updatedAtIso);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function normalizeApplicantDoc(raw: any): any {
  const id = String(raw?.id || raw?.registrationNumber || "").trim();
  const createdMs = resolveApplicantCreatedMs(raw);
  return {
    ...raw,
    id,
    registrationNumber: String(raw?.registrationNumber || id),
    status: normalizeApplicantStatusValue(raw?.status),
    _createdAtMs: createdMs,
    _createdAtIso: createdMs > 0 ? new Date(createdMs).toISOString() : raw?.createdAtIso || "",
  };
}

function mergeApplicantLists(firestoreList: any[], serverList: any[]): any[] {
  const byId = new Map<string, any>();
  for (const s of serverList) {
    const norm = normalizeApplicantDoc(s);
    if (norm.id) byId.set(norm.id, norm);
  }
  for (const f of firestoreList) {
    const norm = normalizeApplicantDoc(f);
    if (!norm.id) continue;
    const prev = byId.get(norm.id);
    if (prev) {
      byId.set(norm.id, {
        ...prev,
        ...norm,
        uploadedDocuments:
          Array.isArray(norm.uploadedDocuments) && norm.uploadedDocuments.length > 0
            ? norm.uploadedDocuments
            : prev.uploadedDocuments || [],
        _createdAtMs: norm._createdAtMs || prev._createdAtMs || 0,
        _createdAtIso: norm._createdAtIso || prev._createdAtIso || "",
      });
    } else {
      byId.set(norm.id, norm);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const diff = (b._createdAtMs || 0) - (a._createdAtMs || 0);
    if (diff !== 0) return diff;
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
}

function resolveGenericCreatedMs(item: any): number {
  if (!item) return 0;
  if (typeof item.createdAt?.toMillis === "function") return item.createdAt.toMillis();
  if (typeof item.createdAt?.seconds === "number") return item.createdAt.seconds * 1000;
  if (typeof item.createdAtIso === "string") {
    const t = Date.parse(item.createdAtIso);
    if (!Number.isNaN(t)) return t;
  }
  if (typeof item.createdAt === "string") {
    const t = Date.parse(item.createdAt);
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function mergeInquiryLists(firestoreList: any[], serverList: any[]): any[] {
  const byId = new Map<string, any>();
  for (const s of serverList) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    byId.set(id, { ...s, id, status: s.status || "unread", _createdAtMs: resolveGenericCreatedMs(s) });
  }
  for (const f of firestoreList) {
    const id = String(f?.id || "").trim();
    if (!id) continue;
    const prev = byId.get(id);
    const ms = resolveGenericCreatedMs(f) || prev?._createdAtMs || 0;
    byId.set(id, {
      ...(prev || {}),
      ...f,
      id,
      status: f.status || prev?.status || "unread",
      _createdAtMs: ms,
    });
  }
  return Array.from(byId.values()).sort((a, b) => (b._createdAtMs || 0) - (a._createdAtMs || 0));
}

function mergePasswordResets(firestoreResets: any[], serverResets: any[]): any[] {
  const byId = new Map<string, any>();
  for (const s of serverResets) {
    const id = String(s?.id || "").trim();
    if (!id) continue;
    byId.set(id, {
      ...s,
      id,
      status: String(s.status || "pending").toLowerCase(),
      _fromServer: true,
      _fromFirestore: false,
      _createdMs: resolveGenericCreatedMs(s),
    });
  }
  for (const f of firestoreResets) {
    const id = String(f?.id || "").trim();
    if (!id) continue;
    const prev = byId.get(id);
    byId.set(id, {
      ...(prev || {}),
      ...f,
      id,
      status: String(f.status || prev?.status || "pending").toLowerCase(),
      _fromServer: Boolean(prev?._fromServer),
      _fromFirestore: true,
      _createdMs: resolveGenericCreatedMs(f) || prev?._createdMs || 0,
    });
  }
  return Array.from(byId.values()).sort((a, b) => (b._createdMs || 0) - (a._createdMs || 0));
}

function resolveInitialModule(urlParam: string | null): AdminModuleId {
  if (urlParam && VALID_MODULES.has(urlParam as AdminModuleId)) {
    return urlParam as AdminModuleId;
  }
  try {
    const saved = localStorage.getItem(MODULE_STORAGE_KEY);
    if (saved && VALID_MODULES.has(saved as AdminModuleId)) {
      return saved as AdminModuleId;
    }
  } catch {
    // ignore
  }
  return "overview";
}

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<AdminModuleId>(() =>
    resolveInitialModule(searchParams.get("module"))
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [applicants, setApplicants] = useState<any[]>([]);
  const [firestoreApplicants, setFirestoreApplicants] = useState<any[]>([]);
  const [serverApplicants, setServerApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applicantsError, setApplicantsError] = useState<string | null>(null);

  const [aiInsights, setAiInsights] = useState("");
  const [isAnalyzingInsights, setIsAnalyzingInsights] = useState(false);
  const [applicantSummaries, setApplicantSummaries] = useState<Record<string, string>>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [serverPasswordResets, setServerPasswordResets] = useState<any[]>([]);
  const [adminSession, setAdminSession] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [serverAdminPwInput, setServerAdminPwInput] = useState("");
  const [savingServerAdminPw, setSavingServerAdminPw] = useState(false);

  // Admin creation & permission states
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPermissions, setAdminPermissions] = useState({
    canAdd: true,
    canEdit: true,
    canDelete: false,
    canViewLogs: true,
    canResetPW: false,
    canApprove: true,
    canExport: false,
    canChat: true,
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<any>(null);
  const [updatingPermissions, setUpdatingPermissions] = useState(false);
  const [confirmDeleteAdminId, setConfirmDeleteAdminId] = useState<string | null>(null);

  // Applicant password reset modal
  const [showPasswordReset, setShowPasswordReset] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [confirmDismissResetId, setConfirmDismissResetId] = useState<string | null>(null);

  // Admin QR modal & system credentials
  const [selectedQrAdmin, setSelectedQrAdmin] = useState<any>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastType, setBroadcastType] = useState("Announcement");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [confirmDeleteBroadcastId, setConfirmDeleteBroadcastId] = useState<string | null>(null);

  // Inquiries (merged real-time Firestore contact_messages + Express /api/contact)
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [firestoreInquiries, setFirestoreInquiries] = useState<any[]>([]);
  const [serverInquiries, setServerInquiries] = useState<any[]>([]);
  const [loadingInquiries, setLoadingInquiries] = useState(false);
  const [inquiryUpdatingId, setInquiryUpdatingId] = useState<string | null>(null);
  const [confirmDeleteInquiryId, setConfirmDeleteInquiryId] = useState<string | null>(null);

  // Firebase Auth UID-linked Users & Admissions
  const [usersList, setUsersList] = useState<any[]>([]);
  const [admissionsList, setAdmissionsList] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [updatingUserUid, setUpdatingUserUid] = useState<string | null>(null);

  const [savingWebsiteToggle, setSavingWebsiteToggle] = useState(false);

  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [dbStats, setDbStats] = useState<CollectionStat[]>([]);
  const [loadingDbStats, setLoadingDbStats] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [dbSyncProgress, setDbSyncProgress] = useState<string>("");
  const [dbSyncResult, setDbSyncResult] = useState<DatabaseSyncResult | null>(null);

  // Server session re-verification state (e.g. if page reloaded after server restart or blocked cookie)
  const [needsServerReauth, setNeedsServerReauth] = useState(false);
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthError, setReauthError] = useState("");
  const [reauthing, setReauthing] = useState(false);

  const navigate = useNavigate();
  const {
    firebaseUser,
    loading: authLoading,
    startImpersonation,
    logout,
  } = useAuth();
  const { settings: cmsSettings, saveSettings, refreshAll: refreshCmsAll } = useCMS();

  const loadDatabaseStats = async () => {
    if (!firebaseUser) return;
    setLoadingDbStats(true);
    try {
      const counts = await getDatabaseCollectionCounts();
      setDbStats(counts);
    } finally {
      setLoadingDbStats(false);
    }
  };

  const handleFullDatabaseSync = async (overwrite: boolean = false) => {
    if (!firebaseUser || dbSyncing) {
      if (!firebaseUser) {
        showToast("ডাটাবেস সিঙ্ক করতে Firebase ইমেইল ও পাসওয়ার্ড অ্যাডমিন লগইন প্রয়োজন।", "error");
      }
      return;
    }
    setDbSyncing(true);
    setDbSyncProgress("Connecting to Cloud Firestore (cbcc-bncc-portal-db)...");
    try {
      const res = await syncAllPortalDataToDatabase({
        overwrite,
        actorId: firebaseUser.email || firebaseUser.uid,
        onProgress: (step) => setDbSyncProgress(step),
      });
      setDbSyncResult(res);
      await Promise.all([refreshCmsAll(), loadDatabaseStats()]);
      showToast(
        `সফলভাবে ${res.totalWritten}টি রেকর্ড Cloud Firestore-এ সংরক্ষণ করা হয়েছে!`,
        "success"
      );
    } catch (err: any) {
      showToast(err?.message || "Database sync failed.", "error");
    } finally {
      setDbSyncing(false);
      setDbSyncProgress("");
    }
  };

  const handleSelectModule = (id: AdminModuleId) => {
    setActiveModule(id);
    try {
      localStorage.setItem(MODULE_STORAGE_KEY, id);
    } catch {
      // ignore
    }
    setSearchParams({ module: id }, { replace: true });
    if (id === "notifications") {
      void loadContactInquiries();
    } else if (id === "security") {
      void loadServerPasswordResets();
    } else if (id === "settings" && firebaseUser) {
      void loadDatabaseStats();
    }
  };

  useEffect(() => {
    const paramMod = searchParams.get("module");
    if (paramMod && VALID_MODULES.has(paramMod as AdminModuleId) && paramMod !== activeModule) {
      setActiveModule(paramMod as AdminModuleId);
    }
  }, [searchParams]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ type, text });
    window.setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const loadContactInquiries = async () => {
    setLoadingInquiries(true);
    try {
      const headers = await getServerAuthHeaders();
      const res = await fetch("/api/contact", { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        setServerInquiries(Array.isArray(data?.inquiries) ? data.inquiries : []);
      }
    } catch (err) {
      console.error("Failed to load inquiries:", err);
    } finally {
      setLoadingInquiries(false);
    }
  };

  const loadServerPasswordResets = async () => {
    try {
      const headers = await getServerAuthHeaders();
      const res = await fetch("/api/auth/password-resets", {
        credentials: "include",
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setServerPasswordResets(Array.isArray(data?.resets) ? data.resets : []);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const handleUpdateInquiryStatus = async (
    id: string,
    nextStatus: "unread" | "read" | "replied" | "resolved"
  ) => {
    setInquiryUpdatingId(id);
    let updated = false;
    if (firebaseUser) {
      try {
        await updateDoc(doc(db, "contact_messages", id), {
          status: nextStatus,
          handledBy: adminSession?.name || adminSession?.username || "admin",
          updatedAt: Timestamp.now(),
        });
        updated = true;
      } catch (err) {
        reportFirestoreListenerError(err, OperationType.UPDATE, `contact_messages/${id}`);
      }
    }
    setFirestoreInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: nextStatus } : i))
    );
    setServerInquiries((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: nextStatus } : i))
    );
    setInquiryUpdatingId(null);
    if (updated) {
      showToast(`বার্তা ${id} স্ট্যাটাস '${nextStatus}' করা হয়েছে।`);
    } else if (!firebaseUser) {
      showToast("শুধুমাত্র লোকাল ভিউতে স্ট্যাটাস পরিবর্তন হয়েছে (Firestore সংযোগ নেই)।", "error");
    } else {
      showToast("বার্তার স্ট্যাটাস আপডেট করা যায়নি।", "error");
    }
  };

  const handleDeleteInquiry = async (id: string) => {
    setInquiryUpdatingId(id);
    try {
      if (firebaseUser) {
        await deleteDoc(doc(db, "contact_messages", id));
      }
      setFirestoreInquiries((prev) => prev.filter((i) => i.id !== id));
      setServerInquiries((prev) => prev.filter((i) => i.id !== id));
      setConfirmDeleteInquiryId(null);
      showToast(`বার্তা ${id} মুছে ফেলা হয়েছে।`);
    } catch (err: any) {
      reportFirestoreListenerError(err, OperationType.DELETE, `contact_messages/${id}`);
      showToast("বার্তা মুছতে শুধুমাত্র অ্যাডমিন অনুমতি প্রয়োজন।", "error");
    } finally {
      setInquiryUpdatingId(null);
    }
  };

  const handleUpdateUserRole = async (targetUser: any, nextRole: UserRole) => {
    const uid = targetUser.uid || targetUser.id;
    if (!uid) return;
    if (adminSession?.role !== "super_admin" && nextRole === "super_admin") {
      showToast("শুধুমাত্র সুপার অ্যাডমিন super_admin রোল প্রদান করতে পারবেন।", "error");
      return;
    }
    setUpdatingUserUid(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        role: nextRole,
        updatedAt: Timestamp.now(),
      });
      await addDoc(collection(db, "activity_logs"), {
        type: "USER_ROLE_UPDATED",
        targetId: uid,
        actorId: adminSession?.id || adminSession?.username || "admin",
        timestamp: Timestamp.now(),
        details: `Updated UID ${uid} (${targetUser.email || targetUser.displayName || ""}) role to ${nextRole}`,
      }).catch(() => {});
      showToast(`ইউজার রোল '${nextRole}' আপডেট হয়েছে।`);
    } catch (err: any) {
      reportFirestoreListenerError(err, OperationType.UPDATE, `users/${uid}`);
      showToast("রোল আপডেট করতে অনুমতি বা নেটওয়ার্ক সমস্যা হয়েছে।", "error");
    } finally {
      setUpdatingUserUid(null);
    }
  };

  const handleToggleUserAccountStatus = async (targetUser: any) => {
    const uid = targetUser.uid || targetUser.id;
    if (!uid) return;
    const isCurrentlyActive = targetUser.accountStatus !== "Suspended" && targetUser.isActive !== false;
    const nextStatus = isCurrentlyActive ? "Suspended" : "Active";
    const nextActive = !isCurrentlyActive;
    setUpdatingUserUid(uid);
    try {
      await updateDoc(doc(db, "users", uid), {
        accountStatus: nextStatus,
        isActive: nextActive,
        updatedAt: Timestamp.now(),
      });
      await addDoc(collection(db, "activity_logs"), {
        type: nextActive ? "USER_ACTIVATED" : "USER_SUSPENDED",
        targetId: uid,
        actorId: adminSession?.id || adminSession?.username || "admin",
        timestamp: Timestamp.now(),
        details: `Set user ${uid} accountStatus to ${nextStatus}`,
      }).catch(() => {});
      showToast(`ইউজার অ্যাকাউন্ট ${nextStatus} করা হয়েছে।`);
    } catch (err: any) {
      reportFirestoreListenerError(err, OperationType.UPDATE, `users/${uid}`);
      showToast("ইউজার স্ট্যাটাস পরিবর্তন করা যায়নি।", "error");
    } finally {
      setUpdatingUserUid(null);
    }
  };

  const fetchServerApplicants = async (quiet = false) => {
    try {
      let headers = await getServerAuthHeaders();
      let res = await fetch("/api/applications", {
        credentials: "include",
        headers,
      });

      // Automatic one-shot session recovery if token/cookie wasn't attached yet
      if (res.status === 401 || res.status === 403) {
        if (firebaseUser) {
          const idToken = await firebaseUser.getIdToken(true).catch(() => null);
          const localSess = getSession();
          if (idToken && localSess) {
            await syncServerSession(localSess, idToken);
            headers = await getServerAuthHeaders();
            res = await fetch("/api/applications", {
              credentials: "include",
              headers,
            });
          }
        } else {
          const sessRes = await fetch("/api/auth/session", { credentials: "include" }).catch(() => null);
          if (sessRes?.ok) {
            const sessData = await sessRes.json().catch(() => null);
            if (sessData?.authenticated && sessData?.token) {
              setServerAuthToken(sessData.token);
              headers = await getServerAuthHeaders();
              res = await fetch("/api/applications", {
                credentials: "include",
                headers,
              });
            }
          }
        }
      }

      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.applications) ? data.applications : [];
        setServerApplicants(list);
        setNeedsServerReauth(false);
        setApplicantsError(null);
      } else if (res.status === 401 || res.status === 403) {
        if (!firebaseUser) {
          setNeedsServerReauth(true);
          if (!quiet) {
            setApplicantsError(
              "অ্যাডমিন সার্ভার সেশন যাচাই করা যায়নি বা মেয়াদ শেষ হয়েছে। অনুগ্রহ করে অ্যাডমিন পাসওয়ার্ড দিয়ে পুনরায় যাচাই করুন অথবা পুনরায় লগইন করুন।"
            );
          }
        } else if (!quiet) {
          setApplicantsError("অ্যাডমিন সেশন যাচাই বা সার্ভার থেকে আবেদন লোড করতে সমস্যা হয়েছে।");
        }
      } else if (!quiet && !firebaseUser) {
        setApplicantsError("সার্ভার থেকে আবেদন লোড করতে সমস্যা হয়েছে। পুনরায় চেষ্টা করুন।");
      }
    } catch {
      if (!quiet && !firebaseUser) {
        setApplicantsError("সার্ভার সংযোগ বিচ্ছিন্ন। পুনরায় চেষ্টা করুন।");
      }
    } finally {
      if (!firebaseUser) {
        setLoading(false);
      }
    }
  };

  const handleQuickReauth = async () => {
    if (!reauthPassword.trim()) return;
    setReauthing(true);
    setReauthError("");
    try {
      const targetUser = adminSession?.username || adminSession?.email || "admin";
      const res = await centralAuthenticate(targetUser, reauthPassword);
      if (res.success && res.user && isAdminRole(res.user.role)) {
        setSession(res.user);
        setAdminSession(res.user);
        setNeedsServerReauth(false);
        setShowReauthModal(false);
        setReauthPassword("");
        setApplicantsError(null);
        showToast("অ্যাডমিন সেশন সফলভাবে পুনঃযাচাই করা হয়েছে!");
        await fetchServerApplicants(false);
      } else {
        setReauthError(res.error || "ভুল পাসওয়ার্ড। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।");
      }
    } catch {
      setReauthError("সার্ভারের সাথে সংযোগ করা যায়নি। পরে চেষ্টা করুন।");
    } finally {
      setReauthing(false);
    }
  };

  useEffect(() => {
    setApplicants(mergeApplicantLists(firestoreApplicants, serverApplicants));
  }, [firestoreApplicants, serverApplicants]);

  useEffect(() => {
    setInquiries(mergeInquiryLists(firestoreInquiries, serverInquiries));
  }, [firestoreInquiries, serverInquiries]);

  useEffect(() => {
    if (authLoading) return;

    const session = getSession();
    if (!session || !isAdminRole(session.role)) {
      navigate("/login");
      return;
    }
    setAdminSession(session);
    void loadContactInquiries();
    void loadServerPasswordResets();
    void fetchServerApplicants(false);

    // Poll server registry every 6 seconds so credential-only admins also get real-time updates
    const pollInterval = window.setInterval(() => {
      void fetchServerApplicants(true);
      void loadServerPasswordResets();
    }, 6000);

    if (!firebaseUser) {
      setLoading(false);
      return () => {
        window.clearInterval(pollInterval);
      };
    }

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    let counterChecked = false;

    const startAdminListeners = async () => {
      setLoading(true);
      setApplicantsError(null);

      const providerEmail = firebaseUser.providerData?.find((p) => p.email)?.email || "";
      const emailLower = (firebaseUser.email || providerEmail || "").toLowerCase();
      let resolvedStaffRole: UserRole = normalizeRole(session.role);

      try {
        let adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid)).catch(() => null);
        if (cancelled) return;

        if ((!adminDoc || !adminDoc.exists()) && emailLower === SUPER_ADMIN_EMAIL) {
          await setDoc(
            doc(db, "admins", firebaseUser.uid),
            {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || "Platoon Commander",
              username: "admin",
              email: emailLower,
              role: "super_admin",
              isActive: true,
              permissions: {
                canAdd: true,
                canEdit: true,
                canDelete: true,
                canViewLogs: true,
                canResetPW: true,
                canApprove: true,
                canExport: true,
                canChat: true,
              },
              updatedAt: Timestamp.now(),
            },
            { merge: true }
          ).catch(() => {});
          adminDoc = await getDoc(doc(db, "admins", firebaseUser.uid)).catch(() => null);
          if (cancelled) return;
        }

        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid)).catch(() => null);
        if (cancelled) return;

        const hasValidAdminDoc =
          adminDoc?.exists() &&
          adminDoc.data()?.isActive !== false &&
          adminDoc.data()?.accountStatus !== "Suspended";
        const hasValidUserStaffDoc =
          userDoc?.exists() &&
          userDoc.data()?.isActive !== false &&
          userDoc.data()?.accountStatus !== "Suspended" &&
          isAdminRole(userDoc.data()?.role);

        if (emailLower === SUPER_ADMIN_EMAIL) {
          resolvedStaffRole = "super_admin";
        } else if (hasValidAdminDoc) {
          resolvedStaffRole = normalizeRole(adminDoc!.data()?.role || "admin");
        } else if (hasValidUserStaffDoc) {
          resolvedStaffRole = normalizeRole(userDoc!.data()?.role);
        } else {
          setApplicantsError("Firestore স্টাফ/অ্যাডমিন প্রোফাইল অনুপস্থিত (সার্ভার রেকর্ড প্রদর্শিত হচ্ছে)।");
          setLoading(false);
          return;
        }
      } catch (err: any) {
        if (cancelled) return;
        reportFirestoreListenerError(err, OperationType.GET, `admins/${firebaseUser.uid}`);
        setApplicantsError("Firestore অ্যাডমিন অনুমতি যাচাই করা যায়নি; অনুগ্রহ করে সুপার অ্যাডমিন দিয়ে লগইন করুন।");
        setLoading(false);
        return;
      }

      if (cancelled) return;

      const isStaffSuperAdmin = resolvedStaffRole === "super_admin";
      const isStaffModeratorOnly = resolvedStaffRole === "moderator" || resolvedStaffRole === "sub_admin";
      const isStaffAdmin = isStaffSuperAdmin || !isStaffModeratorOnly;

      const handleListenerError = (path: string) => (err: any) => {
        reportFirestoreListenerError(err, OperationType.LIST, path);
        setApplicantsError(`Firestore থেকে '${path}' লোড করতে অনুমতি বা নেটওয়ার্ক সমস্যা হয়েছে: ${err?.message || ""}`);
        setLoading(false);
      };

      // Subscribe WITHOUT orderBy("createdAt") so legacy/dateless docs are NEVER excluded by Firestore!
      unsubscribers.push(
        onSnapshot(
          collection(db, "applicants"),
          (snapshot) => {
            const rawDocs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            setFirestoreApplicants(rawDocs);
            setApplicantsError(null);
            setLoading(false);

            // Non-blocking background counter repair if existing numeric ID >= counter
            if (!counterChecked && rawDocs.length > 0) {
              counterChecked = true;
              const numericIds = rawDocs
                .map((r) => (/^\d+$/.test(String(r.id)) ? Number(r.id) : 0))
                .filter((n) => n >= 1111 && n < 1000000);
              const maxNumeric = numericIds.length > 0 ? Math.max(...numericIds) : 0;
              if (maxNumeric >= 1111) {
                getDoc(doc(db, "counters", "applicant_id"))
                  .then((cSnap) => {
                    const current = cSnap.exists() ? Number(cSnap.data()?.currentId || 1110) : 1110;
                    if (current < maxNumeric) {
                      return setDoc(doc(db, "counters", "applicant_id"), { currentId: maxNumeric }, { merge: true });
                    }
                  })
                  .catch(() => {});
              }
            }

            // Mirror live Firestore applicants into persistent server registry for credential-only admin parity
            if (rawDocs.length > 0) {
              const syncBatchPayload = rawDocs.map((d) => {
                const norm = normalizeApplicantDoc(d);
                const { createdAt: _ts, passwordHash: _ph, password: _pw, ...serializable } = norm;
                return {
                  ...serializable,
                  createdAtIso: norm._createdAtIso || new Date().toISOString(),
                };
              });
              getServerAuthHeaders({ "Content-Type": "application/json" })
                .then((headers) =>
                  fetch("/api/applications/sync-batch", {
                    method: "POST",
                    headers,
                    credentials: "include",
                    body: JSON.stringify({ applications: syncBatchPayload }),
                  })
                )
                .catch(() => {});
            }
          },
          handleListenerError("applicants")
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, "admissions"),
          (snapshot) => setAdmissionsList(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))),
          (err) => reportFirestoreListenerError(err, OperationType.LIST, "admissions")
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, "contact_messages"),
          (snapshot) => {
            setFirestoreInquiries(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
          },
          (err) => reportFirestoreListenerError(err, OperationType.LIST, "contact_messages")
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, "users"),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
            docs.sort((a, b) => resolveGenericCreatedMs(b) - resolveGenericCreatedMs(a));
            setUsersList(docs);
          },
          (err) => reportFirestoreListenerError(err, OperationType.LIST, "users")
        )
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, "activity_logs"), orderBy("timestamp", "desc")),
          (snapshot) => setLogs(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))),
          (err) => reportFirestoreListenerError(err, OperationType.LIST, "activity_logs")
        )
      );

      if (isStaffAdmin) {
        unsubscribers.push(
          onSnapshot(
            query(collection(db, "password_resets"), orderBy("createdAt", "desc")),
            (snapshot) => setPasswordResets(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))),
            (err) => reportFirestoreListenerError(err, OperationType.LIST, "password_resets")
          )
        );

        // Auto-seed all missing website CMS, defaults, media catalog, guides, exam config & server records once
        const bootstrapFlagKey = `cbcc_db_auto_seeded_${firebaseUser.uid}`;
        if (!sessionStorage.getItem(bootstrapFlagKey)) {
          sessionStorage.setItem(bootstrapFlagKey, "1");
          void (async () => {
            try {
              const seeded = await isPortalDatabaseSeeded();
              if (!seeded && !cancelled) {
                await syncAllPortalDataToDatabase({
                  overwrite: false,
                  actorId: emailLower || firebaseUser.uid,
                });
                if (!cancelled) {
                  void refreshCmsAll();
                  void loadDatabaseStats();
                }
              } else if (!cancelled && activeModule === "settings") {
                void loadDatabaseStats();
              }
            } catch {
              // Non-blocking background auto-seed
            }
          })();
        } else if (activeModule === "settings") {
          void loadDatabaseStats();
        }
      }

      unsubscribers.push(
        onSnapshot(
          query(collection(db, "notifications"), orderBy("timestamp", "desc")),
          (snapshot) => setNotifications(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }))),
          (err) => reportFirestoreListenerError(err, OperationType.LIST, "notifications")
        )
      );

      if (isStaffSuperAdmin) {
        unsubscribers.push(
          onSnapshot(
            collection(db, "admins"),
            (snapshot) => {
              const adminDocs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
              setAdmins(adminDocs);
              if (adminDocs.length > 0) {
                void getServerAuthHeaders({ "Content-Type": "application/json" })
                  .then((headers) =>
                    fetch("/api/auth/staff/sync-batch", {
                      method: "POST",
                      headers,
                      credentials: "include",
                      body: JSON.stringify({ staff: adminDocs }),
                    })
                  )
                  .catch(() => {});
              }
            },
            (err) => reportFirestoreListenerError(err, OperationType.LIST, "admins")
          )
        );
      }
    };

    void startAdminListeners();

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      unsubscribers.forEach((u) => u());
    };
  }, [navigate, authLoading, firebaseUser?.uid]);

  // Handlers
  const handleCreateAdmin = async () => {
    if (!adminName || !adminUsername || !adminPassword) return;
    setCreatingAdmin(true);
    try {
      const cleanUser = adminUsername.trim().toLowerCase();
      const snap = await getDocs(
        query(collection(db, "admins"), where("username", "==", cleanUser))
      );
      if (!snap.empty) {
        showToast("This username is already taken.", "error");
        return;
      }
      const hashedPassword = await hashPassword(adminPassword);
      const createdRef = await addDoc(collection(db, "admins"), {
        name: adminName,
        username: cleanUser,
        password: hashedPassword,
        role: "admin",
        permissions: adminPermissions,
        isActive: true,
        createdAt: Timestamp.now(),
      });
      const staffHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      await fetch("/api/auth/staff", {
        method: "POST",
        headers: staffHeaders,
        credentials: "include",
        body: JSON.stringify({
          id: createdRef.id,
          username: cleanUser,
          name: adminName,
          role: "admin",
          passwordHash: hashedPassword,
          permissions: adminPermissions,
          isActive: true,
        }),
      }).catch(() => {});
      await addDoc(collection(db, "activity_logs"), {
        type: "ADMIN_CREATED",
        targetId: cleanUser,
        actorId: adminSession?.id || "super_admin",
        timestamp: Timestamp.now(),
        details: `Super Admin created new admin: ${cleanUser}`,
      });
      setShowAddAdmin(false);
      setAdminName("");
      setAdminUsername("");
      setAdminPassword("");
      showToast("Admin created successfully!");
    } catch (err: any) {
      showToast(`Failed to create admin: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleGenerateQrAdmin = async () => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const genUsername = `qr_admin_${randomSuffix}`;
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let genPassword = "";
    for (let i = 0; i < 12; i++) {
      genPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setCreatingAdmin(true);
    try {
      const hashedPassword = await hashPassword(genPassword);
      const qrPerms = {
        canAdd: false,
        canEdit: true,
        canDelete: false,
        canViewLogs: false,
        canResetPW: false,
        canApprove: false,
        canExport: false,
        canChat: false,
      };
      const createdRef = await addDoc(collection(db, "admins"), {
        name: `QR Admin ${randomSuffix}`,
        username: genUsername,
        password: hashedPassword,
        role: "qr_admin",
        permissions: qrPerms,
        isActive: true,
        createdAt: Timestamp.now(),
      });
      const staffHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      await fetch("/api/auth/staff", {
        method: "POST",
        headers: staffHeaders,
        credentials: "include",
        body: JSON.stringify({
          id: createdRef.id,
          username: genUsername,
          name: `QR Admin ${randomSuffix}`,
          role: "qr_admin",
          passwordHash: hashedPassword,
          permissions: qrPerms,
          isActive: true,
        }),
      }).catch(() => {});
      await addDoc(collection(db, "activity_logs"), {
        type: "ADMIN_CREATED",
        targetId: genUsername,
        actorId: adminSession?.id || "super_admin",
        timestamp: Timestamp.now(),
        details: `Super Admin generated system QR Admin account: ${genUsername}`,
      });
      setGeneratedCredentials({ username: genUsername, password: genPassword });
    } catch {
      showToast("Failed to generate QR Admin.", "error");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const deleteAdmin = async (id: string) => {
    try {
      const targetAdmin = admins.find((a) => a.id === id);
      await deleteDoc(doc(db, "admins", id));
      const delHeaders = await getServerAuthHeaders();
      await fetch(`/api/auth/staff/${encodeURIComponent(targetAdmin?.username || id)}`, {
        method: "DELETE",
        headers: delHeaders,
        credentials: "include",
      }).catch(() => {});
      setConfirmDeleteAdminId(null);
      showToast("Admin removed.");
    } catch {
      showToast("Failed to remove admin.", "error");
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingAdminId || !editPermissions) return;
    setUpdatingPermissions(true);
    try {
      await updateDoc(doc(db, "admins", editingAdminId), { permissions: editPermissions });
      const targetAdmin = admins.find((a) => a.id === editingAdminId);
      if (targetAdmin?.username) {
        const staffHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
        await fetch("/api/auth/staff", {
          method: "POST",
          headers: staffHeaders,
          credentials: "include",
          body: JSON.stringify({
            id: editingAdminId,
            username: targetAdmin.username,
            name: targetAdmin.name,
            role: targetAdmin.role || "admin",
            permissions: editPermissions,
          }),
        }).catch(() => {});
      }
      await addDoc(collection(db, "activity_logs"), {
        type: "ADMIN_PERMISSIONS_UPDATED",
        targetId: editingAdminId,
        actorId: adminSession?.id || "super_admin",
        timestamp: Timestamp.now(),
        details: `Super Admin updated permissions for admin ID: ${editingAdminId}`,
      });
      setEditingAdminId(null);
      showToast("Permissions updated successfully!");
    } catch {
      showToast("Failed to update permissions.", "error");
    } finally {
      setUpdatingPermissions(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleResetPassword = async () => {
    if (!showPasswordReset || !newPassword) return;
    if (!adminSession?.permissions?.canResetPW && adminSession?.role !== "super_admin") {
      showToast("আপনার এই কাজটি করার অনুমতি নেই। (Permission Denied)", "error");
      return;
    }
    setResetting(true);
    try {
      const hashedPassword = await hashPassword(newPassword);
      let updated = false;
      if (firebaseUser) {
        await updateDoc(doc(db, "applicants", showPasswordReset), {
          passwordHash: hashedPassword,
          password: hashedPassword,
        })
          .then(() => {
            updated = true;
          })
          .catch(() => {});
        await addDoc(collection(db, "activity_logs"), {
          type: "PASSWORD_RESET_BY_ADMIN",
          targetId: showPasswordReset,
          actorId: adminSession?.id || "admin",
          timestamp: Timestamp.now(),
          details: `Admin reset password for user ${showPasswordReset}`,
        }).catch(() => {});
      }
      const patchHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/applications/${encodeURIComponent(showPasswordReset)}`, {
        method: "PATCH",
        headers: patchHeaders,
        credentials: "include",
        body: JSON.stringify({ passwordHash: hashedPassword }),
      }).catch(() => null);
      if (res?.ok) updated = true;

      if (!updated) {
        showToast("পাসওয়ার্ড আপডেট করা যায়নি।", "error");
        return;
      }
      setShowPasswordReset(null);
      setNewPassword("");
      showToast("Password reset successfully!");
    } finally {
      setResetting(false);
    }
  };

  const handleAdminLoginAsUser = async (applicant: any) => {
    await startImpersonation({
      id: applicant.id,
      name: applicant.fullNameEnglish || applicant.fullNameBangla || "BNCC Cadet",
      registrationNumber: applicant.registrationNumber || applicant.id,
      email: applicant.studentEmail,
    });
    navigate("/dashboard");
  };

  const updateStatus = async (id: string, status: string) => {
    if (!adminSession?.permissions?.canApprove && adminSession?.role !== "super_admin") {
      showToast("আপনার আবেদন অনুমোদন করার অনুমতি নেই।", "error");
      return;
    }
    const targetApp = applicants.find((a) => a.id === id);
    const targetOwnerUid = targetApp?.ownerUid || "public_applicant";
    const isApprovedDecision = status === "Approved" || status === "Joined";
    const admissionStatus = isApprovedDecision
      ? "Approved"
      : status === "Rejected"
      ? "Rejected"
      : "Pending";
    const derivedAccountRole: UserRole = isApprovedDecision ? "cadet" : "user";

    let updated = false;
    if (firebaseUser) {
      try {
        await updateDoc(doc(db, "applicants", id), {
          status,
          role: derivedAccountRole,
          updatedAt: Timestamp.now(),
        });
        updated = true;
        await setDoc(
          doc(db, "public_qr_cards", id),
          {
            status,
            isValidCadet: isApprovedDecision,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        ).catch(() => {});
        await setDoc(
          doc(db, "admissions", id),
          {
            id,
            applicantId: id,
            ownerUid: targetOwnerUid,
            admissionStatus,
            decisionBy: adminSession?.id || adminSession?.username || "admin",
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        ).catch(() => {});

        // Sync linked /users/{uid} role between Applicant ("user") and Inducted Cadet ("cadet")
        if (targetOwnerUid && targetOwnerUid !== "public_applicant") {
          const uSnap = await getDoc(doc(db, "users", targetOwnerUid)).catch(() => null);
          if (uSnap?.exists() && !isAdminRole(uSnap.data()?.role)) {
            await updateDoc(doc(db, "users", targetOwnerUid), {
              role: derivedAccountRole,
              applicantId: id,
              updatedAt: Timestamp.now(),
            }).catch(() => {});
          }
        }
      } catch (err) {
        reportFirestoreListenerError(err, OperationType.UPDATE, `applicants/${id}`);
      }
    }
    try {
      const patchHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: patchHeaders,
        credentials: "include",
        body: JSON.stringify({ status, role: derivedAccountRole }),
      });
      if (res.ok) updated = true;
    } catch {
      // ignore network error if Firestore succeeded
    }
    if (updated) {
      setServerApplicants((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status, role: derivedAccountRole } : a))
      );
      setFirestoreApplicants((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status, role: derivedAccountRole } : a))
      );
      showToast(
        `আবেদন স্ট্যাটাস '${status}' এবং অ্যাকাউন্ট রোল '${derivedAccountRole}' করা হয়েছে।`
      );
    } else {
      showToast("আবেদন স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।", "error");
    }
  };

  const toggleAccountActivation = async (app: any) => {
    if (!adminSession?.permissions?.canEdit && adminSession?.role !== "super_admin") {
      showToast("আপনার অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করার অনুমতি নেই।", "error");
      return;
    }
    const nextActive = app.isActive === false;
    const nextAccountStatus = nextActive ? "Active" : "Suspended";
    let updated = false;
    if (firebaseUser) {
      try {
        await updateDoc(doc(db, "applicants", app.id), {
          isActive: nextActive,
          accountStatus: nextAccountStatus,
        });
        updated = true;
        await addDoc(collection(db, "activity_logs"), {
          type: nextActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_SUSPENDED",
          targetId: app.id,
          actorId: adminSession?.id || "super_admin",
          timestamp: Timestamp.now(),
          details: `Admin set account ${app.id} to ${nextAccountStatus}`,
        }).catch(() => {});
      } catch (err) {
        reportFirestoreListenerError(err, OperationType.UPDATE, `applicants/${app.id}`);
      }
    }
    try {
      const patchHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/applications/${encodeURIComponent(app.id)}`, {
        method: "PATCH",
        headers: patchHeaders,
        credentials: "include",
        body: JSON.stringify({ isActive: nextActive, accountStatus: nextAccountStatus }),
      });
      if (res.ok) updated = true;
    } catch {
      // ignore
    }
    if (updated) {
      setServerApplicants((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, isActive: nextActive, accountStatus: nextAccountStatus } : a))
      );
      setFirestoreApplicants((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, isActive: nextActive, accountStatus: nextAccountStatus } : a))
      );
      showToast(`অ্যাকাউন্ট ${app.id} ${nextActive ? "সক্রিয় (Active)" : "স্থগিত (Suspended)"} করা হয়েছে।`);
    } else {
      showToast("অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করা যায়নি।", "error");
    }
  };

  const deleteApplicant = async (id: string) => {
    if (!adminSession?.permissions?.canDelete && adminSession?.role !== "super_admin") {
      showToast("আপনার রেকর্ড মুছে ফেলার অনুমতি নেই।", "error");
      return;
    }
    let deleted = false;
    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, "applicants", id));
        await deleteDoc(doc(db, "public_qr_cards", id)).catch(() => {});
        deleted = true;
      } catch (err) {
        reportFirestoreListenerError(err, OperationType.DELETE, `applicants/${id}`);
      }
    }
    try {
      const delHeaders = await getServerAuthHeaders();
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: delHeaders,
        credentials: "include",
      });
      if (res.ok) deleted = true;
    } catch {
      // ignore
    }
    if (deleted) {
      setServerApplicants((prev) => prev.filter((a) => a.id !== id));
      setFirestoreApplicants((prev) => prev.filter((a) => a.id !== id));
      showToast("রেকর্ড মুছে ফেলা হয়েছে।");
    } else {
      showToast("রেকর্ড মুছে ফেলতে সমস্যা হয়েছে।", "error");
    }
  };

  const handleBulkAction = async (ids: string[], action: "Approve" | "Reject" | "Delete") => {
    if (ids.length === 0) return;
    let ok = false;
    if (firebaseUser) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          const ref = doc(db, "applicants", id);
          const qrRef = doc(db, "public_qr_cards", id);
          const admRef = doc(db, "admissions", id);
          const appObj = applicants.find((a) => a.id === id);
          const appOwnerUid = appObj?.ownerUid || "public_applicant";
          if (action === "Delete") {
            batch.delete(ref);
            batch.delete(qrRef);
            batch.delete(admRef);
          } else {
            const nextStatus = action === "Approve" ? "Approved" : "Rejected";
            const nextRole: UserRole = action === "Approve" ? "cadet" : "user";
            batch.update(ref, { status: nextStatus, role: nextRole, updatedAt: Timestamp.now() });
            batch.set(
              qrRef,
              {
                status: nextStatus,
                isValidCadet: nextStatus === "Approved",
                updatedAt: Timestamp.now(),
              },
              { merge: true }
            );
            batch.set(
              admRef,
              {
                id,
                applicantId: id,
                ownerUid: appOwnerUid,
                admissionStatus: nextStatus,
                decisionBy: adminSession?.id || adminSession?.username || "admin",
                updatedAt: Timestamp.now(),
              },
              { merge: true }
            );
          }
        });
        await batch.commit();
        ok = true;
        if (action !== "Delete") {
          const nextRole: UserRole = action === "Approve" ? "cadet" : "user";
          for (const id of ids) {
            const appObj = applicants.find((a) => a.id === id);
            const appOwnerUid = appObj?.ownerUid;
            if (appOwnerUid && appOwnerUid !== "public_applicant") {
              const uSnap = await getDoc(doc(db, "users", appOwnerUid)).catch(() => null);
              if (uSnap?.exists() && !isAdminRole(uSnap.data()?.role)) {
                await updateDoc(doc(db, "users", appOwnerUid), {
                  role: nextRole,
                  applicantId: id,
                  updatedAt: Timestamp.now(),
                }).catch(() => {});
              }
            }
          }
        }
        await addDoc(collection(db, "activity_logs"), {
          type: `BULK_${action.toUpperCase()}`,
          targetId: "MULTIPLE",
          actorId: adminSession?.id || "admin",
          timestamp: Timestamp.now(),
          details: `Admin performed bulk ${action} on ${ids.length} candidates.`,
        }).catch(() => {});
      } catch {
        // try server fallback
      }
    }
    try {
      const bulkHeaders = await getServerAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/applications/bulk", {
        method: "POST",
        headers: bulkHeaders,
        credentials: "include",
        body: JSON.stringify({ ids, action }),
      });
      if (res.ok) ok = true;
    } catch {
      // ignore
    }
    if (ok) {
      const idSet = new Set(ids);
      if (action === "Delete") {
        setServerApplicants((prev) => prev.filter((a) => !idSet.has(a.id)));
        setFirestoreApplicants((prev) => prev.filter((a) => !idSet.has(a.id)));
      } else {
        const nextStatus = action === "Approve" ? "Approved" : "Rejected";
        const nextRole = action === "Approve" ? "cadet" : "user";
        setServerApplicants((prev) =>
          prev.map((a) => (idSet.has(a.id) ? { ...a, status: nextStatus, role: nextRole } : a))
        );
        setFirestoreApplicants((prev) =>
          prev.map((a) => (idSet.has(a.id) ? { ...a, status: nextStatus, role: nextRole } : a))
        );
      }
      showToast(`Bulk ${action} completed successfully.`);
    } else {
      showToast("Bulk action failed.", "error");
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim() || !broadcastTitle.trim()) {
      showToast("Please enter both title and message.", "error");
      return;
    }
    setSendingBroadcast(true);
    try {
      if (editingNotificationId) {
        await updateDoc(doc(db, "notifications", editingNotificationId), {
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType,
          timestamp: Timestamp.now(),
          actorId: adminSession?.id || "admin",
        });
        await addDoc(collection(db, "activity_logs"), {
          type: "BROADCAST_EDITED",
          targetId: "ALL_CADETS",
          actorId: adminSession?.id || "admin",
          timestamp: Timestamp.now(),
          details: `Admin updated broadcast notice: ${broadcastTitle}`,
        });
        setBroadcastMessage("");
        setBroadcastTitle("");
        setEditingNotificationId(null);
        showToast("Broadcast notice updated successfully!");
      } else {
        await addDoc(collection(db, "notifications"), {
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType,
          targetId: "ALL",
          isRead: false,
          timestamp: Timestamp.now(),
          actorId: adminSession?.id || "admin",
        });
        await addDoc(collection(db, "activity_logs"), {
          type: "BROADCAST_SENT",
          targetId: "ALL_CADETS",
          actorId: adminSession?.id || "admin",
          timestamp: Timestamp.now(),
          details: `Admin sent broadcast notice: ${broadcastTitle}`,
        });
        setBroadcastMessage("");
        setBroadcastTitle("");
        showToast("Announcement sent to all cadets!");
      }
    } catch {
      showToast("Failed to save broadcast notice.", "error");
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      await addDoc(collection(db, "activity_logs"), {
        type: "BROADCAST_DELETED",
        targetId: "ALL_CADETS",
        actorId: adminSession?.id || "admin",
        timestamp: Timestamp.now(),
        details: `Admin deleted broadcast notice ID: ${id}`,
      });
      setConfirmDeleteBroadcastId(null);
      if (editingNotificationId === id) {
        setBroadcastTitle("");
        setBroadcastMessage("");
        setEditingNotificationId(null);
      }
      showToast("Broadcast notice deleted successfully.");
    } catch {
      showToast("Failed to delete broadcast notice.", "error");
    }
  };

  const exportToExcel = () => {
    const dataToExport = applicants.map(({ photo, uploadedDocuments, password, passwordHash, _createdAtMs, _createdAtIso, ...rest }) => {
      const ms = resolveApplicantCreatedMs({ ...rest, _createdAtMs, _createdAtIso });
      return {
        ...rest,
        height: `${rest.heightFeet || 0}'${rest.heightInches || 0}"`,
        createdAt: ms > 0 ? new Date(ms).toLocaleString() : "",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Applicants");
    XLSX.writeFile(workbook, `BNCC_Applicants_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("Excel ফাইল ডাউনলোড শুরু হয়েছে।");
  };

  const exportJsonBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      organization: "Cox's Bazar City College BNCC Platoon",
      summary: {
        applicants: applicants.length,
        admins: admins.length,
        notifications: notifications.length,
      },
      applicants: applicants.map(({ passwordHash, password, ...safe }) => safe),
      notifications,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BNCC_Full_Backup_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    showToast("পূর্ণাঙ্গ JSON ব্যাকআপ ডাউনলোড সম্পন্ন হয়েছে।");
  };

  const downloadPhotosZip = async () => {
    const zip = new JSZip();
    applicants.forEach((app) => {
      if (app.photo && app.photo.includes(",")) {
        const base64Data = app.photo.split(",")[1];
        zip.file(`${app.id}.jpg`, base64Data, { base64: true });
      }
    });
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "Applicant_Photos.zip";
    link.click();
  };

  const runAiInsights = async () => {
    if (applicants.length === 0) return;
    setIsAnalyzingInsights(true);
    const insights = await getAdminInsights(applicants);
    setAiInsights(insights);
    setIsAnalyzingInsights(false);
  };

  const runApplicantSummary = async (app: any) => {
    setLoadingSummaryId(app.id);
    const summary = await getApplicantSummary(app);
    setApplicantSummaries((prev) => ({ ...prev, [app.id]: summary }));
    setLoadingSummaryId(null);
  };

  const toggleSettingFlag = async (
    key: "examPortalOpen" | "enrollmentOpen" | "offlineFormOpen" | "noticeTickerEnabled",
    nextVal: boolean
  ) => {
    setSavingWebsiteToggle(true);
    try {
      await saveSettings({
        ...cmsSettings,
        [key]: nextVal,
        lastUpdated: new Date().toISOString(),
        updatedBy: adminSession?.name || adminSession?.username || "Main Admin",
      });
      showToast("সেটিংস সফলভাবে আপডেট করা হয়েছে।");
    } catch {
      showToast("সেটিংস আপডেট করতে সমস্যা হয়েছে।", "error");
    } finally {
      setSavingWebsiteToggle(false);
    }
  };

  const newCutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  const stats = {
    total: applicants.length,
    newToday: applicants.filter((a) => (a._createdAtMs || 0) >= newCutoffMs).length,
    pending: applicants.filter((a) => a.status === "Pending").length,
    approved: applicants.filter((a) => a.status === "Approved" || a.status === "Joined").length,
    rejected: applicants.filter((a) => a.status === "Rejected").length,
  };

  const mergedPasswordResets = mergePasswordResets(passwordResets, serverPasswordResets);
  const pendingResetsCount = mergedPasswordResets.filter(
    (r) => String(r.status || "").toLowerCase() === "pending"
  ).length;
  const unreadInquiriesCount = inquiries.filter((i) => !i.status || i.status === "unread").length;
  const activeMeta = ADMIN_MODULE_LABELS[activeModule];

  if (loading && !adminSession) {
    return (
      <div className="flex items-center justify-center min-h-[75vh] text-slate-200 bg-[#020B18] font-bold">
        তথ্য লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 flex">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[95] px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-3 ${
            toastMessage.type === "error"
              ? "bg-rose-950/95 border-rose-500/40 text-rose-100"
              : "bg-emerald-950/95 border-emerald-500/40 text-emerald-100"
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Close notification"
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Persistent Hierarchical Sidebar */}
      <AdminSidebar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        adminName={adminSession?.name || "Main Admin"}
        adminRole={adminSession?.role || "super_admin"}
        pendingApplicantsCount={stats.pending}
        pendingResetsCount={pendingResetsCount}
        unreadInquiriesCount={unreadInquiriesCount}
        canViewLogs={Boolean(adminSession?.permissions?.canViewLogs || adminSession?.role === "super_admin")}
        isSuperAdmin={adminSession?.role === "super_admin"}
        onLogout={handleLogout}
      />

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Module Header */}
        <header className="sticky top-16 z-20 bg-[#031024]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] truncate">
                {activeMeta.group}
              </p>
              <h1 className="text-base sm:text-lg font-extrabold text-white truncate">
                {activeMeta.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <NotificationCenter notifications={notifications} />
            <button
              type="button"
              onClick={() => handleSelectModule("suite-exam")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <Award size={14} className="text-[#C5A059]" />
              <span>Exam Portal: {cmsSettings.examPortalOpen !== false ? "ON" : "OFF"}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/messenger")}
              disabled={!adminSession?.permissions?.canChat && adminSession?.role !== "super_admin"}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-semibold text-slate-200 cursor-pointer disabled:opacity-40"
            >
              <MessageSquare size={14} className="text-[#C5A059]" /> Messenger
            </button>
          </div>
        </header>

        {/* Workspace Viewport */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
          {needsServerReauth && (
            <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-200 flex items-center gap-2">
                  <Shield size={16} className="text-amber-400 shrink-0" />
                  সার্ভার অ্যাডমিন সেশন পুনঃযাচাই প্রয়োজন
                </p>
                <p className="text-xs text-amber-100/80">
                  পৃষ্ঠা রিলোড বা সার্ভার রিস্টার্টের পর নিরাপদ ডেটা লোড করতে অনুগ্রহ করে আপনার অ্যাডমিন পাসওয়ার্ড দিয়ে যাচাই করুন অথবা পুনরায় লগইন করুন।
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setReauthError("");
                    setShowReauthModal(true);
                  }}
                  className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black cursor-pointer"
                >
                  পাসওয়ার্ড দিয়ে যাচাই করুন
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  পুনরায় লগইন করুন
                </button>
              </div>
            </div>
          )}

          {/* MODULE 1: OVERVIEW */}
          {activeModule === "overview" && (
            <div className="space-y-6">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  {
                    label: "মোট আবেদন",
                    sublabel: "Total Applications",
                    value: stats.total,
                    hint: "সকল অনলাইন নিবন্ধন",
                    tone: "text-white",
                    action: () => handleSelectModule("suite-admission"),
                  },
                  {
                    label: "নতুন আবেদন",
                    sublabel: "Last 24 Hours",
                    value: stats.newToday,
                    hint: "সাম্প্রতিক জমা",
                    tone: "text-cyan-300",
                    action: () => handleSelectModule("suite-admission"),
                  },
                  {
                    label: "অপেক্ষমাণ আবেদন",
                    sublabel: "Pending Review",
                    value: stats.pending,
                    hint: "যাচাইয়ের অপেক্ষায়",
                    tone: "text-amber-300",
                    action: () => handleSelectModule("suite-admission"),
                  },
                  {
                    label: "অনুমোদিত আবেদন",
                    sublabel: "Approved Cadets",
                    value: stats.approved,
                    hint: "কিউআর কার্ডের যোগ্য",
                    tone: "text-emerald-300",
                    action: () => handleSelectModule("suite-qr"),
                  },
                  {
                    label: "বাতিল আবেদন",
                    sublabel: "Rejected Applications",
                    value: stats.rejected,
                    hint: "বাতিলকৃত তালিকা",
                    tone: "text-rose-300",
                    action: () => handleSelectModule("suite-admission"),
                  },
                ].map((stat, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={stat.action}
                    className="text-left bg-[#061830] hover:bg-[#092040] border border-white/10 rounded-2xl p-5 space-y-1 transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-slate-300">{stat.label}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{stat.sublabel}</p>
                    <p className={`text-3xl font-black font-mono tabular-nums ${stat.tone}`}>
                      {stat.value}
                    </p>
                    <p className="text-[11px] text-[#C5A059]">{stat.hint}</p>
                  </button>
                ))}
              </div>

              {/* Centralized Exam & Admission Suite Directory Cards */}
              <div className="bg-[#061830] border border-[#C5A059]/30 rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <FolderKanban size={18} className="text-[#C5A059]" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-white">
                      EXAM & ADMISSION SUITE — Centralized Control Folder
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Unified Single-Session Access</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#020B18] border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-mono text-[#C5A059]">01. EXAM PORTAL</p>
                      <h3 className="text-base font-bold text-white">Exam Control & Visibility</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Toggle public Exam Portal visibility, manage Question Bank, exam lifecycle states, answer scripts & leaderboards.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectModule("suite-exam")}
                      className="w-full py-2.5 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Open Exam Portal <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="bg-[#020B18] border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-emerald-400">02. ADMISSION PORTAL</p>
                        {admissionsList.length > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                            {admissionsList.length} admissions
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white">Admission Management</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Online & offline applicants, open/close admission forms, physical BMI verification, circulars, guides & merit list.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectModule("suite-admission")}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Open Admission Portal <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="bg-[#020B18] border border-white/10 rounded-xl p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-xs font-mono text-cyan-400">03. ADMISSION QR PORTAL</p>
                      <h3 className="text-base font-bold text-white">QR Generator & Verifier</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Generate Application/Candidate/Admit QRs, revoke or rotate QR tokens, scan cards live, and export attendance Excel.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectModule("suite-qr")}
                      className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Open QR Portal <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Analytics Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#061830] p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-5">
                    <PieChartIcon className="text-[#C5A059]" size={18} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Applicant Status Distribution
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Pending", value: stats.pending },
                            { name: "Approved", value: stats.approved },
                            { name: "Rejected", value: stats.rejected },
                          ]}
                          innerRadius={55}
                          outerRadius={78}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          <Cell fill="#f59e0b" />
                          <Cell fill="#10b981" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020B18",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "10px",
                          }}
                        />
                        <Legend verticalAlign="bottom" height={32} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#061830] p-6 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-2 mb-5">
                    <Activity className="text-[#C5A059]" size={18} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      Blood Group Readiness
                    </h3>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => ({
                          group: bg,
                          count: applicants.filter((a) => a.bloodGroup === bg).length,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="group" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#020B18",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "10px",
                          }}
                        />
                        <Bar dataKey="count" fill="#C5A059" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE 2: WEBSITE MANAGEMENT */}
          {activeModule === "website" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    key: "examPortalOpen" as const,
                    title: "Public Exam Portal (/exam)",
                    desc: "Show/hide Exam Portal in public navigation and allow/block candidate access.",
                    val: cmsSettings.examPortalOpen !== false,
                  },
                  {
                    key: "enrollmentOpen" as const,
                    title: "Online Admission Portal (/enroll)",
                    desc: "Allow prospective cadets to submit new online enrollment applications.",
                    val: cmsSettings.enrollmentOpen !== false,
                  },
                  {
                    key: "offlineFormOpen" as const,
                    title: "Offline Application Form (/offline-application)",
                    desc: "Allow public printing and Legal PDF download of the offline enrollment form.",
                    val: cmsSettings.offlineFormOpen !== false,
                  },
                  {
                    key: "noticeTickerEnabled" as const,
                    title: "Homepage Live Notice Ticker",
                    desc: "Display scrolling official notice ribbon at top of the public portal.",
                    val: cmsSettings.noticeTickerEnabled !== false,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="bg-[#061830] border border-white/10 rounded-2xl p-5 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={savingWebsiteToggle}
                      onClick={() => void toggleSettingFlag(item.key, !item.val)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        item.val ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                      }`}
                    >
                      <Power size={13} />
                      {item.val ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Public Pages & Quick Shortcuts</h3>
                    <p className="text-xs text-slate-400">Open live public endpoints or jump to Content Management</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectModule("content")}
                    className="px-4 py-2 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer"
                  >
                    Open CMS Editor
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Homepage", path: "/" },
                    { label: "Online Enroll", path: "/enroll" },
                    { label: "Offline Form", path: "/offline-application" },
                    { label: "Exam Portal", path: "/exam" },
                    { label: "QR Verifier", path: "/qr-scan" },
                    { label: "Notice Board", path: "/notices" },
                    { label: "Gallery", path: "/gallery" },
                    { label: "Contact Page", path: "/contact" },
                  ].map((route) => (
                    <Link
                      key={route.path}
                      to={route.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#020B18] hover:bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-slate-200 font-semibold"
                    >
                      <span>{route.label}</span>
                      <ExternalLink size={13} className="text-[#C5A059]" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 3: CONTENT MANAGEMENT */}
          {activeModule === "content" && <CMSControlCenter />}

          {/* MODULE 4: USER & ADMIN MANAGEMENT */}
          {activeModule === "users" && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Admin Roles & Access Control</h2>
                  <p className="text-xs text-slate-400">Manage sub-admins, QR inspectors, and granular permissions</p>
                </div>
                {adminSession?.role === "super_admin" && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleGenerateQrAdmin}
                      disabled={creatingAdmin}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {creatingAdmin ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                      Generate QR Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAdmin(true)}
                      className="px-4 py-2.5 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={14} /> Add Admin
                    </button>
                  </div>
                )}
              </div>

              <div className="bg-[#061830] border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                        <th className="py-3.5 px-4 font-bold uppercase">Admin Name</th>
                        <th className="py-3.5 px-4 font-bold uppercase">Username</th>
                        <th className="py-3.5 px-4 font-bold uppercase">Role</th>
                        <th className="py-3.5 px-4 font-bold uppercase">Created</th>
                        <th className="py-3.5 px-4 font-bold uppercase text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      <tr className="bg-white/[0.02]">
                        <td className="py-3.5 px-4 font-bold text-white">Super Admin (Primary)</td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">admin</td>
                        <td className="py-3.5 px-4 font-bold text-emerald-400">SUPER_ADMIN</td>
                        <td className="py-3.5 px-4 text-slate-400">Permanent</td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQrAdmin({
                                id: "super_admin",
                                username: "admin",
                                name: "Super Admin",
                                role: "super_admin",
                              });
                              setIsQrModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-[#C5A059] cursor-pointer"
                            title="Generate Admin Login QR"
                          >
                            <QrCode size={15} />
                          </button>
                        </td>
                      </tr>
                      {admins.map((adm) => (
                        <tr key={adm.id} className="hover:bg-white/[0.03]">
                          <td className="py-3.5 px-4 font-bold text-white">{adm.name}</td>
                          <td className="py-3.5 px-4 font-mono text-slate-300">{adm.username}</td>
                          <td className="py-3.5 px-4 font-bold text-[#C5A059]">
                            {adm.role ? adm.role.replace("_", " ").toUpperCase() : "ADMIN"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400 font-mono">
                            {adm.createdAt?.toDate
                              ? adm.createdAt.toDate().toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedQrAdmin({
                                  id: adm.id,
                                  username: adm.username,
                                  name: adm.name,
                                  role: adm.role || "admin",
                                });
                                setIsQrModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#C5A059] cursor-pointer"
                              title="QR Login Token"
                            >
                              <QrCode size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAdminId(adm.id);
                                setEditPermissions(
                                  adm.permissions || {
                                    canAdd: false,
                                    canEdit: true,
                                    canDelete: false,
                                    canViewLogs: true,
                                    canResetPW: false,
                                    canApprove: true,
                                    canExport: false,
                                    canChat: true,
                                  }
                                );
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 cursor-pointer"
                              title="Edit Permissions"
                            >
                              <Settings size={14} />
                            </button>
                            {confirmDeleteAdminId === adm.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void deleteAdmin(adm.id)}
                                  className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAdminId(null)}
                                  className="p-1 text-slate-400 cursor-pointer"
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAdminId(adm.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white cursor-pointer"
                                title="Remove Admin"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* UID-Linked Portal Users (Firebase Auth /users/{uid}) */}
              <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users size={16} className="text-[#C5A059]" />
                      Registered Portal Users (Firebase Auth UID)
                      <span className="text-[11px] font-mono text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded-lg">
                        {usersList.length}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Live directory of users linked by Firebase Authentication UID with role-based access control
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search name, email, UID..."
                      className="bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#C5A059]"
                    />
                    <select
                      value={userRoleFilter}
                      onChange={(e) => setUserRoleFilter(e.target.value)}
                      className="bg-[#020B18] border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#C5A059]"
                    >
                      <option value="all">All Roles</option>
                      <option value="super_admin">super_admin</option>
                      <option value="admin">admin</option>
                      <option value="moderator">moderator</option>
                      <option value="cadet">cadet</option>
                      <option value="user">user</option>
                    </select>
                  </div>
                </div>

                {usersList.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">
                    {firebaseUser
                      ? "No UID-linked user profiles created yet. Users will appear here automatically upon Firebase Sign-In."
                      : "Sign in with Firebase Super Admin / Admin account to view live UID-linked users."}
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-white/10 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#020B18] text-slate-400 border-b border-white/10">
                          <th className="py-3 px-4 font-bold uppercase">User / UID</th>
                          <th className="py-3 px-4 font-bold uppercase">Email</th>
                          <th className="py-3 px-4 font-bold uppercase">Cadet / App ID</th>
                          <th className="py-3 px-4 font-bold uppercase">Role</th>
                          <th className="py-3 px-4 font-bold uppercase">Status</th>
                          <th className="py-3 px-4 font-bold uppercase text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {usersList
                          .filter((u) => {
                            if (userRoleFilter !== "all" && u.role !== userRoleFilter) return false;
                            if (!userSearch.trim()) return true;
                            const q = userSearch.trim().toLowerCase();
                            return (
                              String(u.displayName || "").toLowerCase().includes(q) ||
                              String(u.email || "").toLowerCase().includes(q) ||
                              String(u.uid || u.id || "").toLowerCase().includes(q) ||
                              String(u.applicantId || u.registrationNumber || "").toLowerCase().includes(q)
                            );
                          })
                          .map((u) => {
                            const uid = u.uid || u.id;
                            const isTargetSuper = u.role === "super_admin";
                            const canModifyUser =
                              adminSession?.role === "super_admin" ||
                              (adminSession?.role === "admin" && !isTargetSuper);
                            const isActiveAccount = u.accountStatus !== "Suspended" && u.isActive !== false;
                            return (
                              <tr key={uid} className="hover:bg-white/[0.03]">
                                <td className="py-3 px-4">
                                  <p className="font-bold text-white">{u.displayName || "BNCC User"}</p>
                                  <p className="text-[10px] font-mono text-slate-400 truncate max-w-[180px]" title={uid}>
                                    {uid}
                                  </p>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-300">{u.email || "—"}</td>
                                <td className="py-3 px-4 font-mono text-[#C5A059]">
                                  {u.registrationNumber || u.applicantId || "—"}
                                </td>
                                <td className="py-3 px-4">
                                  {canModifyUser && !isTargetSuper ? (
                                    <select
                                      value={u.role || "user"}
                                      disabled={updatingUserUid === uid}
                                      onChange={(e) =>
                                        void handleUpdateUserRole(u, normalizeRole(e.target.value))
                                      }
                                      className="bg-[#020B18] border border-white/15 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-[#C5A059] disabled:opacity-50"
                                    >
                                      <option value="user">user</option>
                                      <option value="cadet">cadet</option>
                                      <option value="moderator">moderator</option>
                                      <option value="admin">admin</option>
                                    </select>
                                  ) : (
                                    <span className="font-bold uppercase text-[#C5A059]">
                                      {u.role || "user"}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isActiveAccount
                                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                        : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                    }`}
                                  >
                                    {isActiveAccount ? "Active" : "Suspended"}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {canModifyUser && !isTargetSuper ? (
                                    <button
                                      type="button"
                                      disabled={updatingUserUid === uid}
                                      onClick={() => void handleToggleUserAccountStatus(u)}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                                        isActiveAccount
                                          ? "bg-rose-500/15 hover:bg-rose-600 text-rose-200 hover:text-white"
                                          : "bg-emerald-500/15 hover:bg-emerald-600 text-emerald-200 hover:text-white"
                                      }`}
                                    >
                                      {updatingUserUid === uid
                                        ? "Saving..."
                                        : isActiveAccount
                                        ? "Suspend"
                                        : "Activate"}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-slate-500">Protected</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white">Cadet Profile Change Approvals</h3>
                <PendingProfileApprovals adminSession={adminSession} />
              </div>
            </div>
          )}

          {/* MODULE 5: MEDIA MANAGEMENT */}
          {activeModule === "media" && (
            <MediaManager
              applicants={applicants}
              uploadedBy={adminSession?.username || adminSession?.name || "admin"}
              onNotify={showToast}
            />
          )}

          {/* MODULE 6: SUITE 01 — EXAM PORTAL */}
          {activeModule === "suite-exam" && (
            <ExamPortalWorkspace
              actorId={adminSession?.id || adminSession?.username || "admin"}
              actorName={adminSession?.name || "Main Admin"}
              isSuperAdmin={adminSession?.role === "super_admin"}
              onNotify={showToast}
            />
          )}

          {/* MODULE 7: SUITE 02 — ADMISSION MANAGEMENT PORTAL */}
          {activeModule === "suite-admission" && (
            <AdmissionPortalWorkspace
              applicants={applicants}
              loadingApplicants={loading}
              applicantsError={applicantsError}
              onRefreshApplicants={() => void fetchServerApplicants(false)}
              adminSession={adminSession}
              onUpdateStatus={updateStatus}
              onToggleActivation={toggleAccountActivation}
              onDeleteApplicant={deleteApplicant}
              onBulkAction={handleBulkAction}
              onOpenPasswordReset={(id) => setShowPasswordReset(id)}
              onLoginAsUser={handleAdminLoginAsUser}
              onExportExcel={exportToExcel}
              onExportJson={exportJsonBackup}
              onDownloadPhotosZip={downloadPhotosZip}
              onRunAiInsights={runAiInsights}
              aiInsights={aiInsights}
              onClearAiInsights={() => setAiInsights("")}
              isAnalyzingInsights={isAnalyzingInsights}
              onRunApplicantSummary={runApplicantSummary}
              applicantSummaries={applicantSummaries}
              loadingSummaryId={loadingSummaryId}
              onNotify={showToast}
            />
          )}

          {/* MODULE 8: SUITE 03 — ADMISSION QR PORTAL */}
          {activeModule === "suite-qr" && (
            <AdmissionQrWorkspace
              applicants={applicants}
              adminSession={adminSession}
              onNotify={showToast}
            />
          )}

          {/* MODULE 9: NOTIFICATIONS & INQUIRIES */}
          {activeModule === "notifications" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-6 bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Megaphone size={18} className="text-[#C5A059]" />
                  {editingNotificationId ? "Edit Broadcast Notice" : "Create Broadcast Notice"}
                </h2>
                <div className="space-y-3 text-xs">
                  <input
                    type="text"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="Notice title (e.g., Mandatory Parade Practice)"
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-3 text-white outline-none focus:border-[#C5A059]"
                  />
                  <textarea
                    rows={5}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Write official announcement..."
                    className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-3 text-white outline-none focus:border-[#C5A059] resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    {["Announcement", "Alert", "Message"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBroadcastType(type)}
                        className={`px-3.5 py-2 rounded-xl font-bold cursor-pointer ${
                          broadcastType === type
                            ? "bg-[#C5A059] text-[#002147]"
                            : "bg-[#020B18] text-slate-300 border border-white/15"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    {editingNotificationId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNotificationId(null);
                          setBroadcastTitle("");
                          setBroadcastMessage("");
                        }}
                        className="px-4 py-2.5 bg-white/10 text-white rounded-xl font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                      onClick={() => void handleBroadcast()}
                      className="flex-1 py-2.5 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl font-black cursor-pointer disabled:opacity-50"
                    >
                      {sendingBroadcast
                        ? "Saving..."
                        : editingNotificationId
                        ? "Update Notice"
                        : "Send Broadcast to All Cadets"}
                    </button>
                  </div>
                </div>

                {/* Published List */}
                <div className="pt-4 border-t border-white/10 space-y-3 max-h-[380px] overflow-y-auto">
                  {notifications
                    .filter((n) => n.targetId === "ALL")
                    .map((notif) => (
                      <div
                        key={notif.id}
                        className="p-4 bg-[#020B18] border border-white/10 rounded-xl space-y-1.5 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-white">{notif.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {notif.type} ·{" "}
                              {notif.timestamp?.toDate
                                ? notif.timestamp.toDate().toLocaleString()
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNotificationId(notif.id);
                                setBroadcastTitle(notif.title);
                                setBroadcastMessage(notif.message);
                                setBroadcastType(notif.type);
                              }}
                              className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
                            >
                              <Edit size={13} />
                            </button>
                            {confirmDeleteBroadcastId === notif.id ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteBroadcast(notif.id)}
                                className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteBroadcastId(notif.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-300">{notif.message}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Public Contact Inquiries */}
              <div className="lg:col-span-6 bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail size={18} className="text-[#C5A059]" />
                    <h2 className="text-base font-bold text-white">
                      Public Contact Inquiries (/contact)
                    </h2>
                    {unreadInquiriesCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {unreadInquiriesCount} Unread
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadContactInquiries()}
                    disabled={loadingInquiries}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} className={loadingInquiries ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>

                {inquiries.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-400">
                    No contact form submissions received yet. New messages from /contact stream here in real time.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {inquiries.map((inq) => {
                      const status = inq.status || "unread";
                      const createdMs = inq._createdAtMs || resolveGenericCreatedMs(inq);
                      return (
                        <div
                          key={inq.id}
                          className={`p-4 bg-[#020B18] border rounded-xl space-y-2 text-xs ${
                            status === "unread" ? "border-[#C5A059]/45" : "border-white/10"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2 font-mono text-[#C5A059]">
                              <span>{inq.id}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-sans text-[10px] font-bold uppercase ${
                                  status === "unread"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : status === "replied"
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : status === "resolved"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-slate-700 text-slate-200"
                                }`}
                              >
                                {status}
                              </span>
                            </div>
                            <span className="text-slate-400">
                              {createdMs > 0 ? new Date(createdMs).toLocaleString() : "Just now"}
                            </span>
                          </div>
                          <p className="font-bold text-white">{inq.subject}</p>
                          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{inq.message}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                            <p className="text-[11px] text-slate-400">
                              {inq.name} · {inq.phone} {inq.email ? `· ${inq.email}` : ""}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {status === "unread" && (
                                <button
                                  type="button"
                                  disabled={inquiryUpdatingId === inq.id}
                                  onClick={() => void handleUpdateInquiryStatus(inq.id, "read")}
                                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[10px] font-bold cursor-pointer"
                                >
                                  Mark Read
                                </button>
                              )}
                              {status !== "replied" && status !== "resolved" && (
                                <button
                                  type="button"
                                  disabled={inquiryUpdatingId === inq.id}
                                  onClick={() => void handleUpdateInquiryStatus(inq.id, "replied")}
                                  className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-600 text-cyan-200 hover:text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Replied
                                </button>
                              )}
                              {status !== "resolved" && (
                                <button
                                  type="button"
                                  disabled={inquiryUpdatingId === inq.id}
                                  onClick={() => void handleUpdateInquiryStatus(inq.id, "resolved")}
                                  className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-600 text-emerald-200 hover:text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Resolve
                                </button>
                              )}
                              {(adminSession?.role === "super_admin" || adminSession?.role === "admin") &&
                                (confirmDeleteInquiryId === inq.id ? (
                                  <button
                                    type="button"
                                    disabled={inquiryUpdatingId === inq.id}
                                    onClick={() => void handleDeleteInquiry(inq.id)}
                                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteInquiryId(inq.id)}
                                    className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                                    title="Delete inquiry"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODULE 10: ACTIVITY LOGS */}
          {activeModule === "logs" && (
            <AuditLogs
              logs={logs.map((l) => ({
                id: l.id,
                type: l.type,
                details: l.details,
                timestamp: l.timestamp?.toDate
                  ? l.timestamp.toDate().toISOString()
                  : new Date().toISOString(),
                actorName: l.actorId,
                severity:
                  l.type?.includes("DELETE") ||
                  l.type?.includes("REJECT") ||
                  l.type?.includes("REVOKE")
                    ? "error"
                    : "info",
              }))}
            />
          )}

          {/* MODULE 11: SETTINGS & BACKUPS */}
          {activeModule === "settings" && (
            <div className="space-y-6">
              <div className="bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-white">Portal Settings & Full Data Backups</h2>
                  <p className="text-xs text-slate-400">
                    Institutional configuration and full JSON/Excel export tools
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={exportToExcel}
                    className="p-4 bg-[#020B18] hover:bg-white/5 border border-white/10 rounded-xl text-left space-y-1 cursor-pointer"
                  >
                    <FileSpreadsheet size={18} className="text-[#C5A059]" />
                    <p className="text-sm font-bold text-white">Export Applicants (.xlsx)</p>
                    <p className="text-xs text-slate-400">Download full spreadsheet ledger</p>
                  </button>
                  <button
                    type="button"
                    onClick={exportJsonBackup}
                    className="p-4 bg-[#020B18] hover:bg-white/5 border border-white/10 rounded-xl text-left space-y-1 cursor-pointer"
                  >
                    <Download size={18} className="text-[#C5A059]" />
                    <p className="text-sm font-bold text-white">Full JSON Snapshot</p>
                    <p className="text-xs text-slate-400">Applicants & broadcast notifications</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPhotosZip()}
                    className="p-4 bg-[#020B18] hover:bg-white/5 border border-white/10 rounded-xl text-left space-y-1 cursor-pointer"
                  >
                    <Archive size={18} className="text-[#C5A059]" />
                    <p className="text-sm font-bold text-white">Candidate Photos ZIP</p>
                    <p className="text-xs text-slate-400">Bundle all applicant portraits</p>
                  </button>
                </div>
              </div>

              {/* Cloud Firestore Full Sync & Live Collection Monitor */}
              <div className="bg-[#061830] border border-white/10 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Database size={18} className="text-[#C5A059]" />
                      <span>Cloud Firestore Database Sync (cbcc-bncc-portal-db)</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      ওয়েবসাইটের সকল CMS কন্টেন্ট, ক্যাডেট তথ্য, নোটিশ, মিডিয়া ক্যাটালগ, নির্দেশিকা, এক্সাম ও সার্ভার রেকর্ড সরাসরি ক্লাউড ডাটাবেসে সংরক্ষণ ও যাচাই করুন
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadDatabaseStats()}
                      disabled={loadingDbStats || !firebaseUser}
                      className="px-3.5 py-2 bg-[#020B18] hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw size={14} className={loadingDbStats ? "animate-spin" : ""} />
                      <span>Refresh Counts</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleFullDatabaseSync(false)}
                      disabled={dbSyncing || !firebaseUser}
                      className="px-4 py-2 bg-[#C5A059] hover:bg-[#d4b06a] text-[#00152e] rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {dbSyncing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
                      <span>{dbSyncing ? "Syncing All Data..." : "Sync All Missing Data to Database"}</span>
                    </button>
                  </div>
                </div>

                {!firebaseUser && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
                    Cloud Firestore-এ ডাটা পুশ করতে অনুগ্রহ করে Firebase ইমেইল ও পাসওয়ার্ড অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করুন।
                  </div>
                )}

                {dbSyncProgress && (
                  <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs text-sky-200 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin shrink-0" />
                    <span>{dbSyncProgress}</span>
                  </div>
                )}

                {dbSyncResult && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 space-y-1">
                    <div className="font-bold">
                      Last Sync: {new Date(dbSyncResult.syncedAt).toLocaleString()} — Written/Verified {dbSyncResult.totalWritten} records
                    </div>
                    {dbSyncResult.warnings.length > 0 && (
                      <div className="text-amber-300 text-[11px]">
                        Warnings: {dbSyncResult.warnings.join(" | ")}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {dbStats.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-400">
                      {loadingDbStats
                        ? "ডাটাবেস কালেকশন সংখ্যা লোড হচ্ছে..."
                        : "সংখ্যা দেখতে 'Refresh Counts' বা 'Sync All Missing Data' ক্লিক করুন।"}
                    </div>
                  ) : (
                    dbStats.map((stat) => (
                      <div
                        key={stat.collection}
                        className="p-3 bg-[#020B18] border border-white/10 rounded-xl space-y-1"
                      >
                        <div className="text-[11px] font-bold text-slate-300 truncate" title={stat.label}>
                          {stat.label}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-500 truncate">
                            {stat.collection}
                          </span>
                          <span
                            className={`text-sm font-black ${
                              stat.count > 0
                                ? "text-emerald-400"
                                : stat.count === 0
                                ? "text-slate-500"
                                : "text-rose-400"
                            }`}
                          >
                            {stat.count >= 0 ? stat.count : "N/A"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODULE 12: SECURITY & PASSWORD RESETS */}
          {activeModule === "security" && (
            <div className="space-y-6">
              <div className="bg-[#061830] border border-white/10 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white">Admin Session &amp; Security Status</h2>
                  <p className="text-xs text-slate-400">
                    Session: {adminSession?.username || adminSession?.id} ({adminSession?.role})
                    {firebaseUser?.email ? ` · ${firebaseUser.email}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadServerPasswordResets()}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={13} /> Refresh Security Alerts
                  </button>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle size={14} /> Active Session
                  </span>
                </div>
              </div>

              {adminSession?.role === "super_admin" && (
                <div className="bg-[#061830] border border-[#C5A059]/30 rounded-2xl p-5 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Key size={15} className="text-[#C5A059]" />
                      Set Server Credential Password (username: admin)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      সার্ভার ভল্টে <code className="text-[#C5A059]">admin</code> ইউজারনেমের জন্য bcrypt-হ্যাশড পাসওয়ার্ড নির্ধারণ করুন (পরিবেশ ভ্যারিয়েবল না থাকলে এটি ব্যবহৃত হবে)।
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={serverAdminPwInput}
                      onChange={(e) => setServerAdminPwInput(e.target.value)}
                      placeholder="New strong password (min 8 chars)"
                      className="flex-1 bg-[#020B18] border border-white/15 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-[#C5A059]"
                    />
                    <button
                      type="button"
                      disabled={savingServerAdminPw || serverAdminPwInput.trim().length < 8}
                      onClick={async () => {
                        setSavingServerAdminPw(true);
                        try {
                          const headers = await getServerAuthHeaders({
                            "Content-Type": "application/json",
                          });
                          const res = await fetch("/api/auth/staff", {
                            method: "POST",
                            headers,
                            credentials: "include",
                            body: JSON.stringify({
                              id: "admin",
                              username: "admin",
                              name: "Platoon Commander",
                              role: "super_admin",
                              plainPassword: serverAdminPwInput.trim(),
                              isActive: true,
                            }),
                          });
                          if (res.ok) {
                            setServerAdminPwInput("");
                            showToast("সার্ভার admin ক্রেডেনশিয়াল পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে।");
                          } else {
                            const d = await res.json().catch(() => null);
                            showToast(d?.error || "পাসওয়ার্ড সেট করা যায়নি।", "error");
                          }
                        } finally {
                          setSavingServerAdminPw(false);
                        }
                      }}
                      className="px-4 py-2.5 bg-[#C5A059] hover:bg-[#d4b06a] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
                    >
                      {savingServerAdminPw ? "Saving..." : "Save Admin Password"}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Password Reset &amp; Officer-Assisted Recovery Requests ({mergedPasswordResets.length})
                </h3>
                {mergedPasswordResets.length === 0 ? (
                  <div className="bg-[#061830] border border-white/10 rounded-2xl p-12 text-center text-xs text-slate-400">
                    No active password reset verification requests.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {mergedPasswordResets.map((reset: any) => {
                      const isPending = String(reset.status || "").toLowerCase() === "pending";
                      return (
                        <div
                          key={reset.id}
                          className="bg-[#061830] border border-white/10 rounded-2xl p-5 space-y-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white truncate">{reset.name || reset.identifier}</span>
                            <span
                              className={`font-bold shrink-0 ${
                                isPending ? "text-rose-400" : "text-emerald-400"
                              }`}
                            >
                              {isPending ? "Pending" : "Resolved"}
                            </span>
                          </div>
                          <p className="font-mono text-slate-400">
                            ID: {reset.applicantId || reset.identifier} · {reset.mobile}
                          </p>
                          {reset.note && (
                            <p className="text-slate-300 bg-[#020B18] border border-white/10 rounded-xl p-2.5 leading-relaxed">
                              {reset.note}
                            </p>
                          )}
                          {reset.photo && (
                            <img
                              src={reset.photo}
                              alt="Security snapshot"
                              referrerPolicy="no-referrer"
                              className="w-full h-36 object-cover rounded-xl bg-black"
                            />
                          )}
                          <p className="text-[11px] text-slate-400 font-mono">
                            IP: {reset.ipAddress || "N/A"}
                            {reset.latitude && reset.longitude && (
                              <>
                                {" · "}
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${reset.latitude},${reset.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#C5A059] underline"
                                >
                                  Map Location
                                </a>
                              </>
                            )}
                          </p>
                          {isPending && (
                            <div className="flex gap-2 pt-2 border-t border-white/10">
                              {confirmDismissResetId === reset.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (firebaseUser && reset._fromFirestore) {
                                      await deleteDoc(doc(db, "password_resets", reset.id)).catch(() => {});
                                    }
                                    if (reset._fromServer) {
                                      const delHeaders = await getServerAuthHeaders();
                                      await fetch(`/api/auth/password-resets/${encodeURIComponent(reset.id)}`, {
                                        method: "DELETE",
                                        headers: delHeaders,
                                        credentials: "include",
                                      }).catch(() => {});
                                      setServerPasswordResets((prev) => prev.filter((r) => r.id !== reset.id));
                                    }
                                    setConfirmDismissResetId(null);
                                    showToast("রিসেট অনুরোধ বাতিল করা হয়েছে।");
                                  }}
                                  className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold cursor-pointer"
                                >
                                  Confirm Dismiss
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDismissResetId(reset.id)}
                                  className="flex-1 py-2 bg-white/10 text-slate-200 rounded-xl font-bold cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  if (firebaseUser && reset._fromFirestore) {
                                    await updateDoc(doc(db, "password_resets", reset.id), {
                                      status: "resolved",
                                      resolvedAt: Timestamp.now(),
                                    }).catch(() => {});
                                  }
                                  if (reset._fromServer) {
                                    const patchHeaders = await getServerAuthHeaders({
                                      "Content-Type": "application/json",
                                    });
                                    await fetch(`/api/auth/password-resets/${encodeURIComponent(reset.id)}`, {
                                      method: "PATCH",
                                      headers: patchHeaders,
                                      credentials: "include",
                                      body: JSON.stringify({ status: "resolved" }),
                                    }).catch(() => {});
                                    setServerPasswordResets((prev) =>
                                      prev.map((r) => (r.id === reset.id ? { ...r, status: "resolved" } : r))
                                    );
                                  }
                                  showToast("রিসেট অনুরোধ Resolved হিসেবে চিহ্নিত হয়েছে।");
                                }}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-bold cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {showPasswordReset && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#061830] border border-white/15 p-6 rounded-2xl space-y-5 shadow-2xl">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Reset Cadet Password</h3>
              <p className="text-xs font-mono text-slate-400">ID: {showPasswordReset}</p>
            </div>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new temporary password"
              className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#C5A059]"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordReset(null)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting || !newPassword}
                onClick={() => void handleResetPassword()}
                className="flex-1 py-2.5 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {resetting ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin QR Modal */}
      {selectedQrAdmin && (
        <AdminQrCodeModal
          isOpen={isQrModalOpen}
          onClose={() => {
            setIsQrModalOpen(false);
            setSelectedQrAdmin(null);
          }}
          admin={selectedQrAdmin}
        />
      )}

      {/* Add Admin Modal */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#061830] border border-white/15 p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Create Sub-Admin</h3>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Full Name"
                className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Username"
                className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-2.5 text-white"
              />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-2.5 text-white"
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                {Object.keys(adminPermissions).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(adminPermissions as any)[k]}
                      onChange={(e) =>
                        setAdminPermissions((p) => ({ ...p, [k]: e.target.checked }))
                      }
                    />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAdmin(false)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingAdmin || !adminName || !adminUsername || !adminPassword}
                onClick={() => void handleCreateAdmin()}
                className="flex-1 py-2.5 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {creatingAdmin ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Permissions Modal */}
      {editingAdminId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#061830] border border-white/15 p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Edit Admin Permissions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.keys(editPermissions || {}).map((k) => (
                <label key={k} className="flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editPermissions?.[k])}
                    onChange={(e) =>
                      setEditPermissions((p: any) => ({ ...p, [k]: e.target.checked }))
                    }
                  />
                  <span>{k}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingAdminId(null)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingPermissions}
                onClick={() => void handleUpdatePermissions()}
                className="flex-1 py-2.5 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {updatingPermissions ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated QR Admin Credentials Modal */}
      {generatedCredentials && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#061830] border border-[#C5A059]/40 p-6 rounded-2xl space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">QR Admin Credentials Generated</h3>
            <div className="bg-[#020B18] p-4 rounded-xl border border-white/10 space-y-2 text-xs font-mono">
              <p className="text-slate-400">
                Username: <strong className="text-white select-all">{generatedCredentials.username}</strong>
              </p>
              <p className="text-slate-400">
                Password: <strong className="text-[#C5A059] select-all">{generatedCredentials.password}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneratedCredentials(null)}
              className="w-full py-2.5 bg-[#C5A059] text-[#002147] rounded-xl text-xs font-black cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Quick Server Session Re-Verification Modal */}
      {showReauthModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#061830] border border-[#C5A059]/40 p-6 rounded-2xl space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-[#C5A059]" />
                অ্যাডমিন সেশন যাচাই করুন
              </h3>
              <button
                type="button"
                onClick={() => setShowReauthModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              অ্যাকাউন্ট: <span className="font-mono text-[#C5A059] font-bold">{adminSession?.username || adminSession?.email || "admin"}</span> — সার্ভার থেকে সকল আবেদন ও তথ্য লোড করতে পাসওয়ার্ড দিন।
            </p>
            {reauthError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 font-semibold">
                {reauthError}
              </div>
            )}
            <input
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleQuickReauth();
              }}
              placeholder="অ্যাডমিন পাসওয়ার্ড লিখুন"
              className="w-full bg-[#020B18] border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#C5A059]"
              autoFocus
            />
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowReauthModal(false)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={reauthing || !reauthPassword.trim()}
                onClick={() => void handleQuickReauth()}
                className="flex-1 py-2.5 bg-[#C5A059] hover:bg-[#d4b068] text-[#002147] rounded-xl text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {reauthing ? "যাচাই হচ্ছে..." : "যাচাই ও লোড করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
