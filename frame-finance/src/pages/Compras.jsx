import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const ITEMS_PER_PAGE = 12;

const PAYMENT_METHODS = [
  { id: "credito",  label: "Crédito",  icon: "💳" },
  { id: "debito",   label: "Débito",   icon: "🏦" },
  { id: "pix",      label: "Pix",      icon: "⚡" },
  { id: "dinheiro", label: "Dinheiro", icon: "💵" },
];

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none",
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{children}</div>
);

// ── Correct installment calculation with Price Table (SAC) ──────────────────
function calcInstallments(total, numInst, hasInterest, monthlyRate, purchaseDate, card) {
  const installments = [];
  const r = hasInterest && monthlyRate > 0 ? monthlyRate / 100 : 0;

  // Price Table (sistema francês) - parcelas iguais com juros
  const pmt = r > 0
    ? total * (r * Math.pow(1 + r, numInst)) / (Math.pow(1 + r, numInst) - 1)
    : total / numInst;

  const totalWithInterest = pmt * numInst;
  const totalInterest = totalWithInterest - total;

  // Calculate due dates based on card closing day
  for (let i = 0; i < numInst; i++) {
    const purchaseDt = new Date(purchaseDate);
    let dueDate;

    if (card && card.due_day && card.closing_day) {
      // If purchase is before closing day, first installment is next due_day
      // If purchase is after closing day, first installment is the following month
      const closingThisMonth = new Date(purchaseDt.getFullYear(), purchaseDt.getMonth(), card.closing_day);
      const monthsAhead = purchaseDt > closingThisMonth ? i + 2 : i + 1;
      dueDate = new Date(purchaseDt.getFullYear(), purchaseDt.getMonth() + monthsAhead - 1, card.due_day);
    } else {
      // No card: due 30 days after purchase per installment
      dueDate = new Date(purchaseDt);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
    }

    installments.push({
      installment_number: i + 1,
      amount: parseFloat(pmt.toFixed(2)),
      due_date: dueDate.toISOString().split("T")[0],
    });
  }

  return { installments, pmt, totalWithInterest, totalInterest };
}

// Best day to buy suggestion
function bestDayToBuy(card) {
  if (!card || !card.closing_day || !card.due_day) return null;
  const closingDay = card.closing_day;
  // Best day: day after closing (more days to pay, max installment period)
  const bestDay = closingDay + 1 > 28 ? 1 : closingDay + 1;
  return { bestDay, closingDay, dueDay: card.due_day };
}

