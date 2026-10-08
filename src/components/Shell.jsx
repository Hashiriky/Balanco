'use client';
// Casca do app: provedores, barra lateral, janelas e tela de acesso.
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AuthScreen from '@/components/Auth.jsx';
import { AccountDialog, AccountViewDialog, BudgetDialog, CategoryDialog, CategoryPickerDialog, ConfirmDialog, PayInvoiceDialog, RecurrenceDialog, RuleDialog, SettleDialog, TxDialog, TxViewDialog, YieldBatchDialog, YieldUpdateDialog } from '@/components/Dialogs.jsx';
import Nav from '@/components/Nav.jsx';
import { ToastHost } from '@/components/ui.jsx';
import { StoreProvider, useStore } from '@/lib/store.jsx';
import { UIProvider, useUI } from '@/lib/ui-context.jsx';

const MODALS = { tx: TxDialog, txView: TxViewDialog, settle: SettleDialog, account: AccountDialog, accountView: AccountViewDialog, payInvoice: PayInvoiceDialog, recurrence: RecurrenceDialog, budget: BudgetDialog, category: CategoryDialog, categoryPicker: CategoryPickerDialog, rule: RuleDialog, confirm: ConfirmDialog, yieldUpdate: YieldUpdateDialog, yieldBatch: YieldBatchDialog };
function ModalHost() {
  const { stack, close } = useUI();
  return stack.map((m) => { const C = MODALS[m.type]; return C ? <C key={m.id} {...m.props} onClose={() => close(m.id)} /> : null; });
}
function Inner({ children }) {
  const { status, ready, authOpen } = useStore();
  const path = usePathname();
  const { open, stack } = useUI();
  /* Atalhos de teclado (só fora de campos de texto e sem janela aberta): N = novo lançamento, / = ir para a busca da tela */
  useEffect(() => {
    if (!ready || authOpen || stack.length) return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target, tag = String(t?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); open('tx', { preset: { type: 'expense' } }); }
      else if (e.key === '/') { const el = document.querySelector('main input[type="search"]'); if (el) { e.preventDefault(); el.focus(); } }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ready, authOpen, stack.length, open]);
  return (
    <div className={ready ? 'shell' : undefined}>
      {ready && <Nav />}
      <div className="content-area">
        <main className="main" id="main" key={path}>
          {status === 'loading' && <p className="loading">Carregando…</p>}
          {ready && <div className="container">{children}</div>}
        </main>
      </div>
      {(status === 'signedOut' || authOpen) && <AuthScreen />}
      <ModalHost />
      <ToastHost />
    </div>
  );
}
export default function Shell({ children }) { return <StoreProvider><UIProvider><Inner>{children}</Inner></UIProvider></StoreProvider>; }
