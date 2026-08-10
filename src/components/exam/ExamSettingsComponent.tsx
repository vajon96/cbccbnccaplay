import { useState, useEffect, FormEvent } from "react";
import { Settings, Save, CheckCircle2, Shield, Lock } from "lucide-react";
import { fetchExamSettings, updateExamSettings } from "../../services/examService";
import { ExamSetting } from "../../types";

interface ExamSettingsComponentProps {
  actorId?: string;
}

export function ExamSettingsComponent({ actorId = "admin" }: ExamSettingsComponentProps) {
  const [settings, setSettings] = useState<ExamSetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchExamSettings();
      setSettings(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      await updateExamSettings(settings, actorId);
      setNotice("Exam portal global settings updated successfully!");
      setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      console.error("Error updating settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-12 text-center text-slate-500 text-xs">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      
      {/* Header */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-white/10">
        <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Settings className="text-primary" size={22} />
          Global Examination Portal Settings
        </h2>
        <p className="text-slate-400 text-xs font-semibold mt-1">
          Configure default exam durations, pass criteria, and security guardrails
        </p>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 p-6 sm:p-8 rounded-2xl space-y-6 shadow-xl">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Default Exam Duration (Mins)</label>
            <input
              type="number"
              min="5"
              max="180"
              value={settings.defaultDurationMinutes}
              onChange={(e) => setSettings({ ...settings, defaultDurationMinutes: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-2">Default Pass Percentage (%)</label>
            <input
              type="number"
              min="10"
              max="100"
              value={settings.defaultPassPercentage}
              onChange={(e) => setSettings({ ...settings, defaultPassPercentage: Number(e.target.value) })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-white/5">
          <label className="flex items-center gap-3 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoSubmitOnTimeExpiry}
              onChange={(e) => setSettings({ ...settings, autoSubmitOnTimeExpiry: e.target.checked })}
              className="w-4 h-4 rounded text-primary"
            />
            Auto-submit candidate exam when time expires
          </label>

          <label className="flex items-center gap-3 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showLeaderboardToStudents}
              onChange={(e) => setSettings({ ...settings, showLeaderboardToStudents: e.target.checked })}
              className="w-4 h-4 rounded text-primary"
            />
            Allow candidates to view public leaderboard after submission
          </label>

          <label className="flex items-center gap-3 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowStudentReviewAnswers}
              onChange={(e) => setSettings({ ...settings, allowStudentReviewAnswers: e.target.checked })}
              className="w-4 h-4 rounded text-primary"
            />
            Allow candidates to review correct answer keys after exam completion
          </label>

          <label className="flex items-center gap-3 text-xs font-bold text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.preventTabSwitching}
              onChange={(e) => setSettings({ ...settings, preventTabSwitching: e.target.checked })}
              className="w-4 h-4 rounded text-rose-500"
            />
            Warn & log when candidate switches browser tabs during exam
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/10">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Exam Settings"}
          </button>
        </div>

      </form>

    </div>
  );
}
