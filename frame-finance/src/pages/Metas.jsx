import { useState, useEffect } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none", fontFamily: "DM Sans",
};

export default function Metas({ userId }) {
  const isMobile = useIsMobile();
  const [goals, setGoals]       = useState([]);
  const [form, setForm]         = useState({ name: "", target: "", saved: "" });
  const [loading, setLoading]   = useState(false);

  const load = async () => {
    const { data } = await supabase.from("goals").select("*").eq("user_id", userId).order("created_at");
    setGoals(data || []);
  };

  useEffect(() => { load(); }, [userId]);

  const addGoal = async () => {
    if (!form.name || !form.target) return;
    setLoading(true);
    await supabase.from("goals").insert({
      user_id: userId, name: form.name,
      target: parseFloat(form.target), saved: parseFloat(form.saved || 0),
    });
    setForm({ name: "", target: "", saved: "" });
    await load();
    setLoading(false);
  };

  const updateSaved = async (id, saved) => {
    await supabase.from("goals").update({ saved: parseFloat(saved) || 0 }).eq("id", id);
    setGoals(prev => prev.map(g => g.id === id ? { ...g, saved: parseFloat(saved) || 0 } : g));
  };

  const delGoal = async (id) => {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 28, letterSpacing: "-.02em", color: "var(--text)" }}>Metas de Economia</h1>

      {/* Form */}
      <div style={{ background: "var(--surface)", borderRadius: 18, padding: 24, border: "1px solid var(--border)", marginBottom: 28 }}>
        <div style={{ fontWeight: 700, marginBottom: 18, fontFamily: "Syne", color: "var(--text)" }}>Nova Meta</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Nome</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Viagem Europa" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Objetivo (R$)</label>
            <input type="number" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="5000" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Já guardou (R$)</label>
            <input type="number" value={form.saved} onChange={e => setForm(f => ({ ...f, saved: e.target.value }))} placeholder="0" style={inp} />
          </div>
          <button onClick={addGoal} disabled={loading} style={{
            padding: "11px 24px", borderRadius: 10, border: "none", background: "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "Syne",
            whiteSpace: "nowrap", opacity: loading ? .7 : 1,
          }}>
            {loading ? "..." : "+ Criar"}
          </button>
        </div>
      </div>

      {/* Goals grid */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px,1fr))", gap: 18 }}>
        {goals.length === 0
          ? <div style={{ background: "var(--surface)", borderRadius: 18, padding: 40, textAlign: "center", color: "var(--muted)", border: "1px solid var(--border)" }}>
              Nenhuma meta criada ainda
            </div>
          : goals.map(g => {
            const pct = Math.min((Number(g.saved) / Number(g.target)) * 100, 100);
            const done = pct >= 100;
            return (
              <div key={g.id} style={{
                background: "var(--surface)", borderRadius: 18, padding: 24,
                border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontFamily: "Syne", fontSize: 16, color: "var(--text)" }}>{g.name}</div>
                  <button onClick={() => delGoal(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 18 }}>×</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                  <span>Guardado: <b style={{ color: "var(--text)" }}>{fmt(g.saved)}</b></span>
                  <span>Meta: <b style={{ color: "var(--text)" }}>{fmt(g.target)}</b></span>
                </div>
                <div style={{ background: "var(--bg)", borderRadius: 99, height: 10, marginBottom: 12 }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 99,
                    background: done ? "var(--green)" : "var(--accent)", transition: "width .5s",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: done ? "var(--green)" : "var(--accent)" }}>
                    {done ? "🎉 Meta alcançada!" : `${pct.toFixed(0)}% concluído`}
                  </span>
                  <input type="number" defaultValue={g.saved} onBlur={e => updateSaved(g.id, e.target.value)}
                    style={{ ...inp, width: 110, fontSize: 13 }} placeholder="Atualizar" />
                </div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
