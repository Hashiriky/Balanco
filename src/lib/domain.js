// Regras financeiras: saldos, agenda (contas a pagar/receber), cartão de crédito, orçamento e relatórios.
// Funções puras — todo valor em CENTAVOS inteiros. Fáceis de testar.
import {
  addDaysISO, dateInMonth, daysInMonth, diffDays, lastDayOfMonth, monthDiff, monthKey, norm, parseISO, shiftMonth, sum, todayISO, isoDate,
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
  const invested = sum(rows.filter((r) => r.account.type === 'investment'), (r) => r.current);
  const liquid = sum(rows.filter((r) => !isCredit(r.account) && r.account.type !== 'investment'), (r) => r.current);
  const assets = liquid + invested;
  const cards = sum(rows.filter((r) => isCredit(r.account)), (r) => r.current);
  return { rows, assets, liquid, invested, cards, netWorth: assets + cards };
}

/* ---------- Investimentos ---------- */
const YIELD_CHECK_DAYS = 30;   // depois de quantos dias sem atualizar o Painel avisa
const yieldTxsOf = (account, txs, upTo) => txs.filter((t) => t.accountId === account.id && t.isYield && isPaid(t) && (!upTo || t.date <= upTo));
const yieldDelta = (t) => (t.type === 'income' ? t.amount : -t.amount);
/** saldo, total investido (principal) e rendimento acumulado (R$ e %) de UMA conta de investimento */
export function accountYield(account, txs, today = todayISO()) {
  const balance = accountBalance(account, txs, { upTo: today, includePending: false });
  const yTxs = yieldTxsOf(account, txs, today);
  const totalYield = sum(yTxs, yieldDelta);
  const principal = balance - totalYield;
  const pct = principal > 0 ? (totalYield / principal) * 100 : null;
  const lastUpdate = yTxs.reduce((max, t) => (!max || t.date > max ? t.date : max), null);
  return { balance, totalYield, principal, pct, lastUpdate };
}
/** lista de atualizações de rendimento, mais recente primeiro, com o % acumulado até cada data */
export function accountYieldHistory(account, txs) {
  let cum = 0;
  return [...yieldTxsOf(account, txs)]
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
    .map((t) => {
      const delta = yieldDelta(t); cum += delta;
      const balAt = accountBalance(account, txs, { upTo: t.date, includePending: false });
      const principalAt = balAt - cum;
      return { id: t.id, date: t.date, delta, cum, pct: principalAt > 0 ? (cum / principalAt) * 100 : null };
    })
    .reverse();
}
/** rendimento acumulado no fim de cada um dos últimos N meses (pro gráfico de evolução) */
export function accountYieldSeries(account, txs, endKey, n) {
  return Array.from({ length: n }, (_, i) => { const key = shiftMonth(endKey, i - n + 1); return { key, value: sum(yieldTxsOf(account, txs).filter((t) => t.date <= lastDayOfMonth(key)), yieldDelta) }; });
}
/** média diária e mensal de rendimento, desde a primeira atualização registrada */
export function accountYieldRate(account, txs, today = todayISO()) {
  const yTxs = yieldTxsOf(account, txs, today);
  if (!yTxs.length) return null;
  const since = yTxs.reduce((min, t) => (!min || t.date < min ? t.date : min), null);
  const days = Math.max(1, diffDays(since, today));
  const daily = sum(yTxs, yieldDelta) / days;
  return { daily, monthly: daily * 30, since, days };
}
/** o mesmo, somado entre TODAS as contas de investimento (pro Painel) */
export function investmentsOverview(accounts, txs, today = todayISO()) {
  const rows = accounts.filter((a) => !a.archived && a.type === 'investment').map((account) => ({ account, ...accountYield(account, txs, today) }));
  const balance = sum(rows, (r) => r.balance), totalYield = sum(rows, (r) => r.totalYield), principal = sum(rows, (r) => r.principal);
  return { rows, balance, totalYield, principal, pct: principal > 0 ? (totalYield / principal) * 100 : null };
}

