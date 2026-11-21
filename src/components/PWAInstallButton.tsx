import { Download } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { canInstall, promptInstall } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <button
      onClick={() => void promptInstall()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C5A059] hover:bg-[#d4b06a] text-[#00152e] text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-md cursor-pointer"
      title="Install BNCC Platoon App"
    >
      <Download size={13} />
      {!compact && <span>Install App</span>}
    </button>
  );
}
