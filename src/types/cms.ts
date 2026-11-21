/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CMSContentItem {
  id: string;               // e.g. "home.hero.title", "footer.address"
  page: string;             // e.g. "Home", "About", "Cadets", "Contact", "Global"
  section: string;          // e.g. "Hero", "Stats", "Commander", "Header", "Footer"
  field: string;            // e.g. "Title", "Subtitle", "Button Label", "Address"
  content: string;          // Main text (Bengali or default)
  contentEn?: string;        // Optional English variant
  defaultValue: string;     // Default fallback
  language: "bn" | "en" | "both";
  lastModified: string;
  modifiedBy: string;
  status: "published" | "draft";
}

export interface CMSSectionConfig {
  id: string;
  name: string;
  page: string;
  order: number;
  enabled: boolean;
  title: string;
  subtitle?: string;
  customData?: Record<string, any>;
}

export interface CMSCadetProfile {
  id: string;
  name: string;
  banglaName?: string;
  cadetNumber: string;
  rank: "Cadet" | "Lance Corporal" | "Corporal" | "Sergeant" | "CUO" | "In-Charge";
  rankFull: string;
  batch: string; // "2023", "2024", "2025", "2026", etc.
  department: string;
  institution: string;
  fatherName?: string;
  motherName?: string;
  bloodGroup?: string;
  photo: string;
  joinDate?: string;
  district?: string;
  contact?: string;
  email?: string;
  role?: string;
  bio?: string;
  status: "Active" | "Alumni" | "Senior Cadet" | "Officer" | "In-Charge";
  isFeatured?: boolean;
  achievements?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CMSInchargeRecord {
  id: string;
  batch: string; // e.g. "Batch 1", "Batch 5"
  name: string;
  banglaName?: string;
  rankBadgeUrl: string;
  rankTitle: string;
  photoUrl: string;
  coPhotoUrl?: string;
  term?: string;
  awards?: string;
  bio?: string;
  order: number;
  isCurrent?: boolean;
}

export interface CMSCommanderProfile {
  name: string;
  banglaName: string;
  rank: string;
  designation: string;
  institution: string;
  regiment: string;
  photoUrl: string;
  phone: string;
  email: string;
  message: string;
}

export interface CMSNoticeItem {
  id: string;
  refNumber: string;
  title: string;
  titleEnglish?: string;
  category: "Recruitment" | "Parade" | "Training" | "Orders" | "Welfare" | "Emergency" | "Exam" | "General";
  publishDate: string;
  isImportant?: boolean;
  status: "Active" | "Archived";
  content: string;
  summary: string;
  signedBy: string;
  designation: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isPinned?: boolean;
}

export interface CMSActivityItem {
  id: string;
  title: string;
  banglaTitle?: string;
  category: string;
  desc: string;
  tags: string[];
  image: string;
  date?: string;
  location?: string;
  participantsCount?: string;
  isFeatured?: boolean;
}

export interface CMSGalleryMediaItem {
  id: string;
  url: string;
  title: string;
  category: "Parade" | "Training" | "Social" | "Ceremony" | "Cadets";
  tags: string[];
  date: string;
  location: string;
  isFeatured?: boolean;
}

export interface CMSSiteSettings {
  siteTitle: string;
  siteTitleEn: string;
  organizationName: string;
  regimentInfo: string;
  motto: string;
  mottoEn: string;
  primaryColor: string;
  accentColor: string;
  collegeLogoUrl: string;
  bnccLogoUrl: string;
  ribbonBannerUrl: string;
  contactPhone: string;
  contactEmail: string;
  emergencyPhone: string;
  address: string;
  collegeWebsite: string;
  bnccCentralWebsite: string;
  facebookPage: string;
  youtubeChannel: string;
  noticeTickerEnabled: boolean;
  noticeTickerSpeed: number;
  enrollmentOpen: boolean;
  offlineFormOpen: boolean;
  examPortalOpen: boolean;
  lastUpdated: string;
  updatedBy: string;
}

export interface CMSBackupData {
  version: string;
  exportedAt: string;
  exportedBy: string;
  settings: CMSSiteSettings;
  contentItems: CMSContentItem[];
  sections: CMSSectionConfig[];
  cadets: CMSCadetProfile[];
  incharges: CMSInchargeRecord[];
  commander: CMSCommanderProfile;
  notices: CMSNoticeItem[];
  activities: CMSActivityItem[];
  gallery: CMSGalleryMediaItem[];
}
