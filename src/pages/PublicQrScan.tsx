import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { 
  Scan, Camera, ShieldCheck, ShieldAlert, User, 
  Award, RefreshCw, Loader2, ArrowLeft,
  Zap, ZapOff, Volume2, VolumeX, RotateCw, Check, Sliders, Search
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db, doc, getDoc, setDoc, collection, Timestamp } from "../firebase";
import { getSession } from "../lib/auth";

export function PublicQrScan() {
  const [loading, setLoading] = useState(false);
  const [cadetData, setCadetData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeScanner, setActiveScanner] = useState(true);

  // Advanced premium camera states
  const qrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [flashlightActive, setFlashlightActive] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [maxZoom, setMaxZoom] = useState(5);
  const [supportTorch, setSupportTorch] = useState(false);
  const [supportZoom, setSupportZoom] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"initializing" | "ready" | "scanning" | "error">("initializing");
  const [scanSuccessTrigger, setScanSuccessTrigger] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const playSuccessSound = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.warn("Digital synthesizer beep fail:", err);
    }
  };

  const handleToggleFlashlight = async () => {
    if (!qrCodeRef.current || !qrCodeRef.current.isScanning) return;
    try {
      const capabilities = qrCodeRef.current.getRunningTrackCapabilities() as any;
      if (capabilities && "torch" in capabilities) {
        const nextState = !flashlightActive;
        await qrCodeRef.current.applyVideoConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setFlashlightActive(nextState);
      }
    } catch (err) {
      console.warn("Flashlight adjust fail:", err);
    }
  };

  const handleZoomChange = async (val: number) => {
    if (!qrCodeRef.current || !qrCodeRef.current.isScanning) return;
    try {
      const capabilities = qrCodeRef.current.getRunningTrackCapabilities() as any;
      if (capabilities && "zoom" in capabilities) {
        const min = capabilities.zoom.min || 1;
        const max = capabilities.zoom.max || 5;
        const nextZoom = Math.max(min, Math.min(val, max));
        await qrCodeRef.current.applyVideoConstraints({
          advanced: [{ zoom: nextZoom } as any]
        });
        setZoomLevel(nextZoom);
      }
    } catch (err) {
      console.warn("Zoom adjust fail:", err);
    }
  };

  const toggleFrontBackCamera = async () => {
    if (cameras.length < 2) return;
    
    const currentCamera = cameras.find(c => c.id === selectedCameraId);
    if (!currentCamera) return;

    const lbl = currentCamera.label.toLowerCase();
    const isCurrentBack = lbl.includes("back") || lbl.includes("rear") || 
                          lbl.includes("environment") || lbl.includes("wide") || 
                          lbl.includes("outward");

    let nextCamera = null;
    if (isCurrentBack) {
      nextCamera = cameras.find(c => {
        const l = c.label.toLowerCase();
        return l.includes("front") || l.includes("user") || l.includes("forward");
      });
    } else {
      nextCamera = cameras.find(c => {
        const l = c.label.toLowerCase();
        return l.includes("back") || l.includes("rear") || l.includes("environment") || l.includes("wide");
      });
    }

    if (!nextCamera) {
      nextCamera = cameras.find(c => c.id !== selectedCameraId);
    }

    if (nextCamera) {
      setSelectedCameraId(nextCamera.id);
      setFlashlightActive(false);
      setZoomLevel(1);
    }
  };

  const getCameraQualityLabel = () => {
    if (!qrCodeRef.current || !qrCodeRef.current.isScanning) return "AUTO FOCUS";
    try {
      const settings = qrCodeRef.current.getRunningTrackSettings();
      const w = settings.width || 0;
      const h = settings.height || 0;
      if (w >= 1920 || h >= 1080) return "1080p FHD";
      if (w >= 1280 || h >= 720) return "720p HD";
      return "SD Quality";
    } catch {
      return "Auto High-Speed";
    }
  };

  // Init public scanner with custom Html5Qrcode Experience
  useEffect(() => {
    if (!activeScanner || cadetData) return;

    let html5QrCode: Html5Qrcode | null = null;
    let isActive = true;

    const startScanner = async (cameraId: string) => {
      if (!isActive) return;

      const target = document.getElementById("public-qr-reader");
      if (!target) {
        setTimeout(() => startScanner(cameraId), 100);
        return;
      }

      try {
        setCameraStatus("initializing");
        
        if (!html5QrCode) {
          html5QrCode = new Html5Qrcode("public-qr-reader");
          qrCodeRef.current = html5QrCode;
        }

        const onScanSuccess = async (decodedText: string) => {
          if (!isActive) return;
          
          setScanSuccessTrigger(true);
          setTimeout(() => setScanSuccessTrigger(false), 800);
          
          if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(150);
          }

          if (audioEnabled) {
            playSuccessSound();
          }

          let cadetId = "";
          try {
            const parsed = JSON.parse(decodedText);
            cadetId = parsed.id || parsed.roll || decodedText;
          } catch {
            cadetId = decodedText;
          }

          cadetId = (cadetId || "").trim();
          if (cadetId.startsWith("http://") || cadetId.startsWith("https://")) {
            try {
              const url = new URL(cadetId);
              const pId = new URLSearchParams(url.search).get("id");
              if (pId) cadetId = pId.trim();
              else {
                const segs = url.pathname.split("/").filter(Boolean);
                if (segs.length > 0) cadetId = segs[segs.length - 1].trim();
              }
            } catch {
              // ignore
            }
          }

          if (!cadetId) return;

          // Prevent scans of admin QR codes in public mode
          if (cadetId.startsWith("adm_qr_")) {
            setError("এটি একটি সুরক্ষিত অ্যাডমিন টোকেন! সাধারণ স্ক্যানার দিয়ে স্ক্যান করা যাবে না।");
            setTimeout(() => setError(null), 5000);
            return;
          }

          setLoading(true);
          setError(null);

          try {
            if (cadetId.includes("/") || cadetId.includes("\\")) {
              setError("অবৈধ ID ফরম্যাট।");
              setLoading(false);
              setTimeout(() => setError(null), 4000);
              return;
            }

            const docRef = doc(db, "applicants", cadetId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              const rawData = docSnap.data();
              const approvedStatus = rawData.status === "Approved" || rawData.status === "Joined";
              
              const publicProfile = {
                id: cadetId,
                fullNameEnglish: rawData.fullNameEnglish,
                fullNameBangla: rawData.fullNameBangla,
                academicYear: rawData.academicYear,
                studyStatus: rawData.studyStatus,
                photo: rawData.photo,
                status: rawData.status,
                collegeName: rawData.collegeName || "কক্সবাজার সিটি কলেজ (Cox's Bazar City College)",
                platoonName: "কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন (Cox's Bazar City College BNCC Platoon)",
                isValidCadet: approvedStatus
              };

              setCadetData(publicProfile);
            } else {
              setError("ক্যাডেট তথ্য পাওয়া যায়নি! সঠিক কিউআর কোড স্ক্যান করুন।");
              setTimeout(() => setError(null), 4000);
            }
          } catch (err) {
            console.error("Public lookup error:", err);
            setError("তথ্য ভেরিফাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
          } finally {
            setLoading(false);
          }
        };

        const config = {
          fps: 24,
          qrbox: (w: number, h: number) => {
            const size = Math.min(w, h) * 0.72;
            return { width: size, height: size };
          },
          aspectRatio: 1.333333
        };

        const cameraSelector = (cameraId === "environment" || cameraId === "user")
          ? { facingMode: cameraId }
          : cameraId;

        await html5QrCode.start(
          cameraSelector as any,
          config,
          onScanSuccess,
          () => {} // Silent failures
        );

        setCameraStatus("scanning");
        setCameraPermissionError(null);

        // Fetch properties
        try {
          const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
          setSupportTorch(capabilities && "torch" in capabilities);
          setSupportZoom(capabilities && "zoom" in capabilities);
          if (capabilities && capabilities.zoom) {
            setMaxZoom(capabilities.zoom.max || 5);
          }
        } catch (capError) {
          console.warn("Could not query device camera capabilities:", capError);
        }

      } catch (err: any) {
        console.error("Camera startup failed:", err);
        setCameraStatus("error");
        setCameraPermissionError("ক্যামেরা অন করতে ব্যর্থ হয়েছে। সেটিংস থেকে ক্যামেরা পারমিশন চেক করুন।");
      }
    };

    const initializeDevices = async () => {
      try {
        setCameraStatus("initializing");
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
          setCameraPermissionError(null);

          const rearCameras = devices.filter((device) => {
            const l = device.label.toLowerCase();
            return (
              l.includes("back") ||
              l.includes("rear") ||
              l.includes("environment") ||
              l.includes("main") ||
              l.includes("wide") ||
              l.includes("outward") ||
              l.includes("0")
            );
          });

          let defaultCamera = rearCameras.find((device) => device.label.toLowerCase().includes("wide")) ||
                             rearCameras.find((device) => device.label.toLowerCase().includes("back")) ||
                             rearCameras[0] ||
                             devices[0];

          if (selectedCameraId) {
            const hasPrev = devices.some(d => d.id === selectedCameraId);
            if (hasPrev) {
              startScanner(selectedCameraId);
              return;
            }
          }

          setSelectedCameraId(defaultCamera.id);
          startScanner(defaultCamera.id);
        } else {
          console.warn("No camera devices enumerated, falling back to direct environment stream");
          const fallbackDevices = [
            { id: "environment", label: "Rear Camera (Auto Fallback)" },
            { id: "user", label: "Front Camera (Auto Fallback)" }
          ];
          setCameras(fallbackDevices);
          setSelectedCameraId("environment");
          startScanner("environment");
        }
      } catch (err: any) {
        console.warn("Camera catalog failed, falling back to direct environment stream:", err);
        const fallbackDevices = [
          { id: "environment", label: "Rear Camera (Auto Fallback)" },
          { id: "user", label: "Front Camera (Auto Fallback)" }
        ];
        setCameras(fallbackDevices);
        setSelectedCameraId("environment");
        startScanner("environment");
      }
    };

    const timer = setTimeout(initializeDevices, 100);

    return () => {
      isActive = false;
      clearTimeout(timer);
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error("Scanner stop on exit:", err));
          }
        } catch (e) {
          console.error("Cleanup error in scanner effect:", e);
        }
      }
    };
  }, [activeScanner, cadetData, selectedCameraId]);

  return (
    <div className="min-h-screen bg-slate-950 text-white py-12 px-4 relative overflow-hidden flex flex-col justify-between">
      {/* Visual Header */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
      
      <div className="max-w-md w-full mx-auto space-y-8 my-auto">
        
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-xs font-black uppercase text-slate-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> হোমপেজে
          </Link>
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
            PUBLIC VERIFIER
          </span>
        </div>

        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
            <Scan className="w-7 h-7 text-emerald-400 animate-pulse" />
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-white">ক্যাডেট কার্ড ভেরিফায়ার</h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Scan QR Code on Cadet Admit Card to verify status
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-center"
          >
            <p className="text-red-400 text-xs font-bold">{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {!cadetData ? (
            <motion.div
              key="scanner-layout"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {loading ? (
                <div className="h-64 rounded-3xl bg-slate-900 border border-white/5 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">যাচাই হচ্ছে...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Camera Screen Wrap */}
                  <div className="relative bg-black rounded-3xl overflow-hidden border border-white/10 aspect-square shadow-2xl">
                    <div id="public-qr-reader" className="w-full h-full object-cover [&_video]:object-cover" />

                    {/* Laser green overlay when scanning */}
                    {cameraStatus === "scanning" && (
                      <>
                        {/* Scan Area Framer */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-[72%] aspect-square border-2 border-white/20 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                            {/* Scanning line laser animation */}
                            <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-[bounce_2.5s_infinite_ease-in-out]" style={{ top: "3%" }} />
                            
                            {/* Custom corners */}
                            <div className="absolute -top-1.5 -left-1.5 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                            <div className="absolute -top-1.5 -right-1.5 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                          </div>
                        </div>

                        {/* Scanner Status Overlay Tag */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-white">QR Code Ready</span>
                        </div>
                      </>
                    )}

                    {/* Camera Switch Flash overlay on success */}
                    {scanSuccessTrigger && (
                      <div className="absolute inset-0 bg-emerald-500/35 transition-all duration-300 backdrop-blur-xs flex items-center justify-center animate-pulse">
                        <Check className="w-12 h-12 text-white" />
                      </div>
                    )}

                    {/* Camera Init overlay */}
                    {cameraStatus === "initializing" && (
                      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">ক্যামেরা চালু হচ্ছে...</span>
                      </div>
                    )}

                    {/* Camera permission/error state */}
                    {cameraStatus === "error" && (
                      <div className="absolute inset-0 bg-slate-950 p-6 flex flex-col items-center justify-center text-center gap-4 z-20">
                        <Camera className="w-10 h-10 text-red-500 animate-pulse" />
                        <div className="space-y-1">
                          <p className="text-xs text-red-400 font-bold leading-relaxed">{cameraPermissionError}</p>
                          <p className="text-[10px] text-slate-400 leading-normal font-bold">
                            আইফ্রেম (Preview IFrame) বা ব্রাউজার সিকিউরিটি ক্যামেরা অ্যাক্সেস ব্লক করে থাকতে পারে। সরাসরি নতুন ট্যাবে অ্যাপটি খুললে চমৎকারভাবে ক্যামেরা চালু হবে।
                          </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full justify-center">
                          <button
                            onClick={() => setActiveScanner(prev => !prev)}
                            className="bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-700 transition-colors"
                          >
                            আবার চেষ্টা করুন
                          </button>
                          <a 
                            href={window.location.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1 text-center"
                          >
                            নতুন ট্যাবে খুলুন (Open in New Tab)
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Micro Control Bar */}
                  {cameraStatus === "scanning" && (
                    <div className="bg-slate-900 p-4 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        {/* Camera Quick Toggle Flip Button */}
                        <button
                          type="button"
                          onClick={toggleFrontBackCamera}
                          disabled={cameras.length < 2}
                          className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          title="ক্যামেরা পরিবর্তন করুন"
                        >
                          <RotateCw size={18} className="animate-spin-slow" />
                        </button>

                        {/* Flashlight/Torch toggle button */}
                        <button
                          type="button"
                          onClick={handleToggleFlashlight}
                          disabled={!supportTorch}
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
                            flashlightActive
                              ? "bg-amber-400 text-slate-950 border-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                              : "bg-white/5 text-white border-white/10 hover:bg-white/10 disabled:opacity-30"
                          }`}
                          title="ফ্ল্যাশলাইট"
                        >
                          {flashlightActive ? <Zap size={18} /> : <ZapOff size={18} />}
                        </button>

                        {/* Audio beacon feedback toggle */}
                        <button
                          type="button"
                          onClick={() => setAudioEnabled(!audioEnabled)}
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition-all ${
                            audioEnabled 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-white/5 text-slate-400 border-white/10"
                          }`}
                          title="সাউন্ড নোটিফিকেশন"
                        >
                          {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                        </button>

                        {/* Selector info container */}
                        <div className="flex-1 max-w-[120px]">
                          <select
                            value={selectedCameraId}
                            onChange={(e) => {
                              setSelectedCameraId(e.target.value);
                              setFlashlightActive(false);
                            }}
                            className="w-full text-[11px] font-black uppercase text-slate-300 bg-slate-950/70 border border-white/10 rounded-xl px-2 py-2 focus:outline-none focus:border-emerald-500/50"
                          >
                            {cameras.map((cam, idx) => (
                              <option key={cam.id} value={cam.id} className="bg-slate-950 text-white">
                                {cam.label ? (cam.label.length > 14 ? `Cam ${idx+1}` : cam.label) : `Lens ${idx+1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Hardware Zoom range controller */}
                      {supportZoom && (
                        <div className="space-y-1 bg-black/40 p-3 rounded-2xl border border-white/5 select-none">
                          <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-slate-400">
                            <span className="flex items-center gap-1"><Sliders size={10} /> Zoom Magnifier</span>
                            <span className="text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">{zoomLevel.toFixed(1)}x</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min="1"
                              max={maxZoom}
                              step="0.1"
                              value={zoomLevel}
                              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                              className="flex-1 accent-emerald-400 bg-slate-800 rounded-lg appearance-none h-1 cursor-pointer"
                            />
                            {/* Zoom Preset triggers */}
                            <div className="flex gap-1.5">
                              {[1, 2, 4].filter(z => z <= maxZoom).map((z) => (
                                <button
                                  key={z}
                                  type="button"
                                  onClick={() => handleZoomChange(z)}
                                  className={`text-[9px] font-black uppercase px-2 py-1 rounded border transition-all ${
                                    Math.round(zoomLevel) === z 
                                      ? "bg-emerald-400 text-slate-950 border-emerald-500" 
                                      : "bg-slate-950/50 text-slate-400 border-white/5 hover:text-white"
                                  }`}
                                >
                                  {z}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Technical hardware metadata indicators */}
                      <div className="flex justify-between items-center pt-1 border-t border-white/5 text-[9px] font-bold text-slate-500 uppercase tracking-widest select-none">
                        <span>Lens Status: {getCameraQualityLabel()}</span>
                        <span>Auto Focus: ACTIVE</span>
                      </div>
                    </div>
                  )}

                  {/* Manual Input Fallback Verification Search */}
                  <div className="bg-slate-900 border border-white/5 p-5 rounded-3xl space-y-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-bengali block">
                      অথবা ক্যাডেট আইডি দিয়ে ম্যানুয়ালি ভেরিফাই করুন (Manual Fallback)
                    </span>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const targetField = e.currentTarget.elements.namedItem("manualCadetId") as HTMLInputElement;
                      const inputId = targetField?.value?.trim() || "";
                      if (!inputId) return;
                      setLoading(true);
                      setError(null);

                      // 1. Check if authorized role: only Super Admin and QR Admin can manually search. Public/user rolls are blocked.
                      const session = getSession();
                      const isAuthorized = session?.role === "super_admin" || session?.role === "qr_admin";
                      if (!isAuthorized) {
                        setError("QR Verification Required. Please scan QR Code to view details. সাধারণ ব্যবহারকারীদের জন্য ম্যানুয়াল ক্যাডেট সার্চ করার সুবিধা বন্ধ রয়েছে।");
                        setTimeout(() => setError(null), 5000);
                        setLoading(false);

                        // Log event
                        try {
                          await setDoc(doc(collection(db, "security_logs")), {
                            attemptType: "Manual Access Blocked",
                            timestamp: Timestamp.now(),
                            userRole: session?.role || "public_user",
                            userId: session?.id || session?.username || "anonymous",
                            reason: "Manual lookup attempted by public user or unauthorized role",
                            attemptedId: inputId
                          });
                        } catch (logErr) {
                          console.error("Failed to write safety security_log:", logErr);
                        }
                        return;
                      }

                      try {
                        let cleanInputId = inputId.trim();
                        if (cleanInputId.startsWith("http://") || cleanInputId.startsWith("https://")) {
                          try {
                            const url = new URL(cleanInputId);
                            const pId = new URLSearchParams(url.search).get("id");
                            if (pId) cleanInputId = pId.trim();
                            else {
                              const segs = url.pathname.split("/").filter(Boolean);
                              if (segs.length > 0) cleanInputId = segs[segs.length - 1].trim();
                            }
                          } catch {
                            // ignore
                          }
                        }

                        if (cleanInputId.includes("/") || cleanInputId.includes("\\")) {
                          setError("অবৈধ ID ফরম্যাট।");
                          setTimeout(() => setError(null), 4000);
                          return;
                        }

                        const docRef = doc(db, "applicants", cleanInputId);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                          const rawData = docSnap.data();

                          // 2. GENDER-BASED SECURITY RULE: Block female manual lookup completely (even for verified admins on public page)
                          if (rawData.gender === "Female") {
                            setError("Access Restricted - Female cadet profiles can only be verified via secure QR Scan. নিরাপত্তা নীতিমালায় নারী ক্যাডেটদের ম্যানুয়াল সার্চ সম্পূর্ণ নিষিদ্ধ।");
                            setTimeout(() => setError(null), 6000);

                            // Log event
                            try {
                              await setDoc(doc(collection(db, "security_logs")), {
                                attemptType: "Manual Access Blocked",
                                timestamp: Timestamp.now(),
                                userRole: session?.role || "unknown",
                                userId: session?.id || session?.username || "unknown",
                                reason: "Manual ID lookup of female cadet was completely blocked",
                                attemptedId: inputId
                              });
                            } catch (logErr) {
                              console.error("Failed to write safety security_log:", logErr);
                            }
                            return;
                          }

                          const approvedStatus = rawData.status === "Approved" || rawData.status === "Joined";
                          const publicProfile = {
                            id: inputId,
                            fullNameEnglish: rawData.fullNameEnglish,
                            fullNameBangla: rawData.fullNameBangla,
                            academicYear: rawData.academicYear,
                            studyStatus: rawData.studyStatus,
                            photo: rawData.photo,
                            status: rawData.status,
                            collegeName: rawData.collegeName || "কক্সবাজার সিটি কলেজ (Cox's Bazar City College)",
                            platoonName: "কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন (Cox's Bazar City College BNCC Platoon)",
                            isValidCadet: approvedStatus
                          };
                          setCadetData(publicProfile);
                          targetField.value = "";
                        } else {
                          setError("ক্যাডেট তথ্য পাওয়া যায়নি! সঠিক কিউআর বা আইডি ভেরিফাই করুন।");
                          setTimeout(() => setError(null), 4000);
                        }
                      } catch (err) {
                        console.error("Public manual lookup error:", err);
                        setError("তথ্য ভেরিফাই করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
                        setTimeout(() => setError(null), 4000);
                      } finally {
                        setLoading(false);
                      }
                    }} className="flex gap-2">
                      <input
                        type="text"
                        name="manualCadetId"
                        placeholder="ক্যাডেট আইডি লিখুন (যেমন: ID: gRpxq9fKaY3L...)"
                        className="flex-1 bg-white/5 border border-white/5 text-white placeholder-slate-500 rounded-xl px-4 py-3.5 text-xs outline-none focus:border-emerald-500 font-mono font-bold"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        যাচাই
                      </button>
                    </form>
                  </div>

                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="results-layout"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 rounded-3xl bg-slate-900 border border-white/5 shadow-2xl space-y-6 text-center"
            >
              {/* Cadet validation alert */}
              {cadetData.isValidCadet ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                    <ShieldCheck className="w-6 h-6 text-emerald-400 animate-bounce" />
                  </div>
                  <h3 className="text-emerald-400 font-black text-sm uppercase tracking-wider">VERIFIED CADET</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Cox's Bazar City College</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center border border-amber-500/30">
                    <ShieldAlert className="w-6 h-6 text-amber-400 animate-bounce" />
                  </div>
                  <h3 className="text-amber-400 font-black text-sm uppercase tracking-wider">PENDING VERIFICATION</h3>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-black">Cox's Bazar City College</p>
                </div>
              )}

              {/* Limited Profile Data Only */}
              <div className="space-y-4 p-5 bg-slate-950 rounded-2xl border border-white/5">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-emerald-500 mx-auto shadow-xl bg-slate-900">
                  {cadetData.photo ? (
                    <img src={cadetData.photo} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-10 h-10 text-slate-700" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-lg font-black text-white">{cadetData.fullNameEnglish}</h4>
                  <p className="text-sm font-bold text-slate-400 font-bengali">{cadetData.fullNameBangla}</p>
                </div>

                <div className="h-px bg-white/5" />

                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black">CADET ID</span>
                    <p className="text-xs font-mono font-bold text-emerald-400">{cadetData.id}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black">SESSION</span>
                    <p className="text-xs font-bold text-white">{cadetData.academicYear || "N/A"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black font-bengali">প্রতিষ্ঠান (Institution)</span>
                    <p className="text-xs font-bold text-white uppercase">{cadetData.collegeName || "কক্সবাজার সিটি কলেজ (Cox's Bazar City College)"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-black font-bengali">প্লাটুন (Platoon Branch)</span>
                    <p className="text-xs font-bold text-slate-300 uppercase">{cadetData.platoonName || "কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন (Cox's Bazar City College BNCC Platoon)"}</p>
                  </div>
                  <div className="col-span-2 text-center pt-2">
                    <span className="text-[9.5px] uppercase tracking-wider text-slate-500 font-black block mb-1">VERIFICATION STATUS</span>
                    <span className={`inline-block px-3 py-1 text-[9.5px] font-black tracking-widest text-white uppercase rounded-full ${
                      cadetData.status === "Approved" || cadetData.status === "Joined" ? "bg-emerald-500 animate-pulse" : "bg-amber-600"
                    }`}>
                      {cadetData.status || "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setCadetData(null)}
                className="w-full py-4 bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <RefreshCw size={14} /> আরেকটি কোড স্ক্যান করুন
              </button>

            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center">
          <p className="text-slate-700 text-[8px] tracking-widest uppercase font-bold">
            Cox's Bazar City College BNCC Platoon • QR Verifier
          </p>
        </div>

      </div>
    </div>
  );
}