/* ---------- Resultado do período ---------- */
export const inMonth = (t, key) => t.date.startsWith(key);
/** receitas e despesas do mês (transferências ficam de fora). includePending soma também os previstos. */
export function monthTotals(txs, key, { includePending = false } = {}) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (t.isYield || !inMonth(t, key) || t.type === 'transfer') continue;
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
    if (t.isYield || t.type !== type || (!includePending && !isPaid(t))) continue;
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
/**
 * Próximos vencimentos para o Painel: no máximo UM item por recorrência (o vencimento mais
 * próximo ainda não resolvido — atrasado ou futuro), mais os lançamentos previstos avulsos.
 * Ordenados por urgência: os mais atrasados primeiro, depois os que vencem mais cedo.
 */
export function upcoming({ recurrences, txs, today = todayISO(), limit = 6 }) {
  const key = today.slice(0, 7), out = [];
  txs.filter((t) => !isPaid(t) && t.type !== 'transfer' && !t.recurrenceId)
    .forEach((t) => out.push({ id: `tx:${t.id}`, kind: 'tx', tx: t, date: t.date, description: t.description, amount: t.amount, type: t.type, accountId: t.accountId, categoryId: t.categoryId, status: t.date < today ? 'late' : t.date === today ? 'pending' : 'pending', daysToDue: diffDays(today, t.date) }));
  recurrences.filter((r) => r.active !== false).forEach((rec) => {
    for (let i = -3; i <= 12; i += 1) {
      const k = shiftMonth(key, i);
      const dates = occurrenceDates(rec, k);
      const open = dates.filter((date) => !txs.some((t) => t.recurrenceId === rec.id && t.recurrenceDate === date && isPaid(t)));
      if (!open.length) continue;
      open.forEach((date) => out.push({ id: `rec:${rec.id}:${date}`, kind: 'occurrence', recurrence: rec, date, description: rec.description, amount: rec.amount, type: rec.type, accountId: rec.accountId, categoryId: rec.categoryId, status: statusOf(false, date, today), daysToDue: diffDays(today, date) }));
      break;   // só o próximo vencimento em aberto desta recorrência — os seguintes ainda não importam
    }
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description, 'pt-BR')).slice(0, limit);
}
/** saldo previsto no fim do mês: saldo em contas + a receber − a pagar (vencimentos em aberto até o fim do mês) */
export function monthEndForecast({ accounts, txs, recurrences, today = todayISO() }) {
  const key = today.slice(0, 7);
  const assets = sum(accounts.filter((a) => !a.archived && !isCredit(a) && a.type !== 'investment'), (a) => accountBalance(a, txs, { upTo: today }));
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
/** dívida que o cartão já tinha ao ser cadastrado (saldo inicial negativo) */
export const cardOpeningDebt = (card) => Math.max(-(card.initialBalance || 0), 0);
/** em qual fatura (mês) essa dívida inicial cai: a escolhida no cadastro; sem escolha, a fatura vigente hoje */
export const openingInvoiceKey = (card, today = todayISO()) => card.initialInvoice || invoiceMonthOf(today, card.closingDay || 1);
export function cardInvoice(card, txs, key, today = todayISO()) {
  const { closeDate, dueDate } = invoiceDates(card, key);
  const items = txs.filter((t) => t.accountId === card.id && t.type !== 'transfer' && invoiceMonthOf(t.date, card.closingDay || 1) === key).sort((a, b) => a.date.localeCompare(b.date));
  const opening = key === openingInvoiceKey(card, today) ? cardOpeningDebt(card) : 0;
  const total = opening + sum(items, (t) => (t.type === 'income' ? -t.amount : t.amount));
  const payments = txs.filter((t) => t.type === 'transfer' && t.toAccountId === card.id && t.invoiceMonth === key);
  const paid = sum(payments, (t) => t.amount), remaining = Math.max(total - paid, 0);
  const status = total <= 0 ? 'empty' : remaining === 0 ? 'paid' : dueDate < today ? 'late' : closeDate < today ? 'closed' : 'open';
  return { key, closeDate, dueDate, items, opening, total, paid, remaining, status, payments };
}
/** limite usado = dívida total do cartão (saldo negativo) */
export const cardUsed = (card, txs) => Math.max(-accountBalance(card, txs, { includePending: true }), 0);
export const cardAvailable = (card, txs) => Math.max((card.limit || 0) - cardUsed(card, txs), 0);

/* ---------- Orçamento ---------- */
export function budgetRows({ budgets, txs, categories, key }) {
  const idx = categoryIndex(categories);
  const rootCache = new Map(); // gasto por grupo de categoria, por mês (evita recalcular)
  const rootSpent = (k) => { if (!rootCache.has(k)) rootCache.set(k, new Map(byCategory(txs.filter((t) => inMonth(t, k)), categories, { type: 'expense', level: 'root', includePending: true }).map((r) => [r.categoryId, r.amount]))); return rootCache.get(k); };
  const spentIn = (b, c, k) => (c && !c.parentId ? (rootSpent(k).get(c.id) || 0) : sum(txs.filter((t) => inMonth(t, k) && t.type === 'expense' && t.categoryId === b.categoryId), (t) => t.amount));
  /* sobra acumulada: o que não foi gasto em cada mês (desde rolloverFrom) soma ao limite do mês seguinte */
  const carryFor = (b, c) => {
    if (!b.rollover || !b.rolloverFrom || b.rolloverFrom >= key) return 0;
    let carry = 0, k = b.rolloverFrom, guard = 0;
    while (k < key && guard++ < 36) { carry = Math.max(0, b.amount + carry - spentIn(b, c, k)); k = shiftMonth(k, 1); }
    return carry;
  };
  return budgets.map((b) => {
    const c = idx.get(b.categoryId);
    const spent = spentIn(b, c, key), carry = carryFor(b, c), limit = b.amount + carry;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return { budget: b, category: c, base: b.amount, carry, limit, spent, left: limit - spent, pct, level: spent > limit ? 'over' : pct >= 85 ? 'high' : 'ok' };
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
    if (t.isYield || t.type !== type || (!includePending && !isPaid(t))) continue;
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
      const fmt = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
      if (inv.remaining > 0 && (inv.status === 'late' || (inv.dueDate >= today && diffDays(today, inv.dueDate) <= 7))) {
        out.push({ id: `inv:${card.id}:${k}`, tone: inv.status === 'late' ? 'danger' : 'warn', text: `Fatura ${card.name}: ${inv.status === 'late' ? 'venceu' : 'vence'} em ${inv.dueDate.split('-').reverse().join('/')}`, value: inv.remaining, href: '/contas' });
      } else if (inv.remaining > 0 && inv.closeDate <= today && inv.dueDate >= today) {
        out.push({ id: `inv:${card.id}:${k}`, tone: 'warn', text: `Fatura ${card.name} ${inv.closeDate === today ? 'fecha hoje' : `fechou em ${fmt(inv.closeDate)}`} · vence em ${fmt(inv.dueDate)}`, value: inv.remaining, href: '/contas' });
      }
    }
  });
  const over = budgetRows({ budgets, txs, categories, key }).filter((r) => r.level === 'over');
  if (over.length) out.push({ id: 'budget', tone: 'warn', text: `${over.length} orçamento${over.length > 1 ? 's' : ''} estourado${over.length > 1 ? 's' : ''} este mês`, href: '/orcamento' });
  unusualSpending({ txs, categories, today }).slice(0, 2).forEach((u) => out.push({ id: `unusual:${u.categoryId}`, tone: 'warn', text: `Gasto com ${u.name} está ${u.pct}% acima da média dos últimos 3 meses`, value: u.amount, href: '/relatorios' }));
  accounts.filter((a) => a.type === 'investment' && !a.archived).forEach((a) => {
    const y = accountYield(a, txs, today);
    if (y.balance <= 0) return;
    const days = y.lastUpdate ? diffDays(y.lastUpdate, today) : null;
    if (days === null) out.push({ id: `yield:${a.id}`, tone: 'warn', text: `Ainda não registrou nenhum rendimento em ${a.name}`, href: '/carteira' });
    else if (days >= YIELD_CHECK_DAYS) out.push({ id: `yield:${a.id}`, tone: 'warn', text: `Faz ${days} dias que você não confere o rendimento de ${a.name}`, href: '/carteira' });
  });
  return out;
}
/* ---------- Conta principal e bancos ---------- */
/** só conta corrente, poupança ou dinheiro pode ser a principal (cartão e investimento, não) */
export const canBePrimary = (a) => a.type === 'checking' || a.type === 'savings' || a.type === 'cash';
export const primaryAccount = (accounts) => accounts.find((a) => a.primary && !a.archived && canBePrimary(a)) || null;
/** conta que já vem escolhida num lançamento novo: a principal; sem principal, a primeira que não seja investimento */
export const defaultAccountId = (accounts) => (primaryAccount(accounts) || accounts.find((a) => !a.archived && a.type !== 'investment') || accounts.find((a) => !a.archived))?.id || '';
export const bankOf = (a) => String(a.bank || '').trim();
/**
 * Agrupa por banco: o grupo da conta principal vem primeiro, depois os outros em ordem alfabética,
 * e "sem banco" (bank = '') por último. Dentro do grupo, a principal vem antes, depois por nome.
 */
