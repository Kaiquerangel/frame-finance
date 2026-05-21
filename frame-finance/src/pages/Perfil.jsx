import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none",
  transition: "border .15s",
};

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{children}</div>
);

const TABS = [
  { id: "info",  label: "Informações" },
  { id: "senha", label: "Senha" },
  { id: "prefs", label: "Preferências" },
];

export default function Perfil({ userId, profile, onClose, onUpdate }) {
  const [firstName, setFirstName]     = useState(profile?.first_name || "");
  const [lastName, setLastName]       = useState(profile?.last_name || "");
  const [nick, setNick]               = useState(profile?.nick || "");
  const [bio, setBio]                 = useState(profile?.bio || "");
  const [currency, setCurrency]       = useState(profile?.currency || "BRL");
  const [avatar, setAvatar]           = useState(profile?.avatar_url || "");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [success, setSuccess]         = useState("");
  const [error, setError]             = useState("");
  const [activeTab, setActiveTab]     = useState("info");
  const fileRef = useRef();

  const handleAvatar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setError("Erro ao enviar foto."); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatar(data.publicUrl + "?t=" + Date.now());
    setUploading(false);
  };

  const saveProfile = async () => {
    setError(""); setSuccess(""); setLoading(true);
    if (nick !== profile?.nick) {
      const { data: existing } = await supabase.from("profiles").select("id").eq("nick", nick).single();
      if (existing) { setError("Nick já está em uso."); setLoading(false); return; }
    }
    const { error: err } = await supabase.from("profiles").update({
      first_name: firstName, last_name: lastName,
      nick, bio, currency, avatar_url: avatar,
    }).eq("id", userId);
    if (err) setError(err.message);
    else { setSuccess("Perfil atualizado!"); onUpdate(); }
    setLoading(false);
  };

  const savePassword = async () => {
    setError(""); setSuccess("");
    if (newPass !== confirmPass) { setError("Senhas não coincidem."); return; }
    if (newPass.length < 6) { setError("Mínimo 6 caracteres."); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPass });
    if (err) setError(err.message);
    else { setSuccess("Senha atualizada!"); setNewPass(""); setConfirmPass(""); }
    setLoading(false);
  };

  const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "?";

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "var(--surface)", borderRadius: 20,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{ padding: "24px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text)" }}>Meu Perfil</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)", cursor: "pointer", color: "var(--muted)",
            fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Avatar + info */}
        <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            {avatar
              ? <img src={avatar} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} />
              : <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>{initials}</div>
            }
            <button onClick={() => fileRef.current.click()} style={{
              position: "absolute", bottom: 0, right: 0, width: 22, height: 22,
              borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--surface)",
              cursor: "pointer", color: "#fff", fontSize: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✎</button>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{firstName} {lastName}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>@{nick}</div>
            <button onClick={() => fileRef.current.click()} style={{
              marginTop: 4, fontSize: 12, color: "var(--accent)", background: "none",
              border: "none", cursor: "pointer", fontWeight: 600, padding: 0,
            }}>{uploading ? "Enviando..." : "Trocar foto"}</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} style={{ display: "none" }} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "16px 24px 0", gap: 4, borderBottom: "1px solid var(--border)", marginTop: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setError(""); setSuccess(""); }} style={{
              padding: "7px 14px", border: "none", background: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, color: activeTab === t.id ? "var(--accent)" : "var(--muted)",
              borderBottom: activeTab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1, transition: "all .12s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: "20px 24px 24px" }}>

          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Nome</Label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} placeholder="Nome" />
                </div>
                <div>
                  <Label>Sobrenome</Label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} placeholder="Sobrenome" />
                </div>
              </div>
              <div>
                <Label>Nick</Label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 14 }}>@</span>
                  <input value={nick}
                    onChange={e => setNick(e.target.value.toLowerCase().replace(/[^a-z0-9_.\-]/g, ""))}
                    style={{ ...inp, paddingLeft: 26 }} placeholder="seu_nick" />
                </div>
              </div>
              <div>
                <Label>Bio</Label>
                <textarea value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="Uma frase sobre você..." rows={2}
                  style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
              </div>
            </div>
          )}

          {activeTab === "senha" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <Label>Nova senha</Label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} style={inp} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <Label>Confirmar senha</Label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inp} placeholder="Repita a senha"
                  onKeyDown={e => e.key === "Enter" && savePassword()} />
              </div>
            </div>
          )}

          {activeTab === "prefs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <Label>Moeda padrão</Label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} style={inp}>
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                </select>
              </div>
              <div style={{ borderRadius: 10, padding: 14, border: "1px solid var(--red)", background: "var(--redbg)", marginTop: 4 }}>
                <div style={{ fontWeight: 600, color: "var(--red)", fontSize: 13, marginBottom: 4 }}>⚠ Zona de perigo</div>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Todos os seus dados serão permanentemente apagados.</p>
                <button style={{
                  padding: "7px 14px", borderRadius: 7, border: "1px solid var(--red)",
                  background: "none", color: "var(--red)", fontWeight: 600, fontSize: 12, cursor: "pointer",
                }} onClick={() => alert("Entre em contato com o suporte para excluir sua conta.")}>
                  Excluir minha conta
                </button>
              </div>
            </div>
          )}

          {error   && <div style={{ marginTop: 12, padding: "9px 13px", borderRadius: 8, background: "var(--redbg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
          {success && <div style={{ marginTop: 12, padding: "9px 13px", borderRadius: 8, background: "var(--greenbg)", color: "var(--green)", fontSize: 13 }}>{success}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>Cancelar</button>
            <button onClick={activeTab === "senha" ? savePassword : saveProfile} disabled={loading} style={{
              flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? .7 : 1,
            }}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}