import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import { LoadingSpinner, ErrorMessage } from "../components/LoadingSpinner";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const mlabel = (ym) => { const [y,m] = ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"long",year:"numeric"}); };
const mlabelShort = (ym) => { const [y,m] = ym.split("-"); return new Date(+y,+m-1).toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}); };
const today = () => new Date().toISOString().slice(0,7);
const ITEMS = 30;

const SOURCE_CONFIG = {
  "Lançamento":   { icon:"↓", bg:"var(--redbg)",    color:"var(--red)",    label:"Lançamento" },
  "Receita":      { icon:"↑", bg:"var(--greenbg)",  color:"var(--green)",  label:"Receita" },
  "Despesa Fixa": { icon:"📌", bg:"#fffbeb",         color:"#f59e0b",       label:"Fixa" },
  "Parcela":      { icon:"💳", bg:"#eff6ff",         color:"#3b82f6",       label:"Parcela" },
  "Receita Tx":   { icon:"↑", bg:"var(--greenbg)",  color:"var(--green)",  label:"Receita" },
};

const Card = ({ children, style = {} }) => (
  <div style={{ background:"var(--surface)", borderRadius:14, border:"1px solid var(--border)", padding:20, boxShadow:"var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const TABS = [
  { id:"extrato",  label:"Extrato"  },
  { id:"faturas",  label:"Faturas"  },
  { id:"metas",    label:"Metas"    },
  { id:"anual",    label:"Anual"    },
];

export default function Historico({ userId, onNavigate }) {
  const isMobile = useIsMobile();

  const [transactions, setTransactions]     = useState([]);
  const [revenues, setRevenues]             = useState([]);
  const [installments, setInstallments]     = useState([]);
  const [fixedPayments, setFixedPayments]   = useState([]);
  const [goals, setGoals]                   = useState([]);
  const [cards, setCards]                   = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadError, setLoadError]           = useState(null);

  // Filtros do extrato
  const [tab, setTab]                 = useState("extrato");
  const [filterMonth, setFilterMonth] = useState("");          // vazio = todos
  const [filterType, setFilterType]   = useState("all");
  const [filterSrc, setFilterSrc]     = useState("all");
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);

  // Faturas
  const [faturaMes, setFaturaMes]     = useState(today());
  const [faturaCard, setFaturaCard]   = useState("all");

  // Anual
  const [anoSel, setAnoSel]           = useState(new Date().getFullYear().toString());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        { data: t }, { data: r }, { data: i },
        { data: fp }, { data: g }, { data: c },
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(2000),
        supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(2000),
        supabase.from("installments").select("*, purchases(description, category, card_id, cards(name))").eq("user_id", userId).order("due_date", { ascending: false }).limit(2000),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description, category)").eq("user_id", userId).order("due_date", { ascending: false }).limit(1000),
        supabase.from("goals").select("*").eq("user_id", userId),
        supabase.from("cards").select("*").eq("user_id", userId),
      ]);
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setFixedPayments(fp || []);
      setGoals(g || []);
      setCards(c || []);
    } catch (err) {
      setLoadError("Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // ── Todos os meses disponíveis ────────────────────────────────────────────
  const availableMonths = useMemo(() => {
    const s = new Set([
      ...transactions.map(t => t.date.slice(0,7)),
      ...revenues.map(r => r.date.slice(0,7)),
      ...fixedPayments.map(fp => (fp.due_date||"").slice(0,7)).filter(Boolean),
      ...installments.map(i => (i.due_date||"").slice(0,7)).filter(Boolean),
    ]);
    return [...s].filter(Boolean).sort().reverse();
  }, [transactions, revenues, fixedPayments, installments]);

  const availableYears = useMemo(() => {
    const s = new Set([
      ...transactions.map(t => t.date.slice(0,4)),
      ...revenues.map(r => r.date.slice(0,4)),
    ]);
    return [...s].sort().reverse();
  }, [transactions, revenues]);

  // ── Extrato unificado ─────────────────────────────────────────────────────
  const allEntries = useMemo(() => {
    const items = [
      ...transactions.map(t => ({
        id:`tx-${t.id}`, date:t.date,
        desc:t.description, cat:t.cat,
        val: t.type==="receita" ? +Number(t.value) : -Number(t.value),
        src: t.type==="receita" ? "Receita Tx" : "Lançamento",
        type: t.type,
      })),
      ...revenues.map(r => ({
        id:`rev-${r.id}`, date:r.date,
        desc:r.description, cat:r.category||"Receita",
        val:+Number(r.amount), src:"Receita", type:"receita",
      })),
      ...fixedPayments.map(fp => ({
        id:`fp-${fp.id}`, date:fp.due_date,
        desc:fp.fixed_expenses?.description||"Despesa Fixa",
        cat:fp.fixed_expenses?.category||"Fixas",
        val:-Number(fp.amount), src:"Despesa Fixa", type:"despesa",
        paid:fp.paid,
      })),
      ...installments.map(i => ({
        id:`inst-${i.id}`, date:i.due_date,
        desc:i.purchases?.description||"Parcela",
        cat:i.purchases?.category||"Compras",
        val:-Number(i.amount), src:"Parcela", type:"despesa",
        paid:i.paid, cardName:i.purchases?.cards?.name,
        instNum:i.installment_number,
      })),
    ];
    return items.sort((a,b) => b.date.localeCompare(a.date));
  }, [transactions, revenues, fixedPayments, installments]);

  // ── Filtra o extrato ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allEntries;
    if (filterMonth) list = list.filter(e => e.date.startsWith(filterMonth));
    if (filterType !== "all") list = list.filter(e => e.type === filterType);
    if (filterSrc  !== "all") list = list.filter(e => e.src === filterSrc);
    if (search) list = list.filter(e =>
      e.desc.toLowerCase().includes(search.toLowerCase()) ||
      e.cat.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [allEntries, filterMonth, filterType, filterSrc, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS);
  const paginated  = filtered.slice((page-1)*ITEMS, page*ITEMS);
  const totalRec   = filtered.filter(e=>e.type==="receita").reduce((a,e)=>a+Math.abs(e.val),0);
  const totalDep   = filtered.filter(e=>e.type==="despesa").reduce((a,e)=>a+Math.abs(e.val),0);

  const exportCSV = () => {
    const rows = [["Data","Tipo","Descrição","Categoria","Valor","Origem","Status"],
      ...filtered.map(e=>[e.date,e.type,e.desc,e.cat,Math.abs(e.val).toFixed(2),e.src,e.paid===false?"Pendente":e.paid===true?"Pago":""])];
    const csv = rows.map(r=>r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="historico.csv"; a.click();
  };

  // ── Faturas ───────────────────────────────────────────────────────────────
  const faturaMonths = useMemo(() => {
    const list = faturaCard==="all" ? installments : installments.filter(i=>i.purchases?.card_id===faturaCard);
    return [...new Set(list.map(i=>(i.due_date||"").slice(0,7)).filter(Boolean))].sort().reverse();
  }, [installments, faturaCard]);

  const faturaItems = useMemo(() => {
    const list = faturaCard==="all" ? installments : installments.filter(i=>i.purchases?.card_id===faturaCard);
    return list.filter(i=>(i.due_date||"").startsWith(faturaMes));
  }, [installments, faturaCard, faturaMes]);

  const faturaTotal = faturaItems.reduce((a,i)=>a+Number(i.amount),0);
  const faturaPago  = faturaItems.filter(i=>i.paid).reduce((a,i)=>a+Number(i.amount),0);

  // ── Anual ─────────────────────────────────────────────────────────────────
  const annualData = useMemo(() => {
    return Array.from({length:12},(_,idx)=>{
      const m  = idx+1;
      const ym = `${anoSel}-${String(m).padStart(2,"0")}`;
      const rec = revenues.filter(r=>r.date.startsWith(ym)).reduce((a,r)=>a+Number(r.amount),0)
                + transactions.filter(t=>t.date.startsWith(ym)&&t.type==="receita").reduce((a,t)=>a+Number(t.value),0);
      const dep = transactions.filter(t=>t.date.startsWith(ym)&&t.type==="despesa").reduce((a,t)=>a+Number(t.value),0)
                + fixedPayments.filter(fp=>fp.paid&&(fp.due_date||"").startsWith(ym)).reduce((a,fp)=>a+Number(fp.amount),0)
                + installments.filter(i=>(i.due_date||"").startsWith(ym)).reduce((a,i)=>a+Number(i.amount),0);
      return { ym, label:new Date(+anoSel,idx).toLocaleDateString("pt-BR",{month:"short"}), rec, dep, bal:rec-dep };
    });
  }, [anoSel, transactions, revenues, fixedPayments, installments]);

  const annualTotals = {
    rec:  annualData.reduce((a,d)=>a+d.rec,0),
    dep:  annualData.reduce((a,d)=>a+d.dep,0),
    bal:  annualData.reduce((a,d)=>a+d.bal,0),
  };
  const maxAnnual = Math.max(...annualData.map(d=>Math.max(d.rec,d.dep)),1);

  // ── Metas ─────────────────────────────────────────────────────────────────
  const donGoals    = useMemo(()=>goals.filter(g=>Number(g.saved)>=Number(g.target)),[goals]);
  const activeGoals = useMemo(()=>goals.filter(g=>Number(g.saved)<Number(g.target)),[goals]);

  if (loading) return <LoadingSpinner message="Carregando histórico..." />;
  if (loadError) return <ErrorMessage message={loadError} onRetry={load} />;

  return (
    <div>
      {!isMobile && (
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontWeight:800, fontSize:24, color:"var(--text)", letterSpacing:"-.03em" }}>Histórico</h1>
          <p style={{ color:"var(--muted)", fontSize:14, marginTop:4 }}>Tudo que aconteceu nas suas finanças, organizado e fácil de encontrar</p>
        </div>
      )}

      {/* Abas */}
      <div style={{
        display:"flex", gap:2, marginBottom:14,
        background:"var(--surface)", borderRadius:12, padding:4,
        border:"1px solid var(--border)",
        overflowX:"auto", WebkitOverflowScrolling:"touch", scrollbarWidth:"none",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>{ setTab(t.id); setPage(1); }} style={{
            flex:1, padding: isMobile?"9px 10px":"8px 16px",
            borderRadius:9, border:"none", cursor:"pointer",
            fontWeight:600, fontSize: isMobile?13:13,
            background: tab===t.id ? "var(--accent)" : "transparent",
            color: tab===t.id ? "#fff" : "var(--muted)",
            whiteSpace:"nowrap", transition:"all .15s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── EXTRATO ───────────────────────────────────────────────────── */}
      {tab === "extrato" && (
        <div>
          {/* KPIs do filtro atual */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap: isMobile?8:12, marginBottom:14 }}>
            {[
              { label:"Receitas",  val:totalRec, color:"var(--green)" },
              { label:"Despesas",  val:totalDep, color:"var(--red)" },
              { label:"Saldo",     val:totalRec-totalDep, color:totalRec-totalDep>=0?"var(--accent)":"var(--red)" },
            ].map(k=>(
              <Card key={k.label} style={{ padding: isMobile?"10px 12px":16 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{k.label}</div>
                <div style={{ fontSize: isMobile?13:18, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
              </Card>
            ))}
          </div>

          <Card>
            {/* Filtros, linha 1: mês + tipo + origem */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <select value={filterMonth} onChange={e=>{ setFilterMonth(e.target.value); setPage(1); }}
                  style={{ flex:1, minWidth:120, padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
                  <option value="">Todos os meses</option>
                  {availableMonths.map(m=><option key={m} value={m}>{mlabel(m)}</option>)}
                </select>
                <select value={filterType} onChange={e=>{ setFilterType(e.target.value); setPage(1); }}
                  style={{ flex:1, minWidth:100, padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
                  <option value="all">Receitas e despesas</option>
                  <option value="receita">Só receitas</option>
                  <option value="despesa">Só despesas</option>
                </select>
                <select value={filterSrc} onChange={e=>{ setFilterSrc(e.target.value); setPage(1); }}
                  style={{ flex:1, minWidth:100, padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
                  <option value="all">Todas as origens</option>
                  <option value="Lançamento">Lançamentos</option>
                  <option value="Receita">Receitas</option>
                  <option value="Receita Tx">Receitas (tx)</option>
                  <option value="Despesa Fixa">Despesas Fixas</option>
                  <option value="Parcela">Parcelas</option>
                </select>
              </div>
              {/* Linha 2: busca + CSV + limpar */}
              <div style={{ display:"flex", gap:8 }}>
                <input value={search} onChange={e=>{ setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar por descrição ou categoria..."
                  style={{ flex:1, padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }} />
                <button onClick={exportCSV} style={{ padding:"9px 14px", borderRadius:8, border:"none", background:"var(--accentbg)", color:"var(--accent)", fontWeight:700, fontSize:12, cursor:"pointer", flexShrink:0 }}>
                  CSV
                </button>
                {(filterMonth||filterType!=="all"||filterSrc!=="all"||search) && (
                  <button onClick={()=>{ setFilterMonth(""); setFilterType("all"); setFilterSrc("all"); setSearch(""); setPage(1); }}
                    style={{ padding:"9px 12px", borderRadius:8, border:"none", background:"var(--redbg)", color:"var(--red)", fontWeight:600, fontSize:12, cursor:"pointer", flexShrink:0 }}>
                    Limpar
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>
              {filtered.length} registro{filtered.length!==1?"s":""} encontrado{filtered.length!==1?"s":""}
              {filterMonth && ` · ${mlabel(filterMonth)}`}
            </div>

            {/* Lista */}
            {paginated.length === 0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"32px 0", fontSize:13 }}>
                  Nenhum registro encontrado.{" "}
                  {filterMonth && <button onClick={()=>setFilterMonth("")} style={{ color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600, fontSize:13 }}>Ver todos os meses</button>}
                </div>
              : paginated.map((e,i) => {
                  const s = SOURCE_CONFIG[e.src] || SOURCE_CONFIG["Lançamento"];
                  return (
                    <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i<paginated.length-1?"1px solid var(--border)":"none" }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                        <div style={{ width:34, height:34, borderRadius:9, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0, color:s.color }}>
                          {s.icon}
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.desc}</div>
                          <div style={{ display:"flex", gap:5, flexWrap:"wrap", fontSize:11, color:"var(--muted)", marginTop:2, alignItems:"center" }}>
                            <span>{e.cat}</span>
                            <span>·</span>
                            <span>{e.date}</span>
                            <span style={{ background:s.bg, color:s.color, borderRadius:99, padding:"1px 6px", fontWeight:600, fontSize:10 }}>{s.label}</span>
                            {e.cardName && <span style={{ color:"var(--accent)" }}>· {e.cardName}</span>}
                            {e.instNum  && <span>· Parcela {e.instNum}</span>}
                            {e.paid===false && <span style={{ color:"#f59e0b", fontWeight:600 }}>Pendente</span>}
                            {e.paid===true  && <span style={{ color:"var(--green)", fontWeight:600 }}>Pago</span>}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontWeight:700, fontSize:13, color:e.val>=0?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>
                        {e.val>=0?"+":""}{fmt(Math.abs(e.val))}
                      </span>
                    </div>
                  );
                })
            }

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  style={{ padding:"7px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color: page===1?"var(--muted)":"var(--text)", cursor: page===1?"not-allowed":"pointer", fontSize:13 }}>← Anterior</button>
                <span style={{ fontSize:13, color:"var(--muted)" }}>Página {page} de {totalPages} · {filtered.length} registros</span>
                <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
                  style={{ padding:"7px 16px", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color: page===totalPages?"var(--muted)":"var(--text)", cursor: page===totalPages?"not-allowed":"pointer", fontSize:13 }}>Próxima →</button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── FATURAS ───────────────────────────────────────────────────── */}
      {tab === "faturas" && (
        <div>
          <Card style={{ marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Cartão</div>
                <select value={faturaCard} onChange={e=>{ setFaturaCard(e.target.value); }}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
                  <option value="all">Todos os cartões</option>
                  {cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--muted)", marginBottom:5, textTransform:"uppercase", letterSpacing:".05em" }}>Mês</div>
                <select value={faturaMes} onChange={e=>setFaturaMes(e.target.value)}
                  style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13 }}>
                  {faturaMonths.map(m=><option key={m} value={m}>{mlabel(m)}</option>)}
                  {faturaMonths.length===0 && <option value={today()}>{mlabel(today())}</option>}
                </select>
              </div>
            </div>
          </Card>

          {/* KPIs fatura */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap: isMobile?8:12, marginBottom:14 }}>
            {[
              { label:"Total fatura", val:faturaTotal, color:"var(--text)" },
              { label:"Pago",         val:faturaPago,  color:"var(--green)" },
              { label:"Em aberto",    val:faturaTotal-faturaPago, color:faturaTotal-faturaPago>0?"var(--red)":"var(--green)" },
            ].map(k=>(
              <Card key={k.label} style={{ padding: isMobile?"10px 12px":16 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>{k.label}</div>
                <div style={{ fontSize: isMobile?13:16, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
              </Card>
            ))}
          </div>

          <Card>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:14 }}>
              Parcelas de {mlabel(faturaMes)}
            </div>
            {faturaItems.length === 0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhuma parcela neste mês</div>
              : faturaItems.map((inst,i) => (
                <div key={inst.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: i<faturaItems.length-1?"1px solid var(--border)":"none", opacity:inst.paid?.5:1 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                    <div style={{ width:20, height:20, borderRadius:6, border:"2px solid", borderColor:inst.paid?"var(--green)":"var(--border)", background:inst.paid?"var(--green)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", flexShrink:0 }}>
                      {inst.paid?"✓":""}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:"var(--text)", textDecoration:inst.paid?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {inst.purchases?.description}
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>
                        Parcela {inst.installment_number} · {inst.due_date}
                        {inst.purchases?.cards?.name && <span style={{ color:"var(--accent)", marginLeft:5 }}>· {inst.purchases.cards.name}</span>}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13, color:inst.paid?"var(--green)":"var(--red)", flexShrink:0, marginLeft:8 }}>{fmt(inst.amount)}</span>
                </div>
              ))
            }
          </Card>
        </div>
      )}

      {/* ── METAS ─────────────────────────────────────────────────────── */}
      {tab === "metas" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {donGoals.length > 0 && (
            <Card>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--green)", marginBottom:14 }}>Metas concluídas ({donGoals.length})</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"repeat(auto-fill,minmax(220px,1fr))", gap:12 }}>
                {donGoals.map(g=>(
                  <div key={g.id} style={{ background:"var(--bg)", borderRadius:10, padding:14, border:"1.5px solid var(--green)33" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:8 }}>{g.name}</div>
                    <div style={{ height:6, background:"var(--border)", borderRadius:99, marginBottom:8 }}>
                      <div style={{ height:"100%", width:"100%", background:"var(--green)", borderRadius:99 }} />
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                      <span style={{ color:"var(--green)", fontWeight:700 }}>Concluída!</span>
                      <span style={{ color:"var(--muted)" }}>{fmt(g.target)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          {activeGoals.length > 0 && (
            <Card>
              <div style={{ fontWeight:700, fontSize:14, color:"var(--accent)", marginBottom:14 }}>Em andamento ({activeGoals.length})</div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"repeat(auto-fill,minmax(220px,1fr))", gap:12 }}>
                {activeGoals.map(g=>{
                  const p = Math.min((Number(g.saved)/Number(g.target))*100,100);
                  return (
                    <div key={g.id} style={{ background:"var(--bg)", borderRadius:10, padding:14, border:"1px solid var(--border)" }}>
                      <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:8 }}>{g.name}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"var(--muted)", marginBottom:6 }}>
                        <span>{fmt(g.saved)}</span><span>{fmt(g.target)}</span>
                      </div>
                      <div style={{ height:6, background:"var(--border)", borderRadius:99, marginBottom:6 }}>
                        <div style={{ height:"100%", width:`${p}%`, background:"var(--accent)", borderRadius:99 }} />
                      </div>
                      <div style={{ fontSize:11, color:"var(--accent)", fontWeight:600 }}>{p.toFixed(0)}% concluído</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          {goals.length === 0 && (
            <Card style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--text)", marginBottom:8 }}>Nenhuma meta cadastrada</div>
              <button onClick={()=>onNavigate("metas")} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                Criar uma meta
              </button>
            </Card>
          )}
        </div>
      )}

      {/* ── ANUAL ─────────────────────────────────────────────────────── */}
      {tab === "anual" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", gap:8 }}>
            <select value={anoSel} onChange={e=>setAnoSel(e.target.value)}
              style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:13, fontWeight:600 }}>
              {availableYears.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* KPIs anuais */}
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(3,1fr)", gap: isMobile?8:12 }}>
            {[
              { label:"Total Receitas", val:annualTotals.rec, color:"var(--green)" },
              { label:"Total Despesas", val:annualTotals.dep, color:"var(--red)" },
              { label:"Saldo do Ano",   val:annualTotals.bal, color:annualTotals.bal>=0?"var(--accent)":"var(--red)" },
            ].map(k=>(
              <Card key={k.label} style={{ padding: isMobile?"12px 14px":18 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:6 }}>{k.label}</div>
                <div style={{ fontSize: isMobile?15:20, fontWeight:800, color:k.color }}>{fmt(k.val)}</div>
              </Card>
            ))}
          </div>

          <Card>
            <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:16 }}>Mês a mês, {anoSel}</div>
            {annualData.map((d,i)=>(
              <div key={d.ym} style={{ padding:"10px 0", borderBottom: i<11?"1px solid var(--border)":"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <span style={{ fontWeight:600, fontSize:13, color:"var(--text)", textTransform:"capitalize", minWidth:36 }}>{d.label}</span>
                  <div style={{ display:"flex", gap: isMobile?8:20, fontSize:12 }}>
                    {!isMobile && <span style={{ color:"var(--green)" }}>+{fmt(d.rec)}</span>}
                    {!isMobile && <span style={{ color:"var(--red)" }}>{fmt(d.dep)}</span>}
                    <span style={{ fontWeight:800, color:d.bal>=0?"var(--accent)":"var(--red)" }}>{d.bal>=0?"+":""}{fmt(d.bal)}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:3, height:8 }}>
                  <div style={{ height:"100%", width:`${(d.rec/maxAnnual)*100}%`, background:"var(--green)", borderRadius:99, opacity:.7 }} />
                  <div style={{ height:"100%", width:`${(d.dep/maxAnnual)*100}%`, background:"var(--red)", borderRadius:99, opacity:.7 }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <HelpButton pageId="historico" onNavigate={onNavigate} />
    </div>
  );
}
