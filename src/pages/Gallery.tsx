import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Image as ImageIcon, 
  Tag, 
  Search, 
  Calendar, 
  Maximize2, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Camera,
  Layers,
  Sparkles
} from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  title: string;
  category: "Training" | "Parade" | "Social" | "Ceremony";
  tags: string[];
  date: string;
  location: string;
}

const MOCK_MEDIA: MediaItem[] = [
  {
    id: "1",
    url: "https://images.unsplash.com/photo-1590218126431-72990666063b?q=80&w=1000",
    title: "Annual Parade 2024",
    category: "Parade",
    tags: ["Military", "Uniform", "Pride"],
    date: "2024-03-15",
    location: "Main Field"
  },
  {
    id: "2",
    url: "https://images.unsplash.com/photo-1544256718-3bcf237f3974?q=80&w=1000",
    title: "Weapon Training Session",
    category: "Training",
    tags: ["Safety", "Focus", "Skill"],
    date: "2024-03-20",
    location: "Range Area"
  },
  {
    id: "3",
    url: "https://images.unsplash.com/photo-1548174415-64188fa63d40?q=80&w=1000",
    title: "Platoon Social Meet",
    category: "Social",
    tags: ["Unity", "Fun", "Team"],
    date: "2024-03-25",
    location: "College Hall"
  },
  {
    id: "4",
    url: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1000",
    title: "Promotion Ceremony",
    category: "Ceremony",
    tags: ["Rank", "Honor", "Achievement"],
    date: "2024-04-01",
    location: "Auditorium"
  }
];

export function Gallery() {
  const [items, setItems] = useState<MediaItem[]>(MOCK_MEDIA);
  const [filter, setFilter] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const filteredItems = items.filter(item => {
    const matchesCategory = filter === "All" || item.category === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = ["All", "Training", "Parade", "Social", "Ceremony"];

  return (
    <div className="min-h-screen bg-bg-light pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <ImageIcon size={24} />
              <h1 className="text-sm font-black uppercase tracking-[0.2em]">Intelligence Gallery</h1>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">
              Platoon <span className="text-primary italic">Memories</span>
            </h2>
            <div className="pt-4">
              <a 
                className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all rounded-xl hover:bg-white/10 text-white bg-white/20 border border-white/10 shadow-xl group" 
                href="https://cbccbncc.netlify.app/gallery" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ImageIcon size={16} className="group-hover:rotate-12 transition-transform" />
                Visit Official Web Gallery
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search by event or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-surface border border-white/5 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-primary transition-all outline-none min-w-[280px] shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                filter === cat 
                  ? "bg-primary text-white shadow-lg shadow-primary/30" 
                  : "bg-surface text-slate-500 hover:text-slate-300 border border-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-[4/5] rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl cursor-pointer"
                onClick={() => setSelectedImage(index)}
              >
                <img 
                  src={item.url} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
                
                {/* Watermark/Meta */}
                <div className="absolute top-4 left-4 p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 opacity-40 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] font-black uppercase tracking-tighter text-white">BNCC PLATOON PROPERTY</p>
                </div>

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-primary/20 text-primary border border-primary/20 rounded text-[8px] font-black uppercase tracking-widest">
                      {item.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Calendar size={10} /> {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white leading-tight group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <div className="flex flex-wrap gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    {item.tags.map(tag => (
                      <span key={tag} className="text-[8px] font-bold text-slate-500 uppercase">#{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="absolute top-4 right-4 p-3 bg-white/10 backdrop-blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                  <Maximize2 className="text-white" size={20} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredItems.length === 0 && (
          <div className="py-40 text-center">
            <ImageIcon className="mx-auto text-slate-800 mb-6" size={80} />
            <h3 className="text-2xl font-black text-slate-700 uppercase italic">Intelligence Gap Found</h3>
            <p className="text-slate-500 text-sm mt-2">No results matching your specific reconnaissance parameters.</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage !== null && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl">
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedImage(null)}
              className="absolute top-10 right-10 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all z-[110]"
            >
              <X size={32} />
            </motion.button>

            <motion.button
              onClick={() => setSelectedImage(prev => prev === null ? null : (prev - 1 + filteredItems.length) % filteredItems.length)}
              className="absolute left-10 p-4 text-white/20 hover:text-white transition-colors"
            >
              <ChevronLeft size={64} />
            </motion.button>

            <motion.button
              onClick={() => setSelectedImage(prev => prev === null ? null : (prev + 1) % filteredItems.length)}
              className="absolute right-10 p-4 text-white/20 hover:text-white transition-colors"
            >
              <ChevronRight size={64} />
            </motion.button>

            <div className="relative w-full max-w-5xl aspect-video p-4">
              <motion.img 
                key={filteredItems[selectedImage].id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                src={filteredItems[selectedImage].url} 
                alt=""
                className="w-full h-full object-contain rounded-3xl"
              />
              
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-8 text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                    {filteredItems[selectedImage].category}
                  </span>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                    {filteredItems[selectedImage].location} — {new Date(filteredItems[selectedImage].date).toLocaleDateString()}
                  </p>
                </div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                  {filteredItems[selectedImage].title}
                </h2>
              </motion.div>

              {/* Secure Watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] select-none text-white whitespace-nowrap rotate-[-30deg]">
                <p className="text-9xl font-black uppercase tracking-[0.5em]">BNCC CONFIDENTIAL</p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
