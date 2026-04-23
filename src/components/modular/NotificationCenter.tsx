import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Info, AlertTriangle, MessageSquare, X, Check } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "Alert" | "Announcement" | "Message";
  isRead: boolean;
  timestamp: string;
}

export function NotificationCenter({ notifications: initialNotifications }: { notifications: Notification[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "Alert": return { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10" };
      case "Announcement": return { icon: Info, color: "text-cyan-400", bg: "bg-cyan-400/10" };
      case "Message": return { icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" };
      default: return { icon: Bell, color: "text-slate-400", bg: "bg-slate-400/10" };
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-surface border border-white/5 rounded-xl hover:bg-white/5 transition-all group"
      >
        <Bell size={20} className="text-slate-400 group-hover:text-primary transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-slate-900 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-bg-light animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-transparent"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-80 lg:w-96 glass-card rounded-3xl border border-white/10 shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Notifications</h3>
                </div>
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-black uppercase text-primary hover:text-cyan-400 transition-colors"
                >
                  Mark all as read
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto no-scrollbar py-2">
                {notifications.length > 0 ? (
                  notifications.map((notif) => {
                    const style = getTypeStyles(notif.type);
                    return (
                      <div 
                        key={notif.id}
                        className={`p-4 hover:bg-white/5 transition-colors border-l-4 ${notif.isRead ? "border-transparent opacity-60" : "border-primary bg-primary/5"}`}
                        onClick={() => markAsRead(notif.id)}
                      >
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${style.bg} ${style.color}`}>
                            <style.icon size={20} />
                          </div>
                          <div className="flex-grow space-y-1">
                            <div className="flex justify-between items-start">
                              <h4 className="text-xs font-black text-white uppercase tracking-tight">{notif.title}</h4>
                              <span className="text-[9px] font-bold text-slate-500">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-relaxed">{notif.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-600">
                      <Bell size={32} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No notifications yet</p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-white/5 text-center">
                <button className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors">
                  View all activity
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