export function groupByBank(accounts) {
  const map = new Map();
  accounts.forEach((a) => { const b = bankOf(a); if (!map.has(b)) map.set(b, []); map.get(b).push(a); });
  const rank = (a) => (a.primary ? 0 : 1);
  const groups = [...map.entries()].map(([bank, items]) => ({ bank, items: [...items].sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name, 'pt-BR')) }));
  const weight = (g) => (g.items.some((a) => a.primary) ? 0 : g.bank ? 1 : 2);
  return groups.sort((x, y) => weight(x) - weight(y) || x.bank.localeCompare(y.bank, 'pt-BR'));
}

/* ---------- Gasto fora do normal e contas fixas ---------- */
/** grupos de categoria em que o gasto do mês já passou bem da média dos 3 meses anteriores (base mínima: 2 meses com gasto e média de R$ 100) */
export function unusualSpending({ txs, categories, today = todayISO() }) {
  const key = today.slice(0, 7), idx = categoryIndex(categories);
  const spendOf = (k) => new Map(byCategory(txs.filter((t) => inMonth(t, k)), categories, { type: 'expense', level: 'root', includePending: true }).map((r) => [r.categoryId, r.amount]));
  const prev = [1, 2, 3].map((n) => spendOf(shiftMonth(key, -n)));
  const out = [];
  for (const [id, amount] of spendOf(key)) {
    const vals = prev.map((m) => m.get(id) || 0), avg = Math.round(sum(vals, (v) => v) / 3);
    if (vals.filter((v) => v > 0).length < 2 || avg < 10000) continue;
    if (amount >= avg * 1.5 && amount - avg >= 10000) out.push({ categoryId: id, name: idx.get(id)?.name || 'Sem categoria', amount, avg, pct: Math.round((amount / avg - 1) * 100) });
  }
  return out.sort((a, b) => (b.amount - b.avg) - (a.amount - a.avg));
}

