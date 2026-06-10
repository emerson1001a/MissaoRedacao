import { ageProfile, callOpenAI, getOrCreateStudent, hasSupabaseConfig, json, readBody, supabaseAdmin } from "./_lib.js";

const SYSTEM = `
Você é um tutor de escrita infantil e também orienta pais/professores.
Avalie com segurança emocional, foco em progresso e linguagem simples.
Personalize rigor, vocabulário e orientação pela idade informada.
Para 6 a 8 anos: elogie tentativa, oralidade e ideia; peça só uma ação muito pequena.
Para 9 a 11 anos: trabalhe começo, meio, fim, ordem dos fatos e uma melhoria objetiva.
Para 12 a 14 anos: trabalhe coesão, exemplos, parágrafos e conclusão.
Para 15 a 18 anos: trabalhe argumento, repertório, estilo e autonomia.
Responda em JSON valido, sem markdown.
Formato:
{
  "review_crianca": "feedback curto, gentil, em linguagem de criança",
  "orientacao_adulto": "como o pai/professor deve conversar com a criança, incluindo o que fazer e o que evitar"
}
`.trim();

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });

  try {
    const body = await readBody(req);
    const texto = String(body.texto || "").trim();
    if (!texto) return json(res, 400, { error: "Texto vazio" });
    const profile = ageProfile(body.idade);

    const user = `
Aluno: ${body.aluno || "Miguel"}
Idade: ${body.idade || 11}
Perfil por idade: ${profile.label}
Expectativa adequada: ${profile.expected}
Tom com a criança: ${profile.tone}
Orientacao ao adulto: ${profile.adult}
Tipo: ${body.tipo || "história"}
Tema: ${body.tema || ""}
Título: ${body.titulo || ""}
Texto:
"""${texto}"""
`.trim();

    const out = await callOpenAI(SYSTEM, user);
    let parsed;
    try {
      parsed = JSON.parse(out);
    } catch {
      parsed = {
        review_crianca: out || "Gostei do seu esforço. Vamos continuar treinando.",
        orientacao_adulto: "Converse sobre uma melhoria por vez e elogie o progresso antes de corrigir."
      };
    }

    if (hasSupabaseConfig()) {
      const db = supabaseAdmin();
      const alunoId = await getOrCreateStudent(db, body.aluno, body.idade);
      const { error } = await db.from("redacoes").insert({
        aluno_id: alunoId,
        tipo: body.tipo || "",
        tema: body.tema || "",
        titulo: body.titulo || "",
        texto_original: texto,
        review: parsed.review_crianca || "",
        orientacao_adulto: parsed.orientacao_adulto || ""
      });
      if (error) throw error;
    }

    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "Erro ao analisar", details: String(error.message || error) });
  }
}
