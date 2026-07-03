/**
 * useMonthlyCosts — fonte única de verdade para custo mensal
 *
 * Critério padronizado para fixed_expense_payments:
 *   SEM filtro .paid  →  "custo do mês" = o que você deve pagar (compromisso)
 *   COM filtro .paid  →  "o que já saiu" = realizado
 *
 * Decisão: usamos SEM filtro (compromisso), que é o que o usuário quer saber
 * quando pergunta "quanto custa esse mês". Página de Análise histórica pode
 * opcionalmente usar onlyPaid=true para mostrar o que realmente saiu.
 *
 * Retorna:
 *   depTx      → gastos avulsos (transactions tipo despesa)
 *   depFixed   → despesas fixas (fixed_expense_payments do mês)
 *   depInst    → parcelas de cartão (installments do mês)
 *   depLoan    → parcelas de empréstimo (loan_installments do mês)
 *   dep        → total despesas (soma dos 4)
 *   rec        → receitas do mês
 *   bal        → saldo (rec - dep)
 *   byCat      → { [categoria]: valor } — todas as fontes unificadas
 *   loading    → boolean
 *   error      → string | null
 *   reload     → função para forçar recarga
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabase";

export function useMonthlyCosts(userId, month, { onlyPaid = false } = {}) {
  const [transactions,    setTransactions]    = useState([]);
  const [revenues,        setRevenues]        = useState([]);
  const [installments,    setInstallments]    = useState([]);
  const [fixedPayments,   setFixedPayments]   = useState([]);
  const [loanInstallments, setLoanInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [tick,    setTick]    = useState(0);

  const reload = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!userId || !month) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase
        .from("transactions")
        .select("id, description, value, cat, type, date, card_id")
        .eq("user_id", userId)
        .like("date", `${month}%`),

      supabase
        .from("revenues")
        .select("id, description, amount, category, date")
        .eq("user_id", userId)
        .like("date", `${month}%`),

      supabase
        .from("installments")
        .select("id, amount, due_date, paid, installment_number, purchases(description, category, card_id, has_interest, cards(name))")
        .eq("user_id", userId)
        .like("due_date", `${month}%`),

      supabase
        .from("fixed_expense_payments")
        .select("id, amount, due_date, paid, fixed_expense_id, fixed_expenses(description, category)")
        .eq("user_id", userId)
        .like("due_date", `${month}%`),

      supabase
        .from("loan_installments")
        .select("id, amount, due_date, paid, installment_number, loans(description, category, type)")
        .eq("user_id", userId)
        .like("due_date", `${month}%`),
    ])
      .then(([tx, rev, inst, fp, loan]) => {
        if (cancelled) return;
        if (tx.error || rev.error || inst.error || fp.error || loan.error) {
          setError("Não foi possível carregar os dados do mês.");
          setLoading(false);
          return;
        }
        setTransactions(tx.data    || []);
        setRevenues(rev.data       || []);
        setInstallments(inst.data  || []);
        setFixedPayments(fp.data   || []);
        setLoanInstallments(loan.data || []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || "Erro inesperado.");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId, month, tick]);

  // ── Cálculos derivados ────────────────────────────────────────────────────

  const depTx = useMemo(() =>
    transactions
      .filter(t => t.type === "despesa")
      .reduce((a, t) => a + Number(t.value), 0),
    [transactions]
  );

  const depFixed = useMemo(() => {
    const list = onlyPaid
      ? fixedPayments.filter(fp => fp.paid)
      : fixedPayments;
    return list.reduce((a, fp) => a + Number(fp.amount), 0);
  }, [fixedPayments, onlyPaid]);

  const depInst = useMemo(() =>
    installments.reduce((a, i) => a + Number(i.amount), 0),
    [installments]
  );

  const depLoan = useMemo(() =>
    loanInstallments.reduce((a, li) => a + Number(li.amount), 0),
    [loanInstallments]
  );

  const dep = depTx + depFixed + depInst + depLoan;

  const rec = useMemo(() =>
    revenues.reduce((a, r) => a + Number(r.amount), 0)
    + transactions
        .filter(t => t.type === "receita")
        .reduce((a, t) => a + Number(t.value), 0),
    [revenues, transactions]
  );

  // Gastos por categoria — todas as fontes unificadas
  const byCat = useMemo(() => {
    const map = {};
    const add = (cat, val) => { map[cat] = (map[cat] || 0) + Number(val); };

    transactions
      .filter(t => t.type === "despesa")
      .forEach(t => add(t.cat || "Outros", t.value));

    (onlyPaid ? fixedPayments.filter(fp => fp.paid) : fixedPayments)
      .forEach(fp => add(fp.fixed_expenses?.category || "Fixas", fp.amount));

    installments
      .forEach(i => add(i.purchases?.category || "Compras", i.amount));

    loanInstallments
      .forEach(li => add(li.loans?.category || "Empréstimos", li.amount));

    return map;
  }, [transactions, fixedPayments, installments, loanInstallments, onlyPaid]);

  // Itens individuais para extrato unificado
  const items = useMemo(() => [
    ...transactions
      .filter(t => t.type === "despesa")
      .map(t => ({
        id: `tx-${t.id}`, date: t.date, desc: t.description,
        cat: t.cat || "Outros", val: Number(t.value),
        src: "Avulso", paid: true,
      })),
    ...(onlyPaid ? fixedPayments.filter(fp => fp.paid) : fixedPayments)
      .map(fp => ({
        id: `fp-${fp.id}`, date: fp.due_date,
        desc: fp.fixed_expenses?.description || "Despesa fixa",
        cat: fp.fixed_expenses?.category || "Fixas",
        val: Number(fp.amount), src: "Fixa", paid: fp.paid,
      })),
    ...installments
      .map(i => ({
        id: `inst-${i.id}`, date: i.due_date,
        desc: i.purchases?.description || "Parcela",
        cat: i.purchases?.category || "Compras",
        val: Number(i.amount), src: "Parcela",
        paid: i.paid,
        extra: i.purchases?.cards?.name,
      })),
    ...loanInstallments
      .map(li => ({
        id: `loan-${li.id}`, date: li.due_date,
        desc: li.loans?.description || "Empréstimo",
        cat: li.loans?.category || "Empréstimos",
        val: Number(li.amount), src: "Empréstimo",
        paid: li.paid,
      })),
  ].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [transactions, fixedPayments, installments, loanInstallments, onlyPaid]
  );

  return {
    // subtotais
    depTx, depFixed, depInst, depLoan, dep,
    rec, bal: rec - dep,
    // breakdown
    byCat, items,
    // dados brutos (para quem precisar filtrar além)
    transactions, revenues, installments, fixedPayments, loanInstallments,
    // estado
    loading, error, reload,
  };
}

/**
 * getMonthlyCosts — versão async sem hook, para uso em alerts.js e funções utilitárias
 * Mesma lógica de cálculo, mas retorna uma Promise com os totais.
 */
