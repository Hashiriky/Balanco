// Períodos de data: atalhos ("Mês passado"), rótulos e a grade do calendário. Tudo com datas ISO (AAAA-MM-DD),
// sem depender de tela, por isso é testado em test/period.test.mjs.
import { addDaysISO, fmtDate, isoDate, lastDayOfMonth, shiftMonth } from './util.js';

/** período = { from, to } com datas ISO; { from: null, to: null } significa "todo o período" */
export const PRESETS = {
  today: 'Hoje', yesterday: 'Ontem', week: 'Esta semana', lastWeek: 'Semana passada', d7: 'Últimos 7 dias', d30: 'Últimos 30 dias',
  month: 'Mês atual', lastMonth: 'Mês passado', m3: 'Últimos 3 meses', m6: 'Últimos 6 meses', m12: 'Últimos 12 meses',
  year: 'Este ano', lastYear: 'Ano passado', all: 'Todo o período',
};
export const ALL_PRESETS = Object.keys(PRESETS);
export const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']; // a semana começa no domingo

const toDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const monthOf = (iso) => iso.slice(0, 7);

/** datas de cada atalho, a partir de "hoje" */
export function presetRange(id, today) {
  const key = monthOf(today), y = Number(today.slice(0, 4));
  const weekStart = addDaysISO(today, -toDate(today).getDay());
  switch (id) {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = addDaysISO(today, -1); return { from: d, to: d }; }
    case 'week': return { from: weekStart, to: addDaysISO(weekStart, 6) };
    case 'lastWeek': { const s = addDaysISO(weekStart, -7); return { from: s, to: addDaysISO(s, 6) }; }
    case 'd7': return { from: addDaysISO(today, -6), to: today };
    case 'd30': return { from: addDaysISO(today, -29), to: today };
    case 'month': return { from: `${key}-01`, to: lastDayOfMonth(key) };
    case 'lastMonth': { const k = shiftMonth(key, -1); return { from: `${k}-01`, to: lastDayOfMonth(k) }; }
    case 'm3': return { from: `${shiftMonth(key, -2)}-01`, to: lastDayOfMonth(key) };
    case 'm6': return { from: `${shiftMonth(key, -5)}-01`, to: lastDayOfMonth(key) };
    case 'm12': return { from: `${shiftMonth(key, -11)}-01`, to: lastDayOfMonth(key) };
    case 'year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'lastYear': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: null, to: null };
  }
}

export const sameRange = (a, b) => (a.from || null) === (b.from || null) && (a.to || null) === (b.to || null);

/** qual atalho corresponde exatamente a este período (ou '' se for um período próprio) */
export function presetOf(range, today, ids = ALL_PRESETS) {
  return ids.find((id) => sameRange(presetRange(id, today), range)) || '';
}

/** só as datas: "01/09/2026 a 30/09/2026", "05/10/2026", "A partir de …", "Até …" ou "Todo o período" */
export function datesText(range) {
  const { from, to } = range;
  if (!from && !to) return 'Todo o período';
  if (from && to) return from === to ? fmtDate(from) : `${fmtDate(from)} a ${fmtDate(to)}`;
  return from ? `A partir de ${fmtDate(from)}` : `Até ${fmtDate(to)}`;
}

/** nome do atalho, quando houver; senão as datas */
export function periodLabel(range, today, ids = ALL_PRESETS) {
  const id = presetOf(range, today, ids);
  return id ? PRESETS[id] : datesText(range);
}

/** quantos dias tem o período (null se for aberto) */
export function daysIn(range) {
  if (!range.from || !range.to) return null;
  return Math.round((toDate(range.to) - toDate(range.from)) / 86400000) + 1;
}

/** 42 células (6 semanas) do mês exibido; month é 0–11. Dias de outros meses vêm com inMonth = false */
export function monthGrid(year, month) {
  const offset = new Date(year, month, 1).getDay();
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { iso: isoDate(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

export const inRange = (iso, from, to) => !!from && !!to && iso >= from && iso <= to;

/** clique num dia: o 1º define o início; o 2º define o fim (se for antes do início, os dois se invertem) */
export function clickDay(draft, iso) {
  if (!draft.from || draft.to) return { from: iso, to: null };
  return iso >= draft.from ? { from: draft.from, to: iso } : { from: iso, to: draft.from };
}

/** garante from <= to */
export const orderRange = ({ from, to }) => (from && to && from > to ? { from: to, to: from } : { from, to });
