import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db, doc, getDoc, handleFirestoreError, OperationType } from "../firebase";

export function AdmitCard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchApplicant = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "applicants", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setApplicant({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `applicants/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchApplicant();
  }, [id]);

  // Automatically trigger download if URL param is present
  useEffect(() => {
    if (applicant && searchParams.get("download") === "true") {
      const timer = setTimeout(() => handleDownloadPDF(), 2000);
      return () => clearTimeout(timer);
    }
  }, [applicant, searchParams]);

  const handleDownloadPDF = async () => {
    if (!cardRef.current || !applicant) return;
    setIsGenerating(true);

    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // Higher scale for professional print quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Admit_Card_${applicant.fullName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Failed to generate PDF. Please try the Print button instead.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-green-500" />
        <p className="text-slate-400 animate-pulse">আবেদন তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-white gap-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <h2 className="text-2xl font-bold">Applicant Not Found</h2>
        <p className="text-slate-400">The record you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      {/* CSS for Print Mode */}
      <style>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .print-hidden { display: none !important; }
          .print-area { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="text-center space-y-4 print-hidden">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-white">আবেদন সফল হয়েছে!</h1>
        <p className="text-slate-400">আপনার প্রবেশপত্রটি ডাউনলোড বা প্রিন্ট করে সংরক্ষণ করুন।</p>
      </div>

      {/* Admit Card Preview */}
      <div className="flex justify-center overflow-x-auto pb-8 no-scrollbar">
        <div 
          ref={cardRef}
          className="print-area w-[210mm] min-h-[297mm] bg-white text-black relative shadow-2xl flex-shrink-0"
          style={{ padding: "15mm" }}
        >
          <div className="w-full h-full border-[3px] border-[#4B5320] rounded-sm p-8 relative flex flex-col min-h-[267mm]">
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] pointer-events-none">
              <img 
                src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                alt="Watermark" 
                className="w-[350px] grayscale" 
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative z-10">
              <img src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" className="w-20 h-20 object-contain" alt="College" crossOrigin="anonymous" />
              <div className="text-center flex-grow">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">COX’S BAZAR CITY COLLEGE</h2>
                <h3 className="text-lg font-bold text-[#4B5320] uppercase">BNCC PLATOON (ARMY WING)</h3>
                <div className="mt-3 inline-block bg-[#4B5320] text-white py-1 px-6 rounded-sm">
                  <h1 className="text-xl font-bold uppercase tracking-widest">ADMIT CARD 2025</h1>
                </div>
              </div>
              <img src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" className="w-20 h-20 object-contain" alt="BNCC" crossOrigin="anonymous" />
            </div>

            <div className="flex justify-between items-start mb-10 relative z-10 border-b-2 border-gray-100 pb-8">
              <div className="space-y-4 flex-grow">
                {[
                  { label: "Candidate Name", value: applicant.fullName },
                  { label: "Application ID", value: applicant.id, highlight: true },
                  { label: "College Roll", value: applicant.roll },
                  { label: "Department", value: applicant.class },
                  { label: "Date of Birth", value: applicant.dob },
                  { label: "Mobile", value: applicant.mobile },
                ].map((item, i) => (
                  <div key={i} className="flex items-center">
                    <span className="w-40 font-bold text-xs uppercase text-gray-500">{item.label}</span>
                    <span className="mx-2">:</span>
                    <span className={`text-sm font-bold ${item.highlight ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                <div className="w-[1.4in] h-[1.7in] border-2 border-gray-200 rounded p-1 bg-white">
                  <img 
                    src={applicant.photo || "https://via.placeholder.com/150"} 
                    className="w-full h-full object-cover rounded-sm" 
                    alt="Candidate"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="flex flex-col items-center p-2 border-2 border-dashed border-gray-200 rounded">
                  <QRCodeSVG value={applicant.id || "N/A"} size={70} />
                  <span className="text-[9px] mt-1 font-mono">{applicant.id}</span>
                </div>
              </div>
            </div>

            {/* Notice Section */}
            <div className="mb-8 p-4 bg-gray-50 border-l-4 border-[#4B5320]">
              <h4 className="text-sm font-bold uppercase text-[#4B5320] mb-1">Examination Notice</h4>
              <p className="text-xs text-gray-700 leading-relaxed">
                Exam dates and seat plans will be published on our official page. 
                Keep this card safe. Link: <span className="font-bold text-blue-700">facebook.com/cbcc.bncc</span>
              </p>
            </div>

            {/* Instructions */}
            <div className="flex-grow">
              <h4 className="text-xs font-bold uppercase mb-3 border-b border-black inline-block">General Instructions</h4>
              <ul className="text-[10.5px] leading-relaxed space-y-1.5 list-decimal pl-4 text-gray-800">
                <li>Candidates must bring a printed copy of this admit card.</li>
                <li>Report at least 30 minutes before the scheduled time.</li>
                <li>Male candidates must have a clean "Army Cut" hairstyle.</li>
                <li>Wear clean college uniform or sports attire as instructed.</li>
                <li>Electronic gadgets (smartwatches, mobile phones) are strictly prohibited.</li>
                <li>Misconduct will lead to immediate disqualification.</li>
              </ul>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-6 flex justify-between items-end">
              <div className="text-[9px] text-gray-400">
                <p>Generated: {new Date().toLocaleString()}</p>
                <p>Verification Hash: {btoa(applicant.id).substring(0, 12)}</p>
              </div>
              <div className="text-center border-t border-black px-6 pt-1">
                <p className="text-[10px] font-bold">Authorized Digital Signature</p>
                <p className="text-[8px] text-gray-500 tracking-tighter">BNCC PLATOON COMMANDER, CBCC</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 print-hidden pb-20">
        <button
          disabled={isGenerating}
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-8 py-4 bg-[#4B5320] text-white font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          {isGenerating ? "Generating..." : "Download PDF"}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-8 py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-all shadow-xl border border-gray-200"
        >
          <Printer className="w-5 h-5" /> Print Card
        </button>
      </div>
    </div>
  );
}