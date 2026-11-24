import {
  auth, db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, handleFirestoreError, OperationType
} from "../firebase";
import { getServerAuthHeaders, getSession, isAuthorizedAdmin } from "../lib/auth";
import {
  QuestionBankItem, QuestionType, QuestionDifficulty, ExamModel, ExamStatus,
  ExamAttempt, ExamResult, ExamSetting, ExamActivityLog, RandomQuestionRule, AttemptStatus,
  EvaluationStatus, ManualQuestionEvaluation, MarksHistoryEntry, AnswerScriptAuditLog
} from "../types";

async function getAuthHeaders(): Promise<Record<string, string>> {
  return await getServerAuthHeaders({ "Content-Type": "application/json" });
}

function isFirestorePermissionError(error: any): boolean {
  const code = String(error?.code || "").toLowerCase();
  const msg = String(error?.message || "").toLowerCase();
  return code === "permission-denied" || msg.includes("missing or insufficient permissions");
}

async function examApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(path, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
    credentials: "include",
  });
}

async function tryMirrorToServer(path: string, method: string, body: unknown): Promise<void> {
  try {
    await examApiFetch(path, {
      method,
      body: JSON.stringify(body),
    });
  } catch {
    // Non-blocking background sync to server store
  }
}

export function stripQuestionKeys(q: QuestionBankItem): QuestionBankItem {
  const { correctAnswer: _c, acceptedAnswers: _a, expectedAnswer: _e, explanation: _ex, ...safeQ } = q as any;
  return safeQ as QuestionBankItem;
}

async function sealExamKeysToVault(
  examId: string,
  questions: QuestionBankItem[],
  negativePenalty: number = 0,
  passMarks: number = 0
): Promise<string | undefined> {
  const payload = questions.map(q => ({
    id: q.id,
    questionType: q.questionType || "mcq",
    correctAnswer: q.correctAnswer ?? "",
    acceptedAnswers: q.acceptedAnswers || [],
    marks: q.marks || 1,
  }));

  let sealedPayload: string | undefined;
  try {
    const res = await examApiFetch("/api/exam/keys", {
      method: "POST",
      body: JSON.stringify({ examId, questions: payload, negativePenalty, passMarks }),
    });
    if (res.ok) {
      const data = await res.json();
      sealedPayload = data?.sealedPayload;
    }
  } catch (err) {
    console.warn("Could not seal exam keys on server vault:", err);
  }

  if (auth.currentUser) {
    try {
      await setDoc(doc(db, "exam_answer_keys", examId), {
        examId,
        sealedPayload: sealedPayload || "",
        keysCount: payload.length,
        negativePenalty,
        passMarks,
        keys: payload,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Could not persist exam_answer_keys doc:", err);
    }
  }

  return sealedPayload;
}

async function patchAttemptEverywhere(attemptId: string, patch: Record<string, any>): Promise<void> {
  let firestoreUpdated = false;
  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, "exam_attempts", attemptId), patch);
      firestoreUpdated = true;
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        throw err;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!firestoreUpdated && !res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to update exam attempt.");
  }
}

async function upsertExamResultEverywhere(
  existingResultId: string | null,
  resultPayload: Record<string, any>
): Promise<void> {
  let firestoreSaved = false;
  if (auth.currentUser) {
    try {
      if (existingResultId) {
        await updateDoc(doc(db, "exam_results", existingResultId), resultPayload);
      } else {
        const newResRef = doc(collection(db, "exam_results"));
        await setDoc(newResRef, { ...resultPayload, id: resultPayload.id || newResRef.id });
      }
      firestoreSaved = true;
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        throw err;
      }
    }
  }

  const res = await examApiFetch("/api/exam/results", {
    method: "POST",
    body: JSON.stringify(resultPayload),
  });
  if (!firestoreSaved && !res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to save exam result.");
  }
}

// ============================================================================
// QUESTION BANK SERVICES
// ============================================================================

export async function fetchQuestions(filters?: {
  subject?: string;
  questionType?: string;
  difficulty?: string;
  search?: string;
  isActiveOnly?: boolean;
}): Promise<QuestionBankItem[]> {
  let items: QuestionBankItem[] | null = null;

  if (auth.currentUser) {
    try {
      const qRef = collection(db, "question_bank");
      const q = query(qRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      items = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as QuestionBankItem));
      void tryMirrorToServer("/api/exam/sync-batch", "POST", { questions: items });
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching question bank from Firestore:", error);
      }
    }
  }

  if (items === null) {
    try {
      const res = await examApiFetch("/api/exam/questions");
      if (res.ok) {
        const data = await res.json();
        items = Array.isArray(data?.questions) ? data.questions : [];
      } else if (res.status === 401 || res.status === 403) {
        items = [];
      } else {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to load questions from server.");
      }
    } catch (error) {
      console.error("Error fetching question bank:", error);
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.GET, "question_bank");
      }
      return [];
    }
  }

  if (filters) {
    if (filters.isActiveOnly) {
      items = items.filter(q => q.isActive !== false);
    }
    if (filters.subject && filters.subject !== "ALL") {
      items = items.filter(q => q.subject === filters.subject);
    }
    if (filters.questionType && filters.questionType !== "ALL") {
      items = items.filter(q => q.questionType === filters.questionType);
    }
    if (filters.difficulty && filters.difficulty !== "ALL") {
      items = items.filter(q => q.difficulty === filters.difficulty);
    }
    if (filters.search && filters.search.trim()) {
      const s = filters.search.toLowerCase().trim();
      items = items.filter(q =>
        q.question.toLowerCase().includes(s) ||
        q.subject.toLowerCase().includes(s) ||
        (q.tags && q.tags.some(t => t.toLowerCase().includes(s))) ||
        q.id.toLowerCase().includes(s)
      );
    }
  }

  return items;
}

