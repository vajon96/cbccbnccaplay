import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useLocation, Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { Download, CheckCircle, Shield, Loader2, FileCheck, Info, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import * as htmlToImage from "html-to-image";
import { db, doc, getDoc } from "../firebase";
import { motion } from "framer-motion";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function AdmitCard() {
  useDocumentMeta({
    title: "Admit Card | Cox's Bazar City College BNCC Platoon",
    description: "Download or print your verified Cox's Bazar City College BNCC admission admit card.",
  });

  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navState = (location.state as { generatedPassword?: string; applicantData?: any; submittedJustNow?: boolean } | null) || null;
  const rawPassword = navState?.generatedPassword;
  const submittedJustNow = Boolean(navState?.submittedJustNow);
  const [applicant, setApplicant] = useState<any>(navState?.applicantData || null);
  const [loading, setLoading] = useState(!navState?.applicantData);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchApplicant = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      if (navState?.applicantData) {
        setApplicant(navState.applicantData);
        setLoading(false);
        return;
      }
      try {
        const cached = sessionStorage.getItem(`bncc_admit_preview_${id}`);
        if (cached) {
          setApplicant(JSON.parse(cached));
          setLoading(false);
          return;
        }
      } catch {
        // Ignore sessionStorage parse/access issues
      }
      let found: any = null;
      try {
        const docRef = doc(db, "applicants", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          found = { ...docSnap.data(), id: docSnap.id };
        }
      } catch (error: any) {
        if (error?.code !== "permission-denied") {
          console.error("Failed to fetch admit card from Firestore:", error);
        }
      }

      if (!found) {
        try {
          const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.application) {
              found = data.application;
            }
          }
        } catch {
          // Ignore network errors
        }
      }

      if (found) {
        setApplicant(found);
      }
      setLoading(false);
    };

    fetchApplicant();
  }, [id, navState?.applicantData]);

  useEffect(() => {
    if (applicant && searchParams.get("download") === "true") {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [applicant, searchParams]);

  const handleDownloadPDF = async () => {
    if (!cardRef.current || downloading || !applicant) return;

    try {
      setDownloading(true);
      await document.fonts.ready;

      const images = Array.from(cardRef.current.querySelectorAll('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = () => resolve(null);
          img.onerror = () => resolve(null);
          setTimeout(() => resolve(null), 10000);
        });
      }));

      await new Promise(resolve => setTimeout(resolve, 600));
      const element = cardRef.current;

      const imgData = await htmlToImage.toJpeg(element, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio: 2.5,
        cacheBust: true,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0'
        }
      });

      if (!imgData) throw new Error("Image generation failed");

      const pdf = new jsPDF({
        orientation: "p",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`BNCC_Admit_Card_${applicant.id}.pdf`);
    } catch (error) {
      console.error("PDF Generation error:", error);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-4">
      <Loader2 className="w-12 h-12 text-[#002147] animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Retrieving Credentials...</p>
    </div>
  );

  if (!applicant) return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6 px-4 text-center">
      <Shield className="w-16 h-16 text-[#C5A059]" />
      <h2 className="text-2xl font-black text-[#002147]">Admit Card Access Requires Owner or Admin Sign-In</h2>
      <p className="text-sm text-slate-600 max-w-md">
        নিরাপত্তার স্বার্থে আপনার নিবন্ধিত ইমেইল/ক্যাডেট অ্যাকাউন্ট অথবা অ্যাডমিন সেশন দিয়ে লগইন অবস্থায় প্রবেশপত্র দেখতে পারবেন।
      </p>
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="px-6 py-3 bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer">
          ফিরে যান
        </button>
        <Link to="/login" className="px-6 py-3 bg-[#002147] text-white font-bold text-xs rounded-xl">
          পোর্টালে লগইন করুন
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {/* Header Banner */}
      <div className="bg-[#002147] py-10 mb-10 border-b border-[#C5A059]/30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <FileCheck className="text-[#C5A059]" size={22} />
              <span className="text-xs font-bold uppercase tracking-widest text-[#dfc07c]">Official Document Retrieval</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Admit Card &amp; Enrollment Slip</h1>
            <p className="text-slate-300 text-sm">Download PDF or print your verified BNCC Admit Card below.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              Print Card
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="px-7 py-3.5 bg-[#C5A059] hover:bg-[#d6b36c] text-slate-950 font-black uppercase tracking-wider text-xs rounded-xl flex items-center gap-2 disabled:opacity-50 shadow-lg cursor-pointer"
            >
              {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {submittedJustNow && (
        <div className="max-w-7xl mx-auto px-4 mb-6 print:hidden">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 shadow-sm">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-black text-sm">আপনার ক্যাডেট ভর্তি আবেদন সফলভাবে জমা হয়েছে! (Application ID: {applicant.id})</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                আপনার আবেদনটি অ্যাডমিন প্যানেলে সংরক্ষিত হয়েছে। নিচে থেকে প্রবেশপত্র প্রিন্ট বা PDF ডাউনলোড করুন।
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-6 print:hidden">
          {rawPassword && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-[#C5A059] p-6 rounded-2xl space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#002147]">
                <Shield size={20} className="text-[#C5A059]" />
                <h3 className="font-black uppercase text-xs tracking-wider">One-Time Credentials (Save Now)</h3>
              </div>
              <div className="space-y-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Applicant ID</span>
                  <span className="font-mono font-black text-lg text-[#002147]">{applicant.id}</span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Password</span>
                  <span className="font-mono font-black text-lg text-[#002147]">{rawPassword}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">নিরাপত্তার জন্য এই পাসওয়ার্ড URL-এ রাখা হয়নি। অনুগ্রহ করে সংরক্ষণ করুন।</p>
            </motion.div>
          )}

          <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-5 shadow-sm">
            <h3 className="text-lg font-black text-[#002147]">Verification Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-xs font-bold uppercase text-slate-500">Document Status</span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-md border border-emerald-200">
                  {applicant.status || "Pending"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
                <span className="text-xs font-bold uppercase text-slate-500">Applicant ID</span>
                <span className="font-mono text-sm font-bold text-[#002147]">{applicant.id}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs font-bold uppercase text-slate-500">Cohort Session</span>
                <span className="font-mono text-sm font-bold text-[#002147]">{applicant.session || "2026-27"}</span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 text-[#002147]">
              <Info size={18} className="text-[#C5A059]" />
              <span className="font-black uppercase text-xs tracking-wider">Candidate Conduct</span>
            </div>
            <ul className="space-y-3">
              {[
                "Bring this printed admit card to the examination hall.",
                "Original NID / Birth Registration Certificate required.",
                "Report 30 minutes before schedule.",
                "Electronic devices are strictly prohibited."
              ].map((text, i) => (
                <li key={i} className="flex gap-3 text-xs text-slate-700 font-medium leading-relaxed">
                  <span className="text-[#002147] font-black font-mono">0{i + 1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Admit Card Preview */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-600">Official A4 Document Preview</span>
          </div>

          <div className="flex justify-center overflow-x-auto pb-8 no-scrollbar bg-slate-900 p-6 md:p-10 rounded-2xl border border-slate-800 relative print:bg-white print:p-0 print:border-0">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity" />
            <div 
              ref={cardRef}
              id="admitCard"
              className="print-area w-[210mm] h-[297mm] bg-white text-black relative shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] flex-shrink-0 print:shadow-none print:m-0 z-10"
              style={{ 
                fontFamily: "Roboto, sans-serif",
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
                  <div className="text-center flex-grow px-4 bg-white py-2 rounded-sm mx-2">
                    <h2 className="text-lg font-bold font-montserrat uppercase leading-tight !text-black">COX’S BAZAR CITY COLLEGE</h2>
                    <h3 className="text-sm font-semibold font-montserrat !text-black uppercase leading-tight">BNCC PLATOON (ARMY WING)</h3>
                    <div className="mt-1 inline-block border-y border-black py-0.5 px-4">
                      <h1 className="text-xl font-extrabold font-montserrat uppercase tracking-wider !text-black">ADMIT CARD 2026</h1>
                    </div>
                    <p className="text-[9px] font-medium italic mt-0.5 text-black/60">
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
                      {applicant.photo && applicant.photo.trim() !== "" ? (
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

                  {applicant.isEthnicMinority && (
                    <div className="flex-grow mx-6 self-center p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-500/30 shadow-md text-center flex flex-col items-center justify-center relative overflow-hidden min-h-[1.2in]">
                      <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/10 rounded-full blur-sm -mr-3 -mt-3"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 bg-teal-500/10 rounded-full blur-sm -ml-3 -mb-3"></div>
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-[0.15em]">
                        বিশেষ ক্যাটাগরি / Special Category
                      </span>
                      <span className="text-sm font-black text-emerald-900 mt-1.5 flex items-center gap-1.5">
                        <span className="text-emerald-600">✔️</span> নৃতাত্ত্বিক (ক্ষুদ্র) জনগোষ্ঠী
                      </span>
                    </div>
                  )}

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
                      { label: "Height", value: `${applicant.heightFeet}'${applicant.heightInches}" (${applicant.heightFeet} feet ${applicant.heightInches} inches)` },
                      { label: "Weight", value: `${applicant.weightKg} kg` },
                      ...(applicant.isEthnicMinority ? [{ label: "Special Category", value: "Ethnic Minority (নৃতাত্ত্বিক ক্ষুদ্র জনগোষ্ঠী)" }] : []),
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline mb-0.5">
                        <span className="w-32 font-bold text-[10px] uppercase font-montserrat shrink-0 text-black/60 truncate">{item.label}</span>
                        <span className="mx-1 font-bold text-[10px] text-black">:</span>
                        <span className="flex-grow font-black text-[10.5px] border-b border-dotted border-black/10 pb-0.5 truncate text-black">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 grid grid-cols-1 gap-y-2">
                    {[
                      { label: "Present Address", value: applicant.presentAddress },
                      { label: "Permanent Address", value: applicant.permanentAddress },
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline mb-0.5">
                        <span className="w-32 font-bold text-[10px] uppercase font-montserrat shrink-0 text-black/60">{item.label}</span>
                        <span className="mx-1 font-bold text-[10px] text-black">:</span>
                        <span className="flex-grow font-black text-[10.5px] border-b border-dotted border-black/10 pb-0.5 text-black">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1">
                    {[
                      { label: "SSC GPA", value: applicant.sscGpa },
                      { label: "SSC Group", value: applicant.sscGroup },
                      { label: "SSC Year", value: applicant.sscYear },
                      { label: "SSC Board", value: applicant.sscBoard },
                    ].map((item, i) => (
                      <div key={i} className="flex items-baseline">
                        <span className="w-32 font-bold text-[10px] uppercase font-montserrat shrink-0 text-black/60">{item.label}</span>
                        <span className="mx-1 font-bold text-[10px] text-black">:</span>
                        <span className="flex-grow font-black text-[10.5px] border-b border-dotted border-black/10 pb-0.5 text-black">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {applicant.hscGpa && applicant.hscGpa.trim() !== "" && (
                    <div className="mt-3 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-md max-w-max">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-black text-emerald-700 tracking-wider font-montserrat uppercase">✓ HSC PASSED</span>
                    </div>
                  )}
                </div>

                {/* Examination Notice */}
                <div className="mb-4 relative z-10 flex items-start gap-4">
                  <div className="flex-grow">
                    <hr className="border-black mb-2" />
                    <h4 className="text-[12px] font-bold font-montserrat uppercase mb-1 !text-black">Examination Notice</h4>
                    <p className="text-[11px] font-medium text-black leading-tight">
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
                  <h4 className="text-[12px] font-bold font-montserrat uppercase mb-1 !text-black">Important Instructions for Candidates</h4>
                  <div className="text-[10px] leading-tight space-y-1 text-justify text-black">
                    <p>
                      This admit card must be presented at the examination hall. Candidates must arrive in a neat, clean, and well-groomed condition. Proper preparation for both written and physical tests is mandatory. Male candidates must maintain a proper haircut and wear disciplined attire. For physical tests, candidates must bring a tracksuit and sports shoes. Candidates must report within the specified time; late entry may not be permitted. Any form of misconduct, disorder, or indiscipline will result in disqualification.
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-2 border-t border-black/10 text-center relative z-10">
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
