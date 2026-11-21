export interface InchargeRecord {
  batch: string;
  name: string;
  banglaName?: string;
  rankBadgeUrl: string;
  rankTitle: string;
  photoUrl: string;
  coPhotoUrl?: string;
  term?: string;
  awards?: string;
  bio?: string;
}

export const INCHARGES_DATA: InchargeRecord[] = [
  {
    batch: "Batch 1",
    name: "Nomanul Islam Saimon",
    banglaName: "নোমানুল ইসলাম সাইমন",
    rankBadgeUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/A_CUO.png",
    rankTitle: "Cadet Under Officer (CUO)",
    photoUrl: "https://i.ibb.co/m8rYjJx/274856261-1655184164824692-8057334507379742892-n.jpg",
    term: "Inaugural Batch",
    awards: "Founding Platoon In-Charge",
    bio: "Pioneered the establishment of Cox's Bazar City College BNCC Platoon under Karnaphuli Regiment."
  },
  {
    batch: "Batch 2",
    name: "Waliul Islam Azan",
    banglaName: "ওয়ালিউল ইসলাম আজান",
    rankBadgeUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/A_CUO.png",
    rankTitle: "Cadet Under Officer (CUO)",
    photoUrl: "https://i.ibb.co/mGx3CWW/454425731-1865516033934342-5355007169042337456-n.jpg",
    term: "2021 – 2022",
    awards: "Best Cadet Award",
    bio: "Recognized as Best Cadet across battalion events, setting an exemplary benchmark in drill and leadership."
  },
  {
    batch: "Batch 3",
    name: "Mehenaj Mahu",
    banglaName: "মেহনাজ মাহু",
    rankBadgeUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/A_SGT.png",
    rankTitle: "Cadet Sergeant",
    photoUrl: "https://i.ibb.co/MpXXtK5/387735944-1684451718707442-3020994251185180456-n-1.jpg",
    term: "2022 – 2023",
    awards: "Distinguished Service Ribbon",
    bio: "Exemplary female cadet leader who steered the platoon through major regional disaster relief and camps."
  },
  {
    batch: "Batch 4",
    name: "Sajon Dey & Rabi Ullah",
    banglaName: "সজন দে এবং রবি উল্লাহ",
    rankBadgeUrl: "https://upload.wikimedia.org/wikipedia/commons/7/73/A_CPL.png",
    rankTitle: "Cadet Corporals (Co-In-Charges)",
    photoUrl: "/assets/aistudio/sajon_5c6a8944.jpg",
    coPhotoUrl: "/assets/aistudio/RABIUL_4437dc09.jpg",
    term: "2023 – 2024",
    awards: "Outstanding Platoon Performance Award",
    bio: "Dual leadership team that elevated platoon discipline, shooting accuracy, and regiment parade representation."
  },
  {
    batch: "Batch 5",
    name: "Wazed Hoque Tasin & M R Kader",
    banglaName: "ওয়াজেদ হক তাসিন এবং এম আর কাদের",
    rankBadgeUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/A_SGT.png",
    rankTitle: "Cadet Lance Corporal / Cadet Sergeant",
    photoUrl: "/assets/aistudio/Kader_d91adfab.jpg",
    coPhotoUrl: "/assets/aistudio/TASIN_12f42ea3.jpg",
    term: "Tasin (Mar – Oct 2025) | Kader (Oct 2025 – Present)",
    awards: "Leadership Medal & Platoon In-Charge Appointment",
    bio: "Current leadership governing the modern automated enrollment system, annual training, and cadet excellence."
  }
];

export const PLATOON_COMMANDER = {
  name: "Ujjwal Kanti Deb",
  banglaName: "উজ্জ্বল কান্তি দেব",
  rank: "Professor Under Officer (PUO)",
  designation: "Platoon Commander",
  institution: "Cox's Bazar City College BNCC Platoon",
  regiment: "Karnaphuli Regiment (15 BNCC Battalion)",
  photoUrl: "/assets/aistudio/POU_7647ec14.png",
  phone: "+880 1812-430454",
  email: "puo.cbccbncc@gmail.com",
  message: "বিএনসিসি ক্যাডেটদের মধ্যে দেশপ্রেম, সামরিক শৃঙ্খলা, নেতৃত্ব ও নিঃস্বার্থ আত্মত্যাগের মহৎ গুণাবলি জাগ্রত করে। কক্সবাজার সিটি কলেজ প্লাটুনের প্রতিটি ক্যাডেট জাতির অতন্দ্র প্রহরী হিসেবে গড়ে উঠছে।"
};
