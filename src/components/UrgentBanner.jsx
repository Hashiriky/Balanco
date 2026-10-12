'use client';
// Faixa vermelha no topo de TODAS as telas quando há algo urgente: fatura ou conta que vence hoje, ou em atraso.
// "Dispensar por hoje" esconde a faixa até o dia seguinte (ou até aparecer um aviso urgente novo).
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/ui.jsx';
import { buildAlerts } from '@/lib/domain.js';
import { announceHash } from '@/lib/focus.js';
import { useStore } from '@/lib/store.jsx';
import { fmtMoney, todayISO } from '@/lib/util.js';

const KEY = 'balanco.urgentDismissed';

export default function UrgentBanner() {
  const { data } = useStore();
  const today = todayISO();
  const [dismissed, setDismissed] = useState('');
  useEffect(() => { try { setDismissed(localStorage.getItem(KEY) || ''); } catch { /* ignore */ } }, []);
  const urgent = useMemo(
    () => buildAlerts({ accounts: data.accounts, txs: data.transactions, recurrences: data.recurrences, budgets: data.budgets, categories: data.categories, today }).filter((a) => a.urgent),
    [data.accounts, data.transactions, data.recurrences, data.budgets, data.categories, today],
  );
  const signature = `${today}|${urgent.map((a) => a.id).join(',')}`;
  if (!urgent.length || dismissed === signature) return null;
  const dismiss = () => { setDismissed(signature); try { localStorage.setItem(KEY, signature); } catch { /* ignore */ } };
  return (
    <section className="urgent-banner" role="alert" aria-label="Avisos urgentes">
      <ul>
        {urgent.map((a) => (
          <li key={a.id}>
            <Icon name="alert" size={20} />
            <span className="urgent-text">{a.text}{a.value ? <strong> · {fmtMoney(a.value)}</strong> : null}</span>
            <Link href={a.href} className="urgent-link" onClick={() => announceHash(a.href)}>Ver</Link>
          </li>
        ))}
      </ul>
      <button type="button" className="urgent-dismiss" onClick={dismiss}>Dispensar por hoje</button>
    </section>
  );
}
