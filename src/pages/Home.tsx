import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle, Users, Award, ShieldCheck, ArrowRight, Info, FileText, Activity, Phone, Target, Zap, Globe } from "lucide-react";

export function Home() {
  return (
    <div className="pb-24">
      {/* Hero Section - Editorial Style */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-ink">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent z-10" />
          <motion.img 
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            transition={{ duration: 2 }}
            src="https://images.unsplash.com/photo-1590233728108-644917409f56?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover"
            alt="BNCC Background"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-4 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-8 space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-px w-12 bg-primary" />
                  <span className="micro-label !text-white/60">Official Enrollment Portal 2026</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-black text-white leading-[0.9] font-montserrat uppercase">
                  Duty <br />
                  <span className="text-primary">Discipline</span> <br />
                  Unity
                </h1>
              </motion.div>

              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-xl text-white/60 max-w-xl font-light leading-relaxed"
              >
                Join the Bangladesh National Cadet Corps. Develop leadership, character, and discipline while serving the nation.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="flex flex-wrap gap-4"
              >
                <Link
                  to="/enroll"
                  className="px-10 py-5 bg-primary text-white font-black uppercase tracking-widest rounded-sm btn-hover flex items-center gap-3"
                >
                  Apply Now <ArrowRight size={20} />
                </Link>
                <a
                  href="#about"
                  className="px-10 py-5 border border-white/20 text-white font-black uppercase tracking-widest rounded-sm hover:bg-white/10 transition-all"
                >
                  Explore More
                </a>
              </motion.div>
            </div>

            <div className="hidden lg:block lg:col-span-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, duration: 1 }}
                className="relative aspect-square military-border p-8 flex flex-col justify-center items-center text-center space-y-6 bg-white/5 backdrop-blur-sm"
              >
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary" />
                
                <Globe className="w-16 h-16 text-primary animate-pulse" />
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Global Standards</h3>
                <p className="text-white/40 text-sm font-mono">Training future leaders with international military protocols and discipline.</p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="w-px h-20 bg-gradient-to-b from-primary to-transparent" />
        </motion.div>
      </section>

      {/* Stats Section - Technical Style */}
      <section className="bg-paper py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "Active Cadets", value: "450+", icon: Users },
              { label: "Training Hours", value: "1200+", icon: Activity },
              { label: "Awards Won", value: "85+", icon: Award },
              { label: "Platoons", value: "12", icon: Target },
            ].map((stat, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <stat.icon size={16} className="text-primary" />
                  <span className="micro-label">{stat.label}</span>
                </div>
                <p className="text-5xl font-black text-ink font-mono">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values - Split Layout */}
      <section id="about" className="max-w-7xl mx-auto px-4 py-24 border-t border-ink/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="space-y-8">
            <span className="micro-label">Our Core Mission</span>
            <h2 className="text-5xl md:text-7xl font-black text-ink leading-none uppercase">
              Building the <br />
              <span className="text-primary">Next Generation</span> <br />
              of Leaders
            </h2>
            <p className="text-xl text-ink/60 leading-relaxed font-light">
              We provide a platform for students to develop their physical and mental capabilities, fostering a sense of responsibility and patriotism.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8">
              {[
                { title: "Leadership", desc: "Training to lead with integrity and courage." },
                { title: "Discipline", desc: "Instilling a sense of order and punctuality." },
                { title: "Service", desc: "Commitment to serving the community and nation." },
                { title: "Excellence", desc: "Striving for the highest standards in all tasks." },
              ].map((val, i) => (
                <div key={i} className="space-y-2">
                  <h4 className="font-black text-ink uppercase tracking-tight">{val.title}</h4>
                  <p className="text-sm text-ink/40">{val.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] military-border overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1590233728108-644917409f56?q=80&w=2070&auto=format&fit=crop" 
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                alt="Training"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-primary/10 -z-10" />
            <div className="absolute -top-12 -right-12 w-64 h-64 border border-primary/20 -z-10" />
          </div>
        </div>
      </section>

      {/* Eligibility Section - Clean Grid */}
      <section className="bg-ink text-white py-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-24">
            <div className="space-y-4">
              <span className="micro-label !text-white/40">Requirements</span>
              <h2 className="text-5xl font-black uppercase leading-none">Who Can <br /> <span className="text-primary">Join Us?</span></h2>
            </div>
            <p className="text-white/40 max-w-sm text-sm font-mono">Ensure you meet the following criteria before starting your application process.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
            {[
              { icon: Users, title: "Academic", desc: "Regular student of Class XI or 1st Year Honors/Degree." },
              { icon: Award, title: "Merit", desc: "Minimum GPA 3.00 in SSC or equivalent examination." },
              { icon: ShieldCheck, title: "Status", desc: "Must be unmarried and physically fit for training." }
            ].map((item, i) => (
              <div key={i} className="bg-ink p-12 space-y-6 hover:bg-white/5 transition-colors group">
                <item.icon className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                <h3 className="text-2xl font-black uppercase tracking-tight">{item.title}</h3>
                <p className="text-white/40 leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Physical Standards - Technical Table */}
      <section className="max-w-7xl mx-auto px-4 py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-24">
          <div className="lg:col-span-4 space-y-6">
            <span className="micro-label">Physical Standards</span>
            <h2 className="text-4xl font-black uppercase leading-tight">Minimum <br /> Requirements</h2>
            <p className="text-ink/60 font-light">Candidates must meet these physical benchmarks to be eligible for the selection process.</p>
            <div className="pt-8">
              <div className="p-6 bg-primary/5 border-l-4 border-primary space-y-2">
                <Zap size={20} className="text-primary" />
                <p className="text-sm font-bold uppercase tracking-tight">Important Note</p>
                <p className="text-xs text-ink/60">Physical tests will be conducted at the college ground. Bring sports attire.</p>
              </div>
            </div>
          </div>
          <div className="lg:col-span-8">
            <div className="overflow-hidden border border-ink/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ink text-white">
                    <th className="p-6 text-[10px] uppercase tracking-widest font-black">Criteria</th>
                    <th className="p-6 text-[10px] uppercase tracking-widest font-black">Male</th>
                    <th className="p-6 text-[10px] uppercase tracking-widest font-black">Female</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {[
                    { label: "Height (Min)", male: "5' 6\"", female: "5' 2\"" },
                    { label: "Chest (Normal)", male: "30\"", female: "N/A" },
                    { label: "Chest (Expanded)", male: "32\"", female: "N/A" },
                    { label: "Weight", male: "Proportional", female: "Proportional" },
                  ].map((row, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                      <td className="p-6 font-black uppercase text-sm tracking-tight">{row.label}</td>
                      <td className="p-6 font-mono text-sm text-ink/60">{row.male}</td>
                      <td className="p-6 font-mono text-sm text-ink/60">{row.female}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="max-w-7xl mx-auto px-4 pb-32">
        <div className="bg-primary p-12 md:p-24 rounded-sm flex flex-col md:flex-row items-center justify-between gap-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10 space-y-4">
            <h2 className="text-4xl md:text-6xl font-black text-white uppercase leading-none">Ready to <br /> Serve?</h2>
            <p className="text-white/60 font-light max-w-md">Start your journey today. Applications for the 2026 session are now open.</p>
          </div>
          <div className="relative z-10 flex flex-col items-center md:items-end gap-4">
            <Link
              to="/enroll"
              className="px-12 py-6 bg-white text-primary font-black uppercase tracking-widest rounded-sm hover:bg-paper transition-all shadow-2xl"
            >
              Start Application
            </Link>
            <div className="flex items-center gap-3 text-white/60">
              <Phone size={16} />
              <span className="font-mono text-sm tracking-tighter">+880 1812-430454</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
