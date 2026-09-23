// Avisos rápidos ("toasts"). Qualquer arquivo pode chamar toast('...'); o <ToastHost /> mostra na tela.
export function toast(message, opts = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('fh-toast', { detail: { message, type: opts.type || 'ok', action: opts.action || null, ttl: opts.ttl || (opts.type === 'err' ? 5500 : 3200) } }));
}
export const toastError = (message, opts = {}) => toast(message, { ...opts, type: 'err' });
