import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

const inp = {
  width: "100%", padding: "10px 13px", borderRadius: 8,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 14, outline: "none",
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 20, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>{children}</div>
);

export default function Emprestimos({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [loans, setLoans]         = useState([]);
  const [installments, setInstallments] = useState([]);
  const [cards, setCards]         = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [form, setForm] = useState({
    description: "", total_amount: "", interest_rate: "",
    installments: "12", start_date: today(), card_id: "", type: "emprestimo",
  });

  const load = async () => {
    const [{ data: l }, { data: i }, { data: c }] = await Promise.all([
      supabase.from("loans").select("*, cards(name, color)").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("loan_installments").select("*, loans(description)").eq("user_id", userId).order("due_date"),
      supabase.from("cards").select("*").eq("user_id", userId),
    ]);
    setLoans(l || []);
    setInstallments(i || []);
    setCards(c || []);
  };

  useEffect(() => { load(); }, [userId]);

  const generateInstallments = (loanId, total, numInst, rate, startDate) => {
    const r = parseFloat(rate) / 100;
    const pmt = r > 0 ? total * (r * Math.pow(1+r, numInst)) / (Math.pow(1+r, numInst) - 1) : total / numInst;
    let balance = total;
    const list = [];
    for (let i = 0; i < numInst; i++) {
      const interest = r > 0 ? balance * r : 0;
      const principal = pmt - interest;
      balance -= principal;
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + i + 1);
      list.push({
        loan_id: loanId, user_id: userId,
        installment_number: i + 1,
        amount: parseFloat(pmt.toFixed(2)),
        interest_amount: parseFloat(interest.toFixed(2)),
        due_date: due.toISOString().split("T")[0],
        paid: false,
      });
    }
    return list;
  };

  const add = async () => {
    if (!form.description || !form.total_amount || !form.installments) return;
    setLoading(true);
    const { data, error } = await supabase.from("loans").insert({
      user_id: userId,
      description: form.description,
      total_amount: parseFloat(form.total_amount),
      interest_rate: parseFloat(form.interest_rate || 0),
      installments: parseInt(form.installments),
      start_date: form.start_date,
      card_id: form.card_id || null,
      type: form.type,
    }).select().single();
    if (!error && data) {
      const list = generateInstallments(data.id, parseFloat(form.total_amount), parseInt(form.installments), form.interest_rate || 0, form.start_date);
      await supabase.from("loan_installments").insert(list);
    }
    setForm({ description: "", total_amount: "", interest_rate: "", installments: "12", start_date: today(), card_id: "", type: "emprestimo" });
    await load();
    setLoading(false);
  };

  const togglePaid = async (id, paid) => {
    await supabase.from("loan_installments").update({ paid: !paid }).eq("id", id);
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: !paid } : i));
  };

  const delLoan = async (id) => {
    await supabase.from("loans").delete().eq("id", id);
    setSelected(null);
    await load();
  };

  const selectedInstallments = useMemo(() =>
    installments.filter(i => i.loan_id === selected?.id),
    [installments, selected]
  );

  const totalInterest = selectedInstallments.reduce((a, i) => a + Number(i.interest_amount), 0);
  const totalPaid     = selectedInstallments.filter(i => i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const totalDebt     = loans.filter(l => !installments.filter(i => i.loan_id === l.id).every(i => i.paid))
    .reduce((a, l) => a + Number(l.total_amount), 0);

  return (
    <div>
      {/* Banner de ajuda para novos usuários */}
      <EmptyBanner pageId="emprestimos" onNavigate={onNavigate} message="Sem empréstimos registrados. Veja como controlar financiamentos e dívidas aqui." />
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight: 800, fontSize: 24, color: "var(--text)", letterSpacing: "-.03em" }}>Empréstimos</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "emprestimos"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>Controle de empréstimos e financiamentos</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Total em dívida</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--red)", letterSpacing: "-.02em" }}>{fmt(totalDebt)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Empréstimos ativos</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", letterSpacing: "-.02em" }}>{loans.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Parcelas pendentes</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--amber)", letterSpacing: "-.02em" }}>{installments.filter(i => !i.paid).length}</div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.4fr" : "1fr", gap: 16 }}>
        {/* Left: form + list */}
        <div>
          {/* Form */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Novo Empréstimo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Tipo</Label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                    <option value="emprestimo">Empréstimo</option>
                    <option value="financiamento">Financiamento</option>
                  </select>
                </div>
                <div>
                  <Label>Cartão (opcional)</Label>
                  <select value={form.card_id} onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))} style={inp}>
                    <option value="">Sem cartão</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Empréstimo pessoal Nubank" style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Valor total (R$)</Label>
                  <input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} placeholder="10000" style={inp} />
                </div>
                <div>
                  <Label>Juros ao mês (%)</Label>
                  <input type="number" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="2.5" style={inp} />
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <select value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} style={inp}>
                    {[6,12,18,24,36,48,60].map(n => <option key={n} value={n}>{n}x</option>)}
                  </select>
                </div>
              </div>

              {/* Preview */}
              {form.total_amount && (
                <div style={{ background: "var(--accentbg)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  {(() => {
                    const total = parseFloat(form.total_amount || 0);
                    const r = parseFloat(form.interest_rate || 0) / 100;
                    const n = parseInt(form.installments || 1);
                    const pmt = r > 0 ? total * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n)-1) : total/n;
                    const totalPay = pmt * n;
                    return (
                      <div style={{ display: "flex", gap: 20 }}>
                        <div><span style={{ color: "var(--muted)" }}>Parcela: </span><strong style={{ color: "var(--accent)" }}>{fmt(pmt)}</strong></div>
                        <div><span style={{ color: "var(--muted)" }}>Total a pagar: </span><strong style={{ color: "var(--red)" }}>{fmt(totalPay)}</strong></div>
                        {r > 0 && <div><span style={{ color: "var(--muted)" }}>Juros totais: </span><strong style={{ color: "var(--amber)" }}>{fmt(totalPay - total)}</strong></div>}
                      </div>
                    );
                  })()}
                </div>
              )}

              <button onClick={add} disabled={loading} style={{
                padding: "9px 0", borderRadius: 8, border: "none", background: "var(--accent)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1,
              }}>
                {loading ? "Salvando..." : "+ Adicionar empréstimo"}
              </button>
            </div>
          </Card>

          {/* Loans list */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Empréstimos</div>
            {loans.length === 0
              ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum empréstimo registrado</div>
              : loans.map(loan => {
                  const lInst = installments.filter(i => i.loan_id === loan.id);
                  const paidCount = lInst.filter(i => i.paid).length;
                  const pct = lInst.length > 0 ? (paidCount / lInst.length) * 100 : 0;
                  const done = pct >= 100;
                  return (
                    <div key={loan.id} onClick={() => setSelected(selected?.id === loan.id ? null : loan)}
                      style={{
                        padding: "12px 0", borderBottom: "1px solid var(--border)", cursor: "pointer",
                        opacity: done ? .6 : 1,
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{loan.description}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                            {loan.type === "emprestimo" ? "Empréstimo" : "Financiamento"} · {loan.installments}x
                            {loan.interest_rate > 0 && ` · ${loan.interest_rate}% a.m.`}
                            {loan.cards && <span style={{ color: "var(--accent)", marginLeft: 4 }}>· {loan.cards.name}</span>}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: done ? "var(--green)" : "var(--red)" }}>{fmt(loan.total_amount)}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{paidCount}/{lInst.length} parcelas</div>
                        </div>
                      </div>
                      <div style={{ height: 4, background: "var(--border)", borderRadius: 99 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: done ? "var(--green)" : "var(--accent)", borderRadius: 99, transition: "width .4s" }} />
                      </div>
                    </div>
                  );
                })
            }
          </Card>
        </div>

        {/* Right: installments detail */}
        {selected && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{selected.description}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Detalhamento das parcelas</div>
              </div>
              <button onClick={() => delLoan(selected.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 13, fontWeight: 600 }}>Excluir</button>
            </div>

            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Total pago", value: fmt(totalPaid), color: "var(--green)" },
                { label: "Total em juros", value: fmt(totalInterest), color: "var(--red)" },
                { label: "Restante", value: fmt(selectedInstallments.filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0)), color: "var(--accent)" },
                { label: "Parcelas restantes", value: selectedInstallments.filter(i => !i.paid).length, color: "var(--muted)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, color, fontSize: 14 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Installments */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {selectedInstallments.map((inst, i) => (
                <div key={inst.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: i < selectedInstallments.length - 1 ? "1px solid var(--border)" : "none",
                  opacity: inst.paid ? .5 : 1,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button onClick={() => togglePaid(inst.id, inst.paid)} style={{
                      width: 20, height: 20, borderRadius: 6, border: "2px solid",
                      borderColor: inst.paid ? "var(--green)" : "var(--border)",
                      background: inst.paid ? "var(--green)" : "transparent",
                      cursor: "pointer", color: "#fff", fontSize: 11, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{inst.paid ? "✓" : ""}</button>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", textDecoration: inst.paid ? "line-through" : "none" }}>
                        Parcela {inst.installment_number}/{selectedInstallments.length}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>
                        Vence {inst.due_date}
                        {inst.interest_amount > 0 && <span style={{ color: "var(--red)", marginLeft: 6 }}>Juros: {fmt(inst.interest_amount)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? "var(--green)" : "var(--text)" }}>{fmt(inst.amount)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      <HelpButton pageId="emprestimos" onNavigate={onNavigate} />
    </div>
  );
}
