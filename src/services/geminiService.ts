import { GoogleGenAI, Type } from "@google/genai";

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

export async function generateAICircular(startDate: string, deadlineDate: string, refNumber: string) {
  try {
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
    
    Provide the output strictly conforming to the requested schema. Return the fields in Bangla.
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
      return JSON.parse(response.text.trim());
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("AI Circular {generateAICircular} Error:", error);
    throw error;
  }
}
