// Histórico de novidades do Balanço. A versão mais nova fica SEMPRE no topo da lista.
// Para registrar uma mudança: adicione uma entrada nova no começo (ou item novo na versão atual) e,
// se for uma versão nova, ela vira a versão do app automaticamente (aparece no backup e na tela de Novidades).
//
// type: 'novo' (recurso novo) · 'melhoria' (algo que já existia ficou melhor) · 'correção' (bug corrigido)

export const CHANGELOG = [
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
