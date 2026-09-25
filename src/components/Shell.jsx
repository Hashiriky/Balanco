'use client';
// Casca do app: provedores, barra lateral, janelas e tela de acesso.
import { usePathname } from 'next/navigation';
import AuthScreen from '@/components/Auth.jsx';
import { AccountDialog, AccountViewDialog, BudgetDialog, CategoryDialog, CategoryPickerDialog, ConfirmDialog, PayInvoiceDialog, RecurrenceDialog, RuleDialog, SettleDialog, TxDialog, TxViewDialog } from '@/components/Dialogs.jsx';
import Nav from '@/components/Nav.jsx';
import { ToastHost } from '@/components/ui.jsx';
import { StoreProvider, useStore } from '@/lib/store.jsx';
import { UIProvider, useUI } from '@/lib/ui-context.jsx';

const MODALS = { tx: TxDialog, txView: TxViewDialog, settle: SettleDialog, account: AccountDialog, accountView: AccountViewDialog, payInvoice: PayInvoiceDialog, recurrence: RecurrenceDialog, budget: BudgetDialog, category: CategoryDialog, categoryPicker: CategoryPickerDialog, rule: RuleDialog, confirm: ConfirmDialog };
function ModalHost() {
  const { stack, close } = useUI();
  return stack.map((m) => { const C = MODALS[m.type]; return C ? <C key={m.id} {...m.props} onClose={() => close(m.id)} /> : null; });
}
function Inner({ children }) {
  const { status, ready, authOpen } = useStore();
  const path = usePathname();
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