export async function getMonthlyCosts(userId, month, { onlyPaid = false } = {}) {
  const [tx, rev, inst, fp, loan] = await Promise.all([
    supabase.from("transactions").select("value, cat, type").eq("user_id", userId).like("date", `${month}%`),
    supabase.from("revenues").select("amount").eq("user_id", userId).like("date", `${month}%`),
    supabase.from("installments").select("amount, purchases(category)").eq("user_id", userId).like("due_date", `${month}%`),
    supabase.from("fixed_expense_payments").select("amount, paid, fixed_expenses(category)").eq("user_id", userId).like("due_date", `${month}%`),
    supabase.from("loan_installments").select("amount, loans(category)").eq("user_id", userId).like("due_date", `${month}%`),
  ]);

  const transactions    = tx.data    || [];
  const revenues        = rev.data   || [];
  const installments    = inst.data  || [];
  const fixedPayments   = fp.data    || [];
  const loanInstallments = loan.data || [];

  const depTx    = transactions.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
  const fpList   = onlyPaid ? fixedPayments.filter(f => f.paid) : fixedPayments;
  const depFixed = fpList.reduce((a, f) => a + Number(f.amount), 0);
  const depInst  = installments.reduce((a, i) => a + Number(i.amount), 0);
  const depLoan  = loanInstallments.reduce((a, l) => a + Number(l.amount), 0);
  const dep      = depTx + depFixed + depInst + depLoan;
  const rec      = revenues.reduce((a, r) => a + Number(r.amount), 0)
                 + transactions.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.value), 0);

  const byCat = {};
  const add = (cat, val) => { byCat[cat] = (byCat[cat] || 0) + Number(val); };
  transactions.filter(t => t.type === "despesa").forEach(t => add(t.cat || "Outros", t.value));
  fpList.forEach(f => add(f.fixed_expenses?.category || "Fixas", f.amount));
  installments.forEach(i => add(i.purchases?.category || "Compras", i.amount));
  loanInstallments.forEach(l => add(l.loans?.category || "Empréstimos", l.amount));

  return { depTx, depFixed, depInst, depLoan, dep, rec, bal: rec - dep, byCat };
}
