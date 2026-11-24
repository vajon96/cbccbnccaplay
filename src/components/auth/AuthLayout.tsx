import React from "react";
import { Link } from "react-router-dom";
import { Shield, Lock, ArrowLeft, BookOpen } from "lucide-react";
import { AuthLogoMark } from "./AuthLogoMark";

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  badgeText?: string;
}

export function AuthHeader({ title, subtitle, badgeText }: AuthHeaderProps) {
  return (
    <div className="text-center space-y-3">
      <AuthLogoMark />
      {badgeText && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#002147]/5 border border-[#002147]/15 text-[#002147] text-[11px] font-bold tracking-wide uppercase">
          <Shield size={12} className="text-[#C5A059]" />
          <span>{badgeText}</span>
        </div>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-[#002147] tracking-tight font-display">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-[#64748B] font-medium leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

interface AuthCardProps {
  children: React.ReactNode;
}

export function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-[460px] bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#002147] via-[#C5A059] to-[#002147]" />
      <div className="p-6 sm:p-9 space-y-6">{children}</div>
    </div>
  );
}

interface AuthFooterProps {
  portalType?: "central" | "officer" | "exam_candidate" | "exam_admin";
}

export function AuthFooter({ portalType = "central" }: AuthFooterProps) {
  return (
    <div className="pt-5 border-t border-slate-200 space-y-3 text-center">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-[#64748B]">
        {portalType !== "central" && (
          <Link to="/login" className="text-[#002147] hover:text-[#C5A059] transition-colors">
            Central Portal Login
          </Link>
        )}
        {portalType !== "officer" && (
          <Link to="/admin2" className="text-[#002147] hover:text-[#C5A059] transition-colors">
            Officer / QR Attendance
          </Link>
        )}
        {portalType !== "exam_candidate" && (
          <Link to="/exam/login" className="text-[#002147] hover:text-[#C5A059] transition-colors">
            Exam Portal
          </Link>
        )}
        {portalType !== "exam_admin" && (
          <Link to="/exam/admin/login" className="text-[#002147] hover:text-[#C5A059] transition-colors">
            Exam Controller
          </Link>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 text-[11px] text-[#64748B]">
        <Lock size={12} className="text-[#C5A059] shrink-0" />
        <span>
          Cox&apos;s Bazar City College BNCC Platoon • 15 BNCC Battalion • Karnaphuli Regiment
        </span>
      </div>
    </div>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
  asideHeading?: string;
  asideDescription?: string;
  highlights?: Array<{ title: string; detail: string }>;
  showBackHome?: boolean;
}

export function AuthLayout({
  children,
  asideHeading = "Cox's Bazar City College BNCC Platoon",
  asideDescription = "Bangladesh National Cadet Corps • Army Wing • 15 BNCC Battalion, Karnaphuli Regiment",
  highlights = [
    {
      title: "Separated Account Architecture",
      detail: "Dedicated verification and workspace paths for Applicants, Inducted Cadets, and Platoon Officers.",
    },
    {
      title: "Verified Credential Access",
      detail: "Sign in using Email & Password, assigned Cadet/Applicant ID, or Officer Credentials.",
    },
    {
      title: "Protected Session Governance",
      detail: "Server-verified HTTP-only sessions, rate-limited authentication, and role-scoped authorization.",
    },
  ],
  showBackHome = true,
}: AuthLayoutProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#061830] relative flex flex-col justify-center py-8 sm:py-12 px-4 overflow-hidden">
      {/* Subtle architectural grid background (zero neon / zero pulsing clutter) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(#C5A059 1px, transparent 1px), radial-gradient(#FFFFFF 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          backgroundPosition: "0 0, 18px 18px",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#002147] to-transparent opacity-90"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {showBackHome && (
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-[#C5A059] transition-colors min-h-[36px]"
            >
              <ArrowLeft size={15} />
              <span>হোমপেজে ফিরে যান / Back to Home</span>
            </Link>
            <Link
              to="/enroll"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C5A059] hover:text-[#dfc07c] transition-colors min-h-[36px]"
            >
              <BookOpen size={14} />
              <span>নতুন ভর্তি আবেদন (Enroll)</span>
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Institutional Brief (visible cleanly on large screens) */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between text-white space-y-7 pr-4">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-[#C5A059]/40 text-[#C5A059] text-[11px] font-bold uppercase tracking-wider">
                <Shield size={13} />
                <span>Official Cadet &amp; Admission Portal</span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight leading-tight font-display text-white">
                {asideHeading}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{asideDescription}</p>
            </div>

            <div className="space-y-3.5">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="p-4 rounded-2xl bg-[#002147]/80 border border-white/10 space-y-1"
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400 font-medium">
              Motto: Knowledge, Discipline, Voluntary Service (জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা)
            </p>
          </div>

          {/* Right Form Container */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
