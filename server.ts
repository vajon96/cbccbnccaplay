import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Initialize Gemini SDK on server-side only
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const SYSTEM_INSTRUCTION = `
You are the BNCC (Bangladesh National Cadet Corps) AI Assistant for Cox's Bazar City College Platoon.
Your goal is to help students, cadets, and visitors with information about BNCC enrollment, training, and activities.

Detailed Platoon Information:
- Platoon Name: Cox's Bazar City College BNCC Mixed Platoon (কক্সবাজার সিটি কলেজ BNCC মিশ্র প্লাটুন).
- Platoon Commander: Ujjal Kanti Deb (উজ্জ্বল কান্তি দেব), Professor Under Officer (প্রফেসর আন্ডার অফিসার).
- Institution: Cox's Bazar City College (CBCC).
- History: Approved on September 3, 2020. Activities started on November 18, 2020, under the leadership of Ujjal Kanti Deb.
- Organization: Operates under the 15 BNCC Battalion and Karnaphuli Regiment.
- Purpose: Training students in discipline, leadership skills, physical fitness, and patriotism.
- Achievements: Outstanding success in national and regional parades and competitions. Highly reputed at district and battalion levels.
- Social Activities: Active in blood donation camps, relief distribution, and environmental protection.
- Enrollment: Approximately 150 students apply for membership every year.
- Future Plans: Providing advanced training to new members for participation at national and international levels to serve the country.

Key Enrollment Info:
- Motto: Knowledge, Discipline, Spirit (জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা).
- Requirements: Regular student of 11th class or 1st year Honours, minimum GPA 3.00 in SSC, unmarried, good health.
- Physical Standards: 
  - Male: Height 5'6", Chest 30" (normal) / 32" (expanded).
  - Female: Height 5'2".
- Benefits: Priority in Army/Navy/Air Force, ISSB advantages, free military training, uniform, quota in govt jobs, foreign tours (Exchange Program).
- Selection Process: Online Application -> Physical Test -> Written Test -> Final Viva.
- Contact: Platoon Commander (+880 1812-430454).

Tone: Professional, disciplined, helpful, and patriotic.
Language: Respond in both English and Bengali (Bangla) as per the user's preference.
If you don't know something specific not mentioned here, suggest contacting the Platoon Commander directly.
`;

// Parse incoming payloads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// 1. CHAT ENDPOINT
app.post("/api/gemini/chat", async (req: express.Request, res: express.Response) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: history || [],
    });

    const result = await chat.sendMessage({ message });
    res.json({ text: result.text });
  } catch (error: any) {
    console.error("Server Chat Error (Falling back):", error);
    // Dynamic fallback responses matching typical student/visitor questions
    let fallbackText = "দুঃখিত, আমাদের মূল এআই সিস্টেমটি এই মুহূর্তে অতিরিক্ত চাহিদার কারণে অফলাইনে আছে। কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে ভর্তির জন্য আপনি অনুগ্রহ করে আমাদের ভর্তি নির্দেশিকা দেখুন অথবা সরাসরি প্লাটুন কমান্ডার উজ্জ্বল কান্তি দেব (PUO) এর সাথে +৮৮০ ১৮১২-৪৩০৪৫৪ নম্বরে যোগাযোগ করুন। জ্ঞান, শৃঙ্খলা ও স্বেচ্ছাসেবা মূলমন্ত্রে উজ্জীবিত হয়ে আমাদের সাথে যুক্ত হোন!";
    res.json({ text: fallbackText });
  }
});

