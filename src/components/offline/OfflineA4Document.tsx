import React, { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { OfflineApplication } from "../../types/offlineApplication";
import { Scissors } from "lucide-react";

interface OfflineA4DocumentProps {
  application: OfflineApplication;
  isBlankTemplate?: boolean;
}

export const OfflineA4Document = forwardRef<HTMLDivElement, OfflineA4DocumentProps>(
  ({ application, isBlankTemplate = false }, ref) => {
    const isBlank = isBlankTemplate;

    const qrData = JSON.stringify({
      id: application.id || "OFF-2026-0000",
      name: application.fullNameEnglish || "OFFLINE CANDIDATE",
      roll: application.classRoll || "N/A",
      type: "BNCC_OFFLINE_ADMIT",
      institution: application.institution || "CBCC",
      examDate: application.examDate || "2026-10-18"
    });

    return (
      <div
        ref={ref}
        id="offlineA4Document"
        className="print-area w-[210mm] min-h-[297mm] max-h-[297mm] bg-white text-slate-900 mx-auto relative shadow-2xl print:shadow-none print:m-0 flex flex-col justify-between overflow-hidden border border-slate-300 print:border-none"
        style={{
          boxSizing: "border-box",
          padding: "10mm 12mm 8mm 12mm",
          fontFamily: "'Inter', 'Roboto', 'Arial', sans-serif",
          color: "#000000",
          backgroundColor: "#ffffff"
        }}
      >
        {/* Subtle Watermark for Official Authenticity */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none z-0">
          <img
            src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png"
            alt="Watermark"
            className="w-[280px] h-auto grayscale"
            crossOrigin="anonymous"
          />
        </div>

        {/* ========================================================================= */}
        {/* TOP SECTION: MAIN OFFLINE APPLICATION FORM */}
        {/* ========================================================================= */}
        <div className="relative z-10 flex flex-col flex-1">
          {/* Header Row */}
          <div className="border-b-2 border-black pb-2 mb-2">
            <div className="flex items-center justify-between">
              {/* College Logo */}
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"
                  alt="College Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Center Military / Platoon Header */}
              <div className="text-center flex-1 px-2">
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-700 leading-tight">
                  বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি) • কর্ণফুলী রেজিমেন্ট
                </p>
                <h1 className="text-[13px] font-black uppercase tracking-tight text-black leading-tight">
                  15 BNCC BATTALION • COX'S BAZAR CITY COLLEGE BNCC PLATOON
                </h1>
                <p className="text-[10px] font-semibold text-slate-800 leading-tight">
                  কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন (আর্মি উইং), কক্সবাজার সদর
                </p>
                <div className="mt-1 inline-block bg-black text-white px-3 py-0.5 rounded-[2px]">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase">
                    OFFLINE ADMISSION APPLICATION FORM — 2026 / অফলাইন ভর্তি আবেদন ফর্ম
                  </span>
                </div>
              </div>

              {/* BNCC Official Logo */}
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png"
                  alt="BNCC Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            {/* Application ID & Instruction Bar */}
            <div className="flex items-center justify-between mt-1 text-[9px] font-bold border-t border-slate-300 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="uppercase text-slate-700">Application ID:</span>
                <span className="font-mono bg-slate-100 border border-black px-1.5 py-0.2 rounded font-black text-[10px]">
                  {application.id || "OFF-2026-XXXX"}
                </span>
                <span className="text-[8px] font-normal text-slate-500 italic ml-2">
                  (অফিস কর্তৃক পূরণযোগ্য / সংরক্ষিত)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Session: 2026-2027</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600">Category: Army Wing</span>
              </div>
            </div>
          </div>

          {/* Form Upper Details & Photo */}
          <div className="flex gap-3 mb-2">
            {/* Left 2 Columns: Applicant Data Fields */}
            <div className="flex-1 space-y-1.5">
              {/* Row 1: Name English & Bangla */}
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-black p-1 rounded-[2px] bg-slate-50/50">
                  <div className="text-[7.5px] uppercase font-bold text-slate-600 leading-tight">
                    1. Applicant Full Name (English Capital Letters):
                  </div>
                  <div className="text-[10px] font-black min-h-[16px] truncate">
                    {isBlank ? "" : application.fullNameEnglish || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px] bg-slate-50/50">
                  <div className="text-[7.5px] uppercase font-bold text-slate-600 leading-tight">
                    ২. আবেদনকারীর পূর্ণ নাম (বাংলায়):
                  </div>
                  <div className="text-[10px] font-black min-h-[16px] truncate font-sans">
                    {isBlank ? "" : application.fullNameBangla || ""}
                  </div>
                </div>
              </div>

              {/* Row 2: Father's & Mother's Name */}
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7.5px] uppercase font-bold text-slate-600 leading-tight">
                    3. Father's Name / পিতার নাম:
                  </div>
                  <div className="text-[9.5px] font-bold min-h-[15px] truncate">
                    {isBlank ? "" : application.fatherName || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7.5px] uppercase font-bold text-slate-600 leading-tight">
                    4. Mother's Name / মাতার নাম:
                  </div>
                  <div className="text-[9.5px] font-bold min-h-[15px] truncate">
                    {isBlank ? "" : application.motherName || ""}
                  </div>
                </div>
              </div>

              {/* Row 3: DOB, Gender, Blood Group, Religion */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    5. Date of Birth:
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "DD / MM / YYYY" : application.dob || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    6. Gender:
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "Male / Female" : application.gender || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    7. Blood Group:
                  </div>
                  <div className="text-[9px] font-black text-red-700 min-h-[14px]">
                    {isBlank ? "" : application.bloodGroup || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    8. Religion:
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "" : application.religion || ""}
                  </div>
                </div>
              </div>

              {/* Row 4: Height & Weight & Mobile Numbers */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    9. Height (উচ্চতা):
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "..... ft ..... in" : `${application.heightFeet}' ${application.heightInches}"`}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    10. Weight (ওজন):
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "..... kg" : `${application.weightKg} kg`}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    11. Student Mobile:
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "" : application.studentPhone || ""}
                  </div>
                </div>
                <div className="border border-black p-1 rounded-[2px]">
                  <div className="text-[7px] uppercase font-bold text-slate-600 leading-tight">
                    12. Guardian Mobile:
                  </div>
                  <div className="text-[9px] font-bold min-h-[14px]">
                    {isBlank ? "" : application.guardianPhone || ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Applicant Photo Box */}
            <div className="w-[26mm] flex flex-col items-center justify-start shrink-0">
              <div className="w-[26mm] h-[32mm] border-2 border-black flex flex-col items-center justify-center p-1 bg-slate-50 text-center relative overflow-hidden">
                {!isBlank && application.applicantPhoto && application.applicantPhoto.trim() !== "" ? (
                  <img
                    src={application.applicantPhoto}
                    alt="Applicant"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <span className="text-[7.5px] font-bold uppercase text-slate-700 leading-tight">
                      Passport Size Photo (Attested)
                    </span>
                    <span className="text-[6.5px] text-slate-500 leading-tight">
                      ১ কপি পাসপোর্ট সাইজ সত্যায়িত ছবি আঠা দিয়ে সংযুক্ত করুন
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[7px] font-bold uppercase mt-0.5 text-center">
                পাসপোর্ট সাইজ ছবি
              </span>
            </div>
          </div>

          {/* Academic & College Information Table */}
          <div className="border border-black rounded-[2px] mb-2 overflow-hidden">
            <div className="bg-slate-200/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border-b border-black flex justify-between items-center">
              <span>13. Current Academic Information / বর্তমান প্রাতিষ্ঠানিক তথ্য</span>
              <span>15 BNCC Battalion</span>
            </div>
            <div className="grid grid-cols-12 text-[8px] divide-x divide-black">
              <div className="col-span-5 p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Educational Institution:</span>
                <span className="font-bold text-[9px] block truncate">
                  {isBlank ? "Cox's Bazar City College" : application.institution || "Cox's Bazar City College"}
                </span>
              </div>
              <div className="col-span-3 p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Class / Year:</span>
                <span className="font-bold text-[9px] block truncate">
                  {isBlank ? "HSC 1st Year / Degree / Honours" : application.classYear || ""}
                </span>
              </div>
              <div className="col-span-2 p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Class Roll:</span>
                <span className="font-bold text-[9px] block">
                  {isBlank ? "" : application.classRoll || ""}
                </span>
              </div>
              <div className="col-span-2 p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Group/Dept:</span>
                <span className="font-bold text-[9px] block truncate">
                  {isBlank ? "Science/Arts/Com" : application.studyStatus || ""}
                </span>
              </div>
            </div>
          </div>

          {/* SSC / Equivalent Examination Information */}
          <div className="border border-black rounded-[2px] mb-2 overflow-hidden">
            <div className="bg-slate-200/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border-b border-black">
              14. SSC / Dakhil / Equivalent Examination Details / এসএসসি বা সমমানের ফলাফল
            </div>
            <div className="grid grid-cols-6 text-[8px] divide-x divide-black text-center">
              <div className="p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">SSC Board</span>
                <span className="font-bold text-[8.5px]">{isBlank ? "" : application.sscBoard || "Chattogram"}</span>
              </div>
              <div className="p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Roll Number</span>
                <span className="font-bold text-[8.5px]">{isBlank ? "" : application.sscRoll || ""}</span>
              </div>
              <div className="p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Reg. Number</span>
                <span className="font-bold text-[8.5px]">{isBlank ? "" : application.sscReg || ""}</span>
              </div>
              <div className="p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Group</span>
                <span className="font-bold text-[8.5px]">{isBlank ? "" : application.sscGroup || "Science"}</span>
              </div>
              <div className="p-1">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">Passing Year</span>
                <span className="font-bold text-[8.5px]">{isBlank ? "" : application.sscYear || "2024"}</span>
              </div>
              <div className="p-1 bg-slate-50">
                <span className="text-[7px] text-slate-600 uppercase font-semibold block">SSC GPA</span>
                <span className="font-black text-[9.5px] text-black">{isBlank ? "" : application.sscGpa || ""}</span>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="border border-black rounded-[2px] mb-2 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-black text-[8px]">
              <div className="p-1.5">
                <span className="font-bold uppercase text-[7.5px] text-slate-700 block mb-0.5">
                  15. Present Address / বর্তমান ঠিকানা:
                </span>
                <p className="font-medium text-[8.5px] leading-tight min-h-[22px]">
                  {isBlank ? "" : application.addressPresent || `${application.thana}, ${application.district}`}
                </p>
              </div>
              <div className="p-1.5">
                <span className="font-bold uppercase text-[7.5px] text-slate-700 block mb-0.5">
                  16. Permanent Address / স্থায়ী ঠিকানা:
                </span>
                <p className="font-medium text-[8.5px] leading-tight min-h-[22px]">
                  {isBlank ? "" : application.addressPermanent || `${application.thana}, ${application.district}`}
                </p>
              </div>
            </div>
          </div>

          {/* Special Category & Physical Declaration Note */}
          <div className="flex items-center justify-between text-[7.5px] border border-black p-1 rounded-[2px] mb-2 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <span className="font-bold uppercase">Special Category (নৃতাত্ত্বিক জনগোষ্ঠী):</span>
              <span className="font-bold">
                {application.isEthnicMinority ? "[ ✓ ] Yes (উপজাতীয় কোটা প্রযোজ্য)" : "[   ] No (সাধারণ)"}
              </span>
            </div>
            <span className="font-semibold text-slate-600 italic">
              * অবশ্যই শারীরিক মাপ ও মৌখিক পরীক্ষার জন্য নির্ধারিত তারিখে উপস্থিত থাকতে হবে।
            </span>
          </div>

          {/* Declarations & Signature Sign-off */}
          <div className="grid grid-cols-3 gap-3 border border-black p-2 rounded-[2px] text-center mb-1">
            <div className="flex flex-col justify-end h-10">
              <div className="border-t border-dotted border-black pt-0.5">
                <span className="text-[7.5px] font-bold uppercase block">আবেদনকারীর স্বাক্ষর ও তারিখ</span>
                <span className="text-[6.5px] text-slate-500">(Applicant's Signature)</span>
              </div>
            </div>
            <div className="flex flex-col justify-end h-10">
              <div className="border-t border-dotted border-black pt-0.5">
                <span className="text-[7.5px] font-bold uppercase block">অভিভাবকের সম্মতি স্বাক্ষর</span>
                <span className="text-[6.5px] text-slate-500">(Guardian's Consent)</span>
              </div>
            </div>
            <div className="flex flex-col justify-end h-10">
              <div className="border-t border-dotted border-black pt-0.5">
                <span className="text-[7.5px] font-bold uppercase block">অফিস গ্রহণকারী কর্মকর্তার স্বাক্ষর ও সিল</span>
                <span className="text-[6.5px] text-slate-500">(Platoon Commander / BNCC Office)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEPARATOR: SCISSORS / CUT LINE */}
        {/* ========================================================================= */}
        <div className="relative my-1.5 flex items-center justify-center">
          <div className="w-full border-t-2 border-dashed border-black"></div>
          <div className="absolute bg-white px-3 flex items-center gap-1.5 text-[8px] font-bold text-slate-800 uppercase tracking-widest border border-black rounded-full py-0.5 shadow-sm">
            <Scissors size={10} className="rotate-90 text-black" />
            <span>কুপন / প্রবেশপত্র অংশ (এখান থেকে কেটে সংরক্ষণ করুন • Detach Here)</span>
            <Scissors size={10} className="-rotate-90 text-black" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM SECTION: DETACHABLE ADMIT CARD */}
        {/* ========================================================================= */}
        <div className="relative z-10 border-2 border-black rounded-[4px] p-2 bg-white flex flex-col justify-between">
          {/* Admit Card Header Bar */}
          <div className="flex items-center justify-between border-b border-black pb-1 mb-1.5">
            <div className="flex items-center gap-2">
              <img
                src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"
                alt="Logo"
                className="w-8 h-8 object-contain"
                crossOrigin="anonymous"
              />
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-tight leading-none text-black">
                  BNCC ADMISSION TEST — ADMIT CARD 2026
                </h3>
                <p className="text-[8px] font-bold text-slate-700 leading-tight mt-0.5">
                  কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন • ১৫ বিএনসিসি ব্যাটালিয়ন (আর্মি উইং)
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="inline-block bg-black text-white px-2 py-0.5 rounded text-[8px] font-mono font-black">
                ID: {application.id || "OFF-2026-XXXX"}
              </div>
              <p className="text-[6.5px] text-slate-500 italic mt-0.5">প্রবেশপত্র ছাড়া পরীক্ষায় অংশগ্রহণ নিষিদ্ধ</p>
            </div>
          </div>

          {/* Admit Card Body: Photo/QR + Candidate Info + Exam Schedule + Instructions */}
          <div className="grid grid-cols-12 gap-2 items-center">
            {/* Left: Candidate Photo Box */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <div className="w-[18mm] h-[22mm] border border-black flex items-center justify-center bg-slate-50 overflow-hidden relative">
                {!isBlank && application.applicantPhoto && application.applicantPhoto.trim() !== "" ? (
                  <img
                    src={application.applicantPhoto}
                    alt="Admit Photo"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span className="text-[6.5px] font-bold text-slate-400 text-center uppercase p-1">
                    Candidate Photo
                  </span>
                )}
              </div>
              <span className="text-[6.5px] font-bold uppercase mt-0.5">প্রবেশপত্র ছবি</span>
            </div>

            {/* Middle Left: Candidate Personal Details */}
            <div className="col-span-4 space-y-1 text-[8px]">
              <div className="border-b border-slate-300 pb-0.5">
                <span className="text-[7px] text-slate-500 uppercase font-semibold">Candidate Name:</span>
                <p className="font-black text-[9px] truncate">
                  {isBlank ? "..................................................." : application.fullNameEnglish || ""}
                </p>
              </div>
              <div className="border-b border-slate-300 pb-0.5 flex justify-between">
                <div>
                  <span className="text-[7px] text-slate-500 uppercase font-semibold">Class / Roll:</span>
                  <p className="font-bold">{isBlank ? "........ / ........" : `${application.classYear || "HSC 1st"} (Roll: ${application.classRoll || "N/A"})`}</p>
                </div>
                <div>
                  <span className="text-[7px] text-slate-500 uppercase font-semibold">Blood:</span>
                  <p className="font-black text-red-700">{isBlank ? "....." : application.bloodGroup || "N/A"}</p>
                </div>
              </div>
              <div>
                <span className="text-[7px] text-slate-500 uppercase font-semibold">Contact Mobile:</span>
                <p className="font-bold">{isBlank ? "........................" : application.studentPhone || ""}</p>
              </div>
            </div>

            {/* Middle Right: Exam Venue & Schedule Box */}
            <div className="col-span-4 border border-black rounded p-1.5 bg-slate-50 text-[7.5px] space-y-1">
              <div className="flex justify-between items-center border-b border-slate-300 pb-0.5">
                <span className="font-bold uppercase text-slate-700">Exam Date:</span>
                <span className="font-black text-[8.5px] text-black">
                  {application.examDate || "18 October, 2026"}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-300 pb-0.5">
                <span className="font-bold uppercase text-slate-700">Reporting Time:</span>
                <span className="font-black text-[8.5px] text-black">
                  {application.examTime || "09:00 AM Sharp"}
                </span>
              </div>
              <div>
                <span className="font-bold uppercase text-slate-700 block">Exam Venue (পরীক্ষা কেন্দ্র):</span>
                <p className="font-bold text-[8px] text-slate-900 leading-tight">
                  {application.examVenue || "Cox's Bazar City College Campus & BNCC Parade Ground"}
                </p>
              </div>
            </div>

            {/* Right: Security QR Code */}
            <div className="col-span-2 flex flex-col items-center justify-center">
              <div className="p-1 border border-black bg-white rounded flex items-center justify-center">
                <QRCodeCanvas
                  value={qrData}
                  size={52}
                  level="M"
                />
              </div>
              <span className="text-[6.5px] font-mono font-bold mt-0.5 text-center">
                VERIFY QR
              </span>
            </div>
          </div>

          {/* Admit Card Footer: Rules & Signatures */}
          <div className="grid grid-cols-12 gap-2 mt-1.5 pt-1 border-t border-black items-end text-[7px]">
            {/* Rules list */}
            <div className="col-span-8 space-y-0.5 text-slate-700 leading-tight">
              <p className="font-black text-black uppercase text-[7.5px]">নির্দেশাবলী / Important Instructions:</p>
              <p>১. পরীক্ষার দিন অবশ্যই এই প্রবেশপত্র এবং এসএসসি মূল মার্কশিট/রেজিস্ট্রেশন কার্ড সাথে আনতে হবে।</p>
              <p>২. শারীরিক যোগ্যতা যাচাই পরীক্ষার জন্য উপযুক্ত সাদা টি-শার্ট ও কেডস পরিধান করে আসতে হবে।</p>
              <p>৩. মোবাইল ফোন, ক্যালকুলেটর বা যে কোনো ইলেকট্রনিক ডিভাইস সম্পূর্ণ নিষিদ্ধ।</p>
            </div>

            {/* Signatures */}
            <div className="col-span-2 text-center">
              <div className="border-t border-dotted border-black pt-0.5">
                <span className="font-bold block text-[6.5px] uppercase">প্রার্থীর স্বাক্ষর</span>
              </div>
            </div>
            <div className="col-span-2 text-center">
              <div className="border-t border-dotted border-black pt-0.5">
                <span className="font-bold block text-[6.5px] uppercase">অনুমোদনকারী কর্মকর্তা</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OfflineA4Document.displayName = "OfflineA4Document";
