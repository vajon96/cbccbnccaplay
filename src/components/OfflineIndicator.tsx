import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-[#00152e] px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 z-50 border-b border-amber-600/40">
      <WifiOff size={14} className="shrink-0" />
      <span>
        আপনি এখন অফলাইন মোডে আছেন — লোকাল ড্রাফট সংরক্ষিত থাকবে এবং ইন্টারনেট ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।
      </span>
    </div>
  );
}
