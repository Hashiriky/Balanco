// O Next.js troca só o "#" da URL (ex.: /contas#fatura-…) sem disparar o evento "hashchange".
// Depois de clicar num link com "#", chame announceHash() para a tela de destino reagir (rolar e destacar).
export const announceHash = (href = '') => {
  if (!String(href).includes('#') || typeof window === 'undefined') return;
  setTimeout(() => window.dispatchEvent(new Event('hashchange')), 150);
};
