'use client';
import { useEffect, useMemo, useState } from 'react';
import { AccountName, CategoryLabel, StatusTag, TxAmount, TxDescription, useLookups } from '@/components/pages/shared.jsx';
import { CategorySelect } from '@/components/selects.jsx';
import PeriodPicker from '@/components/PeriodPicker.jsx';
import { Card, Empty, Field, Icon, Money, PageHeader, Pagination } from '@/components/ui.jsx';
import { categoryPath, rootOf } from '@/lib/domain.js';
import { periodLabel } from '@/lib/period.js';
import { transactionsToCSV } from '@/lib/storage.js';
import { useStore } from '@/lib/store.jsx';
import { toast } from '@/lib/toast.js';
import { useUI } from '@/lib/ui-context.jsx';
import { fmtDate, lastDayOfMonth, monthLabel, norm, sum, todayISO } from '@/lib/util.js';

const SIZE = 50;
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Transactions() {
  const { data, viewMonth, upsert, remove } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const today = todayISO();
  const [custom, setCustom] = useState(null); // null = segue o mês escolhido no topo da página; senão, o período escolhido no seletor
  const [accountId, setAccountId] = useState(''); const [categoryId, setCategoryId] = useState(''); const [type, setType] = useState(''); const [status, setStatus] = useState(''); const [q, setQ] = useState('');
  const [sort, setSort] = useState({ by: 'date', dir: 'desc' }); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set()); const [bulkCat, setBulkCat] = useState('');
  useEffect(() => { setPage(1); setSelected(new Set()); }, [custom, accountId, categoryId, type, status, q, viewMonth, sort]);

  const monthRange = useMemo(() => ({ from: `${viewMonth}-01`, to: lastDayOfMonth(viewMonth) }), [viewMonth]);
  const period = custom || monthRange; // período em uso (datas ISO; nulos = sem limite)
  const range = useMemo(() => [period.from || '0000-01-01', period.to || '9999-12-31'], [period]);
  const list = useMemo(() => {
    const nq = norm(q);
    const inCat = (t) => { if (!categoryId) return true; const c = lk.cat.get(categoryId); return t.categoryId === categoryId || (c && !c.parentId && rootOf(t.categoryId, lk.cat)?.id === categoryId); };
    const l = data.transactions.filter((t) => !t.isYield && t.date >= range[0] && t.date <= range[1] && (!accountId || t.accountId === accountId || t.toAccountId === accountId) && inCat(t) && (!type || t.type === type) && (!status || (status === 'paid' ? t.status !== 'pending' : t.status === 'pending'))
      && (!nq || norm(`${t.description} ${categoryPath(t.categoryId, lk.cat)} ${t.notes || ''}`).includes(nq)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = { date: (t) => t.date, description: (t) => norm(t.description), amount: (t) => (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0) }[sort.by];
    return l.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || String(a.id).localeCompare(String(b.id)); });
  }, [data.transactions, range, accountId, categoryId, type, status, q, sort, lk]);
  const income = sum(list.filter((t) => t.type === 'income'), (t) => t.amount), expense = sum(list.filter((t) => t.type === 'expense'), (t) => t.amount);
  const pages = Math.max(1, Math.ceil(list.length / SIZE)), cur = Math.min(page, pages), shown = list.slice((cur - 1) * SIZE, cur * SIZE);
  const allSel = shown.length > 0 && shown.every((t) => selected.has(t.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sortBy = (by) => setSort((s) => ({ by, dir: s.by === by && s.dir === 'desc' ? 'asc' : 'desc' }));
  const arrow = (by) => (sort.by === by ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const sel = list.filter((t) => selected.has(t.id));

  const bulkStatus = (paid) => { const before = sel.map((t) => ({ ...t })); upsert('transactions', sel.map((t) => ({ ...t, status: paid ? 'paid' : 'pending' }))); setSelected(new Set()); toast(`${sel.length} lançamento(s) atualizado(s).`, { action: { label: 'Desfazer', run: () => upsert('transactions', before) } }); };
  const bulkCategory = () => {
    const c = lk.cat.get(bulkCat); if (!c) return;
    const targets = sel.filter((t) => t.type === c.type);
    if (!targets.length) { toast(`Nenhum dos selecionados é ${c.type === 'income' ? 'receita' : 'despesa'}.`, { type: 'err' }); return; }
    const before = targets.map((t) => ({ ...t })); upsert('transactions', targets.map((t) => ({ ...t, categoryId: bulkCat }))); setSelected(new Set()); setBulkCat('');
    toast(`${targets.length} lançamento(s) movido(s) para ${categoryPath(bulkCat, lk.cat)}.`, { action: { label: 'Desfazer', run: () => upsert('transactions', before) } });
  };
  const bulkDelete = async () => {
    if (!(await ui.confirm({ title: 'Excluir lançamentos', danger: true, okLabel: `Excluir ${sel.length}`, message: `${sel.length} lançamento(s) selecionado(s) serão excluídos.` }))) return;
    const removed = remove('transactions', sel); setSelected(new Set()); toast(`${removed.length} lançamento(s) excluído(s).`, { ttl: 6000, action: { label: 'Desfazer', run: () => upsert('transactions', removed) } });
  };
  const subtitle = custom ? periodLabel(custom, today) : monthLabel(viewMonth);

  return (
    <>
      <PageHeader title="Lançamentos" subtitle={subtitle} month={!custom}>
        <button type="button" className="btn btn-secondary" onClick={() => download(`lancamentos-${todayISO()}.csv`, transactionsToCSV(list, data.accounts, data.categories))}><Icon name="download" />Exportar CSV</button>
        <button type="button" className="btn btn-primary" onClick={() => ui.open('tx', { preset: { type: 'expense' } })}>Nova despesa</button>
        <button type="button" className="btn btn-primary" onClick={() => ui.open('tx', { preset: { type: 'income' } })}>Nova receita</button>
        <button type="button" className="btn btn-secondary" onClick={() => ui.open('tx', { preset: { type: 'transfer' } })}>Transferência</button>
      </PageHeader>
      <Card className="filters">
        <div className="filter-row">
          <div className="field"><span className="label">Período</span><PeriodPicker value={period} onChange={setCustom} onReset={() => setCustom(null)} resetLabel="Voltar ao mês selecionado" /></div>
          <Field label="Conta"><select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)} aria-label="Conta"><option value="">Todas</option>{data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <Field label="Categoria"><CategorySelect value={categoryId} onChange={setCategoryId} includeArchived emptyLabel="Todas" aria-label="Categoria" /></Field>
          <Field label="Tipo"><select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo"><option value="">Todos</option><option value="expense">Despesas</option><option value="income">Receitas</option><option value="transfer">Transferências</option></select></Field>
          <Field label="Situação"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Situação"><option value="">Todas</option><option value="paid">Realizados</option><option value="pending">Previstos</option></select></Field>
          <Field label="Buscar" className="grow-field"><input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descrição, categoria ou observação" aria-label="Buscar" /></Field>
        </div>
      </Card>
      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Ações em lote">
          <strong>{selected.size} selecionado(s)</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => bulkStatus(true)}>Marcar como realizado</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => bulkStatus(false)}>Marcar como previsto</button>
          <span className="bulk-cat"><CategorySelect value={bulkCat} onChange={setBulkCat} emptyLabel="Alterar categoria para…" aria-label="Nova categoria em lote" /><button type="button" className="btn btn-secondary btn-sm" disabled={!bulkCat} onClick={bulkCategory}>Alterar categoria</button></span>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={bulkDelete}>Excluir</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Limpar seleção</button>
        </div>
      )}
      <Card flush>
        {list.length ? (
          <div className="table-wrap"><table className="table table-tx">
            <thead><tr>
              <th className="w-chk"><input type="checkbox" aria-label="Selecionar todos da página" checked={allSel} onChange={() => setSelected(allSel ? new Set() : new Set(shown.map((t) => t.id)))} /></th>
              <th className="sortable" onClick={() => sortBy('date')} aria-sort={sort.by === 'date' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>Data{arrow('date')}</th>
              <th className="sortable" onClick={() => sortBy('description')}>Descrição{arrow('description')}</th><th>Categoria</th><th>Conta</th><th>Situação</th>
              <th className="num sortable" onClick={() => sortBy('amount')}>Valor{arrow('amount')}</th>
            </tr></thead>
            <tbody>{shown.map((t) => (
              <tr key={t.id} className={selected.has(t.id) ? 'selected click' : 'click'} onClick={() => ui.open('txView', { tx: t })}>
                <td className="w-chk" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${t.description}`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} /></td>
                <td className="w-date">{fmtDate(t.date)}</td><td><TxDescription t={t} lk={lk} /></td>
                <td>{t.type === 'transfer' ? <span className="muted">Transferência</span> : <CategoryLabel id={t.categoryId} lk={lk} />}</td><td><AccountName id={t.accountId} lk={lk} /></td>
                <td><StatusTag t={t} today={today} /></td><td className="num"><TxAmount t={t} /></td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td colSpan={6}>Total do filtro ({list.length}): receitas <Money cents={income} tone="income" /> · despesas <Money cents={expense} tone="expense" /></td><td className="num"><Money cents={income - expense} tone="auto" /></td></tr></tfoot>
          </table></div>
        ) : <Empty title="Nenhum lançamento encontrado" text="Ajuste os filtros ou crie um novo lançamento." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('tx')}>Novo lançamento</button>} />}
        {list.length > 0 && <Pagination page={cur} pages={pages} onPage={setPage} total={list.length} size={SIZE} />}
      </Card>
    </>
  );
}
