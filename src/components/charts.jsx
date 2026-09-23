'use client';
// Gráficos simples em SVG (cores chapadas, sem animação).
import { fmtMoney, monthShort } from '@/lib/util.js';

const niceMax = (v) => { if (v <= 0) return 100; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x >= n) || 10) * p; };
const short = (c) => { const v = Math.abs(c) / 100; const s = v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)} mil` : `${v.toFixed(0)}`; return (c < 0 ? '−' : '') + s.replace('.', ','); };

/** barras agrupadas: receitas × despesas por mês */
export function BarChart({ series, height = 240 }) {
  const W = 760, H = height, L = 52, B = 26, T = 10, R = 8, w = W - L - R, h = H - B - T;
  const max = niceMax(Math.max(...series.flatMap((s) => [s.income, s.expense]), 1)), n = series.length, slot = w / n, bw = Math.min(22, slot / 3);
  const y = (v) => T + h - (v / max) * h;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receitas e despesas por mês">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="grid" /><text x={L - 6} y={y(max * f) + 4} className="axis" textAnchor="end">{short(max * f)}</text></g>)}
      {series.map((s, i) => {
        const cx = L + slot * i + slot / 2;
        return (
          <g key={s.key}>
            <title>{`${monthShort(s.key)} · Receitas ${fmtMoney(s.income)} · Despesas ${fmtMoney(s.expense)} · Resultado ${fmtMoney(s.income - s.expense)}`}</title>
            <rect x={cx - bw - 1} y={y(s.income)} width={bw} height={Math.max(0, T + h - y(s.income))} className="bar-inc" />
            <rect x={cx + 1} y={y(s.expense)} width={bw} height={Math.max(0, T + h - y(s.expense))} className="bar-exp" />
            <text x={cx} y={H - 8} className="axis" textAnchor="middle">{monthShort(s.key)}</text>
          </g>
        );
      })}
    </svg>
  );
}
/** linha: patrimônio ao longo do tempo */
export function LineChart({ points, height = 240 }) {
  const W = 760, H = height, L = 62, B = 26, T = 12, R = 12, w = W - L - R, h = H - B - T;
  const vals = points.map((p) => p.value), lo = Math.min(...vals, 0), hi = Math.max(...vals, 1), span = niceMax(hi - lo) || 100;
  const min = lo < 0 ? -niceMax(-lo) : 0, max = Math.max(min + span, hi);
  const x = (i) => L + (points.length === 1 ? w / 2 : (w / (points.length - 1)) * i), y = (v) => T + h - ((v - min) / (max - min || 1)) * h;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolução do patrimônio">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = min + (max - min) * f; return <g key={f}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v) + 4} className="axis" textAnchor="end">{short(v)}</text></g>; })}
      <path d={path} className="line" fill="none" />
      {points.map((p, i) => <g key={p.key}><circle cx={x(i)} cy={y(p.value)} r="3.5" className="dot"><title>{`${monthShort(p.key)} · ${fmtMoney(p.value)}`}</title></circle><text x={x(i)} y={H - 8} className="axis" textAnchor="middle">{monthShort(p.key)}</text></g>)}
    </svg>
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
