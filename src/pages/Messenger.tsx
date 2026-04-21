import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, Trash2, User, Shield, Clock, Smile, 
  MoreVertical, LogOut, MessageSquare, Loader2,
  ChevronLeft, Info
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { 
  db, collection, query, orderBy, limit, onSnapshot, 
  addDoc, deleteDoc, doc, Timestamp, getDoc,
  handleFirestoreError, OperationType 
} from "../firebase";
import { getSession } from "../lib/auth";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: any;
  role: "user" | "admin";
}

export function Messenger() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      navigate("/login");
      return;
    }

    const fetchUser = async () => {
      try {
        if (session.role === "admin") {
          setUser({ id: "admin", fullNameEnglish: "Administrator", role: "admin" });
        } else {
          const docRef = doc(db, "applicants", session.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser({ ...docSnap.data(), id: docSnap.id });
          } else {
            navigate("/login");
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();

    // Real-time messages listener
    const q = query(
      collection(db, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Message[];
      setMessages(msgs);
      scrollToBottom();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, "messages");
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, "messages"), {
        senderId: user.id,
        senderName: user.fullNameEnglish || user.fullNameBangla || "Unknown User",
        content: newMessage.trim(),
        timestamp: Timestamp.now(),
        role: user.role || "user"
      });
      setNewMessage("");
      setShowEmojiPicker(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "messages");
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (user?.role !== "admin") return;
    if (!confirm("Delete this message?")) return;

    try {
      await deleteDoc(doc(db, "messages", id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `messages/${id}`);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-light">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-light text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-surface/50 backdrop-blur-xl border-b border-white/5 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/20 rounded-2xl flex items-center justify-center border border-accent/20">
              <MessageSquare className="text-accent" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">BNCC Messenger</h1>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Group Chat</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-bold text-white uppercase tracking-tight">{user?.fullNameEnglish}</span>
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">{user?.role}</span>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <Info size={20} className="text-slate-400" />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-8">
            <div className="inline-block px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-white/5">
              Messages are end-to-end encrypted
            </div>
          </div>

          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              const isAdmin = msg.role === "admin";

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex flex-col max-w-[80%] md:max-w-[60%] ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 mb-1 px-2">
                      {!isMe && (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {msg.senderName}
                        </span>
                      )}
                      {isAdmin && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-accent/20 text-accent rounded text-[8px] font-black uppercase tracking-widest border border-accent/20">
                          <Shield size={8} />
                          Admin
                        </span>
                      )}
                      <span className="text-[8px] text-slate-500 font-bold uppercase">
                        {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="group relative flex items-center gap-2">
                      {isMe && user?.role === "admin" && (
                        <button 
                          onClick={() => deleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      
                      <div className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-xl ${
                        isMe 
                          ? "bg-accent text-white rounded-tr-none" 
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-white/5"
                      }`}>
                        {msg.content}
                      </div>

                      {!isMe && user?.role === "admin" && (
                        <button 
                          onClick={() => deleteMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-surface/50 backdrop-blur-xl border-t border-white/5 z-20">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="w-full bg-slate-800/20 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent/50 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${
                  showEmojiPicker ? "text-accent bg-accent/10" : "text-slate-400 hover:text-white"
                }`}
              >
                <Smile size={20} />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="p-4 bg-accent text-white rounded-2xl hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50 disabled:shadow-none"
            >
              {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>

          {/* Emoji Picker */}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                ref={emojiPickerRef}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="absolute bottom-full right-0 mb-4 z-50"
              >
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.DARK}
                  width={350}
                  height={400}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </footer>
    </div>
  );
}
