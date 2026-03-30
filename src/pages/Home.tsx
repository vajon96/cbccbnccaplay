import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle, Users, Award, ShieldCheck, ArrowRight, Info, FileText, Activity, Phone } from "lucide-react";

export function Home() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/95 to-[#000814] z-10" />
          <img 
            src="https://picsum.photos/seed/bncc/1920/1080?blur=2" 
            className="w-full h-full object-cover"
            alt="BNCC Background"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="relative z-20 max-w-5xl mx-auto px-4 text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-[0.2em]">
              Bangladesh National Cadet Corps
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight">
              বাংলাদেশ ন্যাশনাল ক্যাডেট কোর <br />
              <span className="text-gradient">(BNCC)</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
              দেশপ্রেম ও শৃঙ্খলা
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <Link
              to="/enroll"
              className="group px-8 py-4 bg-accent text-primary font-bold rounded-xl flex items-center gap-2 hover:bg-white transition-all transform hover:scale-105"
            >
              আবেদন করুন <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#eligibility"
              className="px-8 py-4 glass text-white font-bold rounded-xl hover:bg-white/10 transition-all"
            >
              বিস্তারিত জানুন
            </a>
          </motion.div>
        </div>
      </section>

      {/* Eligibility Section */}
      <section id="eligibility" className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">ভর্তির যোগ্যতা ও শর্তাবলী</h2>
          <div className="w-24 h-1 bg-accent mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: "শিক্ষাগত যোগ্যতা", desc: "একাদশ শ্রেণি অথবা স্নাতক (সম্মান) ১ম বর্ষের নিয়মিত শিক্ষার্থী হতে হবে।" },
            { icon: Award, title: "ফলাফল", desc: "এসএসসি বা সমমান পরীক্ষায় ন্যূনতম জিপিএ ৩.০০ থাকতে হবে।" },
            { icon: ShieldCheck, title: "অন্যান্য", desc: "অবিবাহিত হতে হবে এবং সুস্বাস্থ্যের অধিকারী হতে হবে।" }
          ].map((item, i) => (
            <motion.div
              key={i}
              whileHover={{ y: -10 }}
              className="glass-card p-8 rounded-3xl space-y-4"
            >
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center">
                <item.icon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Physical Standards */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="glass-card rounded-[2rem] overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 space-y-8">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-accent" />
                <h2 className="text-3xl font-bold text-white">শারীরিক মানদণ্ড</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="py-4 text-accent font-semibold">বিবরণ</th>
                      <th className="py-4 text-accent font-semibold">পুরুষ</th>
                      <th className="py-4 text-accent font-semibold">মহিলা</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-white/5">
                      <td className="py-4">উচ্চতা (ন্যূনতম)</td>
                      <td className="py-4">৫ ফুট ৬ ইঞ্চি</td>
                      <td className="py-4">৫ ফুট ২ ইঞ্চি</td>
                    </tr>
                    <tr className="border-b border-white/5">
                      <td className="py-4">বুক (স্বাভাবিক)</td>
                      <td className="py-4">৩০ ইঞ্চি</td>
                      <td className="py-4">N/A</td>
                    </tr>
                    <tr>
                      <td className="py-4">বুক (প্রসারিত)</td>
                      <td className="py-4">৩২ ইঞ্চি</td>
                      <td className="py-4">N/A</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-accent/5 p-12 flex items-center justify-center">
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-white">প্রয়োজনীয় কাগজপত্র</h3>
                <ul className="space-y-4">
                  {[
                    "এসএসসি ও এইচএসসি সনদপত্র, নম্বরপত্র, প্রশংসাপত্র – ২ কপি করে ফটোকপি",
                    "কলেজ ভর্তির রশিদ/OK Wallet প্রিন্ট কপি",
                    "পাসপোর্ট সাইজ ছবি – ২ কপি",
                    "ব্লাড গ্রুপ রিপোর্টের ফটোকপি – ২ কপি",
                    "জাতীয় পরিচয়পত্র/জন্ম নিবন্ধনের ফটোকপি",
                    "পিতামাতার জাতীয় পরিচয়পত্রের ফটোকপি"
                  ].map((doc, i) => (
                    <li key={i} className="flex items-center gap-3 text-slate-300">
                      <CheckCircle className="w-5 h-5 text-accent shrink-0" />
                      <span className="text-sm">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Selection Process */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">নির্বাচন প্রক্রিয়া</h2>
          <div className="w-24 h-1 bg-accent mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "০১", title: "অনলাইন আবেদন", icon: FileText },
            { step: "০২", title: "শারীরিক পরীক্ষা", icon: Activity },
            { step: "০৩", title: "লিখিত পরীক্ষা", icon: Info },
            { step: "০৪", title: "চূড়ান্ত ভাইভা", icon: Users }
          ].map((item, i) => (
            <div key={i} className="relative p-8 glass rounded-2xl text-center space-y-4">
              <span className="absolute top-4 right-4 text-4xl font-black text-white/5">{item.step}</span>
              <div className="w-12 h-12 bg-accent text-primary rounded-full flex items-center justify-center mx-auto">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="glass-card p-12 rounded-[2rem] bg-gradient-to-br from-accent/10 to-transparent">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-white mb-8">বিএনসিসি ক্যাডেট হওয়ার সুবিধাসমূহ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                "সেনা, নৌ ও বিমান বাহিনীতে যোগদানে অগ্রাধিকার",
                "আইএসএসবি (ISSB) পরীক্ষায় বিশেষ সুবিধা",
                "বিনামূল্যে সামরিক প্রশিক্ষণ ও ইউনিফর্ম",
                "সরকারি চাকরিতে কোটা সুবিধা",
                "বিদেশ ভ্রমণের সুযোগ (ক্যাডেট এক্সচেঞ্জ প্রোগ্রাম)",
                "নেতৃত্ব ও ব্যক্তিত্ব বিকাশের সুযোগ"
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 bg-accent rounded-full shrink-0" />
                  <p className="text-slate-300 text-sm">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      {/* Contact / Urgent Inquiries */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="glass-card p-8 rounded-3xl border border-accent/20 bg-accent/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">জরুরি প্রয়োজনে</h3>
              <p className="text-slate-400 text-sm">প্লাটুন কমান্ডারের সাথে সরাসরি কথা বলতে কল করুন</p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <a 
              href="tel:+8801812430454" 
              className="text-2xl md:text-3xl font-black text-accent hover:text-white transition-colors"
            >
              +880 1812-430454
            </a>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Platoon Commander</p>
          </div>
        </div>
      </section>
    </div>
  );
}
