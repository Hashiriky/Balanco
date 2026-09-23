// Importação de extratos: CSV (com mapeamento de colunas) e OFX, regras de categorização e detecção de duplicados.
import { isValidISO, norm, uid } from './util.js';

/** ArrayBuffer → texto. Extratos de banco costumam vir em Windows-1252; tenta UTF-8 primeiro. */
export function decodeText(buffer) {
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8.replace(/^\uFEFF/, '');
  try { return new TextDecoder('windows-1252').decode(buffer); } catch { return utf8; }
}

export function parseDate(str) {
  const s = String(str ?? '').trim();
  let m;
  const ok = (y, mo, d) => { const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`; return isValidISO(iso) ? iso : null; };
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return ok(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})/))) return ok(m[3], m[2], m[1]);
  if ((m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{2})$/))) return ok(2000 + Number(m[3]), m[2], m[1]);
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return ok(m[1], m[2], m[3]);
  return null;
}
/** texto → centavos com sinal (ou null). Aceita "1.234,56", "-1234.56", "(123,45)", "123,45-", "R$ 10". */
export function parseAmount(str) {
  let s = String(str ?? '').trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
  if (/^\s*-/.test(s)) { neg = true; s = s.replace(/^\s*-/, ''); }
  s = s.replace(/^\s*\+/, '').replace(/[^\d.,]/g, '');
  if (!s || !/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  let num;
  if (lc >= 0 && ld >= 0) num = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc >= 0) num = s.replace(/\./g, '').replace(',', '.');
  else if (ld >= 0) num = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  else num = s;
  const n = parseFloat(num);
  return Number.isFinite(n) ? (neg ? -1 : 1) * Math.round(n * 100) : null;
}

/* ---------- CSV ---------- */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  const sample = lines.find((l) => l.trim()) || '';
  const count = (ch) => sample.split(ch).length - 1;
  const delim = [';', '\t', ','].map((d) => [d, count(d)]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  const push = () => { row.push(cell); cell = ''; };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) push();
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i += 1; push(); if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim())); row = []; }
    else cell += ch;
  }
  push(); if (row.some((c) => c.trim() !== '')) rows.push(row.map((c) => c.trim()));
  return { rows, delimiter: delim };
}
/** tenta descobrir quais colunas são data, descrição e valor (ou débito/crédito) */
export function guessMapping(rows) {
  const first = rows[0] || [], hasHeader = !first.some((c) => parseDate(c)) ;
  const h = first.map((c) => norm(c));
  const find = (re) => h.findIndex((x) => re.test(x));
  let date = hasHeader ? find(/^(data|date|dt|dia)/) : first.findIndex((c) => parseDate(c));
  let description = hasHeader ? find(/(descri|hist|memo|lancamento|estabelec|title|titulo|nome|detalhe)/) : -1;
  let amount = hasHeader ? find(/^(valor|amount|quantia|vlr)/) : first.findIndex((c, i) => i !== date && parseAmount(c) !== null && /\d/.test(c));
  const debit = hasHeader ? find(/(debito|saida)/) : -1, credit = hasHeader ? find(/(credito|entrada)/) : -1;
  if (description < 0) description = first.findIndex((c, i) => i !== date && i !== amount && i !== debit && i !== credit);
  if (amount < 0 && debit < 0 && credit < 0 && hasHeader) amount = find(/valor|amount/);
  return { hasHeader, date, description, amount, debit, credit };
}
/** aplica o mapeamento: retorna { items, errors } com valor em centavos COM sinal (+ receita, − despesa) */
export function mapCSV(rows, mapping) {
  const items = []; let errors = 0;
  rows.slice(mapping.hasHeader ? 1 : 0).forEach((r) => {
    const date = parseDate(r[mapping.date]);
    let amount = null;
    if (mapping.amount >= 0) amount = parseAmount(r[mapping.amount]);
    else {
      const c = mapping.credit >= 0 ? parseAmount(r[mapping.credit]) : null, d = mapping.debit >= 0 ? parseAmount(r[mapping.debit]) : null;
      if (c || d) amount = Math.abs(c || 0) - Math.abs(d || 0);
    }
    const description = (r[mapping.description] || '').replace(/\s+/g, ' ').trim();
    if (!date || amount === null || amount === 0) { errors += 1; return; }
    items.push({ date, description: description || 'Sem descrição', amount, externalId: null });
  });
  return { items, errors };
}

/* ---------- OFX ---------- */
export function parseOFX(text) {
  const items = []; let errors = 0;
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || [];
  blocks.forEach((b) => {
    const f = {};
    for (const m of b.matchAll(/<(\w+)>([^<\r\n]*)/g)) f[m[1].toUpperCase()] = m[2].trim();
    const date = parseDate(f.DTPOSTED), amount = parseAmount(f.TRNAMT);
    if (!date || amount === null || amount === 0) { errors += 1; return; }
    const description = (f.MEMO || f.NAME || 'Sem descrição').replace(/\s+/g, ' ').trim();
    items.push({ date, description, amount, externalId: f.FITID || null });
  });
  return { items, errors };
}

/* ---------- Regras e duplicados ---------- */
/** primeira regra cuja palavra aparece na descrição (as mais específicas/longas primeiro) */
export function applyRules(description, rules = []) {
  const d = norm(description);
  const sorted = [...rules].filter((r) => r.contains && r.categoryId).sort((a, b) => b.contains.length - a.contains.length);
  return sorted.find((r) => d.includes(norm(r.contains)))?.categoryId || null;
}
/** monta as linhas de revisão: tipo, categoria sugerida e marcação de duplicados */
export function buildImportRows(items, { accountId, existing = [], rules = [], invert = false }) {
  const known = existing.filter((t) => t.accountId === accountId || t.toAccountId === accountId);
  const seenIds = new Set(known.map((t) => t.externalId).filter(Boolean));
  const inFile = new Set();
  return items.map((it) => {
    const signed = invert ? -it.amount : it.amount;
    const type = signed >= 0 ? 'income' : 'expense', amount = Math.abs(signed);
    let duplicate = null;
    if (it.externalId && (seenIds.has(it.externalId) || inFile.has(it.externalId))) duplicate = 'Já importado antes';
    else if (known.some((t) => t.date === it.date && t.amount === amount && t.type === type && (t.accountId === accountId))) duplicate = 'Já existe um lançamento igual';
    if (it.externalId) inFile.add(it.externalId);
    return { key: uid(), date: it.date, description: it.description, amount, type, externalId: it.externalId || null, categoryId: applyRules(it.description, rules), duplicate, selected: !duplicate };
  });
}
export function rowsToTransactions(rows, accountId) {
  return rows.filter((r) => r.selected).map((r) => ({ id: uid(), type: r.type, amount: r.amount, date: r.date, description: r.description, accountId, categoryId: r.categoryId || null, status: 'paid', notes: null, externalId: r.externalId || null, imported: true }));
}
