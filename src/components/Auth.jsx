'use client';
// Tela de entrada: login, cadastro, recuperação de senha ou "continuar sem conta".
import { useState } from 'react';
import { Field, Tabs } from '@/components/ui.jsx';
import * as cloud from '@/lib/cloud.js';
import { useStore } from '@/lib/store.jsx';
import { toast } from '@/lib/toast.js';

export default function AuthScreen() {
  const { status, enterGuest, setAuthOpen, cloudReady, refreshUser } = useStore();
  const [tab, setTab] = useState('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const run = async (fn) => { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(cloud.authMessage(e)); } finally { setBusy(false); } };
  const forgot = () => {
    if (!email.trim()) { setError('Digite seu e-mail para recuperar a senha.'); return; }
    run(async () => { await cloud.resetPassword(email.trim()); toast('E-mail de recuperação enviado. Confira sua caixa de entrada.', { ttl: 6000 }); });
  };
  return (
    <div className="auth-page" role="dialog" aria-modal="true" aria-label="Acesso ao Balanço">
      <div className="auth-card">
        <div className="auth-brand"><span className="logo" aria-hidden="true">B</span><div><h1>Balanço</h1><p className="muted">Finanças pessoais</p></div></div>
        <Tabs label="Entrar ou criar conta" value={tab} onChange={(t) => { setTab(t); setError(''); }} tabs={[{ value: 'login', label: 'Entrar' }, { value: 'register', label: 'Criar conta' }]} />
        {tab === 'login' ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); run(() => cloud.signIn(email.trim(), pw)); }}>
            <Field label="E-mail"><input id="loginEmail" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Senha"><input id="loginPassword" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></Field>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Aguarde…' : 'Entrar'}</button>
            <button type="button" className="link-btn" onClick={forgot}>Esqueci minha senha</button>
          </form>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (pw !== pw2) { setError('As senhas não coincidem.'); return; } run(async () => { refreshUser(await cloud.signUp(name.trim(), email.trim(), pw)); }); }}>
            <Field label="Nome"><input id="registerName" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="E-mail"><input id="registerEmail" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Senha" help="Mínimo de 6 caracteres."><input id="registerPassword" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} /></Field>
            <Field label="Confirmar senha"><input id="registerPasswordConfirm" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></Field>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Aguarde…' : 'Criar conta'}</button>
          </form>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="auth-alt">
          {status === 'guest' ? <button type="button" className="link-btn" onClick={() => setAuthOpen(false)}>← Voltar</button>
            : cloudReady && <button type="button" className="link-btn" onClick={enterGuest}>Continuar sem conta (dados só neste aparelho)</button>}
        </div>
      </div>
    </div>
  );
}
