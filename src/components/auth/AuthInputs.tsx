import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function AuthInput({
  id,
  label,
  icon,
  hint,
  className = "",
  ...rest
}: AuthInputProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold text-[#172033] tracking-wide"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`w-full min-h-[44px] bg-[#F5F7FA] border border-slate-300 rounded-xl ${
            icon ? "pl-10" : "pl-4"
          } pr-4 py-2.5 text-sm text-[#172033] placeholder:text-slate-400 focus:bg-white focus:border-[#002147] focus:ring-2 focus:ring-[#002147]/15 outline-none transition-all ${className}`}
          {...rest}
        />
      </div>
      {hint && <p className="text-[11px] text-[#64748B] leading-snug">{hint}</p>}
    </div>
  );
}

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function PasswordInput({
  id,
  label,
  icon,
  hint,
  className = "",
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold text-[#172033] tracking-wide"
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] pointer-events-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`w-full min-h-[44px] bg-[#F5F7FA] border border-slate-300 rounded-xl ${
            icon ? "pl-10" : "pl-4"
          } pr-12 py-2.5 text-sm text-[#172033] placeholder:text-slate-400 focus:bg-white focus:border-[#002147] focus:ring-2 focus:ring-[#002147]/15 outline-none transition-all ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#002147] hover:bg-slate-200/60 transition-colors cursor-pointer"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-[#64748B] leading-snug">{hint}</p>}
    </div>
  );
}

interface AuthLoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "gold" | "secondary";
  icon?: React.ReactNode;
}

export function AuthLoadingButton({
  loading = false,
  loadingText = "Processing...",
  variant = "primary",
  icon,
  children,
  className = "",
  disabled,
  ...rest
}: AuthLoadingButtonProps) {
  const variantClasses =
    variant === "gold"
      ? "bg-[#C5A059] hover:bg-[#b59048] text-[#002147] shadow-md"
      : variant === "secondary"
      ? "bg-[#F5F7FA] hover:bg-slate-200 text-[#002147] border border-slate-300"
      : "bg-[#002147] hover:bg-[#061830] text-white shadow-md";

  return (
    <button
      disabled={disabled || loading}
      className={`w-full min-h-[46px] px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses} ${className}`}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 size={17} className="animate-spin shrink-0" />
          <span>{loadingText}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon}
        </>
      )}
    </button>
  );
}
