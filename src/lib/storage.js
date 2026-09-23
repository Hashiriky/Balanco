// Limpeza dos dados (do disco, da nuvem ou de arquivos), leitura/gravação local, mesclagem e backup.
import { ACCOUNT_TYPES, FREQUENCIES, defaultCategories } from './defaults.js';
import { fmtDate, fmtNumber, isValidISO, monthKey, uid } from './util.js';

export const COLLECTIONS = ['accounts', 'categories', 'transactions', 'recurrences', 'budgets', 'rules'];
export const APP_VERSION = '1.0.0';
const KEY = (c) => `balanco.${c}`;
export const GUEST_KEY = 'balanco.guest';

export const emptyData = () => ({ accounts: [], categories: [], transactions: [], recurrences: [], budgets: [], rules: [] });

const str = (v, d = '') => (v === undefined || v === null ? d : String(v));
const int = (v) => Math.round(Number(v) || 0);
const day = (v, d = 1) => Math.min(31, Math.max(1, parseInt(v, 10) || d));
const monthOrNull = (v) => (/^\d{4}-\d{2}$/.test(str(v)) ? str(v) : null);

export function cleanAccount(a) {
  if (!a || !a.name) return null;
  const type = ACCOUNT_TYPES[a.type] ? a.type : 'checking';
  const out = { ...a, id: str(a.id) || uid(), name: str(a.name).trim(), type, initialBalance: int(a.initialBalance), archived: !!a.archived };
  if (type === 'credit') Object.assign(out, { limit: Math.max(0, int(a.limit)), closingDay: day(a.closingDay, 1), dueDay: day(a.dueDay, 10) });
  return out;
}
export function cleanCategory(c) {
  if (!c || !c.name) return null;
  return { ...c, id: str(c.id) || uid(), name: str(c.name).trim(), type: c.type === 'income' ? 'income' : 'expense', parentId: c.parentId ? str(c.parentId) : null, color: str(c.color, '#64748b'), archived: !!c.archived };
}
export function cleanTx(t) {
  if (!t || typeof t !== 'object') return null;
  const type = ['income', 'expense', 'transfer'].includes(t.type) ? t.type : null;
  const amount = Math.abs(int(t.amount)), date = str(t.date).slice(0, 10);
  if (!type || !amount || !isValidISO(date) || !t.accountId) return null;
  if (type === 'transfer' && (!t.toAccountId || t.toAccountId === t.accountId)) return null;
  return { ...t, id: str(t.id) || uid(), type, amount, date, accountId: str(t.accountId), toAccountId: type === 'transfer' ? str(t.toAccountId) : null,
    categoryId: type === 'transfer' ? null : (t.categoryId ? str(t.categoryId) : null), status: t.status === 'pending' ? 'pending' : 'paid',
    description: str(t.description).trim() || (type === 'transfer' ? 'Transferência' : 'Sem descrição'), notes: t.notes ? str(t.notes) : null };
}
export function cleanRecurrence(r) {
  if (!r || !r.description || !(int(r.amount) > 0) || !r.accountId) return null;
  const freq = FREQUENCIES[r.freq] ? r.freq : 'monthly';
  return { ...r, id: str(r.id) || uid(), description: str(r.description).trim(), amount: Math.abs(int(r.amount)), type: r.type === 'income' ? 'income' : 'expense', accountId: str(r.accountId),
    categoryId: r.categoryId ? str(r.categoryId) : null, freq, day: freq === 'weekly' ? Math.min(6, Math.max(0, parseInt(r.day, 10) || 0)) : day(r.day), startMonth: monthOrNull(r.startMonth) || monthKey(new Date()), endMonth: monthOrNull(r.endMonth), active: r.active !== false };
}
export const cleanBudget = (b) => { const cid = b && (b.categoryId || b.id); return cid && int(b.amount) > 0 ? { id: str(cid), categoryId: str(cid), amount: int(b.amount) } : null; };
export const cleanRule = (r) => (r && str(r.contains).trim() && r.categoryId ? { ...r, id: str(r.id) || uid(), contains: str(r.contains).trim(), categoryId: str(r.categoryId) } : null);

