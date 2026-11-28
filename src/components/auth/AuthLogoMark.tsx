import { useCMS } from "../../context/CMSContext";
import { resolveMediaUrl } from "../../lib/api";

const DEFAULT_COLLEGE_LOGO = "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png";
const DEFAULT_BNCC_LOGO = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";

interface AuthLogoMarkProps {
  compact?: boolean;
}

export function AuthLogoMark({ compact = false }: AuthLogoMarkProps) {
  const { settings } = useCMS();
  const collegeLogo = resolveMediaUrl(settings?.collegeLogoUrl || DEFAULT_COLLEGE_LOGO);
  const bnccLogo = resolveMediaUrl(settings?.bnccLogoUrl || DEFAULT_BNCC_LOGO);

  return (
    <div className="flex items-center justify-center gap-3">
      <div
        className={`${
          compact ? "w-11 h-11 p-1.5" : "w-14 h-14 p-1.5"
        } rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0`}
      >
        <img
          src={collegeLogo}
          alt="Cox's Bazar City College Crest"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="h-8 w-px bg-[#C5A059]/40" aria-hidden="true" />
      <div
        className={`${
          compact ? "w-11 h-11 p-1.5" : "w-14 h-14 p-1.5"
        } rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0`}
      >
        <img
          src={bnccLogo}
          alt="Bangladesh National Cadet Corps Emblem"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
