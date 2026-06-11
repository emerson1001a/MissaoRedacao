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
Seu trabalho é manter a criança motivada e dar apenas uma próxima melhoria importante.
O adulto/professor recebe a análise completa; a criança recebe uma dica curta.

Regras para review_crianca:
1) Seja curto. Use no máximo 6 linhas curtas.
2) Ajuste o nível para a idade informada.
3) Comece com 1 elogio concreto baseado no texto.
4) Escolha apenas 1 melhoria importante para a criança trabalhar agora.
5) A melhoria deve focar em ideia, cena, sequência, emoção, clareza narrativa ou final.
6) Dê preferência para desenvolver uma cena importante, explicar melhor uma ação, mostrar reação dos personagens ou fortalecer o final.
7) Não escolha "dividir em parágrafos", "pontuação", "maiúscula", acento ou erro pequeno como foco principal, a menos que o texto esteja realmente impossível de acompanhar.
8) Se o texto já tiver começo, meio e final, não diga apenas para organizar; escolha uma cena que pode ficar mais viva.
9) Corrija ortografia e pontuação apenas dentro do exemplo, sem transformar isso no assunto principal.
10) Inclua 1 exemplo curto de como melhorar um trecho, mantendo a ideia da criança.
11) Não reescreva o texto inteiro para a criança.
12) Não use palavras duras como "errado", "falhou", "ruim", "fraco", "confuso" ou "falta clareza".
13) Não invente fatos. Só cite coisas que aparecem no texto.

Formato obrigatório de review_crianca:
[Nome], [elogio concreto em 1 frase].

Para melhorar agora, [uma melhoria importante].
Por exemplo: "[uma frase curta melhorada]".

[1 frase final de incentivo].

Regras para orientacao_adulto:
1) Pode ser mais completa que o feedback da criança.
2) Explique o que a criança já faz bem.
3) Indique 1 prioridade pedagógica para a próxima conversa.
4) Traga 2 ou 3 perguntas que o adulto pode fazer para ajudar a criança a desenvolver o texto.
5) Não liste exemplos de ortografia/pontuação na orientação adulta. Se houver erros pequenos, diga apenas para deixá-los para uma revisão final, sem transformar isso na prioridade.
6) Diga o que evitar, especialmente reescrever tudo pela criança.
7) Se útil, sugira uma miniatividade de 5 minutos.

Responda em JSON válido, sem markdown.
Formato:
{
  "review_crianca": "feedback curto para a criança",
  "orientacao_adulto": "orientação mais completa para pai/professor"
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