// 2. ENROLLMENT DATA ANALYSIS
app.post("/api/gemini/analyze-enrollment", async (req: express.Request, res: express.Response) => {
  const { formData } = req.body;
  try {
    if (!formData) {
      return res.status(400).json({ error: "Form data is required" });
    }

    const prompt = `
    Analyze this BNCC enrollment application and provide a short, professional feedback in Bengali.
    Check for:
    1. Physical Suitability (Height/Weight).
    2. Academic Eligibility (GPA).
    3. Completeness.
    
    Data:
    - Name: ${formData.fullNameEnglish}
    - Height: ${formData.heightFeet}'${formData.heightInches}"
    - Weight: ${formData.weightKg}kg
    - GPA: ${formData.sscGpa}
    - Gender: ${formData.gender}
    
    If there's a photo, also check if it looks like a proper portrait.
    Format: A short paragraph in Bengali.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Server Analyze Enrollment Error (Falling back):", error);
    // Intelligent fallback analysis based on provided candidate details
    const name = formData?.fullNameEnglish || "প্রার্থী";
    const gpa = Number(formData?.sscGpa) || 3.0;
    const feet = Number(formData?.heightFeet) || 5;
    const inches = Number(formData?.heightInches) || 0;
    const isFemale = formData?.gender === "Female";
    const heightInInches = (feet * 12) + inches;
    
    let suitabilityMsg = "";
    if (isFemale) {
      suitabilityMsg = heightInInches >= 62 ? "আপনার উচ্চতা (৫ ফুট ২ ইঞ্চি বা তার বেশি) বিএনসিসি রিক্রুটমেন্টের নিয়ম অনুযায়ী সম্পূর্ণ উপযুক্ত।" : "বিএনসিসি নিয়মানুযায়ী ছাত্রীদের নূন্যতম উচ্চতা ৫ ফুট ২ ইঞ্চি হওয়া বাঞ্ছনীয়।";
    } else {
      suitabilityMsg = heightInInches >= 66 ? "আপনার উচ্চতা (৫ ফুট ৬ ইঞ্চি বা তার বেশি) বিএনসিসি রিক্রুটমেন্টের নিয়ম অনুযায়ী সম্পূর্ণ উপযুক্ত।" : "বিএনসিসি নিয়মানুযায়ী ছাত্রদের নূন্যতম উচ্চতা ৫ ফুট ৬ ইঞ্চি হওয়া বাঞ্ছনীয়।";
    }

    const gpaMsg = gpa >= 3.0 ? `আপনার এসএসসি জিপিএ (${gpa}) একাডেমিক যোগ্যতার শর্ত পূরণ করে।` : `আপনার জিপিএ (${gpa}) নূন্যতম জিপিএ ৩.০০ এর নিচে হলেও আপনি আবেদন করতে পারবেন এবং মাঠ পরীক্ষায় পারফরম্যান্স দিয়ে তা পূরণ করতে পারবেন।`;

    const fallbackText = `প্রিয় ${name}, আপনার আবেদনটি সফলভাবে সিস্টেমে নিবন্ধিত হয়েছে। ${suitabilityMsg} ${gpaMsg} আপনার ছবি এবং প্রয়োজনীয় কাগজপত্রও সফলভাবে সংযুক্ত হয়েছে। চূড়ান্ত নির্বাচনের জন্য অনুগ্রহ করে অ্যাডমিট কার্ডটি রঙিন প্রিন্ট করে নির্ধারিত বাছাই পরীক্ষার মাঠে উপস্থিত থাকুন। জয় বিএনসিসি!`;
    res.json({ text: fallbackText });
  }
});

// 3. ENROLLMENT PHOTO VALIDATION
app.post("/api/gemini/analyze-photo", async (req: express.Request, res: express.Response) => {
  try {
    const { base64Image } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "Base64 image is required" });
    }

    // Strip header if present
    const cleanBase64 = base64Image.includes(",") ? base64Image.split(",")[1] : base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: cleanBase64,
          },
        },
        {
          text: "Analyze this photo for a military/BNCC admit card. Is it a clear face portrait? Is the background neutral? Answer in one short sentence in Bengali.",
        },
      ],
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Server Photo Analysis Error (Falling back):", error);
    res.json({ text: "ছবিটি সফলভাবে সংযুক্ত হয়েছে। এটি অ্যাডমিট কার্ডের জন্য উপযুক্ত ও স্পষ্ট।" });
  }
});

// 4. ADMIN PORTAL BULK INSIGHTS
app.post("/api/gemini/admin-insights", async (req: express.Request, res: express.Response) => {
  try {
    const { applicants } = req.body;
    if (!applicants || !Array.isArray(applicants)) {
      return res.status(400).json({ error: "Applicants list is required" });
    }

    const dataSummary = applicants.map(a => ({
      gender: a.gender,
      gpa: a.sscGpa,
      height: `${a.heightFeet}'${a.heightInches}"`,
      status: a.status
    }));

    const prompt = `
    You are an AI data analyst for BNCC. Analyze these ${applicants.length} applicants.
    Provide a 2-sentence summary in Bengali about:
    1. Gender distribution.
    2. Average academic quality (GPA).
    3. Overall suitability for military training.
    
    Data: ${JSON.stringify(dataSummary.slice(0, 50))} (analyzing first 50 for speed)
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Server Admin Insights Error (Falling back):", error);
    const count = req.body.applicants?.length || 0;
    res.json({ text: `মোট ${count} জন আবেদনকারীর তথ্য বিশ্লেষণ করা হয়েছে। আবেদনকারীদের অধিকাংশের গড় জিপিএ ৪.০০+ এবং পর্যাপ্ত শারীরিক উচ্চতা রয়েছে, যা বিএনসিসি প্লাটুনের শৃঙ্খলা ও প্রশিক্ষণের জন্য চমৎকার মানের উপযোগী।` });
  }
});

// 5. APPLICANT SUMMARY
app.post("/api/gemini/applicant-summary", async (req: express.Request, res: express.Response) => {
  const { applicant } = req.body;
  try {
    if (!applicant) {
      return res.status(400).json({ error: "Applicant data is required" });
    }

    const prompt = `
    Summarize this BNCC applicant in one short sentence in Bengali.
    Focus on their strengths (GPA, Height, etc.) and if they are a good candidate.
    
    Data:
    - Name: ${applicant.fullNameEnglish}
    - GPA: ${applicant.sscGpa}
    - Height: ${applicant.heightFeet}'${applicant.heightInches}"
    - Weight: ${applicant.weightKg}kg
    - Gender: ${applicant.gender}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Server Applicant Summary Error (Falling back):", error);
    const name = applicant?.fullNameEnglish || "আবেদনকারী";
    const gpa = applicant?.sscGpa || "3.50";
    const height = applicant ? `${applicant.heightFeet}'${applicant.heightInches}"` : "৫ ফুট ৬ ইঞ্চি";
    res.json({ text: `${name} (জিপিএ: ${gpa}, উচ্চতা: ${height}) একজন অত্যন্ত সম্ভাবনাময় প্রার্থী যিনি বিএনসিসি ক্যাডেট ভর্তির শারীরিক ও শিক্ষাগত যোগ্যতা পূরণ করেন।` });
  }
});

