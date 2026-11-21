import { useState } from "react";
import {
  LayoutDashboard,
  Globe,
  FileEdit,
  Users,
  Image as ImageIcon,
  FolderKanban,
  Award,
  ClipboardCheck,
  QrCode,
  Bell,
  History,
  Settings,
  Shield,
  ChevronDown,
  ChevronRight,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";

export type AdminModuleId =
  | "overview"
  | "website"
  | "content"
  | "users"
  | "media"
  | "suite-exam"
  | "suite-admission"
  | "suite-qr"
  | "notifications"
  | "logs"
  | "settings"
  | "security";

export const ADMIN_MODULE_LABELS: Record<AdminModuleId, { title: string; subtitle: string; group: string }> = {
  overview: {
    title: "Dashboard Overview",
    subtitle: "Institutional telemetry, quick actions, and live portal overview",
    group: "MAIN ADMIN",
  },
  website: {
    title: "Website Management",
    subtitle: "Visibility toggles, portal controls, and live public page access",
    group: "MAIN ADMIN",
  },
  content: {
    title: "Content Management",
    subtitle: "Website Control Center (CMS) — sections, cadets, notices, gallery",
    group: "MAIN ADMIN",
  },
  users: {
    title: "User Management",
    subtitle: "Cadet accounts, admin roles, permissions, and profile approvals",
    group: "MAIN ADMIN",
  },
  media: {
    title: "Media Management",
    subtitle: "Centralized file vault, image optimization, usage tracking & URL copy",
    group: "MAIN ADMIN",
  },
  "suite-exam": {
    title: "01. Exam Portal",
    subtitle: "Public visibility gate, question bank, exams lifecycle, scripts & results",
    group: "EXAM & ADMISSION SUITE",
  },
  "suite-admission": {
    title: "02. Admission Management Portal",
    subtitle: "Online/offline applicants, physical verification, circulars & guides",
    group: "EXAM & ADMISSION SUITE",
  },
  "suite-qr": {
    title: "03. Admission QR Portal",
    subtitle: "Live QR verification, card generator, revocation & field attendance storage",
    group: "EXAM & ADMISSION SUITE",
  },
  notifications: {
    title: "Notifications & Broadcast",
    subtitle: "Cadet announcements, urgent alerts, and public contact inquiries",
    group: "SYSTEM",
  },
  logs: {
    title: "Activity Logs",
    subtitle: "Immutable administrative and security audit trail",
    group: "SYSTEM",
  },
  settings: {
    title: "Settings & Backups",
    subtitle: "Institutional metadata, data exports, and configuration",
    group: "SYSTEM",
  },
  security: {
    title: "Security & Alerts",
    subtitle: "Password reset alerts, session status, and access controls",
    group: "SYSTEM",
  },
};

interface AdminSidebarProps {
  activeModule: AdminModuleId;
  onSelectModule: (id: AdminModuleId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  adminName?: string;
  adminRole?: string;
  pendingApplicantsCount?: number;
  pendingResetsCount?: number;
  canViewLogs?: boolean;
  isSuperAdmin?: boolean;
  onLogout: () => void;
}

const SUITE_EXPANDED_KEY = "cbcc_admin_suite_expanded_v1";

export function AdminSidebar({
  activeModule,
  onSelectModule,
  mobileOpen,
  onCloseMobile,
  adminName = "Main Admin",
  adminRole = "super_admin",
  pendingApplicantsCount = 0,
  pendingResetsCount = 0,
  canViewLogs = true,
  isSuperAdmin = true,
  onLogout,
}: AdminSidebarProps) {
  const [suiteExpanded, setSuiteExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(SUITE_EXPANDED_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const toggleSuite = () => {
    const next = !suiteExpanded;
    setSuiteExpanded(next);
    try {
      localStorage.setItem(SUITE_EXPANDED_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const handleNav = (id: AdminModuleId) => {
    onSelectModule(id);
    onCloseMobile();
  };

  const mainAdminItems: Array<{ id: AdminModuleId; label: string; icon: any; badge?: number }> = [
    { id: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "website", label: "Website Management", icon: Globe },
    { id: "content", label: "Content Management", icon: FileEdit },
    { id: "users", label: "User Management", icon: Users },
    { id: "media", label: "Media Management", icon: ImageIcon },
  ];

  const suiteItems: Array<{ id: AdminModuleId; label: string; icon: any; badge?: number }> = [
    { id: "suite-exam", label: "01. Exam Portal", icon: Award },
    {
      id: "suite-admission",
      label: "02. Admission Management Portal",
      icon: ClipboardCheck,
      badge: pendingApplicantsCount > 0 ? pendingApplicantsCount : undefined,
    },
    { id: "suite-qr", label: "03. Admission QR Portal", icon: QrCode },
  ];

  const systemItems: Array<{
    id: AdminModuleId;
    label: string;
    icon: any;
    badge?: number;
    disabled?: boolean;
  }> = [
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "logs", label: "Activity Logs", icon: History, disabled: !canViewLogs },
    { id: "settings", label: "Settings", icon: Settings },
    {
      id: "security",
      label: "Security",
      icon: Shield,
      badge: pendingResetsCount > 0 ? pendingResetsCount : undefined,
    },
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col bg-[#031024] border-r border-white/10 text-slate-100 select-none">
      {/* Identity Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-wide text-[#C5A059] truncate">
            CBCC BNCC ADMIN
          </p>
          <p className="text-[11px] text-slate-400 truncate">Unified Control Ecosystem</p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main Admin Navigation">
        {/* Group 1: MAIN ADMIN */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            MAIN ADMIN
          </p>
          {mainAdminItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#C5A059] text-[#002147] font-bold shadow-sm"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className={active ? "text-[#002147] shrink-0" : "text-[#C5A059] shrink-0"} />
                  <span className="truncate">{item.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Group 2: EXAM & ADMISSION SUITE (Expandable Folder) */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={toggleSuite}
            aria-expanded={suiteExpanded}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-[0.14em] text-[#C5A059] hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <FolderKanban size={14} className="shrink-0" />
              <span className="truncate">EXAM & ADMISSION SUITE</span>
            </span>
            {suiteExpanded ? (
              <ChevronDown size={14} className="shrink-0" />
            ) : (
              <ChevronRight size={14} className="shrink-0" />
            )}
          </button>

          {suiteExpanded && (
            <div className="space-y-1 pl-2 border-l border-white/10 ml-3">
              {suiteItems.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? "bg-[#C5A059] text-[#002147] font-bold shadow-sm"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon size={15} className={active ? "text-[#002147] shrink-0" : "text-[#C5A059] shrink-0"} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${
                          active ? "bg-[#002147] text-[#C5A059]" : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Group 3: SYSTEM */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">
            SYSTEM
          </p>
          {systemItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  item.disabled
                    ? "opacity-40 cursor-not-allowed text-slate-500"
                    : active
                    ? "bg-[#C5A059] text-[#002147] font-bold shadow-sm cursor-pointer"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white cursor-pointer"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon size={16} className={active ? "text-[#002147] shrink-0" : "text-[#C5A059] shrink-0"} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-mono tabular-nums font-bold px-1.5 py-0.5 rounded ${
                      active ? "bg-[#002147] text-[#C5A059]" : "bg-rose-500/20 text-rose-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer Session Info */}
      <div className="p-3.5 border-t border-white/10 space-y-2.5 bg-[#020B18]">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-lg bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#C5A059] flex items-center justify-center text-xs font-bold shrink-0">
            {(adminName || "A")[0].toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">{adminName}</p>
            <p className="text-[10px] font-mono text-slate-400 truncate">
              {isSuperAdmin ? "Super Admin" : adminRole}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
          >
            <ExternalLink size={12} /> Public Site
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-2 px-2.5 bg-rose-500/15 hover:bg-rose-600 text-rose-200 hover:text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-rose-500/25 transition-colors cursor-pointer"
          >
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-[270px] shrink-0 sticky top-16 h-[calc(100vh-4rem)] z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
          />
          <aside className="relative w-[280px] max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
