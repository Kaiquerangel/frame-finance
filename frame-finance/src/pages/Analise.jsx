import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";

const fmt  = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtK = (v) => Math.abs(v) >= 1000 ? `R$\u00a0${(v/1000).toFixed(1)}k` : fmt(v);
const mlabel = (ym) => { const [y,m] = ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const mlabelFull = (ym) => { const [y,m] = ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };
const today = () => new Date().toISOString().slice(0,7);
const PALETTE = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

const Card = ({ children, style = {} }) => (
  <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", padding:20, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{children}</div>
    {sub && <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{sub}</div>}
  </div>
);

const BarH = ({ label, value, total, color, pct: pctVal, sub }) => (
  <div style={{ marginBottom:12 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, marginBottom:5 }}>
      <span style={{ color:"var(--text)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{label}</span>
      <span style={{ flexShrink:0, display:"flex", gap:8, alignItems:"center" }}>
        <span style={{ color, fontWeight:700 }}>{fmt(value)}</span>
        <span style={{ color:"var(--muted)", fontSize:11 }}>{pctVal?.toFixed(0)}%</span>
      </span>
    </div>
    <div style={{ height:10, background:"var(--border)", borderRadius:99 }}>
      <div style={{ height:"100%", width:`${Math.min(pctVal||0,100)}%`, background:color, borderRadius:99, transition:"width .5s" }} />
    </div>
    {sub && <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>{sub}</div>}
  </div>
);

const PERIODS = [
  { id:"1",  label:"1 mês",    months:1  },
  { id:"3",  label:"3 meses",  months:3  },
  { id:"6",  label:"6 meses",  months:6  },
  { id:"12", label:"1 ano",    months:12 },
  { id:"custom", label:"Personalizado", months:0 },
];

export default function Analise({ userId, onNavigate }) {
  const isMobile = useIsMobile();

  // ── Dados ─────────────────────────────────────────────────────────────────
  const [transactions, setTransactions]   = useState([]);
  const [revenues, setRevenues]           = useState([]);
  const [installments, setInstallments]   = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(null);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [period, setPeriod]         = useState("3");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]   = useState("");
  const [filterCat, setFilterCat]   = useState("all");
  const [filterType, setFilterType] = useState("all"); // all | despesa | receita
  const [tab, setTab]               = useState("resumo"); // resumo | categorias | evolucao | comparativo | transacoes

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [{ data: t }, { data: r }, { data: i }, { data: fp }] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(2000),
        supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(2000),
        supabase.from("installments").select("*, purchases(description,category,cards(name))").eq("user_id", userId).order("due_date", { ascending: false }).limit(2000),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description,category)").eq("user_id", userId).order("due_date", { ascending: false }).limit(1000),
      ]);
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setFixedPayments(fp || []);
    } catch (err) {
      setLoadError("Não foi possível carregar os dados de análise.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Range de datas ────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    if (period === "custom") {
      return { start: customStart, end: customEnd };
    }
    const months = parseInt(period);
    const now    = new Date();
    const end    = today();
    const start  = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
                   .toISOString().slice(0,7);
    return { start, end };
  }, [period, customStart, customEnd]);

  // ── Meses no range ────────────────────────────────────────────────────────
  const monthsInRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const result = [];
    const [sy, sm] = dateRange.start.split("-").map(Number);
    const [ey, em] = dateRange.end.split("-").map(Number);
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      result.push(`${y}-${String(m).padStart(2,"0")}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result;
  }, [dateRange]);

  // ── Filtra dados pelo range ────────────────────────────────────────────────
  const inRange = useCallback((date) => {
    if (!date) return false;
    const ym = date.slice(0,7);
    return monthsInRange.includes(ym);
  }, [monthsInRange]);

  const filtTx    = useMemo(() => transactions.filter(t => inRange(t.date)), [transactions, inRange]);
  const filtRev   = useMemo(() => revenues.filter(r => inRange(r.date)), [revenues, inRange]);
  const filtFixed = useMemo(() => fixedPayments.filter(fp => inRange(fp.due_date)), [fixedPayments, inRange]);
  const filtInst  = useMemo(() => installments.filter(i => inRange(i.due_date)), [installments, inRange]);

  // ── Todas as categorias disponíveis ───────────────────────────────────────
  const allCategories = useMemo(() => {
    const s = new Set();
    filtTx.filter(t => t.type==="despesa").forEach(t => s.add(t.cat));
    filtFixed.forEach(fp => s.add(fp.fixed_expenses?.category||"Fixas"));
    filtInst.forEach(i => s.add(i.purchases?.category||"Compras"));
    return [...s].sort();
  }, [filtTx, filtFixed, filtInst]);

  // ── Totais gerais ─────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const rec = filtRev.reduce((a,r)=>a+Number(r.amount),0)
              + filtTx.filter(t=>t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const depTx    = filtTx.filter(t=>t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
    const depFixed = filtFixed.filter(fp=>fp.paid).reduce((a,fp)=>a+Number(fp.amount),0);
    const depInst  = filtInst.reduce((a,i)=>a+Number(i.amount),0);
    const dep      = depTx + depFixed + depInst;
    return { rec, dep, bal:rec-dep, depTx, depFixed, depInst, months: monthsInRange.length||1 };
  }, [filtTx, filtRev, filtFixed, filtInst, monthsInRange]);

  // ── Gastos por categoria ──────────────────────────────────────────────────
  const byCat = useMemo(() => {
    const map = {};
    filtTx.filter(t=>t.type==="despesa").forEach(t => { map[t.cat]=(map[t.cat]||0)+Number(t.value); });
    filtFixed.filter(fp=>fp.paid).forEach(fp => { const c=fp.fixed_expenses?.category||"Fixas"; map[c]=(map[c]||0)+Number(fp.amount); });
    filtInst.forEach(i => { const c=i.purchases?.category||"Compras"; map[c]=(map[c]||0)+Number(i.amount); });
    return Object.entries(map).map(([cat,val])=>({ cat, val })).sort((a,b)=>b.val-a.val);
  }, [filtTx, filtFixed, filtInst]);

  // ── Evolução mensal ───────────────────────────────────────────────────────
  const evolution = useMemo(() => {
    return monthsInRange.map(ym => {
      const rec = revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
                + transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const dep = transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
                + fixedPayments.filter(fp=>fp.paid&&(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
                + installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      return { ym, label:mlabel(ym), rec, dep, bal:rec-dep };
    });
  }, [monthsInRange, transactions, revenues, fixedPayments, installments]);

  const maxEvol = Math.max(...evolution.map(e=>Math.max(e.rec,e.dep)),1);

  // ── Comparativo de períodos ───────────────────────────────────────────────
  const [compA, setCompA] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  });
  const [compB, setCompB] = useState(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth()-1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,"0")}`;
  });

  const getMonthTotals = useCallback((ym) => {
    const rec = revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
              + transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const dep = transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
              + fixedPayments.filter(fp=>fp.paid&&(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
              + installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
    const catMap = {};
    transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").forEach(t=>{ catMap[t.cat]=(catMap[t.cat]||0)+Number(t.value); });
    fixedPayments.filter(fp=>fp.paid&&(fp.due_date||"").startsWith(ym)).forEach(fp=>{ const c=fp.fixed_expenses?.category||"Fixas"; catMap[c]=(catMap[c]||0)+Number(fp.amount); });
    installments.filter(i=>(i.due_date||"").startsWith(ym)).forEach(i=>{ const c=i.purchases?.category||"Compras"; catMap[c]=(catMap[c]||0)+Number(i.amount); });
    return { rec, dep, bal:rec-dep, catMap };
  }, [transactions, revenues, fixedPayments, installments]);

  const dataA = useMemo(()=>getMonthTotals(compA), [compA, getMonthTotals]);
  const dataB = useMemo(()=>getMonthTotals(compB), [compB, getMonthTotals]);

  // ── Lista de transações detalhada ─────────────────────────────────────────
  const [txSearch, setTxSearch] = useState("");
  const [txPage, setTxPage]     = useState(1);
  const TX_PER_PAGE = 30;

  const allTx = useMemo(() => {
    const items = [
      ...filtTx.map(t => ({
        id:`tx-${t.id}`, date:t.date, desc:t.description,
        cat:t.cat, val:t.type==="receita"?+Number(t.value):-Number(t.value),
        src:"Lançamento", type:t.type,
      })),
      ...filtRev.map(r => ({
        id:`rev-${r.id}`, date:r.date, desc:r.description,
        cat:r.category, val:+Number(r.amount), src:"Receita", type:"receita",
      })),
      ...filtFixed.map(fp => ({
        id:`fp-${fp.id}`, date:fp.due_date, desc:fp.fixed_expenses?.description||"Fixa",
        cat:fp.fixed_expenses?.category||"Fixas", val:-Number(fp.amount),
        src:"Fixa", type:"despesa", paid:fp.paid,
      })),
      ...filtInst.map(i => ({
        id:`inst-${i.id}`, date:i.due_date, desc:i.purchases?.description||"Parcela",
        cat:i.purchases?.category||"Compras", val:-Number(i.amount),
        src:"Parcela", type:"despesa", paid:i.paid,
      })),
    ];
    return items
      .filter(e => filterType==="all" || e.type===filterType)
      .filter(e => filterCat==="all" || e.cat===filterCat)
      .filter(e => !txSearch || e.desc.toLowerCase().includes(txSearch.toLowerCase()) || e.cat.toLowerCase().includes(txSearch.toLowerCase()))
      .sort((a,b)=>b.date.localeCompare(a.date));
  }, [filtTx, filtRev, filtFixed, filtInst, filterType, filterCat, txSearch]);

  const txPages = Math.ceil(allTx.length / TX_PER_PAGE);
  const txPaged = allTx.slice((txPage-1)*TX_PER_PAGE, txPage*TX_PER_PAGE);

  // ── Meses disponíveis para seletores ──────────────────────────────────────
  const availableMonths = useMemo(() => {
    const s = new Set([
      ...transactions.map(t=>t.date.slice(0,7)),
      ...revenues.map(r=>r.date.slice(0,7)),
    ]);
    return [...s].sort().reverse();
  }, [transactions, revenues]);

  const exportCSV = () => {
    const rows = [
      ["Data","Tipo","Descrição","Categoria","Valor","Origem"],
      ...allTx.map(e=>[e.date, e.type, e.desc, e.cat, Math.abs(e.val).toFixed(2), e.src]),
    ];
    const csv = rows.map(r=>r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="analise-frame-finance.csv"; a.click();
  };

  const TABS = [
    { id:"resumo",       label:"Resumo"       },
    { id:"categorias",   label:"Categorias"   },
    { id:"evolucao",     label:"Evolução"      },
    { id:"comparativo",  label:"Comparativo"  },
    { id:"transacoes",   label:"Transações"   },
  ];

  if (loading) return <LoadingSpinner message="Carregando análise..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={load} />;

  return (
    <div>
      {/* Header */}
      {!isMobile && (
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontWeight:800, fontSize:24, color:"var(--text)", letterSpacing:"-.03em" }}>Análise Financeira</h1>
          <p style={{ color:"var(--muted)", fontSize:14, marginTop:4 }}>Entenda para onde está indo o seu dinheiro</p>
        </div>
      )}

      {/* Filtros de período */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {PERIODS.map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                padding:"7px 14px", borderRadius:8, border:"1.5px solid",
                borderColor: period===p.id ? "var(--accent)" : "var(--border)",
                background: period===p.id ? "var(--accentbg)" : "transparent",
                color: period===p.id ? "var(--accent)" : "var(--muted)",
                fontWeight:600, fontSize:13, cursor:"pointer",
              }}>{p.label}</button>
            ))}
          </div>
          {period === "custom" && (
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <input type="month" value={customStart} onChange={e=>setCustomStart(e.target.value)}
                style={{ padding:"7px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }} />
              <span style={{ color:"var(--muted)", fontSize:13 }}>até</span>
              <input type="month" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}
                style={{ padding:"7px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }} />
            </div>
          )}
        </div>
        {monthsInRange.length > 0 && (
          <div style={{ fontSize:12, color:"var(--muted)", marginTop:8 }}>
            {mlabelFull(monthsInRange[0])} até {mlabelFull(monthsInRange[monthsInRange.length-1])} · {monthsInRange.length} mês(es)
          </div>
        )}
      </Card>

      {/* Abas */}
      <div style={{
        display:"flex", gap:2, marginBottom:14,
        background:"var(--surface)", borderRadius:12, padding:4,
        border:"1px solid var(--border)",
        overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, padding: isMobile?"8px 10px":"8px 14px",
            borderRadius:9, border:"none", cursor:"pointer",
            fontWeight:600, fontSize: isMobile?12:13,
            background: tab===t.id ? "var(--accent)" : "transparent",
            color: tab===t.id ? "#fff" : "var(--muted)",
            whiteSpace:"nowrap", transition:"all .15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── RESUMO ─────────────────────────────────────────────────────── */}
      {tab === "resumo" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* KPIs principais */}
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap: isMobile?8:12 }}>
            {[
              { label:"Total Receitas",  val:totals.rec,  color:"var(--green)" },
              { label:"Total Despesas",  val:totals.dep,  color:"var(--red)" },
              { label:"Saldo",           val:totals.bal,  color:totals.bal>=0?"var(--accent)":"var(--red)" },
              { label:"Média Mensal",    val:totals.dep/totals.months, color:"var(--muted)" },
            ].map(k => (
              <Card key={k.label} style={{ padding: isMobile?"12px 14px":18 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{k.label}</div>
                <div style={{ fontSize: isMobile?15:20, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
              </Card>
            ))}
          </div>

          {/* Composição das despesas */}
          {totals.dep > 0 && (
            <Card>
              <SectionTitle sub="Como suas despesas estão distribuídas">Composição das despesas</SectionTitle>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                {[
                  { label:"Avulsos",  val:totals.depTx,    color:"var(--accent)", icon:"💸" },
                  { label:"Fixas",    val:totals.depFixed, color:"#f59e0b",       icon:"📌" },
                  { label:"Parcelas", val:totals.depInst,  color:"#3b82f6",       icon:"💳" },
                ].map(item => (
                  <div key={item.label} style={{ background:"var(--bg)", borderRadius:10, padding:"12px", border:"1px solid var(--border)", textAlign:"center" }}>
                    <div style={{ fontSize:20, marginBottom:6 }}>{item.icon}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>{item.label}</div>
                    <div style={{ fontSize:14, fontWeight:800, color:item.color }}>{fmt(item.val)}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                      {totals.dep>0?`${((item.val/totals.dep)*100).toFixed(0)}%`:"0%"}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top categorias */}
          {byCat.length > 0 && (
            <Card>
              <SectionTitle sub={`Top ${Math.min(byCat.length,5)} categorias com mais gasto`}>Maiores gastos por categoria</SectionTitle>
              {byCat.slice(0,5).map((item,idx) => (
                <BarH key={item.cat} label={item.cat} value={item.val} total={totals.dep}
                  color={PALETTE[idx%PALETTE.length]} pct={(item.val/totals.dep)*100} />
              ))}
              {byCat.length > 5 && (
                <button onClick={()=>setTab("categorias")} style={{ fontSize:12, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0, marginTop:4 }}>
                  Ver todas as {byCat.length} categorias →
                </button>
              )}
            </Card>
          )}

          {/* Top transações */}
          <Card>
            <SectionTitle sub="As 5 maiores despesas individuais do período">Maiores gastos individuais</SectionTitle>
            {allTx.filter(e=>e.type==="despesa").sort((a,b)=>Math.abs(b.val)-Math.abs(a.val)).slice(0,5).map((e,i) => (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom: i<4?"1px solid var(--border)":"none" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"var(--red)", flexShrink:0 }}>
                    {i+1}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{e.cat} · {e.date} · {e.src}</div>
                  </div>
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:"var(--red)", flexShrink:0, marginLeft:8 }}>{fmt(Math.abs(e.val))}</span>
              </div>
            ))}
            {allTx.filter(e=>e.type==="despesa").length === 0 && (
              <div style={{ color:"var(--muted)", fontSize:13, textAlign:"center", padding:"20px 0" }}>Nenhuma despesa no período</div>
            )}
          </Card>
        </div>
      )}

      {/* ── CATEGORIAS ────────────────────────────────────────────────── */}
      {tab === "categorias" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card>
            <SectionTitle sub={`Total de despesas: ${fmt(totals.dep)} · ${byCat.length} categorias`}>Gastos por categoria</SectionTitle>
            {byCat.length === 0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhum gasto no período</div>
              : byCat.map((item, idx) => (
                <BarH key={item.cat} label={item.cat} value={item.val} total={totals.dep}
                  color={PALETTE[idx%PALETTE.length]} pct={(item.val/totals.dep)*100}
                  sub={`Média mensal: ${fmt(item.val/totals.months)}`}
                />
              ))
            }
          </Card>

          {/* Detalhamento por categoria */}
          {byCat.length > 0 && (
            <Card>
              <SectionTitle>Detalhamento por categoria</SectionTitle>
              <div style={{ marginBottom:12 }}>
                <select value={filterCat} onChange={e=>{setFilterCat(e.target.value); setTab("transacoes");}} style={{
                  padding:"9px 13px", borderRadius:8, border:"1.5px solid var(--border)",
                  background:"var(--bg)", color:"var(--text)", fontSize:13, width:"100%",
                }}>
                  <option value="all">Selecionar categoria para ver transações</option>
                  {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── EVOLUÇÃO ──────────────────────────────────────────────────── */}
      {tab === "evolucao" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card>
            <SectionTitle sub="Receitas, despesas e saldo mês a mês">Evolução mensal</SectionTitle>
            {evolution.length === 0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhum dado no período</div>
              : (
                <>
                  {evolution.map((e,i) => (
                    <div key={e.ym} style={{ marginBottom: i<evolution.length-1?18:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <span style={{ fontWeight:700, fontSize:13, color:"var(--text)", textTransform:"capitalize" }}>{mlabelFull(e.ym)}</span>
                        <span style={{ fontWeight:800, fontSize:13, color:e.bal>=0?"var(--green)":"var(--red)" }}>{e.bal>=0?"+":""}{fmt(e.bal)}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, marginBottom:6 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:"var(--green)", fontWeight:600, marginBottom:3 }}>Receitas: {fmt(e.rec)}</div>
                          <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
                            <div style={{ height:"100%", width:`${(e.rec/maxEvol)*100}%`, background:"var(--green)", borderRadius:99 }} />
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:"var(--red)", fontWeight:600, marginBottom:3 }}>Despesas: {fmt(e.dep)}</div>
                          <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
                            <div style={{ height:"100%", width:`${(e.dep/maxEvol)*100}%`, background:"var(--red)", borderRadius:99 }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Totais do período */}
                  <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid var(--border)", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                    {[
                      { label:"Total Receitas", val:totals.rec, color:"var(--green)" },
                      { label:"Total Despesas", val:totals.dep, color:"var(--red)" },
                      { label:"Saldo Total",    val:totals.bal, color:totals.bal>=0?"var(--accent)":"var(--red)" },
                    ].map(k => (
                      <div key={k.label} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em", marginBottom:4 }}>{k.label}</div>
                        <div style={{ fontSize:14, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </Card>
        </div>
      )}

      {/* ── COMPARATIVO ───────────────────────────────────────────────── */}
      {tab === "comparativo" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card>
            <SectionTitle>Compare dois meses</SectionTitle>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Mês A</div>
                <select value={compA} onChange={e=>setCompA(e.target.value)} style={{ padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--accent)", background:"var(--bg)", color:"var(--text)", fontSize:13, width:"100%" }}>
                  {availableMonths.map(m=><option key={m} value={m}>{mlabelFull(m)}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Mês B</div>
                <select value={compB} onChange={e=>setCompB(e.target.value)} style={{ padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13, width:"100%" }}>
                  {availableMonths.map(m=><option key={m} value={m}>{mlabelFull(m)}</option>)}
                </select>
              </div>
            </div>

            {/* Comparativo lado a lado */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              {[{ data:dataA, ym:compA, color:"var(--accent)" }, { data:dataB, ym:compB, color:"var(--muted)" }].map(({data,ym,color}) => (
                <div key={ym} style={{ background:"var(--bg)", borderRadius:10, padding:14, border:`1.5px solid ${color}` }}>
                  <div style={{ fontWeight:700, fontSize:13, color, marginBottom:12, textTransform:"capitalize" }}>{mlabelFull(ym)}</div>
                  {[
                    { label:"Receitas", val:data.rec, c:"var(--green)" },
                    { label:"Despesas", val:data.dep, c:"var(--red)" },
                    { label:"Saldo",    val:data.bal, c:data.bal>=0?"var(--accent)":"var(--red)" },
                  ].map(k => (
                    <div key={k.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span style={{ fontSize:12, color:"var(--muted)" }}>{k.label}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:k.c }}>{fmt(k.val)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Diferenças */}
            <div style={{ background:"var(--bg)", borderRadius:10, padding:14, border:"1px solid var(--border)" }}>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--text)", marginBottom:12 }}>Diferença (A vs B)</div>
              {[
                { label:"Receitas", diff:dataA.rec-dataB.rec },
                { label:"Despesas", diff:dataA.dep-dataB.dep },
                { label:"Saldo",    diff:dataA.bal-dataB.bal },
              ].map(k => (
                <div key={k.label} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <span style={{ fontSize:12, color:"var(--muted)" }}>{k.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:k.diff>=0?"var(--green)":"var(--red)" }}>
                    {k.diff>=0?"+":""}{fmt(k.diff)}
                  </span>
                </div>
              ))}
            </div>

            {/* Comparativo de categorias */}
            {(Object.keys(dataA.catMap).length > 0 || Object.keys(dataB.catMap).length > 0) && (
              <div style={{ marginTop:16 }}>
                <div style={{ fontWeight:700, fontSize:13, color:"var(--text)", marginBottom:12 }}>Categorias comparadas</div>
                {[...new Set([...Object.keys(dataA.catMap), ...Object.keys(dataB.catMap)])].sort().map(cat => {
                  const a = dataA.catMap[cat]||0;
                  const b = dataB.catMap[cat]||0;
                  const diff = a - b;
                  return (
                    <div key={cat} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontSize:13, color:"var(--text)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat}</span>
                      <div style={{ display:"flex", gap:12, flexShrink:0 }}>
                        <span style={{ fontSize:12, color:"var(--accent)", minWidth:80, textAlign:"right" }}>{fmt(a)}</span>
                        <span style={{ fontSize:12, color:"var(--muted)", minWidth:80, textAlign:"right" }}>{fmt(b)}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:diff<=0?"var(--green)":"var(--red)", minWidth:80, textAlign:"right" }}>
                          {diff>=0?"+":""}{fmt(diff)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TRANSAÇÕES ────────────────────────────────────────────────── */}
      {tab === "transacoes" && (
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
            <SectionTitle sub={`${allTx.length} registros encontrados`}>Todas as transações</SectionTitle>
            <button onClick={exportCSV} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"var(--accentbg)", color:"var(--accent)", fontWeight:700, fontSize:12, cursor:"pointer" }}>
              Exportar CSV
            </button>
          </div>

          {/* Filtros */}
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            <input value={txSearch} onChange={e=>{setTxSearch(e.target.value); setTxPage(1);}}
              placeholder="Buscar descrição ou categoria..."
              style={{ flex:1, minWidth:140, padding:"9px 13px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }} />
            <select value={filterType} onChange={e=>{setFilterType(e.target.value); setTxPage(1);}}
              style={{ padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
              <option value="all">Todos</option>
              <option value="despesa">Só despesas</option>
              <option value="receita">Só receitas</option>
            </select>
            <select value={filterCat} onChange={e=>{setFilterCat(e.target.value); setTxPage(1);}}
              style={{ padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
              <option value="all">Todas as categorias</option>
              {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            {(txSearch||filterType!=="all"||filterCat!=="all") && (
              <button onClick={()=>{setTxSearch(""); setFilterType("all"); setFilterCat("all"); setTxPage(1);}}
                style={{ padding:"9px 12px", borderRadius:8, border:"none", background:"var(--redbg)", color:"var(--red)", fontWeight:600, fontSize:12, cursor:"pointer" }}>
                Limpar
              </button>
            )}
          </div>

          {/* Lista */}
          {txPaged.length === 0
            ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhuma transação encontrada</div>
            : txPaged.map((e,i) => (
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i<txPaged.length-1?"1px solid var(--border)":"none" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:e.val>=0?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                    {e.val>=0?"↑":"↓"}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", display:"flex", gap:6, flexWrap:"wrap", marginTop:1 }}>
                      <span>{e.cat}</span>
                      <span>·</span>
                      <span>{e.date}</span>
                      <span>·</span>
                      <span style={{ background:"var(--border)", borderRadius:99, padding:"1px 6px" }}>{e.src}</span>
                      {e.paid===false && <span style={{ color:"var(--amber,#f59e0b)", fontWeight:600 }}>Pendente</span>}
                    </div>
                  </div>
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:e.val>=0?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                  {e.val>=0?"+":""}{fmt(Math.abs(e.val))}
                </span>
              </div>
            ))
          }

          {/* Paginação */}
          {txPages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
              <button onClick={()=>setTxPage(p=>Math.max(1,p-1))} disabled={txPage===1}
                style={{ padding:"6px 14px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", cursor:"pointer", fontSize:13 }}>←</button>
              <span style={{ fontSize:13, color:"var(--muted)" }}>{txPage}/{txPages} · {allTx.length} registros</span>
              <button onClick={()=>setTxPage(p=>Math.min(txPages,p+1))} disabled={txPage===txPages}
                style={{ padding:"6px 14px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", cursor:"pointer", fontSize:13 }}>→</button>
            </div>
          )}
        </Card>
      )}

      <HelpButton pageId="relatorios" onNavigate={onNavigate} />
    </div>
  );
}
