import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, Shield, CheckCircle } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function AdmitCard() {
  const { id } = useParams();
  const [applicant, setApplicant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/applicant/${id}`)
      .then(res => res.json())
      .then(data => {
        setApplicant(data);
        setLoading(false);
      });
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Admit_Card_${applicant.fullName}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold text-white">আবেদন সফল হয়েছে!</h1>
        <p className="text-slate-400">আপনার প্রবেশপত্রটি ডাউনলোড করে সংরক্ষণ করুন।</p>
      </div>

      {/* Admit Card Preview */}
      <div className="flex justify-center">
        <div 
          ref={cardRef}
          className="w-[210mm] min-h-[148mm] bg-white text-black p-8 border-[12px] border-primary relative overflow-hidden shadow-2xl"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-[-45deg]">
            <Shield className="w-[400px] h-[400px]" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-primary pb-6 mb-8">
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" alt="College Logo" className="h-full w-auto" />
            </div>
            <div className="text-center flex-grow px-4">
              <h2 className="text-2xl font-black text-primary uppercase tracking-tight">Cox's Bazar City College</h2>
              <h3 className="text-lg font-bold text-accent uppercase tracking-widest">BNCC Platoon</h3>
              <p className="text-[10px] font-bold text-slate-500 mt-1">ADMIT CARD - RECRUITMENT {new Date().getFullYear()}</p>
            </div>
            <div className="w-20 h-20 flex items-center justify-center">
              <img src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" alt="BNCC Logo" className="h-full w-auto" />
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-12 gap-8 relative z-10">
            <div className="col-span-12 flex justify-between items-start mb-4">
              <div className="w-32 aspect-[3/4] bg-slate-100 border-2 border-primary rounded-lg overflow-hidden shadow-md">
                <img src={applicant.photo} className="w-full h-full object-cover" alt="Applicant" />
              </div>
              <div className="p-3 bg-white border-2 border-primary rounded-lg flex flex-col items-center shadow-md">
                <QRCodeSVG value={`BNCC-${applicant.id}-${applicant.collegeId}`} size={100} />
                <span className="text-[10px] font-bold mt-2 text-primary">ID: BNCC-{applicant.id}</span>
              </div>
            </div>

            <div className="col-span-12">
              <div className="grid grid-cols-2 gap-y-4 gap-x-12">
                {[
                  { label: "Full Name", value: applicant.fullName },
                  { label: "Father's Name", value: applicant.fatherName },
                  { label: "Mother's Name", value: applicant.motherName },
                  { label: "Date of Birth", value: applicant.dob },
                  { label: "Gender", value: applicant.gender },
                  { label: "Blood Group", value: applicant.bloodGroup },
                  { label: "College ID", value: applicant.collegeId },
                  { label: "Class", value: applicant.class },
                  { label: "Roll", value: applicant.roll },
                  { label: "Session", value: applicant.session }
                ].map((item, i) => (
                  <div key={i} className="border-b border-slate-100 pb-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</label>
                    <p className="text-sm font-bold text-primary truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-12 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <h4 className="text-[10px] font-bold text-primary uppercase mb-2">Instructions:</h4>
                <ul className="text-[9px] text-slate-600 space-y-1 list-disc pl-4">
                  <li>Bring this admit card to the selection venue.</li>
                  <li>Wear proper sports attire for physical tests.</li>
                  <li>Report at the college ground by 08:00 AM on selection day.</li>
                  <li>This is a computer-generated document, no signature required.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-100 text-center space-y-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Computer Generated Admit Card</p>
            <p className="text-[8px] text-slate-400">Generated on {new Date().toLocaleString()} | CBCC BNCC Enrollment Management System</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-4 print:hidden">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-8 py-4 bg-accent text-primary font-bold rounded-xl hover:bg-white transition-all"
        >
          <Download className="w-5 h-5" /> Download PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-8 py-4 glass text-white font-bold rounded-xl hover:bg-white/10 transition-all"
        >
          <Printer className="w-5 h-5" /> Print Card
        </button>
      </div>
    </div>
  );
}
