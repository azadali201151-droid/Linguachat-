import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { image, plan, region } = req.body;
    if (!image) {
       return res.status(400).json({ error: "Missing image" });
    }

    const keyToUse = process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY" });
    }

    const ai = new GoogleGenAI({ apiKey: keyToUse });
    const base64Data = image.split(',')[1] || image;
    
    const expectedAmount = region === 'pakistan' ? (plan === 'weekly' ? '130' : '500') : (plan === 'weekly' ? '3' : '10');
    const expectedTarget = region === 'pakistan' ? '03141201151' : 'PK82SADA0000003141201151';

    const prompt = `You are an AI payment verifier. You need to verify if the provided screenshot is a valid and authentic payment receipt.
Check for the following criteria very strictly:
1. Does the receipt clearly show a successful payment, transfer, or transaction? (Pending, failed, or "request" screenshots must be rejected).
2. Is the amount paid exactly ${expectedAmount}? (e.g. Rs ${expectedAmount} or $${expectedAmount}). It must match exactly.
3. Does the recipient account/number match or clearly relate to ${expectedTarget}? (Accept if it shows ${expectedTarget} or a partially masked version that aligns with it).
4. Is the date on the receipt within the last 2 days from today? Today is ${new Date().toISOString()}.
5. Does the image look like a genuine banking/wallet app screenshot and not a random image or tampered photo?

If ALL criteria are met, set verified to true. If ANY criterion fails, set verified to false and provide a specific, 1-sentence reason why.
Return your answer as ONLY a raw JSON object with no markdown formatting or backticks:
{
  "verified": boolean,
  "reason": "If verified is false, provide a short 1 sentence reason why."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
         prompt,
         {
            inlineData: {
               data: base64Data,
               mimeType: "image/jpeg"
            }
         }
      ]
    });

    const text = response.text || "";
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
       const parsed = JSON.parse(cleaned);
       if (parsed.verified) {
         return res.status(200).json({ verified: true });
       } else {
         return res.status(400).json({ verified: false, error: parsed.reason });
       }
    } catch (e) {
       console.error("Failed to parse Gemini response:", text);
       return res.status(500).json({ verified: false, error: "Failed to parse AI response." });
    }

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
