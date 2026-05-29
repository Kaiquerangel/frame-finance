import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const today = () => new Date().toISOString().slice(0, 7);

const COLORS = ["#7c3aed","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#14b8a6","#f97316"];

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

export default function Cartoes({ userId }) {
  const isMobile = useIsMobile();
  const [cards, setCards]               = useState([]);
  const [installments, setInstallments] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [filterMonth, setFilterMonth]   = useState(today());
  const [loading, setLoading]           = useState(false);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [form, setForm] = useState({ name: "", limit_amount: "", closing_day: "", due_day: "", color: "#7c3aed" });

  const load = async () => {
    const [{ data: c }, { data: i }] = await Promise.all([
      supabase.from("cards").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("installments")
        .select("*, purchases(description, category, total_amount, payment_method, has_interest, interest_rate, card_id)")
        .eq("user_id", userId).order("due_date"),
    ]);
    setCards(c || []);
    setInstallments(i || []);
  };

  useEffect(() => { load(); }, [userId]);

  const add = async () => {
    if (!form.name) return;
    setLoading(true);
    await supabase.from("cards").insert({
      user_id: userId, name: form.name,
      limit_amount: parseFloat(form.limit_amount || 0),
      closing_day: parseInt(form.closing_day || 0),
      due_day: parseInt(form.due_day || 0),
      color: form.color,
    });
    setForm({ name: "", limit_amount: "", closing_day: "", due_day: "", color: "#7c3aed" });
    await load();
    setLoading(false);
  };

  const del = async (id) => {
    await supabase.from("cards").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const startEdit = (card) => { setEditId(card.id); setEditForm({ ...card }); };

  const saveEdit = async () => {
    await supabase.from("cards").update({
      name: editForm.name,
      limit_amount: parseFloat(editForm.limit_amount || 0),
      closing_day: parseInt(editForm.closing_day || 0),
      due_day: parseInt(editForm.due_day || 0),
      color: editForm.color,
    }).eq("id", editId);
    setEditId(null);
    await load();
  };

  const togglePaid = async (id, paid) => {
    await supabase.from("installments").update({ paid: !paid }).eq("id", id);
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: !paid } : i));
  };

  const cardInstallments = useMemo(() =>
    installments.filter(i => i.purchases?.card_id === selected?.id),
    [installments, selected]
  );

  const months = useMemo(() => {
    const s = new Set(cardInstallments.map(i => i.due_date.slice(0, 7)));
    s.add(filterMonth);
    return [...s].sort();
  }, [cardInstallments, filterMonth]);

  const monthInst = useMemo(() =>
    cardInstallments.filter(i => i.due_date.startsWith(filterMonth)),
    [cardInstallments, filterMonth]
  );

  const monthTotal    = monthInst.reduce((a, i) => a + Number(i.amount), 0);
  const monthInterest = monthInst.reduce((a, i) => {
    if (i.purchases?.has_interest && i.purchases?.interest_rate > 0)
      return a + (Number(i.amount) * Number(i.purchases.interest_rate) / 100);
    return a;
  }, 0);
  const monthPaid = monthInst.filter(i => i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const monthOpen = monthTotal - monthPaid;

  const usedLimit = selected
    ? installments.filter(i => !i.paid && i.purchases?.card_id === selected.id).reduce((a, i) => a + Number(i.amount), 0)
    : 0;
  const limitPct = selected && selected.limit_amount > 0
    ? Math.min((usedLimit / selected.limit_amount) * 100, 100) : 0;

  // No mobile: quando seleciona um cartão, mostra só o detalhe (sem a lista ao lado)
  const showDetail = selected !== null;
  const showList   = !isMobile || !showDetail;

  return (
    <div>
      {/* Header mobile com botão voltar quando está no detalhe */}
      {isMobile && showDetail ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setSelected(null)} style={{
            background: "var(--bg)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "7px 12px", cursor: "pointer",
            color: "var(--text)", fontSize: 13, fontWeight: 600,
          }}>← Voltar</button>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{selected.name}</div>
        </div>
      ) : !isMobile ? (
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Cartões</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Gerencie seus cartões e faturas</p>
        </div>
      ) : null}

      {/* Layout: desktop = grid lado a lado | mobile = tela única */}
      <div style={{
        display: "grid",
        gridTemplateColumns: (!isMobile && showDetail) ? "340px 1fr" : "1fr",
        gap: 16,
      }}>

        {/* ── Coluna esquerda: form + lista de cartões ── */}
        {showList && (
          <div>
            {/* Form novo cartão */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--text)" }}>Novo Cartão</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Nome</div>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Nubank, Inter..." style={inp} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Limite</div>
                    <input type="number" value={form.limit_amount} onChange={e => setForm(f => ({ ...f, limit_amount: e.target.value }))} placeholder="5000" style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Fechamento</div>
                    <input type="number" min="1" max="31" value={form.closing_day} onChange={e => setForm(f => ({ ...f, closing_day: e.target.value }))} placeholder="15" style={inp} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Vencimento</div>
                    <input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} placeholder="22" style={inp} />
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Cor</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                        width: 26, height: 26, borderRadius: 7, background: c,
                        border: form.color === c ? "2.5px solid var(--text)" : "2.5px solid transparent",
                        cursor: "pointer", transition: "border .12s",
                      }} />
                    ))}
                  </div>
                </div>
                <button onClick={add} disabled={loading} style={{
                  padding: "9px 0", borderRadius: 8, border: "none", background: "var(--accent)",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1,
                }}>
                  {loading ? "Salvando..." : "+ Adicionar cartão"}
                </button>
              </div>
            </Card>

            {/* Lista de cartões */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cards.length === 0 && (
                <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum cartão cadastrado</div>
              )}
              {cards.map(card => {
                const usedCard = installments
                  .filter(i => !i.paid && i.purchases?.card_id === card.id)
                  .reduce((a, i) => a + Number(i.amount), 0);
                const pct = card.limit_amount > 0 ? Math.min((usedCard / card.limit_amount) * 100, 100) : 0;
                const isSelected = selected?.id === card.id;
                return (
                  <div key={card.id} onClick={() => setSelected(isSelected ? null : card)}
                    style={{
                      borderRadius: 14, padding: 18, cursor: "pointer", position: "relative", overflow: "hidden",
                      background: `linear-gradient(135deg, ${card.color}ee, ${card.color}99)`,
                      border: isSelected ? "2.5px solid var(--text)" : "2.5px solid transparent",
                      transition: "border .15s",
                    }}>
                    <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.1)" }} />
                    <div style={{ position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "#fff" }}>{card.name}</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={e => { e.stopPropagation(); startEdit(card); }} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 6, padding: "2px 7px", cursor: "pointer", color: "#fff", fontSize: 13 }}>✎</button>
                          <button onClick={e => { e.stopPropagation(); del(card.id); }} style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: 6, padding: "2px 7px", cursor: "pointer", color: "#fff", fontSize: 14 }}>×</button>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        {[
                          { l: "Limite", v: fmt(card.limit_amount) },
                          { l: "Fechamento", v: `Dia ${card.closing_day || "-"}` },
                          { l: "Vencimento", v: `Dia ${card.due_day || "-"}` },
                        ].map(({ l, v }) => (
                          <div key={l}>
                            <div style={{ fontSize: 9, color: "rgba(255,255,255,.7)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{l}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {card.limit_amount > 0 && (
                        <div>
                          <div style={{ height: 4, background: "rgba(255,255,255,.25)", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: "#fff", borderRadius: 99 }} />
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,.8)", marginTop: 4 }}>{pct.toFixed(0)}% do limite utilizado</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Coluna direita / tela de detalhe mobile: fatura ── */}
        {showDetail && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              {!isMobile && (
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: "var(--text)" }}>
                  Fatura — {selected.name}
                </div>
              )}

              {/* Seletor de mês */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {months.map(m => (
                  <button key={m} onClick={() => setFilterMonth(m)} style={{
                    padding: "5px 12px", borderRadius: 6, border: "1px solid",
                    borderColor: filterMonth === m ? "var(--accent)" : "var(--border)",
                    background: filterMonth === m ? "var(--accentbg)" : "transparent",
                    color: filterMonth === m ? "var(--accent)" : "var(--muted)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>{monthLabel(m)}</button>
                ))}
              </div>

              {/* KPIs do mês */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Total fatura", value: fmt(monthTotal),    color: "var(--text)" },
                  { label: "Com juros",    value: fmt(monthInterest), color: "var(--red)" },
                  { label: "Pago",         value: fmt(monthPaid),     color: "var(--green)" },
                  { label: "Em aberto",    value: fmt(monthOpen),     color: monthOpen > 0 ? "var(--amber)" : "var(--green)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 700, color, fontSize: 14 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Uso do limite */}
              {selected.limit_amount > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "var(--muted)" }}>Limite utilizado</span>
                    <span style={{ color: limitPct > 80 ? "var(--red)" : "var(--muted)" }}>{fmt(usedLimit)} / {fmt(selected.limit_amount)}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 99 }}>
                    <div style={{ height: "100%", width: `${limitPct}%`, background: limitPct > 80 ? "var(--red)" : "var(--accent)", borderRadius: 99, transition: "width .4s" }} />
                  </div>
                </div>
              )}

              {/* Parcelas */}
              {monthInst.length === 0
                ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "24px 0", fontSize: 13 }}>Nenhuma parcela neste mês</div>
                : monthInst.map((inst, i) => (
                  <div key={inst.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: i < monthInst.length - 1 ? "1px solid var(--border)" : "none",
                    opacity: inst.paid ? .5 : 1,
                  }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 0 }}>
                      <button onClick={() => togglePaid(inst.id, inst.paid)} style={{
                        width: 20, height: 20, borderRadius: 6, border: "2px solid",
                        borderColor: inst.paid ? "var(--green)" : "var(--border)",
                        background: inst.paid ? "var(--green)" : "transparent",
                        cursor: "pointer", color: "#fff", fontSize: 11, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{inst.paid ? "✓" : ""}</button>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: inst.paid ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {inst.purchases?.description}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                          Vence {inst.due_date}
                          {inst.purchases?.has_interest && <span style={{ color: "var(--red)", marginLeft: 6 }}>c/ juros</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? "var(--green)" : "var(--red)", flexShrink: 0, marginLeft: 8 }}>{fmt(inst.amount)}</div>
                  </div>
                ))
              }
            </Card>
          </div>
        )}
      </div>

      {/* Modal de edição — FORA do grid */}
      {editId && (
        <div onClick={e => e.target === e.currentTarget && setEditId(null)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{ background: "var(--surface)", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20, color: "var(--text)" }}>Editar Cartão</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Nome</div>
                <input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Limite</div>
                  <input type="number" value={editForm.limit_amount || ""} onChange={e => setEditForm(f => ({ ...f, limit_amount: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Fechamento</div>
                  <input type="number" min="1" max="31" value={editForm.closing_day || ""} onChange={e => setEditForm(f => ({ ...f, closing_day: e.target.value }))} style={inp} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Vencimento</div>
                  <input type="number" min="1" max="31" value={editForm.due_day || ""} onChange={e => setEditForm(f => ({ ...f, due_day: e.target.value }))} style={inp} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Cor</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))} style={{
                      width: 26, height: 26, borderRadius: 7, background: c,
                      border: editForm.color === c ? "2.5px solid var(--text)" : "2.5px solid transparent",
                      cursor: "pointer",
                    }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setEditId(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveEdit} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Salvar alterações</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}