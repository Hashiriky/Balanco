'use client';
import { useMemo, useState } from 'react';
import { BarChart, HBars, LineChart } from '@/components/charts.jsx';
import { Card, Empty, Icon, Money, PageHeader, Tabs } from '@/components/ui.jsx';
import { byCategory, cashflowSeries, categoryIndex, categoryMonthTable, netWorthSeries, rootOf } from '@/lib/domain.js';
import { tableToCSV } from '@/lib/storage.js';
import { useStore } from '@/lib/store.jsx';
import { fmtMoney, fmtPct, monthKey, monthLabel, monthShort, monthsBetween, shiftMonth, sum, todayISO } from '@/lib/util.js';

const PRESETS = { 6: 'Últimos 6 meses', 12: 'Últimos 12 meses', ytd: 'Ano atual', prev: 'Ano anterior' };
function keysFor(preset, nowKey) {
  const y = Number(nowKey.slice(0, 4));
  if (preset === 'ytd') return monthsBetween(`${y}-01`, nowKey);
  if (preset === 'prev') return monthsBetween(`${y - 1}-01`, `${y - 1}-12`);
  const n = Number(preset); return Array.from({ length: n }, (_, i) => shiftMonth(nowKey, i - n + 1));
}
const money2 = (c) => (c / 100).toFixed(2).replace('.', ',');
function download(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Reports() {
  const { data } = useStore();
  const [tab, setTab] = useState('cashflow'); const [preset, setPreset] = useState('12'); const [pending, setPending] = useState(false); const [ctype, setCtype] = useState('expense');
  const nowKey = monthKey(new Date());
  const keys = useMemo(() => keysFor(preset, nowKey), [preset, nowKey]);
  const endKey = keys[keys.length - 1];
  const inKeys = useMemo(() => { const s = new Set(keys); return data.transactions.filter((t) => s.has(t.date.slice(0, 7))); }, [data.transactions, keys]);
  const flow = useMemo(() => { let acc = 0; return cashflowSeries(data.transactions, endKey, keys.length, { includePending: pending }).map((m) => { acc += m.result; return { ...m, acc }; }); }, [data.transactions, endKey, keys.length, pending]);
  const idx = useMemo(() => categoryIndex(data.categories), [data.categories]);
  const catTotal = useMemo(() => byCategory(inKeys, data.categories, { type: ctype, level: 'root', includePending: pending }), [inKeys, data.categories, ctype, pending]);
  const table = useMemo(() => categoryMonthTable(data.transactions, data.categories, keys, { type: ctype, includePending: pending }), [data.transactions, data.categories, keys, ctype, pending]);
  const worth = useMemo(() => netWorthSeries(data.accounts, data.transactions, endKey, Math.min(keys.length, 24)), [data.accounts, data.transactions, endKey, keys.length]);
  const sumIncome = sum(flow, (m) => m.income), sumExpense = sum(flow, (m) => m.expense);
  const exportFlow = () => download(`fluxo-de-caixa-${todayISO()}.csv`, tableToCSV(['Mês', 'Receitas', 'Despesas', 'Resultado', 'Acumulado'], flow.map((m) => [monthLabel(m.key), money2(m.income), money2(m.expense), money2(m.result), money2(m.acc)])));
  const exportTable = () => download(`categorias-por-mes-${todayISO()}.csv`, tableToCSV(['Categoria', ...keys.map(monthShort), 'Total'], [...table.rows.map((r) => [`${'  '.repeat(r.depth)}${r.name}`, ...r.values.map(money2), money2(r.total)]), ['Total', ...table.totals.map(money2), money2(table.total)]]));
  const empty = !data.transactions.length;

  return (
    <>
      <PageHeader title="Relatórios" subtitle={`${monthLabel(keys[0])} a ${monthLabel(endKey)}`} />
      <Card className="filters">
        <div className="filter-row">
          <div className="field"><span className="label">Relatório</span><Tabs label="Relatório" value={tab} onChange={setTab} tabs={[{ value: 'cashflow', label: 'Fluxo de caixa' }, { value: 'categories', label: 'Categorias' }, { value: 'worth', label: 'Patrimônio' }, { value: 'table', label: 'Tabela mensal' }]} /></div>
          <label className="field"><span className="label">Período</span><select className="select" value={preset} onChange={(e) => setPreset(e.target.value)} aria-label="Período">{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {(tab === 'categories' || tab === 'table') && <label className="field"><span className="label">Tipo</span><select className="select" value={ctype} onChange={(e) => setCtype(e.target.value)} aria-label="Tipo"><option value="expense">Despesas</option><option value="income">Receitas</option></select></label>}
          {tab !== 'worth' && <label className="check inline"><input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} /><span>Incluir lançamentos previstos</span></label>}
        </div>
      </Card>
      {empty ? <Card><Empty title="Ainda não há dados" text="Os relatórios aparecem assim que houver lançamentos." /></Card> : (<>
        {tab === 'cashflow' && (<>
          <Card title="Receitas e despesas por mês"><BarChart series={flow} /><div className="legend"><span><i className="sw inc" />Receitas</span><span><i className="sw exp" />Despesas</span></div></Card>
          <Card title="Resumo por mês" actions={<button type="button" className="btn btn-secondary btn-sm" onClick={exportFlow}><Icon name="download" />Exportar CSV</button>} flush>
            <div className="table-wrap"><table className="table"><thead><tr><th>Mês</th><th className="num">Receitas</th><th className="num">Despesas</th><th className="num">Resultado</th><th className="num">Acumulado</th></tr></thead>
              <tbody>{flow.map((m) => <tr key={m.key}><td>{monthLabel(m.key)}</td><td className="num"><Money cents={m.income} tone="income" /></td><td className="num"><Money cents={m.expense} tone="expense" /></td><td className="num"><Money cents={m.result} tone="auto" /></td><td className="num"><Money cents={m.acc} tone="auto" /></td></tr>)}</tbody>
              <tfoot><tr><td>Total do período</td><td className="num"><Money cents={sumIncome} tone="income" /></td><td className="num"><Money cents={sumExpense} tone="expense" /></td><td className="num"><Money cents={sumIncome - sumExpense} tone="auto" /></td><td /></tr></tfoot></table></div>
          </Card>
        </>)}
        {tab === 'categories' && (
          <Card title={ctype === 'expense' ? 'Despesas por categoria' : 'Receitas por categoria'}>
            {catTotal.length ? <HBars total={sum(catTotal, (c) => c.amount)} items={catTotal.map((c) => ({ id: c.categoryId, value: c.amount, label: idx.get(c.categoryId)?.name || 'Sem categoria', color: rootOf(c.categoryId, idx)?.color || '#94a3b8' }))} /> : <Empty title="Sem dados no período" />}
          </Card>
        )}
        {tab === 'worth' && (<>
          <Card title="Evolução do patrimônio líquido (fim de cada mês)"><LineChart points={worth.map((w) => ({ key: w.key, value: w.netWorth }))} /></Card>
          <Card title="Detalhe" flush><div className="table-wrap"><table className="table"><thead><tr><th>Mês</th><th className="num">Saldo em contas</th><th className="num">Cartões</th><th className="num">Patrimônio</th></tr></thead>
            <tbody>{worth.map((w) => <tr key={w.key}><td>{monthLabel(w.key)}</td><td className="num"><Money cents={w.assets} /></td><td className="num"><Money cents={w.cards} tone="auto" /></td><td className="num"><Money cents={w.netWorth} tone="auto" /></td></tr>)}</tbody></table></div></Card>
        </>)}
        {tab === 'table' && (
          <Card title={ctype === 'expense' ? 'Despesas por categoria e mês' : 'Receitas por categoria e mês'} actions={<button type="button" className="btn btn-secondary btn-sm" onClick={exportTable}><Icon name="download" />Exportar CSV</button>} flush>
            {table.rows.length ? (
              <div className="table-wrap"><table className="table table-matrix"><thead><tr><th>Categoria</th>{keys.map((k) => <th key={k} className="num">{monthShort(k)}</th>)}<th className="num">Total</th><th className="num">%</th></tr></thead>
                <tbody>{table.rows.map((r) => <tr key={r.id} className={r.depth ? 'sub-row' : 'root-row'}><td style={{ paddingLeft: 12 + r.depth * 18 }}>{r.name}</td>{r.values.map((v, i) => <td key={i} className="num">{v ? fmtMoney(v) : '—'}</td>)}<td className="num"><strong>{fmtMoney(r.total)}</strong></td><td className="num">{r.depth === 0 && table.total ? fmtPct((r.total / table.total) * 100) : ''}</td></tr>)}</tbody>
                <tfoot><tr><td>Total</td>{table.totals.map((v, i) => <td key={i} className="num">{fmtMoney(v)}</td>)}<td className="num">{fmtMoney(table.total)}</td><td /></tr></tfoot></table></div>
            ) : <Empty title="Sem dados no período" />}
          </Card>
        )}
      </>)}
      <p className="muted footnote">{pending ? 'Incluindo lançamentos previstos.' : 'Considera apenas lançamentos realizados.'} Transferências entre contas não entram nos resultados.</p>
    </>
  );
}
