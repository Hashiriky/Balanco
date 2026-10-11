// Histórico de novidades do Balanço. A versão mais nova fica SEMPRE no topo da lista.
// Para registrar uma mudança: adicione uma entrada nova no começo (ou item novo na versão atual) e,
// se for uma versão nova, ela vira a versão do app automaticamente (aparece no backup e na tela de Novidades).
//
// type: 'novo' (recurso novo) · 'melhoria' (algo que já existia ficou melhor) · 'correção' (bug corrigido)

export const CHANGELOG = [
  {
    version: '1.8.1',
    date: '2026-10-11',
    title: 'Correção do formulário de lançamento',
    items: [
      { type: 'correção', text: 'O rótulo "Descrição" ficava escondido atrás de Despesa/Receita/Transferência quando o formulário ficava mais alto que a janela (por causa das sugestões ou das mensagens de erro em vermelho). O espaçamento foi corrigido em todas as janelas do app: agora, se não couber, a janela rola em vez de amassar os campos.' },
      { type: 'melhoria', text: 'Os atalhos de preenchimento agora ficam numa faixa de uma linha logo abaixo da Descrição, com altura fixa (o formulário não pula mais). Ao digitar, a faixa mostra só os atalhos parecidos com o que você escreveu, e "Repetir último" aparece quando o campo está vazio.' },
    ],
  },
  {
    version: '1.8.0',
    date: '2026-10-11',
    title: 'Compromissos futuros, contas fixas e alertas',
    items: [
      { type: 'novo', text: 'Compromissos dos próximos meses no Painel: mês a mês, quanto já está comprometido em contas a pagar, faturas de cartão e quanto está previsto receber. Compras no cartão entram só pela fatura, sem contar duas vezes.' },
      { type: 'novo', text: 'Repetir todo mês: no detalhe de um lançamento, o botão "Repetir todo mês" abre o cadastro de recorrência já preenchido, começando no mês seguinte.' },
      { type: 'novo', text: 'Sugestões de contas fixas na Agenda: o app percebe lançamentos que se repetiram por 3 meses seguidos, com valor e dia parecidos, e oferece criar a recorrência. "Agora não" esconde a sugestão.' },
      { type: 'novo', text: 'Alerta de gasto fora do normal no Painel: avisa quando uma categoria já passou 50% da média dos últimos 3 meses.' },
      { type: 'melhoria', text: 'O bloco de saldo previsto no Painel foi reescrito: valor em destaque, conta explicada em uma linha e a folga por dia separada, com textos mais claros e melhor espaçamento.' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-10',
    title: 'Folga do mês e categoria automática',
    items: [
      { type: 'novo', text: 'Folga do mês no Painel: abaixo do saldo previsto, o app mostra quanto dá para gastar em média por dia até o fim do mês, ou avisa quando o mês deve fechar sem folga.' },
      { type: 'novo', text: 'Categoria automática: ao sair do campo Descrição, se a categoria estiver vazia e você já lançou exatamente a mesma descrição antes, o app usa a mesma categoria (e avisa que foi sugestão). Você pode trocar.' },
      { type: 'melhoria', text: 'Testes novos para a fatura do cartão na virada de mês e de ano, e para os cálculos novos.' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-10',
    title: 'Novo seletor de período',
    items: [
      { type: 'novo', text: 'Seletor de período em Lançamentos e Relatórios: um botão mostra o período atual e abre uma janela com atalhos (Hoje, Ontem, Esta semana, Mês passado, Últimos 3, 6 e 12 meses, Este ano, Todo o período…) e um calendário para escolher qualquer intervalo.' },
      { type: 'novo', text: 'No calendário, clique no dia inicial e depois no final. Também dá para digitar as datas nos campos De e Até. Nada muda na tela até você clicar em Aplicar.' },
      { type: 'melhoria', text: 'Relatórios agora aceitam qualquer intervalo de datas, não só 4 períodos fixos. Todos os gráficos e tabelas respeitam o recorte (inclusive meses parciais).' },
      { type: 'melhoria', text: 'Em Lançamentos, o período continua seguindo o mês escolhido no topo da página até você escolher outro; "Voltar ao mês selecionado" desfaz a escolha.' },
      { type: 'melhoria', text: 'Relatórios com mais de 36 meses mostram os últimos 36 para os gráficos continuarem legíveis, e a tela avisa quando isso acontece.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-09',
    title: 'Sobra no orçamento e cor nas contas',
    items: [
      { type: 'novo', text: 'Orçamento com sobra acumulada: ao editar um orçamento, marque "Levar a sobra para o mês seguinte". O que você não gastar soma ao limite do próximo mês (conta a partir do mês em que você ativar).' },
      { type: 'novo', text: 'Cor por conta: escolha uma cor no cadastro da conta e ela aparece ao lado do nome nas listas (lançamentos, agenda, painel e tela Contas).' },
      { type: 'melhoria', text: 'Na tela de Orçamento, o limite mostra quanto veio de sobra do mês anterior.' },
      { type: 'melhoria', text: 'Conferido o contraste das cores de status (verde, vermelho, laranja, cinza e azul): todas passam no padrão de acessibilidade AA.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-09',
    title: 'Mais segurança, PDF e rolagem corrigida',
    items: [
      { type: 'correção', text: 'Com uma janela aberta, a tela de trás não rola mais quando você usa a roda do mouse. A rolagem fica só dentro da janela.' },
      { type: 'novo', text: 'Busca global: botão "Buscar" no menu ou tecla / em qualquer tela. Procura em todos os lançamentos por descrição, valor, conta, categoria ou data (dá para combinar palavras, como "mercado 50").' },
      { type: 'novo', text: 'Cópia de segurança automática: antes de "Substituir tudo" (restaurar backup) e de "Apagar tudo", o app baixa sozinho um arquivo com os dados atuais.' },
      { type: 'novo', text: 'Relatórios: botão "Imprimir / salvar PDF". Na janela de impressão, escolha "Salvar como PDF" como destino.' },
      { type: 'melhoria', text: 'Impressão mais bonita: gráficos mantêm as cores, sem sombras e sem cortar os cartões no meio.' },
      { type: 'melhoria', text: 'Quem desativa animações no sistema (acessibilidade) não vê mais animações nem transições no app.' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-08',
    title: 'Formulários mais seguros e atalhos de preenchimento',
    items: [
      { type: 'correção', text: 'Clicar fora de um formulário (lançamento, conta, etc.) não fecha mais a janela, então você não perde o que estava digitando.' },
      { type: 'correção', text: 'Ao apertar Esc num formulário já preenchido, o app pergunta antes de descartar. O Esc também dispara ao fechar o seletor de data, por isso a proteção.' },
      { type: 'novo', text: 'Atalhos "Mais usados" no lançamento novo: as descrições que você repete (2 vezes ou mais) aparecem como botões e preenchem descrição, valor, conta e categoria de uma vez.' },
      { type: 'melhoria', text: '"Repetir último" agora fica junto dos atalhos "Mais usados", logo acima do formulário.' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-08',
    title: 'Lançamento mais rápido e Painel comparativo',
    items: [
      { type: 'novo', text: 'Botão "Salvar e novo" no lançamento: salva e já deixa o formulário pronto para o próximo, mantendo tipo, conta, data e situação.' },
      { type: 'novo', text: 'Botão "Repetir último lançamento": preenche descrição, valor, conta e categoria com os do lançamento mais recente.' },
      { type: 'novo', text: 'Atalhos de teclado: aperte N para criar uma despesa nova e / para ir direto ao campo de busca (só funcionam fora de campos de texto).' },
      { type: 'novo', text: 'No Painel, receitas, despesas e resultado agora mostram a comparação com o mês anterior.' },
      { type: 'correção', text: 'Os títulos de banco na tela Contas ficavam quase da cor do fundo; agora têm fundo azul claro, texto escuro e uma faixa de destaque.' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-08',
    title: 'Conta principal, bancos e Novidades',
    items: [
      { type: 'novo', text: 'Conta principal: marque uma conta como "Principal" (conta corrente, poupança ou dinheiro). Ela já vem escolhida ao criar um lançamento.' },
      { type: 'novo', text: 'Campo "Banco" nas contas e nos cartões. Contas antigas continuam funcionando sem banco.' },
      { type: 'novo', text: 'Esta tela de Novidades, que mostra o que mudou em cada versão. Um ponto aparece no menu quando há novidade que você ainda não viu.' },
      { type: 'melhoria', text: 'Tela Contas agrupada por banco, com o selo "Principal" e o total de cada banco.' },
      { type: 'melhoria', text: 'Na lista de contas dos formulários, a principal aparece primeiro (com ★) e as demais ficam agrupadas por banco.' },
      { type: 'melhoria', text: 'Ao pagar uma fatura, a conta principal já vem sugerida como origem do pagamento.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-06',
    title: 'Primeira versão do Balanço',
    items: [
      { type: 'novo', text: 'Contas, lançamentos (receita, despesa e transferência), parcelamento e edição em lote com Desfazer.' },
      { type: 'novo', text: 'Cartão de crédito com fatura por mês, pagamento de fatura e avisos de fechamento e vencimento.' },
      { type: 'novo', text: 'Agenda de contas a pagar e receber, com recorrências.' },
      { type: 'novo', text: 'Orçamento por categoria, relatórios, carteira de investimentos e importação de extrato (CSV e OFX).' },
      { type: 'novo', text: 'Login com sincronização na nuvem, ou uso só neste aparelho; backup e restauração em JSON.' },
    ],
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;
export const TYPE_LABEL = { novo: 'Novo', melhoria: 'Melhoria', correção: 'Correção' };
