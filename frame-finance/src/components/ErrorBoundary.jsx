import React from "react";

// Error Boundary — evita que um erro de runtime em qualquer página (Dashboard,
// Análise, Visão, etc.) derrube o app inteiro deixando a tela branca, como
// aconteceu com o bug do "calcMonthlyRate" e do "useMemo is not defined".
//
// React só permite Error Boundaries em class components — não existe
// equivalente via hooks. getDerivedStateFromError e componentDidCatch são a
// API oficial do React para isso.
//
// Uso: <ErrorBoundary onNavigate={navigate}><PageComponent ... /></ErrorBoundary>
// A key recebida (ex: page) deve mudar quando a página muda, para resetar o
// estado de erro ao navegar para outro lugar.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Loga no console para debug — não envia a lugar nenhum, mantém tudo local
    console.error("ErrorBoundary capturou um erro:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Reseta o erro se a pessoa navegar para outra página
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "60px 24px", textAlign: "center", gap: 14,
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>
            Essa página encontrou um problema
          </div>
          <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 380, lineHeight: 1.6 }}>
            Algo deu errado ao carregar esta tela. Seus dados estão seguros — isso é só um
            problema de exibição. Tente voltar para o Dashboard ou recarregar a página.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={() => this.props.onNavigate ? this.props.onNavigate("dashboard") : window.location.reload()} style={{
              padding: "10px 20px", borderRadius: 10, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              Voltar ao Dashboard
            </button>
            <button onClick={() => window.location.reload()} style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
