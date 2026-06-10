import { createClient } from "@supabase/supabase-js";

export function json(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function ageProfile(idade) {
  const age = Number.isFinite(Number(idade)) ? Number(idade) : 11;
  if (age <= 8) {
    return {
      age,
      label: "criança pequena",
      expected: "frases muito curtas; aceite ideias simples e incompletas",
      tone: "muito acolhedor, concreto, com palavras simples",
      adult: "oriente o adulto a perguntar oralmente e ajudar a criança a contar antes de escrever"
    };
  }
  if (age <= 11) {
    return {
      age,
      label: "criança em desenvolvimento",
      expected: "parágrafos curtos; valorize personagens, lugar e sequência de fatos",
      tone: "leve, encorajador e direto",
      adult: "oriente o adulto a organizar uma ideia por vez, sem reescrever pela criança"
    };
  }
  if (age <= 14) {
    return {
      age,
      label: "pre-adolescente",
      expected: "mais conexão entre ideias, exemplos e conclusão simples",
      tone: "respeitoso, sem infantilizar, mas ainda claro",
      adult: "oriente o adulto a discutir estrutura, exemplos e uma melhoria objetiva por rodada"
    };
  }
  return {
    age,
    label: "adolescente",
    expected: "argumentos mais completos, coesão e revisão de estilo",
    tone: "maduro, direto e colaborativo",
    adult: "oriente o adulto/professor a trabalhar critério, autonomia e revisão por metas"
  };
}

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

export async function getOrCreateStudent(db, nome = "Miguel", idade = 11) {
  const cleanName = String(nome || "Miguel").trim() || "Miguel";
  const age = Number.isFinite(Number(idade)) ? Number(idade) : 11;
  const nomeNorm = normalizeName(cleanName);

  const { data: found, error: findError } = await db
    .from("alunos")
    .select("id")
    .eq("nome_norm", nomeNorm)
    .eq("idade", age)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (found?.id) return found.id;

  const { data, error } = await db
    .from("alunos")
    .insert({ nome: cleanName, idade: age, nome_norm: nomeNorm })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function callOpenAI(system, user) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI HTTP ${response.status}`);
  return extractOutputText(data);
}

export function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data?.output)) return "";
  return data.output
    .map((item) => (item.content || []).map((content) => content.text || "").join(""))
    .join("\n")
    .trim();
}

export function parseJsonLoose(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
