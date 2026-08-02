export default function handler(req: any, res: any) {
  // Check both GEMINI_API_KEY and VITE_GEMINI_API_KEY to ensure it works on Vercel
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  res.status(200).json({ apiKey });
}