/**
 * Lançamentos que parecem conta fixa e ainda não têm recorrência: mesma descrição em 3 meses seguidos
 * (1 por mês), valores parecidos (até 15% de diferença) e mais ou menos no mesmo dia (até 5 dias de diferença).
 */
export function detectFixed({ txs, recurrences = [], today = todayISO(), minMonths = 3 }) {
  const key = today.slice(0, 7), from = shiftMonth(key, -6);
  const covered = new Set(recurrences.filter((r) => r.active !== false).map((r) => `${r.type}|${baseDescription(r.description)}`));
  const groups = new Map();
  for (const t of txs) {
    const base = baseDescription(t.description), k = `${t.type}|${base}`;
    if (!base || t.isYield || t.type === 'transfer' || t.recurrenceId || t.installment || !isPaid(t) || t.date > today || t.date.slice(0, 7) < from || covered.has(k)) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const out = [];
  for (const [k, items] of groups) {
    const months = [...new Set(items.map((t) => t.date.slice(0, 7)))].sort();
    if (months.length < minMonths || items.length > months.length) continue; // precisa ser um por mês
    const lastN = months.slice(-minMonths);
    if (!lastN.every((m, i) => i === 0 || shiftMonth(lastN[i - 1], 1) === m)) continue; // meses seguidos
    const amounts = items.map((t) => t.amount), days = items.map((t) => Number(t.date.slice(8))).sort((a, b) => a - b);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.15 || days[days.length - 1] - days[0] > 5) continue;
    const last = [...items].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({ key: k, type: last.type, description: last.description, amount: last.amount, accountId: last.accountId, categoryId: last.categoryId || '', day: days[Math.floor(days.length / 2)], months: months.length, startMonth: last.date.slice(0, 7) >= key ? shiftMonth(key, 1) : key });
  }
  return out.sort((a, b) => b.months - a.months || b.amount - a.amount);
}

