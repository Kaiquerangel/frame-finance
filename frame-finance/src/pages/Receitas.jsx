import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

const CATS = ["Salário","Freelance","Investimentos","Aluguel recebido","Dividendos","Presente","Outros"];

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

export default function Receitas({ userId }) {
  const isMobile = useIsMobile();
  const [revenues, setRevenues] = useState([]);
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "", date: today(), recurring: false });

  const load = async () => {
    const { data } = await supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false });
    setRevenues(data || []);
  };

  useEffect(() => { load(); }, [userId]);

  const months = useMemo(() => {
    const s = new Set(revenues.map(r => r.date.slice(0, 7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [revenues, filterMonth]);

  const filtered = useMemo(() => revenues.filter(r => r.date.startsWith(filterMonth)), [revenues, filterMonth]);

  const totalMonth = filtered.reduce((a, r) => a + Number(r.amount), 0);
  const totalYear  = revenues.filter(r => r.date.startsWith(filterMonth.slice(0,4))).reduce((a, r) => a + Number(r.amount), 0);

  const chartData = useMemo(() => {
    const last6 = [...new Set(revenues.map(r => r.date.slice(0,7)))].sort().slice(-6);
    return last6.map(ym => ({
      name: monthLabel(ym),
      Total: revenues.filter(r => r.date.startsWith(ym)).reduce((a, r) => a + Number(r.amount), 0),
    }));
  }, [revenues]);

  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach(r => { map[r.category] = (map[r.category] || 0) + Number(r.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const add = async () => {
    if (!form.description || !form.amount || !form.category) return;
    setLoading(true);
    await supabase.from("revenues").insert({ user_id: userId, ...form, amount: parseFloat(form.amount) });
    setForm({ description: "", amount: "", category: "", date: today(), recurring: false });
    await load();
    setLoading(false);
  };

  const del = async (id) => {
    await supabase.from("revenues").delete().eq("id", id);
    setRevenues(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Receitas</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Acompanhe todas as suas entradas</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Este mês", value: totalMonth, color: "var(--green)" },
          { label: `Ano ${filterMonth.slice(0,4)}`, value: totalYear, color: "var(--accent)" },
          { label: "Média mensal", value: chartData.length ? chartData.reduce((a,c) => a + c.Total, 0) / chartData.length : 0, color: "var(--muted)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color, letterSpacing: "-.02em" }}>{fmt(value)}</div>
          </Card>
        ))}
      </div>

      {/* Chart + Categories */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.6fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Evolução de receitas</div>
          {chartData.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "32px 0", fontSize: 13 }}>Sem dados ainda</div>
            : <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="Total" stroke="var(--green)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--green)" }} />
                </LineChart>
              </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Por categoria</div>
          {byCategory.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "32px 0", fontSize: 13 }}>Sem receitas no mês</div>
            : byCategory.map(([cat, val]) => {
                const pct = totalMonth > 0 ? (val / totalMonth) * 100 : 0;
                return (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{cat}</span>
                      <span style={{ color: "var(--muted)" }}>{fmt(val)}</span>
                    </div>
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--green)", borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })
          }
        </Card>
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Nova Receita</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "2fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Descrição</div>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Salário maio" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Valor (R$)</div>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Categoria</div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Data</div>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
            <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))}
              style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
            Receita recorrente (mensal)
          </label>
          <button onClick={add} disabled={loading} style={{
            padding: "9px 22px", borderRadius: 8, border: "none", background: "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1,
          }}>
            {loading ? "Salvando..." : "+ Adicionar"}
          </button>
        </div>
      </Card>

      {/* List */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Histórico</div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        {filtered.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhuma receita neste mês</div>
          : filtered.map((r, i) => (
            <div key={r.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--greenbg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>↑</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{r.description}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                    {r.category} · {r.date} {r.recurring && <span style={{ color: "var(--accent)", marginLeft: 4 }}>● Recorrente</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--green)" }}>+{fmt(r.amount)}</span>
                <button onClick={() => del(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: 2 }}>×</button>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}
