import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Maximize2, X, ChevronLeft, ChevronRight,
  Filter, Camera, Download
} from "lucide-react";
import { useCMS } from "../context/CMSContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

interface MediaItem {
  id: string;
  url: string;
  title: string;
  category: "Parade" | "Training" | "Social" | "Ceremony" | "Cadets";
  tags: string[];
  date: string;
  location: string;
}

const AUTHENTIC_MEDIA: MediaItem[] = [
  {
    id: "g-1",
    url: "/assets/aistudio/dddf__1__7ebcab35.jpg",
    title: "কলেজ মাঠ পরিদর্শন ও গার্ড অব অনার প্যারেড",
    category: "Parade",
    tags: ["Parade", "GuardOfHonor", "Discipline", "Uniform"],
    date: "২০২৪",
    location: "কক্সবাজার সিটি কলেজ প্যারেড গ্রাউন্ড",
  },
  {
    id: "g-2",
    url: "/assets/aistudio/dd__1__02ef1095.jpg",
    title: "সামরিক মার্চ ও স্কোয়াড ড্রিল অনুশীলন",
    category: "Training",
    tags: ["SquadDrill", "Marching", "Coordination"],
    date: "২০২৪",
    location: "কলেজ মাঠ",
  },
  {
    id: "g-3",
    url: "/assets/aistudio/POU_7647ec14.png",
    title: "প্লাটুন কমান্ডার পিইউও উজ্জ্বল কান্তি দেব",
    category: "Ceremony",
    tags: ["Leadership", "PUO", "Commander"],
    date: "২০২৫",
    location: "প্লাটুন হেডকোয়ার্টার",
  },
  {
    id: "g-4",
    url: "/assets/aistudio/gg__2__6f7e0545.jpeg",
    title: "ক্যাডেট সালেহা সুলতানা আঁকা — রেজিমেন্টাল ইউনিফর্ম",
    category: "Cadets",
    tags: ["Cadet", "Uniform", "Pride"],
    date: "২০২৫",
    location: "সিটি কলেজ প্লাটুন",
  },
  {
    id: "g-5",
    url: "/assets/aistudio/gg__4__36190cf6.jpeg",
    title: "ক্যাডেট অন্বেষা বড়ুয়া আরোহী — আনুষ্ঠানিক ইউনিফর্ম",
    category: "Cadets",
    tags: ["Cadet", "Insignia", "Discipline"],
    date: "২০২৫",
    location: "সিটি কলেজ প্লাটুন",
  },
  {
    id: "g-6",
    url: "/assets/aistudio/gg__1__a9924232.jpg",
    title: "বাৎসরিক রেজিমেন্টাল ক্যাম্প (ATC) প্রস্তুতি",
    category: "Training",
    tags: ["Camp", "FieldCraft", "Adventure"],
    date: "২০২৪",
    location: "কর্ণফুলী রেজিমেন্ট ক্যাম্প",
  },
  {
    id: "g-7",
    url: "/assets/aistudio/gg__5__b991f0cf.jpg",
    title: "টার্গেট শুটিং ও অস্ত্র পরিচিতি ক্লাস",
    category: "Training",
    tags: ["Firing", "SmallArms", "Marksmanship"],
    date: "২০২৪",
    location: "ক্যান্টনমেন্ট ফায়ারিং রেঞ্জ",
  },
  {
    id: "g-8",
    url: "/assets/aistudio/2025__4__b991f0cf.jpg",
    title: "জাতীয় দিবস উপলক্ষে কুচকাওয়াজ সমাবেশ",
    category: "Parade",
    tags: ["NationalDay", "Ceremony", "March"],
    date: "২০২৫",
    location: "বীরশ্রেষ্ঠ রুহুল আমিন স্টেডিয়াম",
  },
  {
    id: "g-9",
    url: "/assets/aistudio/gg__3__5a59c92d.jpeg",
    title: "প্লাটুন সমাজসেবা ও স্বেচ্ছাসেবী সমাবেশ",
    category: "Social",
    tags: ["Community", "Volunteers", "Welfare"],
    date: "২০২৪",
    location: "কক্সবাজার পৌরসভা এলাকা",
  },
  {
    id: "g-10",
    url: "/assets/aistudio/2025__7__36190cf6.jpeg",
    title: "বিজয় দিবস প্যারেড পরিদর্শন ও কুচকাওয়াজ",
    category: "Ceremony",
    tags: ["VictoryDay", "Parade", "Honors"],
    date: "২০২৪",
    location: "কক্সবাজার স্টেডিয়াম",
  },
  {
    id: "g-11",
    url: "/assets/aistudio/2025__10__44904ccb.jpeg",
    title: "ক্যাডেট ব্রিফিং ও প্রশিক্ষণ সেশন",
    category: "Training",
    tags: ["Briefing", "Leadership", "Team"],
    date: "২০২৫",
    location: "প্লাটুন ক্লাসরুম",
  },
  {
    id: "g-12",
    url: "/assets/aistudio/6.3__1__9a654429.jpg",
    title: "প্লাটুন ইন-চার্জ ও সিনিয়র ক্যাডেটদের দল",
    category: "Cadets",
    tags: ["Seniors", "Unity", "Fellowship"],
    date: "২০২৪",
    location: "কক্সবাজার সিটি কলেজ",
  },
];

