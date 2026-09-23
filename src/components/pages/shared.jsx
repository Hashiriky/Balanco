'use client';
import { useMemo } from 'react';
import { Icon, Money, Tag } from '@/components/ui.jsx';
import { categoryIndex, categoryPath, rootOf } from '@/lib/domain.js';
import { useStore } from '@/lib/store.jsx';
import { fmtDate } from '@/lib/util.js';

export function useLookups() {
  const { data } = useStore();
  return useMemo(() => ({ acc: new Map(data.accounts.map((a) => [a.id, a])), cat: categoryIndex(data.categories) }), [data.accounts, data.categories]);
}
export function CategoryLabel({ id, lk }) {
  const c = lk.cat.get(id); const root = c ? rootOf(id, lk.cat) : null;
  return <span className="cat-label"><i className="dot" style={{ background: root?.color || '#94a3b8' }} />{categoryPath(id, lk.cat)}</span>;
}
export const AccountName = ({ id, lk }) => lk.acc.get(id)?.name || '—';
export function TxAmount({ t }) {
  if (t.type === 'transfer') return <span className="num muted">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.amount / 100)}</span>;
  return <Money cents={t.type === 'income' ? t.amount : -t.amount} tone="auto" />;
}
export const StatusTag = ({ t, today }) => (t.status === 'pending' ? <Tag tone={t.date < today ? 'danger' : 'warn'}>{t.date < today ? 'Atrasado' : 'Previsto'}</Tag> : <Tag tone="ok">Realizado</Tag>);
export function TxDescription({ t, lk }) {
  return (
    <span className="tx-desc">
      {t.type === 'transfer' && <Icon name="swap" size={14} className="muted" />}
      <span>{t.description}{t.type === 'transfer' && <small className="muted"> ({lk.acc.get(t.accountId)?.name || '?'} → {lk.acc.get(t.toAccountId)?.name || '?'})</small>}</span>
    </span>
  );
}
export { fmtDate };
