import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Receitas from "./pages/Receitas";
import Lancamentos from "./pages/Lancamentos";
import Compras from "./pages/Compras";
import DespesasFixas from "./pages/DespesasFixas";
import Cartoes from "./pages/Cartoes";
import Emprestimos from "./pages/Emprestimos";
import Orcamento from "./pages/Orcamento";
import Relatorios from "./pages/Relatorios";
import Metas from "./pages/Metas";
import Categorias from "./pages/Categorias";
import Perfil from "./pages/Perfil";
import Historico from "./pages/Historico";

const THEMES = [
  { id: "blue",  color: "#7c3aed" },
  { id: "gold",  color: "#c9a84c" },
  { id: "green", color: "#059669" },
  { id: "dark",  color: "#6b7280" },
];

const NAV = [
  { id: "dashboard",   label: "Dashboard",     icon: "⊟", group: "main" },
  { id: "receitas",    label: "Receitas",       icon: "↑", group: "main" },
  { id: "lancamentos",    label: "Lançamentos",    icon: "↕", group: "main" },
  { id: "despesasfixas", label: "Despesas Fixas",  icon: "📌", group: "main" },
  { id: "compras",     label: "Compras",        icon: "◻", group: "main" },
  { id: "cartoes",     label: "Cartões",        icon: "▭", group: "credito" },
  { id: "emprestimos", label: "Empréstimos",    icon: "⊕", group: "credito" },
  { id: "orcamento",   label: "Orçamento",      icon: "◑", group: "planej" },
  { id: "metas",       label: "Metas",          icon: "◎", group: "planej" },
  { id: "relatorios",  label: "Relatórios",     icon: "≡", group: "planej" },
  { id: "historico",    label: "Histórico",      icon: "⏱", group: "planej" },
  { id: "categorias",  label: "Categorias",     icon: "⊞", group: "config" },
];

const GROUPS = {
  main:    { label: "Geral" },
  credito: { label: "Crédito" },
  planej:  { label: "Planejamento" },
  config:  { label: "Configurações" },
};

export default function App() {
  const [session, setSession]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [page, setPage]             = useState("dashboard");
  const [theme, setTheme]           = useState(() => localStorage.getItem("ff_theme") || "blue");
  const [profile, setProfile]       = useState(null);
  const [showPerfil, setShowPerfil] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ff_theme", theme);
  }, [theme]);

  useEffect(() => { if (session?.user) loadProfile(); }, [session]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setProfile(data);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--bg)" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>Frame Finance</div>
    </div>
  );

  if (!session) return <Auth />;

  const pages = { dashboard: Dashboard, receitas: Receitas, lancamentos: Lancamentos, compras: Compras, despesasfixas: DespesasFixas, cartoes: Cartoes, emprestimos: Emprestimos, orcamento: Orcamento, relatorios: Relatorios, metas: Metas, categorias: Categorias, historico: Historico };
  const PageComponent = pages[page];
  const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() : "?";

  // Group nav items
  const groupedNav = Object.entries(GROUPS).map(([gid, { label }]) => ({
    gid, label, items: NAV.filter(n => n.group === gid),
  }));

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
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

        {/* Nav grouped */}
        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {groupedNav.map(({ gid, label, items }) => (
            <div key={gid}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sid-muted)", textTransform: "uppercase", letterSpacing: ".1em", paddingLeft: 10, marginBottom: 4 }}>{label}</div>
              {items.map(n => {
                const active = page === n.id;
                return (
                  <button key={n.id} onClick={() => setPage(n.id)} style={{
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

        {/* Theme */}
        <div style={{ padding: "12px 0 10px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--sid-muted)", textTransform: "uppercase", letterSpacing: ".1em", paddingLeft: 10, marginBottom: 8 }}>Tema</div>
          <div style={{ display: "flex", gap: 6, paddingLeft: 10 }}>
            {THEMES.map(t => (
              <button key={t.id} onClick={() => setTheme(t.id)} style={{
                width: 20, height: 20, borderRadius: 5, background: t.color,
                border: theme === t.id ? "2px solid #fff" : "2px solid transparent",
                cursor: "pointer", transition: "border .12s",
              }} />
            ))}
          </div>
        </div>

        {/* User */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => setShowPerfil(true)} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
            borderRadius: 7, border: "none", background: "rgba(255,255,255,.05)",
            cursor: "pointer", width: "100%", textAlign: "left", transition: "background .12s",
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
            cursor: "pointer", fontWeight: 500, fontSize: 12, textAlign: "left", transition: "background .12s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(220,38,38,.2)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(220,38,38,.1)"}
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ marginLeft: 220, flex: 1, padding: "32px 36px", minHeight: "100vh" }}>
        <div style={{ maxWidth: 980, width: "100%" }}>
          <PageComponent userId={session.user.id} />
        </div>
      </main>

      {showPerfil && <Perfil userId={session.user.id} profile={profile} onClose={() => setShowPerfil(false)} onUpdate={loadProfile} />}
    </div>
  );
}
