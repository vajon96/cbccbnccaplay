import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, CheckCircle, Shield, Loader2, ExternalLink } from "lucide-react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { db, doc, getDoc, handleFirestoreError, OperationType } from "../firebase";

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
      // Small delay to ensure QR code and images are rendered
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [applicant, searchParams]);

  const handleDownloadPDF = async () => {
    if (!cardRef.current || downloading) return;
    
    console.log("Starting PDF download process...");
    try {
      setDownloading(true);
      
      // Ensure all images are loaded with a timeout
      const images = Array.from(cardRef.current.querySelectorAll('img'));
      console.log(`Found ${images.length} images to wait for.`);
      
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.warn(`Image load timeout: ${img.src}`);
            resolve(null);
          }, 5000);
          img.onload = () => {
            clearTimeout(timeout);
            resolve(null);
          };
          img.onerror = () => {
            clearTimeout(timeout);
            console.error(`Image load error: ${img.src}`);
            resolve(null);
          };
        });
      }));

      console.log("All images handled, capturing canvas...");

      // Scroll to top to avoid html2canvas offset issues
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      // Small delay for rendering stability after scroll
      await new Promise(resolve => setTimeout(resolve, 500));

      const element = cardRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2, // High quality
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        imageTimeout: 15000,
        removeContainer: true,
      });

      if (!canvas) {
        throw new Error("Failed to create canvas");
      }

      console.log("Canvas captured successfully, generating PDF...");

      // Restore scroll position
      window.scrollTo(0, originalScrollY);

      const imgData = canvas.toDataURL("image/png", 1.0);
      
      // Initialize jsPDF with standard A4 format
      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true
      });
      
      // A4 dimensions are 210mm x 297mm
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BNCC_Admit_Card_${applicant.id}.pdf`);
      console.log("PDF download triggered.");
    } catch (error) {
      console.error("PDF Generation error:", error);
      alert("পিডিএফ ডাউনলোড করতে সমস্যা হচ্ছে। অনুগ্রহ করে 'নতুন ট্যাবে ওপেন করুন' বাটনে ক্লিক করে সেখান থেকে চেষ্টা করুন।");
      
      // Fallback: Try to download as image if PDF fails
      try {
        const canvas = await html2canvas(cardRef.current!, { scale: 1.5, useCORS: true });
        const link = document.createElement('a');
        link.download = `BNCC_Admit_Card_${applicant.id}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        alert("পিডিএফ কাজ না করায় ইমেজ হিসেবে ডাউনলোড করা হয়েছে।");
      } catch (fallbackError) {
        console.error("Fallback download error:", fallbackError);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    console.log("Print button clicked");
    try {
      window.print();
    } catch (error) {
      console.error("Print error:", error);
      alert("প্রিন্ট করতে সমস্যা হচ্ছে। অনুগ্রহ করে 'নতুন ট্যাবে ওপেন করুন' বাটনে ক্লিক করে সেখান থেকে চেষ্টা করুন।");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!applicant) return <div className="flex items-center justify-center h-screen">Applicant not found.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-4 print:hidden">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">আবেদন সফল হয়েছে!</h1>
        <p className="text-slate-600">আপনার প্রবেশপত্রটি ডাউনলোড করে সংরক্ষণ করুন।</p>
      </div>

      <div className="flex justify-center overflow-x-auto pb-8 no-scrollbar">
        <div 
          ref={cardRef}
          id="admitCard"
          className="print-area w-[210mm] h-[297mm] bg-white text-black relative shadow-2xl flex-shrink-0 print:shadow-none print:m-0"
          style={{ 
            fontFamily: "'Roboto', sans-serif",
            padding: "0.75in",
          }}
        >
          {/* Background Pattern - Hidden from html2canvas and print if needed */}
          <div 
            className="absolute inset-0 pointer-events-none print:hidden" 
            style={{ 
              backgroundImage: 'radial-gradient(#f1f5f9 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
            data-html2canvas-ignore="true"
          ></div>

          {/* Outer Border */}
          <div className="w-full h-full border-2 border-black rounded-[5px] p-6 relative flex flex-col">
            
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
            <div className="mt-4 relative z-10">
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
              <p className="text-[10px] font-bold text-gray-800">
                
              </p>
              <p className="text-[8px] text-gray-400 mt-1">
                Generated on {new Date().toLocaleString()} | CBCC BNCC Enrollment System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 print:hidden">
        <div className="flex justify-center gap-4">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Processing...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" /> Download PDF
              </>
            )}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-8 py-4 bg-white text-slate-900 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all shadow-lg"
          >
            <Printer className="w-5 h-5" /> Print Card
          </button>
        </div>
        
        <p className="text-xs text-slate-500 text-center max-w-md">
          যদি ডাউনলোড বা প্রিন্ট করতে সমস্যা হয়, তবে নিচের বাটনে ক্লিক করে নতুন ট্যাবে ওপেন করুন এবং সেখান থেকে চেষ্টা করুন।
        </p>
        <button
          onClick={() => window.open(window.location.href, '_blank')}
          className="flex items-center gap-2 text-primary font-bold text-sm hover:underline"
        >
          <ExternalLink className="w-4 h-4" /> নতুন ট্যাবে ওপেন করুন
        </button>
      </div>
    </div>
  );
}
