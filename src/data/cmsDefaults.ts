/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  CMSContentItem, 
  CMSSectionConfig, 
  CMSCadetProfile, 
  CMSInchargeRecord, 
  CMSCommanderProfile, 
  CMSNoticeItem, 
  CMSActivityItem, 
  CMSGalleryMediaItem, 
  CMSSiteSettings 
} from "../types/cms";
import { CADETS_DATA } from "./cadetsData";
import { INCHARGES_DATA, PLATOON_COMMANDER } from "./inchargesData";
import { NOTICES_DATA } from "./noticesData";

export const DEFAULT_CMS_SETTINGS: CMSSiteSettings = {
  siteTitle: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
  siteTitleEn: "Cox's Bazar City College BNCC Platoon",
  organizationName: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি)",
  regimentInfo: "১৫ বিএনসিসি ব্যাটালিয়ন • কর্ণফুলী রেজিমেন্ট • ই কোম্পানি",
  motto: "জ্ঞান ও শৃঙ্খলা",
  mottoEn: "Knowledge & Discipline",
  primaryColor: "#002147",
  accentColor: "#C5A059",
  collegeLogoUrl: "https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png",
  bnccLogoUrl: "https://i.ibb.co/Fb3R6wR/Bncc-logo.png",
  ribbonBannerUrl: "/assets/aistudio/New_Project__2__6a6c0725.png",
  contactPhone: "+880 1812-430454",
  contactEmail: "cbccbncc@gmail.com",
  emergencyPhone: "+880 1819-060727",
  address: "কক্সবাজার সিটি কলেজ ক্যাম্পাস, সাহিত্যিকা রোড, কক্সবাজার-৪৭০০",
  collegeWebsite: "https://cbcc.edu.bd/",
  bnccCentralWebsite: "https://bncc.info/",
  facebookPage: "https://facebook.com/cbccbncc",
  youtubeChannel: "",
  noticeTickerEnabled: true,
  noticeTickerSpeed: 30,
  enrollmentOpen: true,
  offlineFormOpen: true,
  examPortalOpen: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: "Super Admin"
};

