import { useState } from "react";
import { Phone, MapPin, Globe, Mail, X, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useCMS } from "../context/CMSContext";
import { useLanguage } from "../context/LanguageContext";

export function Footer() {
  const cms = useCMS();
  const { lang, t } = useLanguage();
  const [policyModal, setPolicyModal] = useState<"privacy" | "terms" | null>(null);

  const contactEmail = cms.settings.contactEmail || "cbccbnccplatoon@gmail.com";
  const collegeSite = cms.settings.collegeWebsite || "https://cbcc.edu.bd/";
  const bnccSite = cms.settings.bnccCentralWebsite || "https://bncc.info/";

  return (
    <footer className="relative bg-[#00152e] text-white pt-20 pb-12 overflow-hidden border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Brand Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-5 p-3.5 bg-white/5 rounded-xl border border-white/10 w-fit shadow-lg">
              <a
                href={collegeSite}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105"
                aria-label="Cox's Bazar City College Website"
              >
                <img
                  src={cms.settings.collegeLogoUrl || "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"}
                  alt="Cox's Bazar City College Logo"
                  className="h-10 w-auto"
                  referrerPolicy="no-referrer"
                />
              </a>
              <div className="w-px h-8 bg-white/15" />
              <a
                href={bnccSite}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-transform hover:scale-105"
                aria-label="BNCC Official Website"
              >
                <img
                  src={cms.settings.bnccLogoUrl || "https://i.ibb.co/Fb3R6wR/Bncc-logo.png"}
                  alt="BNCC Logo"
                  className="h-10 w-auto"
                  referrerPolicy="no-referrer"
                />
              </a>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight leading-none font-display text-white">
                  {t("brandFull")}
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="h-px w-6 bg-[#C5A059]" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C5A059]">
                    15 BNCC Battalion · Karnaphuli Regiment
                  </span>
                </div>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
                {cms.getText("footer.about", t("footerTagline"), lang)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-[#C5A059] hover:text-[#00152e] text-slate-200 text-xs font-bold transition-colors"
              >
                <Mail size={15} />
                <span>{contactEmail}</span>
              </a>
              <a
                href={bnccSite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-[#C5A059] hover:text-[#00152e] text-slate-200 text-xs font-bold transition-colors"
              >
                <Globe size={15} />
                <span>BNCC HQ</span>
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest pb-2 border-b border-[#C5A059]/40 w-fit">
              {t("footerQuickLinks")}
            </h3>
            <ul className="space-y-2.5">
              {[
                { name: t("navHome"), path: "/" },
                { name: t("ctaEnroll"), path: "/enroll" },
                { name: t("navCadets"), path: "/cadets" },
                { name: t("navIncharges"), path: "/hall-of-incharges" },
                { name: t("navActivities"), path: "/activities" },
                { name: t("navNotices"), path: "/notices" },
                { name: t("navGallery"), path: "/gallery" },
                { name: t("navAbout"), path: "/about" },
                { name: t("navContact"), path: "/contact" },
              ].map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-xs text-slate-300 hover:text-[#C5A059] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div className="lg:col-span-2 space-y-5">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest pb-2 border-b border-[#C5A059]/40 w-fit">
              {t("footerOfficialPortal")}
            </h3>
            <ul className="space-y-2.5">
              {[
                { name: t("navGuide"), path: "/how-to-become-cadet" },
                { name: t("navOfflineForm"), path: "/offline-application" },
                { name: t("navQrScan"), path: "/qr-scan" },
                ...(cms.settings.examPortalOpen !== false ? [{ name: t("navExamPortal"), path: "/exam" }] : []),
                { name: t("navLogin"), path: "/login" },
              ].map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-xs text-slate-300 hover:text-[#C5A059] transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div className="lg:col-span-4 space-y-5">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest pb-2 border-b border-[#C5A059]/40 w-fit">
              {t("footerContactTitle")}
            </h3>
            <div className="grid grid-cols-1 gap-3.5">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#C5A059]/15 flex items-center justify-center text-[#C5A059] shrink-0">
                    <MapPin size={17} />
                  </div>
                  <div>
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Headquarters
                    </h4>
                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                      {cms.settings.address || t("footerAddress")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#C5A059]/15 flex items-center justify-center text-[#C5A059] shrink-0">
                    <Phone size={17} />
                  </div>
                  <div>
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Phone Enquiries
                    </h4>
                    <a
                      href={`tel:${cms.settings.contactPhone || "+8801812430454"}`}
                      className="text-sm text-white hover:text-[#C5A059] font-bold tabular-nums transition-colors"
                    >
                      {cms.settings.contactPhone || "+880 1812-430454"}
                    </a>
                    <p className="text-[10px] text-[#C5A059] font-bold uppercase tracking-wider mt-0.5">
                      Platoon Commander
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#C5A059]/15 flex items-center justify-center text-[#C5A059] shrink-0">
                    <Globe size={17} />
                  </div>
                  <div>
                    <h4 className="text-[11px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Web Presence
                    </h4>
                    <a
                      href={bnccSite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-200 hover:text-[#C5A059] transition-colors font-bold underline underline-offset-4 decoration-[#C5A059]/40"
                    >
                      www.bncc.info
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-slate-300 text-xs font-semibold">
              © {new Date().getFullYear()} Cox's Bazar City College BNCC Platoon. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-400">
              15 BNCC Battalion · Karnaphuli Regiment · E Company (Army Wing)
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setPolicyModal("privacy")}
              className="text-xs text-slate-300 hover:text-[#C5A059] transition-colors font-bold cursor-pointer"
            >
              {t("footerPrivacy")}
            </button>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() => setPolicyModal("terms")}
              className="text-xs text-slate-300 hover:text-[#C5A059] transition-colors font-bold cursor-pointer"
            >
              {t("footerTerms")}
            </button>
          </div>
        </div>
      </div>

      {/* Institutional Policy & Terms Modal */}
      {policyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="bg-white text-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setPolicyModal(null)}
              className="absolute top-5 right-5 text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#002147] text-[#C5A059] flex items-center justify-center">
                <ShieldCheck size={22} />
              </div>
              <h3 className="text-lg font-extrabold text-[#002147]">
                {policyModal === "privacy"
                  ? "Privacy & Cadet Data Protection Policy"
                  : "Institutional Terms of Service"}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {policyModal === "privacy"
                ? "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন পোর্টালে সংরক্ষিত সকল ক্যাডেট তথ্য, পরিচয়পত্র ও নথিপত্র শুধুমাত্র প্রাতিষ্ঠানিক ভর্তি, প্রশিক্ষণ ও পরীক্ষার মূল্যায়নের জন্য ব্যবহৃত হয়। কোনো ব্যক্তিগত মোবাইল নম্বর বা জন্ম নিবন্ধন তথ্য পাবলিক কিউআর কার্ডে প্রদর্শিত হয় না এবং অননুমোদিত তৃতীয় পক্ষের সাথে শেয়ার করা হয় না।"
                : "এই পোর্টালটি কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের অফিসিয়াল ব্যবস্থাপনা সিস্টেম। অনলাইন ও অফলাইন ভর্তি আবেদন, প্রবেশপত্র এবং অনলাইন পরীক্ষায় শুধুমাত্র সঠিক প্রাতিষ্ঠানিক তথ্য প্রদান করতে হবে। যেকোনো অসদুপায় বা ভুয়া তথ্য প্রদান করলে আবেদন বাতিল বলে গণ্য হবে।"}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="px-5 py-2.5 bg-[#002147] hover:bg-[#0B2545] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
