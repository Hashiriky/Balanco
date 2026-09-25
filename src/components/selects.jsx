'use client';
import { useStore } from '@/lib/store.jsx';
import { categoryIndex, categoryPath, rootOf } from '@/lib/domain.js';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';
import { useUI } from '@/lib/ui-context.jsx';
import { Icon } from '@/components/ui.jsx';
import { cn } from '@/lib/util.js';

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

/**
 * Campo de categoria com busca. Visualmente parece um <select>, mas ao clicar abre uma janela
 * com um campo de busca e a lista agrupada por grupo — melhor para quem tem muitas categorias.
 * Mesma API do <select> antigo (type, value, onChange, exclude, includeArchived, allowEmpty, emptyLabel).
 */
export function CategorySelect({ type, value, onChange, exclude = [], includeArchived = false, allowEmpty = true, emptyLabel = 'Selecione…', 'aria-label': ariaLabel, ...rest }) {
  const { data } = useStore();
  const ui = useUI();
  const idx = categoryIndex(data.categories);
  const selected = value ? idx.get(value) : null;
  const color = selected ? (rootOf(value, idx)?.color || selected.color) : null;
  const label = !value ? emptyLabel : selected ? (selected.parentId ? categoryPath(value, idx) : `${selected.name} (geral)`) : 'Categoria removida';
  return (
    <button
      type="button" className="select cat-select-btn" aria-label={ariaLabel} aria-haspopup="dialog" {...rest}
      onClick={() => ui.open('categoryPicker', { type, value, exclude, includeArchived, allowEmpty, emptyLabel, onSelect: onChange })}
    >
      <span className="cat-select-value">{color && <i className="dot" style={{ background: color }} />}<span className={cn(!value && 'muted')}>{label}</span></span>
      <Icon name="chevronDown" size={16} className="muted" />
    </button>
  );
}
export const WEEKDAY_OPTIONS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
