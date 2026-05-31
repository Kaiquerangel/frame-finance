import { useIsMobile } from "../lib/useIsMobile";

export default function EmptyBanner({ pageId, onNavigate, message }) {
  const isMobile = useIsMobile();

  return (
    <div style={{
      display: "flex",
      flexDirection: isMobile ? "column" : "row",
      alignItems: isMobile ? "flex-start" : "center",
      gap: isMobile ? 10 : 12,
      background: "var(--accentbg)",
      border: "1px solid var(--accent)33",
      borderRadius: 12,
      padding: "14px 16px",
      marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📖</span>
        <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, lineHeight: 1.5 }}>
          {message || "Nunca usou essa seção? Veja como funciona antes de começar."}
        </span>
      </div>
      <button
        onClick={() => {
          sessionStorage.setItem("ff_help_section", pageId);
          onNavigate("aprendendo");
        }}
        style={{
          padding: "9px 16px",
          borderRadius: 8, border: "none",
          background: "var(--accent)", color: "#fff",
          fontWeight: 700, fontSize: 13,
          cursor: "pointer", whiteSpace: "nowrap",
          width: isMobile ? "100%" : "auto",
        }}
      >
        Como usar essa seção →
      </button>
    </div>
  );
}
