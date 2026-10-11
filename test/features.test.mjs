import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlerts, cardInvoice, commitments, dailyAllowance, detectFixed, guessCategory, invoiceDates, invoiceMonthOf, unusualSpending } from '../src/lib/domain.js';

test('folga do mês: saldo previsto dividido pelos dias que faltam (hoje conta)', () => {
  assert.deepEqual(dailyAllowance(230000, '2026-10-09'), { daysLeft: 23, projected: 230000, perDay: 10000 });
  assert.equal(dailyAllowance(100, '2026-10-31').daysLeft, 1); // último dia do mês
  assert.equal(dailyAllowance(100, '2026-10-01').daysLeft, 31);
  assert.equal(dailyAllowance(100000, '2028-02-10').daysLeft, 20); // fevereiro bissexto
  assert.equal(dailyAllowance(-5000, '2026-10-09').perDay, 0); // sem folga
  assert.equal(dailyAllowance(0, '2026-10-09').perDay, 0);
  assert.equal(dailyAllowance(1000, '2026-10-09').perDay, 43); // arredonda para baixo
});

const cats = [{ id: 'c1', name: 'Mercado' }, { id: 'c2', name: 'Casa' }];
const tx = (o) => ({ id: Math.random().toString(36), type: 'expense', description: 'Mercado', amount: 1000, date: '2026-09-01', accountId: 'a', categoryId: 'c1', ...o });

test('categoria sugerida: a da última vez que a mesma descrição foi lançada', () => {
  const txs = [tx({ categoryId: 'c1', date: '2026-08-01' }), tx({ categoryId: 'c2', date: '2026-09-15' })];
  assert.equal(guessCategory(txs, cats, 'expense', 'Mercado'), 'c2'); // a mais recente vence
  assert.equal(guessCategory(txs, cats, 'expense', '  MERCADO '), 'c2'); // ignora maiúsculas e espaços
  assert.equal(guessCategory([tx({ description: 'Padaria', categoryId: 'c1' })], cats, 'expense', 'padária'), 'c1'); // ignora acentos
  assert.equal(guessCategory([tx({ description: 'Mercado (2/3)', categoryId: 'c2' })], cats, 'expense', 'Mercado'), 'c2'); // parcelas
});

test('categoria sugerida: não chuta quando não há base segura', () => {
  assert.equal(guessCategory([tx()], cats, 'expense', 'Mercadinho'), ''); // só descrição exata
  assert.equal(guessCategory([tx()], cats, 'income', 'Mercado'), ''); // tipo diferente
  assert.equal(guessCategory([tx({ categoryId: 'apagada' })], cats, 'expense', 'Mercado'), ''); // categoria que não existe mais
  assert.equal(guessCategory([tx({ isYield: true })], cats, 'expense', 'Mercado'), '');
  assert.equal(guessCategory([tx()], cats, 'expense', ''), '');
  assert.equal(guessCategory([], cats, 'expense', 'Mercado'), '');
});

/* Fatura do cartão na virada de mês e de ano (fecha dia 25, vence dia 5) */
const card = { id: 'k', name: 'Cartão', type: 'credit', initialBalance: 0, limit: 500000, closingDay: 25, dueDay: 5 };
const buy = (date, amount) => ({ id: date + amount, accountId: 'k', type: 'expense', description: 'Compra', amount, date, status: 'paid' });

test('cartão: compra depois do fechamento cai na fatura do mês seguinte, inclusive na virada de ano', () => {
  assert.equal(invoiceMonthOf('2026-12-25', 25), '2026-12'); // no dia do fechamento ainda entra
  assert.equal(invoiceMonthOf('2026-12-26', 25), '2027-01'); // depois, vai para a fatura de janeiro
  assert.equal(invoiceMonthOf('2026-01-31', 25), '2026-02');
});

test('cartão: datas de fechamento e vencimento na virada de ano', () => {
  assert.deepEqual(invoiceDates(card, '2026-12'), { closeDate: '2026-12-25', dueDate: '2027-01-05' });
  assert.deepEqual(invoiceDates(card, '2027-01'), { closeDate: '2027-01-25', dueDate: '2027-02-05' });
  assert.deepEqual(invoiceDates({ ...card, closingDay: 5, dueDay: 15 }, '2026-12'), { closeDate: '2026-12-05', dueDate: '2026-12-15' }); // vence no mesmo mês
});

