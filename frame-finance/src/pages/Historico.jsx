import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
const ITEMS_PER_PAGE = 20;

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const inp = {
  padding: "9px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 13, outline: "none",
};

const TABS = ["Extrato Unificado", "Faturas", "Metas Concluídas", "Resumo Anual"];

export default function Historico({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [tab, setTab]                   = useState("Extrato Unificado");
  const [transactions, setTransactions] = useState([]);
  const [revenues, setRevenues]         = useState([]);
  const [installments, setInstallments] = useState([]);
  const [goals, setGoals]               = useState([]);
  const [cards, setCards]               = useState([]);
  const [fixedPayments, setFixedPayments] = useState([]);

  // Filters
  const [search, setSearch]       = useState("");
  const [filterType, setFilterType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [filterCard, setFilterCard] = useState("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear().toString());
  const [page, setPage]           = useState(1);

  useEffect(() => {
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(1000),
      supabase.from("revenues").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(1000),
      supabase.from("installments").select("*, purchases(description, category, card_id, cards(name))").eq("user_id", userId).order("due_date", { ascending: false }).limit(1000),
      supabase.from("goals").select("*").eq("user_id", userId),
      supabase.from("cards").select("*").eq("user_id", userId),
      supabase.from("fixed_expense_payments").select("*, fixed_expenses(description, category)").eq("user_id", userId).order("due_date", { ascending: false }).limit(500),
    ]).then(([{ data: t }, { data: r }, { data: i }, { data: g }, { data: c }, { data: fp }]) => {
      setTransactions(t || []);
      setRevenues(r || []);
      setInstallments(i || []);
      setGoals(g || []);
      setCards(c || []);
      setFixedPayments(fp || []);
    });
  }, [userId]);

  // ── Extrato Unificado ────────────────────────────────────────────────────
  const allEntries = useMemo(() => {
    const entries = [
      ...transactions.map(t => ({ id: t.id, date: t.date, description: t.description, category: t.cat, type: t.type === "receita" ? "receita" : "despesa", value: Number(t.value), source: "Lançamento" })),
      ...revenues.map(r => ({ id: r.id, date: r.date, description: r.description, category: r.category, type: "receita", value: Number(r.amount), source: "Receita" })),
      ...fixedPayments.map(p => ({ id: p.id, date: p.due_date, description: p.fixed_expenses?.description || "-", category: p.fixed_expenses?.category || "-", type: "despesa", value: Number(p.amount), source: "Despesa Fixa", paid: p.paid })),
    ];
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, revenues, fixedPayments]);

  const filteredEntries = useMemo(() => {
    let list = allEntries;
    if (search) list = list.filter(e => e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()));
    if (filterType !== "all") list = list.filter(e => e.type === filterType);
    if (startDate) list = list.filter(e => e.date >= startDate);
    if (endDate) list = list.filter(e => e.date <= endDate);
    return list;
  }, [allEntries, search, filterType, startDate, endDate]);

  const totalPages = Math.ceil(filteredEntries.length / ITEMS_PER_PAGE);
  const paginated  = filteredEntries.slice((page-1)*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE);

  const totalRec = filteredEntries.filter(e => e.type === "receita").reduce((a, e) => a + e.value, 0);
  const totalDep = filteredEntries.filter(e => e.type === "despesa").reduce((a, e) => a + e.value, 0);

  const exportCSV = () => {
    const rows = [["Data","Tipo","Descrição","Categoria","Valor","Origem"],
      ...filteredEntries.map(e => [e.date, e.type, e.description, e.category, e.value, e.source])];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF"+csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="historico-frame-finance.csv"; a.click();
  };

  // ── Faturas por cartão ───────────────────────────────────────────────────
  const cardMonths = useMemo(() => {
    const selectedCardInst = filterCard === "all"
      ? installments
      : installments.filter(i => i.purchases?.card_id === filterCard);
    const months = [...new Set(selectedCardInst.map(i => i.due_date.slice(0,7)))].sort().reverse();
    return months;
  }, [installments, filterCard]);

  const invoiceData = useMemo(() => {
    if (!filterMonth) return [];
    const cardInst = filterCard === "all"
      ? installments.filter(i => i.due_date.startsWith(filterMonth))
      : installments.filter(i => i.purchases?.card_id === filterCard && i.due_date.startsWith(filterMonth));
    return cardInst;
  }, [installments, filterCard, filterMonth]);

  const invoiceTotal = invoiceData.reduce((a, i) => a + Number(i.amount), 0);
  const invoicePaid  = invoiceData.filter(i => i.paid).reduce((a, i) => a + Number(i.amount), 0);

  // ── Metas concluídas ─────────────────────────────────────────────────────
  const completedGoals = useMemo(() => goals.filter(g => Number(g.saved) >= Number(g.target)), [goals]);
  const activeGoals    = useMemo(() => goals.filter(g => Number(g.saved) < Number(g.target)), [goals]);

  // ── Resumo Anual ─────────────────────────────────────────────────────────
  const years = useMemo(() => {
    const s = new Set([...transactions.map(t => t.date.slice(0,4)), ...revenues.map(r => r.date.slice(0,4))]);
    return [...s].sort().reverse();
  }, [transactions, revenues]);

  const annualData = useMemo(() => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const ym = `${filterYear}-${String(m).padStart(2,"0")}`;
      const rec = revenues.filter(r => r.date.startsWith(ym)).reduce((a,r) => a+Number(r.amount), 0) +
                  transactions.filter(t => t.date.startsWith(ym) && t.type==="receita").reduce((a,t) => a+Number(t.value), 0);
      const dep = transactions.filter(t => t.date.startsWith(ym) && t.type==="despesa").reduce((a,t) => a+Number(t.value), 0);
      const label = new Date(+filterYear, m-1).toLocaleDateString("pt-BR", { month:"short" });
      months.push({ month: label, ym, rec, dep, bal: rec-dep });
    }
    return months;
  }, [filterYear, transactions, revenues]);

  const annualTotals = {
    rec: annualData.reduce((a,d) => a+d.rec, 0),
    dep: annualData.reduce((a,d) => a+d.dep, 0),
    bal: annualData.reduce((a,d) => a+d.bal, 0),
    best:  annualData.reduce((a,d) => d.bal > a.bal ? d : a, annualData[0] || {}),
    worst: annualData.reduce((a,d) => d.bal < a.bal ? d : a, annualData[0] || {}),
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Histórico</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "historico"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Todo o seu histórico financeiro em um lugar só</p>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:2, marginBottom:20, background:"var(--surface)", borderRadius:10, padding:4, width:"fit-content", border:"1px solid var(--border)", flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"7px 14px", borderRadius:7, border:"none", cursor:"pointer",
            fontWeight:600, fontSize:12,
            background: tab===t ? "var(--accent)" : "transparent",
            color: tab===t ? "#fff" : "var(--muted)",
            transition:"all .15s",
          }}>{t}</button>
        ))}
      </div>

      {/* ── EXTRATO UNIFICADO ── */}
      {tab === "Extrato Unificado" && (
        <div>
          {/* Summary */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
            {[
              { label:"Total Receitas",  value:fmt(totalRec), color:"var(--green)" },
              { label:"Total Despesas",  value:fmt(totalDep), color:"var(--red)" },
              { label:"Saldo Filtrado",  value:fmt(totalRec-totalDep), color:totalRec-totalDep>=0?"var(--accent)":"var(--red)" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
              </Card>
            ))}
          </div>

          <Card>
            {/* Filters */}
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 Buscar..." style={{ ...inp, width:180 }} />
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} style={{ ...inp }}>
                <option value="all">Todos</option>
                <option value="receita">Receitas</option>
                <option value="despesa">Despesas</option>
              </select>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} style={inp} placeholder="De" />
              <input type="date" value={endDate}   onChange={e => { setEndDate(e.target.value); setPage(1); }} style={inp} placeholder="Até" />
              {(search || filterType !== "all" || startDate || endDate) && (
                <button onClick={() => { setSearch(""); setFilterType("all"); setStartDate(""); setEndDate(""); setPage(1); }} style={{ ...inp, background:"var(--redbg)", color:"var(--red)", cursor:"pointer", border:"none", fontWeight:600 }}>
                  Limpar
                </button>
              )}
              <button onClick={exportCSV} style={{ ...inp, background:"var(--accentbg)", color:"var(--accent)", cursor:"pointer", border:"none", fontWeight:600, marginLeft:"auto" }}>
                ⬇ CSV
              </button>
            </div>
            <div style={{ fontSize:12, color:"var(--muted)", marginBottom:12 }}>{filteredEntries.length} registros encontrados</div>

            {paginated.length === 0
              ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"28px 0", fontSize:13 }}>Nenhum registro encontrado</div>
              : paginated.map((e, i) => (
                <div key={`${e.source}-${e.id}`} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<paginated.length-1?"1px solid var(--border)":"none" }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:e.type==="receita"?"var(--greenbg)":"var(--redbg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                      {e.type==="receita"?"↑":"↓"}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)" }}>{e.description}</div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>
                        {e.category} · {e.date}
                        <span style={{ marginLeft:6, background:"var(--border)", borderRadius:99, padding:"1px 6px", fontSize:10 }}>{e.source}</span>
                        {e.paid !== undefined && (
                          <span style={{ marginLeft:4, color: e.paid ? "var(--green)" : "var(--muted)" }}>{e.paid ? "· Paga" : "· Pendente"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13, color:e.type==="receita"?"var(--green)":"var(--red)" }}>
                    {e.type==="receita"?"+":"-"}{fmt(e.value)}
                  </span>
                </div>
              ))
            }

            {totalPages > 1 && (
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid var(--border)" }}>
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:page===1?"var(--muted)":"var(--text)", cursor:page===1?"not-allowed":"pointer", fontSize:13 }}>← Anterior</button>
                <span style={{ fontSize:13, color:"var(--muted)" }}>Página {page} de {totalPages}</span>
                <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", color:page===totalPages?"var(--muted)":"var(--text)", cursor:page===totalPages?"not-allowed":"pointer", fontSize:13 }}>Próxima →</button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── FATURAS ── */}
      {tab === "Faturas" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <select value={filterCard} onChange={e => { setFilterCard(e.target.value); setFilterMonth(""); }} style={inp}>
              <option value="all">Todos os cartões</option>
              {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {cardMonths.length > 0 && (
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={inp}>
                <option value="">Selecionar mês...</option>
                {cardMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            )}
          </div>

          {filterMonth && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
                {[
                  { label:"Total da fatura",  value:fmt(invoiceTotal),              color:"var(--text)" },
                  { label:"Pago",              value:fmt(invoicePaid),               color:"var(--green)" },
                  { label:"Em aberto",         value:fmt(invoiceTotal-invoicePaid),  color:invoiceTotal-invoicePaid>0?"var(--red)":"var(--green)" },
                ].map(({ label, value, color }) => (
                  <Card key={label}>
                    <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
                    <div style={{ fontSize:20, fontWeight:800, color }}>{value}</div>
                  </Card>
                ))}
              </div>
              <Card>
                <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Parcelas de {monthLabel(filterMonth)}</div>
                {invoiceData.length === 0
                  ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"24px 0", fontSize:13 }}>Nenhuma parcela neste mês</div>
                  : invoiceData.map((inst, i) => (
                    <div key={inst.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:i<invoiceData.length-1?"1px solid var(--border)":"none", opacity:inst.paid?.5:1 }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <div style={{ width:20, height:20, borderRadius:5, border:"2px solid", borderColor:inst.paid?"var(--green)":"var(--border)", background:inst.paid?"var(--green)":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff" }}>
                          {inst.paid?"✓":""}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", textDecoration:inst.paid?"line-through":"none" }}>{inst.purchases?.description}</div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>
                            Parcela {inst.installment_number} · {inst.due_date}
                            {inst.purchases?.cards?.name && <span style={{ color:"var(--accent)", marginLeft:5 }}>· {inst.purchases.cards.name}</span>}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontWeight:700, fontSize:13, color:inst.paid?"var(--green)":"var(--red)" }}>{fmt(inst.amount)}</span>
                    </div>
                  ))
                }
              </Card>
            </>
          )}
          {!filterMonth && <div style={{ color:"var(--muted)", textAlign:"center", padding:"40px 0", fontSize:13 }}>Selecione um mês para ver as faturas</div>}
        </div>
      )}

      {/* ── METAS CONCLUÍDAS ── */}
      {tab === "Metas Concluídas" && (
        <div>
          {completedGoals.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--green)", marginBottom:14 }}>🎉 Metas alcançadas ({completedGoals.length})</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:12 }}>
                {completedGoals.map(g => (
                  <Card key={g.id} style={{ borderTop:"3px solid var(--green)" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:8 }}>{g.name}</div>
                    <div style={{ fontSize:13, color:"var(--muted)", marginBottom:8 }}>
                      Objetivo: <strong style={{ color:"var(--text)" }}>{fmt(g.target)}</strong>
                    </div>
                    <div style={{ height:6, background:"var(--border)", borderRadius:99, marginBottom:8 }}>
                      <div style={{ height:"100%", width:"100%", background:"var(--green)", borderRadius:99 }} />
                    </div>
                    <div style={{ fontSize:12, color:"var(--green)", fontWeight:700 }}>✓ Meta concluída!</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>Guardado: {fmt(g.saved)}</div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {activeGoals.length > 0 && (
            <div>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--accent)", marginBottom:14 }}>Em andamento ({activeGoals.length})</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:12 }}>
                {activeGoals.map(g => {
                  const pct = Math.min((Number(g.saved)/Number(g.target))*100, 100);
                  return (
                    <Card key={g.id}>
                      <div style={{ fontWeight:700, fontSize:14, color:"var(--text)", marginBottom:8 }}>{g.name}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--muted)", marginBottom:8 }}>
                        <span>Guardado: <b style={{ color:"var(--text)" }}>{fmt(g.saved)}</b></span>
                        <span>Meta: <b style={{ color:"var(--text)" }}>{fmt(g.target)}</b></span>
                      </div>
                      <div style={{ height:6, background:"var(--border)", borderRadius:99, marginBottom:6 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:"var(--accent)", borderRadius:99 }} />
                      </div>
                      <div style={{ fontSize:12, color:"var(--accent)", fontWeight:600 }}>{pct.toFixed(0)}% concluído</div>
                      <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>Faltam {fmt(Number(g.target)-Number(g.saved))}</div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          {goals.length === 0 && <div style={{ color:"var(--muted)", textAlign:"center", padding:"40px 0", fontSize:13 }}>Nenhuma meta cadastrada</div>}
        </div>
      )}

      {/* ── RESUMO ANUAL ── */}
      {tab === "Resumo Anual" && (
        <div>
          <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"center" }}>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ ...inp, fontWeight:600 }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:16 }}>
            {[
              { label:"Total Receitas",  value:fmt(annualTotals.rec), color:"var(--green)" },
              { label:"Total Despesas",  value:fmt(annualTotals.dep), color:"var(--red)" },
              { label:"Saldo do Ano",    value:fmt(annualTotals.bal), color:annualTotals.bal>=0?"var(--accent)":"var(--red)" },
              { label:"Média mensal",    value:fmt(annualTotals.dep/12), color:"var(--muted)" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>{label}</div>
                <div style={{ fontSize:18, fontWeight:800, color }}>{value}</div>
              </Card>
            ))}
          </div>

          {annualTotals.best && annualTotals.worst && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              <Card style={{ borderTop:"3px solid var(--green)" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Melhor mês</div>
                <div style={{ fontWeight:800, fontSize:16, color:"var(--green)", textTransform:"capitalize" }}>{annualTotals.best.month}</div>
                <div style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>Saldo: <b style={{ color:"var(--green)" }}>{fmt(annualTotals.best.bal)}</b></div>
              </Card>
              <Card style={{ borderTop:"3px solid var(--red)" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:8 }}>Pior mês</div>
                <div style={{ fontWeight:800, fontSize:16, color:"var(--red)", textTransform:"capitalize" }}>{annualTotals.worst.month}</div>
                <div style={{ fontSize:13, color:"var(--muted)", marginTop:4 }}>Saldo: <b style={{ color:"var(--red)" }}>{fmt(annualTotals.worst.bal)}</b></div>
              </Card>
            </div>
          )}

          <Card>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:16, color:"var(--text)" }}>Mês a mês, {filterYear}</div>
            {annualData.map((d, i) => {
              const maxVal = Math.max(...annualData.map(x => Math.max(x.rec, x.dep)), 1);
              const recPct = (d.rec/maxVal)*100;
              const depPct = (d.dep/maxVal)*100;
              return (
                <div key={d.ym} style={{ padding:"10px 0", borderBottom:i<11?"1px solid var(--border)":"none" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--text)", textTransform:"capitalize", width:40 }}>{d.month}</span>
                    <div style={{ flex:1, margin:"0 16px" }}>
                      <div style={{ display:"flex", gap:4, marginBottom:3 }}>
                        <div style={{ height:7, width:`${recPct}%`, background:"var(--green)", borderRadius:99, transition:"width .4s", maxWidth:"100%" }} />
                      </div>
                      <div style={{ display:"flex", gap:4 }}>
                        <div style={{ height:7, width:`${depPct}%`, background:"var(--red)", borderRadius:99, transition:"width .4s", maxWidth:"100%" }} />
                      </div>
                    </div>
                    <div style={{ textAlign:"right", minWidth:120 }}>
                      <div style={{ fontSize:11, color:"var(--green)" }}>+{fmt(d.rec)}</div>
                      <div style={{ fontSize:11, color:"var(--red)" }}>-{fmt(d.dep)}</div>
                    </div>
                    <div style={{ minWidth:90, textAlign:"right", fontWeight:700, fontSize:13, color:d.bal>=0?"var(--accent)":"var(--red)" }}>
                      {fmt(d.bal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}
      <HelpButton pageId="historico" onNavigate={onNavigate} />
    </div>
  );
}
