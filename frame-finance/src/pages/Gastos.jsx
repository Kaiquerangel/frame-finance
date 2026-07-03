import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import RegistrarGasto from "../components/RegistrarGasto";
import { LoadingSpinner, ErrorMessage, SaveError, SaveSuccess } from "../components/LoadingSpinner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 13, outline: "none",
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{children}</div>
);

const TABS = [
  { id: "avulsos",    label: "Avulsos",     icon: "💸", desc: "Gastos do dia a dia" },
  { id: "parcelados", label: "Parcelados",  icon: "💳", desc: "Compras no cartão" },
  { id: "fixos",      label: "Fixos",       icon: "📌", desc: "Contas todo mês" },
  { id: "emprestimos",label: "Empréstimos", icon: "🏦", desc: "Parcela todo mês" },
];

// ── ABA EMPRÉSTIMOS (gasto fixo — todo mês tem parcela pra pagar) ───────────
// Tratada com o mesmo cuidado que Fixos: KPIs do período, filtro de mês/categoria/status,
// marcar parcela como paga direto na lista. A diferença pra Fixos é só técnica (loans tem
// prazo certo, fixed_expenses não) — pra quem paga, o impacto mensal é idêntico.
function EmprestimosTab({ userId, categories, onNavigate }) {
  const isMobile = useIsMobile();
  const [loans, setLoans]               = useState([]);
  const [installments, setInstallments] = useState([]);
  const [filterMonth, setFilterMonth]       = useState(today().slice(0,7));
  const [periodMode, setPeriodMode]         = useState("mes");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [editInstId, setEditInstId]     = useState(null);
  const [editInstForm, setEditInstForm] = useState({});
  const [confirmDelInstId, setConfirmDelInstId] = useState(null);

  const [loadingE, setLoadingE]     = useState(true);
  const [loadErrorE, setLoadErrorE] = useState(null);

  const load = useCallback(async () => {
    setLoadingE(true);
    setLoadErrorE(null);
    try {
      const [{ data: l, error: e1 }, { data: i }] = await Promise.all([
        supabase.from("loans").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("loan_installments").select("*, loans(description,category,type)").eq("user_id", userId).order("due_date", { ascending: false }).limit(500),
      ]);
      if (e1) throw e1;
      setLoans(l || []);
      setInstallments(i || []);
    } catch (err) {
      setLoadErrorE("Não foi possível carregar os empréstimos.");
    } finally {
      setLoadingE(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const s = new Set(installments.map(i => (i.due_date||"").slice(0,7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [installments, filterMonth]);

  const periodMonths = useMemo(() => {
    if (periodMode === "ano") {
      const y = filterMonth.slice(0, 4);
      return Array.from({ length: 12 }, (_, idx) => `${y}-${String(idx + 1).padStart(2, "0")}`);
    }
    if (periodMode === "trimestre") {
      const [y, m] = filterMonth.split("-").map(Number);
      return [2, 1, 0].map(idx => {
        const d = new Date(y, m - 1 - idx, 1);
        return d.toISOString().slice(0, 7);
      });
    }
    return [filterMonth];
  }, [periodMode, filterMonth]);

  const periodInst = useMemo(() => {
    let list = installments.filter(i => periodMonths.includes((i.due_date||"").slice(0,7)));
    if (filterCategory !== "all") list = list.filter(i => i.loans?.category === filterCategory);
    if (filterStatus === "paga")      list = list.filter(i => i.paid);
    if (filterStatus === "pendente")  list = list.filter(i => !i.paid);
    return list;
  }, [installments, periodMonths, filterCategory, filterStatus]);

  const totalMonth   = periodInst.reduce((a,i) => a+Number(i.amount), 0);
  const totalPaid     = periodInst.filter(i => i.paid).reduce((a,i) => a+Number(i.amount), 0);
  const totalPending  = periodInst.filter(i => !i.paid).reduce((a,i) => a+Number(i.amount), 0);

  const chartData = useMemo(() => {
    if (periodMode === "mes") return [];
    return periodMonths.map(m => {
      let list = installments.filter(i => (i.due_date||"").startsWith(m));
      if (filterCategory !== "all") list = list.filter(i => i.loans?.category === filterCategory);
      if (filterStatus === "paga")     list = list.filter(i => i.paid);
      if (filterStatus === "pendente") list = list.filter(i => !i.paid);
      return { name: monthLabel(m), total: list.reduce((a,i) => a+Number(i.amount), 0) };
    });
  }, [periodMode, periodMonths, installments, filterCategory, filterStatus]);

  const groupedByMonth = useMemo(() => {
    const map = {};
    periodInst.forEach(i => {
      const m = (i.due_date||"").slice(0,7);
      (map[m] = map[m] || []).push(i);
    });
    return Object.entries(map).sort(([a],[b]) => b.localeCompare(a));
  }, [periodInst]);

  const togglePaid = async (id, paid) => {
    // loan_installments.paid é a única fonte de verdade — sem espelho em transactions
    // (era a causa da duplicação corrigida anteriormente em Emprestimos.jsx)
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: !paid } : i));
    await supabase.from("loan_installments").update({ paid: !paid }).eq("id", id);
  };

  const saveInstEdit = async () => {
    if (!editInstForm.amount || !editInstForm.due_date) return;
    await supabase.from("loan_installments").update({
      amount: parseFloat(editInstForm.amount),
      due_date: editInstForm.due_date,
    }).eq("id", editInstId);
    setInstallments(prev => prev.map(i => i.id === editInstId
      ? { ...i, amount: parseFloat(editInstForm.amount), due_date: editInstForm.due_date }
      : i
    ));
    setEditInstId(null);
  };

  const delInstallment = async (id) => {
    setConfirmDelInstId(null);
    setInstallments(prev => prev.filter(i => i.id !== id));
    await supabase.from("loan_installments").delete().eq("id", id);
  };

  return (
    <div>
      {/* ── Modal: editar parcela ── */}
      {editInstId && (
        <div onClick={e => e.target === e.currentTarget && setEditInstId(null)} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", display:"flex", alignItems: isMobile ? "flex-end" : "center", justifyContent:"center", padding: isMobile ? 0 : 20 }}>
          <div style={{ width:"100%", maxWidth: isMobile ? "100%" : 420, background:"var(--surface)", borderRadius: isMobile ? "20px 20px 0 0" : 16, border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
            {isMobile && <div style={{ width:36, height:4, borderRadius:99, background:"var(--border)", margin:"12px auto 0" }} />}
            <div style={{ padding: isMobile ? "16px 20px 0" : "20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>Editar parcela</div>
              <button onClick={() => setEditInstId(null)} style={{ width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", cursor:"pointer", color:"var(--muted)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ padding: isMobile ? "14px 20px 22px" : "16px 24px 24px", display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <Label>Valor (R$)</Label>
                <input type="number" value={editInstForm.amount || ""} onChange={e => setEditInstForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <input type="date" value={editInstForm.due_date || ""} onChange={e => setEditInstForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={() => setEditInstId(null)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--muted)", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancelar</button>
                <button onClick={saveInstEdit} style={{ flex:2, padding:"10px 0", borderRadius:8, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadErrorE && <ErrorMessage message={loadErrorE} onRetry={load} />}
      {!loadingE && !loadErrorE && (<>

      {loans.length === 0 && (
        <EmptyBanner pageId="emprestimos" onNavigate={onNavigate} message="Nenhum empréstimo cadastrado ainda. Cadastre na página de Empréstimos para ver as parcelas aqui." />
      )}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
        {[
          { label: "Total do período",  value: fmt(totalMonth),   color: "var(--text)" },
          { label: "Pago",              value: fmt(totalPaid),    color: "var(--green)" },
          { label: "Pendente",          value: fmt(totalPending), color: totalPending > 0 ? "var(--red)" : "var(--green)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: isMobile ? "10px 8px" : 18 }}>
            <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 13 : 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 3 }}>
            {[["mes","Mês"],["trimestre","Trimestre"],["ano","Ano"]].map(([id,label]) => (
              <button key={id} onClick={() => setPeriodMode(id)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 12,
                background: periodMode === id ? "var(--surface)" : "transparent",
                color: periodMode === id ? "var(--accent)" : "var(--muted)",
                boxShadow: periodMode === id ? "var(--shadow-sm)" : "none",
              }}>{label}</button>
            ))}
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Todas categorias</option>
            {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Pago e pendente</option>
            <option value="paga">Só pagas</option>
            <option value="pendente">Só pendentes</option>
          </select>
        </div>
      </Card>

      {/* Mini-gráfico */}
      {periodMode !== "mes" && chartData.some(d => d.total > 0) && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>
            Evolução do período
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} width={48} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#7c3aed" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Parcelas do período */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>
          Parcelas do período
        </div>

        {periodInst.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0", fontSize: 13 }}>Nenhuma parcela encontrada com esses filtros</div>
        )}

        {periodMode === "mes"
          ? periodInst.map((i, idx) => (
            <div key={i.id} style={{ borderBottom: idx < periodInst.length-1 ? "1px solid var(--border)" : "none" }}>
              {confirmDelInstId === i.id ? (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
                  <div style={{ flex:1, fontSize:13, color:"var(--text)" }}>Excluir parcela <strong>{i.installment_number}</strong> de <strong>"{i.loans?.description}"</strong>?</div>
                  <button onClick={() => delInstallment(i.id)} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Excluir</button>
                  <button onClick={() => setConfirmDelInstId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:12, cursor:"pointer" }}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", opacity: i.paid ? .55 : 1 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                    <button onClick={() => togglePaid(i.id, i.paid)} style={{ width:22, height:22, borderRadius:6, border:"2px solid", borderColor: i.paid ? "var(--green)" : "var(--border)", background: i.paid ? "var(--green)" : "transparent", cursor:"pointer", color:"#fff", fontSize:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{i.paid ? "✓" : ""}</button>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", textDecoration: i.paid ? "line-through" : "none" }}>
                        {i.loans?.description || "Empréstimo"} — parcela {i.installment_number}
                      </div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>
                        {i.loans?.category || "Outros"} · {i.loans?.type === "financiamento" ? "Financiamento" : "Empréstimo"} · Vence {i.due_date}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8 }}>
                    <span style={{ fontWeight:700, fontSize:13, color: i.paid ? "var(--green)" : "var(--red)" }}>{fmt(i.amount)}</span>
                    {!i.paid && <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:"var(--red)", borderRadius:99, padding:"2px 7px" }}>Pendente</span>}
                    <button onClick={() => { setEditInstId(i.id); setEditInstForm({ amount: i.amount, due_date: i.due_date }); }} title="Editar" style={{ background:"var(--accentbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--accent)", fontSize:12, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                    <button onClick={() => setConfirmDelInstId(i.id)} title="Excluir" style={{ background:"var(--redbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--red)", fontSize:15, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))
          : groupedByMonth.map(([m, items]) => (
            <div key={m} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".04em" }}>{monthLabel(m)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmt(items.reduce((a,i)=>a+Number(i.amount),0))}</span>
              </div>
              {items.map((i, idx) => (
                <div key={i.id} style={{ borderBottom: idx < items.length-1 ? "1px solid var(--border)" : "none" }}>
                  {confirmDelInstId === i.id ? (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0" }}>
                      <div style={{ flex:1, fontSize:12, color:"var(--text)" }}>Excluir parcela <strong>{i.installment_number}</strong>?</div>
                      <button onClick={() => delInstallment(i.id)} style={{ padding:"6px 12px", borderRadius:6, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:11, cursor:"pointer" }}>Excluir</button>
                      <button onClick={() => setConfirmDelInstId(null)} style={{ padding:"6px 12px", borderRadius:6, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:11, cursor:"pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", opacity: i.paid ? .55 : 1 }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                        <button onClick={() => togglePaid(i.id, i.paid)} style={{ width:20, height:20, borderRadius:6, border:"2px solid", borderColor: i.paid ? "var(--green)" : "var(--border)", background: i.paid ? "var(--green)" : "transparent", cursor:"pointer", color:"#fff", fontSize:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{i.paid ? "✓" : ""}</button>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", textDecoration: i.paid ? "line-through" : "none" }}>
                            {i.loans?.description || "Empréstimo"} — parcela {i.installment_number}
                          </div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>{i.loans?.category || "Outros"} · Vence {i.due_date}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8 }}>
                        <span style={{ fontWeight:700, fontSize:13, color: i.paid ? "var(--green)" : "var(--red)" }}>{fmt(i.amount)}</span>
                        {!i.paid && <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:"var(--red)", borderRadius:99, padding:"2px 6px" }}>Pendente</span>}
                        <button onClick={() => { setEditInstId(i.id); setEditInstForm({ amount: i.amount, due_date: i.due_date }); }} title="Editar" style={{ background:"var(--accentbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--accent)", fontSize:12, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                        <button onClick={() => setConfirmDelInstId(i.id)} title="Excluir" style={{ background:"var(--redbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--red)", fontSize:14, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        }
      </Card>

      {/* Empréstimos cadastrados */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>Empréstimos e financiamentos</div>
        {loans.length === 0
          ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"20px 0", fontSize:13 }}>Nenhum empréstimo cadastrado</div>
          : loans.map((l, idx) => {
              const instOfLoan = installments.filter(i => i.loan_id === l.id);
              const pending = instOfLoan.filter(i => !i.paid).length;
              return (
                <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0", borderBottom: idx < loans.length-1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>{l.description}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>
                      {l.category} · {l.type === "financiamento" ? "Financiamento" : "Empréstimo"} · {pending} parcela(s) pendente(s) de {l.installments}
                    </div>
                  </div>
                  <span style={{ fontWeight:700, fontSize:13, color:"var(--text)", flexShrink:0, marginLeft:8 }}>{fmt(l.total_amount)}</span>
                </div>
              );
            })
        }
      </Card>
      </>)}
    </div>
  );
}

// ── ABA AVULSOS (Lançamentos) ────────────────────────────────────────────────
function Avulsos({ userId, categories }) {
  const isMobile = useIsMobile();
  const [transactions, setTransactions] = useState([]);
  const [filterMonth, setFilterMonth]   = useState(today().slice(0,7));
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saveMsg, setSaveMsg]     = useState("");
  const [saveErr, setSaveErr]     = useState("");
  const ITEMS = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500);
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      setLoadError("Não foi possível carregar os lançamentos.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = transactions.filter(t => t.date.startsWith(filterMonth));
    if (search) list = list.filter(t => t.description.toLowerCase().includes(search.toLowerCase()) || t.cat.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [transactions, filterMonth, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS);
  const paginated  = filtered.slice((page-1)*ITEMS, page*ITEMS);
  const totalDep   = filtered.filter(t => t.type === "despesa").reduce((a,t) => a+Number(t.value), 0);
  const totalRec   = filtered.filter(t => t.type === "receita").reduce((a,t) => a+Number(t.value), 0);

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date.slice(0,7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [transactions, filterMonth]);

  const del = async (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      setSaveErr("Erro ao excluir. Tente novamente.");
      await load();
    }
  };

  const saveEdit = async () => {
    if (!editForm.description || !editForm.value) return;
    const updated = { description: editForm.description, value: parseFloat(editForm.value), cat: editForm.cat, date: editForm.date, type: editForm.type };
    setTransactions(prev => prev.map(t => t.id === editId ? { ...t, ...updated } : t));
    setEditId(null);
    const { error } = await supabase.from("transactions").update(updated).eq("id", editId);
    if (error) {
      setSaveErr("Erro ao salvar. Tente novamente.");
    } else {
      setSaveMsg("Lançamento atualizado!");
      setTimeout(() => setSaveMsg(""), 2500);
    }
    await load();
  };

  return (
    <div>
      {/* ── Modal de edição ─────────────────────────────────────────── */}
      {editId && (
        <div onClick={e => e.target === e.currentTarget && setEditId(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: isMobile ? "flex-end" : "center",
          justifyContent: "center", padding: isMobile ? 0 : 20,
        }}>
          <div style={{
            width: "100%", maxWidth: isMobile ? "100%" : 460,
            background: "var(--surface)",
            borderRadius: isMobile ? "20px 20px 0 0" : 18,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)", overflow: "hidden",
          }}>
            {isMobile && <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 0" }} />}
            <div style={{ padding: isMobile ? "16px 20px 0" : "22px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Editar lançamento</div>
              <button onClick={() => setEditId(null)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", color: "var(--muted)", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ padding: isMobile ? "16px 20px 24px" : "20px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Tipo */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Tipo</div>
                <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 3 }}>
                  {["despesa","receita"].map(t => (
                    <button key={t} onClick={() => setEditForm(f => ({ ...f, type: t, cat: "" }))} style={{
                      flex: 1, padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
                      fontWeight: 600, fontSize: 13,
                      background: editForm.type === t ? (t === "despesa" ? "var(--red)" : "var(--green)") : "transparent",
                      color: editForm.type === t ? "#fff" : "var(--muted)",
                    }}>{t === "despesa" ? "↓ Despesa" : "↑ Receita"}</button>
                  ))}
                </div>
              </div>
              {/* Descrição */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Descrição</div>
                <input value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} maxLength={150} style={inp} />
              </div>
              {/* Valor + Data */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Valor (R$)</div>
                  <input type="number" value={editForm.value || ""} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Data</div>
                  <input type="date" value={editForm.date || ""} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                </div>
              </div>
              {/* Categoria */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Categoria</div>
                <select value={editForm.cat || ""} onChange={e => setEditForm(f => ({ ...f, cat: e.target.value }))} style={inp}>
                  <option value="">Selecionar...</option>
                  {(categories[editForm.type || "despesa"] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Ações */}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
                <button onClick={saveEdit} style={{ flex: 2, padding: "11px 0", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Salvar alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner message="Carregando lançamentos..." />}
      {loadError && <ErrorMessage message={loadError} onRetry={load} />}
      <SaveError message={saveErr} onDismiss={() => setSaveErr("")} />
      <SaveSuccess message={saveMsg} onDismiss={() => setSaveMsg("")} />

      {!loading && !loadError && (
      <>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
        {[
          { label: "Gastos", value: fmt(totalDep), color: "var(--red)" },
          { label: "Receitas", value: fmt(totalRec), color: "var(--green)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: isMobile ? "12px 14px" : 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} style={{ ...inp, flex: "none", width: "auto" }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar..." style={{ ...inp, flex: 1, minWidth: 100 }} />
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{filtered.length} lançamento(s)</div>

        {paginated.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum lançamento neste mês</div>
          : paginated.map((tx, i) => (
            <div key={tx.id} style={{ borderBottom: i < paginated.length-1 ? "1px solid var(--border)" : "none" }}>
              {confirmDelId === tx.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--text)" }}>Excluir <strong>"{tx.description}"</strong>?</div>
                  <button onClick={() => { setConfirmDelId(null); del(tx.id); }} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "var(--red)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Excluir</button>
                  <button onClick={() => setConfirmDelId(null)} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: tx.type === "receita" ? "var(--greenbg)" : "var(--redbg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                      {tx.type === "receita" ? "↑" : "↓"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{tx.cat} · {tx.date}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: tx.type === "receita" ? "var(--green)" : "var(--red)" }}>
                      {tx.type === "receita" ? "+" : "-"}{fmt(tx.value)}
                    </span>
                    <button onClick={() => { setEditId(tx.id); setEditForm({ ...tx }); }} title="Editar" style={{ background: "var(--accentbg)", border: "none", borderRadius: 7, cursor: "pointer", color: "var(--accent)", fontSize: 13, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>✎</button>
                    <button onClick={() => setConfirmDelId(tx.id)} title="Excluir" style={{ background: "var(--redbg)", border: "none", borderRadius: 7, cursor: "pointer", color: "var(--red)", fontSize: 16, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))
        }

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>←</button>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer", fontSize: 13 }}>→</button>
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
}

// ── ABA PARCELADOS (Compras) ─────────────────────────────────────────────────
function Parcelados({ userId, categories }) {
  const isMobile  = useIsMobile();
  const [purchases, setPurchases]       = useState([]);
  const [installments, setInstallments] = useState([]);
  const [cards, setCards]               = useState([]);
  const [filterMonth, setFilterMonth]   = useState(today().slice(0,7));
  const [search, setSearch]             = useState("");
  const [tab, setTab]                   = useState("compras");
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});

  const [loadingP, setLoadingP]   = useState(true);
  const [loadErrorP, setLoadErrorP] = useState(null);

  const load = useCallback(async () => {
    setLoadingP(true);
    setLoadErrorP(null);
    try {
      const [{ data: p, error: e1 }, { data: i }, { data: c }] = await Promise.all([
        supabase.from("purchases").select("*, cards(name,color,due_day,closing_day)").eq("user_id", userId).order("purchase_date", { ascending: false }),
        supabase.from("installments").select("*, purchases(description,category,card_id,has_interest,cards(name))").eq("user_id", userId).order("due_date"),
        supabase.from("cards").select("*").eq("user_id", userId),
      ]);
      if (e1) throw e1;
      setPurchases(p || []);
      setInstallments(i || []);
      setCards(c || []);
    } catch (err) {
      setLoadErrorP("Não foi possível carregar as compras.");
    } finally {
      setLoadingP(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const s = new Set(installments.map(i => i.due_date.slice(0,7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [installments, filterMonth]);

  const monthInst    = useMemo(() => installments.filter(i => i.due_date.startsWith(filterMonth)), [installments, filterMonth]);
  const totalPending = installments.filter(i => !i.paid).reduce((a,i) => a+Number(i.amount), 0);
  const monthPending = monthInst.filter(i => !i.paid).reduce((a,i) => a+Number(i.amount), 0);

  const filteredPurchases = useMemo(() => {
    if (!search) return purchases;
    return purchases.filter(p => p.description.toLowerCase().includes(search.toLowerCase()));
  }, [purchases, search]);

  const del = async (id) => {
    setPurchases(prev => prev.filter(p => p.id !== id));
    await supabase.from("purchases").delete().eq("id", id);
  };

  const togglePaid = async (id, paid) => {
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: !paid } : i));
    await supabase.from("installments").update({ paid: !paid }).eq("id", id);
  };

  const saveEdit = async () => {
    const updated = { description: editForm.description, category: editForm.category, total_amount: parseFloat(editForm.total_amount), purchase_date: editForm.purchase_date };
    setPurchases(prev => prev.map(p => p.id === editId ? { ...p, ...updated } : p));
    setEditId(null);
    await supabase.from("purchases").update(updated).eq("id", editId);
    await load();
  };

  return (
    <div>
      {loadingP && <LoadingSpinner message="Carregando compras..." />}
      {loadErrorP && <ErrorMessage message={loadErrorP} onRetry={load} />}
      {!loadingP && !loadErrorP && (<>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
        {[
          { label: "Total em aberto", value: fmt(totalPending), color: "var(--red)" },
          { label: "Vence este mês",  value: fmt(monthPending), color: "var(--accent)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: isMobile ? "12px 14px" : 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 2, marginBottom: 12, background: "var(--surface)", borderRadius: 10, padding: 4, border: "1px solid var(--border)", width: "fit-content" }}>
        {[["compras","Compras"],["parcelas","Parcelas do mês"]].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: tab===id ? "var(--accent)" : "transparent", color: tab===id ? "#fff" : "var(--muted)" }}>{label}</button>
        ))}
      </div>

      {tab === "compras" && (
        <Card>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar compra..." style={{ ...inp, marginBottom: 14 }} />
          {filteredPurchases.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhuma compra registrada</div>
            : filteredPurchases.map((p, i) => {
              const paid = installments.filter(inst => inst.purchase_id === p.id && inst.paid).length;
              return (
                <div key={p.id} style={{ borderBottom: i < filteredPurchases.length-1 ? "1px solid var(--border)" : "none" }}>
                  {editId === p.id ? (
                    <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <input type="number" value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                          {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <input type="date" value={editForm.purchase_date||""} onChange={e => setEditForm(f => ({ ...f, purchase_date: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={saveEdit} style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✓ Salvar</button>
                        <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "9px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: "12px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {p.category} · {p.purchase_date}
                            {p.cards && <span style={{ color: "var(--accent)", marginLeft: 5 }}>· {p.cards.name}</span>}
                            {p.has_interest && <span style={{ color: "var(--red)", marginLeft: 5 }}>· c/ juros</span>}
                          </div>
                          {p.installments > 1 && (
                            <div style={{ marginTop: 7 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted)", marginBottom: 3 }}>
                                <span>{paid} de {p.installments} pagas</span>
                                <span style={{ fontWeight: 700, color: paid===p.installments ? "var(--green)" : "var(--accent)" }}>{Math.round((paid/p.installments)*100)}%</span>
                              </div>
                              <div style={{ height: 5, background: "var(--border)", borderRadius: 99, maxWidth: 200 }}>
                                <div style={{ height: "100%", borderRadius: 99, width: `${(paid/p.installments)*100}%`, background: paid===p.installments ? "var(--green)" : "var(--accent)", transition: "width .4s" }} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: paid===p.installments ? "var(--green)" : "var(--red)" }}>{fmt(p.total_amount)}</div>
                            {p.installments > 1 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.installments}x {fmt(p.total_amount/p.installments)}</div>}
                          </div>
                          <button onClick={() => { setEditId(p.id); setEditForm({...p}); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14 }}>✎</button>
                          <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>×</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </Card>
      )}

      {tab === "parcelas" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto" }}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          {monthInst.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhuma parcela neste mês</div>
            : monthInst.map((inst, i) => (
              <div key={inst.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < monthInst.length-1 ? "1px solid var(--border)" : "none", opacity: inst.paid ? .5 : 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                  <button onClick={() => togglePaid(inst.id, inst.paid)} style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid", borderColor: inst.paid ? "var(--green)" : "var(--border)", background: inst.paid ? "var(--green)" : "transparent", cursor: "pointer", color: "#fff", fontSize: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{inst.paid ? "✓" : ""}</button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: inst.paid ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inst.purchases?.description}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>Parcela {inst.installment_number} · {inst.due_date}{inst.purchases?.cards?.name && <span style={{ color: "var(--accent)", marginLeft: 5 }}>· {inst.purchases.cards.name}</span>}</div>
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? "var(--green)" : "var(--red)", flexShrink: 0, marginLeft: 8 }}>{fmt(inst.amount)}</span>
              </div>
            ))
          }
        </Card>
      )}
      </>)}
    </div>
  );
}

// ── ABA FIXOS (Despesas Fixas) ────────────────────────────────────────────────
function Fixos({ userId, categories }) {
  const isMobile = useIsMobile();
  const [fixed, setFixed]         = useState([]);
  const [payments, setPayments]   = useState([]);
  const [filterMonth, setFilterMonth]       = useState(today().slice(0,7));
  const [periodMode, setPeriodMode]         = useState("mes"); // mes | trimestre | ano
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all"); // all | paga | pendente
  const [editId, setEditId]           = useState(null);  // edita fixed_expense (base)
  const [editForm, setEditForm]       = useState({});
  const [confirmDeactId, setConfirmDeactId] = useState(null); // confirma desativar fixed_expense
  const [editPayId, setEditPayId]     = useState(null);  // edita fixed_expense_payment
  const [editPayForm, setEditPayForm] = useState({});
  const [confirmDelPayId, setConfirmDelPayId] = useState(null); // confirma excluir payment

  const [loadingF, setLoadingF]     = useState(true);
  const [loadErrorF, setLoadErrorF] = useState(null);

  const load = useCallback(async () => {
    setLoadingF(true);
    setLoadErrorF(null);
    try {
      const [{ data: f, error: e1 }, { data: p }] = await Promise.all([
        supabase.from("fixed_expenses").select("*").eq("user_id", userId).eq("active", true).order("due_day"),
        supabase.from("fixed_expense_payments").select("*, fixed_expenses(description,category)").eq("user_id", userId).order("due_date", { ascending: false }).limit(200),
      ]);
      if (e1) throw e1;
      setFixed(f || []);
      setPayments(p || []);
    } catch (err) {
      setLoadErrorF("Não foi possível carregar as despesas fixas.");
    } finally {
      setLoadingF(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const months = useMemo(() => {
    const s = new Set(payments.map(p => (p.due_date||"").slice(0,7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [payments, filterMonth]);

  // Janela de meses do período selecionado, a partir do mês de referência
  const periodMonths = useMemo(() => {
    if (periodMode === "ano") {
      const y = filterMonth.slice(0, 4);
      return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    }
    if (periodMode === "trimestre") {
      const [y, m] = filterMonth.split("-").map(Number);
      return [2, 1, 0].map(i => {
        const d = new Date(y, m - 1 - i, 1);
        return d.toISOString().slice(0, 7);
      });
    }
    return [filterMonth];
  }, [periodMode, filterMonth]);

  const periodPayments = useMemo(() => {
    let list = payments.filter(p => periodMonths.includes((p.due_date||"").slice(0,7)));
    if (filterCategory !== "all") list = list.filter(p => p.fixed_expenses?.category === filterCategory);
    if (filterStatus === "paga")      list = list.filter(p => p.paid);
    if (filterStatus === "pendente")  list = list.filter(p => !p.paid);
    return list;
  }, [payments, periodMonths, filterCategory, filterStatus]);

  const totalMonth   = periodPayments.reduce((a,p) => a+Number(p.amount), 0);
  const totalPaid     = periodPayments.filter(p => p.paid).reduce((a,p) => a+Number(p.amount), 0);
  const totalPending  = periodPayments.filter(p => !p.paid).reduce((a,p) => a+Number(p.amount), 0);

  // Dados pro mini-gráfico (trimestre/ano): total por mês, já com os filtros aplicados
  const chartData = useMemo(() => {
    if (periodMode === "mes") return [];
    return periodMonths.map(m => {
      let list = payments.filter(p => (p.due_date||"").startsWith(m));
      if (filterCategory !== "all") list = list.filter(p => p.fixed_expenses?.category === filterCategory);
      if (filterStatus === "paga")     list = list.filter(p => p.paid);
      if (filterStatus === "pendente") list = list.filter(p => !p.paid);
      return { name: monthLabel(m), total: list.reduce((a,p) => a+Number(p.amount), 0) };
    });
  }, [periodMode, periodMonths, payments, filterCategory, filterStatus]);

  // Lista agrupada por mês, só pra deixar legível quando o período é trimestre/ano
  const groupedByMonth = useMemo(() => {
    const map = {};
    periodPayments.forEach(p => {
      const m = (p.due_date||"").slice(0,7);
      (map[m] = map[m] || []).push(p);
    });
    return Object.entries(map).sort(([a],[b]) => b.localeCompare(a));
  }, [periodPayments]);

  const togglePaid = async (id, paid) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
    await supabase.from("fixed_expense_payments").update({ paid: !paid }).eq("id", id);
  };

  const deactivate = async (id) => {
    setFixed(prev => prev.filter(f => f.id !== id));
    await supabase.from("fixed_expenses").update({ active: false }).eq("id", id);
  };

  const saveEdit = async () => {
    if (!editForm.description) return;
    await supabase.from("fixed_expenses").update({
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      category: editForm.category,
      due_day: parseInt(editForm.due_day),
    }).eq("id", editId);
    setEditId(null);
    await load();
  };

  const savePayEdit = async () => {
    if (!editPayForm.amount || !editPayForm.due_date) return;
    await supabase.from("fixed_expense_payments").update({
      amount: parseFloat(editPayForm.amount),
      due_date: editPayForm.due_date,
    }).eq("id", editPayId);
    setPayments(prev => prev.map(p => p.id === editPayId
      ? { ...p, amount: parseFloat(editPayForm.amount), due_date: editPayForm.due_date }
      : p
    ));
    setEditPayId(null);
  };

  const delPayment = async (id) => {
    setConfirmDelPayId(null);
    setPayments(prev => prev.filter(p => p.id !== id));
    await supabase.from("fixed_expense_payments").delete().eq("id", id);
  };

  return (
    <div>
      {/* ── Modal: editar fixed_expense_payment (linha da fatura) ── */}
      {editPayId && (
        <div onClick={e => e.target === e.currentTarget && setEditPayId(null)} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", display:"flex", alignItems: isMobile ? "flex-end" : "center", justifyContent:"center", padding: isMobile ? 0 : 20 }}>
          <div style={{ width:"100%", maxWidth: isMobile ? "100%" : 420, background:"var(--surface)", borderRadius: isMobile ? "20px 20px 0 0" : 16, border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
            {isMobile && <div style={{ width:36, height:4, borderRadius:99, background:"var(--border)", margin:"12px auto 0" }} />}
            <div style={{ padding: isMobile ? "16px 20px 0" : "20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>Editar fatura</div>
              <button onClick={() => setEditPayId(null)} style={{ width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", cursor:"pointer", color:"var(--muted)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ padding: isMobile ? "14px 20px 22px" : "16px 24px 24px", display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Valor (R$)</div>
                <input type="number" value={editPayForm.amount || ""} onChange={e => setEditPayForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Data de vencimento</div>
                <input type="date" value={editPayForm.due_date || ""} onChange={e => setEditPayForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={() => setEditPayId(null)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--muted)", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancelar</button>
                <button onClick={savePayEdit} style={{ flex:2, padding:"10px 0", borderRadius:8, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: editar fixed_expense (despesa base) ── */}
      {editId && (
        <div onClick={e => e.target === e.currentTarget && setEditId(null)} style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)", display:"flex", alignItems: isMobile ? "flex-end" : "center", justifyContent:"center", padding: isMobile ? 0 : 20 }}>
          <div style={{ width:"100%", maxWidth: isMobile ? "100%" : 440, background:"var(--surface)", borderRadius: isMobile ? "20px 20px 0 0" : 16, border:"1px solid var(--border)", boxShadow:"var(--shadow-lg)", overflow:"hidden" }}>
            {isMobile && <div style={{ width:36, height:4, borderRadius:99, background:"var(--border)", margin:"12px auto 0" }} />}
            <div style={{ padding: isMobile ? "16px 20px 0" : "20px 24px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>Editar despesa fixa</div>
              <button onClick={() => setEditId(null)} style={{ width:28, height:28, borderRadius:7, border:"1px solid var(--border)", background:"var(--bg)", cursor:"pointer", color:"var(--muted)", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
            </div>
            <div style={{ padding: isMobile ? "14px 20px 22px" : "16px 24px 24px", display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Descrição</div>
                <input value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} maxLength={100} style={inp} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Valor (R$)</div>
                  <input type="number" value={editForm.amount || ""} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Categoria</div>
                  <select value={editForm.category || ""} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                    {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:".06em", marginBottom:5 }}>Dia venc.</div>
                  <input type="number" min="1" max="28" value={editForm.due_day || ""} onChange={e => setEditForm(f => ({ ...f, due_day: e.target.value }))} style={inp} />
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button onClick={() => setEditId(null)} style={{ flex:1, padding:"10px 0", borderRadius:8, border:"1px solid var(--border)", background:"var(--bg)", color:"var(--muted)", fontWeight:600, fontSize:13, cursor:"pointer" }}>Cancelar</button>
                <button onClick={saveEdit} style={{ flex:2, padding:"10px 0", borderRadius:8, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>Salvar alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {loadErrorF && <ErrorMessage message={loadErrorF} onRetry={load} />}
      {!loadingF && !loadErrorF && (<>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
        {[
          { label: "Total do período",  value: fmt(totalMonth),   color: "var(--text)" },
          { label: "Pago",              value: fmt(totalPaid),    color: "var(--green)" },
          { label: "Pendente",          value: fmt(totalPending), color: totalPending > 0 ? "var(--red)" : "var(--green)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: isMobile ? "10px 8px" : 18 }}>
            <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 13 : 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Filtros: período, mês de referência, categoria, status */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 3 }}>
            {[["mes","Mês"],["trimestre","Trimestre"],["ano","Ano"]].map(([id,label]) => (
              <button key={id} onClick={() => setPeriodMode(id)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 12,
                background: periodMode === id ? "var(--surface)" : "transparent",
                color: periodMode === id ? "var(--accent)" : "var(--muted)",
                boxShadow: periodMode === id ? "var(--shadow-sm)" : "none",
              }}>{label}</button>
            ))}
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Todas categorias</option>
            {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Pago e pendente</option>
            <option value="paga">Só pagas</option>
            <option value="pendente">Só pendentes</option>
          </select>
        </div>
      </Card>

      {/* Mini-gráfico, só faz sentido pra trimestre/ano */}
      {periodMode !== "mes" && chartData.some(d => d.total > 0) && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>
            Evolução do período
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(1)}k`} width={48} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="#f59e0b" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Faturas do período */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>
          Faturas do período
        </div>

        {periodPayments.length === 0 && (
          <div style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0", fontSize: 13 }}>Nenhuma fatura encontrada com esses filtros</div>
        )}

        {periodMode === "mes"
          ? periodPayments.map((p, i) => (
            <div key={p.id} style={{ borderBottom: i < periodPayments.length-1 ? "1px solid var(--border)" : "none" }}>
              {confirmDelPayId === p.id ? (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0" }}>
                  <div style={{ flex:1, fontSize:13, color:"var(--text)" }}>Excluir <strong>"{p.fixed_expenses?.description}"</strong> de {p.due_date?.slice(0,7)}?</div>
                  <button onClick={() => delPayment(p.id)} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Excluir</button>
                  <button onClick={() => setConfirmDelPayId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:12, cursor:"pointer" }}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", opacity: p.paid ? .55 : 1 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                    <button onClick={() => togglePaid(p.id, p.paid)} style={{ width:22, height:22, borderRadius:6, border:"2px solid", borderColor: p.paid ? "var(--green)" : "var(--border)", background: p.paid ? "var(--green)" : "transparent", cursor:"pointer", color:"#fff", fontSize:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{p.paid ? "✓" : ""}</button>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", textDecoration: p.paid ? "line-through" : "none" }}>{p.fixed_expenses?.description}</div>
                      <div style={{ fontSize:11, color:"var(--muted)" }}>{p.fixed_expenses?.category} · Vence {p.due_date}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8 }}>
                    <span style={{ fontWeight:700, fontSize:13, color: p.paid ? "var(--green)" : "var(--red)" }}>{fmt(p.amount)}</span>
                    {!p.paid && <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:"var(--red)", borderRadius:99, padding:"2px 7px" }}>Pendente</span>}
                    <button onClick={() => { setEditPayId(p.id); setEditPayForm({ amount: p.amount, due_date: p.due_date }); }} title="Editar" style={{ background:"var(--accentbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--accent)", fontSize:12, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                    <button onClick={() => setConfirmDelPayId(p.id)} title="Excluir" style={{ background:"var(--redbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--red)", fontSize:15, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))
          : groupedByMonth.map(([m, items]) => (
            <div key={m} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".04em" }}>{monthLabel(m)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{fmt(items.reduce((a,p)=>a+Number(p.amount),0))}</span>
              </div>
              {items.map((p, i) => (
                <div key={p.id} style={{ borderBottom: i < items.length-1 ? "1px solid var(--border)" : "none" }}>
                  {confirmDelPayId === p.id ? (
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0" }}>
                      <div style={{ flex:1, fontSize:12, color:"var(--text)" }}>Excluir <strong>"{p.fixed_expenses?.description}"</strong>?</div>
                      <button onClick={() => delPayment(p.id)} style={{ padding:"6px 12px", borderRadius:6, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:11, cursor:"pointer" }}>Excluir</button>
                      <button onClick={() => setConfirmDelPayId(null)} style={{ padding:"6px 12px", borderRadius:6, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:11, cursor:"pointer" }}>Cancelar</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", opacity: p.paid ? .55 : 1 }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center", flex:1, minWidth:0 }}>
                        <button onClick={() => togglePaid(p.id, p.paid)} style={{ width:20, height:20, borderRadius:6, border:"2px solid", borderColor: p.paid ? "var(--green)" : "var(--border)", background: p.paid ? "var(--green)" : "transparent", cursor:"pointer", color:"#fff", fontSize:11, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>{p.paid ? "✓" : ""}</button>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--text)", textDecoration: p.paid ? "line-through" : "none" }}>{p.fixed_expenses?.description}</div>
                          <div style={{ fontSize:11, color:"var(--muted)" }}>{p.fixed_expenses?.category} · Vence {p.due_date}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0, marginLeft:8 }}>
                        <span style={{ fontWeight:700, fontSize:13, color: p.paid ? "var(--green)" : "var(--red)" }}>{fmt(p.amount)}</span>
                        {!p.paid && <span style={{ fontSize:10, fontWeight:700, color:"#fff", background:"var(--red)", borderRadius:99, padding:"2px 6px" }}>Pendente</span>}
                        <button onClick={() => { setEditPayId(p.id); setEditPayForm({ amount: p.amount, due_date: p.due_date }); }} title="Editar" style={{ background:"var(--accentbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--accent)", fontSize:12, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                        <button onClick={() => setConfirmDelPayId(p.id)} title="Excluir" style={{ background:"var(--redbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--red)", fontSize:14, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        }
      </Card>

      {/* Despesas cadastradas */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>Despesas cadastradas</div>
        {fixed.length === 0
          ? <div style={{ color:"var(--muted)", textAlign:"center", padding:"20px 0", fontSize:13 }}>Nenhuma despesa fixa cadastrada</div>
          : fixed.map((f, i) => (
            <div key={f.id} style={{ borderBottom: i < fixed.length-1 ? "1px solid var(--border)" : "none" }}>
              {confirmDeactId === f.id ? (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 0" }}>
                  <div style={{ flex:1, fontSize:13, color:"var(--text)" }}>Desativar <strong>"{f.description}"</strong>? Não vai gerar mais faturas.</div>
                  <button onClick={() => { setConfirmDeactId(null); deactivate(f.id); }} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Desativar</button>
                  <button onClick={() => setConfirmDeactId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:12, cursor:"pointer" }}>Cancelar</button>
                </div>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 0" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:13, color:"var(--text)" }}>{f.description}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:1 }}>{f.category} · Vence todo dia {f.due_day}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:8 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:"var(--text)" }}>{fmt(f.amount)}</span>
                    <button onClick={() => { setEditId(f.id); setEditForm({...f}); }} title="Editar" style={{ background:"var(--accentbg)", border:"none", borderRadius:7, cursor:"pointer", color:"var(--accent)", fontSize:13, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>✎</button>
                    <button onClick={() => setConfirmDeactId(f.id)} title="Desativar" style={{ background:"var(--redbg)", border:"none", borderRadius:7, cursor:"pointer", color:"var(--red)", fontSize:16, width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))
        }
      </Card>
      </>)}
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────
export default function Gastos({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab]         = useState("avulsos");
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [categories, setCategories]       = useState({ despesa: [], receita: [] });
  const [refreshKey, setRefreshKey]       = useState(0);

  useEffect(() => { loadCategories(userId).then(setCategories); }, [userId]);

  const handleSaved = (tipo) => {
    setShowRegistrar(false);
    if (tipo === "unico")     setActiveTab("avulsos");
    if (tipo === "parcelado") setActiveTab("parcelados");
    if (tipo === "fixo")      setActiveTab("fixos");
    if (tipo === "emprestimo") setActiveTab("emprestimos");
    setRefreshKey(k => k + 1);
  };

  return (
    <div>
      {/* Header */}
      {!isMobile && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontWeight: 800, fontSize: 24, color: "var(--text)", letterSpacing: "-.03em" }}>Gastos</h1>
              <button onClick={() => { sessionStorage.setItem("ff_help_section", "lancamentos"); onNavigate("aprendendo"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
            </div>
            <button onClick={() => setShowRegistrar(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(124,58,237,.3)" }}>
              + Registrar gasto
            </button>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>Todos os seus gastos em um só lugar</p>
        </div>
      )}

      {/* Mobile header */}
      {isMobile && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <button onClick={() => setShowRegistrar(true)} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(124,58,237,.3)" }}>
            + Registrar
          </button>
        </div>
      )}

      {/* Abas */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 16,
        background: "var(--surface)", borderRadius: 12, padding: 4,
        border: "1px solid var(--border)",
        overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            padding: isMobile ? "10px 8px" : "10px 16px",
            borderRadius: 9, border: "none", cursor: "pointer",
            background: activeTab === t.id ? "var(--accent)" : "transparent",
            color: activeTab === t.id ? "#fff" : "var(--muted)",
            fontWeight: 600, fontSize: isMobile ? 13 : 13,
            transition: "all .15s", whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span>{t.label}</span>
            {!isMobile && <span style={{ fontSize: 10, opacity: .75, fontWeight: 400 }}>{t.desc}</span>}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div key={`${activeTab}-${refreshKey}`}>
        {activeTab === "avulsos"     && <Avulsos      userId={userId} categories={categories} />}
        {activeTab === "parcelados"  && <Parcelados   userId={userId} categories={categories} />}
        {activeTab === "fixos"       && <Fixos        userId={userId} categories={categories} />}
        {activeTab === "emprestimos" && <EmprestimosTab userId={userId} categories={categories} onNavigate={onNavigate} />}
      </div>

      {showRegistrar && (
        <RegistrarGasto userId={userId} onClose={() => setShowRegistrar(false)} onSaved={handleSaved} />
      )}

      <HelpButton pageId="lancamentos" onNavigate={onNavigate} />
    </div>
  );
}