// Componente de loading e erro reutilizável
export function LoadingSpinner({ message = "Carregando..." }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "48px 0", gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "3px solid var(--border)",
        borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }} />
      <div style={{ fontSize: 13, color: "var(--muted)" }}>{message}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorMessage({ message, onRetry }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "40px 20px", gap: 12, textAlign: "center",
    }}>
      <span style={{ fontSize: 32 }}>⚠️</span>
      <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
        {message || "Não foi possível carregar os dados."}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Verifique sua conexão e tente novamente.
      </div>
      {onRetry && (
        <button onClick={onRetry} style={{
          padding: "9px 20px", borderRadius: 9, border: "none",
          background: "var(--accent)", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
          marginTop: 4,
        }}>Tentar de novo</button>
      )}
    </div>
  );
}

export function SaveError({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      background: "var(--redbg)", border: "1px solid var(--red)33",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, marginTop: 10,
    }}>
      <div style={{ fontSize: 13, color: "var(--red)", lineHeight: 1.5 }}>
        {message}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--red)", fontSize: 18, flexShrink: 0, padding: 0,
        }}>×</button>
      )}
    </div>
  );
}

export function SaveSuccess({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 10,
      background: "var(--greenbg)", border: "1px solid var(--green)33",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 10, marginTop: 10,
    }}>
      <div style={{ fontSize: 13, color: "var(--green)", lineHeight: 1.5 }}>
        {message}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--green)", fontSize: 18, flexShrink: 0, padding: 0,
        }}>×</button>
      )}
    </div>
  );
}
