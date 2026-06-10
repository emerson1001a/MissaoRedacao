import { ageProfile, callOpenAI, json, parseJsonLoose, readBody } from "./_lib.js";

const SYSTEM = `
Você ajuda uma criança a escrever uma redação em etapas.
Responda somente JSON válido.
Se a etapa estiver boa o bastante para continuar, use ok=true.
Se precisar melhorar, use ok=false e dê apenas uma dica curta.
Nunca use palavras duras como ruim, fraco, confuso ou falta clareza.
Personalize tudo pela idade informada:
- 6 a 8 anos: aceite frases simples; use palavras muito concretas.
- 9 a 11 anos: peça sequência de ideias, mas sem exigir texto adulto.
- 12 a 14 anos: peça conexão entre ideias e exemplo.
- 15 a 18 anos: peça argumento, coesão e revisão mais madura.
Formato:
{
  "ok": true,
  "titulo": "string curta",
  "mensagem": "maximo 2 frases",
  "balao": "uma frase curta de ajuda para a criança"
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
        balao: profile.age <= 8 ? "Pode contar do seu jeito, bem simples." : "Uma frase simples já serve para começar."
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
        balao: profile.age <= 8 ? "Conte mais uma coisa que aconteceu." : "Pense em quem aparece, onde acontece e o que mudou."
      });
    }

    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "Erro ao validar", details: String(error.message || error) });
  }
}