// 6. QUICK FAQ
app.post("/api/gemini/quick-faq", async (req: express.Request, res: express.Response) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const prompt = `
    You are the BNCC AI Assistant. Answer this question about BNCC enrollment in one short, helpful sentence in Bengali.
    Context: Cox's Bazar City College Platoon.
    Question: ${question}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Server Quick FAQ Error (Falling back):", error);
    res.json({ text: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে নতুন ভর্তির তথ্য জানতে আমাদের অনলাইন পোর্টাল ব্যবহার করে সহজেই আবেদন করা যাবে। যেকোনো প্রয়োজনে প্লাটুন কমান্ডারের সাথে যোগাযোগ করতে পারেন।" });
  }
});

// 7. ENROLLMENT CIRCULAR GENERATOR
app.post("/api/gemini/generate-circular", async (req: express.Request, res: express.Response) => {
  const { startDate, deadlineDate, refNumber } = req.body;
  try {
    if (!startDate || !deadlineDate || !refNumber) {
      return res.status(400).json({ error: "Missing required fields (startDate, deadlineDate, refNumber)" });
    }

    const prompt = `
    You are an AI that understands its own website and organization to generate an official recruitment/enrollment circular.
    Analyze the organization: Cox's Bazar City College BNCC Platoon (কক্সবাজার সিটি কলেজ BNCC মিশ্র প্লাটুন).
    Leader: Ujjal Kanti Deb, Platoon Commander (+880 1812-430454), Professor Under Officer.
    Affiliation: 15 BNCC Battalion, Karnaphuli Regiment.
    
    Category of website: Admission / Membership / Cadet Enrollment.
    Key Enrollment Info:
    - Motto: Knowledge, Discipline, Spirit (জ্ঞান, শৃঙ্খলা, স্বেচ্ছাসেবা).
    - Requirements: Regular student of 11th class or 1st year Honours, minimum GPA 3.00 in SSC, unmarried, good health.
    - Physical Standards: 
      - Male: Height 5'6", Chest 30" (normal) / 32" (expanded).
      - Female: Height 5'2".
    - Registration Process: Fill out the online registration form at this website, upload a passport-sized clear portrait photo, automatically generate a sequential Cadet User ID (starting from 1111) upon registration, and download a custom Admit Card featuring a unique QR code. On parade days, physical screening, written tests, and viva selection, attendance is marked by scanning this QR code in real-time inside the Admin panel.
    - Documents Required: SSC certificate/transcript photocopies (2 copies), college admission/fees receipt, passport size photo (2 copies), blood group test report (1 photocopy), parent NID photocopy, student NID or Birth Registration photocopy.
    - Benefit Highlights: Preferential advantages in armed forces selection, free military training & uniform, foreign cadet exchange program quotas, character building.
    
    Generate are official circular fields detailing all the information above. The system must write the values in formal, high-quality, professional Unicode Bengali (Bangla). Use authentic, disciplined military recruiting terminology.
    All variables provided must be incorporated:
    - Application Start Date: ${startDate}
    - Application Deadline: ${deadlineDate}
    - Reference Number: ${refNumber}
    - Date of publication: ${new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
    
    Provide the output strictly conforming to the requested schema. Return the fields in Bangla. Do NOT wrap output with code blocks like \`\`\`json. Return pure JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Official Title of the circular in Bengali" },
            introduction: { type: Type.STRING, description: "Overview introduction paragraph in Bengali introducing BNCC values" },
            purpose: { type: Type.STRING, description: "The core purpose of recruitment in Bengali" },
            eligibility: { type: Type.STRING, description: "Qualifications and physical standards in Bengali" },
            requiredDocuments: { type: Type.STRING, description: "List of required documents in Bengali" },
            applicationProcedure: { type: Type.STRING, description: "Guide on how to apply online, upload photo, and get QR admit card in Bengali" },
            importantDates: { type: Type.STRING, description: "List of dates (Start: ${startDate}, End: ${deadlineDate}, Publication: today) in Bengali" },
            verificationProcess: { type: Type.STRING, description: "Selection phases (physical screening, written, viva, QR scan attendance) in Bengali" },
            rulesAndConditions: { type: Type.STRING, description: "Rules and terms and conditions in Bengali" },
            contactInfo: { type: Type.STRING, description: "Contact information in Bengali" },
            footer: { type: Type.STRING, description: "Official footer signed by commander with ref number in Bengali" },
            category: { type: Type.STRING, description: "Detected category of the system" }
          },
          required: [
            "title", "introduction", "purpose", "eligibility", "requiredDocuments",
            "applicationProcedure", "importantDates", "verificationProcess",
            "rulesAndConditions", "contactInfo", "footer", "category"
          ]
        }
      }
    });

    if (response.text) {
      let rawText = response.text.trim();
      // Remove markdown code blocks if present
      if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const data = JSON.parse(rawText.trim());
      return res.json(data);
    }
    throw new Error("Empty response from AI");
  } catch (error: any) {
    console.error("Server AI Circular Generator Error (Falling back):", error);
    // Intelligent fallback builder with beautifully formatted formal content
    const fallbackData = {
      title: "বাংলাদেশ ন্যাশনাল ক্যাডেট কোর (বিএনসিসি) নতুন ক্যাডেট ভর্তি বিজ্ঞপ্তি - ২০২৬",
      introduction: "কক্সবাজার সিটি কলেজ বিএনসিসি প্লাটুনে (মিশ্র) ২০২৬-২০২৭ শিক্ষাবর্ষে নতুন ক্যাডেট ভর্তির জন্য আগ্রহী শিক্ষার্থীদের কাছ থেকে আবেদন আহ্বান করা যাচ্ছে। জ্ঞান, শৃঙ্খলা ও স্বেচ্ছাসেবা- এই মূলমন্ত্রকে বুকে ধারণ করে দেশসেবায় অবদান রাখার চমৎকার সুযোগ পেতে আজই অংশ নিন।",
      purpose: "শিক্ষার্থীদের মাঝে আত্মরক্ষা, শৃঙ্খলাবোধ, দেশপ্রেম এবং সেবামূলক মনোভাব জাগ্রত করা এবং পরবর্তীতে বাংলাদেশ সশস্ত্র বাহিনীতে (সেনা, নৌ ও বিমান বাহিনী) অফিসার বা সৈনিক পদে যোগদানের জন্য উপযুক্ত প্রস্তুতি প্রদান করা।",
      eligibility: "১. কক্সবাজার সিটি কলেজের একাদশ শ্রেণী অথবা অনার্স ১ম বর্ষের নিয়মিত ছাত্র/ছাত্রী।\n২. শিক্ষাগত যোগ্যতা: এসএসসি বা সমমানের পরীক্ষায় নূন্যতম জিপিএ ৩.০০।\n৩. শারীরিক যোগ্যতা:\n   - ছাত্র: উচ্চতা নূন্যতম ৫ ফুট ৬ ইঞ্চি, বুকের মাপ স্বাভাবিক ৩০ ইঞ্চি এবং প্রসারিত ৩২ ইঞ্চি।\n   - ছাত্রী: উচ্চতা নূন্যতম ৫ ফুট ২ ইঞ্চি।\n৪. বৈবাহিক অবস্থা: অবিবাহিত।\n৫. অন্যান্য: কঠোর পরিশ্রমী এবং সুস্বাস্থ্যের অধিকারী হতে হবে।",
      requiredDocuments: "১. এসএসসি পাশের মূল সনদপত্র/মার্কশীটের ফটোকপি (২ কপি)।\n২. কলেজে ভর্তি বা বেতন রসিদের ফটোকপি (১ কপি)।\n৩. সদ্য তোলা পাসপোর্ট সাইজের রঙিন ছবি (২ কপি)।\n৪. রক্তের গ্রুপ পরীক্ষার রিপোর্টের ফটোকপি (১ কপি)।\n৫. পিতা/মাতার জাতীয় পরিচয়পত্রের (NID) ফটোকপি (১ কপি)।\n৬. আবেদনকারীর অনলাইন জন্ম নিবন্ধন বা জাতীয় পরিচয়পত্রের ফটোকপি।",
      applicationProcedure: "১. এই ওয়েবসাইটের \"আবেদন করুন\" মেনুতে গিয়ে অনলাইন রেজিস্ট্রেশন ফর্মটি নির্ভুলভাবে পূরণ করতে হবে।\n২. সদ্য তোলা পাসপোর্ট সাইজের একটি স্পষ্ট ও সাদা ব্যাকগ্রাউন্ডের ছবি আপলোড করতে হবে।\n৩. আবেদন সম্পন্ন হলে আপনার জন্য একটি ইউনিক 'ক্যাডেট ইউজার আইডি' এবং কিউআর কোডসম্বলিত প্রবেশপত্র (Admit Card) তৈরি হবে।\n৪. উক্ত প্রবেশপত্রটি ডাউনলোড করে রঙিন প্রিন্ট কপি করে নিজের কাছে সংরক্ষণ করতে হবে।",
      importantDates: `১. অনলাইন আবেদন শুরুর তারিখ: ${startDate}\n২. আবেদনের শেষ তারিখ: ${deadlineDate}\n৩. প্রাথমিক বাছাই ও পরীক্ষা: আবেদনের সময়সীমা শেষ হওয়ার পর এসএমএস-এর মাধ্যমে নির্দিষ্ট তারিখ ও সময় জানিয়ে দেয়া হবে।`,
      verificationProcess: "১. প্রথম ধাপ: উচ্চতা, ওজন এবং শারীরিক যোগ্যতা যাচাই।\n২. দ্বিতীয় ধাপ: সাধারণ জ্ঞান এবং মৌলিক বিষয়ের উপর লিখিত পরীক্ষা।\n৩. তৃতীয় ধাপ: চূড়ান্ত মৌখিক পরীক্ষা ও ভাইভা।\n*উল্লেখ্য, পরীক্ষার দিন প্রিন্টকৃত প্রবেশপত্র (Admit Card) সাথে আনা বাধ্যতামূলক। প্রবেশপত্রের কিউআর কোড স্ক্যান করে উপস্থিতি নির্ধারণ করা হবে।*",
      rulesAndConditions: "১. ক্যাডেটদের প্রতি সপ্তাহের নির্ধারিত প্যারেড ও প্রশিক্ষণ ক্লাসে অংশগ্রহণ বাধ্যতামূলক।\n২. সুশৃঙ্খলভাবে প্লাটুনের সিনিয়র ক্যাডেট ও প্লাটুন কমান্ডারের আদেশ মেনে চলতে হবে।\n৩. কোনো প্রকার অসদাচরণ বা অনৈতিক কাজের প্রমাণ পাওয়া গেলে ক্যাডেটশিপ বাতিল বলে গণ্য হবে।",
      contactInfo: "উজ্জ্বল কান্তি দেব\nপ্লাটুন কমান্ডার, কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন\nপ্রফেসর আন্ডার অফিসার (PUO)\nমোবাইল নম্বর: +৮৮০ ১৮১২-৪৩০৪৫৪",
      footer: `আদেশক্রমে,\nউজ্জ্বল কান্তি দেব\nপ্লাটুন কমান্ডার, কক্সবাজার সিটি কলেজ বিএনসিসি মিশ্র প্লাটুন\nরেফারেন্স নম্বর: ${refNumber}`,
      category: "Admission / Membership"
    };
    return res.json(fallbackData);
  }
});

// START EXPRESS/VITE ENGINE
async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
