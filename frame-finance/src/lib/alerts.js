import { supabase } from "./supabase";

export async function generateAlerts(userId) {
  const alerts = [];
  const today = new Date();
  const thisMonth = today.toISOString().slice(0, 7);
  const monthStart = `${thisMonth}-01`;
  const monthEnd = `${thisMonth}-31`;

  const [
    { data: installments },
    { data: cards },
    { data: budgets },
    { data: transactions },
    { data: goals },
    { data: loanInst },
  ] = await Promise.all([
    supabase.from("installments").select("*, purchases(description, has_interest, cards(name, due_day, closing_day))").eq("user_id", userId).eq("paid", false),
    supabase.from("cards").select("*").eq("user_id", userId),
    supabase.from("budgets").select("*").eq("user_id", userId).eq("month", thisMonth),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("loan_installments").select("*").eq("user_id", userId).eq("paid", false),
  ]);

  // 1. Parcelas vencendo em até 5 dias
  (installments || []).forEach(inst => {
    const due = new Date(inst.due_date);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 5) {
      const cardName = inst.purchases?.cards?.name || "cartão";
      alerts.push({ type: "warning", message: `Parcela de "${inst.purchases?.description}" vence em ${diff === 0 ? "hoje" : `${diff} dia(s)`} — ${cardName}` });
    }
  });

  // 2. Fatura do cartão fechando em até 3 dias
  (cards || []).forEach(card => {
    if (!card.closing_day) return;
    const closing = new Date(today.getFullYear(), today.getMonth(), card.closing_day);
    const diff = Math.ceil((closing - today) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 3) {
      alerts.push({ type: "info", message: `Fatura do ${card.name} fecha em ${diff === 0 ? "hoje" : `${diff} dia(s)`}` });
    }
  });

  // 3. Orçamento excedido
  const spentByCategory = {};
  (transactions || []).filter(t => t.type === "despesa").forEach(t => {
    spentByCategory[t.cat] = (spentByCategory[t.cat] || 0) + Number(t.value);
  });
  (budgets || []).forEach(b => {
    const spent = spentByCategory[b.category] || 0;
    const pct = (spent / Number(b.amount)) * 100;
    if (pct >= 100) alerts.push({ type: "danger", message: `Orçamento de ${b.category} excedido! Gasto: R$ ${spent.toFixed(2)} / Limite: R$ ${Number(b.amount).toFixed(2)}` });
    else if (pct >= 80) alerts.push({ type: "warning", message: `Orçamento de ${b.category} em ${pct.toFixed(0)}% — fique atento!` });
  });

  // 4. Compras parceladas com juros este mês
  const instWithInterest = (installments || []).filter(i => i.due_date?.startsWith(thisMonth) && i.purchases?.has_interest);
  if (instWithInterest.length > 0) {
    alerts.push({ type: "warning", message: `Você tem ${instWithInterest.length} parcela(s) com juros vencendo este mês` });
  }

  // 5. Metas próximas de concluir
  (goals || []).forEach(g => {
    const pct = (Number(g.saved) / Number(g.target)) * 100;
    if (pct >= 80 && pct < 100) alerts.push({ type: "success", message: `Meta "${g.name}" está ${pct.toFixed(0)}% concluída! Quase lá 🎉` });
    if (pct >= 100) alerts.push({ type: "success", message: `🎉 Meta "${g.name}" foi alcançada!` });
  });

  // 6. Empréstimos vencendo em até 5 dias
  (loanInst || []).forEach(inst => {
    const due = new Date(inst.due_date);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 5) {
      alerts.push({ type: "warning", message: `Parcela de empréstimo vence em ${diff === 0 ? "hoje" : `${diff} dia(s)`} — R$ ${Number(inst.amount).toFixed(2)}` });
    }
  });

  return alerts.slice(0, 8);
}
