import { useState } from "react";
import { useIsMobile } from "../lib/useIsMobile";

const Card = ({ children, style = {} }) => (
  <div style={{
    background: "var(--surface)", borderRadius: 14,
    border: "1px solid var(--border)", padding: 20,
    boxShadow: "var(--shadow-sm)", ...style,
  }}>
    {children}
  </div>
);

const Tag = ({ children, color = "var(--accent)", bg = "var(--accentbg)" }) => (
  <span style={{
    display: "inline-block", padding: "2px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, color, background: bg,
    border: `1px solid ${color}22`, marginRight: 6, marginBottom: 4,
  }}>{children}</span>
);

const Tip = ({ children }) => (
  <div style={{
    display: "flex", gap: 10, alignItems: "flex-start",
    background: "var(--accentbg)", borderRadius: 10,
    padding: "11px 14px", marginTop: 12,
    border: "1px solid var(--accent)22",
  }}>
    <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{children}</span>
  </div>
);

const Example = ({ children }) => (
  <div style={{
    background: "var(--bg)", borderRadius: 10,
    border: "1px solid var(--border)",
    padding: "12px 16px", marginTop: 12,
  }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
      📖 Exemplo prático
    </div>
    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>{children}</div>
  </div>
);

const Step = ({ number, children }) => (
  <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
    <div style={{
      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent)", color: "#fff",
      fontSize: 12, fontWeight: 800,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{number}</div>
    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6, paddingTop: 2 }}>{children}</div>
  </div>
);

