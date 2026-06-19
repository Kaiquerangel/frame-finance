import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";
import { useIsMobile } from "../lib/useIsMobile";
import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import RegistrarGasto from "../components/RegistrarGasto";
import { LoadingSpinner, ErrorMessage, SaveError, SaveSuccess } from "../components/LoadingSpinner";

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
  { id: "avulsos",    label: "Avulsos",    icon: "💸", desc: "Gastos do dia a dia" },
  { id: "parcelados", label: "Parcelados", icon: "💳", desc: "Compras no cartão" },
  { id: "fixos",      label: "Fixos",      icon: "📌", desc: "Contas todo mês" },
];

// ── ABA AVULSOS (Lançamentos) ────────────────────────────────────────────────
function Avulsos({ userId, categories }) {
  const isMobile = useIsMobile();
  const [transactions, setTransactions] = useState([]);
  const [filterMonth, setFilterMonth]   = useState(today().slice(0,7));
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});
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
              {editId === tx.id ? (
                <div style={{ padding: "10px 0", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
                  <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                  <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <input type="number" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <select value={editForm.cat} onChange={e => setEditForm(f => ({ ...f, cat: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                    {categories[editForm.type]?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✓</button>
                    <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "9px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                  </div>
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
                    <button onClick={() => { setEditId(tx.id); setEditForm({ ...tx }); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14 }}>✎</button>
                    <button onClick={() => del(tx.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>×</button>
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
  const [filterMonth, setFilterMonth] = useState(today().slice(0,7));
  const [editId, setEditId]       = useState(null);
  const [editForm, setEditForm]   = useState({});

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

  const monthPayments = useMemo(() => payments.filter(p => (p.due_date||"").startsWith(filterMonth)), [payments, filterMonth]);
  const totalMonth    = monthPayments.reduce((a,p) => a+Number(p.amount), 0);
  const totalPending  = monthPayments.filter(p => !p.paid).reduce((a,p) => a+Number(p.amount), 0);

  const togglePaid = async (id, paid) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, paid: !paid } : p));
    await supabase.from("fixed_expense_payments").update({ paid: !paid }).eq("id", id);
  };

  const deactivate = async (id) => {
    setFixed(prev => prev.filter(f => f.id !== id));
    await supabase.from("fixed_expenses").update({ active: false }).eq("id", id);
  };

  const saveEdit = async () => {
    await supabase.from("fixed_expenses").update({ description: editForm.description, amount: parseFloat(editForm.amount), category: editForm.category, due_day: parseInt(editForm.due_day) }).eq("id", editId);
    setEditId(null);
    await load();
  };

  return (
    <div>
      {loadingF && <LoadingSpinner message="Carregando despesas fixas..." />}
      {loadErrorF && <ErrorMessage message={loadErrorF} onRetry={load} />}
      {!loadingF && !loadErrorF && (<>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12, marginBottom: 14 }}>
        {[
          { label: "Total do mês",  value: fmt(totalMonth),   color: "var(--text)" },
          { label: "Pendente",      value: fmt(totalPending), color: totalPending > 0 ? "var(--red)" : "var(--green)" },
        ].map(k => (
          <Card key={k.label} style={{ padding: isMobile ? "12px 14px" : 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: k.color }}>{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Faturas do mês */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Faturas do mês</div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        {monthPayments.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0", fontSize: 13 }}>Nenhuma fatura neste mês</div>
          : monthPayments.map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < monthPayments.length-1 ? "1px solid var(--border)" : "none", opacity: p.paid ? .55 : 1 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                <button onClick={() => togglePaid(p.id, p.paid)} style={{ width: 22, height: 22, borderRadius: 6, border: "2px solid", borderColor: p.paid ? "var(--green)" : "var(--border)", background: p.paid ? "var(--green)" : "transparent", cursor: "pointer", color: "#fff", fontSize: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{p.paid ? "✓" : ""}</button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: p.paid ? "line-through" : "none" }}>{p.fixed_expenses?.description}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.fixed_expenses?.category} · Vence {p.due_date}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: p.paid ? "var(--green)" : "var(--red)" }}>{fmt(p.amount)}</span>
                {!p.paid && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--red)", borderRadius: 99, padding: "2px 7px" }}>Pendente</span>}
              </div>
            </div>
          ))
        }
      </Card>

      {/* Despesas cadastradas */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>Despesas cadastradas</div>
        {fixed.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "20px 0", fontSize: 13 }}>Nenhuma despesa fixa cadastrada</div>
          : fixed.map((f, i) => (
            <div key={f.id} style={{ borderBottom: i < fixed.length-1 ? "1px solid var(--border)" : "none" }}>
              {editId === f.id ? (
                <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={editForm.description} onChange={e => setEditForm(ef => ({ ...ef, description: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <input type="number" value={editForm.amount} onChange={e => setEditForm(ef => ({ ...ef, amount: e.target.value }))} style={{ ...inp, fontSize: 12 }} placeholder="Valor" />
                    <select value={editForm.category} onChange={e => setEditForm(ef => ({ ...ef, category: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                      {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" min="1" max="31" value={editForm.due_day} onChange={e => setEditForm(ef => ({ ...ef, due_day: e.target.value }))} style={{ ...inp, fontSize: 12 }} placeholder="Dia" />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveEdit} style={{ flex: 1, padding: "9px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>✓ Salvar</button>
                    <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "9px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{f.description}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{f.category} · Vence todo dia {f.due_day}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{fmt(f.amount)}</span>
                    <button onClick={() => { setEditId(f.id); setEditForm({...f}); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14 }}>✎</button>
                    <button onClick={() => deactivate(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>×</button>
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
    // Navega para a aba correta após salvar
    if (tipo === "unico")     setActiveTab("avulsos");
    if (tipo === "parcelado") setActiveTab("parcelados");
    if (tipo === "fixo")      setActiveTab("fixos");
    // Incrementa refreshKey para forçar re-mount e re-fetch da aba
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
        {activeTab === "avulsos"    && <Avulsos    userId={userId} categories={categories} />}
        {activeTab === "parcelados" && <Parcelados userId={userId} categories={categories} />}
        {activeTab === "fixos"      && <Fixos      userId={userId} categories={categories} />}
      </div>

      {showRegistrar && (
        <RegistrarGasto userId={userId} onClose={() => setShowRegistrar(false)} onSaved={handleSaved} />
      )}

      <HelpButton pageId="lancamentos" onNavigate={onNavigate} />
    </div>
  );
}