export async function addQuestion(question: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const now = new Date().toISOString();

  if (auth.currentUser) {
    try {
      const docRef = doc(collection(db, "question_bank"));
      const newItem: QuestionBankItem = {
        ...question,
        id: docRef.id,
        createdAt: now,
        updatedAt: now,
        isActive: question.isActive ?? true
      };
      await setDoc(docRef, newItem);
      void tryMirrorToServer("/api/exam/questions", "POST", newItem);
      await logExamActivity({
        action: "QUESTION_CREATED",
        targetId: docRef.id,
        actorId: question.createdBy || "admin",
        details: `Created question: ${question.question.substring(0, 40)}... (${question.subject} - ${question.questionType})`
      });
      return docRef.id;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error adding question:", error);
        handleFirestoreError(error, OperationType.CREATE, "question_bank");
        throw error;
      }
    }
  }

  const res = await examApiFetch("/api/exam/questions", {
    method: "POST",
    body: JSON.stringify({
      ...question,
      isActive: question.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to add question.");
  }
  const data = await res.json();
  return data.id;
}

export async function updateQuestion(id: string, updates: Partial<QuestionBankItem>, actorId: string = "admin"): Promise<void> {
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString()
  };

  if (auth.currentUser) {
    try {
      const docRef = doc(db, "question_bank", id);
      await updateDoc(docRef, updatedData);
      void tryMirrorToServer(`/api/exam/questions/${encodeURIComponent(id)}`, "PATCH", { ...updatedData, actorId });
      await logExamActivity({
        action: "QUESTION_UPDATED",
        targetId: id,
        actorId,
        details: `Updated question ID ${id}`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error updating question:", error);
        handleFirestoreError(error, OperationType.UPDATE, `question_bank/${id}`);
        throw error;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/questions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ ...updatedData, actorId }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to update question.");
  }
}

export async function deleteQuestion(id: string, actorId: string = "admin", softDelete = true): Promise<void> {
  if (auth.currentUser) {
    try {
      if (softDelete) {
        await updateQuestion(id, { isActive: false }, actorId);
      } else {
        await deleteDoc(doc(db, "question_bank", id));
        void tryMirrorToServer(`/api/exam/questions/${encodeURIComponent(id)}?soft=false`, "DELETE", {});
      }
      await logExamActivity({
        action: "QUESTION_DELETED",
        targetId: id,
        actorId,
        details: `${softDelete ? "Soft deleted" : "Permanently deleted"} question ID ${id}`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error deleting question:", error);
        handleFirestoreError(error, OperationType.DELETE, `question_bank/${id}`);
        throw error;
      }
    }
  }

  const res = await examApiFetch(
    `/api/exam/questions/${encodeURIComponent(id)}?soft=${softDelete ? "true" : "false"}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to delete question.");
  }
}

export async function duplicateQuestion(id: string, actorId: string = "admin"): Promise<string> {
  try {
    let data: QuestionBankItem | null = null;
    if (auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, "question_bank", id));
        if (snap.exists()) data = snap.data() as QuestionBankItem;
      } catch (err) {
        if (!isFirestorePermissionError(err)) throw err;
      }
    }
    if (!data) {
      const all = await fetchQuestions();
      data = all.find(q => q.id === id) || null;
    }
    if (!data) throw new Error("Question not found");

    return await addQuestion({
      ...data,
      question: `${data.question} (Copy)`,
      createdBy: actorId,
      isActive: true
    });
  } catch (error) {
    console.error("Error duplicating question:", error);
    throw error;
  }
}

// ============================================================================
// BULK QUESTION IMPORT UTILS & SEEDING
// ============================================================================

export interface ImportValidationResult {
  validRows: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[];
  errors: { row: number; reason: string; data?: any }[];
}

export function validateAndParseImportRows(rows: any[], createdBy: string = "admin"): ImportValidationResult {
  const validRows: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[] = [];
  const errors: { row: number; reason: string; data?: any }[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const subject = (row.Subject || row.subject || "").toString().trim();
    const typeRaw = (row.Type || row.questionType || row.type || "").toString().trim().toLowerCase();
    const question = (row.Question || row.question || "").toString().trim();
    const marks = Number(row.Marks || row.marks || 1);
    const difficultyRaw = (row.Difficulty || row.difficulty || "medium").toString().trim().toLowerCase();

    if (!subject) {
      errors.push({ row: rowNum, reason: "Missing Subject (বিষয়ের নাম খালি)", data: row });
      return;
    }
    if (!question) {
      errors.push({ row: rowNum, reason: "Missing Question text (প্রশ্ন খালি)", data: row });
      return;
    }

    let questionType: QuestionType = "mcq";
    if (typeRaw.includes("mcq") || typeRaw.includes("বহুনির্বাচনী")) {
      questionType = "mcq";
    } else if (typeRaw.includes("fill") || typeRaw.includes("gap") || typeRaw.includes("শূন্যস্থান")) {
      questionType = "fill_gaps";
    } else if (typeRaw.includes("tag") || typeRaw.includes("ট্যাগ")) {
      questionType = "tag_question";
    } else if (typeRaw.includes("change") || typeRaw.includes("changing") || typeRaw.includes("বাক্য পরিবর্তন")) {
      questionType = "changing_sentence";
    } else if (typeRaw.includes("short") || typeRaw.includes("সংক্ষিপ্ত")) {
      questionType = "short_question";
    } else if (typeRaw.includes("true") || typeRaw.includes("false") || typeRaw.includes("সত্য/মিথ্যা")) {
      questionType = "true_false";
    }

    let difficulty: QuestionDifficulty = "medium";
    if (difficultyRaw.includes("easy") || difficultyRaw.includes("সহজ")) difficulty = "easy";
    if (difficultyRaw.includes("hard") || difficultyRaw.includes("কঠিন")) difficulty = "hard";

    const answerRaw = (row.Answer || row.correctAnswer || row.answer || "").toString().trim();

    if (questionType === "mcq") {
      const optA = (row["Option A"] || row.optionA || row.A || "").toString().trim();
      const optB = (row["Option B"] || row.optionB || row.B || "").toString().trim();
      const optC = (row["Option C"] || row.optionC || row.C || "").toString().trim();
      const optD = (row["Option D"] || row.optionD || row.D || "").toString().trim();

      if (!optA || !optB || !optC || !optD) {
        errors.push({ row: rowNum, reason: "MCQ requires all 4 options (Option A, B, C, D)", data: row });
        return;
      }

      let normalizedAns = answerRaw.toUpperCase();
      if (!["A", "B", "C", "D"].includes(normalizedAns)) {
        if (answerRaw === optA) normalizedAns = "A";
        else if (answerRaw === optB) normalizedAns = "B";
        else if (answerRaw === optC) normalizedAns = "C";
        else if (answerRaw === optD) normalizedAns = "D";
        else normalizedAns = "A";
      }

      validRows.push({
        subject,
        questionType: "mcq",
        question,
        options: { A: optA, B: optB, C: optC, D: optD },
        correctAnswer: normalizedAns,
        marks: marks > 0 ? marks : 1,
        difficulty,
        tags: row.Tags ? row.Tags.toString().split(",").map((t: string) => t.trim()) : [],
        explanation: row.Explanation || row.explanation || "",
        isActive: true,
        createdBy
      });
    } else if (questionType === "true_false") {
      let normalizedAns = "True";
      if (answerRaw.toLowerCase() === "f" || answerRaw.toLowerCase() === "false" || answerRaw.includes("মিথ্যা")) {
        normalizedAns = "False";
      }
      validRows.push({
        subject,
        questionType: "true_false",
        question,
        options: { A: "True", B: "False" },
        correctAnswer: normalizedAns,
        marks: marks > 0 ? marks : 1,
        difficulty,
        tags: row.Tags ? row.Tags.toString().split(",").map((t: string) => t.trim()) : [],
        explanation: row.Explanation || row.explanation || "",
        isActive: true,
        createdBy
      });
    } else {
      const accepted = answerRaw ? [answerRaw] : [];
      validRows.push({
        subject,
        questionType,
        question,
        correctAnswer: answerRaw,
        acceptedAnswers: accepted,
        expectedAnswer: answerRaw,
        marks: marks > 0 ? marks : 1,
        difficulty,
        tags: row.Tags ? row.Tags.toString().split(",").map((t: string) => t.trim()) : [],
        explanation: row.Explanation || row.explanation || "",
        isActive: true,
        createdBy
      });
    }
  });

  return { validRows, errors };
}

export async function bulkImportQuestions(
  items: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[],
  actorId: string = "admin"
): Promise<number> {
  const now = new Date().toISOString();

  if (auth.currentUser) {
    try {
      const batchSize = 400;
      let importedCount = 0;
      const prepared: QuestionBankItem[] = [];

      for (let i = 0; i < items.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = items.slice(i, i + batchSize);
        chunk.forEach(item => {
          const ref = doc(collection(db, "question_bank"));
          const data: QuestionBankItem = {
            ...item,
            id: ref.id,
            createdAt: now,
            updatedAt: now,
            isActive: true
          };
          batch.set(ref, data);
          prepared.push(data);
          importedCount++;
        });
        await batch.commit();
      }

      void tryMirrorToServer("/api/exam/questions/bulk", "POST", { items: prepared, actorId });
      await logExamActivity({
        action: "QUESTION_IMPORTED",
        targetId: "bulk",
        actorId,
        details: `Successfully bulk imported ${importedCount} questions into Question Bank.`
      });

      return importedCount;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error bulk importing questions:", error);
        handleFirestoreError(error, OperationType.WRITE, "question_bank");
        throw error;
      }
    }
  }

  const res = await examApiFetch("/api/exam/questions/bulk", {
    method: "POST",
    body: JSON.stringify({ items, actorId }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to bulk import questions.");
  }
  const data = await res.json();
  return Number(data?.count) || 0;
}

export async function seedDefaultQuestionsIfEmpty(actorId: string = "system"): Promise<void> {
  try {
    const questions = await fetchQuestions();
    if (questions.length > 0) return;

    const defaults: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[] = [
      {
        subject: "BNCC",
        questionType: "mcq",
        question: "বিএনসিসি (BNCC) এর পূর্ণরূপ কোনটি?",
        options: {
          A: "Bangladesh National Cadet Corps",
          B: "Bangladesh Naval Cadet Corps",
          C: "Bangladesh National Army Corps",
          D: "Bangladesh National College Corps"
        },
        correctAnswer: "A",
        marks: 1,
        difficulty: "easy",
        tags: ["bncc", "basics"],
        explanation: "BNCC stands for Bangladesh National Cadet Corps.",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "BNCC",
        questionType: "mcq",
        question: "বিএনসিসি (BNCC)-এর মূলমন্ত্র কি?",
        options: {
          A: "একতা, সততা, নিষ্ঠা",
          B: "জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা",
          C: "দেশপ্রেম, সাহস, সেবা",
          D: "শৃঙ্খলা, আনুগত্য, একতা"
        },
        correctAnswer: "B",
        marks: 1,
        difficulty: "easy",
        tags: ["motto", "bncc"],
        explanation: "বিএনসিসির মূলমন্ত্র হলো 'জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা' (Knowledge, Discipline, Spirit).",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "বাংলা",
        questionType: "mcq",
        question: "'অগ্নিবীণা' কাব্যগ্রন্থের রচয়িতা কে?",
        options: {
          A: "রবীন্দ্রনাথ ঠাকুর",
          B: "কাজী নজরুল ইসলাম",
          C: "জসীমউদ্দীন",
          D: "সুকান্ত ভট্টাচার্য"
        },
        correctAnswer: "B",
        marks: 1,
        difficulty: "easy",
        tags: ["bangla", "literature"],
        explanation: "কাজী নজরুল ইসলামের প্রথম কাব্যগ্রন্থ 'অগ্নিবীণা' ১৯২২ সালে প্রকাশিত হয়।",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "English",
        questionType: "fill_gaps",
        question: "He is senior ___ me in service.",
        correctAnswer: "to",
        acceptedAnswers: ["to"],
        expectedAnswer: "to",
        marks: 1,
        difficulty: "medium",
        tags: ["english", "preposition"],
        explanation: "'Senior' takes the preposition 'to' after it.",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "English",
        questionType: "tag_question",
        question: "Let's start the BNCC selection test, ___?",
        correctAnswer: "shall we",
        acceptedAnswers: ["shall we", "shall we?"],
        expectedAnswer: "shall we",
        marks: 1,
        difficulty: "medium",
        tags: ["english", "grammar"],
        explanation: "Imperative sentences starting with 'Let's' take 'shall we' as tag question.",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "গণিত",
        questionType: "mcq",
        question: "১ থেকে ১০০ পর্যন্ত মৌলিক সংখ্যা কয়টি?",
        options: {
          A: "২০টি",
          B: "২২টি",
          C: "২৫টি",
          D: "৩০টি"
        },
        correctAnswer: "C",
        marks: 1,
        difficulty: "easy",
        tags: ["math", "prime_numbers"],
        explanation: "১ থেকে ১০০ এর মধ্যে মোট ২৫টি মৌলিক সংখ্যা রয়েছে।",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "সাধারণ বিজ্ঞান",
        questionType: "true_false",
        question: "সূর্যের আলোতে ভিটামিন-ডি পাওয়া যায়।",
        options: { A: "True", B: "False" },
        correctAnswer: "True",
        marks: 1,
        difficulty: "easy",
        tags: ["science", "vitamins"],
        explanation: "সূর্যের অতিবেগুনি রশ্মির উপস্থিতিতে ত্বকে ভিটামিন ডি তৈরি হয়।",
        isActive: true,
        createdBy: actorId
      },
      {
        subject: "বাংলাদেশ ও আন্তর্জাতিক বিষয়াবলি",
        questionType: "mcq",
        question: "কক্সবাজার সমুদ্র সৈকতের দৈর্ঘ্য কত কিলোমিটার?",
        options: {
          A: "১০০ কিমি",
          B: "১২০ কিমি",
          C: "১৫০ কিমি",
          D: "২০০ কিমি"
        },
        correctAnswer: "B",
        marks: 1,
        difficulty: "medium",
        tags: ["coxsbazar", "geography"],
        explanation: "কক্সবাজার সমুদ্র সৈকত পৃথিবীর দীর্ঘতম প্রাকৃতিক বালুকাময় সমুদ্র সৈকত (প্রায় ১২০ কিমি)।",
        isActive: true,
        createdBy: actorId
      }
    ];

    await bulkImportQuestions(defaults, "system");
  } catch (error) {
    console.error("Error seeding default questions:", error);
  }
}

// ============================================================================
// EXAM MANAGEMENT SERVICES
// ============================================================================

export async function fetchExams(statusFilter?: ExamStatus | ExamStatus[]): Promise<ExamModel[]> {
  let items: ExamModel[] | null = null;

  if (auth.currentUser) {
    try {
      const ref = collection(db, "exams");
      const statusArr = statusFilter
        ? Array.isArray(statusFilter)
          ? statusFilter
          : [statusFilter]
        : null;
      const q =
        statusArr && statusArr.length > 0 && statusArr.length <= 10
          ? query(ref, where("status", "in", statusArr))
          : query(ref, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      items = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ExamModel))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      if (!statusFilter) {
        void tryMirrorToServer("/api/exam/sync-batch", "POST", { exams: items });
      }
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching exams from Firestore:", error);
      }
    }
  }

  if (items === null) {
    try {
      const res = await examApiFetch("/api/exam/exams");
      if (res.ok) {
        const data = await res.json();
        items = Array.isArray(data?.exams) ? data.exams : [];
      } else if (res.status === 401 || res.status === 403) {
        items = [];
      } else {
        throw new Error("Failed to fetch exams from server.");
      }
    } catch (error) {
      console.error("Error fetching exams:", error);
      return [];
    }
  }

  if (statusFilter) {
    if (Array.isArray(statusFilter)) {
      items = items.filter(e => statusFilter.includes(e.status));
    } else {
      items = items.filter(e => e.status === statusFilter);
    }
  }
  return items;
}

export async function getExamById(id: string): Promise<ExamModel | null> {
  if (auth.currentUser) {
    try {
      const snap = await getDoc(doc(db, "exams", id));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as ExamModel;
      }
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error getting exam by ID from Firestore:", error);
      }
    }
  }

  try {
    const res = await examApiFetch(`/api/exam/exams/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.exam || null;
  } catch (error) {
    console.error("Error getting exam by ID:", error);
    return null;
  }
}

export async function createExam(examData: Omit<ExamModel, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const now = new Date().toISOString();

  let snapshots: QuestionBankItem[] = [];
  if (examData.questionSelectionMode === "manual" && examData.selectedQuestionIds && examData.selectedQuestionIds.length > 0) {
    const allQ = await fetchQuestions();
    snapshots = allQ.filter(q => examData.selectedQuestionIds?.includes(q.id));
  } else if (examData.questionSelectionMode === "random" && examData.randomRules) {
    snapshots = await generateRandomQuestionSet(examData.randomRules);
  }

  const calculatedTotalMarks = snapshots.length > 0
    ? snapshots.reduce((acc, curr) => acc + (curr.marks || 1), 0)
    : (examData.totalMarks || 100);

  const negativePenalty = (examData.negativeMarking?.enabled && examData.negativeMarking.marksPerWrongAnswer > 0)
    ? examData.negativeMarking.marksPerWrongAnswer
    : 0;

  if (auth.currentUser) {
    try {
      const docRef = doc(collection(db, "exams"));
      const sealedKeyEnvelope = snapshots.length > 0
        ? await sealExamKeysToVault(docRef.id, snapshots, negativePenalty, examData.passMarks || 0)
        : undefined;

      const sanitizedSnapshots = snapshots.map(stripQuestionKeys);
      const newExam: ExamModel = {
        ...examData,
        id: docRef.id,
        totalMarks: calculatedTotalMarks,
        questionSnapshots: sanitizedSnapshots,
        ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
        createdAt: now,
        updatedAt: now
      };

      await setDoc(docRef, newExam);
      void tryMirrorToServer("/api/exam/exams", "POST", {
        ...newExam,
        questionSnapshots: snapshots,
      });

      await logExamActivity({
        action: "EXAM_CREATED",
        targetId: docRef.id,
        actorId: examData.createdBy || "admin",
        details: `Created exam '${examData.title}' (${snapshots.length} questions, Total Marks: ${calculatedTotalMarks})`
      });

      return docRef.id;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error creating exam:", error);
        handleFirestoreError(error, OperationType.CREATE, "exams");
        throw error;
      }
    }
  }

  const res = await examApiFetch("/api/exam/exams", {
    method: "POST",
    body: JSON.stringify({
      ...examData,
      totalMarks: calculatedTotalMarks,
      questionSnapshots: snapshots,
      createdAt: now,
      updatedAt: now,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to create exam.");
  }
  const data = await res.json();
  return data.id;
}

export async function updateExam(id: string, updates: Partial<ExamModel>, actorId: string = "admin"): Promise<void> {
  const existing = await getExamById(id);
  if (!existing) throw new Error("Exam not found");

  let snapshots = updates.questionSnapshots || existing.questionSnapshots || [];

  if (updates.questionSelectionMode === "manual" && updates.selectedQuestionIds) {
    const allQ = await fetchQuestions();
    snapshots = allQ.filter(q => updates.selectedQuestionIds?.includes(q.id));
  } else if (updates.questionSelectionMode === "random" && updates.randomRules) {
    snapshots = await generateRandomQuestionSet(updates.randomRules);
  } else if (snapshots.length > 0) {
    try {
      const allQ = await fetchQuestions();
      const bankMap = new Map(allQ.map(q => [q.id, q]));
      snapshots = snapshots.map(q => bankMap.get(q.id) || q);
    } catch {
      // Keep snapshots if question_bank read skipped
    }
  }

  const calculatedTotalMarks = snapshots.length > 0
    ? snapshots.reduce((acc, curr) => acc + (curr.marks || 1), 0)
    : (updates.totalMarks || existing.totalMarks);

  const negConfig = updates.negativeMarking ?? existing.negativeMarking;
  const negativePenalty = (negConfig?.enabled && negConfig.marksPerWrongAnswer > 0)
    ? negConfig.marksPerWrongAnswer
    : 0;
  const passMarks = updates.passMarks ?? existing.passMarks ?? 0;

  let sealedKeyEnvelope = existing.sealedKeyEnvelope;
  if (snapshots.length > 0 && snapshots.some(q => q.correctAnswer !== undefined)) {
    sealedKeyEnvelope = await sealExamKeysToVault(id, snapshots, negativePenalty, passMarks) || sealedKeyEnvelope;
  }

  const updatedData: any = {
    ...updates,
    questionSnapshots: snapshots.map(stripQuestionKeys),
    ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
    totalMarks: calculatedTotalMarks,
    updatedAt: new Date().toISOString()
  };

  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, "exams", id), updatedData);
      void tryMirrorToServer(`/api/exam/exams/${encodeURIComponent(id)}`, "PATCH", {
        ...updates,
        questionSnapshots: snapshots,
        ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
        totalMarks: calculatedTotalMarks,
      });
      await logExamActivity({
        action: "EXAM_UPDATED",
        targetId: id,
        actorId,
        details: `Updated exam '${updates.title || existing.title}'`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error updating exam:", error);
        handleFirestoreError(error, OperationType.UPDATE, `exams/${id}`);
        throw error;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/exams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...updates,
      questionSnapshots: snapshots,
      ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
      totalMarks: calculatedTotalMarks,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to update exam.");
  }
}

export async function publishExam(id: string, actorId: string = "admin"): Promise<void> {
  const exam = await getExamById(id);
  if (!exam) throw new Error("Exam not found");

  if (!exam.title || !exam.durationMinutes || exam.durationMinutes <= 0) {
    throw new Error("Exam must have a title and valid duration before publishing.");
  }

  if (!exam.questionSnapshots || exam.questionSnapshots.length === 0) {
    throw new Error("Exam has no selected questions. Please add questions before publishing.");
  }

  const allQ = await fetchQuestions();
  const bankMap = new Map(allQ.map(q => [q.id, q]));
  const fullQuestions = exam.questionSnapshots.map(q => bankMap.get(q.id) || q);
  const negativePenalty = (exam.negativeMarking?.enabled && exam.negativeMarking.marksPerWrongAnswer > 0)
    ? exam.negativeMarking.marksPerWrongAnswer
    : 0;
  const sealedKeyEnvelope =
    (await sealExamKeysToVault(id, fullQuestions, negativePenalty, exam.passMarks || 0)) ||
    exam.sealedKeyEnvelope;

  const patch = {
    status: "published" as ExamStatus,
    questionSnapshots: fullQuestions.map(stripQuestionKeys),
    ...(sealedKeyEnvelope ? { sealedKeyEnvelope } : {}),
    updatedAt: new Date().toISOString()
  };

  if (auth.currentUser) {
    try {
      await updateDoc(doc(db, "exams", id), patch);
      void tryMirrorToServer(`/api/exam/exams/${encodeURIComponent(id)}`, "PATCH", {
        ...patch,
        questionSnapshots: fullQuestions,
      });
      await logExamActivity({
        action: "EXAM_PUBLISHED",
        targetId: id,
        actorId,
        details: `Published exam '${exam.title}'`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        throw error;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/exams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...patch,
      questionSnapshots: fullQuestions,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to publish exam.");
  }
}

export async function deleteExam(id: string, actorId: string = "admin"): Promise<void> {
  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, "exams", id));
      void tryMirrorToServer(`/api/exam/exams/${encodeURIComponent(id)}`, "DELETE", {});
      await logExamActivity({
        action: "EXAM_UPDATED",
        targetId: id,
        actorId,
        details: `Deleted exam ID ${id}`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error deleting exam:", error);
        handleFirestoreError(error, OperationType.DELETE, `exams/${id}`);
        throw error;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/exams/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to delete exam.");
  }
}

export async function duplicateExam(id: string, actorId: string = "admin"): Promise<string> {
  const exam = await getExamById(id);
  if (!exam) throw new Error("Exam not found");

  return await createExam({
    ...exam,
    title: `${exam.title} (Copy)`,
    status: "draft",
    createdBy: actorId
  });
}

export async function generateRandomQuestionSet(rules: RandomQuestionRule[]): Promise<QuestionBankItem[]> {
  const allQ = await fetchQuestions({ isActiveOnly: true });
  const selected: QuestionBankItem[] = [];
  const usedIds = new Set<string>();

  rules.forEach(rule => {
    let pool = allQ.filter(q => q.subject === rule.subject && !usedIds.has(q.id));
    if (rule.questionType) {
      pool = pool.filter(q => q.questionType === rule.questionType);
    }

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const countToPick = Math.min(rule.count, shuffled.length);

    for (let i = 0; i < countToPick; i++) {
      selected.push(shuffled[i]);
      usedIds.add(shuffled[i].id);
    }
  });

  return selected;
}

// ============================================================================
// CANDIDATE ATTEMPT & EXAM ENGINE
// ============================================================================

export async function startExamAttempt(params: {
  examId: string;
  candidateId: string;
  userId: string;
  registrationNumber: string;
  candidateName?: string;
  candidatePhoto?: string;
  session?: string;
  collegeName?: string;
}): Promise<ExamAttempt> {
  const { examId, candidateId, userId, registrationNumber, candidateName, candidatePhoto, session, collegeName } = params;

  if (auth.currentUser) {
    try {
      const exam = await getExamById(examId);
      if (!exam) throw new Error("পরীক্ষাটি পাওয়া যায়নি (Exam not found).");

      if (exam.status !== "published" && exam.status !== "live") {
        throw new Error("পরীক্ষাটি বর্তমানে সক্রিয় নয় (Exam is not active).");
      }

      const authUid = auth.currentUser.uid;
      const attemptsRef = collection(db, "exam_attempts");

      let existingAttempts: ExamAttempt[] = [];
      try {
        const q = query(attemptsRef, where("ownerUid", "==", authUid));
        const snap = await getDocs(q);
        existingAttempts = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ExamAttempt))
          .filter(a => a.examId === examId);
      } catch {
        existingAttempts = [];
      }

      const inProgress = existingAttempts.find(a => a.status === "in_progress");
      if (inProgress) {
        return inProgress;
      }

      const completedCount = existingAttempts.filter(
        a => a.status === "submitted" || a.status === "auto_submitted" || a.status === "expired"
      ).length;
      if (exam.maxAttempts > 0 && completedCount >= exam.maxAttempts) {
        throw new Error(`আপনার সর্বোচ্চ Attempt (${exam.maxAttempts} টি) পূর্ণ হয়ে গেছে।`);
      }

      let questions = exam.questionSnapshots || [];
      if (questions.length === 0) {
        if (exam.selectedQuestionIds && exam.selectedQuestionIds.length > 0) {
          const allQ = await fetchQuestions();
          questions = allQ.filter(q => exam.selectedQuestionIds?.includes(q.id));
        }
        if (questions.length === 0 && exam.randomRules && exam.randomRules.length > 0) {
          questions = await generateRandomQuestionSet(exam.randomRules);
        }
      }

      if (questions.length === 0) {
        throw new Error("পরীক্ষায় কোনো প্রশ্ন যুক্ত করা হয়নি। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।");
      }

      const normalizedQuestions = questions.map(q => {
        const qText = (q as any).question || (q as any).questionText || (q as any).question_text || (q as any).text || (q as any).title || (q as any).content || (q as any).name || "Question text unavailable";
        return {
          ...q,
          question: qText
        };
      });

      let finalQuestions = [...normalizedQuestions];
      if (exam.shuffleQuestions) {
        finalQuestions = finalQuestions.sort(() => 0.5 - Math.random());
      }

      const candidateSafeSnapshot = finalQuestions.map(stripQuestionKeys);
      const docRef = doc(collection(db, "exam_attempts"));
      const now = new Date().toISOString();

      const attempt: ExamAttempt = {
        id: docRef.id,
        examId,
        examTitle: exam.title,
        candidateId,
        userId,
        ownerUid: authUid,
        registrationNumber,
        candidateName: candidateName || "Candidate",
        candidatePhoto: candidatePhoto || "",
        session: session || "",
        collegeName: collegeName || "",
        startedAt: now,
        status: "in_progress",
        questionSnapshot: candidateSafeSnapshot,
        answers: {},
        createdAt: now,
        updatedAt: now
      };

      await setDoc(docRef, attempt);
      void tryMirrorToServer("/api/exam/attempts", "POST", attempt);

      await logExamActivity({
        action: "EXAM_STARTED",
        targetId: examId,
        actorId: userId,
        details: `Candidate '${candidateName}' (${userId}) started attempt on '${exam.title}'`
      });

      return attempt;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error starting exam attempt:", error);
        throw error;
      }
    }
  }

  const res = await examApiFetch("/api/exam/attempts", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "পরীক্ষা শুরু করা যায়নি।");
  }
  const data = await res.json();
  return data.attempt as ExamAttempt;
}

export async function saveAttemptAnswer(params: {
  attemptId: string;
  questionId: string;
  selectedAnswer: string | string[];
  isMarkedForReview?: boolean;
}): Promise<void> {
  const { attemptId, questionId, selectedAnswer, isMarkedForReview } = params;

  if (auth.currentUser) {
    try {
      const docRef = doc(db, "exam_attempts", attemptId);
      await updateDoc(docRef, {
        [`answers.${questionId}`]: {
          questionId,
          selectedAnswer,
          answeredAt: new Date().toISOString(),
          isMarkedForReview: isMarkedForReview ?? false
        },
        updatedAt: new Date().toISOString()
      });
      void tryMirrorToServer(`/api/exam/attempts/${encodeURIComponent(attemptId)}/answers`, "POST", {
        questionId,
        selectedAnswer,
        isMarkedForReview: isMarkedForReview ?? false,
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error saving attempt answer:", error);
        handleFirestoreError(error, OperationType.UPDATE, `exam_attempts/${attemptId}`);
        return;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}/answers`, {
    method: "POST",
    body: JSON.stringify({
      questionId,
      selectedAnswer,
      isMarkedForReview: isMarkedForReview ?? false,
    }),
  });
  if (!res.ok) {
    console.warn("Could not save answer on server:", res.status);
  }
}

export async function getAttemptById(attemptId: string): Promise<ExamAttempt | null> {
  if (auth.currentUser) {
    try {
      const snap = await getDoc(doc(db, "exam_attempts", attemptId));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as ExamAttempt;
      }
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error getting attempt by ID:", error);
      }
    }
  }

  try {
    const res = await examApiFetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.attempt || null;
  } catch (error) {
    console.error("Error getting attempt by ID:", error);
    return null;
  }
}

export async function getUserAttempts(userId: string): Promise<ExamAttempt[]> {
  if (auth.currentUser) {
    try {
      const ref = collection(db, "exam_attempts");
      const q = query(ref, where("ownerUid", "==", auth.currentUser.uid));
      const snap = await getDocs(q);
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ExamAttempt))
        .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
      if (list.length > 0) return list;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error getting user attempts:", error);
      }
    }
  }

  try {
    const res = await examApiFetch("/api/exam/attempts");
    if (!res.ok) return [];
    const data = await res.json();
    const all: ExamAttempt[] = Array.isArray(data?.attempts) ? data.attempts : [];
    return all
      .filter(a => !userId || a.userId === userId || a.candidateId === userId || a.ownerUid === userId)
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
  } catch (error) {
    console.error("Error getting user attempts:", error);
    return [];
  }
}

// ============================================================================
// AUTHORITATIVE SERVER-SIDE EVALUATION & SCORING
// ============================================================================

export async function submitExamAttempt(attemptId: string, autoSubmitted = false): Promise<ExamResult> {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  if (attempt.status === "submitted" || attempt.status === "auto_submitted" || attempt.status === "expired") {
    const existingResult = await getResultByAttemptId(attemptId);
    if (existingResult) return existingResult;
  }

  const exam = await getExamById(attempt.examId);
  if (!exam) throw new Error("Associated exam not found");

  const ownerUid = attempt.ownerUid || auth.currentUser?.uid || attempt.userId;
  const candidateSnapshot = attempt.questionSnapshot || [];
  const answersMap = attempt.answers || {};

  let finalScore = 0;
  let totalMarks = exam.totalMarks || candidateSnapshot.reduce((acc, q) => acc + (q.marks || 1), 0);
  let percentage = 0;
  let isPassed = false;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let resultSignature: string | undefined;
  let gradingStatus = "graded";

  const serverRes = await examApiFetch("/api/exam/submit", {
    method: "POST",
    body: JSON.stringify({
      examId: exam.id,
      attemptId,
      answers: answersMap,
      sealedPayload: exam.sealedKeyEnvelope || undefined,
    }),
  });

  if (serverRes.ok) {
    const graded = await serverRes.json();
    finalScore = Number(graded.obtainedMarks) || 0;
    totalMarks = Number(graded.totalMarks) || totalMarks;
    percentage = Number(graded.percentage) || 0;
    isPassed = Boolean(graded.isPassed);
    correctCount = Number(graded.correctCount) || 0;
    wrongCount = Number(graded.wrongCount) || 0;
    unansweredCount = Number(graded.unansweredCount) || 0;
    resultSignature = graded.resultSignature;
    gradingStatus = graded.gradingStatus || "graded";
  } else {
    const allQuestions = await fetchQuestions();
    if (allQuestions.length === 0) {
      const errBody = await serverRes.json().catch(() => ({}));
      throw new Error(errBody?.error || "Server grading failed. Please retry submitting.");
    }

    const questionMap = new Map<string, QuestionBankItem>();
    allQuestions.forEach(q => questionMap.set(q.id, q));
    let earnedScore = 0;
    const penalty = (exam.negativeMarking?.enabled && exam.negativeMarking.marksPerWrongAnswer > 0)
      ? exam.negativeMarking.marksPerWrongAnswer
      : 0;

    candidateSnapshot.forEach(qItem => {
      const fullQ = questionMap.get(qItem.id);
      const userAnsObj = answersMap[qItem.id];
      const qMarks = qItem.marks || fullQ?.marks || 1;
      if (!userAnsObj || userAnsObj.selectedAnswer === undefined || userAnsObj.selectedAnswer === null || userAnsObj.selectedAnswer === "") {
        unansweredCount++;
        return;
      }
      const given = userAnsObj.selectedAnswer;
      const key = fullQ?.correctAnswer;
      const accepted = fullQ?.acceptedAnswers || [];
      let isCorrect = false;
      if (qItem.questionType === "mcq" || qItem.questionType === "true_false") {
        if (typeof given === "string" && typeof key === "string") {
          isCorrect = given.trim().toUpperCase() === key.trim().toUpperCase();
        }
      } else {
        const normGiven = typeof given === "string" ? given.trim().toLowerCase() : "";
        const normKey = typeof key === "string" ? key.trim().toLowerCase() : "";
        const normAccepted = accepted.map(a => a.trim().toLowerCase());
        if (normGiven === normKey || normAccepted.includes(normGiven)) {
          isCorrect = true;
        }
      }
      if (isCorrect) {
        correctCount++;
        earnedScore += qMarks;
      } else {
        wrongCount++;
        if (penalty > 0) earnedScore -= penalty;
      }
    });

    finalScore = Math.max(0, Number(earnedScore.toFixed(2)));
    percentage = totalMarks > 0 ? Number(((finalScore / totalMarks) * 100).toFixed(2)) : 0;
    isPassed = finalScore >= (exam.passMarks || 0);
  }

  const now = new Date().toISOString();
  const startTime = new Date(attempt.startedAt).getTime();
  const endTime = new Date(now).getTime();
  const timeTakenSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

  await patchAttemptEverywhere(attemptId, {
    ownerUid,
    status: "submitted" as AttemptStatus,
    isAutoSubmitted: autoSubmitted,
    gradingStatus,
    ...(resultSignature ? { resultSignature } : {}),
    submittedAt: now,
    score: finalScore,
    percentage,
    correctCount,
    wrongCount,
    unansweredCount,
    isPassed,
    updatedAt: now
  });

  const resultId = auth.currentUser ? doc(collection(db, "exam_results")).id : `res_${Date.now()}`;
  const examResult: ExamResult = {
    id: resultId,
    examId: exam.id,
    examTitle: exam.title,
    attemptId,
    candidateId: attempt.candidateId,
    userId: attempt.userId,
    ownerUid,
    registrationNumber: attempt.registrationNumber,
    candidateName: attempt.candidateName || "Candidate",
    candidatePhoto: attempt.candidatePhoto || "",
    score: finalScore,
    totalMarks,
    percentage,
    passMarks: exam.passMarks || 0,
    isPassed,
    correctCount,
    wrongCount,
    unansweredCount,
    timeTakenSeconds,
    gradingStatus,
    ...(resultSignature ? { resultSignature } : {}),
    submittedAt: now
  };

  await upsertExamResultEverywhere(null, examResult);

  await logExamActivity({
    action: "EXAM_STOPPED",
    targetId: exam.id,
    actorId: attempt.userId,
    details: `Candidate '${attempt.candidateName}' submitted attempt for '${exam.title}' (Score: ${finalScore}/${totalMarks}, ${isPassed ? "PASSED" : "FAILED"})`
  });

  return examResult;
}

export async function getResultByAttemptId(attemptId: string): Promise<ExamResult | null> {
  if (auth.currentUser) {
    try {
      const ref = collection(db, "exam_results");
      const q = query(ref, where("attemptId", "==", attemptId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as ExamResult;
      }
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error getting result by attempt ID:", error);
      }
    }
  }

  try {
    const res = await examApiFetch(`/api/exam/results?attemptId=${encodeURIComponent(attemptId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data?.results) ? data.results : [];
    return list[0] || null;
  } catch (error) {
    console.error("Error getting result by attempt ID:", error);
    return null;
  }
}

export async function fetchAllExamResults(examId?: string, leaderboardMode = false): Promise<ExamResult[]> {
  let items: ExamResult[] | null = null;

  if (auth.currentUser) {
    try {
      const ref = collection(db, "exam_results");
      const q = query(ref, orderBy("submittedAt", "desc"));
      const snap = await getDocs(q);
      items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));
      if (!leaderboardMode) {
        void tryMirrorToServer("/api/exam/sync-batch", "POST", { results: items });
      }
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching all exam results from Firestore:", error);
      }
    }
  }

  if (items === null) {
    try {
      const params = new URLSearchParams();
      if (examId && examId !== "ALL") params.set("examId", examId);
      if (leaderboardMode) params.set("leaderboard", "true");
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await examApiFetch(`/api/exam/results${qs}`);
      if (!res.ok) return [];
      const data = await res.json();
      items = Array.isArray(data?.results) ? data.results : [];
    } catch (error) {
      console.error("Error fetching all exam results:", error);
      return [];
    }
  }

  if (examId && examId !== "ALL") {
    items = items.filter(r => r.examId === examId);
  }
  return items;
}

export async function generateRankings(examId: string): Promise<ExamResult[]> {
  try {
    const session = getSession();
    const isAdmin = isAuthorizedAdmin(session?.role);
    const results = await fetchAllExamResults(examId, !isAdmin);

    const sorted = [...results].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
    });

    return sorted.map((r, index) => ({
      ...r,
      rank: index + 1
    }));
  } catch (error) {
    console.error("Error generating rankings:", error);
    return [];
  }
}

// ============================================================================
// SYSTEM SETTINGS & AUDIT LOGS
// ============================================================================

const DEFAULT_EXAM_SETTINGS: ExamSetting = {
  id: "global",
  defaultDurationMinutes: 60,
  defaultPassPercentage: 40,
  enableNegativeMarkingDefault: false,
  defaultWrongPenalty: 0.25,
  allowStudentReviewAnswers: false,
  showLeaderboardToStudents: true,
  autoSubmitOnTimeExpiry: true,
  preventTabSwitching: false,
  updatedAt: new Date().toISOString(),
  updatedBy: "system"
};

export async function fetchExamSettings(): Promise<ExamSetting> {
  if (auth.currentUser) {
    try {
      const docRef = doc(db, "exam_settings", "global");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const s = { id: snap.id, ...snap.data() } as ExamSetting;
        void tryMirrorToServer("/api/exam/sync-batch", "POST", { settings: s });
        return s;
      }
      const fallback = { ...DEFAULT_EXAM_SETTINGS, updatedAt: new Date().toISOString() };
      await setDoc(docRef, fallback).catch(() => {});
      return fallback;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching exam settings:", error);
      }
    }
  }

  try {
    const res = await examApiFetch("/api/exam/settings");
    if (res.ok) {
      const data = await res.json();
      if (data?.settings) return data.settings as ExamSetting;
    }
  } catch (error) {
    console.error("Error fetching exam settings from server:", error);
  }
  return { ...DEFAULT_EXAM_SETTINGS, updatedAt: new Date().toISOString() };
}

