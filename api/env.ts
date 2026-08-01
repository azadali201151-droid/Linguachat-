export default function handler(req: any, res: any) {
  res.status(200).json({ apiKey: process.env.GEMINI_API_KEY || '' });
}
