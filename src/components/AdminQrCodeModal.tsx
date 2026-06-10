import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw, Calendar, Shield, Check, Copy, Printer, Download } from "lucide-react";
import { db, doc, setDoc, getDocs, deleteDoc, collection, query, where, Timestamp } from "../firebase";

interface AdminQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: {
    id: string;
    username: string;
    name: string;
    role?: string;
  };
}

export function AdminQrCodeModal({ isOpen, onClose, admin }: AdminQrCodeModalProps) {
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [expiryDays, setExpiryDays] = useState<number>(30); // Default 30 days
  const [copied, setCopied] = useState(false);

  // Use specified role or fall back based on username
  const adminRole = admin.role || (admin.username === "admin" ? "super_admin" : "sub_admin");

  useEffect(() => {
    if (isOpen && admin) {
      fetchOrGenerateToken();
    }
  }, [isOpen, admin]);

  const fetchOrGenerateToken = async (forceRotate = false) => {
    setLoading(true);
    try {
      if (!forceRotate) {
        // Look up existing token for this admin's username
        const q = query(
          collection(db, "adminTokens"),
          where("username", "==", admin.username.toLowerCase())
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0].data();
          const docId = querySnapshot.docs[0].id;
          
          // Check if expired
          const now = Date.now();
          const expiresAtMs = docData.expiresAt ? docData.expiresAt.toMillis() : Infinity;
          if (now < expiresAtMs) {
            setTokenData({ id: docId, ...docData });
            setLoading(false);
            return;
          } else {
            // Delete expired token doc
            await deleteDoc(doc(db, "adminTokens", docId));
          }
        }
      }

      // Generate secure unique token
      const randomPart = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const uniqueToken = `adm_qr_${admin.username.toLowerCase()}_${randomPart}`;
      
      const expiresAt = expiryDays === -1 
        ? null 
        : Timestamp.fromMillis(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      const tokenRef = doc(collection(db, "adminTokens"));
      const newTokenPayload = {
        qrToken: uniqueToken,
        username: admin.username.toLowerCase(),
        name: admin.name,
        role: adminRole,
        createdAt: Timestamp.now(),
        expiresAt
      };

      // If rotating, delete any existing token docs first
      const qOld = query(
        collection(db, "adminTokens"),
        where("username", "==", admin.username.toLowerCase())
      );
      const snapOld = await getDocs(qOld);
      for (const oldDoc of snapOld.docs) {
        await deleteDoc(doc(db, "adminTokens", oldDoc.id));
      }

      await setDoc(tokenRef, newTokenPayload);
      setTokenData({ id: tokenRef.id, ...newTokenPayload });
    } catch (err) {
      console.error("Error managing admin token:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!tokenData?.qrToken) return;
    navigator.clipboard.writeText(tokenData.qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const svg = document.getElementById("admin-qr-svg");
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const blobURL = (window.URL || (window as any).webkitURL).createObjectURL(svgBlob);
    
    // Create downloaded filename
    const link = document.createElement("a");
    link.href = blobURL;
    link.download = `${admin.username}_qr_login_code.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    const qrSvgElement = document.getElementById("admin-qr-svg");
    const svgOuterHTML = qrSvgElement ? qrSvgElement.outerHTML : "";
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Admin QR Code - ${admin.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; text-align: center; padding: 40px; color: #333; }
            .card { border: 2px solid #eaeaea; border-radius: 20px; padding: 30px; display: inline-block; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            h1 { font-size: 20px; margin-bottom: 5px; color: #0f172a; }
            p { font-size: 13px; color: #64748b; margin-top: 0; }
            .role { display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: bold; text-transform: uppercase; border-radius: 100px; background-color: #ef4444; color: white; margin-bottom: 20px; letter-spacing: 1px; }
            .qr-holder { margin: 20px auto; padding: 15px; background: white; display: inline-block; border-radius: 12px; border: 1px solid #f1f5f9; }
            .meta { font-size: 11px; color: #94a3b8; font-family: monospace; word-break: break-all; margin-top: 15px; }
            .warning { font-size: 12px; font-weight: bold; color: #b91c1c; background-color: #fef2f2; padding: 10px; border-radius: 8px; margin-top: 20px; border: 1px solid #fee2e2; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="role">${adminRole.replace("_", " ")}</span>
            <h1>${admin.name}</h1>
            <p>Cox's Bazar City College BNCC Platoon</p>
            <div class="qr-holder">${svgOuterHTML}</div>
            <p class="meta">TOKEN: ${tokenData?.qrToken || "N/A"}</p>
            <p style="font-size: 11px; color: #64748b;">Expires: ${tokenData?.expiresAt ? tokenData.expiresAt.toDate().toLocaleDateString() : "Never (Permanent)"}</p>
            <div class="warning">WARNING: Keep this QR Code highly private. Anyone with this QR can instantly login to your administrative account.</div>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative border border-slate-100"
          >
            {/* Header */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-500" />
                <div>
                  <h3 className="font-black uppercase tracking-tight text-sm">অ্যাডমিন QR কোড</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{admin.name}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {loading ? (
                <div className="h-64 flex flex-col items-center justify-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">টোকেন প্রস্তুত হচ্ছে...</p>
                </div>
              ) : tokenData ? (
                <div className="flex flex-col items-center text-center space-y-5">
                  {/* Badge */}
                  <span className="px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-500 text-white shadow-lg shadow-rose-500/20">
                    {adminRole.replace("_", " ")}
                  </span>

                  {/* QR Image Frame */}
                  <div className="p-5 bg-gradient-to-tr from-slate-50 to-slate-100/50 border border-slate-100 rounded-3xl shadow-inner relative flex items-center justify-center">
                    <QRCodeSVG
                      id="admin-qr-svg"
                      value={tokenData.qrToken}
                      size={180}
                      level="H"
                      includeMargin={true}
                      className="rounded-2xl bg-white p-2.5 shadow-sm"
                    />
                  </div>

                  {/* Expiration Config */}
                  <div className="w-full bg-slate-50 border border-slate-100/80 p-4 rounded-2xl text-left space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Calendar size={13} /> মেয়াদ নির্ধারণ করুন:
                      </span>
                      <span className="font-mono bg-slate-200/50 text-slate-700 px-2.5 py-0.5 rounded-md font-bold text-[10px]">
                        {tokenData.expiresAt ? tokenData.expiresAt.toDate().toLocaleDateString() : "স্থায়ী (Permanent)"}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '১ দিন', value: 1 },
                        { label: '৭ দিন', value: 7 },
                        { label: '৩০ দিন', value: 30 },
                        { label: 'স্থায়ী', value: -1 }
                      ].map((item) => (
                        <button
                          key={item.value}
                          onClick={() => {
                            setExpiryDays(item.value);
                            // Set immediate update
                            setTimeout(() => fetchOrGenerateToken(true), 50);
                          }}
                          className={`py-2 text-[10px] font-black rounded-lg border uppercase transition-all ${
                            expiryDays === item.value
                              ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/10"
                              : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warning message */}
                  <p className="text-[10px] leading-relaxed text-red-500 font-bold bg-red-50 p-3 rounded-xl border border-red-100">
                    সতর্কতা: এই QR কোডটি সম্পূর্ণ গোপন রাখুন। এটি দিয়ে পাসওয়ার্ড ছাড়াই সরাসরি অ্যাডমিন প্যানেলে প্রবেশ করা যাবে।
                  </p>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                      onClick={handleCopy}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                      টোকেন কপি করুন
                    </button>
                    <button
                      onClick={() => fetchOrGenerateToken(true)}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-400" />
                      কোড পরিবর্তন
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 w-full border-t border-slate-100 pt-4">
                    <button
                      onClick={handleDownload}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                    >
                      <Download className="w-4 h-4" />
                      ডাউনলোড
                    </button>
                    <button
                      onClick={handlePrint}
                      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-md shadow-rose-500/15"
                    >
                      <Printer className="w-4 h-4" />
                      প্রিন্ট করুন
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">কোনো টোকেন লোড করা যায়নি।</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
