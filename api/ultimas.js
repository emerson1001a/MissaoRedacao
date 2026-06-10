import { hasSupabaseConfig, json, normalizeName, supabaseAdmin } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido" });

  try {
    if (!hasSupabaseConfig()) return json(res, 200, []);

    const db = supabaseAdmin();
    const aluno = String(req.query.aluno || "Miguel").trim() || "Miguel";
    const idade = Number.isFinite(Number(req.query.idade)) ? Number(req.query.idade) : 11;
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 50);

    const { data: alunoRow, error: alunoError } = await db
      .from("alunos")
      .select("id")
      .eq("nome_norm", normalizeName(aluno))
      .eq("idade", idade)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (alunoError) throw alunoError;
    if (!alunoRow?.id) return json(res, 200, []);

    const { data, error } = await db
      .from("redacoes")
      .select("id,tipo,tema,titulo,texto_original,review,orientacao_adulto,created_at")
      .eq("aluno_id", alunoRow.id)
      .order("id", { ascending: false })
      .limit(limit);
    if (error) throw error;

    return json(res, 200, data || []);
  } catch (error) {
    return json(res, 500, { error: "Erro ao carregar histórico", details: String(error.message || error) });
  }
}
