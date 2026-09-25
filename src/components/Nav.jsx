'use client';
// Navegação: barra lateral fixa no computador (pode recolher para só ícones) e gaveta deslizante no celular.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui.jsx';
import { useStore } from '@/lib/store.jsx';
import { cn } from '@/lib/util.js';

export const ITEMS = [
  { href: '/', label: 'Painel', icon: 'panel' }, { href: '/lancamentos', label: 'Lançamentos', icon: 'list' }, { href: '/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/contas', label: 'Contas', icon: 'bank' }, { href: '/orcamento', label: 'Orçamento', icon: 'target' }, { href: '/relatorios', label: 'Relatórios', icon: 'chart' },
];
const MORE = [{ href: '/importar', label: 'Importar extrato', icon: 'upload' }, { href: '/ajustes', label: 'Ajustes', icon: 'file' }];
const SYNC = { off: 'Somente neste aparelho', syncing: 'Sincronizando…', ok: 'Sincronizado', error: 'Erro de sincronização' };
const COLLAPSE_KEY = 'balanco.navCollapsed';

export default function Nav() {
  const path = usePathname() || '/';
  const { status, user, sync, signOut, setAuthOpen, cloudReady } = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1'); } catch { /* ignore */ } }, []);
  const toggleCollapsed = () => setCollapsed((c) => { try { localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1'); } catch { /* ignore */ } return !c; });
  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setMobileOpen(false); setMenuOpen(false); } };
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);

  const allItems = [...ITEMS, ...MORE];
  const link = (it) => (
    <Link key={it.href} href={it.href} className={cn('nav-link', path === it.href && 'on')} aria-current={path === it.href ? 'page' : undefined} title={collapsed ? it.label : undefined}>
      <Icon name={it.icon} size={19} /><span className="side-label">{it.label}</span>
    </Link>
  );
  return (
    <>
      <button type="button" className="topbar-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
        <Icon name="menu" size={20} /><strong>Balanço</strong>
      </button>
      {mobileOpen && <button type="button" className="nav-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('sidebar', collapsed && 'collapsed', mobileOpen && 'mobile-open')} aria-label="Navegação principal">
        <div className="sidebar-top">
          <Link href="/" className="brand"><span className="brand-mark">B</span><span className="side-label">Balanço</span></Link>
          <button type="button" className="icon-btn collapse-toggle" onClick={toggleCollapsed} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} aria-pressed={collapsed} title={collapsed ? 'Expandir menu' : 'Recolher menu'}>
            <Icon name={collapsed ? 'right' : 'left'} size={16} />
          </button>
          <button type="button" className="icon-btn nav-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><Icon name="x" size={18} /></button>
        </div>
        <nav className="nav-links">{ITEMS.map(link)}<div className="nav-sep" />{MORE.map(link)}</nav>
        <div className="sidebar-bottom" ref={menuRef}>
          {menuOpen && (
            <div className="side-menu" role="menu">
              <div className="side-menu-user"><strong>{status === 'user' ? (user?.name || user?.email) : 'Sem conta'}</strong>{status === 'user' && <small>{user?.email}</small>}<small className="sync" data-state={status === 'user' ? sync : 'off'}>{SYNC[status === 'user' ? sync : 'off']}</small></div>
              {status === 'user' && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); signOut(); }}><Icon name="logout" size={17} />Sair</button>}
              {status === 'guest' && cloudReady && <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setAuthOpen(true); }}><Icon name="user" size={17} />Entrar ou criar conta</button>}
            </div>
          )}
          <button type="button" className="nav-user" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} title={collapsed ? (status === 'user' ? (user?.name || user?.email) : 'Sem conta') : undefined}>
            <span className={cn('user-dot', status === 'user' && `dot-${sync}`)}><Icon name="user" size={17} /></span>
            <span className="side-label user-text"><strong>{status === 'user' ? (user?.name || user?.email) : 'Sem conta'}</strong><small>{status === 'user' ? SYNC[sync] : 'Dados neste aparelho'}</small></span>
          </button>
        </div>
      </aside>
    </>
  );
}
