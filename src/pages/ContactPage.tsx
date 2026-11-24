import { useState, FormEvent } from "react";
import {
  Phone, Mail, MapPin, Clock, Send,
  CheckCircle, MessageSquare, Shield, Loader2, AlertCircle
} from "lucide-react";
import { useCMS } from "../context/CMSContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import {
  auth,
  db,
  doc,
  setDoc,
  serverTimestamp,
  reportFirestoreListenerError,
  OperationType,
} from "../firebase";

export function ContactPage() {
  useDocumentMeta({
    title: "Contact & Headquarters | Cox's Bazar City College BNCC Platoon",
    description: "Contact Platoon Commander, office hours, headquarters address, and inquiry form for CBCC BNCC Platoon.",
  });
  const cms = useCMS();
  const commander = cms.commander;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.trim();
    const cleanEmail = formData.email.trim();
    const cleanSubject = formData.subject.trim() || "সাধারণ অনুসন্ধান";
    const cleanMessage = formData.message.trim();

    if (!cleanName || !cleanPhone || !cleanMessage) {
      setSubmitError("অনুগ্রহ করে নাম, মোবাইল নম্বর এবং বিস্তারিত বার্তা পূরণ করুন।");
      return;
    }
    if (cleanName.length > 160) {
      setSubmitError("নাম ১৬০ অক্ষরের মধ্যে হতে হবে।");
      return;
    }
    if (!/^[0-9+\-\s()]{6,25}$/.test(cleanPhone) || cleanPhone.length < 6 || cleanPhone.length > 32) {
      setSubmitError("অনুগ্রহ করে সঠিক মোবাইল নম্বর (৬–২৫ অক্ষর) প্রদান করুন।");
      return;
    }
    if (cleanEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 160)) {
      setSubmitError("অনুগ্রহ করে সঠিক ইমেইল ঠিকানা দিন (সর্বোচ্চ ১৬০ অক্ষর)।");
      return;
    }
    if (cleanSubject.length > 200) {
      setSubmitError("বিষয় ২০০ অক্ষরের মধ্যে লিখুন।");
      return;
    }
    if (cleanMessage.length > 5000) {
      setSubmitError("বার্তা ৫০০০ অক্ষরের মধ্যে হতে হবে।");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const generatedTicketId = `CBCC-INQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const hasFirebaseUser = Boolean(auth.currentUser && !auth.currentUser.isAnonymous);
    const ownerUid = hasFirebaseUser && auth.currentUser ? auth.currentUser.uid : "public_visitor";
    const createdAtIso = new Date().toISOString();

    let firestoreSaved = false;
    let firestoreErrMsg = "";

    try {
      await setDoc(doc(db, "contact_messages", generatedTicketId), {
        id: generatedTicketId,
        referenceId: generatedTicketId,
        ownerUid,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        status: "unread",
        createdAtIso,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      firestoreSaved = true;
    } catch (err: any) {
      reportFirestoreListenerError(err, OperationType.CREATE, `contact_messages/${generatedTicketId}`);
      firestoreErrMsg = err?.message || "Firestore write failed";
    }

    let serverSaved = false;
    let serverErrMsg = "";
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: generatedTicketId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          subject: cleanSubject,
          message: cleanMessage,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        serverSaved = true;
      } else {
        serverErrMsg = data.error || `Server error (${res.status})`;
      }
    } catch {
      serverErrMsg = "Server connection failed";
    } finally {
      setSubmitting(false);
    }

    if (!firestoreSaved && !serverSaved) {
      setSubmitError(
        serverErrMsg && serverErrMsg !== "Server connection failed"
          ? serverErrMsg
          : `বার্তা পাঠাতে সমস্যা হয়েছে (${firestoreErrMsg || "নেটওয়ার্ক সংযোগ পরীক্ষা করুন"})।`
      );
      return;
    }

    setTicketId(generatedTicketId);
  };

  return (
    <div className="min-h-screen bg-[#020B18] text-slate-100 py-14 md:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto relative z-10 space-y-14">
        {/* Banner Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[#C5A059] text-xs font-bold uppercase tracking-[0.2em]">
            <Mail size={14} />
            <span>যোগাযোগ · Contact Us</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display uppercase text-balance">
            আমাদের সাথে <span className="text-[#C5A059]">যোগাযোগ করুন</span>
          </h1>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন সংক্রান্ত যেকোনো তথ্য, ক্যাডেট ভর্তি অনুসন্ধান বা প্রাতিষ্ঠানিক যোগাযোগের জন্য নিচের মাধ্যমে আমাদের সাথে যুক্ত হতে পারেন।
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#061830] border border-white/10 shadow-2xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-display">
                <Shield size={20} className="text-[#C5A059]" />
                <span>প্লাটুন হেডকোয়ার্টার</span>
              </h2>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#020B18] border border-white/10">
                  <MapPin className="text-[#C5A059] shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">ঠিকানা</span>
                    <p className="text-slate-200 font-medium mt-0.5">
                      {cms.settings.address || (
                        <>
                          বিএনসিসি প্লাটুন রুম, কক্সবাজার সিটি কলেজ ক্যাম্পাস<br />
                          দক্ষিণ রুমালিয়ার ছড়া, কক্সবাজার - ৪৭০০
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#020B18] border border-white/10">
                  <Phone className="text-[#C5A059] shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">প্লাটুন কমান্ডার</span>
                    <a
                      href={`tel:${commander.phone}`}
                      className="text-slate-100 hover:text-[#C5A059] font-bold text-sm tabular-nums block mt-0.5 transition-colors"
                    >
                      {commander.phone}
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {commander.rank} {commander.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#020B18] border border-white/10">
                  <Phone className="text-[#C5A059] shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">প্লাটুন ইন-চার্জ</span>
                    <a
                      href="tel:+8801311106204"
                      className="text-slate-100 hover:text-[#C5A059] font-bold text-sm tabular-nums block mt-0.5 transition-colors"
                    >
                      +880 1311-106204
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Cadet Sergeant Mr Kader
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#020B18] border border-white/10">
                  <Mail className="text-[#C5A059] shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">ইমেইল</span>
                    <a
                      href={`mailto:${cms.settings.contactEmail || "cbccbnccplatoon@gmail.com"}`}
                      className="text-slate-200 hover:text-[#C5A059] font-medium text-xs font-mono mt-0.5 block transition-colors"
                    >
                      {cms.settings.contactEmail || "cbccbnccplatoon@gmail.com"}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-xl bg-[#020B18] border border-white/10">
                  <Clock className="text-[#C5A059] shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="font-bold text-slate-400 block text-xs uppercase tracking-wider">অফিস সময়</span>
                    <p className="text-slate-200 font-medium text-xs mt-0.5 leading-relaxed">
                      রবিবার – বৃহস্পতিবার: সকাল ৯:০০ টা – দুপুর ২:০০ টা<br />
                      প্যারেড দিবস (শুক্র ও শনি): সকাল ৭:০০ টা – সকাল ৯:০০ টা
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column */}
          <div className="lg:col-span-7">
            <div className="p-6 sm:p-8 rounded-2xl bg-[#061830] border border-white/10 shadow-2xl space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-display">
                <MessageSquare size={20} className="text-[#C5A059]" />
                <span>বার্তা বা অনুসন্ধান পাঠান</span>
              </h2>

              {ticketId ? (
                <div className="p-8 rounded-xl bg-[#020B18] border border-emerald-500/35 text-center space-y-3">
                  <CheckCircle size={44} className="mx-auto text-emerald-400" />
                  <h3 className="text-lg font-bold text-white">আপনার বার্তা সফলভাবে গ্রহণ করা হয়েছে!</h3>
                  <p className="text-xs font-mono text-[#C5A059]">
                    Reference ID: <strong>{ticketId}</strong>
                  </p>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুন কর্তৃপক্ষ শীঘ্রই আপনার সাথে উল্লেখিত ফোন বা ইমেইলে যোগাযোগ করবে। ধন্যবাদ।
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTicketId(null);
                      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
                    }}
                    className="mt-2 px-5 py-2.5 bg-[#002147] hover:bg-[#0B2545] border border-white/15 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                  >
                    নতুন বার্তা পাঠান
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {submitError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2"
                    >
                      <AlertCircle size={16} className="shrink-0 text-red-400" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-name" className="text-xs font-bold text-slate-200">
                        আপনার পূর্ণ নাম *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="নাম লিখুন"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-[#020B18] border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-phone" className="text-xs font-bold text-slate-200">
                        মোবাইল নম্বর *
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        required
                        placeholder="01XXXXXXXXX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-[#020B18] border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A059] tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="contact-email" className="text-xs font-bold text-slate-200">
                        ইমেইল (ঐচ্ছিক)
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        placeholder="email@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-[#020B18] border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-subject" className="text-xs font-bold text-slate-200">
                        বিষয়
                      </label>
                      <input
                        id="contact-subject"
                        type="text"
                        placeholder="যেমন: ক্যাডেট ভর্তি সংক্রান্ত"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full px-4 py-3 bg-[#020B18] border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A059]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="contact-message" className="text-xs font-bold text-slate-200">
                      আপনার বার্তা বা প্রশ্ন *
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={4}
                      placeholder="এখানে বিস্তারিত লিখুন..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="w-full px-4 py-3 bg-[#020B18] border border-white/15 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#C5A059] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl bg-[#C5A059] hover:bg-[#b59048] text-[#00152e] font-extrabold text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    <span>{submitting ? "পাঠানো হচ্ছে..." : "বার্তা পাঠান"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
