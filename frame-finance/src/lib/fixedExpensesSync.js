// Geração automática de pagamentos de despesas fixas
// Roda quando o app abre e garante que o mês atual tem pagamentos gerados

import { supabase } from "./supabase";

export async function syncFixedExpensePayments(userId) {
  try {
    const today     = new Date();
    const thisMonth = today.toISOString().slice(0, 7); // "2026-06"

    // 1. Busca todas as despesas fixas ativas do usuário
    const { data: fixedExpenses, error: feError } = await supabase
      .from("fixed_expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    if (feError || !fixedExpenses || fixedExpenses.length === 0) return;

    // 2. Busca pagamentos já existentes neste mês
    const { data: existing } = await supabase
      .from("fixed_expense_payments")
      .select("fixed_expense_id")
      .eq("user_id", userId)
      .gte("due_date", `${thisMonth}-01`)
      .lte("due_date", `${thisMonth}-31`);

    const existingIds = new Set((existing || []).map(p => p.fixed_expense_id));

    // 3. Para cada despesa fixa que ainda não tem pagamento neste mês, gera um
    const toInsert = [];
    for (const fe of fixedExpenses) {
      if (existingIds.has(fe.id)) continue;

      // Verifica se a despesa já deve estar ativa neste mês
      const startMonth = fe.start_date ? fe.start_date.slice(0, 7) : "2000-01";
      if (startMonth > thisMonth) continue; // ainda não chegou o mês de início

      // Monta a data de vencimento
      const dueDay    = parseInt(fe.due_day || 1);
      const dueDayStr = String(Math.min(dueDay, 28)).padStart(2, "0");
      const dueDate   = `${thisMonth}-${dueDayStr}`;

      toInsert.push({
        user_id:           userId,
        fixed_expense_id:  fe.id,
        amount:            fe.amount,
        due_date:          dueDate,
        paid:              false,
      });
    }

    if (toInsert.length > 0) {
      await supabase.from("fixed_expense_payments").insert(toInsert);
    }

    return toInsert.length; // retorna quantos foram gerados
  } catch (err) {
    console.error("Erro ao sincronizar despesas fixas:", err);
    return 0;
  }
}
