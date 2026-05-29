import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { loadCategories } from "../lib/categories";
import { supabase } from "../lib/supabase";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().slice(0, 7);

const CATS = ["Moradia","Alimentação","Transporte","Saúde","Lazer","Educação","Vestuário","Assinaturas","Outros"];

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

export default function Orcamento({ userId }) {
  const isMobile = useIsMobile();
  const [budgets, setBudgets]           = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth]               = useState(today());
  const [loading, setLoading]           = useState(false);
  const [form, setForm]                 = useState({ category: "", amount: "" });

  const load = async () => {
    const [{ data: b }, { data: t }] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", userId).eq("month", month),
      supabase.from("transactions").select("*").eq("user_id", userId).like("date", `${month}%`),
    ]);
    setBudgets(b || []);
    setTransactions(t || []);
  };

  useEffect(() => { load(); }, [userId, month]);

  const save = async () => {
    if (!form.category || !form.amount) return;
    setLoading(true);
    await supabase.from("budgets").upsert({
      user_id: userId, category: form.category,
      amount: parseFloat(form.amount), month,
    }, { onConflict: "user_id,category,month" });
    setForm({ category: "", amount: "" });
    await load();
    setLoading(false);
  };

  const del = async (id) => {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const spentByCategory = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "despesa").forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + Number(t.value);
    });
    return map;
  }, [transactions]);

  const totalBudget = budgets.reduce((a, b) => a + Number(b.amount), 0);
  const totalSpent  = budgets.reduce((a, b) => a + (spentByCategory[b.category] || 0), 0);
  const totalLeft   = totalBudget - totalSpent;

  const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Orçamento</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Defina limites por categoria e acompanhe seus gastos</p>
      </div>

      {/* Month selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ ...inp, width: "auto", fontWeight: 600 }} />
        <span style={{ fontSize: 13, color: "var(--muted)", textTransform: "capitalize" }}>{monthLabel(month)}</span>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Orçamento total",  value: totalBudget, color: "var(--accent)" },
          { label: "Total gasto",       value: totalSpent,  color: totalSpent > totalBudget ? "var(--red)" : "var(--text)" },
          { label: "Disponível",        value: totalLeft,   color: totalLeft >= 0 ? "var(--green)" : "var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-.02em" }}>{fmt(value)}</div>
          </Card>
        ))}
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--text)" }}>Definir orçamento</div>
        <div style={{ display: isMobile ? "grid" : "flex", gridTemplateColumns: "1fr", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Categoria</div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Limite (R$)</div>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" style={inp} />
          </div>
          <button onClick={save} disabled={loading} style={{
            padding: "10px 22px", borderRadius: 8, border: "none", background: "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1, whiteSpace: "nowrap",
          }}>
            {loading ? "..." : "Salvar"}
          </button>
        </div>
      </Card>

      {/* Budget bars */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Progresso por categoria</div>
        {budgets.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum orçamento definido para este mês</div>
          : budgets.map(b => {
              const spent = spentByCategory[b.category] || 0;
              const pct = Math.min((spent / Number(b.amount)) * 100, 100);
              const over = spent > Number(b.amount);
              const color = pct > 85 ? "var(--red)" : pct > 60 ? "var(--amber)" : "var(--green)";
              return (
                <div key={b.id} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{b.category}</span>
                      {over && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", background: "var(--redbg)", padding: "1px 6px", borderRadius: 99 }}>Excedido</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(spent)} / {fmt(b.amount)}</span>
                      <button onClick={() => del(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>×</button>
                    </div>
                  </div>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s" }} />
                  </div>
                  <div style={{ fontSize: 11, color, marginTop: 4 }}>
                    {over ? `${fmt(spent - Number(b.amount))} acima do limite` : `${fmt(Number(b.amount) - spent)} disponível (${(100 - pct).toFixed(0)}%)`}
                  </div>
                </div>
              );
            })
        }
      </Card>
    </div>
  );
}
