import HelpButton from "../components/HelpButton";
import EmptyBanner from "../components/EmptyBanner";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "../lib/useIsMobile";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().split("T")[0];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return new Date(+y, +m-1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };

// Taxa mensal pelo método de Newton-Raphson — função pura, sem dependência do componente.
// Movida para fora do componente: estava declarada com const após seu primeiro uso em
// "preview" (useMemo), causando ReferenceError de temporal dead zone ("Cannot access
// 'calcMonthlyRate' before initialization") já no primeiro render.
const calcMonthlyRate = (pv, pmt, n) => {
  if (pv <= 0 || pmt <= 0 || n <= 0) return null;
  if (pmt * n <= pv) return null;
  let i = 0.01;
  for (let iter = 0; iter < 200; iter++) {
    const f  = pmt * (1 - Math.pow(1 + i, -n)) / i - pv;
    const df = pmt * (Math.pow(1 + i, -n) * n / (i * (1 + i)) - (1 - Math.pow(1 + i, -n)) / (i * i));
    const next = i - f / df;
    if (Math.abs(next - i) < 1e-8) { i = next; break; }
    i = next;
  }
  return i > 0 && i < 1 ? i : null;
};

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

const EMPTY_FORM = {
  description: "", category: "", type: "emprestimo",
  total_amount: "", down_payment: "", installment_value: "", installments: "12",
  start_date: today(),
};

