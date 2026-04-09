import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { CheckCircle, Users, Award, ShieldCheck, ArrowRight, Info, FileText, Activity, Phone, Sparkles, BrainCircuit, Send, Loader2 } from "lucide-react";
import { getQuickFAQ } from "../services/geminiService";

export function Home() {
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [isFaqLoading, setIsFaqLoading] = useState(false);

  const handleFaqSubmit = async () => {
    if (!faqQuestion.trim() || isFaqLoading) return;
    setIsFaqLoading(true);
    const answer = await getQuickFAQ(faqQuestion);
    setFaqAnswer(answer);
    setIsFaqLoading(false);
  };

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-bg-light/80 to-bg-light z-10" />
          <img 
            src="https://picsum.photos/seed/army-training/1920/1080?blur=2" 
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
            <span className="inline-block px-4 py-1.5 mb-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-[0.2em]">
              Bangladesh National Cadet Corps
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight">
              বাংলাদেশ ন্যাশনাল ক্যাডেট কোর <br />
              <span className="text-primary">BNCC</span>
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
              className="group px-8 py-4 bg-accent text-white font-bold rounded-xl flex items-center gap-2 hover:bg-accent/90 transition-all transform hover:scale-105 shadow-lg shadow-accent/20"
            >
              আবেদন করুন <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#eligibility"
              className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:bg-sand transition-all border border-primary/10 shadow-sm"
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
          <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
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
              className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl space-y-4 shadow-xl border border-white/5"
            >
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <item.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Physical Standards */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-[2rem] overflow-hidden shadow-2xl border border-white/5">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-12 space-y-8">
              <div className="flex items-center gap-3">
                <Activity className="w-8 h-8 text-primary" />
                <h2 className="text-3xl font-bold text-white">শারীরিক মানদণ্ড</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="py-4 text-primary font-semibold">বিবরণ</th>
                      <th className="py-4 text-primary font-semibold">পুরুষ</th>
                      <th className="py-4 text-primary font-semibold">মহিলা</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-400">
                    <tr className="border-b border-slate-800/30">
                      <td className="py-4">উচ্চতা (ন্যূনতম)</td>
                      <td className="py-4">৫ ফুট ৬ ইঞ্চি</td>
                      <td className="py-4">৫ ফুট ২ ইঞ্চি</td>
                    </tr>
                    <tr className="border-b border-slate-800/30">
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
            <div className="bg-white/5 p-12 flex items-center justify-center">
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
                    <li key={i} className="flex items-center gap-3 text-slate-400">
                      <CheckCircle className="w-5 h-5 text-primary shrink-0" />
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
          <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: "০১", title: "অনলাইন আবেদন", icon: FileText },
            { step: "০২", title: "শারীরিক পরীক্ষা", icon: Activity },
            { step: "০৩", title: "লিখিত পরীক্ষা", icon: Info },
            { step: "০৪", title: "চূড়ান্ত ভাইভা", icon: Users }
          ].map((item, i) => (
            <div key={i} className="relative p-8 bg-slate-900/50 backdrop-blur-sm rounded-2xl text-center space-y-4 shadow-lg border border-white/5">
              <span className="absolute top-4 right-4 text-4xl font-black text-white/5">{item.step}</span>
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                <item.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{item.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-900/50 backdrop-blur-sm p-12 rounded-[2rem] shadow-2xl border border-white/5 bg-gradient-to-br from-primary/10 to-transparent">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-bold text-white mb-8">বিএনসিসি ক্যাডেট হওয়ার সুবিধাসমূহ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                "সেনা, নৌ ও বিমান বাহিনীতে যোগদানে অগ্রাধিকার",
                "আইএসএসবি (ISSB) পরীক্ষায় বিশেষ সুবিধা",
                "বিনামূল্যে সামরিক প্রশিক্ষণ ও ইউনিফর্ম",
                "সরকারি চাকরিতে কোটা সুবিধা",
                "বিদেশ ভ্রমণের সুযোগ (ক্যাডেট এক্সচেঞ্জ প্রোগ্রাম)",
                "নেত্বৃত্ব ও ব্যক্তিত্ব বিকাশের সুযোগ"
              ].map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1.5 w-2 h-2 bg-primary rounded-full shrink-0" />
                  <p className="text-slate-400 text-sm">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* About the Platoon Section */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">প্লাটুন পরিচিতি</h2>
          <div className="w-24 h-1 bg-primary mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="inline-block px-4 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-widest">
              কক্সবাজার সিটি কলেজ BNCC মিশ্র প্লাটুন
            </div>
            <h3 className="text-3xl font-bold text-white leading-tight">
              শৃঙ্খলা, দেশপ্রেম এবং নেতৃত্বের গুণাবলি বিকাশে আমাদের অঙ্গীকার
            </h3>
            <p className="text-slate-400 leading-relaxed">
              কক্সবাজার সিটি কলেজ BNCC মিশ্র প্লাটুন বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (BNCC)-এর একটি গুরুত্বপূর্ণ শাখা। এটি শিক্ষার্থীদের শৃঙ্খলা, নেতৃত্বের দক্ষতা, শারীরিক সক্ষমতা এবং দেশপ্রেমে উদ্বুদ্ধ করতে প্রশিক্ষণ প্রদান করে। ৩ সেপ্টেম্বর ২০২০ তারিখে প্লাটুনটি প্রতিষ্ঠার অনুমোদন পায় এবং ১৮ নভেম্বর ২০২০ তারিখে উজ্জ্বল কান্তি দেব-এর নেতৃত্বে কার্যক্রম শুরু করে।
            </p>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 shadow-sm">
                <p className="text-[10px] uppercase text-white/40 font-bold mb-1">প্রতিষ্ঠা</p>
                <p className="text-sm font-bold text-white">৩ সেপ্টেম্বর ২০২০</p>
              </div>
              <div className="p-4 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 shadow-sm">
                <p className="text-[10px] uppercase text-white/40 font-bold mb-1">কমান্ড</p>
                <p className="text-sm font-bold text-white">১৫ বিএনসিসি ব্যাটালিয়ন</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-primary p-8 md:p-12 rounded-[3rem] text-white shadow-2xl space-y-8"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h4 className="text-xl font-bold">উজ্জ্বল কান্তি দেব</h4>
                <p className="text-white/60 text-sm">প্রফেসর আন্ডার অফিসার ও প্লাটুন কমান্ডার</p>
              </div>
            </div>

            <div className="space-y-4">
              <h5 className="font-bold text-accent uppercase tracking-widest text-xs">আমাদের কার্যক্রম</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  "জাতীয় ও আঞ্চলিক প্যারেড",
                  "রক্তদান কর্মসূচি",
                  "ত্রাণ বিতরণ",
                  "পরিবেশ রক্ষা কার্যক্রম",
                  "নেতৃত্ব প্রশিক্ষণ",
                  "শারীরিক সক্ষমতা বৃদ্ধি"
                ].map((act, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle className="w-4 h-4 text-accent shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <p className="text-sm text-white/70 italic">
                "প্রতিবছর প্রায় ১৫০ জন শিক্ষার্থী আমাদের প্লাটুনে যোগদানের জন্য আবেদন করে, যা আমাদের কার্যক্রমের প্রতি তাদের গভীর আগ্রহ প্রকাশ করে।"
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Smart AI FAQ Section */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-primary p-8 md:p-16 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <BrainCircuit size={200} className="text-white" />
          </div>
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Sparkles className="text-accent" size={32} />
                <h2 className="text-3xl md:text-5xl font-bold text-white">Smart AI FAQ</h2>
              </div>
              <p className="text-white/70 text-lg leading-relaxed">
                ভর্তি সংক্রান্ত যেকোনো প্রশ্ন সরাসরি এআই-কে জিজ্ঞাসা করুন। আমাদের ইন্টেলিজেন্ট অ্যাসিস্ট্যান্ট আপনাকে তাৎক্ষণিক উত্তর দেবে।
              </p>
              <div className="flex flex-wrap gap-3">
                {["ভর্তির শেষ সময় কবে?", "উচ্চতা কত লাগবে?", "কি কি কাগজ লাগবে?"].map((q) => (
                  <button 
                    key={q}
                    onClick={() => setFaqQuestion(q)}
                    className="px-4 py-2 bg-white/10 border border-white/20 rounded-full text-xs font-medium hover:bg-white/20 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-2xl">
              <div className="space-y-4">
                <div className="relative">
                  <input 
                    type="text"
                    value={faqQuestion}
                    onChange={(e) => setFaqQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleFaqSubmit()}
                    placeholder="আপনার প্রশ্নটি এখানে লিখুন..."
                    className="w-full bg-sand/20 border border-primary/10 rounded-2xl px-6 py-4 text-black focus:border-primary outline-none transition-colors pr-14"
                  />
                  <button 
                    onClick={handleFaqSubmit}
                    disabled={!faqQuestion.trim() || isFaqLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isFaqLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {faqAnswer && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-6 bg-primary/5 border border-primary/10 rounded-2xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="text-primary" size={16} />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">AI Response</span>
                      </div>
                      <p className="text-black/80 text-sm leading-relaxed italic">"{faqAnswer}"</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Partners Section */}
      <section className="max-w-7xl mx-auto px-4 py-12 border-t border-primary/10">
        <div className="flex flex-col md:flex-row items-center justify-center gap-12 opacity-60 hover:opacity-100 transition-opacity">
          <a href="https://cbcc.edu.bd/" target="_blank" rel="noopener noreferrer" className="grayscale hover:grayscale-0 transition-all">
            <img 
              src="https://i.ibb.co/SBfzG9K/logo-removebg-preview-2.png" 
              alt="Cox's Bazar City College Logo" 
              className="h-20 w-auto"
              referrerPolicy="no-referrer"
            />
          </a>
          <a href="https://bncc.info/" target="_blank" rel="noopener noreferrer" className="grayscale hover:grayscale-0 transition-all">
            <img 
              src="https://i.ibb.co/Fb3R6wR/Bncc-logo.png" 
              alt="BNCC Logo" 
              className="h-20 w-auto"
              referrerPolicy="no-referrer"
            />
          </a>
        </div>
      </section>

      {/* Contact / Urgent Inquiries */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="bg-slate-900/50 backdrop-blur-sm p-8 rounded-3xl border border-white/10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">জরুরি প্রয়োজনে</h3>
              <p className="text-white/40 text-sm">প্লাটুন কমান্ডারের সাথে সরাসরি কথা বলতে কল করুন</p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <a 
              href="tel:+8801812430454" 
              className="text-2xl md:text-3xl font-black text-primary hover:text-primary/80 transition-colors"
            >
              +880 1812-430454
            </a>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1 font-bold">Platoon Commander</p>
          </div>
        </div>
      </section>
    </div>
  );
}
