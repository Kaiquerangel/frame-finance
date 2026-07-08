import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Cell, PieChart, Pie, Sector,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

// ── Utilitários ────────────────────────────────────────────────────────────────
const fmt    = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const fmtK   = (v) => Math.abs(v)>=1000?`R$\u00a0${(v/1000).toFixed(1)}k`:fmt(v);
const fmtPct = (v) => `${(v||0).toFixed(1)}%`;
const today  = () => new Date().toISOString().slice(0,7);
const mlabel = (ym) => { if(!ym) return ""; const [y,m]=ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const mlabelFull = (ym) => { if(!ym) return ""; const [y,m]=ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };
const PALETTE = ["#7c3aed","#3b82f6","#f59e0b","#10b981","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

const TABS = [
  { id:"custo",          label:"Custo mensal"    },
  { id:"compromissos",   label:"Compromissos"    },
  { id:"evolucao",       label:"Evolução"        },
  { id:"saude",          label:"Saúde"           },
  { id:"endividamento",  label:"Endividamento"   },
  { id:"fluxo",          label:"Fluxo de caixa"  },
];

// ── Componentes ────────────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:"var(--surface)", borderRadius:16, border:"1px solid var(--border)", padding:20, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{children}</div>
    {sub&&<div style={{ fontSize:12, color:"var(--muted)", marginTop:3 }}>{sub}</div>}
  </div>
);
const KpiBox = ({ label, value, sub, color="var(--text)", icon, alert }) => (
  <div style={{ background:alert?"var(--redbg)":"var(--bg)", borderRadius:12, padding:"14px 16px",
    border:`1px solid ${alert?"var(--red)33":"var(--border)"}` }}>
    {icon&&<div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>}
    <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:800, color, letterSpacing:"-.02em" }}>{value}</div>
    {sub&&<div style={{ fontSize:11, color:"var(--muted)", marginTop:4, lineHeight:1.4 }}>{sub}</div>}
  </div>
);
const BarH = ({ label, value, total, color, sub, onClick }) => {
  const p = total>0?Math.min((value/total)*100,100):0;
  return (
    <div onClick={onClick} style={{ cursor:onClick?"pointer":"default", marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, marginBottom:5 }}>
        <span style={{ color:"var(--text)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, maxWidth:"55%" }}>{label}</span>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          {sub&&<span style={{ fontSize:11, color:"var(--muted)" }}>{sub}</span>}
          <span style={{ color, fontWeight:700 }}>{fmt(value)}</span>
          <span style={{ color:"var(--muted)", fontSize:11 }}>({p.toFixed(0)}%)</span>
        </div>
      </div>
      <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
        <div style={{ height:"100%", width:`${p}%`, background:color, borderRadius:99, transition:"width .5s" }} />
      </div>
    </div>
  );
};

// ── Fatia ativa em destaque (hover) ─────────────────────────────────────────
const renderActiveSlice = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy-8} textAnchor="middle" style={{ fontSize:13, fontWeight:800, fill:"var(--text)" }}>{payload.name}</text>
      <text x={cx} y={cy+12} textAnchor="middle" style={{ fontSize:15, fontWeight:800, fill }}>{fmt(value)}</text>
      <text x={cx} y={cy+30} textAnchor="middle" style={{ fontSize:11, fill:"var(--muted)" }}>{(percent*100).toFixed(0)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius+7} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius+9} outerRadius={outerRadius+12} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.35} />
    </g>
  );
};

