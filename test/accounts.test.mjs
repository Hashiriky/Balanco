import test from 'node:test';
import assert from 'node:assert/strict';
import { canBePrimary, defaultAccountId, groupByBank, primaryAccount } from '../src/lib/domain.js';
import { cleanAccount, APP_VERSION } from '../src/lib/storage.js';
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
