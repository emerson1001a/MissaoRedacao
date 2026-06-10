import { ageProfile, callOpenAI, json, parseJsonLoose, readBody } from "./_lib.js";

const SYSTEM = `
Você ajuda uma criança a escrever uma redação em etapas.
O botão "Validar etapa" deve incentivar a criança a continuar, sem corrigir demais.
Sua postura é de leitor curioso, não de corretor.

Regra mais importante:
NÃO INVENTE nada. Só afirme fatos que estejam literalmente no texto do aluno.
Se quiser demonstrar curiosidade sobre algo que ainda não foi explicado, faça uma pergunta ou diga "quero saber mais sobre...", mas não diga que aconteceu algo que o aluno não escreveu.

Exemplo proibido:
Texto do aluno: "o foguete ligou e decolamos"
Não diga: "a surpresa do fogo no foguete", porque fogo não foi escrito.

Exemplo permitido:
Texto do aluno: "o foguete ligou e decolamos"
Pode dizer: "fiquei curioso para saber o que vocês viram depois que o foguete decolou."

Regras:
1) Responda somente JSON válido.
2) Se a etapa estiver boa o bastante para continuar, use ok=true.
3) Use ok=false somente se o texto estiver muito curto ou se não der para entender uma ação/ideia principal.
4) Se ok=false, dê 1 dica concreta e curta, com exemplo baseado no texto do aluno.
5) Nunca dê dicas vagas.
6) Nunca use palavras duras como "ruim", "fraco", "confuso" ou "falta clareza".
7) A mensagem deve ter no máximo 3 frases.
8) Personalize tudo pela idade informada.

Quando ok=true:
- Fale com a criança pelo nome.
- Cite 1 ou 2 acertos concretos e verificáveis no texto.
- Mostre curiosidade por algo escrito no texto ou pelo que pode vir depois.
- Se a etapa NÃO for final, convide a clicar em Continuar.
- Se a etapa for final, NÃO pergunte "o que aconteceu depois" e NÃO peça nova parte da história. Reconheça que a redação terminou e convide a criança a clicar em Continuar para ir para a revisão final.
- Não crie título criativo para a etapa.
- Não use tom de boletim, nota ou correção.

Bom tom:
"Emerson, fiquei curioso para saber o que aconteceu depois que o foguete decolou. Você já mostrou que entrou com seus amigos no compartimento e que o foguete saiu com vocês dentro. Agora clique em Continuar para contar a próxima parte."

Bom tom para etapa final:
"Emerson, gostei de como você fechou a aventura mostrando a chegada pela escotilha. Sua redação já tem começo, meio e final. Agora clique em Continuar para ir para a revisão final."

Quando ok=false:
- Comece acolhendo a ideia.
- Peça só um detalhe concreto.
- Dê um exemplo curto baseado no texto da criança.

Formato:
{
  "ok": true,
  "titulo": "Estou curioso",
  "mensagem": "máximo 3 frases",
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
      const aluno = String(body.aluno || "Miguel").trim() || "Miguel";
      const etapa = String(body.etapa || "começo");
      const next = etapa === "começo" ? "o que vai acontecer" : etapa === "meio" ? "como tudo vai terminar" : "a próxima redação";
      const isFinal = etapa === "final";
      return json(res, 200, {
        ok: texto.length >= min,
        titulo: texto.length >= min ? "Estou curioso" : "Só mais um detalhe",
        mensagem: texto.length >= min
          ? isFinal
            ? `${aluno}, gostei de como você fechou sua redação. Agora clique em Continuar para ir para a revisão final.`
            : `${aluno}, sua ideia já começou bem e deu vontade de saber ${next}. Clique em Continuar para seguir.`
          : `${aluno}, sua ideia já apareceu. Conte mais um detalhe para eu imaginar melhor essa parte.`,
        balao: texto.length >= min
          ? isFinal ? "Agora vamos para a revisão final." : "Agora vamos para a próxima parte."
          : profile.age <= 8 ? "Conte mais uma coisa que aconteceu." : "Pense em quem aparece, onde acontece e o que mudou.",
        sugestao: { aluno_trecho: "", como_pode_ficar: "" }
      });
    }

    return json(res, 200, parsed);
  } catch (error) {
    return json(res, 500, { error: "Erro ao validar", details: String(error.message || error) });
  }
}
