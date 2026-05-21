import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const DEFAULT_CATS = { receita: ["Salário","Freelance","Investimentos","Outros"], despesa: ["Moradia","Alimentação","Transporte","Saúde","Lazer","Educação","Outros"] };

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "DM Sans",
};

export default function Categorias({ userId }) {
  const [custom, setCustom]   = useState([]);
  const [form, setForm]       = useState({ type: "despesa", name: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").eq("user_id", userId);
    setCustom(data || []);
  };

  useEffect(() => { load(); }, [userId]);

  const addCat = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    await supabase.from("categories").insert({ user_id: userId, type: form.type, name: form.name.trim() });
    setForm(f => ({ ...f, name: "" }));
    await load();
    setLoading(false);
  };

  const delCat = async (id) => {
    await supabase.from("categories").delete().eq("id", id);
    setCustom(prev => prev.filter(c => c.id !== id));
  };

  const allCats = (type) => {
    const defaults = DEFAULT_CATS[type].map(name => ({ id: `default-${name}`, name, isDefault: true }));
    const customList = custom.filter(c => c.type === type).map(c => ({ ...c, isDefault: false }));
    return [...defaults, ...customList];
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 28, letterSpacing: "-.02em", color: "var(--text)" }}>Categorias</h1>

      {/* Form */}
      <div style={{ background: "var(--surface)", borderRadius: 18, padding: 24, border: "1px solid var(--border)", marginBottom: 28 }}>
        <div style={{ fontWeight: 700, marginBottom: 18, fontFamily: "Syne", color: "var(--text)" }}>Nova Categoria</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Tipo</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Streaming" style={inp}
              onKeyDown={e => e.key === "Enter" && addCat()} />
          </div>
          <button onClick={addCat} disabled={loading} style={{
            padding: "11px 24px", borderRadius: 10, border: "none", background: "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "Syne",
            opacity: loading ? .7 : 1,
          }}>
            {loading ? "..." : "+ Adicionar"}
          </button>
        </div>
      </div>

      {/* Lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {["receita", "despesa"].map(type => (
          <div key={type} style={{ background: "var(--surface)", borderRadius: 18, padding: 24, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontFamily: "Syne", marginBottom: 18, color: "var(--text)" }}>
              {type === "receita" ? "🟢" : "🔴"} Categorias de {type}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {allCats(type).map(cat => (
                <div key={cat.id} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--bg)", border: "1.5px solid var(--border)",
                  borderRadius: 99, padding: "6px 14px", fontSize: 13, fontWeight: 600,
                  color: "var(--text)",
                }}>
                  {cat.name}
                  {!cat.isDefault && (
                    <button onClick={() => delCat(cat.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--red)", fontSize: 15, lineHeight: 1, padding: 0,
                    }}>×</button>
                  )}
                  {cat.isDefault && (
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: 2 }}>•</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
