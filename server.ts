import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '10mb' }));

  app.get("/api/env", (req, res) => {
    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
  });

  app.post("/api/verify-payment", async (req, res) => {
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

      const prompt = `You are an AI payment verifier. You need to verify if the provided screenshot is a valid payment receipt.
Check for the following:
1. Does the receipt show a successful payment or transfer?
2. Is the amount paid exactly or equivalent to ${expectedAmount}? (e.g. Rs 130, $3)
3. Is the target account/number related to ${expectedTarget}? (Sometimes it might be partially masked or match the name associated with it. If it matches ${expectedTarget} or looks like a valid transfer to the correct entity, accept it).
4. Is the date on the receipt within the last 6 days from today? Today is ${new Date().toISOString()}.

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
           return res.json({ verified: true });
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
  });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const language = url.searchParams.get("language") || "Spanish";
    const difficulty = url.searchParams.get("difficulty") || "beginner";
    
    const keyToUse = process.env.GEMINI_API_KEY;

    if (!keyToUse) {
      ws.send(JSON.stringify({ error: "Server error: Missing GEMINI_API_KEY environment variable. The app owner must configure this." }));
      ws.close();
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: keyToUse });
      const session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              ws.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              ws.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck"
              }
            }
          },
          systemInstruction: `You are a conversational language practice partner for someone learning ${language}. The user's difficulty level is ${difficulty}. Keep your responses short and natural. Provide feedback when they make mistakes, but focus primarily on keeping the conversation flowing. Start the conversation right away in ${language}. Use a realistic human male voice.`
        },
      });

      ws.on("message", (data) => {
        try {
          const { audio } = JSON.parse(data.toString());
          if (audio) {
            session.sendRealtimeInput({
              audio: { data: audio, mimeType: "audio/pcm;rate=16000" }
            });
          }
        } catch (e) {
          console.error("Error processing websocket message:", e);
        }
      });

      ws.on("close", () => {
        session.close();
      });
    } catch (err: any) {
      console.error("Error connecting to Live API:", err);
      ws.send(JSON.stringify({ error: err.message || "Failed to connect to Live API" }));
      ws.close();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
