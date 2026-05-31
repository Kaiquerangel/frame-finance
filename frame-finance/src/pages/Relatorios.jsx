import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ReferenceLine
} from "recharts";

const fmt  = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtS = (v) => (v >= 0 ? "+" : "") + fmt(v);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const monthFull  = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
const PALETTE = ["#7c3aed","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const Delta = ({ value, invert = false }) => {
  const positive = invert ? value < 0 : value > 0;
  const color = value === 0 ? "var(--muted)" : positive ? "var(--green)" : "var(--red)";
  const arrow = value === 0 ? "→" : value > 0 ? "▲" : "▼";
  return (
    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{arrow} {fmtS(value)}</span>
  );
};

const TABS = ["Geral","Comparativo","Juros","Dívidas","Extrato"];

export default function Relatorios({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [transactions, setTransactions] = useState([]);
  const [revenues, setRevenues]         = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loanInst, setLoanInst]         = useState([]);
  const [period, setPeriod]             = useState("6");
  const [tab, setTab]                   = useState("Comparativo");
  const [compareA, setCompareA]         = useState("");
  const [compareB, setCompareB]         = useState("");

  useEffect(() => {
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("date"),
      supabase.from("revenues").select("*").eq("user_id", userId).order("date"),
      supabase.from("installments").select("*, purchases(description,has_interest,interest_rate,cards(name))").eq("user_id", userId).order("due_date"),
      supabase.from("loan_installments").select("*, loans(description,interest_rate)").eq("user_id", userId).order("due_date"),
    ]).then(([{ data: t }, { data: r }, { data: i }, { data: li }]) => {
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setLoanInst(li || []);
    });
  }, [userId]);

  const allMonths = useMemo(() => {
    return [...new Set([
      ...transactions.map(t => t.date.slice(0,7)),
      ...revenues.map(r => r.date.slice(0,7)),
    ])].sort();
  }, [transactions, revenues]);

  const months = useMemo(() => allMonths.slice(-parseInt(period)), [allMonths, period]);

  // Auto-select compare months
  useEffect(() => {
    if (allMonths.length >= 2 && !compareA && !compareB) {
      setCompareB(allMonths[allMonths.length - 1]);
      setCompareA(allMonths[allMonths.length - 2]);
    }
  }, [allMonths]);

  // Helper: get month data
  const getMonthData = (ym) => {
    const rec = revenues.filter(r => r.date.startsWith(ym)).reduce((a, r) => a + Number(r.amount), 0) +
                transactions.filter(t => t.date.startsWith(ym) && t.type === "receita").reduce((a, t) => a + Number(t.value), 0);
    const dep = transactions.filter(t => t.date.startsWith(ym) && t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
    const debt = [...installments, ...loanInst].filter(i => !i.paid && (i.due_date||"").startsWith(ym)).reduce((a, i) => a + Number(i.amount), 0);
    const interest = installments.filter(i => (i.due_date||"").startsWith(ym) && i.purchases?.has_interest)
      .reduce((a, i) => a + (Number(i.amount) * Number(i.purchases?.interest_rate||0) / 100), 0) +
      loanInst.filter(i => (i.due_date||"").startsWith(ym)).reduce((a, i) => a + Number(i.interest_amount||0), 0);
    const catMap = {};
    transactions.filter(t => t.date.startsWith(ym) && t.type === "despesa").forEach(t => { catMap[t.cat] = (catMap[t.cat]||0) + Number(t.value); });
    return { rec, dep, bal: rec - dep, debt, interest, catMap, saving: Math.max(0, rec - dep) };
  };

  // Monthly chart data
  const monthlyData = useMemo(() => months.map(ym => {
    const d = getMonthData(ym);
    return { name: monthLabel(ym), Receitas: d.rec, Despesas: d.dep, Saldo: d.bal, Dívidas: d.debt };
  }), [months, transactions, revenues, installments, loanInst]);

  // Comparativo data
  const dataA = useMemo(() => compareA ? getMonthData(compareA) : null, [compareA, transactions, revenues, installments, loanInst]);
  const dataB = useMemo(() => compareB ? getMonthData(compareB) : null, [compareB, transactions, revenues, installments, loanInst]);

  // All categories union
  const allCats = useMemo(() => {
    if (!dataA || !dataB) return [];
    return [...new Set([...Object.keys(dataA.catMap), ...Object.keys(dataB.catMap)])];
  }, [dataA, dataB]);

  // Interest data
  const interestData = useMemo(() => months.map(ym => {
    const pi = installments.filter(i => (i.due_date||"").startsWith(ym) && i.purchases?.has_interest && i.purchases?.interest_rate > 0)
      .reduce((a, i) => a + (Number(i.amount) * Number(i.purchases.interest_rate) / 100), 0);
    const li = loanInst.filter(i => (i.due_date||"").startsWith(ym)).reduce((a, i) => a + Number(i.interest_amount||0), 0);
    return { name: monthLabel(ym), "Compras": parseFloat(pi.toFixed(2)), "Empréstimos": parseFloat(li.toFixed(2)) };
  }), [months, installments, loanInst]);

  // Debt evolution
  const debtEvolution = useMemo(() => months.map(ym => ({
    name: monthLabel(ym),
    "Em aberto": [...installments, ...loanInst].filter(i => !i.paid && (i.due_date||"").startsWith(ym)).reduce((a, i) => a + Number(i.amount), 0),
    "Pago": [...installments, ...loanInst].filter(i => i.paid && (i.due_date||"").startsWith(ym)).reduce((a, i) => a + Number(i.amount), 0),
  })), [months, installments, loanInst]);

  // Top categories
  const topCategories = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "despesa" && months.some(m => t.date.startsWith(m)))
      .forEach(t => { map[t.cat] = (map[t.cat]||0) + Number(t.value); });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,6);
  }, [transactions, months]);

  // KPIs
  const totalRev  = revenues.filter(r => months.some(m => r.date.startsWith(m))).reduce((a,r) => a+Number(r.amount), 0);
  const totalExp  = transactions.filter(t => t.type==="despesa" && months.some(m => t.date.startsWith(m))).reduce((a,t) => a+Number(t.value), 0);
  const totalInt  = interestData.reduce((a,d) => a+d["Compras"]+d["Empréstimos"], 0);
  const savingRate = totalRev > 0 ? ((totalRev-totalExp)/totalRev*100) : 0;

  const exportCSV = () => {
    const rows = [
      ["Data","Tipo","Descrição","Categoria","Valor"],
      ...transactions.map(t => [t.date, t.type, t.description, t.cat, t.value]),
      ...revenues.map(r => [r.date, "receita", r.description, r.category, r.amount]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="frame-finance.csv"; a.click();
  };

  const empty = <div style={{ color:"var(--muted)", textAlign:"center", padding:"36px 0", fontSize:13 }}>Sem dados suficientes</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight:800, fontSize:22, color:"var(--text)", letterSpacing:"-.02em" }}>Relatórios</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "relatorios"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:2 }}>Análise completa das suas finanças</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <select value={period} onChange={e => setPeriod(e.target.value)} style={{ padding:"7px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:13, outline:"none", cursor:"pointer" }}>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
            <option value="12">12 meses</option>
          </select>
          <button onClick={exportCSV} style={{ padding:"7px 14px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--accent)", fontSize:13, fontWeight:600, cursor:"pointer" }}>⬇ CSV</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
        {[
          { label:"Total receitas",    value:fmt(totalRev),  color:"var(--green)" },
          { label:"Total despesas",    value:fmt(totalExp),  color:"var(--red)" },
          { label:"Total em juros",    value:fmt(totalInt),  color:"#d97706" },
          { label:"Taxa de poupança",  value:`${savingRate.toFixed(1)}%`, color: savingRate>=20?"var(--green)":savingRate>=0?"#d97706":"var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
            <div style={{ fontSize:20, fontWeight:800, color, letterSpacing:"-.02em" }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:16, background:"var(--surface)", borderRadius:10, padding:4, width:"fit-content", border:"1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"7px 16px", borderRadius:7, border:"none", cursor:"pointer",
            fontWeight:600, fontSize:13,
            background: tab===t ? "var(--accent)" : "transparent",
            color: tab===t ? "#fff" : "var(--muted)",
            transition:"all .15s",
          }}>{t}</button>
        ))}
      </div>

      {/* ── GERAL ── */}
      {tab==="Geral" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Receitas × Despesas × Saldo</div>
            {monthlyData.length===0 ? empty :
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={monthlyData} barSize={11} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                  <Bar dataKey="Receitas" fill="var(--green)"  radius={[4,4,0,0]} />
                  <Bar dataKey="Despesas" fill="var(--red)"    radius={[4,4,0,0]} />
                  <Bar dataKey="Saldo"    fill="var(--accent)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            }
          </Card>
          <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:12 }}>
            <Card>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Evolução do saldo</div>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                  <Line type="monotone" dataKey="Saldo" stroke="var(--accent)" strokeWidth={2.5} dot={{ r:4, fill:"var(--accent)" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:"var(--text)" }}>Maiores gastos</div>
              {topCategories.length===0 ? empty :
                <>
                  <ResponsiveContainer width="100%" height={110}>
                    <PieChart>
                      <Pie data={topCategories.map(([name,value])=>({name,value}))} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={48} innerRadius={24}
                        label={({percent})=>percent>.1?`${(percent*100).toFixed(0)}%`:""} labelLine={false}>
                        {topCategories.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]} />)}
                      </Pie>
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {topCategories.slice(0,4).map(([cat,val],i)=>(
                    <div key={cat} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background:PALETTE[i%PALETTE.length] }} />
                        <span style={{ color:"var(--text)" }}>{cat}</span>
                      </div>
                      <span style={{ color:"var(--muted)", fontWeight:600 }}>{fmt(val)}</span>
                    </div>
                  ))}
                </>
              }
            </Card>
          </div>
        </div>
      )}

      {/* ── COMPARATIVO ── */}
      {tab==="Comparativo" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Month selectors */}
          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:"var(--text)" }}>Selecione os meses para comparar</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Mês A</div>
                <select value={compareA} onChange={e=>setCompareA(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14, outline:"none" }}>
                  <option value="">Selecionar...</option>
                  {allMonths.map(m=><option key={m} value={m}>{monthFull(m)}</option>)}
                </select>
              </div>
              <div style={{ fontSize:20, color:"var(--muted)", fontWeight:700, textAlign:"center", marginTop:18 }}>vs</div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Mês B</div>
                <select value={compareB} onChange={e=>setCompareB(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:14, outline:"none" }}>
                  <option value="">Selecionar...</option>
                  {allMonths.map(m=><option key={m} value={m}>{monthFull(m)}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {dataA && dataB && compareA && compareB && (
            <>
              {/* Side by side KPIs */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {/* Mês A */}
                <Card style={{ borderTop:"3px solid var(--accent)" }}>
                  <div style={{ fontWeight:700, fontSize:15, color:"var(--accent)", marginBottom:16, textTransform:"capitalize" }}>{monthFull(compareA)}</div>
                  {[
                    { label:"Receitas",  value:dataA.rec,      color:"var(--green)" },
                    { label:"Despesas",  value:dataA.dep,      color:"var(--red)" },
                    { label:"Saldo",     value:dataA.bal,      color:dataA.bal>=0?"var(--accent)":"var(--red)" },
                    { label:"Juros",     value:dataA.interest, color:"#d97706" },
                    { label:"Dívidas",   value:dataA.debt,     color:"var(--red)" },
                    { label:"Economia",  value:dataA.saving,   color:"var(--green)" },
                  ].map(({ label, value, color })=>(
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--muted)" }}>{label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color }}>{fmt(value)}</span>
                    </div>
                  ))}
                </Card>

                {/* Mês B */}
                <Card style={{ borderTop:"3px solid var(--green)" }}>
                  <div style={{ fontWeight:700, fontSize:15, color:"var(--green)", marginBottom:16, textTransform:"capitalize" }}>{monthFull(compareB)}</div>
                  {[
                    { label:"Receitas",  value:dataB.rec,      color:"var(--green)" },
                    { label:"Despesas",  value:dataB.dep,      color:"var(--red)" },
                    { label:"Saldo",     value:dataB.bal,      color:dataB.bal>=0?"var(--accent)":"var(--red)" },
                    { label:"Juros",     value:dataB.interest, color:"#d97706" },
                    { label:"Dívidas",   value:dataB.debt,     color:"var(--red)" },
                    { label:"Economia",  value:dataB.saving,   color:"var(--green)" },
                  ].map(({ label, value, color })=>(
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--muted)" }}>{label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color }}>{fmt(value)}</span>
                    </div>
                  ))}
                </Card>
              </div>

              {/* Delta card */}
              <Card>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>
                  Diferença, {monthLabel(compareA)} → {monthLabel(compareB)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                  {[
                    { label:"Receitas",  delta:dataB.rec-dataA.rec,      invert:false, desc:dataB.rec>dataA.rec?"Receitas aumentaram":"Receitas caíram" },
                    { label:"Despesas",  delta:dataB.dep-dataA.dep,      invert:true,  desc:dataB.dep>dataA.dep?"Gastos aumentaram":"Gastos diminuíram" },
                    { label:"Saldo",     delta:dataB.bal-dataA.bal,      invert:false, desc:dataB.bal>dataA.bal?"Saldo melhorou":"Saldo piorou" },
                    { label:"Juros",     delta:dataB.interest-dataA.interest, invert:true, desc:dataB.interest>dataA.interest?"Mais juros pagos":"Menos juros" },
                    { label:"Dívidas",   delta:dataB.debt-dataA.debt,   invert:true,  desc:dataB.debt>dataA.debt?"Dívidas aumentaram":"Dívidas reduziram" },
                    { label:"Economia",  delta:dataB.saving-dataA.saving,invert:false, desc:dataB.saving>dataA.saving?"Economizou mais":"Economizou menos" },
                  ].map(({ label, delta, invert, desc })=>{
                    const positive = invert ? delta<0 : delta>0;
                    const bg = delta===0?"var(--bg)":positive?"var(--greenbg)":"var(--redbg)";
                    const color = delta===0?"var(--muted)":positive?"var(--green)":"var(--red)";
                    return (
                      <div key={label} style={{ background:bg, borderRadius:10, padding:"12px 14px" }}>
                        <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{label}</div>
                        <div style={{ fontSize:16, fontWeight:800, color, letterSpacing:"-.01em" }}>{fmtS(delta)}</div>
                        <div style={{ fontSize:11, color, marginTop:3 }}>{desc}</div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Category comparison */}
              {allCats.length > 0 && (
                <Card>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Gastos por categoria, comparativo</div>
                  <ResponsiveContainer width="100%" height={Math.max(200, allCats.length*36)}>
                    <BarChart data={allCats.map(cat=>({
                      cat, [monthLabel(compareA)]:dataA.catMap[cat]||0, [monthLabel(compareB)]:dataB.catMap[cat]||0
                    }))} layout="vertical" barSize={10} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} />
                      <YAxis type="category" dataKey="cat" tick={{ fontSize:12, fill:"var(--text)" }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                      <Bar dataKey={monthLabel(compareA)} fill="var(--accent)" radius={[0,4,4,0]} />
                      <Bar dataKey={monthLabel(compareB)} fill="var(--green)"  radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Trend over all months */}
              <Card>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Tendência geral, todos os meses</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(0)}k`} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                    <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                    <Line type="monotone" dataKey="Receitas" stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="Despesas" stroke="var(--red)"   strokeWidth={2} dot={{ r:3 }} />
                    <Line type="monotone" dataKey="Saldo"    stroke="var(--accent)" strokeWidth={2.5} dot={{ r:4, fill:"var(--accent)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {(!compareA || !compareB) && (
            <div style={{ color:"var(--muted)", textAlign:"center", padding:"40px 0", fontSize:13 }}>
              Selecione dois meses acima para ver a comparação
            </div>
          )}
        </div>
      )}

      {/* ── JUROS ── */}
      {tab==="Juros" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { label:"Juros totais",       value:fmt(totalInt), color:"#d97706" },
              { label:"Juros em compras",   value:fmt(interestData.reduce((a,d)=>a+d["Compras"],0)), color:"var(--red)" },
              { label:"Juros em emprést.",  value:fmt(interestData.reduce((a,d)=>a+d["Empréstimos"],0)), color:"var(--accent)" },
            ].map(({ label, value, color })=>(
              <Card key={label}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:20, fontWeight:800, color, letterSpacing:"-.02em" }}>{value}</div>
              </Card>
            ))}
          </div>
          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Juros pagos por mês</div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={interestData} barSize={13} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${v.toFixed(0)}`} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                <Bar dataKey="Compras"     fill="var(--red)"    radius={[4,4,0,0]} />
                <Bar dataKey="Empréstimos" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:14, color:"var(--text)" }}>Detalhamento por mês</div>
            {interestData.map((d,i)=>(
              <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<interestData.length-1?"1px solid var(--border)":"none" }}>
                <span style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>{d.name}</span>
                <div style={{ display:"flex", gap:20, fontSize:13 }}>
                  <span style={{ color:"var(--muted)" }}>Compras: <b style={{ color:"var(--red)" }}>{fmt(d["Compras"])}</b></span>
                  <span style={{ color:"var(--muted)" }}>Emprést.: <b style={{ color:"var(--accent)" }}>{fmt(d["Empréstimos"])}</b></span>
                  <span style={{ color:"var(--muted)" }}>Total: <b style={{ color:"#d97706" }}>{fmt(d["Compras"]+d["Empréstimos"])}</b></span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── DÍVIDAS ── */}
      {tab==="Dívidas" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Evolução de dívidas</div>
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={debtEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`R$${(v/1000).toFixed(1)}k`} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize:12 }} />
                <Line type="monotone" dataKey="Em aberto" stroke="var(--red)"   strokeWidth={2.5} dot={{ r:4 }} />
                <Line type="monotone" dataKey="Pago"      stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { label:"Total em aberto", value:fmt([...installments,...loanInst].filter(i=>!i.paid).reduce((a,i)=>a+Number(i.amount),0)), color:"var(--red)" },
              { label:"Parcelas abertas", value:`${installments.filter(i=>!i.paid).length} parcelas`, color:"#d97706" },
              { label:"Emprést. abertos", value:`${loanInst.filter(i=>!i.paid).length} parcelas`, color:"var(--accent)" },
            ].map(({ label, value, color })=>(
              <Card key={label}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color, letterSpacing:"-.02em" }}>{value}</div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── EXTRATO ── */}
      {tab==="Extrato" && (
        <Card>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Extrato completo do período</div>
          {[...transactions.filter(t=>months.some(m=>t.date.startsWith(m)))]
            .sort((a,b)=>b.date.localeCompare(a.date))
            .map((tx,i,arr)=>(
              <div key={tx.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<arr.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{ width:30, height:30, borderRadius:8, background:tx.type==="receita"?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>
                    {tx.type==="receita"?"↑":"↓"}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{tx.description}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{tx.cat} · {tx.date}</div>
                  </div>
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:tx.type==="receita"?"var(--green)":"var(--red)" }}>
                  {tx.type==="receita"?"+":"-"}{fmt(tx.value)}
                </span>
              </div>
            ))
          }
          {transactions.filter(t=>months.some(m=>t.date.startsWith(m))).length===0 && (
            <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhum lançamento no período</div>
          )}
        </Card>
      )}
      <HelpButton pageId="relatorios" onNavigate={onNavigate} />
    </div>
  );
}
