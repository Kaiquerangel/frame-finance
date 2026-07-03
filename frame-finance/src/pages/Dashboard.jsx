import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { generateAlerts } from "../lib/alerts";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import Checklist from "../components/Checklist";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend, ReferenceLine,
} from "recharts";

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmt   = (v) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v||0);
const fmtK  = (v) => Math.abs(v)>=1000 ? `R$\u00a0${(v/1000).toFixed(1)}k` : fmt(v);
const fmtPct= (v) => `${(v||0).toFixed(0)}%`;
const pct   = (a,b) => b>0 ? Math.min((a/b)*100,100) : 0;
const today = () => new Date().toISOString().slice(0,7);
const mlabel= (ym) => { const [y,m]=ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const PALETTE = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#8b5cf6","#06b6d4"];

// ── Componentes base ──────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", padding:18, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const SLabel = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{children}</div>
);

const KpiCard = ({ label, value, sub, sub2, color="var(--text)", icon, onClick, urgent, badge }) => (
  <button onClick={onClick} style={{
    background: urgent ? `${color}11` : "var(--surface)",
    borderRadius:14, border: urgent ? `1.5px solid ${color}44` : "1px solid var(--border)",
    padding:"16px 14px", cursor: onClick?"pointer":"default",
    textAlign:"left", width:"100%", boxShadow:"var(--shadow-sm)", transition:"all .15s",
  }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
        {icon && <span style={{ fontSize:16 }}>{icon}</span>}
        <span style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
      </div>
      {badge && <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:badge.color, borderRadius:99, padding:"2px 7px" }}>{badge.text}</span>}
    </div>
    <div style={{ fontSize:18, fontWeight:800, color, lineHeight:1, marginBottom:4 }}>{value}</div>
    {sub  && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{sub}</div>}
    {sub2 && <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>{sub2}</div>}
  </button>
);