test('cartão: total, pagamento e situação da fatura de janeiro', () => {
  const txs = [buy('2026-12-26', 30000), buy('2027-01-10', 20000), buy('2027-01-26', 99900)]; // a última vai para fevereiro
  const open = cardInvoice(card, txs, '2027-01', '2027-01-15');
  assert.equal(open.total, 50000); assert.equal(open.remaining, 50000); assert.equal(open.status, 'open');
  assert.equal(cardInvoice(card, txs, '2027-01', '2027-01-30').status, 'closed'); // fechou, ainda não venceu
  assert.equal(cardInvoice(card, txs, '2027-01', '2027-02-10').status, 'late'); // venceu sem pagar
  const pago = [...txs, { id: 'p', type: 'transfer', accountId: 'b', toAccountId: 'k', amount: 50000, date: '2027-02-04', status: 'paid', invoiceMonth: '2027-01' }];
  const paid = cardInvoice(card, pago, '2027-01', '2027-02-10');
  assert.equal(paid.remaining, 0); assert.equal(paid.status, 'paid');
  assert.equal(cardInvoice(card, txs, '2027-02', '2027-02-10').total, 99900);
});

/* Compromissos dos próximos meses */
const bank = { id: 'b', name: 'Banco', type: 'checking', initialBalance: 0 };
const internet = { id: 'r1', type: 'expense', description: 'Internet', amount: 10000, accountId: 'b', categoryId: 'c1', freq: 'monthly', day: 10, startMonth: '2026-10', endMonth: '', active: true };
const baseTxs = [
  { id: 'a', type: 'expense', description: 'Aluguel', amount: 100000, accountId: 'b', date: '2026-11-05', status: 'pending' },
  { id: 'k1', type: 'expense', description: 'Compra', amount: 20000, accountId: 'k', date: '2026-10-10', status: 'paid' }, // fatura de outubro, vence 05/11
  { id: 'k2', type: 'expense', description: 'Parcela', amount: 30000, accountId: 'k', date: '2026-11-10', status: 'pending' }, // fatura de novembro, vence 05/12
];

test('compromissos: contas a pagar e faturas por mês, sem contar o cartão duas vezes', () => {
  const r = commitments({ accounts: [bank, card], txs: baseTxs, recurrences: [internet], today: '2026-10-09', months: 3 });
  assert.deepEqual(r.map((m) => m.key), ['2026-10', '2026-11', '2026-12']);
  assert.deepEqual([r[0].bills, r[0].invoices, r[0].total], [10000, 0, 10000]); // só a internet
  assert.deepEqual([r[1].bills, r[1].invoices, r[1].total], [110000, 20000, 130000]); // aluguel + internet; fatura de outubro vence em novembro
  assert.deepEqual([r[2].bills, r[2].invoices, r[2].total], [10000, 30000, 40000]); // parcela do cartão só entra pela fatura
});

test('compromissos: fatura já paga sai, e o que é para receber vem à parte', () => {
  const pagamento = { id: 'p', type: 'transfer', accountId: 'b', toAccountId: 'k', amount: 20000, date: '2026-10-20', status: 'paid', invoiceMonth: '2026-10' };
  const salario = { id: 's', type: 'income', description: 'Freela', amount: 50000, accountId: 'b', date: '2026-11-20', status: 'pending' };
  const r = commitments({ accounts: [bank, card], txs: [...baseTxs, pagamento, salario], recurrences: [], today: '2026-10-09', months: 2 });
  assert.equal(r[1].invoices, 0); // a fatura de outubro foi paga
  assert.equal(r[1].income, 50000);
  assert.equal(r[1].bills, 100000); // sem a recorrência da internet neste teste
});

