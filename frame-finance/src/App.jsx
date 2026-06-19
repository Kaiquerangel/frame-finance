import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import {
  getWelcomed, getTourDone, getTourRepeat, resetTour,
} from "./lib/onboarding";
import { useIsMobile } from "./lib/useIsMobile";

import Auth          from "./pages/Auth";
import Dashboard     from "./pages/Dashboard";
import Receitas      from "./pages/Receitas";
import Lancamentos   from "./pages/Lancamentos";
import Compras       from "./pages/Compras";
import DespesasFixas from "./pages/DespesasFixas";
import Gastos        from "./pages/Gastos";
import Cartoes       from "./pages/Cartoes";
import Emprestimos   from "./pages/Emprestimos";
import Orcamento     from "./pages/Orcamento";
import Relatorios    from "./pages/Relatorios";
import Metas         from "./pages/Metas";
import Categorias    from "./pages/Categorias";
import Perfil        from "./pages/Perfil";
import Historico     from "./pages/Historico";
import Analise       from "./pages/Analise";
import Aprendendo    from "./pages/Aprendendo";
import Welcome       from "./components/Welcome";
import Footer, { FooterMini } from "./components/Footer";
import Privacidade   from "./components/Privacidade";
import Tour          from "./components/Tour";
import RegistrarGasto from "./components/RegistrarGasto";
import { syncFixedExpensePayments } from "./lib/fixedExpensesSync";

const THEMES = [
  { id: "blue",  color: "#7c3aed" },
  { id: "gold",  color: "#c9a84c" },
  { id: "green", color: "#059669" },
  { id: "dark",  color: "#6b7280" },
];

const NAV = [
  { id: "dashboard",    label: "Dashboard",        icon: "⊟", group: "main" },
  { id: "receitas",     label: "Receitas",          icon: "↑",  group: "main" },
  { id: "gastos",       label: "Gastos",            icon: "💸", group: "main" },
  { id: "cartoes",      label: "Cartões",           icon: "▭",  group: "credito" },
  { id: "emprestimos",  label: "Empréstimos",       icon: "⊕",  group: "credito" },
  { id: "orcamento",    label: "Orçamento",         icon: "◑",  group: "planej" },
  { id: "metas",        label: "Metas",             icon: "◎",  group: "planej" },
  { id: "analise",      label: "Análise",           icon: "📈", group: "planej" },
  { id: "historico",    label: "Histórico",         icon: "⏱",  group: "planej" },
  { id: "categorias",   label: "Categorias",        icon: "⊞",  group: "config" },
];

const GROUPS = {
  main:    { label: "Geral" },
  credito: { label: "Crédito" },
  planej:  { label: "Planejamento" },
  config:  { label: "Configurações" },
};

const BOTTOM_NAV = ["dashboard", "gastos", "cartoes", "metas"];

