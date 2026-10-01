'use client';
// Gráficos em SVG no tamanho real da tela (texto legível), com valores à vista e dica instantânea ao passar o mouse / tocar.
import { useLayoutEffect, useRef, useState } from 'react';
import { cn, fmtMoney, monthLabel, monthShort } from '@/lib/util.js';

const niceMax = (v) => { if (v <= 0) return 100; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x >= n) || 10) * p; };
const short = (c) => { const v = Math.abs(c) / 100; const s = v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)} mil` : `${v.toFixed(0)}`; return (c < 0 ? '−' : '') + s.replace('.', ','); };
const signed = (c) => `${c > 0 ? '+' : c < 0 ? '−' : ''}${short(c).replace('−', '')}`;
const tone = (c) => (c > 0 ? 'pos' : c < 0 ? 'neg' : 'muted');

/** largura real do contêiner (o gráfico é desenhado nesse tamanho, então a fonte não encolhe) */
function useWidth() {
  const ref = useRef(null); const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    setW(Math.round(el.clientWidth));
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w];
}
function Tip({ x, half = 0, width, top = 4, children }) {
  const TW = 210, GAP = 10;
  /* fica ao lado da coluna destacada, pra não tampar as barras; vira pro lado esquerdo se não couber */
  const left = x + half + GAP + TW <= width ? x + half + GAP : Math.max(0, x - half - GAP - TW);
  return <div className="chart-tip" style={{ left, top, width: TW }} role="status">{children}</div>;
}

/** barras agrupadas: receitas × despesas por mês */
export function BarChart({ series, height = 330 }) {
  const [ref, W] = useWidth(); const [act, setAct] = useState(null);
  const L = 58, R = 10, T = 22, B = 92, H = height, w = W - L - R, h = H - B - T;
  const n = series.length, slot = w / n, bw = Math.min(28, slot / 2.5);
  const max = niceMax(Math.max(...series.flatMap((s) => [s.income, s.expense]), 1));
  const y = (v) => T + h - (v / max) * h;
  const pick = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.floor((e.clientX - r.left - L) / slot); setAct(i >= 0 && i < n ? i : null); };
  const showVals = slot >= 96; // com pouco espaço os valores ficam nas linhas abaixo dos meses
  const a = act !== null ? series[act] : null;
  return (
    <div className="chart-box" ref={ref} style={{ minHeight: H }}>
      {W > 0 && (
        <svg className="chart" width={W} height={H} role="img" aria-label="Receitas e despesas por mês, com o resultado de cada mês" onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setAct(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="grid" /><text x={L - 8} y={y(max * f) + 4} className="axis" textAnchor="end">{short(max * f)}</text></g>)}
          <text x={L - 8} y={T + h + 38} className="axis axis-res" textAnchor="end">Receitas</text>
          <text x={L - 8} y={T + h + 56} className="axis axis-res" textAnchor="end">Despesas</text>
          <text x={L - 8} y={T + h + 74} className="axis axis-res" textAnchor="end">Resultado</text>
          {series.map((s, i) => {
            const cx = L + slot * i + slot / 2, res = s.income - s.expense, on = act === i;
            return (
              <g key={s.key}>
                {on && <rect x={L + slot * i} y={T - 6} width={slot} height={h + 6 + 78} className="chart-band" />}
                <rect x={cx - bw - 1} y={y(s.income)} width={bw} height={Math.max(0, T + h - y(s.income))} rx="2" className="bar-inc" />
                <rect x={cx + 1} y={y(s.expense)} width={bw} height={Math.max(0, T + h - y(s.expense))} rx="2" className="bar-exp" />
                {showVals && s.income > 0 && <text x={cx - bw / 2 - 1} y={y(s.income) - 5} className="val val-inc" textAnchor="middle">{short(s.income)}</text>}
                {showVals && s.expense > 0 && <text x={cx + bw / 2 + 1} y={y(s.expense) - 5} className="val val-exp" textAnchor="middle">{short(s.expense)}</text>}
                <text x={cx} y={T + h + 20} className={cn('axis', on && 'axis-on')} textAnchor="middle">{monthShort(s.key)}</text>
                <text x={cx} y={T + h + 38} className="val val-inc" textAnchor="middle">{short(s.income)}</text>
                <text x={cx} y={T + h + 56} className="val val-exp" textAnchor="middle">{short(s.expense)}</text>
                <text x={cx} y={T + h + 74} className={cn('val', `val-${tone(res)}`)} textAnchor="middle">{res === 0 ? '0' : signed(res)}</text>
              </g>
            );
          })}
        </svg>
      )}
      {a && (
        <Tip x={L + slot * act + slot / 2} half={slot / 2} width={W}>
          <strong>{monthLabel(a.key)}</strong>
          <div className="tip-row"><span><i className="sw inc" />Receitas</span><b className="num">{fmtMoney(a.income)}</b></div>
          <div className="tip-row"><span><i className="sw exp" />Despesas</span><b className="num">{fmtMoney(a.expense)}</b></div>
          <div className="tip-row tip-total"><span>Resultado</span><b className={cn('num', tone(a.income - a.expense))}>{fmtMoney(a.income - a.expense)}</b></div>
        </Tip>
      )}
    </div>
  );
}

/** linha: evolução ao longo do tempo (patrimônio, rendimento acumulado…) */
export function LineChart({ points, height = 300, label = 'Evolução do patrimônio', valueLabel = 'Valor' }) {
  const [ref, W] = useWidth(); const [act, setAct] = useState(null);
  const L = 66, R = 30, T = 26, B = 34, H = height, w = W - L - R, h = H - B - T;
  const vals = points.map((p) => p.value), lo = Math.min(...vals, 0), hi = Math.max(...vals, 1), span = niceMax(hi - lo) || 100;
  const min = lo < 0 ? -niceMax(-lo) : 0, max = Math.max(min + span, hi);
  const n = points.length, step = n > 1 ? w / (n - 1) : w;
  const x = (i) => L + (n === 1 ? w / 2 : step * i), y = (v) => T + h - ((v - min) / (max - min || 1)) * h;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const pick = (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round((e.clientX - r.left - L) / (step || 1)); setAct(Math.min(n - 1, Math.max(0, i))); };
  const showAll = step >= 58;
  const a = act !== null ? points[act] : null, prev = act > 0 ? points[act - 1] : null;
  return (
    <div className="chart-box" ref={ref} style={{ minHeight: H }}>
      {W > 0 && (
        <svg className="chart" width={W} height={H} role="img" aria-label={label} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setAct(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = min + (max - min) * f; return <g key={f}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} className="axis" textAnchor="end">{short(v)}</text></g>; })}
          {a && <line x1={x(act)} x2={x(act)} y1={T - 8} y2={T + h} className="chart-cross" />}
          <path d={path} className="line" fill="none" />
          {points.map((p, i) => {
            const on = act === i, last = i === n - 1;
            return (
              <g key={p.key}>
                <circle cx={x(i)} cy={y(p.value)} r={on ? 6.5 : 4.5} className="dot" />
                {(showAll || last || on) && <text x={x(i)} y={y(p.value) - 11} className={cn('val', 'val-line', on && 'val-on')} textAnchor="middle">{short(p.value)}</text>}
                {(showAll || on || last || i === 0) && <text x={x(i)} y={H - 10} className={cn('axis', on && 'axis-on')} textAnchor="middle">{monthShort(p.key)}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {a && (
        <Tip x={x(act)} half={6} width={W}>
          <strong>{monthLabel(a.key)}</strong>
          <div className="tip-row tip-total"><span>{valueLabel}</span><b className="num">{fmtMoney(a.value)}</b></div>
          {prev && <div className="tip-row"><span>Vs. mês anterior</span><b className={cn('num', tone(a.value - prev.value))}>{a.value - prev.value > 0 ? '+' : ''}{fmtMoney(a.value - prev.value)}</b></div>}
        </Tip>
      )}
    </div>
  );
}
/** barras horizontais: ranking de categorias */
export function HBars({ items, total }) {
  return (
    <ul className="hbars">
      {items.map((it) => (
        <li key={it.id}>
          <div className="hbar-top"><span><i className="dot" style={{ background: it.color }} />{it.label}</span><span><strong className="num">{fmtMoney(it.value)}</strong><small className="muted"> {total ? `${Math.round((it.value / total) * 100)}%` : ''}</small></span></div>
          <div className="progress"><span style={{ width: `${total ? Math.max(2, (it.value / total) * 100) : 0}%`, background: it.color }} /></div>
        </li>
      ))}
    </ul>
  );
}