const SECTIONS = [
  {
    id: "dashboard",
    icon: "⊟",
    label: "Dashboard",
    color: "#7c3aed",
    tagline: "A primeira coisa que você vê ao abrir o app",
    what: "O Dashboard é tipo a tela inicial do seu banco, só que muito mais completo. Assim que você abre o app, já aparece aqui um resumo de tudo: quanto entrou, quanto saiu, se você está gastando demais, alertas de contas vencendo e o progresso das suas metas. Você não precisa ficar abrindo página por página para ter uma noção de como está sua situação.",
    forWhat: [
      "Saber rapidinho se o mês está indo bem ou mal",
      "Ver alertas de contas que estão quase vencendo",
      "Conferir o seu Score de Saúde Financeira",
      "Acompanhar quanto já gastou em cada categoria",
      "Ver gráficos do histórico dos últimos meses",
    ],
    howTo: [
      "Abra o app, o Dashboard já abre sozinho, você não precisa fazer nada",
      "Mude o mês no seletor do canto superior se quiser ver um mês passado",
      "Olhe o Score de Saúde: acima de 75 está ótimo, abaixo de 50 é sinal de atenção",
      "Leia os alertas coloridos. Laranja é atenção, vermelho é urgente",
    ],
    example: "Imagine que você abre o app numa sexta à noite. O Dashboard mostra que você já gastou R$ 1.200 dos R$ 1.500 que separou pra alimentação nesse mês. Ainda faltam 10 dias pro mês acabar. Com essa informação na mão, você decide cozinhar em casa no fim de semana em vez de pedir delivery, e consegue fechar o mês no azul.",
    tips: [
      "Dê uma olhada no Dashboard pelo menos uma vez por semana, é rápido e já te dá uma visão geral",
      "O heatmap de gastos (aquela grade de quadradinhos) mostra os dias em que você mais gastou. Dias vermelhos = gastou mais",
      "O Score de Saúde Financeira leva em conta suas dívidas, se você está cumprindo o orçamento e se está conseguindo guardar dinheiro",
    ],
  },
  {
    id: "receitas",
    icon: "↑",
    label: "Receitas",
    color: "#059669",
    tagline: "Tudo que entra no seu bolso vai aqui",
    what: "Receita é qualquer dinheiro que você recebe, salário, freela, dinheiro de aluguel, presente em dinheiro, restituição do IR, venda de algo. Se entrou no seu bolso, é uma receita e precisa ser registrada aqui. Parece besteira, mas saber exatamente quanto você ganha é o primeiro passo pra organizar qualquer coisa.",
    forWhat: [
      "Registrar o salário do mês",
      "Anotar ganhos extras como freelas ou bicos",
      "Registrar qualquer outro dinheiro que entrou",
      "Ver o total que você recebeu em cada mês",
      "Comparar quanto você ganhou em meses diferentes",
    ],
    howTo: [
      "Toque em 'Nova Receita'",
      "Escreva uma descrição que você vai entender depois, 'Salário maio' é melhor que só 'Salário'",
      "Coloque o valor e escolha a categoria certa",
      "Confirme a data em que o dinheiro entrou",
      "Se for uma receita que repete todo mês (tipo salário), marque como 'Recorrente'",
    ],
    example: "O Lucas trabalha de carteira assinada e ainda faz uns freelas de design nos fins de semana. Em maio ele recebeu R$ 2.800 de salário, R$ 450 de um freela e R$ 200 que um amigo lhe devia. Ele registra os três separados: o salário como 'Receita recorrente', o freela como 'Freelance' e os R$ 200 como 'Outros'. O app mostra que ele teve R$ 3.450 de renda em maio. Essa informação ele vai usar pra montar o orçamento.",
    tips: [
      "Registre a receita no mesmo dia que receber, depois você esquece",
      "Marque o salário como 'Recorrente' e você não precisa ficar repetindo todo mês",
      "Separe bem os tipos de receita. Isso vai aparecer nos gráficos de Relatórios e ajuda muito a entender de onde vem seu dinheiro",
    ],
  },
  {
    id: "lancamentos",
    icon: "↕",
    label: "Lançamentos",
    color: "#ef4444",
    tagline: "Os gastos do seu dia a dia ficam aqui",
    what: "Lançamentos são os gastos que mudam de valor ou não acontecem todo mês: mercado, farmácia, restaurante, Uber, roupa, consulta médica. Sabe aquele dinheiro que some da conta e você não sabe onde foi parar? É exatamente aqui que você vai resolver isso. Registra tudo e em poucos dias você vai descobrir padrões que nunca tinha percebido.",
    forWhat: [
      "Registrar compras do mercado, farmácia, padaria",
      "Anotar almoços, jantares, lanches fora de casa",
      "Registrar Uber, combustível, estacionamento",
      "Filtrar gastos por mês, categoria ou tipo",
      "Editar ou apagar um lançamento errado",
    ],
    howTo: [
      "Escolha se é uma Despesa (↓) ou uma Receita (↑)",
      "Escreva uma descrição clara, 'Mercado Extra quinta' é muito melhor que só escrever 'Compra'",
      "Informe o valor e escolha a categoria certa",
      "A data já vem como hoje. Se precisar mudar, é só trocar",
      "Toque em Adicionar e pronto",
    ],
    example: "A Mariana teve um dia corrido: mercado de manhã (R$ 165), almoço fora (R$ 32) e Uber de volta pra casa (R$ 18). À noite, antes de dormir, ela abre o app e registra os três gastos em menos de 2 minutos. No fim do mês, ela descobre que gastou R$ 680 só com alimentação fora de casa, e decide levar marmita mais vezes.",
    tips: [
      "Registre no mesmo dia, de preferência logo depois do gasto. Quanto mais fresco na memória, melhor",
      "Use a busca lá no topo pra encontrar um lançamento específico quando precisar",
      "Errou alguma coisa? Toque no ícone de lápis ✎ pra editar. Sem estresse nenhum",
    ],
  },
  {
    id: "despesasfixas",
    icon: "📌",
    label: "Despesas Fixas",
    color: "#f59e0b",
    tagline: "As contas que chegam todo mês sem falta",
    what: "Despesas fixas são aquelas contas que chegam todo mês, quase sempre no mesmo valor e na mesma data: aluguel, internet, academia, plano de saúde, escola dos filhos, serviços de streaming. O app cadastra uma vez e já gera automaticamente os pagamentos dos meses seguintes. Você nunca mais esquece de pagar uma dessas.",
    forWhat: [
      "Cadastrar aluguel, condomínio, IPTU",
      "Registrar mensalidades de internet, academia, escola",
      "Ver o status de cada conta: paga, pendente ou vencida",
      "Nunca mais ser pego de surpresa por uma conta fixa",
      "Saber de cara quanto da sua renda já está comprometida todo mês",
    ],
    howTo: [
      "Toque em 'Nova Despesa Fixa'",
      "Dê um nome pra conta (ex: 'Aluguel'), coloque o valor e o dia que vence",
      "Escolha a categoria",
      "O app cria automaticamente o registro desse mês e vai continuar criando nos próximos",
      "Quando pagar, marque como 'Pago', ela sai dos alertas e fica verde",
    ],
    example: "O Rafael tem quatro contas fixas: aluguel R$ 850 (dia 5), internet R$ 110 (dia 12), academia R$ 90 (dia 15) e plano de saúde R$ 220 (dia 20). Ele cadastra as quatro de uma vez. Dia 5 chega, o app avisa que o aluguel vence hoje. Ele paga e marca como pago. Fim do mês: todas pagas, nenhuma esquecida, sem multa.",
    tips: [
      "Reserve uns 10 minutos pra cadastrar todas as suas fixas de uma vez, depois é só marcar como pago",
      "Se o valor mudar (reajuste de aluguel, por exemplo), edite a despesa fixa e o novo valor já vale pros próximos meses",
      "Contas vencidas aparecem em vermelho no Dashboard. É um aviso que você não consegue ignorar",
    ],
  },
  {
    id: "compras",
    icon: "◻",
    label: "Compras",
    color: "#3b82f6",
    tagline: "Parcelou no cartão? Registra aqui",
    what: "Aqui é onde você registra aquelas compras maiores que você parcela no cartão: geladeira, celular, notebook, passagem de avião. Você coloca o valor total, o número de parcelas e o cartão que usou. O app divide tudo automaticamente e já organiza cada parcela no mês certo, sem você precisar ficar calculando na mão.",
    forWhat: [
      "Registrar qualquer compra parcelada no cartão",
      "Ver o total de parcelas que você tem pra pagar em cada mês",
      "Descobrir o melhor dia pra fazer uma compra grande",
      "Registrar se a compra tem juros ou não",
      "Acompanhar quantas parcelas ainda faltam",
    ],
    howTo: [
      "Toque em 'Nova Compra'",
      "Descreva o que você comprou (ex: 'Notebook Dell')",
      "Coloque o valor total e em quantas vezes parcelou",
      "Escolha qual cartão você usou e se tem juros",
      "O app já calcula e agenda cada parcela no mês certo",
    ],
    example: "A Camila comprou uma geladeira por R$ 1.800 em 12x sem juros no Nubank. Ela registra no app e pronto, R$ 150 por mês já aparecem automaticamente na fatura do Nubank, do mês atual até daqui 11 meses. Ela sabe exatamente quanto vai comprometer do limite do cartão por mês, sem surpresa na fatura.",
    tips: [
      "O app tem uma sugestão de melhor dia pra comprar, use isso pra ganhar mais prazo antes da fatura fechar",
      "Compras com juros ficam marcadas em vermelho, fica fácil de ver o quanto os juros estão pesando",
      "Pense bem antes de parcelar em muitas vezes: o compromisso dura muito tempo e pode apertar quando bater um imprevisto",
    ],
  },
  {
    id: "cartoes",
    icon: "▭",
    label: "Cartões",
    color: "#8b5cf6",
    tagline: "Seus cartões de crédito organizados num lugar só",
    what: "Você cadastra seus cartões aqui e o app passa a mostrar a fatura de cada um, mês a mês. Dá pra ver quanto do limite já foi usado, quais parcelas vencem naquele mês e o app avisa quando a fatura está prestes a fechar. Se você usa mais de um cartão, isso aqui é essencial pra não perder o controle.",
    forWhat: [
      "Cadastrar todos os seus cartões de crédito",
      "Acompanhar o limite disponível de cada um",
      "Ver a fatura completa de qualquer mês",
      "Marcar parcelas como pagas",
      "Receber aviso quando a fatura vai fechar",
    ],
    howTo: [
      "Toque em 'Adicionar cartão'",
      "Coloque o nome do cartão (ex: Nubank), o limite total, o dia de fechamento e o dia de vencimento",
      "Escolha uma cor pra identificar o cartão mais fácil",
      "Toque no cartão pra ver a fatura do mês atual",
      "Conforme for pagando as parcelas, marque como pagas",
    ],
    example: "O Bruno tem Nubank e C6. No Nubank o limite é R$ 4.000, fecha dia 12 e vence dia 19. No C6 o limite é R$ 6.000, fecha dia 20 e vence dia 27. Ele cadastra os dois. Quando vai fazer uma compra grande, abre o app e vê qual tem mais limite sobrando e qual fecha mais longe. Assim ele ganha o máximo de prazo possível antes de pagar.",
    tips: [
      "Não confunda fechamento com vencimento: fechamento é quando a fatura fica pronta, vencimento é quando você paga",
      "Se a barra de limite estiver vermelha (acima de 80%), cuidado, você está usando demais e pode não conseguir uma compra importante",
      "Nunca pague só o mínimo da fatura do cartão. Os juros são absurdos, em média 15% ao mês",
    ],
  },
  {
    id: "emprestimos",
    icon: "⊕",
    label: "Empréstimos",
    color: "#ef4444",
    tagline: "Financiamentos e dívidas sob controle",
    what: "Se você tem um financiamento de carro, uma moto parcelada no banco ou um empréstimo pessoal, registra tudo aqui. O app usa o sistema SAC pra calcular quanto de cada parcela é amortização e quanto é juro. Você vai saber exatamente quanto ainda deve e quando vai terminar de pagar. Sem precisar ligar no banco pra perguntar.",
    forWhat: [
      "Registrar financiamento de carro, moto ou imóvel",
      "Controlar empréstimo pessoal ou consignado",
      "Ver o quanto de cada parcela é só juros",
      "Acompanhar o saldo devedor mês a mês",
      "Saber a data exata em que vai quitar",
    ],
    howTo: [
      "Toque em 'Novo Empréstimo'",
      "Dê um nome (ex: 'Financiamento Moto'), coloque o valor total, a taxa de juros mensal e o número de parcelas",
      "Informe a data da primeira parcela",
      "O app já calcula o valor de cada parcela com os juros separados",
      "Conforme for pagando, marque cada parcela como paga",
    ],
    example: "A Fernanda financiou uma moto de R$ 9.000 em 24x com juros de 1,8% ao mês. Ela registra no app e descobre que a primeira parcela é R$ 487. Desse valor, R$ 375 é amortização e R$ 112 é juros. Com o tempo, os juros vão diminuindo e a amortização vai subindo. O app mostra isso parcela por parcela, clarinho.",
    tips: [
      "Registre todos os seus empréstimos pra ter uma visão real de quanto você deve no total. Pode ser um choque, mas é necessário",
      "Se sobrar um dinheiro extra no mês, considere adiantar uma parcela, você elimina os juros das parcelas que sobram",
      "Evite pegar empréstimo pra pagar outro. Isso parece resolver mas só empurra o problema pra frente e com mais juros",
    ],
  },
  {
    id: "orcamento",
    icon: "◑",
    label: "Orçamento",
    color: "#7c3aed",
    tagline: "Decida antes quanto vai gastar em cada coisa",
    what: "Orçamento é basicamente um plano: antes do mês começar, você decide quanto pode gastar em cada área da sua vida. Parece chato, mas é exatamente isso que separa quem consegue juntar dinheiro de quem não consegue. O app tem um assistente que faz isso por você em minutos, usando a Regra 50-30-20. É um dos métodos mais simples e eficazes que existem.",
    forWhat: [
      "Definir um limite de gasto pra cada categoria",
      "Evitar chegar no fim do mês no vermelho",
      "Usar o assistente pra montar tudo automaticamente",
      "Ver em tempo real quanto ainda pode gastar em cada área",
      "Receber um alerta antes de passar do limite",
    ],
    howTo: [
      "Toque em '✨ Assistente', ele vai te guiar por tudo",
      "Coloque quanto você recebe por mês (só o líquido, o que cai na conta mesmo)",
      "Escolha seu perfil: iniciante, intermediário ou avançado",
      "Revise os valores sugeridos e ajuste o que quiser",
      "Toque em 'Criar meu orçamento' e pronto",
    ],
    example: "A Jéssica sempre chegava no fim do mês sem dinheiro e sem saber onde tinha ido parar. Ela usou o assistente, informou que ganha R$ 2.800 líquidos. O app sugeriu R$ 1.400 pra necessidades, R$ 840 pra desejos e R$ 560 pra guardar. Ela ajustou o lazer pra R$ 600 e separou R$ 280 pra uma meta de viagem. Primeiro mês seguindo o plano: sobrou R$ 180. Pela primeira vez na vida sobrou dinheiro.",
    tips: [
      "Use o assistente sempre que começar um mês novo. Leva menos de 3 minutos",
      "Categoria em vermelho = você passou do limite. Não entre em pânico, só ajuste",
      "Não precisa ser perfeito no primeiro mês. O orçamento é um rascunho que você vai melhorando com o tempo",
      "A Regra 50-30-20 é um ponto de partida, não uma lei. Adapta pra sua realidade",
    ],
  },
  {
    id: "metas",
    icon: "◎",
    label: "Metas",
    color: "#059669",
    tagline: "Juntando dinheiro pra realizar algo",
    what: "Metas são os seus objetivos financeiros com nome e valor definido. Uma viagem, um celular novo, um carro, uma reserva de emergência, a entrada de um apartamento. Você coloca o quanto quer juntar e o app vai mostrando o progresso conforme você atualiza o valor guardado. Ter uma meta visual faz toda a diferença na motivação.",
    forWhat: [
      "Juntar dinheiro pra uma viagem",
      "Guardar pra comprar um bem específico",
      "Montar uma reserva de emergência",
      "Planejar qualquer conquista que precisa de grana",
      "Acompanhar o progresso com um anel visual",
    ],
    howTo: [
      "Toque em '+ Criar'",
      "Dê um nome à meta. Quanto mais específico, melhor. 'Viagem Recife junho' é melhor que só 'Viagem'",
      "Coloque o valor que você precisa juntar",
      "Se já guardou alguma coisa, coloca quanto",
      "Todo mês, atualize o campo 'Já guardou' com o novo valor",
    ],
    example: "O Thiago quer ir pra praia nas férias de julho. Estimou que vai precisar de R$ 2.200. Criou a meta 'Praia julho' com esse valor. Já tinha R$ 400 guardados, o app mostrou 18% concluído. Ele decidiu guardar R$ 300 por mês. Em 6 meses estava lá. A cada mês ele atualizava o valor e via o anel crescendo. Isso o motivou a não mexer no dinheiro.",
    tips: [
      "Crie uma meta só pra Reserva de Emergência. Tente juntar o equivalente a 3 meses dos seus gastos fixos",
      "Seja realista no valor e no prazo, meta impossível desmotiva e você acaba abandonando",
      "Quando chegar em 80%, o app te avisa. É quase lá Não desiste!",
    ],
  },
  {
    id: "relatorios",
    icon: "≡",
    label: "Relatórios",
    color: "#3b82f6",
    tagline: "Entendendo pra onde o seu dinheiro foi",
    what: "Os Relatórios são onde a mágica acontece. Com os dados que você foi registrando, o app gera gráficos e análises que mostram exatamente onde você está gastando mais, como sua renda evoluiu, quanto você paga em juros e como seus gastos se comparam mês a mês. É a seção que mais te ensina sobre você mesmo.",
    forWhat: [
      "Ver um comparativo do seu gasto mês a mês",
      "Descobrir em qual categoria você gasta mais",
      "Ver o total que você pagou em juros no mês",
      "Acompanhar como suas dívidas estão evoluindo",
      "Baixar um extrato completo em planilha",
    ],
    howTo: [
      "Acesse Relatórios",
      "Use as abas pra navegar entre os tipos de análise",
      "Na aba Geral, veja o resumo do mês que você escolher",
      "Na aba Comparativo, coloque dois meses lado a lado",
      "Na aba Extrato, filtre e exporte seus dados em CSV",
    ],
    example: "No último dia de março, o Diego abriu os Relatórios e levou um susto: tinha gastado R$ 580 em delivery naquele mês. Puxou o Comparativo e viu que em fevereiro tinha sido R$ 210. A diferença? Em março ele começou a trabalhar em casa e passou a pedir comida toda hora. Com esse dado na mão, ele criou uma regra pra si mesmo: delivery só às sextas. Em abril, o gasto caiu pra R$ 160.",
    tips: [
      "Separa uns 15 minutos no último dia do mês pra revisar os relatórios, é o melhor investimento de tempo que você pode fazer",
      "A aba de Juros pode ser bem dolorosa de olhar, mas é ótima motivação pra quitar dívidas logo",
      "Exporta o CSV e joga numa planilha se quiser fazer análises mais detalhadas por conta própria",
    ],
  },
  {
    id: "historico",
    icon: "⏱",
    label: "Histórico",
    color: "#6b7280",
    tagline: "Tudo que aconteceu nas suas finanças",
    what: "O Histórico é o arquivo completo de tudo. Diferente dos Lançamentos, que mostra só os gastos avulsos de um mês, aqui o Histórico junta tudo em um lugar só: receitas, gastos, faturas de cartão, metas concluídas e um resumo do ano inteiro. Se você precisa consultar algo de meses atrás, é aqui que você vem.",
    forWhat: [
      "Consultar tudo que aconteceu em um período específico",
      "Ver faturas de cartão de meses passados",
      "Rever metas que você já concluiu",
      "Ter um resumo do ano financeiro",
      "Achar um lançamento antigo que você não lembra onde foi",
    ],
    howTo: [
      "Acesse Histórico",
      "Use as abas pra filtrar: Extrato, Faturas, Metas ou Resumo Anual",
      "No Extrato, mude o mês no filtro pra navegar no tempo",
      "Em Faturas, escolhe o cartão e o mês que quer ver",
      "No Resumo Anual, seleciona o ano e vê tudo de uma vez",
    ],
    example: "A Sandra precisava declarar o IR e queria saber o total de salários que recebeu no ano anterior. Abriu o Histórico, foi em Resumo Anual, escolheu o ano e em segundos tinha o número: R$ 36.800 de receitas totais. Sem precisar fuçar em extrato de banco, sem ligar em lugar nenhum.",
    tips: [
      "O Histórico é ótimo quando você precisa de uma visão mais ampla, tipo ver como foram os últimos 6 meses de uma vez",
      "O Resumo Anual é muito útil pra planejar o ano seguinte, você vê o que funcionou e o que não funcionou",
      "Se estiver procurando algo específico, use o Extrato com os filtros. É mais rápido que rolar tudo",
    ],
  },
  {
    id: "categorias",
    icon: "⊞",
    label: "Categorias",
    color: "#14b8a6",
    tagline: "Organize tudo do seu jeito",
    what: "Categorias são os rótulos que você coloca nos seus gastos e receitas. Pensa nelas como as pastas de uma gaveta. O app já vem com as categorias mais comuns (Alimentação, Transporte, Saúde...) e você pode criar quantas quiser. Quanto melhor você categorizar, mais úteis ficam os relatórios.",
    forWhat: [
      "Ver quais categorias já existem no app",
      "Criar uma categoria que faz sentido pra sua vida",
      "Separar gastos que o app não previu",
      "Deixar os relatórios mais precisos e úteis",
    ],
    howTo: [
      "Acesse Categorias",
      "Veja as categorias padrão marcadas com •. Essas não dá pra apagar",
      "Pra criar uma nova, escolhe se é de Despesa ou Receita, escreve o nome e clica em Adicionar",
      "Pronto, ela já aparece disponível em todos os formulários do app",
    ],
    example: "O Paulo faz churrasco todo fim de semana e queria saber quanto gasta com isso por mês. Criou a categoria 'Churrasco' dentro de Alimentação. Agora toda vez que compra carvão, carne ou cerveja pro churrasco, ele categoriza como Churrasco. No fim do mês os Relatórios mostram exatamente quanto foi, e o número assustou ele um pouco.",
    tips: [
      "Cria categorias pra gastos que se repetem muito na sua vida. Fica muito mais fácil de analisar depois",
      "Não exagera na quantidade de categorias. Se ficou difícil de escolher qual usar, é porque tem categorias demais",
      "Se uma categoria tem poucos lançamentos, agrega ela em Outros. Sem problema nenhum",
    ],
  },
];


