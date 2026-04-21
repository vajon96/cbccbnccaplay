import { Shield, Phone, MapPin, Globe, Facebook, Twitter, Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="relative bg-slate-950 text-white pt-32 pb-12 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 blur-[120px] rounded-full translate-y-1/2" />
      
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          {/* Brand Section */}
          <div className="lg:col-span-4 space-y-10">
            <div className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm w-fit shadow-2xl">
              <a href="https://cbcc.edu.bd/" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105 active:scale-95">
                <img 
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                  alt="Cox's Bazar City College Logo" 
                  className="h-10 w-auto brightness-110"
                  referrerPolicy="no-referrer"
                />
              </a>
              <div className="w-px h-8 bg-white/10" />
              <a href="https://bncc.info/" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105 active:scale-95">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="BNCC Logo" 
                  className="h-10 w-auto brightness-110"
                  referrerPolicy="no-referrer"
                />
              </a>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-3xl font-extrabold tracking-tighter leading-none font-montserrat bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">BNCC PLATOON</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="h-px w-6 bg-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cox's Bazar City College</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                Building future leaders through discipline, unity, and service to the nation. The premier youth organization of Bangladesh, fostering character and selfless service.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Instagram, Mail].map((Icon, i) => (
                <a 
                  key={i} 
                  href="#" 
                  className="w-11 h-11 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center hover:bg-primary transition-all duration-300 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] group active:scale-90"
                >
                  <Icon size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Section */}
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-6">
              <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(220,38,38,1)]" />
                Navigation
              </h3>
              <ul className="space-y-3">
                {["Home", "Enrollment", "About Us", "Gallery", "Contact"].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-[13px] text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-2 h-px bg-primary transition-all" />
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-6">
              <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(220,38,38,1)]" />
                Resources
              </h3>
              <ul className="space-y-3">
                {["Eligibility", "Selection Process", "Training Manual", "Admin Portal", "FAQ"].map((link) => (
                  <li key={link}>
                    <a href="#" className="text-[13px] text-slate-500 hover:text-white transition-colors flex items-center gap-2 group">
                      <span className="w-0 group-hover:w-2 h-px bg-primary transition-all" />
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Contact Section */}
          <div className="lg:col-span-4 space-y-8">
            <h3 className="text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(220,38,38,1)]" />
              Contact Us
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Headquarters</h4>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      Cox's Bazar City College, <br />
                      Cox's Bazar, Bangladesh
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <Phone size={18} />
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Phone Enquiries</h4>
                    <p className="text-sm text-white font-bold tracking-tight">+880 1812-430454</p>
                    <p className="text-[9px] text-primary font-bold uppercase tracking-widest mt-0.5">Platoon Commander</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                    <Globe size={18} />
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-1">Web Presence</h4>
                    <a href="https://bncc.info" target="_blank" className="text-xs text-slate-300 hover:text-white transition-colors font-bold underline underline-offset-4 decoration-primary/30">www.bncc.info</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-24 pt-12 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">
              © {new Date().getFullYear()} BNCC Platoon. All rights reserved.
            </p>
            <p className="text-[9px] text-slate-600 font-medium">Developed for Cox's Bazar City College Platoon</p>
          </div>
          
          <div className="flex items-center gap-10">
            <a href="#" className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-black">Privacy Policy</a>
            <div className="w-1 h-1 bg-slate-800 rounded-full" />
            <a href="#" className="text-[10px] text-slate-500 hover:text-white transition-colors uppercase tracking-widest font-black">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
