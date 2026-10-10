'use client';
// Seletor de período: um botão que mostra o período atual e abre uma janela com atalhos prontos
// (Hoje, Mês passado, Últimos 12 meses…) e um calendário para escolher um intervalo.
// Nada muda na tela até clicar em "Aplicar".
import { useState } from 'react';
import { Icon, Modal } from '@/components/ui.jsx';
import { ALL_PRESETS, PRESETS, WEEKDAYS, clickDay, daysIn, datesText, inRange, monthGrid, orderRange, periodLabel, presetOf, presetRange, sameRange } from '@/lib/period.js';
import { MONTHS, cn, fmtDate, isValidISO, todayISO } from '@/lib/util.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const viewOf = (iso) => { const [y, m] = (iso || todayISO()).split('-').map(Number); return { y, m: m - 1 }; };

/**
 * value: { from, to } (datas ISO; os dois nulos = todo o período) · onChange({ from, to })
 * presets: quais atalhos mostrar, na ordem · onReset/resetLabel: botão "voltar ao padrão" da tela
 */
export default function PeriodPicker({ value, onChange, presets = ALL_PRESETS, onReset, resetLabel = 'Redefinir', ariaLabel = 'Período' }) {
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [view, setView] = useState(viewOf(value.to || value.from));

  const openIt = () => { setDraft(value); setView(viewOf(value.to || value.from)); setOpen(true); };
  const isAll = !draft.from && !draft.to;
  const pick = (id) => { const r = presetRange(id, today); setDraft(r); setView(viewOf(r.to || r.from)); };
  const apply = () => { onChange(isAll ? { from: null, to: null } : orderRange({ from: draft.from, to: draft.to ?? draft.from })); setOpen(false); };
  const shift = (n) => setView(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const typed = (field, v) => {
    if (v === '') { setDraft((d) => ({ ...d, [field]: null })); return; }
    if (!isValidISO(v)) return;
    setDraft((d) => ({ ...d, [field]: v })); setView(viewOf(v));
  };
  const years = [...new Set([...Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - 6 + i), view.y])].sort();
  const label = periodLabel(value, today, presets);
  const named = presetOf(value, today, presets);
  const summary = isAll ? 'Todo o período' : draft.to || !draft.from ? datesText(draft) : `${fmtDate(draft.from)} · escolha o dia final (ou aplique para usar só este dia)`;
  const n = daysIn(isAll ? { from: null, to: null } : { from: draft.from, to: draft.to ?? draft.from });

  return (
    <>
      <button type="button" className="btn btn-secondary period-btn" onClick={openIt} aria-haspopup="dialog" aria-label={`${ariaLabel}: ${label}`}>
        <Icon name="calendar" size={16} />
        <span className="period-btn-label">{label}</span>
        {named && named !== 'all' && <small className="muted period-btn-dates">{datesText(value)}</small>}
      </button>
      {open && (
        <Modal title="Escolher período" size="lg" onClose={() => setOpen(false)}
          footer={(close) => (<>
            {onReset && <button type="button" className="btn btn-ghost" onClick={() => { onReset(); close(); }}>{resetLabel}</button>}
            <span className="grow" />
            <button type="button" className="btn btn-secondary" onClick={close}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={apply} disabled={!isAll && !draft.from && !draft.to}>Aplicar</button>
          </>)}>
          <div className="period-summary" aria-live="polite">
            <strong>{summary}</strong>
            {n && <span className="muted">{n} dia{n === 1 ? '' : 's'}</span>}
          </div>
          <div className="period-layout">
            <div className="period-presets" role="group" aria-label="Atalhos">
              {presets.map((id) => (
                <button key={id} type="button" className={cn('period-chip', sameRange(presetRange(id, today), draft) && 'on')} aria-pressed={sameRange(presetRange(id, today), draft)} onClick={() => pick(id)}>{PRESETS[id]}</button>
              ))}
            </div>
            <div className="period-cal">
              <div className="cal-nav">
                <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Mês anterior"><Icon name="left" /></button>
                <select className="select" value={view.m} onChange={(e) => setView({ ...view, m: Number(e.target.value) })} aria-label="Mês">{MONTHS.map((name, i) => <option key={name} value={i}>{cap(name)}</option>)}</select>
                <select className="select cal-year" value={view.y} onChange={(e) => setView({ ...view, y: Number(e.target.value) })} aria-label="Ano">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Próximo mês"><Icon name="right" /></button>
              </div>
              <div className="cal-week" aria-hidden="true">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>
              <div className="cal-grid">
                {monthGrid(view.y, view.m).map((c) => {
                  const edge = !isAll && (c.iso === draft.from || c.iso === draft.to);
                  const mid = !isAll && !edge && inRange(c.iso, draft.from, draft.to);
                  return (
                    <button key={c.iso} type="button" className={cn('cal-day', edge && 'edge', mid && 'mid', !c.inMonth && 'out', c.iso === today && 'today')} aria-pressed={edge}
                      aria-label={new Date(`${c.iso}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'full' })} onClick={() => setDraft((d) => clickDay(isAll ? { from: null, to: null } : d, c.iso))}>{c.day}</button>
                  );
                })}
              </div>
              <p className="help">Para um intervalo seu: clique no dia inicial e depois no dia final.</p>
              <div className="grid-2 cal-typed">
                <label className="field"><span className="label">De</span><input className="input" type="date" value={draft.from || ''} onChange={(e) => typed('from', e.target.value)} aria-label="Data inicial" /></label>
                <label className="field"><span className="label">Até</span><input className="input" type="date" value={draft.to || ''} onChange={(e) => typed('to', e.target.value)} aria-label="Data final" /></label>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
