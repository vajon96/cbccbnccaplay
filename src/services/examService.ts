import { 
  db, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, 
  query, where, orderBy, limit, Timestamp, writeBatch, handleFirestoreError, OperationType 
} from "../firebase";
import { 
  QuestionBankItem, QuestionType, QuestionDifficulty, ExamModel, ExamStatus, 
  ExamAttempt, ExamResult, ExamSetting, ExamActivityLog, RandomQuestionRule, AttemptStatus
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
      // Fallback: load questions from selection
      if (exam.selectedQuestionIds && exam.selectedQuestionIds.length > 0) {
        const allQ = await fetchQuestions();
        questions = allQ.filter(q => exam.selectedQuestionIds?.includes(q.id));
      } else if (exam.randomRules) {
        questions = await generateRandomQuestionSet(exam.randomRules);
      }
    }

    // Shuffle questions if required
    let finalQuestions = [...questions];
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
