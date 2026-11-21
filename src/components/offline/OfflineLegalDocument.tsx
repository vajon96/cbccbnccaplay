import React, { forwardRef } from "react";
import { OfflineApplication } from "../../types/offlineApplication";
import { Scissors } from "lucide-react";

interface OfflineLegalDocumentProps {
  application: OfflineApplication;
  isBlankTemplate?: boolean;
}

export const SKILL_OPTIONS = [
  "গান",
  "নৃত্য",
  "কৌতুক",
  "আবৃত্তি",
  "বক্তৃতা",
  "বিতর্ক",
  "ফুটবল",
  "ক্রিকেট",
  "হ্যান্ডবল",
  "দাবা"
];

// Helper to convert date string "YYYY-MM-DD" or similar to 6 day-month-year digits: [D, D, M, M, Y, Y]
function getDateDigits(dateStr?: string): string[] {
  if (!dateStr) return ["", "", "", "", "", ""];
  // If it's YYYY-MM-DD
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const y = parts[0].slice(-2); // last 2 digits of year
    const m = parts[1].padStart(2, "0");
    const d = parts[2].padStart(2, "0");
    return [d[0], d[1], m[0], m[1], y[0], y[1]];
  }
  return ["", "", "", "", "", ""];
}

export const OfflineLegalDocument = forwardRef<HTMLDivElement, OfflineLegalDocumentProps>(
  ({ application, isBlankTemplate = false }, ref) => {
    const isBlank = isBlankTemplate;
    const dateDigits = isBlank ? ["", "", "", "", "", ""] : getDateDigits(application.applicationDate);

    // Extract skills array
    const selectedSkills = application.skills || [];

    return (
      <div
        ref={ref}
        id="offlineLegalDocument"
        className="print-area w-[8.5in] h-[14in] min-h-[14in] max-h-[14in] bg-white text-slate-900 mx-auto relative shadow-2xl print:shadow-none print:m-0 flex flex-col justify-between overflow-hidden border border-slate-400 print:border-none"
        style={{
          boxSizing: "border-box",
          padding: "0.35in 0.45in 0.35in 0.45in",
          fontFamily: "'Noto Serif Bengali', 'SolaimanLipi', 'Kalpurush', 'Inter', 'Roboto', 'Arial', sans-serif",
          color: "#000000",
          backgroundColor: "#ffffff",
          lineHeight: "1.15"
        }}
      >
        {/* Subtle Watermark for Official Authenticity */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
          <img
            src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png"
            alt="Watermark"
            className="w-[320px] h-auto grayscale"
            crossOrigin="anonymous"
          />
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: MAIN APPLICATION FORM (Approx 72% of page height) */}
        {/* ========================================================================= */}
        <div className="relative z-10 flex flex-col justify-between" style={{ height: "72%" }}>
          {/* Header Row */}
          <div>
            {/* Top Motto */}
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-900 px-4 pb-0.5">
              <span>জ্ঞান</span>
              <span>শৃঙ্খলা</span>
              <span>সেবাপ্রবণ</span>
            </div>

            {/* Logos & Institution Title */}
            <div className="flex items-center justify-between border-b border-black pb-1 mb-1">
              {/* BNCC Circular Logo Placeholder (Left) */}
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png"
                  alt="BNCC Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Title Center */}
              <div className="text-center flex-1 px-2">
                <h1 className="text-[17px] font-black tracking-tight text-slate-950 font-serif leading-none">
                  বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি)
                </h1>
                <p className="text-[12px] font-bold text-slate-900 mt-0.5 leading-none">
                  (সেনা শাখা)
                </p>
                <p className="text-[13px] font-extrabold text-slate-950 mt-0.5 leading-none">
                  কক্সবাজার সিটি কলেজ মিশ্র প্লাটুন
                </p>

                {/* Bordered Title: আবেদন ফরম */}
                <div className="inline-block border border-black px-4 py-0.5 mt-1">
                  <span className="text-[12px] font-black uppercase tracking-wider">
                    আবেদন ফরম
                  </span>
                </div>
              </div>

              {/* Cox's Bazar City College Logo Placeholder (Right) */}
              <div className="w-14 h-14 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"
                  alt="College Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            {/* Top Information: ফরম নং, ক্যাডেট নং, তারিখ */}
            <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
              <div>
                <span className="font-bold">ফরম নং : </span>
                <span className="font-mono font-bold text-[11px]">{application.formNumber || "258"}</span>
                <span className="ml-4 font-bold">ক্যাডেট নং : </span>
                <span className="font-mono text-slate-950 inline-block min-w-[70px] border-b border-dotted border-black text-center">
                  {!isBlank && (application.cadetNumber || application.id || "")}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-bold">তারিখ:</span>
                <div className="flex gap-0.5 ml-1">
                  {dateDigits.map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-4 h-4 border border-black flex items-center justify-center font-mono text-[10px] font-bold"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Form Fields: Compact & Grid Layout */}
          <div className="border border-black text-[10px] divide-y divide-black">
            {/* ১. আবেদনকারীর নাম */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[22px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ১. আবেদনকারীর নাম
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">বাংলায়:</span>
                  <span className="font-bold text-slate-950 truncate">{!isBlank && application.fullNameBangla}</span>
                </div>
                <div className="col-span-5 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">Block Letter:</span>
                  <span className="font-mono font-bold uppercase text-[9.5px] truncate">{!isBlank && application.fullNameEnglish}</span>
                </div>
                <div className="col-span-3 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">E-mail:</span>
                  <span className="font-mono text-[9px] truncate">{!isBlank && application.email}</span>
                </div>
              </div>
            </div>

            {/* ২. পিতার নাম */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ২. পিতার নাম
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-6 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">বাংলায়:</span>
                  <span className="font-bold text-slate-950 truncate">{!isBlank && (application.fatherNameBangla || application.fatherName)}</span>
                </div>
                <div className="col-span-6 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">Block Letter:</span>
                  <span className="font-mono font-bold uppercase text-[9.5px] truncate">{!isBlank && (application.fatherNameEnglish || application.fatherName)}</span>
                </div>
              </div>
            </div>

            {/* ৩. মাতার নাম */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৩. মাতার নাম
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-6 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">বাংলায়:</span>
                  <span className="font-bold text-slate-950 truncate">{!isBlank && (application.motherNameBangla || application.motherName)}</span>
                </div>
                <div className="col-span-6 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">Block Letter:</span>
                  <span className="font-mono font-bold uppercase text-[9.5px] truncate">{!isBlank && (application.motherNameEnglish || application.motherName)}</span>
                </div>
              </div>
            </div>

            {/* ৪. শিক্ষাগত তথ্য */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৪. শিক্ষাগত তথ্য
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-5 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">শ্রেণি/বিভাগ:</span>
                  <span className="font-bold text-slate-950 truncate">{!isBlank && (application.classDepartment || application.classYear)}</span>
                </div>
                <div className="col-span-3 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">রোল:</span>
                  <span className="font-mono font-bold text-slate-950">{!isBlank && application.classRoll}</span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">শিক্ষাবর্ষ:</span>
                  <span className="font-mono font-bold text-slate-950">{!isBlank && (application.academicYear || "2026-2027")}</span>
                </div>
              </div>
            </div>

            {/* ৫. বর্তমান ঠিকানা */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[22px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৫. বর্তমান ঠিকানা
              </div>
              <div className="col-span-9 px-2 py-0.5 flex items-center">
                <span className="text-[9.5px] text-slate-900 leading-tight">
                  {!isBlank && (application.addressPresent || "—")}
                </span>
              </div>
            </div>

            {/* ৬. স্থায়ী ঠিকানা */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[22px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৬. স্থায়ী ঠিকানা
              </div>
              <div className="col-span-9 px-2 py-0.5 flex items-center">
                <span className="text-[9.5px] text-slate-900 leading-tight">
                  {!isBlank && (application.addressPermanent || application.addressPresent || "—")}
                </span>
              </div>
            </div>

            {/* ৭. ব্যক্তিগত তথ্য */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৭. ব্যক্তিগত তথ্য
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-5 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">জন্ম তারিখ:</span>
                  <span className="font-mono font-bold text-slate-950">{!isBlank && application.dob}</span>
                </div>
                <div className="col-span-3 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">ধর্ম:</span>
                  <span className="font-semibold text-slate-950">{!isBlank && (application.religion || "ইসলাম")}</span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">জাতীয়তা:</span>
                  <span className="font-semibold text-slate-950">{!isBlank && (application.nationality || "বাংলাদেশী")}</span>
                </div>
              </div>
            </div>

            {/* ৮. শারীরিক তথ্য */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৮. শারীরিক তথ্য
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">উচ্চতা:</span>
                  <span className="font-mono font-bold text-slate-950">
                    {!isBlank && application.heightFeet ? `${application.heightFeet}′ ${application.heightInches || "0"}″` : ""}
                  </span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">ওজন:</span>
                  <span className="font-mono font-bold text-slate-950">
                    {!isBlank && application.weightKg ? `${application.weightKg} কেজি` : ""}
                  </span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">দৃষ্টি শক্তি:</span>
                  <span className="font-semibold text-slate-950">
                    {!isBlank && (application.eyesight || "৬/৬")}
                  </span>
                </div>
              </div>
            </div>

            {/* ৯. শারীরিক মাপ */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ৯. শারীরিক মাপ
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">বুকের মাপ (স্বাভাবিক):</span>
                  <span className="font-semibold text-slate-950">{!isBlank && (application.chestNormal || "৩২\"")}</span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">প্রসারিত:</span>
                  <span className="font-semibold text-slate-950">{!isBlank && (application.chestExpanded || "৩৪\"")}</span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">সনাক্তকরণ চিহ্ন:</span>
                  <span className="font-semibold text-slate-950 truncate">{!isBlank && (application.identificationMark || "তিল")}</span>
                </div>
              </div>
            </div>

            {/* ১০. পূর্ববর্তী BNCC তথ্য */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[20px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ১০. পূর্ববর্তী BNCC তথ্য
              </div>
              <div className="col-span-9 grid grid-cols-12 divide-x divide-black">
                <div className="col-span-5 px-1.5 py-0.5 flex items-center gap-1">
                  <span className="text-[9px] text-slate-700 font-semibold">সদস্য ছিলেন কি?</span>
                  <span className="font-bold text-slate-950">
                    {!isBlank ? (application.previousBnccMember || "না") : "[  ] হ্যাঁ   [  ] না"}
                  </span>
                </div>
                <div className="col-span-4 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">থাকলে পদবী:</span>
                  <span className="font-semibold text-slate-950">{!isBlank && application.previousBnccRank}</span>
                </div>
                <div className="col-span-3 px-1.5 py-0.5 flex items-center">
                  <span className="text-[9px] text-slate-700 mr-1 font-semibold">রক্তের গ্রুপ:</span>
                  <span className="font-mono font-black text-rose-700">{!isBlank && application.bloodGroup}</span>
                </div>
              </div>
            </div>

            {/* ১১. দক্ষতা */}
            <div className="grid grid-cols-12 divide-x divide-black min-h-[24px]">
              <div className="col-span-3 bg-slate-50/80 px-1.5 py-0.5 font-bold flex items-center">
                ১১. দক্ষতা
              </div>
              <div className="col-span-9 px-1.5 py-0.5 flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
                <span className="text-[9px] text-slate-700 font-semibold">কোন বিষয়ে পারদর্শী—</span>
                {SKILL_OPTIONS.map((skill) => {
                  const isChecked = !isBlank && selectedSkills.includes(skill);
                  return (
                    <label key={skill} className="inline-flex items-center gap-1 text-[9.5px]">
                      <span
                        className={`w-2.5 h-2.5 border border-black flex items-center justify-center font-bold text-[8px] leading-none ${
                          isChecked ? "bg-black text-white" : "bg-white"
                        }`}
                      >
                        {isChecked ? "✓" : ""}
                      </span>
                      <span>{skill}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ১২. শিক্ষাগত যোগ্যতা টেবিল */}
          <div className="mt-1">
            <div className="text-[10px] font-bold text-slate-950 mb-0.5 flex items-center justify-between">
              <span>১২. শিক্ষাগত যোগ্যতা :</span>
              <span className="text-[8.5px] font-normal italic text-slate-600">(সকল তথ্য সতর্কতার সহিত পূরণ করুন)</span>
            </div>
            <table className="w-full border-collapse border border-black text-[9.5px] text-center">
              <thead>
                <tr className="bg-slate-100/90 font-bold border-b border-black">
                  <th className="border border-black px-1 py-0.5 w-[35px]">ক্রমনং</th>
                  <th className="border border-black px-1.5 py-0.5 w-[110px]">পরীক্ষার নাম</th>
                  <th className="border border-black px-1.5 py-0.5 w-[90px]">শিক্ষা বোর্ড</th>
                  <th className="border border-black px-1.5 py-0.5 w-[80px]">সিজিপিএ/জিপিএ</th>
                  <th className="border border-black px-1.5 py-0.5">শিক্ষা প্রতিষ্ঠান</th>
                  <th className="border border-black px-1.5 py-0.5 w-[65px]">পাশের সন</th>
                </tr>
              </thead>
              <tbody>
                {/* ক. এসএসসি/সমমান */}
                <tr className="h-[18px]">
                  <td className="border border-black px-1 py-0.5 font-bold">ক.</td>
                  <td className="border border-black px-1.5 py-0.5 font-semibold text-left">এসএসসি/সমমান</td>
                  <td className="border border-black px-1.5 py-0.5">{!isBlank && (application.ssc?.board || application.sscBoard || "")}</td>
                  <td className="border border-black px-1.5 py-0.5 font-mono font-bold">{!isBlank && (application.ssc?.gpa || application.sscGpa || "")}</td>
                  <td className="border border-black px-1.5 py-0.5 text-left truncate max-w-[200px]">{!isBlank && (application.ssc?.institution || "")}</td>
                  <td className="border border-black px-1.5 py-0.5 font-mono">{!isBlank && (application.ssc?.passingYear || application.sscYear || "")}</td>
                </tr>
                {/* খ. এইচএসসি/সমমান */}
                <tr className="h-[18px]">
                  <td className="border border-black px-1 py-0.5 font-bold">খ.</td>
                  <td className="border border-black px-1.5 py-0.5 font-semibold text-left">এইচএসসি/সমমান</td>
                  <td className="border border-black px-1.5 py-0.5">{!isBlank && (application.hsc?.board || "")}</td>
                  <td className="border border-black px-1.5 py-0.5 font-mono font-bold">{!isBlank && (application.hsc?.gpa || "")}</td>
                  <td className="border border-black px-1.5 py-0.5 text-left truncate max-w-[200px]">{!isBlank && (application.hsc?.institution || "কক্সবাজার সিটি কলেজ")}</td>
                  <td className="border border-black px-1.5 py-0.5 font-mono">{!isBlank && (application.hsc?.passingYear || "")}</td>
                </tr>
              </tbody>
            </table>
            <div className="text-[8.5px] italic text-slate-600 text-center mt-0.5">
              (উপরিউক্ত তথ্য সঠিকভাবে পূরণ করুন)
            </div>
          </div>

          {/* ৯. DECLARATION (অঙ্গীকারনামা) */}
          <div className="border border-black p-1.5 my-1 bg-slate-50/50">
            <p className="text-[8.5px] text-justify leading-relaxed text-slate-900 font-serif">
              "আমি <span className="inline-block min-w-[140px] border-b border-dotted border-black text-center font-bold px-1">{!isBlank ? application.fullNameBangla : ""}</span> প্রতিশ্রুতি করিতেছি যে, আমি বিএনসিসির আদেশ ক্রমে জাতীয় স্বার্থে যে কোন সেবামূলক কাজ করিতে বাধ্য থাকিব এবং দেশ রক্ষা কল্পে নিজের জীবন বিসর্জন দিয়াও আমার উপরস্থ অফিসারের আইনসংগত আদেশ পালন করিয়া যাইব। ক্যাডেট শীপ বহাল থাকাকালীন সময়ে বিএনসিসির ডাকে আমি উপযুক্ত যে কোন কাজে হাজির হইতে বাধ্য থাকিব। বর্তমানে আমি কোন রাজনৈতিক দল ও দেশদ্রোহী কর্মকাণ্ডের সহিত জড়িত নই এবং ক্যাডেট থাকাকালীন সময়ে জড়িত হব না।"
            </p>
          </div>

          {/* ১০. SIGNATURE SECTION */}
          <div className="mt-auto">
            {/* Top row signatures */}
            <div className="grid grid-cols-3 text-center items-end text-[9.5px] font-bold pt-3 pb-1 border-b border-slate-300">
              {/* LEFT: অভিভাবকের স্বাক্ষর */}
              <div>
                <div className="w-32 border-b border-black mx-auto mb-1"></div>
                <span>অভিভাবকের স্বাক্ষর</span>
              </div>

              {/* CENTER: ভর্তির জন্য উপযুক্ত/অনুপযুক্ত */}
              <div className="text-[10px]">
                <span className="border border-black px-2 py-0.5">
                  ভর্তির জন্য উপযুক্ত/অনুপযুক্ত...
                </span>
              </div>

              {/* RIGHT: আবেদনকারীর স্বাক্ষর */}
              <div>
                <div className="w-32 border-b border-black mx-auto mb-1"></div>
                <span>আবেদনকারীর স্বাক্ষর</span>
              </div>
            </div>

            {/* Bottom Row Signatures & Comments */}
            <div className="flex items-center justify-between text-[9.5px] pt-1">
              {/* Below LEFT: ক্যাডেট ইনচার্জ এর স্বাক্ষর */}
              <div className="font-bold flex items-center gap-2">
                <span>ক্যাডেট ইনচার্জ এর স্বাক্ষর :</span>
                <span className="inline-block w-32 border-b border-dotted border-black"></span>
              </div>

              {/* Bottom-right: প্লাটুন মন্তব্য ও স্বাক্ষর */}
              <div className="border border-black px-3 py-1 text-right min-w-[200px]">
                <div className="text-[9px] font-bold text-left">প্লাটুন মন্তব্য ও স্বাক্ষর :</div>
                <div className="h-4"></div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: CUTTING / DETACHABLE LINE */}
        {/* ========================================================================= */}
        <div className="relative my-1 text-center flex items-center justify-center">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t-2 border-dashed border-black"></div>
          </div>
          <div className="relative inline-flex items-center gap-1.5 bg-white px-3 py-0.5 text-[9px] font-bold text-black border border-black uppercase tracking-wider">
            <Scissors size={11} className="rotate-90" />
            <span>এখান থেকে কেটে আলাদা করুন</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: ADMIT CARD / প্রবেশপত্র (Approx 26% of page height) */}
        {/* ========================================================================= */}
        <div className="relative z-10 flex flex-col justify-between border-2 border-black p-2 bg-white" style={{ height: "26%" }}>
          {/* Admit Header */}
          <div>
            {/* Top Motto */}
            <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-900 px-3 pb-0.5">
              <span>জ্ঞান</span>
              <span>শৃঙ্খলা</span>
              <span>সেবাপ্রবণ</span>
            </div>

            {/* Logos & Admit Title */}
            <div className="flex items-center justify-between border-b border-black pb-0.5 mb-1">
              {/* Left Logo */}
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png"
                  alt="BNCC Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>

              {/* Center Title */}
              <div className="text-center flex-1 px-1">
                <h2 className="text-[13px] font-black tracking-tight text-slate-950 font-serif leading-none">
                  বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি)
                </h2>
                <p className="text-[10px] font-bold text-slate-900 leading-none mt-0.5">
                  (সেনা শাখা)
                </p>
                <p className="text-[10.5px] font-extrabold text-slate-950 leading-none mt-0.5">
                  কক্সবাজার সিটি কলেজ মিশ্র প্লাটুন
                </p>

                {/* Title */}
                <div className="inline-block border border-black px-3 py-0.2 mt-0.5">
                  <span className="text-[10.5px] font-black uppercase tracking-wider">
                    ADMIT CARD / প্রবেশপত্র
                  </span>
                </div>
              </div>

              {/* Right Logo */}
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <img
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png"
                  alt="College Logo"
                  className="max-h-full max-w-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
            </div>

            {/* Admit Form No & Date */}
            <div className="flex items-center justify-between text-[9.5px] font-semibold mb-1">
              <div>
                <span className="font-bold">ফরম নং - </span>
                <span className="font-mono font-bold">{application.formNumber || "258"}</span>
                <span className="ml-3 font-bold">ক্যাডেট নং : </span>
                <span className="font-mono font-bold text-slate-950">
                  {!isBlank && (application.cadetNumber || application.id || "")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold">তারিখ:</span>
                <div className="flex gap-0.5 ml-1">
                  {dateDigits.map((digit, idx) => (
                    <div
                      key={idx}
                      className="w-3.5 h-3.5 border border-black flex items-center justify-center font-mono text-[9px] font-bold"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Admit Body: Candidate Info & Photo Box */}
          <div className="flex items-stretch gap-2 my-0.5">
            {/* Info Grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] border border-black p-1">
              <div>
                <span className="font-bold">নাম : </span>
                <span className="border-b border-dotted border-black inline-block min-w-[120px] font-bold">
                  {!isBlank && (application.fullNameBangla || application.fullNameEnglish)}
                </span>
              </div>
              <div>
                <span className="font-bold">পিতার নাম : </span>
                <span className="border-b border-dotted border-black inline-block min-w-[120px]">
                  {!isBlank && (application.fatherNameBangla || application.fatherName)}
                </span>
              </div>
              <div>
                <span className="font-bold">শ্রেণি/বিভাগ : </span>
                <span className="border-b border-dotted border-black inline-block min-w-[120px]">
                  {!isBlank && (application.classDepartment || application.classYear)}
                </span>
              </div>
              <div>
                <span className="font-bold">শিক্ষাবর্ষ : </span>
                <span className="border-b border-dotted border-black inline-block min-w-[120px] font-mono">
                  {!isBlank && (application.academicYear || "2026-2027")}
                </span>
              </div>
            </div>

            {/* Candidate Attested Photo Box */}
            <div className="w-[1.2in] h-[1.3in] border border-black flex flex-col items-center justify-center p-0.5 text-center bg-slate-50 shrink-0">
              {!isBlank && application.applicantPhoto && application.applicantPhoto.trim() !== "" ? (
                <img
                  src={application.applicantPhoto}
                  alt="Applicant Photo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-[7.5px] leading-tight text-slate-600 font-sans">
                  <span>সত্যায়িত</span><br />
                  <span>পাসপোর্ট সাইজ</span><br />
                  <span>ছবি</span>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Bordered Box */}
          <div className="border border-black p-1 bg-slate-50/50">
            <div className="text-[9px] font-bold text-slate-950 mb-0.5">
              প্রয়োজনীয় তথ্য/নির্দেশনা :
            </div>
            <p className="text-[8px] text-slate-800 leading-snug">
              {!isBlank && application.admitInstructions
                ? application.admitInstructions
                : "১. মূল মার্কশিট, শিক্ষাগত সনদ ও প্রবেশপত্র পরীক্ষার দিন সাথে আনতে হবে। ২. শারীরিক ও স্বাস্থ্য পরীক্ষার জন্য উপযুক্ত পোশাক পরিধান করতে হবে। ৩. পরীক্ষা কেন্দ্রে মোবাইল ফোন বা ইলেকট্রনিক ডিভাইস সম্পূর্ণ নিষিদ্ধ।"}
            </p>
          </div>

          {/* Admit Footer: Cadet In-charge Signature */}
          <div className="flex items-center justify-end text-[9px] font-bold pt-1">
            <div className="text-right">
              <div className="w-36 border-b border-black ml-auto mb-0.5"></div>
              <span>ক্যাডেট ইনচার্জের স্বাক্ষর</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OfflineLegalDocument.displayName = "OfflineLegalDocument";
