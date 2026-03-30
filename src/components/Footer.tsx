import { Shield, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#00040a] border-t border-white/10 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-accent" />
              <span className="text-xl font-bold text-white">CBCC BNCC</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Cox's Bazar City College BNCC Platoon. Building future leaders through discipline, 
              unity, and service to the nation.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-white font-semibold uppercase tracking-wider text-sm">Contact Info</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3 text-slate-400 text-sm">
                <MapPin className="w-5 h-5 text-accent shrink-0" />
                <span>Cox's Bazar City College, Cox's Bazar, Bangladesh</span>
              </li>
              <li className="flex items-start space-x-3 text-slate-400 text-sm">
                <Phone className="w-5 h-5 text-accent shrink-0" />
                <div>
                  <p className="text-white font-medium">Platoon Commander</p>
                  <p className="text-slate-400">+880 1812-430454</p>
                  <p className="text-[10px] text-accent mt-1 uppercase tracking-wider">Urgent Inquiries Only</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-white font-semibold uppercase tracking-wider text-sm">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-slate-400 hover:text-accent transition-colors">Eligibility Criteria</a></li>
              <li><a href="#" className="text-slate-400 hover:text-accent transition-colors">Selection Process</a></li>
              <li><a href="#" className="text-slate-400 hover:text-accent transition-colors">Admin Login</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-slate-500 text-xs">
            © {new Date().getFullYear()} Cox's Bazar City College BNCC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
