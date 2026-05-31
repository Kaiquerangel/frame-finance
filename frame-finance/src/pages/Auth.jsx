import { useState } from "react";
import { FooterMini } from "../components/Footer";
import Privacidade from "../components/Privacidade";
import { supabase } from "../lib/supabase";

const inp = (extra = {}) => ({
  width: "100%", padding: "13px 16px", borderRadius: 12,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 15, outline: "none",
  fontFamily: "DM Sans", transition: "border .18s",
  ...extra,
});

const Msg = ({ text, type }) => (
  <div style={{
    padding: "10px 14px", borderRadius: 10, fontSize: 13, marginTop: 14,
    background: type === "error" ? "rgba(239,68,68,.1)" : "rgba(16,185,129,.1)",
    color: type === "error" ? "var(--red)" : "var(--green)",
  }}>{text}</div>
);

export default function Auth() {
  const [mode, setMode]           = useState("login");
  const [showPrivacidade, setShowPrivacidade] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  // login
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [remember, setRemember]     = useState(false);

  // signup
  const [firstName, setFirstName]   = useState("");
  const [lastName, setLastName]     = useState("");
  const [nick, setNick]             = useState("");
  const [email, setEmail]           = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // forgot
  const [forgotEmail, setForgotEmail] = useState("");

  const reset = () => { setError(""); setSuccess(""); };
  const switchMode = (m) => { setMode(m); reset(); };

  const handleLogin = async () => {
    reset(); setLoading(true);
    let emailToUse = identifier;

    if (!identifier.includes("@")) {
      const { data, error: rpcError } = await supabase
        .rpc("get_email_by_nick", { p_nick: identifier.toLowerCase() });
      if (rpcError || !data) {
        setError("Nick não encontrado."); setLoading(false); return;
      }
      emailToUse = data;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse, password,
      options: { persistSession: remember },
    });
    if (error) setError("E-mail/nick ou senha incorretos.");
    setLoading(false);
  };

  const handleSignup = async () => {
    reset();
    if (!firstName || !lastName || !nick || !email || !signupPass) {
      setError("Preencha todos os campos."); return;
    }
    if (signupPass !== confirmPass) { setError("As senhas não coincidem."); return; }
    if (nick.length < 3) { setError("Nick deve ter pelo menos 3 caracteres."); return; }
    setLoading(true);

    const { data: existing } = await supabase
      .from("profiles").select("id").eq("nick", nick.toLowerCase()).single();
    if (existing) { setError("Este nick já está em uso."); setLoading(false); return; }

    const { data, error } = await supabase.auth.signUp({ email, password: signupPass });
    if (error) { setError(error.message); setLoading(false); return; }

    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id, first_name: firstName,
        last_name: lastName, nick: nick.toLowerCase(),
      });
    }
    setSuccess("Conta criada! Verifique seu e-mail para confirmar.");
    setLoading(false);
  };

  const handleForgot = async () => {
    reset(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setSuccess("E-mail de recuperação enviado!");
    setLoading(false);
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <>
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 440, background: "var(--surface)",
        borderRadius: 24, padding: "40px 36px",
        boxShadow: "0 8px 40px rgba(0,0,0,.10)",
        border: "1px solid var(--border)",
      }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 28, color: "var(--accent)", letterSpacing: "-.02em" }}>
            Frame Finance
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginTop: 4 }}>
            by Kaique Rangel · KRA
          </div>
        </div>

        {/* FORGOT */}
        {mode === "forgot" && (
          <div>
            <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 18, marginBottom: 6, color: "var(--text)" }}>Recuperar senha</div>
            <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 22 }}>Enviaremos um link para redefinir sua senha.</p>
            <input type="email" placeholder="Seu e-mail" value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)} style={inp()}
              onKeyDown={e => e.key === "Enter" && handleForgot()} />
            {error   && <Msg text={error}   type="error" />}
            {success && <Msg text={success} type="success" />}
            <button onClick={handleForgot} disabled={loading} style={{
              width: "100%", marginTop: 16, padding: "14px 0", borderRadius: 12, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 15,
              cursor: "pointer", fontFamily: "Syne", opacity: loading ? .7 : 1,
            }}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>
            <button onClick={() => switchMode("login")} style={{
              width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 12, border: "none",
              background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "DM Sans",
            }}>← Voltar ao login</button>
          </div>
        )}

        {/* LOGIN / SIGNUP */}
        {mode !== "forgot" && (
          <>
            {/* Toggle */}
            <div style={{ display: "flex", background: "var(--bg)", borderRadius: 12, padding: 4, marginBottom: 22 }}>
              {["login", "signup"].map(m => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                  fontWeight: 700, fontSize: 14, fontFamily: "DM Sans", transition: "all .18s",
                  background: mode === m ? "var(--surface)" : "transparent",
                  color: mode === m ? "var(--accent)" : "var(--muted)",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                }}>
                  {m === "login" ? "Entrar" : "Criar conta"}
                </button>
              ))}
            </div>

            {/* Google */}
            <button onClick={handleGoogle} style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              border: "1.5px solid var(--border)", background: "var(--bg)",
              color: "var(--text)", fontWeight: 600, fontSize: 14, cursor: "pointer",
              fontFamily: "DM Sans", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              marginBottom: 18,
            }}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7l-6.6 5.1C9.8 39.7 16.4 44 24 44z"/>
                <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
              </svg>
              Entrar com Google
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>ou</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            {/* LOGIN FIELDS */}
            {mode === "login" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input placeholder="Nick ou e-mail" value={identifier}
                  onChange={e => setIdentifier(e.target.value)} style={inp()} />
                <input type="password" placeholder="Senha" value={password}
                  onChange={e => setPassword(e.target.value)} style={inp()}
                  onKeyDown={e => e.key === "Enter" && handleLogin()} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--muted)" }}>
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                    Lembrar de mim
                  </label>
                  <button onClick={() => switchMode("forgot")} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 13, color: "var(--accent)", fontFamily: "DM Sans", fontWeight: 600,
                  }}>Esqueci a senha</button>
                </div>
              </div>
            )}

            {/* SIGNUP FIELDS */}
            {mode === "signup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <input placeholder="Nome" value={firstName}
                    onChange={e => setFirstName(e.target.value)} style={inp()} />
                  <input placeholder="Sobrenome" value={lastName}
                    onChange={e => setLastName(e.target.value)} style={inp()} />
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 15 }}>@</span>
                  <input placeholder="seu_nick" value={nick}
                    onChange={e => setNick(e.target.value.toLowerCase().replace(/[^a-z0-9_.\-]/g, ""))}
                    style={inp({ paddingLeft: 30 })} />
                </div>
                <input type="email" placeholder="E-mail" value={email}
                  onChange={e => setEmail(e.target.value)} style={inp()} />
                <input type="password" placeholder="Senha" value={signupPass}
                  onChange={e => setSignupPass(e.target.value)} style={inp()} />
                <input type="password" placeholder="Confirmar senha" value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)} style={inp()}
                  onKeyDown={e => e.key === "Enter" && handleSignup()} />
              </div>
            )}

            {error   && <Msg text={error}   type="error" />}
            {success && <Msg text={success} type="success" />}

            <button onClick={mode === "login" ? handleLogin : handleSignup}
              disabled={loading} style={{
                width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 12, border: "none",
                background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 15,
                cursor: loading ? "not-allowed" : "pointer", fontFamily: "Syne",
                opacity: loading ? .7 : 1, transition: "opacity .18s",
              }}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </>
        )}
        {/* Aviso de segurança */}
        <div style={{
          marginTop: 20, padding: "10px 14px", borderRadius: 10,
          background: "var(--bg)", border: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>🔒</span>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            O Frame Finance nunca pede dados do seu cartão de crédito, senha de banco ou acesso a contas financeiras.{" "}
            <button onClick={() => setShowPrivacidade(true)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 12, color: "var(--accent)", fontWeight: 600, padding: 0,
            }}>Saiba mais</button>
          </div>
        </div>

        <FooterMini onPrivacidade={() => setShowPrivacidade(true)} />
      </div>
    </div>

    {showPrivacidade && <Privacidade onClose={() => setShowPrivacidade(false)} />}
    </>
  );
}