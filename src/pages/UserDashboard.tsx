import { useState, useEffect, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, Shield, LogOut, Edit3, Save, X, Key, 
  CheckCircle, AlertCircle, Loader2, Camera,
  FileText, Calendar, Mail, Phone, MapPin, Droplets,
  Ruler, Weight, Download, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, doc, getDoc, updateDoc, Timestamp, handleFirestoreError, OperationType, collection, addDoc } from "../firebase";
import { getSession, clearSession, hashPassword } from "../lib/auth";

export function UserDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const session = getSession();
    if (!session || session.role !== "user") {
      navigate("/login");
      return;
    }

    const fetchUserData = async () => {
      try {
        const docRef = doc(db, "applicants", session.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUser(data);
          setFormData(data);
        } else {
          clearSession();
          navigate("/login");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `applicants/${session.id}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    clearSession();
    navigate("/login");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "applicants", user.id);
      
      // Calculate changes for logging
      const changes: any = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== user[key] && key !== 'password') {
          changes[key] = { old: user[key], new: formData[key] };
        }
      });

      await updateDoc(docRef, formData);
      
      // Log activity
      if (Object.keys(changes).length > 0) {
        await addDoc(collection(db, "activity_logs"), {
          type: "PROFILE_UPDATED",
          targetId: user.id,
          actorId: user.id,
          timestamp: Timestamp.now(),
          details: `User updated profile fields: ${Object.keys(changes).join(", ")}`,
          changes
        });
      }

      setUser(formData);
      setEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${user.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const hashedPassword = await hashPassword(newPassword);
      const docRef = doc(db, "applicants", user.id);
      await updateDoc(docRef, { password: hashedPassword });

      // Log activity
      await addDoc(collection(db, "activity_logs"), {
        type: "PASSWORD_CHANGED",
        targetId: user.id,
        actorId: user.id,
        timestamp: Timestamp.now(),
        details: "User changed their password"
      });

      setShowPasswordModal(false);
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      alert("Password updated successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `applicants/${user.id}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-bg-light flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-light text-slate-200 pb-20">
      {/* Header */}
      <header className="bg-surface/50 border-b border-white/5 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Shield className="text-primary" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter text-white">Candidate Portal</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">BNCC Enrollment System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Change Password"
            >
              <Key size={20} />
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Profile Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-8 rounded-3xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary/20 to-accent/20" />
              <div className="relative z-10">
                <div className="w-32 h-32 mx-auto mb-6 rounded-3xl border-4 border-slate-900 overflow-hidden shadow-2xl">
                  <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-1">{user.fullNameEnglish}</h2>
                <p className="text-slate-400 text-sm font-medium mb-6">{user.id}</p>
                
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto w-fit mb-6">
                  <CheckCircle size={12} />
                  Verified Candidate
                </div>

                <button 
                  onClick={() => navigate(`/admit-card/${user.id}?download=true`)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-accent text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-accent/90 transition-all shadow-xl shadow-accent/20 group"
                >
                  <Download size={18} className="group-hover:bounce" />
                  Download Admit Card
                </button>

                <button 
                  onClick={() => navigate("/messenger")}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all group mt-4"
                >
                  <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
                  Open Messenger
                </button>
              </div>
            </motion.div>

            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface/50 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Status</p>
                  <p className="text-sm font-black text-white">{user.status}</p>
                </div>
                <div className="p-4 bg-surface/50 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Attendance</p>
                  <p className="text-sm font-black text-white">{user.attendanceStatus}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-surface rounded-2xl flex items-center justify-center border border-white/5">
                  <User className="text-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Profile Information</h2>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Manage your personal and academic details</p>
                </div>
              </div>

              {!editing ? (
                <button 
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <Edit3 size={16} />
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setEditing(false); setFormData(user); }}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-500 transition-all shadow-lg shadow-green-600/20"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Details */}
              <div className="glass-card p-8 rounded-3xl space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <FileText size={16} />
                  Personal Details
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Full Name (English)", name: "fullNameEnglish", icon: User },
                    { label: "Father's Name", name: "fatherNameEnglish", icon: User },
                    { label: "Mother's Name", name: "motherNameEnglish", icon: User },
                    { label: "Date of Birth", name: "dob", icon: Calendar, type: "date" },
                    { label: "Gender", name: "gender", icon: User, type: "select", options: ["Male", "Female", "Other"] },
                    { label: "Religion", name: "religion", icon: Shield, type: "select", options: ["Islam", "Hinduism", "Buddhism", "Christianity", "Other"] },
                  ].map((field: any) => (
                    <div key={field.name} className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{field.label}</label>
                      {editing ? (
                        field.type === "select" ? (
                          <select 
                            name={field.name} 
                            value={formData[field.name]} 
                            onChange={handleChange}
                            className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary appearance-none transition-all"
                          >
                            {field.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input 
                            type={field.type || "text"} 
                            name={field.name} 
                            value={formData[field.name]} 
                            onChange={handleChange}
                            className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary transition-all shadow-inner"
                          />
                        )
                      ) : (
                        <p className="text-sm font-bold text-slate-200">{user[field.name] || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact & Physical */}
              <div className="glass-card p-8 rounded-3xl space-y-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Phone size={16} />
                  Contact & Physical
                </h3>
                <div className="space-y-4">
                  {[
                    { label: "Phone Number", name: "studentPhone", icon: Phone },
                    { label: "Email Address", name: "studentEmail", icon: Mail },
                    { label: "Blood Group", name: "bloodGroup", icon: Droplets, type: "select", options: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
                    { label: "Height (Feet'Inches)", name: "heightCombined", icon: Ruler, isHeight: true },
                    { label: "Weight (Kg)", name: "weightKg", icon: Weight },
                  ].map((field: any) => (
                    <div key={field.name} className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{field.label}</label>
                      {editing ? (
                        field.isHeight ? (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <p className="text-[8px] font-bold text-slate-600 uppercase">Feet</p>
                              <input 
                                type="number" 
                                name="heightFeet" 
                                value={formData.heightFeet} 
                                onChange={handleChange}
                                className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary transition-all shadow-inner"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-[8px] font-bold text-slate-600 uppercase">Inches</p>
                              <input 
                                type="number" 
                                name="heightInches" 
                                value={formData.heightInches} 
                                onChange={handleChange}
                                className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary transition-all shadow-inner"
                              />
                            </div>
                          </div>
                        ) : field.type === "select" ? (
                          <select 
                            name={field.name} 
                            value={formData[field.name]} 
                            onChange={handleChange}
                            className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary appearance-none transition-all"
                          >
                            {field.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input 
                            type={field.type || "text"} 
                            name={field.name} 
                            value={formData[field.name]} 
                            onChange={handleChange}
                            className="w-full bg-surface border border-white/10 rounded-[1.2rem] px-5 py-3 text-sm text-white outline-none focus:border-primary transition-all shadow-inner"
                          />
                        )
                      ) : (
                        <p className="text-sm font-bold text-slate-200">
                          {field.isHeight 
                            ? `${user.heightFeet}'${user.heightInches}" (${user.heightFeet} feet ${user.heightInches} inches)`
                            : (user[field.name] || "—")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-bg-light/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md glass-card p-8 rounded-[2.5rem] space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Key className="text-primary" size={28} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Security Reset</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Update your access key</p>
              </div>

              <div className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest">
                    <AlertCircle size={14} />
                    {passwordError}
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">New Password Key</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-primary shadow-xl"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Confirm Key</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-surface border border-white/10 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-primary shadow-xl"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleChangePassword}
                  disabled={saving}
                  className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
