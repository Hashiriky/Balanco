'use client';
import { useMemo } from 'react';
import { AccountName, CategoryLabel, useLookups } from '@/components/pages/shared.jsx';
import { Card, Empty, Kpi, Money, PageHeader, Tag } from '@/components/ui.jsx';
import { FREQUENCIES } from '@/lib/defaults.js';
import { agendaOfMonth, agendaSummary } from '@/lib/domain.js';
import { usePrefs } from '@/lib/prefs.js';
import { useStore } from '@/lib/store.jsx';
import { toast } from '@/lib/toast.js';
import { useUI } from '@/lib/ui-context.jsx';
import { cn, fmtDate, monthLabel, todayISO } from '@/lib/util.js';
import { WEEKDAY_OPTIONS } from '@/components/selects.jsx';

export default function Agenda() {
  const { data, viewMonth, upsert, remove } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const [prefs] = usePrefs();
  const today = todayISO();
  const items = useMemo(() => agendaOfMonth({ recurrences: data.recurrences, txs: data.transactions, key: viewMonth, today }), [data.recurrences, data.transactions, viewMonth, today]);
  const s = agendaSummary(items);
  const undo = (i) => {
    if (i.tx.recurrenceId) { const removed = remove('transactions', [i.tx]); toast('Pagamento desfeito.', { action: { label: 'Refazer', run: () => upsert('transactions', removed) } }); }
    else { upsert('transactions', { ...i.tx, status: 'pending' }); toast('Lançamento voltou a ser previsto.'); }
  };
  const label = (i) => (i.status === 'paid' ? <Tag tone="ok">{i.type === 'income' ? 'Recebido' : 'Pago'}</Tag> : i.status === 'late' ? <Tag tone="danger">Atrasado {-i.daysToDue}d</Tag> : <Tag tone={i.daysToDue <= prefs.alertDays ? 'warn' : undefined}>{i.daysToDue === 0 ? 'Vence hoje' : `Em ${i.daysToDue} dia${i.daysToDue > 1 ? 's' : ''}`}</Tag>);
  return (
    <>
      <PageHeader title="Agenda" subtitle={`Contas a pagar e a receber · ${monthLabel(viewMonth)}`} month>
        <button type="button" className="btn btn-secondary" onClick={() => ui.open('tx', { preset: { type: 'income', status: 'pending' } })}>Previsto: a receber</button>
        <button type="button" className="btn btn-secondary" onClick={() => ui.open('tx', { preset: { type: 'expense', status: 'pending' } })}>Previsto: a pagar</button>
        <button type="button" className="btn btn-primary" onClick={() => ui.open('recurrence')}>Nova recorrência</button>
      </PageHeader>
      <div className="kpis">
        <Kpi label="A pagar" value={<Money cents={s.payable} />} tone="neg" sub="em aberto no mês" />
        <Kpi label="A receber" value={<Money cents={s.receivable} />} tone="pos" sub="em aberto no mês" />
        <Kpi label="Em atraso" value={<Money cents={s.late} />} tone={s.late ? 'neg' : undefined} sub={`${s.lateCount} conta${s.lateCount === 1 ? '' : 's'}`} />
        <Kpi label="Efetivados" value={`${s.paidCount} de ${s.count}`} sub="itens do mês" />
      </div>
      <Card title="Vencimentos do mês" flush>
        {items.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Situação</th><th className="num">Valor</th><th className="w-act" /></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id} className={cn('click', i.status === 'late' && 'row-late', i.status === 'pending' && i.daysToDue <= prefs.alertDays && 'row-soon')} onClick={() => (i.kind === 'tx' ? ui.open('txView', { tx: i.tx }) : ui.open('recurrence', { recurrence: i.recurrence }))}>
                <td className="w-date">{fmtDate(i.date)}</td><td>{i.description}{i.kind === 'occurrence' && <small className="muted"> (recorrente)</small>}</td>
                <td>{i.type === 'transfer' ? <span className="muted">Transferência</span> : <CategoryLabel id={i.categoryId} lk={lk} />}</td><td><AccountName id={i.accountId} lk={lk} /></td><td>{label(i)}</td>
                <td className="num"><Money cents={i.type === 'income' ? i.amount : -i.amount} tone="auto" /></td>
                <td className="w-act" onClick={(e) => e.stopPropagation()}>{i.status === 'paid' ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => undo(i)}>Desfazer</button> : <button type="button" className="btn btn-primary btn-sm" onClick={() => ui.open('settle', { item: i })}>Efetivar</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="Nenhum vencimento neste mês" text="Cadastre recorrências (aluguel, internet, salário) ou lance itens como previstos." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('recurrence')}>Nova recorrência</button>} />}
      </Card>
      <Card title="Recorrências cadastradas" flush>
        {data.recurrences.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Descrição</th><th>Frequência</th><th>Vencimento</th><th>Conta</th><th>Categoria</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{[...data.recurrences].sort((a, b) => a.description.localeCompare(b.description, 'pt-BR')).map((r) => (
              <tr key={r.id} className={r.active === false ? 'muted click' : 'click'} onClick={() => ui.open('recurrence', { recurrence: r })}>
                <td>{r.description}{r.active === false && <Tag>Pausada</Tag>}</td><td>{FREQUENCIES[r.freq]}</td><td>{r.freq === 'weekly' ? WEEKDAY_OPTIONS[r.day] : `Dia ${r.day}`}</td>
                <td><AccountName id={r.accountId} lk={lk} /></td><td><CategoryLabel id={r.categoryId} lk={lk} /></td><td className="num"><Money cents={r.type === 'income' ? r.amount : -r.amount} tone="auto" /></td>
                <td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('recurrence', { recurrence: r }); }}>Editar</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="Nenhuma recorrência" text="Contas que se repetem todo mês ficam aqui." />}
      </Card>
    </>
  );
}
