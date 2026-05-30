// ── Chaves do localStorage ────────────────────────────────────────────────────
export const KEYS = {
  welcomed:    "ff_welcomed",       // boolean — viu a tela de boas-vindas
  tourDone:    "ff_tour_done",      // boolean — concluiu o tour ao menos 1x
  tourRepeat:  "ff_tour_repeat",    // boolean — quer ver o tour novamente
  checklist:   "ff_checklist",      // JSON    — estado da checklist
};

export const getWelcomed  = () => localStorage.getItem(KEYS.welcomed) === "true";
export const setWelcomed  = () => localStorage.setItem(KEYS.welcomed, "true");

export const getTourDone   = () => localStorage.getItem(KEYS.tourDone) === "true";
export const setTourDone   = () => localStorage.setItem(KEYS.tourDone, "true");

export const getTourRepeat = () => localStorage.getItem(KEYS.tourRepeat) !== "false"; // default: true
export const setTourRepeat = (v) => localStorage.setItem(KEYS.tourRepeat, String(v));

export const resetTour = () => {
  localStorage.removeItem(KEYS.tourDone);
  localStorage.setItem(KEYS.tourRepeat, "true");
};

// ── Checklist ────────────────────────────────────────────────────────────────
export const DEFAULT_CHECKLIST = [
  { id: "receita",      label: "Adicione sua primeira receita",         page: "receitas",     icon: "↑", tip: "Registre seu salário ou qualquer entrada de dinheiro." },
  { id: "lancamento",   label: "Registre um gasto do dia a dia",        page: "lancamentos",  icon: "↓", tip: "Mercado, farmácia, restaurante — tudo conta!" },
  { id: "cartao",       label: "Cadastre um cartão de crédito",         page: "cartoes",      icon: "▭", tip: "Gerencie seus cartões e acompanhe faturas." },
  { id: "orcamento",    label: "Monte seu orçamento com o assistente",  page: "orcamento",    icon: "◑", tip: "Use a regra 50-30-20 para organizar sua renda." },
  { id: "meta",         label: "Crie uma meta de economia",             page: "metas",        icon: "◎", tip: "Defina um objetivo e acompanhe seu progresso." },
  { id: "despesafixa",  label: "Adicione uma despesa fixa",             page: "despesasfixas",icon: "📌", tip: "Aluguel, internet, academia — gastos que se repetem." },
  { id: "emprestimo",   label: "Registre um empréstimo ou financiamento", page: "emprestimos",icon: "⊕", tip: "Acompanhe parcelas e juros dos seus compromissos." },
];

export const getChecklist = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS.checklist) || "{}");
    return DEFAULT_CHECKLIST.map(item => ({ ...item, done: !!saved[item.id] }));
  } catch { return DEFAULT_CHECKLIST.map(item => ({ ...item, done: false })); }
};

export const markChecklistItem = (id) => {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYS.checklist) || "{}");
    saved[id] = true;
    localStorage.setItem(KEYS.checklist, JSON.stringify(saved));
  } catch {}
};

export const resetChecklist = () => localStorage.removeItem(KEYS.checklist);

