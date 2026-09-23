// Regras financeiras: saldos, agenda (contas a pagar/receber), cartão de crédito, orçamento e relatórios.
// Funções puras — todo valor em CENTAVOS inteiros. Fáceis de testar.
import {
  addDaysISO, dateInMonth, daysInMonth, diffDays, lastDayOfMonth, monthDiff, monthKey, parseISO, shiftMonth, sum, todayISO, isoDate,
} from './util.js';

export const isCredit = (a) => a.type === 'credit';
export const isPaid = (t) => t.status !== 'pending';

/* ---------- Saldos ---------- */
/** efeito (em centavos, com sinal) de um lançamento sobre uma conta */
export function effectOn(t, accountId) {
  if (t.type === 'transfer') return (t.accountId === accountId ? -t.amount : 0) + (t.toAccountId === accountId ? t.amount : 0);
  if (t.accountId !== accountId) return 0;
  return t.type === 'income' ? t.amount : -t.amount;
}
/** saldo = saldo inicial + lançamentos (só realizados, a menos que includePending) até a data "upTo" */
export function accountBalance(account, txs, { upTo = null, includePending = false } = {}) {
  let bal = account.initialBalance || 0;
  for (const t of txs) {
    if (!includePending && !isPaid(t)) continue;
    if (upTo && t.date > upTo) continue;
    bal += effectOn(t, account.id);
  }
  return bal;
}
/** linhas por conta + totais. Patrimônio = soma de tudo (dívidas de cartão entram negativas). */
export function accountsOverview(accounts, txs, today = todayISO()) {
  const key = today.slice(0, 7);
  const rows = accounts.filter((a) => !a.archived).map((account) => ({
    account,
    current: accountBalance(account, txs, { upTo: today }),
    forecast: accountBalance(account, txs, { upTo: lastDayOfMonth(key), includePending: true }),
  }));
  const assets = sum(rows.filter((r) => !isCredit(r.account)), (r) => r.current);
  const cards = sum(rows.filter((r) => isCredit(r.account)), (r) => r.current);
  return { rows, assets, cards, netWorth: assets + cards };
}

/* ---------- Resultado do período ---------- */
export const inMonth = (t, key) => t.date.startsWith(key);
/** receitas e despesas do mês (transferências ficam de fora). includePending soma também os previstos. */
export function monthTotals(txs, key, { includePending = false } = {}) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (!inMonth(t, key) || t.type === 'transfer') continue;
    if (!includePending && !isPaid(t)) continue;
    if (t.type === 'income') income += t.amount; else expense += t.amount;
  }
  return { income, expense, result: income - expense };
}

