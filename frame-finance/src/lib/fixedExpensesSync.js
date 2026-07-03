// Geração automática de pagamentos de despesas fixas
// Roda quando o app abre e garante que o mês atual + os próximos têm pagamentos gerados.
//
// Fonte única de verdade: tanto o App.jsx (no load da sessão) quanto a criação de
// uma despesa fixa nova (RegistrarGasto.jsx) e a tela de Despesas Fixas chamam
// esta mesma função — evita ter duas implementações divergentes gerando a
// mesma tabela de formas diferentes (foi exatamente isso que causou o bug do
// Shopee-01: a rota antiga não enviava a coluna `month`, que é NOT NULL).

import { supabase } from "./supabase";

export async function syncFixedExpensePayments(userId) {
  try {
    // Gera para o mês anterior, o atual e os 2 próximos — cobre quem fica
    // um tempo sem abrir o app sem deixar fatura faltando, e ainda garante
    // que mexer em "Despesa Fixa" no FAB já deixa o pagamento do mês pronto.
    const months = [];
    const now = new Date();
    for (let i = -1; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(d.toISOString().slice(0, 7));
    }

    const { data: fixedExpenses, error: feError } = await supabase
      .from("fixed_expenses")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    if (feError || !fixedExpenses || fixedExpenses.length === 0) return 0;

    const rows = [];
    for (const fe of fixedExpenses) {
      const dueDay = Math.min(parseInt(fe.due_day || 1), 28);

      for (const month of months) {
        const [y, m] = month.split("-").map(Number);
        const dueDate = new Date(y, m - 1, dueDay);

        // Respeita o início e o fim de vigência da despesa fixa
        if (fe.start_date && dueDate < new Date(fe.start_date)) continue;
        if (fe.end_date && dueDate > new Date(fe.end_date)) continue;

        rows.push({
          user_id: userId,
          fixed_expense_id: fe.id,
          month,
          amount: fe.amount,
          due_date: dueDate.toISOString().split("T")[0],
          paid: false,
        });
      }
    }

    if (rows.length === 0) return 0;

    // upsert com onConflict evita duplicar quem já existe e não derruba
    // o resto do lote se uma linha já estiver lá
    const { error: upsertError } = await supabase
      .from("fixed_expense_payments")
      .upsert(rows, { onConflict: "fixed_expense_id,month", ignoreDuplicates: true });

    if (upsertError) {
      console.error("Erro ao sincronizar despesas fixas:", upsertError);
      return 0;
    }

    return rows.length;
  } catch (err) {
    console.error("Erro ao sincronizar despesas fixas:", err);
    return 0;
  }
}
