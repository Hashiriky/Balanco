'use client';
// Preferências locais de exibição (não fazem parte dos dados financeiros e não sincronizam
// com a nuvem — ficam só neste aparelho, como tema ou zoom).
import { useEffect, useState } from 'react';

const KEY = 'balanco:prefs';
export const DEFAULT_PREFS = { alertDays: 3 };

function load() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  useEffect(() => { setPrefs(load()); }, []);
  const update = (patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return [prefs, update];
}
