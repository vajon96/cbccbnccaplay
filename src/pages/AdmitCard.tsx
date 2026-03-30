import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, CheckCircle, Shield } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { db, doc, getDoc, handleFirestoreError, OperationType } from "../firebase";

export function AdmitCard() {
  const { id } = useParams();
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { 
      scale: 2, 
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Admit_Card_${applicant.fullName}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!applicant) return <div className="flex items-center justify-center h-screen">Applicant not found.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-4 print:hidden">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-white">আবেদন সফল হয়েছে!</h1>
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
          <div className="w-full h-full border-2 border-black rounded-[5px] p-8 relative flex flex-col">
            
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
              <img 
                src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                alt="Watermark" 
                className="w-[300px] h-auto grayscale" 
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Army Green Header Strip */}
            <div className="absolute top-0 left-0 w-full h-2 bg-[#4B5320] rounded-t-[3px]"></div>

            {/* Header Section */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="w-20 h-20 flex items-center justify-center">
                <img 
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                  alt="College Logo" 
                  className="max-h-full max-w-full" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="text-center flex-grow px-4">
                <h2 className="text-xl font-bold font-montserrat uppercase leading-tight">COX’S BAZAR CITY COLLEGE</h2>
                <h3 className="text-base font-semibold font-montserrat text-[#4B5320] uppercase leading-tight">BNCC PLATOON (ARMY WING)</h3>
                <div className="mt-2 inline-block border-y-2 border-black py-1 px-4">
                  <h1 className="text-2xl font-extrabold font-montserrat uppercase tracking-wider">ADMIT CARD 2025</h1>
                </div>
                <p className="text-[10px] font-medium italic mt-1 text-gray-600">
                  “Computer Generated Admit Card (No Signature Required)”
                </p>
              </div>
              <div className="w-20 h-20 flex items-center justify-center">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="BNCC Logo" 
                  className="max-h-full max-w-full" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>

            <hr className="border-black mb-6" />

            {/* Candidate Section */}
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-[1.5in] h-[2in] border border-black overflow-hidden bg-gray-50 flex items-center justify-center">
                  {applicant.photo ? (
                    <img 
                      src={applicant.photo} 
                      className="w-full h-full object-cover" 
                      alt="Candidate" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <span className="text-xs text-gray-400">Photo</span>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase">Candidate Photo</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-[1.5in] h-[2in] border border-black p-4 flex flex-col items-center justify-center bg-white">
                  <QRCodeSVG 
                    value={JSON.stringify({
                      id: applicant.id,
                      name: applicant.fullName,
                      collegeId: applicant.collegeId,
                      status: applicant.status
                    })} 
                    size={100} 
                  />
                  <div className="mt-4 text-center">
                    <p className="text-[10px] font-bold leading-none">ID: {applicant.id}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase">Verification QR</span>
              </div>
            </div>

            {/* Candidate Information Section */}
            <div className="mb-8 relative z-10">
              <div className="grid grid-cols-1 gap-y-3">
                {[
                  { label: "Name", value: applicant.fullName },
                  { label: "Date of Birth", value: applicant.dob },
                  { label: "Roll Number", value: applicant.roll },
                  { label: "Application ID", value: applicant.id },
                  { label: "Department / Group", value: applicant.class },
                  { label: "Mobile Number", value: applicant.mobile }
                ].map((item, i) => (
                  <div key={i} className="flex items-baseline">
                    <span className="w-48 font-bold text-sm uppercase font-montserrat">{item.label}</span>
                    <span className="mx-2 font-bold">:</span>
                    <span className="flex-grow font-medium text-sm border-b border-dotted border-gray-400 pb-0.5">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Examination Details */}
            <div className="mb-8 relative z-10">
              <hr className="border-black mb-4" />
              <h4 className="text-sm font-bold font-montserrat uppercase mb-3 text-[#4B5320]">Examination Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Exam Date</span>
                  <span className="text-sm font-bold">To be announced</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Time</span>
                  <span className="text-sm font-bold">08:00 AM</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Venue</span>
                  <span className="text-sm font-bold">College Ground</span>
                </div>
              </div>
            </div>

            {/* Important Instructions */}
            <div className="mt-auto relative z-10">
              <hr className="border-black mb-4" />
              <h4 className="text-sm font-bold font-montserrat uppercase mb-3">Important Instructions for Candidates</h4>
              <ul className="text-[11px] leading-relaxed space-y-1.5 list-disc pl-5 text-justify">
                <li>This admit card must be brought to the examination hall.</li>
                <li>Candidates must arrive in a neat, clean, and well-presented manner.</li>
                <li>Proper preparation for both the written and physical tests is required.</li>
                <li>Male candidates must maintain a proper haircut and wear disciplined attire.</li>
                <li>If a physical test is conducted, candidates must bring tracksuit and sports shoes.</li>
                <li>Candidates must report within the specified time.</li>
                <li>Any form of disorder, misconduct, or indiscipline will not be tolerated.</li>
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
          className="flex items-center gap-2 px-8 py-4 bg-[#4B5320] text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg"
        >
          <Download className="w-5 h-5" /> Download PDF
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
