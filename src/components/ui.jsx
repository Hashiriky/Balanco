'use client';
// Peças reutilizáveis da interface (visual sóbrio, sem efeitos).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store.jsx';
import { cn, fmtMoney, maskMoney, monthKey, monthLabel, shiftMonth } from '@/lib/util.js';

const PATHS = {
  panel: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z', list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18', target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
  chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8', more: 'M5 12h.01M12 12h.01M19 12h.01', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z', trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', download: 'M12 4v11M7 11l5 5 5-5M4 20h16', upload: 'M12 16V5M7 9l5-5 5 5M4 20h16',
  check: 'M5 12.5l4.5 4.5L19 7.5', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17h.01', up: 'M12 19V5M6 11l6-6 6 6', down: 'M12 5v14M6 13l6 6 6-6', logout: 'M9 4H5v16h4M16 8l4 4-4 4M10 12h10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6', card: 'M3 6h18v12H3zM3 10h18M6 15h4', swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7', file: 'M6 3h8l4 4v14H6zM14 3v4h4',
};
export function Icon({ name, size = 18, className }) {
  return <svg className={cn('icon', className)} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name] || ''} /></svg>;
}

/** valor em reais a partir de centavos; tone: 'auto' colore pelo sinal */
export function Money({ cents, tone, sign = false, className }) {
  const v = Number(cents) || 0;
  const color = tone === 'auto' ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : tone === 'income' ? 'pos' : tone === 'expense' ? 'neg' : '';
  return <span className={cn('num', color, className)}>{sign && v > 0 ? '+' : ''}{fmtMoney(v)}</span>;
}

export function MoneyInput({ value, onChange, ...rest }) {
  return (
    <div className="money-input">
      <span>R$</span>
      <input inputMode="numeric" placeholder="0,00" value={value} onChange={(e) => onChange(maskMoney(e.target.value))} onFocus={(e) => e.target.select()} {...rest} />
    </div>
  );
}
export function Field({ label, error, help, children, className }) {
  return (
    <label className={cn('field', error && 'has-error', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="error" role="alert">{error}</span> : help ? <span className="help">{help}</span> : null}
    </label>
  );
}
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={cn('tab', value === t.value && 'on')} onClick={() => onChange(t.value)}>{t.label}</button>)}
    </div>
  );
}
/** escolha entre poucas opções (ex.: Despesa / Receita / Transferência) */
export function Choice({ options, value, onChange, name }) {
  return (
    <div className="choice" role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={cn(value === o.value && 'on')}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} /><span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size = 'md', onSubmit }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) { d.showModal(); d.querySelector('[data-autofocus]')?.focus({ preventScroll: true }); } }, []);
  const down = useRef(false);
  const close = useCallback(() => onClose(), [onClose]);
  const Tag = onSubmit ? 'form' : 'div';
  return (
    <dialog ref={ref} className={cn('modal', `modal-${size}`)} aria-label={title} onCancel={(e) => { e.preventDefault(); close(); }}
      onMouseDown={(e) => { down.current = e.target === ref.current; }} onClick={(e) => { if (e.target === ref.current && down.current) close(); }}>
      <Tag className="modal-in" {...(onSubmit ? { onSubmit: (e) => { e.preventDefault(); onSubmit(close); }, autoComplete: 'off', noValidate: true } : {})}>
        <header className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><Icon name="x" /></button></header>
        <div className="modal-body">{typeof children === 'function' ? children(close) : children}</div>
        {footer && <footer className="modal-foot">{typeof footer === 'function' ? footer(close) : footer}</footer>}
      </Tag>
    </dialog>
  );
}

export function MonthNav() {
  const { viewMonth, setViewMonth } = useStore();
  const now = monthKey(new Date());
  return (
    <div className="month-nav" role="group" aria-label="Mês">
      <button type="button" className="icon-btn" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} aria-label="Mês anterior"><Icon name="left" /></button>
      <strong aria-live="polite">{monthLabel(viewMonth)}</strong>
      <button type="button" className="icon-btn" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} aria-label="Próximo mês"><Icon name="right" /></button>
      {viewMonth !== now && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewMonth(now)}>Mês atual</button>}
    </div>
  );
}
export function PageHeader({ title, subtitle, month = false, children }) {
  return (
    <header className="page-header">
      <div><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      <div className="page-actions">{month && <MonthNav />}{children}</div>
    </header>
  );
}
export const Card = ({ title, actions, children, className, flush }) => (
  <section className={cn('card', className)}>
    {(title || actions) && <header className="card-head"><h2>{title}</h2>{actions && <div className="card-actions">{actions}</div>}</header>}
    <div className={cn('card-body', flush && 'flush')}>{children}</div>
  </section>
);
export const Kpi = ({ label, value, sub, tone }) => <div className="kpi"><span className="kpi-label">{label}</span><strong className={cn('kpi-value', tone)}>{value}</strong>{sub && <span className="kpi-sub">{sub}</span>}</div>;
export const Empty = ({ title, text, action }) => <div className="empty"><strong>{title}</strong>{text && <p>{text}</p>}{action}</div>;
export const Alert = ({ tone = 'info', children, action }) => <div className={cn('alert', `alert-${tone}`)} role={tone === 'danger' ? 'alert' : 'status'}><Icon name="alert" /><span>{children}</span>{action}</div>;
export const Tag = ({ tone, children }) => <span className={cn('tag', tone && `tag-${tone}`)}>{children}</span>;
export const ProgressBar = ({ pct, level }) => <div className={cn('progress', level && `progress-${level}`)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>;
export function Pagination({ page, pages, onPage, total, size }) {
  if (pages <= 1) return <div className="pagination"><span className="muted">{total} registro{total === 1 ? '' : 's'}</span></div>;
  return (
    <div className="pagination">
      <span className="muted">{(page - 1) * size + 1}–{Math.min(page * size, total)} de {total}</span>
      <div><button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
        <span className="page-num">Página {page} de {pages}</span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Próxima</button></div>
    </div>
  );
}
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const on = (e) => {
      const id = Math.random().toString(36).slice(2), t = { id, ...e.detail };
      setItems((l) => [...l.slice(-3), t]);
      setTimeout(() => setItems((l) => l.filter((x) => x.id !== id)), t.ttl);
    };
    window.addEventListener('fh-toast', on);
    return () => window.removeEventListener('fh-toast', on);
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={cn('toast', t.type === 'err' && 'toast-err')} role={t.type === 'err' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          {t.action && <button type="button" onClick={() => { t.action.run(); setItems((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          <button type="button" className="toast-x" aria-label="Fechar aviso" onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
