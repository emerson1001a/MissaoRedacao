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
A redação já terminou. Seu papel com a criança é fechar a experiência com incentivo, não pedir que ela volte a escrever mais agora.
O adulto/professor recebe a análise completa; a criança recebe uma devolutiva curta.

Regras para review_crianca:
1) Seja curto. Use no máximo 5 linhas curtas.
2) Ajuste o nível para a idade informada.
3) Comece com 1 elogio concreto baseado no texto.
4) Preserve exatamente o nome informado pelo usuário, incluindo acentos.
5) Não diga "para ficar ainda melhor, escreva mais..." como se a redação atual ainda precisasse continuar.
6) Se houver dica, formule como aprendizado para a próxima história/redação.
7) A dica deve focar em ideia, cena, sequência, emoção, clareza narrativa ou final.
8) Não escolha "dividir em parágrafos", "pontuação", "maiúscula", acento ou erro pequeno como foco principal, a menos que o texto esteja realmente impossível de acompanhar.
9) Não reescreva o texto inteiro para a criança.
10) Não use palavras duras como "errado", "falhou", "ruim", "fraco", "confuso" ou "falta clareza".
11) Não invente fatos. Só cite coisas que aparecem no texto.

Formato obrigatório de review_crianca:
[Nome], [elogio concreto em 1 frase].

Na próxima história, [uma dica pequena e acionável].

[1 frase final de comemoração/incentivo].

Exemplo de tom:
"José, adorei sua aventura com o dinossauro no rio.

Na próxima história, você pode mostrar uma ação bem importante da brincadeira, como o que vocês fizeram juntos.

Você terminou uma história divertida. Parabéns pela criatividade!"

Regras para orientacao_adulto:
1) Pode ser mais completa que o feedback da criança.
2) Explique o que a criança já faz bem.
3) Indique 1 prioridade pedagógica para a próxima conversa ou próxima redação.
4) Traga 2 ou 3 perguntas que o adulto pode fazer para ajudar a criança a desenvolver textos futuros.
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

function fallbackReview(body, texto, profile) {
  const aluno = String(body.aluno || "Miguel").trim() || "Miguel";
  const tipo = String(body.tipo || "historia").trim() || "historia";
  const tema = String(body.tema || "").trim();
  const titulo = String(body.titulo || "").trim();
  const clean = texto.replace(/\s+/g, " ").trim();
  const trecho = clean.length <= 90 ? clean : `${clean.slice(0, 90).trim()}...`;

  const childTip = profile.age <= 8
    ? "Na proxima historia, conte uma coisa bem importante que aconteceu e como voce se sentiu."
    : profile.age <= 11
      ? "Na proxima historia, escolha uma cena importante e mostre um pouco mais o que os personagens fizeram."
      : "Na proxima redacao, escolha uma ideia central e fortaleca com mais detalhe, exemplo ou ligacao entre os paragrafos.";

  return {
    review_crianca: `${aluno}, gostei de ver que voce terminou seu texto e manteve uma sequencia de ideias.\n\n${childTip}\n\nVoce concluiu uma redacao completa. Parabens pelo capricho!`,
    orientacao_adulto: [
      `A redacao de ${aluno} ja mostra uma producao completa para o perfil de ${profile.label}.`,
      `Ponto positivo: ha uma tentativa de organizar o texto em uma sequencia, com tema${tema ? ` "${tema}"` : ""}${titulo ? ` e titulo "${titulo}"` : ""}.`,
      "Prioridade pedagogica: na proxima conversa, ajude a crianca a escolher uma cena do texto e detalhar melhor quem fez o que, onde aconteceu e por que isso foi importante.",
      "Perguntas uteis: qual foi a parte mais importante? O que o personagem sentiu nesse momento? Como o leitor percebe que a historia terminou?",
      "Evite reescrever o texto pela crianca. Primeiro valorize a ideia, depois escolha uma melhoria pequena para revisar.",
      `Trecho observado: "${trecho}". Tipo escolhido: ${tipo}.`
    ].join("\n\n"),
    fallback: true
  };
}

async function saveReview(body, texto, parsed) {
  if (!hasSupabaseConfig()) return;

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

    let parsed;
    try {
      const out = await callOpenAI(SYSTEM, user);
      parsed = parseJsonLoose(out) || {
      review_crianca: out || "Gostei do seu esforço. Você terminou sua redação e isso já é uma conquista.",
      orientacao_adulto: "Converse sobre uma melhoria para a próxima redação e elogie o progresso antes de corrigir."
      };
    } catch (error) {
      parsed = fallbackReview(body, texto, profile);
      parsed.ai_error = String(error.message || error);
    }

    saveReview(body, texto, parsed).catch((error) => {
      console.error("Erro ao salvar redacao", error);
    });

    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "Erro ao analisar", details: String(error.message || error) });
  }
}
