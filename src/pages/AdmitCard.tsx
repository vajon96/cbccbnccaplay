import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, CheckCircle, Shield, AlertCircle, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db, doc, getDoc, handleFirestoreError, OperationType } from "../firebase";

// Types
interface Applicant {
  id: string;
  fullName: string;
  dob: string;
  roll: string;
  class: string;
  mobile: string;
  photo?: string;
  status?: string;
  collegeId?: string;
}

interface QRData {
  id: string;
  name: string;
  collegeId?: string;
  status?: string;
}

// Constants
const COLLEGE_NAME = "COX'S BAZAR CITY COLLEGE";
const BNCC_PLATOON = "BNCC PLATOON (ARMY WING)";
const ADMIT_CARD_YEAR = "2025";
const WATERMARK_IMAGE = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
const COLLEGE_LOGO = "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png";
const BNCC_LOGO = "https://i.ibb.co/Fb3R6wR/Bncc-logo.png";
const FACEBOOK_URL = "https://www.facebook.com/cbcc.bncc";

// Helper Components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-screen">
    <Loader2 className="w-8 h-8 animate-spin text-[#4B5320]" />
  </div>
);

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center h-screen gap-4">
    <AlertCircle className="w-12 h-12 text-red-500" />
    <p className="text-lg text-red-500">{message}</p>
  </div>
);

const InfoField = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline">
    <span className="w-48 font-bold text-sm uppercase font-montserrat">{label}</span>
    <span className="mx-2 font-bold">:</span>
    <span className="flex-grow font-medium text-sm border-b border-dotted border-gray-400 pb-0.5">
      {value || "N/A"}
    </span>
  </div>
);

const InstructionItem = ({ children }: { children: React.ReactNode }) => (
  <li className="text-[11px] leading-relaxed list-disc ml-5 text-justify">
    {children}
  </li>
);

