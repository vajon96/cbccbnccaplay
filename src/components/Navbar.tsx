import { Link, useLocation } from "react-router-dom";
import { 
  Shield, Menu, X, Home, Info, Activity, Users, 
  Image as ImageIcon, Mail, Medal, UserCheck, 
  UserPlus, MessageCircle, LogIn 
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "Main Website", path: "/", icon: Home },
    { name: "About", path: "/about", icon: Info },
    { name: "Activities", path: "/activities", icon: Activity },
    { name: "Cadets", path: "/cadets", icon: Users },
    { name: "Gallery", path: "/gallery", icon: ImageIcon },
    { name: "Contact", path: "/contact", icon: Mail },
    { name: "Hall of In-Charges", path: "/hall-of-incharges", icon: Medal },
    { name: "How to Join", path: "/how-to-become-cadet", icon: UserCheck },
  ];

  const authLinks = [
    { name: "Messenger", path: "/messenger", icon: MessageCircle },
    { name: "Login", path: "/login", icon: LogIn },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-primary border-b border-primary/20 shadow-lg">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-3 shrink-0">
            {/* ... logos remain same ... */}
            <a href="https://cbcc.edu.bd/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img 
                src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                alt="Cox's Bazar City College Logo" 
                className="h-10 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
            <Link to="/" className="flex flex-col hidden sm:flex">
              <span className="text-sand font-bold text-sm tracking-tight leading-none font-display">Cox's Bazar City College</span>
              <span className="text-[9px] text-sand/80 uppercase tracking-widest font-semibold mt-1">BNCC Platoon</span>
            </Link>
            <a href="https://bncc.info/" target="_blank" rel="noopener noreferrer" className="shrink-0 border-l border-white/20 pl-3 ml-1">
              <img 
                src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                alt="BNCC Logo" 
                className="h-10 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Desktop Nav */}
          <div className="hidden xl:flex items-center space-x-1">
            <div className="flex items-center border-r border-white/10 pr-4 mr-4 space-x-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-3 py-2 text-[11px] font-black uppercase tracking-wider transition-all rounded-lg hover:bg-white/10 ${
                    location.pathname === link.path ? "text-white bg-white/20" : "text-sand/70 hover:text-white"
                  }`}
                >
                  <link.icon size={14} className={location.pathname === link.path ? "text-white" : "text-sand/40"} />
                  {link.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center space-x-4">
              {authLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex items-center gap-2 text-sand/70 hover:text-white text-[11px] font-black uppercase tracking-[0.15em] transition-all"
                >
                  <link.icon size={16} className="text-white" />
                  {link.name}
                </Link>
              ))}
              <Link
                to="/enroll"
                className="ml-4 px-6 py-2 bg-white text-primary font-black uppercase tracking-widest text-[11px] rounded-full hover:bg-sand transition-all shadow-xl shadow-black/20 flex items-center gap-2 group"
              >
                <UserPlus size={14} className="group-hover:scale-110 transition-transform" />
                Join Us
              </Link>
            </div>
          </div>

          {/* Mobile/Tablet Menu Button */}
          <div className="xl:hidden flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
              {authLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                  title={link.name}
                >
                  <link.icon size={18} />
                </Link>
              ))}
            </div>
            <Link
              to="/enroll"
              className="px-4 py-2 bg-white text-primary font-black uppercase tracking-widest text-[10px] rounded-full shadow-lg"
            >
              Join
            </Link>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-sand hover:text-white ring-1 ring-white/10 rounded-lg"
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full sm:w-80 bg-primary z-[60] shadow-2xl flex flex-col xl:hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <span className="text-sand font-black uppercase tracking-[0.2em] text-xs">Command Center</span>
              <button onClick={() => setIsOpen(false)} className="p-2 text-sand hover:text-white ring-1 ring-white/10 rounded-lg">
                <X />
              </button>
            </div>
            
            <div className="flex-grow overflow-y-auto pt-4 pb-12 px-4 space-y-2 no-scrollbar">
              <div className="grid grid-cols-2 gap-2 mb-8">
                {authLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 text-sand hover:bg-white/10 hover:text-white transition-all"
                  >
                    <link.icon size={20} className="text-white" />
                    <span className="font-extrabold text-[10px] uppercase tracking-widest">{link.name}</span>
                  </Link>
                ))}
              </div>

              <div className="space-y-1">
                <span className="block px-4 py-2 text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Quick Navigation</span>
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${
                      location.pathname === link.path 
                        ? "bg-white/20 text-white shadow-inner" 
                        : "text-sand/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      location.pathname === link.path ? "bg-white text-primary shadow-lg" : "bg-white/5"
                    }`}>
                      <link.icon size={18} />
                    </div>
                    <span className="font-bold text-xs uppercase tracking-wide">{link.name}</span>
                  </Link>
                ))}
              </div>
              
              <div className="pt-8 px-2">
                <Link
                  to="/enroll"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-3 w-full py-5 bg-white text-primary font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-2xl shadow-black/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <UserPlus size={18} />
                  Join the Platoon
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Backdrop for Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] xl:hidden"
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
