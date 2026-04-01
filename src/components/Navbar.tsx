import { Link, useLocation } from "react-router-dom";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { name: "Home", path: "/" },
    { name: "Apply Now", path: "/enroll" },
    { name: "Admin", path: "/admin" },
    { name: "Admin 2", path: "/admin2" },
  ];

  return (
    <nav className="sticky top-0 z-50 glass border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <a href="https://cbcc.edu.bd/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img 
                src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                alt="College Logo" 
                className="h-12 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
            <Link to="/" className="flex flex-col">
              <span className="text-slate-900 font-bold text-lg tracking-tight leading-none font-display">Cox's Bazar City College</span>
              <span className="text-[10px] text-primary uppercase tracking-widest font-semibold">BNCC Platoon Enrollment</span>
            </Link>
            <a href="https://bncc.info/" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img 
                src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                alt="BNCC Logo" 
                className="h-12 w-auto"
                referrerPolicy="no-referrer"
              />
            </a>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === link.path ? "text-primary" : "text-slate-600"
                }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/enroll"
              className="px-5 py-2 bg-primary text-white font-bold rounded-full text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Apply Now
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-600 hover:text-primary"
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass border-t border-slate-200 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-4 text-base font-medium text-slate-600 hover:text-primary border-b border-slate-100"
                >
                  {link.name}
                </Link>
              ))}
              <Link
                to="/enroll"
                onClick={() => setIsOpen(false)}
                className="block px-3 py-4 text-base font-bold text-primary"
              >
                Apply Now
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
