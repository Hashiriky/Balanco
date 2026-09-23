'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AccountSelect, CategorySelect } from '@/components/selects.jsx';
import { Alert, Card, Field, Money, PageHeader, Tag } from '@/components/ui.jsx';
import { buildImportRows, decodeText, guessMapping, mapCSV, parseCSV, parseOFX, rowsToTransactions } from '@/lib/importers.js';
import { useStore } from '@/lib/store.jsx';
import { toast, toastError } from '@/lib/toast.js';
import { fmtDate, fmtMoney } from '@/lib/util.js';

export default function Import() {
  const { data, upsert } = useStore();
  const [stage, setStage] = useState('select');           // select | map | review | done
  const [accountId, setAccountId] = useState('');
  const [fileName, setFileName] = useState(''); const [kind, setKind] = useState('');
  const [csv, setCsv] = useState(null); const [mapping, setMapping] = useState(null);
  const [items, setItems] = useState([]); const [parseErrors, setParseErrors] = useState(0);
  const [invert, setInvert] = useState(false); const [rows, setRows] = useState([]); const [result, setResult] = useState(0);
  const [error, setError] = useState('');

  const reset = () => { setStage('select'); setFileName(''); setKind(''); setCsv(null); setMapping(null); setItems([]); setRows([]); setError(''); };
  const account = data.accounts.find((a) => a.id === accountId);
  const toReview = (its, inv = invert) => { setRows(buildImportRows(its, { accountId, existing: data.transactions, rules: data.rules, invert: inv })); setStage('review'); };
  const onFile = async (file) => {
    setError('');
    if (!file) return;
    if (!accountId) { setError('Escolha primeiro a conta que receberá os lançamentos.'); return; }
    try {
      const text = decodeText(await file.arrayBuffer());
      setFileName(file.name);
      if (/\.ofx$/i.test(file.name) || /<OFX>|OFXHEADER/i.test(text.slice(0, 2000))) {
        const r = parseOFX(text); if (!r.items.length) throw new Error('Nenhuma transação encontrada no arquivo OFX.');
        setKind('ofx'); setItems(r.items); setParseErrors(r.errors); toReview(r.items);
      } else {
        const parsed = parseCSV(text); if (parsed.rows.length < 1) throw new Error('O arquivo está vazio.');
        setKind('csv'); setCsv(parsed); setMapping(guessMapping(parsed.rows)); setStage('map');
      }
    } catch (e) { setError(e.message || 'Não foi possível ler o arquivo.'); }
  };
  const applyMapping = () => {
    const m = mapping;
    if (m.date < 0 || (m.amount < 0 && m.debit < 0 && m.credit < 0)) { setError('Indique as colunas de data e de valor (ou débito/crédito).'); return; }
    const r = mapCSV(csv.rows, m); if (!r.items.length) { setError('Nenhuma linha válida com esse mapeamento.'); return; }
    setError(''); setItems(r.items); setParseErrors(r.errors); toReview(r.items);
  };
  const setRow = (key, patch) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const selectedRows = rows.filter((r) => r.selected);
  const missing = selectedRows.filter((r) => !r.categoryId).length;
  const doImport = () => {
    if (missing) { toastError(`${missing} linha(s) sem categoria. Escolha a categoria ou desmarque a linha.`); return; }
    const txs = rowsToTransactions(rows, accountId); upsert('transactions', txs); setResult(txs.length); setStage('done'); toast(`${txs.length} lançamentos importados.`);
  };
  const col = (label, key) => (
    <Field label={label}><select className="select" value={mapping[key]} onChange={(e) => setMapping({ ...mapping, [key]: Number(e.target.value) })} aria-label={label}>
      <option value={-1}>— não usar —</option>{(csv.rows[0] || []).map((c, i) => <option key={i} value={i}>{mapping.hasHeader ? c || `Coluna ${i + 1}` : `Coluna ${i + 1} (${(c || '').slice(0, 18)})`}</option>)}</select></Field>
  );

  if (!data.accounts.length) return (<><PageHeader title="Importar extrato" /><Card><p>Crie uma conta antes de importar. <Link href="/contas">Ir para Contas</Link></p></Card></>);
  return (
    <>
      <PageHeader title="Importar extrato" subtitle="CSV ou OFX do seu banco ou cartão">{stage !== 'select' && stage !== 'done' && <button type="button" className="btn btn-secondary" onClick={reset}>Recomeçar</button>}</PageHeader>
      {stage === 'select' && (
        <Card title="1. Escolha a conta e o arquivo">
          <div className="stack">
            <Field label="Conta de destino"><AccountSelect value={accountId} onChange={setAccountId} aria-label="Conta de destino" /></Field>
            <Field label="Arquivo (.csv ou .ofx)" help="Os lançamentos serão criados como realizados, na conta escolhida."><input id="importFile" className="input" type="file" accept=".csv,.ofx,.txt,text/csv" onChange={(e) => onFile(e.target.files[0])} aria-label="Arquivo" /></Field>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="muted">Dica: as <Link href="/ajustes">regras de categorização</Link> preenchem a categoria automaticamente. Extratos de cartão às vezes trazem as compras com sinal positivo: você poderá inverter na próxima etapa.</p>
          </div>
        </Card>
      )}
      {stage === 'map' && csv && (
        <Card title={`2. Indique as colunas de ${fileName}`}>
          <div className="stack">
            <label className="check"><input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setMapping({ ...mapping, hasHeader: e.target.checked })} /><span>A primeira linha é o cabeçalho</span></label>
            <div className="grid-3">{col('Data', 'date')}{col('Descrição', 'description')}{col('Valor (com sinal)', 'amount')}{col('Débito (opcional)', 'debit')}{col('Crédito (opcional)', 'credit')}</div>
            <div className="table-wrap"><table className="table"><tbody>{csv.rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="btn-row"><button type="button" className="btn btn-primary" onClick={applyMapping}>Continuar</button></div>
          </div>
        </Card>
      )}
      {stage === 'review' && (
        <>
          <Card className="filters">
            <div className="import-summary">
              <span><strong>{rows.length}</strong> linhas em {fileName} → <strong>{account?.name}</strong></span>
              <span><strong>{rows.filter((r) => r.duplicate).length}</strong> possíveis duplicadas (desmarcadas)</span>
              <span><strong>{selectedRows.length}</strong> a importar</span>
              {parseErrors > 0 && <span className="muted">{parseErrors} linha(s) ignorada(s) por dados inválidos</span>}
              <label className="check inline"><input type="checkbox" checked={invert} onChange={(e) => { setInvert(e.target.checked); toReview(items, e.target.checked); }} /><span>Inverter sinais (compras positivas)</span></label>
            </div>
          </Card>
          {missing > 0 && <Alert tone="warn">{missing} linha(s) selecionada(s) sem categoria. Escolha a categoria de cada uma para poder importar.</Alert>}
          <Card flush>
            <div className="table-wrap"><table className="table">
              <thead><tr><th className="w-chk"><input type="checkbox" aria-label="Selecionar todas" checked={rows.length > 0 && rows.every((r) => r.selected)} onChange={(e) => setRows((l) => l.map((r) => ({ ...r, selected: e.target.checked })))} /></th><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th><th>Aviso</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.key} className={r.selected ? '' : 'muted'}>
                  <td className="w-chk"><input type="checkbox" aria-label={`Importar ${r.description}`} checked={r.selected} onChange={(e) => setRow(r.key, { selected: e.target.checked })} /></td>
                  <td className="w-date">{fmtDate(r.date)}</td><td>{r.description}</td>
                  <td className="cell-select"><CategorySelect type={r.type} value={r.categoryId || ''} onChange={(v) => setRow(r.key, { categoryId: v })} aria-label={`Categoria de ${r.description}`} /></td>
                  <td className="num"><Money cents={r.type === 'income' ? r.amount : -r.amount} tone="auto" /></td><td>{r.duplicate && <Tag tone="warn">{r.duplicate}</Tag>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </Card>
          <div className="sticky-actions"><button type="button" className="btn btn-primary" onClick={doImport} disabled={!selectedRows.length}>Importar {selectedRows.length} lançamento(s)</button><button type="button" className="btn btn-secondary" onClick={reset}>Cancelar</button></div>
        </>
      )}
      {stage === 'done' && (
        <Card title="Importação concluída">
          <p>{result} lançamento(s) importado(s) para <strong>{account?.name}</strong> ({fmtMoney(sum0(rowsToTransactions(rows, accountId)))} em movimentações).</p>
          <div className="btn-row"><Link href="/lancamentos" className="btn btn-primary">Ver lançamentos</Link><button type="button" className="btn btn-secondary" onClick={reset}>Importar outro arquivo</button></div>
        </Card>
      )}
    </>
  );
}
const sum0 = (txs) => txs.reduce((s, t) => s + t.amount, 0);