// ── Componente principal ──────────────────────────────────────────────────────
export default function Aprendendo({ onNavigate }) {
  const isMobile = useIsMobile();
  const [active, setActive] = useState("dashboard");
  const section = SECTIONS.find(s => s.id === active);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        {!isMobile && (
          <h1 style={{ fontWeight: 800, fontSize: 22, color: "var(--text)", letterSpacing: "-.02em" }}>
            Aprendendo a Usar
          </h1>
        )}
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: isMobile ? 0 : 4 }}>
          Guia completo com exemplos práticos para você tirar o máximo do Frame Finance.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "220px 1fr", gap: 16, alignItems: "start" }}>

        {/* Menu lateral de seções */}
        <div style={{
          background: "var(--surface)", borderRadius: 14,
          border: "1px solid var(--border)", padding: 8,
          position: isMobile ? "static" : "sticky", top: 24,
        }}>
          {isMobile && (
            <div style={{ padding: "6px 8px 10px", fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em" }}>
              Selecione uma seção
            </div>
          )}
          {/* Mobile: scroll horizontal */}
          {isMobile ? (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setActive(s.id)} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "8px 12px", borderRadius: 10, border: "none", cursor: "pointer",
                  background: active === s.id ? "var(--accentbg)" : "transparent",
                  color: active === s.id ? "var(--accent)" : "var(--muted)",
                  fontWeight: active === s.id ? 700 : 400, fontSize: 11,
                  whiteSpace: "nowrap", flexShrink: 0,
                  outline: active === s.id ? `2px solid ${s.color}44` : "none",
                }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          ) : (
            /* Desktop: lista vertical */
            SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActive(s.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                background: active === s.id ? "var(--accentbg)" : "transparent",
                color: active === s.id ? "var(--accent)" : "var(--text)",
                fontWeight: active === s.id ? 700 : 400, fontSize: 13,
                textAlign: "left", transition: "all .12s",
                borderLeft: active === s.id ? `3px solid ${s.color}` : "3px solid transparent",
              }}>
                <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{s.icon}</span>
                {s.label}
              </button>
            ))
          )}
        </div>

        {/* Conteúdo da seção */}
        {section && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Hero da seção */}
            <Card style={{ borderLeft: `4px solid ${section.color}`, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${section.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>{section.icon}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: "var(--text)" }}>{section.label}</div>
                  <div style={{ fontSize: 13, color: section.color, fontWeight: 600 }}>{section.tagline}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.75, margin: 0 }}>
                {section.what}
              </p>
            </Card>

            {/* Para que serve */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 12 }}>
                Para que serve?
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {section.forWhat.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                      background: section.color, marginTop: 7,
                    }} />
                    <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Como usar passo a passo */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 14 }}>
                Como usar, passo a passo
              </div>
              {section.howTo.map((step, i) => (
                <Step key={i} number={i + 1}>{step}</Step>
              ))}

              {/* Exemplo prático */}
              <Example>{section.example}</Example>
            </Card>

            {/* Dicas */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>
                Dicas importantes
              </div>
              {section.tips.map((tip, i) => (
                <Tip key={i}>{tip}</Tip>
              ))}
            </Card>

            {/* Botão ir para a seção */}
            <button onClick={() => onNavigate(section.id)} style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: section.color, color: "#fff",
              fontWeight: 700, fontSize: 15, cursor: "pointer",
              boxShadow: `0 4px 16px ${section.color}44`,
              transition: "opacity .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Ir para {section.label} →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}