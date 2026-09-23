'use client';
// Estado global: dados, conta do usuário, mês em exibição e as ações que alteram dados.
// Com conta: grava no Firestore documento a documento. Sem conta: grava no localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as cloud from './cloud.js';
import { GUEST_KEY, cleanData, cleanOne, clearLocal, emptyData, hasData, importInto, loadLocal, mergeData, saveLocal, withDefaults } from './storage.js';
import { toast, toastError } from './toast.js';
import { monthKey } from './util.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

function upsertList(list, items) {
  const out = [...list];
  items.forEach((it) => { const i = out.findIndex((x) => x.id === it.id); if (i >= 0) out[i] = it; else out.push(it); });
  return out;
}

export function StoreProvider({ children }) {
  const [data, setDataState] = useState(emptyData);
  const [status, setStatus] = useState('loading');      // loading | signedOut | guest | user
  const [user, setUser] = useState(null);
  const [sync, setSync] = useState('off');              // off | syncing | ok | error
  const [cloudReady, setCloudReady] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => monthKey(new Date()));
  const [authOpen, setAuthOpen] = useState(false);

  const dataRef = useRef(data), statusRef = useRef(status), userRef = useRef(null), queue = useRef(Promise.resolve()), unlisten = useRef(null);
  const setData = useCallback((d) => { dataRef.current = d; setDataState(d); }, []);
  const setStatusBoth = useCallback((s) => { statusRef.current = s; setStatus(s); }, []);

  /* fila de gravação na nuvem (mantém a ordem das operações) */
  const enqueue = useCallback((fn) => {
    setSync('syncing');
    queue.current = queue.current.then(fn).then(() => setSync((s) => (s === 'error' ? s : 'ok'))).catch((e) => {
      console.error('Sincronização', e); setSync('error'); toastError('Não foi possível sincronizar. Verifique a conexão.');
    });
    return queue.current;
  }, []);
  const cloudSave = useCallback((col, items) => {
    const u = userRef.current; if (!u || !items.length) return;
    if (items.length > 8) enqueue(() => cloud.saveMany(u.uid, col, items)); else items.forEach((it) => enqueue(() => cloud.saveDoc(u.uid, col, it)));
  }, [enqueue]);
  const cloudRemove = useCallback((col, items) => {
    const u = userRef.current; if (!u || !items.length) return;
    if (items.length > 8) enqueue(() => cloud.removeMany(u.uid, col, items)); else items.forEach((it) => enqueue(() => cloud.removeDoc(u.uid, col, it)));
  }, [enqueue]);

  /* entrada e saída da nuvem */
  const enterCloud = useCallback(async (u) => {
    userRef.current = u; setUser({ uid: u.uid, name: u.displayName || '', email: u.email });
    setStatusBoth('user'); setAuthOpen(false); setSync('syncing');
    try { localStorage.removeItem(GUEST_KEY); } catch { /* ignore */ }
    const local = loadLocal();
    try {
      const remote = cleanData(await cloud.loadAll(u.uid));
      let next = remote;
      if (hasData(local)) {                        // dados feitos sem conta: juntam-se à conta (a nuvem vence em conflito)
        next = withDefaults(mergeData(local, remote));
        await cloud.syncAll(u.uid, next);
        clearLocal();
        toast('Os dados deste aparelho foram juntados à sua conta.', { ttl: 5000 });
      } else if (!remote.categories.length) {      // conta nova: entra o plano de categorias padrão
        next = withDefaults(remote);
        await cloud.saveMany(u.uid, 'categories', next.categories);
      }
      setData(next);
      unlisten.current?.();
      unlisten.current = await cloud.listen(u.uid, (col, type, item) => {
        const d = dataRef.current;
        if (type === 'removed') setData({ ...d, [col]: d[col].filter((x) => x.id !== item.id) });
        else { const clean = cleanOne(col, item); if (clean) setData({ ...d, [col]: upsertList(d[col], [clean]) }); }
      });
      setSync('ok');
    } catch (e) {
      console.error('Falha ao carregar da nuvem', e); setSync('error');
      toastError('Não foi possível carregar seus dados. Verifique a conexão e as regras do Firestore.', { ttl: 8000 });
    }
  }, [setData, setStatusBoth]);
  const leaveCloud = useCallback(() => { unlisten.current?.(); unlisten.current = null; userRef.current = null; setUser(null); setData(emptyData()); }, [setData]);

  useEffect(() => {
    let off = () => {}, dead = false;
    (async () => {
      const ok = await cloud.cloudAvailable();
      if (dead) return;
      setCloudReady(ok);
      const local = withDefaults(loadLocal());
      let guest = false; try { guest = localStorage.getItem(GUEST_KEY) === '1'; } catch { /* ignore */ }
      setData(local);                              // mantém os dados locais na memória até saber se haverá login
      if (!ok) { setStatusBoth('guest'); return; }
      const stop = await cloud.watchAuth((u) => {
        if (dead) return;
        if (u) enterCloud(u);
        else {
          const wasUser = statusRef.current === 'user';
          if (wasUser) leaveCloud();
          setStatusBoth(guest && !wasUser ? 'guest' : 'signedOut'); setSync('off');
        }
      });
      if (dead) stop(); else off = stop;           // (o modo estrito do React roda o efeito duas vezes em desenvolvimento)
    })();
    return () => { dead = true; off(); unlisten.current?.(); };
  }, [enterCloud, leaveCloud, setData, setStatusBoth]);

  // sem conta: grava no aparelho a cada mudança
  useEffect(() => { if (status === 'guest') saveLocal(data); }, [data, status]);

  /* ações que alteram dados */
  const upsert = useCallback((col, items) => {
    const list = [].concat(items).map((it) => cleanOne(col, it)).filter(Boolean);
    if (!list.length) return [];
    const d = dataRef.current; setData({ ...d, [col]: upsertList(d[col], list) }); cloudSave(col, list);
    return list;
  }, [cloudSave, setData]);
  const remove = useCallback((col, items) => {
    const ids = new Set([].concat(items).map((x) => x.id)), d = dataRef.current;
    const removed = d[col].filter((x) => ids.has(x.id));
    setData({ ...d, [col]: d[col].filter((x) => !ids.has(x.id)) }); cloudRemove(col, removed);
    return removed;
  }, [cloudRemove, setData]);
  /** troca todos os dados de uma vez (importação, apagar tudo) */
  const replaceAll = useCallback((next) => {
    const full = withDefaults(next); setData(full);
    const u = userRef.current; if (u) enqueue(() => cloud.syncAll(u.uid, full));
  }, [enqueue, setData]);
  const importBackup = useCallback((raw, mode) => { const { next, counts } = importInto(dataRef.current, raw, mode); replaceAll(next); return counts; }, [replaceAll]);
  const eraseAll = useCallback(() => replaceAll(emptyData()), [replaceAll]);

  /* conta */
  const enterGuest = useCallback(() => { try { localStorage.setItem(GUEST_KEY, '1'); } catch { /* ignore */ } setAuthOpen(false); setStatusBoth('guest'); }, [setStatusBoth]);
  const signOut = useCallback(async () => { try { await cloud.logOut(); } catch { toastError('Não foi possível sair.'); } }, []);
  const refreshUser = useCallback((u) => setUser({ uid: u.uid, name: u.displayName || '', email: u.email }), []);

  const value = useMemo(() => ({
    data, status, user, sync, cloudReady, viewMonth, setViewMonth, authOpen, setAuthOpen,
    upsert, remove, importBackup, eraseAll, enterGuest, signOut, refreshUser, ready: status === 'guest' || status === 'user',
  }), [data, status, user, sync, cloudReady, viewMonth, authOpen, upsert, remove, importBackup, eraseAll, enterGuest, signOut, refreshUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