export default function Emprestimos({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [loans, setLoans]               = useState([]);
  const [installments, setInstallments] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [selected, setSelected]         = useState(null);
  const [loading, setLoading]           = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [editInstId, setEditInstId]     = useState(null);
  const [editInstForm, setEditInstForm] = useState({ amount: "", due_date: "" });
  const [editLoanId, setEditLoanId]     = useState(null);
  const [editLoanForm, setEditLoanForm] = useState({});
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const load = async () => {
    const [{ data: l }, { data: i }, cats] = await Promise.all([
      supabase.from("loans").select("*, cards(name, color)").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("loan_installments").select("*, loans(description)").eq("user_id", userId).order("due_date"),
      loadCategories(userId),
    ]);
    setLoans(l || []);
    setInstallments(i || []);
    setCategories(cats.despesa || []);
  };

  useEffect(() => { load(); }, [userId]);

  // Preview: o usuário informa total + entrada + parcela + n → app calcula juros e taxa mensal
  const preview = useMemo(() => {
    const total   = parseFloat(form.total_amount || 0);
    const entrada = parseFloat(form.down_payment || 0);
    const parcela = parseFloat(form.installment_value || 0);
    const n       = parseInt(form.installments || 0);
    if (!total || !parcela || !n) return null;
    const financed  = total - entrada;
    const totalPay  = parseFloat((entrada + parcela * n).toFixed(2));
    const juros     = parseFloat((totalPay - total).toFixed(2));
    const monthRate = juros > 0.01 ? calcMonthlyRate(financed, parcela, n) : null;
    return { totalPay, financed, juros, hasInterest: juros > 0.01, monthRate };
  }, [form.total_amount, form.down_payment, form.installment_value, form.installments]);

  const generateInstallments = (loanId, parcela, numInst, startDate) => {
    const list = [];
    for (let i = 0; i < numInst; i++) {
      const due = new Date(startDate + "T12:00:00");
      due.setMonth(due.getMonth() + i);   // i=0 → primeira parcela = startDate exato
      list.push({
        loan_id: loanId, user_id: userId,
        installment_number: i + 1,
        amount: parseFloat(parcela.toFixed(2)),
        interest_amount: 0,
        due_date: due.toISOString().split("T")[0],
        paid: false,
      });
    }
    return list;
  };

  const add = async () => {
    if (!form.description || !form.total_amount || !form.installment_value || !form.installments) return;
    setLoading(true);
    const parcela = parseFloat(form.installment_value);
    const n       = parseInt(form.installments);
    const entrada = parseFloat(form.down_payment || 0);
    const { data, error } = await supabase.from("loans").insert({
      user_id: userId,
      description: form.description,
      category: form.category || "Outros",
      total_amount: parseFloat(form.total_amount),
      down_payment: entrada,
      interest_rate: 0,
      installments: n,
      start_date: form.start_date,
      type: form.type,
    }).select().single();
    if (!error && data) {
      const list = generateInstallments(data.id, parcela, n, form.start_date);
      await supabase.from("loan_installments").insert(list);
    }
    setForm(EMPTY_FORM);
    await load();
    setLoading(false);
  };

  const togglePaid = async (id, paid) => {
    const newPaid = !paid;
    const inst = installments.find(i => i.id === id);
    if (!inst) return;

    // Otimista
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid: newPaid } : i));

    const { error } = await supabase.from("loan_installments")
      .update({ paid: newPaid })
      .eq("id", id);

    if (error) {
      // Reverte se falhou
      setInstallments(prev => prev.map(i => i.id === id ? { ...i, paid } : i));
      console.error("Erro ao marcar parcela:", error);
      return;
    }
    // loan_installments.paid já é a fonte de verdade — igual a installments (cartão)
    // e fixed_expense_payments, que nunca espelham em transactions. O insert/delete
    // espelhado que existia aqui causava duplicação: a mesma parcela paga era somada
    // duas vezes em Dashboard, Análise, Visão e Histórico (uma como "Empréstimo",
    // outra como "Lançamento"), já que nenhuma dessas telas filtra transactions por
    // loan_installment_id. Removido — useMonthlyCosts.js lê loan_installments direto.
  };

  const saveInstEdit = async () => {
    const val  = parseFloat(parseFloat(editInstForm.amount || 0).toFixed(2));
    const date = editInstForm.due_date;
    if (!val || !date) return;
    setInstallments(prev => prev.map(i =>
      i.id === editInstId ? { ...i, amount: val, due_date: date } : i
    ));
    setEditInstId(null);
    await supabase.from("loan_installments")
      .update({ amount: val, due_date: date })
      .eq("id", editInstId);
  };

  const saveLoanEdit = async () => {
    if (!editLoanForm.description || !editLoanForm.total_amount) return;
    const updated = {
      description:  editLoanForm.description,
      category:     editLoanForm.category || "Outros",
      type:         editLoanForm.type,
      total_amount: parseFloat(editLoanForm.total_amount),
      down_payment: parseFloat(editLoanForm.down_payment || 0),
    };
    setLoans(prev => prev.map(l => l.id === editLoanId ? { ...l, ...updated } : l));
    if (selected?.id === editLoanId) setSelected(prev => ({ ...prev, ...updated }));
    setEditLoanId(null);
    await supabase.from("loans").update(updated).eq("id", editLoanId);
  };

  const delLoan = async (id) => {
    setConfirmDelId(null);
    await supabase.from("loan_installments").delete().eq("loan_id", id);
    await supabase.from("loans").delete().eq("id", id);
    if (selected?.id === id) setSelected(null);
    await load();
  };

  const selectedInstallments = useMemo(() =>
    installments.filter(i => i.loan_id === selected?.id),
    [installments, selected]
  );

  const entrada      = selected ? Number(selected.down_payment || 0) : 0;
  const totalPaid    = selectedInstallments.filter(i => i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const totalRemain  = selectedInstallments.filter(i => !i.paid).reduce((a, i) => a + Number(i.amount), 0);
  const totalAll     = selectedInstallments.reduce((a, i) => a + Number(i.amount), 0);
  const totalContrato = totalAll + entrada;
  const totalJuros   = selected ? totalContrato - Number(selected.total_amount) : 0;

  // Taxa mensal real calculada a partir das parcelas reais do empréstimo selecionado
  const selectedMonthRate = useMemo(() => {
    if (!selected || selectedInstallments.length === 0) return null;
    const pv  = Number(selected.total_amount) - Number(selected.down_payment || 0);
    const pmt = selectedInstallments[0] ? Number(selectedInstallments[0].amount) : 0;
    const n   = selectedInstallments.length;
    return calcMonthlyRate(pv, pmt, n);
  }, [selected, selectedInstallments]);
  const totalDebt    = loans.reduce((a, l) => {
    const lInst = installments.filter(i => i.loan_id === l.id);
    const hasPending = lInst.some(i => !i.paid);
    return hasPending ? a + lInst.filter(i => !i.paid).reduce((s, i) => s + Number(i.amount), 0) : a;
  }, 0);

  return (
    <div>
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
        {[
          { label: "Total a pagar", value: fmt(totalDebt), color: "var(--red)" },
          { label: "Empréstimos ativos", value: loans.filter(l => installments.filter(i => i.loan_id === l.id).some(i => !i.paid)).length, color: "var(--accent)" },
          { label: "Parcelas pendentes", value: installments.filter(i => !i.paid).length, color: "var(--amber)" },
        ].map(k => (
          <Card key={k.label}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color: k.color, letterSpacing: "-.02em" }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : selected ? "1fr 1.4fr" : "1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Formulário */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Novo Empréstimo / Financiamento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Descrição */}
              <div>
                <Label>Descrição</Label>
                <input value={form.description} onChange={e => f("description", e.target.value)}
                  placeholder="Ex: Empréstimo Nubank, Financiamento Moto..." maxLength={100} style={inp} />
              </div>

              {/* Tipo + Categoria */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Tipo</Label>
                  <select value={form.type} onChange={e => f("type", e.target.value)} style={inp}>
                    <option value="emprestimo">Empréstimo</option>
                    <option value="financiamento">Financiamento</option>
                    <option value="cartao">Cartão de crédito</option>
                  </select>
                </div>
                <div>
                  <Label>Categoria</Label>
                  <select value={form.category} onChange={e => f("category", e.target.value)} style={inp}>
                    <option value="">Selecionar...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Valores */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Valor total (R$)</Label>
                  <input type="number" value={form.total_amount} onChange={e => f("total_amount", e.target.value)}
                    placeholder="Ex: 5.000,00" style={inp} />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Custo total do bem</div>
                </div>
                <div>
                  <Label>Entrada (R$) <span style={{ color:"var(--muted)", fontWeight:400 }}>(opcional)</span></Label>
                  <input type="number" value={form.down_payment} onChange={e => f("down_payment", e.target.value)}
                    placeholder="Ex: 1.000,00" style={inp} />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Valor pago de entrada</div>
                </div>
                <div>
                  <Label>Valor da parcela (R$)</Label>
                  <input type="number" value={form.installment_value} onChange={e => f("installment_value", e.target.value)}
                    placeholder="Ex: 320,00" style={inp} />
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>Conforme o banco/loja informou</div>
                </div>
              </div>

              {/* Parcelas + Data */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>Número de parcelas</Label>
                  <select value={form.installments} onChange={e => f("installments", e.target.value)} style={inp}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60,72,84,96,120].map(n =>
                      <option key={n} value={n}>{n}x</option>
                    )}
                  </select>
                </div>
                <div>
                  <Label>Data do 1º vencimento</Label>
                  <input type="date" value={form.start_date} onChange={e => f("start_date", e.target.value)} style={inp} />
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{ background: "var(--accentbg)", borderRadius: 10, padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
                  {parseFloat(form.down_payment || 0) > 0 && (
                    <div>
                      <span style={{ color: "var(--muted)" }}>Financiado: </span>
                      <strong style={{ color: "var(--text)" }}>{fmt(preview.financed)}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: "var(--muted)" }}>Total a pagar: </span>
                    <strong style={{ color: "var(--text)" }}>{fmt(preview.totalPay)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted)" }}>Juros totais: </span>
                    <strong style={{ color: preview.hasInterest ? "var(--red)" : "var(--green)" }}>
                      {preview.hasInterest ? fmt(preview.juros) : "Sem juros 🎉"}
                    </strong>
                  </div>
                  {preview.hasInterest && (
                    <div>
                      <span style={{ color: "var(--muted)" }}>Custo total: </span>
                      <strong style={{ color: "var(--amber)" }}>
                        +{((preview.juros / parseFloat(form.total_amount)) * 100).toFixed(1)}%
                      </strong>
                    </div>
                  )}
                  {preview.hasInterest && preview.monthRate && (
                    <div>
                      <span style={{ color: "var(--muted)" }}>Taxa mensal: </span>
                      <strong style={{ color: "var(--red)" }}>
                        {(preview.monthRate * 100).toFixed(2)}% a.m.
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <button onClick={add} disabled={loading || !form.description || !form.total_amount || !form.installment_value} style={{
                padding: "11px 0", borderRadius: 8, border: "none", background: "var(--accent)",
                color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                opacity: (loading || !form.description || !form.total_amount || !form.installment_value) ? .5 : 1,
              }}>
                {loading ? "Salvando..." : "+ Adicionar"}
              </button>
            </div>
          </Card>

          {/* Lista de empréstimos */}
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: "var(--text)" }}>Empréstimos e Financiamentos</div>
            {loans.length === 0
              ? <div style={{ color: "var(--muted)", textAlign: "center", padding: "28px 0", fontSize: 13 }}>Nenhum registrado ainda</div>
              : loans.map(loan => {
                  const lInst = installments.filter(i => i.loan_id === loan.id);
                  const paidCount = lInst.filter(i => i.paid).length;
                  const pct = lInst.length > 0 ? (paidCount / lInst.length) * 100 : 0;
                  const done = pct >= 100;
                  return (
                    <div key={loan.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      {confirmDelId === loan.id ? (
                        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 0" }}>
                          <div style={{ flex:1, fontSize:13, color:"var(--text)" }}>Excluir <strong>"{loan.description}"</strong> e todas as parcelas?</div>
                          <button onClick={() => delLoan(loan.id)} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:"var(--red)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>Excluir</button>
                          <button onClick={() => setConfirmDelId(null)} style={{ padding:"7px 14px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:12, cursor:"pointer" }}>Cancelar</button>
                        </div>
                      ) : (
                        <div style={{ padding: "12px 0", cursor: "pointer", opacity: done ? .6 : 1 }}
                          onClick={() => setSelected(selected?.id === loan.id ? null : loan)}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{loan.description}</div>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                                {loan.type === "emprestimo" ? "Empréstimo" : loan.type === "financiamento" ? "Financiamento" : "Cartão"}
                                {loan.category && <span style={{ marginLeft:6 }}>· {loan.category}</span>}
                                <span style={{ marginLeft:6 }}>· {loan.installments}x</span>
                              </div>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:8 }}>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: done ? "var(--green)" : "var(--red)" }}>{fmt(loan.total_amount)}</div>
                                <div style={{ fontSize: 11, color: "var(--muted)" }}>{paidCount}/{lInst.length} parcelas</div>
                              </div>
                              <button onClick={e => { e.stopPropagation(); setConfirmDelId(loan.id); }} style={{ background:"var(--redbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--red)", fontSize:14, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                            </div>
                          </div>
                          <div style={{ height: 4, background: "var(--border)", borderRadius: 99 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: done ? "var(--green)" : "var(--accent)", borderRadius: 99, transition: "width .4s" }} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            }
          </Card>
        </div>

        {/* Detalhe das parcelas */}
        {selected && (
          <Card>
            {/* Modal edição do contrato */}
            {editLoanId === selected.id && (
              <div onClick={e => e.target === e.currentTarget && setEditLoanId(null)} style={{
                position: "fixed", inset: 0, zIndex: 200,
                background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: isMobile ? "flex-end" : "center",
                justifyContent: "center", padding: isMobile ? 0 : 20,
              }}>
                <div style={{
                  width: "100%", maxWidth: isMobile ? "100%" : 460,
                  background: "var(--surface)", borderRadius: isMobile ? "20px 20px 0 0" : 18,
                  border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", overflow: "hidden",
                }}>
                  {isMobile && <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--border)", margin: "12px auto 0" }} />}
                  <div style={{ padding: isMobile ? "16px 20px 0" : "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Editar contrato</div>
                    <button onClick={() => setEditLoanId(null)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", color: "var(--muted)", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                  <div style={{ padding: isMobile ? "14px 20px 24px" : "16px 24px 24px", display: "flex", flexDirection: "column", gap: 12 }}>

                    <div>
                      <Label>Nome / Descrição</Label>
                      <input value={editLoanForm.description || ""} onChange={e => setEditLoanForm(f => ({ ...f, description: e.target.value }))} maxLength={100} style={inp} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <Label>Tipo</Label>
                        <select value={editLoanForm.type || "emprestimo"} onChange={e => setEditLoanForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                          <option value="emprestimo">Empréstimo</option>
                          <option value="financiamento">Financiamento</option>
                          <option value="cartao">Cartão de crédito</option>
                        </select>
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <select value={editLoanForm.category || ""} onChange={e => setEditLoanForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                          <option value="">Selecionar...</option>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <Label>Valor do empréstimo (R$)</Label>
                        <input type="number" value={editLoanForm.total_amount || ""} onChange={e => setEditLoanForm(f => ({ ...f, total_amount: e.target.value }))} style={inp} />
                      </div>
                      <div>
                        <Label>Entrada (R$)</Label>
                        <input type="number" value={editLoanForm.down_payment || ""} onChange={e => setEditLoanForm(f => ({ ...f, down_payment: e.target.value }))} placeholder="0,00" style={inp} />
                      </div>
                    </div>

                    <div style={{ background: "var(--accentbg)", borderRadius: 8, padding: "10px 13px", fontSize: 12, color: "var(--muted)" }}>
                      ⚠️ Alterar o valor do empréstimo ou a entrada recalcula os juros mostrados no resumo, mas <strong>não altera os valores das parcelas individuais</strong>. Para ajustar parcelas, use o botão ✎ em cada uma.
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button onClick={() => setEditLoanId(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                      <button onClick={saveLoanEdit} style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Salvar alterações</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:15, color:"var(--text)" }}>{selected.description}</div>
                <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                  {selected.category && `${selected.category} · `}
                  {(() => {
                    const valores = selectedInstallments.map(i => Number(i.amount));
                    const saoIguais = valores.every(v => v === valores[0]);
                    return saoIguais
                      ? `${selected.installments}x de ${fmt(valores[0])}`
                      : `${selected.installments}x (valores variáveis)`;
                  })()}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end", flexShrink:0 }}>
                <button onClick={() => { setEditLoanId(selected.id); setEditLoanForm({ ...selected }); }} style={{ background:"var(--accentbg)", border:"none", borderRadius:7, cursor:"pointer", color:"var(--accent)", fontSize:12, padding:"5px 10px", fontWeight:600, whiteSpace:"nowrap" }}>✎ Editar</button>
                <button onClick={() => setSelected(null)} style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:7, cursor:"pointer", color:"var(--muted)", fontSize:12, padding:"5px 10px" }}>Fechar</button>
              </div>
            </div>

            {/* Resumo financeiro */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {[
                { label: "Valor do empréstimo", value: fmt(selected.total_amount),          color: "var(--text)" },
                { label: "Entrada paga",         value: entrada > 0 ? fmt(entrada) : "—",   color: entrada > 0 ? "var(--green)" : "var(--muted)" },
                { label: "Total a pagar",        value: fmt(totalContrato),                  color: "var(--text)" },
                { label: "Juros totais",
                  value: totalJuros > 0
                    ? `${fmt(Math.max(totalJuros, 0))} (${((totalJuros / Number(selected.total_amount)) * 100).toFixed(1)}%${selectedMonthRate ? ` · ${(selectedMonthRate * 100).toFixed(2)}% a.m.` : ""})`
                    : "Sem juros 🎉",
                  color: totalJuros > 0 ? "var(--red)" : "var(--green)" },
                { label: "Já pago (parcelas)",   value: fmt(totalPaid),                      color: "var(--green)" },
                { label: "Ainda falta",          value: fmt(totalRemain),                    color: "var(--accent)" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 700, color, fontSize: 14 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Lista de parcelas */}
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {selectedInstallments.map((inst, i) => (
                <div key={inst.id} style={{
                  padding: "10px 0",
                  borderBottom: i < selectedInstallments.length - 1 ? "1px solid var(--border)" : "none",
                  opacity: inst.paid ? .5 : 1,
                }}>
                  {editInstId === inst.id ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:8, padding:"8px 0" }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"var(--muted)" }}>
                        Parcela {inst.installment_number}/{selectedInstallments.length}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                        <div style={{ flex:1, minWidth:120 }}>
                          <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3 }}>Valor (R$)</div>
                          <input
                            type="number"
                            value={editInstForm.amount}
                            onChange={e => setEditInstForm(f => ({ ...f, amount: e.target.value }))}
                            autoFocus
                            style={{ ...inp, fontSize:13, padding:"6px 10px" }}
                          />
                        </div>
                        <div style={{ flex:1, minWidth:130 }}>
                          <div style={{ fontSize:10, color:"var(--muted)", marginBottom:3 }}>Data de vencimento</div>
                          <input
                            type="date"
                            value={editInstForm.due_date}
                            onChange={e => setEditInstForm(f => ({ ...f, due_date: e.target.value }))}
                            style={{ ...inp, fontSize:13, padding:"6px 10px" }}
                          />
                        </div>
                        <div style={{ display:"flex", gap:6, alignSelf:"flex-end" }}>
                          <button onClick={saveInstEdit} style={{ padding:"8px 14px", borderRadius:7, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>✓ Salvar</button>
                          <button onClick={() => setEditInstId(null)} style={{ padding:"8px 10px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", color:"var(--muted)", fontSize:12, cursor:"pointer" }}>✕</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>Vence {inst.due_date}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: inst.paid ? "var(--green)" : "var(--text)" }}>{fmt(inst.amount)}</span>
                        {!inst.paid && (
                          <button
                          onClick={() => { setEditInstId(inst.id); setEditInstForm({ amount: String(inst.amount), due_date: inst.due_date }); }}
                            title="Editar valor desta parcela"
                            style={{ background:"var(--accentbg)", border:"none", borderRadius:6, cursor:"pointer", color:"var(--accent)", fontSize:12, width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center" }}
                          >✎</button>
                        )}
                      </div>
                    </div>
                  )}
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