// ── Passos do Tour ────────────────────────────────────────────────────────────
// target: ID do elemento HTML que será destacado
// page: página para navegar antes de mostrar o passo
export const TOUR_STEPS = [
  // ── Geral ──────────────────────────────────────────────────────────────────
  {
    id: "welcome",
    page: "dashboard",
    target: null, // sem highlight — cobre a tela toda
    title: "Bem-vindo ao Frame Finance! 👋",
    desc: "Este tour vai te mostrar tudo que o app pode fazer por você. São 12 seções, cada uma com um propósito. Vamos começar pelo Dashboard!",
    position: "center",
  },
  {
    id: "dashboard",
    page: "dashboard",
    target: "nav-dashboard",
    title: "Dashboard 📊",
    desc: "Aqui é o seu painel de controle. Você vê um resumo completo: saldo do mês, receitas, despesas, saúde financeira, gráficos e alertas. É a primeira coisa que você vê ao abrir o app.",
    position: "right",
  },
  {
    id: "receitas",
    page: "receitas",
    target: "nav-receitas",
    title: "Receitas ↑",
    desc: "Registre tudo que entra: salário, freelances, aluguéis recebidos, dividendos. Você pode marcar receitas como recorrentes para não esquecer de lançar todo mês.",
    position: "right",
  },
  {
    id: "lancamentos",
    page: "lancamentos",
    target: "nav-lancamentos",
    title: "Lançamentos ↕",
    desc: "Os gastos do dia a dia ficam aqui — mercado, farmácia, restaurante, Uber. Você pode filtrar por mês, categoria ou tipo, e editar qualquer lançamento.",
    position: "right",
  },
  {
    id: "despesasfixas",
    page: "despesasfixas",
    target: "nav-despesasfixas",
    title: "Despesas Fixas 📌",
    desc: "Gastos que se repetem todo mês: aluguel, internet, academia, streaming. O app gera automaticamente os pagamentos mensais e avisa quando estão vencendo.",
    position: "right",
  },
  {
    id: "compras",
    page: "compras",
    target: "nav-compras",
    title: "Compras ◻",
    desc: "Registre compras parceladas no cartão. O app calcula automaticamente cada parcela usando a Tabela Price e te sugere o melhor dia para comprar.",
    position: "right",
  },
  // ── Crédito ────────────────────────────────────────────────────────────────
  {
    id: "cartoes",
    page: "cartoes",
    target: "nav-cartoes",
    title: "Cartões ▭",
    desc: "Gerencie seus cartões de crédito. Veja o limite utilizado, acompanhe a fatura mês a mês e marque parcelas como pagas. Toque em um cartão para ver os detalhes.",
    position: "right",
  },
  {
    id: "emprestimos",
    page: "emprestimos",
    target: "nav-emprestimos",
    title: "Empréstimos ⊕",
    desc: "Controle financiamentos e empréstimos. O app calcula os juros de cada parcela pelo sistema SAC e mostra quanto você já pagou e quanto ainda deve.",
    position: "right",
  },
  // ── Planejamento ───────────────────────────────────────────────────────────
  {
    id: "orcamento",
    page: "orcamento",
    target: "nav-orcamento",
    title: "Orçamento ◑",
    desc: "Defina um limite de gastos por categoria. Use o assistente inteligente — ele aplica a Regra 50-30-20 e distribui sua renda automaticamente entre necessidades, desejos e economia.",
    position: "right",
  },
  {
    id: "metas",
    page: "metas",
    target: "nav-metas",
    title: "Metas ◎",
    desc: "Defina objetivos financeiros: viagem, carro, reserva de emergência. Acompanhe o progresso com um visual claro e receba alertas quando estiver perto de concluir.",
    position: "right",
  },
  {
    id: "relatorios",
    page: "relatorios",
    target: "nav-relatorios",
    title: "Relatórios ≡",
    desc: "Análises detalhadas das suas finanças: comparativo mês a mês, quanto você paga em juros, evolução das dívidas e extrato completo com exportação para CSV.",
    position: "right",
  },
  {
    id: "historico",
    page: "historico",
    target: "nav-historico",
    title: "Histórico ⏱",
    desc: "Veja tudo em ordem cronológica: extrato unificado, faturas de cartões, metas concluídas e resumo anual. É a memória completa das suas finanças.",
    position: "right",
  },
  // ── Config ─────────────────────────────────────────────────────────────────
  {
    id: "categorias",
    page: "categorias",
    target: "nav-categorias",
    title: "Categorias ⊞",
    desc: "Personalize as categorias de receitas e despesas. As categorias padrão já cobrem a maioria dos casos, mas você pode criar quantas quiser.",
    position: "right",
  },
  // ── Fim ───────────────────────────────────────────────────────────────────
  {
    id: "fim",
    page: "dashboard",
    target: null,
    title: "Você está pronto! 🎉",
    desc: "Agora você conhece todas as funcionalidades do Frame Finance. Comece adicionando sua renda e seus gastos — quanto mais dados, mais preciso fica o seu painel.",
    position: "center",
    isFinal: true,
  },
];
