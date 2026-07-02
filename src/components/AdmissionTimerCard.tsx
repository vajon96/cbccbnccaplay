import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, Calendar, ShieldAlert, Sparkles, AlertCircle, ArrowRight, Power } from "lucide-react";
import { motion } from "framer-motion";
import { db, doc, getDoc } from "../firebase";
import { TimerConfig } from "./modular/AdmissionTimerManager";

export function AdmissionTimerCard() {
  const [config, setConfig] = useState<TimerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Synchronize clock every second
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const docRef = doc(db, "admin_config", "admission_timer");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConfig(docSnap.data() as TimerConfig);
        }
      } catch (err) {
        console.error("Error loading timer config for landing page:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-slate-800 h-10 w-10"></div>
          <div className="flex-1 space-y-6 py-1">
            <div className="h-2 bg-slate-800 rounded"></div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="h-2 bg-slate-800 rounded col-span-2"></div>
                <div className="h-2 bg-slate-800 rounded col-span-1"></div>
              </div>
              <div className="h-2 bg-slate-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!config || !config.isEnabled) {
    return null; // System is disabled, hide completely
  }

  const { startDate, startTime, endDate, endTime, isCancelled } = config;

  // Timezone target string creation (Asia/Dhaka)
  const startStr = `${startDate}T${startTime}:00+06:00`;
  const endStr = `${endDate}T${endTime}:00+06:00`;

  const startMs = new Date(startStr).getTime();
  const endMs = new Date(endStr).getTime();
  const currentMs = now.getTime();

  let timerState: "CANCELLED" | "UPCOMING" | "OPEN" | "CLOSED" = "UPCOMING";

  if (isCancelled) {
    timerState = "CANCELLED";
  } else if (currentMs < startMs) {
    timerState = "UPCOMING";
  } else if (currentMs >= startMs && currentMs < endMs) {
    timerState = "OPEN";
  } else {
    timerState = "CLOSED";
  }

  // Calculate remaining or upcoming countdown values
  let diff = 0;
  if (timerState === "UPCOMING") {
    diff = startMs - currentMs;
  } else if (timerState === "OPEN") {
    diff = endMs - currentMs;
  }

  const days = diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
  const hours = diff > 0 ? Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) : 0;
  const minutes = diff > 0 ? Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)) : 0;
  const seconds = diff > 0 ? Math.floor((diff % (1000 * 60)) / 1000) : 0;

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

  // Date converters to Bangla
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
      
      const hr = parseInt(hours, 10);
      const isPm = hr >= 12;
      const displayHr = hr % 12 === 0 ? 12 : hr % 12;
      const ampmBangla = isPm ? "রাত" : "সকাল";
      
      let formattedTime = `${ampmBangla} ${translateToBanglaDigits(displayHr.toString())}:${translateToBanglaDigits(minutes.padStart(2, "0"))} টা`;
      
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

  return (
    <section id="apply-now" className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-500">
      <div className="glass-card p-8 md:p-10 rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden bg-gradient-to-b from-slate-900/40 via-slate-950/20 to-transparent">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Clock size={250} className="text-white" />
        </div>

        {timerState === "CANCELLED" ? (
          /* CANCELLED STATE SCREEN */
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto shadow-xl">
              <ShieldAlert className="w-8 h-8 text-red-400 animate-pulse" />
            </div>
            <div className="space-y-4 max-w-xl mx-auto">
              <span className="px-4 py-1.5 bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest rounded-full">
                বাতিল / Cancelled
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-slate-100 leading-relaxed font-sans">
                এই নিয়োগ/ভর্তি কার্যক্রম authority দ্বারা বাতিল করা হয়েছে। পরবর্তী বিজ্ঞপ্তির জন্য অপেক্ষা করুন।
              </h3>
              <div className="w-12 h-0.5 bg-red-500/20 mx-auto" />
              <p className="text-sm md:text-base text-slate-400 leading-relaxed font-sans">
                This recruitment/admission process has been cancelled by the authority. Please wait for the next official circular.
              </p>
            </div>
          </div>
        ) : (
          /* ACTIVE / SCHEDULED TIMER STATES */
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-2">
                {timerState === "UPCOMING" && (
                  <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-amber-500/5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Upcoming / শীঘ্রই শুরু হবে
                  </span>
                )}
                {timerState === "OPEN" && (
                  <span className="px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-500/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Open / আবেদন চলছে
                  </span>
                )}
                {timerState === "CLOSED" && (
                  <span className="px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg shadow-rose-500/5">
                    Closed / আবেদন শেষ
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">ভর্তি কার্যক্রমের সময়সূচী (Admission Schedule)</h2>
              <div className="w-20 h-1 bg-primary mx-auto rounded-full" />
            </div>

            {/* Bilingual Display Box */}
            <div className="bg-slate-950/50 rounded-3xl border border-white/5 p-6 md:p-8 space-y-8">
              
              {/* BANGLA VIEW */}
              <div className="space-y-4 pb-6 border-b border-white/5 text-center">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">🇧🇩 ভর্তি বিজ্ঞপ্তি বিবরণ</span>
                {timerState === "UPCOMING" && (
                  <div className="space-y-2">
                    <p className="text-sm md:text-base font-medium text-slate-300">
                      আবেদন শুরু হবে: <span className="text-white font-extrabold">{formatBanglaDate(startDate, startTime)}</span>
                    </p>
                    <p className="text-sm md:text-base font-medium text-slate-400">
                      আবেদন শেষ হবে: <span className="text-slate-300">{formatBanglaDate(endDate, endTime)}</span>
                    </p>
                    <h4 className="text-sm font-black text-primary uppercase tracking-wider pt-3">আবেদন শুরু হতে বাকি:</h4>
                  </div>
                )}
                {timerState === "OPEN" && (
                  <div className="space-y-2">
                    <p className="text-lg font-black text-emerald-400 leading-none">ভর্তি কার্যক্রম উন্মুক্ত</p>
                    <p className="text-sm md:text-base font-medium text-slate-300">
                      আবেদন শেষ হবে: <span className="text-white font-extrabold">{formatBanglaDate(endDate, endTime)}</span>
                    </p>
                    <h4 className="text-sm font-black text-slate-300 uppercase tracking-wider pt-3">আবেদন শেষ হতে বাকি:</h4>
                  </div>
                )}
                {timerState === "CLOSED" && (
                  <div className="space-y-2 py-4">
                    <p className="text-lg font-black text-rose-400">অনলাইন আবেদন গ্রহণের সময়সীমা শেষ হয়েছে।</p>
                    <p className="text-xs text-slate-400">পরবর্তী নির্দেশনার জন্য নিয়মিত নোটিশ বোর্ড বা সার্কুলার চেক করুন।</p>
                  </div>
                )}

                {/* Bangla Timer Digits */}
                {(timerState === "UPCOMING" || timerState === "OPEN") && (
                  <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto pt-3">
                    {[
                      { label: "দিন", value: toBanglaDigits(days) },
                      { label: "ঘণ্টা", value: toBanglaDigits(hours) },
                      { label: "মিনিট", value: toBanglaDigits(minutes) },
                      { label: "সেকেন্ড", value: toBanglaDigits(seconds) }
                    ].map((d, i) => (
                      <div key={i} className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 shadow-inner">
                        <p className="text-2xl md:text-3xl font-extrabold text-white font-sans">{d.value}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{d.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ENGLISH VIEW */}
              <div className="space-y-4 text-center">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">🇬🇧 Admission Schedule Info</span>
                {timerState === "UPCOMING" && (
                  <div className="space-y-2">
                    <p className="text-sm md:text-base font-medium text-slate-300">
                      Application Starts: <span className="text-white font-extrabold">{formatEnglishDate(startDate, startTime)}</span>
                    </p>
                    <p className="text-sm md:text-base font-medium text-slate-400">
                      Application Ends: <span className="text-slate-300">{formatEnglishDate(endDate, endTime)}</span>
                    </p>
                    <h4 className="text-sm font-black text-primary uppercase tracking-wider pt-3">Application Starts In:</h4>
                  </div>
                )}
                {timerState === "OPEN" && (
                  <div className="space-y-2">
                    <p className="text-base font-black text-emerald-400 uppercase tracking-wider">Application Open</p>
                    <p className="text-sm md:text-base font-medium text-slate-300">
                      Application Ends: <span className="text-white font-extrabold">{formatEnglishDate(endDate, endTime)}</span>
                    </p>
                    <h4 className="text-sm font-black text-slate-300 uppercase tracking-wider pt-3">Time Remaining:</h4>
                  </div>
                )}
                {timerState === "CLOSED" && (
                  <div className="space-y-2 py-4">
                    <p className="text-base font-black text-rose-400 uppercase tracking-widest">Online Application has ended.</p>
                    <p className="text-xs text-slate-400">Please stay tuned for further notifications or announcements.</p>
                  </div>
                )}

                {/* English Timer Digits */}
                {(timerState === "UPCOMING" || timerState === "OPEN") && (
                  <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto pt-3">
                    {[
                      { label: "Days", value: toEnglishDigits(days) },
                      { label: "Hours", value: toEnglishDigits(hours) },
                      { label: "Mins", value: toEnglishDigits(minutes) },
                      { label: "Secs", value: toEnglishDigits(seconds) }
                    ].map((d, i) => (
                      <div key={i} className="bg-slate-900/60 p-3 rounded-2xl border border-white/5 shadow-inner">
                        <p className="text-2xl md:text-3xl font-extrabold text-white font-sans">{d.value}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{d.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Application Form Action Trigger Button */}
            <div className="flex justify-center pt-2">
              {timerState === "OPEN" ? (
                <Link
                  to="/enroll"
                  className="group px-10 py-4 bg-accent text-white font-black rounded-2xl flex items-center gap-3 hover:bg-accent/90 transition-all transform hover:scale-105 shadow-xl shadow-accent/20 cursor-pointer text-sm tracking-wider"
                >
                  Apply Now / আবেদন করুন
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <button
                  disabled
                  className="px-10 py-4 bg-slate-800 text-slate-500 font-black rounded-2xl flex items-center gap-3 cursor-not-allowed text-sm tracking-wider border border-white/5"
                >
                  Apply Now / আবেদন করুন (Not Open)
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </section>
  );
}
