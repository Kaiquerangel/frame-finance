import { useIsMobile } from "../lib/useIsMobile";

export default function HelpButton({ pageId, onNavigate }) {
  const isMobile = useIsMobile();

  return (
    <button
      onClick={() => {
        sessionStorage.setItem("ff_help_section", pageId);
        onNavigate("aprendendo");
      }}
      title="Aprender a usar esta seção"
      style={{
        position: "fixed",
        bottom: isMobile ? 84 : 28,
        right: isMobile ? 16 : 28,
        zIndex: 90,
        width: isMobile ? 48 : 44,
        height: isMobile ? 48 : 44,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontSize: isMobile ? 22 : 20,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(124,58,237,.45)",
        transition: "transform .15s, box-shadow .15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = "0 6px 24px rgba(124,58,237,.55)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(124,58,237,.45)";
      }}
    >
      ?
    </button>
  );
}
