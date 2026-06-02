export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GEMINI_KEY = process.env.VITE_GEMINI_KEY || "";
  if (!GEMINI_KEY) return res.status(500).json({ error: "VITE_GEMINI_KEY non configuree" });

  let prompt = "";
  try {
    prompt = typeof req.body === "string" ? JSON.parse(req.body).prompt : req.body?.prompt;
  } catch {
    prompt = req.body?.prompt;
  }
  if (!prompt) return res.status(400).json({ error: "No prompt" });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
        }),
      }
    );
    const data = await r.json();
    if (data.error) return res.status(400).json({ error: data.error.message });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text });
  } catch (e: any) {
    return res.status(500).json({ error: e.message || "Erreur inconnue" });
  }
}
