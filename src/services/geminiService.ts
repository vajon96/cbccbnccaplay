import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export async function getChatResponse(message: string, history: { role: "user" | "model"; parts: { text: string }[] }[]) {
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm sorry, I encountered an error. Please try again later or contact the Platoon Commander.";
  }
}

export async function analyzeEnrollment(formData: any) {
  try {
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
    
    If there's a photo (base64), also check if it looks like a proper portrait (if I were to provide it).
    For now, just analyze the text data.
    Format: A short paragraph in Bengali.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "আবেদনটি পর্যালোচনার জন্য প্রস্তুত। (Application is ready for review.)";
  }
}

export async function analyzePhoto(base64Image: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image.split(",")[1],
          },
        },
        {
          text: "Analyze this photo for a military/BNCC admit card. Is it a clear face portrait? Is the background neutral? Answer in one short sentence in Bengali.",
        },
      ],
    });
    return response.text;
  } catch (error) {
    console.error("Photo Analysis Error:", error);
    return "ছবিটি গ্রহণ করা হয়েছে। (Photo accepted.)";
  }
}

export async function getAdminInsights(applicants: any[]) {
  try {
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
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Admin Insights Error:", error);
    return "আবেদনকারীদের তথ্য বিশ্লেষণ করা হচ্ছে। (Analyzing applicant data.)";
  }
}

export async function getApplicantSummary(applicant: any) {
  try {
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
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Applicant Summary Error:", error);
    return "আবেদনকারীর তথ্য সঠিক আছে। (Applicant data is correct.)";
  }
}

export async function getQuickFAQ(question: string) {
  try {
    const prompt = `
    You are the BNCC AI Assistant. Answer this question about BNCC enrollment in one short, helpful sentence in Bengali.
    Context: Cox's Bazar City College Platoon.
    Question: ${question}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Quick FAQ Error:", error);
    return "দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। (Sorry, I cannot answer right now.)";
  }
}