/* ---------- Categorias ---------- */
export const categoryIndex = (categories) => new Map(categories.map((c) => [c.id, c]));
export const rootOf = (id, idx) => { let c = idx.get(id), guard = 0; while (c && c.parentId && idx.get(c.parentId) && guard < 5) { c = idx.get(c.parentId); guard += 1; } return c || null; };
export const categoryPath = (id, idx) => { const c = idx.get(id); if (!c) return 'Sem categoria'; const p = c.parentId ? idx.get(c.parentId) : null; return p ? `${p.name} › ${c.name}` : c.name; };
export const categoryName = (id, idx) => idx.get(id)?.name || 'Sem categoria';
/** soma por categoria (no nível do "pai" por padrão), do maior para o menor */
export function byCategory(txs, categories, { type = 'expense', level = 'root', includePending = true } = {}) {
  const idx = categoryIndex(categories), map = new Map();
  for (const t of txs) {
    if (t.type !== type || (!includePending && !isPaid(t))) continue;
    const c = idx.get(t.categoryId);
    const id = !c ? 'none' : level === 'root' ? (rootOf(t.categoryId, idx)?.id || 'none') : c.id;
    map.set(id, (map.get(id) || 0) + t.amount);
  }
  return [...map.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
}

/* ---------- Recorrências e agenda (contas a pagar/receber) ---------- */
/** datas de vencimento de uma recorrência dentro do mês "key" */
export function occurrenceDates(rec, key) {
  if (rec.active === false) return [];
  const start = rec.startMonth || '0000-00';
  if (key < start || (rec.endMonth && key > rec.endMonth)) return [];
  if (rec.freq === 'yearly') return monthDiff(start, key) % 12 === 0 ? [dateInMonth(key, rec.day || 1)] : [];
  if (rec.freq === 'weekly') {
    const out = [];
    for (let d = 1; d <= daysInMonth(key); d += 1) { const iso = `${key}-${String(d).padStart(2, '0')}`; if (parseISO(iso).getDay() === Number(rec.day)) out.push(iso); }
    return out;
  }
  return [dateInMonth(key, rec.day || 1)];
}
const statusOf = (paid, date, today) => (paid ? 'paid' : date < today ? 'late' : 'pending');
/**
 * Agenda do mês: (1) lançamentos previstos e os ligados a recorrências; (2) vencimentos de recorrências ainda sem lançamento.
 * status: paid | pending | late
 */
export function agendaOfMonth({ recurrences = [], txs, key, today = todayISO() }) {
  const items = [];
  const linked = new Set(txs.filter((t) => t.recurrenceId && t.recurrenceDate).map((t) => `${t.recurrenceId}|${t.recurrenceDate}`));
  for (const t of txs) {
    if (!inMonth(t, key) || (isPaid(t) && !t.recurrenceId)) continue;
    items.push({ id: `tx:${t.id}`, kind: 'tx', tx: t, date: t.date, description: t.description, amount: t.amount, type: t.type, accountId: t.accountId, categoryId: t.categoryId, status: statusOf(isPaid(t), t.date, today), daysToDue: diffDays(today, t.date) });
  }
  for (const rec of recurrences) {
    for (const date of occurrenceDates(rec, key)) {
      if (linked.has(`${rec.id}|${date}`)) continue;
      items.push({ id: `rec:${rec.id}:${date}`, kind: 'occurrence', recurrence: rec, date, description: rec.description, amount: rec.amount, type: rec.type, accountId: rec.accountId, categoryId: rec.categoryId, status: statusOf(false, date, today), daysToDue: diffDays(today, date) });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'pt-BR'));
}
export function agendaSummary(items) {
  const open = items.filter((i) => i.status !== 'paid' && i.type !== 'transfer');
  return {
    payable: sum(open.filter((i) => i.type === 'expense'), (i) => i.amount), receivable: sum(open.filter((i) => i.type === 'income'), (i) => i.amount),
    late: sum(open.filter((i) => i.status === 'late' && i.type === 'expense'), (i) => i.amount), lateCount: open.filter((i) => i.status === 'late' && i.type === 'expense').length,
    paidCount: items.filter((i) => i.status === 'paid').length, count: items.length,
  };
}
/** próximos vencimentos em aberto (a partir de meses anteriores atrasados até 2 meses à frente) */
export function upcoming({ recurrences, txs, today = todayISO(), limit = 6 }) {
  const key = today.slice(0, 7), out = [], windowStart = `${shiftMonth(key, -1)}-01`;
  txs.filter((t) => !isPaid(t) && t.type !== 'transfer' && t.date < windowStart).forEach((t) => out.push({ id: `tx:${t.id}`, kind: 'tx', tx: t, date: t.date, description: t.description, amount: t.amount, type: t.type, accountId: t.accountId, categoryId: t.categoryId, status: 'late', daysToDue: diffDays(today, t.date) }));
  for (let i = -1; i <= 2; i += 1) agendaOfMonth({ recurrences, txs, key: shiftMonth(key, i), today }).filter((x) => x.status !== 'paid' && x.type !== 'transfer').forEach((x) => out.push(x));
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}
/** saldo previsto no fim do mês: saldo em contas + a receber − a pagar (vencimentos em aberto até o fim do mês) */
export function monthEndForecast({ accounts, txs, recurrences, today = todayISO() }) {
  const key = today.slice(0, 7);
  const assets = sum(accounts.filter((a) => !a.archived && !isCredit(a)), (a) => accountBalance(a, txs, { upTo: today }));
  const open = agendaOfMonth({ recurrences, txs, key, today }).filter((i) => i.status !== 'paid' && i.type !== 'transfer');
  const receivable = sum(open.filter((i) => i.type === 'income'), (i) => i.amount), payable = sum(open.filter((i) => i.type === 'expense'), (i) => i.amount);
  return { assets, receivable, payable, projected: assets + receivable - payable };
}

/* ---------- Cartão de crédito ---------- */
/** a que fatura (mês) uma compra pertence: até o fechamento → mês da compra; depois → mês seguinte */
export const invoiceMonthOf = (dateISO, closingDay) => (Number(dateISO.slice(8)) <= closingDay ? dateISO.slice(0, 7) : shiftMonth(dateISO.slice(0, 7), 1));
export function invoiceDates(card, key) {
  const closing = card.closingDay || 1, due = card.dueDay || closing;
  return { closeDate: dateInMonth(key, closing), dueDate: dateInMonth(due > closing ? key : shiftMonth(key, 1), due) };
}
export function cardInvoice(card, txs, key, today = todayISO()) {
  const { closeDate, dueDate } = invoiceDates(card, key);
  const items = txs.filter((t) => t.accountId === card.id && t.type !== 'transfer' && invoiceMonthOf(t.date, card.closingDay || 1) === key).sort((a, b) => a.date.localeCompare(b.date));
  const total = sum(items, (t) => (t.type === 'income' ? -t.amount : t.amount));
  const payments = txs.filter((t) => t.type === 'transfer' && t.toAccountId === card.id && t.invoiceMonth === key);
  const paid = sum(payments, (t) => t.amount), remaining = Math.max(total - paid, 0);
  const status = total <= 0 ? 'empty' : remaining === 0 ? 'paid' : dueDate < today ? 'late' : closeDate < today ? 'closed' : 'open';
  return { key, closeDate, dueDate, items, total, paid, remaining, status, payments };
}
/** limite usado = dívida total do cartão (saldo negativo) */
export const cardUsed = (card, txs) => Math.max(-accountBalance(card, txs, { includePending: true }), 0);
export const cardAvailable = (card, txs) => Math.max((card.limit || 0) - cardUsed(card, txs), 0);

/* ---------- Orçamento ---------- */
export function budgetRows({ budgets, txs, categories, key }) {
  const idx = categoryIndex(categories);
  const spentByRoot = new Map(byCategory(txs.filter((t) => inMonth(t, key)), categories, { type: 'expense', level: 'root', includePending: true }).map((r) => [r.categoryId, r.amount]));
  return budgets.map((b) => {
    const c = idx.get(b.categoryId);
    const spent = c && !c.parentId ? (spentByRoot.get(c.id) || 0) : sum(txs.filter((t) => inMonth(t, key) && t.type === 'expense' && t.categoryId === b.categoryId), (t) => t.amount);
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    return { budget: b, category: c, limit: b.amount, spent, left: b.amount - spent, pct, level: spent > b.amount ? 'over' : pct >= 85 ? 'high' : 'ok' };
  }).filter((r) => r.category).sort((a, b) => b.pct - a.pct);
}

/* ---------- Relatórios ---------- */
export function cashflowSeries(txs, endKey, n, { includePending = false } = {}) {
  return Array.from({ length: n }, (_, i) => { const key = shiftMonth(endKey, i - n + 1); return { key, ...monthTotals(txs, key, { includePending }) }; });
}
/** patrimônio no fim de cada mês (só realizados) */
export function netWorthSeries(accounts, txs, endKey, n) {
  const list = accounts.filter((a) => !a.archived);
  return Array.from({ length: n }, (_, i) => {
    const key = shiftMonth(endKey, i - n + 1), upTo = lastDayOfMonth(key);
    const assets = sum(list.filter((a) => !isCredit(a)), (a) => accountBalance(a, txs, { upTo })), cards = sum(list.filter(isCredit), (a) => accountBalance(a, txs, { upTo }));
    return { key, assets, cards, netWorth: assets + cards };
  });
}
/** tabela mês a mês: pais com filhos, totais por linha e por coluna */
export function categoryMonthTable(txs, categories, keys, { type = 'expense', includePending = false } = {}) {
  const idx = categoryIndex(categories), cols = keys.length, pos = new Map(keys.map((k, i) => [k, i]));
  const cells = new Map(), add = (id, i, v) => { if (!cells.has(id)) cells.set(id, Array(cols).fill(0)); cells.get(id)[i] += v; };
  for (const t of txs) {
    if (t.type !== type || (!includePending && !isPaid(t))) continue;
    const i = pos.get(t.date.slice(0, 7)); if (i === undefined) continue;
    const c = idx.get(t.categoryId);
    if (!c) { add('none', i, t.amount); continue; }
    add(c.id, i, t.amount);
    if (c.parentId) add(c.parentId, i, t.amount);
  }
  const rows = [];
  categories.filter((c) => c.type === type && !c.parentId).forEach((p) => {
    const pv = cells.get(p.id); if (!pv) return;
    rows.push({ id: p.id, name: p.name, depth: 0, values: pv, total: sum(pv) });
    categories.filter((c) => c.parentId === p.id).forEach((k) => { const kv = cells.get(k.id); if (kv) rows.push({ id: k.id, name: k.name, depth: 1, values: kv, total: sum(kv) }); });
  });
  if (cells.has('none')) rows.push({ id: 'none', name: 'Sem categoria', depth: 0, values: cells.get('none'), total: sum(cells.get('none')) });
  const totals = Array(cols).fill(0); rows.filter((r) => r.depth === 0).forEach((r) => r.values.forEach((v, i) => { totals[i] += v; }));
  return { rows, totals, total: sum(totals) };
}

/* ---------- Alertas do painel ---------- */
export function buildAlerts({ accounts, txs, recurrences, budgets, categories, today = todayISO() }) {
  const out = [], key = today.slice(0, 7);
  const ag = agendaSummary(agendaOfMonth({ recurrences, txs, key, today }));
  const prevLate = agendaSummary(agendaOfMonth({ recurrences, txs, key: shiftMonth(key, -1), today }));
  const lateCount = ag.lateCount + prevLate.lateCount, lateTotal = ag.late + prevLate.late;
  if (lateCount) out.push({ id: 'late', tone: 'danger', text: `${lateCount} conta${lateCount > 1 ? 's' : ''} a pagar em atraso`, value: lateTotal, href: '/agenda' });
  accounts.filter((a) => isCredit(a) && !a.archived).forEach((card) => {
    for (const k of [shiftMonth(key, -1), key, shiftMonth(key, 1)]) {
      const inv = cardInvoice(card, txs, k, today);
      if (inv.remaining > 0 && (inv.status === 'late' || (inv.dueDate >= today && diffDays(today, inv.dueDate) <= 7))) {
        out.push({ id: `inv:${card.id}:${k}`, tone: inv.status === 'late' ? 'danger' : 'warn', text: `Fatura ${card.name}: ${inv.status === 'late' ? 'venceu' : 'vence'} em ${inv.dueDate.split('-').reverse().join('/')}`, value: inv.remaining, href: '/contas' });
      }
    }
  });
  const over = budgetRows({ budgets, txs, categories, key }).filter((r) => r.level === 'over');
  if (over.length) out.push({ id: 'budget', tone: 'warn', text: `${over.length} orçamento${over.length > 1 ? 's' : ''} estourado${over.length > 1 ? 's' : ''} este mês`, href: '/orcamento' });
  return out;
}
export { addDaysISO, isoDate, monthKey };
