import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetRows, canBePrimary, defaultAccountId, groupByBank, primaryAccount } from '../src/lib/domain.js';
import { cleanAccount, cleanBudget, APP_VERSION } from '../src/lib/storage.js';
import { CHANGELOG, LATEST_VERSION } from '../src/lib/changelog.js';

const acc = (id, o = {}) => ({ id, name: id, type: 'checking', initialBalance: 0, archived: false, ...o });

test('conta principal: só corrente, poupança e dinheiro podem ser principais', () => {
  assert.equal(canBePrimary(acc('a')), true);
  assert.equal(canBePrimary(acc('a', { type: 'cash' })), true);
  assert.equal(canBePrimary(acc('a', { type: 'credit' })), false);
  assert.equal(canBePrimary(acc('a', { type: 'investment' })), false);
});

test('conta padrão do lançamento: a principal; sem principal, mantém o comportamento antigo', () => {
  const list = [acc('cartao', { type: 'credit' }), acc('banco'), acc('loja', { primary: true })];
  assert.equal(defaultAccountId(list), 'loja');
  assert.equal(defaultAccountId(list.map((a) => ({ ...a, primary: false }))), 'cartao'); // como antes: a primeira da lista
  assert.equal(defaultAccountId([acc('inv', { type: 'investment' }), acc('banco')]), 'banco');
  assert.equal(defaultAccountId([]), '');
});

test('conta principal arquivada ou convertida em cartão deixa de valer', () => {
  assert.equal(primaryAccount([acc('a', { primary: true, archived: true })]), null);
  assert.equal(primaryAccount([acc('a', { primary: true, type: 'credit' })]), null);
  assert.equal(primaryAccount([acc('a'), acc('b', { primary: true })]).id, 'b');
});

test('agrupar por banco: grupo da principal primeiro, "sem banco" por último', () => {
  const list = [acc('z', { bank: 'Nubank' }), acc('semBanco'), acc('b', { bank: 'Itaú' }), acc('a', { bank: 'Itaú', primary: true })];
  const g = groupByBank(list);
  assert.deepEqual(g.map((x) => x.bank), ['Itaú', 'Nubank', '']);
  assert.deepEqual(g[0].items.map((a) => a.id), ['a', 'b']); // a principal vem antes dentro do grupo
  assert.equal(groupByBank([acc('x'), acc('y')]).length, 1); // ninguém tem banco: um grupo só
});

test('limpeza da conta: banco é aparado; principal só em tipo permitido', () => {
  const c = cleanAccount({ id: '1', name: 'Loja', type: 'checking', bank: '  Nubank  ', primary: true });
  assert.equal(c.bank, 'Nubank');
  assert.equal(c.primary, true);
  const card = cleanAccount({ id: '2', name: 'Cartão', type: 'credit', limit: 100000, bank: '', primary: true });
  assert.equal('primary' in card, false);
  assert.equal('bank' in card, false);
  const old = cleanAccount({ id: '3', name: 'Antiga', type: 'cash' }); // conta de antes dos campos novos
  assert.equal('bank' in old, false);
  assert.equal('primary' in old, false);
});

test('changelog: versão atual é a primeira e tem itens', () => {
  assert.equal(APP_VERSION, LATEST_VERSION);
  assert.equal(CHANGELOG[0].version, LATEST_VERSION);
  CHANGELOG.forEach((v) => { assert.match(v.date, /^\d{4}-\d{2}-\d{2}$/); assert.ok(v.items.length > 0); v.items.forEach((i) => assert.ok(['novo', 'melhoria', 'correção'].includes(i.type))); });
});

test('cor da conta: só aceita #rrggbb; valor inválido some', () => {
  assert.equal(cleanAccount({ id: '1', name: 'A', type: 'checking', color: '#2563EB' }).color, '#2563eb');
  assert.equal('color' in cleanAccount({ id: '1', name: 'A', type: 'checking', color: 'azul' }), false);
  assert.equal('color' in cleanAccount({ id: '1', name: 'A', type: 'checking' }), false);
});

const cats = [{ id: 'c1', name: 'Mercado', type: 'expense', parentId: null, color: '#000000' }];
const spend = (date, amount) => ({ id: date + amount, type: 'expense', description: 'x', amount, date, status: 'paid', accountId: 'a', categoryId: 'c1' });
const txs = [spend('2026-08-10', 60000), spend('2026-09-10', 120000)];

test('orçamento com sobra acumulada: o que sobra soma ao limite do mês seguinte', () => {
  const b = { id: 'c1', categoryId: 'c1', amount: 100000, rollover: true, rolloverFrom: '2026-08' };
  const oct = budgetRows({ budgets: [b], txs, categories: cats, key: '2026-10' })[0];
  assert.equal(oct.carry, 20000); // ago sobra 40.000; set: 100.000 + 40.000 - 120.000 = 20.000
  assert.equal(oct.limit, 120000);
  assert.equal(oct.left, 120000);
  assert.equal(budgetRows({ budgets: [b], txs, categories: cats, key: '2026-08' })[0].carry, 0); // mês de início: sem sobra anterior
  assert.equal(budgetRows({ budgets: [b], txs, categories: cats, key: '2026-09' })[0].limit, 140000);
});

test('orçamento sem sobra acumulada continua igual a antes', () => {
  const r = budgetRows({ budgets: [{ id: 'c1', categoryId: 'c1', amount: 100000 }], txs, categories: cats, key: '2026-09' })[0];
  assert.equal(r.carry, 0); assert.equal(r.limit, 100000); assert.equal(r.spent, 120000); assert.equal(r.level, 'over');
});

test('limpeza do orçamento: sobra acumulada só com mês de início válido', () => {
  assert.deepEqual(cleanBudget({ categoryId: 'c1', amount: 5000, rollover: true, rolloverFrom: '2026-08' }), { id: 'c1', categoryId: 'c1', amount: 5000, rollover: true, rolloverFrom: '2026-08' });
  assert.deepEqual(cleanBudget({ categoryId: 'c1', amount: 5000, rollover: true }), { id: 'c1', categoryId: 'c1', amount: 5000 });
  assert.equal(cleanBudget({ categoryId: 'c1', amount: 0 }), null);
});