export async function updateExamSettings(settings: Partial<ExamSetting>, actorId: string = "admin"): Promise<void> {
  const payload = {
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId
  };

  if (auth.currentUser) {
    try {
      await setDoc(doc(db, "exam_settings", "global"), payload, { merge: true });
      void tryMirrorToServer("/api/exam/settings", "PUT", payload);
      await logExamActivity({
        action: "EXAM_SETTINGS_UPDATED",
        targetId: "global",
        actorId,
        details: "Updated global examination system settings."
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error updating exam settings:", error);
        handleFirestoreError(error, OperationType.WRITE, "exam_settings/global");
        return;
      }
    }
  }

  const res = await examApiFetch("/api/exam/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to update exam settings.");
  }
}

export async function logExamActivity(log: Omit<ExamActivityLog, "id" | "timestamp">): Promise<void> {
  if (auth.currentUser) {
    try {
      const docRef = doc(collection(db, "exam_activity_logs"));
      const entry: ExamActivityLog = {
        ...log,
        id: docRef.id,
        timestamp: new Date().toISOString()
      };
      await setDoc(docRef, entry);
      void tryMirrorToServer("/api/exam/logs", "POST", log);
      return;
    } catch {
      // Fall back to server log
    }
  }

  await tryMirrorToServer("/api/exam/logs", "POST", log);
}