export default function App() {
  const [session, setSession]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [page, setPage] = useState(() => {
    return sessionStorage.getItem("ff_last_page") || "dashboard";
  });
  const [theme, setTheme]             = useState(() => localStorage.getItem("ff_theme") || "blue");
  const [profile, setProfile]         = useState(null);
  const [showPerfil, setShowPerfil]   = useState(false);
  const [showMore, setShowMore]       = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour]         = useState(false);
  const [showPrivacidade, setShowPrivacidade] = useState(false);
  const [showRegistrar, setShowRegistrar]     = useState(false);
  const isMobile                      = useIsMobile();
  const moreRef                       = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ff_theme", theme);
  }, [theme]);

  useEffect(() => {
    if (session?.user) {
      loadProfile();
      // Gera pagamentos do mês para despesas fixas que ainda não foram criados
      syncFixedExpensePayments(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const shownThisSession = sessionStorage.getItem("ff_tour_shown_session");
    if (shownThisSession) return;

    if (!getWelcomed()) {
      setShowWelcome(true);
    } else if (!getTourDone()) {
      setTimeout(() => {
        setShowTour(true);
        sessionStorage.setItem("ff_tour_shown_session", "1");
      }, 600);
    }
    // getTourRepeat sozinho não mostra automaticamente
    // o usuário precisa clicar em "Ver tour" manualmente
  }, [session]);

  useEffect(() => {
    if (!showMore) return;
    const handler = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMore]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data);
  };

  const navigate = (id) => {
    setPage(id);
    setShowMore(false);
    sessionStorage.setItem("ff_last_page", id);
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setShowTour(true);
  };

  const handleTourEnd = () => {
    setShowTour(false);
    setPage("dashboard");
  };

  const handleStartTourManual = () => {
    resetTour();
    setShowTour(true);
    setShowMore(false);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>Frame Finance</div>
    </div>
  );

  if (!session) return <Auth />;

  const pages = {
    dashboard: Dashboard, receitas: Receitas, lancamentos: Lancamentos,
    gastos: Gastos,
    compras: Compras, despesasfixas: DespesasFixas, cartoes: Cartoes,
    emprestimos: Emprestimos, orcamento: Orcamento,
    relatorios: Analise, analise: Analise,
    metas: Metas, categorias: Categorias, historico: Historico,
    aprendendo: Aprendendo,
  };

  const PageComponent = pages[page] || Dashboard;
  const initials = profile
    ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase()
    : "?";
  const currentNav = NAV.find(n => n.id === page);
  const currentLabel = page === "aprendendo" ? "Aprendendo a Usar" : currentNav?.label || "Frame Finance";

  const groupedNav = Object.entries(GROUPS).map(([gid, { label }]) => ({
    gid, label, items: NAV.filter(n => n.group === gid),
  }));
  const morePages = NAV.filter(n => !BOTTOM_NAV.includes(n.id));

  // Botões de ajuda, aparecem próximos em ambos os layouts
  const HelpButtons = ({ inSheet = false }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: inSheet ? "0 20px" : "8px 0" }}>
      <button onClick={() => { navigate("aprendendo"); }} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: inSheet ? "11px 14px" : "8px 10px",
        borderRadius: 9, border: "none", cursor: "pointer",
        background: page === "aprendendo"
          ? "rgba(255,255,255,.12)"
          : inSheet ? "var(--accentbg)" : "rgba(255,255,255,.06)",
        color: inSheet ? "var(--accent)" : "var(--sid-muted)",
        fontSize: inSheet ? 14 : 12, fontWeight: 700, textAlign: "left",
        width: "100%",
      }}>
        <span style={{ fontSize: inSheet ? 18 : 14 }}>📖</span>
        Aprendendo a usar
      </button>
      <button onClick={handleStartTourManual} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: inSheet ? "11px 14px" : "8px 10px",
        borderRadius: 9, border: "none", cursor: "pointer",
        background: inSheet ? "var(--bg)" : "rgba(255,255,255,.06)",
        color: inSheet ? "var(--text)" : "var(--sid-muted)",
        fontSize: inSheet ? 14 : 12, fontWeight: 600, textAlign: "left",
        width: "100%",
        border: inSheet ? "1px solid var(--border)" : "none",
      }}>
        <span style={{ fontSize: inSheet ? 18 : 14 }}>🗺️</span>
        Ver tour do app
      </button>
    </div>
  );

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg)" }}>

        {showWelcome && <Welcome onStartTour={handleStartTour} onSkip={() => setShowWelcome(false)} />}
        {showTour && !showWelcome && <Tour onNavigate={navigate} onEnd={handleTourEnd} />}

        {/* Header */}
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: "var(--surface)", borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: 56,
        }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text)", letterSpacing: "-.01em" }}>
            {currentLabel}
          </div>
          <button onClick={() => setShowPerfil(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} />
              : <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{initials}</div>
            }
          </button>
        </header>

        {/* Conteúdo */}
        <main style={{ flex: 1, padding: "72px 16px 88px", overflowY: "auto" }}>
          <PageComponent
            userId={session.user.id}
            onNavigate={navigate}
            onStartTour={handleStartTourManual}
          />
        </main>

        {/* Menu Mais */}
        {showMore && (
          <>
            <div onClick={() => setShowMore(false)} style={{
              position: "fixed", inset: 0, zIndex: 150,
              background: "rgba(0,0,0,.4)", backdropFilter: "blur(2px)",
            }} />
            <div ref={moreRef} style={{
              position: "fixed", bottom: 72, left: 0, right: 0, zIndex: 200,
              background: "var(--surface)", borderRadius: "20px 20px 0 0",
              padding: "8px 0 20px",
              boxShadow: "0 -4px 30px rgba(0,0,0,.15)",
              border: "1px solid var(--border)",
              maxHeight: "80vh", overflowY: "auto",
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "8px auto 16px" }} />

              {/* Páginas agrupadas */}
              {Object.entries(GROUPS).map(([gid, { label }]) => {
                const items = morePages.filter(n => n.group === gid);
                if (items.length === 0) return null;
                return (
                  <div key={gid}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", padding: "10px 20px 4px" }}>{label}</div>
                    {items.map(n => {
                      const active = page === n.id;
                      return (
                        <button key={n.id} id={`nav-${n.id}`} onClick={() => navigate(n.id)} style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 14,
                          padding: "13px 20px", border: "none", cursor: "pointer",
                          background: active ? "var(--accentbg)" : "transparent",
                          color: active ? "var(--accent)" : "var(--text)",
                          fontSize: 15, fontWeight: active ? 700 : 400, textAlign: "left",
                        }}>
                          <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{n.icon}</span>
                          {n.label}
                          {active && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Divider + Ajuda */}
              <div style={{ height: 1, background: "var(--border)", margin: "12px 20px 14px" }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", padding: "0 20px 8px" }}>Ajuda</div>
              <HelpButtons inSheet />

              {/* Divider + Tema + Sair */}
              <div style={{ height: 1, background: "var(--border)", margin: "14px 20px 14px" }} />
              <div style={{ padding: "0 20px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Tema</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => setTheme(t.id)} style={{
                      width: 28, height: 28, borderRadius: 8, background: t.color,
                      border: theme === t.id ? "3px solid var(--text)" : "3px solid transparent",
                      cursor: "pointer",
                    }} />
                  ))}
                </div>
              </div>

              <button onClick={() => supabase.auth.signOut()} style={{
                width: "calc(100% - 40px)", margin: "8px 20px 0",
                padding: "12px 0", borderRadius: 10, border: "none",
                background: "rgba(220,38,38,.1)", color: "#ef4444",
                fontWeight: 700, fontSize: 14, cursor: "pointer",
              }}>Sair</button>
            </div>
          </>
        )}

        {/* Bottom Nav */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "var(--surface)", borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "stretch", height: 72,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {BOTTOM_NAV.map(id => {
            const n = NAV.find(x => x.id === id);
            const active = page === n.id && !showMore;
            return (
              <button key={n.id} id={`nav-${n.id}`} onClick={() => navigate(n.id)} style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 4,
                border: "none", background: "transparent", cursor: "pointer",
                color: active ? "var(--accent)" : "var(--muted)",
                transition: "color .15s", padding: "8px 0", position: "relative",
              }}>
                <div style={{
                  width: active ? 32 : 0, height: 3, borderRadius: 99,
                  background: "var(--accent)", transition: "width .2s",
                  position: "absolute", top: 0,
                }} />
                <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{n.label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMore(v => !v)} style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
            border: "none", background: "transparent", cursor: "pointer",
            color: showMore ? "var(--accent)" : "var(--muted)",
            transition: "color .15s", padding: "8px 0", position: "relative",
          }}>
            <div style={{
              width: showMore ? 32 : 0, height: 3, borderRadius: 99,
              background: "var(--accent)", transition: "width .2s",
              position: "absolute", top: 0,
            }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "center" }}>
              <div style={{ width: 18, height: 2, borderRadius: 99, background: "currentColor" }} />
              <div style={{ width: 12, height: 2, borderRadius: 99, background: "currentColor" }} />
              <div style={{ width: 18, height: 2, borderRadius: 99, background: "currentColor" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: showMore ? 700 : 400 }}>Mais</span>
          </button>
        </nav>

        {showPerfil && (
          <Perfil userId={session.user.id} profile={profile} onClose={() => setShowPerfil(false)} onUpdate={loadProfile} />
        )}
        {showPrivacidade && <Privacidade onClose={() => setShowPrivacidade(false)} />}

        {showRegistrar && (
          <RegistrarGasto
            userId={session.user.id}
            onClose={() => setShowRegistrar(false)}
            onSaved={() => setShowRegistrar(false)}
          />
        )}

        {/* Botão + flutuante — acima da bottom bar e do HelpButton */}
        <button onClick={() => setShowRegistrar(true)} style={{
          position: "fixed",
          bottom: 84,
          right: 72,
          zIndex: 89,
          width: 52, height: 52,
          borderRadius: "50%",
          background: "var(--accent)",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontSize: 28,
          fontWeight: 300,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(124,58,237,.5)",
          transition: "transform .15s, box-shadow .15s",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          title="Registrar gasto"
        >+</button>
      </div>
    );
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {showWelcome && <Welcome onStartTour={handleStartTour} onSkip={() => setShowWelcome(false)} />}
      {showTour && !showWelcome && <Tour onNavigate={navigate} onEnd={handleTourEnd} />}

      {/* Sidebar */}
      <aside style={{
        width: 220, background: "var(--sidebar)", display: "flex",
        flexDirection: "column", padding: "16px 10px", position: "fixed",
        top: 0, left: 0, height: "100vh", zIndex: 100, overflowY: "auto",
      }}>
        {/* Brand */}
        <div style={{ padding: "6px 10px 16px", borderBottom: "1px solid rgba(255,255,255,.07)", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--sid-text)", letterSpacing: "-.01em" }}>Frame Finance</div>
          <div style={{ fontSize: 10, color: "var(--sid-muted)", marginTop: 2, letterSpacing: ".08em", textTransform: "uppercase" }}>by KRA</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {groupedNav.map(({ gid, label, items }) => (
            <div key={gid}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sid-muted)", textTransform: "uppercase", letterSpacing: ".1em", paddingLeft: 10, marginBottom: 4 }}>{label}</div>
              {items.map(n => {
                const active = page === n.id;
                return (
                  <button key={n.id} id={`nav-${n.id}`} onClick={() => { setPage(n.id); sessionStorage.setItem("ff_last_page", n.id); }} style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", borderRadius: 7, border: "none",
                    cursor: "pointer", fontWeight: active ? 600 : 400,
                    fontSize: 13, transition: "all .12s", width: "100%", textAlign: "left",
                    background: active ? "var(--sid-active)" : "transparent",
                    color: active ? "#fff" : "var(--sid-muted)",
                  }}>
                    <span style={{ fontSize: 13, width: 16, textAlign: "center", opacity: active ? 1 : .6 }}>{n.icon}</span>
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Ajuda, logo abaixo da nav, antes do tema */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 10, marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sid-muted)", textTransform: "uppercase", letterSpacing: ".1em", paddingLeft: 10, marginBottom: 6 }}>Ajuda</div>
          <HelpButtons />
        </div>

        {/* Tema */}
        <div style={{ padding: "12px 0 10px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sid-muted)", textTransform: "uppercase", letterSpacing: ".1em", paddingLeft: 10, marginBottom: 8 }}>Tema</div>
          <div style={{ display: "flex", gap: 6, paddingLeft: 10 }}>
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} style={{
                width: 20, height: 20, borderRadius: 5, background: t.color,
                border: theme === t.id ? "2px solid #fff" : "2px solid transparent",
                cursor: "pointer",
              }} />
            ))}
          </div>
        </div>

        {/* User */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => setShowPerfil(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
            borderRadius: 7, border: "none", background: "rgba(255,255,255,.05)",
            cursor: "pointer", width: "100%", textAlign: "left",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.1)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,.05)"}
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--sid-active)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{initials}</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--sid-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile ? `${profile.first_name} ${profile.last_name}` : "Perfil"}
              </div>
              <div style={{ fontSize: 10, color: "var(--sid-muted)" }}>@{profile?.nick || "..."}</div>
            </div>
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{
            padding: "7px 10px", borderRadius: 7, border: "none",
            background: "rgba(220,38,38,.1)", color: "#fca5a5",
            cursor: "pointer", fontWeight: 500, fontSize: 12, textAlign: "left",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(220,38,38,.1)"}
          >Sair</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        marginLeft: 220, flex: 1,
        minHeight: "100vh",
        display: "flex", flexDirection: "column",
        padding: "32px 36px 0",
      }}>
        <div style={{ maxWidth: 980, width: "100%", flex: 1 }}>
          <PageComponent
            userId={session.user.id}
            onNavigate={navigate}
            onStartTour={handleStartTourManual}
          />
        </div>
        <div style={{ maxWidth: 980, width: "100%" }}>
          <Footer onPrivacidade={() => setShowPrivacidade(true)} />
        </div>
      </main>

      {showPerfil && (
        <Perfil userId={session.user.id} profile={profile} onClose={() => setShowPerfil(false)} onUpdate={loadProfile} />
      )}
      {showPrivacidade && <Privacidade onClose={() => setShowPrivacidade(false)} />}

      {showRegistrar && (
        <RegistrarGasto
          userId={session.user.id}
          onClose={() => setShowRegistrar(false)}
          onSaved={() => setShowRegistrar(false)}
        />
      )}

      {/* Botão + flutuante desktop — acima do HelpButton */}
      <button onClick={() => setShowRegistrar(true)} style={{
        position: "fixed",
        bottom: 80,
        right: 28,
        zIndex: 89,
        width: 52, height: 52,
        borderRadius: "50%",
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        cursor: "pointer",
        fontSize: 28,
        fontWeight: 300,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(124,58,237,.5)",
        transition: "transform .15s, box-shadow .15s",
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
        title="Registrar gasto"
      >+</button>
    </div>
  );
}
