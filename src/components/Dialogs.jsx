'use client';
// Janelas (formulários) do app.
import { useMemo, useState } from 'react';
import { AccountName, CategoryLabel, StatusTag, TxAmount, useLookups } from '@/components/pages/shared.jsx';
import { AccountSelect, CategorySelect, WEEKDAY_OPTIONS } from '@/components/selects.jsx';
import { Choice, Field, Icon, Modal, Money, MoneyInput, Tag } from '@/components/ui.jsx';
import { ACCOUNT_TYPES, FREQUENCIES } from '@/lib/defaults.js';
import { accountBalance, invoiceMonthOf, isPaid } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { toast } from '@/lib/toast.js';
import { useUI } from '@/lib/ui-context.jsx';
import { addMonthsISO, centsToField, cn, fmtDate, fmtMoney, isValidISO, monthKey, monthLabel, norm, parseMoney, splitCents, todayISO, uid } from '@/lib/util.js';

const hasErrors = (e) => Object.keys(e).length > 0;

/* ---------- Confirmação ---------- */
/* ---------- Categoria (busca) ---------- */
export function CategoryPickerDialog({ type, value, exclude = [], includeArchived = false, allowEmpty = true, emptyLabel = 'Selecione…', onSelect, onClose }) {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const nq = norm(q);
  const visible = (c) => (!c.archived || c.id === value || includeArchived) && !exclude.includes(c.id);
  const groups = useMemo(() => {
    const cats = data.categories.filter((c) => !type || c.type === type);
    const roots = cats.filter((c) => !c.parentId);
    return roots.map((r) => {
      const kids = cats.filter((c) => c.parentId === r.id && visible(c) && (!r.archived || includeArchived || r.id === value));
      const rootMatches = !nq || norm(r.name).includes(nq);
      const filteredKids = kids.filter((k) => !nq || rootMatches || norm(k.name).includes(nq));
      const showRoot = visible(r) && (!nq || rootMatches);
      return { root: r, kids: filteredKids, showRoot };
    }).filter((g) => g.showRoot || g.kids.length);
  }, [data.categories, type, nq, value, includeArchived]); // eslint-disable-line react-hooks/exhaustive-deps
  /* usadas com mais frequência (só quando não tem busca), pra encurtar listas longas */
  const frequent = useMemo(() => {
    if (nq) return [];
    const idx = new Map(data.categories.map((c) => [c.id, c]));
    const counts = new Map();
    data.transactions.forEach((t) => { if (t.categoryId && (!type || t.type === type)) counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1); });
    return [...counts.entries()].filter(([id]) => { const c = idx.get(id); return c && visible(c) && c.id !== value; })
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => idx.get(id));
  }, [data.transactions, data.categories, type, nq, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const select = (id) => { onSelect(id); onClose(); };
  const showEmpty = allowEmpty && (!nq || norm(emptyLabel).includes(nq));
  const nothing = !showEmpty && !frequent.length && !groups.length;
  /* lista achatada (na ordem exibida) pra navegar com as setas do teclado */
  const flat = useMemo(() => {
    const out = [];
    if (showEmpty) out.push('');
    frequent.forEach((c) => out.push(c.id));
    groups.forEach((g) => { if (g.showRoot) out.push(g.root.id); g.kids.forEach((k) => out.push(k.id)); });
    return out;
  }, [showEmpty, frequent, groups]);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flat.length) { e.preventDefault(); select(flat[Math.min(active, flat.length - 1)]); }
  };
  const itemProps = (id) => { const i = flat.indexOf(id); return { className: cn('cat-pick-item', value === id && 'on', i === active && 'active'), onMouseEnter: () => setActive(i), onClick: () => select(id) }; };
  return (
    <Modal title="Escolher categoria" size="sm" onClose={onClose}>
      <input className="input" type="search" value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder="Buscar categoria…" aria-label="Buscar categoria" data-autofocus />
      <div className="cat-pick-list">
        {showEmpty && <button type="button" {...itemProps('')}>{emptyLabel}</button>}
        {!!frequent.length && (
          <div className="cat-pick-group">
            <div className="cat-pick-group-label">Usadas com frequência</div>
            {frequent.map((c) => <button key={c.id} type="button" {...itemProps(c.id)}><i className="dot" style={{ background: c.color }} />{c.parentId ? c.name : `${c.name} (geral)`}</button>)}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.root.id} className="cat-pick-group">
            <button type="button" className="cat-pick-group-label cat-pick-group-btn" onClick={() => g.showRoot && select(g.root.id)}><i className="dot" style={{ background: g.root.color }} />{g.root.name}{g.showRoot && <span className="muted"> (usar geral)</span>}</button>
            {g.kids.map((k) => <button key={k.id} type="button" {...itemProps(k.id)}>{k.name}</button>)}
          </div>
        ))}
        {nothing && <p className="muted pad">Nenhuma categoria encontrada.</p>}
      </div>
    </Modal>
  );
}

