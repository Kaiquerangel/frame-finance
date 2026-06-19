import HelpButton from "../components/HelpButton";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { loadCategories } from "../lib/categories";
import { useIsMobile } from "../lib/useIsMobile";

const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const today = () => new Date().toISOString().slice(0, 7);
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return new Date(+y, +m - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

const inp = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: 15, outline: "none",
};

const Card = ({ children, style = {} }) => (
  <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", padding: 24, boxShadow: "var(--shadow-sm)", ...style }}>
    {children}
  </div>
);

// ── Regra 50-30-20 ────────────────────────────────────────────────────────────
// Cada categoria tem: grupo (necessidade/desejo/economia), % sugerido, ícone e dica
const RULE_503020 = [
  // NECESSIDADES, 50%
  { cat: "Moradia",      group: "necessidade", pct: 15, icon: "🏠", tip: "Aluguel, condomínio, IPTU, manutenção." },
  { cat: "Alimentação",  group: "necessidade", pct: 12, icon: "🍽️", tip: "Mercado, feira, refeições no trabalho." },
  { cat: "Transporte",   group: "necessidade", pct: 10, icon: "🚌", tip: "Combustível, transporte público, manutenção do carro." },
  { cat: "Saúde",        group: "necessidade", pct: 8,  icon: "❤️", tip: "Plano de saúde, remédios, consultas." },
  { cat: "Educação",     group: "necessidade", pct: 5,  icon: "📚", tip: "Mensalidade escolar, cursos essenciais." },
  // DESEJOS, 30%
  { cat: "Lazer",        group: "desejo",      pct: 10, icon: "🎬", tip: "Cinema, viagens, passeios, hobbies." },
  { cat: "Assinaturas",  group: "desejo",      pct: 8,  icon: "📱", tip: "Streaming, apps, clubes de assinatura." },
  { cat: "Vestuário",    group: "desejo",      pct: 7,  icon: "👕", tip: "Roupas, calçados, acessórios." },
  { cat: "Outros",       group: "desejo",      pct: 5,  icon: "🛍️", tip: "Gastos variados não categorizados." },
  // ECONOMIA, 20%
  { cat: "Reserva de Emergência", group: "economia", pct: 10, icon: "🛡️", tip: "Meta: 6 meses de despesas guardados." },
  { cat: "Investimentos",         group: "economia", pct: 5,  icon: "📈", tip: "Renda fixa, ações, fundos." },
  { cat: "Metas",                 group: "economia", pct: 5,  icon: "🎯", tip: "Viagem, carro, imóvel, seus sonhos." },
];

const GROUPS = {
  necessidade: { label: "Necessidades", subtitle: "50% da renda", color: "var(--accent)", bg: "var(--accentbg)", desc: "Gastos essenciais para sua vida funcionar." },
  desejo:      { label: "Desejos",      subtitle: "30% da renda", color: "#f59e0b",       bg: "#fffbeb",        desc: "O que melhora sua qualidade de vida, mas não é essencial." },
  economia:    { label: "Economia",     subtitle: "20% da renda", color: "var(--green)",  bg: "var(--greenbg)", desc: "Seu futuro financeiro. Nunca abra mão disso." },
};

