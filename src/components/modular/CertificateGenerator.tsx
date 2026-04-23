import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Download, ShieldCheck, X, FileText, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import * as htmlToImage from 'html-to-image';

interface CertificateProps {
  id: string;
  name: string;
  type: string;
  date: string;
  onClose: () => void;
}

export function CertificateGenerator({ id, name, type, date, onClose }: CertificateProps) {
  const [downloading, setDownloading] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);

  const handleDownload = async () => {
    if (!certRef.current || downloading) return;
    try {
      setDownloading(true);
      const element = certRef.current;
      const imgData = await htmlToImage.toJpeg(element, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 3,
      });

      const pdf = new jsPDF({
        orientation: "l",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BNCC_Certificate_${name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Certificate generation error:", error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-bg-light/95 backdrop-blur-md"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl glass-card rounded-[3rem] shadow-2xl overflow-hidden border border-white/10"
      >
        <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award size={24} className="text-primary" />
            <h3 className="text-lg font-black uppercase tracking-widest text-white">Digital Certificate Preview</h3>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-6 py-3 bg-primary text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-cyan-400 transition-all flex items-center gap-2 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-12 overflow-x-auto no-scrollbar flex justify-center bg-slate-950/50">
          <div 
            ref={certRef}
            className="w-[297mm] h-[210mm] bg-white text-slate-900 relative shadow-2xl flex-shrink-0"
            style={{ 
              fontFamily: "'Playfair Display', serif",
              padding: "20mm",
            }}
          >
            {/* Border Design */}
            <div className="absolute inset-0 border-[6mm] border-[#4B5320]"></div>
            <div className="absolute inset-[8mm] border-[1px] border-[#4B5320]"></div>
            
            {/* Corners */}
            <div className="absolute top-[8mm] left-[8mm] w-24 h-24 border-t-8 border-l-8 border-[#B8860B]"></div>
            <div className="absolute top-[8mm] right-[8mm] w-24 h-24 border-t-8 border-r-8 border-[#B8860B]"></div>
            <div className="absolute bottom-[8mm] left-[8mm] w-24 h-24 border-b-8 border-l-8 border-[#B8860B]"></div>
            <div className="absolute bottom-[8mm] right-[8mm] w-24 h-24 border-b-8 border-r-8 border-[#B8860B]"></div>

            <div className="w-full h-full border-2 border-slate-200 flex flex-col items-center p-16 text-center space-y-10 relative">
              {/* Logo */}
              <div className="flex items-center gap-8 mb-4">
                <img src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" className="h-28 w-auto grayscale contrast-125" alt="BNCC Logo" />
                <div className="h-24 w-px bg-slate-200"></div>
                <img src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" className="h-28 w-auto grayscale contrast-125" alt="College Logo" />
              </div>

              <div className="space-y-4">
                <h1 className="text-6xl font-black uppercase tracking-[0.2em] text-[#4B5320]">Certificate</h1>
                <p className="text-xl font-bold tracking-[0.5em] text-slate-500 uppercase">of Achievement</p>
              </div>

              <div className="space-y-6 max-w-2xl">
                 <p className="text-lg italic font-medium">This is to certify that</p>
                 <h2 className="text-5xl font-black border-b-2 border-slate-900 px-12 py-4 inline-block">{name}</h2>
                 <p className="text-lg leading-relaxed">
                   has successfully completed the <strong>{type}</strong> training program of 
                   <strong> Cox’s Bazar City College BNCC Platoon (Army Wing)</strong> 
                   with outstanding performance and dedication.
                 </p>
              </div>

              <div className="w-full mt-auto flex justify-between items-end px-12">
                <div className="text-center space-y-2 border-t border-slate-300 pt-4 w-64">
                   <p className="text-sm font-black uppercase tracking-widest">Issued Date</p>
                   <p className="text-sm font-bold opacity-60">{date}</p>
                </div>
                
                <div className="flex flex-col items-center gap-2 mb-[-20px]">
                   <ShieldCheck size={48} className="text-[#4B5320] opacity-20" />
                   <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Unique ID: {id}</p>
                </div>

                <div className="text-center space-y-2 border-t border-slate-300 pt-4 w-64">
                   <p className="text-sm font-black uppercase tracking-widest leading-none">Platoon Officer</p>
                   <p className="text-[10px] font-bold opacity-60">Cox's Bazar City College</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
