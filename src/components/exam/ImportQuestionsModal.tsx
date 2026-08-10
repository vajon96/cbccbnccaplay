import { useState, ChangeEvent } from "react";
import { 
  Upload, FileSpreadsheet, Download, AlertCircle, 
  CheckCircle, X, HelpCircle, Save, Table 
} from "lucide-react";
import * as XLSX from "xlsx";
import { validateAndParseImportRows, bulkImportQuestions } from "../../services/examService";
import { QuestionBankItem } from "../../types";

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actorId?: string;
}

export function ImportQuestionsModal({ isOpen, onClose, onSuccess, actorId = "admin" }: ImportQuestionsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedValidRows, setParsedValidRows] = useState<Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; reason: string; data?: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  // Generate downloadable sample template
  const downloadSampleTemplate = () => {
    const templateData = [
      {
        Subject: "বাংলা",
        Type: "MCQ",
        Question: "অগ্নিবীণার রচয়িতা কে?",
        "Option A": "রবীন্দ্রনাথ ঠাকুর",
        "Option B": "কাজী নজরুল ইসলাম",
        "Option C": "জসীমউদ্দীন",
        "Option D": "সুকান্ত ভট্টাচার্য",
        Answer: "B",
        Marks: 1,
        Difficulty: "Easy",
        Tags: "bangla, literature",
        Explanation: "কাজী নজরুল ইসলামের প্রথম কাব্যগ্রন্থ अग्निবীণা।"
      },
      {
        Subject: "English",
        Type: "Fill in the Gaps",
        Question: "He is senior ___ me.",
        "Option A": "",
        "Option B": "",
        "Option C": "",
        "Option D": "",
        Answer: "to",
        Marks: 1,
        Difficulty: "Medium",
        Tags: "english, grammar",
        Explanation: "Senior takes preposition 'to'."
      },
      {
        Subject: "BNCC",
        Type: "MCQ",
        Question: "বিএনসিসি (BNCC) এর মূলমন্ত্র কি?",
        "Option A": "একতা, সততা, নিষ্ঠা",
        "Option B": "জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা",
        "Option C": "দেশপ্রেম, সাহস, সেবা",
        "Option D": "শৃঙ্খলা, আনুগত্য, একতা",
        Answer: "B",
        Marks: 1,
        Difficulty: "Easy",
        Tags: "bncc, motto",
        Explanation: "বিএনসিসির মূলমন্ত্র হলো 'জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা'।"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions_Template");
    XLSX.writeFile(workbook, "BNCC_Question_Bank_Import_Template.xlsx");
  };

  // Handle file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setSuccessMessage("");

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const { validRows, errors } = validateAndParseImportRows(data, actorId);
        setParsedValidRows(validRows);
        setImportErrors(errors);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        setImportErrors([{ row: 0, reason: "ফাইল রিড করতে ব্যর্থ হয়েছে: " + err.message }]);
      }
    };
    reader.readAsBinaryString(selected);
  };

  // Execute bulk save
  const handleConfirmImport = async () => {
    if (parsedValidRows.length === 0) return;
    setLoading(true);
    try {
      const count = await bulkImportQuestions(parsedValidRows, actorId);
      setSuccessMessage(`সফলভাবে ${count} টি প্রশ্ন Question Bank-এ যুক্ত হয়েছে!`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Import save error:", err);
      setImportErrors([{ row: 0, reason: "ডাটাবেজে প্রশ্ন সংরক্ষণ করতে সমস্যা: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Bulk Import Questions (CSV / XLSX)
              </h3>
              <p className="text-slate-400 text-xs font-semibold">
                Upload questions in batch to Question Bank
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Bar: Download Sample Template */}
        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-300 space-y-0.5">
            <span className="font-bold block text-amber-400">১. ডাউনলোড করুন Import Template</span>
            <span className="text-[11px] text-slate-400 block">
              Excel ফাইলে কলামের হেডারসমূহ সঠিকভাবে সাজাতে টেমপ্লেটটি ডাউনলোড করে পূরণ করুন।
            </span>
          </div>

          <button
            onClick={downloadSampleTemplate}
            type="button"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            <Download size={14} />
            Download Excel Template
          </button>
        </div>

        {/* File Dropzone */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase">
            ২. আপনার প্রস্তুতকৃত Excel / CSV ফাইল নির্বাচন করুন
          </label>
          <div className="border-2 border-dashed border-slate-700 hover:border-primary rounded-2xl p-6 text-center bg-slate-950/50 transition-all">
            <Upload size={32} className="mx-auto text-slate-500 mb-2" />
            <p className="text-xs text-slate-300 font-bold">
              {file ? file.name : "ফাইল ড্রপ করুন অথবা ব্রাউজ করুন (.xlsx, .csv)"}
            </p>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="mt-3 block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
        </div>

        {/* Validation Summary */}
        {file && (
          <div className="space-y-3 pt-2">
            
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle size={16} />
                Valid Questions Ready: {parsedValidRows.length}
              </span>

              {importErrors.length > 0 && (
                <span className="text-rose-400 flex items-center gap-1.5">
                  <AlertCircle size={16} />
                  Validation Errors: {importErrors.length}
                </span>
              )}
            </div>

            {/* Error Log Table if any */}
            {importErrors.length > 0 && (
              <div className="max-h-36 overflow-y-auto bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl space-y-1.5">
                <span className="text-[11px] font-bold text-rose-300 uppercase block">ত্রুটিযুক্ত সারি তালিকা (Validation Errors):</span>
                {importErrors.map((err, idx) => (
                  <div key={idx} className="text-[11px] text-rose-300 flex items-center justify-between">
                    <span>Row {err.row}: {err.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Preview snippet */}
            {parsedValidRows.length > 0 && (
              <div className="bg-slate-950 border border-white/5 p-3 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">প্রাকদর্শন (Preview of first 3 questions):</span>
                <div className="space-y-1">
                  {parsedValidRows.slice(0, 3).map((q, idx) => (
                    <div key={idx} className="text-xs text-slate-300 truncate pl-2 border-l-2 border-primary">
                      <span className="font-bold text-white">[{q.subject} - {q.questionType}]</span> {q.question}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold text-center">
            {successMessage}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase transition-all cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={parsedValidRows.length === 0 || loading}
            onClick={handleConfirmImport}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            {loading ? "Importing..." : `Confirm Import (${parsedValidRows.length})`}
          </button>
        </div>

      </div>
    </div>
  );
}
