// Plano de categorias padrão (dois níveis). Ao criar a conta, isto vira dado do usuário e pode ser editado.
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const EXPENSE = {
  Moradia: ['Aluguel e financiamento', 'Condomínio', 'Energia', 'Água e esgoto', 'Gás', 'Internet e telefone', 'Manutenção da casa'],
  Alimentação: ['Supermercado', 'Restaurantes', 'Delivery', 'Padaria e lanches'],
  Transporte: ['Combustível', 'Transporte público', 'Aplicativos e táxi', 'Manutenção do veículo', 'Estacionamento e pedágio', 'Seguro e IPVA'],
  Saúde: ['Plano de saúde', 'Consultas e exames', 'Farmácia'],
  Educação: ['Mensalidade', 'Cursos', 'Livros e materiais'],
  Lazer: ['Streaming e assinaturas', 'Viagens', 'Cultura e eventos', 'Esportes'],
  Compras: ['Roupas e acessórios', 'Eletrônicos', 'Casa e decoração', 'Presentes'],
  Financeiro: ['Tarifas bancárias', 'Juros e multas', 'Impostos'],
  Outros: [],
};
const INCOME = { Receitas: ['Salário', 'Serviços e freelance', 'Rendimentos', 'Reembolsos', 'Outras receitas'] };
const COLORS = ['#2f5fc4', '#0f8a6a', '#b5651d', '#7a4fb0', '#c2410c', '#0e7490', '#a23b72', '#4d7c0f', '#64748b'];

export function defaultCategories() {
  const out = []; let i = 0;
  Object.entries({ expense: EXPENSE, income: INCOME }).forEach(([type, groups]) => {
    Object.entries(groups).forEach(([parent, kids]) => {
      const color = type === 'income' ? '#157347' : COLORS[i++ % COLORS.length];
      const pid = `cat_${slug(parent)}`;
      out.push({ id: pid, name: parent, type, parentId: null, color, archived: false });
      kids.forEach((k) => out.push({ id: `cat_${slug(parent)}_${slug(k)}`, name: k, type, parentId: pid, color, archived: false }));
    });
  });
  return out;
}
export const ACCOUNT_TYPES = { checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', investment: 'Investimento', credit: 'Cartão de crédito' };
export const FREQUENCIES = { monthly: 'Mensal', weekly: 'Semanal', yearly: 'Anual' };
