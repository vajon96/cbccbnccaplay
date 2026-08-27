import { 
  db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, 
  query, where, orderBy, limit, Timestamp, writeBatch, handleFirestoreError, OperationType 
} from "../firebase";
import { 
  QuestionBankItem, QuestionType, QuestionDifficulty, ExamModel, ExamStatus, 
  ExamAttempt, ExamResult, ExamSetting, ExamActivityLog, RandomQuestionRule, AttemptStatus,
  EvaluationStatus, ManualQuestionEvaluation, MarksHistoryEntry, AnswerScriptAuditLog
} from "../types";

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
  try {
    const qRef = collection(db, "question_bank");
    let q = query(qRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    
    let items: QuestionBankItem[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as QuestionBankItem));

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
  } catch (error) {
    console.error("Error fetching question bank:", error);
    handleFirestoreError(error, OperationType.GET, "question_bank");
    return [];
  }
}

export async function addQuestion(question: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">): Promise<string> {
  try {
    const docRef = doc(collection(db, "question_bank"));
    const now = new Date().toISOString();
    const newItem: QuestionBankItem = {
      ...question,
      id: docRef.id,
      createdAt: now,
      updatedAt: now,
      isActive: question.isActive ?? true
    };
    await setDoc(docRef, newItem);
    await logExamActivity({
      action: "QUESTION_CREATED",
      targetId: docRef.id,
      actorId: question.createdBy || "admin",
      details: `Created question: ${question.question.substring(0, 40)}... (${question.subject} - ${question.questionType})`
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding question:", error);
    handleFirestoreError(error, OperationType.CREATE, "question_bank");
    throw error;
  }
}

export async function updateQuestion(id: string, updates: Partial<QuestionBankItem>, actorId: string = "admin"): Promise<void> {
  try {
    const docRef = doc(db, "question_bank", id);
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(docRef, updatedData);
    await logExamActivity({
      action: "QUESTION_UPDATED",
      targetId: id,
      actorId,
      details: `Updated question ID ${id}`
    });
  } catch (error) {
    console.error("Error updating question:", error);
    handleFirestoreError(error, OperationType.UPDATE, `question_bank/${id}`);
    throw error;
  }
}

export async function deleteQuestion(id: string, actorId: string = "admin", softDelete = true): Promise<void> {
  try {
    if (softDelete) {
      await updateQuestion(id, { isActive: false }, actorId);
    } else {
      await deleteDoc(doc(db, "question_bank", id));
    }
    await logExamActivity({
      action: "QUESTION_DELETED",
      targetId: id,
      actorId,
      details: `${softDelete ? 'Soft deleted' : 'Permanently deleted'} question ID ${id}`
    });
  } catch (error) {
    console.error("Error deleting question:", error);
    handleFirestoreError(error, OperationType.DELETE, `question_bank/${id}`);
    throw error;
  }
}

export async function duplicateQuestion(id: string, actorId: string = "admin"): Promise<string> {
  try {
    const docRef = doc(db, "question_bank", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("Question not found");
    const data = snap.data() as QuestionBankItem;
    
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

    // Determine type
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

      // Answer should be A, B, C, or D
      let normalizedAns = answerRaw.toUpperCase();
      if (!["A", "B", "C", "D"].includes(normalizedAns)) {
        if (answerRaw === optA) normalizedAns = "A";
        else if (answerRaw === optB) normalizedAns = "B";
        else if (answerRaw === optC) normalizedAns = "C";
        else if (answerRaw === optD) normalizedAns = "D";
        else normalizedAns = "A"; // default fallback
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
      // fill_gaps, tag_question, changing_sentence, short_question
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

export async function bulkImportQuestions(items: Omit<QuestionBankItem, "id" | "createdAt" | "updatedAt">[], actorId: string = "admin"): Promise<number> {
  try {
    const batchSize = 400; // Firestore batch limit is 500
    let importedCount = 0;
    const now = new Date().toISOString();

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
        importedCount++;
      });
      await batch.commit();
    }

    await logExamActivity({
      action: "QUESTION_IMPORTED",
      targetId: "bulk",
      actorId,
      details: `Successfully bulk imported ${importedCount} questions into Question Bank.`
    });

    return importedCount;
  } catch (error) {
    console.error("Error bulk importing questions:", error);
    handleFirestoreError(error, OperationType.WRITE, "question_bank");
    throw error;
  }
}

// Seed initial Question Bank if empty
export async function seedDefaultQuestionsIfEmpty(actorId: string = "system"): Promise<void> {
  try {
    const questions = await fetchQuestions();
    if (questions.length > 0) return; // already seeded

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

export async function fetchExams(statusFilter?: ExamStatus): Promise<ExamModel[]> {
  try {
    const ref = collection(db, "exams");
    const q = query(ref, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    let items: ExamModel[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ExamModel));

    if (statusFilter) {
      items = items.filter(e => e.status === statusFilter);
    }
    return items;
  } catch (error) {
    console.error("Error fetching exams:", error);
    handleFirestoreError(error, OperationType.GET, "exams");
    return [];
  }
}

export async function getExamById(id: string): Promise<ExamModel | null> {
  try {
    const docRef = doc(db, "exams", id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ExamModel;
  } catch (error) {
    console.error("Error getting exam by ID:", error);
    handleFirestoreError(error, OperationType.GET, `exams/${id}`);
    return null;
  }
}

export async function createExam(examData: Omit<ExamModel, "id" | "createdAt" | "updatedAt">): Promise<string> {
  try {
    const docRef = doc(collection(db, "exams"));
    const now = new Date().toISOString();
    
    // Resolve question snapshots
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

    const newExam: ExamModel = {
      ...examData,
      id: docRef.id,
      totalMarks: calculatedTotalMarks,
      questionSnapshots: snapshots,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, newExam);

    await logExamActivity({
      action: "EXAM_CREATED",
      targetId: docRef.id,
      actorId: examData.createdBy || "admin",
      details: `Created exam '${examData.title}' (${snapshots.length} questions, Total Marks: ${calculatedTotalMarks})`
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating exam:", error);
    handleFirestoreError(error, OperationType.CREATE, "exams");
    throw error;
  }
}

export async function updateExam(id: string, updates: Partial<ExamModel>, actorId: string = "admin"): Promise<void> {
  try {
    const docRef = doc(db, "exams", id);
    const existing = await getExamById(id);
    if (!existing) throw new Error("Exam not found");

    let snapshots = updates.questionSnapshots || existing.questionSnapshots || [];

    if (updates.questionSelectionMode === "manual" && updates.selectedQuestionIds) {
      const allQ = await fetchQuestions();
      snapshots = allQ.filter(q => updates.selectedQuestionIds?.includes(q.id));
    } else if (updates.questionSelectionMode === "random" && updates.randomRules) {
      snapshots = await generateRandomQuestionSet(updates.randomRules);
    }

    const calculatedTotalMarks = snapshots.length > 0 
      ? snapshots.reduce((acc, curr) => acc + (curr.marks || 1), 0)
      : (updates.totalMarks || existing.totalMarks);

    const updatedData = {
      ...updates,
      questionSnapshots: snapshots,
      totalMarks: calculatedTotalMarks,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, updatedData);

    await logExamActivity({
      action: "EXAM_UPDATED",
      targetId: id,
      actorId,
      details: `Updated exam '${updates.title || existing.title}'`
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    handleFirestoreError(error, OperationType.UPDATE, `exams/${id}`);
    throw error;
  }
}

export async function publishExam(id: string, actorId: string = "admin"): Promise<void> {
  try {
    const exam = await getExamById(id);
    if (!exam) throw new Error("Exam not found");

    if (!exam.title || !exam.durationMinutes || exam.durationMinutes <= 0) {
      throw new Error("Exam must have a title and valid duration before publishing.");
    }

    if (!exam.questionSnapshots || exam.questionSnapshots.length === 0) {
      throw new Error("Exam has no selected questions. Please add questions before publishing.");
    }

    await updateDoc(doc(db, "exams", id), {
      status: "published",
      updatedAt: new Date().toISOString()
    });

    await logExamActivity({
      action: "EXAM_PUBLISHED",
      targetId: id,
      actorId,
      details: `Published exam '${exam.title}'`
    });
  } catch (error) {
    console.error("Error publishing exam:", error);
    throw error;
  }
}

export async function deleteExam(id: string, actorId: string = "admin"): Promise<void> {
  try {
    await deleteDoc(doc(db, "exams", id));
    await logExamActivity({
      action: "EXAM_UPDATED",
      targetId: id,
      actorId,
      details: `Deleted exam ID ${id}`
    });
  } catch (error) {
    console.error("Error deleting exam:", error);
    handleFirestoreError(error, OperationType.DELETE, `exams/${id}`);
    throw error;
  }
}

export async function duplicateExam(id: string, actorId: string = "admin"): Promise<string> {
  try {
    const exam = await getExamById(id);
    if (!exam) throw new Error("Exam not found");

    return await createExam({
      ...exam,
      title: `${exam.title} (Copy)`,
      status: "draft",
      createdBy: actorId
    });
  } catch (error) {
    console.error("Error duplicating exam:", error);
    throw error;
  }
}

// Helper to assemble random questions by rules
export async function generateRandomQuestionSet(rules: RandomQuestionRule[]): Promise<QuestionBankItem[]> {
  const allQ = await fetchQuestions({ isActiveOnly: true });
  const selected: QuestionBankItem[] = [];
  const usedIds = new Set<string>();

  rules.forEach(rule => {
    let pool = allQ.filter(q => q.subject === rule.subject && !usedIds.has(q.id));
    if (rule.questionType) {
      pool = pool.filter(q => q.questionType === rule.questionType);
    }

    // Shuffle pool
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
  try {
    const { examId, candidateId, userId, registrationNumber, candidateName, candidatePhoto, session, collegeName } = params;

    const exam = await getExamById(examId);
    if (!exam) throw new Error("পরীক্ষাটি পাওয়া যায়নি (Exam not found).");

    if (exam.status !== "published" && exam.status !== "live") {
      throw new Error("পরীক্ষাটি বর্তমানে সক্রিয় নয় (Exam is not active).");
    }

    // Check existing attempts for this candidate
    const attemptsRef = collection(db, "exam_attempts");
    const q = query(
      attemptsRef, 
      where("examId", "==", examId), 
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    const existingAttempts = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));

    // Check if there is an in_progress attempt
    const inProgress = existingAttempts.find(a => a.status === "in_progress");
    if (inProgress) {
      // Return active in-progress attempt for interruption recovery!
      return inProgress;
    }

    // Check attempt limit
    const completedCount = existingAttempts.filter(a => a.status === "submitted" || a.status === "auto_submitted" || a.status === "expired").length;
    if (exam.maxAttempts > 0 && completedCount >= exam.maxAttempts) {
      throw new Error(`আপনার সর্বোচ্চ Attempt (${exam.maxAttempts} টি) পূর্ণ হয়ে গেছে।`);
    }

    // Prepare question set snapshot
    let questions = exam.questionSnapshots || [];
    if (questions.length === 0) {
      // Fallback 1: load questions from selection
      if (exam.selectedQuestionIds && exam.selectedQuestionIds.length > 0) {
        const allQ = await fetchQuestions();
        questions = allQ.filter(q => exam.selectedQuestionIds?.includes(q.id));
      } 
      
      // Fallback 2: load from random rules if still 0
      if (questions.length === 0 && exam.randomRules && exam.randomRules.length > 0) {
        questions = await generateRandomQuestionSet(exam.randomRules);
      }

      // Fallback 3: if still 0 questions, fetch all active questions or seed defaults
      if (questions.length === 0) {
        let allActive = await fetchQuestions({ isActiveOnly: true });
        if (allActive.length === 0) {
          await seedDefaultQuestionsIfEmpty(userId);
          allActive = await fetchQuestions({ isActiveOnly: true });
        }
        questions = allActive;
      }
    }

    // Ensure every question object explicitly normalizes `question` text and `options`
    const normalizedQuestions = questions.map(q => {
      const qText = (q as any).question || (q as any).questionText || (q as any).question_text || (q as any).text || (q as any).title || (q as any).content || (q as any).name || "Question text unavailable";
      return {
        ...q,
        question: qText
      };
    });

    // Shuffle questions if required
    let finalQuestions = [...normalizedQuestions];
    if (exam.shuffleQuestions) {
      finalQuestions = finalQuestions.sort(() => 0.5 - Math.random());
    }

    // Create candidate-safe question snapshot (REMOVE correct answer keys from candidate snapshot!)
    const candidateSafeSnapshot = finalQuestions.map(q => {
      const { correctAnswer, acceptedAnswers, expectedAnswer, explanation, ...safeQ } = q;
      return safeQ as QuestionBankItem;
    });

    const docRef = doc(collection(db, "exam_attempts"));
    const now = new Date().toISOString();

    const attempt: ExamAttempt = {
      id: docRef.id,
      examId,
      examTitle: exam.title,
      candidateId,
      userId,
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

    await logExamActivity({
      action: "EXAM_STARTED",
      targetId: examId,
      actorId: userId,
      details: `Candidate '${candidateName}' (${userId}) started attempt on '${exam.title}'`
    });

    return attempt;
  } catch (error) {
    console.error("Error starting exam attempt:", error);
    handleFirestoreError(error, OperationType.CREATE, "exam_attempts");
    throw error;
  }
}

export async function saveAttemptAnswer(params: {
  attemptId: string;
  questionId: string;
  selectedAnswer: string | string[];
  isMarkedForReview?: boolean;
}): Promise<void> {
  try {
    const { attemptId, questionId, selectedAnswer, isMarkedForReview } = params;
    const docRef = doc(db, "exam_attempts", attemptId);
    
    // We update the answers map field directly in Firestore
    await updateDoc(docRef, {
      [`answers.${questionId}`]: {
        questionId,
        selectedAnswer,
        answeredAt: new Date().toISOString(),
        isMarkedForReview: isMarkedForReview ?? false
      },
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error saving attempt answer:", error);
    handleFirestoreError(error, OperationType.UPDATE, `exam_attempts/${params.attemptId}`);
  }
}

export async function getAttemptById(attemptId: string): Promise<ExamAttempt | null> {
  try {
    const docRef = doc(db, "exam_attempts", attemptId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ExamAttempt;
  } catch (error) {
    console.error("Error getting attempt by ID:", error);
    return null;
  }
}

export async function getUserAttempts(userId: string): Promise<ExamAttempt[]> {
  try {
    const ref = collection(db, "exam_attempts");
    const q = query(ref, where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));
  } catch (error) {
    console.error("Error getting user attempts:", error);
    return [];
  }
}

// ============================================================================
// TRUSTED SERVER-SIDE EVALUATION & SCORING
// ============================================================================

export async function submitExamAttempt(attemptId: string, autoSubmitted = false): Promise<ExamResult> {
  try {
    const attempt = await getAttemptById(attemptId);
    if (!attempt) throw new Error("Attempt not found");

    if (attempt.status === "submitted" || attempt.status === "auto_submitted" || attempt.status === "expired") {
      // Already evaluated, return existing result if available
      const existingResult = await getResultByAttemptId(attemptId);
      if (existingResult) return existingResult;
    }

    const exam = await getExamById(attempt.examId);
    if (!exam) throw new Error("Associated exam not found");

    // Retrieve authoritative questions with correct answers from Question Bank or exam.questionSnapshots
    const allQuestions = await fetchQuestions();
    const questionMap = new Map<string, QuestionBankItem>();
    
    // First map from exam snapshots
    if (exam.questionSnapshots) {
      exam.questionSnapshots.forEach(q => questionMap.set(q.id, q));
    }
    // Override/enrich with full Question Bank item to ensure correct answer is available
    allQuestions.forEach(q => {
      if (questionMap.has(q.id) || attempt.questionSnapshot?.some(qs => qs.id === q.id)) {
        questionMap.set(q.id, q);
      }
    });

    const candidateSnapshot = attempt.questionSnapshot || [];
    const answersMap = attempt.answers || {};

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
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
      const key = fullQ?.correctAnswer || qItem.correctAnswer;
      const accepted = fullQ?.acceptedAnswers || [];

      let isCorrect = false;

      if (qItem.questionType === "mcq" || qItem.questionType === "true_false") {
        if (typeof given === "string" && typeof key === "string") {
          isCorrect = given.trim().toUpperCase() === key.trim().toUpperCase();
        }
      } else {
        // String normalized comparison for fill_gaps, tag_question, changing_sentence, short_question
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
        if (penalty > 0) {
          earnedScore -= penalty;
        }
      }
    });

    const finalScore = Math.max(0, Number(earnedScore.toFixed(2)));
    const totalMarks = exam.totalMarks || candidateSnapshot.reduce((acc, q) => acc + (q.marks || 1), 0);
    const percentage = totalMarks > 0 ? Number(((finalScore / totalMarks) * 100).toFixed(2)) : 0;
    const isPassed = finalScore >= (exam.passMarks || 0);

    const now = new Date().toISOString();

    // Calculate time taken in seconds
    const startTime = new Date(attempt.startedAt).getTime();
    const endTime = new Date(now).getTime();
    const timeTakenSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));

    // Update attempt record
    const updatedAttemptStatus: AttemptStatus = autoSubmitted ? "auto_submitted" : "submitted";
    await updateDoc(doc(db, "exam_attempts", attemptId), {
      status: updatedAttemptStatus,
      submittedAt: now,
      score: finalScore,
      percentage,
      correctCount,
      wrongCount,
      unansweredCount,
      isPassed,
      updatedAt: now
    });

    // Create result record
    const resultDocRef = doc(collection(db, "exam_results"));
    const examResult: ExamResult = {
      id: resultDocRef.id,
      examId: exam.id,
      examTitle: exam.title,
      attemptId,
      candidateId: attempt.candidateId,
      userId: attempt.userId,
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
      submittedAt: now
    };

    await setDoc(resultDocRef, examResult);

    await logExamActivity({
      action: "EXAM_STOPPED",
      targetId: exam.id,
      actorId: attempt.userId,
      details: `Candidate '${attempt.candidateName}' submitted attempt for '${exam.title}' (Score: ${finalScore}/${totalMarks}, ${isPassed ? 'PASSED' : 'FAILED'})`
    });

    return examResult;
  } catch (error) {
    console.error("Error submitting exam attempt:", error);
    handleFirestoreError(error, OperationType.WRITE, `exam_attempts/${attemptId}`);
    throw error;
  }
}

export async function getResultByAttemptId(attemptId: string): Promise<ExamResult | null> {
  try {
    const ref = collection(db, "exam_results");
    const q = query(ref, where("attemptId", "==", attemptId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as ExamResult;
  } catch (error) {
    console.error("Error getting result by attempt ID:", error);
    return null;
  }
}

export async function fetchAllExamResults(examId?: string): Promise<ExamResult[]> {
  try {
    const ref = collection(db, "exam_results");
    let q = query(ref, orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamResult));

    if (examId && examId !== "ALL") {
      items = items.filter(r => r.examId === examId);
    }
    return items;
  } catch (error) {
    console.error("Error fetching all exam results:", error);
    return [];
  }
}

export async function generateRankings(examId: string): Promise<ExamResult[]> {
  try {
    const results = await fetchAllExamResults(examId);
    
    // Sort descending by score, tie-break by time taken ascending (earlier submission or faster completion)
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

export async function fetchExamSettings(): Promise<ExamSetting> {
  try {
    const docRef = doc(db, "exam_settings", "global");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ExamSetting;
    }
    
    // Default fallback settings
    const defaultSettings: ExamSetting = {
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

    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  } catch (error) {
    console.error("Error fetching exam settings:", error);
    return {
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
  }
}

export async function updateExamSettings(settings: Partial<ExamSetting>, actorId: string = "admin"): Promise<void> {
  try {
    const docRef = doc(db, "exam_settings", "global");
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId
    }, { merge: true });

    await logExamActivity({
      action: "EXAM_SETTINGS_UPDATED",
      targetId: "global",
      actorId,
      details: "Updated global examination system settings."
    });
  } catch (error) {
    console.error("Error updating exam settings:", error);
    handleFirestoreError(error, OperationType.WRITE, "exam_settings/global");
  }
}

export async function logExamActivity(log: Omit<ExamActivityLog, "id" | "timestamp">): Promise<void> {
  try {
    const docRef = doc(collection(db, "exam_activity_logs"));
    const entry: ExamActivityLog = {
      ...log,
      id: docRef.id,
      timestamp: new Date().toISOString()
    };
    await setDoc(docRef, entry);
  } catch (error) {
    console.warn("Could not write exam activity log:", error);
  }
}

export async function fetchExamActivityLogs(): Promise<ExamActivityLog[]> {
  try {
    const ref = collection(db, "exam_activity_logs");
    const q = query(ref, orderBy("timestamp", "desc"), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamActivityLog));
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
  timeFilter?: string; // "ALL", "TODAY", "YESTERDAY", "THIS_WEEK"
  startDate?: string;
  endDate?: string;
}): Promise<ExamAttempt[]> {
  try {
    const ref = collection(db, "exam_attempts");
    const q = query(ref, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    let items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));

    // Filter out unstarted attempts (only show submitted, auto_submitted, expired, or in_progress with answers)
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
  } catch (error) {
    console.error("Error fetching answer scripts:", error);
    return [];
  }
}

export async function logAnswerScriptAudit(audit: Omit<AnswerScriptAuditLog, "id" | "timestamp">): Promise<void> {
  try {
    const docRef = doc(collection(db, "answer_script_audit_logs"));
    const entry: AnswerScriptAuditLog = {
      ...audit,
      id: docRef.id,
      timestamp: new Date().toISOString()
    };
    await setDoc(docRef, entry);
  } catch (err) {
    console.warn("Could not log answer script audit:", err);
  }
}

export async function fetchAttemptAuditLogs(attemptId: string): Promise<AnswerScriptAuditLog[]> {
  try {
    const ref = collection(db, "answer_script_audit_logs");
    const q = query(ref, where("attemptId", "==", attemptId));
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AnswerScriptAuditLog));
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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

  // Validation Rule 13: 0 <= obtainedMarks <= maxMarks
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

  // Record history entry
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

  // Re-calculate counts and scores across questions
  const questions = attempt.questionSnapshot || [];
  let totalManualMarks = 0;
  let evaluatedQuestionsCount = 0;

  questions.forEach(q => {
    const ev = updatedEvaluations[q.id];
    if (ev !== undefined) {
      totalManualMarks += ev.obtainedMarks;
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

  const attemptRef = doc(db, "exam_attempts", attemptId);

  await updateDoc(attemptRef, {
    manualEvaluations: updatedEvaluations,
    marksHistory: updatedHistory,
    evaluationStatus: evalStatus,
    evaluatedBy: actorId,
    evaluatedByName: actorName || "Examiner",
    evaluatedAt: now,
    updatedAt: now
  });

  // Log audit
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

  // Recalculate final combined result and sync
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

  const attemptRef = doc(db, "exam_attempts", attemptId);
  await updateDoc(attemptRef, {
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

export async function recalculateAttemptResult(attemptId: string, actorId: string, actorName?: string): Promise<ExamAttempt> {
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
    const isSubjective = ["short_question", "fill_gaps", "changing_sentence", "tag_question"].includes(q.questionType);

    const manualEval = manualEvals[q.id];

    if (manualEval !== undefined) {
      // Use manual score directly
      manualMarks += manualEval.obtainedMarks;
      if (manualEval.obtainedMarks >= qMaxMarks) {
        correctCount++;
      } else if (manualEval.obtainedMarks === 0) {
        wrongCount++;
      }
    } else {
      // Evaluate objective auto score
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

  const attemptRef = doc(db, "exam_attempts", attemptId);

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

  await updateDoc(attemptRef, {
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

  // Sync to exam_results collection so candidates & rankings see authoritative updated result
  const existingResult = await getResultByAttemptId(attemptId);
  const now = new Date().toISOString();

  if (existingResult) {
    await updateDoc(doc(db, "exam_results", existingResult.id), {
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
    const newResRef = doc(collection(db, "exam_results"));
    await setDoc(newResRef, {
      id: newResRef.id,
      examId: exam.id,
      examTitle: exam.title,
      attemptId,
      candidateId: attempt.candidateId,
      userId: attempt.userId,
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

  await updateDoc(doc(db, "exam_attempts", attemptId), {
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
  await updateDoc(doc(db, "exam_attempts", attemptId), {
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

  // 1. Update Question Bank item if changing key
  if (action === "change_key" && newCorrectAnswer) {
    await updateQuestion(questionId, { correctAnswer: newCorrectAnswer }, actorId);
  }

  // 2. Fetch all attempts for this exam
  const attemptsRef = collection(db, "exam_attempts");
  const q = query(attemptsRef, where("examId", "==", examId));
  const snap = await getDocs(q);
  const attempts = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExamAttempt));

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
        comment: `Grace marks awarded (${action.replace("_", " ")}) - ${reason || 'Admin action'}`,
        isManuallyOverridden: true,
        evaluatedBy: actorId,
        evaluatedByName: actorName || "Admin",
        evaluatedAt: new Date().toISOString()
      };
    }

    await updateDoc(doc(db, "exam_attempts", att.id), {
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
  const attemptRef = doc(db, "exam_attempts", attemptId);
  const snap = await getDoc(attemptRef);
  if (!snap.exists()) {
    throw new Error("Answer script / attempt not found");
  }

  const data = snap.data();
  const examId = data.examId;
  const candidateId = data.candidateId || data.userId;

  // 1. Delete from exam_attempts
  await deleteDoc(attemptRef);

  // 2. Try deleting matching entry in leaderboard if exists
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

  // 3. Log activity
  await logExamActivity({
    action: "EXAM_DELETED",
    targetId: examId,
    actorId,
    details: `Deleted answer script / attempt ${attemptId} for candidate ${data.candidateName || candidateId} by ${actorName || actorId}`
  });
}

