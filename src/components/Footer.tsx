import { Shield, Phone, MapPin, Globe, Facebook, Twitter, Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="bg-ink text-white pt-24 pb-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
          {/* Brand Section */}
          <div className="md:col-span-4 space-y-8">
            <div className="flex items-center gap-6">
              <a href="https://cbcc.edu.bd/" target="_blank" rel="noopener noreferrer">
                <img 
                  src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
                  alt="Cox's Bazar City College Logo" 
                  className="h-12 w-auto grayscale brightness-200 hover:grayscale-0 transition-all"
                  referrerPolicy="no-referrer"
                />
              </a>
              <a href="https://bncc.info/" target="_blank" rel="noopener noreferrer">
                <img 
                  src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
                  alt="BNCC Logo" 
                  className="h-12 w-auto grayscale brightness-200 hover:grayscale-0 transition-all"
                  referrerPolicy="no-referrer"
                />
              </a>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter leading-none font-montserrat">BNCC PLATOON</span>
              <span className="micro-label !text-white/40 !text-[8px] mt-1">Cox's Bazar City College</span>
            </div>
            <p className="text-white/40 text-sm leading-relaxed font-light max-w-xs">
              Building future leaders through discipline, unity, and service to the nation. The premier youth organization of Bangladesh.
            </p>
            <div className="flex items-center gap-4">
              {[Facebook, Twitter, Instagram, Mail].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-sm border border-white/10 flex items-center justify-center hover:bg-primary hover:border-primary transition-all group">
                  <Icon size={18} className="text-white/40 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Section */}
          <div className="md:col-span-2 space-y-6">
            <h3 className="micro-label !text-white/60">Navigation</h3>
            <ul className="space-y-4">
              {["Home", "Enrollment", "About Us", "Gallery", "Contact"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-white/40 hover:text-primary transition-colors font-medium">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2 space-y-6">
            <h3 className="micro-label !text-white/60">Resources</h3>
            <ul className="space-y-4">
              {["Eligibility", "Selection Process", "Training Manual", "Admin Portal", "FAQ"].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-white/40 hover:text-primary transition-colors font-medium">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Section */}
          <div className="md:col-span-4 space-y-6">
            <h3 className="micro-label !text-white/60">Headquarters</h3>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="text-primary shrink-0" size={20} />
                <p className="text-sm text-white/40 leading-relaxed font-light">
                  Cox's Bazar City College, <br />
                  Cox's Bazar, Bangladesh
                </p>
              </div>
              <div className="flex items-start gap-4">
                <Phone className="text-primary shrink-0" size={20} />
                <div className="space-y-1">
                  <p className="text-sm text-white font-bold tracking-tight">+880 1812-430454</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Platoon Commander</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Globe className="text-primary shrink-0" size={20} />
                <a href="https://bncc.info" target="_blank" className="text-sm text-white/40 hover:text-primary transition-colors font-medium">www.bncc.info</a>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-white/20 text-[10px] font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} BNCC Platoon. All rights reserved.
          </p>
          <div className="flex items-center gap-8">
            <a href="#" className="text-[10px] text-white/20 hover:text-white transition-colors uppercase tracking-widest font-mono">Privacy Policy</a>
            <a href="#" className="text-[10px] text-white/20 hover:text-white transition-colors uppercase tracking-widest font-mono">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
