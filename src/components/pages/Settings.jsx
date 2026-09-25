'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { CategoryLabel, useLookups } from '@/components/pages/shared.jsx';
import { Alert, Card, Empty, Field, Tabs, Tag } from '@/components/ui.jsx';
import * as cloud from '@/lib/cloud.js';
import { usePrefs } from '@/lib/prefs.js';
import { buildBackup, transactionsToCSV } from '@/lib/storage.js';
import { useStore } from '@/lib/store.jsx';
import { toast, toastError } from '@/lib/toast.js';
import { useUI } from '@/lib/ui-context.jsx';
import { todayISO } from '@/lib/util.js';

function download(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function CategoriesTab() {
  const { data } = useStore();
  const ui = useUI();
  const block = (type, title) => {
    const roots = data.categories.filter((c) => c.type === type && !c.parentId);
    return (
      <Card title={title} actions={<button type="button" className="btn btn-secondary btn-sm" onClick={() => ui.open('category', { presetType: type })}>Nova categoria</button>} flush>
        <table className="table"><tbody>{roots.map((r) => (<Fragment key={r.id}>
          <tr className="root-row click" onClick={() => ui.open('category', { category: r })}><td><i className="dot" style={{ background: r.color }} /><strong>{r.name}</strong>{r.archived && <Tag>Arquivada</Tag>}</td><td className="w-act"><button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('category', { presetParent: r.id }); }}>+ Subcategoria</button><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('category', { category: r }); }}>Editar</button></td></tr>
          {data.categories.filter((c) => c.parentId === r.id).map((k) => <tr key={k.id} className="sub-row click" onClick={() => ui.open('category', { category: k })}><td style={{ paddingLeft: 34 }}>{k.name}{k.archived && <Tag>Arquivada</Tag>}</td><td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('category', { category: k }); }}>Editar</button></td></tr>)}
        </Fragment>))}</tbody></table>
      </Card>
    );
  };
  return <>{block('expense', 'Categorias de despesa')}{block('income', 'Categorias de receita')}</>;
}
function RulesTab() {
  const { data } = useStore();
  const ui = useUI();
  const lk = useLookups();
  return (
    <Card title="Regras de categorização" actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => ui.open('rule')}>Nova regra</button>} flush>
      <p className="card-note muted">Usadas na importação de extratos: se a descrição contiver o texto, a categoria é preenchida. Vale a regra mais específica (texto mais longo).</p>
      {data.rules.length ? <table className="table"><thead><tr><th>Se a descrição contiver</th><th>Categoria</th><th /></tr></thead><tbody>{[...data.rules].sort((a, b) => a.contains.localeCompare(b.contains, 'pt-BR')).map((r) => <tr key={r.id} className="click" onClick={() => ui.open('rule', { rule: r })}><td><code>{r.contains}</code></td><td><CategoryLabel id={r.categoryId} lk={lk} /></td><td className="w-act"><button type="button" className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); ui.open('rule', { rule: r }); }}>Editar</button></td></tr>)}</tbody></table>
        : <Empty title="Nenhuma regra" text="Ex.: “uber” → Transporte › Aplicativos e táxi." action={<button type="button" className="btn btn-primary" onClick={() => ui.open('rule')}>Nova regra</button>} />}
    </Card>
  );
}
function DataTab() {
  const { data, importBackup, eraseAll } = useStore();
  const ui = useUI();
  const [mode, setMode] = useState('merge'); const [word, setWord] = useState('');
  const file = useRef(null);
  const onFile = async (f) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (mode === 'replace' && !(await ui.confirm({ title: 'Substituir todos os dados?', danger: true, okLabel: 'Substituir', message: 'Todos os dados atuais serão trocados pelos do arquivo. Faça um backup antes se tiver dúvida.' }))) return;
      const c = importBackup(raw, mode);
      toast(`Importado: ${c.transactions} lançamentos, ${c.accounts} contas, ${c.categories} categorias, ${c.recurrences} recorrências.`, { ttl: 6000 });
    } catch (e) { toastError(e instanceof SyntaxError ? 'Arquivo inválido: não é um JSON.' : e.message); } finally { if (file.current) file.current.value = ''; }
  };
  return (
    <>
      <Card title="Exportar">
        <p className="muted">Guarde uma cópia dos seus dados. O backup (JSON) pode ser restaurado; o CSV abre no Excel.</p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => { download(`balanco-backup-${todayISO()}.json`, JSON.stringify(buildBackup(data), null, 2), 'application/json'); toast('Backup baixado.'); }}>Baixar backup completo (JSON)</button>
          <button type="button" className="btn btn-secondary" onClick={() => { download(`balanco-lancamentos-${todayISO()}.csv`, transactionsToCSV(data.transactions, data.accounts, data.categories), 'text/csv'); toast('CSV baixado.'); }}>Baixar lançamentos (CSV)</button>
        </div>
      </Card>
      <Card title="Restaurar backup">
        <div className="stack">
          <div className="choice" role="radiogroup" aria-label="Como restaurar">{[['merge', 'Juntar com o que já existe'], ['replace', 'Substituir tudo']].map(([v, l]) => <label key={v} className={mode === v ? 'on' : ''}><input type="radio" name="restoreMode" checked={mode === v} onChange={() => setMode(v)} /><span>{l}</span></label>)}</div>
          <div><button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>Escolher arquivo .json</button><input ref={file} id="importBackup" type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files[0])} /></div>
        </div>
      </Card>
      <Card title="Apagar todos os dados">
        <Alert tone="danger">Esta ação apaga contas, lançamentos, recorrências, orçamentos e regras. Não há como desfazer.</Alert>
        <div className="btn-row"><Field label="Digite APAGAR para confirmar"><input className="input" value={word} onChange={(e) => setWord(e.target.value)} aria-label="Confirmação" /></Field>
          <button type="button" className="btn btn-danger" disabled={word !== 'APAGAR'} onClick={() => { eraseAll(); setWord(''); toast('Todos os dados foram apagados.'); }}>Apagar tudo</button></div>
      </Card>
    </>
  );
}
function PreferencesTab() {
  const [prefs, updatePrefs] = usePrefs();
  const [val, setVal] = useState(String(prefs.alertDays));
  useEffect(() => setVal(String(prefs.alertDays)), [prefs.alertDays]);
  const commit = () => {
    const n = Math.max(0, Math.min(60, Number(val) || 0));
    setVal(String(n)); updatePrefs({ alertDays: n });
  };
  return (
    <Card title="Alertas de vencimento">
      <p className="muted">Contas a vencer ganham um destaque (cor de aviso) na Agenda quando faltarem poucos dias. Defina a partir de quantos dias antes isso deve aparecer.</p>
      <Field label="Avisar a partir de quantos dias antes do vencimento" help="0 = só no dia do vencimento.">
        <input className="input" type="number" min={0} max={60} value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} aria-label="Dias de antecedência para alerta" style={{ maxWidth: 120 }} />
      </Field>
    </Card>
  );
}
function AccountTab() {
  const { status, user, refreshUser, signOut, setAuthOpen, cloudReady } = useStore();
  const [name, setName] = useState(user?.name || ''); const [email, setEmail] = useState(user?.email || '');
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [error, setError] = useState('');
  if (status !== 'user') return (
    <Card title="Conta">
      <p>Você está usando o Balanço <strong>sem conta</strong>: os dados ficam somente neste aparelho.</p>
      {cloudReady && <div className="btn-row"><button type="button" className="btn btn-primary" onClick={() => setAuthOpen(true)}>Entrar ou criar conta</button></div>}
      <p className="muted">Ao entrar, o que está neste aparelho é juntado à sua conta.</p>
    </Card>
  );
  const changing = email.trim() !== user.email || !!pw;
  const save = async (e) => {
    e.preventDefault(); setError('');
    if (changing && !cur) return setError('Digite sua senha atual para trocar e-mail ou senha.');
    if (pw && pw !== pw2) return setError('As senhas não coincidem.');
    if (pw && pw.length < 6) return setError('A nova senha precisa ter ao menos 6 caracteres.');
    try { const u = await cloud.updateAccount({ name: name.trim(), newEmail: email.trim() !== user.email ? email.trim() : '', currentPassword: cur, newPassword: pw }); refreshUser(u); setCur(''); setPw(''); setPw2(''); toast(email.trim() !== user.email ? `Enviamos um link de verificação para ${email.trim()}.` : 'Dados atualizados.', { ttl: 5000 }); }
    catch (err) { setError(cloud.authMessage(err)); }
  };
  return (
    <Card title="Minha conta">
      <form className="stack narrow" onSubmit={save} noValidate>
        <Field label="Nome"><input className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" /></Field>
        <Field label="E-mail" help={email.trim() !== user.email ? 'O e-mail só troca depois que você clicar no link enviado ao novo endereço.' : undefined}><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" /></Field>
        <Field label="Senha atual (necessária para trocar e-mail ou senha)"><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} aria-label="Senha atual" /></Field>
        <div className="grid-2"><Field label="Nova senha"><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Nova senha" /></Field><Field label="Confirmar nova senha"><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="Confirmar nova senha" /></Field></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="btn-row"><button className="btn btn-primary">Salvar alterações</button><button type="button" className="btn btn-secondary" onClick={signOut}>Sair da conta</button></div>
      </form>
    </Card>
  );
}
export default function Settings() {
  const [tab, setTab] = useState('categories');
  return (
    <>
      <header className="page-header"><div><h1>Ajustes</h1></div></header>
      <Tabs label="Ajustes" value={tab} onChange={setTab} tabs={[{ value: 'categories', label: 'Categorias' }, { value: 'rules', label: 'Regras' }, { value: 'preferences', label: 'Preferências' }, { value: 'data', label: 'Dados e backup' }, { value: 'account', label: 'Conta' }]} />
      <div className="tab-panel">{tab === 'categories' && <CategoriesTab />}{tab === 'rules' && <RulesTab />}{tab === 'preferences' && <PreferencesTab />}{tab === 'data' && <DataTab />}{tab === 'account' && <AccountTab />}</div>
    </>
  );
}
