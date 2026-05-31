import { setWelcomed } from "../lib/onboarding";
import { useIsMobile } from "../lib/useIsMobile";

export default function Welcome({ onStartTour, onSkip }) {
  const isMobile = useIsMobile();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: isMobile ? "16px" : "24px",
      overflowY: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 480, textAlign: "center",
        paddingTop: isMobile ? 16 : 0,
        paddingBottom: isMobile ? 24 : 0,
      }}>

        <div style={{
          width: isMobile ? 64 : 80,
          height: isMobile ? 64 : 80,
          borderRadius: 20,
          background: "var(--accent)",
          margin: `0 auto ${isMobile ? 20 : 28}px`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(124,58,237,.35)",
          fontSize: isMobile ? 28 : 36,
        }}>💰</div>

        <div style={{
          fontWeight: 800,
          fontSize: isMobile ? 24 : 30,
          color: "var(--text)",
          letterSpacing: "-.03em",
          marginBottom: 10,
          lineHeight: 1.2,
        }}>
          Bem-vindo ao<br />
          <span style={{ color: "var(--accent)" }}>Frame Finance</span>
        </div>

        <p style={{
          fontSize: isMobile ? 14 : 15,
          color: "var(--muted)",
          lineHeight: 1.7,
          maxWidth: 360,
          margin: `0 auto ${isMobile ? 24 : 32}px`,
        }}>
          Aqui você controla receitas, gastos, cartões, metas e muito mais. Tudo num lugar só, do jeito que faz sentido pra você.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: isMobile ? 8 : 10,
          marginBottom: isMobile ? 28 : 36,
          textAlign: "left",
        }}>
          {[
            { icon: "📊", label: "Dashboard completo" },
            { icon: "💳", label: "Controle de cartões" },
            { icon: "🎯", label: "Metas de economia" },
            { icon: "📋", label: "Orçamento inteligente" },
            { icon: "📈", label: "Relatórios detalhados" },
            { icon: "🔔", label: "Alertas de vencimento" },
          ].map(f => (
            <div key={f.label} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--surface)", borderRadius: 10,
              padding: isMobile ? "9px 12px" : "10px 14px",
              border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: isMobile ? 17 : 20 }}>{f.icon}</span>
              <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: "var(--text)" }}>{f.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => { setWelcomed(); onStartTour(); }} style={{
            padding: isMobile ? "15px 0" : "14px 0",
            borderRadius: 12, border: "none",
            background: "var(--accent)", color: "#fff",
            fontWeight: 700,
            fontSize: isMobile ? 15 : 16,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(124,58,237,.3)",
          }}>
            🗺️ Fazer o tour guiado
          </button>
          <button onClick={() => { setWelcomed(); onSkip(); }} style={{
            padding: isMobile ? "14px 0" : "12px 0",
            borderRadius: 12, border: "1px solid var(--border)",
            background: "transparent", color: "var(--muted)",
            fontWeight: 600,
            fontSize: isMobile ? 14 : 14,
            cursor: "pointer",
          }}>
            Prefiro explorar por conta
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 20 }}>
          by Kaique Rangel · KRA
        </div>
      </div>
    </div>
  );
}
