'use client';
import { useMemo } from 'react';
import { CategoryLabel, useLookups } from '@/components/pages/shared.jsx';
import { Card, Empty, Kpi, Money, PageHeader, ProgressBar } from '@/components/ui.jsx';
import { budgetRows, byCategory, inMonth } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { useUI } from '@/lib/ui-context.jsx';
import { fmtPct, monthLabel, sum } from '@/lib/util.js';

const LEVEL = { ok: 'Dentro do limite', high: 'Perto do limite', over: 'Estourado' };
export default function Budget() {
  const { data, viewMonth } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const rows = useMemo(() => budgetRows({ budgets: data.budgets, txs: data.transactions, categories: data.categories, key: viewMonth }), [data, viewMonth]);
  const limit = sum(rows, (r) => r.limit), spent = sum(rows, (r) => r.spent);
  const noBudget = useMemo(() => {
    const has = new Set(data.budgets.map((b) => b.categoryId));
    return byCategory(data.transactions.filter((t) => inMonth(t, viewMonth)), data.categories, { type: 'expense', level: 'root' }).filter((c) => c.categoryId !== 'none' && !has.has(c.categoryId)).slice(0, 8);
  }, [data, viewMonth]);
  return (
    <>
      <PageHeader title="Orçamento" subtitle={`Limites de ${monthLabel(viewMonth)} (realizado + previsto)`} month>
        <button type="button" className="btn btn-primary" onClick={() => ui.open('budget')}>Novo orçamento</button>
      </PageHeader>
      <div className="kpis kpis-3">
        <Kpi label="Orçado" value={<Money cents={limit} />} /><Kpi label="Gasto nas categorias orçadas" value={<Money cents={spent} />} />
        <Kpi label="Disponível" value={<Money cents={limit - spent} tone="auto" />} sub={limit ? `${fmtPct((spent / limit) * 100)} utilizado` : undefined} />
      </div>
      <Card title="Orçamento por categoria" flush>
        {rows.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Categoria</th><th className="num">Orçado</th><th className="num">Realizado</th><th className="num">Disponível</th><th className="w-bar">Utilização</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.budget.id} className="click" onClick={() => ui.open('budget', { categoryId: r.budget.categoryId })}>
                <td><CategoryLabel id={r.category.id} lk={lk} /></td><td className="num"><Money cents={r.limit} /></td><td className="num"><Money cents={r.spent} /></td>
                <td className="num"><Money cents={r.left} tone="auto" /></td><td><ProgressBar pct={r.pct} level={r.level} /><small className={r.level === 'over' ? 'neg' : 'muted'}>{fmtPct(r.pct)} · {LEVEL[r.level]}</small></td>
                <td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('budget', { categoryId: r.budget.categoryId }); }}>Editar</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="Nenhum orçamento definido" text="Defina um limite mensal por categoria para acompanhar seus gastos." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('budget')}>Novo orçamento</button>} />}
      </Card>
      {noBudget.length > 0 && (
        <Card title="Gastos sem orçamento neste mês" flush>
          <table className="table"><tbody>{noBudget.map((c) => (
            <tr key={c.categoryId}><td><CategoryLabel id={c.categoryId} lk={lk} /></td><td className="num"><Money cents={c.amount} /></td><td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={() => ui.open('budget', { categoryId: undefined, presetCategory: c.categoryId })}>Definir limite</button></td></tr>
          ))}</tbody></table>
        </Card>
      )}
    </>
  );
}
