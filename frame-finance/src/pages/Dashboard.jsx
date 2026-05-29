import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { generateAlerts } from "../lib/alerts";
import { useIsMobile } from "../lib/useIsMobile";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Treemap
} from "recharts";

const fmt  = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const PALETTE = ["#7c3aed","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4"];

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

function CardGauge({ card, used }) {
  const pct = card.limit_amount > 0 ? Math.min((used / card.limit_amount) * 100, 100) : 0;
  const color = pct > 80 ? "var(--red)" : pct > 60 ? "#f59e0b" : "var(--green)";
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx="35" cy="35" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="35" cy="35" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 35 35)" style={{ transition: "stroke-dashoffset .5s" }} />
        <text x="35" y="39" textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>{pct.toFixed(0)}%</text>
      </svg>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{card.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{fmt(used)} / {fmt(card.limit_amount)}</div>
        <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1 }}>
          {pct > 80 ? "⚠ Limite alto!" : pct > 60 ? "Atenção" : "Saudável"}
        </div>
      </div>
    </div>
  );
}

function GoalRing({ goal }) {
  const pct = Math.min((Number(goal.saved) / Number(goal.target)) * 100, 100);
  const done = pct >= 100;
  const color = done ? "var(--green)" : "var(--accent)";
  const r = 24, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={60} height={60} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 30 30)" style={{ transition: "stroke-dashoffset .5s" }} />
        <text x="30" y="34" textAnchor="middle" fontSize="10" fontWeight="800" fill={color}>{pct.toFixed(0)}%</text>
      </svg>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{goal.name}</div>
      <div style={{ fontSize: 10, color: "var(--muted)" }}>{fmt(goal.saved)}</div>
    </div>
  );
}

function SpendingHeatmap({ transactions, filterMonth }) {
  const [y, m] = filterMonth.split("-");
  const daysInMonth = new Date(+y, +m, 0).getDate();
  const firstDay = new Date(+y, +m - 1, 1).getDay();

  const spendByDay = useMemo(() => {
    const map = {};
    transactions.filter(t => t.date.startsWith(filterMonth) && t.type === "despesa")
      .forEach(t => {
        const day = parseInt(t.date.split("-")[2]);
        map[day] = (map[day] || 0) + Number(t.value);
      });
    return map;
  }, [transactions, filterMonth]);

  const maxSpend = Math.max(...Object.values(spendByDay), 1);
  const days = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getColor = (day) => {
    if (!day || !spendByDay[day]) return "var(--border)";
    const intensity = spendByDay[day] / maxSpend;
    if (intensity > 0.75) return "#ef4444";
    if (intensity > 0.5)  return "#f97316";
    if (intensity > 0.25) return "#f59e0b";
    return "#86efac";
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
        {days.map(d => <div key={d} style={{ fontSize: 9, color: "var(--muted)", textAlign: "center", fontWeight: 600 }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, i) => (
          <div key={i} title={day && spendByDay[day] ? `${day}: ${fmt(spendByDay[day])}` : ""} style={{
            aspectRatio: "1", borderRadius: 4,
            background: day ? getColor(day) : "transparent",
            cursor: day && spendByDay[day] ? "pointer" : "default",
            position: "relative",
          }}>
            {day && <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 8, color: spendByDay[day] ? "#fff" : "var(--muted)", fontWeight: 600 }}>{day}</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", fontSize: 10, color: "var(--muted)" }}>
        <span>Menos</span>
        {["#86efac","#f59e0b","#f97316","#ef4444"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />)}
        <span>Mais</span>
      </div>
    </div>
  );
}

const CustomTreemapContent = ({ x, y, width, height, name, value, index }) => {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={PALETTE[index % PALETTE.length]} rx={6} opacity={0.9} />
      {width > 50 && height > 30 && (
        <>
          <text x={x + width/2} y={y + height/2 - 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{name}</text>
          <text x={x + width/2} y={y + height/2 + 10} textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize={10}>
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)}
          </text>
        </>
      )}
    </g>
  );
};