export function Gallery() {
  useDocumentMeta({
    title: "Photo Gallery | Cox's Bazar City College BNCC Platoon",
    description: "Official photographic archive of parade drills, firing camps, ceremonies, and cadet service.",
  });

  const cms = useCMS();
  const [filter, setFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const galleryItems = cms.gallery.length > 0 ? cms.gallery : AUTHENTIC_MEDIA;

  const filteredItems = galleryItems.filter((item) => {
    const matchesCategory = filter === "All" || item.category === filter;
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      item.title.toLowerCase().includes(term) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(term)));
    return matchesCategory && matchesSearch;
  });

  const categories = ["All", "Parade", "Training", "Cadets", "Social", "Ceremony"];

  const handleNext = () => {
    if (selectedImage !== null && filteredItems.length > 0) {
      setSelectedImage((selectedImage + 1) % filteredItems.length);
    }
  };

  const handlePrev = () => {
    if (selectedImage !== null && filteredItems.length > 0) {
      setSelectedImage((selectedImage - 1 + filteredItems.length) % filteredItems.length);
    }
  };

  useEffect(() => {
    if (selectedImage === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedImage, filteredItems.length]);

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto relative z-10 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
              <Camera size={14} />
              <span>স্মৃতি ও ইতিহাস · Photo Gallery</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white uppercase tracking-tight font-display text-balance">
              প্লাটুন <span className="text-[#C5A059]">ফটো গ্যালারি</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনের ড্রিল, বাৎসরিক ক্যাম্প, ফায়ারিং, জাতীয় দিবস এবং ক্যাডেট জীবনের স্মরণীয় মুহূর্তসমূহ।
            </p>
          </div>

          <div className="w-full md:w-72">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                aria-label="Search gallery images"
                placeholder="ছবি বা ট্যাগ খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#061830] border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Filter size={14} className="text-[#C5A059] shrink-0 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setFilter(cat);
                setSelectedImage(null);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap cursor-pointer ${
                filter === cat
                  ? "bg-[#C5A059] text-[#00152e]"
                  : "bg-[#061830] text-slate-300 hover:text-white border border-white/10"
              }`}
            >
              {cat === "All" ? "সকল ছবি" : cat}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filteredItems.length === 0 ? (
          <div className="bg-[#061830] border border-white/10 rounded-2xl p-12 text-center space-y-2">
            <Camera size={32} className="mx-auto text-[#C5A059]" />
            <h2 className="text-base font-bold text-white">কোনো ছবি পাওয়া যায়নি</h2>
            <p className="text-xs text-slate-400">ফিল্টার বা অনুসন্ধান শব্দ পরিবর্তন করে দেখুন।</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map((item, index) => (
              <motion.button
                type="button"
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
                onClick={() => setSelectedImage(index)}
                className="group relative text-left bg-[#061830] rounded-xl overflow-hidden border border-white/10 hover:border-[#C5A059]/60 transition-colors shadow-xl cursor-pointer aspect-[4/3] flex flex-col"
              >
                <img
                  src={item.url || "/assets/aistudio/dddf__1__7ebcab35.jpg"}
                  alt={item.title || "Gallery image"}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/assets/aistudio/dddf__1__7ebcab35.jpg";
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#020B18] via-[#020B18]/25 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

                <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#002147]/90 rounded-md text-[10px] font-bold uppercase text-[#C5A059] tracking-wider border border-[#C5A059]/30">
                  {item.category}
                </div>

                <div className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-[#020B18]/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 size={14} />
                </div>

                <div className="absolute bottom-3 left-3 right-3 space-y-1">
                  <h3 className="text-xs font-bold text-white group-hover:text-[#C5A059] transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span className="line-clamp-1">{item.location}</span>
                    <span className="font-mono tabular-nums shrink-0">{item.date}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Lightbox Modal */}
        <AnimatePresence>
          {selectedImage !== null && filteredItems[selectedImage] && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={filteredItems[selectedImage].title}
              className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedImage(null)}
                className="absolute inset-0 bg-black/95 backdrop-blur-md"
              />

              <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col z-10 space-y-4">
                <div className="flex items-center justify-between text-white px-2">
                  <span className="text-xs font-mono tabular-nums text-slate-300">
                    ছবি {selectedImage + 1} / {filteredItems.length}
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={filteredItems[selectedImage].url}
                      download
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      aria-label="ছবি ডাউনলোড করুন"
                    >
                      <Download size={18} />
                    </a>
                    <button
                      type="button"
                      onClick={() => setSelectedImage(null)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                      aria-label="Close lightbox"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-[#020B18] flex items-center justify-center max-h-[70vh] border border-white/15">
                  <img
                    src={filteredItems[selectedImage]?.url || "/assets/aistudio/dddf__1__7ebcab35.jpg"}
                    alt={filteredItems[selectedImage]?.title || "Gallery photo"}
                    referrerPolicy="no-referrer"
                    className="max-h-[70vh] w-auto max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/aistudio/dddf__1__7ebcab35.jpg";
                    }}
                  />

                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-[#002147]/90 text-white hover:bg-[#C5A059] hover:text-[#00152e] transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-lg bg-[#002147]/90 text-white hover:bg-[#C5A059] hover:text-[#00152e] transition-colors cursor-pointer"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-[#061830] border border-white/10 text-slate-300 space-y-1 text-xs">
                  <h4 className="text-sm font-bold text-white">
                    {filteredItems[selectedImage].title}
                  </h4>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
                    <span>
                      {filteredItems[selectedImage].category} · {filteredItems[selectedImage].location} ·{" "}
                      <span className="font-mono tabular-nums">{filteredItems[selectedImage].date}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