// ── Donut interativo ─────────────────────────────────────────────────────────
const InteractiveDonut = ({ data, centerLabel, centerValue, height=220 }) => {
  const [activeIdx, setActiveIdx] = useState(null);
  const total = data.reduce((a,d)=>a+d.value,0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          cx="50%" cy="50%" innerRadius="62%" outerRadius="88%"
          paddingAngle={3} cornerRadius={6}
          activeIndex={activeIdx}
          activeShape={renderActiveSlice}
          onMouseEnter={(_,idx)=>setActiveIdx(idx)}
          onMouseLeave={()=>setActiveIdx(null)}
          style={{ outline:"none" }}
          animationDuration={600}
        >
          {data.map((d,i)=><Cell key={i} fill={d.color} stroke="var(--surface)" strokeWidth={2} />)}
        </Pie>
        {activeIdx===null && (
          <text x="50%" y="47%" textAnchor="middle" style={{ fontSize:11, fill:"var(--muted)", fontWeight:600 }}>{centerLabel}</text>
        )}
        {activeIdx===null && (
          <text x="50%" y="58%" textAnchor="middle" style={{ fontSize:17, fill:"var(--text)", fontWeight:800 }}>{centerValue}</text>
        )}
        <Legend verticalAlign="bottom" iconType="circle" iconSize={9}
          wrapperStyle={{ fontSize:12, paddingTop:10 }}
          formatter={(value)=>{
            const d=data.find(x=>x.name===value);
            const pct=total>0?((d.value/total)*100).toFixed(0):0;
            return <span style={{ color:"var(--text)" }}>{value} <span style={{ color:"var(--muted)" }}>({pct}%)</span></span>;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

// ── Pie de categorias — N fatias, clique filtra ─────────────────────────────
const CategoryPie = ({ data, height=260, onSliceClick, maxSlices=7 }) => {
  const [activeIdx, setActiveIdx] = useState(null);
  const sorted = [...data].sort((a,b)=>b.val-a.val);
  const top = sorted.slice(0,maxSlices);
  const rest = sorted.slice(maxSlices);
  const restSum = rest.reduce((a,d)=>a+d.val,0);
  const chartData = restSum>0 ? [...top, { cat:"Outras", val:restSum }] : top;
  const pieData = chartData.map((d,i)=>({ name:d.cat, value:d.val, color:PALETTE[i%PALETTE.length] }));
  const total = pieData.reduce((a,d)=>a+d.value,0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={pieData} dataKey="value" nameKey="name"
          cx="50%" cy="50%" innerRadius="45%" outerRadius="85%"
          paddingAngle={2} cornerRadius={5}
          activeIndex={activeIdx}
          activeShape={renderActiveSlice}
          onMouseEnter={(_,idx)=>setActiveIdx(idx)}
          onMouseLeave={()=>setActiveIdx(null)}
          onClick={(d)=>d.name!=="Outras"&&onSliceClick&&onSliceClick(d.name)}
          style={{ cursor:"pointer", outline:"none" }}
          animationDuration={600}
        >
          {pieData.map((d,i)=><Cell key={i} fill={d.color} stroke="var(--surface)" strokeWidth={2} />)}
        </Pie>
        {activeIdx===null && (
          <text x="50%" y="47%" textAnchor="middle" style={{ fontSize:11, fill:"var(--muted)", fontWeight:600 }}>Total</text>
        )}
        {activeIdx===null && (
          <text x="50%" y="58%" textAnchor="middle" style={{ fontSize:16, fill:"var(--text)", fontWeight:800 }}>{fmt(total)}</text>
        )}
      </PieChart>
    </ResponsiveContainer>
  );
};

const ScoreRing = ({ pts, color, size=100 }) => {
  const r=(size-10)/2, circ=2*Math.PI*r, dash=(pts/100)*circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition:"stroke-dasharray .8s ease" }} />
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
export default function Visao({ userId, onNavigate }) {
  const isMobile = useIsMobile();

  // ── Estado ──────────────────────────────────────────────────────────────────
  const [filterMonth,  setFilterMonth]  = useState(today());
  const [activeTab,    setActiveTab]    = useState("custo");
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [revenues,     setRevenues]     = useState([]);
  const [installments, setInstallments] = useState([]);
  const [fixedPayments,setFixedPayments]= useState([]);
  const [loanInst,     setLoanInst]     = useState([]);
  const [loans,        setLoans]        = useState([]);
  const [cards,        setCards]        = useState([]);
  const [budgets,      setBudgets]      = useState([]);

  // ── Carga ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [{data:t},{data:r},{data:i},{data:fp},{data:li},{data:l},{data:c},{data:b}] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(2000),
        supabase.from("revenues").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(2000),
        supabase.from("installments").select("*, purchases(description,category,card_id,cards(name,color))").eq("user_id",userId).order("due_date").limit(2000),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description,category,due_day)").eq("user_id",userId).order("due_date").limit(1000),
        supabase.from("loan_installments").select("*, loans(id,description,category,type,total_amount,installments,interest_rate)").eq("user_id",userId).order("due_date").limit(1000),
        supabase.from("loans").select("*").eq("user_id",userId),
        supabase.from("cards").select("*").eq("user_id",userId),
        supabase.from("budgets").select("*").eq("user_id",userId),
      ]);
      setTransactions(t||[]); setRevenues(r||[]); setInstallments(i||[]);
      setFixedPayments(fp||[]); setLoanInst(li||[]); setLoans(l||[]);
      setCards(c||[]); setBudgets(b||[]);
    } catch { setLoadError("Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  },[userId]);
  useEffect(()=>{ load(); },[load]);

  // ── Meses disponíveis ────────────────────────────────────────────────────────
  const months = useMemo(()=>{
    const s=new Set([
      ...transactions.map(t=>t.date.slice(0,7)),
      ...revenues.map(r=>r.date.slice(0,7)),
      ...fixedPayments.map(fp=>(fp.due_date||"").slice(0,7)).filter(Boolean),
      ...installments.map(i=>(i.due_date||"").slice(0,7)).filter(Boolean),
      ...loanInst.map(li=>(li.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    s.add(today());
    return [...s].filter(Boolean).sort().reverse();
  },[transactions,revenues,fixedPayments,installments,loanInst]);

  // ── Filtrados ────────────────────────────────────────────────────────────────
  const filtTx    = useMemo(()=>transactions.filter(t=>t.date.startsWith(filterMonth)),[transactions,filterMonth]);
  const filtRev   = useMemo(()=>revenues.filter(r=>r.date.startsWith(filterMonth)),[revenues,filterMonth]);
  const filtFixed = useMemo(()=>fixedPayments.filter(fp=>(fp.due_date||"").startsWith(filterMonth)),[fixedPayments,filterMonth]);
  const filtInst  = useMemo(()=>installments.filter(i=>(i.due_date||"").startsWith(filterMonth)),[installments,filterMonth]);
  const filtLoan  = useMemo(()=>loanInst.filter(li=>(li.due_date||"").startsWith(filterMonth)),[loanInst,filterMonth]);

  // ── Totais consolidados ──────────────────────────────────────────────────────
  const totals = useMemo(()=>{
    const rec    = filtRev.reduce((a,r)=>a+Number(r.amount),0)
                 + filtTx.filter(t=>t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const depTx  = filtTx.filter(t=>t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
    const depFixed=filtFixed.reduce((a,fp)=>a+Number(fp.amount),0);
    const depInst= filtInst.reduce((a,i)=>a+Number(i.amount),0);
    const depLoan= filtLoan.reduce((a,li)=>a+Number(li.amount),0);
    const dep    = depTx+depFixed+depInst+depLoan;
    const fixos  = depFixed+depInst+depLoan;
    return { rec, dep, bal:rec-dep, depTx, depFixed, depInst, depLoan, fixos,
      txRate:rec>0?(dep/rec)*100:0, fixosRate:rec>0?(fixos/rec)*100:0,
      savings:Math.max(rec-dep,0), savingsRate:rec>0?((rec-dep)/rec)*100:0 };
  },[filtTx,filtRev,filtFixed,filtInst,filtLoan]);

  // ── Por cartão ───────────────────────────────────────────────────────────────
  const byCard = useMemo(()=>
    cards.map(card=>({
      id:card.id, name:card.name, color:card.color,
      parcelas:filtInst.filter(i=>i.purchases?.card_id===card.id).reduce((a,i)=>a+Number(i.amount),0),
      avulsos:filtTx.filter(t=>t.type==="despesa"&&t.card_id===card.id).reduce((a,t)=>a+Number(t.value),0),
    })).map(c=>({...c,total:c.parcelas+c.avulsos})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total),
  [cards,filtInst,filtTx]);

  // ── Por categoria ────────────────────────────────────────────────────────────
  const byCat = useMemo(()=>{
    const map={};
    filtTx.filter(t=>t.type==="despesa").forEach(t=>{ map[t.cat]=(map[t.cat]||0)+Number(t.value); });
    filtFixed.forEach(fp=>{ const c=fp.fixed_expenses?.category||"Fixas"; map[c]=(map[c]||0)+Number(fp.amount); });
    filtInst.forEach(i=>{ const c=i.purchases?.category||"Compras"; map[c]=(map[c]||0)+Number(i.amount); });
    filtLoan.forEach(li=>{ const c=li.loans?.category||"Empréstimo"; map[c]=(map[c]||0)+Number(li.amount); });
    return Object.entries(map).map(([cat,val])=>({cat,val})).sort((a,b)=>b.val-a.val);
  },[filtTx,filtFixed,filtInst,filtLoan]);

  // ── Dívida total pendente ────────────────────────────────────────────────────
  const totalDebt = useMemo(()=>{
    const instPending  = installments.filter(i=>!i.paid).reduce((a,i)=>a+Number(i.amount),0);
    const loanPending  = loanInst.filter(li=>!li.paid).reduce((a,li)=>a+Number(li.amount),0);
    const fixedPending = fixedPayments.filter(fp=>!fp.paid).reduce((a,fp)=>a+Number(fp.amount),0);
    return { instPending, loanPending, fixedPending, total:instPending+loanPending+fixedPending };
  },[installments,loanInst,fixedPayments]);

  // ── Análise por empréstimo ───────────────────────────────────────────────────
  const loanAnalysis = useMemo(()=>
    loans.map(loan=>{
      const parcelas = loanInst.filter(li=>li.loan_id===loan.id);
      const pagas    = parcelas.filter(li=>li.paid);
      const pendentes= parcelas.filter(li=>!li.paid);
      const totalPago = pagas.reduce((a,li)=>a+Number(li.amount),0);
      const totalPend = pendentes.reduce((a,li)=>a+Number(li.amount),0);
      const totalOrig = Number(loan.total_amount)||0;
      const nTotal    = Number(loan.installments)||parcelas.length;
      const nPagas    = pagas.length;
      const proxParcela = pendentes.sort((a,b)=>(a.due_date||"").localeCompare(b.due_date||""))[0];
      const pctPago   = nTotal>0?(nPagas/nTotal)*100:0;
      const capital   = totalOrig*(nPagas/Math.max(nTotal,1));
      const juros     = Math.max(totalPago-capital,0);
      const custo_mensal = proxParcela?Number(proxParcela.amount):0;
      const mesesRestantes = pendentes.length;
      return {
        ...loan, parcelas, pagas, pendentes, totalPago, totalPend,
        nTotal, nPagas, proxParcela, pctPago, capital, juros,
        custo_mensal, mesesRestantes,
        pctRenda: totals.rec>0?(custo_mensal/totals.rec)*100:0,
      };
    }).sort((a,b)=>b.totalPend-a.totalPend),
  [loans,loanInst,totals.rec]);

  // ── Evolução 12 meses ────────────────────────────────────────────────────────
  const evolution = useMemo(()=>{
    // Filtra até o mês atual — evita que parcelas futuras de financiamentos
    // longos (ex: 120x) façam o gráfico pular para datas anos à frente.
    const nowYm = today();
    const allM=new Set([
      ...transactions.map(t=>t.date.slice(0,7)),
      ...revenues.map(r=>r.date.slice(0,7)),
      ...fixedPayments.map(fp=>(fp.due_date||"").slice(0,7)).filter(Boolean),
      ...installments.map(i=>(i.due_date||"").slice(0,7)).filter(Boolean),
      ...loanInst.map(li=>(li.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    let balAcum=0;
    return [...allM].filter(ym=>ym<=nowYm).sort().slice(-12).map(ym=>{
      const rec=revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
               +transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const depTx=transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
      const depFixed=fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0);
      const depInst=installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      const depLoan=loanInst.filter(li=>(li.due_date||"").startsWith(ym)).reduce((a,li)=>a+Number(li.amount),0);
      const dep=depTx+depFixed+depInst+depLoan;
      const bal=rec-dep;
      balAcum+=bal;
      const savings=rec>0?Math.max(((rec-dep)/rec)*100,0):0;
      return { ym, label:mlabel(ym), rec, dep, depTx, depFixed, depInst, depLoan, bal, balAcum, savings };
    });
  },[transactions,revenues,fixedPayments,installments,loanInst]);

  // ── Fluxo de caixa projetado (6 meses à frente) ──────────────────────────────
  const cashflow = useMemo(()=>{
    const [y,m]=filterMonth.split("-").map(Number);
    const avgRec = evolution.length>0 ? evolution.reduce((a,e)=>a+e.rec,0)/evolution.length : totals.rec;
    const avgAvulso = evolution.length>0 ? evolution.reduce((a,e)=>a+e.depTx,0)/evolution.length : totals.depTx;

    return Array.from({length:6},(_,offset)=>{
      const d=new Date(y,m-1+offset,1);
      const ym2=d.toISOString().slice(0,7);
      const fixed=fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym2)).reduce((a,fp)=>a+Number(fp.amount),0);
      const inst=installments.filter(i=>(i.due_date||"").startsWith(ym2)).reduce((a,i)=>a+Number(i.amount),0);
      const loan=loanInst.filter(li=>(li.due_date||"").startsWith(ym2)).reduce((a,li)=>a+Number(li.amount),0);
      const fixosProj=fixed+inst+loan;
      const depProj=avgAvulso+fixosProj;
      const recProj=avgRec;
      const balProj=recProj-depProj;
      return { ym:ym2, label:mlabel(ym2), recProj, depProj, fixosProj, avulsoProj:avgAvulso, balProj, isCurrentOrPast:ym2<=filterMonth };
    });
  },[filterMonth,evolution,fixedPayments,installments,loanInst,totals]);

  // ── Score financeiro (4 fatores) ─────────────────────────────────────────────
  const score = useMemo(()=>{
    if (totals.rec<=0) return null;
    const spendRate=totals.dep/totals.rec;
    const debtLoad=totalDebt.total/Math.max(totals.rec,1);
    const savings=Math.max(1-spendRate,0);
    const totalBudget=budgets.filter(b=>b.month===filterMonth).reduce((a,b)=>a+Number(b.amount),0);
    const budgetAdh=totalBudget>0?Math.max(1-totals.dep/totalBudget,0):0.5;

    const factors={
      gasto:   { pts:Math.round(Math.max(1-spendRate,0)*30),  max:30, label:"Taxa de gasto",    pct:spendRate*100 },
      divida:  { pts:Math.round(Math.max(1-debtLoad/0.5,0)*30),max:30, label:"Carga de dívida", pct:Math.min(debtLoad/24*100,100) },
      poupanca:{ pts:Math.round(Math.min(savings/0.2,1)*25),   max:25, label:"Poupança",         pct:savings*100 },
      orcamento:{ pts:Math.round(budgetAdh*15),                 max:15, label:"Aderência orç.",  pct:budgetAdh*100 },
    };
    const total=Object.values(factors).reduce((a,f)=>a+f.pts,0);
    const color=total>=75?"var(--green)":total>=50?"#f59e0b":"var(--red)";
    const label=total>=75?"Saudável":total>=50?"Atenção":"Crítico";
    return { pts:total, color, label, factors, spendRate, debtLoad };
  },[totals,totalDebt,budgets,filterMonth]);

  // ── Próximos 3 meses para compromissos ───────────────────────────────────────
  const futureCommitments = useMemo(()=>{
    const [y,m]=filterMonth.split("-").map(Number);
    return [1,2,3].map(offset=>{
      const d=new Date(y,m-1+offset,1);
      const ym2=d.toISOString().slice(0,7);
      const fixed=fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym2)).reduce((a,fp)=>a+Number(fp.amount),0);
      const inst=installments.filter(i=>(i.due_date||"").startsWith(ym2)).reduce((a,i)=>a+Number(i.amount),0);
      const loan=loanInst.filter(li=>(li.due_date||"").startsWith(ym2)).reduce((a,li)=>a+Number(li.amount),0);
      return { ym:ym2, label:mlabel(ym2), fixed, inst, loan, total:fixed+inst+loan };
    });
  },[filterMonth,fixedPayments,installments,loanInst]);

  if (loading) return <LoadingSpinner message="Carregando visão financeira..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={load} />;

  return (
    <div>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <h1 style={{ fontWeight:800, fontSize:24, color:"var(--text)", letterSpacing:"-.03em" }}>Visão Financeira</h1>
            <p style={{ color:"var(--muted)", fontSize:14, marginTop:3 }}>Tudo consolidado num lugar só</p>
          </div>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{
            padding:"8px 12px", borderRadius:10, border:"1.5px solid var(--border)",
            background:"var(--bg)", color:"var(--text)", fontSize:13, fontWeight:600, cursor:"pointer", outline:"none",
          }}>
            {months.map(m=><option key={m} value={m}>{mlabelFull(m)}</option>)}
          </select>
        </div>
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, var(--accent) 0%, var(--accent2,#5b21b6) 100%)",
        borderRadius:20, padding:isMobile?"20px":"24px 28px",
        color:"#fff", marginBottom:16, position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-30, right:-30, width:140, height:140, borderRadius:"50%", background:"rgba(255,255,255,.07)" }} />
        <div style={{ position:"relative" }}>
          <div style={{ fontSize:11, fontWeight:700, opacity:.75, textTransform:"uppercase", letterSpacing:".08em", marginBottom:6 }}>
            Saldo de {mlabelFull(filterMonth)}
          </div>
          <div style={{ fontSize:isMobile?34:44, fontWeight:800, letterSpacing:"-.03em", lineHeight:1, marginBottom:16 }}>
            {fmt(totals.bal)}
          </div>
          <div style={{ display:"flex", gap:isMobile?14:28, flexWrap:"wrap" }}>
            {[
              { l:"Receitas",      v:fmt(totals.rec) },
              { l:"Despesas",      v:fmt(totals.dep), color:totals.dep>totals.rec?"#fca5a5":"rgba(255,255,255,.9)" },
              { l:"% renda gasta", v:totals.rec>0?`${totals.txRate.toFixed(0)}%`:"—", color:totals.txRate>90?"#fca5a5":totals.txRate>70?"#fde68a":"rgba(255,255,255,.9)" },
              { l:"Taxa poupança", v:totals.rec>0?`${totals.savingsRate.toFixed(0)}%`:"—", color:totals.rec<=0?"rgba(255,255,255,.9)":totals.savingsRate>=20?"#86efac":totals.savingsRate>=10?"#fde68a":"#fca5a5" },
              { l:"Score",         v:score?`${score.pts}/100`:"—", color:score?.color.includes("green")?"#86efac":score?.color.includes("red")?"#fca5a5":"#fde68a" },
            ].map(({l,v,color})=>(
              <div key={l}>
                <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:2 }}>{l}</div>
                <div style={{ fontSize:isMobile?14:17, fontWeight:700, color:color||"rgba(255,255,255,.9)" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ABAS ───────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
        {TABS.map(tab=>(
          <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
            padding:"8px 16px", borderRadius:10, border:"none",
            background:activeTab===tab.id?"var(--accent)":"var(--surface)",
            color:activeTab===tab.id?"#fff":"var(--muted)",
            fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
            boxShadow:activeTab===tab.id?"var(--shadow-sm)":"none",
            border:activeTab===tab.id?"none":"1px solid var(--border)",
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ══════════ ABA: CUSTO MENSAL ══════════ */}
      {activeTab==="custo"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Composição — donut interativo */}
          <Card>
            <SectionTitle sub="Avulsos vs compromissos fixos, com destaque ao passar o mouse">Composição do mês</SectionTitle>
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:16, alignItems:"center" }}>
              <InteractiveDonut
                data={[
                  { name:"Avulsos", value:totals.depTx, color:"var(--accent)" },
                  { name:"Fixos",   value:totals.fixos, color:"#f59e0b" },
                ]}
                centerLabel="Total"
                centerValue={fmt(totals.dep)}
                height={220}
              />
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>💸 Avulsos — gastos do dia a dia</div>
                  <div style={{ fontSize:20, fontWeight:800, color:"var(--accent)", marginTop:2 }}>{fmt(totals.depTx)}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{totals.dep>0?`${((totals.depTx/totals.dep)*100).toFixed(0)}% das despesas`:"—"}</div>
                </div>
                <div>
                  <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>📌 Fixos — fixas + parcelas + empréstimos</div>
                  <div style={{ fontSize:20, fontWeight:800, color:"#f59e0b", marginTop:2 }}>{fmt(totals.fixos)}</div>
                  <div style={{ fontSize:11, color:totals.fixosRate>50?"var(--red)":"var(--muted)" }}>
                    {totals.rec>0?`${totals.fixosRate.toFixed(0)}% da renda`:totals.dep>0?`${((totals.fixos/totals.dep)*100).toFixed(0)}% das despesas`:"—"}
                    {totals.fixosRate>50&&" ⚠ Acima do recomendado"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Detalhe dos fixos */}
          {totals.fixos>0&&(
            <Card>
              <SectionTitle sub="O que compõe seus compromissos fixos este mês">Detalhe dos fixos</SectionTitle>
              {[
                { label:"Despesas fixas",     val:totals.depFixed, color:"#f59e0b", icon:"📌" },
                { label:"Parcelas de cartão", val:totals.depInst,  color:"#3b82f6", icon:"💳" },
                { label:"Empréstimos",        val:totals.depLoan,  color:"#7c3aed", icon:"🏦" },
              ].filter(i=>i.val>0).map(item=>(
                <BarH key={item.label} label={`${item.icon} ${item.label}`} value={item.val} total={totals.fixos} color={item.color} />
              ))}
              <div style={{ marginTop:12, padding:"10px 14px", borderRadius:9, background:"var(--bg)", border:"1px solid var(--border)", fontSize:12, color:"var(--muted)", lineHeight:1.6 }}>
                💡 Regra saudável: fixos abaixo de 50% da renda. Você está em {totals.rec>0?`${totals.fixosRate.toFixed(0)}%`:"—"}.
                {totals.rec<=0
                  ? " Sem receita lançada neste mês para avaliar essa proporção."
                  : totals.fixosRate>50?" Considere revisar as despesas fixas.":" Boa margem de manobra!"}
              </div>
            </Card>
          )}

          {/* Por cartão */}
          {byCard.length>0&&(
            <Card>
              <SectionTitle sub="Parcelas + avulsos por cartão neste mês">Por cartão</SectionTitle>
              {byCard.map(card=>(
                <BarH key={card.id} label={card.name} value={card.total} total={totals.dep} color={card.color||"var(--accent)"}
                  sub={card.avulsos>0&&card.parcelas>0?`Parc. ${fmt(card.parcelas)} + Avuls. ${fmt(card.avulsos)}`:null} />
              ))}
            </Card>
          )}

          {/* Empréstimos ativos no mês */}
          {filtLoan.length>0&&(
            <Card>
              <SectionTitle sub="Cada empréstimo e financiamento contribuindo para o fixo do mês">Empréstimos e financiamentos</SectionTitle>
              {loans.filter(l=>filtLoan.some(li=>li.loan_id===l.id)).map(loan=>{
                const val=filtLoan.filter(li=>li.loan_id===loan.id).reduce((a,li)=>a+Number(li.amount),0);
                const la=loanAnalysis.find(l2=>l2.id===loan.id);
                const instNum=filtLoan.find(li=>li.loan_id===loan.id)?.installment_number;
                return (
                  <BarH key={loan.id} label={loan.description} value={val} total={totals.depLoan||val} color="#7c3aed"
                    sub={instNum&&loan.installments?`Parcela ${instNum}/${loan.installments} · ${loan.type==="financiamento"?"Financiamento":"Empréstimo"}`:null} />
                );
              })}
            </Card>
          )}

          {/* Por categoria */}
          {byCat.length>0&&(
            <Card>
              <SectionTitle sub="Todos os gastos agrupados por categoria — avulsos + fixos juntos">Por categoria</SectionTitle>
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1.1fr", gap:16, alignItems:"center" }}>
                <CategoryPie data={byCat} height={260} />
                <div>
                  {byCat.map((item,idx)=>(
                    <BarH key={item.cat} label={item.cat} value={item.val} total={totals.dep} color={PALETTE[idx%PALETTE.length]} />
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ ABA: COMPROMISSOS ══════════ */}
      {activeTab==="compromissos"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Dívida total consolidada */}
          <Card>
            <SectionTitle sub="Tudo que ainda está pendente de pagamento — parcelas, fixas e empréstimos">Compromisso total pendente</SectionTitle>
            <div style={{ padding:"16px", borderRadius:12, background:"var(--redbg)", border:"1px solid var(--red)22", marginBottom:16 }}>
              <div style={{ fontSize:12, color:"var(--muted)", marginBottom:4 }}>Total pendente (todas as fontes)</div>
              <div style={{ fontSize:30, fontWeight:800, color:"var(--red)" }}>{fmt(totalDebt.total)}</div>
              {totals.rec>0&&(
                <div style={{ fontSize:12, color:"var(--muted)", marginTop:6 }}>
                  Equivale a {(totalDebt.total/totals.rec).toFixed(1)} meses da sua renda atual de {fmt(totals.rec)}/mês
                </div>
              )}
            </div>
            {[
              { label:"Parcelas de cartão", value:totalDebt.instPending,  color:"#3b82f6" },
              { label:"Empréstimos",        value:totalDebt.loanPending,  color:"#7c3aed" },
              { label:"Despesas fixas",     value:totalDebt.fixedPending, color:"#f59e0b" },
            ].filter(i=>i.value>0).map(item=>(
              <BarH key={item.label} label={item.label} value={item.value} total={totalDebt.total} color={item.color} />
            ))}
          </Card>

          {/* Próximos 3 meses */}
          <Card>
            <SectionTitle sub="Compromisso fixo já mapeado para os próximos 3 meses">Próximos meses</SectionTitle>
            {futureCommitments.map((fc,idx)=>(
              <div key={fc.ym} style={{ marginBottom:idx<2?20:0, paddingBottom:idx<2?20:0, borderBottom:idx<2?"1px solid var(--border)":"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", textTransform:"capitalize" }}>{fc.label}</div>
                  <div style={{ fontWeight:800, fontSize:15, color:fc.total>totals.rec?"var(--red)":"var(--text)" }}>{fmt(fc.total)}</div>
                </div>
                {[
                  { label:"Despesas fixas",     value:fc.fixed, color:"#f59e0b" },
                  { label:"Parcelas de cartão", value:fc.inst,  color:"#3b82f6" },
                  { label:"Empréstimos",        value:fc.loan,  color:"#7c3aed" },
                ].filter(s=>s.value>0).map(s=>(
                  <BarH key={s.label} label={s.label} value={s.value} total={fc.total} color={s.color} />
                ))}
                {fc.total===0&&<div style={{ fontSize:12, color:"var(--muted)", textAlign:"center", padding:"8px 0" }}>Sem compromissos fixos registrados</div>}
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ══════════ ABA: EVOLUÇÃO ══════════ */}
      {activeTab==="evolucao"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {evolution.length<2
            ? <Card><div style={{ textAlign:"center", color:"var(--muted)", padding:"32px 0" }}>Dados insuficientes. Registre mais meses.</div></Card>
            : (
              <>
                {/* Receitas vs Despesas */}
                <Card>
                  <SectionTitle sub="Receitas e despesas totais (todas as fontes) — últimos 12 meses">Evolução mensal</SectionTitle>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={evolution} margin={{ left:-8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="rec" name="Receitas" fill="var(--green)" radius={[3,3,0,0]} opacity={.85} />
                      <Bar dataKey="dep" name="Despesas" fill="var(--red)"   radius={[3,3,0,0]} opacity={.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Saldo + acumulado */}
                <Card>
                  <SectionTitle sub="Saldo mensal e acumulado">Tendência de saldo</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={evolution} margin={{ left:-8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                      <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                      <Line type="monotone" dataKey="bal" name="Saldo mensal" stroke="var(--accent)" strokeWidth={2} dot={{ r:4 }} />
                      <Line type="monotone" dataKey="balAcum" name="Acumulado" stroke="var(--green)" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {/* Breakdown empilhado */}
                <Card>
                  <SectionTitle sub="Composição das despesas por tipo — empilhado">Despesas por tipo</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={evolution} margin={{ left:-8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="depTx"    name="Avulsos"    stackId="a" fill={PALETTE[0]} />
                      <Bar dataKey="depFixed" name="Fixas"      stackId="a" fill={PALETTE[2]} />
                      <Bar dataKey="depInst"  name="Parcelas"   stackId="a" fill={PALETTE[1]} />
                      <Bar dataKey="depLoan"  name="Empréstimos" stackId="a" fill={PALETTE[6]} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Taxa de poupança */}
                <Card>
                  <SectionTitle sub="% da renda que sobrou em cada mês">Taxa de poupança mensal</SectionTitle>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={evolution} margin={{ left:-8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}%`} width={36} />
                      <Tooltip formatter={v=>`${Number(v).toFixed(1)}%`} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <ReferenceLine y={20} stroke="var(--green)" strokeDasharray="4 2" label={{ value:"Meta 20%", fill:"var(--green)", fontSize:10, position:"insideTopLeft" }} />
                      <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="savings" name="Taxa poupança" stroke="var(--accent)" fill="var(--accentbg)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Tabela resumo */}
                <Card style={{ padding:0, overflow:"hidden" }}>
                  <div style={{ padding:"12px 18px", fontWeight:700, fontSize:14, color:"var(--text)", borderBottom:"1px solid var(--border)" }}>Tabela de evolução</div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"var(--bg)" }}>
                          {["Mês","Receitas","Despesas","Saldo","Poupança %"].map(h=>(
                            <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {evolution.slice().reverse().map((e,i)=>(
                          <tr key={e.ym} style={{ borderTop:"1px solid var(--border)", background:e.ym===filterMonth?"var(--accentbg)":"transparent" }}>
                            <td style={{ padding:"9px 12px", fontSize:13, fontWeight:e.ym===filterMonth?700:400, color:"var(--text)" }}>{e.label}</td>
                            <td style={{ padding:"9px 12px", fontSize:13, color:"var(--green)", fontWeight:600 }}>{fmtK(e.rec)}</td>
                            <td style={{ padding:"9px 12px", fontSize:13, color:"var(--red)", fontWeight:600 }}>{fmtK(e.dep)}</td>
                            <td style={{ padding:"9px 12px", fontSize:13, color:e.bal>=0?"var(--green)":"var(--red)", fontWeight:700 }}>{fmtK(e.bal)}</td>
                            <td style={{ padding:"9px 12px", fontSize:13, color:e.savings>=20?"var(--green)":e.savings>=10?"#f59e0b":"var(--red)", fontWeight:600 }}>{e.savings.toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )
          }
        </div>
      )}

      {/* ══════════ ABA: SAÚDE ══════════ */}
      {activeTab==="saude"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!score
            ? <Card style={{ textAlign:"center", padding:"40px 20px" }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
                <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", marginBottom:8 }}>Sem dados suficientes</div>
                <p style={{ fontSize:13, color:"var(--muted)" }}>Registre receitas e despesas para calcular o score.</p>
              </Card>
            : (
              <>
                {/* Score ring */}
                <Card>
                  <div style={{ display:"flex", gap:20, alignItems:"center", marginBottom:20 }}>
                    <div style={{ position:"relative", flexShrink:0 }}>
                      <ScoreRing pts={score.pts} color={score.color} size={100} />
                      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ fontSize:22, fontWeight:800, color:score.color }}>{score.pts}</div>
                        <div style={{ fontSize:10, color:"var(--muted)" }}>/ 100</div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize:24, fontWeight:800, color:score.color, marginBottom:4 }}>{score.label}</div>
                      <div style={{ fontSize:13, color:"var(--muted)", lineHeight:1.7 }}>
                        Você gasta <strong style={{ color:"var(--text)" }}>{score.spendRate>=1?"100+":fmtPct(score.spendRate*100)}</strong> da sua renda<br/>
                        Dívida equivale a <strong style={{ color:"var(--text)" }}>{score.debtLoad.toFixed(1)}x</strong> a renda mensal
                      </div>
                    </div>
                  </div>

                  {/* Os 4 fatores — radar + barras de detalhe */}
                  <SectionTitle sub="Visão geral dos 4 pilares que compõem o score">Fatores do score</SectionTitle>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={Object.values(score.factors).map(f=>({ label:f.label, pct:Math.round((f.pts/f.max)*100) }))}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="label" tick={{ fontSize:11, fill:"var(--muted)" }} />
                      <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
                      <Radar dataKey="pct" stroke={score.color} fill={score.color} fillOpacity={0.35} strokeWidth={2} />
                      <Tooltip formatter={v=>`${v}%`} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                  {Object.values(score.factors).map(f=>(
                    <div key={f.label} style={{ background:"var(--bg)", borderRadius:10, padding:"12px 14px", marginBottom:10, border:"1px solid var(--border)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{f.label}</span>
                        <span style={{ fontSize:13, fontWeight:800, color:f.pts>=f.max*0.7?"var(--green)":f.pts>=f.max*0.4?"#f59e0b":"var(--red)" }}>
                          {f.pts}/{f.max} pts
                        </span>
                      </div>
                      <div style={{ height:6, background:"var(--border)", borderRadius:99 }}>
                        <div style={{ height:"100%", width:`${(f.pts/f.max)*100}%`, background:f.pts>=f.max*0.7?"var(--green)":f.pts>=f.max*0.4?"#f59e0b":"var(--red)", borderRadius:99, transition:"width .6s" }} />
                      </div>
                    </div>
                  ))}
                </Card>

                {/* Indicadores detalhados */}
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12 }}>
                  {[
                    { label:"Taxa de gasto", value:`${score.spendRate>=1?"100+":fmtPct(score.spendRate*100)}`, ideal:"<70%",
                      ok:score.spendRate<0.7, bar:Math.min(score.spendRate*100,100),
                      desc:score.spendRate<=0.5?"Excelente — você guarda mais da metade":score.spendRate<=0.7?"Bom — dentro da margem":score.spendRate<=0.9?"Atenção — pouca margem":"Crítico — despesas maiores que receitas" },
                    { label:"Carga de dívida", value:`${score.debtLoad.toFixed(1)}× renda`, ideal:"<3×",
                      ok:score.debtLoad<3, bar:Math.min((score.debtLoad/12)*100,100),
                      desc:score.debtLoad<=3?"Nível saudável":score.debtLoad<=6?"Aceitável — monitore":score.debtLoad<=12?"Elevado — priorize quitar":"Muito alto — considere renegociar" },
                    { label:"Taxa de poupança", value:fmtPct(totals.savingsRate), ideal:">20%",
                      ok:totals.savingsRate>=20, bar:Math.min(totals.savingsRate,100),
                      desc:totals.savingsRate>=20?"Excelente":totals.savingsRate>=10?"Razoável":"Abaixo do ideal — tente poupar mais" },
                    { label:"Fixos / renda", value:fmtPct(totals.fixosRate), ideal:"<50%",
                      ok:totals.fixosRate<50, bar:Math.min(totals.fixosRate,100),
                      desc:totals.fixosRate<30?"Ótimo — baixa obrigação fixa":totals.fixosRate<50?"Aceitável":totals.fixosRate<70?"Elevado — pouca flexibilidade":"Crítico — comprometimento excessivo" },
                  ].map(ind=>(
                    <Card key={ind.label}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{ind.label}</div>
                        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                          <span style={{ fontSize:11, color:"var(--muted)" }}>ideal {ind.ideal}</span>
                          <span style={{ fontSize:14, fontWeight:800, color:ind.ok?"var(--green)":"var(--red)" }}>{ind.value}</span>
                        </div>
                      </div>
                      <div style={{ height:7, background:"var(--border)", borderRadius:99, marginBottom:8 }}>
                        <div style={{ height:"100%", width:`${ind.bar}%`, background:ind.ok?"var(--green)":"var(--red)", borderRadius:99, transition:"width .6s" }} />
                      </div>
                      <div style={{ fontSize:12, color:"var(--muted)" }}>{ind.desc}</div>
                    </Card>
                  ))}
                </div>

                {/* Regra 50-30-20 */}
                <Card>
                  <SectionTitle sub="Como distribuir sua renda de forma saudável">Regra 50-30-20</SectionTitle>
                  {[
                    { label:"Necessidades (50%)", ideal:totals.rec*0.5, real:totals.fixos, color:"#3b82f6" },
                    { label:"Desejos (30%)",      ideal:totals.rec*0.3, real:totals.depTx, color:"var(--accent)" },
                    { label:"Poupança (20%)",     ideal:totals.rec*0.2, real:Math.max(totals.savings,0), color:"var(--green)" },
                  ].map(item=>{
                    const status=item.real<=item.ideal?"✅":"⚠️";
                    return (
                      <div key={item.label} style={{ marginBottom:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5 }}>
                          <span style={{ color:"var(--text)", fontWeight:600 }}>{status} {item.label}</span>
                          <span style={{ color:"var(--muted)", fontSize:12 }}>{fmt(item.real)} / {fmt(item.ideal)}</span>
                        </div>
                        <div style={{ height:10, background:"var(--border)", borderRadius:99, position:"relative", overflow:"hidden" }}>
                          {/* Ideal */}
                          <div style={{ position:"absolute", height:"100%", width:`${Math.min((item.ideal/Math.max(totals.rec,1))*100,100)}%`, background:`${item.color}33`, borderRadius:99 }} />
                          {/* Real */}
                          <div style={{ position:"absolute", height:"100%", width:`${Math.min((item.real/Math.max(totals.rec,1))*100,100)}%`, background:item.color, borderRadius:99 }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:4, lineHeight:1.6 }}>
                    Baseado na sua renda de <strong style={{ color:"var(--text)" }}>{fmt(totals.rec)}</strong> neste mês.
                  </div>
                </Card>

                {/* Histórico do score (últimos 6 meses) */}
                {evolution.length>=3&&(
                  <Card>
                    <SectionTitle sub="Como a taxa de gasto variou nos últimos meses">Histórico de saúde</SectionTitle>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={evolution.map(e=>({ ...e, txRate:e.rec>0?(e.dep/e.rec)*100:0 }))} margin={{ left:-8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}%`} width={36} />
                        <Tooltip formatter={v=>`${Number(v).toFixed(1)}%`} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                        <ReferenceLine y={100} stroke="var(--red)" strokeDasharray="4 2" label={{ value:"100%", fill:"var(--red)", fontSize:10 }} />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 2" label={{ value:"70%", fill:"#f59e0b", fontSize:10 }} />
                        <Line type="monotone" dataKey="txRate" name="% renda gasta" stroke="var(--accent)" strokeWidth={2} dot={{ r:4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </>
            )
          }
        </div>
      )}

      {/* ══════════ ABA: ENDIVIDAMENTO ══════════ */}
      {activeTab==="endividamento"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* KPIs */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <KpiBox icon="💳" label="Parcelas pendentes" value={fmt(totalDebt.instPending)} color="#3b82f6" sub={`${installments.filter(i=>!i.paid).length} parcelas`} />
            <KpiBox icon="🏦" label="Empréstimos pendentes" value={fmt(totalDebt.loanPending)} color="#7c3aed" sub={`${loanInst.filter(li=>!li.paid).length} parcelas`} />
            <KpiBox icon="📌" label="Fixas pendentes" value={fmt(totalDebt.fixedPending)} color="#f59e0b" sub={`${fixedPayments.filter(fp=>!fp.paid).length} itens`} />
            <KpiBox icon="⚠" label="Total em aberto" value={fmt(totalDebt.total)} color="var(--red)"
              alert={totals.rec>0&&totalDebt.total>totals.rec*6}
              sub={totals.rec>0?`${(totalDebt.total/totals.rec).toFixed(1)} meses de renda`:"—"} />
          </div>

          {/* Análise por empréstimo */}
          {loanAnalysis.length>0&&(
            <Card>
              <SectionTitle sub="Situação detalhada de cada empréstimo e financiamento">Empréstimos e financiamentos</SectionTitle>
              {loanAnalysis.map((l,idx)=>(
                <div key={l.id} style={{ marginBottom:idx<loanAnalysis.length-1?20:0, paddingBottom:idx<loanAnalysis.length-1?20:0, borderBottom:idx<loanAnalysis.length-1?"1px solid var(--border)":"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{l.description}</div>
                      <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                        {l.type==="financiamento"?"Financiamento":"Empréstimo"} · {l.nPagas}/{l.nTotal} pagas{l.interest_rate?` · ${l.interest_rate}% a.m.`:""}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:16, fontWeight:800, color:"var(--red)" }}>{fmt(l.totalPend)}</div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>pendente</div>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--muted)", marginBottom:4 }}>
                      <span>{l.pctPago.toFixed(0)}% pago</span>
                      <span>{l.mesesRestantes} parcela{l.mesesRestantes!==1?"s":""} restante{l.mesesRestantes!==1?"s":""}</span>
                    </div>
                    <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
                      <div style={{ height:"100%", width:`${l.pctPago}%`, background:"var(--green)", borderRadius:99, transition:"width .6s" }} />
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                    {[
                      { label:"Total original", value:fmt(l.total_amount) },
                      { label:"Total pago",     value:fmt(l.totalPago) },
                      { label:"Juros estimado", value:fmt(l.juros) },
                      { label:"Custo mensal",   value:fmt(l.custo_mensal) },
                      { label:"% da renda",     value:totals.rec>0?`${l.pctRenda.toFixed(1)}%`:"—" },
                      { label:"Próx. parcela",  value:l.proxParcela?l.proxParcela.due_date:"—" },
                    ].map(item=>(
                      <div key={item.label} style={{ background:"var(--bg)", borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:".04em", marginBottom:3 }}>{item.label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Ranking: qual quitar primeiro */}
          {loanAnalysis.filter(l=>l.totalPend>0).length>1&&(
            <Card>
              <SectionTitle sub="Estratégia: quite primeiro quem custa mais em relação ao saldo devedor">Prioridade para quitar</SectionTitle>
              {loanAnalysis.filter(l=>l.totalPend>0).sort((a,b)=>{
                const pctA=a.totalPend>0?(a.custo_mensal/a.totalPend)*100:0;
                const pctB=b.totalPend>0?(b.custo_mensal/b.totalPend)*100:0;
                return pctB-pctA;
              }).map((l,idx)=>(
                <div key={l.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:idx<loanAnalysis.length-1?"1px solid var(--border)":"none" }}>
                  <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:idx===0?"var(--red)":idx===1?"#f59e0b":"var(--bg)", color:idx<2?"#fff":"var(--muted)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800 }}>{idx+1}º</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{l.description}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                      {l.mesesRestantes} meses · {totals.rec>0?`${l.pctRenda.toFixed(1)}% da renda`:""} · Restam {fmt(l.totalPend)}
                    </div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:"var(--red)", flexShrink:0 }}>{fmt(l.custo_mensal)}/mês</div>
                </div>
              ))}
              <div style={{ marginTop:12, padding:"10px 14px", borderRadius:9, background:"var(--accentbg)", fontSize:12, color:"var(--muted)", lineHeight:1.6 }}>
                💡 Quite primeiro quem tem maior custo mensal relativo ao saldo devedor (método avalanche) — você paga menos juros no total.
              </div>
            </Card>
          )}

          {totalDebt.total===0&&(
            <Card style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🎉</div>
              <div style={{ fontWeight:700, fontSize:16, color:"var(--green)", marginBottom:6 }}>Sem dívidas pendentes!</div>
              <p style={{ fontSize:13, color:"var(--muted)" }}>Todas as parcelas, fixas e empréstimos estão quitados.</p>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ ABA: FLUXO DE CAIXA ══════════ */}
      {activeTab==="fluxo"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Alertas */}
          {cashflow.some(c=>c.balProj<0)&&(
            <div style={{ background:"var(--redbg)", border:"1px solid var(--red)33", borderRadius:12, padding:"12px 16px", display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <div style={{ fontSize:13, color:"var(--text)" }}>
                <strong>Atenção:</strong> Projeção indica saldo negativo em{" "}
                {cashflow.filter(c=>c.balProj<0).map(c=>c.label).join(", ")}.
                Revise suas despesas fixas ou aumente a receita.
              </div>
            </div>
          )}

          {/* Gráfico de projeção */}
          <Card>
            <SectionTitle sub="Receita projetada vs despesas comprometidas — próximos 6 meses">Fluxo de caixa projetado</SectionTitle>
            <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14, padding:"8px 12px", background:"var(--bg)", borderRadius:8 }}>
              📌 Receita = média dos últimos meses. Despesas = fixas já cadastradas + média dos avulsos. Barras sólidas = já ocorrido, tracejado = projeção.
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cashflow} margin={{ left:-8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey="recProj" name="Receita proj." fill="var(--green)" radius={[3,3,0,0]} opacity={.75} />
                <Bar dataKey="depProj" name="Despesa proj." fill="var(--red)"   radius={[3,3,0,0]} opacity={.75} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Saldo projetado */}
          <Card>
            <SectionTitle sub="Saldo esperado ao fim de cada mês">Saldo projetado</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={cashflow} margin={{ left:-8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 2" label={{ value:"0", fill:"var(--red)", fontSize:10 }} />
                <Line type="monotone" dataKey="balProj" name="Saldo projetado" stroke="var(--accent)" strokeWidth={2.5} dot={(p)=>(
                  <circle cx={p.cx} cy={p.cy} r={5} fill={p.value<0?"var(--red)":"var(--accent)"} />
                )} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Tabela de projeção */}
          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"12px 18px", fontWeight:700, fontSize:14, color:"var(--text)", borderBottom:"1px solid var(--border)" }}>Detalhamento mês a mês</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--bg)" }}>
                    {["Mês","Receita proj.","Avulsos proj.","Fixos comprometidos","Total despesas","Saldo proj."].map(h=>(
                      <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cashflow.map((fc,i)=>(
                    <tr key={fc.ym} style={{ borderTop:"1px solid var(--border)", background:fc.ym===filterMonth?"var(--accentbg)":fc.balProj<0?"var(--redbg)":"transparent" }}>
                      <td style={{ padding:"9px 12px", fontSize:13, fontWeight:fc.ym===filterMonth?700:400, color:"var(--text)", whiteSpace:"nowrap" }}>
                        {fc.label} {fc.ym===filterMonth&&<span style={{ fontSize:10, color:"var(--accent)" }}>← atual</span>}
                      </td>
                      <td style={{ padding:"9px 12px", fontSize:13, color:"var(--green)", fontWeight:600 }}>{fmtK(fc.recProj)}</td>
                      <td style={{ padding:"9px 12px", fontSize:13, color:"var(--muted)" }}>{fmtK(fc.avulsoProj)}</td>
                      <td style={{ padding:"9px 12px", fontSize:13, color:"#f59e0b" }}>{fmtK(fc.fixosProj)}</td>
                      <td style={{ padding:"9px 12px", fontSize:13, color:"var(--red)", fontWeight:600 }}>{fmtK(fc.depProj)}</td>
                      <td style={{ padding:"9px 12px", fontSize:14, color:fc.balProj>=0?"var(--green)":"var(--red)", fontWeight:800 }}>{fmtK(fc.balProj)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Linha do tempo: quando os empréstimos terminam */}
          {loanAnalysis.filter(l=>l.mesesRestantes>0).length>0&&(
            <Card>
              <SectionTitle sub="Quando cada empréstimo termina e o quanto isso libera na renda">Linha do tempo dos empréstimos</SectionTitle>
              {loanAnalysis.filter(l=>l.mesesRestantes>0).sort((a,b)=>a.mesesRestantes-b.mesesRestantes).map((l,idx)=>{
                const terminaYm=()=>{
                  if (!l.proxParcela) return "—";
                  const ultimaPend=[...l.pendentes].sort((a,b)=>(b.due_date||"").localeCompare(a.due_date||""))[0];
                  return ultimaPend?.due_date?.slice(0,7)||"—";
                };
                const ym=terminaYm();
                const mesesAte=ym!=="—"?Math.max(0,Math.ceil((new Date(ym+"-01")-new Date())/2629800)):0;
                return (
                  <div key={l.id} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 0", borderBottom:idx<loanAnalysis.filter(l2=>l2.mesesRestantes>0).length-1?"1px solid var(--border)":"none" }}>
                    <div style={{ width:44, height:44, borderRadius:10, background:"var(--accentbg)", border:"1px solid var(--accent)33", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"var(--accent)" }}>{l.mesesRestantes}</div>
                      <div style={{ fontSize:9, color:"var(--muted)" }}>meses</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{l.description}</div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                        Termina em {ym!=="—"?mlabelFull(ym):"—"} · Libera {fmt(l.custo_mensal)}/mês
                        {totals.rec>0&&` (${l.pctRenda.toFixed(1)}% da renda)`}
                      </div>
                      <div style={{ marginTop:6, height:5, background:"var(--border)", borderRadius:99 }}>
                        <div style={{ height:"100%", width:`${l.pctPago}%`, background:"var(--green)", borderRadius:99 }} />
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"var(--red)" }}>{fmt(l.totalPend)}</div>
                      <div style={{ fontSize:10, color:"var(--muted)" }}>restando</div>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      <HelpButton pageId="visao" onNavigate={onNavigate} />
    </div>
  );
}