export default function Dashboard({ userId }) {
  const isMobile = useIsMobile();
  const [transactions, setTransactions]   = useState([]);
  const [revenues, setRevenues]           = useState([]);
  const [installments, setInstallments]   = useState([]);
  const [loanInst, setLoanInst]           = useState([]);
  const [goals, setGoals]                 = useState([]);
  const [budgets, setBudgets]             = useState([]);
  const [cards, setCards]                 = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [filterMonth, setFilterMonth]     = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const load = async () => {
      const thisMonth = new Date().toISOString().slice(0, 7);
      const [
        { data: t }, { data: r }, { data: i },
        { data: li }, { data: g }, { data: b }, { data: c },
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
        supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
        supabase.from("installments").select("*, purchases(description, card_id)").eq("user_id", userId).limit(500),
        supabase.from("loan_installments").select("*").eq("user_id", userId).limit(500),
        supabase.from("goals").select("*").eq("user_id", userId),
        supabase.from("budgets").select("*").eq("user_id", userId).eq("month", thisMonth),
        supabase.from("cards").select("*").eq("user_id", userId),
      ]);
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setLoanInst(li || []);
      setGoals(g || []);
      setBudgets(b || []);
      setCards(c || []);
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

  const healthScore = useMemo(() => {
    let score = 100;
    const totalRec = filteredRev.reduce((a, r) => a + Number(r.amount), 0);
    const totalDep = filteredTx.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
    const savingRate = totalRec > 0 ? ((totalRec - totalDep) / totalRec) * 100 : 0;
    if (savingRate < 0) score -= 30;
    else if (savingRate < 10) score -= 20;
    else if (savingRate < 20) score -= 10;
    const totalDebt = [...installments, ...loanInst].filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0);
    if (totalRec > 0 && totalDebt / totalRec > 0.5) score -= 25;
    else if (totalRec > 0 && totalDebt / totalRec > 0.3) score -= 15;
    const spentByCat = {};
    filteredTx.filter(t => t.type === "despesa").forEach(t => { spentByCat[t.cat] = (spentByCat[t.cat]||0) + Number(t.value); });
    const exceeded = budgets.filter(b => (spentByCat[b.category]||0) > Number(b.amount)).length;
    score -= exceeded * 8;
    const done = goals.filter(g => Number(g.saved) >= Number(g.target)).length;
    score += Math.min(done * 5, 15);
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [filteredTx, filteredRev, installments, loanInst, budgets, goals]);

  const monthlyData = useMemo(() => {
    const last6 = [...new Set([...transactions.map(t => t.date.slice(0,7)), ...revenues.map(r => r.date.slice(0,7))])].sort().slice(-6);
    return last6.map(ym => {
      const rec = revenues.filter(r => r.date.startsWith(ym)).reduce((a, r) => a + Number(r.amount), 0) +
                  transactions.filter(t => t.date.startsWith(ym) && t.type === "receita").reduce((a, t) => a + Number(t.value), 0);
      const dep = transactions.filter(t => t.date.startsWith(ym) && t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
      return { name: monthLabel(ym), Receitas: rec, Despesas: dep, Saldo: rec - dep };
    });
  }, [transactions, revenues]);

  const accumulatedBalance = useMemo(() => {
    let cum = 0;
    return monthlyData.map(d => { cum += d.Saldo; return { name: d.name, Patrimônio: cum }; });
  }, [monthlyData]);

  const treemapData = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "despesa").forEach(t => { map[t.cat] = (map[t.cat]||0) + Number(t.value); });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [filteredTx]);

  const debtEvolution = useMemo(() => {
    const allInst = [...installments, ...loanInst];
    const ms = [...new Set(allInst.map(i => (i.due_date||"").slice(0,7)))].sort().slice(-6);
    return ms.map(ym => ({
      name: monthLabel(ym),
      "Em aberto": allInst.filter(i => !i.paid && (i.due_date||"").startsWith(ym)).reduce((a,i) => a + Number(i.amount), 0),
      "Pago":      allInst.filter(i => i.paid  && (i.due_date||"").startsWith(ym)).reduce((a,i) => a + Number(i.amount), 0),
    }));
  }, [installments, loanInst]);

  const cardUsage = useMemo(() => {
    return cards.map(card => {
      const used = installments.filter(i => i.purchases?.card_id === card.id && !i.paid).reduce((a,i) => a + Number(i.amount), 0);
      return { card, used };
    });
  }, [cards, installments]);

  const spentByCat = useMemo(() => {
    const map = {};
    filteredTx.filter(t => t.type === "despesa").forEach(t => { map[t.cat] = (map[t.cat]||0) + Number(t.value); });
    return map;
  }, [filteredTx]);

  const saved = Math.max(0, totals.bal);
  const planned = budgets.reduce((a, b) => a + Number(b.amount), 0);
  const empty = (msg="Sem dados ainda") => <div style={{ color:"var(--muted)", textAlign:"center", padding:"32px 0", fontSize:13 }}>{msg}</div>;

  // Responsive helpers
  const col2 = isMobile ? "1fr" : "1fr 1fr";
  const col2bar = isMobile ? "1fr" : "1.4fr 1fr";
  const col4kpi = isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1.2fr";
  const gap = isMobile ? 10 : 12;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: isMobile ? 16 : 24 }}>
        {!isMobile && (
          <div>
            <h1 style={{ fontWeight:800, fontSize:22, color:"var(--text)", letterSpacing:"-.02em" }}>Dashboard</h1>
            <p style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>Visão geral das suas finanças</p>
          </div>
        )}
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{
          padding:"7px 12px", borderRadius:8, border:"1px solid var(--border)",
          background:"var(--surface)", color:"var(--text)", fontSize:13, outline:"none", cursor:"pointer",
          marginLeft: isMobile ? 0 : "auto",
          width: isMobile ? "100%" : "auto",
        }}>
          {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
          {alerts.map((a, i) => {
            const { bg, color, icon } = ALERT_COLORS[a.type] || ALERT_COLORS.info;
            return (
              <div key={i} style={{ background:bg, borderRadius:10, padding:"9px 14px", display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
                <span style={{ color, fontWeight:700, flexShrink:0 }}>{icon}</span>
                <span style={{ color:"var(--text)" }}>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Row 1: KPIs + Health */}
      <div style={{ display:"grid", gridTemplateColumns: col4kpi, gap, marginBottom: gap }}>
        {[
          { label:"Receitas", value:totals.rec, color:"var(--green)" },
          { label:"Despesas", value:totals.dep, color:"var(--red)" },
          { label:"Saldo",    value:totals.bal, color:totals.bal>=0?"var(--accent)":"var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color, letterSpacing:"-.02em" }}>{fmt(value)}</div>
          </Card>
        ))}
        {/* Health Score ocupa linha inteira no mobile */}
        <Card style={ isMobile ? { gridColumn: "1 / -1" } : {} }>
          <HealthScore score={healthScore} />
        </Card>
      </div>

      {/* Row 2: Bar chart + Heatmap */}
      <div style={{ display:"grid", gridTemplateColumns: col2bar, gap, marginBottom: gap }}>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Receitas × Despesas</div>
          {monthlyData.length < 2 ? empty("Acumule mais meses para ver o gráfico") :
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 190}>
              <BarChart data={monthlyData} barSize={isMobile ? 10 : 13} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} width={45} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="Receitas" fill="var(--green)" radius={[4,4,0,0]} />
                <Bar dataKey="Despesas" fill="var(--red)"   radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Heatmap de Gastos</div>
          <SpendingHeatmap transactions={transactions} filterMonth={filterMonth} />
        </Card>
      </div>

      {/* Row 3: Treemap + Accumulated balance */}
      <div style={{ display:"grid", gridTemplateColumns: col2, gap, marginBottom: gap }}>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Gastos por Categoria</div>
          {treemapData.length === 0 ? empty("Sem despesas no mês") :
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <Treemap data={treemapData} dataKey="value" aspectRatio={4/3} content={<CustomTreemapContent />}>
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
              </Treemap>
            </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Saldo Acumulado</div>
          {accumulatedBalance.length < 2 ? empty("Acumule mais meses para ver") :
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <LineChart data={accumulatedBalance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} width={45} />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Line type="monotone" dataKey="Patrimônio" stroke="var(--accent)" strokeWidth={2.5} dot={{ r:4, fill:"var(--accent)" }} />
              </LineChart>
            </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* Row 4: Debt evolution + Savings */}
      <div style={{ display:"grid", gridTemplateColumns: col2, gap, marginBottom: gap }}>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Evolução de Dívidas</div>
          {debtEvolution.length === 0 ? empty("Sem parcelas registradas") :
            <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
              <LineChart data={debtEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} width={45} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:11 }} />
                <Line type="monotone" dataKey="Em aberto" stroke="var(--red)"   strokeWidth={2} dot={{ r:3 }} />
                <Line type="monotone" dataKey="Pago"      stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
              </LineChart>
            </ResponsiveContainer>
          }
        </Card>
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Economizado vs Planejado</div>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {[
              { label:"Planejado (orçamento)", value:planned, color:"var(--accent)", max:Math.max(planned,saved,1) },
              { label:"Economizado (saldo)",   value:saved,   color:"var(--green)",  max:Math.max(planned,saved,1) },
            ].map(({ label, value, color, max }) => {
              const pct = (value/max)*100;
              return (
                <div key={label}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                    <span style={{ color:"var(--muted)" }}>{label}</span>
                    <span style={{ fontWeight:700, color }}>{fmt(value)}</span>
                  </div>
                  <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
                    <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:99, transition:"width .5s" }} />
                  </div>
                </div>
              );
            })}
            <div style={{ background:"var(--bg)", borderRadius:8, padding:"9px 12px", fontSize:13 }}>
              {saved >= planned
                ? <span style={{ color:"var(--green)", fontWeight:600 }}>✓ {fmt(saved-planned)} acima do planejado!</span>
                : <span style={{ color:"var(--red)", fontWeight:600 }}>⚠ Faltam {fmt(planned-saved)} para o planejado</span>
              }
            </div>
          </div>
        </Card>
      </div>

      {/* Row 5: Card gauges + Goal rings */}
      {(cardUsage.length > 0 || goals.length > 0) && (
        <div style={{ display:"grid", gridTemplateColumns: col2, gap, marginBottom: gap }}>
          {cardUsage.length > 0 && (
            <Card>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:"var(--text)" }}>Limite dos Cartões</div>
              {cardUsage.map(({ card, used }) => (
                <CardGauge key={card.id} card={card} used={used} />
              ))}
            </Card>
          )}
          {goals.length > 0 && (
            <Card>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Progresso das Metas</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:16 }}>
                {goals.map(g => <GoalRing key={g.id} goal={g} />)}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Row 6: Recent transactions */}
      <Card>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Lançamentos Recentes</div>
        {filteredTx.length === 0
          ? empty("Nenhum lançamento neste mês")
          : filteredTx.slice(0,7).map((tx,i,arr) => (
            <div key={tx.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<arr.length-1?"1px solid var(--border)":"none" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:tx.type==="receita"?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                  {tx.type==="receita"?"↑":"↓"}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>{tx.description}</div>
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>{tx.cat} · {tx.date}</div>
                </div>
              </div>
              <div style={{ fontWeight:700, fontSize:13, color:tx.type==="receita"?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                {tx.type==="receita"?"+":"-"}{fmt(tx.value)}
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}