/* ---------- Compromissos dos próximos meses ---------- */
/**
 * O que já está comprometido em cada um dos próximos meses (a partir do atual):
 * contas a pagar (lançamentos previstos + recorrências, fora cartão) e faturas de cartão que vencem no mês.
 * Compras no cartão entram só pela fatura, para não contar duas vezes. `income` = o que está previsto receber.
 */
export function commitments({ accounts, txs, recurrences = [], today = todayISO(), months = 6 }) {
  const startKey = today.slice(0, 7);
  const cards = accounts.filter((a) => !a.archived && isCredit(a));
  const cardIds = new Set(cards.map((c) => c.id));
  return Array.from({ length: months }, (_, i) => {
    const key = shiftMonth(startKey, i);
    const open = agendaOfMonth({ recurrences, txs, key, today }).filter((it) => it.status !== 'paid' && it.type !== 'transfer' && !cardIds.has(it.accountId));
    const bills = sum(open.filter((it) => it.type === 'expense'), (it) => it.amount);
    const income = sum(open.filter((it) => it.type === 'income'), (it) => it.amount);
    let invoices = 0;
    for (const c of cards) for (const k of [shiftMonth(key, -1), key]) { const inv = cardInvoice(c, txs, k, today); if (inv.dueDate.slice(0, 7) === key) invoices += inv.remaining; }
    return { key, bills, invoices, income, total: bills + invoices };
  });
}

/* ---------- Folga do mês e categoria sugerida ---------- */
/** quanto dá para gastar por dia até o fim do mês, a partir do saldo previsto (0 se não houver folga) */
export function dailyAllowance(projected, today = todayISO()) {
  const daysLeft = Number(lastDayOfMonth(today.slice(0, 7)).slice(8)) - Number(today.slice(8)) + 1;
  return { daysLeft, projected, perDay: projected > 0 ? Math.floor(projected / daysLeft) : 0 };
}

const baseDescription = (d) => norm(String(d || '').replace(/ \(\d+\/\d+\)$/, '').trim());
/** categoria da última vez que você lançou exatamente esta descrição (mesmo tipo); '' se não houver */
export function guessCategory(txs, categories, type, description) {
  const key = baseDescription(description);
  if (!key) return '';
  const valid = new Set(categories.map((c) => c.id));
  let best = null;
  for (const t of txs) {
    if (t.isYield || t.type !== type || !t.categoryId || !valid.has(t.categoryId) || baseDescription(t.description) !== key) continue;
    if (!best || String(t.createdAt || t.date) > String(best.createdAt || best.date)) best = t;
  }
  return best ? best.categoryId : '';
}

export { addDaysISO, isoDate, monthKey };