export async function fetchExamActivityLogs(): Promise<ExamActivityLog[]> {
  if (auth.currentUser) {
    try {
      const ref = collection(db, "exam_activity_logs");
      const q = query(ref, orderBy("timestamp", "desc"), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamActivityLog));
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching exam activity logs:", error);
      }
    }
  }

  try {
    const res = await examApiFetch("/api/exam/logs");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.logs) ? data.logs : [];
  } catch (error) {
    console.error("Error fetching exam activity logs:", error);
    return [];
  }
}

// ============================================================================
// ANSWER SCRIPT EVALUATION & MANUAL MARKING MODULE SERVICES
// ============================================================================

export async function fetchAnswerScripts(filters?: {
  examId?: string;
  search?: string;
  evaluationStatus?: string;
  sortBy?: string;
  timeFilter?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ExamAttempt[]> {
  let items: ExamAttempt[] | null = null;

  if (auth.currentUser) {
    try {
      const ref = collection(db, "exam_attempts");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));
      void tryMirrorToServer("/api/exam/sync-batch", "POST", { attempts: items });
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        console.error("Error fetching answer scripts from Firestore:", error);
      }
    }
  }

  if (items === null) {
    try {
      const res = await examApiFetch("/api/exam/attempts");
      if (!res.ok) return [];
      const data = await res.json();
      items = Array.isArray(data?.attempts) ? data.attempts : [];
    } catch (error) {
      console.error("Error fetching answer scripts:", error);
      return [];
    }
  }

  items = items.filter(a => a.status !== "not_started");

  if (filters) {
    if (filters.examId && filters.examId !== "ALL") {
      items = items.filter(a => a.examId === filters.examId);
    }
    if (filters.evaluationStatus && filters.evaluationStatus !== "ALL") {
      items = items.filter(a => (a.evaluationStatus || "pending") === filters.evaluationStatus);
    }
    if (filters.timeFilter && filters.timeFilter !== "ALL") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (filters.timeFilter === "TODAY") {
        items = items.filter(a => {
          const dt = new Date(a.submittedAt || a.startedAt || a.createdAt);
          return dt >= startOfToday;
        });
      } else if (filters.timeFilter === "YESTERDAY") {
        const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
        items = items.filter(a => {
          const dt = new Date(a.submittedAt || a.startedAt || a.createdAt);
          return dt >= startOfYesterday && dt < startOfToday;
        });
      } else if (filters.timeFilter === "THIS_WEEK") {
        const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        items = items.filter(a => {
          const dt = new Date(a.submittedAt || a.startedAt || a.createdAt);
          return dt >= startOfWeek;
        });
      }
    }
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      items = items.filter(a => new Date(a.submittedAt || a.startedAt || a.createdAt) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      items = items.filter(a => new Date(a.submittedAt || a.startedAt || a.createdAt) <= end);
    }
    if (filters.search && filters.search.trim()) {
      const s = filters.search.toLowerCase().trim();
      items = items.filter(a =>
        (a.candidateName || "").toLowerCase().includes(s) ||
        (a.registrationNumber || "").toLowerCase().includes(s) ||
        (a.userId || "").toLowerCase().includes(s) ||
        (a.examTitle || "").toLowerCase().includes(s) ||
        a.id.toLowerCase().includes(s)
      );
    }
    if (filters.sortBy) {
      if (filters.sortBy === "highest_score") {
        items.sort((a, b) => (b.finalScore ?? b.score ?? 0) - (a.finalScore ?? a.score ?? 0));
      } else if (filters.sortBy === "lowest_score") {
        items.sort((a, b) => (a.finalScore ?? a.score ?? 0) - (b.finalScore ?? b.score ?? 0));
      } else if (filters.sortBy === "oldest") {
        items.sort((a, b) => new Date(a.startedAt || a.createdAt).getTime() - new Date(b.startedAt || b.createdAt).getTime());
      } else if (filters.sortBy === "candidate_name") {
        items.sort((a, b) => (a.candidateName || "").localeCompare(b.candidateName || ""));
      } else if (filters.sortBy === "roll_number") {
        items.sort((a, b) => (a.registrationNumber || "").localeCompare(b.registrationNumber || ""));
      }
    }
  }

  return items;
}

