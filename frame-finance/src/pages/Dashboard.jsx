import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { generateAlerts } from "../lib/alerts";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const PALETTE = ["#7c3aed","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const ALERT_COLORS = {
  danger:  { bg: "var(--redbg)",   color: "var(--red)",    icon: "⚠" },
  warning: { bg: "#fffbeb",        color: "#d97706",       icon: "⚡" },
  info:    { bg: "var(--accentbg)",color: "var(--accent)", icon: "ℹ" },
  success: { bg: "var(--greenbg)", color: "var(--green)",  icon: "✓" },
};

function HealthScore({ score }) {
  const color = score >= 75 ? "var(--green)" : score >= 50 ? "#f59e0b" : "var(--red)";
  const label = score >= 75 ? "Boa" : score >= 50 ? "Regular" : "Atenção";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="36" fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle cx="45" cy="45" r="36" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 45 45)" style={{ transition: "stroke-dashoffset .6s" }} />
        <text x="45" y="49" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{score}</text>
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>Saúde Financeira</div>
        <div style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Score de 0 a 100</div>
      </div>
    </div>
  );
}

export default function Dashboard({ userId }) {
  const [transactions, setTransactions]   = useState([]);
  const [revenues, setRevenues]           = useState([]);
  const [installments, setInstallments]   = useState([]);
  const [loanInst, setLoanInst]           = useState([]);
  const [goals, setGoals]                 = useState([]);
  const [budgets, setBudgets]             = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [filterMonth, setFilterMonth]     = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const load = async () => {
      const [
        { data: t }, { data: r }, { data: i },
        { data: li }, { data: g }, { data: b },
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
        supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
        supabase.from("installments").select("*").eq("user_id", userId).limit(500),
        supabase.from("loan_installments").select("*").eq("user_id", userId).limit(500),
        supabase.from("goals").select("*").eq("user_id", userId),
        supabase.from("budgets").select("*").eq("user_id", userId).eq("month", new Date().toISOString().slice(0, 7)),
      ]);
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setLoanInst(li || []);
      setGoals(g || []);
      setBudgets(b || []);
      const a = await generateAlerts(userId);
      setAlerts(a);
    };
    load();
  }, [userId]);

  const months = useMemo(() => {
    const s = new Set([...transactions.map(t => t.date.slice(0,7)), ...revenues.map(r => r.date.slice(0,7))]);
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [transactions, revenues, filterMonth]);

  const filteredTx  = useMemo(() => transactions.filter(t => t.date.startsWith(filterMonth)), [transactions, filterMonth]);
  const filteredRev = useMemo(() => revenues.filter(r => r.date.startsWith(filterMonth)), [revenues, filterMonth]);

  const totals = useMemo(() => {
    const rec = filteredRev.reduce((a, r) => a + Number(r.amount), 0) +
                filteredTx.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.value), 0);
    const dep = filteredTx.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
    return { rec, dep, bal: rec - dep };
  }, [filteredTx, filteredRev]);

  // Health score
  const healthScore = useMemo(() => {
    let score = 100;
    const totalRec = revenues.filter(r => r.date.startsWith(filterMonth)).reduce((a, r) => a + Number(r.amount), 0);
    const totalDep = transactions.filter(t => t.date.startsWith(filterMonth) && t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
    const savingRate = totalRec > 0 ? ((totalRec - totalDep) / totalRec) * 100 : 0;
    if (savingRate < 0) score -= 30;
    else if (savingRate < 10) score -= 20;
    else if (savingRate < 20) score -= 10;
    const totalDebt = [...installments, ...loanInst].filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0);
    if (totalRec > 0 && totalDebt / totalRec > 0.5) score -= 25;
    else if (totalRec > 0 && totalDebt / totalRec > 0.3) score -= 15;
    const spentByCategory = {};
    filteredTx.filter(t => t.type === "despesa").forEach(t => { spentByCategory[t.cat] = (spentByCategory[t.cat] || 0) + Number(t.value); });
    const exceeded = budgets.filter(b => (spentByCategory[b.category] || 0) > Number(b.amount)).length;
    score -= exceeded * 8;
    const completedGoals = goals.filter(g => Number(g.saved) >= Number(g.target)).length;
    score += Math.min(completedGoals * 5, 15);
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [transactions, revenues, installments, loanInst, budgets, goals, filterMonth, filteredTx]);

  // Monthly chart
  const monthlyData = useMemo(() => {
    const last6 = [...new Set([...transactions.map(t => t.date.slice(0,7)), ...revenues.map(r => r.date.slice(0,7))])].sort().slice(-6);
    return last6.map(ym => {
      const rec = revenues.filter(r => r.date.startsWith(ym)).reduce((a, r) => a + Number(r.amount), 0) +
                  transactions.filter(t => t.date.startsWith(ym) && t.type === "receita").reduce((a, t) => a + Number(t.value), 0);
      const dep = transactions.filter(t => t.date.startsWith(ym) && t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
      return { name: monthLabel(ym), Receitas: rec, Despesas: dep };
    });
  }, [transactions, revenues]);

  // Debt evolution
  const debtEvolution = useMemo(() => {
    const allInst = [...installments, ...loanInst];
    const months6 = [...new Set(allInst.map(i => (i.due_date || "").slice(0,7)))].sort().slice(-6);
    return months6.map(ym => ({
      name: monthLabel(ym),
      "Em aberto": allInst.filter(i => !i.paid && (i.due_date || "").startsWith(ym)).reduce((a, i) => a + Number(i.amount), 0),
      "Pago":      allInst.filter(i => i.paid && (i.due_date || "").startsWith(ym)).reduce((a, i) => a + Number(i.amount), 0),
    }));
  }, [installments, loanInst]);

  // Pie
  const pieData = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "despesa").forEach(t => { map[t.cat] = (map[t.cat] || 0) + Number(t.value); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredTx]);

  // Savings comparison
  const planned = budgets.reduce((a, b) => a + Number(b.amount), 0);
  const saved = Math.max(0, totals.bal);

  const empty = (msg = "Sem dados ainda") => (
    <div style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0", fontSize: 13 }}>{msg}</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Visão geral das suas finanças</p>
        </div>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{
          padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 500, outline: "none", cursor: "pointer",
        }}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {alerts.map((a, i) => {
            const { bg, color, icon } = ALERT_COLORS[a.type] || ALERT_COLORS.info;
            return (
              <div key={i} style={{ background: bg, borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{icon}</span>
                <span style={{ color: "var(--text)" }}>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs + Health */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Receitas",  value: totals.rec, color: "var(--green)" },
          { label: "Despesas",  value: totals.dep, color: "var(--red)" },
          { label: "Saldo",     value: totals.bal, color: totals.bal >= 0 ? "var(--accent)" : "var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-.02em" }}>{fmt(value)}</div>
          </Card>
        ))}
        <Card><HealthScore score={healthScore} /></Card>
      </div>

      {/* Charts row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Receitas × Despesas</div>
          {monthlyData.length === 0 ? empty() :
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={monthlyData} barSize={13} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Receitas" fill="var(--green)" radius={[4,4,0,0]} />
                <Bar dataKey="Despesas" fill="var(--red)"   radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Por Categoria</div>
          {pieData.length === 0 ? empty("Sem despesas no mês") :
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={30}
                  label={({ percent }) => percent > .08 ? `${(percent*100).toFixed(0)}%` : ""} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* Charts row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {/* Debt evolution */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Evolução de dívidas</div>
          {debtEvolution.length === 0 ? empty("Sem parcelas registradas") :
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={debtEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Em aberto" stroke="var(--red)"   strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Pago"      stroke="var(--green)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          }
        </Card>

        {/* Savings comparison */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Economizado vs Planejado</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Planejado (orçamento)", value: planned, color: "var(--accent)", max: Math.max(planned, saved) },
              { label: "Economizado (saldo)", value: saved, color: "var(--green)", max: Math.max(planned, saved) },
            ].map(({ label, value, color, max }) => {
              const pct = max > 0 ? (value / max) * 100 : 0;
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "var(--muted)" }}>{label}</span>
                    <span style={{ fontWeight: 700, color }}>{fmt(value)}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--border)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
              {saved >= planned
                ? <span style={{ color: "var(--green)", fontWeight: 600 }}>✓ Você economizou {fmt(saved - planned)} acima do planejado!</span>
                : <span style={{ color: "var(--red)", fontWeight: 600 }}>⚠ Faltam {fmt(planned - saved)} para atingir o planejado</span>
              }
            </div>
          </div>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Lançamentos recentes</div>
        {filteredTx.length === 0
          ? empty("Nenhum lançamento neste mês")
          : filteredTx.slice(0, 7).map((tx, i, arr) => (
            <div key={tx.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: tx.type === "receita" ? "var(--greenbg)" : "var(--redbg)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>{tx.type === "receita" ? "↑" : "↓"}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{tx.description}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{tx.cat} · {tx.date}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: tx.type === "receita" ? "var(--green)" : "var(--red)" }}>
                {tx.type === "receita" ? "+" : "-"}{fmt(tx.value)}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}