export function AdmitCard() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Fetch applicant data
  useEffect(() => {
    const fetchApplicant = async () => {
      if (!id) {
        setError("No applicant ID provided");
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, "applicants", id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setApplicant({ id, ...docSnap.data() } as Applicant);
        } else {
          setError("Applicant not found");
        }
      } catch (error) {
        console.error("Error fetching applicant:", error);
        handleFirestoreError(error, OperationType.GET, `applicants/${id}`);
        setError("Failed to load applicant data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchApplicant();
  }, [id]);

  // Handle automatic download
  useEffect(() => {
    if (applicant && searchParams.get("download") === "true" && !isDownloading) {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [applicant, searchParams, isDownloading]);

  // Generate QR code data
  const getQRData = useCallback((): QRData => ({
    id: applicant?.id || "",
    name: applicant?.fullName || "",
    collegeId: applicant?.collegeId,
    status: applicant?.status
  }), [applicant]);

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!cardRef.current || !applicant) return;
    
    setIsDownloading(true);
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3, // Increased for better quality
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: cardRef.current.scrollWidth,
        windowHeight: cardRef.current.scrollHeight,
        onclone: (clonedDoc, element) => {
          // Ensure all images are loaded in the cloned document
          const images = element.getElementsByTagName('img');
          return Promise.all(Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          }));
        }
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Admit_Card_${applicant.fullName.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Loading and error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!applicant) return <ErrorMessage message="Applicant not found" />;

  // Applicant information fields
  const infoFields = [
    { label: "Name", value: applicant.fullName },
    { label: "Date of Birth", value: applicant.dob },
    { label: "Roll Number", value: applicant.roll },
    { label: "Application ID", value: applicant.id },
    { label: "Department / Group", value: applicant.class },
    { label: "Mobile Number", value: applicant.mobile }
  ];

  // Instructions list
  const instructions = [
    "This admit card must be brought to the examination hall.",
    "Candidates must arrive in a neat, clean, and well-presented manner.",
    "Proper preparation for both the written and physical tests is required.",
    "Male candidates must maintain a proper haircut and wear disciplined attire.",
    "If a physical test is conducted, candidates must bring tracksuit and sports shoes.",
    "Candidates must report within the specified time.",
    "Any form of disorder, misconduct, or indiscipline will not be tolerated."
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      {/* Success Message */}
      <div className="text-center space-y-4 print:hidden">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-white">আবেদন সফল হয়েছে!</h1>
        <p className="text-slate-400">আপনার প্রবেশপত্রটি ডাউনলোড করে সংরক্ষণ করুন।</p>
      </div>

      {/* Admit Card Preview */}
      <div className="flex justify-center overflow-x-auto pb-8 no-scrollbar">
        <div
          ref={cardRef}
          className="print-area w-[210mm] h-[297mm] bg-white text-black relative shadow-2xl flex-shrink-0"
          style={{
            fontFamily: "'Roboto', sans-serif",
            padding: "1in"
          }}
        >
          {/* Outer Border */}
          <div className="w-full h-full border-2 border-black rounded-[5px] p-6 relative flex flex-col">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
              <img
                src={WATERMARK_IMAGE}
                alt="Watermark"
                className="w-[300px] h-auto grayscale"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            </div>

            {/* Army Green Header Strip */}
            <div className="absolute top-0 left-0 w-full h-2 bg-[#4B5320] rounded-t-[3px]"></div>

            {/* Header Section */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src={COLLEGE_LOGO}
                  alt="College Logo"
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
              <div className="text-center flex-grow px-4">
                <h2 className="text-xl font-bold font-montserrat uppercase leading-tight">
                  {COLLEGE_NAME}
                </h2>
                <h3 className="text-base font-semibold font-montserrat text-[#4B5320] uppercase leading-tight">
                  {BNCC_PLATOON}
                </h3>
                <div className="mt-2 inline-block border-y-2 border-black py-1 px-4">
                  <h1 className="text-2xl font-extrabold font-montserrat uppercase tracking-wider">
                    ADMIT CARD {ADMIT_CARD_YEAR}
                  </h1>
                </div>
                <p className="text-[10px] font-medium italic mt-1 text-gray-600">
                  "Computer Generated Admit Card (No Signature Required)"
                </p>
              </div>
              <div className="w-20 h-20 flex items-center justify-center">
                <img
                  src={BNCC_LOGO}
                  alt="BNCC Logo"
                  className="max-h-full max-w-full object-contain"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            </div>

            <hr className="border-black mb-6" />

            {/* Candidate Section */}
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-[1.5in] h-[2in] border border-black overflow-hidden bg-gray-50 flex items-center justify-center">
                  {applicant.photo ? (
                    <img
                      src={applicant.photo}
                      className="w-full h-full object-cover"
                      alt="Candidate"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No Photo</span>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase">Candidate Photo</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-[1.5in] h-[2in] border border-black p-4 flex flex-col items-center justify-center bg-white">
                  <QRCodeSVG
                    value={JSON.stringify(getQRData())}
                    size={100}
                    level="H"
                    includeMargin={false}
                  />
                  <div className="mt-4 text-center">
                    <p className="text-[10px] font-bold leading-none">ID: {applicant.id}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase">Verification QR</span>
              </div>
            </div>

            {/* Candidate Information Section */}
            <div className="mb-6 relative z-10">
              <div className="grid grid-cols-1 gap-y-3">
                {infoFields.map((field, index) => (
                  <InfoField key={index} {...field} />
                ))}
              </div>
            </div>

            {/* Examination Notice */}
            <div className="mb-6 relative z-10">
              <hr className="border-black mb-4" />
              <h4 className="text-sm font-bold font-montserrat uppercase mb-3 text-[#4B5320]">
                Examination Notice
              </h4>
              <p className="text-sm font-medium text-gray-800 leading-relaxed">
                The examination date will be announced through the Platoon Officer's official Facebook page.
                Please stay updated by following the official link:
                <a
                  href={FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline ml-1 hover:text-blue-800"
                >
                  {FACEBOOK_URL}
                </a>
              </p>
            </div>

            {/* Important Instructions */}
            <div className="mt-auto relative z-10">
              <hr className="border-black mb-4" />
              <h4 className="text-sm font-bold font-montserrat uppercase mb-3">
                Important Instructions for Candidates
              </h4>
              <ul className="space-y-1.5">
                {instructions.map((instruction, index) => (
                  <InstructionItem key={index}>
                    {instruction}
                  </InstructionItem>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200 text-center relative z-10">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                System Generated – No Signature Required
              </p>
              <p className="text-[8px] text-gray-300 mt-1">
                Generated on {new Date().toLocaleString()} | CBCC BNCC Enrollment System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 print:hidden">
        <button
          onClick={handleDownloadPDF}
          disabled={isDownloading}
          className="flex items-center gap-2 px-8 py-4 bg-[#4B5320] text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {isDownloading ? "Generating PDF..." : "Download PDF"}
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-8 py-4 glass text-white font-bold rounded-xl hover:bg-white/10 transition-all shadow-lg"
        >
          <Printer className="w-5 h-5" /> Print Card
        </button>
      </div>
    </div>
  );
}