export async function logAnswerScriptAudit(audit: Omit<AnswerScriptAuditLog, "id" | "timestamp">): Promise<void> {
  if (auth.currentUser) {
    try {
      const docRef = doc(collection(db, "answer_script_audit_logs"));
      const entry: AnswerScriptAuditLog = {
        ...audit,
        id: docRef.id,
        timestamp: new Date().toISOString()
      };
      await setDoc(docRef, entry);
      void tryMirrorToServer("/api/exam/audit-logs", "POST", entry);
      return;
    } catch {
      // Fall back to server
    }
  }

  await tryMirrorToServer("/api/exam/audit-logs", "POST", audit);
}

export async function fetchAttemptAuditLogs(attemptId: string): Promise<AnswerScriptAuditLog[]> {
  if (auth.currentUser) {
    try {
      const ref = collection(db, "answer_script_audit_logs");
      const q = query(ref, where("attemptId", "==", attemptId));
      const snap = await getDocs(q);
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AnswerScriptAuditLog));
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Error fetching attempt audit logs:", err);
      }
    }
  }

  try {
    const res = await examApiFetch(`/api/exam/audit-logs?attemptId=${encodeURIComponent(attemptId)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.logs) ? data.logs : [];
  } catch (err) {
    console.error("Error fetching attempt audit logs:", err);
    return [];
  }
}

export async function saveQuestionEvaluation(params: {
  attemptId: string;
  questionId: string;
  obtainedMarks: number;
  maxMarks: number;
  comment?: string;
  actorId: string;
  actorName?: string;
  overrideReason?: string;
  isManuallyOverridden?: boolean;
}): Promise<ExamAttempt> {
  const { attemptId, questionId, obtainedMarks, maxMarks, comment, actorId, actorName, overrideReason, isManuallyOverridden } = params;

  if (obtainedMarks < 0 || obtainedMarks > maxMarks) {
    throw new Error(`Obtained marks must be between 0 and maximum marks (${maxMarks}). (নম্বর ০ থেকে ${maxMarks} এর মধ্যে হতে হবে)`);
  }

  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Answer script attempt not found.");

  if (attempt.evaluationStatus === "finalized") {
    throw new Error("This answer script evaluation is FINALIZED. Please reopen before modifying marks.");
  }

  const now = new Date().toISOString();
  const existingEvaluations = attempt.manualEvaluations || {};
  const currentEval = existingEvaluations[questionId];
  const previousMarks = currentEval ? currentEval.obtainedMarks : 0;

  const newEval: ManualQuestionEvaluation = {
    questionId,
    obtainedMarks,
    maxMarks,
    comment: comment || "",
    isManuallyOverridden: isManuallyOverridden ?? false,
    originalAutoScore: currentEval?.originalAutoScore ?? previousMarks,
    evaluatedBy: actorId,
    evaluatedByName: actorName || "Examiner",
    evaluatedAt: now,
    overrideReason: overrideReason || ""
  };

  const updatedEvaluations = {
    ...existingEvaluations,
    [questionId]: newEval
  };

  const historyEntry: MarksHistoryEntry = {
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    questionId,
    previousMarks,
    newMarks: obtainedMarks,
    changedBy: actorId,
    changedByName: actorName || "Examiner",
    reason: overrideReason || comment || "Manual evaluation updated",
    timestamp: now
  };

  const updatedHistory = [...(attempt.marksHistory || []), historyEntry];

  const questions = attempt.questionSnapshot || [];
  let evaluatedQuestionsCount = 0;

  questions.forEach(q => {
    const ev = updatedEvaluations[q.id];
    if (ev !== undefined) {
      evaluatedQuestionsCount++;
    }
  });

  let evalStatus: EvaluationStatus = "in_progress";
  if (evaluatedQuestionsCount === 0) {
    evalStatus = "pending";
  } else if (evaluatedQuestionsCount >= questions.length) {
    evalStatus = "fully_evaluated";
  } else {
    evalStatus = "partially_evaluated";
  }

  await patchAttemptEverywhere(attemptId, {
    manualEvaluations: updatedEvaluations,
    marksHistory: updatedHistory,
    evaluationStatus: evalStatus,
    evaluatedBy: actorId,
    evaluatedByName: actorName || "Examiner",
    evaluatedAt: now,
    updatedAt: now
  });

  await logAnswerScriptAudit({
    attemptId,
    questionId,
    action: "SAVE_QUESTION_EVALUATION",
    actorId,
    actorName,
    oldValue: previousMarks,
    newValue: obtainedMarks,
    reason: overrideReason || comment || "Question evaluation updated",
  });

  return await recalculateAttemptResult(attemptId, actorId, actorName);
}

export async function saveBulkEvaluations(params: {
  attemptId: string;
  evaluations: Array<{
    questionId: string;
    obtainedMarks: number;
    maxMarks: number;
    comment?: string;
  }>;
  actorId: string;
  actorName?: string;
}): Promise<ExamAttempt> {
  const { attemptId, evaluations, actorId, actorName } = params;

  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  if (attempt.evaluationStatus === "finalized") {
    throw new Error("Cannot modify a finalized answer script.");
  }

  const now = new Date().toISOString();
  const updatedEvaluations = { ...(attempt.manualEvaluations || {}) };
  const updatedHistory = [...(attempt.marksHistory || [])];

  evaluations.forEach(item => {
    if (item.obtainedMarks < 0 || item.obtainedMarks > item.maxMarks) {
      throw new Error(`Marks for question ID ${item.questionId} must be between 0 and ${item.maxMarks}`);
    }

    const prevMarks = updatedEvaluations[item.questionId]?.obtainedMarks || 0;
    updatedEvaluations[item.questionId] = {
      questionId: item.questionId,
      obtainedMarks: item.obtainedMarks,
      maxMarks: item.maxMarks,
      comment: item.comment || "",
      evaluatedBy: actorId,
      evaluatedByName: actorName || "Examiner",
      evaluatedAt: now
    };

    updatedHistory.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      questionId: item.questionId,
      previousMarks: prevMarks,
      newMarks: item.obtainedMarks,
      changedBy: actorId,
      changedByName: actorName || "Examiner",
      reason: "Bulk evaluation saved",
      timestamp: now
    });
  });

  const questions = attempt.questionSnapshot || [];
  const evaluatedCount = Object.keys(updatedEvaluations).length;
  const evalStatus: EvaluationStatus = evaluatedCount >= questions.length ? "fully_evaluated" : "partially_evaluated";

  await patchAttemptEverywhere(attemptId, {
    manualEvaluations: updatedEvaluations,
    marksHistory: updatedHistory,
    evaluationStatus: evalStatus,
    evaluatedBy: actorId,
    evaluatedByName: actorName || "Examiner",
    evaluatedAt: now,
    updatedAt: now
  });

  await logAnswerScriptAudit({
    attemptId,
    action: "SAVE_BULK_EVALUATION",
    actorId,
    actorName,
    reason: `Saved bulk evaluations for ${evaluations.length} questions`
  });

  return await recalculateAttemptResult(attemptId, actorId, actorName);
}

export async function recalculateAttemptResult(attemptId: string, _actorId: string, _actorName?: string): Promise<ExamAttempt> {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  const exam = await getExamById(attempt.examId);
  if (!exam) throw new Error("Exam model not found");

  const allQ = await fetchQuestions();
  const qMap = new Map<string, QuestionBankItem>();
  if (exam.questionSnapshots) exam.questionSnapshots.forEach(q => qMap.set(q.id, q));
  allQ.forEach(q => {
    if (qMap.has(q.id) || attempt.questionSnapshot?.some(qs => qs.id === q.id)) {
      qMap.set(q.id, q);
    }
  });

  const questions = attempt.questionSnapshot || [];
  const answers = attempt.answers || {};
  const manualEvals = attempt.manualEvaluations || {};

  let autoScore = 0;
  let manualMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const penalty = (exam.negativeMarking?.enabled && exam.negativeMarking.marksPerWrongAnswer > 0)
    ? exam.negativeMarking.marksPerWrongAnswer
    : 0;

  questions.forEach(q => {
    const fullQ = qMap.get(q.id);
    const userAnsObj = answers[q.id];
    const qMaxMarks = q.marks || fullQ?.marks || 1;
    const manualEval = manualEvals[q.id];

    if (manualEval !== undefined) {
      manualMarks += manualEval.obtainedMarks;
      if (manualEval.obtainedMarks >= qMaxMarks) {
        correctCount++;
      } else if (manualEval.obtainedMarks === 0) {
        wrongCount++;
      }
    } else {
      if (!userAnsObj || userAnsObj.selectedAnswer === undefined || userAnsObj.selectedAnswer === null || userAnsObj.selectedAnswer === "") {
        unansweredCount++;
        return;
      }

      const given = userAnsObj.selectedAnswer;
      const key = fullQ?.correctAnswer || q.correctAnswer;
      const accepted = fullQ?.acceptedAnswers || [];

      let isCorrect = false;

      if (q.questionType === "mcq" || q.questionType === "true_false") {
        if (typeof given === "string" && typeof key === "string") {
          isCorrect = given.trim().toUpperCase() === key.trim().toUpperCase();
        }
      } else {
        const normGiven = typeof given === "string" ? given.trim().toLowerCase() : "";
        const normKey = typeof key === "string" ? key.trim().toLowerCase() : "";
        const normAccepted = accepted.map(a => a.trim().toLowerCase());
        if (normGiven === normKey || normAccepted.includes(normGiven)) {
          isCorrect = true;
        }
      }

      if (isCorrect) {
        correctCount++;
        autoScore += qMaxMarks;
      } else {
        wrongCount++;
        if (penalty > 0) autoScore -= penalty;
      }
    }
  });

  const calculatedTotalMarks = exam.totalMarks || questions.reduce((acc, q) => acc + (q.marks || 1), 0);
  const combinedObtainedScore = Math.max(0, Number((autoScore + manualMarks).toFixed(2)));
  const percentage = calculatedTotalMarks > 0 ? Number(((combinedObtainedScore / calculatedTotalMarks) * 100).toFixed(2)) : 0;
  const isPassed = combinedObtainedScore >= (exam.passMarks || 0);

  const markingSummary = {
    totalQuestions: questions.length,
    attempted: questions.length - unansweredCount,
    unanswered: unansweredCount,
    autoEvaluatedMarks: Math.max(0, Number(autoScore.toFixed(2))),
    manualMarks: Number(manualMarks.toFixed(2)),
    totalMarks: calculatedTotalMarks,
    obtainedMarks: combinedObtainedScore,
    percentage,
    isPassed
  };

  await patchAttemptEverywhere(attemptId, {
    autoScore: Math.max(0, Number(autoScore.toFixed(2))),
    manualMarks: Number(manualMarks.toFixed(2)),
    finalScore: combinedObtainedScore,
    score: combinedObtainedScore,
    percentage,
    correctCount,
    wrongCount,
    unansweredCount,
    isPassed,
    markingSummary,
    updatedAt: new Date().toISOString()
  });

  const existingResult = await getResultByAttemptId(attemptId);
  const now = new Date().toISOString();

  if (existingResult) {
    await upsertExamResultEverywhere(existingResult.id, {
      ...existingResult,
      score: combinedObtainedScore,
      totalMarks: calculatedTotalMarks,
      percentage,
      isPassed,
      correctCount,
      wrongCount,
      unansweredCount,
      submittedAt: attempt.submittedAt || now
    });
  } else {
    const newId = auth.currentUser ? doc(collection(db, "exam_results")).id : `res_${Date.now()}`;
    await upsertExamResultEverywhere(null, {
      id: newId,
      examId: exam.id,
      examTitle: exam.title,
      attemptId,
      candidateId: attempt.candidateId,
      userId: attempt.userId,
      ownerUid: attempt.ownerUid || auth.currentUser?.uid || attempt.userId,
      registrationNumber: attempt.registrationNumber,
      candidateName: attempt.candidateName || "Candidate",
      candidatePhoto: attempt.candidatePhoto || "",
      score: combinedObtainedScore,
      totalMarks: calculatedTotalMarks,
      percentage,
      passMarks: exam.passMarks || 0,
      isPassed,
      correctCount,
      wrongCount,
      unansweredCount,
      submittedAt: attempt.submittedAt || now
    });
  }

  const reloaded = await getAttemptById(attemptId);
  return reloaded!;
}

export async function finalizeAttemptEvaluation(attemptId: string, actorId: string, actorName?: string): Promise<ExamAttempt> {
  const attempt = await recalculateAttemptResult(attemptId, actorId, actorName);
  const now = new Date().toISOString();

  await patchAttemptEverywhere(attemptId, {
    evaluationStatus: "finalized",
    finalizedAt: now,
    finalizedBy: actorId,
    finalizedByName: actorName || "Examiner",
    updatedAt: now
  });

  await logAnswerScriptAudit({
    attemptId,
    action: "FINALIZE_EVALUATION",
    actorId,
    actorName,
    reason: `Finalized script evaluation with final score ${attempt.finalScore ?? attempt.score}/${attempt.markingSummary?.totalMarks}`
  });

  const reloaded = await getAttemptById(attemptId);
  return reloaded!;
}

export async function reopenAttemptEvaluation(attemptId: string, reason: string, actorId: string, actorName?: string): Promise<ExamAttempt> {
  if (!reason || !reason.trim()) {
    throw new Error("Reason is required to reopen a finalized evaluation script.");
  }

  const now = new Date().toISOString();
  await patchAttemptEverywhere(attemptId, {
    evaluationStatus: "reopened",
    updatedAt: now
  });

  await logAnswerScriptAudit({
    attemptId,
    action: "REOPEN_EVALUATION",
    actorId,
    actorName,
    reason
  });

  const reloaded = await getAttemptById(attemptId);
  return reloaded!;
}

export async function recheckExamQuestionKey(params: {
  examId: string;
  questionId: string;
  action: "change_key" | "cancel_question" | "full_marks_all";
  newCorrectAnswer?: string;
  actorId: string;
  actorName?: string;
  reason?: string;
}): Promise<number> {
  const { examId, questionId, action, newCorrectAnswer, actorId, actorName, reason } = params;

  if (action === "change_key" && newCorrectAnswer) {
    await updateQuestion(questionId, { correctAnswer: newCorrectAnswer }, actorId);
  }

  const attempts = await fetchAnswerScripts({ examId });
  let affectedCount = 0;

  for (const att of attempts) {
    const qSnapshot = att.questionSnapshot || [];
    const targetQ = qSnapshot.find(item => item.id === questionId);
    if (!targetQ) continue;

    const manualEvals = { ...(att.manualEvaluations || {}) };
    const maxMarks = targetQ.marks || 1;

    if (action === "full_marks_all" || action === "cancel_question") {
      manualEvals[questionId] = {
        questionId,
        obtainedMarks: maxMarks,
        maxMarks,
        comment: `Grace marks awarded (${action.replace("_", " ")}) - ${reason || "Admin action"}`,
        isManuallyOverridden: true,
        evaluatedBy: actorId,
        evaluatedByName: actorName || "Admin",
        evaluatedAt: new Date().toISOString()
      };
    }

    await patchAttemptEverywhere(att.id, {
      manualEvaluations: manualEvals,
      updatedAt: new Date().toISOString()
    });

    await recalculateAttemptResult(att.id, actorId, actorName);
    affectedCount++;
  }

  await logExamActivity({
    action: "QUESTION_UPDATED",
    targetId: examId,
    actorId,
    details: `Rechecked question ${questionId} on exam ${examId}: Action '${action}'. Recalculated ${affectedCount} attempt scripts.`
  });

  return affectedCount;
}

export async function deleteAttemptById(attemptId: string, actorId: string, actorName?: string): Promise<void> {
  const data = await getAttemptById(attemptId);
  if (!data) {
    throw new Error("Answer script / attempt not found");
  }

  const examId = data.examId;
  const candidateId = data.candidateId || data.userId;

  if (auth.currentUser) {
    try {
      await deleteDoc(doc(db, "exam_attempts", attemptId));
      try {
        const lbRef = collection(db, "leaderboard");
        const q = query(lbRef, where("attemptId", "==", attemptId));
        const lbSnap = await getDocs(q);
        for (const lbDoc of lbSnap.docs) {
          await deleteDoc(doc(db, "leaderboard", lbDoc.id));
        }
      } catch (err) {
        console.warn("Could not delete associated leaderboard entry:", err);
      }
      void tryMirrorToServer(`/api/exam/attempts/${encodeURIComponent(attemptId)}`, "DELETE", {});
      await logExamActivity({
        action: "EXAM_DELETED",
        targetId: examId,
        actorId,
        details: `Deleted answer script / attempt ${attemptId} for candidate ${data.candidateName || candidateId} by ${actorName || actorId}`
      });
      return;
    } catch (error) {
      if (!isFirestorePermissionError(error)) {
        throw error;
      }
    }
  }

  const res = await examApiFetch(`/api/exam/attempts/${encodeURIComponent(attemptId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || "Failed to delete answer script.");
  }
}
