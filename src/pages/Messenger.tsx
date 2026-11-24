import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Trash2, Shield, Smile,
  MessageSquare, Loader2, ChevronLeft, Megaphone, Users
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";
import {
  auth, db, collection, query, orderBy, limit, onSnapshot, where,
  addDoc, deleteDoc, doc, Timestamp, getDoc, getDocs, updateDoc,
  handleFirestoreError, reportFirestoreListenerError, OperationType
} from "../firebase";
import { getSession, getServerAuthHeaders } from "../lib/auth";
import { isAdminRole } from "../lib/rbac";
import { useAuth } from "../context/AuthContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  ownerUid?: string;
  candidateId?: string;
  content: string;
  timestamp?: any;
  timestampIso?: string;
  timestampMs?: number;
  role: string;
  isRead?: boolean;
}

export function Messenger() {
  useDocumentMeta({
    title: "Platoon Messenger | Cox's Bazar City College BNCC Platoon",
    description: "Official internal platoon communications and cadet support channel.",
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeChannel, setActiveChannel] = useState<"ALL" | string>("ALL");
  const [channelMode, setChannelMode] = useState<"broadcast" | "support">("broadcast");
  const [actionError, setActionError] = useState<string | null>(null);
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const { firebaseUser, loading: authLoading } = useAuth();
  const session = getSession();
  const isAdmin = isAdminRole(session?.role);
  const useFirestore = Boolean(firebaseUser);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      navigate("/login");
      return;
    }

    setActionError(null);
    let cancelled = false;

    const fetchUser = async () => {
      try {
        if (isAdmin) {
          if (!cancelled) {
            setUser({
              id: session.id,
              uid: firebaseUser?.uid || session.uid || session.id,
              fullNameEnglish: session.name || "Platoon Admin",
              role: session.role,
            });
          }
        } else {
          const authUid = firebaseUser?.uid || session.uid || session.id;
          if (firebaseUser) {
            const targetApplicantId =
              session.applicantId || (session.id && session.id !== firebaseUser.uid ? session.id : "");
            if (targetApplicantId) {
              const docRef = doc(db, "applicants", targetApplicantId);
              const docSnap = await getDoc(docRef).catch(() => null);
              if (!cancelled && docSnap && docSnap.exists()) {
                setUser({ ...docSnap.data(), id: docSnap.id, uid: authUid, role: session.role || "cadet" });
                return;
              }
            } else {
              const appSnap = await getDocs(
                query(collection(db, "applicants"), where("ownerUid", "==", firebaseUser.uid))
              ).catch(() => null);
              if (!cancelled && appSnap && !appSnap.empty) {
                const docSnap = appSnap.docs[0];
                setUser({ ...docSnap.data(), id: docSnap.id, uid: authUid, role: session.role || "cadet" });
                return;
              }
            }
          }
          if (!cancelled) {
            setUser({
              id: session.id,
              uid: authUid,
              fullNameEnglish: session.name || "BNCC Cadet",
              role: session.role || "cadet",
            });
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        if (!cancelled && !firebaseUser) setLoading(false);
      }
    };

    void fetchUser();

    const toMillis = (ts: any) => {
      if (!ts) return 0;
      if (typeof ts === "number") return ts;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts.toDate === "function") return ts.toDate().getTime();
      return new Date(ts).getTime() || 0;
    };

    const unsubscribers: Array<() => void> = [];
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const loadServerMessages = async () => {
      try {
        const res = await fetch("/api/messages", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.messages)) {
          setMessages(data.messages);
        }
      } catch {
        // Ignore transient network failures during polling
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!firebaseUser) {
      void loadServerMessages();
      pollTimer = setInterval(() => {
        void loadServerMessages();
      }, 4000);
    } else if (isAdmin) {
      const qAll = query(collection(db, "messages"), orderBy("timestamp", "asc"), limit(200));
      unsubscribers.push(
        onSnapshot(
          qAll,
          (snapshot) => {
            const msgs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Message));
            setMessages(msgs);
            setLoading(false);
          },
          (err) => {
            reportFirestoreListenerError(err, OperationType.LIST, "messages");
            void loadServerMessages();
          }
        )
      );
    } else {
      const authUid = firebaseUser.uid || auth.currentUser?.uid;
      const mergedMap = new Map<string, Message>();

      const flushMerged = () => {
        const list = Array.from(mergedMap.values()).sort(
          (a, b) => toMillis(a.timestamp || a.timestampMs || a.timestampIso) - toMillis(b.timestamp || b.timestampMs || b.timestampIso)
        );
        setMessages(list);
        setLoading(false);
      };

      const qBroadcast = query(collection(db, "messages"), where("recipientId", "==", "ALL"));
      unsubscribers.push(
        onSnapshot(
          qBroadcast,
          (snapshot) => {
            snapshot.docs.forEach((d) => mergedMap.set(d.id, { ...d.data(), id: d.id } as Message));
            flushMerged();
          },
          (err) => {
            reportFirestoreListenerError(err, OperationType.LIST, "messages");
            void loadServerMessages();
          }
        )
      );

      if (authUid) {
        const qPrivate = query(collection(db, "messages"), where("ownerUid", "==", authUid));
        unsubscribers.push(
          onSnapshot(
            qPrivate,
            (snapshot) => {
              snapshot.docs.forEach((d) => mergedMap.set(d.id, { ...d.data(), id: d.id } as Message));
              flushMerged();
            },
            (err) => {
              reportFirestoreListenerError(err, OperationType.LIST, "messages");
            }
          )
        );
      }
    }

    return () => {
      cancelled = true;
      unsubscribers.forEach((u) => u());
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [navigate, authLoading, firebaseUser?.uid, session?.id, session?.role, isAdmin]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel, channelMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derive distinct cadet threads for admin view
  const cadetThreads = useMemo(() => {
    const map = new Map<string, { ownerUid: string; label: string; unread: number }>();
    messages.forEach((m) => {
      if (m.recipientId === "ALL" || !m.ownerUid || m.ownerUid === "ALL") return;
      const existing = map.get(m.ownerUid);
      const isUnread = !m.isRead && !isAdminRole(m.role);
      if (!existing) {
        map.set(m.ownerUid, {
          ownerUid: m.ownerUid,
          label: !isAdminRole(m.role) ? m.senderName : m.candidateId || "Cadet Thread",
          unread: isUnread ? 1 : 0,
        });
      } else {
        if (!isAdminRole(m.role) && m.senderName) existing.label = m.senderName;
        if (isUnread) existing.unread += 1;
      }
    });
    return Array.from(map.values());
  }, [messages]);

  const visibleMessages = useMemo(() => {
    if (isAdmin) {
      if (activeChannel === "ALL") {
        return messages.filter((m) => m.recipientId === "ALL" || !m.recipientId);
      }
      return messages.filter((m) => m.ownerUid === activeChannel);
    }
    if (channelMode === "broadcast") {
      return messages.filter((m) => m.recipientId === "ALL");
    }
    const uid = firebaseUser?.uid || user?.uid;
    return messages.filter((m) => m.recipientId !== "ALL" && (!uid || m.ownerUid === uid));
  }, [messages, isAdmin, activeChannel, channelMode, firebaseUser?.uid, user?.uid]);

  // Mark unread messages as read when viewed
  useEffect(() => {
    const myUid = firebaseUser?.uid || user?.uid;
    visibleMessages.forEach((m) => {
      if (!m.isRead && m.senderId !== myUid && m.senderId !== user?.id) {
        if (isAdmin || m.recipientId === myUid || m.ownerUid === myUid) {
          if (useFirestore) {
            void updateDoc(doc(db, "messages", m.id), {
              isRead: true,
              readAt: new Date().toISOString(),
            }).catch(() => {});
          } else {
            void fetch(`/api/messages/${encodeURIComponent(m.id)}/read`, {
              method: "PATCH",
              credentials: "include",
            }).catch(() => {});
          }
        }
      }
    });
  }, [visibleMessages, isAdmin, useFirestore, firebaseUser?.uid, user?.id, user?.uid]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    setActionError(null);
    try {
      const text = newMessage.trim();
      if (useFirestore) {
        const authUid = firebaseUser?.uid || auth.currentUser?.uid || user.uid || user.id;
        const payload = isAdmin
          ? {
              senderId: authUid,
              senderName: user.fullNameEnglish || "Platoon Admin",
              recipientId: activeChannel === "ALL" ? "ALL" : activeChannel,
              ownerUid: activeChannel === "ALL" ? "ALL" : activeChannel,
              content: text,
              timestamp: Timestamp.now(),
              role: "admin",
              isRead: false,
            }
          : {
              senderId: authUid,
              senderName: user.fullNameEnglish || user.fullNameBangla || "BNCC Cadet",
              candidateId: session?.id || user.id,
              recipientId: "ADMIN",
              ownerUid: authUid,
              content: text,
              timestamp: Timestamp.now(),
              role: "cadet",
              isRead: false,
            };

        await addDoc(collection(db, "messages"), payload);
        void getServerAuthHeaders({ "Content-Type": "application/json" }).then((headers) =>
          fetch("/api/messages", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              content: text,
              recipientId: isAdmin ? (activeChannel === "ALL" ? "ALL" : activeChannel) : "ADMIN",
            }),
          })
        ).catch(() => {});
      } else {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            content: text,
            recipientId: isAdmin ? (activeChannel === "ALL" ? "ALL" : activeChannel) : "ADMIN",
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || "বার্তা পাঠানো যায়নি।");
        }
        const data = await res.json();
        if (data?.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      }
      setNewMessage("");
      setShowEmojiPicker(false);
    } catch (err: any) {
      if (useFirestore) {
        handleFirestoreError(err, OperationType.CREATE, "messages");
      } else {
        setActionError(err?.message || "বার্তা পাঠাতে সমস্যা হয়েছে।");
      }
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete this message?")) return;

    try {
      if (useFirestore) {
        await deleteDoc(doc(db, "messages", id));
        void getServerAuthHeaders().then((headers) =>
          fetch(`/api/messages/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers,
            credentials: "include",
          })
        ).catch(() => {});
      } else {
        const res = await fetch(`/api/messages/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("বার্তা মুছে ফেলা যায়নি।");
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err: any) {
      if (useFirestore) {
        handleFirestoreError(err, OperationType.DELETE, `messages/${id}`);
      } else {
        setActionError(err?.message || "বার্তা মুছে ফেলতে সমস্যা হয়েছে।");
      }
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage((prev) => prev + emojiData.emoji);
  };

  const formatMessageTime = (msg: Message) => {
    const d = msg.timestamp?.toDate?.() || (msg.timestampIso ? new Date(msg.timestampIso) : msg.timestampMs ? new Date(msg.timestampMs) : null);
    if (!d || Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#00152e] text-white">
        <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
      </div>
    );
  }

  const canCandidateCompose = isAdmin || channelMode === "support";

  return (
    <div className="flex flex-col h-screen bg-[#00152e] text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 bg-[#002147] border-b border-white/10 z-20">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            aria-label="Go Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#C5A059]/15 rounded-xl flex items-center justify-center border border-[#C5A059]/30">
              <MessageSquare className="text-[#C5A059]" size={20} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black uppercase tracking-tight">BNCC Platoon Messenger</h1>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                {isAdmin
                  ? activeChannel === "ALL"
                    ? "Official Announcements Broadcast"
                    : `Private Thread: ${cadetThreads.find((t) => t.ownerUid === activeChannel)?.label || activeChannel}`
                  : channelMode === "broadcast"
                  ? "Official Platoon Announcements"
                  : "Direct 1:1 Platoon HQ Helpdesk"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && (
            <div className="flex bg-[#00152e] p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setChannelMode("broadcast")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  channelMode === "broadcast" ? "bg-[#C5A059] text-[#00152e]" : "text-slate-300 hover:text-white"
                }`}
              >
                <Megaphone size={13} />
                <span>Notices</span>
              </button>
              <button
                onClick={() => setChannelMode("support")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  channelMode === "support" ? "bg-[#C5A059] text-[#00152e]" : "text-slate-300 hover:text-white"
                }`}
              >
                <Shield size={13} />
                <span>HQ Support</span>
              </button>
            </div>
          )}

          <div className="hidden md:flex flex-col items-end">
            <span className="text-xs font-bold text-white uppercase tracking-tight">
              {user?.fullNameEnglish || user?.fullNameBangla}
            </span>
            <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest">
              {user?.role}
            </span>
          </div>
        </div>
      </header>

      {actionError && (
        <div className="px-4 py-2 bg-rose-500/20 border-b border-rose-400/30 text-rose-200 text-xs font-semibold text-center">
          {actionError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Admin Thread Sidebar */}
        {isAdmin && (
          <aside className="hidden sm:flex w-64 flex-col bg-[#001b3a] border-r border-white/10 p-3 gap-1.5 overflow-y-auto">
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Channels
            </div>
            <button
              onClick={() => setActiveChannel("ALL")}
              className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeChannel === "ALL" ? "bg-[#C5A059] text-[#00152e]" : "text-slate-200 hover:bg-white/5"
              }`}
            >
              <Megaphone size={15} />
              <span>Platoon Announcements</span>
            </button>

            <div className="px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Users size={12} />
              <span>Cadet 1:1 Threads ({cadetThreads.length})</span>
            </div>
            {cadetThreads.map((t) => (
              <button
                key={t.ownerUid}
                onClick={() => setActiveChannel(t.ownerUid)}
                className={`w-full px-3 py-2.5 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  activeChannel === t.ownerUid ? "bg-[#C5A059] text-[#00152e]" : "text-slate-200 hover:bg-white/5"
                }`}
              >
                <span className="truncate">{t.label}</span>
                {t.unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black">
                    {t.unread}
                  </span>
                )}
              </button>
            ))}
          </aside>
        )}

        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-5">
            <div className="max-w-4xl mx-auto space-y-5">
              {visibleMessages.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-semibold">
                  {channelMode === "broadcast" && !isAdmin
                    ? "এই চ্যানেলে এখনো কোনো অফিসিয়াল ঘোষণা প্রকাশিত হয়নি।"
                    : "এখনো কোনো বার্তা নেই। প্লাটুন দপ্তরের সাথে সরাসরি কথা বলতে নিচে লিখুন।"}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {visibleMessages.map((msg) => {
                    const myUid = firebaseUser?.uid || user?.uid;
                    const isMe = msg.senderId === myUid || msg.senderId === user?.id;
                    const msgIsAdmin = isAdminRole(msg.role);

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex flex-col max-w-[82%] md:max-w-[65%] ${isMe ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-2 mb-1 px-1">
                            {!isMe && (
                              <span className="text-[11px] font-bold text-slate-300">{msg.senderName}</span>
                            )}
                            {msgIsAdmin && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[#C5A059]/20 text-[#C5A059] rounded text-[9px] font-black uppercase tracking-wider border border-[#C5A059]/30">
                                <Shield size={9} />
                                Admin
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {formatMessageTime(msg)}
                            </span>
                          </div>

                          <div className="group relative flex items-center gap-2">
                            {isMe && isAdmin && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                                title="Delete message"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}

                            <div
                              className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-md ${
                                isMe
                                  ? "bg-[#C5A059] text-[#00152e] font-semibold rounded-tr-none"
                                  : "bg-[#002147] text-slate-100 rounded-tl-none border border-white/10"
                              }`}
                            >
                              {msg.content}
                            </div>

                            {!isMe && isAdmin && (
                              <button
                                onClick={() => deleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                                title="Delete message"
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
              )}
              <div ref={messagesEndRef} />
            </div>
          </main>

          {/* Input Area */}
          <footer className="p-4 sm:p-5 bg-[#002147] border-t border-white/10 z-20">
            <div className="max-w-4xl mx-auto relative">
              {canCandidateCompose ? (
                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder={
                        isAdmin
                          ? activeChannel === "ALL"
                            ? "Broadcast an official announcement..."
                            : "Reply to cadet thread..."
                          : "Write a message to Platoon HQ..."
                      }
                      className="w-full bg-[#00152e] border border-white/15 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#C5A059] transition-all pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all cursor-pointer ${
                        showEmojiPicker ? "text-[#C5A059]" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Smile size={20} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="p-3.5 bg-[#C5A059] text-[#00152e] font-bold rounded-2xl hover:bg-[#d4b06a] transition-all shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </form>
              ) : (
                <div className="text-center text-xs text-slate-300 font-semibold py-2">
                  অফিসিয়াল নোটিশ চ্যানেলে শুধুমাত্র অ্যাডমিন ঘোষণা প্রকাশ করতে পারেন। প্রশ্ন করতে উপরে "HQ Support" ট্যাবে যান।
                </div>
              )}

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
                    <EmojiPicker onEmojiClick={onEmojiClick} theme={Theme.DARK} width={340} height={380} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
