import React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function AuthErrorMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-left"
    >
      <AlertCircle size={17} className="text-[#DC2626] shrink-0 mt-0.5" />
      <p className="text-xs font-semibold text-[#991B1B] leading-relaxed">{message}</p>
    </div>
  );
}

export function AuthSuccessMessage({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-left"
    >
      <CheckCircle2 size={17} className="text-[#16A34A] shrink-0 mt-0.5" />
      <p className="text-xs font-semibold text-emerald-900 leading-relaxed">{message}</p>
    </div>
  );
}

export function SecurityNotice({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-left">
      <Info size={16} className="text-[#D97706] shrink-0 mt-0.5" />
      <div className="text-xs text-amber-950 leading-relaxed space-y-0.5">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function AuthDivider({ label = "OR" }: { label?: string }) {
  return (
    <div className="relative flex items-center justify-center my-1">
      <div className="border-t border-slate-200 w-full" />
      <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#64748B] bg-white shrink-0">
        {label}
      </span>
      <div className="border-t border-slate-200 w-full" />
    </div>
  );
}
