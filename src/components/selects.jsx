'use client';
import { useStore } from '@/lib/store.jsx';
import { categoryIndex } from '@/lib/domain.js';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';

export function AccountSelect({ value, onChange, exclude = [], only, id, ...rest }) {
  const { data } = useStore();
  const list = data.accounts.filter((a) => (!a.archived || a.id === value) && !exclude.includes(a.id) && (!only || only(a)));
  return (
    <select className="select" id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">Selecione…</option>
      {list.map((a) => <option key={a.id} value={a.id}>{a.name} ({ACCOUNT_TYPES[a.type]}){a.archived ? ' — arquivada' : ''}</option>)}
    </select>
  );
}
/** categorias em dois níveis: o grupo (pai) e as subcategorias */
export function CategorySelect({ type, value, onChange, exclude = [], includeArchived = false, allowEmpty = true, emptyLabel = 'Selecione…', ...rest }) {
  const { data } = useStore();
  const cats = data.categories.filter((c) => (!type || c.type === type));
  const roots = cats.filter((c) => !c.parentId);
  const idx = categoryIndex(data.categories);
  // uma subcategoria também some se o GRUPO dela estiver arquivado (mantém a opção já selecionada, para não sumir da tela sem explicação)
  const visible = (c) => (!c.archived || c.id === value || includeArchived) && !exclude.includes(c.id);
  const visibleWithGroup = (c) => visible(c) && (!c.parentId || visible(idx.get(c.parentId)) || includeArchived);
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest}>
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {roots.map((r) => {
        const kids = cats.filter((c) => c.parentId === r.id && visibleWithGroup(c));
        if (!visible(r) && !kids.length) return null;
        return (
          <optgroup key={r.id} label={r.name}>
            {visible(r) && <option value={r.id}>{r.name} (geral)</option>}
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </optgroup>
        );
      })}
      {value && !idx.get(value) && <option value={value}>Categoria removida</option>}
    </select>
  );
}
export const WEEKDAY_OPTIONS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
