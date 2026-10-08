'use client';
import { useStore } from '@/lib/store.jsx';
import { categoryIndex, categoryPath, groupByBank, rootOf } from '@/lib/domain.js';
import { ACCOUNT_TYPES } from '@/lib/defaults.js';
import { useUI } from '@/lib/ui-context.jsx';
import { Icon } from '@/components/ui.jsx';
import { cn } from '@/lib/util.js';

/** Contas de investimento ficam fora da lista por padrão (têm a própria tela, a Carteira).
 *  Passe `investments` pra incluí-las — usado nas transferências (aporte/resgate). */
export function AccountSelect({ value, onChange, exclude = [], only, investments = false, id, ...rest }) {
  const { data } = useStore();
  const list = data.accounts.filter((a) => a.id === value || ((!a.archived) && !exclude.includes(a.id) && (investments || a.type !== 'investment') && (!only || only(a))));
  const label = (a) => `${a.primary ? '★ ' : ''}${a.name} (${ACCOUNT_TYPES[a.type]})${a.primary ? ' — principal' : ''}${a.archived ? ' — arquivada' : ''}`;
  const opt = (a) => <option key={a.id} value={a.id}>{label(a)}</option>;
  // a principal vem primeiro; o resto fica agrupado por banco (se nenhuma conta tem banco, a lista é simples)
  const main = list.find((a) => a.primary);
  const groups = groupByBank(list.filter((a) => a !== main));
  const flat = groups.every((g) => !g.bank);
  return (
    <select className="select" id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      <option value="">Selecione…</option>
      {main && opt(main)}
      {flat ? groups.flatMap((g) => g.items.map(opt)) : groups.map((g) => <optgroup key={g.bank || '_'} label={g.bank || 'Sem banco'}>{g.items.map(opt)}</optgroup>)}
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
