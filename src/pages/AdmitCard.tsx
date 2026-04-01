import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, CheckCircle, Shield, Loader2, ExternalLink, ArrowLeft, FileCheck, Info } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { db, doc, getDoc, handleFirestoreError, OperationType } from "../firebase";
import { motion } from "framer-motion";

export function AdmitCard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchApplicant = async () => {
      if (!id) return;
      const path = `applicants/${id}`;
      try {
        const docRef = doc(db, "applicants", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setApplicant(docSnap.data());
        } else {
          console.error("No such document!");
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchApplicant();
  }, [id]);

  useEffect(() => {
    if (applicant && searchParams.get("download") === "true") {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [applicant, searchParams]);

  const handleDownloadPDF = async () => {
    if (!cardRef.current || downloading) return;
    
    try {
      setDownloading(true);
      
      const images = Array.from(cardRef.current.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const timeout = setTimeout(() => resolve(null), 5000);
          img.onload = () => { clearTimeout(timeout); resolve(null); };
          img.onerror = () => { clearTimeout(timeout); resolve(null); };
        });
      }));

      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = cardRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        imageTimeout: 15000,
        removeContainer: true,
      });

      window.scrollTo(0, originalScrollY);

      if (!canvas) throw new Error("Failed to create canvas");

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BNCC_Admit_Card_${applicant.id}.pdf`);
    } catch (error) {
      console.error("PDF Generation error:", error);
      alert("Error generating PDF. Please try the 'Open in New Tab' option.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      console.error("Print error:", error);
      alert("Printing failed. Please try opening in a new tab.");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="micro-label">Retrieving Credentials...</p>
    </div>
  );

  if (!applicant) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      <Shield className="w-16 h-16 text-accent" />
      <h2 className="text-2xl font-black uppercase">Applicant Not Found</h2>
      <button onClick={() => window.history.back()} className="btn-hover px-6 py-3 bg-ink text-white font-bold uppercase tracking-widest text-xs rounded-sm">Return to Base</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper pb-24">
      {/* Header Banner */}
      <div className="bg-ink py-12 mb-12 border-b border-primary/20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <FileCheck className="text-primary" size={24} />
              <span className="micro-label !text-white/60">Official Document Retrieval</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">Enrollment Successful</h1>
            <p className="text-white/40 font-light">Your application has been processed. Please download your admit card below.</p>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-8 py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-sm btn-hover flex items-center gap-3 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              Download PDF
            </button>
            <button
              onClick={handlePrint}
              className="px-8 py-4 border border-white/20 text-white font-black uppercase tracking-widest text-xs rounded-sm hover:bg-white/10 transition-all flex items-center gap-3"
            >
              <Printer size={18} />
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-8 rounded-sm space-y-6 border-l-4 border-primary"
          >
            <h3 className="text-xl font-black uppercase tracking-tight">Candidate Status</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-ink/5">
                <span className="text-xs font-bold uppercase text-ink/40">Status</span>
                <span className="px-3 py-1 bg-green-500/10 text-green-600 text-[10px] font-black uppercase rounded-full">Verified</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-ink/5">
                <span className="text-xs font-bold uppercase text-ink/40">ID Number</span>
                <span className="font-mono text-sm font-bold">{applicant.id}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-ink/5">
                <span className="text-xs font-bold uppercase text-ink/40">Session</span>
                <span className="font-mono text-sm font-bold">2026-27</span>
              </div>
            </div>
          </motion.div>

          <div className="p-6 bg-primary/5 border border-primary/10 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Info size={18} />
              <span className="font-black uppercase text-xs tracking-widest">Instructions</span>
            </div>
            <ul className="space-y-3">
              {[
                "Bring this card to the examination hall.",
                "Original NID/Birth Certificate required.",
                "Report 30 minutes before schedule.",
                "Electronic devices are strictly prohibited."
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-xs text-ink/60 font-medium">
                  <span className="text-primary">•</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => window.open(window.location.href, '_blank')}
            className="w-full py-4 border border-ink/10 text-ink/60 font-black uppercase tracking-widest text-[10px] rounded-sm hover:bg-ink hover:text-white transition-all flex items-center justify-center gap-3"
          >
            <ExternalLink size={14} />
            Open in New Tab
          </button>
        </div>

        {/* Admit Card Preview */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-6">
            <span className="micro-label">Document Preview</span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
          </div>

          <div className="flex justify-center overflow-x-auto pb-8 no-scrollbar bg-ink/5 p-8 rounded-sm border border-ink/5">
            <div 
              ref={cardRef}
              id="admitCard"
              className="print-area w-[210mm] h-[297mm] bg-white text-black relative shadow-2xl flex-shrink-0 print:shadow-none print:m-0"
              style={{ 
                fontFamily: "'Roboto', sans-serif",
                padding: "0.75in",
              }}
            >
              {/* Watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="Watermark" 
                  className="w-[300px] h-auto grayscale" 
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Outer Border */}
              <div className="w-full h-full border-2 border-black rounded-[5px] p-6 relative flex flex-col">
                {/* Army Green Header Strip */}
                <div className="absolute top-0 left-0 w-full h-2 bg-[#4B5320] rounded-t-[3px]"></div>

                {/* Header Section */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="w-16 h-16 flex items-center justify-center">
                    <img 
                      src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                      alt="College Logo" 
                      className="max-h-full max-w-full" 
                      referrerPolicy="no-referrer" 
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="text-center flex-grow px-4">
                    <h2 className="text-lg font-bold font-montserrat uppercase leading-tight">COX’S BAZAR CITY COLLEGE</h2>
                    <h3 className="text-sm font-semibold font-montserrat text-[#4B5320] uppercase leading-tight">BNCC PLATOON (ARMY WING)</h3>
                    <div className="mt-1 inline-block border-y border-black py-0.5 px-4">
                      <h1 className="text-xl font-extrabold font-montserrat uppercase tracking-wider">ADMIT CARD 2026</h1>
                    </div>
                    <p className="text-[9px] font-medium italic mt-0.5 text-gray-600">
                      “Computer Generated Admit Card (No Signature Required)”
                    </p>
                  </div>
                  <div className="w-16 h-16 flex items-center justify-center">
                    <img 
                      src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                      alt="BNCC Logo" 
                      className="max-h-full max-w-full" 
                      referrerPolicy="no-referrer" 
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>

                <hr className="border-black mb-4" />

                {/* Candidate Section */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-[1.2in] h-[1.5in] border border-black overflow-hidden bg-gray-50 flex items-center justify-center">
                      {applicant.photo ? (
                        <img 
                          src={applicant.photo} 
                          className="w-full h-full object-cover" 
                          alt="Candidate" 
                          referrerPolicy="no-referrer" 
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <span className="text-[10px] text-gray-400">Photo</span>
                      )}
                    </div>
                    <span className="text-[9px] font-bold uppercase">Candidate Photo</span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div className="w-[1.2in] h-[1.5in] border border-black p-2 flex flex-col items-center justify-center bg-white">
                      <QRCodeCanvas 
                        value={JSON.stringify({
                          id: applicant.id,
                          name: applicant.fullNameEnglish,
                          classRoll: applicant.classRoll,
                          status: applicant.status
                        })} 
                        size={80} 
                      />
                      <div className="mt-2 text-center">
                        <p className="text-[9px] font-bold leading-none">ID: {applicant.id}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold uppercase">Verification QR</span>
                  </div>
                </div>

                {/* Candidate Information Section */}
                <div className="mb-4 relative z-10">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    {[
                      { label: "Full Name", value: applicant.fullNameEnglish },
                      { label: "Application ID", value: applicant.id },
                      { label: "Father's Name", value: applicant.fatherNameEnglish },
                      { label: "Mother's Name", value: applicant.motherNameEnglish },
                      { label: "Date of Birth", value: applicant.dob },
                      { label: "Gender", value: applicant.gender },
                      { label: "NID / Birth Reg", value: applicant.nidBirthReg },
                      { label: "Religion", value: applicant.religion },
                      { label: "Roll Number", value: applicant.classRoll },
                      { label: "Department / Group", value: applicant.studyStatus },
                      { label: "Mobile Number", value: applicant.studentPhone },
                      { label: "Blood Group", value: applicant.bloodGroup },
                      { label: "Height", value: `${applicant.heightFeet}'${applicant.heightInches}"` },
                      { label: "Weight", value: `${applicant.weightKg} kg` },
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline">
                        <span className="w-32 font-bold text-[11px] uppercase font-montserrat shrink-0">{item.label}</span>
                        <span className="mx-1 font-bold text-[11px]">:</span>
                        <span className="flex-grow font-medium text-[11px] border-b border-dotted border-gray-400 pb-0.5 truncate">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 grid grid-cols-1 gap-y-2">
                    {[
                      { label: "Present Address", value: applicant.presentAddress },
                      { label: "Permanent Address", value: applicant.permanentAddress },
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline">
                        <span className="w-32 font-bold text-[11px] uppercase font-montserrat shrink-0">{item.label}</span>
                        <span className="mx-1 font-bold text-[11px]">:</span>
                        <span className="flex-grow font-medium text-[11px] border-b border-dotted border-gray-400 pb-0.5">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2">
                    {[
                      { label: "SSC GPA", value: applicant.sscGpa },
                      { label: "SSC Group", value: applicant.sscGroup },
                      { label: "SSC Year", value: applicant.sscYear },
                      { label: "SSC Board", value: applicant.sscBoard },
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline">
                        <span className="w-32 font-bold text-[11px] uppercase font-montserrat shrink-0">{item.label}</span>
                        <span className="mx-1 font-bold text-[11px]">:</span>
                        <span className="flex-grow font-medium text-[11px] border-b border-dotted border-gray-400 pb-0.5">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Examination Notice */}
                <div className="mb-4 relative z-10 flex items-start gap-4">
                  <div className="flex-grow">
                    <hr className="border-black mb-2" />
                    <h4 className="text-[12px] font-bold font-montserrat uppercase mb-1 text-[#4B5320]">Examination Notice</h4>
                    <p className="text-[11px] font-medium text-gray-800 leading-tight">
                      The examination date will be announced through the Platoon Officer’s official Facebook page. 
                      Please stay updated by scanning the official QR code:
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="p-1 border border-black bg-white">
                      <QRCodeCanvas 
                        value="https://www.facebook.com/cbcc.bncc" 
                        size={60} 
                      />
                    </div>
                    <span className="text-[7px] font-bold uppercase">Facebook Page</span>
                  </div>
                </div>

                {/* Important Instructions */}
                <div className="mt-auto relative z-10">
                  <hr className="border-black mb-2" />
                  <h4 className="text-[12px] font-bold font-montserrat uppercase mb-1">Important Instructions for Candidates</h4>
                  <div className="text-[10px] leading-tight space-y-1 text-justify text-gray-700">
                    <p>
                      This admit card must be presented at the examination hall. Candidates must arrive in a neat, clean, and well-groomed condition. Proper preparation for both written and physical tests is mandatory. Male candidates must maintain a proper haircut and wear disciplined attire. For physical tests, candidates must bring a tracksuit and sports shoes. Candidates must report within the specified time; late entry may not be permitted. Any form of misconduct, disorder, or indiscipline will result in disqualification.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-2 border-t border-gray-200 text-center relative z-10">
                  <p className="text-[8px] text-gray-400 mt-1">
                    Generated on {new Date().toLocaleString()} | CBCC BNCC Enrollment System
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