const CLEANERS = { accounts: cleanAccount, categories: cleanCategory, transactions: cleanTx, recurrences: cleanRecurrence, budgets: cleanBudget, rules: cleanRule };
export const cleanOne = (col, item) => CLEANERS[col](item);
export function cleanData(d = {}) {
  const out = emptyData();
  COLLECTIONS.forEach((c) => { out[c] = Array.isArray(d[c]) ? d[c].map(CLEANERS[c]).filter(Boolean) : []; });
  return out;
}
/** primeiro acesso: se não há categorias, entra o plano padrão */
export function withDefaults(data) { return data.categories.length ? data : { ...data, categories: defaultCategories() }; }
export const hasData = (d) => COLLECTIONS.some((c) => c !== 'categories' && d[c].length > 0);

/* ---------- localStorage ---------- */
const read = (st, key) => { try { const v = JSON.parse(st.getItem(key)); return Array.isArray(v) ? v : []; } catch { return []; } };
export function loadLocal(storage = globalThis.localStorage) {
  if (!storage) return emptyData();
  const raw = {}; COLLECTIONS.forEach((c) => { raw[c] = read(storage, KEY(c)); });
  return cleanData(raw);
}
export function saveLocal(data, storage = globalThis.localStorage) {
  if (!storage) return false;
  try { COLLECTIONS.forEach((c) => storage.setItem(KEY(c), JSON.stringify(data[c]))); return true; } catch { return false; }
}
export const clearLocal = (storage = globalThis.localStorage) => COLLECTIONS.forEach((c) => storage?.removeItem(KEY(c)));

/* ---------- Mesclagem e backup ---------- */
const mergeById = (a, b) => { const m = new Map(a.map((x) => [x.id, x])); b.forEach((x) => m.set(x.id, x)); return [...m.values()]; };
/** junta duas fotografias; em conflito, "b" vence */
export function mergeData(a, b) { const out = emptyData(); COLLECTIONS.forEach((c) => { out[c] = mergeById(a[c], b[c]); }); return out; }
export const isBackupFile = (o) => !!o && typeof o === 'object' && COLLECTIONS.some((c) => Array.isArray(o[c]));
export function importInto(current, raw, mode) {
  if (!isBackupFile(raw)) throw new Error('Este arquivo não parece um backup do Balanço.');
  const incoming = cleanData(raw);
  const counts = {}; COLLECTIONS.forEach((c) => { counts[c] = incoming[c].length; });
  return { next: mode === 'replace' ? incoming : mergeData(current, incoming), counts };
}
export const buildBackup = (data) => ({ app: 'Balanço', version: APP_VERSION, exportedAt: new Date().toISOString(), ...data });

const csvCell = (v) => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** CSV com BOM e ponto e vírgula: o Excel em português abre direto */
export function transactionsToCSV(txs, accounts, categories) {
  const acc = new Map(accounts.map((a) => [a.id, a.name])), cat = new Map(categories.map((c) => [c.id, c]));
  const path = (id) => { const c = cat.get(id); if (!c) return ''; const p = c.parentId && cat.get(c.parentId); return p ? `${p.name} > ${c.name}` : c.name; };
  const TYPE = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' };
  const rows = [['Data', 'Descrição', 'Tipo', 'Conta', 'Conta destino', 'Categoria', 'Situação', 'Valor', 'Observações']];
  [...txs].sort((a, b) => a.date.localeCompare(b.date)).forEach((t) => {
    rows.push([fmtDate(t.date), t.description, TYPE[t.type], acc.get(t.accountId) || '', t.toAccountId ? acc.get(t.toAccountId) || '' : '', path(t.categoryId), t.status === 'pending' ? 'Previsto' : 'Realizado', (t.amount / 100).toFixed(2).replace('.', ','), t.notes || '']);
  });
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
}
export function tableToCSV(header, rows) {
  return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}
export { fmtNumber };
