import { useState, useEffect } from "react";
import { 
  Calendar, Clock, ShieldAlert, ShieldCheck, Power, 
  Trash2, Save, Play, Square, Loader2, RefreshCw, AlertCircle, Globe
} from "lucide-react";
import { db, doc, setDoc, getDoc, Timestamp } from "../../firebase";

interface AdmissionTimerManagerProps {
  adminSession: any;
  onLogActivity: (type: string, details: string) => Promise<void>;
}

export interface TimerConfig {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isCancelled: boolean;
  isEnabled: boolean;
}

export function AdmissionTimerManager({ adminSession, onLogActivity }: AdmissionTimerManagerProps) {
  const [startDate, setStartDate] = useState("2026-07-15");
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState("2026-07-30");
  const [endTime, setEndTime] = useState("23:59");
  const [isCancelled, setIsCancelled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Time calculations for live preview
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Sync current time every second
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current config from Firestore on load
  useEffect(() => {
    async function fetchConfig() {
      try {
        const docRef = doc(db, "admin_config", "admission_timer");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as TimerConfig;
          setStartDate(data.startDate || "2026-07-15");
          setStartTime(data.startTime || "10:00");
          setEndDate(data.endDate || "2026-07-30");
          setEndTime(data.endTime || "23:59");
          setIsCancelled(!!data.isCancelled);
          setIsEnabled(data.isEnabled !== false); // default to true
        }
      } catch (err) {
        console.error("Error fetching timer config:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: TimerConfig = {
        startDate,
        startTime,
        endDate,
        endTime,
        isCancelled,
        isEnabled
      };

      await setDoc(doc(db, "admin_config", "admission_timer"), payload);
      
      await onLogActivity(
        "TIMER_CONFIG_UPDATED", 
        `Admin ${adminSession?.name || "Super Admin"} updated admission timer schedule. Start: ${startDate} ${startTime}, End: ${endDate} ${endTime}, Enabled: ${isEnabled}, Cancelled: ${isCancelled}`
      );

      setMessage({ type: "success", text: "শিডিউল ও টাইমার কনফিগারেশন সফলভাবে সেভ করা হয়েছে!" });
    } catch (err) {
      console.error("Error saving timer config:", err);
      setMessage({ type: "error", text: "কনফিগারেশন সেভ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" });
    } finally {
      setSaving(false);
    }
  };

  // Live timer state calculations
  const getTimerState = () => {
    if (!isEnabled) return "DISABLED";
    if (isCancelled) return "CANCELLED";

    // Create Date objects representing Dhaka time
    // ISO format for offset +06:00
    const startStr = `${startDate}T${startTime}:00+06:00`;
    const endStr = `${endDate}T${endTime}:00+06:00`;

    const startMs = new Date(startStr).getTime();
    const endMs = new Date(endStr).getTime();
    const currentMs = now.getTime();

    if (isNaN(startMs) || isNaN(endMs)) return "ERROR";

    if (currentMs < startMs) {
      return "UPCOMING";
    } else if (currentMs >= startMs && currentMs < endMs) {
      return "OPEN";
    } else {
      return "CLOSED";
    }
  };

  const timerState = getTimerState();

  // Format Bangladesh dates nicely for preview
  const formatBanglaDate = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      const [hours, minutes] = timeStr.split(":");
      
      const monthsBangla = [
        "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
        "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
      ];
      const monthIndex = parseInt(month, 10) - 1;
      const banglaMonth = monthsBangla[monthIndex] || month;

      // English digits mapping to Bangla
      const translateToBanglaDigits = (numStr: string) => {
        const eng = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
        const bng = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
        return numStr.split("").map(char => {
          const index = eng.indexOf(char);
          return index !== -1 ? bng[index] : char;
        }).join("");
      };

      const banglaDay = translateToBanglaDigits(parseInt(day, 10).toString());
      const banglaYear = translateToBanglaDigits(year);
      
      let formattedTime = "";
      const hr = parseInt(hours, 10);
      const min = parseInt(minutes, 10);
      const isPm = hr >= 12;
      const displayHr = hr % 12 === 0 ? 12 : hr % 12;
      const ampmBangla = isPm ? "রাত" : "সকাল";
      
      formattedTime = `${ampmBangla} ${translateToBanglaDigits(displayHr.toString())}:${translateToBanglaDigits(minutes.padStart(2, "0"))} টা`;
      
      if (hr >= 12 && hr < 16) {
        formattedTime = `দুপুর ${translateToBanglaDigits((hr - 12 || 12).toString())}:${translateToBanglaDigits(minutes.padStart(2, "0"))} টা`;
      } else if (hr >= 16 && hr < 18) {
        formattedTime = `বিকাল ${translateToBanglaDigits((hr - 12).toString())}:${translateToBanglaDigits(minutes.padStart(2, "0"))} টা`;
      } else if (hr >= 18 && hr < 20) {
        formattedTime = `সন্ধ্যা ${translateToBanglaDigits((hr - 12).toString())}:${translateToBanglaDigits(minutes.padStart(2, "0"))} টা`;
      }

      return `${banglaDay} ${banglaMonth} ${banglaYear}, ${formattedTime}`;
    } catch (e) {
      return `${dateStr} ${timeStr}`;
    }
  };

  const formatEnglishDate = (dateStr: string, timeStr: string) => {
    try {
      const date = new Date(`${dateStr}T${timeStr}`);
      const day = date.getDate();
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      
      const [hours, minutes] = timeStr.split(":");
      const hr = parseInt(hours, 10);
      const ampm = hr >= 12 ? "PM" : "AM";
      const displayHr = hr % 12 === 0 ? 12 : hr % 12;
      
      return `${day} ${month} ${year}, ${displayHr}:${minutes.padStart(2, "0")} ${ampm}`;
    } catch (e) {
      return `${dateStr} ${timeStr}`;
    }
  };

  // Calculate remaining or upcoming countdown values
  const getCountdownParts = () => {
    const startStr = `${startDate}T${startTime}:00+06:00`;
    const endStr = `${endDate}T${endTime}:00+06:00`;

    const startMs = new Date(startStr).getTime();
    const endMs = new Date(endStr).getTime();
    const currentMs = now.getTime();

    let diff = 0;
    if (timerState === "UPCOMING") {
      diff = startMs - currentMs;
    } else if (timerState === "OPEN") {
      diff = endMs - currentMs;
    }

    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
  };

  const { days, hours, minutes, seconds } = getCountdownParts();

  const toBanglaDigits = (num: number) => {
    const eng = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const bng = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return num.toString().padStart(2, "0").split("").map(char => {
      const index = eng.indexOf(char);
      return index !== -1 ? bng[index] : char;
    }).join("");
  };

  const toEnglishDigits = (num: number) => {
    return num.toString().padStart(2, "0");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
        <span className="font-bold tracking-widest uppercase text-xs">Loading Timer System...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">ভর্তি শিডিউল ও টাইমার ম্যানেজমেন্ট (Admission Timer Settings)</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">
              Configure and fully control BNCC enrollment startup dates, cutoff deadlines, and active countdown rules.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3.5 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl flex items-center gap-2 transition-all shadow-xl disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>

        {/* Status Alerts */}
        {message && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
            message.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-bold uppercase tracking-wider">{message.text}</p>
          </div>
        )}

        {/* Form Body split into Settings Form and Live Website Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Config Controls */}
          <div className="space-y-6 bg-slate-900/30 p-6 rounded-2xl border border-white/5">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              শিডিউল সেটিংস (Schedule Parameters)
            </h4>

            {/* Quick Status Badges */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsEnabled(!isEnabled)}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  isEnabled 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-slate-950 border-white/5 text-slate-500"
                }`}
              >
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black tracking-widest opacity-60">Timer System</p>
                  <p className="text-xs font-bold">{isEnabled ? "ENABLED" : "DISABLED"}</p>
                </div>
                <Power className={`w-5 h-5 ${isEnabled ? "text-emerald-400 animate-pulse" : "text-slate-600"}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsCancelled(!isCancelled)}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                  isCancelled 
                    ? "bg-red-500/10 border-red-500/20 text-red-400" 
                    : "bg-slate-950 border-white/5 text-slate-500"
                }`}
              >
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black tracking-widest opacity-60">Process Status</p>
                  <p className="text-xs font-bold">{isCancelled ? "CANCELLED" : "ACTIVE"}</p>
                </div>
                <ShieldAlert className={`w-5 h-5 ${isCancelled ? "text-red-400 animate-bounce" : "text-slate-600"}`} />
              </button>
            </div>

            {/* Start Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">আবেদন শুরুর তারিখ (Start Date)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">আবেদন শুরুর সময় (Start Time)</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <input 
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* End Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">আবেদন শেষ তারিখ (End Date)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">আবেদন শেষ সময় (End Time)</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5" />
                  <input 
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-slate-200 outline-none focus:border-primary transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions / Presets */}
            <div className="pt-2">
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">Preset Commands</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Extend 7 days from now
                    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    const dateStr = in7Days.toISOString().split("T")[0];
                    setEndDate(dateStr);
                    setEndTime("23:59");
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[9px] uppercase font-bold border border-white/5 transition-all"
                >
                  Extend 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Start today, end in 15 days
                    const today = new Date();
                    const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
                    setStartDate(today.toISOString().split("T")[0]);
                    setStartTime("10:00");
                    setEndDate(in15Days.toISOString().split("T")[0]);
                    setEndTime("23:59");
                    setIsCancelled(false);
                    setIsEnabled(true);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-[9px] uppercase font-bold border border-white/5 transition-all"
                >
                  Standard 15 Days Run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCancelled(true);
                  }}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[9px] uppercase font-bold border border-red-500/10 transition-all"
                >
                  Cancel Immediately
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Screen */}
          <div className="space-y-6">
            <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent animate-pulse" />
              লাইভ প্রিভিউ (Live Website Preview)
            </h4>

            {/* Preview Box Frame */}
            <div className="p-6 bg-slate-950 rounded-3xl border border-white/10 relative overflow-hidden flex flex-col justify-center min-h-[380px]">
              <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Dhaka Local Time</span>
              </div>

              {!isEnabled ? (
                /* Disabled Preview */
                <div className="text-center space-y-4 py-8">
                  <Power className="w-16 h-16 text-slate-700 mx-auto stroke-[1.5]" />
                  <div className="space-y-1">
                    <h5 className="text-base font-bold text-slate-400 uppercase tracking-wide">টাইমার নিষ্ক্রিয় (Timer Disabled)</h5>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto">
                      The countdown timer card and schedules are currently hidden from visitors. Enabling will resume user timer countdowns.
                    </p>
                  </div>
                </div>
              ) : isCancelled ? (
                /* Cancelled Preview */
                <div className="glass-card p-8 rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-950/20 to-transparent text-center space-y-4">
                  <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
                  <div className="space-y-3">
                    <span className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-full">
                      বাতিল / Cancelled
                    </span>
                    <h4 className="text-md font-bold text-slate-200 font-sans leading-relaxed">
                      এই নিয়োগ/ভর্তি কার্যক্রম authority দ্বারা বাতিল করা হয়েছে। পরবর্তী বিজ্ঞপ্তির জন্য অপেক্ষা করুন।
                    </h4>
                    <p className="text-xs text-slate-400 border-t border-white/5 pt-3 leading-relaxed">
                      This recruitment/admission process has been cancelled by the authority. Please wait for the next official circular.
                    </p>
                  </div>
                </div>
              ) : (
                /* Active / Scheduled Countdown Preview */
                <div className="space-y-6">
                  {/* Status Badge in Card */}
                  <div className="flex justify-center">
                    {timerState === "UPCOMING" && (
                      <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                        Upcoming / শীঘ্রই শুরু হবে
                      </span>
                    )}
                    {timerState === "OPEN" && (
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full animate-pulse">
                        Open / আবেদন চলছে
                      </span>
                    )}
                    {timerState === "CLOSED" && (
                      <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                        Closed / আবেদন শেষ
                      </span>
                    )}
                  </div>

                  {/* Bilingual Time Details Card */}
                  <div className="bg-slate-900/40 p-6 rounded-2xl border border-white/5 space-y-6 text-center">
                    
                    {/* BANGLA PART (TOP) */}
                    <div className="space-y-3 pb-4 border-b border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">🇧🇩 বাংলা</span>
                        {timerState === "UPCOMING" && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-300">
                              আবেদন শুরু হবে: <span className="text-white font-black">{formatBanglaDate(startDate, startTime)}</span>
                            </p>
                            <p className="text-xs font-bold text-slate-400">
                              আবেদন শেষ হবে: <span className="text-slate-300">{formatBanglaDate(endDate, endTime)}</span>
                            </p>
                            <p className="text-sm font-black text-primary mt-3 uppercase tracking-wider">আবেদন শুরু হতে বাকি:</p>
                          </div>
                        )}
                        {timerState === "OPEN" && (
                          <div className="space-y-1">
                            <p className="text-lg font-black text-emerald-400">আবেদন চলছে</p>
                            <p className="text-sm font-black text-slate-300">আবেদন শেষ হতে বাকি:</p>
                          </div>
                        )}
                        {timerState === "CLOSED" && (
                          <p className="text-lg font-black text-rose-400">আবেদন শেষ হয়েছে</p>
                        )}
                      </div>

                      {/* Bangla Counter Blocks */}
                      {(timerState === "UPCOMING" || timerState === "OPEN") && (
                        <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto pt-2">
                          {[
                            { label: "দিন", value: toBanglaDigits(days) },
                            { label: "ঘণ্টা", value: toBanglaDigits(hours) },
                            { label: "মিনিট", value: toBanglaDigits(minutes) },
                            { label: "সেকেন্ড", value: toBanglaDigits(seconds) }
                          ].map((b, i) => (
                            <div key={i} className="bg-slate-950 p-2 rounded-xl border border-white/5">
                              <p className="text-xl font-extrabold text-white">{b.value}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase">{b.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ENGLISH PART (BOTTOM) */}
                    <div className="space-y-3 pt-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">🇬🇧 English</span>
                        {timerState === "UPCOMING" && (
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-300">
                              Application Starts: <span className="text-white font-black">{formatEnglishDate(startDate, startTime)}</span>
                            </p>
                            <p className="text-xs font-bold text-slate-400">
                              Application Ends: <span className="text-slate-300">{formatEnglishDate(endDate, endTime)}</span>
                            </p>
                            <p className="text-sm font-black text-primary mt-3 uppercase tracking-wider">Application Starts In:</p>
                          </div>
                        )}
                        {timerState === "OPEN" && (
                          <div className="space-y-1">
                            <p className="text-base font-black text-emerald-400 uppercase tracking-widest">Application Open</p>
                            <p className="text-sm font-black text-slate-300 uppercase tracking-wider">Time Remaining:</p>
                          </div>
                        )}
                        {timerState === "CLOSED" && (
                          <p className="text-base font-black text-rose-400 uppercase tracking-widest">Application Closed</p>
                        )}
                      </div>

                      {/* English Counter Blocks */}
                      {(timerState === "UPCOMING" || timerState === "OPEN") && (
                        <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto pt-2">
                          {[
                            { label: "Days", value: toEnglishDigits(days) },
                            { label: "Hours", value: toEnglishDigits(hours) },
                            { label: "Mins", value: toEnglishDigits(minutes) },
                            { label: "Secs", value: toEnglishDigits(seconds) }
                          ].map((e, i) => (
                            <div key={i} className="bg-slate-950 p-2 rounded-xl border border-white/5">
                              <p className="text-xl font-extrabold text-white">{e.value}</p>
                              <p className="text-[9px] text-slate-500 font-bold uppercase">{e.label}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Join Us / Apply Button status inside card */}
                  <div className="pt-2">
                    <button
                      disabled={timerState !== "OPEN"}
                      className="w-full py-3.5 bg-accent text-white font-black uppercase tracking-widest text-xs rounded-xl flex items-center justify-center gap-2 hover:bg-accent/90 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Apply Now / আবেদন করুন
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
