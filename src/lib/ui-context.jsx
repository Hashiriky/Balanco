'use client';
// Controle das janelas (modais): ui.open('tx', { ... }) e await ui.confirm({ ... }).
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { uid } from './util.js';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [stack, setStack] = useState([]);
  const open = useCallback((type, props = {}) => setStack((s) => [...s, { id: uid(), type, props }]), []);
  const close = useCallback((id) => setStack((s) => s.filter((m) => m.id !== id)), []);
  /** confirmação: resolve true (confirmou) ou false */
  const confirm = useCallback((opts) => new Promise((resolve) => open('confirm', { ...opts, resolve })), [open]);
  const value = useMemo(() => ({ stack, open, close, confirm }), [stack, open, close, confirm]);
  return <UICtx.Provider value={value}>{children}</UICtx.Provider>;
}
