// Auto-geração de receitas recorrentes
// Roda quando o app abre — mesmo padrão do fixedExpensesSync.js
// Para cada receita marcada como recurring=true, verifica se o mês atual
// já tem um registro gerado e, se não tiver, cria um.

import { supabase } from "./supabase";

export async function syncRecurringRevenues(userId) {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7); // "2026-06"

    // 1. Busca todas as receitas recorrentes do usuário
    const { data: recurring, error } = await supabase
      .from("revenues")
      .select("*")
      .eq("user_id", userId)
      .eq("recurring", true)
      .order("date", { ascending: false });

    if (error || !recurring || recurring.length === 0) return 0;

    // 2. Agrupa por descrição+valor+categoria — pega só a mais recente de cada combinação
    //    (evita duplicar se o usuário tem várias entradas da mesma receita recorrente)
    const canonical = {};
    recurring.forEach(r => {
      const key = `${r.description}||${r.amount}||${r.category}`;
      if (!canonical[key]) canonical[key] = r; // já vem ordenado por date desc
    });

    // 3. Verifica quais já têm lançamento no mês atual
    const { data: existing } = await supabase
      .from("revenues")
      .select("description, amount, category")
      .eq("user_id", userId)
      .like("date", `${thisMonth}%`);

    const existingKeys = new Set(
      (existing || []).map(r => `${r.description}||${r.amount}||${r.category}`)
    );

    // 4. Insere as que estão faltando
    const toInsert = [];
    Object.entries(canonical).forEach(([key, r]) => {
      if (existingKeys.has(key)) return; // já existe no mês

      // Mantém o mesmo dia do mês original, limitado ao dia 28
      const origDay = parseInt((r.date || "").slice(8, 10) || "1");
      const day     = Math.min(origDay, 28);
      const newDate = `${thisMonth}-${String(day).padStart(2, "0")}`;

      toInsert.push({
        user_id:     userId,
        description: r.description,
        amount:      r.amount,
        category:    r.category,
        date:        newDate,
        recurring:   true,
      });
    });

    if (toInsert.length > 0) {
      await supabase.from("revenues").insert(toInsert);
    }

    return toInsert.length;
  } catch (err) {
    console.error("Erro ao sincronizar receitas recorrentes:", err);
    return 0;
  }
}
