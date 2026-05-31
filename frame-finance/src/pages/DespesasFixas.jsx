import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const thisMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none",
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{children}</div>
);

const STATUS_COLORS = {
  overdue:  { bg: "var(--redbg)",    color: "var(--red)",    label: "Vencida" },
  due_soon: { bg: "#fffbeb",         color: "#d97706",       label: "Vence em breve" },
  pending:  { bg: "var(--accentbg)", color: "var(--accent)", label: "Pendente" },
  paid:     { bg: "var(--greenbg)",  color: "var(--green)",  label: "Paga" },
};

function getStatus(payment) {
  if (payment.paid) return "paid";
  const today = new Date();
  const due = new Date(payment.due_date);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff <= 5) return "due_soon";
  return "pending";
}

// Generate payments for current + next 2 months if not exists
async function ensurePayments(userId, expenses) {
  const months = [];
  const now = new Date();
  for (let i = -1; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  for (const expense of expenses) {
    if (!expense.active) continue;
    for (const month of months) {
      const [y, m] = month.split("-");
      const dueDate = new Date(+y, +m - 1, expense.due_day);
      // Check if end_date passed
      if (expense.end_date && dueDate > new Date(expense.end_date)) continue;
      // Check if before start
      if (dueDate < new Date(expense.start_date)) continue;

      await supabase.from("fixed_expense_payments").upsert({
        fixed_expense_id: expense.id,
        user_id: userId,
        month,
        amount: expense.amount,
        due_date: dueDate.toISOString().split("T")[0],
        paid: false,
      }, { onConflict: "fixed_expense_id,month", ignoreDuplicates: true });
    }
  }
}

export default function DespesasFixas({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [expenses, setExpenses]   = useState([]);
  const [payments, setPayments]   = useState([]);
  const [categories, setCategories] = useState({ despesa: [] });
  const [filterMonth, setFilterMonth] = useState(thisMonth());
  const [loading, setLoading]     = useState(false);
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});
  const [form, setForm] = useState({
    description: "", amount: "", category: "",
    due_day: "", start_date: today(), end_date: "",
  });

  const load = async () => {
    const [{ data: e }, { data: p }, cats] = await Promise.all([
      supabase.from("fixed_expenses").select("*").eq("user_id", userId).order("due_day"),
      supabase.from("fixed_expense_payments").select("*, fixed_expenses(description, category)").eq("user_id", userId).order("due_date"),
      loadCategories(userId),
    ]);
    const exps = e || [];
    setExpenses(exps);
    setPayments(p || []);
    setCategories(cats);
    if (exps.length > 0) await ensurePayments(userId, exps);
    // Reload payments after ensuring
    const { data: p2 } = await supabase.from("fixed_expense_payments")
      .select("*, fixed_expenses(description, category)").eq("user_id", userId).order("due_date");
    setPayments(p2 || []);
  };

  useEffect(() => { load(); }, [userId]);

  const add = async () => {
    if (!form.description || !form.amount || !form.category || !form.due_day) return;
    setLoading(true);
    const { data } = await supabase.from("fixed_expenses").insert({
      user_id: userId, description: form.description,
      amount: parseFloat(form.amount), category: form.category,
      due_day: parseInt(form.due_day), start_date: form.start_date,
      end_date: form.end_date || null, active: true,
    }).select().single();
    if (data) await ensurePayments(userId, [data]);
    setForm({ description: "", amount: "", category: "", due_day: "", start_date: today(), end_date: "" });
    await load();
    setLoading(false);
  };

  const togglePaid = async (payment) => {
    const paid = !payment.paid;
    await supabase.from("fixed_expense_payments").update({
      paid, paid_at: paid ? new Date().toISOString() : null
    }).eq("id", payment.id);
    setPayments(prev => prev.map(p => p.id === payment.id ? { ...p, paid, paid_at: paid ? new Date().toISOString() : null } : p));
  };

  const startEdit = (exp) => {
    setEditId(exp.id);
    setEditForm({ ...exp });
  };

  const saveEdit = async () => {
    await supabase.from("fixed_expenses").update({
      description: editForm.description, amount: parseFloat(editForm.amount),
      category: editForm.category, due_day: parseInt(editForm.due_day),
      end_date: editForm.end_date || null, active: editForm.active,
    }).eq("id", editId);
    setEditId(null);
    await load();
  };

  const toggleActive = async (id, active) => {
    await supabase.from("fixed_expenses").update({ active: !active }).eq("id", id);
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, active: !active } : e));
  };

  const del = async (id) => {
    await supabase.from("fixed_expenses").delete().eq("id", id);
    await load();
  };

  // Months available
  const months = useMemo(() => {
    const s = new Set(payments.map(p => p.month));
    s.add(filterMonth);
    return [...s].sort();
  }, [payments, filterMonth]);

  const monthPayments = useMemo(() =>
    payments.filter(p => p.month === filterMonth),
    [payments, filterMonth]
  );

  const totalMonth   = monthPayments.reduce((a, p) => a + Number(p.amount), 0);
  const totalPaid    = monthPayments.filter(p => p.paid).reduce((a, p) => a + Number(p.amount), 0);
  const totalPending = totalMonth - totalPaid;
  const overdue      = monthPayments.filter(p => getStatus(p) === "overdue").length;

  return (
    <div>
      {/* Banner de ajuda para novos usuários */}
      <EmptyBanner pageId="despesasfixas" onNavigate={onNavigate} message="Sem despesas fixas cadastradas. Veja como funciona e cadastre seu aluguel, internet e outras contas fixas." />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Despesas Fixas</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "despesasfixas"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Cadastre uma vez, acompanhe todo mês</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total do mês",  value: fmt(totalMonth),   color: "var(--text)" },
          { label: "Pago",          value: fmt(totalPaid),    color: "var(--green)" },
          { label: "Pendente",      value: fmt(totalPending), color: "var(--accent)" },
          { label: "Vencidas",      value: `${overdue} conta(s)`, color: overdue > 0 ? "var(--red)" : "var(--green)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-.02em" }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Nova Despesa Fixa</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><Label>Descrição</Label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Faculdade, Aluguel..." style={inp} /></div>
          <div><Label>Valor (R$)</Label><input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="800,00" style={inp} /></div>
          <div><Label>Categoria</Label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Vence todo dia</Label><input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="15" style={inp} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
          <div><Label>Data início</Label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></div>
          <div><Label>Data fim (opcional)</Label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} /></div>
          <button onClick={add} disabled={loading} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1, whiteSpace: "nowrap" }}>
            {loading ? "..." : "+ Adicionar"}
          </button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16 }}>
        {/* Expenses list */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Despesas cadastradas</div>
          {expenses.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>Nenhuma despesa fixa cadastrada</div>
            : expenses.map(exp => (
              <div key={exp.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                {editId === exp.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, fontSize: 13 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inp, fontSize: 13 }} placeholder="Valor" />
                      <input type="number" value={editForm.due_day} onChange={e => setEditForm(f => ({ ...f, due_day: e.target.value }))} style={{ ...inp, fontSize: 13 }} placeholder="Dia venc." />
                      <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, fontSize: 13 }}>
                        {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={saveEdit} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Salvar</button>
                      <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: exp.active ? "var(--text)" : "var(--muted)", textDecoration: exp.active ? "none" : "line-through" }}>{exp.description}</div>
                        {!exp.active && <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--border)", padding: "1px 6px", borderRadius: 99 }}>Inativa</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{exp.category} · Vence todo dia {exp.due_day}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--red)" }}>{fmt(exp.amount)}</span>
                      <button onClick={() => startEdit(exp)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 13, padding: 2 }}>✎</button>
                      <button onClick={() => toggleActive(exp.id, exp.active)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 11, padding: 2 }}>{exp.active ? "⏸" : "▶"}</button>
                      <button onClick={() => del(exp.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 18, padding: 2 }}>×</button>
                    </div>
                  </div>
                )}
              </div>
            ))
          }
        </Card>

        {/* Monthly payments */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Faturas do mês</div>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          {monthPayments.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>Nenhuma fatura neste mês</div>
            : monthPayments.map((payment, i) => {
                const status = getStatus(payment);
                const { bg, color, label } = STATUS_COLORS[status];
                return (
                  <div key={payment.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < monthPayments.length - 1 ? "1px solid var(--border)" : "none", opacity: payment.paid ? .6 : 1 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button onClick={() => togglePaid(payment)} style={{
                        width: 20, height: 20, borderRadius: 5, border: "2px solid",
                        borderColor: payment.paid ? "var(--green)" : "var(--border)",
                        background: payment.paid ? "var(--green)" : "transparent",
                        cursor: "pointer", color: "#fff", fontSize: 11, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{payment.paid ? "✓" : ""}</button>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: payment.paid ? "line-through" : "none" }}>
                          {payment.fixed_expenses?.description}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                          {payment.fixed_expenses?.category} · Vence {payment.due_date}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: 99 }}>{label}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, color: payment.paid ? "var(--green)" : "var(--red)" }}>{fmt(payment.amount)}</span>
                    </div>
                  </div>
                );
              })
          }
        </Card>
      </div>
      <HelpButton pageId="despesasfixas" onNavigate={onNavigate} />
    </div>
  );
}
