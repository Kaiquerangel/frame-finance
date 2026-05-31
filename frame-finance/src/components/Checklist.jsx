import { useState } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { getChecklist, markChecklistItem, resetChecklist } from "../lib/onboarding";

export default function Checklist({ onNavigate, onStartTour }) {
  const isMobile = useIsMobile();
  const [items, setItems]       = useState(getChecklist);
  const [collapsed, setCollapsed] = useState(false);

  const done    = items.filter(i => i.done).length;
  const total   = items.length;
  const pct     = Math.round((done / total) * 100);
  const allDone = done === total;

  const handleItem = (item) => {
    markChecklistItem(item.id);
    setItems(getChecklist());
    onNavigate(item.page);
  };

  const handleReset = () => {
    resetChecklist();
    setItems(getChecklist());
  };

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "10px 16px", cursor: "pointer",
        marginBottom: 16, width: "100%", textAlign: "left",
        boxShadow: "var(--shadow-sm)",
      }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Primeiros passos</div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{done} de {total} feitos</div>
        </div>
        <div style={{ width: 60, height: 5, background: "var(--border)", borderRadius: 99 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: 99 }} />
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>▲</span>
      </button>
    );
  }

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)",
      marginBottom: 20, boxShadow: "var(--shadow-sm)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 20px",
        background: allDone ? "var(--greenbg)" : "var(--accentbg)",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{allDone ? "🎉" : "🗺️"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>
              {allDone ? "Boa, você completou tudo!" : "Por onde começar"}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>
              {allDone
                ? "Agora é só usar e deixar o app trabalhar por você."
                : `${done} de ${total} feitos · ${pct}%`}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {allDone && (
            <button onClick={handleReset} style={{
              fontSize: 12, color: "var(--muted)", background: "none", border: "none",
              cursor: "pointer", fontWeight: 600,
            }}>Resetar</button>
          )}
          <button onClick={() => setCollapsed(true)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--muted)", fontSize: 16, padding: "2px 6px",
          }}>▼</button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 5, background: "var(--border)" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: allDone ? "var(--green)" : "var(--accent)",
          transition: "width .5s",
        }} />
      </div>

      {/* Items */}
      <div style={{ padding: "8px 0" }}>
        {items.map((item, i) => (
          <div key={item.id} style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            gap: isMobile ? 8 : 12,
            padding: isMobile ? "14px 16px" : "12px 20px",
            borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
            opacity: item.done ? .55 : 1,
            transition: "opacity .2s",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 7, flexShrink: 0,
              border: `2px solid ${item.done ? "var(--green)" : "var(--border)"}`,
              background: item.done ? "var(--green)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 12, fontWeight: 700,
              transition: "all .2s",
            }}>
              {item.done ? "✓" : ""}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "var(--text)",
                textDecoration: item.done ? "line-through" : "none",
              }}>{item.label}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{item.tip}</div>
            </div>

            {!item.done && (
              <button onClick={() => handleItem(item)} style={{
                padding: isMobile ? "10px 0" : "6px 14px",
                width: isMobile ? "100%" : "auto",
                borderRadius: 8, border: "none",
                background: "var(--accent)", color: "#fff",
                fontWeight: 700, fontSize: isMobile ? 14 : 12,
                cursor: "pointer", whiteSpace: "nowrap",
                flexShrink: 0,
              }}>Ir →</button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px", borderTop: "1px solid var(--border)",
        background: "var(--bg)",
      }}>
        <button onClick={onStartTour} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: "var(--accent)", fontWeight: 600,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          🗺️ Ver o tour de novo
        </button>
        {!allDone && (
          <button onClick={handleReset} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--muted)", fontWeight: 500,
          }}>Resetar progresso</button>
        )}
      </div>
    </div>
  );
}
