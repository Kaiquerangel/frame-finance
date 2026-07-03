import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useIsMobile } from "../lib/useIsMobile";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const SOURCES = [
  { key: "transactions", label: "Lançamentos",    icon: "↓", color: "var(--red)",    page: "gastos" },
  { key: "revenues",     label: "Receitas",        icon: "↑", color: "var(--green)",  page: "receitas" },
  { key: "purchases",    label: "Compras",          icon: "💳", color: "#3b82f6",      page: "gastos" },
  { key: "fixed",        label: "Despesas fixas",  icon: "📌", color: "#f59e0b",      page: "gastos" },
  { key: "loans",        label: "Empréstimos",     icon: "🏦", color: "var(--accent)", page: "emprestimos" },
];

export default function BuscaGlobal({ userId, onNavigate, onClose }) {
  const isMobile      = useIsMobile();
  const [query, setQuery]   = useState("");
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  // Foca o input ao abrir
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fecha com Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const search = useCallback(async (q) => {
    if (!q || q.trim().length < 2) { setResults({}); return; }
    setLoading(true);
    const term = `%${q.trim()}%`;

    const [
      { data: transactions },
      { data: revenues },
      { data: purchases },
      { data: fixed },
      { data: loans },
    ] = await Promise.all([
      supabase.from("transactions").select("id,description,value,cat,date,type").eq("user_id", userId).ilike("description", term).order("date", { ascending: false }).limit(5),
      supabase.from("revenues").select("id,description,amount,category,date").eq("user_id", userId).ilike("description", term).order("date", { ascending: false }).limit(5),
      supabase.from("purchases").select("id,description,total_amount,category,purchase_date").eq("user_id", userId).ilike("description", term).order("purchase_date", { ascending: false }).limit(5),
      supabase.from("fixed_expenses").select("id,description,amount,category").eq("user_id", userId).ilike("description", term).limit(5),
      supabase.from("loans").select("id,description,total_amount,type").eq("user_id", userId).ilike("description", term).limit(5),
    ]);

    setResults({
      transactions: transactions || [],
      revenues:     revenues     || [],
      purchases:    purchases    || [],
      fixed:        fixed        || [],
      loans:        loans        || [],
    });
    setLoading(false);
  }, [userId]);

  // Debounce de 300ms
  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const totalResults = Object.values(results).reduce((a, v) => a + v.length, 0);
  const hasQuery = query.trim().length >= 2;

  const getItemValue = (source, item) => {
    if (source === "transactions") return fmt(item.value);
    if (source === "revenues")     return fmt(item.amount);
    if (source === "purchases")    return fmt(item.total_amount);
    if (source === "fixed")        return fmt(item.amount) + "/mês";
    if (source === "loans")        return fmt(item.total_amount);
    return "";
  };

  const getItemSub = (source, item) => {
    if (source === "transactions") return `${item.cat} · ${item.date}`;
    if (source === "revenues")     return `${item.category} · ${item.date}`;
    if (source === "purchases")    return `${item.category} · ${item.purchase_date}`;
    if (source === "fixed")        return item.category;
    if (source === "loans")        return item.type === "emprestimo" ? "Empréstimo" : "Financiamento";
    return "";
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: isMobile ? "flex-start" : "center",
        justifyContent: "center",
        padding: isMobile ? "16px 12px" : "60px 20px 20px",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 560,
        background: "var(--surface)",
        borderRadius: isMobile ? 16 : 20,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        maxHeight: isMobile ? "85vh" : "70vh",
        display: "flex", flexDirection: "column",
      }}>
        {/* Input de busca */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, color: "var(--muted)", flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar lançamentos, receitas, compras, despesas fixas..."
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 15,
              background: "transparent", color: "var(--text)",
            }}
          />
          {loading && (
            <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--accent)", animation: "spin .6s linear infinite", flexShrink: 0 }} />
          )}
          <button onClick={onClose} style={{ border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 12, flexShrink: 0, padding: "4px 8px", borderRadius: 6, background: "var(--bg)" }}>Esc</button>
        </div>

        {/* Resultados */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {!hasQuery && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Digite pelo menos 2 caracteres para buscar em todos os seus registros
            </div>
          )}

          {hasQuery && !loading && totalResults === 0 && (
            <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Nenhum resultado encontrado para <strong style={{ color: "var(--text)" }}>"{query}"</strong>
            </div>
          )}

          {hasQuery && totalResults > 0 && SOURCES.map(src => {
            const items = results[src.key] || [];
            if (items.length === 0) return null;
            return (
              <div key={src.key}>
                {/* Header da seção */}
                <div style={{
                  padding: "8px 18px 4px", fontSize: 11, fontWeight: 700,
                  color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg)",
                }}>
                  {src.label}
                </div>

                {/* Itens */}
                {items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(src.page); onClose(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "11px 18px",
                      border: "none", borderBottom: "1px solid var(--border)",
                      background: "var(--surface)", cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
                    onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: "var(--bg)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, color: src.color,
                    }}>{src.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                        {getItemSub(src.key, item)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: src.color, flexShrink: 0 }}>
                      {getItemValue(src.key, item)}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {hasQuery && totalResults > 0 && (
          <div style={{
            padding: "8px 18px", borderTop: "1px solid var(--border)",
            fontSize: 11, color: "var(--muted)", background: "var(--bg)", flexShrink: 0,
          }}>
            {totalResults} resultado{totalResults !== 1 ? "s" : ""} · Clique para ir à página
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
