import { Link, useNavigate } from "react-router-dom";
import { Shield, BookOpen, LogOut, User, Lock, Home } from "lucide-react";
import { getSession, clearSession } from "../../lib/auth";

interface ExamNavbarProps {
  title?: string;
}

export function ExamNavbar({ title = "BNCC Examination Portal" }: ExamNavbarProps) {
  const session = getSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearSession();
    navigate("/exam");
  };

  return (
    <nav className="bg-slate-900 border-b border-white/10 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand */}
          <div className="flex items-center space-x-3">
            <Link to="/exam" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                <BookOpen size={20} />
              </div>
              <div>
                <span className="text-white font-black text-sm tracking-tight block font-display">
                  {title}
                </span>
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block">
                  Cox's Bazar City College BNCC Platoon
                </span>
              </div>
            </Link>
          </div>

          {/* Right Action / Profile */}
          <div className="flex items-center space-x-3">
            <Link 
              to="/" 
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 border border-white/10"
            >
              <Home size={14} />
              <span className="hidden sm:inline">Main Website</span>
            </Link>

            {session ? (
              <div className="flex items-center space-x-3 border-l border-white/10 pl-3">
                <div className="text-right hidden sm:block">
                  <span className="block text-xs font-black text-white">{session.name || session.id}</span>
                  <span className="block text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                    {session.role === "super_admin" || session.role === "admin" ? "Exam Admin" : `ID: ${session.id}`}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Logout"
                >
                  <LogOut size={16} />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/exam/login"
                  className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-black uppercase tracking-wider hover:bg-primary/90 transition-all shadow-md flex items-center gap-1.5"
                >
                  <User size={14} />
                  Candidate Login
                </Link>
                <Link
                  to="/exam/admin/login"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all border border-white/10 flex items-center gap-1.5"
                >
                  <Lock size={14} />
                  Admin
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
