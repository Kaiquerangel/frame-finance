// Chaves do localStorage
export const KEYS = {
  welcomed:   "ff_welcomed",
  tourDone:   "ff_tour_done",
  tourRepeat: "ff_tour_repeat",
  checklist:  "ff_checklist",
};

export const getWelcomed  = () => localStorage.getItem(KEYS.welcomed) === "true";
export const setWelcomed  = () => localStorage.setItem(KEYS.welcomed, "true");

export const getTourDone   = () => localStorage.getItem(KEYS.tourDone) === "true";
export const setTourDone   = () => localStorage.setItem(KEYS.tourDone, "true");

export const getTourRepeat = () => localStorage.getItem(KEYS.tourRepeat) !== "false";
export const setTourRepeat = (v) => localStorage.setItem(KEYS.tourRepeat, String(v));

export const resetTour = () => {
  localStorage.removeItem(KEYS.tourDone);
  localStorage.setItem(KEYS.tourRepeat, "true");
};

// Checklist
export const DEFAULT_CHECKLIST = [
  { id: "receita",     label: "Adicione sua primeira receita",           page: "receitas",      icon: "up",  tip: "Coloca seu salário ou qualquer dinheiro que entrou." },
  { id: "lancamento",  label: "Registre um gasto do dia a dia",          page: "gastos",        icon: "down", tip: "Mercado, farmácia, restaurante, tudo conta." },
  { id: "cartao",      label: "Cadastre um cartão de crédito",           page: "cartoes",       icon: "card", tip: "Acompanhe o limite e a fatura de cada cartão." },
  { id: "orcamento",   label: "Monte seu orçamento com o assistente",    page: "orcamento",     icon: "plan", tip: "Leva menos de 3 minutos e organiza sua renda direitinho." },
  { id: "meta",        label: "Crie uma meta de economia",               page: "metas",         icon: "goal", tip: "Coloca um objetivo com valor e acompanha o progresso." },
  { id: "despesafixa", label: "Adicione uma despesa fixa",               page: "gastos",        icon: "pin",  tip: "Aluguel, internet, academia, contas que chegam todo mês." },
  { id: "emprestimo",  label: "Registre um empréstimo ou financiamento", page: "emprestimos",   icon: "loan", tip: "Veja parcelas, juros e quanto ainda falta pagar." },
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

// Passos do Tour
export const TOUR_STEPS = [
  {
    id: "welcome",
    page: "dashboard",
    target: null,
    title: "Bem-vindo ao Frame Finance!",
    desc: "Vou te mostrar tudo que tem aqui dentro. São 12 seções e cada uma tem um papel diferente nas suas finanças. Vai levar poucos minutos e depois você vai saber exatamente onde cada coisa está.",
    position: "center",
  },
  {
    id: "dashboard",
    page: "dashboard",
    target: "nav-dashboard",
    title: "Dashboard",
    desc: "Aqui é a tela principal. Toda vez que você abrir o app, vai cair aqui primeiro. Tem um resumo de tudo: quanto entrou, quanto saiu, gráficos dos últimos meses, alertas de contas vencendo e o seu Score de Saúde Financeira.",
    position: "right",
  },
  {
    id: "receitas",
    page: "receitas",
    target: "nav-receitas",
    title: "Receitas",
    desc: "Tudo que entra no seu bolso vai aqui. Salário, freela, aluguel recebido, qualquer coisa. Você pode marcar uma receita como recorrente e ela não precisa ser lançada todo mês manualmente.",
    position: "right",
  },
  {
    id: "lancamentos",
    page: "gastos",
    target: "nav-gastos",
    title: "Gastos",
    desc: "Todos os seus gastos ficam aqui, divididos em três abas: Avulsos (dia a dia), Parcelados (compras no cartão) e Fixos (contas que chegam todo mês). Você filtra, busca, edita e exclui qualquer lançamento.",
    position: "right",
  },
  {
    id: "cartoes",
    page: "cartoes",
    target: "nav-cartoes",
    title: "Cartões",
    desc: "Cadastre seus cartões e veja a fatura de cada mês. Dá pra acompanhar o limite utilizado, marcar parcelas como pagas e receber aviso quando a fatura está fechando.",
    position: "right",
  },
  {
    id: "emprestimos",
    page: "emprestimos",
    target: "nav-emprestimos",
    title: "Empréstimos",
    desc: "Tem financiamento de carro, moto ou um empréstimo pessoal? Registra aqui. O app mostra quanto de cada parcela é juros, quanto você já pagou e quando vai quitar.",
    position: "right",
  },
  {
    id: "orcamento",
    page: "orcamento",
    target: "nav-orcamento",
    title: "Orçamento",
    desc: "Define quanto pode gastar em cada área da sua vida. Tem um assistente que monta tudo por você usando a Regra 50-30-20. Você informa a renda e ele distribui automaticamente entre necessidades, desejos e economia.",
    position: "right",
  },
  {
    id: "metas",
    page: "metas",
    target: "nav-metas",
    title: "Metas",
    desc: "Crie objetivos financeiros com nome e valor. Viagem, carro, reserva de emergência, o que for. Conforme você vai guardando dinheiro, atualiza o valor e vê o progresso no anel visual.",
    position: "right",
  },
  {
    id: "relatorios",
    page: "relatorios",
    target: "nav-relatorios",
    title: "Relatórios",
    desc: "Com os dados que você foi lançando, o app gera gráficos e análises completas. Comparativo mês a mês, quanto você pagou de juros, como estão suas dívidas e um extrato que você pode exportar em planilha.",
    position: "right",
  },
  {
    id: "historico",
    page: "historico",
    target: "nav-historico",
    title: "Histórico",
    desc: "Aqui fica o arquivo completo das suas finanças. Extrato de tudo junto, faturas de meses passados, metas que você já concluiu e um resumo do ano inteiro. Muito útil quando você precisa consultar algo de meses atrás.",
    position: "right",
  },
  {
    id: "categorias",
    page: "categorias",
    target: "nav-categorias",
    title: "Categorias",
    desc: "O app já vem com as categorias mais comuns, mas você pode criar as suas. Quanto melhor você categorizar os gastos, mais úteis ficam os relatórios no fim do mês.",
    position: "right",
  },
  {
    id: "fim",
    page: "dashboard",
    target: null,
    title: "Pronto, você conhece tudo!",
    desc: "Agora é só começar. Lança sua renda, registra os gastos e deixa o app trabalhar por você. Quanto mais você usar, mais claro fica pra onde o seu dinheiro está indo.",
    position: "center",
    isFinal: true,
  },
];
