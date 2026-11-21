import { Link, useLocation } from "react-router-dom";
import {
  Menu, X, Home, Users, Image as ImageIcon, Medal, UserPlus,
  MessageCircle, LogIn, FileText, BookOpen, Info, Activity,
  Phone, Bell, Globe, LayoutDashboard, ChevronDown, QrCode
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircularViewerModal } from "./modular/CircularViewerModal";
import { PWAInstallButton } from "./PWAInstallButton";
import { useCMS } from "../context/CMSContext";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { getDefaultLandingRoute, hasPermission } from "../lib/rbac";

export function Navbar() {
  const cms = useCMS();
  const { user, isAuthenticated } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isCircularModalOpen, setIsCircularModalOpen] = useState(false);
  const location = useLocation();
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(false);
    setIsMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const isExamPortalOpen = cms.settings.examPortalOpen !== false;

  const primaryLinks = [
    { name: t("navHome"), path: "/", icon: Home },
    { name: t("navActivities"), path: "/activities", icon: Activity },
    { name: t("navCadets"), path: "/cadets", icon: Users },
    { name: t("navNotices"), path: "/notices", icon: Bell },
    ...(isExamPortalOpen
      ? [{ name: t("navExamPortal"), path: "/exam", icon: BookOpen, highlight: true }]
      : []),
  ];

  const secondaryLinks = [
    { name: t("navAbout"), path: "/about", icon: Info },
    { name: t("navIncharges"), path: "/hall-of-incharges", icon: Medal },
    { name: t("navGallery"), path: "/gallery", icon: ImageIcon },
    { name: t("navGuide"), path: "/how-to-become-cadet", icon: BookOpen },
    { name: t("navOfflineForm"), path: "/offline-application", icon: FileText },
    { name: t("navQrScan"), path: "/qr-scan", icon: QrCode },
    { name: t("navContact"), path: "/contact", icon: Phone },
  ];

  const allDrawerLinks = [...primaryLinks, ...secondaryLinks];

  const canManageCms = hasPermission(user?.role, "manage_cms");

  const authLinks = [
    ...(canManageCms ? [{ name: "CMS", path: "/admin/cms", icon: Globe }] : []),
    ...(isAuthenticated ? [{ name: "Messenger", path: "/messenger", icon: MessageCircle }] : []),
    isAuthenticated && user
      ? { name: t("navDashboard"), path: getDefaultLandingRoute(user.role), icon: LayoutDashboard }
      : { name: t("navLogin"), path: "/login", icon: LogIn },
  ];

  const isSecondaryActive = secondaryLinks.some((item) => location.pathname === item.path);

  return (
    <header className="sticky top-0 z-50 bg-[#002147] border-b border-white/10 shadow-lg">
      <nav aria-label="Main navigation" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[70px] gap-4">
          {/* Zone 1: Institutional Crest & Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={cms.settings.collegeWebsite || "https://cbcc.edu.bd/"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cox's Bazar City College Website"
              className="shrink-0"
            >
              <img
                src={cms.settings.collegeLogoUrl || "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"}
                alt="Cox's Bazar City College Logo"
                className="h-9 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
            <Link to="/" className="hidden sm:flex flex-col whitespace-nowrap">
              <span className="text-white font-bold text-xs tracking-tight leading-none font-display">
                {cms.settings.siteTitleEn || "Cox's Bazar City College"}
              </span>
              <span className="text-[10px] text-[#C5A059] uppercase tracking-[0.18em] font-bold mt-1">
                BNCC Platoon
              </span>
            </Link>
            <a
              href={cms.settings.bnccCentralWebsite || "https://bncc.info/"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="BNCC Headquarters Website"
              className="shrink-0 border-l border-white/15 pl-2.5 ml-0.5"
            >
              <img
                src={cms.settings.bnccLogoUrl || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png"}
                alt="BNCC Logo"
                className="h-9 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Zone 2: Single-Line Core Links + More Dropdown (Desktop) */}
          <div className="hidden xl:flex items-center gap-1 whitespace-nowrap">
            {primaryLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold tracking-wide transition-colors rounded-lg whitespace-nowrap ${
                    link.highlight
                      ? "bg-[#C5A059]/15 text-[#f3d492] hover:bg-[#C5A059]/25 border border-[#C5A059]/40"
                      : isActive
                      ? "text-white bg-white/15"
                      : "text-slate-200 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <link.icon
                    size={14}
                    className={link.highlight ? "text-[#C5A059]" : isActive ? "text-white" : "text-slate-300"}
                  />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            {/* More Dropdown */}
            <div className="relative" ref={moreMenuRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                aria-expanded={isMoreOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold tracking-wide rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  isMoreOpen || isSecondaryActive
                    ? "text-white bg-white/15"
                    : "text-slate-200 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>{t("navMore")}</span>
                <ChevronDown size={14} className={`transition-transform duration-150 ${isMoreOpen ? "rotate-180" : ""}`} />
              </button>

              {isMoreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 bg-[#061830] border border-[#C5A059]/30 rounded-xl shadow-2xl py-2 z-50"
                >
                  {secondaryLinks.map((item) => {
                    const active = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        role="menuitem"
                        to={item.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-white/15 text-[#C5A059]"
                            : "text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <item.icon size={15} className="text-[#C5A059] shrink-0" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Zone 3: Language Switcher, Portal Auth & Action CTAs */}
          <div className="hidden xl:flex items-center gap-2.5 shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={lang === "bn" ? "Switch language to English" : "বাংলা ভাষায় পরিবর্তন করুন"}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 text-xs font-bold cursor-pointer transition-colors"
            >
              {lang === "bn" ? "EN" : "বাং"}
            </button>

            <PWAInstallButton compact />

            {authLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-100 hover:text-[#C5A059] hover:bg-white/5 text-xs font-semibold transition-colors"
              >
                <link.icon size={14} className="text-[#C5A059]" />
                <span>{link.name}</span>
              </Link>
            ))}

            <button
              id="navbar-circular-btn"
              type="button"
              onClick={() => setIsCircularModalOpen(true)}
              className="px-3 py-2 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#f3d492] border border-[#C5A059]/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              title="ভর্তি সার্কুলার দেখুন (View Admission Circular)"
            >
              <FileText size={13} className="text-[#C5A059]" />
              <span>{t("navCircular")}</span>
            </button>

            <Link
              to="/enroll"
              className="px-4 py-2 bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs rounded-lg transition-colors shadow-md flex items-center gap-1.5"
            >
              <UserPlus size={14} />
              <span>{t("navJoinUs")}</span>
            </Link>
          </div>

          {/* Mobile / Tablet Controls */}
          <div className="xl:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLang}
              aria-label={lang === "bn" ? "Switch language to English" : "বাংলা ভাষায় পরিবর্তন করুন"}
              className="px-2.5 py-2 rounded-lg bg-white/10 text-slate-100 border border-white/15 text-xs font-bold cursor-pointer"
            >
              {lang === "bn" ? "EN" : "বাং"}
            </button>
            <PWAInstallButton compact />
            <button
              id="mobile-navbar-circular-btn"
              type="button"
              onClick={() => setIsCircularModalOpen(true)}
              className="w-9 h-9 rounded-lg bg-[#C5A059]/20 hover:bg-[#C5A059]/30 flex items-center justify-center text-[#f3d492] border border-[#C5A059]/40 cursor-pointer"
              aria-label={t("navCircular")}
              title={t("navCircular")}
            >
              <FileText size={16} />
            </button>
            <Link
              to="/enroll"
              className="px-3 py-2 bg-[#C5A059] text-[#00152e] font-extrabold text-xs rounded-lg shadow-md shrink-0"
            >
              {t("navJoinUs")}
            </Link>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-100 hover:text-white ring-1 ring-white/20 rounded-lg shrink-0 cursor-pointer"
              aria-label="Toggle Menu"
              aria-expanded={isOpen}
            >
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-y-0 right-0 w-full sm:w-80 bg-[#002147] z-[60] shadow-2xl flex flex-col xl:hidden border-l border-white/10"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <span className="text-[#C5A059] font-extrabold uppercase tracking-[0.18em] text-xs">
                Platoon Navigation
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-2 text-slate-200 hover:text-white ring-1 ring-white/15 rounded-lg cursor-pointer"
                aria-label="Close Menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pt-4 pb-12 px-4 space-y-2 no-scrollbar">
              <div className="grid grid-cols-2 gap-2 mb-5">
                {authLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-white/5 border border-white/10 text-slate-100 hover:bg-white/10 transition-colors"
                  >
                    <link.icon size={18} className="text-[#C5A059]" />
                    <span className="font-bold text-xs">{link.name}</span>
                  </Link>
                ))}
              </div>

              <div className="space-y-1">
                <span className="block px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  All Pages
                </span>
                {allDrawerLinks.map((link) => {
                  const isExam = link.path === "/exam";
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-colors ${
                        isExam
                          ? "bg-[#C5A059]/20 text-[#f3d492] border border-[#C5A059]/30"
                          : isActive
                          ? "bg-white/15 text-white"
                          : "text-slate-200 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isExam
                            ? "bg-[#C5A059] text-[#00152e]"
                            : isActive
                            ? "bg-white text-[#002147]"
                            : "bg-white/5 text-slate-300"
                        }`}
                      >
                        <link.icon size={16} />
                      </div>
                      <span className="font-semibold text-xs">{link.name}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="pt-5 px-1 space-y-2.5">
                <PWAInstallButton />

                <button
                  id="drawer-circular-btn"
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsCircularModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2.5 w-full py-3 bg-[#C5A059]/20 text-[#f3d492] border border-[#C5A059]/40 font-bold text-xs rounded-xl hover:bg-[#C5A059]/30 transition-colors cursor-pointer"
                >
                  <FileText size={16} />
                  <span>{t("navCircular")}</span>
                </button>

                <Link
                  to="/enroll"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-2.5 w-full py-3.5 bg-[#C5A059] text-[#00152e] font-extrabold text-xs rounded-xl shadow-lg hover:bg-[#b59048] transition-colors"
                >
                  <UserPlus size={16} />
                  <span>{t("ctaEnroll")}</span>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] xl:hidden"
          />
        )}
      </AnimatePresence>

      <CircularViewerModal isOpen={isCircularModalOpen} onClose={() => setIsCircularModalOpen(false)} />
    </header>
  );
}
