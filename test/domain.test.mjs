import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/lib/domain.js';
import * as U from '../src/lib/util.js';
import { defaultCategories } from '../src/lib/defaults.js';

const TODAY = '2026-09-19';
const acc = (id, o = {}) => ({ id, name: id, type: 'checking', initialBalance: 0, ...o });
const tx = (id, o) => ({ id, type: 'expense', status: 'paid', description: id, amount: 1000, date: '2026-09-10', accountId: 'cc', categoryId: 'cat_lazer', ...o });
const cats = defaultCategories();

test('dinheiro em centavos: leitura, máscara e parcelas', () => {
  assert.equal(U.parseMoney('1.234,56'), 123456); assert.equal(U.parseMoney('0,29'), 29); assert.equal(U.parseMoney(''), 0);
  assert.equal(U.maskMoney('123456'), '1.234,56'); assert.equal(U.fmtNumber(5), '0,05');
  assert.deepEqual(U.splitCents(10000, 3), [3333, 3333, 3334]); assert.equal(U.sum(U.splitCents(129990, 7)), 129990);
  assert.equal(U.centsToField(123456), '1.234,56'); assert.equal(U.parseMoney(U.centsToField(123456)), 123456);
});
test('datas de calendário', () => {
  assert.equal(U.addMonthsISO('2026-01-31', 1), '2026-02-28'); assert.equal(U.dateInMonth('2026-02', 31), '2026-02-28');
  assert.equal(U.isValidISO('2026-02-30'), false); assert.equal(U.isValidISO('2026-09-19'), true);
  assert.equal(U.lastDayOfMonth('2028-02'), '2028-02-29'); assert.equal(U.monthLabel('2026-09'), 'Setembro de 2026');
});

test('saldo: realizado × previsto, futuro e transferências', () => {
  const cc = acc('cc', { initialBalance: 100000 }), poup = acc('pp', { type: 'savings' });
  const txs = [
    tx('a', { type: 'income', amount: 500000 }),
    tx('b', { amount: 20000 }),
    tx('c', { amount: 30000, status: 'pending', date: '2026-09-25' }),
    tx('d', { type: 'transfer', amount: 50000, accountId: 'cc', toAccountId: 'pp', categoryId: null }),
    tx('e', { amount: 7000, date: '2026-09-22' }),               // realizado, mas com data futura
  ];
  assert.equal(D.accountBalance(cc, txs, { upTo: TODAY }), 100000 + 500000 - 20000 - 50000);
  assert.equal(D.accountBalance(poup, txs, { upTo: TODAY }), 50000);
  assert.equal(D.accountBalance(cc, txs, { includePending: true }), 100000 + 500000 - 20000 - 30000 - 50000 - 7000);
  const ov = D.accountsOverview([cc, poup], txs, TODAY);
  assert.equal(ov.netWorth, 530000 + 50000);
});
test('resultado do mês ignora transferências e separa previstos', () => {
  const txs = [tx('a', { type: 'income', amount: 300000 }), tx('b', { amount: 100000 }), tx('c', { amount: 40000, status: 'pending' }), tx('t', { type: 'transfer', amount: 999, toAccountId: 'x' }), tx('o', { amount: 5, date: '2026-10-01' })];
  assert.deepEqual(D.monthTotals(txs, '2026-09'), { income: 300000, expense: 100000, result: 200000 });
  assert.equal(D.monthTotals(txs, '2026-09', { includePending: true }).expense, 140000);
});
test('categorias: soma no pai e caminho', () => {
  const idx = D.categoryIndex(cats);
  const txs = [tx('a', { categoryId: 'cat_moradia_energia', amount: 20000 }), tx('b', { categoryId: 'cat_moradia_condominio', amount: 50000 }), tx('c', { categoryId: 'cat_lazer', amount: 1000 }), tx('d', { categoryId: 'inexistente', amount: 300 })];
  const r = D.byCategory(txs, cats);
  assert.deepEqual(r.map((x) => [x.categoryId, x.amount]), [['cat_moradia', 70000], ['cat_lazer', 1000], ['none', 300]]);
  assert.equal(D.categoryPath('cat_moradia_energia', idx), 'Moradia › Energia'); assert.equal(D.categoryPath('x', idx), 'Sem categoria');
  assert.equal(D.byCategory(txs, cats, { level: 'leaf' })[0].categoryId, 'cat_moradia_condominio');
});