export default function Compras({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [purchases, setPurchases]       = useState([]);
  const [installments, setInstallments] = useState([]);
  const [cards, setCards]               = useState([]);
  const [categories, setCategories]     = useState({ despesa: [] });
  const [loading, setLoading]           = useState(false);
  const [tab, setTab]                   = useState("lista");
  const [filterMonth, setFilterMonth]   = useState(today().slice(0, 7));
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});

  const [form, setForm] = useState({
    description: "", category: "", total_amount: "",
    payment_method: "credito", card_id: "",
    installments: "1", has_interest: false, interest_rate: "",
    purchase_date: today(),
  });

  const load = async () => {
    const [{ data: p }, { data: i }, { data: c }, cats] = await Promise.all([
      supabase.from("purchases").select("*, cards(name,color,due_day,closing_day)").eq("user_id", userId).order("purchase_date", { ascending: false }),
      supabase.from("installments").select("*, purchases(description, cards(name))").eq("user_id", userId).order("due_date"),
      supabase.from("cards").select("*").eq("user_id", userId),
      loadCategories(userId),
    ]);
    setPurchases(p || []);
    setInstallments(i || []);
    setCards(c || []);
    setCategories(cats);
  };

  useEffect(() => { load(); }, [userId]);

  const selectedCard = useMemo(() => cards.find(c => c.id === form.card_id), [cards, form.card_id]);
  const bestDay = useMemo(() => bestDayToBuy(selectedCard), [selectedCard]);

  // Preview calculation
  const preview = useMemo(() => {
    if (!form.total_amount) return null;
    const total = parseFloat(form.total_amount);
    const numInst = parseInt(form.installments || 1);
    const { pmt, totalWithInterest, totalInterest } = calcInstallments(
      total, numInst, form.has_interest, parseFloat(form.interest_rate || 0), form.purchase_date, selectedCard
    );
    return { pmt, totalWithInterest, totalInterest, numInst };
  }, [form.total_amount, form.installments, form.has_interest, form.interest_rate, form.purchase_date, selectedCard]);

  const add = async () => {
    if (!form.description || !form.total_amount || !form.category) return;
    if (form.payment_method === "credito" && !form.card_id) return;
    setLoading(true);

    const totalAmount = parseFloat(form.total_amount);
    const numInst = parseInt(form.installments || 1);
    const card = selectedCard || null;

    const { data, error } = await supabase.from("purchases").insert({
      user_id: userId, description: form.description, category: form.category,
      total_amount: totalAmount, payment_method: form.payment_method,
      card_id: form.payment_method === "credito" ? form.card_id : null,
      installments: numInst, has_interest: form.has_interest,
      interest_rate: parseFloat(form.interest_rate || 0),
      purchase_date: form.purchase_date,
    }).select().single();

    if (!error && data) {
      const { installments: instList } = calcInstallments(
        totalAmount, numInst, form.has_interest,
        parseFloat(form.interest_rate || 0), form.purchase_date, card
      );
      await supabase.from("installments").insert(
        instList.map(inst => ({ ...inst, purchase_id: data.id, user_id: userId, paid: false }))
      );
    }

    setForm({ description: "", category: "", total_amount: "", payment_method: "credito", card_id: "", installments: "1", has_interest: false, interest_rate: "", purchase_date: today() });
    setPage(1);
    await load();
    setLoading(false);
  };

  const startEdit = (p) => { setEditId(p.id); setEditForm({ ...p }); };

  const saveEdit = async () => {
    await supabase.from("purchases").update({
      description: editForm.description, category: editForm.category,
      total_amount: parseFloat(editForm.total_amount),
    }).eq("id", editId);
    setEditId(null);
    await load();
  };

  const del = async (id) => {
    await supabase.from("purchases").delete().eq("id", id);
    await load();
  };

  const togglePaid = async (id, paid) => {
    await supabase.from("installments").update({ paid: !paid }).eq("id", id);
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: !paid } : i));
  };

  const isCredit = form.payment_method === "credito";

  const monthInstallments = useMemo(() =>
    installments.filter(i => i.due_date.startsWith(filterMonth)),
    [installments, filterMonth]
  );

  const months = useMemo(() => {
    const s = new Set(installments.map(i => i.due_date.slice(0, 7)));
    s.add(filterMonth);
    return [...s].sort();
  }, [installments, filterMonth]);

  const filteredPurchases = useMemo(() => {
    if (!search) return purchases;
    return purchases.filter(p => p.description.toLowerCase().includes(search.toLowerCase()));
  }, [purchases, search]);

  const totalPages = Math.ceil(filteredPurchases.length / ITEMS_PER_PAGE);
  const paginated  = filteredPurchases.slice((page-1)*ITEMS_PER_PAGE, page*ITEMS_PER_PAGE);

  const totalDebt = installments.filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const monthDebt = monthInstallments.filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0);

  return (
    <div>
      {/* Banner de ajuda para novos usuários */}
      <EmptyBanner pageId="compras" onNavigate={onNavigate} message="Nenhuma compra parcelada registrada. Veja como funciona e registre suas parcelas do cartão." />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Compras</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "compras"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Compras no crédito parceladas, iPhone 12x, geladeira 10x</p>
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--text)" }}>Nova Compra</div>

        {/* Payment method */}
        <div style={{ marginBottom: 14 }}>
          <Label>Forma de pagamento</Label>
          <div style={{ display: "flex", gap: 8 }}>
            {PAYMENT_METHODS.map(pm => (
              <button key={pm.id} onClick={() => setForm(f => ({ ...f, payment_method: pm.id, installments: "1", has_interest: false, interest_rate: "" }))} style={{
                padding: "7px 14px", borderRadius: 8, border: "1.5px solid",
                borderColor: form.payment_method === pm.id ? "var(--accent)" : "var(--border)",
                background: form.payment_method === pm.id ? "var(--accentbg)" : "transparent",
                color: form.payment_method === pm.id ? "var(--accent)" : "var(--muted)",
                fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all .12s",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {pm.icon} {pm.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div><Label>Descrição</Label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: iPhone 15" style={inp} /></div>
          <div><Label>Valor total (R$)</Label><input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="3500,00" style={inp} /></div>
          <div><Label>Data da compra</Label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inp} /></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isCredit ? "1fr 1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <Label>Categoria</Label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {isCredit && (
            <div>
              <Label>Cartão</Label>
              <select value={form.card_id} onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))} style={inp}>
                <option value="">Selecionar...</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {isCredit && (
            <div>
              <Label>Parcelas</Label>
              <select value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} style={inp}>
                {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                  <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
                ))}
              </select>
            </div>
          )}
          {isCredit && parseInt(form.installments) > 1 && (
            <div>
              <Label>Juros (%/mês)</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 2 }}>
                <input type="checkbox" checked={form.has_interest}
                  onChange={e => setForm(f => ({ ...f, has_interest: e.target.checked, interest_rate: "" }))}
                  style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0 }} />
                {form.has_interest
                  ? <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="Ex: 2.5" style={{ ...inp, flex: 1 }} />
                  : <span style={{ fontSize: 12, color: "var(--muted)" }}>Sem juros</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* Best day suggestion */}
        {bestDay && (
          <div style={{ background: "var(--greenbg)", borderRadius: 8, padding: "9px 14px", marginBottom: 10, fontSize: 12, color: "var(--green)" }}>
            💡 <strong>Melhor dia para comprar:</strong> dia {bestDay.bestDay}, você terá mais tempo até o fechamento (dia {bestDay.closingDay}) e vencimento (dia {bestDay.dueDay})
          </div>
        )}

        {/* Preview */}
        {preview && isCredit && parseInt(form.installments) > 1 && (
          <div style={{ background: "var(--accentbg)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <span>Parcela: <strong style={{ color: "var(--accent)" }}>{fmt(preview.pmt)}</strong></span>
              <span>Total: <strong style={{ color: preview.totalInterest > 0 ? "var(--red)" : "var(--text)" }}>{fmt(preview.totalWithInterest)}</strong></span>
              {preview.totalInterest > 0 && <span>Juros: <strong style={{ color: "var(--red)" }}>{fmt(preview.totalInterest)} ({((preview.totalInterest / parseFloat(form.total_amount)) * 100).toFixed(1)}% do valor)</strong></span>}
            </div>
            {/* Show first 3 due dates */}
            {selectedCard && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                Vencimentos: {calcInstallments(parseFloat(form.total_amount), parseInt(form.installments), form.has_interest, parseFloat(form.interest_rate||0), form.purchase_date, selectedCard).installments.slice(0,3).map(i => `${i.installment_number}ª ${i.due_date}`).join(" · ")}
                {parseInt(form.installments) > 3 && " ..."}
              </div>
            )}
          </div>
        )}

        <button onClick={add} disabled={loading} style={{
          padding: "9px 22px", borderRadius: 8, border: "none", background: "var(--accent)",
          color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1,
        }}>
          {loading ? "Salvando..." : "+ Registrar compra"}
        </button>
      </Card>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Total em aberto</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)", letterSpacing: "-.02em" }}>{fmt(totalDebt)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{installments.filter(i => !i.paid).length} parcelas pendentes</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Vence este mês</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", letterSpacing: "-.02em" }}>{fmt(monthDebt)}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{monthInstallments.filter(i => !i.paid).length} parcelas no mês</div>
        </Card>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 14, background: "var(--surface)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid var(--border)" }}>
        {[["lista","Compras"],["parcelas","Parcelas"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "7px 18px", borderRadius: 7, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13,
            background: tab === id ? "var(--accent)" : "transparent",
            color: tab === id ? "#fff" : "var(--muted)",
            transition: "all .15s",
          }}>{label}</button>
        ))}
      </div>

      {/* Lista */}
      {tab === "lista" && (
        <Card>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 Buscar compra..." style={{ ...inp, width: 220, fontSize: 12 }} />
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{filteredPurchases.length} compra(s)</span>
          </div>
          {filteredPurchases.length === 0
            ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhuma compra registrada</div>
            : paginated.map((p, i) => {
                const method = PAYMENT_METHODS.find(m => m.id === p.payment_method);
                return (
                  <div key={p.id} style={{ borderBottom: i < paginated.length - 1 ? "1px solid var(--border)" : "none" }}>
                    {editId === p.id ? (
                      <div style={{ padding: "10px 0", display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 8, alignItems: "center" }}>
                        <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                        <input type="number" value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                          {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={saveEdit} style={{ padding: "8px 12px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓</button>
                        <button onClick={() => setEditId(null)} style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--accentbg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{method?.icon}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{p.description}</div>
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {p.category} · {p.purchase_date}
                              {p.cards && <span style={{ color: "var(--accent)", marginLeft: 5 }}>· {p.cards.name}</span>}
                              {p.installments > 1 && <span style={{ marginLeft: 5 }}>· {p.installments}x {p.has_interest ? `c/ ${p.interest_rate}% a.m.` : "s/ juros"}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--red)" }}>{fmt(p.total_amount)}</div>
                            {p.installments > 1 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.installments}x de {fmt(p.total_amount / p.installments)}</div>}
                          </div>
                          <button onClick={() => startEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14, padding: 2 }}>✎</button>
                          <button onClick={() => del(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18 }}>×</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
          }
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: page===1?"var(--muted)":"var(--text)", cursor: page===1?"not-allowed":"pointer", fontSize: 13 }}>← Anterior</button>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: page===totalPages?"var(--muted)":"var(--text)", cursor: page===totalPages?"not-allowed":"pointer", fontSize: 13 }}>Próxima →</button>
            </div>
          )}
        </Card>
      )}

      {/* Parcelas */}
      {tab === "parcelas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: "auto", fontSize: 12 }}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <Card>
            {monthInstallments.length === 0
              ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhuma parcela neste mês</div>
              : monthInstallments.map((inst, i) => (
                <div key={inst.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < monthInstallments.length - 1 ? "1px solid var(--border)" : "none", opacity: inst.paid ? .5 : 1 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => togglePaid(inst.id, inst.paid)} style={{
                      width: 20, height: 20, borderRadius: 5, border: "2px solid",
                      borderColor: inst.paid ? "var(--green)" : "var(--border)",
                      background: inst.paid ? "var(--green)" : "transparent",
                      cursor: "pointer", color: "#fff", fontSize: 11, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{inst.paid ? "✓" : ""}</button>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: inst.paid ? "line-through" : "none" }}>
                        {inst.purchases?.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        Parcela {inst.installment_number} · Vence {inst.due_date}
                        {inst.purchases?.cards?.name && <span style={{ color: "var(--accent)", marginLeft: 5 }}>· {inst.purchases.cards.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? "var(--green)" : "var(--red)" }}>{fmt(inst.amount)}</div>
                </div>
              ))
            }
          </Card>
        </div>
      )}
      <HelpButton pageId="compras" onNavigate={onNavigate} />
    </div>
  );
}
