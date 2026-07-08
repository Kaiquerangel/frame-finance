import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell,
  AreaChart, Area, PieChart, Pie, Sector,
} from "recharts";

// ── Utilitários ───────────────────────────────────────────────────────────────
const fmt     = (v) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v||0);
const fmtK    = (v) => Math.abs(v)>=1000?`R$\u00a0${(v/1000).toFixed(1)}k`:fmt(v);
const fmtPct  = (v) => `${(v||0).toFixed(1)}%`;
const mlabel  = (ym) => { const [y,m]=ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const mlabelFull = (ym) => { const [y,m]=ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };
const today   = () => new Date().toISOString().slice(0,7);
const PALETTE = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16"];

const PERIODS = [
  { id:"1",      label:"1 mês",       months:1  },
  { id:"3",      label:"3 meses",     months:3  },
  { id:"6",      label:"6 meses",     months:6  },
  { id:"12",     label:"1 ano",       months:12 },
  { id:"custom", label:"Personalizado",months:0 },
];

const TABS = [
  { id:"resumo",      label:"Resumo"      },
  { id:"categorias",  label:"Categorias"  },
  { id:"evolucao",    label:"Evolução"    },
  { id:"comparativo", label:"Comparativo" },
  { id:"juros",       label:"Juros"       },
  { id:"poupanca",    label:"Poupança"    },
  { id:"transacoes",  label:"Transações"  },
];

// ── Componentes base ──────────────────────────────────────────────────────────
const Card = ({ children, style={} }) => (
  <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", padding:20, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);
const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom:14 }}>
    <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{children}</div>
    {sub&&<div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>{sub}</div>}
  </div>
);
const KpiBox = ({ label, value, sub, color="var(--text)", icon }) => (
  <div style={{ background:"var(--bg)", borderRadius:12, padding:"14px 16px", border:"1px solid var(--border)" }}>
    {icon&&<div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>}
    <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{label}</div>
    <div style={{ fontSize:20, fontWeight:800, color, letterSpacing:"-.02em" }}>{value}</div>
    {sub&&<div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>{sub}</div>}
  </div>
);
const BarH = ({ label, value, total, color, sub, delta, onClick }) => {
  const p = total>0?Math.min((value/total)*100,100):0;
  return (
    <div onClick={onClick} style={{ cursor:onClick?"pointer":"default", marginBottom:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, marginBottom:5 }}>
        <span style={{ color:"var(--text)", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, maxWidth:"50%" }}>{label}</span>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
          {delta!==undefined&&delta!==null&&(
            <span style={{ fontSize:11, fontWeight:700, color:delta>0?"var(--red)":delta<0?"var(--green)":"var(--muted)", background:delta>0?"var(--redbg)":delta<0?"var(--greenbg)":"var(--bg)", borderRadius:6, padding:"1px 6px" }}>
              {delta>0?"+":""}{delta.toFixed(0)}%
            </span>
          )}
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

// ════════════════════════════════════════════════════════════════════════════════
export default function Analise({ userId, onNavigate }) {
  const isMobile = useIsMobile();

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [transactions,      setTransactions]      = useState([]);
  const [revenues,          setRevenues]          = useState([]);
  const [installments,      setInstallments]      = useState([]);
  const [fixedPayments,     setFixedPayments]     = useState([]);
  const [loanInstallments,  setLoanInstallments]  = useState([]);
  const [loans,             setLoans]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [loadError,         setLoadError]         = useState(null);

  const [period,       setPeriod]       = useState("1");
  const [customStart,  setCustomStart]  = useState("");
  const [customEnd,    setCustomEnd]    = useState("");
  const [filterCat,    setFilterCat]    = useState("all");
  const [filterSrc,    setFilterSrc]    = useState("all"); // all|avulso|fixo|parcela|emprestimo
  const [tab,          setTab]          = useState("resumo");
  const [txSearch,     setTxSearch]     = useState("");
  const [txType,       setTxType]       = useState("all");
  const [compA,        setCompA]        = useState(today());
  const [compB,        setCompB]        = useState(()=>{ const d=new Date(); return new Date(d.getFullYear(),d.getMonth()-1,1).toISOString().slice(0,7); });

  // ── Carga ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const [{data:t},{data:r},{data:i},{data:fp},{data:li},{data:l}] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(2000),
        supabase.from("revenues").select("*").eq("user_id",userId).order("date",{ascending:false}).limit(2000),
        supabase.from("installments").select("*, purchases(description,category,has_interest,interest_rate,cards(name))").eq("user_id",userId).order("due_date",{ascending:false}).limit(2000),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description,category)").eq("user_id",userId).order("due_date",{ascending:false}).limit(1000),
        supabase.from("loan_installments").select("*, loans(description,category,type,total_amount,installments,interest_rate)").eq("user_id",userId).order("due_date",{ascending:false}).limit(1000),
        supabase.from("loans").select("*").eq("user_id",userId),
      ]);
      setTransactions(t||[]); setRevenues(r||[]); setInstallments(i||[]);
      setFixedPayments(fp||[]); setLoanInstallments(li||[]); setLoans(l||[]);
    } catch(err) { setLoadError("Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  },[userId]);
  useEffect(()=>{ load(); },[load]);

  // ── Range de datas ─────────────────────────────────────────────────────────
  const dateRange = useMemo(()=>{
    if (period==="custom") return { start:customStart, end:customEnd };
    const months=parseInt(period);
    const now=new Date();
    const end=today();
    const start=new Date(now.getFullYear(),now.getMonth()-months+1,1).toISOString().slice(0,7);
    return { start, end };
  },[period,customStart,customEnd]);

  const monthsInRange = useMemo(()=>{
    if (!dateRange.start||!dateRange.end) return [];
    const result=[];
    const [sy,sm]=dateRange.start.split("-").map(Number);
    const [ey,em]=dateRange.end.split("-").map(Number);
    let y=sy, m=sm;
    while(y<ey||(y===ey&&m<=em)){ result.push(`${y}-${String(m).padStart(2,"0")}`); m++; if(m>12){m=1;y++;} }
    return result;
  },[dateRange]);

  const inRange = useCallback((date)=>{ if(!date) return false; return monthsInRange.includes(date.slice(0,7)); },[monthsInRange]);

  // ── Dados filtrados ─────────────────────────────────────────────────────────
  const filtTx    = useMemo(()=>transactions.filter(t=>inRange(t.date)),[transactions,inRange]);
  const filtRev   = useMemo(()=>revenues.filter(r=>inRange(r.date)),[revenues,inRange]);
  const filtFixed = useMemo(()=>fixedPayments.filter(fp=>inRange(fp.due_date)),[fixedPayments,inRange]);
  const filtInst  = useMemo(()=>installments.filter(i=>inRange(i.due_date)),[installments,inRange]);
  const filtLoan  = useMemo(()=>loanInstallments.filter(li=>inRange(li.due_date)),[loanInstallments,inRange]);

  // ── Totais ─────────────────────────────────────────────────────────────────
  const totals = useMemo(()=>{
    const rec = filtRev.reduce((a,r)=>a+Number(r.amount),0)
              + filtTx.filter(t=>t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const depTx    = filtTx.filter(t=>t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
    const depFixed = filtFixed.reduce((a,fp)=>a+Number(fp.amount),0);
    const depInst  = filtInst.reduce((a,i)=>a+Number(i.amount),0);
    const depLoan  = filtLoan.reduce((a,li)=>a+Number(li.amount),0);
    const dep = depTx+depFixed+depInst+depLoan;
    const n = monthsInRange.length||1;
    return { rec, dep, bal:rec-dep, depTx, depFixed, depInst, depLoan, months:n,
      avgRec:rec/n, avgDep:dep/n, savingsRate:rec>0?((rec-dep)/rec)*100:0 };
  },[filtTx,filtRev,filtFixed,filtInst,filtLoan,monthsInRange]);

  // ── Categorias ─────────────────────────────────────────────────────────────
  const allCategories = useMemo(()=>{
    const s=new Set();
    filtTx.filter(t=>t.type==="despesa").forEach(t=>s.add(t.cat));
    filtFixed.forEach(fp=>s.add(fp.fixed_expenses?.category||"Fixas"));
    filtInst.forEach(i=>s.add(i.purchases?.category||"Compras"));
    filtLoan.forEach(li=>s.add(li.loans?.category||"Empréstimos"));
    return [...s].sort();
  },[filtTx,filtFixed,filtInst,filtLoan]);

  const byCat = useMemo(()=>{
    const map={};
    const add=(cat,val,src)=>{ if(!map[cat]) map[cat]={val:0,avulso:0,fixo:0,parcela:0,emprestimo:0}; map[cat].val+=Number(val); map[cat][src]+=Number(val); };
    filtTx.filter(t=>t.type==="despesa").filter(t=>filterCat==="all"||t.cat===filterCat).forEach(t=>add(t.cat||"Outros",t.value,"avulso"));
    filtFixed.filter(fp=>filterCat==="all"||(fp.fixed_expenses?.category||"Fixas")===filterCat).forEach(fp=>add(fp.fixed_expenses?.category||"Fixas",fp.amount,"fixo"));
    filtInst.filter(i=>filterCat==="all"||(i.purchases?.category||"Compras")===filterCat).forEach(i=>add(i.purchases?.category||"Compras",i.amount,"parcela"));
    filtLoan.filter(li=>filterCat==="all"||(li.loans?.category||"Empréstimos")===filterCat).forEach(li=>add(li.loans?.category||"Empréstimos",li.amount,"emprestimo"));
    return Object.entries(map).map(([cat,d])=>({ cat, ...d })).sort((a,b)=>b.val-a.val);
  },[filtTx,filtFixed,filtInst,filtLoan,filterCat]);

  // ── Evolução ───────────────────────────────────────────────────────────────
  const evolution = useMemo(()=>{
    let balAcum=0;
    return monthsInRange.map(ym=>{
      const rec=revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
               +transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const depTx=transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0);
      const depFixed=fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0);
      const depInst=installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      const depLoan=loanInstallments.filter(li=>(li.due_date||"").startsWith(ym)).reduce((a,li)=>a+Number(li.amount),0);
      const dep=depTx+depFixed+depInst+depLoan;
      const bal=rec-dep;
      balAcum+=bal;
      const savings=rec>0?((rec-dep)/rec)*100:0;
      return { ym, label:mlabel(ym), rec, dep, depTx, depFixed, depInst, depLoan, bal, balAcum, savings };
    });
  },[monthsInRange,transactions,revenues,fixedPayments,installments,loanInstallments]);

  // ── Comparativo entre meses ────────────────────────────────────────────────
  const getMonthTotals = useCallback((ym)=>{
    const rec=revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
             +transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const dep=transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
             +fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
             +installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0)
             +loanInstallments.filter(li=>(li.due_date||"").startsWith(ym)).reduce((a,li)=>a+Number(li.amount),0);
    const byCatLocal={};
    transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").forEach(t=>{ byCatLocal[t.cat]=(byCatLocal[t.cat]||0)+Number(t.value); });
    fixedPayments.filter(fp=>(fp.due_date||"").startsWith(ym)).forEach(fp=>{ const c=fp.fixed_expenses?.category||"Fixas"; byCatLocal[c]=(byCatLocal[c]||0)+Number(fp.amount); });
    installments.filter(i=>(i.due_date||"").startsWith(ym)).forEach(i=>{ const c=i.purchases?.category||"Compras"; byCatLocal[c]=(byCatLocal[c]||0)+Number(i.amount); });
    loanInstallments.filter(li=>(li.due_date||"").startsWith(ym)).forEach(li=>{ const c=li.loans?.category||"Empréstimos"; byCatLocal[c]=(byCatLocal[c]||0)+Number(li.amount); });
    return { rec, dep, bal:rec-dep, byCat:byCatLocal };
  },[revenues,transactions,fixedPayments,installments,loanInstallments]);

  const compAData = useMemo(()=>getMonthTotals(compA),[compA,getMonthTotals]);
  const compBData = useMemo(()=>getMonthTotals(compB),[compB,getMonthTotals]);

  const compCats = useMemo(()=>{
    const cats=new Set([...Object.keys(compAData.byCat),...Object.keys(compBData.byCat)]);
    return [...cats].sort((a,b)=>((compAData.byCat[b]||0)+(compBData.byCat[b]||0))-((compAData.byCat[a]||0)+(compBData.byCat[a]||0)));
  },[compAData,compBData]);

  // ── Análise de juros ───────────────────────────────────────────────────────
  const jurosData = useMemo(()=>{
    // Parcelas de cartão com juros
    const instComJuros = filtInst.filter(i=>i.purchases?.has_interest);
    const totalInstJuros = instComJuros.reduce((a,i)=>a+Number(i.amount),0);

    // Empréstimos: total pago - valor original = juros pagos
    const loanJuros = loans.map(l=>{
      const parcsPagas = loanInstallments.filter(li=>li.loan_id===l.id&&li.paid);
      const totalPago  = parcsPagas.reduce((a,li)=>a+Number(li.amount),0);
      const valorOrig  = Number(l.total_amount)||0;
      const nParcelas  = Number(l.installments)||1;
      const parcsPagasN = parcsPagas.length;
      const proporcional = valorOrig*(parcsPagasN/nParcelas);
      const juros = Math.max(totalPago-proporcional,0);
      const taxaTotal = valorOrig>0?((totalPago/Math.max(proporcional,1))-1)*100:0;
      return { id:l.id, desc:l.description, tipo:l.type, juros, totalPago, proporcional, taxa:l.interest_rate, parcsPagasN, nParcelas, taxaTotal };
    }).filter(l=>l.juros>0||l.totalPago>0);

    const totalLoanJuros = loanJuros.reduce((a,l)=>a+l.juros,0);
    const totalJuros = totalInstJuros+totalLoanJuros;

    // Custo do crédito: quanto % a mais você pagou vs o valor original
    const totalCreditoPago = filtInst.reduce((a,i)=>a+Number(i.amount),0)
                           + loanInstallments.filter(li=>inRange(li.due_date)&&li.paid).reduce((a,li)=>a+Number(li.amount),0);

    return { instComJuros, totalInstJuros, loanJuros, totalLoanJuros, totalJuros, totalCreditoPago };
  },[filtInst,filtLoan,loans,loanInstallments,inRange]);

  // ── Análise de poupança ────────────────────────────────────────────────────
  const poupancaData = useMemo(()=>{
    let acum=0;
    const byMonth = evolution.map(e=>{
      const saved=Math.max(e.rec-e.dep,0);
      acum+=saved;
      const rate=e.rec>0?((e.rec-e.dep)/e.rec)*100:0;
      return { ...e, saved, acum, rate };
    });
    const avgSaved = byMonth.length>0?byMonth.reduce((a,m)=>a+m.saved,0)/byMonth.length:0;
    const bestMonth = [...byMonth].sort((a,b)=>b.saved-a.saved)[0];
    const worstMonth = [...byMonth].sort((a,b)=>a.rate-b.rate)[0];

    // Projeção para metas
    const goalProjections = [];
    // sem acesso às metas aqui, deixamos vazio — quem tiver será calculado externamente

    return { byMonth, avgSaved, bestMonth, worstMonth, acumTotal:acum };
  },[evolution]);

  // ── Extrato unificado ──────────────────────────────────────────────────────
  const allItems = useMemo(()=>{
    let items=[
      ...filtTx.map(t=>({ id:`tx-${t.id}`, date:t.date, desc:t.description, val:t.type==="receita"?Number(t.value):-Number(t.value), cat:t.cat||"Outros", src:"Avulso", type:t.type, paid:true })),
      ...filtRev.map(r=>({ id:`rev-${r.id}`, date:r.date, desc:r.description, val:Number(r.amount), cat:r.category||"Receita", src:"Receita", type:"receita", paid:true })),
      ...filtFixed.map(fp=>({ id:`fp-${fp.id}`, date:fp.due_date, desc:fp.fixed_expenses?.description||"Despesa fixa", val:-Number(fp.amount), cat:fp.fixed_expenses?.category||"Fixas", src:"Fixa", type:"despesa", paid:fp.paid })),
      ...filtInst.map(i=>({ id:`inst-${i.id}`, date:i.due_date, desc:i.purchases?.description||"Parcela", val:-Number(i.amount), cat:i.purchases?.category||"Compras", src:"Parcela", type:"despesa", paid:i.paid, extra:i.purchases?.cards?.name })),
      ...filtLoan.map(li=>({ id:`loan-${li.id}`, date:li.due_date, desc:li.loans?.description||"Empréstimo", val:-Number(li.amount), cat:li.loans?.category||"Empréstimos", src:"Empréstimo", type:"despesa", paid:li.paid })),
    ];
    if (txType!=="all") items=items.filter(i=>i.type===txType);
    if (filterCat!=="all") items=items.filter(i=>i.cat===filterCat);
    if (filterSrc!=="all") items=items.filter(i=>i.src.toLowerCase()===filterSrc);
    if (txSearch) {
      const q=txSearch.toLowerCase();
      items=items.filter(i=>i.desc.toLowerCase().includes(q)||i.cat.toLowerCase().includes(q));
    }
    return items.sort((a,b)=>b.date.localeCompare(a.date));
  },[filtTx,filtRev,filtFixed,filtInst,filtLoan,txType,filterCat,filterSrc,txSearch]);

  const exportCSV = () => {
    const header="Data,Descrição,Categoria,Origem,Valor\n";
    const rows=allItems.map(i=>`${i.date},"${i.desc}","${i.cat}","${i.src}","${Math.abs(i.val).toFixed(2)}"`).join("\n");
    const a=document.createElement("a");
    a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(header+rows);
    a.download=`analise-${dateRange.start}-${dateRange.end}.csv`;
    a.click();
  };

  // ── Resumo: maiores gastos ─────────────────────────────────────────────────
  const biggestItems = useMemo(()=>{
    const items=[
      ...filtTx.filter(t=>t.type==="despesa").map(t=>({ desc:t.description, cat:t.cat||"Outros", val:Number(t.value), src:"Avulso", date:t.date })),
      ...filtFixed.map(fp=>({ desc:fp.fixed_expenses?.description||"Fixa", cat:fp.fixed_expenses?.category||"Fixas", val:Number(fp.amount), src:"Fixa", date:fp.due_date })),
      ...filtInst.map(i=>({ desc:i.purchases?.description||"Parcela", cat:i.purchases?.category||"Compras", val:Number(i.amount), src:"Parcela", date:i.due_date })),
      ...filtLoan.map(li=>({ desc:li.loans?.description||"Empréstimo", cat:li.loans?.category||"Fixo", val:Number(li.amount), src:"Empréstimo", date:li.due_date })),
    ];
    return items.sort((a,b)=>b.val-a.val).slice(0,10);
  },[filtTx,filtFixed,filtInst,filtLoan]);

  // ── Dia da semana com mais gasto ───────────────────────────────────────────
  const byWeekday = useMemo(()=>{
    const days=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    const map={};
    filtTx.filter(t=>t.type==="despesa").forEach(t=>{
      const d=new Date(t.date+"T12:00:00").getDay();
      map[d]=(map[d]||0)+Number(t.value);
    });
    return days.map((name,i)=>({ name, val:map[i]||0 }));
  },[filtTx]);

  // ── Meses disponíveis para selects ────────────────────────────────────────
  const availMonths = useMemo(()=>{
    const s=new Set([...revenues.map(r=>r.date.slice(0,7)),...transactions.map(t=>t.date.slice(0,7))]);
    s.add(today());
    return [...s].sort().reverse();
  },[revenues,transactions]);

  // ── Variação vs período anterior ──────────────────────────────────────────
  const prevRange = useMemo(()=>{
    if (!dateRange.start||!dateRange.end) return null;
    const n=monthsInRange.length;
    const [sy,sm]=dateRange.start.split("-").map(Number);
    const prevEnd=new Date(sy,sm-2,1);
    const prevStart=new Date(sy,sm-2-n+1,1);
    return {
      start:prevStart.toISOString().slice(0,7),
      end:prevEnd.toISOString().slice(0,7),
    };
  },[dateRange,monthsInRange]);

  const prevTotals = useMemo(()=>{
    if(!prevRange) return null;
    const [psy,psm]=prevRange.start.split("-").map(Number);
    const [pey,pem]=prevRange.end.split("-").map(Number);
    const pMonths=[];
    let y=psy,m=psm;
    while(y<pey||(y===pey&&m<=pem)){ pMonths.push(`${y}-${String(m).padStart(2,"0")}`); m++; if(m>12){m=1;y++;} }
    const inPrev=(date)=>pMonths.includes((date||"").slice(0,7));
    const rec=revenues.filter(r=>inPrev(r.date)).reduce((a,r)=>a+Number(r.amount),0)
             +transactions.filter(t=>inPrev(t.date)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
    const dep=transactions.filter(t=>inPrev(t.date)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
             +fixedPayments.filter(fp=>inPrev(fp.due_date)).reduce((a,fp)=>a+Number(fp.amount),0)
             +installments.filter(i=>inPrev(i.due_date)).reduce((a,i)=>a+Number(i.amount),0)
             +loanInstallments.filter(li=>inPrev(li.due_date)).reduce((a,li)=>a+Number(li.amount),0);
    return { rec, dep };
  },[prevRange,revenues,transactions,fixedPayments,installments,loanInstallments]);

  const varDep = prevTotals&&prevTotals.dep>0?((totals.dep-prevTotals.dep)/prevTotals.dep)*100:null;
  const varRec = prevTotals&&prevTotals.rec>0?((totals.rec-prevTotals.rec)/prevTotals.rec)*100:null;

  if (loading) return <LoadingSpinner message="Carregando análise..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={load} />;

  const srcColors={ Avulso:"var(--accent)", Fixa:"#f59e0b", Parcela:"#3b82f6", Empréstimo:"#7c3aed", Receita:"var(--green)" };

  return (
    <div>
      {/* ── TÍTULO ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontWeight:800, fontSize:24, color:"var(--text)", letterSpacing:"-.02em" }}>Análise Financeira</h1>
        <p style={{ color:"var(--muted)", fontSize:14, marginTop:4 }}>Entenda para onde está indo o seu dinheiro</p>
      </div>

      {/* ── FILTRO DE PERÍODO ──────────────────────────────────────────────── */}
      <Card style={{ marginBottom:16, padding:"14px 18px" }}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", background:"var(--bg)", borderRadius:10, padding:3, gap:2 }}>
            {PERIODS.map(p=>(
              <button key={p.id} onClick={()=>setPeriod(p.id)} style={{
                padding:"6px 14px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:12,
                background:period===p.id?"var(--surface)":"transparent",
                color:period===p.id?"var(--accent)":"var(--muted)",
                boxShadow:period===p.id?"var(--shadow-sm)":"none",
              }}>{p.label}</button>
            ))}
          </div>
          {period==="custom"&&(
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <input type="month" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }} />
              <span style={{ color:"var(--muted)", fontSize:12 }}>até</span>
              <input type="month" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ padding:"5px 8px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }} />
            </div>
          )}
          <div style={{ fontSize:12, color:"var(--muted)", marginLeft:4 }}>
            {monthsInRange.length>0&&`${mlabelFull(monthsInRange[0])} → ${mlabelFull(monthsInRange[monthsInRange.length-1])} · ${monthsInRange.length} mês(es)`}
          </div>
        </div>
      </Card>

      {/* ── ABAS ───────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:"8px 16px", borderRadius:10, border:"none", cursor:"pointer",
            fontWeight:700, fontSize:13, whiteSpace:"nowrap", flexShrink:0,
            background:tab===t.id?"var(--accent)":"var(--surface)",
            color:tab===t.id?"#fff":"var(--muted)",
            boxShadow:tab===t.id?"var(--shadow-sm)":"none",
            border:tab===t.id?"none":"1px solid var(--border)",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══════════ ABA: RESUMO ══════════ */}
      {tab==="resumo"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* KPIs principais */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <KpiBox icon="↑" label="Total receitas" value={fmt(totals.rec)} color="var(--green)"
              sub={varRec!==null?`${varRec>=0?"+":""}${varRec.toFixed(0)}% vs período ant.`:undefined} />
            <KpiBox icon="↓" label="Total despesas" value={fmt(totals.dep)} color="var(--red)"
              sub={varDep!==null?`${varDep>=0?"+":""}${varDep.toFixed(0)}% vs período ant.`:undefined} />
            <KpiBox icon="=" label="Saldo" value={fmt(totals.bal)} color={totals.bal>=0?"var(--accent)":"var(--red)"}
              sub={totals.bal>=0?"Positivo":"Negativo"} />
            <KpiBox icon="⌀" label="Média mensal gasto" value={fmt(totals.avgDep)} color="var(--text)"
              sub={`sobre ${totals.months} mês(es)`} />
          </div>

          {/* KPIs secundários */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <KpiBox label="Avulsos" value={fmt(totals.depTx)} color="var(--accent)"
              sub={`${((totals.depTx/Math.max(totals.dep,1))*100).toFixed(0)}% das despesas`} />
            <KpiBox label="Fixos (fixas+parc+empr)" value={fmt(totals.depFixed+totals.depInst+totals.depLoan)} color="#f59e0b"
              sub={`${(((totals.depFixed+totals.depInst+totals.depLoan)/Math.max(totals.dep,1))*100).toFixed(0)}% das despesas`} />
            <KpiBox label="Taxa de poupança" value={`${totals.savingsRate.toFixed(1)}%`}
              color={totals.savingsRate>=20?"var(--green)":totals.savingsRate>=10?"#f59e0b":"var(--red)"}
              sub={totals.savingsRate>=20?"Excelente":totals.savingsRate>=10?"Razoável":"Melhorar"} />
            <KpiBox label="Média mensal receita" value={fmt(totals.avgRec)} color="var(--green)"
              sub={`sobre ${totals.months} mês(es)`} />
          </div>

          {/* Composição das despesas */}
          {totals.dep>0&&(
            <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
              <Card>
                <SectionTitle sub="Avulsos vs compromissos fixos">Composição das despesas</SectionTitle>
                <InteractiveDonut
                  data={[
                    { name:"Avulsos", value:totals.depTx, color:PALETTE[0] },
                    { name:"Fixos",   value:totals.depFixed+totals.depInst+totals.depLoan, color:PALETTE[3] },
                  ]}
                  centerLabel="Total"
                  centerValue={fmt(totals.dep)}
                  height={200}
                />
                <div style={{ marginTop:8, paddingTop:12, borderTop:"1px solid var(--border)" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".04em", marginBottom:8 }}>Detalhe dos fixos</div>
                  {[
                    { label:"Despesas fixas",     val:totals.depFixed, color:"#f59e0b" },
                    { label:"Parcelas de cartão", val:totals.depInst,  color:"#3b82f6" },
                    { label:"Empréstimos",        val:totals.depLoan,  color:"#7c3aed" },
                  ].filter(i=>i.val>0).map((item,i)=>(
                    <BarH key={i} label={item.label} value={item.val} total={totals.depFixed+totals.depInst+totals.depLoan} color={item.color} />
                  ))}
                </div>
              </Card>
              <Card>
                <SectionTitle sub={`Top 10 maiores gastos individuais do período (${totals.months} mes(es))`}>Maiores gastos individuais</SectionTitle>
                {biggestItems.length===0
                  ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"24px 0", fontSize:13 }}>Nenhuma despesa no período</div>
                  : biggestItems.map((item,idx)=>(
                    <div key={idx} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:idx<biggestItems.length-1?"1px solid var(--border)":"none" }}>
                      <div style={{ width:22, height:22, borderRadius:6, flexShrink:0, background:idx<3?"var(--accent)":"var(--bg)", color:idx<3?"#fff":"var(--muted)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.desc}</div>
                        <div style={{ fontSize:10, color:"var(--muted)" }}>{item.cat} · <span style={{ color:srcColors[item.src]||"var(--muted)" }}>{item.src}</span> · {item.date}</div>
                      </div>
                      <span style={{ fontWeight:700, fontSize:12, color:"var(--red)", flexShrink:0 }}>{fmt(item.val)}</span>
                    </div>
                  ))
                }
              </Card>
            </div>
          )}

          {/* Padrão de consumo — dia da semana */}
          {byWeekday.some(d=>d.val>0)&&(
            <Card>
              <SectionTitle sub="Em qual dia da semana você mais gasta (só avulsos)">Padrão de consumo semanal</SectionTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byWeekday} margin={{ left:-8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>fmtK(v)} width={44} />
                  <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                  <Bar dataKey="val" name="Gastos" radius={[4,4,0,0]}>
                    {byWeekday.map((e,i)=>(
                      <Cell key={i} fill={e.val===Math.max(...byWeekday.map(d=>d.val))?"var(--red)":"var(--accent)"} opacity={.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ ABA: CATEGORIAS ══════════ */}
      {tab==="categorias"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Filtro de categoria */}
          <Card style={{ padding:"12px 16px" }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                <option value="all">Todas as categorias</option>
                {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterSrc} onChange={e=>setFilterSrc(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                <option value="all">Todas as origens</option>
                <option value="avulso">Avulsos</option>
                <option value="fixa">Fixas</option>
                <option value="parcela">Parcelas</option>
                <option value="emprestimo">Empréstimos</option>
              </select>
              {(filterCat!=="all"||filterSrc!=="all")&&(
                <button onClick={()=>{setFilterCat("all");setFilterSrc("all");}} style={{ fontSize:12, color:"var(--red)", background:"var(--redbg)", border:"none", borderRadius:7, padding:"5px 10px", cursor:"pointer", fontWeight:600 }}>Limpar filtros ×</button>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle sub={`${byCat.length} categorias · Total: ${fmt(totals.dep)}`}>Gastos por categoria</SectionTitle>
            {byCat.length===0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhuma despesa no período</div>
              : (
                <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1.1fr", gap:16, alignItems:"start" }}>
                  <CategoryPie data={byCat} onSliceClick={(cat)=>setFilterCat(filterCat===cat?"all":cat)} height={260} />
                  <div>
                    {byCat.map((item,idx)=>(
                      <div key={item.cat}>
                        <BarH label={item.cat} value={item.val} total={totals.dep} color={PALETTE[idx%PALETTE.length]}
                          onClick={()=>setFilterCat(filterCat===item.cat?"all":item.cat)} />
                        {/* Detalhe por origem dentro da categoria */}
                        {(item.avulso>0||item.fixo>0||item.parcela>0||item.emprestimo>0)&&(
                          <div style={{ marginLeft:16, marginBottom:8, display:"flex", gap:8, flexWrap:"wrap" }}>
                            {[
                              { label:"Avulso", val:item.avulso,     color:"var(--accent)" },
                              { label:"Fixa",   val:item.fixo,       color:"#f59e0b" },
                              { label:"Parcela",val:item.parcela,    color:"#3b82f6" },
                              { label:"Empr.",  val:item.emprestimo, color:"#7c3aed" },
                            ].filter(s=>s.val>0).map(s=>(
                              <span key={s.label} style={{ fontSize:10, fontWeight:600, color:s.color, background:"var(--bg)", border:`1px solid ${s.color}33`, borderRadius:6, padding:"2px 7px" }}>
                                {s.label}: {fmt(s.val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            }
          </Card>
        </div>
      )}

      {/* ══════════ ABA: EVOLUÇÃO ══════════ */}
      {tab==="evolucao"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {evolution.length<2
            ? <Card><div style={{ textAlign:"center", color:"var(--muted)", padding:"32px 0" }}>Dados insuficientes para evolução. Amplie o período.</div></Card>
            : (
              <>
                {/* Receitas vs Despesas */}
                <Card>
                  <SectionTitle sub="Receitas e despesas mês a mês">Evolução mensal</SectionTitle>
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

                {/* Saldo mensal + acumulado */}
                <Card>
                  <SectionTitle sub="Saldo mensal e acumulado no período">Saldo</SectionTitle>
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

                {/* Breakdown empilhado de despesas */}
                <Card>
                  <SectionTitle sub="Composição das despesas por tipo a cada mês">Despesas por tipo</SectionTitle>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={evolution} margin={{ left:-8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                      <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                      <Bar dataKey="depTx"    name="Avulsos"   stackId="a" fill={PALETTE[0]} />
                      <Bar dataKey="depFixed" name="Fixas"     stackId="a" fill={PALETTE[3]} />
                      <Bar dataKey="depInst"  name="Parcelas"  stackId="a" fill={PALETTE[1]} />
                      <Bar dataKey="depLoan"  name="Empréstimos" stackId="a" fill={PALETTE[6]} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </>
            )
          }
        </div>
      )}

      {/* ══════════ ABA: COMPARATIVO ══════════ */}
      {tab==="comparativo"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card style={{ padding:"12px 16px" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <select value={compA} onChange={e=>setCompA(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                {availMonths.map(m=><option key={m} value={m}>{mlabelFull(m)}</option>)}
              </select>
              <span style={{ fontWeight:700, color:"var(--muted)" }}>vs</span>
              <select value={compB} onChange={e=>setCompB(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                {availMonths.map(m=><option key={m} value={m}>{mlabelFull(m)}</option>)}
              </select>
            </div>
          </Card>

          {/* KPIs comparativos */}
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:14 }}>
            {[
              { label:"Receitas",  a:compAData.rec, b:compBData.rec, color:"var(--green)" },
              { label:"Despesas",  a:compAData.dep, b:compBData.dep, color:"var(--red)" },
              { label:"Saldo",     a:compAData.bal, b:compBData.bal, color:"var(--accent)" },
            ].map(item=>{
              const delta=item.b>0?((item.a-item.b)/item.b)*100:null;
              return (
                <Card key={item.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--muted)", marginBottom:8 }}>{item.label}</div>
                    <div style={{ fontSize:17, fontWeight:800, color:item.color }}>{fmt(item.a)}</div>
                    <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>vs {fmt(item.b)}</div>
                  </div>
                  {delta!==null&&(
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:22, fontWeight:800, color:delta>0?(item.label==="Receitas"?"var(--green)":"var(--red)"):(item.label==="Receitas"?"var(--red)":"var(--green)") }}>
                        {delta>=0?"+":""}{delta.toFixed(1)}%
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>{mlabel(compA)} vs {mlabel(compB)}</div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Gráfico de barras lado a lado */}
          <Card>
            <SectionTitle sub={`${mlabel(compA)} vs ${mlabel(compB)}`}>Comparativo visual</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name:"Receitas", [mlabel(compA)]:compAData.rec, [mlabel(compB)]:compBData.rec },
                { name:"Despesas", [mlabel(compA)]:compAData.dep, [mlabel(compB)]:compBData.dep },
                { name:"Saldo",    [mlabel(compA)]:Math.max(compAData.bal,0), [mlabel(compB)]:Math.max(compBData.bal,0) },
              ]} margin={{ left:-8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                <Bar dataKey={mlabel(compA)} fill="var(--accent)" radius={[3,3,0,0]} opacity={.85} />
                <Bar dataKey={mlabel(compB)} fill="var(--muted)" radius={[3,3,0,0]} opacity={.6} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Por categoria */}
          {compCats.length>0&&(
            <Card>
              <SectionTitle sub="Variação por categoria entre os dois meses">Por categoria</SectionTitle>
              {compCats.slice(0,10).map((cat,idx)=>{
                const a=compAData.byCat[cat]||0;
                const b=compBData.byCat[cat]||0;
                const delta=b>0?((a-b)/b)*100:null;
                const max=Math.max(a,b,1);
                return (
                  <div key={cat} style={{ marginBottom:14 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{cat}</span>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        {delta!==null&&(
                          <span style={{ fontSize:11, fontWeight:700, color:delta>0?"var(--red)":"var(--green)", background:delta>0?"var(--redbg)":"var(--greenbg)", borderRadius:6, padding:"1px 6px" }}>
                            {delta>0?"+":""}{delta.toFixed(0)}%
                          </span>
                        )}
                        <span style={{ fontSize:12, color:"var(--accent)", fontWeight:700 }}>{fmt(a)}</span>
                        <span style={{ fontSize:11, color:"var(--muted)" }}>vs {fmt(b)}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:50, fontSize:10, color:"var(--muted)", textAlign:"right", flexShrink:0 }}>{mlabel(compA)}</div>
                        <div style={{ flex:1, height:7, background:"var(--border)", borderRadius:99 }}>
                          <div style={{ height:"100%", width:`${(a/max)*100}%`, background:"var(--accent)", borderRadius:99 }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:50, fontSize:10, color:"var(--muted)", textAlign:"right", flexShrink:0 }}>{mlabel(compB)}</div>
                        <div style={{ flex:1, height:7, background:"var(--border)", borderRadius:99 }}>
                          <div style={{ height:"100%", width:`${(b/max)*100}%`, background:"var(--muted)", borderRadius:99, opacity:.6 }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* ══════════ ABA: JUROS ══════════ */}
      {tab==="juros"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)", gap:10 }}>
            <KpiBox icon="💸" label="Total pago em juros" value={fmt(jurosData.totalJuros)} color="var(--red)"
              sub="Parcelas + Empréstimos" />
            <KpiBox icon="💳" label="Juros de parcelamentos" value={fmt(jurosData.totalInstJuros)} color="#f59e0b"
              sub={`${jurosData.instComJuros.length} parcela(s) com juros`} />
            <KpiBox icon="🏦" label="Juros de empréstimos" value={fmt(jurosData.totalLoanJuros)} color="#7c3aed"
              sub={`${jurosData.loanJuros.length} empréstimo(s)`} />
          </div>

          {jurosData.loanJuros.length>0&&(
            <Card>
              <SectionTitle sub="Quanto de juros você já pagou em cada empréstimo">Custo real dos empréstimos</SectionTitle>
              {jurosData.loanJuros.map(l=>(
                <div key={l.id} style={{ marginBottom:16, paddingBottom:16, borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{l.desc}</div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                        {l.tipo==="financiamento"?"Financiamento":"Empréstimo"} · {l.parcsPagasN}/{l.nParcelas} parcelas pagas
                        {l.taxa?` · Taxa: ${l.taxa}% a.m.`:""}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:16, fontWeight:800, color:"var(--red)" }}>{fmt(l.juros)}</div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>em juros</div>
                    </div>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                    {[
                      { label:"Total pago",      val:fmt(l.totalPago) },
                      { label:"Capital amortizado", val:fmt(l.proporcional) },
                      { label:"% de juros",      val:`${l.totalPago>0?((l.juros/l.totalPago)*100).toFixed(1):0}%` },
                    ].map(item=>(
                      <div key={item.label} style={{ background:"var(--bg)", borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3, fontWeight:600, textTransform:"uppercase" }}>{item.label}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text)" }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {jurosData.instComJuros.length>0&&(
            <Card>
              <SectionTitle sub="Parcelas de cartão marcadas como tendo juros no período">Parcelamentos com juros</SectionTitle>
              {jurosData.instComJuros.slice(0,8).map((i,idx)=>(
                <div key={i.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:idx<7?"1px solid var(--border)":"none" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{i.purchases?.description||"Parcela"}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>{i.purchases?.category||"Compras"} · {i.purchases?.cards?.name||""} · Vence {i.due_date}</div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, marginLeft:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f59e0b" }}>{fmt(i.amount)}</div>
                    <div style={{ fontSize:10, color:"var(--red)" }}>Com juros</div>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {jurosData.totalJuros===0&&(
            <Card style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--green)", marginBottom:6 }}>Nenhum juro identificado no período</div>
              <p style={{ fontSize:13, color:"var(--muted)" }}>Seus parcelamentos estão sem juros e seus empréstimos não mostraram custo adicional acima do capital.</p>
            </Card>
          )}
        </div>
      )}

      {/* ══════════ ABA: POUPANÇA ══════════ */}
      {tab==="poupanca"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10 }}>
            <KpiBox icon="🏦" label="Poupança do período" value={fmt(Math.max(totals.rec-totals.dep,0))} color="var(--green)"
              sub="Receitas − Despesas" />
            <KpiBox icon="%" label="Taxa de poupança" value={`${totals.savingsRate.toFixed(1)}%`}
              color={totals.savingsRate>=20?"var(--green)":totals.savingsRate>=10?"#f59e0b":"var(--red)"}
              sub={totals.savingsRate>=20?"Excelente (≥20%)":totals.savingsRate>=10?"Razoável (10–20%)":"Baixa (<10%)"} />
            <KpiBox icon="⌀" label="Média poupada/mês" value={fmt(poupancaData.avgSaved)} color="var(--green)"
              sub={`sobre ${totals.months} mês(es)`} />
            <KpiBox icon="↑" label="Melhor mês" value={poupancaData.bestMonth?fmt(poupancaData.bestMonth.saved):"—"}
              color="var(--green)" sub={poupancaData.bestMonth?mlabel(poupancaData.bestMonth.ym):undefined} />
          </div>

          {poupancaData.byMonth.length>=2&&(
            <>
              <Card>
                <SectionTitle sub="Quanto foi poupado em cada mês">Poupança mensal</SectionTitle>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={poupancaData.byMonth} margin={{ left:-8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                    <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                    <Bar dataKey="saved" name="Poupado" radius={[4,4,0,0]}>
                      {poupancaData.byMonth.map((e,i)=>(
                        <Cell key={i} fill={e.saved>=0?"var(--green)":"var(--red)"} opacity={.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionTitle sub="Poupança acumulada no período">Acúmulo</SectionTitle>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:28, fontWeight:800, color:"var(--green)" }}>{fmt(poupancaData.acumTotal)}</div>
                  <div style={{ fontSize:12, color:"var(--muted)", marginTop:4 }}>poupado ao longo de {totals.months} mês(es)</div>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={poupancaData.byMonth} margin={{ left:-8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={48} />
                    <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    <Area type="monotone" dataKey="acum" name="Acumulado" stroke="var(--green)" fill="var(--greenbg)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionTitle sub="Taxa de poupança mês a mês (quanto % da renda foi guardado)">Taxa de poupança</SectionTitle>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={poupancaData.byMonth} margin={{ left:-8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:10, fill:"var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(0)}%`} width={40} />
                    <Tooltip formatter={v=>`${Number(v).toFixed(1)}%`} contentStyle={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, fontSize:12 }} />
                    <ReferenceLine y={20} stroke="var(--green)" strokeDasharray="4 2" label={{ value:"Meta 20%", fill:"var(--green)", fontSize:10 }} />
                    <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="rate" name="Taxa poupança" stroke="var(--accent)" strokeWidth={2} dot={{ r:4, fill:"var(--accent)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ══════════ ABA: TRANSAÇÕES ══════════ */}
      {tab==="transacoes"&&(
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <Card style={{ padding:"12px 16px" }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <input value={txSearch} onChange={e=>setTxSearch(e.target.value)}
                placeholder="Buscar descrição ou categoria..."
                style={{ flex:1, minWidth:180, padding:"7px 12px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12, outline:"none" }} />
              <select value={txType} onChange={e=>setTxType(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                <option value="all">Todos</option>
                <option value="receita">Só receitas</option>
                <option value="despesa">Só despesas</option>
              </select>
              <select value={filterSrc} onChange={e=>setFilterSrc(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                <option value="all">Todas as origens</option>
                <option value="avulso">Avulsos</option>
                <option value="fixa">Fixas</option>
                <option value="parcela">Parcelas</option>
                <option value="emprestimo">Empréstimos</option>
                <option value="receita">Receitas</option>
              </select>
              <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:12 }}>
                <option value="all">Todas as categorias</option>
                {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={exportCSV} style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"var(--accentbg)", color:"var(--accent)", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                ⬇ CSV
              </button>
            </div>
          </Card>

          <Card style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"12px 18px", borderBottom:"1px solid var(--border)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{allItems.length} registro{allItems.length!==1?"s":""} encontrado{allItems.length!==1?"s":""}</span>
              <span style={{ fontSize:12, color:"var(--muted)" }}>
                {mlabelFull(dateRange.start)} → {mlabelFull(dateRange.end||today())}
              </span>
            </div>
            {allItems.length===0
              ? <div style={{ textAlign:"center", color:"var(--muted)", padding:"32px 0", fontSize:13 }}>Nenhum registro com esses filtros</div>
              : allItems.slice(0,100).map((item,i)=>(
                <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 18px", borderBottom:i<allItems.length-1?"1px solid var(--border)":"none" }}>
                  <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, background:item.val>=0?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                    {item.val>=0?"↑":"↓"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.desc}</div>
                    <div style={{ fontSize:11, color:"var(--muted)" }}>
                      {item.cat} · {item.date} ·{" "}
                      <span style={{ color:srcColors[item.src]||"var(--muted)", fontWeight:600 }}>{item.src}</span>
                      {item.extra&&<span style={{ marginLeft:5, color:"var(--accent)" }}>· {item.extra}</span>}
                      {!item.paid&&<span style={{ marginLeft:5, color:"var(--red)", fontWeight:600 }}>· Pendente</span>}
                    </div>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13, color:item.val>=0?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                    {item.val>=0?"+":""}{fmt(Math.abs(item.val))}
                  </span>
                </div>
              ))
            }
            {allItems.length>100&&(
              <div style={{ textAlign:"center", padding:"12px 0", color:"var(--muted)", fontSize:12, borderTop:"1px solid var(--border)" }}>
                Mostrando 100 de {allItems.length} registros. Exporte o CSV para ver todos.
              </div>
            )}
          </Card>
        </div>
      )}

      <HelpButton pageId="analise" onNavigate={onNavigate} />
    </div>
  );
}