export const DEFAULT_UNIVERSAL_TEXT_ITEMS: CMSContentItem[] = [
  // Global / Header
  {
    id: "global.site_title",
    page: "Global",
    section: "Header",
    field: "Site Title",
    content: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
    contentEn: "Cox's Bazar City College BNCC Platoon",
    defaultValue: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "global.motto",
    page: "Global",
    section: "Header",
    field: "Platoon Motto",
    content: "জ্ঞান ও শৃঙ্খলা",
    contentEn: "Knowledge & Discipline",
    defaultValue: "জ্ঞান ও শৃঙ্খলা",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "global.regiment_badge",
    page: "Global",
    section: "Header",
    field: "Regiment Badge Tag",
    content: "১৫ বিএনসিসি ব্যাটালিয়ন • কর্ণফুলী রেজিমেন্ট • ই কোম্পানি",
    contentEn: "15 BNCC Battalion • Karnaphuli Regiment • E Company",
    defaultValue: "১৫ বিএনসিসি ব্যাটালিয়ন • কর্ণফুলী রেজিমেন্ট • ই কোম্পানি",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Home Hero Section
  {
    id: "home.hero.title_pre",
    page: "Home",
    section: "Hero",
    field: "Hero College Name",
    content: "কক্সবাজার সিটি কলেজ",
    contentEn: "Cox's Bazar City College",
    defaultValue: "কক্সবাজার সিটি কলেজ",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.title_post",
    page: "Home",
    section: "Hero",
    field: "Hero Platoon Highlight",
    content: "বিএনসিসি প্লাটুন",
    contentEn: "BNCC Platoon",
    defaultValue: "বিএনসিসি প্লাটুন",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.subtitle",
    page: "Home",
    section: "Hero",
    field: "Hero Subtitle",
    content: "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service.",
    contentEn: "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service.",
    defaultValue: "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service.",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.description",
    page: "Home",
    section: "Hero",
    field: "Hero Mission Statement",
    content: "আত্মপ্রত্যয়ী তরুণ নেতৃত্ব এবং দ্বিতীয় প্রতিরক্ষা স্তর গড়ে তোলাই আমাদের লক্ষ্য।",
    contentEn: "Fostering confident youth leadership and the nation's second line of defense.",
    defaultValue: "আত্মপ্রত্যয়ী তরুণ নেতৃত্ব এবং দ্বিতীয় প্রতিরক্ষা স্তর গড়ে তোলাই আমাদের লক্ষ্য।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.cta_online",
    page: "Home",
    section: "Hero",
    field: "CTA Button Online",
    content: "অনলাইনে আবেদন করুন",
    contentEn: "Apply Online",
    defaultValue: "অনলাইনে আবেদন করুন",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.cta_offline",
    page: "Home",
    section: "Hero",
    field: "CTA Button Offline Form",
    content: "অফলাইন ফর্ম ডাউনলোড",
    contentEn: "Download Offline Form",
    defaultValue: "অফলাইন ফর্ম ডাউনলোড",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.hero.cta_circular",
    page: "Home",
    section: "Hero",
    field: "CTA Button Circular",
    content: "ভর্তি সার্কুলার",
    contentEn: "Admission Circular",
    defaultValue: "ভর্তি সার্কুলার",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Home Commander Message
  {
    id: "home.commander.heading",
    page: "Home",
    section: "Commander Message",
    field: "Commander Section Heading",
    content: "প্লাটুন কমান্ডারের বাণী",
    contentEn: "Platoon Commander's Message",
    defaultValue: "প্লাটুন কমান্ডারের বাণী",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "home.commander.quote",
    page: "Home",
    section: "Commander Message",
    field: "Commander Quotation",
    content: "বিএনসিসি ক্যাডেটদের মধ্যে দেশপ্রেম, সামরিক শৃঙ্খলা, নেতৃত্ব ও নিঃস্বার্থ আত্মত্যাগের মহৎ গুণাবলি জাগ্রত করে। কক্সবাজার সিটি কলেজ প্লাটুনের প্রতিটি ক্যাডেট জাতির অতন্দ্র প্রহরী হিসেবে গড়ে উঠছে।",
    contentEn: "BNCC instills patriotism, military discipline, leadership, and selfless sacrifice. Every cadet of Cox's Bazar City College is being molded as a vigilant guardian of the nation.",
    defaultValue: "বিএনসিসি ক্যাডেটদের মধ্যে দেশপ্রেম, সামরিক শৃঙ্খলা, নেতৃত্ব ও নিঃস্বার্থ আত্মত্যাগের মহৎ গুণাবলি জাগ্রত করে। কক্সবাজার সিটি কলেজ প্লাটুনের প্রতিটি ক্যাডেট জাতির অতন্দ্র প্রহরী হিসেবে গড়ে উঠছে।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // About Page
  {
    id: "about.page.title",
    page: "About",
    section: "Overview",
    field: "About Page Main Title",
    content: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন পরিচিতি",
    contentEn: "About Cox's Bazar City College BNCC Platoon",
    defaultValue: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন পরিচিতি",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "about.page.intro",
    page: "About",
    section: "Overview",
    field: "About Platoon History & Mission",
    content: "১৫ বিএনসিসি ব্যাটালিয়ন • কর্ণফুলী রেজিমেন্ট (আর্মি উইং)। ২০২০ সালে ৩ সেপ্টেম্বর অনুমোদনের মাধ্যমে প্রতিষ্ঠিত এই প্লাটুন জেলার অন্যতম অগ্রগণ্য ও সুশৃঙ্খল সামরিক ছাত্র সংগঠন হিসেবে সুপরিচিত।",
    contentEn: "15 BNCC Battalion • Karnaphuli Regiment (Army Wing). Established on 3 September 2020, renowned as the premier student military organization in the district.",
    defaultValue: "১৫ বিএনসিসি ব্যাটালিয়ন • কর্ণফুলী রেজিমেন্ট (আর্মি উইং)। ২০২০ সালে ৩ সেপ্টেম্বর অনুমোদনের মাধ্যমে প্রতিষ্ঠিত এই প্লাটুন জেলার অন্যতম অগ্রগণ্য ও সুশৃঙ্খল সামরিক ছাত্র সংগঠন হিসেবে সুপরিচিত।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Cadets Directory
  {
    id: "cadets.page.title",
    page: "Cadets",
    section: "Hero",
    field: "Cadets Directory Title",
    content: "সিটি কলেজ প্লাটুনের বীর ক্যাডেটবৃন্দ",
    contentEn: "Cadets Directory of CBCC BNCC Platoon",
    defaultValue: "সিটি কলেজ প্লাটুনের বীর ক্যাডেটবৃন্দ",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "cadets.page.subtitle",
    page: "Cadets",
    section: "Hero",
    field: "Cadets Directory Subtitle",
    content: "শৃঙ্খলার প্রতীক, নেতৃত্বের কাণ্ডারি — আমাদের সকল ব্যাচের নিয়মিত ও সিনিয়র ক্যাডেট প্রোফাইল।",
    contentEn: "Symbols of discipline, vanguard of leadership — profiles of active and alumni cadets.",
    defaultValue: "শৃঙ্খলার প্রতীক, নেতৃত্বের কাণ্ডারি — আমাদের সকল ব্যাচের নিয়মিত ও সিনিয়র ক্যাডেট প্রোফাইল।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Incharges
  {
    id: "incharges.page.title",
    page: "Incharges",
    section: "Hero",
    field: "Hall of Incharges Title",
    content: "হল অব ইন-চার্জেস (Hall of In-Charges)",
    contentEn: "Hall of In-Charges & Platoon Leadership",
    defaultValue: "হল অব ইন-চার্জেস (Hall of In-Charges)",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Activities
  {
    id: "activities.page.title",
    page: "Activities",
    section: "Hero",
    field: "Activities Page Title",
    content: "প্রশিক্ষণ ও সামাজিক কার্যক্রম",
    contentEn: "Training & Community Activities",
    defaultValue: "প্রশিক্ষণ ও সামাজিক কার্যক্রম",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Notice Board
  {
    id: "notices.page.title",
    page: "Notices",
    section: "Hero",
    field: "Notice Board Title",
    content: "অফিসিয়াল নোটিশ বোর্ড ও সার্কুলার",
    contentEn: "Official Notice Board & Circulars",
    defaultValue: "অফিসিয়াল নোটিশ বোর্ড ও সার্কুলার",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Gallery
  {
    id: "gallery.page.title",
    page: "Gallery",
    section: "Hero",
    field: "Photo Gallery Title",
    content: "আলোকচিত্রে আমাদের কর্মকাণ্ড",
    contentEn: "Platoon Activities & Photo Gallery",
    defaultValue: "আলোকচিত্রে আমাদের কর্মকাণ্ড",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Contact
  {
    id: "contact.page.title",
    page: "Contact",
    section: "Hero",
    field: "Contact Page Title",
    content: "আমাদের সাথে যোগাযোগ করুন",
    contentEn: "Contact CBCC BNCC Platoon",
    defaultValue: "আমাদের সাথে যোগাযোগ করুন",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },

  // Footer
  {
    id: "footer.about",
    page: "Global",
    section: "Footer",
    field: "Footer About Summary",
    content: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন কর্ণফুলী রেজিমেন্টের ১৫ বিএনসিসি ব্যাটালিয়নের আওতাধীন একটি মর্যাদাপূর্ণ সামরিক ছাত্র উইং।",
    contentEn: "Cox's Bazar City College BNCC Platoon is a prestigious youth military wing under 15 BNCC Battalion, Karnaphuli Regiment.",
    defaultValue: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন কর্ণফুলী রেজিমেন্টের ১৫ বিএনসিসি ব্যাটালিয়নের আওতাধীন একটি মর্যাদাপূর্ণ সামরিক ছাত্র উইং।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  },
  {
    id: "footer.copyright",
    page: "Global",
    section: "Footer",
    field: "Footer Copyright Notice",
    content: "© ২০২৬ কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন। সর্বস্বত্ব সংরক্ষিত।",
    contentEn: "© 2026 Cox's Bazar City College BNCC Platoon. All Rights Reserved.",
    defaultValue: "© ২০২৬ কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন। সর্বস্বত্ব সংরক্ষিত।",
    language: "both",
    lastModified: new Date().toISOString(),
    modifiedBy: "System",
    status: "published"
  }
];

export const DEFAULT_CMS_SECTIONS: CMSSectionConfig[] = [
  {
    id: "home.hero",
    name: "Hero Banner",
    page: "Home",
    order: 1,
    enabled: true,
    title: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন",
    subtitle: "Developing responsible citizens through discipline, leadership, teamwork, and voluntary service.",
    customData: {
      bgImage: "/assets/aistudio/dddf__1__7ebcab35.jpg",
      showTicker: true,
      ctaApply: true,
      ctaOffline: true,
      ctaCircular: true
    }
  },
  {
    id: "home.stats",
    name: "Statistics & Milestones",
    page: "Home",
    order: 2,
    enabled: true,
    title: "প্লাটুনের মূল পরিচিতি ও পরিসংখ্যান",
    customData: {
      stats: [
        { label: "প্রতিষ্ঠা", value: "২০২০", desc: "ESTD. 2020 (অনুমোদন ৩ সেপ্টেম্বর)" },
        { label: "রেজিমেন্ট", value: "কর্ণফুলী", desc: "Karnaphuli Regiment" },
        { label: "ব্যাটালিয়ন", value: "১৫ বিএনসিসি", desc: "15 BNCC Battalion" },
        { label: "কোম্পানি ও উইং", value: "ই কোম্পানি", desc: "Army Wing • Mixed Platoon" },
      ]
    }
  },
  {
    id: "home.commander_message",
    name: "Commander's Message",
    page: "Home",
    order: 3,
    enabled: true,
    title: "প্লাটুন কমান্ডারের বাণী",
    customData: {
      showBadge: true,
      showFullBio: true
    }
  },
  {
    id: "home.notice_ticker",
    name: "Notice Board Preview",
    page: "Home",
    order: 4,
    enabled: true,
    title: "সাম্প্রতিক নোটিশ ও সার্কুলার"
  },
  {
    id: "home.activities_showcase",
    name: "Activities Showcase",
    page: "Home",
    order: 5,
    enabled: true,
    title: "প্লাটুনের প্রধান কার্যক্রম"
  },
  {
    id: "home.photo_highlights",
    name: "Photo Highlights",
    page: "Home",
    order: 6,
    enabled: true,
    title: "আলোকচিত্রে প্লাটুন"
  },
  {
    id: "home.quick_enroll",
    name: "Quick Enrollment Callout",
    page: "Home",
    order: 7,
    enabled: true,
    title: "তুমি কি প্রস্তুত দেশসেবায় নিজেকে নিয়োজিত করতে?"
  }
];

export const DEFAULT_CMS_CADETS: CMSCadetProfile[] = CADETS_DATA.map((c) => ({
  id: c.id,
  name: c.name,
  banglaName: c.banglaName || "",
  cadetNumber: c.cadetNumber,
  rank: c.rank,
  rankFull: c.rankFull,
  batch: c.batch,
  department: c.department,
  institution: c.institution,
  fatherName: c.fatherName,
  motherName: c.motherName,
  bloodGroup: c.bloodGroup || "O+",
  photo: c.photo,
  joinDate: c.joinDate,
  district: c.district,
  contact: c.contact,
  email: c.email,
  role: c.role,
  bio: c.bio,
  status: c.role?.includes("In-Charge") ? "In-Charge" : "Active",
  isFeatured: c.role?.includes("In-Charge") || false,
  achievements: c.role || ""
}));

export const DEFAULT_CMS_INCHARGES: CMSInchargeRecord[] = INCHARGES_DATA.map((item, idx) => ({
  id: `incharge-${idx + 1}`,
  batch: item.batch,
  name: item.name,
  banglaName: item.banglaName || "",
  rankBadgeUrl: item.rankBadgeUrl,
  rankTitle: item.rankTitle,
  photoUrl: item.photoUrl,
  coPhotoUrl: item.coPhotoUrl,
  term: item.term,
  awards: item.awards,
  bio: item.bio,
  order: idx + 1,
  isCurrent: idx === INCHARGES_DATA.length - 1
}));

export const DEFAULT_CMS_COMMANDER: CMSCommanderProfile = {
  name: PLATOON_COMMANDER.name,
  banglaName: PLATOON_COMMANDER.banglaName,
  rank: PLATOON_COMMANDER.rank,
  designation: PLATOON_COMMANDER.designation,
  institution: PLATOON_COMMANDER.institution,
  regiment: PLATOON_COMMANDER.regiment,
  photoUrl: PLATOON_COMMANDER.photoUrl,
  phone: PLATOON_COMMANDER.phone,
  email: PLATOON_COMMANDER.email,
  message: PLATOON_COMMANDER.message
};

export const DEFAULT_CMS_NOTICES: CMSNoticeItem[] = NOTICES_DATA.map((n) => ({
  id: n.id,
  refNumber: n.refNumber,
  title: n.title,
  titleEnglish: n.titleEnglish,
  category: n.category as any,
  publishDate: n.publishDate,
  isImportant: n.isImportant,
  status: n.status,
  content: n.content,
  summary: n.summary,
  signedBy: n.signedBy,
  designation: n.designation,
  attachmentUrl: n.attachmentUrl,
  attachmentName: n.attachmentName,
  isPinned: n.isImportant || false
}));

export const DEFAULT_CMS_ACTIVITIES: CMSActivityItem[] = [
  {
    id: "drill-parade",
    title: "সাপ্তাহিক ড্রিল ও প্যারেড প্রশিক্ষণ",
    banglaTitle: "সাপ্তাহিক ড্রিল ও প্যারেড প্রশিক্ষণ",
    category: "নিয়মিত প্রশিক্ষণ",
    desc: "কলেজ মাঠে প্রতি সপ্তাহে দক্ষ সেনা প্রশিক্ষক ও প্লাটুন কমান্ডারের তত্ত্বাবধানে সামরিক ফুট ড্রিল, অস্ত্রবিহীন কুচকাওয়াজ ও শারীরিক কসরত পরিচালনা করা হয়।",
    tags: ["Drill", "Discipline", "Parade"],
    image: "/assets/aistudio/dd__1__02ef1095.jpg",
    date: "নিয়মিত প্রতি শুক্রবার ও শনিবার",
    location: "কক্সবাজার সিটি কলেজ মাঠ",
    isFeatured: true
  },
  {
    id: "weapon-training",
    title: "অস্ত্র চালনা ও ফায়ারিং ক্যাম্প",
    banglaTitle: "অস্ত্র চালনা ও ফায়ারিং ক্যাম্প",
    category: "সামরিক প্রশিক্ষণ",
    desc: "ক্যান্টনমেন্ট ও রেজিমেন্টাল রেঞ্জে নিরাপত্তা নির্দেশিকা মেনে ক্ষুদ্রাস্ত্র (Small Arms) পরিচিতি, পরিষ্কারকরণ, খোলা-জোড়া এবং টার্গেট শুটিং প্রশিক্ষণ।",
    tags: ["Firing", "Small Arms", "Marksmanship"],
    image: "/assets/aistudio/gg__5__b991f0cf.jpg",
    date: "রেজিমেন্টাল সময়সূচি অনুযায়ী",
    location: "ক্যান্টনমেন্ট ফায়ারিং রেঞ্জ",
    isFeatured: true
  },
  {
    id: "annual-camp",
    title: "বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC)",
    banglaTitle: "বাৎসরিক প্রশিক্ষণ ক্যাম্প (ATC)",
    category: "ক্যাম্প ও অ্যাডভেঞ্চার",
    desc: "কর্ণফুলী রেজিমেন্ট আয়োজিত ১০ দিনব্যাপী আবাসিক ক্যাম্পে অংশগ্রহণ। যেখানে ফিল্ড ক্রাফট, মানচিত্র পাঠ (Map Reading), তাঁবু নির্মাণ ও রণকৌশলের বাস্তব অভিজ্ঞতা হয়।",
    tags: ["ATC", "Field Craft", "Survival"],
    image: "/assets/aistudio/gg__1__a9924232.jpg",
    date: "বাৎসরিক শীতকালীন সময়সূচি",
    location: "কর্ণফুলী রেজিমেন্টাল ক্যাম্পাস",
    isFeatured: true
  },
  {
    id: "national-days",
    title: "জাতীয় দিবসসমূহে কুচকাওয়াজ ও গার্ড অব অনার",
    banglaTitle: "জাতীয় দিবসসমূহে কুচকাওয়াজ ও গার্ড অব অনার",
    category: "রাষ্ট্রীয় মর্যাদা",
    desc: "মহান স্বাধীনতা দিবস, বিজয় দিবস ও ২১শে ফেব্রুয়ারিতে জেলা স্টেডিয়ামে প্রথম পুরস্কার অর্জনকারী কুচকাওয়াজ এবং বিশিষ্ট ব্যক্তিবর্গকে সালামি প্রদর্শন।",
    tags: ["Guard of Honor", "Victory Day", "Pride"],
    image: "/assets/aistudio/dddf__1__7ebcab35.jpg",
    date: "২৬ মার্চ ও ১৬ ডিসেম্বর",
    location: "কক্সবাজার বীরশ্রেষ্ঠ রুহুল আমিন স্টেডিয়াম",
    isFeatured: true
  },
  {
    id: "social-welfare",
    title: "সামাজিক সেবা ও মানবিক দুর্যোগ মোকাবেলা",
    banglaTitle: "সামাজিক সেবা ও মানবিক দুর্যোগ মোকাবেলা",
    category: "স্বেচ্ছাসেবক কার্যক্রম",
    desc: "কক্সবাজারের উপকূলীয় অঞ্চলে ঘূর্ণিঝড় ও দুর্যোগকালীন উদ্ধার তৎপরতা, রক্তদান কর্মসূচি, প্লাস্টিক দূষণ রোধে সমুদ্রসৈকত পরিচ্ছন্নতা অভিযান পরিচালনা।",
    tags: ["Disaster Relief", "Blood Donation", "Community"],
    image: "/assets/aistudio/gg__3__5a59c92d.jpeg",
    date: "সারা বছর ব্যাপী",
    location: "কক্সবাজার উপকূলীয় এলাকা ও সৈকত",
    isFeatured: true
  },
  {
    id: "traffic-security",
    title: "ট্রাফিক ব্যবস্থাপনা ও জননিরাপত্তা সহায়তা",
    banglaTitle: "ট্রাফিক ব্যবস্থাপনা ও জননিরাপত্তা সহায়তা",
    category: "নাগরিক সেবা",
    desc: "পরীক্ষার দিনগুলোতে কলেজ প্রাঙ্গণে শৃঙ্খলা বজায় রাখা, ট্রাফিক পুলিশকে সহায়তা প্রদান এবং জরুরি মুহূর্তে আইন-শৃঙ্খলা রক্ষাকারী বাহিনীর সহযোগী হিসেবে দায়িত্ব পালন।",
    tags: ["Civic Duty", "Campus Safety", "Traffic Control"],
    image: "/assets/aistudio/2025__10__44904ccb.jpeg",
    date: "পরীক্ষা ও বিশেষ দিবসে",
    location: "কলেজ প্রাঙ্গণ ও সংলগ্ন মহাসড়ক",
    isFeatured: true
  }
];

export const DEFAULT_CMS_GALLERY: CMSGalleryMediaItem[] = [
  {
    id: "g-1",
    url: "/assets/aistudio/dddf__1__7ebcab35.jpg",
    title: "কলেজ মাঠ পরিদর্শন ও গার্ড অব অনার প্যারেড",
    category: "Parade",
    tags: ["Parade", "GuardOfHonor", "Discipline", "Uniform"],
    date: "২০২৪",
    location: "কক্সবাজার সিটি কলেজ প্যারেড গ্রাউন্ড",
    isFeatured: true
  },
  {
    id: "g-2",
    url: "/assets/aistudio/dd__1__02ef1095.jpg",
    title: "সামরিক মার্চ ও স্কোয়াড ড্রিল অনুশীলন",
    category: "Training",
    tags: ["SquadDrill", "Marching", "Coordination"],
    date: "২০২৪",
    location: "কলেজ মাঠ",
    isFeatured: true
  },
  {
    id: "g-3",
    url: "/assets/aistudio/POU_7647ec14.png",
    title: "প্লাটুন কমান্ডার পিইউও উজ্জ্বল কান্তি দেব",
    category: "Ceremony",
    tags: ["Leadership", "PUO", "Commander"],
    date: "২০২৫",
    location: "প্লাটুন হেডকোয়ার্টার",
    isFeatured: true
  },
  {
    id: "g-4",
    url: "/assets/aistudio/gg__2__6f7e0545.jpeg",
    title: "ক্যাডেট সালেহা সুলতানা আঁকা — রেজিমেন্টাল ইউনিফর্ম",
    category: "Cadets",
    tags: ["Cadet", "Uniform", "Pride"],
    date: "২০২৫",
    location: "সিটি কলেজ প্লাটুন",
    isFeatured: true
  },
  {
    id: "g-5",
    url: "/assets/aistudio/gg__4__36190cf6.jpeg",
    title: "ক্যাডেট অন্বেষা বড়ুয়া আরোহী — আনুষ্ঠানিক ইউনিফর্ম",
    category: "Cadets",
    tags: ["Cadet", "Uniform", "Discipline"],
    date: "২০২৫",
    location: "সিটি কলেজ প্লাটুন",
    isFeatured: true
  },
  {
    id: "g-6",
    url: "/assets/aistudio/New_Project__2__6a6c0725.png",
    title: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর রেজিমেন্টাল ট্রাই-কালার রিবন",
    category: "Ceremony",
    tags: ["BNCC", "Flag", "Insignia"],
    date: "২০২৫",
    location: "অফিসিয়াল ব্যানার",
    isFeatured: true
  }
];