const rec = (o) => ({ id: 'r1', description: 'Aluguel', amount: 145000, type: 'expense', accountId: 'cc', categoryId: 'cat_moradia', freq: 'monthly', day: 5, startMonth: '2026-01', endMonth: null, active: true, ...o });
test('recorrências: mensal, dia 31, anual, semanal, início e fim', () => {
  assert.deepEqual(D.occurrenceDates(rec({}), '2026-09'), ['2026-09-05']);
  assert.deepEqual(D.occurrenceDates(rec({ day: 31 }), '2026-02'), ['2026-02-28']);
  assert.deepEqual(D.occurrenceDates(rec({}), '2025-12'), []); assert.deepEqual(D.occurrenceDates(rec({ endMonth: '2026-06' }), '2026-09'), []);
  assert.deepEqual(D.occurrenceDates(rec({ active: false }), '2026-09'), []);
  const y = rec({ freq: 'yearly', startMonth: '2026-03', day: 10 });
  assert.deepEqual(['2026-03', '2026-09', '2027-03'].map((k) => D.occurrenceDates(y, k).length), [1, 0, 1]);
  const w = rec({ freq: 'weekly', day: 1 });                   // toda segunda-feira
  assert.deepEqual(D.occurrenceDates(w, '2026-09'), ['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
});
test('agenda: vencimentos, atraso, efetivados e previstos avulsos', () => {
  const recs = [rec({ id: 'r1', day: 5 }), rec({ id: 'r2', description: 'Internet', day: 22 }), rec({ id: 'r3', description: 'Salário', type: 'income', amount: 500000, day: 28 })];
  const txs = [tx('p1', { recurrenceId: 'r1', recurrenceDate: '2026-09-05', description: 'Aluguel', amount: 145000 }), tx('p2', { status: 'pending', amount: 9000, date: '2026-09-12', description: 'IPTU' }), tx('normal', { amount: 1 })];
  const ag = D.agendaOfMonth({ recurrences: recs, txs, key: '2026-09', today: TODAY });
  assert.deepEqual(ag.map((i) => [i.description, i.status]), [['Aluguel', 'paid'], ['IPTU', 'late'], ['Internet', 'pending'], ['Salário', 'pending']]);
  const s = D.agendaSummary(ag);
  assert.equal(s.payable, 9000 + 145000); assert.equal(s.receivable, 500000); assert.equal(s.lateCount, 1); assert.equal(s.late, 9000);
  const acs = [acc('cc', { initialBalance: 1000000 })];
  const f = D.monthEndForecast({ accounts: acs, txs, recurrences: recs, today: TODAY });
  assert.equal(f.assets, 1000000 - 145000 - 1);
  assert.equal(f.receivable, 500000); assert.equal(f.payable, 154000);
  const up = D.upcoming({ recurrences: recs, txs: [...txs, tx('velho', { status: 'pending', date: '2026-05-01', amount: 100, description: 'Velho' })], today: TODAY, limit: 3 });
  assert.equal(up[0].description, 'Velho'); assert.ok(up.every((i) => i.status !== 'paid'));
  assert.equal(up[0].status, 'late');
});

const card = acc('card', { type: 'credit', limit: 500000, closingDay: 10, dueDay: 17 });
test('cartão: a qual fatura pertence a compra, datas e vencimento no mês seguinte', () => {
  assert.equal(D.invoiceMonthOf('2026-09-10', 10), '2026-09'); assert.equal(D.invoiceMonthOf('2026-09-11', 10), '2026-10');
  assert.equal(D.invoiceMonthOf('2026-12-20', 10), '2027-01');
  assert.deepEqual(D.invoiceDates(card, '2026-09'), { closeDate: '2026-09-10', dueDate: '2026-09-17' });
  assert.deepEqual(D.invoiceDates(acc('c2', { type: 'credit', closingDay: 25, dueDay: 5 }), '2026-09'), { closeDate: '2026-09-25', dueDate: '2026-10-05' });
});
test('fatura: total, pagamento parcial, situação e limite', () => {
  const txs = [
    tx('c1', { accountId: 'card', amount: 30000, date: '2026-09-02' }), tx('c2', { accountId: 'card', amount: 20000, date: '2026-09-10' }),
    tx('c3', { accountId: 'card', amount: 99900, date: '2026-09-11' }),               // vai para outubro
    tx('r', { accountId: 'card', type: 'income', amount: 5000, date: '2026-09-05' }),  // estorno
    tx('pay', { type: 'transfer', accountId: 'cc', toAccountId: 'card', amount: 20000, invoiceMonth: '2026-09', categoryId: null, date: '2026-09-15' }),
  ];
  const inv = D.cardInvoice(card, txs, '2026-09', TODAY);
  assert.equal(inv.total, 30000 + 20000 - 5000); assert.equal(inv.paid, 20000); assert.equal(inv.remaining, 25000); assert.equal(inv.items.length, 3);
  assert.equal(inv.status, 'late');                                                  // vencia dia 17; hoje é 19
  assert.equal(D.cardInvoice(card, txs, '2026-09', '2026-09-16').status, 'closed');
  assert.equal(D.cardInvoice(card, txs, '2026-09', '2026-09-19').status, 'late');
  assert.equal(D.cardInvoice(card, txs, '2026-10', TODAY).total, 99900); assert.equal(D.cardInvoice(card, txs, '2026-08', TODAY).status, 'empty');
  const paidAll = [...txs, tx('pay2', { type: 'transfer', accountId: 'cc', toAccountId: 'card', amount: 25000, invoiceMonth: '2026-09', categoryId: null })];
  assert.equal(D.cardInvoice(card, paidAll, '2026-09', TODAY).status, 'paid');
  assert.equal(D.cardUsed(card, txs), 30000 + 20000 + 99900 - 5000 - 20000); assert.equal(D.cardAvailable(card, txs), 500000 - 124900);
});
test('orçamento: pai soma filhos, previstos contam, níveis', () => {
  const txs = [tx('a', { categoryId: 'cat_moradia_energia', amount: 40000 }), tx('b', { categoryId: 'cat_moradia_gas', amount: 40000, status: 'pending' }), tx('c', { categoryId: 'cat_lazer', amount: 85000 }), tx('d', { categoryId: 'cat_saude', amount: 1000 })];
  const rows = D.budgetRows({ budgets: [{ id: 'cat_moradia', categoryId: 'cat_moradia', amount: 150000 }, { id: 'cat_lazer', categoryId: 'cat_lazer', amount: 100000 }, { id: 'cat_saude', categoryId: 'cat_saude', amount: 500 }, { id: 'apagada', categoryId: 'apagada', amount: 1 }], txs, categories: cats, key: '2026-09' });
  assert.deepEqual(rows.map((r) => [r.category.id, r.spent, r.level]), [['cat_saude', 1000, 'over'], ['cat_lazer', 85000, 'high'], ['cat_moradia', 80000, 'ok']]);
});
test('relatórios: fluxo de caixa, patrimônio e tabela mensal', () => {
  const a1 = acc('cc', { initialBalance: 100000 });
  const txs = [tx('i8', { type: 'income', amount: 500000, date: '2026-08-05' }), tx('e8', { amount: 100000, date: '2026-08-10', categoryId: 'cat_moradia_energia' }), tx('e9', { amount: 30000, categoryId: 'cat_moradia_energia' }), tx('e9b', { amount: 5000, categoryId: 'cat_lazer' })];
  const cf = D.cashflowSeries(txs, '2026-09', 3);
  assert.deepEqual(cf.map((m) => [m.key, m.income, m.expense]), [['2026-07', 0, 0], ['2026-08', 500000, 100000], ['2026-09', 0, 35000]]);
  const nw = D.netWorthSeries([a1], txs, '2026-09', 3);
  assert.deepEqual(nw.map((m) => m.netWorth), [100000, 500000, 465000]);
  const tb = D.categoryMonthTable(txs, cats, ['2026-08', '2026-09']);
  assert.deepEqual(tb.rows.map((r) => [r.name, r.depth, r.values]), [['Moradia', 0, [100000, 30000]], ['Energia', 1, [100000, 30000]], ['Lazer', 0, [0, 5000]]]);
  assert.deepEqual(tb.totals, [100000, 35000]); assert.equal(tb.total, 135000);
});
test('alertas do painel', () => {
  const recs = [rec({ id: 'r1', day: 5 })];
  const cardTx = [tx('c1', { accountId: 'card', amount: 30000, date: '2026-09-02' })];
  const al = D.buildAlerts({ accounts: [acc('cc'), card], txs: cardTx, recurrences: recs, budgets: [{ id: 'cat_lazer', categoryId: 'cat_lazer', amount: 1 }], categories: cats, today: '2026-09-15' });
  assert.ok(al.some((a) => a.id === 'late') && al.some((a) => a.id.startsWith('inv:card')));
});
