import { useNavigate } from "react-router-dom";
import { ShieldAlert, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating || !user) return null;

  const handleRestore = async () => {
    await stopImpersonation();
    navigate("/admin/dashboard");
  };

  return (
    <div className="bg-[#C5A059] text-[#00152e] px-4 py-2 text-xs font-black flex flex-wrap items-center justify-center gap-3 z-50 border-b border-[#002147]/20 shadow-md">
      <div className="flex items-center gap-2">
        <ShieldAlert size={15} className="shrink-0" />
        <span>
          Viewing as Cadet: {user.name || user.id} (Admin Impersonation Active)
        </span>
      </div>
      <button
        onClick={() => void handleRestore()}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#002147] text-white rounded-lg text-[11px] font-bold hover:bg-[#00152e] transition-all cursor-pointer"
      >
        <RotateCcw size={12} />
        <span>Restore Admin Session</span>
      </button>
    </div>
  );
}
