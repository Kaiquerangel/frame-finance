import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";
import { useIsMobile } from "../lib/useIsMobile";
import { syncFixedExpensePayments } from "../lib/fixedExpensesSync";

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
    id: "rapido",
    icon: "⚡",
    label: "Lançamento rápido",
    desc: "Valor + categoria — lança em 5 segundos",
    color: "var(--green)",
    bg: "var(--greenbg)",
  },
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

export default function RegistrarGasto({ userId, onClose, onSaved }) {
  const isMobile = useIsMobile();
  const [step, setStep]           = useState("tipo");
  const [tipo, setTipo]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [categories, setCategories] = useState({ despesa: [] });
  const [cards, setCards]         = useState([]);

  const EMPTY = {
    description: "", category: "", value: "", date: today(),
    // parcelado
    payment_method: "credito", card_id: "",
    installments: "1", installment_value: "",
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

  // Preview do parcelado: usuário informa valor da parcela + n → app calcula total e juros
  const parceladoPreview = useMemo(() => {
    const parcela = parseFloat(form.installment_value || 0);
    const n       = parseInt(form.installments || 1);
    const total   = parseFloat(form.value || 0);
    if (!parcela || !n) return null;
    const totalPay = parseFloat((parcela * n).toFixed(2));
    const juros    = total > 0 ? parseFloat((totalPay - total).toFixed(2)) : 0;
    return { totalPay, juros, hasJuros: juros > 0.01 };
  }, [form.installment_value, form.installments, form.value]);

  const canSave = form.description !== undefined &&
    (tipo === "rapido"    ? (form.value && form.category) :
     tipo === "unico"     ? (form.description && form.value && form.category) :
     tipo === "parcelado" ? (form.description && form.category && (form.payment_method !== "credito" ? form.value : (form.card_id && form.installment_value))) :
     tipo === "fixo"      ? (form.description && form.value && form.category && form.due_day) : false);

  const handleSave = async () => {
    if (!canSave) return;
    setLoading(true);

    try {
      if (tipo === "rapido") {
        // Lançamento rápido: só valor + categoria, descrição opcional, data = hoje
        await supabase.from("transactions").insert({
          user_id: userId, type: "despesa",
          description: form.description || form.category,
          value: parseFloat(form.value),
          cat: form.category,
          date: today(),
        });

      } else if (tipo === "unico") {
        // Salva como transaction
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "despesa",
          description: form.description,
          value: parseFloat(form.value),
          cat: form.category,
          date: form.date,
        });

      } else if (tipo === "parcelado" && form.payment_method !== "credito") {
        await supabase.from("transactions").insert({
          user_id: userId, type: "despesa",
          description: form.description,
          value: parseFloat(form.value),
          cat: form.category, date: form.date,
        });

      } else if (tipo === "parcelado") {
        // Crédito: o usuário informa valor da compra + valor da parcela + n
        // Não usa fórmula de PMT — usa o valor real informado pelo banco/loja
        const numInst      = parseInt(form.installments || 1);
        const parcela      = parseFloat(form.installment_value);
        const totalCompra  = parseFloat(form.value);
        const card         = selectedCard || null;

        const { data: purchase, error } = await supabase.from("purchases").insert({
          user_id: userId,
          description: form.description,
          category: form.category,
          total_amount: totalCompra,
          payment_method: "credito",
          card_id: form.card_id,
          installments: numInst,
          has_interest: parceladoPreview?.hasJuros || false,
          interest_rate: 0,
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
              amount: parseFloat(parcela.toFixed(2)),
              due_date: dueDate.toISOString().split("T")[0],
              paid: false,
            });
          }
          await supabase.from("installments").insert(instList);
        }

      } else if (tipo === "fixo") {
        // Salva como fixed_expense e deixa a função única gerar os pagamentos
        // (mês anterior + atual + 2 próximos), já com `month` preenchido
        // corretamente — antes esse insert era feito na mão aqui mesmo, sem
        // a coluna `month` (NOT NULL), e falhava silenciosamente.
        const dueDay = parseInt(form.due_day || 1);
        const [y, m] = form.start_date.slice(0,7).split("-").map(Number);

        const { error } = await supabase.from("fixed_expenses").insert({
          user_id: userId,
          description: form.description,
          category: form.category,
          amount: parseFloat(form.value),
          due_day: dueDay,
          start_date: `${y}-${String(m).padStart(2,"0")}-01`,
          active: true,
        });

        if (!error) {
          await syncFixedExpensePayments(userId);
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

              {/* Descrição + Valor + Categoria — só pros tipos que não têm form próprio */}
              {tipo !== "rapido" && (
                <>
                  <div>
                    <Label>Descrição</Label>
                    <input value={form.description} onChange={e => f("description", e.target.value)}
                      placeholder={
                        tipo === "unico"     ? "Ex: Mercado Extra, Farmácia..." :
                        tipo === "parcelado" ? "Ex: iPhone 15, Geladeira Samsung..." :
                        "Ex: Aluguel, Internet Vivo..."
                      }
                      maxLength={150} style={inp} autoFocus />
                  </div>

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
                </>
              )}

              {/* Campos específicos por tipo */}
              {/* ── RÁPIDO ─────────────────────────────────────── */}
              {tipo === "rapido" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Valor — input grande, foco imediato */}
                  <div>
                    <Label>Valor (R$)</Label>
                    <input
                      type="number"
                      value={form.value}
                      onChange={e => f("value", e.target.value)}
                      placeholder="0,00"
                      autoFocus
                      style={{ ...inp, fontSize: 26, fontWeight: 800, padding: "14px 16px", textAlign: "center" }}
                    />
                  </div>

                  {/* Categoria */}
                  <div>
                    <Label>Categoria</Label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {categories.despesa.map(cat => (
                        <button key={cat} onClick={() => f("category", cat)} style={{
                          padding: "8px 14px", borderRadius: 99, border: "1.5px solid",
                          borderColor: form.category === cat ? "var(--green)" : "var(--border)",
                          background: form.category === cat ? "var(--greenbg)" : "var(--bg)",
                          color: form.category === cat ? "var(--green)" : "var(--text)",
                          fontWeight: 600, fontSize: 13, cursor: "pointer",
                          transition: "all .12s",
                        }}>{cat}</button>
                      ))}
                    </div>
                  </div>

                  {/* Descrição opcional */}
                  <div>
                    <Label>Descrição <span style={{ color: "var(--muted)", fontWeight: 400 }}>(opcional)</span></Label>
                    <input
                      value={form.description}
                      onChange={e => f("description", e.target.value)}
                      placeholder="Ex: Mercado, Farmácia..."
                      maxLength={100}
                      style={inp}
                      onKeyDown={e => e.key === "Enter" && canSave && handleSave()}
                    />
                  </div>

                  {/* Info: data automática */}
                  <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                    📅 Data registrada como hoje automaticamente
                  </div>
                </div>
              )}

              {/* ── ÚNICO ──────────────────────────────────────── */}
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

                  {form.payment_method === "credito" ? (
                    <>
                      {/* Cartão */}
                      <div>
                        <Label>Cartão</Label>
                        <select value={form.card_id} onChange={e => f("card_id", e.target.value)} style={inp}>
                          <option value="">Selecionar cartão...</option>
                          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      {/* Valor da parcela + n + data */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <Label>Valor da parcela (R$)</Label>
                          <input type="number" value={form.installment_value}
                            onChange={e => f("installment_value", e.target.value)}
                            placeholder="Ex: 32,06"
                            style={inp} />
                          <div style={{ fontSize: 10, color:"var(--muted)", marginTop:3 }}>Conforme cobrado no cartão</div>
                        </div>
                        <div>
                          <Label>Número de parcelas</Label>
                          <select value={form.installments} onChange={e => f("installments", e.target.value)} style={inp}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => (
                              <option key={n} value={n}>{n === 1 ? "À vista (1x)" : `${n}x`}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label>Data da compra</Label>
                        <input type="date" value={form.date} onChange={e => f("date", e.target.value)} style={inp} />
                      </div>

                      {/* Preview */}
                      {parceladoPreview && (
                        <div style={{ background:"var(--accentbg)", borderRadius:10, padding:"12px 14px", fontSize:13, display:"flex", flexWrap:"wrap", gap:16 }}>
                          <div>
                            <span style={{ color:"var(--muted)" }}>Total a pagar: </span>
                            <strong>{fmt(parceladoPreview.totalPay)}</strong>
                          </div>
                          {form.value && (
                            <div>
                              <span style={{ color:"var(--muted)" }}>Juros: </span>
                              <strong style={{ color: parceladoPreview.hasJuros ? "var(--red)" : "var(--green)" }}>
                                {parceladoPreview.hasJuros ? fmt(parceladoPreview.juros) : "Sem juros 🎉"}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Data</Label>
                        <input type="date" value={form.date} onChange={e => f("date", e.target.value)} style={inp} />
                      </div>
                      <div style={{ background:"var(--accentbg)", borderRadius:10, padding:"11px 14px", fontSize:13, color:"var(--accent)" }}>
                        Pago à vista — registrado como Gasto Único, sem entrar na fatura do cartão.
                      </div>
                    </>
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
