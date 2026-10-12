'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CategoryLabel, useLookups } from '@/components/pages/shared.jsx';
import { Card, Empty, Icon, Kpi, Money, PageHeader, ProgressBar, Tag } from '@/components/ui.jsx';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';
import { accountsOverview, cardAvailable, cardInvoice, cardOpeningDebt, cardUsed, groupByBank, invoiceUrgency, isCredit, openingInvoiceKey } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { useUI } from '@/lib/ui-context.jsx';
import { cn, fmtDate, fmtMoney, monthLabel, shiftMonth, todayISO } from '@/lib/util.js';

const INV_STATUS = { open: ['Aberta', undefined], closed: ['Fechada', 'warn'], late: ['Vencida', 'danger'], paid: ['Paga', 'ok'], empty: ['Sem compras', undefined] };

function CardPanel({ card }) {
  const { data, viewMonth, upsert } = useStore();
  const ui = useUI();
  const lk = useLookups();
  const today = todayISO();
  const [key, setKey] = useState(viewMonth);
  // cartão antigo com dívida inicial e sem mês definido: fixa na fatura vigente pra dívida não "andar" de mês
  useEffect(() => { if (!card.initialInvoice && cardOpeningDebt(card) > 0) upsert('accounts', { ...card, initialInvoice: openingInvoiceKey(card, today) }); }, [card, today, upsert]);
  const inv = useMemo(() => cardInvoice(card, data.transactions, key, today), [card, data.transactions, key, today]);
  const used = cardUsed(card, data.transactions), avail = cardAvailable(card, data.transactions);
  const [label, tone] = INV_STATUS[inv.status];
  /* fatura que merece atenção (atrasada, vence hoje ou em até 7 dias): destaca o cartão e avisa dentro do painel */
  const urg = useMemo(() => invoiceUrgency(card, data.transactions, today), [card, data.transactions, today]);
  const urgMonth = urg ? monthLabel(urg.key).split(' ')[0].toLowerCase() : '';
  const urgText = !urg ? '' : urg.level === 'late' ? `Fatura de ${urgMonth} venceu em ${fmtDate(urg.invoice.dueDate)}: pague o quanto antes, pode estar gerando juros`
    : urg.level === 'today' ? `Fatura de ${urgMonth} vence HOJE: último dia para pagar sem juros`
    : urg.days === 1 ? `Fatura de ${urgMonth} vence amanhã (${fmtDate(urg.invoice.dueDate)})` : `Fatura de ${urgMonth} vence em ${urg.days} dias (${fmtDate(urg.invoice.dueDate)})`;
  /* vindo do botão "Ver" de um aviso (#fatura-<cartão>-<AAAA-MM>): abre a fatura do aviso, rola até o cartão e o destaca por alguns segundos */
  const anchor = useRef(null);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    let t1, t2;
    const go = () => {
      const m = window.location.hash.match(/^#fatura-(.+)-(\d{4}-\d{2})$/);
      if (!m || m[1] !== card.id) return;
      setKey(m[2]);
      t1 = setTimeout(() => {
        const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        anchor.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
        setFocus(true); t2 = setTimeout(() => setFocus(false), 4500);
      }, 120);
    };
    go();
    window.addEventListener('hashchange', go);
    return () => { window.removeEventListener('hashchange', go); clearTimeout(t1); clearTimeout(t2); };
  }, [card.id]);
  return (
    <div ref={anchor} id={`fatura-${card.id}`} className={cn('card-anchor', urg && `card-urgent-${urg.level === 'soon' ? 'warn' : 'danger'}`, focus && 'card-focus')}>
    <Card title={`Cartão ${card.name}`} className="card-panel" actions={<><button type="button" className="btn btn-secondary btn-sm" onClick={() => setKey(shiftMonth(key, -1))} aria-label="Fatura anterior">‹</button><strong className="inv-month">{monthLabel(key)}</strong><button type="button" className="btn btn-secondary btn-sm" onClick={() => setKey(shiftMonth(key, 1))} aria-label="Próxima fatura">›</button></>}>
      {urg && (
        <div className={cn('inv-urgent', urg.level === 'soon' ? 'inv-urgent-warn' : 'inv-urgent-danger')} role="status">
          <Icon name="alert" size={20} />
          <span><strong>{urgText}</strong> · {fmtMoney(urg.invoice.remaining)}</span>
          {urg.key !== key && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setKey(urg.key)}>Ver esta fatura</button>}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => ui.open('payInvoice', { card, invoice: urg.invoice })}>Pagar fatura</button>
        </div>
      )}
      <div className="kpis kpis-3">
        <Kpi label="Limite" value={fmtMoney(card.limit)} sub={`Disponível: ${fmtMoney(avail)}`} />
        <Kpi label="Limite usado" value={fmtMoney(used)} sub={<ProgressBar pct={card.limit ? (used / card.limit) * 100 : 0} level={used > card.limit ? 'over' : used / (card.limit || 1) > 0.85 ? 'high' : 'ok'} />} />
        <Kpi label={`Fatura de ${monthLabel(key).split(' ')[0].toLowerCase()}`} value={fmtMoney(inv.total)} sub={<>Fecha {fmtDate(inv.closeDate)} · vence {fmtDate(inv.dueDate)} <Tag tone={tone}>{label}</Tag></>} />
      </div>
      <div className="inv-actions">
        <span>Pago: <strong>{fmtMoney(inv.paid)}</strong> · Restante: <strong>{fmtMoney(inv.remaining)}</strong></span>
        <button type="button" className="btn btn-primary" disabled={inv.remaining <= 0} onClick={() => ui.open('payInvoice', { card, invoice: inv })}><Icon name="check" size={16} />Pagar fatura</button>
        <button type="button" className="btn btn-secondary" onClick={() => ui.open('tx', { preset: { type: 'expense', accountId: card.id } })}><Icon name="plus" size={16} />Lançar compra</button>
      </div>
      {inv.items.length || inv.opening ? (
        <div className="table-wrap"><table className="table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
          <tbody>{inv.opening > 0 && <tr><td className="w-date">—</td><td>Dívida anterior do cartão (saldo inicial)</td><td /><td className="num"><Money cents={inv.opening} /></td></tr>}{inv.items.map((t) => <tr key={t.id} className="click" onClick={() => ui.open('txView', { tx: t })}><td className="w-date">{fmtDate(t.date)}</td><td>{t.description}</td><td><CategoryLabel id={t.categoryId} lk={lk} /></td><td className="num"><Money cents={t.type === 'income' ? -t.amount : t.amount} /></td></tr>)}</tbody></table></div>
      ) : <Empty title="Sem compras nesta fatura" />}
      {inv.payments.length > 0 && <p className="muted">Pagamentos: {inv.payments.map((p) => `${fmtDate(p.date)} — ${fmtMoney(p.amount)}`).join(' · ')}</p>}
    </Card>
    </div>
  );
}

