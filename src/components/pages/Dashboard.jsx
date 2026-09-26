'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, HBars } from '@/components/charts.jsx';
import { AccountName, CategoryLabel, TxAmount, TxDescription, useLookups } from '@/components/pages/shared.jsx';
import { Alert, Card, Empty, Kpi, Money, PageHeader, ProgressBar } from '@/components/ui.jsx';
import { accountsOverview, agendaOfMonth, agendaSummary, budgetRows, buildAlerts, byCategory, cashflowSeries, categoryIndex, investmentsOverview, isCredit, isPaid, monthEndForecast, monthTotals, rootOf, upcoming } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { useUI } from '@/lib/ui-context.jsx';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';
import { cn, fmtDate, fmtMoney, monthKey, monthLabel, sum, todayISO } from '@/lib/util.js';

const NEXT_LIMIT_KEY = 'balanco.nextLimit';

export default function Dashboard() {
  const { data, viewMonth } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const today = todayISO(), isCurrent = viewMonth === monthKey(new Date());
  const [nextLimit, setNextLimit] = useState(5);
  useEffect(() => { try { setNextLimit(Number(localStorage.getItem(NEXT_LIMIT_KEY)) || 5); } catch { /* ignore */ } }, []);
  const changeNextLimit = (n) => { setNextLimit(n); try { localStorage.setItem(NEXT_LIMIT_KEY, String(n)); } catch { /* ignore */ } };
  const v = useMemo(() => {
    const { accounts, transactions: txs, recurrences, budgets, categories } = data;
    const ov = accountsOverview(accounts, txs, today), real = monthTotals(txs, viewMonth);
    const ag = agendaOfMonth({ recurrences, txs, key: viewMonth, today }), open = ag.filter((i) => i.status !== 'paid' && i.type !== 'transfer');
    const plan = { income: real.income + sum(open.filter((i) => i.type === 'income'), (i) => i.amount), expense: real.expense + sum(open.filter((i) => i.type === 'expense'), (i) => i.amount) };
    const idx = categoryIndex(categories);
    const cats = byCategory(txs.filter((t) => t.date.startsWith(viewMonth)), categories, { includePending: false }).slice(0, 7);
    const total = sum(byCategory(txs.filter((t) => t.date.startsWith(viewMonth)), categories, { includePending: false }), (c) => c.amount);
    return {
      ov, real, plan, agSum: agendaSummary(ag), forecast: monthEndForecast({ accounts, txs, recurrences, today }), series: cashflowSeries(txs, viewMonth, 12), total,
      inv: investmentsOverview(accounts, txs, today),
      cats: cats.map((c) => ({ id: c.categoryId, value: c.amount, label: idx.get(c.categoryId)?.name || 'Sem categoria', color: rootOf(c.categoryId, idx)?.color || '#94a3b8' })),
      next: upcoming({ recurrences, txs, today, limit: nextLimit }), alerts: buildAlerts({ accounts, txs, recurrences, budgets, categories, today }),
      buds: budgetRows({ budgets, txs, categories, key: viewMonth }).slice(0, 5),
      recent: [...txs].filter(isPaid).sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 8),
    };
  }, [data, viewMonth, today, nextLimit]);

  if (!data.accounts.length) {
    return (
      <>
        <PageHeader title="Painel" subtitle="Bem-vindo ao Balanço" />
        <Card title="Primeiros passos">
          <ol className="steps">
            <li><strong>Crie sua primeira conta</strong><span className="muted">Conta corrente, carteira ou cartão de crédito, com o saldo de hoje.</span></li>
            <li><strong>Registre lançamentos</strong><span className="muted">Receitas, despesas e transferências. Ou importe o extrato do banco (CSV/OFX).</span></li>
            <li><strong>Cadastre contas recorrentes</strong><span className="muted">Aluguel, internet, salário: a Agenda avisa o que vence.</span></li>
          </ol>
          <div className="btn-row"><button type="button" className="btn btn-primary" onClick={() => ui.open('account')}>Criar primeira conta</button><Link href="/importar" className="btn btn-secondary">Importar extrato</Link></div>
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Painel" subtitle={monthLabel(viewMonth)} month>
        <button type="button" className="btn btn-primary" onClick={() => ui.open('tx')}>Novo lançamento</button>
      </PageHeader>
      {v.alerts.length > 0 && <div className="alerts">{v.alerts.map((a) => <Alert key={a.id} tone={a.tone} action={<Link href={a.href} className="link">Ver</Link>}>{a.text}{a.value ? <> — <Money cents={a.value} /></> : null}</Alert>)}</div>}
      <div className={cn('kpis', v.inv.rows.length > 0 && 'kpis-5')}>
        <Kpi label="Saldo disponível" value={<Money cents={v.ov.liquid} />} sub={v.ov.cards < 0 ? `Faturas de cartão em aberto: ${fmtMoney(-v.ov.cards)}` : 'Sem dívidas de cartão'} />
        {v.inv.rows.length > 0 && (
          <Kpi label="Investido" value={<Money cents={v.inv.balance} />} sub={v.inv.pct !== null ? `Rendimento acumulado: ${fmtMoney(v.inv.totalYield)} (${v.inv.pct >= 0 ? '+' : ''}${v.inv.pct.toFixed(2)}%)` : 'Sem rendimento registrado ainda'} tone={v.inv.totalYield >= 0 ? 'pos' : 'neg'} />
        )}
        <Kpi label="Receitas do mês" value={<Money cents={v.real.income} />} sub={`Previsto: ${fmtMoney(v.plan.income)}`} tone="pos" />
        <Kpi label="Despesas do mês" value={<Money cents={v.real.expense} />} sub={`Previsto: ${fmtMoney(v.plan.expense)}`} tone="neg" />
        <Kpi label="Resultado do mês" value={<Money cents={v.real.result} tone="auto" />} sub={`Previsto: ${fmtMoney(v.plan.income - v.plan.expense)}`} />
      </div>
      {isCurrent && (
        <div className="forecast">
          <span>Saldo previsto para o fim de {monthLabel(viewMonth).split(' ')[0].toLowerCase()}: <strong><Money cents={v.forecast.projected} tone="auto" /></strong></span>
          <span className="muted">= saldo disponível {fmtMoney(v.forecast.assets)} + a receber {fmtMoney(v.forecast.receivable)} − a pagar {fmtMoney(v.forecast.payable)}{v.inv.rows.length > 0 ? ' (não conta o investido)' : ''}</span>
        </div>
      )}
      <div className="grid-2-1">
        <Card title="Fluxo de caixa (12 meses)"><BarChart series={v.series} /><div className="legend"><span><i className="sw inc" />Receitas</span><span><i className="sw exp" />Despesas</span><span className="muted">Somente lançamentos realizados</span></div></Card>
        <Card title="Despesas por categoria">{v.cats.length ? <HBars items={v.cats} total={v.total} /> : <Empty title="Sem despesas neste mês" />}</Card>
      </div>
      <div className="grid-2">
        <Card title="Próximos vencimentos" actions={<>
          <select className="select select-sm" value={nextLimit} onChange={(e) => changeNextLimit(Number(e.target.value))} aria-label="Quantos vencimentos mostrar">
            <option value={3}>Mostrar 3</option><option value={5}>Mostrar 5</option><option value={8}>Mostrar 8</option><option value={12}>Mostrar 12</option>
          </select>
          <Link href="/agenda" className="link">Abrir agenda</Link>
        </>} flush>
          {v.next.length ? (
            <table className="table"><tbody>{v.next.map((i) => (
              <tr key={i.id}><td className="w-date">{fmtDate(i.date)}</td><td>{i.description}<div className="sub">{i.status === 'late' ? <span className="neg">Em atraso</span> : i.daysToDue === 0 ? 'Vence hoje' : `Vence em ${i.daysToDue} dia${i.daysToDue > 1 ? 's' : ''}`}</div></td>
                <td className="num"><Money cents={i.type === 'income' ? i.amount : -i.amount} tone="auto" /></td><td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={() => ui.open('settle', { item: i })}>Efetivar</button></td></tr>
            ))}</tbody></table>
          ) : <Empty title="Nada a vencer" text="Cadastre contas recorrentes na Agenda." />}
        </Card>
        <Card title="Contas e cartões" actions={<Link href="/contas" className="link">Gerenciar</Link>} flush>
          <table className="table"><tbody>{v.ov.rows.map((r) => <tr key={r.account.id}><td>{r.account.name}<div className="sub">{ACCOUNT_TYPES[r.account.type]}</div></td><td className="num"><Money cents={r.current} tone={isCredit(r.account) ? 'auto' : undefined} /></td></tr>)}
            <tr className="total"><td>Patrimônio líquido</td><td className="num"><Money cents={v.ov.netWorth} tone="auto" /></td></tr></tbody></table>
        </Card>
        <Card title="Orçamento do mês" actions={<Link href="/orcamento" className="link">Abrir</Link>}>
          {v.buds.length ? v.buds.map((r) => <div className="budget-mini" key={r.budget.id}><div><span>{r.category.name}</span><span className="num">{fmtMoney(r.spent)} / {fmtMoney(r.limit)}</span></div><ProgressBar pct={r.pct} level={r.level} /></div>) : <Empty title="Nenhum orçamento" text="Defina limites por categoria." action={<Link href="/orcamento" className="btn btn-secondary btn-sm">Definir</Link>} />}
        </Card>
        <Card title="Últimas movimentações" actions={<Link href="/lancamentos" className="link">Ver todos</Link>} flush>
          {v.recent.length ? (
            <table className="table"><tbody>{v.recent.map((t) => (
              <tr key={t.id} className="click" onClick={() => ui.open('txView', { tx: t })}><td className="w-date">{fmtDate(t.date)}</td><td><TxDescription t={t} lk={lk} />{t.type !== 'transfer' && <div className="sub"><CategoryLabel id={t.categoryId} lk={lk} /> · <AccountName id={t.accountId} lk={lk} /></div>}</td><td className="num"><TxAmount t={t} /></td></tr>
            ))}</tbody></table>
          ) : <Empty title="Sem movimentações" />}
        </Card>
      </div>
    </>
  );
}
