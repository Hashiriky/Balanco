'use client';
// Carteira de investimentos: contas do tipo "investimento" separadas das contas do dia a dia.
import { useMemo, useState } from 'react';
import { LineChart } from '@/components/charts.jsx';
import { Card, Empty, Icon, Kpi, Money, PageHeader, Tag } from '@/components/ui.jsx';
import { accountBalance, accountYield, accountYieldRate, accountYieldSeries } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { useUI } from '@/lib/ui-context.jsx';
import { diffDays, fmtDate, fmtMoney, monthKey, sum, todayISO } from '@/lib/util.js';

const STALE_DAYS = 30;
const pctText = (p) => (p === null ? '—' : `${p >= 0 ? '+' : ''}${p.toFixed(2).replace('.', ',')}%`);

export default function Portfolio() {
  const { data } = useStore();
  const ui = useUI();
  const today = todayISO();
  const [showArchived, setShowArchived] = useState(false);

  const all = useMemo(() => data.accounts.filter((a) => a.type === 'investment'), [data.accounts]);
  const archivedCount = all.filter((a) => a.archived).length;
  const active = all.filter((a) => !a.archived);
  const rows = useMemo(() => (showArchived ? all : active).map((account) => ({
    account,
    ...accountYield(account, data.transactions, today),
    rate: accountYieldRate(account, data.transactions, today),
  })), [all, active, showArchived, data.transactions, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = rows.filter((r) => !r.account.archived);
  const balance = sum(live, (r) => r.balance), principal = sum(live, (r) => r.principal), totalYield = sum(live, (r) => r.totalYield);
  const pct = principal > 0 ? (totalYield / principal) * 100 : null;
  const monthly = sum(live, (r) => r.rate?.monthly || 0);
  const hasYield = live.some((r) => r.lastUpdate);
  const series = useMemo(() => {
    const end = monthKey(new Date());
    const per = active.map((a) => accountYieldSeries(a, data.transactions, end, 12));
    return per.length ? per[0].map((p, i) => ({ key: p.key, value: sum(per, (s) => s[i].value) })) : [];
  }, [active, data.transactions]);

  const newInvestment = () => ui.open('account', { presetType: 'investment' });
  const updateOne = (account) => ui.open('yieldUpdate', { account, currentBalance: accountBalance(account, data.transactions, { upTo: today }) });

  return (
    <>
      <PageHeader title="Carteira" subtitle="Investimentos, aportes e rendimento">
        {active.length > 0 && <button type="button" className="btn btn-primary" onClick={() => ui.open('yieldBatch')}><Icon name="up" size={16} />Atualizar rendimentos</button>}
        <button type="button" className={active.length ? 'btn btn-secondary' : 'btn btn-primary'} onClick={newInvestment}><Icon name="plus" size={16} />Novo investimento</button>
      </PageHeader>

      {all.length === 0 ? (
        <Card><Empty title="Você ainda não tem investimentos" text="Crie um investimento (CDB, Tesouro, ações, cofrinho…) pra acompanhar quanto você aportou e quanto rendeu — separado das contas do dia a dia." action={<button type="button" className="btn btn-primary" onClick={newInvestment}>Novo investimento</button>} /></Card>
      ) : (<>
        <div className="kpis">
          <Kpi label="Total na carteira" value={<Money cents={balance} />} sub={`${live.length} investimento${live.length === 1 ? '' : 's'}`} />
          <Kpi label="Total aportado" value={<Money cents={principal} />} sub="Saldo menos rendimento" />
          <Kpi label="Rendimento acumulado" value={<Money cents={totalYield} tone="auto" />} sub={pct !== null ? `${pctText(pct)} sobre o aportado` : 'Sem rendimento registrado ainda'} tone={totalYield > 0 ? 'pos' : totalYield < 0 ? 'neg' : undefined} />
          <Kpi label="Média mensal" value={<Money cents={monthly} tone="auto" />} sub="Estimativa pelo histórico" />
        </div>

        <Card title="Investimentos" flush actions={archivedCount > 0 && <label className="check inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /><span>Mostrar arquivados ({archivedCount})</span></label>}>
          <div className="table-wrap"><table className="table portfolio-table">
            <thead><tr><th>Investimento</th><th className="num">Saldo</th><th className="num">Aportado</th><th className="num">Rendimento</th><th className="num">%</th><th>Atualizado</th><th /></tr></thead>
            <tbody>{rows.map((r) => {
              const a = r.account;
              const days = r.lastUpdate ? diffDays(r.lastUpdate, today) : null;
              const stale = days === null || days >= STALE_DAYS;
              return (
                <tr key={a.id} className={a.archived ? 'muted click' : 'click'} onClick={() => ui.open('accountView', { account: a })}>
                  <td><strong>{a.name}</strong>{a.archived && <Tag>Arquivado</Tag>}</td>
                  <td className="num"><Money cents={r.balance} /></td>
                  <td className="num"><Money cents={r.principal} /></td>
                  <td className="num"><Money cents={r.totalYield} tone="auto" sign /></td>
                  <td className={`num ${r.totalYield >= 0 ? 'pos' : 'neg'}`}>{pctText(r.pct)}</td>
                  <td>{r.lastUpdate ? <>{fmtDate(r.lastUpdate)}{stale && <Tag tone="warn">{days} dias</Tag>}</> : <Tag tone="warn">Nunca</Tag>}</td>
                  <td className="w-act">
                    {!a.archived && (<div className="pf-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); updateOne(a); }}><Icon name="up" size={14} />Rendimento</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('tx', { preset: { type: 'transfer', toAccountId: a.id, description: `Aporte em ${a.name}` } }); }}>Aportar</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('tx', { preset: { type: 'transfer', accountId: a.id, description: `Resgate de ${a.name}` } }); }}>Resgatar</button>
                    </div>)}
                  </td>
                </tr>
              );
            })}</tbody>
            {live.length > 1 && <tfoot><tr><td>Total</td><td className="num">{fmtMoney(balance)}</td><td className="num">{fmtMoney(principal)}</td><td className="num"><Money cents={totalYield} tone="auto" sign /></td><td className={`num ${totalYield >= 0 ? 'pos' : 'neg'}`}>{pctText(pct)}</td><td colSpan={2} /></tr></tfoot>}
          </table></div>
        </Card>
        <p className="muted footnote">Aportar e resgatar são transferências entre suas contas e a carteira — não contam como receita nem despesa. Só o rendimento altera o resultado da carteira.</p>

        {hasYield && (
          <Card title="Rendimento acumulado (12 meses)"><LineChart points={series} label="Rendimento acumulado da carteira" valueLabel="Rendimento acumulado" /></Card>
        )}
      </>)}
    </>
  );
}
