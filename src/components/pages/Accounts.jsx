'use client';
import { useMemo, useState } from 'react';
import { CategoryLabel, useLookups } from '@/components/pages/shared.jsx';
import { Card, Empty, Kpi, Money, PageHeader, ProgressBar, Tag } from '@/components/ui.jsx';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';
import { accountsOverview, cardAvailable, cardInvoice, cardUsed, isCredit } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { useUI } from '@/lib/ui-context.jsx';
import { fmtDate, fmtMoney, monthLabel, shiftMonth, todayISO } from '@/lib/util.js';

const INV_STATUS = { open: ['Aberta', undefined], closed: ['Fechada', 'warn'], late: ['Vencida', 'danger'], paid: ['Paga', 'ok'], empty: ['Sem compras', undefined] };

function CardPanel({ card }) {
  const { data, viewMonth } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const today = todayISO();
  const [key, setKey] = useState(viewMonth);
  const inv = useMemo(() => cardInvoice(card, data.transactions, key, today), [card, data.transactions, key, today]);
  const used = cardUsed(card, data.transactions), avail = cardAvailable(card, data.transactions);
  const [label, tone] = INV_STATUS[inv.status];
  return (
    <Card title={`Cartão ${card.name}`} className="card-panel" actions={<><button type="button" className="btn btn-secondary btn-sm" onClick={() => setKey(shiftMonth(key, -1))} aria-label="Fatura anterior">‹</button><strong className="inv-month">{monthLabel(key)}</strong><button type="button" className="btn btn-secondary btn-sm" onClick={() => setKey(shiftMonth(key, 1))} aria-label="Próxima fatura">›</button></>}>
      <div className="kpis kpis-3">
        <Kpi label="Limite" value={fmtMoney(card.limit)} sub={`Disponível: ${fmtMoney(avail)}`} />
        <Kpi label="Limite usado" value={fmtMoney(used)} sub={<ProgressBar pct={card.limit ? (used / card.limit) * 100 : 0} level={used > card.limit ? 'over' : used / (card.limit || 1) > 0.85 ? 'high' : 'ok'} />} />
        <Kpi label={`Fatura de ${monthLabel(key).split(' ')[0].toLowerCase()}`} value={fmtMoney(inv.total)} sub={<>Fecha {fmtDate(inv.closeDate)} · vence {fmtDate(inv.dueDate)} <Tag tone={tone}>{label}</Tag></>} />
      </div>
      <div className="inv-actions">
        <span>Pago: <strong>{fmtMoney(inv.paid)}</strong> · Restante: <strong>{fmtMoney(inv.remaining)}</strong></span>
        <button type="button" className="btn btn-primary btn-sm" disabled={inv.remaining <= 0} onClick={() => ui.open('payInvoice', { card, invoice: inv })}>Pagar fatura</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => ui.open('tx', { preset: { type: 'expense', accountId: card.id } })}>Lançar compra</button>
      </div>
      {inv.items.length ? (
        <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
          <tbody>{inv.items.map((t) => <tr key={t.id} className="click" onClick={() => ui.open('txView', { tx: t })}><td className="w-date">{fmtDate(t.date)}</td><td>{t.description}</td><td><CategoryLabel id={t.categoryId} lk={lk} /></td><td className="num"><Money cents={t.type === 'income' ? -t.amount : t.amount} /></td></tr>)}</tbody></table></div>
      ) : <Empty title="Sem compras nesta fatura" />}
      {inv.payments.length > 0 && <p className="muted">Pagamentos: {inv.payments.map((p) => `${fmtDate(p.date)} — ${fmtMoney(p.amount)}`).join(' · ')}</p>}
    </Card>
  );
}

export default function Accounts() {
  const { data } = useStore();
  const ui = useUI();
  const today = todayISO();
  const [showArchived, setShowArchived] = useState(false);
  const ov = useMemo(() => accountsOverview(data.accounts, data.transactions, today), [data.accounts, data.transactions, today]);
  const archived = data.accounts.filter((a) => a.archived);
  const rows = showArchived ? [...ov.rows, ...archived.map((account) => ({ account, current: 0, forecast: 0 }))] : ov.rows;
  const cards = data.accounts.filter((a) => isCredit(a) && !a.archived);
  return (
    <>
      <PageHeader title="Contas e cartões" subtitle="Saldos e faturas"><button type="button" className="btn btn-primary" onClick={() => ui.open('account')}>Nova conta</button></PageHeader>
      <div className="kpis kpis-3">
        <Kpi label="Saldo em contas" value={<Money cents={ov.assets} />} sub="Contas correntes, poupança, dinheiro e investimentos" />
        <Kpi label="Faturas de cartão em aberto" value={<Money cents={-ov.cards} tone={ov.cards < 0 ? 'expense' : undefined} />} sub="Dívida total nos cartões" />
        <Kpi label="Patrimônio líquido" value={<Money cents={ov.netWorth} tone="auto" />} sub="Saldos menos cartões" />
      </div>
      <Card title="Contas" actions={archived.length > 0 && <label className="check inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /><span>Mostrar arquivadas ({archived.length})</span></label>} flush>
        {rows.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Nome</th><th>Tipo</th><th className="num">Saldo atual</th><th className="num">Previsto no fim do mês</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.account.id} className={r.account.archived ? 'muted click' : 'click'} onClick={() => ui.open('accountView', { account: r.account })}>
                <td>{r.account.name}{r.account.archived && <Tag>Arquivada</Tag>}</td><td>{ACCOUNT_TYPES[r.account.type]}{isCredit(r.account) && <small className="muted"> · limite {fmtMoney(r.account.limit)}</small>}</td>
                <td className="num"><Money cents={r.current} tone="auto" /></td><td className="num"><Money cents={r.forecast} tone="auto" /></td>
                <td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('account', { account: r.account }); }}>Editar</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty title="Nenhuma conta cadastrada" text="Crie uma conta para começar a lançar." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('account')}>Nova conta</button>} />}
      </Card>
      {cards.map((c) => <CardPanel key={c.id} card={c} />)}
    </>
  );
}