/* Gasto fora do normal */
const gasto = (date, amount) => ({ id: date + amount, type: 'expense', description: 'x', amount, date, status: 'paid', accountId: 'b', categoryId: 'c1' });
const hist = [gasto('2026-07-10', 70000), gasto('2026-08-10', 50000), gasto('2026-09-10', 60000)]; // média de R$ 600
const mercado = [{ id: 'c1', name: 'Mercado', type: 'expense', parentId: null, color: '#000000' }];

test('gasto fora do normal: 50% acima da média dos 3 meses anteriores', () => {
  const r = unusualSpending({ txs: [...hist, gasto('2026-10-15', 100000)], categories: mercado, today: '2026-10-20' });
  assert.deepEqual(r.map((x) => [x.name, x.amount, x.avg, x.pct]), [['Mercado', 100000, 60000, 67]]);
  assert.equal(unusualSpending({ txs: [...hist, gasto('2026-10-15', 80000)], categories: mercado, today: '2026-10-20' }).length, 0); // só 33% acima
});

test('gasto fora do normal: não avisa com base fraca', () => {
  assert.equal(unusualSpending({ txs: [gasto('2026-09-10', 60000), gasto('2026-10-15', 200000)], categories: mercado, today: '2026-10-20' }).length, 0); // só 1 mês de histórico
  const pouco = [gasto('2026-07-10', 3000), gasto('2026-08-10', 3000), gasto('2026-09-10', 3000), gasto('2026-10-15', 9000)];
  assert.equal(unusualSpending({ txs: pouco, categories: mercado, today: '2026-10-20' }).length, 0); // média menor que R$ 100
});

test('gasto fora do normal aparece nos alertas do Painel', () => {
  const al = buildAlerts({ accounts: [bank], txs: [...hist, gasto('2026-10-15', 100000)], recurrences: [], budgets: [], categories: mercado, today: '2026-10-20' });
  const u = al.find((a) => a.id === 'unusual:c1');
  assert.ok(u); assert.equal(u.value, 100000); assert.match(u.text, /Mercado.*67%/);
});

/* Detectar contas fixas */
const pago = (description, date, amount = 8000, o = {}) => ({ id: description + date, type: 'expense', description, amount, date, status: 'paid', accountId: 'b', categoryId: 'c1', ...o });
const academia = [pago('Academia', '2026-07-10'), pago('Academia', '2026-08-11'), pago('Academia', '2026-09-10')];

test('contas fixas: 3 meses seguidos, mesmo valor e dia parecido viram sugestão', () => {
  const r = detectFixed({ txs: academia, today: '2026-10-20' });
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].description, r[0].amount, r[0].day, r[0].months, r[0].startMonth], ['Academia', 8000, 10, 3, '2026-10']);
  const jaPago = detectFixed({ txs: [...academia, pago('Academia', '2026-10-10')], today: '2026-10-20' });
  assert.equal(jaPago[0].startMonth, '2026-11'); // este mês já foi pago: a recorrência começa no próximo
});

test('contas fixas: não sugere quando não parece fixa', () => {
  const d = (txs, recurrences = []) => detectFixed({ txs, recurrences, today: '2026-10-20' }).length;
  assert.equal(d(academia.slice(0, 2)), 0); // só 2 meses
  assert.equal(d([...academia, pago('Academia', '2026-09-12')]), 0); // dois no mesmo mês
  assert.equal(d([pago('Luz', '2026-07-10', 8000), pago('Luz', '2026-08-10', 12000), pago('Luz', '2026-09-10', 9000)]), 0); // valor muda muito
  assert.equal(d([pago('Feira', '2026-07-02'), pago('Feira', '2026-08-15'), pago('Feira', '2026-09-28')]), 0); // dia muito diferente
  assert.equal(d([pago('Curso', '2026-06-10'), pago('Curso', '2026-08-10'), pago('Curso', '2026-09-10')]), 0); // pulou um mês
  assert.equal(d(academia, [{ id: 'r', type: 'expense', description: 'academia', active: true }]), 0); // já tem recorrência
  assert.equal(d(academia.map((t) => ({ ...t, installment: { number: 1, total: 3 } }))), 0); // parcelas não contam
  assert.equal(d(academia.map((t) => ({ ...t, type: 'transfer' }))), 0);
});
