import { ageProfile, callOpenAI, json, parseJsonLoose, readBody } from "./_lib.js";

const SYSTEM = `
Você ajuda uma criança a escrever uma redação em etapas.
O botão "Validar etapa" deve ajudar sem travar demais.

Regras:
1) Responda somente JSON válido.
2) Se a etapa estiver boa o bastante para continuar, use ok=true.
3) Use ok=false somente se o texto estiver muito curto ou se não der para entender uma ação/ideia principal.
4) Se ok=false, dê 1 dica concreta e curta, com exemplo de "como pode ficar" baseado no texto do aluno.
5) Nunca dê dicas vagas.
6) Nunca use palavras duras como "ruim", "fraco", "confuso" ou "falta clareza".
7) A mensagem deve ter no máximo 2 frases.
8) Personalize tudo pela idade informada.

Formato:
{
  "ok": true,
  "titulo": "string curta",
  "mensagem": "máximo 2 frases",
  "balao": "uma frase curta de ajuda para a criança",
  "sugestao": {
    "aluno_trecho": "trecho exato do aluno ou vazio",
    "como_pode_ficar": "versão melhorada curta ou vazio"
  }
}
`.trim();

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido" });

  try {
    const body = await readBody(req);
    const texto = String(body.textoEtapa || "").trim();
    const profile = ageProfile(body.idade);
    if (!texto) {
      return json(res, 200, {
        ok: false,
        titulo: "Escreva um pouquinho",
        mensagem: profile.age <= 8 ? "Escreva uma frase pequena antes de continuar." : "Digite pelo menos uma frase antes de continuar.",
        balao: profile.age <= 8 ? "Pode contar do seu jeito, bem simples." : "Uma frase simples já serve para começar.",
        sugestao: { aluno_trecho: "", como_pode_ficar: "" }
      });
    }

    const user = `
Aluno: ${body.aluno || "Miguel"}
Idade: ${body.idade || 11}
Perfil por idade: ${profile.label}
Expectativa adequada: ${profile.expected}
Tom da resposta: ${profile.tone}
Tipo: ${body.tipo || "história"}
Tema: ${body.tema || "(sem tema)"}
Etapa: ${body.etapa || "começo"}
Texto:
"""${texto}"""
`.trim();

    const out = await callOpenAI(SYSTEM, user);
    const parsed = parseJsonLoose(out);
    if (!parsed || typeof parsed.ok !== "boolean") {
      const min = profile.age <= 8 ? 18 : profile.age <= 11 ? 35 : profile.age <= 14 ? 55 : 75;
      return json(res, 200, {
        ok: texto.length >= min,
        titulo: texto.length >= min ? "Pode continuar" : "Só mais um pouco",
        mensagem: texto.length >= min ? "Sua ideia já apareceu. Vamos para a próxima missão." : "Coloque mais um detalhe para a ideia ficar mais completa.",
        balao: profile.age <= 8 ? "Conte mais uma coisa que aconteceu." : "Pense em quem aparece, onde acontece e o que mudou.",
        sugestao: { aluno_trecho: "", como_pode_ficar: "" }
      });
    }

    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "Erro ao validar", details: String(error.message || error) });
  }
}
