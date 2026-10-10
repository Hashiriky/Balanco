import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PRESETS, PRESETS, clickDay, daysIn, datesText, inRange, monthGrid, orderRange, periodLabel, presetOf, presetRange } from '../src/lib/period.js';

const today = '2026-10-09'; // sexta-feira

test('atalhos de período a partir de "hoje"', () => {
  const r = (id) => presetRange(id, today);
  assert.deepEqual(r('today'), { from: '2026-10-09', to: '2026-10-09' });
  assert.deepEqual(r('yesterday'), { from: '2026-10-08', to: '2026-10-08' });
  assert.deepEqual(r('week'), { from: '2026-10-04', to: '2026-10-10' }); // domingo a sábado
  assert.deepEqual(r('lastWeek'), { from: '2026-09-27', to: '2026-10-03' });
  assert.deepEqual(r('d7'), { from: '2026-10-03', to: '2026-10-09' });
  assert.deepEqual(r('d30'), { from: '2026-09-10', to: '2026-10-09' });
  assert.deepEqual(r('month'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(r('lastMonth'), { from: '2026-09-01', to: '2026-09-30' });
  assert.deepEqual(r('m3'), { from: '2026-08-01', to: '2026-10-31' });
  assert.deepEqual(r('m12'), { from: '2025-11-01', to: '2026-10-31' });
  assert.deepEqual(r('year'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(r('lastYear'), { from: '2025-01-01', to: '2025-12-31' });
  assert.deepEqual(r('all'), { from: null, to: null });
});

test('atalhos funcionam na virada de ano e em fevereiro bissexto', () => {
  assert.deepEqual(presetRange('lastMonth', '2026-01-15'), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(presetRange('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(presetRange('week', '2026-01-01'), { from: '2025-12-28', to: '2026-01-03' });
});

test('todo atalho tem nome e gera período válido', () => {
  ALL_PRESETS.forEach((id) => { assert.ok(PRESETS[id]); const r = presetRange(id, today); if (r.from) assert.ok(r.from <= r.to); });
});

test('rótulo: usa o nome do atalho quando bate; senão mostra as datas', () => {
  assert.equal(presetOf({ from: '2026-09-01', to: '2026-09-30' }, today), 'lastMonth');
  assert.equal(periodLabel({ from: '2026-09-01', to: '2026-09-30' }, today), 'Mês passado');
  assert.equal(periodLabel({ from: '2026-09-03', to: '2026-09-20' }, today), '03/09/2026 a 20/09/2026');
  assert.equal(periodLabel({ from: null, to: null }, today), 'Todo o período');
  assert.equal(datesText({ from: '2026-10-05', to: '2026-10-05' }), '05/10/2026');
  assert.equal(datesText({ from: '2026-10-05', to: null }), 'A partir de 05/10/2026');
  assert.equal(datesText({ from: null, to: '2026-10-05' }), 'Até 05/10/2026');
  assert.equal(presetOf({ from: '2026-09-01', to: '2026-09-30' }, today, ['today', 'month']), ''); // só considera os atalhos oferecidos
});

test('calendário: 42 células, começando no domingo, com dias vizinhos marcados', () => {
  const g = monthGrid(2026, 9); // outubro de 2026 (1º é quinta-feira)
  assert.equal(g.length, 42);
  assert.equal(g[0].iso, '2026-09-27'); assert.equal(g[0].inMonth, false);
  assert.equal(g[4].iso, '2026-10-01'); assert.equal(g[4].inMonth, true);
  assert.equal(g.filter((c) => c.inMonth).length, 31);
  assert.equal(monthGrid(2026, 1)[0].iso, '2026-02-01'); // fevereiro/2026 começa num domingo
});

test('intervalo: 1º clique é o início, 2º é o fim, antes do início inverte, 3º recomeça', () => {
  let d = { from: null, to: null };
  d = clickDay(d, '2026-10-05'); assert.deepEqual(d, { from: '2026-10-05', to: null });
  assert.deepEqual(clickDay(d, '2026-10-09'), { from: '2026-10-05', to: '2026-10-09' });
  assert.deepEqual(clickDay(d, '2026-10-01'), { from: '2026-10-01', to: '2026-10-05' });
  assert.deepEqual(clickDay(d, '2026-10-05'), { from: '2026-10-05', to: '2026-10-05' });
  assert.deepEqual(clickDay({ from: '2026-10-01', to: '2026-10-09' }, '2026-10-20'), { from: '2026-10-20', to: null });
});

test('dias do período e ordenação', () => {
  assert.equal(daysIn({ from: '2026-10-01', to: '2026-10-31' }), 31);
  assert.equal(daysIn({ from: '2026-10-09', to: '2026-10-09' }), 1);
  assert.equal(daysIn({ from: null, to: null }), null);
  assert.equal(inRange('2026-10-05', '2026-10-01', '2026-10-09'), true);
  assert.equal(inRange('2026-10-10', '2026-10-01', '2026-10-09'), false);
  assert.deepEqual(orderRange({ from: '2026-10-09', to: '2026-10-01' }), { from: '2026-10-01', to: '2026-10-09' });
});
