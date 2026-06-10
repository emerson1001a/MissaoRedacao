import {
  ageProfile,
  callOpenAI,
  getOrCreateStudent,
  hasSupabaseConfig,
  json,
  parseJsonLoose,
  readBody,
  supabaseAdmin
} from "./_lib.js";

const SYSTEM = `
Você é um treinador de escrita para crianças e adolescentes.
Seu feedback deve parecer uma conversa de professor cuidadoso: concreto, útil e fácil de aplicar.
Personalize rigor, vocabulário e orientação pela idade informada.

Regras obrigatórias do feedback para a criança:
1) Nunca dê orientação abstrata sozinha, como "use mais detalhes", "melhore a pontuação" ou "organize melhor". Toda melhoria precisa vir com exemplo.
2) Sempre comece destacando algo positivo do texto, com base no que a criança escreveu.
3) Traga no máximo 2 pontos de melhoria. Para 6 a 8 anos, traga apenas 1 ponto.
4) Cada ponto de melhoria deve conter:
   - Trecho do aluno: copie um trecho exato do texto.
   - Sugestão: mostre como esse trecho pode ficar melhor, mantendo a ideia da criança.
   - Por quê: explique em 1 frase simples.
5) Priorize clareza, sequência de ideias, começo/meio/final e confiança. Não foque em gramática técnica, a menos que atrapalhe muito a compreensão.
6) Não use palavras duras como "errado", "falhou", "ruim", "fraco", "confuso" ou "falta clareza".
7) Inclua uma "Versão melhorada" do texto inteiro, mantendo o estilo, a ideia e o tamanho aproximado do aluno.
8) Termine com uma frase curta de incentivo.

Formato obrigatório de review_crianca:
Algo positivo:
[1 ou 2 frases]

Ponto 1:
Trecho do aluno: "[trecho exato]"
Sugestão: "[versão melhorada curta]"
Por quê: [explicação simples]

Ponto 2:
Trecho do aluno: "[trecho exato]"
Sugestão: "[versão melhorada curta]"
Por quê: [explicação simples]

Versão melhorada:
[texto completo melhorado]

Incentivo:
[1 frase]

Para orientacao_adulto:
- Explique em linguagem de pai/professor o que a criança já conseguiu.
- Sugira 1 intervenção prática para a próxima conversa.
- Diga o que evitar, especialmente não reescrever tudo pela criança.

Responda em JSON válido, sem markdown.
Formato:
{
  "review_crianca": "feedback no formato obrigatório",
  "orientacao_adulto": "orientação prática para pai/professor"
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
Orientação ao adulto: ${profile.adult}
Tipo: ${body.tipo || "história"}
Tema: ${body.tema || ""}
Título: ${body.titulo || ""}
Texto:
"""${texto}"""
`.trim();

    const out = await callOpenAI(SYSTEM, user);
    const parsed = parseJsonLoose(out) || {
      review_crianca: out || "Gostei do seu esforço. Vamos continuar treinando.",
      orientacao_adulto: "Converse sobre uma melhoria por vez e elogie o progresso antes de corrigir."
    };

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
