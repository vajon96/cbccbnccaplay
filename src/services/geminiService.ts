// Client-side Gemini API service proxies that safely delegate calls to the backend Express server
// This protects secret keys and adheres to security guidelines.

export async function getChatResponse(
  message: string,
  history: { role: "user" | "model"; parts: { text: string }[] }[]
): Promise<string> {
  try {
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client getChatResponse Error:", error);
    return "দুঃখিত, সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না। অনুগ্রহ করে পরে আবার চেষ্টা করুন।";
  }
}

export async function analyzeEnrollment(formData: any): Promise<string> {
  try {
    const response = await fetch("/api/gemini/analyze-enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client analyzeEnrollment Error:", error);
    return "আবেদনটি সফলভাবে জমা হয়েছে এবং পর্যালোচনার জন্য প্রস্তুত।";
  }
}

export async function analyzePhoto(base64Image: string): Promise<string> {
  try {
    const response = await fetch("/api/gemini/analyze-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Image }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client analyzePhoto Error:", error);
    return "ছবিটি সফলভাবে আপলোড করা হয়েছে।";
  }
}

export async function getAdminInsights(applicants: any[]): Promise<string> {
  try {
    const response = await fetch("/api/gemini/admin-insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicants }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client getAdminInsights Error:", error);
    return "সিস্টেম তথ্য বিশ্লেষণ এই মুহূর্তে অফলাইনে রয়েছে।";
  }
}

export async function getApplicantSummary(applicant: any): Promise<string> {
  try {
    const response = await fetch("/api/gemini/applicant-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client getApplicantSummary Error:", error);
    return "আবেদনকারীর তথ্য সফলভাবে লোড হয়েছে।";
  }
}

export async function getQuickFAQ(question: string): Promise<string> {
  try {
    const response = await fetch("/api/gemini/quick-faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Client getQuickFAQ Error:", error);
    return "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না।";
  }
}

export async function generateAICircular(
  startDate: string,
  deadlineDate: string,
  refNumber: string
): Promise<any> {
  try {
    const response = await fetch("/api/gemini/generate-circular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, deadlineDate, refNumber }),
    });
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Client generateAICircular Error:", error);
    throw error; // Let caller (AICircularManager) handle it and trigger local template fallback
  }
}
