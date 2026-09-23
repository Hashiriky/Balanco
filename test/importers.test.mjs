import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../src/lib/importers.js';

test('datas de extrato', () => {
  assert.equal(I.parseDate('19/09/2026'), '2026-09-19'); assert.equal(I.parseDate('2026-09-19'), '2026-09-19'); assert.equal(I.parseDate('19/09/26'), '2026-09-19');
  assert.equal(I.parseDate('20260919120000[-3:BRT]'), '2026-09-19'); assert.equal(I.parseDate('31/02/2026'), null); assert.equal(I.parseDate('abc'), null);
});
test('valores de extrato (formatos brasileiros e internacionais)', () => {
  const p = I.parseAmount;
  assert.equal(p('1.234,56'), 123456); assert.equal(p('-45,90'), -4590); assert.equal(p('R$ 1.000,00'), 100000); assert.equal(p('-1234.56'), -123456);
  assert.equal(p('(123,45)'), -12345); assert.equal(p('123,45-'), -12345); assert.equal(p('1.234'), 123400); assert.equal(p('12.5'), 1250); assert.equal(p('1,234.56'), 123456);
  assert.equal(p('+10'), 1000); assert.equal(p(''), null); assert.equal(p('abc'), null);
});
test('CSV com ; aspas e cabeçalho: detecta colunas e mapeia', () => {
  const csv = 'Data;Descrição;Valor\r\n19/09/2026;"Mercado; do Zé";-45,90\r\n18/09/2026;Salário;5.200,00\r\nlinha;quebrada;x\r\n';
  const { rows, delimiter } = I.parseCSV(csv);
  assert.equal(delimiter, ';'); assert.equal(rows.length, 4); assert.equal(rows[1][1], 'Mercado; do Zé');
  const m = I.guessMapping(rows); assert.deepEqual([m.hasHeader, m.date, m.description, m.amount], [true, 0, 1, 2]);
  const r = I.mapCSV(rows, m);
  assert.deepEqual(r.items.map((i) => [i.date, i.description, i.amount]), [['2026-09-19', 'Mercado; do Zé', -4590], ['2026-09-18', 'Salário', 520000]]); assert.equal(r.errors, 1);
});
test('CSV com débito/crédito separados e sem cabeçalho', () => {
  const a = I.parseCSV('Data,Histórico,Débito,Crédito\n2026-09-01,Aluguel,1450.00,\n2026-09-05,Salário,,5200.00');
  const m = I.guessMapping(a.rows); assert.deepEqual([m.debit, m.credit, m.amount], [2, 3, -1]);
  assert.deepEqual(I.mapCSV(a.rows, m).items.map((i) => i.amount), [-145000, 520000]);
  const b = I.parseCSV('19/09/2026;Padaria;-12,50\n18/09/2026;Pix recebido;100,00');
  const mb = I.guessMapping(b.rows); assert.equal(mb.hasHeader, false); assert.equal(I.mapCSV(b.rows, mb).items.length, 2);
});
test('OFX (formato SGML de banco brasileiro)', () => {
  const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>\n<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>20260918120000[-3:BRT]\n<TRNAMT>-45.90\n<FITID>abc123\n<MEMO>COMPRA MERCADO ZE\n</STMTTRN>\n<STMTTRN>\n<TRNTYPE>CREDIT\n<DTPOSTED>20260905\n<TRNAMT>5200.00\n<FITID>abc124\n<NAME>SALARIO EMPRESA\n</STMTTRN>\n<STMTTRN>\n<DTPOSTED>xx\n<TRNAMT>1\n</STMTTRN>\n</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const r = I.parseOFX(ofx);
  assert.deepEqual(r.items.map((i) => [i.date, i.description, i.amount, i.externalId]), [['2026-09-18', 'COMPRA MERCADO ZE', -4590, 'abc123'], ['2026-09-05', 'SALARIO EMPRESA', 520000, 'abc124']]); assert.equal(r.errors, 1);
});
test('regras de categorização e duplicados', () => {
  const rules = [{ contains: 'mercado', categoryId: 'cat_a' }, { contains: 'mercado livre', categoryId: 'cat_b' }];
  assert.equal(I.applyRules('COMPRA Mercado Livre', rules), 'cat_b'); assert.equal(I.applyRules('Mercado do Zé', rules), 'cat_a'); assert.equal(I.applyRules('Outra', rules), null);
  const existing = [{ id: 'x', accountId: 'cc', type: 'expense', amount: 4590, date: '2026-09-18', externalId: null }, { id: 'y', accountId: 'cc', type: 'expense', amount: 1, date: '2026-01-01', externalId: 'fit9' }];
  const items = [{ date: '2026-09-18', description: 'Mercado', amount: -4590 }, { date: '2026-09-19', description: 'Padaria', amount: -1250, externalId: 'fit1' }, { date: '2026-09-19', description: 'Padaria', amount: -1250, externalId: 'fit1' }, { date: '2026-01-01', description: 'Velho', amount: -1, externalId: 'fit9' }];
  const rows = I.buildImportRows(items, { accountId: 'cc', existing, rules });
  assert.deepEqual(rows.map((r) => [r.duplicate ? 'dup' : 'ok', r.selected, r.categoryId]), [['dup', false, 'cat_a'], ['ok', true, null], ['dup', false, null], ['dup', false, null]]);
  const inv = I.buildImportRows([{ date: '2026-09-19', description: 'Compra cartão', amount: 5000 }], { accountId: 'card', existing: [], invert: true });
  assert.deepEqual([inv[0].type, inv[0].amount], ['expense', 5000]);
  const txs = I.rowsToTransactions(rows, 'cc'); assert.equal(txs.length, 1); assert.deepEqual([txs[0].type, txs[0].status, txs[0].externalId], ['expense', 'paid', 'fit1']);
});
test('decodifica Windows-1252', () => {
  const buf = new Uint8Array([0x53, 0x61, 0x6c, 0xe1, 0x72, 0x69, 0x6f]).buffer;   // "Salário" em latin1
  assert.equal(I.decodeText(buf), 'Salário');
});
