'use client';
// Tela de Novidades: mostra, versão por versão, o que mudou no Balanço (dados em src/lib/changelog.js).
import { Card, PageHeader, Tag } from '@/components/ui.jsx';
import { CHANGELOG, LATEST_VERSION, TYPE_LABEL } from '@/lib/changelog.js';
import { fmtDate } from '@/lib/util.js';

const TONE = { novo: 'ok', melhoria: undefined, correção: 'warn' };

export default function Changelog() {
  return (
    <>
      <PageHeader title="Novidades" subtitle={`O que mudou no Balanço · versão atual ${LATEST_VERSION}`} />
      {CHANGELOG.map((v, i) => (
        <Card key={v.version} title={`Versão ${v.version} · ${v.title}`} actions={<span className="muted">{fmtDate(v.date)}{i === 0 && <Tag tone="ok">Atual</Tag>}</span>}>
          <ul className="changelog">
            {v.items.map((it, k) => (
              <li key={k}><span className="changelog-type"><Tag tone={TONE[it.type]}>{TYPE_LABEL[it.type] || it.type}</Tag></span><span>{it.text}</span></li>
            ))}
          </ul>
        </Card>
      ))}
    </>
  );
}