const BarH = ({ label, value, total, color, sub, onClick }) => {
  const p = total>0 ? Math.min((value/total)*100,100) : 0;
  return (
    <div onClick={onClick} style={{ cursor:onClick?"pointer":"default", marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
        <span style={{ color:"var(--text)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%", flex:1 }}>{label}</span>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          {sub && <span style={{ color:"var(--muted)", fontSize:11 }}>{sub}</span>}
          <span style={{ color, fontWeight:700 }}>{fmt(value)}</span>
          <span style={{ color:"var(--muted)", fontWeight:400 }}>({p.toFixed(0)}%)</span>
        </div>
      </div>
      <div style={{ height:7, background:"var(--border)", borderRadius:99 }}>
        <div style={{ height:"100%", width:`${p}%`, background:color, borderRadius:99, transition:"width .5s" }} />
      </div>
    </div>
  );
};

// ── Score ring ────────────────────────────────────────────────────────────────
const ScoreRing = ({ pts, color, size=72 }) => {
  const r = (size-8)/2;
  const circ = 2*Math.PI*r;
  const dash = (pts/100)*circ;
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray .8s ease" }} />
    </svg>
  );
};

// ── Treemap simples ───────────────────────────────────────────────────────────
const MiniTreemap = ({ data, total, onClick }) => {
  const sorted = [...data].sort((a,b)=>b.val-a.val).slice(0,8);
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
      {sorted.map((item,idx) => {
        const w = Math.max((item.val/total)*100, 8);
        return (
          <div key={item.cat} onClick={() => onClick && onClick(item.cat)}
            title={`${item.cat}: ${fmt(item.val)} (${((item.val/total)*100).toFixed(0)}%)`}
            style={{
              width:`${w}%`, minWidth:32, height:40, borderRadius:6,
              background:PALETTE[idx%PALETTE.length], cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              padding:"0 6px", overflow:"hidden", transition:"opacity .15s",
              opacity:.85,
            }}
            onMouseEnter={e=>e.currentTarget.style.opacity=1}
            onMouseLeave={e=>e.currentTarget.style.opacity=.85}
          >
            <span style={{ fontSize:10, fontWeight:700, color:"#fff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>
              {item.cat}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
export default function Dashboard({ userId, onNavigate, onStartTour }) {
  const isMobile = useIsMobile();

  // ── Estado ───────────────────────────────────────────────────────────────
  const [transactions,  setTransactions]  = useState([]);
  const [revenues,      setRevenues]      = useState([]);
  const [installments,  setInstallments]  = useState([]);
  const [loanInst,      setLoanInst]      = useState([]);
  const [goals,         setGoals]         = useState([]);
  const [budgets,       setBudgets]       = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);
  const [alerts,        setAlerts]        = useState([]);
  const [filterMonth,   setFilterMonth]   = useState(today());
  const [loading,       setLoading]       = useState(true);
  const [loadError,     setLoadError]     = useState(null);
  const [selectedCat,   setSelectedCat]   = useState(null);
  const [showAllCats,   setShowAllCats]   = useState(false);

  // ── Carga de dados ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [
        {data:t},{data:r},{data:i},{data:li},{data:g},{data:b},{data:fp},
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(1000),
        supabase.from("revenues").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(500),
        supabase.from("installments").select("*, purchases(description,category,card_id,cards(name))").eq("user_id",userId).order("due_date").limit(500),
        supabase.from("loan_installments").select("*, loans(description,category,type,installments)").eq("user_id",userId).limit(500),
        supabase.from("goals").select("*").eq("user_id",userId),
        supabase.from("budgets").select("*").eq("user_id",userId).eq("month",today()),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description,category)").eq("user_id",userId).limit(500),
      ]);
      setTransactions(t||[]); setRevenues(r||[]); setInstallments(i||[]);
      setLoanInst(li||[]); setGoals(g||[]); setBudgets(b||[]); setFixedPayments(fp||[]);
      const a = await generateAlerts(userId); setAlerts(a);
    } catch(err) { setLoadError("Não foi possível carregar o Dashboard."); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Meses disponíveis ─────────────────────────────────────────────────────
  const months = useMemo(() => {
    const s = new Set([
      ...transactions.map(t=>t.date.slice(0,7)),
      ...revenues.map(r=>r.date.slice(0,7)),
      ...fixedPayments.map(fp=>(fp.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    s.add(today());
    return [...s].sort().reverse();
  }, [transactions,revenues,fixedPayments]);

  // ── Dados filtrados ───────────────────────────────────────────────────────
  const filtTx    = useMemo(()=>transactions.filter(t=>t.date.startsWith(filterMonth)),[transactions,filterMonth]);
  const filtRev   = useMemo(()=>revenues.filter(r=>r.date.startsWith(filterMonth)),[revenues,filterMonth]);
  const filtFixed = useMemo(()=>fixedPayments.filter(fp=>(fp.due_date||"").startsWith(filterMonth)),[fixedPayments,filterMonth]);
  const filtInst  = useMemo(()=>installments.filter(i=>(i.due_date||"").startsWith(filterMonth)),[installments,filterMonth]);
  const filtLoan  = useMemo(()=>loanInst.filter(i=>(i.due_date||"").startsWith(filterMonth)),[loanInst,filterMonth]);

  // ── Totais do mês ─────────────────────────────────────────────────────────
  const totals = useMemo(()=>{
    const rec = filtRev.reduce((a,r)=>a+Number(r.amount),0)
              + filtTx.filter(t=>t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const depTx    = filtTx.filter(t=>t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
    const depFixed = filtFixed.reduce((a,fp)=>a+Number(fp.amount),0);
    const depInst  = filtInst.reduce((a,i)=>a+Number(i.amount),0);
    const depLoan  = filtLoan.reduce((a,i)=>a+Number(i.amount),0);
    const dep = depTx+depFixed+depInst+depLoan;
    return { rec, dep, bal:rec-dep, depTx, depFixed, depInst, depLoan };
  },[filtTx,filtRev,filtFixed,filtInst,filtLoan]);

  // ── Orçamento ─────────────────────────────────────────────────────────────
  const totalBudget = budgets.reduce((a,b)=>a+Number(b.amount),0);
  const budgetPct   = pct(totals.dep, totalBudget);
  const budgetLeft  = totalBudget - totals.dep;
  const budgColor   = budgetPct>90?"var(--red)":budgetPct>70?"#f59e0b":"var(--green)";

  // ── Taxa de poupança ──────────────────────────────────────────────────────
  const savingsRate = totals.rec>0 ? Math.max(((totals.rec-totals.dep)/totals.rec)*100,0) : 0;

  // ── Score financeiro (4 fatores) ──────────────────────────────────────────
  const score = useMemo(()=>{
    if (totals.rec<=0) return null;
    const spendRate = totals.dep/totals.rec;          // ideal <0.7
    const debtLoad  = (totals.depFixed+totals.depInst+totals.depLoan)/Math.max(totals.rec,1); // ideal <0.3
    const savings   = Math.max(1-spendRate,0);         // ideal >0.2
    const budgetAdh = totalBudget>0 ? Math.max(1-budgetPct/100,0) : 0.5;

    const s = Math.round(
      Math.max(1-spendRate,0)*30 +
      Math.max(1-debtLoad/0.5,0)*30 +
      Math.min(savings/0.2,1)*25 +
      budgetAdh*15
    );
    const pts = Math.min(Math.max(s,0),100);
    const color = pts>=75?"var(--green)":pts>=50?"#f59e0b":"var(--red)";
    const label = pts>=75?"Saudável":pts>=50?"Atenção":"Crítico";
    return { pts, color, label, spendRate, debtLoad };
  },[totals,totalBudget,budgetPct]);

  // ── Ritmo de gastos ───────────────────────────────────────────────────────
  const dailyBudget = useMemo(()=>{
    if (totalBudget<=0) return null;
    const now=new Date();
    const [y,m]=filterMonth.split("-").map(Number);
    const daysInMonth=new Date(y,m,0).getDate();
    const isThisMonth=now.getFullYear()===y&&now.getMonth()+1===m;
    const dayOfMonth=isThisMonth?now.getDate():daysInMonth;
    const daysLeft=Math.max(daysInMonth-dayOfMonth+1,1);
    return { perDay:budgetLeft/daysLeft, daysLeft };
  },[totalBudget,budgetLeft,filterMonth]);

  // ── Projeção de saldo ─────────────────────────────────────────────────────
  const projection = useMemo(()=>{
    const now=new Date();
    const [y,m]=filterMonth.split("-").map(Number);
    const isThisMonth=now.getFullYear()===y&&now.getMonth()+1===m;
    if (!isThisMonth) return null;
    const daysInMonth=new Date(y,m,0).getDate();
    const dayOfMonth=now.getDate();
    const daysLeft=Math.max(daysInMonth-dayOfMonth,0);
    if (dayOfMonth<2) return null;
    const avgDailyAvulso=totals.depTx/dayOfMonth;
    const projectedAvulso=totals.depTx+(avgDailyAvulso*daysLeft);
    const projectedDep=projectedAvulso+totals.depFixed+totals.depInst+totals.depLoan;
    return { projectedDep, projectedBal:totals.rec-projectedDep, daysLeft };
  },[filterMonth,totals]);

  // ── Categorias ────────────────────────────────────────────────────────────
  const byCat = useMemo(()=>{
    const map={};
    filtTx.filter(t=>t.type==="despesa").forEach(t=>{map[t.cat]=(map[t.cat]||0)+Number(t.value);});
    filtFixed.forEach(fp=>{const c=fp.fixed_expenses?.category||"Fixas"; map[c]=(map[c]||0)+Number(fp.amount);});
    filtInst.forEach(i=>{const c=i.purchases?.category||"Compras"; map[c]=(map[c]||0)+Number(i.amount);});
    filtLoan.forEach(i=>{const c=i.loans?.category||"Empréstimos"; map[c]=(map[c]||0)+Number(i.amount);});
    return Object.entries(map).map(([cat,val])=>({cat,val})).sort((a,b)=>b.val-a.val);
  },[filtTx,filtFixed,filtInst,filtLoan]);

  // ── Histórico da categoria (12 meses) ─────────────────────────────────────
  const catHistory = useMemo(()=>{
    if (!selectedCat) return [];
    const now=new Date();
    const mons=[];
    for(let i=11;i>=0;i--){
      const d=new Date(now.getFullYear(),now.getMonth()-i,1);
      mons.push(d.toISOString().slice(0,7));
    }
    return mons.map(ym=>{
      const val=
        transactions.filter(t=>t.type==="despesa"&&t.cat===selectedCat&&t.date.startsWith(ym)).reduce((a,t)=>a+Number(t.value),0)
        +fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)&&fp.fixed_expenses?.category===selectedCat).reduce((a,fp)=>a+Number(fp.amount),0)
        +installments.filter(i=>(i.due_date||"").startsWith(ym)&&i.purchases?.category===selectedCat).reduce((a,i)=>a+Number(i.amount),0)
        +loanInst.filter(i=>(i.due_date||"").startsWith(ym)&&i.loans?.category===selectedCat).reduce((a,i)=>a+Number(i.amount),0);
      const [y2,m2]=ym.split("-");
      return { name:new Date(+y2,+m2-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}), val, ym };
    });
  },[selectedCat,transactions,fixedPayments,installments,loanInst]);

  // ── Top 10 maiores gastos ─────────────────────────────────────────────────
  const top10 = useMemo(()=>{
    const items=[
      ...filtTx.filter(t=>t.type==="despesa").map(t=>({id:`tx-${t.id}`,desc:t.description,cat:t.cat,val:Number(t.value),src:"Avulso",date:t.date})),
      ...filtFixed.map(fp=>({id:`fp-${fp.id}`,desc:fp.fixed_expenses?.description||"Despesa fixa",cat:fp.fixed_expenses?.category||"Fixas",val:Number(fp.amount),src:"Fixa",date:fp.due_date})),
      ...filtInst.map(i=>({id:`inst-${i.id}`,desc:i.purchases?.description||"Parcela",cat:i.purchases?.category||"Compras",val:Number(i.amount),src:"Parcela",date:i.due_date})),
      ...filtLoan.map(i=>({id:`loan-${i.id}`,desc:i.loans?.description||"Empréstimo",cat:i.loans?.category||"Fixo",val:Number(i.amount),src:"Empréstimo",date:i.due_date})),
    ];
    return items.sort((a,b)=>b.val-a.val).slice(0,10);
  },[filtTx,filtFixed,filtInst,filtLoan]);

  // ── Evolução 12 meses ─────────────────────────────────────────────────────
  const evolution = useMemo(()=>{
    const allMonths=new Set([
      ...transactions.map(t=>t.date.slice(0,7)),
      ...revenues.map(r=>r.date.slice(0,7)),
      ...fixedPayments.map(fp=>(fp.due_date||"").slice(0,7)).filter(Boolean),
      ...installments.map(i=>(i.due_date||"").slice(0,7)).filter(Boolean),
      ...loanInst.map(i=>(i.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    let bal=0;
    return [...allMonths].sort().slice(-12).map(ym=>{
      const rec=revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
               +transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const dep=transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
               +fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
               +installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0)
               +loanInst.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      bal+=rec-dep;
      return { ym, label:mlabel(ym), rec, dep, bal:rec-dep, balAcum:bal };
    });
  },[transactions,revenues,fixedPayments,installments,loanInst]);

  // ── Variação vs mês anterior ──────────────────────────────────────────────
  const prevMonth = useMemo(()=>{
    const [y,m]=filterMonth.split("-").map(Number);
    const d=new Date(y,m-2,1);
    return d.toISOString().slice(0,7);
  },[filterMonth]);

  const prevTotals = useMemo(()=>{
    const rec=revenues.filter(r=>r.date.startsWith(prevMonth)).reduce((a,r)=>a+Number(r.amount),0)
             +transactions.filter(t=>t.date.startsWith(prevMonth)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const dep=transactions.filter(t=>t.date.startsWith(prevMonth)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
             +fixedPayments.filter(fp=>(fp.due_date||"").startsWith(prevMonth)).reduce((a,fp)=>a+Number(fp.amount),0)
             +installments.filter(i=>(i.due_date||"").startsWith(prevMonth)).reduce((a,i)=>a+Number(i.amount),0)
             +loanInst.filter(i=>(i.due_date||"").startsWith(prevMonth)).reduce((a,i)=>a+Number(i.amount),0);
    return { rec, dep };
  },[revenues,transactions,fixedPayments,installments,loanInst,prevMonth]);

  const varDep = prevTotals.dep>0 ? ((totals.dep-prevTotals.dep)/prevTotals.dep)*100 : null;
  const varRec = prevTotals.rec>0 ? ((totals.rec-prevTotals.rec)/prevTotals.rec)*100 : null;

  // ── Vencimentos próximos (7 dias) ─────────────────────────────────────────
  const upcoming = useMemo(()=>{
    const now=new Date(); const limit=new Date(now); limit.setDate(limit.getDate()+7);
    const toDate=s=>new Date(s+"T00:00:00");
    const items=[
      ...fixedPayments.filter(fp=>!fp.paid&&toDate(fp.due_date)>=now&&toDate(fp.due_date)<=limit)
        .map(fp=>({id:`fp-${fp.id}`,desc:fp.fixed_expenses?.description||"Fixa",val:Number(fp.amount),due:fp.due_date,type:"Fixa"})),
      ...installments.filter(i=>!i.paid&&toDate(i.due_date)>=now&&toDate(i.due_date)<=limit)
        .map(i=>({id:`inst-${i.id}`,desc:i.purchases?.description||"Parcela",val:Number(i.amount),due:i.due_date,type:"Parcela"})),
      ...loanInst.filter(i=>!i.paid&&toDate(i.due_date)>=now&&toDate(i.due_date)<=limit)
        .map(i=>({id:`loan-${i.id}`,desc:i.loans?.description||"Empréstimo",val:Number(i.amount),due:i.due_date,type:"Empréstimo"})),
    ];
    return items.sort((a,b)=>a.due.localeCompare(b.due)).slice(0,6);
  },[fixedPayments,installments,loanInst]);

  // ── Alertas ───────────────────────────────────────────────────────────────
  const urgentAlerts = useMemo(()=>alerts.filter(a=>a.type==="danger"||a.type==="warning"),[alerts]);
  const infoAlerts   = useMemo(()=>alerts.filter(a=>a.type==="info"||a.type==="success"),[alerts]);

  // ── Movimentos recentes ───────────────────────────────────────────────────
  const recent = useMemo(()=>{
    const items=[
      ...filtTx.map(t=>({id:`tx-${t.id}`,date:t.date,desc:t.description,val:t.type==="receita"?+Number(t.value):-Number(t.value),src:"Avulso",cat:t.cat})),
      ...filtRev.map(r=>({id:`rev-${r.id}`,date:r.date,desc:r.description,val:+Number(r.amount),src:"Receita",cat:r.category})),
      ...filtFixed.filter(fp=>fp.paid).map(fp=>({id:`fp-${fp.id}`,date:fp.due_date,desc:fp.fixed_expenses?.description||"Fixa",val:-Number(fp.amount),src:"Fixa",cat:fp.fixed_expenses?.category})),
      ...filtInst.filter(i=>i.paid).map(i=>({id:`inst-${i.id}`,date:i.due_date,desc:i.purchases?.description||"Parcela",val:-Number(i.amount),src:"Parcela",cat:i.purchases?.category})),
      ...filtLoan.filter(i=>i.paid).map(i=>({id:`loan-${i.id}`,date:i.due_date,desc:i.loans?.description||"Empréstimo",val:-Number(i.amount),src:"Empréstimo",cat:i.loans?.category})),
    ];
    return items.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  },[filtTx,filtRev,filtFixed,filtInst,filtLoan]);

  // ── Metas ─────────────────────────────────────────────────────────────────
  const activeGoals = useMemo(()=>goals.filter(g=>Number(g.saved)<Number(g.target)).slice(0,3),[goals]);
  const totalGoalPct = useMemo(()=>{
    if (!goals.length) return 0;
    return goals.reduce((a,g)=>a+Math.min(Number(g.saved)/Number(g.target),1),0)/goals.length*100;
  },[goals]);

  if (loading) return <LoadingSpinner message="Carregando seu painel..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={load} />;

  const isCurrentMonth = filterMonth===today();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:isMobile?10:12 }}>

      <Checklist onNavigate={onNavigate} onStartTour={onStartTour} />

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, var(--accent) 0%, var(--accent2,#5b21b6) 100%)",
        borderRadius:20, padding:isMobile?"20px":"28px",
        color:"#fff", position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,.07)" }} />
        <div style={{ position:"absolute", bottom:-60, left:-30, width:220, height:220, borderRadius:"50%", background:"rgba(255,255,255,.04)" }} />
        <div style={{ position:"relative" }}>
          {/* Cabeçalho */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, opacity:.8 }}>
                {isCurrentMonth?"Este mês":mlabel(filterMonth)}
              </div>
              {!isCurrentMonth && (
                <button onClick={()=>setFilterMonth(today())} style={{ fontSize:11, color:"rgba(255,255,255,.7)", background:"rgba(255,255,255,.1)", border:"none", borderRadius:6, padding:"2px 8px", cursor:"pointer", marginTop:3 }}>
                  Voltar ao mês atual →
                </button>
              )}
            </div>
            <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{
              background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.25)",
              color:"#fff", borderRadius:8, padding:"5px 10px", fontSize:12, fontWeight:600, cursor:"pointer", outline:"none",
            }}>
              {months.map(m=><option key={m} value={m} style={{ background:"var(--accent)", color:"#fff" }}>{mlabel(m)}</option>)}
            </select>
          </div>

          {/* Saldo principal */}
          <div style={{ fontSize:isMobile?36:48, fontWeight:800, letterSpacing:"-.03em", lineHeight:1, marginBottom:4 }}>
            {fmt(totals.bal)}
          </div>
          <div style={{ fontSize:13, opacity:.75, marginBottom:20 }}>
            {totals.bal>=0?"Saldo positivo no período":"Gastos acima das receitas"}
            {varDep!==null && (
              <span style={{ marginLeft:10, fontSize:11, background:"rgba(255,255,255,.15)", borderRadius:6, padding:"2px 8px" }}>
                Despesas {varDep>=0?"+":""}{varDep.toFixed(0)}% vs mês anterior
              </span>
            )}
          </div>

          {/* Métricas rápidas */}
          <div style={{ display:"flex", gap:isMobile?16:32, flexWrap:"wrap" }}>
            {[
              { l:"Receitas",   v:`+${fmt(totals.rec)}`, delta:varRec },
              { l:"Despesas",   v:fmt(totals.dep),       delta:varDep, invertColor:true },
              { l:"Taxa gasto", v:totals.rec>0?fmtPct(totals.dep/totals.rec*100):"—" },
              { l:"Poupança",   v:fmtPct(savingsRate), color: savingsRate>=20?"#86efac":savingsRate>=10?"#fde68a":"#fca5a5" },
            ].map((item,i)=>(
              <div key={i}>
                {i>0&&<div style={{ width:1, background:"rgba(255,255,255,.2)", height:32, position:"absolute", marginLeft:-16 }} />}
                <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>{item.l}</div>
                <div style={{ fontSize:isMobile?14:17, fontWeight:700, color:item.color||"#fff" }}>{item.v}</div>
              </div>
            ))}
          </div>

          {/* Barra de orçamento */}
          {totalBudget>0&&(
            <div style={{ marginTop:18 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:5, opacity:.85 }}>
                <span>Orçamento {fmt(totalBudget)}</span>
                <span>{fmtPct(budgetPct)} usado · {fmt(Math.max(budgetLeft,0))} livre</span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,.2)", borderRadius:99 }}>
                <div style={{ height:"100%", width:`${Math.min(budgetPct,100)}%`, borderRadius:99, transition:"width .6s",
                  background:budgetPct>90?"#ef4444":budgetPct>70?"#f59e0b":"rgba(255,255,255,.9)" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs LINHA 1: Saldo · Receitas · Despesas · Fixos · Avulsos ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)", gap:isMobile?8:10 }}>
        <KpiCard icon="💰" label="Saldo líquido"
          value={fmt(totals.bal)}
          sub={totals.bal>=0?"Positivo":"Negativo"}
          color={totals.bal>=0?"var(--green)":"var(--red)"}
          urgent={totals.bal<0} />
        <KpiCard icon="↑" label="Receitas"
          value={fmt(totals.rec)}
          sub={varRec!==null?`${varRec>=0?"+":""}${varRec.toFixed(0)}% vs mês ant.`:`${filtRev.length} lançamentos`}
          color="var(--green)"
          onClick={()=>onNavigate("receitas")} />
        <KpiCard icon="↓" label="Despesas"
          value={fmt(totals.dep)}
          sub={varDep!==null?`${varDep>=0?"+":""}${varDep.toFixed(0)}% vs mês ant.`:`${filtTx.filter(t=>t.type==="despesa").length+filtFixed.length+filtInst.length+filtLoan.length} itens`}
          color={totals.dep>totals.rec?"var(--red)":"var(--text)"}
          urgent={totals.dep>totals.rec}
          onClick={()=>onNavigate("gastos")} />
        <KpiCard icon="📌" label="Fixos do mês"
          value={fmt(totals.depFixed+totals.depInst+totals.depLoan)}
          sub={`${filtFixed.filter(f=>!f.paid).length+filtInst.filter(i=>!i.paid).length+filtLoan.filter(i=>!i.paid).length} pendentes`}
          sub2={`${fmtPct((totals.depFixed+totals.depInst+totals.depLoan)/Math.max(totals.rec,1)*100)} da renda`}
          color="#f59e0b"
          urgent={(totals.depFixed+totals.depInst+totals.depLoan)/Math.max(totals.rec,1)>0.5}
          onClick={()=>onNavigate("gastos")} />
        <KpiCard icon="💸" label="Avulsos"
          value={fmt(totals.depTx)}
          sub={`${filtTx.filter(t=>t.type==="despesa").length} lançamentos`}
          sub2={`${fmtPct(totals.depTx/Math.max(totals.dep,1)*100)} das despesas`}
          color="var(--accent)"
          onClick={()=>onNavigate("gastos")} />
      </div>

      {/* ── KPIs LINHA 2: Score · Orçamento · Taxa gasto · Poupança · Metas ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(5,1fr)", gap:isMobile?8:10 }}>
        <KpiCard icon="🎯" label="Score financeiro"
          value={score?`${score.pts}/100`:"—"}
          sub={score?.label||"Sem dados"}
          color={score?.color||"var(--muted)"}
          urgent={score&&score.pts<50}
          badge={score&&score.pts<50?{text:"Atenção",color:"var(--red)"}:null}
          onClick={()=>onNavigate("visao")} />
        <KpiCard icon="◑" label="Orçamento"
          value={totalBudget>0?fmtPct(budgetPct):"Sem orçamento"}
          sub={totalBudget>0?`${fmt(Math.max(budgetLeft,0))} disponível`:"Configurar agora"}
          color={totalBudget>0?budgColor:"var(--muted)"}
          urgent={budgetPct>80}
          onClick={()=>onNavigate("orcamento")} />
        <KpiCard icon="%" label="Taxa de gasto"
          value={totals.rec>0?fmtPct(totals.dep/totals.rec*100):"—"}
          sub={totals.dep<=totals.rec*0.7?"Dentro do ideal":totals.dep<=totals.rec*0.9?"Moderado":"Acima do ideal"}
          color={totals.dep<=totals.rec*0.7?"var(--green)":totals.dep<=totals.rec*0.9?"#f59e0b":"var(--red)"}
          urgent={totals.dep>totals.rec*0.9} />
        <KpiCard icon="🏦" label="Taxa de poupança"
          value={fmtPct(savingsRate)}
          sub={savingsRate>=20?"Excelente":savingsRate>=10?"Razoável":"Melhorar"}
          sub2={`${fmt(Math.max(totals.rec-totals.dep,0))} guardado`}
          color={savingsRate>=20?"var(--green)":savingsRate>=10?"#f59e0b":"var(--red)"}
          urgent={savingsRate<10&&totals.rec>0}
          onClick={()=>onNavigate("metas")} />
        <KpiCard icon="◎" label="Metas"
          value={`${goals.filter(g=>Number(g.saved)>=Number(g.target)).length}/${goals.length}`}
          sub={activeGoals.length>0?`${activeGoals.length} em andamento`:"Nenhuma ativa"}
          sub2={goals.length>0?`${fmtPct(totalGoalPct)} médio`:"Criar uma meta"}
          color="var(--accent)"
          onClick={()=>onNavigate("metas")} />
      </div>

      {/* ── ALERTAS CRÍTICOS ─────────────────────────────────────────────── */}
      {urgentAlerts.length>0&&(
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {urgentAlerts.map((a,i)=>(
            <div key={i} style={{
              background:a.type==="danger"?"var(--redbg)":"#fffbeb",
              border:`1px solid ${a.type==="danger"?"var(--red)":"#f59e0b"}44`,
              borderRadius:10, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{a.type==="danger"?"⛔":"⚠️"}</span>
              <span style={{ fontSize:13, color:"var(--text)", lineHeight:1.5, flex:1 }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── GRÁFICOS ROW 1: Evolução (BarChart) + Tendência saldo (LineChart) ── */}
      {evolution.length>=2&&(
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1.4fr 1fr", gap:12 }}>
          {/* Receitas vs Despesas */}
          <Card>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Receitas vs Despesas</div>
                <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>Últimos {evolution.length} meses</div>
              </div>
              <button onClick={()=>onNavigate("analise")} style={{ fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Ver análise →</button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evolution} margin={{ left:-8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={48} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize:11, paddingTop:8 }} />
                <Bar dataKey="rec" name="Receitas" fill="var(--green)" radius={[3,3,0,0]} opacity={.85} />
                <Bar dataKey="dep" name="Despesas" fill="var(--red)"   radius={[3,3,0,0]} opacity={.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Saldo acumulado */}
          <Card>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4 }}>Saldo acumulado</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginBottom:14 }}>Tendência mensal</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolution} margin={{ left:-8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={48} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="bal" name="Saldo mensal" stroke="var(--accent)" strokeWidth={2} dot={{ r:3, fill:"var(--accent)" }} />
                <Line type="monotone" dataKey="balAcum" name="Acumulado" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── SCORE + PROJEÇÃO + RITMO ──────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":`${score?"1fr ":""}${projection?"1fr ":""}${dailyBudget?"1fr":""}`.trim()||"1fr", gap:12 }}>
        {score&&(
          <Card style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ position:"relative", flexShrink:0 }}>
              <ScoreRing pts={score.pts} color={score.color} size={80} />
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                <div style={{ fontSize:18, fontWeight:800, color:score.color }}>{score.pts}</div>
                <div style={{ fontSize:9, color:"var(--muted)" }}>/ 100</div>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <SLabel>Score financeiro</SLabel>
              <div style={{ fontSize:17, fontWeight:800, color:score.color, marginBottom:4 }}>{score.label}</div>
              <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.6 }}>
                Gasta {fmtPct(score.spendRate*100)} da renda<br/>
                Fixos comprometem {fmtPct(score.debtLoad*100)} da renda
              </div>
              <button onClick={()=>onNavigate("visao")} style={{ marginTop:6, fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0 }}>
                Ver saúde completa →
              </button>
            </div>
          </Card>
        )}
        {projection&&(
          <Card style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ fontSize:32 }}>📈</div>
            <div style={{ flex:1 }}>
              <SLabel>Projeção fim do mês</SLabel>
              <div style={{ fontSize:17, fontWeight:800, color:projection.projectedBal>=0?"var(--green)":"var(--red)", marginBottom:4 }}>
                {fmt(projection.projectedBal)}
              </div>
              <div style={{ fontSize:11, color:"var(--muted)", lineHeight:1.6 }}>
                Despesas projetadas: {fmt(projection.projectedDep)}<br/>
                {projection.daysLeft} dia{projection.daysLeft!==1?"s":""} restando
              </div>
            </div>
          </Card>
        )}
        {dailyBudget&&dailyBudget.perDay>0&&(
          <Card style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ fontSize:32 }}>🗓</div>
            <div style={{ flex:1 }}>
              <SLabel>Ritmo de gastos</SLabel>
              <div style={{ fontSize:17, fontWeight:800, color:dailyBudget.perDay>0?"var(--green)":"var(--red)", marginBottom:4 }}>
                {fmt(dailyBudget.perDay)}<span style={{ fontSize:11, fontWeight:400, color:"var(--muted)" }}>/dia</span>
              </div>
              <div style={{ fontSize:11, color:"var(--muted)" }}>
                Disponível pelos próximos {dailyBudget.daysLeft} dias
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* ── COMPOSIÇÃO: Avulsos vs Fixos + Detalhe fixos ─────────────────── */}
      {totals.dep>0&&(
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
          {/* Composição macro */}
          <Card>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4 }}>Composição das despesas</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginBottom:14 }}>Avulsos vs compromissos fixos</div>
            {[
              { label:"Avulsos",   val:totals.depTx,                                      color:PALETTE[0], desc:"Gastos do dia a dia" },
              { label:"Fixos",     val:totals.depFixed+totals.depInst+totals.depLoan,      color:PALETTE[3], desc:"Fixas + Parcelas + Empréstimos" },
            ].map(item=>(
              <BarH key={item.label} label={item.label} value={item.val} total={totals.dep} color={item.color} sub={item.desc} />
            ))}
            <button onClick={()=>onNavigate("visao")} style={{ marginTop:8, fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600, padding:0 }}>
              Ver detalhe completo →
            </button>
          </Card>

          {/* Detalhe dos fixos */}
          <Card>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4 }}>Detalhe dos fixos</div>
            <div style={{ fontSize:11, color:"var(--muted)", marginBottom:14 }}>
              Total: {fmt(totals.depFixed+totals.depInst+totals.depLoan)} ·{" "}
              {fmtPct((totals.depFixed+totals.depInst+totals.depLoan)/Math.max(totals.rec,1)*100)} da renda
            </div>
            {[
              { label:"Despesas fixas",     val:totals.depFixed, color:"#f59e0b",  icon:"📌" },
              { label:"Parcelas de cartão", val:totals.depInst,  color:"#3b82f6",  icon:"💳" },
              { label:"Empréstimos",        val:totals.depLoan,  color:"#7c3aed",  icon:"🏦" },
            ].map(item=>(
              <BarH key={item.label} label={`${item.icon} ${item.label}`} value={item.val}
                total={totals.depFixed+totals.depInst+totals.depLoan} color={item.color} />
            ))}
          </Card>
        </div>
      )}

      {/* ── TREEMAP + CATEGORIAS ─────────────────────────────────────────── */}
      {byCat.length>0&&(
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Gastos por categoria</div>
            <button onClick={()=>setShowAllCats(v=>!v)} style={{ fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>
              {showAllCats?`Mostrar menos ▲`:`Ver todas (${byCat.length}) ▼`}
            </button>
          </div>
          <div style={{ fontSize:11, color:"var(--muted)", marginBottom:12 }}>
            {fmt(totals.dep)} total · <span style={{ color:"var(--accent)" }}>Clique numa categoria para ver histórico de 12 meses</span>
          </div>

          {/* Treemap visual */}
          <MiniTreemap data={byCat} total={totals.dep} onClick={setSelectedCat} />

          {/* Lista de barras */}
          <div style={{ marginTop:14 }}>
            {(showAllCats?byCat:byCat.slice(0,6)).map((item,idx)=>(
              <BarH key={item.cat} label={item.cat} value={item.val} total={totals.dep}
                color={PALETTE[idx%PALETTE.length]}
                onClick={()=>setSelectedCat(item.cat)} />
            ))}
          </div>
        </Card>
      )}

      {/* ── MODAL DRILL-DOWN CATEGORIA ───────────────────────────────────── */}
      {selectedCat&&(
        <div onClick={e=>e.target===e.currentTarget&&setSelectedCat(null)} style={{
          position:"fixed", inset:0, zIndex:200,
          background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)",
          display:"flex", alignItems:isMobile?"flex-end":"center",
          justifyContent:"center", padding:isMobile?0:20,
        }}>
          <div style={{
            width:"100%", maxWidth:isMobile?"100%":520,
            background:"var(--surface)", borderRadius:isMobile?"20px 20px 0 0":18,
            border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", overflow:"hidden",
          }}>
            {isMobile&&<div style={{ width:36, height:4, borderRadius:99, background:"var(--border)", margin:"12px auto 0" }} />}
            <div style={{ padding:isMobile?"16px 20px 0":"20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontWeight:800, fontSize:17, color:"var(--text)" }}>{selectedCat}</div>
                <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>Histórico — últimos 12 meses</div>
              </div>
              <button onClick={()=>setSelectedCat(null)} style={{ width:30, height:30, borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", cursor:"pointer", color:"var(--muted)", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ padding:isMobile?"14px 20px 24px":"16px 24px 24px" }}>
              {catHistory.every(d=>d.val===0)?(
                <div style={{ textAlign:"center", color:"var(--muted)", padding:"28px 0", fontSize:13 }}>Nenhum registro nos últimos 12 meses</div>
              ):(
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={catHistory} margin={{ left:-10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={44} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <Bar dataKey="val" radius={[4,4,0,0]}>
                        {catHistory.map((e,i)=>(
                          <Cell key={i} fill={e.ym===filterMonth?"var(--accent)":"var(--muted)"} opacity={e.ym===filterMonth?1:.55} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:14 }}>
                    {[
                      { label:"Total 12m",    value:fmt(catHistory.reduce((a,d)=>a+d.val,0)) },
                      { label:"Média mensal", value:fmt(catHistory.filter(d=>d.val>0).reduce((a,d)=>a+d.val,0)/Math.max(catHistory.filter(d=>d.val>0).length,1)) },
                      { label:"Mês atual",    value:fmt(catHistory.find(d=>d.ym===filterMonth)?.val||0) },
                    ].map(({label,value})=>(
                      <div key={label} style={{ background:"var(--bg)", borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:"var(--muted)", marginBottom:4, fontWeight:700, textTransform:"uppercase", letterSpacing:".04em" }}>{label}</div>
                        <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TOP 10 MAIORES GASTOS ────────────────────────────────────────── */}
      {top10.length>0&&(
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Top 10 maiores gastos</div>
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>Despesas individuais do período</div>
            </div>
          </div>
          {top10.map((item,idx)=>(
            <div key={item.id} style={{
              display:"flex", alignItems:"center", gap:10, padding:"10px 18px",
              borderTop:"1px solid var(--border)",
              background:idx===0?"var(--accentbg)":"transparent",
            }}>
              <div style={{
                width:26, height:26, borderRadius:7, flexShrink:0,
                background:idx<3?"var(--accent)":"var(--bg)",
                color:idx<3?"#fff":"var(--muted)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:800,
              }}>{idx+1}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.desc}</div>
                <div style={{ fontSize:11, color:"var(--muted)" }}>{item.cat} · <span style={{ color:
                  item.src==="Avulso"?"var(--accent)":item.src==="Fixa"?"#f59e0b":item.src==="Parcela"?"#3b82f6":"#7c3aed"
                }}>{item.src}</span> · {item.date}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontWeight:700, fontSize:13, color:"var(--red)" }}>{fmt(item.val)}</div>
                <div style={{ fontSize:10, color:"var(--muted)" }}>{fmtPct(item.val/Math.max(totals.dep,1)*100)}</div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* ── VENCIMENTOS PRÓXIMOS (7 dias) ────────────────────────────────── */}
      {upcoming.length>0&&(
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>⏰ Vencimentos nos próximos 7 dias</div>
            <button onClick={()=>onNavigate("gastos")} style={{ fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Ver todos →</button>
          </div>
          {upcoming.map((item,i)=>{
            const daysLeft=Math.ceil((new Date(item.due+"T00:00:00")-new Date())/(1000*60*60*24));
            return(
              <div key={item.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderTop:"1px solid var(--border)" }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                  <div style={{
                    width:36, height:36, borderRadius:9, flexShrink:0,
                    background:daysLeft<=1?"var(--redbg)":daysLeft<=3?"#fffbeb":"var(--bg)",
                    border:`1px solid ${daysLeft<=1?"var(--red)":daysLeft<=3?"#f59e0b":"var(--border)"}`,
                    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                  }}>
                    <div style={{ fontSize:13, fontWeight:800, color:daysLeft<=1?"var(--red)":daysLeft<=3?"#f59e0b":"var(--text)", lineHeight:1 }}>{daysLeft===0?"Hoje":daysLeft}</div>
                    {daysLeft>0&&<div style={{ fontSize:8, color:"var(--muted)" }}>dia{daysLeft!==1?"s":""}</div>}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.desc}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{item.type} · Vence {item.due}</div>
                  </div>
                </div>
                <span style={{ fontWeight:700, fontSize:13, color:"var(--red)", flexShrink:0, marginLeft:8 }}>{fmt(item.val)}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── METAS ATIVAS ─────────────────────────────────────────────────── */}
      {activeGoals.length>0&&(
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Metas em andamento</div>
            <button onClick={()=>onNavigate("metas")} style={{ fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Ver todas →</button>
          </div>
          {activeGoals.map(g=>{
            const p=Math.min((Number(g.saved)/Number(g.target))*100,100);
            const falta=Number(g.target)-Number(g.saved);
            return(
              <div key={g.id} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                  <span style={{ fontWeight:600, color:"var(--text)" }}>{g.name}</span>
                  <span style={{ color:"var(--muted)" }}>{fmt(g.saved)} / {fmt(g.target)}</span>
                </div>
                <div style={{ height:8, background:"var(--border)", borderRadius:99, marginBottom:4 }}>
                  <div style={{ height:"100%", width:`${p}%`, background:"var(--accent)", borderRadius:99, transition:"width .5s" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)" }}>
                  <span>{p.toFixed(0)}% concluído</span>
                  <span>Faltam {fmt(falta)}</span>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* ── MOVIMENTOS RECENTES ──────────────────────────────────────────── */}
      {recent.length>0&&(
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 18px 10px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Movimentos recentes</div>
            <button onClick={()=>onNavigate("historico")} style={{ fontSize:11, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Ver histórico →</button>
          </div>
          {recent.map(e=>(
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderTop:"1px solid var(--border)" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:e.val>=0?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                  {e.val>=0?"↑":"↓"}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{e.src}{e.cat?` · ${e.cat}`:""} · {e.date}</div>
                </div>
              </div>
              <span style={{ fontWeight:700, fontSize:13, color:e.val>=0?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                {e.val>=0?"+":""}{fmt(Math.abs(e.val))}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* ── ALERTAS INFORMATIVOS ─────────────────────────────────────────── */}
      {infoAlerts.length>0&&(
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {infoAlerts.map((a,i)=>(
            <div key={i} style={{ background:a.type==="success"?"var(--greenbg)":"var(--accentbg)", border:`1px solid ${a.type==="success"?"var(--green)":"var(--accent)"}33`, borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{a.type==="success"?"✅":"ℹ️"}</span>
              <span style={{ fontSize:13, color:"var(--text)", lineHeight:1.5 }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── ESTADO VAZIO ─────────────────────────────────────────────────── */}
      {recent.length===0&&byCat.length===0&&(
        <Card style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", marginBottom:8 }}>Nenhum movimento em {mlabel(filterMonth)}</div>
          <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Registre sua primeira receita ou gasto para ver o painel completo.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={()=>onNavigate("receitas")} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--green)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Receita</button>
            <button onClick={()=>onNavigate("gastos")} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Gasto</button>
          </div>
        </Card>
      )}

      <HelpButton pageId="dashboard" onNavigate={onNavigate} />
    </div>
  );
}