export default function Accounts() {
  const { data } = useStore();
  const ui = useUI();
  const today = todayISO();
  const [showArchived, setShowArchived] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const ov = useMemo(() => accountsOverview(data.accounts, data.transactions, today), [data.accounts, data.transactions, today]);
  const archived = data.accounts.filter((a) => a.archived && a.type !== 'investment');
  const activeRows = ov.rows.filter((r) => r.account.type !== 'investment'); // investimentos ficam na Carteira
  const allRows = showArchived ? [...activeRows, ...archived.map((account) => ({ account, current: 0, forecast: 0 }))] : activeRows;
  const rows = typeFilter === 'all' ? allRows : allRows.filter((r) => r.account.type === typeFilter);
  const cards = data.accounts.filter((a) => isCredit(a) && !a.archived);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.account.id, r])), [rows]);
  const groups = useMemo(() => groupByBank(rows.map((r) => r.account)), [rows]);
  const byBank = groups.some((g) => g.bank); // só mostra os títulos de banco se alguma conta tiver banco
  const typeCounts = useMemo(() => { const c = {}; allRows.forEach((r) => { c[r.account.type] = (c[r.account.type] || 0) + 1; }); return c; }, [allRows]);
  return (
    <>
      <PageHeader title="Contas e cartões" subtitle="Saldos e faturas (investimentos ficam na Carteira)"><button type="button" className="btn btn-primary" onClick={() => ui.open('account')}>Nova conta</button></PageHeader>
      <div className="kpis">
        <Kpi label="Saldo em contas" value={<Money cents={ov.liquid} />} sub="Corrente, poupança e dinheiro" />
        <Kpi label="Investido" value={<Money cents={ov.invested} />} sub={<Link href="/carteira" className="link">Ver carteira →</Link>} />
        <Kpi label="Faturas de cartão em aberto" value={<Money cents={-ov.cards} tone={ov.cards < 0 ? 'expense' : undefined} />} sub="Dívida total nos cartões" />
        <Kpi label="Patrimônio líquido" value={<Money cents={ov.netWorth} tone="auto" />} sub="Saldos + investido − cartões" />
      </div>
      <Card title="Contas" actions={
        <div className="acc-filters">
          <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filtrar por tipo" style={{ width: 'auto' }}>
            <option value="all">Todos os tipos</option>
            {Object.entries(ACCOUNT_TYPES).filter(([k]) => typeCounts[k]).map(([k, v]) => <option key={k} value={k}>{v} ({typeCounts[k]})</option>)}
          </select>
          {archived.length > 0 && <label className="check inline"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /><span>Mostrar arquivadas ({archived.length})</span></label>}
        </div>
      } flush>
        {rows.length ? (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Nome</th><th>Tipo</th><th className="num">Saldo atual</th><th className="num">Previsto no fim do mês</th><th /></tr></thead>
            <tbody>{groups.flatMap((g) => {
              const line = (r) => (
                <tr key={r.account.id} className={r.account.archived ? 'muted click' : 'click'} onClick={() => ui.open('accountView', { account: r.account })}>
                  <td><span className="acc-label">{r.account.color && <i className="acc-dot" style={{ background: r.account.color }} />}{r.account.name}</span>{r.account.primary && <Tag tone="ok">Principal</Tag>}{r.account.archived && <Tag>Arquivada</Tag>}</td>
                  <td>{ACCOUNT_TYPES[r.account.type]}{isCredit(r.account) && <small className="muted"> · limite {fmtMoney(r.account.limit)}</small>}</td>
                  <td className="num"><Money cents={r.current} tone="auto" /></td><td className="num"><Money cents={r.forecast} tone="auto" /></td>
                  <td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('account', { account: r.account }); }}>Editar</button></td>
                </tr>
              );
              const items = g.items.map((a) => rowById.get(a.id));
              if (!byBank) return items.map(line);
              const sum = (k) => items.reduce((t, r) => t + r[k], 0);
              return [
                <tr key={`bank-${g.bank || '_'}`} className="group-row"><th colSpan={2}>{g.bank || 'Sem banco'}</th><th className="num"><Money cents={sum('current')} tone="auto" /></th><th className="num"><Money cents={sum('forecast')} tone="auto" /></th><th /></tr>,
                ...items.map(line),
              ];
            })}</tbody>
          </table></div>
        ) : <Empty title="Nenhuma conta encontrada" text="Tente outro filtro, ou crie uma conta pra começar." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('account')}>Nova conta</button>} />}
      </Card>
      {cards.map((c) => <CardPanel key={c.id} card={c} />)}
    </>
  );
}
