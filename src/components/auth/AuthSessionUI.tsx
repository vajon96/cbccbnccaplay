import React from "react";
import { CheckCircle2, LayoutDashboard, LogOut } from "lucide-react";
import type { AuthUser } from "../../lib/auth";
import { ROLE_LABELS, normalizeRole } from "../../lib/rbac";

export interface LoginMethodOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface LoginMethodSelectorProps<T extends string> {
  options: Array<LoginMethodOption<T>>;
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}

export function LoginMethodSelector<T extends string>({
  options,
  activeId,
  onChange,
  ariaLabel = "Select account type",
}: LoginMethodSelectorProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid gap-1.5 p-1 rounded-xl bg-[#F5F7FA] border border-slate-200"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.id === activeId;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`min-h-[40px] px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              active
                ? "bg-[#002147] text-white shadow-sm"
                : "text-[#64748B] hover:text-[#002147] hover:bg-white/70"
            }`}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface SessionResumeCardProps {
  session: AuthUser;
  onContinue: () => void;
  onLogout: () => void;
  continueLabel?: string;
}

export function SessionResumeCard({
  session,
  onContinue,
  onLogout,
  continueLabel = "Open Dashboard",
}: SessionResumeCardProps) {
  const roleInfo = ROLE_LABELS[normalizeRole(session.role)];

  return (
    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={18} className="text-[#16A34A] shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-emerald-950 truncate">
            Signed in as {session.name}
          </p>
          <p className="text-[11px] font-medium text-emerald-800">
            Role: {roleInfo?.en || session.role}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 min-h-[40px] px-3.5 py-2 bg-[#002147] hover:bg-[#061830] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LayoutDashboard size={14} />
          <span>{continueLabel}</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="min-h-[40px] px-3.5 py-2 bg-white hover:bg-red-50 text-[#DC2626] border border-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
