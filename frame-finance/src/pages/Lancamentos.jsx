import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
const ITEMS_PER_PAGE = 15;

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

export default function Lancamentos({ userId }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories]     = useState({ receita: [], despesa: [] });
  const [filterMonth, setFilterMonth]   = useState(today().slice(0, 7));
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [filterCat, setFilterCat]       = useState("all");
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(false);
  const [editId, setEditId]             = useState(null);
  const [editForm, setEditForm]         = useState({});
  const [form, setForm] = useState({ type: "despesa", description: "", value: "", cat: "", date: today() });

  const load = async () => {
    const [{ data: txs }, cats] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
      loadCategories(userId),
    ]);
    setTransactions(txs || []);
    setCategories(cats);
  };

  useEffect(() => { load(); }, [userId]);

  const months = useMemo(() => {
    const s = new Set(transactions.map(t => t.date.slice(0, 7)));
    s.add(filterMonth);
    return [...s].sort().reverse();
  }, [transactions, filterMonth]);

  // All categories for filter
  const allCats = useMemo(() => [...new Set(transactions.map(t => t.cat))].sort(), [transactions]);

  const filtered = useMemo(() => {
    let list = transactions.filter(t => t.date.startsWith(filterMonth));
    if (filterType !== "all") list = list.filter(t => t.type === filterType);
    if (filterCat !== "all") list = list.filter(t => t.cat === filterCat);
    if (search) list = list.filter(t => t.description.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [transactions, filterMonth, filterType, filterCat, search]);

  const totals = useMemo(() => {
    const rec = filtered.filter(t => t.type === "receita").reduce((a, t) => a + Number(t.value), 0);
    const dep = filtered.filter(t => t.type === "despesa").reduce((a, t) => a + Number(t.value), 0);
    return { rec, dep, bal: rec - dep };
  }, [filtered]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const add = async () => {
    if (!form.description || !form.value || !form.cat) return;
    setLoading(true);
    await supabase.from("transactions").insert({
      user_id: userId, type: form.type, description: form.description,
      value: parseFloat(form.value), cat: form.cat, date: form.date,
    });
    setForm(f => ({ ...f, description: "", value: "", cat: "" }));
    setPage(1);
    await load();
    setLoading(false);
  };

  const del = async (id) => {
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const startEdit = (tx) => { setEditId(tx.id); setEditForm({ ...tx }); };

  const saveEdit = async () => {
    await supabase.from("transactions").update({
      description: editForm.description, value: parseFloat(editForm.value),
      cat: editForm.cat, date: editForm.date, type: editForm.type,
    }).eq("id", editId);
    setEditId(null);
    await load();
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Lançamentos</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Gastos avulsos do dia a dia — mercado, farmácia, restaurante</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Receitas", value: totals.rec, color: "var(--green)" },
          { label: "Despesas", value: totals.dep, color: "var(--red)" },
          { label: "Saldo",    value: totals.bal, color: totals.bal >= 0 ? "var(--accent)" : "var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: "-.02em" }}>{fmt(value)}</div>
          </Card>
        ))}
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--text)" }}>Novo Lançamento</div>
        <div style={{ display: "flex", background: "var(--bg)", borderRadius: 8, padding: 3, marginBottom: 12, width: "fit-content" }}>
          {["despesa", "receita"].map(t => (
            <button key={t} onClick={() => setForm(f => ({ ...f, type: t, cat: "" }))} style={{
              padding: "6px 18px", borderRadius: 6, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, transition: "all .12s",
              background: form.type === t ? (t === "despesa" ? "var(--red)" : "var(--green)") : "transparent",
              color: form.type === t ? "#fff" : "var(--muted)",
            }}>
              {t === "despesa" ? "↓ Despesa" : "↑ Receita"}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
          <div><Label>Descrição</Label><input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Mercado, Farmácia..." style={inp} onKeyDown={e => e.key === "Enter" && add()} /></div>
          <div><Label>Valor (R$)</Label><input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" style={inp} /></div>
          <div><Label>Categoria</Label>
            <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {categories[form.type].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Data</Label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></div>
          <button onClick={add} disabled={loading} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1, whiteSpace: "nowrap" }}>
            {loading ? "..." : "+ Add"}
          </button>
        </div>
      </Card>

      {/* Filters */}
      <Card>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <select value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setPage(1); }} style={{ ...inp, width: "auto", fontSize: 12 }}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Todos os tipos</option>
            <option value="despesa">Despesas</option>
            <option value="receita">Receitas</option>
          </select>
          <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }} style={{ ...inp, width: "auto", fontSize: 12 }}>
            <option value="all">Todas categorias</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="🔍 Buscar..." style={{ ...inp, width: 180, fontSize: 12 }} />
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
            {filtered.length} lançamento(s)
          </div>
        </div>

        {filtered.length === 0
          ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum lançamento encontrado</div>
          : paginated.map((tx, i) => (
            <div key={tx.id} style={{ borderBottom: i < paginated.length - 1 ? "1px solid var(--border)" : "none" }}>
              {editId === tx.id ? (
                <div style={{ padding: "10px 0", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto auto", gap: 8, alignItems: "center" }}>
                  <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <input type="number" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <select value={editForm.cat} onChange={e => setEditForm(f => ({ ...f, cat: e.target.value }))} style={{ ...inp, fontSize: 12 }}>
                    {categories[editForm.type].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} style={{ ...inp, fontSize: 12 }} />
                  <button onClick={saveEdit} style={{ padding: "8px 12px", borderRadius: 7, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditId(null)} style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: tx.type === "receita" ? "var(--greenbg)" : "var(--redbg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                      {tx.type === "receita" ? "↑" : "↓"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{tx.cat} · {tx.date}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: tx.type === "receita" ? "var(--green)" : "var(--red)" }}>
                      {tx.type === "receita" ? "+" : "-"}{fmt(tx.value)}
                    </span>
                    <button onClick={() => startEdit(tx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14, padding: 2 }}>✎</button>
                    <button onClick={() => del(tx.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 18, padding: 2 }}>×</button>
                  </div>
                </div>
              )}
            </div>
          ))
        }

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: page === 1 ? "var(--muted)" : "var(--text)", cursor: page === 1 ? "not-allowed" : "pointer", fontSize: 13 }}>← Anterior</button>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", color: page === totalPages ? "var(--muted)" : "var(--text)", cursor: page === totalPages ? "not-allowed" : "pointer", fontSize: 13 }}>Próxima →</button>
          </div>
        )}
      </Card>
    </div>
  );
}
