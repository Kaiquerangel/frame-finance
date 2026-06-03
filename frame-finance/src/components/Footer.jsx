// Rodapé desktop — aparece em todas as páginas
// Mobile: só no Auth e no Perfil (via FooterMini)

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "https://instagram.com/kaiquerangel",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    name: "GitHub",
    href: "https://github.com/Kaiquerangel",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>
    ),
  },
  {
    name: "X (Twitter)",
    href: "#",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
];

const TECH_STACK = [
  "React", "Vite", "Supabase", "Recharts",
];

export default function Footer({ onPrivacidade }) {
  return (
    <footer style={{
      marginTop: 40,
      borderTop: "1px solid var(--border)",
      padding: "16px 0 20px",
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        {/* Esquerda: marca + versão */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Frame Finance</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>v1.0.0</span>
          </div>
          <span style={{ fontSize: 11, color: "var(--border)" }}>·</span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>by Kaique Rangel · KRA</span>
          <span style={{ fontSize: 11, color: "var(--border)" }}>·</span>

          {/* Tecnologias */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {TECH_STACK.map((tech, i) => (
              <span key={tech} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{tech}</span>
                {i < TECH_STACK.length - 1 && (
                  <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Direita: redes sociais + privacidade */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Redes sociais */}
          {SOCIAL_LINKS.map(s => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              title={s.name}
              style={{
                color: "var(--muted)",
                display: "flex", alignItems: "center",
                transition: "color .15s",
                textDecoration: "none",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
            >
              {s.icon}
            </a>
          ))}

          <span style={{ fontSize: 11, color: "var(--border)" }}>·</span>

          {/* Privacidade */}
          <button
            onClick={onPrivacidade}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--muted)", fontWeight: 500,
              padding: 0, transition: "color .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--accent)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
          >
            Privacidade e Segurança
          </button>
        </div>
      </div>
    </footer>
  );
}

// Versão compacta para Auth e Perfil mobile
export function FooterMini({ onPrivacidade }) {
  return (
    <div style={{
      borderTop: "1px solid var(--border)",
      paddingTop: 16, marginTop: 24,
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 10,
    }}>
      {/* Redes sociais */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {SOCIAL_LINKS.map(s => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            title={s.name}
            style={{ color: "var(--muted)", display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            {s.icon}
          </a>
        ))}
      </div>

      {/* Links */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Frame Finance v1.0.0</span>
        <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>KRA · Kaique Rangel</span>
        <span style={{ fontSize: 10, color: "var(--border)" }}>·</span>
        <button onClick={onPrivacidade} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: "var(--accent)", fontWeight: 600, padding: 0,
        }}>
          Privacidade e Segurança
        </button>
      </div>

      {/* Tech stack */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {TECH_STACK.map((tech, i) => (
          <span key={tech} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{tech}</span>
            {i < TECH_STACK.length - 1 && <span style={{ fontSize: 9, color: "var(--border)" }}>·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}