export function ConfirmDialog({ title = 'Confirmar', message, okLabel = 'Confirmar', danger, extraLabel, resolve, onClose }) {
  const [done, setDone] = useState(false);
  const finish = (v, close) => { setDone(true); resolve(v); close(); };
  return (
    <Modal title={title} size="sm" onClose={() => { if (!done) resolve(false); onClose(); }}
      footer={(close) => (<>
        <button type="button" className="btn btn-secondary" onClick={() => finish(false, close)}>Cancelar</button><span className="grow" />
        {extraLabel && <button type="button" className="btn btn-danger-outline" onClick={() => finish('extra', close)}>{extraLabel}</button>}
        <button type="button" className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => finish(true, close)} data-autofocus>{okLabel}</button>
      </>)}>
      <p>{message}</p>
    </Modal>
  );
}

/* ---------- Ver detalhes (só leitura) ---------- */
export function TxViewDialog({ tx, onClose }) {
  const ui = useUI();
  const lk = useLookups();
  const isTransfer = tx.type === 'transfer';
  return (
    <Modal title="Detalhes do lançamento" size="sm" onClose={onClose}
      footer={(close) => (<>
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Fechar</button>
        <button type="button" className="btn btn-primary" onClick={() => { close(); setTimeout(() => ui.open('tx', { tx }), 0); }}><Icon name="edit" size={16} />Editar</button>
      </>)}>
      <div className="view-amount"><TxAmount t={tx} /></div>
      <dl className="view-grid">
        <div className="span2"><dt>Descrição</dt><dd>{tx.description}</dd></div>
        <div><dt>Data</dt><dd>{fmtDate(tx.date)}</dd></div>
        <div><dt>Situação</dt><dd><StatusTag t={tx} today={todayISO()} /></dd></div>
        {isTransfer ? (<>
          <div><dt>Conta de origem</dt><dd><AccountName id={tx.accountId} lk={lk} /></dd></div>
          <div><dt>Conta de destino</dt><dd><AccountName id={tx.toAccountId} lk={lk} /></dd></div>
        </>) : (<>
          <div><dt>Conta</dt><dd><AccountName id={tx.accountId} lk={lk} /></dd></div>
          <div><dt>Categoria</dt><dd><CategoryLabel id={tx.categoryId} lk={lk} /></dd></div>
        </>)}
        {tx.installment && <div><dt>Parcela</dt><dd>{tx.installment.number} de {tx.installment.total}</dd></div>}
        {tx.recurrenceId && <div><dt>Origem</dt><dd>Gerado por uma recorrência (veja a Agenda)</dd></div>}
        {tx.notes && <div className="span2"><dt>Observações</dt><dd>{tx.notes}</dd></div>}
      </dl>
    </Modal>
  );
}
export function AccountViewDialog({ account, onClose }) {
  const { data } = useStore();
  const ui = useUI();
  const today = todayISO();
  const bal = accountBalance(account, data.transactions, { upTo: today, includePending: false });
  const isCard = account.type === 'credit';
  const isInvestment = account.type === 'investment';
  const yieldTxs = isInvestment ? data.transactions.filter((t) => t.accountId === account.id && t.isYield && isPaid(t)) : [];
  const totalYield = yieldTxs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const principal = bal - totalYield;
  const yieldPct = principal > 0 ? (totalYield / principal) * 100 : null;
  const lastUpdate = yieldTxs.reduce((max, t) => (!max || t.date > max ? t.date : max), null);
  /* histórico: quanto rendeu em cada atualização e o % acumulado até aquela data */
  const history = useMemo(() => {
    if (!isInvestment) return [];
    let cum = 0;
    return [...yieldTxs]
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .map((t) => {
        const delta = t.type === 'income' ? t.amount : -t.amount;
        cum += delta;
        const balAt = accountBalance(account, data.transactions, { upTo: t.date, includePending: false });
        const principalAt = balAt - cum;
        const pct = principalAt > 0 ? (cum / principalAt) * 100 : null;
        return { id: t.id, date: t.date, delta, cum, pct };
      })
      .reverse();
  }, [yieldTxs, account, data.transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal title="Detalhes da conta" size="sm" onClose={onClose}
      footer={(close) => (<>
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Fechar</button>
        <button type="button" className="btn btn-primary" onClick={() => { close(); setTimeout(() => ui.open('account', { account }), 0); }}><Icon name="edit" size={16} />Editar</button>
      </>)}>
      <div className="view-amount"><Money cents={bal} tone="auto" /></div>
      <dl className="view-grid">
        <div><dt>Nome</dt><dd>{account.name}</dd></div>
        <div><dt>Tipo</dt><dd>{ACCOUNT_TYPES[account.type]}</dd></div>
        {isCard && (<>
          <div><dt>Limite</dt><dd>{fmtMoney(account.limit)}</dd></div>
          <div><dt>Fechamento</dt><dd>Dia {account.closingDay}</dd></div>
          <div><dt>Vencimento</dt><dd>Dia {account.dueDay}</dd></div>
        </>)}
        {isInvestment && (<>
          <div><dt>Total investido</dt><dd>{fmtMoney(principal)}</dd></div>
          <div><dt>Rendimento acumulado</dt><dd className={totalYield >= 0 ? 'pos' : 'neg'}>{fmtMoney(totalYield)}{yieldPct !== null ? ` (${yieldPct >= 0 ? '+' : ''}${yieldPct.toFixed(2)}%)` : ''}</dd></div>
          {lastUpdate && <div><dt>Última atualização</dt><dd>{fmtDate(lastUpdate)}</dd></div>}
        </>)}
        {account.archived && <div><dt>Situação</dt><dd><Tag tone="warn">Arquivada</Tag></dd></div>}
      </dl>
      {isInvestment && !!history.length && (
        <div className="yield-history">
          <h3 className="section-title">Histórico de rendimento</h3>
          <ul className="yield-history-list">
            {history.map((h) => (
              <li key={h.id}>
                <span>{fmtDate(h.date)}</span>
                <span className={h.delta >= 0 ? 'pos' : 'neg'}>{h.delta >= 0 ? '+' : ''}{fmtMoney(h.delta)}</span>
                <span className="muted">{h.pct !== null ? `${h.pct >= 0 ? '+' : ''}${h.pct.toFixed(2)}% acum.` : '—'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {isInvestment && !account.archived && (
        <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { onClose(); setTimeout(() => ui.open('yieldUpdate', { account, currentBalance: bal }), 0); }}>
          <Icon name="up" size={16} />Atualizar rendimento
        </button>
      )}
    </Modal>
  );
}

/* ---------- Rendimento (conta de investimento) ---------- */
export function YieldUpdateDialog({ account, currentBalance, onClose }) {
  const { upsert } = useStore();
  const [mode, setMode] = useState('total'); // 'total' | 'yield'
  const [total, setTotal] = useState(centsToField(currentBalance));
  const [yieldAmount, setYieldAmount] = useState('');
  const [loss, setLoss] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState({});
  const delta = mode === 'total' ? parseMoney(total) - currentBalance : parseMoney(yieldAmount) * (loss ? -1 : 1);
  return (
    <Modal title="Atualizar rendimento" size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {};
        if (!isValidISO(date)) e.date = 'Data inválida.';
        if (mode === 'total' && !(parseMoney(total) >= 0)) e.total = 'Informe o valor atual.';
        if (mode === 'yield' && !(parseMoney(yieldAmount) > 0)) e.yieldAmount = 'Informe quanto rendeu.';
        setErrors(e); if (hasErrors(e)) return;
        if (delta === 0) { toast('Sem variação desde a última atualização.'); close(); return; }
        upsert('transactions', { id: uid(), type: delta > 0 ? 'income' : 'expense', amount: Math.abs(delta), date, description: 'Rendimento', accountId: account.id, toAccountId: null, categoryId: null, isYield: true, notes: null, status: 'paid', createdAt: new Date().toISOString() });
        toast('Rendimento registrado.'); close();
      }}
      footer={(close) => (<><span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></>)}>
      <p className="muted">Saldo atual em <strong>{account.name}</strong>: {fmtMoney(currentBalance)}</p>
      <Choice name="yieldMode" value={mode} onChange={setMode} options={[{ value: 'total', label: 'Sei o valor total atual' }, { value: 'yield', label: 'Sei quanto rendeu' }]} />
      {mode === 'total'
        ? <Field label="Valor total hoje" error={errors.total}><MoneyInput value={total} onChange={setTotal} data-autofocus aria-label="Valor total hoje" /></Field>
        : (<>
            <div className="grid-2">
              <Field label="Quanto rendeu" error={errors.yieldAmount}><MoneyInput value={yieldAmount} onChange={setYieldAmount} data-autofocus aria-label="Quanto rendeu" /></Field>
              <label className="check inline"><input type="checkbox" checked={loss} onChange={(e) => setLoss(e.target.checked)} /><span>Foi perda (rendeu negativo)</span></label>
            </div>
          </>)}
      <Field label="Data" error={errors.date}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" /></Field>
      {parseMoney(mode === 'total' ? total : yieldAmount) > 0 && <p className="help">Rendimento calculado: <strong className={delta >= 0 ? 'pos' : 'neg'}>{fmtMoney(delta)}</strong></p>}
    </Modal>
  );
}

/* ---------- Lançamento ---------- */
export function TxDialog({ tx, preset = {}, onClose }) {
  const { data, upsert, remove, setViewMonth } = useStore();
  const ui = useUI();
  const src = tx || preset, editing = !!tx;
  const firstAccount = data.accounts.find((a) => !a.archived)?.id || '';
  const [type, setType] = useState(src.type || 'expense');
  const [description, setDescription] = useState(src.description || '');
  const [amount, setAmount] = useState(centsToField(src.amount));
  const [date, setDate] = useState(src.date || todayISO());
  const [accountId, setAccountId] = useState(src.accountId || firstAccount);
  const [toAccountId, setToAccountId] = useState(src.toAccountId || '');
  const [categoryId, setCategoryId] = useState(src.categoryId || '');
  const [paid, setPaid] = useState(src.status ? src.status !== 'pending' : true);
  const [notes, setNotes] = useState(src.notes || '');
  const [parcels, setParcels] = useState(1);
  const [errors, setErrors] = useState({});
  const account = data.accounts.find((a) => a.id === accountId);
  const onCard = account?.type === 'credit';
  const cents = parseMoney(amount);
  const changeType = (t) => { setType(t); setCategoryId(''); };

  const submit = (close) => {
    const e = {};
    if (!description.trim() && type !== 'transfer') e.description = 'Informe a descrição.';
    if (!(cents > 0)) e.amount = 'Informe um valor maior que zero.';
    if (!isValidISO(date)) e.date = 'Data inválida.';
    if (!accountId) e.accountId = 'Escolha a conta.';
    if (type === 'transfer') { if (!toAccountId) e.toAccountId = 'Escolha a conta de destino.'; else if (toAccountId === accountId) e.toAccountId = 'A conta de destino deve ser diferente da de origem.'; }
    else if (!categoryId) e.categoryId = 'Escolha a categoria.';
    setErrors(e);
    if (hasErrors(e)) return;
    const base = { type, description: description.trim() || 'Transferência', accountId, toAccountId: type === 'transfer' ? toAccountId : null, categoryId: type === 'transfer' ? null : categoryId, notes: notes.trim() || null };
    if (editing) upsert('transactions', { ...tx, ...base, amount: cents, date, status: paid ? 'paid' : 'pending' });
    else if (type === 'expense' && parcels > 1) {
      const group = uid(), parts = splitCents(cents, parcels);
      upsert('transactions', parts.map((v, i) => ({ ...base, id: uid(), amount: v, date: addMonthsISO(date, i), status: onCard || (i === 0 && paid) ? 'paid' : 'pending', installment: { group, number: i + 1, total: parcels }, description: `${base.description} (${i + 1}/${parcels})`, createdAt: new Date().toISOString() })));
    } else upsert('transactions', { ...base, id: uid(), amount: cents, date, status: paid ? 'paid' : 'pending', createdAt: new Date().toISOString() });
    setViewMonth(date.slice(0, 7));
    toast(editing ? 'Lançamento atualizado.' : parcels > 1 && type === 'expense' ? `${parcels} parcelas lançadas.` : 'Lançamento salvo.');
    close();
  };
  const del = async (close) => {
    const sib = tx.installment ? data.transactions.filter((x) => x.installment?.group === tx.installment.group) : [];
    const res = await ui.confirm({ title: 'Excluir lançamento', danger: true, okLabel: sib.length > 1 ? 'Só esta parcela' : 'Excluir', extraLabel: sib.length > 1 ? `Todas as ${sib.length} parcelas` : '',
      message: sib.length > 1 ? `“${tx.description}” faz parte de um parcelamento. Excluir só esta parcela ou todas?` : `“${tx.description}” (${fmtMoney(tx.amount)}) será excluído.` });
    if (!res) return;
    const removed = remove('transactions', res === 'extra' ? sib : [tx]); close();
    toast(removed.length > 1 ? `${removed.length} lançamentos excluídos.` : 'Lançamento excluído.', { ttl: 6000, action: { label: 'Desfazer', run: () => upsert('transactions', removed) } });
  };
  const title = `${editing ? 'Editar' : 'Novo'} lançamento`;
  return (
    <Modal title={title} onClose={onClose} onSubmit={submit}
      footer={(close) => (<>
        {editing && <button type="button" className="btn btn-danger-outline" onClick={() => del(close)}><Icon name="trash" />Excluir</button>}
        {editing && <button type="button" className="btn btn-secondary" onClick={() => { close(); setTimeout(() => ui.open('tx', { preset: { ...tx, id: undefined, date: todayISO(), installment: undefined, recurrenceId: undefined, recurrenceDate: undefined, externalId: undefined } }), 0); }}>Duplicar</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Choice name="txType" value={type} onChange={changeType} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }, { value: 'transfer', label: 'Transferência' }]} />
      <Field label="Descrição" error={errors.description}><input className="input" value={description} maxLength={80} onChange={(e) => setDescription(e.target.value)} data-autofocus placeholder={type === 'transfer' ? 'Opcional' : 'Ex.: Supermercado, Salário…'} aria-label="Descrição" /></Field>
      <div className="grid-2">
        <Field label="Valor" error={errors.amount}><MoneyInput value={amount} onChange={setAmount} aria-label="Valor" /></Field>
        <Field label="Data" error={errors.date}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" /></Field>
      </div>
      <div className="grid-2">
        <Field label={type === 'transfer' ? 'Conta de origem' : 'Conta'} error={errors.accountId}><AccountSelect value={accountId} onChange={setAccountId} aria-label="Conta" /></Field>
        {type === 'transfer'
          ? <Field label="Conta de destino" error={errors.toAccountId}><AccountSelect value={toAccountId} onChange={setToAccountId} exclude={[accountId]} aria-label="Conta de destino" /></Field>
          : <Field label="Categoria" error={errors.categoryId}><CategorySelect type={type} value={categoryId} onChange={setCategoryId} aria-label="Categoria" /></Field>}
      </div>
      {onCard && type === 'expense' && isValidISO(date) && <p className="help">Esta compra entra na fatura de {monthLabel(invoiceMonthOf(date, account.closingDay || 1))}.</p>}
      <label className="check"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /><span>{type === 'income' ? 'Já recebido' : type === 'transfer' ? 'Já realizada' : 'Já pago'}</span><small className="muted">Desmarque para lançar como previsto (aparece na Agenda).</small></label>
      {!editing && type === 'expense' && (
        <Field label="Parcelas" help={parcels > 1 && cents > 0 ? `${parcels}× de ${fmtMoney(splitCents(cents, parcels)[0])}${onCard ? ', todas na fatura do cartão' : '; as próximas ficam como previstas'}` : undefined}>
          <select className="select" value={parcels} onChange={(e) => setParcels(Number(e.target.value))} aria-label="Parcelas">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24, 36, 48].map((n) => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}×`}</option>)}
          </select>
        </Field>
      )}
      <Field label="Observações (opcional)"><textarea className="input" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Observações" /></Field>
      {tx?.recurrenceId && <p className="help">Vinculado a uma recorrência (Agenda).</p>}
    </Modal>
  );
}

/* ---------- Efetivar (pagar/receber) um item da Agenda ---------- */
export function SettleDialog({ item, onClose }) {
  const { upsert } = useStore();
  const isIncome = item.type === 'income';
  const [amount, setAmount] = useState(centsToField(item.amount));
  const [date, setDate] = useState(todayISO());
  const [accountId, setAccountId] = useState(item.accountId || '');
  const [errors, setErrors] = useState({});
  return (
    <Modal title={isIncome ? 'Efetivar recebimento' : 'Efetivar pagamento'} size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {}, cents = parseMoney(amount);
        if (!(cents > 0)) e.amount = 'Informe o valor.'; if (!isValidISO(date)) e.date = 'Data inválida.'; if (!accountId) e.accountId = 'Escolha a conta.';
        setErrors(e); if (hasErrors(e)) return;
        if (item.kind === 'occurrence') {
          const r = item.recurrence;
          upsert('transactions', { id: uid(), type: r.type, amount: cents, date, description: r.description, accountId, categoryId: r.categoryId, status: 'paid', notes: null, recurrenceId: r.id, recurrenceDate: item.date, createdAt: new Date().toISOString() });
        } else upsert('transactions', { ...item.tx, amount: cents, date, accountId, status: 'paid' });
        toast(isIncome ? 'Recebimento efetivado.' : 'Pagamento efetivado.'); close();
      }}
      footer={(close) => (<><span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">{isIncome ? 'Confirmar recebimento' : 'Confirmar pagamento'}</button></>)}>
      <p><strong>{item.description}</strong> · vencimento em {fmtDate(item.date)}</p>
      <div className="grid-2">
        <Field label="Valor" error={errors.amount}><MoneyInput value={amount} onChange={setAmount} data-autofocus aria-label="Valor" /></Field>
        <Field label={isIncome ? 'Data do recebimento' : 'Data do pagamento'} error={errors.date}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" /></Field>
      </div>
      <Field label={isIncome ? 'Conta que recebe' : 'Conta de onde sai'} error={errors.accountId}><AccountSelect value={accountId} onChange={setAccountId} aria-label="Conta" /></Field>
    </Modal>
  );
}

/* ---------- Conta ---------- */
export function AccountDialog({ account, onClose }) {
  const { data, upsert, remove } = useStore();
  const ui = useUI();
  const editing = !!account;
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState(account?.type || 'checking');
  const [balance, setBalance] = useState(centsToField(Math.abs(account?.initialBalance || 0)));
  const [negative, setNegative] = useState((account?.initialBalance || 0) < 0);
  const [limit, setLimit] = useState(centsToField(account?.limit));
  const [closingDay, setClosingDay] = useState(String(account?.closingDay || 10));
  const [dueDay, setDueDay] = useState(String(account?.dueDay || 17));
  const [errors, setErrors] = useState({});
  const used = editing && data.transactions.some((t) => t.accountId === account.id || t.toAccountId === account.id);
  const credit = type === 'credit';
  return (
    <Modal title={editing ? 'Editar conta' : 'Nova conta'} onClose={onClose}
      onSubmit={(close) => {
        const e = {};
        if (!name.trim()) e.name = 'Informe o nome da conta.';
        if (credit) { if (!(parseMoney(limit) > 0)) e.limit = 'Informe o limite do cartão.'; const c = Number(closingDay), d = Number(dueDay); if (!(c >= 1 && c <= 31)) e.closingDay = 'Dia entre 1 e 31.'; if (!(d >= 1 && d <= 31)) e.dueDay = 'Dia entre 1 e 31.'; }
        setErrors(e); if (hasErrors(e)) return;
        const bal = parseMoney(balance) * (negative ? -1 : 1);
        upsert('accounts', { ...(account || {}), id: account?.id || uid(), name: name.trim(), type, initialBalance: bal, archived: account?.archived || false, ...(credit ? { limit: parseMoney(limit), closingDay: Number(closingDay), dueDay: Number(dueDay) } : {}) });
        toast(editing ? 'Conta atualizada.' : 'Conta criada.'); close();
      }}
      footer={(close) => (<>
        {editing && !used && <button type="button" className="btn btn-danger-outline" onClick={async () => { if (await ui.confirm({ title: 'Excluir conta', danger: true, okLabel: 'Excluir', message: `“${account.name}” será excluída.` })) { remove('accounts', [account]); close(); toast('Conta excluída.'); } }}><Icon name="trash" />Excluir</button>}
        {editing && used && <button type="button" className="btn btn-secondary" onClick={() => { upsert('accounts', { ...account, archived: !account.archived }); close(); toast(account.archived ? 'Conta reativada.' : 'Conta arquivada.'); }}>{account.archived ? 'Reativar' : 'Arquivar'}</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Field label="Nome" error={errors.name}><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Banco X, Carteira, Cartão Y" data-autofocus aria-label="Nome" /></Field>
      <Field label="Tipo"><select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <div className="grid-2">
        <Field label={credit ? 'Dívida atual do cartão' : 'Saldo inicial'} help={credit ? 'Compras anteriores ainda não pagas (deixe zerado se não houver).' : 'Quanto havia na conta antes do primeiro lançamento.'}><MoneyInput value={balance} onChange={setBalance} aria-label="Saldo inicial" /></Field>
        <label className="check inline"><input type="checkbox" checked={negative} onChange={(e) => setNegative(e.target.checked)} /><span>Saldo negativo</span></label>
      </div>
      {credit && (<>
        <Field label="Limite" error={errors.limit}><MoneyInput value={limit} onChange={setLimit} aria-label="Limite" /></Field>
        <div className="grid-2">
          <Field label="Dia do fechamento" error={errors.closingDay}><input className="input" type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} aria-label="Dia do fechamento" /></Field>
          <Field label="Dia do vencimento" error={errors.dueDay}><input className="input" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} aria-label="Dia do vencimento" /></Field>
        </div>
      </>)}
    </Modal>
  );
}

/* ---------- Pagar fatura ---------- */
export function PayInvoiceDialog({ card, invoice, onClose }) {
  const { upsert } = useStore();
  const [origin, setOrigin] = useState('');
  const [amount, setAmount] = useState(centsToField(invoice.remaining));
  const [date, setDate] = useState(todayISO());
  const [errors, setErrors] = useState({});
  return (
    <Modal title="Pagar fatura" size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {}, cents = parseMoney(amount);
        if (!origin) e.origin = 'Escolha de qual conta sai o pagamento.'; if (!(cents > 0)) e.amount = 'Informe o valor.'; if (!isValidISO(date)) e.date = 'Data inválida.';
        setErrors(e); if (hasErrors(e)) return;
        upsert('transactions', { id: uid(), type: 'transfer', amount: cents, date, description: `Pagamento da fatura ${card.name} (${monthLabel(invoice.key)})`, accountId: origin, toAccountId: card.id, categoryId: null, status: 'paid', invoiceMonth: invoice.key, notes: null, createdAt: new Date().toISOString() });
        toast('Pagamento da fatura registrado.'); close();
      }}
      footer={(close) => (<><span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Confirmar pagamento</button></>)}>
      <p><strong>{card.name}</strong> · fatura de {monthLabel(invoice.key)} · vence em {fmtDate(invoice.dueDate)}<br />Restante: <strong>{fmtMoney(invoice.remaining)}</strong></p>
      <Field label="Pagar com a conta" error={errors.origin}><AccountSelect value={origin} onChange={setOrigin} only={(a) => a.type !== 'credit'} aria-label="Conta de origem" /></Field>
      <div className="grid-2">
        <Field label="Valor" error={errors.amount}><MoneyInput value={amount} onChange={setAmount} aria-label="Valor" /></Field>
        <Field label="Data" error={errors.date}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" /></Field>
      </div>
    </Modal>
  );
}

/* ---------- Recorrência ---------- */
export function RecurrenceDialog({ recurrence, onClose }) {
  const { data, upsert, remove } = useStore();
  const ui = useUI();
  const editing = !!recurrence;
  const [type, setType] = useState(recurrence?.type || 'expense');
  const [description, setDescription] = useState(recurrence?.description || '');
  const [amount, setAmount] = useState(centsToField(recurrence?.amount));
  const [accountId, setAccountId] = useState(recurrence?.accountId || data.accounts.find((a) => !a.archived && a.type !== 'credit')?.id || '');
  const [categoryId, setCategoryId] = useState(recurrence?.categoryId || '');
  const [freq, setFreq] = useState(recurrence?.freq || 'monthly');
  const [day, setDay] = useState(String(recurrence?.day ?? new Date().getDate()));
  const [start, setStart] = useState(recurrence?.startMonth || monthKey(new Date()));
  const [end, setEnd] = useState(recurrence?.endMonth || '');
  const [active, setActive] = useState(recurrence?.active !== false);
  const [errors, setErrors] = useState({});
  return (
    <Modal title={editing ? 'Editar recorrência' : 'Nova recorrência'} onClose={onClose}
      onSubmit={(close) => {
        const e = {}, cents = parseMoney(amount);
        if (!description.trim()) e.description = 'Informe a descrição.'; if (!(cents > 0)) e.amount = 'Informe o valor.'; if (!accountId) e.accountId = 'Escolha a conta.'; if (!categoryId) e.categoryId = 'Escolha a categoria.';
        if (freq !== 'weekly' && !(Number(day) >= 1 && Number(day) <= 31)) e.day = 'Dia entre 1 e 31.';
        if (end && end < start) e.end = 'O fim não pode ser antes do início.';
        setErrors(e); if (hasErrors(e)) return;
        upsert('recurrences', { ...(recurrence || {}), id: recurrence?.id || uid(), type, description: description.trim(), amount: cents, accountId, categoryId, freq, day: Number(day), startMonth: start, endMonth: end || null, active });
        toast(editing ? 'Recorrência atualizada.' : 'Recorrência criada.'); close();
      }}
      footer={(close) => (<>
        {editing && <button type="button" className="btn btn-danger-outline" onClick={async () => { if (await ui.confirm({ title: 'Excluir recorrência', danger: true, okLabel: 'Excluir', message: `“${recurrence.description}” deixa de gerar vencimentos. Os lançamentos já efetivados continuam.` })) { remove('recurrences', [recurrence]); close(); toast('Recorrência excluída.'); } }}><Icon name="trash" />Excluir</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Choice name="recType" value={type} onChange={(t) => { setType(t); setCategoryId(''); }} options={[{ value: 'expense', label: 'Conta a pagar' }, { value: 'income', label: 'Conta a receber' }]} />
      <Field label="Descrição" error={errors.description}><input className="input" value={description} maxLength={60} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Aluguel, Internet, Salário" data-autofocus aria-label="Descrição" /></Field>
      <div className="grid-2">
        <Field label="Valor" error={errors.amount}><MoneyInput value={amount} onChange={setAmount} aria-label="Valor" /></Field>
        <Field label="Frequência"><select className="select" value={freq} onChange={(e) => { setFreq(e.target.value); setDay(e.target.value === 'weekly' ? '1' : String(new Date().getDate())); }} aria-label="Frequência">{Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
      <div className="grid-2">
        <Field label="Conta" error={errors.accountId}><AccountSelect value={accountId} onChange={setAccountId} aria-label="Conta" /></Field>
        <Field label="Categoria" error={errors.categoryId}><CategorySelect type={type} value={categoryId} onChange={setCategoryId} aria-label="Categoria" /></Field>
      </div>
      {freq === 'weekly'
        ? <Field label="Dia da semana"><select className="select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Dia da semana">{WEEKDAY_OPTIONS.map((w, i) => <option key={w} value={i}>{w}</option>)}</select></Field>
        : <Field label="Dia do vencimento" error={errors.day} help="Em meses curtos vale o último dia."><input className="input" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} aria-label="Dia do vencimento" /></Field>}
      <div className="grid-2">
        <Field label="Começa em"><input className="input" type="month" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Começa em" /></Field>
        <Field label="Termina em (opcional)" error={errors.end}><input className="input" type="month" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Termina em" /></Field>
      </div>
      {editing && <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /><span>Recorrência ativa</span><small className="muted">Desmarque para pausar sem apagar.</small></label>}
    </Modal>
  );
}

/* ---------- Orçamento ---------- */
export function BudgetDialog({ categoryId: editing, presetCategory, onClose }) {
  const { data, upsert, remove } = useStore();
  const ui = useUI();
  const cur = data.budgets.find((b) => b.categoryId === editing);
  const [categoryId, setCategoryId] = useState(editing || presetCategory || '');
  const [amount, setAmount] = useState(centsToField(cur?.amount));
  const [errors, setErrors] = useState({});
  const taken = data.budgets.map((b) => b.categoryId);
  return (
    <Modal title={editing ? 'Editar orçamento' : 'Novo orçamento'} size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {}, cents = parseMoney(amount);
        if (!categoryId) e.categoryId = 'Escolha a categoria.'; if (!(cents > 0)) e.amount = 'Informe um limite maior que zero.';
        setErrors(e); if (hasErrors(e)) return;
        upsert('budgets', { id: categoryId, categoryId, amount: cents }); toast('Orçamento salvo.'); close();
      }}
      footer={(close) => (<>
        {editing && <button type="button" className="btn btn-danger-outline" onClick={async () => { if (await ui.confirm({ title: 'Remover orçamento', danger: true, okLabel: 'Remover', message: 'O limite será removido. Os lançamentos continuam intactos.' })) { remove('budgets', [cur]); close(); toast('Orçamento removido.'); } }}><Icon name="trash" />Remover</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Field label="Categoria" error={errors.categoryId} help="Um orçamento no grupo (ex.: Moradia) soma todas as subcategorias."><CategorySelect type="expense" value={categoryId} onChange={setCategoryId} exclude={taken.filter((t) => t !== editing)} data-autofocus aria-label="Categoria" /></Field>
      <Field label="Limite mensal" error={errors.amount}><MoneyInput value={amount} onChange={setAmount} aria-label="Limite mensal" /></Field>
    </Modal>
  );
}

/* ---------- Categoria e regra ---------- */
const CATEGORY_COLORS = ['#2f5fc4', '#0f8a6a', '#b5651d', '#7a4fb0', '#c2410c', '#0e7490', '#a23b72', '#4d7c0f', '#64748b'];
export function CategoryDialog({ category, presetParent, presetType = 'expense', onClose }) {
  const { data, upsert, remove } = useStore();
  const ui = useUI();
  const editing = !!category;
  const parent0 = category?.parentId || presetParent || '';
  const [name, setName] = useState(category?.name || '');
  const [type, setType] = useState(category?.type || (parent0 ? data.categories.find((c) => c.id === parent0)?.type : presetType) || 'expense');
  const [parentId, setParentId] = useState(parent0);
  const [color, setColor] = useState(category?.color || CATEGORY_COLORS[data.categories.filter((c) => !c.parentId).length % CATEGORY_COLORS.length]);
  const [archived, setArchived] = useState(!!category?.archived);
  const [errors, setErrors] = useState({});
  const roots = data.categories.filter((c) => !c.parentId && c.type === type && c.id !== category?.id);
  const hasKids = editing && data.categories.some((c) => c.parentId === category.id);
  const inUse = editing && (data.transactions.some((t) => t.categoryId === category.id) || data.budgets.some((b) => b.categoryId === category.id) || data.rules.some((r) => r.categoryId === category.id) || data.recurrences.some((r) => r.categoryId === category.id));
  return (
    <Modal title={editing ? 'Editar categoria' : 'Nova categoria'} size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {};
        if (!name.trim()) e.name = 'Informe o nome.';
        else if (data.categories.some((c) => c.id !== category?.id && c.type === type && c.parentId === (parentId || null) && c.name.toLowerCase() === name.trim().toLowerCase())) e.name = 'Já existe uma categoria com esse nome aqui.';
        setErrors(e); if (hasErrors(e)) return;
        const parent = data.categories.find((c) => c.id === parentId);
        upsert('categories', { ...(category || {}), id: category?.id || uid(), name: name.trim(), type: parent ? parent.type : type, parentId: parentId || null, color: parent ? parent.color : color, archived });
        toast(editing ? 'Categoria atualizada.' : 'Categoria criada.'); close();
      }}
      footer={(close) => (<>
        {editing && !inUse && !hasKids && <button type="button" className="btn btn-danger-outline" onClick={async () => { if (await ui.confirm({ title: 'Excluir categoria', danger: true, okLabel: 'Excluir', message: `“${category.name}” será excluída.` })) { remove('categories', [category]); close(); toast('Categoria excluída.'); } }}><Icon name="trash" />Excluir</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Field label="Nome" error={errors.name}><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-autofocus aria-label="Nome da categoria" /></Field>
      {!editing && !presetParent && <Choice name="catType" value={type} onChange={(t) => { setType(t); setParentId(''); }} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />}
      <Field label="Grupo (categoria pai)" help={hasKids ? 'Esta categoria tem subcategorias e por isso é um grupo.' : 'Deixe em branco para criar um grupo novo.'}>
        <select className="select" value={parentId} disabled={hasKids} onChange={(e) => setParentId(e.target.value)} aria-label="Grupo"><option value="">— Nenhum (é um grupo) —</option>{roots.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </Field>
      {!parentId && <div className="field"><span className="label">Cor</span><div className="swatches">{CATEGORY_COLORS.map((c) => <button key={c} type="button" className={c === color ? 'swatch on' : 'swatch'} style={{ background: c }} aria-label={`Cor ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} />)}</div></div>}
      {editing && <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /><span>Arquivada</span><small className="muted">Some das listas de escolha; o histórico continua.</small></label>}
    </Modal>
  );
}
export function RuleDialog({ rule, onClose }) {
  const { upsert, remove } = useStore();
  const editing = !!rule;
  const [contains, setContains] = useState(rule?.contains || '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId || '');
  const [errors, setErrors] = useState({});
  return (
    <Modal title={editing ? 'Editar regra' : 'Nova regra'} size="sm" onClose={onClose}
      onSubmit={(close) => {
        const e = {}; if (!contains.trim()) e.contains = 'Informe o texto.'; if (!categoryId) e.categoryId = 'Escolha a categoria.';
        setErrors(e); if (hasErrors(e)) return;
        upsert('rules', { ...(rule || {}), id: rule?.id || uid(), contains: contains.trim(), categoryId }); toast('Regra salva.'); close();
      }}
      footer={(close) => (<>
        {editing && <button type="button" className="btn btn-danger-outline" onClick={() => { remove('rules', [rule]); close(); toast('Regra excluída.'); }}><Icon name="trash" />Excluir</button>}
        <span className="grow" /><button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button>
      </>)}>
      <Field label="Se a descrição contiver" error={errors.contains} help="Sem diferença entre maiúsculas, minúsculas e acentos."><input className="input" value={contains} onChange={(e) => setContains(e.target.value)} placeholder="Ex.: uber, netflix, posto" data-autofocus aria-label="Texto" /></Field>
      <Field label="Usar a categoria" error={errors.categoryId}><CategorySelect value={categoryId} onChange={setCategoryId} aria-label="Categoria da regra" /></Field>
    </Modal>
  );
}