// ── Wizard ────────────────────────────────────────────────────────────────────
function Wizard({ onFinish }) {
  const [step, setStep]         = useState(0);
  const [renda, setRenda]       = useState("");
  const [perfil, setPerfil]     = useState("");
  const [ajustes, setAjustes]   = useState(() =>
    Object.fromEntries(RULE_503020.map(r => [r.cat, r.pct]))
  );

  const rendaNum = parseFloat(renda) || 0;

  // Ajusta % totais para não ultrapassar 100
  const totalPct = Object.values(ajustes).reduce((a, v) => a + v, 0);

  const perfilOptions = [
    { id: "iniciante", icon: "🌱", label: "Iniciante", desc: "Nunca organizei meu dinheiro. Quero começar do zero." },
    { id: "intermediario", icon: "📊", label: "Intermediário", desc: "Já controlo alguns gastos mas quero melhorar." },
    { id: "avancado", icon: "🚀", label: "Avançado", desc: "Já tenho controle, quero otimizar meu orçamento." },
  ];

  const stepContent = [
    // Passo 0, Boas-vindas
    {
      title: "Vamos montar seu orçamento! 🎉",
      subtitle: "Em 3 passos simples você terá um plano financeiro personalizado.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--accentbg)", borderRadius: 12, padding: 20, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", marginBottom: 8 }}>O que é a Regra 50-30-20?</div>
            <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, marginBottom: 12 }}>
              É o método mais simples e eficaz para quem está começando. A ideia é dividir sua renda em três partes:
            </p>
            {Object.entries(GROUPS).map(([key, g]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: g.bg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: g.color, flexShrink: 0 }}>
                  {g.subtitle.split("%")[0]}%
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{g.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
            Não se preocupe, vamos adaptar tudo para a sua realidade!
          </div>
        </div>
      ),
    },
    // Passo 1, Renda + perfil
    {
      title: "Qual é a sua renda mensal?",
      subtitle: "Inclua salário, freelances, aluguéis recebidos, tudo que entra no mês.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Renda mensal líquida (R$)</div>
            <input
              type="number" value={renda} onChange={e => setRenda(e.target.value)}
              placeholder="Ex: 3500" style={{ ...inp, fontSize: 22, fontWeight: 700, textAlign: "center" }}
              autoFocus
            />
            {rendaNum > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
                {Object.entries(GROUPS).map(([key, g]) => {
                  const pct = key === "necessidade" ? 50 : key === "desejo" ? 30 : 20;
                  return (
                    <div key={key} style={{ background: g.bg, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, color: g.color, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{g.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: g.color }}>{fmt(rendaNum * pct / 100)}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{pct}% da renda</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Qual é o seu perfil?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {perfilOptions.map(p => (
                <button key={p.id} onClick={() => setPerfil(p.id)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                  borderRadius: 12, border: "2px solid",
                  borderColor: perfil === p.id ? "var(--accent)" : "var(--border)",
                  background: perfil === p.id ? "var(--accentbg)" : "var(--bg)",
                  cursor: "pointer", textAlign: "left", transition: "all .15s",
                }}>
                  <span style={{ fontSize: 24 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {perfil === p.id && <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 18 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
    },
    // Passo 2, Ajuste fino
    {
      title: "Ajuste os valores se quiser",
      subtitle: "Sugerimos valores baseados na regra 50-30-20. Você pode personalizar cada categoria.",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {/* Aviso se total > 100% */}
          {totalPct > 100 && (
            <div style={{ background: "var(--redbg)", border: "1px solid var(--red)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--red)", marginBottom: 8 }}>
              ⚠ Os percentuais somam {totalPct}%, tente manter em 100% ou menos.
            </div>
          )}

          {Object.entries(GROUPS).map(([gkey, g]) => {
            const cats = RULE_503020.filter(r => r.group === gkey);
            const groupTotal = cats.reduce((a, r) => a + (rendaNum * ajustes[r.cat] / 100), 0);
            return (
              <div key={gkey} style={{ marginBottom: 12 }}>
                {/* Header do grupo */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: g.bg, borderRadius: 10, padding: "10px 14px", marginBottom: 6 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: g.color }}>{g.label}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{g.subtitle}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: g.color }}>{fmt(groupTotal)}</span>
                </div>

                {/* Categorias do grupo */}
                {cats.map(r => {
                  const val = rendaNum * ajustes[r.cat] / 100;
                  return (
                    <div key={r.cat} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span>{r.icon}</span>
                          <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{r.cat}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.tip}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{fmt(val)}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{ajustes[r.cat]}% da renda</div>
                      </div>
                      {/* Controles +/- */}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => setAjustes(a => ({ ...a, [r.cat]: Math.max(0, a[r.cat] - 1) }))}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 16, color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                        <button onClick={() => setAjustes(a => ({ ...a, [r.cat]: a[r.cat] + 1 }))}
                          style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", fontSize: 16, color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Total geral */}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 4px", borderTop: "2px solid var(--border)", marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>Total orçado</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: totalPct > 100 ? "var(--red)" : "var(--green)" }}>{fmt(RULE_503020.reduce((a, r) => a + rendaNum * ajustes[r.cat] / 100, 0))}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{totalPct}% da renda de {fmt(rendaNum)}</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const canAdvance = () => {
    if (step === 1) return rendaNum > 0 && perfil !== "";
    return true;
  };

  const handleFinish = () => {
    const budgets = RULE_503020.map(r => ({
      category: r.cat,
      amount: Math.round(rendaNum * ajustes[r.cat] / 100),
    })).filter(b => b.amount > 0);
    onFinish(budgets);
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {stepContent.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 99,
            background: i <= step ? "var(--accent)" : "var(--border)",
            transition: "background .3s",
          }} />
        ))}
      </div>

      {/* Step badge */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
        Passo {step + 1} de {stepContent.length}
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-.02em", marginBottom: 6 }}>
        {stepContent[step].title}
      </h2>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 24, lineHeight: 1.6 }}>
        {stepContent[step].subtitle}
      </p>

      {/* Conteúdo do step */}
      <div style={{ marginBottom: 28 }}>
        {stepContent[step].content}
      </div>

      {/* Navegação */}
      <div style={{ display: "flex", gap: 10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--bg)", color: "var(--muted)", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>← Voltar</button>
        )}
        {step < stepContent.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canAdvance()} style={{
            flex: 2, padding: "13px 0", borderRadius: 10, border: "none",
            background: canAdvance() ? "var(--accent)" : "var(--border)",
            color: canAdvance() ? "#fff" : "var(--muted)",
            fontWeight: 700, fontSize: 14, cursor: canAdvance() ? "pointer" : "not-allowed",
            transition: "all .15s",
          }}>Continuar →</button>
        ) : (
          <button onClick={handleFinish} disabled={rendaNum === 0} style={{
            flex: 2, padding: "13px 0", borderRadius: 10, border: "none",
            background: "var(--green)", color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>✓ Criar meu orçamento!</button>
        )}
      </div>
    </div>
  );
}

// ── Orçamento Principal ───────────────────────────────────────────────────────
export default function Orcamento({ userId, onNavigate }) {
  const isMobile = useIsMobile();
  const [budgets, setBudgets]           = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [month, setMonth]               = useState(today());
  const [loading, setLoading]           = useState(false);
  const [form, setForm]                 = useState({ category: "", amount: "" });
  const [showWizard, setShowWizard]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [showTips, setShowTips]         = useState(null); // id da categoria com dica aberta

  const load = async () => {
    const [{ data: b }, { data: t }, cats] = await Promise.all([
      supabase.from("budgets").select("*").eq("user_id", userId).eq("month", month),
      supabase.from("transactions").select("*").eq("user_id", userId).like("date", `${month}%`),
      loadCategories(userId),
    ]);
    setBudgets(b || []);
    setTransactions(t || []);
    setCategories(cats.despesa || []);
  };

  useEffect(() => { load(); }, [userId, month]);

  // Abre wizard automaticamente se não tem orçamento no mês
  useEffect(() => {
    if (budgets.length === 0 && !loading) setShowWizard(true);
  }, [budgets]);

  const save = async () => {
    if (!form.category || !form.amount) return;
    setLoading(true);
    await supabase.from("budgets").upsert({
      user_id: userId, category: form.category,
      amount: parseFloat(form.amount), month,
    }, { onConflict: "user_id,category,month" });
    setForm({ category: "", amount: "" });
    await load();
    setLoading(false);
  };

  const del = async (id) => {
    await supabase.from("budgets").delete().eq("id", id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  };

  const handleWizardFinish = async (suggested) => {
    setSaving(true);
    // Salva todos os orçamentos sugeridos de uma vez
    await Promise.all(suggested.map(s =>
      supabase.from("budgets").upsert({
        user_id: userId, category: s.category, amount: s.amount, month,
      }, { onConflict: "user_id,category,month" })
    ));
    await load();
    setShowWizard(false);
    setSaving(false);
  };

  const spentByCategory = useMemo(() => {
    const map = {};
    transactions.filter(t => t.type === "despesa").forEach(t => {
      map[t.cat] = (map[t.cat] || 0) + Number(t.value);
    });
    return map;
  }, [transactions]);

  const totalBudget = budgets.reduce((a, b) => a + Number(b.amount), 0);
  const totalSpent  = budgets.reduce((a, b) => a + (spentByCategory[b.category] || 0), 0);
  const totalLeft   = totalBudget - totalSpent;
  const savingRate  = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0;

  // Enriquece budgets com info da regra 50-30-20
  const enrichedBudgets = useMemo(() =>
    budgets.map(b => {
      const rule = RULE_503020.find(r => r.cat === b.category);
      const spent = spentByCategory[b.category] || 0;
      const pct   = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0;
      return { ...b, icon: rule?.icon || "💰", group: rule?.group || "desejo", tip: rule?.tip || "", spentPct: pct };
    }).sort((a, b) => b.spentPct - a.spentPct), // estourados primeiro
    [budgets, spentByCategory]
  );

  // Agrupa por grupo para exibição
  const budgetsByGroup = useMemo(() => {
    const groups = { necessidade: [], desejo: [], economia: [], outros: [] };
    enrichedBudgets.forEach(b => {
      const g = groups[b.group] ? b.group : "outros";
      groups[g].push(b);
    });
    return groups;
  }, [enrichedBudgets]);

  if (showWizard) {
    return (
      <div>
        {/* Header com opção de pular */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          {!isMobile && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Orçamento</h1>
          <button onClick={() => { sessionStorage.setItem("ff_help_section", "orcamento"); onNavigate("aprendendo"); }} title="Como usar esta seção?" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 16, padding: "2px 4px", fontWeight: 700 }}>?</button>
        </div>
              <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>Vamos configurar seu orçamento</p>
            </div>
          )}
          {budgets.length > 0 && (
            <button onClick={() => setShowWizard(false)} style={{
              padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg)", color: "var(--muted)", fontSize: 13, cursor: "pointer", fontWeight: 600,
            }}>Pular →</button>
          )}
        </div>

        {saving ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)" }}>Criando seu orçamento...</div>
          </div>
        ) : (
          <Wizard onFinish={handleWizardFinish} />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 12 : 0 }}>
        <div>
          {!isMobile && <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>Orçamento</h1>}
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: isMobile ? 0 : 2 }}>Defina limites por categoria e acompanhe seus gastos</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", width: isMobile ? "100%" : "auto" }}>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ ...inp, padding: "7px 12px", fontSize: 13, width: "auto", flex: isMobile ? 1 : "none" }} />
          <button onClick={() => setShowWizard(true)} style={{
            padding: "8px 14px", borderRadius: 10, border: "none",
            background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            whiteSpace: "nowrap",
          }}>✨ Assistente</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Orçamento total", value: fmt(totalBudget),        color: "var(--accent)" },
          { label: "Total gasto",     value: fmt(totalSpent),         color: totalSpent > totalBudget ? "var(--red)" : "var(--text)" },
          { label: "Disponível",      value: fmt(totalLeft),          color: totalLeft >= 0 ? "var(--green)" : "var(--red)" },
          { label: "Taxa de controle",value: `${savingRate.toFixed(0)}%`, color: savingRate >= 20 ? "var(--green)" : savingRate >= 0 ? "var(--amber)" : "var(--red)" },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ padding: isMobile ? "12px 14px" : 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: isMobile ? 15 : 20, fontWeight: 800, color, letterSpacing: "-.02em" }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Adicionar categoria manual */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "var(--text)" }}>Adicionar categoria</div>
        <div style={{ display: "flex", gap: 10, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-end" }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Categoria</div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
              <option value="">Selecionar...</option>
              {[...categories, ...RULE_503020.map(r => r.cat)].filter((v, i, a) => a.indexOf(v) === i).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>Limite (R$)</div>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" style={inp} />
          </div>
          <button onClick={save} disabled={loading} style={{
            padding: "11px 22px", borderRadius: 10, border: "none", background: "var(--accent)",
            color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? .7 : 1, whiteSpace: "nowrap",
          }}>{loading ? "..." : "Salvar"}</button>
        </div>
      </Card>

      {/* Orçamentos agrupados */}
      {budgets.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>Nenhum orçamento ainda</div>
            <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 20 }}>Use o assistente para criar um orçamento personalizado em minutos.</p>
            <button onClick={() => setShowWizard(true)} style={{
              padding: "11px 28px", borderRadius: 10, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer",
            }}>✨ Usar o assistente</button>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Object.entries(GROUPS).map(([gkey, g]) => {
            const items = budgetsByGroup[gkey] || [];
            if (items.length === 0) return null;
            const groupSpent  = items.reduce((a, b) => a + (spentByCategory[b.category] || 0), 0);
            const groupBudget = items.reduce((a, b) => a + Number(b.amount), 0);
            const groupPct    = groupBudget > 0 ? Math.min((groupSpent / groupBudget) * 100, 100) : 0;
            return (
              <Card key={gkey} style={{ padding: 0, overflow: "hidden" }}>
                {/* Header do grupo */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: g.bg, borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: g.color }}>{g.label}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{g.subtitle}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{fmt(groupSpent)} / {fmt(groupBudget)}</div>
                    <div style={{ height: 4, background: "rgba(0,0,0,.1)", borderRadius: 99, marginTop: 4, width: 80 }}>
                      <div style={{ height: "100%", width: `${groupPct}%`, background: g.color, borderRadius: 99 }} />
                    </div>
                  </div>
                </div>

                {/* Itens */}
                <div style={{ padding: "8px 20px" }}>
                  {items.map((b, idx) => {
                    const spent = spentByCategory[b.category] || 0;
                    const pct   = Math.min((spent / Number(b.amount)) * 100, 100);
                    const over  = spent > Number(b.amount);
                    const color = pct > 85 ? "var(--red)" : pct > 60 ? "var(--amber)" : "var(--green)";
                    const isOpen = showTips === b.id;
                    return (
                      <div key={b.id} style={{
                        paddingTop: 14, paddingBottom: 14,
                        borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                        borderRadius: over ? 10 : 0,
                        background: over ? "var(--redbg)" : pct > 75 ? "#fffbeb" : "transparent",
                        margin: over || pct > 75 ? "4px -4px" : "0",
                        padding: over || pct > 75 ? "14px 12px" : "14px 0",
                        transition: "background .2s",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{b.icon}</span>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{b.category}</span>
                                {over && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", background: "var(--redbg)", padding: "1px 6px", borderRadius: 99 }}>Excedido</span>}
                                {b.tip && (
                                  <button onClick={() => setShowTips(isOpen ? null : b.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--muted)", padding: 0 }}>ℹ</button>
                                )}
                              </div>
                              {isOpen && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, maxWidth: 240 }}>{b.tip}</div>}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(spent)} / {fmt(b.amount)}</div>
                              <div style={{ fontSize: 11, color, marginTop: 1, fontWeight: 600 }}>
                                {over ? `${fmt(spent - Number(b.amount))} acima` : `${fmt(Number(b.amount) - spent)} livre`}
                              </div>
                            </div>
                            <button onClick={() => del(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16, padding: 2 }}>×</button>
                          </div>
                        </div>
                        <div style={{ height: 8, background: "var(--border)", borderRadius: 99, position: "relative" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                          <div style={{ fontSize: 11, color, fontWeight: over ? 700 : 500 }}>
                            {over ? `${fmt(spent - Number(b.amount))} acima` : `${fmt(Number(b.amount) - spent)} livre`}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color }}>{pct.toFixed(0)}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Categorias sem grupo definido */}
          {(budgetsByGroup.outros || []).length > 0 && (
            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "var(--text)" }}>Outras categorias</div>
              {budgetsByGroup.outros.map((b, idx) => {
                const spent = spentByCategory[b.category] || 0;
                const pct   = Math.min((spent / Number(b.amount)) * 100, 100);
                const over  = spent > Number(b.amount);
                const color = pct > 85 ? "var(--red)" : pct > 60 ? "var(--amber)" : "var(--green)";
                return (
                  <div key={b.id} style={{ marginBottom: idx < budgetsByGroup.outros.length - 1 ? 18 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>💰 {b.category}</span>
                        {over && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--red)", background: "var(--redbg)", padding: "1px 6px", borderRadius: 99 }}>Excedido</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{fmt(spent)} / {fmt(b.amount)}</span>
                        <button onClick={() => del(b.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>×</button>
                      </div>
                    </div>
                    <div style={{ height: 7, background: "var(--border)", borderRadius: 99 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width .4s" }} />
                    </div>
                    <div style={{ fontSize: 11, color, marginTop: 4 }}>
                      {over ? `${fmt(spent - Number(b.amount))} acima do limite` : `${fmt(Number(b.amount) - spent)} disponível`}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}
      <HelpButton pageId="orcamento" onNavigate={onNavigate} />
    </div>
  );
}
