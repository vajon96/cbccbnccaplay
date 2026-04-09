import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Loader2, Bot, User, Minimize2, Maximize2 } from "lucide-react";
import { getChatResponse } from "../services/geminiService";

interface Message {
  role: "user" | "model";
  text: string;
}

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "স্বাগতম! আমি বিএনসিসি এআই অ্যাসিস্ট্যান্ট। আমি আপনাকে কীভাবে সাহায্য করতে পারি? (Welcome! I am the BNCC AI Assistant. How can I help you?)" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setIsLoading(true);

    const history = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const response = await getChatResponse(userMessage, history);
    setMessages(prev => [...prev, { role: "model", text: response }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? "64px" : "500px"
            }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-[350px] sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-primary/20 overflow-hidden flex flex-col mb-4"
          >
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">BNCC Assistant</h3>
                  <span className="text-[10px] text-white/60 uppercase tracking-widest">Online</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages */}
                <div 
                  ref={scrollRef}
                  className="flex-grow overflow-y-auto p-4 space-y-4 bg-sand/10"
                >
                  {messages.map((msg, i) => (
                    <div 
                      key={i} 
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === "user" ? "bg-accent text-white" : "bg-primary text-white"}`}>
                          {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                          msg.role === "user" 
                            ? "bg-accent text-white rounded-tr-none" 
                            : "bg-white text-black border border-primary/10 rounded-tl-none"
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 items-center bg-white p-3 rounded-2xl border border-primary/10 shadow-sm">
                        <Loader2 size={16} className="animate-spin text-primary" />
                        <span className="text-xs text-black/40 font-medium italic">Assistant is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 bg-white border-t border-primary/10">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSend()}
                      placeholder="Ask anything about BNCC..."
                      className="flex-grow px-4 py-2 bg-sand/20 border border-primary/10 rounded-xl text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                  <p className="text-[9px] text-center text-black/30 mt-2 uppercase tracking-widest font-bold">
                    Powered by Gemini AI
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className={`w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-2xl transition-all ${isOpen ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      >
        <MessageSquare size={24} />
      </motion.button>
    </div>
  );
}
