import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";
import { useIsMobile } from "../lib/useIsMobile";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];

const inp = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 15, outline: "none",
  transition: "border .15s",
};

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
    {children}
  </div>
);

const TIPOS = [
  {
    id: "unico",
    icon: "💸",
    label: "Gasto único",
    desc: "Mercado, farmácia, restaurante, Uber...",
    color: "var(--red)",
    bg: "var(--redbg)",
  },
  {
    id: "parcelado",
    icon: "💳",
    label: "Parcelado no cartão",
    desc: "Eletrônico, móvel, eletrodoméstico...",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    id: "fixo",
    icon: "📌",
    label: "Todo mês",
    desc: "Aluguel, internet, academia, streaming...",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
];

const PAYMENT_METHODS = [
  { id: "credito",  label: "Crédito",  icon: "💳" },
  { id: "debito",   label: "Débito",   icon: "🏦" },
  { id: "pix",      label: "Pix",      icon: "⚡" },
  { id: "dinheiro", label: "Dinheiro", icon: "💵" },
];

function calcPmt(total, n, hasInterest, rate) {
  if (!hasInterest || !rate || n <= 1) return total / n;
  const r = rate / 100;
  return total * (r * Math.pow(1+r, n)) / (Math.pow(1+r, n) - 1);
}

export default function RegistrarGasto({ userId, onClose, onSaved }) {
  const isMobile = useIsMobile();
  const [step, setStep]           = useState("tipo");   // "tipo" | "form"
  const [tipo, setTipo]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [categories, setCategories] = useState({ despesa: [] });
  const [cards, setCards]         = useState([]);

  // Formulário único — campos que variam por tipo
  const EMPTY = {
    description: "", category: "", value: "", date: today(),
    // parcelado
    payment_method: "credito", card_id: "",
    installments: "1", has_interest: false, interest_rate: "",
    // fixo
    due_day: "", start_date: today().slice(0,7) + "-01",
  };
  const [form, setForm] = useState(EMPTY);
  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    Promise.all([
      loadCategories(userId),
      supabase.from("cards").select("*").eq("user_id", userId),
    ]).then(([cats, { data: c }]) => {
      setCategories(cats);
      setCards(c || []);
    });
  }, [userId]);

  const selectedCard = cards.find(c => c.id === form.card_id);

  const pmt = form.value && form.installments
    ? calcPmt(parseFloat(form.value), parseInt(form.installments), form.has_interest, parseFloat(form.interest_rate || 0))
    : 0;

  const canSave = form.description && form.value && form.category &&
    (tipo !== "parcelado" || (form.payment_method !== "credito" || form.card_id));

  const handleSave = async () => {
    if (!canSave) return;
    setLoading(true);

    try {
      if (tipo === "unico") {
        // Salva como transaction
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "despesa",
          description: form.description,
          value: parseFloat(form.value),
          cat: form.category,
          date: form.date,
        });

      } else if (tipo === "parcelado") {
        // Salva como purchase + installments
        const numInst = parseInt(form.installments || 1);
        const totalAmount = parseFloat(form.value);
        const card = selectedCard || null;

        const { data: purchase, error } = await supabase.from("purchases").insert({
          user_id: userId,
          description: form.description,
          category: form.category,
          total_amount: totalAmount,
          payment_method: form.payment_method,
          card_id: form.payment_method === "credito" ? form.card_id : null,
          installments: numInst,
          has_interest: form.has_interest,
          interest_rate: parseFloat(form.interest_rate || 0),
          purchase_date: form.date,
        }).select().single();

        if (!error && purchase) {
          const instList = [];
          for (let i = 0; i < numInst; i++) {
            let dueDate;
            const base = new Date(form.date + "T12:00:00");
            if (card && card.closing_day && card.due_day) {
              const closing = new Date(base.getFullYear(), base.getMonth(), card.closing_day);
              const monthsAhead = base > closing ? i + 2 : i + 1;
              dueDate = new Date(base.getFullYear(), base.getMonth() + monthsAhead - 1, card.due_day);
            } else {
              dueDate = new Date(base);
              dueDate.setMonth(dueDate.getMonth() + i + 1);
            }
            instList.push({
              purchase_id: purchase.id,
              user_id: userId,
              installment_number: i + 1,
              amount: parseFloat(pmt.toFixed(2)),
              due_date: dueDate.toISOString().split("T")[0],
              paid: false,
            });
          }
          await supabase.from("installments").insert(instList);
        }

      } else if (tipo === "fixo") {
        // Salva como fixed_expense + gera o payment do mês atual
        const dueDay = parseInt(form.due_day || 1);
        const [y, m] = form.start_date.slice(0,7).split("-").map(Number);

        const { data: fixedExp, error } = await supabase.from("fixed_expenses").insert({
          user_id: userId,
          description: form.description,
          category: form.category,
          amount: parseFloat(form.value),
          due_day: dueDay,
          start_date: `${y}-${String(m).padStart(2,"0")}-01`,
          active: true,
        }).select().single();

        if (!error && fixedExp) {
          // Gera payment para o mês atual
          const today_d = new Date();
          const thisMonth = today_d.toISOString().slice(0,7);
          const dueDate = `${thisMonth}-${String(dueDay).padStart(2,"0")}`;
          await supabase.from("fixed_expense_payments").insert({
            user_id: userId,
            fixed_expense_id: fixedExp.id,
            amount: parseFloat(form.value),
            due_date: dueDate,
            paid: false,
          });
        }
      }

      onSaved && onSaved(tipo);
      onClose();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleTipoSelect = (t) => {
    setTipo(t);
    setStep("form");
  };

  const handleBack = () => {
    setStep("tipo");
    setTipo(null);
    setForm(EMPTY);
  };

  const tipoInfo = TIPOS.find(t => t.id === tipo);

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center", padding: isMobile ? 0 : 20,
    }}>
      <div style={{
        width: "100%", maxWidth: isMobile ? "100%" : 480,
        background: "var(--surface)",
        borderRadius: isMobile ? "20px 20px 0 0" : 20,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
        maxHeight: isMobile ? "92vh" : "88vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Handle mobile */}
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 0", flexShrink: 0 }} />
        )}

        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: isMobile ? "14px 20px" : "20px 24px",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {step === "form" && (
              <button onClick={handleBack} style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                color: "var(--muted)", fontSize: 14,
              }}>←</button>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--text)" }}>
                {step === "tipo" ? "Registrar gasto" : tipoInfo?.label}
              </div>
              {step === "form" && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{tipoInfo?.desc}</div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
            background: "var(--bg)", cursor: "pointer", color: "var(--muted)",
            fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Conteúdo scrollável */}
        <div style={{ overflowY: "auto", flex: 1, padding: isMobile ? "16px 20px 24px" : "20px 24px 24px" }}>

          {/* STEP: Escolha o tipo */}
          {step === "tipo" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 6, lineHeight: 1.5 }}>
                Que tipo de gasto é esse?
              </p>
              {TIPOS.map(t => (
                <button key={t.id} onClick={() => handleTipoSelect(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "16px 18px", borderRadius: 14,
                  border: "1.5px solid var(--border)",
                  background: "var(--bg)",
                  cursor: "pointer", textAlign: "left", width: "100%",
                  transition: "all .15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = t.bg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg)"; }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: t.bg, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24,
                  }}>{t.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 3 }}>{t.label}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{t.desc}</div>
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: 18 }}>›</span>
                </button>
              ))}
            </div>
          )}

          {/* STEP: Formulário */}
          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Descrição */}
              <div>
                <Label>Descrição</Label>
                <input value={form.description} onChange={e => f("description", e.target.value)}
                  placeholder={
                    tipo === "unico" ? "Ex: Mercado Extra, Farmácia..." :
                    tipo === "parcelado" ? "Ex: iPhone 15, Geladeira Samsung..." :
                    "Ex: Aluguel, Internet Vivo..."
                  }
                  maxLength={150} style={inp} autoFocus />
              </div>

              {/* Valor + Categoria */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <Label>Valor {tipo === "parcelado" ? "total (R$)" : "(R$)"}</Label>
                  <input type="number" value={form.value} onChange={e => f("value", e.target.value)}
                    placeholder="0,00" style={inp} />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <select value={form.category} onChange={e => f("category", e.target.value)} style={inp}>
                    <option value="">Selecionar...</option>
                    {categories.despesa.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Campos específicos por tipo */}
              {tipo === "unico" && (
                <div>
                  <Label>Data</Label>
                  <input type="date" value={form.date} onChange={e => f("date", e.target.value)} style={inp} />
                </div>
              )}

              {tipo === "parcelado" && (
                <>
                  {/* Forma de pagamento */}
                  <div>
                    <Label>Forma de pagamento</Label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {PAYMENT_METHODS.map(pm => (
                        <button key={pm.id} onClick={() => f("payment_method", pm.id)} style={{
                          padding: "8px 14px", borderRadius: 9, border: "1.5px solid",
                          borderColor: form.payment_method === pm.id ? "var(--accent)" : "var(--border)",
                          background: form.payment_method === pm.id ? "var(--accentbg)" : "transparent",
                          color: form.payment_method === pm.id ? "var(--accent)" : "var(--muted)",
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 5,
                        }}>
                          {pm.icon} {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cartão (se crédito) */}
                  {form.payment_method === "credito" && (
                    <div>
                      <Label>Cartão</Label>
                      <select value={form.card_id} onChange={e => f("card_id", e.target.value)} style={inp}>
                        <option value="">Selecionar cartão...</option>
                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Parcelas + Juros */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <Label>Parcelas</Label>
                      <select value={form.installments} onChange={e => f("installments", e.target.value)} style={inp}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                          <option key={n} value={n}>{n === 1 ? "À vista" : `${n}x`}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Data da compra</Label>
                      <input type="date" value={form.date} onChange={e => f("date", e.target.value)} style={inp} />
                    </div>
                  </div>

                  {/* Juros */}
                  {parseInt(form.installments) > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={form.has_interest}
                        onChange={e => f("has_interest", e.target.checked)}
                        style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>Tem juros</span>
                      {form.has_interest && (
                        <input type="number" value={form.interest_rate}
                          onChange={e => f("interest_rate", e.target.value)}
                          placeholder="% ao mês" style={{ ...inp, width: 120, flex: "none" }} />
                      )}
                    </div>
                  )}

                  {/* Preview */}
                  {form.value && parseInt(form.installments) > 1 && (
                    <div style={{ background: "var(--accentbg)", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                        <span>Parcela: <strong style={{ color: "var(--accent)" }}>{fmt(pmt)}</strong></span>
                        <span>Total: <strong>{fmt(pmt * parseInt(form.installments))}</strong></span>
                        {form.has_interest && parseFloat(form.interest_rate) > 0 && (
                          <span>Juros: <strong style={{ color: "var(--red)" }}>{fmt(pmt * parseInt(form.installments) - parseFloat(form.value))}</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tipo === "fixo" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <Label>Vence todo dia</Label>
                      <input type="number" min="1" max="31" value={form.due_day}
                        onChange={e => f("due_day", e.target.value)}
                        placeholder="Ex: 5" style={inp} />
                    </div>
                    <div>
                      <Label>A partir de</Label>
                      <input type="month" value={form.start_date.slice(0,7)}
                        onChange={e => f("start_date", e.target.value + "-01")} style={inp} />
                    </div>
                  </div>
                  <div style={{ background: "#fffbeb", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#92400e", border: "1px solid #f59e0b33" }}>
                    O app vai gerar essa cobrança todo mês automaticamente e te avisar quando estiver perto de vencer.
                  </div>
                </>
              )}

              {/* Botão salvar */}
              <button onClick={handleSave} disabled={!canSave || loading} style={{
                padding: "14px", borderRadius: 12, border: "none",
                background: canSave ? (tipoInfo?.color || "var(--accent)") : "var(--border)",
                color: canSave ? "#fff" : "var(--muted)",
                fontWeight: 700, fontSize: 15, cursor: canSave ? "pointer" : "not-allowed",
                transition: "all .15s", marginTop: 4,
              }}>
                {loading ? "Salvando..." : `Registrar ${tipoInfo?.label || "gasto"}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
