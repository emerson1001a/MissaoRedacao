import { hasSupabaseConfig, json } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido" });

  return json(res, 200, {
    openai: Boolean(process.env.OPENAI_API_KEY),
    openai_model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    supabase: hasSupabaseConfig(),
    checked_at: new Date().toISOString()
  });
}
