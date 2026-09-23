// Firebase (login + Firestore). Carregado sob demanda, só no navegador.
// Estrutura:  users/{uid}/{accounts|categories|transactions|recurrences|budgets|rules}/{id}
// As chaves abaixo são públicas por natureza (quem protege os dados são as REGRAS do Firestore — veja firestore.rules).
// Para usar outro projeto Firebase, defina as variáveis NEXT_PUBLIC_FIREBASE_* (veja .env.example).
import { COLLECTIONS } from './storage.js';

const fallback = {
  apiKey: 'AIzaSyAu7gofuJ2QXhPrwj5Do2YgPuj8UVMpv3Q', authDomain: 'financehub-1ea6b.firebaseapp.com', projectId: 'financehub-1ea6b',
  storageBucket: 'financehub-1ea6b.firebasestorage.app', messagingSenderId: '311833747929', appId: '1:311833747929:web:631d7df2d45cc381ed39c8',
};
const config = () => ({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallback.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallback.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallback.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallback.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallback.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || fallback.appId,
});
const plain = (o) => JSON.parse(JSON.stringify(o));   // remove "undefined" (o Firestore recusa)
export const docId = (item) => String(item.id);

let sdk = null;
async function load() {
  if (sdk) return sdk;
  const [app, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
  const inst = app.getApps().length ? app.getApp() : app.initializeApp(config());
  sdk = { auth, fs, authInst: auth.getAuth(inst), db: fs.getFirestore(inst) };
  return sdk;
}
export async function cloudAvailable() { try { await load(); return true; } catch { return false; } }

/* ---------- Conta ---------- */
export async function watchAuth(cb) { const s = await load(); return s.auth.onAuthStateChanged(s.authInst, cb); }
export async function signIn(email, password) { const s = await load(); return (await s.auth.signInWithEmailAndPassword(s.authInst, email, password)).user; }
export async function signUp(name, email, password) {
  const s = await load();
  const { user } = await s.auth.createUserWithEmailAndPassword(s.authInst, email, password);
  await s.auth.updateProfile(user, { displayName: name });
  await s.fs.setDoc(s.fs.doc(s.db, 'users', user.uid), { name, email: user.email, createdAt: new Date().toISOString() }, { merge: true });
  return user;
}
export async function logOut() { const s = await load(); await s.auth.signOut(s.authInst); }
export async function resetPassword(email) { const s = await load(); await s.auth.sendPasswordResetEmail(s.authInst, email); }
export async function updateAccount({ name, newEmail, currentPassword, newPassword }) {
  const s = await load(); const user = s.authInst.currentUser;
  if (newEmail || newPassword) await s.auth.reauthenticateWithCredential(user, s.auth.EmailAuthProvider.credential(user.email, currentPassword));
  if (newPassword) await s.auth.updatePassword(user, newPassword);
  await s.auth.updateProfile(user, { displayName: name });
  await s.fs.setDoc(s.fs.doc(s.db, 'users', user.uid), { name, email: user.email, updatedAt: new Date().toISOString() }, { merge: true });
  if (newEmail) await s.auth.verifyBeforeUpdateEmail(user, newEmail);
  return user;
}
const MESSAGES = {
  'auth/email-already-in-use': 'Este e-mail já está em uso.', 'auth/invalid-email': 'E-mail inválido.', 'auth/weak-password': 'Senha muito fraca (mínimo de 6 caracteres).',
  'auth/user-disabled': 'Usuário desabilitado.', 'auth/user-not-found': 'Usuário não encontrado.', 'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Tente de novo em alguns minutos.', 'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de alterar.',
};
export const authMessage = (e) => MESSAGES[e?.code] || 'Não foi possível concluir. Tente novamente.';

/* ---------- Dados ---------- */
const colRef = (s, uid, col) => s.fs.collection(s.db, 'users', uid, col);
export async function loadAll(uid) {
  const s = await load();
  const snaps = await Promise.all(COLLECTIONS.map((c) => s.fs.getDocs(colRef(s, uid, c))));
  const out = {}; COLLECTIONS.forEach((c, i) => { out[c] = snaps[i].docs.map((d) => ({ id: d.id, ...d.data() })); });
  return out;
}
export async function listen(uid, onChange) {
  const s = await load();
  const unsubs = COLLECTIONS.map((col) => s.fs.onSnapshot(colRef(s, uid, col), (snap) => {
    snap.docChanges().forEach((ch) => onChange(col, ch.type, { id: ch.doc.id, ...ch.doc.data() }));
  }, (err) => console.error('Firestore listener', col, err)));
  return () => unsubs.forEach((u) => u());
}
export async function saveDoc(uid, col, item) { const s = await load(); await s.fs.setDoc(s.fs.doc(s.db, 'users', uid, col, docId(item)), plain(item)); }
export async function removeDoc(uid, col, item) { const s = await load(); await s.fs.deleteDoc(s.fs.doc(s.db, 'users', uid, col, docId(item))); }
async function runBatched(s, ops) {
  for (let i = 0; i < ops.length; i += 400) { const batch = s.fs.writeBatch(s.db); ops.slice(i, i + 400).forEach((op) => op(batch)); await batch.commit(); }
}
/** grava muitos documentos de uma vez (lotes de até 400) */
export async function saveMany(uid, col, items) { const s = await load(); await runBatched(s, items.map((it) => (b) => b.set(s.fs.doc(s.db, 'users', uid, col, docId(it)), plain(it)))); }
export async function removeMany(uid, col, items) { const s = await load(); await runBatched(s, items.map((it) => (b) => b.delete(s.fs.doc(s.db, 'users', uid, col, docId(it))))); }
/** deixa o Firestore idêntico ao estado informado (primeiro login, importação, apagar tudo) */
export async function syncAll(uid, data) {
  const s = await load(), ops = [];
  for (const col of COLLECTIONS) {
    const existing = await s.fs.getDocs(colRef(s, uid, col)), keep = new Set();
    data[col].forEach((item) => { keep.add(docId(item)); ops.push((b) => b.set(s.fs.doc(s.db, 'users', uid, col, docId(item)), plain(item))); });
    existing.docs.filter((d) => !keep.has(d.id)).forEach((d) => ops.push((b) => b.delete(d.ref)));
  }
  await runBatched(s, ops);
}
