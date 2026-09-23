// Utilitários: datas de calendário (texto AAAA-MM-DD, sem fuso), dinheiro em CENTAVOS inteiros e coisas pequenas.

export const cn = (...a) => a.filter(Boolean).join(' ');
export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------- Datas ---------- */
const pad2 = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayISO = () => isoDate(new Date());
export const monthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
export const parseISO = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const isValidISO = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false; const d = parseISO(s); return !Number.isNaN(d.getTime()) && isoDate(d) === s; };
export const shiftMonth = (key, delta) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + delta, 1)); };
export const daysInMonth = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
export const lastDayOfMonth = (key) => `${key}-${pad2(daysInMonth(key))}`;
export const monthDiff = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
export const addDaysISO = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const diffDays = (aISO, bISO) => Math.round((parseISO(bISO) - parseISO(aISO)) / 86400000);
/** 31/jan + 1 mês = 28/fev (e não 03/mar) */
export const addMonthsISO = (iso, n) => {
  const d = parseISO(iso), t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return isoDate(t);
};
/** dia "day" dentro do mês "key", limitado ao último dia do mês */
export const dateInMonth = (key, day) => `${key}-${pad2(Math.min(Math.max(day, 1), daysInMonth(key)))}`;
export const monthsBetween = (fromKey, toKey) => { const out = []; for (let k = fromKey; k <= toKey; k = shiftMonth(k, 1)) out.push(k); return out; };

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthName = (key) => MONTHS[Number(key.slice(5)) - 1];
export const monthLabel = (key) => `${cap(monthName(key))} de ${key.slice(0, 4)}`;
export const monthShort = (key) => `${cap(monthName(key).slice(0, 3))}/${key.slice(2, 4)}`;
export const fmtDate = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
export const fmtDayMonth = (iso) => { const [, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}`; };

/* ---------- Dinheiro (centavos inteiros) ---------- */
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtMoney = (cents) => brl.format((Number(cents) || 0) / 100);
export const fmtNumber = (cents) => ((Number(cents) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtPct = (v, digits = 0) => `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`;
/** "1.234,56" → 123456 (centavos) */
export const parseMoney = (str) => { const n = parseFloat(String(str || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
/** máscara: só dígitos; os dois últimos viram centavos → "1.234,56" */
export const maskMoney = (str) => { const d = String(str).replace(/\D/g, '').replace(/^0+/, ''); return d ? fmtNumber(parseInt(d, 10)) : ''; };
export const centsToField = (c) => (c ? fmtNumber(c) : '');
export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);
/** divide um total em parcelas de centavos exatos (a última absorve o resto) */
export function splitCents(total, n) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

/* ---------- Diversos ---------- */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const groupBy = (arr, fn) => arr.reduce((acc, x) => { (acc[fn(x)] ||= []).push(x); return acc; }, {});
export const stripAccents = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const norm = (s) => stripAccents(s).toLowerCase().trim();
