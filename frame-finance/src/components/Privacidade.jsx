import { useIsMobile } from "../lib/useIsMobile";

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 10 }}>{title}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </div>
  </div>
);

const Item = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
    <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7 }}>{children}</span>
  </div>
);

export default function Privacidade({ onClose }) {
  const isMobile = useIsMobile();

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center", padding: isMobile ? 0 : 24,
    }}>
      <div style={{
        width: "100%",
        maxWidth: isMobile ? "100%" : 600,
        maxHeight: isMobile ? "90vh" : "85vh",
        background: "var(--surface)",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Handle mobile */}
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 0" }} />
        )}

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: isMobile ? "16px 20px 12px" : "24px 28px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>Privacidade e Segurança</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Frame Finance · KRA · v1.0.0</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)", cursor: "pointer", color: "var(--muted)",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Conteúdo com scroll */}
        <div style={{ overflowY: "auto", padding: isMobile ? "20px 20px 32px" : "28px 28px 32px" }}>

          {/* Intro */}
          <div style={{
            background: "var(--accentbg)", borderRadius: 12, padding: "14px 16px",
            border: "1px solid var(--accent)22", marginBottom: 28,
          }}>
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, margin: 0 }}>
              O Frame Finance foi criado pra te ajudar a organizar as suas finanças de um jeito simples e seguro.
              Antes de qualquer coisa, você precisa saber o que este app faz e o que ele não faz com as suas informações.
            </p>
          </div>

          <Section title="O que o app guarda sobre você">
            <Item icon="👤">Seu nome, sobrenome, nick e e-mail, usados só pra criar e identificar a sua conta.</Item>
            <Item icon="📊">Os dados financeiros que você mesmo lança: receitas, gastos, metas, orçamentos e parcelas. Nada é coletado automaticamente.</Item>
            <Item icon="🖼️">Foto de perfil, se você optar por adicionar uma. É completamente opcional.</Item>
            <Item icon="🎨">Suas preferências de tema e configurações visuais do app.</Item>
          </Section>

          <Section title="O que o app nunca pede e nunca vai pedir">
            <Item icon="🚫">Número do cartão de crédito, CVV, data de validade ou qualquer dado do cartão. Quando você cadastra um cartão aqui, você está apenas criando um apelido pra organizar as faturas. Nenhum dado real do cartão é armazenado.</Item>
            <Item icon="🚫">Senha do banco, token de acesso, dados de login em outras plataformas.</Item>
            <Item icon="🚫">CPF, RG, data de nascimento ou qualquer documento pessoal.</Item>
            <Item icon="🚫">Acesso à sua conta bancária ou a qualquer instituição financeira.</Item>
          </Section>

          <Section title="Sincronização com bancos e outros apps">
            <Item icon="🔒">O Frame Finance não se conecta a nenhum banco, corretora, carteira digital ou aplicativo financeiro. Não existe e não vai existir integração automática com Open Finance ou qualquer outra plataforma.</Item>
            <Item icon="🔒">Tudo que aparece aqui foi colocado por você manualmente. O app é uma ferramenta de controle, não um agregador financeiro.</Item>
            <Item icon="🔒">Essa decisão foi tomada intencionalmente por questões de segurança. Quanto menos conexões externas, menor o risco pra você.</Item>
          </Section>

          <Section title="Onde seus dados ficam">
            <Item icon="☁️">Os dados são armazenados no Supabase, uma plataforma de banco de dados segura com criptografia em trânsito e em repouso.</Item>
            <Item icon="☁️">Seus dados são seus. O Frame Finance não vende, não compartilha e não usa suas informações pra fins publicitários.</Item>
            <Item icon="☁️">Você pode excluir sua conta a qualquer momento pelo seu Perfil. Quando isso acontece, todos os seus dados são removidos permanentemente.</Item>
          </Section>

          <Section title="Responsabilidade">
            <Item icon="📋">O Frame Finance é uma ferramenta de organização pessoal. As informações exibidas no app são baseadas nos dados que você lança. Decisões financeiras importantes devem sempre contar com a orientação de um profissional qualificado.</Item>
            <Item icon="📋">Este app não é um banco, não é uma corretora e não oferece serviços financeiros regulados.</Item>
          </Section>

          {/* Rodapé da política */}
          <div style={{
            borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 8,
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Frame Finance v1.0.0 · desenvolvido por Kaique Rangel</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>KRA · Feira de Santana, Bahia, Brasil</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Última atualização: maio de 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}
