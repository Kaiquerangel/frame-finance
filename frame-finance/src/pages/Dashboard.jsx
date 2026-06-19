import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { generateAlerts } from "../lib/alerts";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import Checklist from "../components/Checklist";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";

const fmt  = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtK = (v) => Math.abs(v) >= 1000 ? `R$\u00a0${(v/1000).toFixed(1)}k` : fmt(v);
const pct  = (a, b) => b > 0 ? Math.min((a / b) * 100, 100) : 0;
const mlabel = (ym) => { const [y,m] = ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const today = () => new Date().toISOString().slice(0,7);

// ── Mini componentes ──────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", padding:18, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const KpiCard = ({ label, value, sub, color = "var(--text)", icon, onClick, urgent }) => (
  <button onClick={onClick} style={{
    background: urgent ? `${color}11` : "var(--surface)",
    borderRadius: 14,
    border: urgent ? `1.5px solid ${color}44` : "1px solid var(--border)",
    padding: "16px 14px", cursor: onClick ? "pointer" : "default",
    textAlign: "left", width: "100%", boxShadow: "var(--shadow-sm)",
    transition: "all .15s",
  }}>
    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
      {icon && <span style={{ fontSize:16 }}>{icon}</span>}
      <span style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em" }}>{label}</span>
    </div>
    <div style={{ fontSize:18, fontWeight:800, color, lineHeight:1, marginBottom:4 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{sub}</div>}
  </button>
);

const BarH = ({ label, value, total, color, onClick }) => {
  const p = total > 0 ? Math.min((value/total)*100, 100) : 0;
  return (
    <div onClick={onClick} style={{ cursor: onClick ? "pointer" : "default", marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
        <span style={{ color:"var(--text)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"60%" }}>{label}</span>
        <span style={{ color, fontWeight:700, flexShrink:0 }}>{fmt(value)} <span style={{ color:"var(--muted)", fontWeight:400 }}>({p.toFixed(0)}%)</span></span>
      </div>
      <div style={{ height:8, background:"var(--border)", borderRadius:99 }}>
        <div style={{ height:"100%", width:`${p}%`, background:color, borderRadius:99, transition:"width .5s" }} />
      </div>
    </div>
  );
};

export default function Dashboard({ userId, onNavigate, onStartTour }) {
  const isMobile = useIsMobile();

  const [transactions, setTransactions]   = useState([]);
  const [revenues, setRevenues]           = useState([]);
  const [installments, setInstallments]   = useState([]);
  const [loanInst, setLoanInst]           = useState([]);
  const [goals, setGoals]                 = useState([]);
  const [budgets, setBudgets]             = useState([]);
  const [cards, setCards]                 = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);
  const [alerts, setAlerts]               = useState([]);
  const [filterMonth, setFilterMonth]     = useState(today());
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [
          { data: t }, { data: r }, { data: i },
          { data: li }, { data: g }, { data: b },
          { data: c }, { data: fp },
        ] = await Promise.all([
          supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
          supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
          supabase.from("installments").select("*, purchases(description, category, card_id, cards(name))").eq("user_id", userId).order("due_date").limit(500),
          supabase.from("loan_installments").select("*").eq("user_id", userId).limit(500),
          supabase.from("goals").select("*").eq("user_id", userId),
          supabase.from("budgets").select("*").eq("user_id", userId).eq("month", today()),
          supabase.from("cards").select("*").eq("user_id", userId),
          supabase.from("fixed_expense_payments").select("*, fixed_expenses(description, category)").eq("user_id", userId).limit(500),
        ]);
        setTransactions(t || []);
        setRevenues(r || []);
        setInstallments(i || []);
        setLoanInst(li || []);
        setGoals(g || []);
        setBudgets(b || []);
        setCards(c || []);
        setFixedPayments(fp || []);
        const a = await generateAlerts(userId);
        setAlerts(a);
      } catch (err) {
        setLoadError("Não foi possível carregar o Dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  // ── Meses disponíveis ─────────────────────────────────────────────────────
  const months = useMemo(() => {
    const s = new Set([
      ...transactions.map(t => t.date.slice(0,7)),
      ...revenues.map(r => r.date.slice(0,7)),
      ...fixedPayments.map(fp => (fp.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    s.add(today());
    return [...s].sort().reverse();
  }, [transactions, revenues, fixedPayments]);

  // ── Dados filtrados do mês ────────────────────────────────────────────────
  const filtTx    = useMemo(() => transactions.filter(t => t.date.startsWith(filterMonth)), [transactions, filterMonth]);
  const filtRev   = useMemo(() => revenues.filter(r => r.date.startsWith(filterMonth)), [revenues, filterMonth]);
  const filtFixed = useMemo(() => fixedPayments.filter(fp => (fp.due_date||"").startsWith(filterMonth)), [fixedPayments, filterMonth]);
  const filtInst  = useMemo(() => installments.filter(i => (i.due_date||"").startsWith(filterMonth)), [installments, filterMonth]);

  // ── Totais ────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const rec = filtRev.reduce((a,r) => a+Number(r.amount), 0)
              + filtTx.filter(t => t.type==="receita").reduce((a,t) => a+Number(t.value), 0);
    const depTx    = filtTx.filter(t => t.type==="despesa").reduce((a,t) => a+Number(t.value), 0);
    const depFixed = filtFixed.filter(fp => fp.paid).reduce((a,fp) => a+Number(fp.amount), 0);
    const depInst  = filtInst.reduce((a,i) => a+Number(i.amount), 0);
    const dep      = depTx + depFixed + depInst;
    return { rec, dep, bal: rec - dep, depTx, depFixed, depInst };
  }, [filtTx, filtRev, filtFixed, filtInst]);

  // ── Orçamento ─────────────────────────────────────────────────────────────
  const totalBudget = budgets.reduce((a,b) => a+Number(b.amount), 0);
  const budgetPct   = pct(totals.dep, totalBudget);
  const budgetLeft  = totalBudget - totals.dep;

  // ── Ritmo de gastos ───────────────────────────────────────────────────────
  const dailyBudget = useMemo(() => {
    if (totalBudget <= 0) return null;
    const now = new Date();
    const [y,m] = filterMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isThisMonth = now.getFullYear()===y && now.getMonth()+1===m;
    const dayOfMonth  = isThisMonth ? now.getDate() : daysInMonth;
    const daysLeft    = Math.max(daysInMonth - dayOfMonth + 1, 1);
    return { perDay: budgetLeft / daysLeft, daysLeft };
  }, [totalBudget, budgetLeft, filterMonth]);

  // ── Gastos por categoria ──────────────────────────────────────────────────
  const byCat = useMemo(() => {
    const map = {};
    filtTx.filter(t => t.type==="despesa").forEach(t => { map[t.cat] = (map[t.cat]||0)+Number(t.value); });
    filtFixed.filter(fp => fp.paid).forEach(fp => { const c = fp.fixed_expenses?.category||"Fixas"; map[c]=(map[c]||0)+Number(fp.amount); });
    filtInst.forEach(i => { const c = i.purchases?.category||"Compras"; map[c]=(map[c]||0)+Number(i.amount); });
    return Object.entries(map).map(([cat,val]) => ({ cat, val })).sort((a,b) => b.val-a.val);
  }, [filtTx, filtFixed, filtInst]);

  // ── Evolução últimos 6 meses ──────────────────────────────────────────────
  const evolution = useMemo(() => {
    const allMonths = new Set([
      ...transactions.map(t => t.date.slice(0,7)),
      ...revenues.map(r => r.date.slice(0,7)),
    ]);
    return [...allMonths].sort().slice(-6).map(ym => {
      const rec = revenues.filter(r => r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
                + transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const dep = transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
                + fixedPayments.filter(fp=>fp.paid&&(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
                + installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      return { ym, label: mlabel(ym), rec, dep, bal: rec-dep };
    });
  }, [transactions, revenues, fixedPayments, installments]);

  // ── Alertas urgentes ──────────────────────────────────────────────────────
  const urgentAlerts = useMemo(() => alerts.filter(a => a.type==="danger"||a.type==="warning"), [alerts]);

  // ── Parcelas pendentes ────────────────────────────────────────────────────
  const pendingInst = useMemo(() => filtInst.filter(i => !i.paid).slice(0,4), [filtInst]);

  // ── Movimentos recentes ───────────────────────────────────────────────────
  const recent = useMemo(() => {
    const items = [
      ...filtTx.map(t => ({ id:`tx-${t.id}`, date:t.date, desc:t.description, val: t.type==="receita"?+Number(t.value):-Number(t.value), src:"Lançamento" })),
      ...filtRev.map(r => ({ id:`rev-${r.id}`, date:r.date, desc:r.description, val:+Number(r.amount), src:"Receita" })),
      ...filtFixed.filter(fp=>fp.paid).map(fp => ({ id:`fp-${fp.id}`, date:fp.due_date, desc:fp.fixed_expenses?.description||"Fixa", val:-Number(fp.amount), src:"Fixa" })),
    ];
    return items.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
  }, [filtTx, filtRev, filtFixed]);

  const balColor   = totals.bal >= 0 ? "var(--green)" : "var(--red)";
  const budgColor  = budgetPct > 90 ? "var(--red)" : budgetPct > 70 ? "var(--amber, #f59e0b)" : "var(--green)";
  const maxEvol    = Math.max(...evolution.map(e => Math.max(e.rec, e.dep)), 1);

  const PALETTE = ["#7c3aed","#3b82f6","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316"];

  if (loading) return <LoadingSpinner message="Carregando seu painel..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={() => window.location.reload()} />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap: isMobile ? 10 : 12 }}>

      <Checklist onNavigate={onNavigate} onStartTour={onStartTour} />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, var(--accent) 0%, var(--accent2, #5b21b6) 100%)",
        borderRadius:20, padding: isMobile ? "20px" : "28px",
        color:"#fff", position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:180, height:180, borderRadius:"50%", background:"rgba(255,255,255,.07)" }} />
        <div style={{ position:"relative" }}>
          {/* Seletor de mês */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontSize:13, fontWeight:600, opacity:.85 }}>
              {filterMonth === today() ? "Este mês" : mlabel(filterMonth)}
            </span>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{
              background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.25)",
              color:"#fff", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:600,
              cursor:"pointer", outline:"none",
            }}>
              {months.map(m => <option key={m} value={m} style={{ background:"var(--accent)", color:"#fff" }}>{mlabel(m)}</option>)}
            </select>
          </div>

          {/* Saldo */}
          <div style={{ fontSize: isMobile ? 38 : 46, fontWeight:800, letterSpacing:"-.03em", lineHeight:1, marginBottom:4 }}>
            {fmt(totals.bal)}
          </div>
          <div style={{ fontSize:13, opacity:.75, marginBottom:20 }}>
            {totals.bal >= 0 ? "Saldo positivo" : "Gastos acima das receitas"}
          </div>

          {/* Receitas x Despesas */}
          <div style={{ display:"flex", gap: isMobile ? 20 : 40, marginBottom: totalBudget > 0 ? 20 : 0 }}>
            <div>
              <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Receitas</div>
              <div style={{ fontSize: isMobile ? 15 : 18, fontWeight:700 }}>+{fmt(totals.rec)}</div>
            </div>
            <div style={{ width:1, background:"rgba(255,255,255,.2)" }} />
            <div>
              <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Despesas</div>
              <div style={{ fontSize: isMobile ? 15 : 18, fontWeight:700 }}>{fmt(totals.dep)}</div>
            </div>
            {totals.dep > 0 && (
              <>
                <div style={{ width:1, background:"rgba(255,255,255,.2)" }} />
                <div>
                  <div style={{ fontSize:10, opacity:.7, fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginBottom:3 }}>Taxa de gasto</div>
                  <div style={{ fontSize: isMobile ? 15 : 18, fontWeight:700 }}>
                    {totals.rec > 0 ? `${((totals.dep/totals.rec)*100).toFixed(0)}%` : "—"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Barra orçamento */}
          {totalBudget > 0 && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5, opacity:.85 }}>
                <span>Orçamento: {fmt(totalBudget)}</span>
                <span>{budgetPct.toFixed(0)}% usado · {fmt(Math.max(budgetLeft,0))} livre</span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,.2)", borderRadius:99 }}>
                <div style={{ height:"100%", width:`${budgetPct}%`, borderRadius:99, transition:"width .6s", background: budgetPct>90?"#ef4444":budgetPct>70?"#f59e0b":"rgba(255,255,255,.9)" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RITMO DE GASTOS ───────────────────────────────────────────── */}
      {dailyBudget && dailyBudget.perDay > 0 && (
        <Card style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>Ritmo de gastos</div>
            <div style={{ fontSize:13, color:"var(--text)" }}>
              Pode gastar até <strong style={{ color:"var(--green)" }}>{fmt(dailyBudget.perDay)}/dia</strong> pelos próximos {dailyBudget.daysLeft} dias
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize: isMobile?18:22, fontWeight:800, color:"var(--green)" }}>{fmt(dailyBudget.perDay)}</div>
            <div style={{ fontSize:11, color:"var(--muted)" }}>/dia</div>
          </div>
        </Card>
      )}

      {/* ── ALERTAS ──────────────────────────────────────────────────── */}
      {urgentAlerts.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {urgentAlerts.map((a,i) => (
            <div key={i} style={{
              background: a.type==="danger" ? "var(--redbg)" : "#fffbeb",
              border:`1px solid ${a.type==="danger" ? "var(--red)" : "#f59e0b"}33`,
              borderRadius:10, padding:"10px 14px",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{a.type==="danger"?"⚠️":"⚡"}</span>
              <span style={{ fontSize:13, color:"var(--text)", lineHeight:1.5 }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── STATUS CARDS ──────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap: isMobile?8:12 }}>
        <KpiCard
          icon="◑" label="Orçamento"
          value={totalBudget > 0 ? `${budgetPct.toFixed(0)}%` : "Sem orçamento"}
          sub={totalBudget > 0 ? `${fmt(Math.max(budgetLeft,0))} disponível` : "Toque para configurar"}
          color={totalBudget > 0 ? budgColor : "var(--muted)"}
          urgent={budgetPct > 80}
          onClick={() => onNavigate("orcamento")}
        />
        <KpiCard
          icon="💳" label="Parcelas no mês"
          value={fmt(filtInst.reduce((a,i)=>a+Number(i.amount),0))}
          sub={`${filtInst.filter(i=>!i.paid).length} pendente${filtInst.filter(i=>!i.paid).length!==1?"s":""}`}
          color={filtInst.filter(i=>!i.paid).length > 0 ? "var(--red)" : "var(--green)"}
          urgent={filtInst.filter(i=>!i.paid).length > 0}
          onClick={() => onNavigate("gastos")}
        />
        <KpiCard
          icon="📌" label="Despesas fixas"
          value={`${filtFixed.filter(fp=>!fp.paid).length} pendente${filtFixed.filter(fp=>!fp.paid).length!==1?"s":""}`}
          sub={filtFixed.filter(fp=>!fp.paid).length > 0 ? `${fmt(filtFixed.filter(fp=>!fp.paid).reduce((a,fp)=>a+Number(fp.amount),0))} a pagar` : "Tudo pago"}
          color={filtFixed.filter(fp=>!fp.paid).length > 0 ? "#f59e0b" : "var(--green)"}
          urgent={filtFixed.filter(fp=>!fp.paid).length > 0}
          onClick={() => onNavigate("gastos")}
        />
        <KpiCard
          icon="◎" label="Metas"
          value={`${goals.filter(g=>Number(g.saved)>=Number(g.target)).length}/${goals.length}`}
          sub={goals.length > 0 ? `${goals.filter(g=>Number(g.saved)<Number(g.target)).length} em andamento` : "Criar uma meta"}
          color="var(--accent)"
          urgent={false}
          onClick={() => onNavigate("metas")}
        />
      </div>

      {/* ── COMPOSIÇÃO DAS DESPESAS ───────────────────────────────────── */}
      {totals.dep > 0 && (
        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4 }}>Composição das despesas</div>
          <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>De onde vêm seus gastos este mês</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
            {[
              { label:"Avulsos",   val:totals.depTx,    color:"var(--accent)", icon:"💸" },
              { label:"Fixas",     val:totals.depFixed,  color:"#f59e0b",       icon:"📌" },
              { label:"Parcelas",  val:totals.depInst,   color:"#3b82f6",       icon:"💳" },
            ].map(item => (
              <div key={item.label} style={{ background:"var(--bg)", borderRadius:10, padding:"10px 12px", border:"1px solid var(--border)" }}>
                <div style={{ fontSize:13, marginBottom:3 }}>{item.icon}</div>
                <div style={{ fontSize:11, color:"var(--muted)", marginBottom:4 }}>{item.label}</div>
                <div style={{ fontSize:14, fontWeight:800, color:item.color }}>{fmt(item.val)}</div>
                <div style={{ fontSize:10, color:"var(--muted)" }}>{totals.dep>0?`${((item.val/totals.dep)*100).toFixed(0)}%`:"—"}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── GASTOS POR CATEGORIA ─────────────────────────────────────── */}
      {byCat.length > 0 && (
        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:4 }}>Gastos por categoria</div>
          <div style={{ fontSize:12, color:"var(--muted)", marginBottom:14 }}>Total: {fmt(totals.dep)}</div>
          {byCat.slice(0,6).map((item, idx) => (
            <BarH key={item.cat} label={item.cat} value={item.val} total={totals.dep} color={PALETTE[idx % PALETTE.length]} />
          ))}
          {byCat.length > 6 && (
            <button onClick={() => onNavigate("analise")} style={{
              marginTop:8, fontSize:12, color:"var(--accent)", background:"none",
              border:"none", cursor:"pointer", fontWeight:600, padding:0,
            }}>
              Ver todas as {byCat.length} categorias na Análise →
            </button>
          )}
        </Card>
      )}

      {/* ── EVOLUÇÃO 6 MESES ─────────────────────────────────────────── */}
      {evolution.length >= 2 && (
        <Card>
          <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:16 }}>Evolução dos últimos {evolution.length} meses</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {evolution.map(e => (
              <div key={e.ym}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                  <span style={{ fontWeight:600, color:"var(--text)", textTransform:"capitalize", minWidth:40 }}>{e.label}</span>
                  <div style={{ display:"flex", gap:16 }}>
                    <span style={{ color:"var(--green)" }}>+{fmtK(e.rec)}</span>
                    <span style={{ color:"var(--red)" }}>{fmtK(e.dep)}</span>
                    <span style={{ color: e.bal>=0?"var(--accent)":"var(--red)", fontWeight:700 }}>{fmtK(e.bal)}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:3, height:10 }}>
                  <div style={{ height:"100%", background:"var(--green)", borderRadius:99, width:`${(e.rec/maxEvol)*100}%`, opacity:.7 }} />
                  <div style={{ height:"100%", background:"var(--red)", borderRadius:99, width:`${(e.dep/maxEvol)*100}%`, opacity:.7 }} />
                </div>
              </div>
            ))}
            <div style={{ display:"flex", gap:16, fontSize:11, color:"var(--muted)", marginTop:4 }}>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:8, background:"var(--green)", borderRadius:2, opacity:.7, display:"inline-block" }} />Receitas</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:8, background:"var(--red)", borderRadius:2, opacity:.7, display:"inline-block" }} />Despesas</span>
              <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ fontWeight:700, color:"var(--accent)" }}>→</span>Saldo</span>
            </div>
          </div>
          <button onClick={() => onNavigate("analise")} style={{
            marginTop:14, fontSize:12, color:"var(--accent)", background:"none",
            border:"none", cursor:"pointer", fontWeight:600, padding:0,
          }}>
            Ver análise completa →
          </button>
        </Card>
      )}

      {/* ── PARCELAS PENDENTES ────────────────────────────────────────── */}
      {pendingInst.length > 0 && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px 10px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Parcelas pendentes</div>
            <button onClick={() => onNavigate("gastos")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"var(--accent)", fontWeight:600 }}>Ver todas →</button>
          </div>
          {pendingInst.map((inst,i) => (
            <div key={inst.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderTop:"1px solid var(--border)" }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{inst.purchases?.description||"Parcela"}</div>
                <div style={{ fontSize:11, color:"var(--muted)" }}>Vence {inst.due_date}{inst.purchases?.cards?.name&&<span style={{ color:"var(--accent)", marginLeft:5 }}>· {inst.purchases.cards.name}</span>}</div>
              </div>
              <span style={{ fontWeight:700, fontSize:13, color:"var(--red)", flexShrink:0, marginLeft:8 }}>{fmt(inst.amount)}</span>
            </div>
          ))}
        </Card>
      )}

      {/* ── MOVIMENTOS RECENTES ───────────────────────────────────────── */}
      {recent.length > 0 && (
        <Card style={{ padding:0, overflow:"hidden" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px 10px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>Movimentos recentes</div>
            <button onClick={() => onNavigate("historico")} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"var(--accent)", fontWeight:600 }}>Ver histórico →</button>
          </div>
          {recent.map(e => (
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderTop:"1px solid var(--border)" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                <div style={{ width:32, height:32, borderRadius:8, background: e.val>=0?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                  {e.val>=0?"↑":"↓"}
                </div>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
                  <div style={{ fontSize:11, color:"var(--muted)" }}>{e.src} · {e.date}</div>
                </div>
              </div>
              <span style={{ fontWeight:700, fontSize:13, color: e.val>=0?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                {e.val>=0?"+":""}{fmt(Math.abs(e.val))}
              </span>
            </div>
          ))}
        </Card>
      )}

      {recent.length === 0 && byCat.length === 0 && (
        <Card style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", marginBottom:8 }}>Nenhum movimento este mês</div>
          <p style={{ fontSize:13, color:"var(--muted)", marginBottom:20 }}>Registre sua primeira receita ou gasto para começar.</p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={() => onNavigate("receitas")} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--green)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Receita</button>
            <button onClick={() => onNavigate("gastos")} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Gasto</button>
          </div>
        </Card>
      )}

      <HelpButton pageId="dashboard" onNavigate={onNavigate} />
    </div>
  );
}
