import { setWelcomed } from "../lib/onboarding";

export default function Welcome({ onStartTour, onSkip }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>

        {/* Logo animado */}
        <div style={{
          width: 80, height: 80, borderRadius: 24,
          background: "var(--accent)", margin: "0 auto 28px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(124,58,237,.35)",
          fontSize: 36,
        }}>💰</div>

        <div style={{ fontWeight: 800, fontSize: 30, color: "var(--text)", letterSpacing: "-.03em", marginBottom: 10 }}>
          Bem-vindo ao<br />
          <span style={{ color: "var(--accent)" }}>Frame Finance</span>
        </div>

        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.7, marginBottom: 32, maxWidth: 360, margin: "0 auto 32px" }}>
          Seu assistente financeiro pessoal. Controle receitas, gastos, cartões, metas e muito mais — tudo em um só lugar.
        </p>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 36, textAlign: "left" }}>
          {[
            { icon: "📊", label: "Dashboard completo" },
            { icon: "💳", label: "Gestão de cartões" },
            { icon: "🎯", label: "Metas de economia" },
            { icon: "📋", label: "Orçamento inteligente" },
            { icon: "📈", label: "Relatórios detalhados" },
            { icon: "🔔", label: "Alertas de vencimento" },
          ].map(f => (
            <div key={f.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--surface)", borderRadius: 10, padding: "10px 14px",
              border: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Botões */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => { setWelcomed(); onStartTour(); }} style={{
            padding: "14px 0", borderRadius: 12, border: "none",
            background: "var(--accent)", color: "#fff",
            fontWeight: 700, fontSize: 16, cursor: "pointer",
            boxShadow: "0 4px 16px rgba(124,58,237,.3)",
          }}>
            🗺️ Fazer tour guiado
          </button>
          <button onClick={() => { setWelcomed(); onSkip(); }} style={{
            padding: "12px 0", borderRadius: 12, border: "1px solid var(--border)",
            background: "transparent", color: "var(--muted)",
            fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            Pular e começar direto
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 20 }}>
          by Kaique Rangel · KRA
        </div>
      </div>
    </div>
  );
}
