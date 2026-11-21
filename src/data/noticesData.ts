export interface NoticeItem {
  id: string;
  refNumber: string;
  title: string;
  titleEnglish?: string;
  category: "Recruitment" | "Parade" | "Training" | "Orders" | "Welfare" | "Emergency";
  publishDate: string;
  isImportant?: boolean;
  status: "Active" | "Archived";
  content: string;
  summary: string;
  signedBy: string;
  designation: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export const NOTICES_DATA: NoticeItem[] = [
  {
    id: "notc-2026-01",
    refNumber: "CBCC-BNCC/REC-2026/01",
    title: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে নতুন ক্যাডেট ভর্তি বিজ্ঞপ্তি - ২০২৬",
    titleEnglish: "New Cadet Enrollment Circular 2026 - Cox's Bazar City College BNCC Platoon",
    category: "Recruitment",
    publishDate: "১৫ জানুয়ারি, ২০২৬",
    isImportant: true,
    status: "Active",
    summary: "কক্সবাজার সিটি কলেজের একাদশ ও ডিগ্রি ১ম বর্ষের শিক্ষার্থীদের মধ্য থেকে নতুন ক্যাডেট ভর্তির আহ্বান জানানো হচ্ছে।",
    content: `কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে (১৫ বিএনসিসি ব্যাটালিয়ন, কর্ণফুলী রেজিমেন্ট, ই কোম্পানি, মিশ্র প্লাটুন) ২০২৬-২০২৭ শিক্ষাবর্ষে নিয়মিত ক্যাডেট অন্তর্ভুক্তির জন্য যোগ্য শিক্ষার্থীদের কাছ থেকে আবেদন আহ্বান করা যাচ্ছে।

আবেদনের যোগ্যতা:
১. কক্সবাজার সিটি কলেজের একাদশ শ্রেণি অথবা স্নাতক ১ম বর্ষে অধ্যয়নরত নিয়মিত শিক্ষার্থী।
২. ন্যূনতম এসএসসি জিপিএ ৩.০০।
৩. উচ্চতা: পুরুষ ন্যূনতম ৫ ফুট ৬ ইঞ্চি, নারী ন্যূনতম ৫ ফুট ২ ইঞ্চি।
৪. অবিবাহিত এবং সুস্বাস্থ্যের অধিকারী।

প্রয়োজনীয় কাগজপত্র:
• অনলাইন বা অফলাইন পূরণকৃত আবেদন ফর্ম
• এসএসসি পাশের সনদ ও নম্বরপত্রের কপি (২ কপি)
• কলেজ ভর্তির মূল রসিদের ফটোকপি
• পাসপোর্ট সাইজের ল্যাব প্রিন্ট রঙিন ছবি (২ কপি)

আবেদনের শেষ তারিখ ও বাছাই পরীক্ষার সময়সূচি ওয়েবসাইটে ও কলেজ নোটিশ বোর্ডে জানিয়ে দেওয়া হবে।`,
    signedBy: "উজ্জ্বল কান্তি দেব",
    designation: "প্রফেসর আন্ডার অফিসার (PUO) ও প্লাটুন কমান্ডার",
    attachmentUrl: "https://docs.google.com/document/d/1ej5TVfzgkKG8mfU2cWRuliKrC2_QBLCn/preview",
    attachmentName: "Circular-2026.pdf"
  },
  {
    id: "notc-2026-02",
    refNumber: "CBCC-BNCC/PAR-2026/03",
    title: "২৬শে মার্চ মহান স্বাধীনতা দিবস কুচকাওয়াজ ২০২৬ উপলক্ষে বিশেষ প্যারেড আদেশ",
    titleEnglish: "Independence Day Parade 2026 Directive & Contingent Assembly",
    category: "Parade",
    publishDate: "০১ মার্চ, ২০২৬",
    isImportant: true,
    status: "Active",
    summary: "জেলা প্রশাসন আয়োজিত কুচকাওয়াজে অংশগ্রহণকারী ক্যাডেটদের রিহার্সাল ও ফুল ইউনিফর্ম (Full Rig) উপস্থিতি বাধ্যতামূলক।",
    content: `আগামী ২৬শে মার্চ মহান স্বাধীনতা ও জাতীয় দিবস ২০২৬ উদযাপন উপলক্ষে কক্সবাজার বীরশ্রেষ্ঠ রুহুল আমিন স্টেডিয়ামে জেলা প্রশাসন আয়োজিত সম্মিলিত কুচকাওয়াজে কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন দল অংশগ্রহণ করবে।

নির্বাচিত সকল ক্যাডেটদের নির্দেশ দেওয়া যাচ্ছে:
১. প্রতিদিন সকাল ৬:৩০ মিনিটে কলেজ মাঠে প্যারেড অনুশীলনে উপস্থিত থাকতে হবে।
২. পরিপাটি ইউনিফর্ম, পলিশকৃত বুট, বেরেট ক্যাপ ও ক্রেস্ট রিবন পরিধান নিশ্চিত করতে হবে।
৩. শৃঙ্খলা ও সামরিক সময়ানুবর্তিতা লঙ্ঘন করলে কন্টিনজেন্ট থেকে অব্যাহতি দেওয়া হবে।`,
    signedBy: "উজ্জ্বল কান্তি দেব",
    designation: "প্লাটুন কমান্ডার, কক্সবাজার সিটি কলেজ প্লাটুন",
    attachmentName: "IndependenceDay-Contingent-List.pdf"
  },
  {
    id: "notc-2026-03",
    refNumber: "CBCC-BNCC/DRL-2026/02",
    title: "সাপ্তাহিক শুক্রবার ও শনিবার নিয়মিত ড্রিল ও ইউনিফর্ম পরিদর্শন নির্দেশনা",
    titleEnglish: "Routine Weekend Drill & Weekly Inspection Directive",
    category: "Orders",
    publishDate: "১০ ফেব্রুয়ারি, ২০২৬",
    isImportant: false,
    status: "Active",
    summary: "ক্যাম্পাসের প্যারেড গ্রাউন্ডে নিয়মিত ড্রিল ও পিটি সংক্রান্ত সাপ্তাহিক রুটিন কার্যকর রাখার আদেশ।",
    content: `প্লাটুনের সকল নিয়মিত ক্যাডেটদের অবগতির জন্য জানানো যাচ্ছে যে, প্রতি সপ্তাহের শুক্রবার ও শনিবার সকাল ৭:০০ টা থেকে ৯:০০ টা পর্যন্ত কলেজ প্যারেড গ্রাউন্ডে নিয়মিত ড্রিল ও শারীরিক প্রশিক্ষণ অনুষ্ঠিত হবে।

নির্দেশনাবলী:
১. নির্ধারিত সময়ের ১৫ মিনিট পূর্বে মাঠে ফল-ইন (Fall-in) করতে হবে।
২. সঠিক হেয়ারকাট ও শেইভ নিশ্চিত করতে হবে।
৩. কোনো ক্যাডেট যুক্তিসঙ্গত কারণ ব্যতীত পরপর দুই সপ্তাহ অনুপস্থিত থাকলে কারণ দর্শানোর নোটিশ প্রদান করা হবে।`,
    signedBy: "মোঃ কাদের (সার্জেন্ট)",
    designation: "প্লাটুন ইন-চার্জ (ব্যাচ ৫)",
    attachmentName: "Weekly-Drill-Schedule.pdf"
  },
  {
    id: "notc-2026-04",
    refNumber: "CBCC-BNCC/SOC-2026/04",
    title: "উপকূলীয় পরিবেশ পরিচ্ছন্নতা ও স্বেচ্ছাসেবী রক্তদান কর্মসূচি ২০২৬",
    titleEnglish: "Coastal Environmental Clean-up & Voluntary Blood Donation Drive",
    category: "Welfare",
    publishDate: "২৮ ফেব্রুয়ারি, ২০২৬",
    isImportant: false,
    status: "Active",
    summary: "কক্সবাজার সমুদ্রসৈকত প্লাস্টিক দূষণমুক্তকরণ এবং স্বেচ্ছাসেবী রক্তদান শিবিরের আয়োজন।",
    content: `সামাজিক দায়িত্ববোধ ও স্বেচ্ছাসেবার অংশ হিসেবে কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের উদ্যোগে 'ক্লিন বিচ, সেভ লাইফ' শীর্ষক পরিচ্ছন্নতা অভিযান এবং কলেজ মিলনায়তনে বিনামূল্যে রক্তের গ্রুপ নির্ণয় ও রক্তদান ক্যাম্প পরিচালিত হবে।

সকল ক্যাডেটকে স্বেচ্ছাসেবী মনোভাব নিয়ে অংশগ্রহণ করার আহ্বান জানানো হচ্ছে।`,
    signedBy: "উজ্জ্বল কান্তি দেব",
    designation: "প্লাটুন কমান্ডার",
    attachmentName: "Social-Drive-Notice.pdf"
  },
  {
    id: "notc-2025-11",
    refNumber: "CBCC-BNCC/TRG-2025/11",
    title: "বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC ২০২৫–২৬) এর ফলাফল ও সনদ বিতরণ",
    titleEnglish: "Annual Training Camp (ATC) 2025-26 Certification & Results",
    category: "Training",
    publishDate: "২০ ডিসেম্বর, ২০২৫",
    isImportant: false,
    status: "Archived",
    summary: "কর্ণফুলী রেজিমেন্ট ক্যাম্প সমাপ্তির পর অংশগ্রহণকারী ক্যাডেটদের সামরিক গ্রেডিং ও প্রশংসাপত্র প্রদান সংক্রান্ত।",
    content: `কর্ণফুলী রেজিমেন্ট পরিচালিত ১০ দিনব্যাপী বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC ২০২৫) সফলভাবে সম্পন্নকারী ক্যাডেটদের অভিনন্দন। 

ক্যাম্পে প্রদর্শিত নৈপুণ্য, ফায়ারিং ফলাফল এবং প্যারেড স্কোরের ভিত্তিতে আগামী সপ্তাহে আনুষ্ঠানিকভাবে ক্যাডেটদের পদবী ব্যাজ ও সনদপত্র হস্তান্তর করা হবে।`,
    signedBy: "উজ্জ্বল কান্তি দেব",
    designation: "প্লাটুন কমান্ডার",
    attachmentName: "ATC-2025-Grading.pdf"
  }
];
