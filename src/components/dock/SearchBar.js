/**
 * DIALR — SearchBar.
 *
 * Lives directly above the dock, inside the thumb zone, per the brief's
 * one-handed rule. Collapsed it is a tap target; focused it raises a scrim that
 * separates it and the dock from the content behind, and shows results in a
 * panel that grows upward.
 */
import { h, on, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import haptics from '../../core/haptics.js';

export function SearchBar({ placeholder = 'Search contacts', onQuery, onFocus, onBlur, onSubmit }) {
  const input = h('input.search__input', {
    type: 'search', placeholder, autocomplete: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'search',
    aria: { label: 'Search contacts, calls and notes' },
  });

  const clearBtn = h('button.search__clear', {
    type: 'button', aria: { label: 'Clear search' }, html: icon('close'),
    on: { click: () => { input.value = ''; onQuery?.(''); sync(); input.focus(); } },
  });

  const el = h('div.search', null,
    h('span.search__icon', { html: icon('search') }),
    input,
    clearBtn);

  const sync = () => toggle(clearBtn, 'is-on', input.value.length > 0);

  const offInput = on(input, 'input', () => { sync(); onQuery?.(input.value); });
  const offFocus = on(input, 'focus', () => { el.classList.add('is-focused'); haptics.fire('tap'); onFocus?.(); });
  const offBlur = on(input, 'blur', () => { el.classList.remove('is-focused'); onBlur?.(); });
  const offKey = on(input, 'keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(input.value); input.blur(); }
    if (e.key === 'Escape') { input.value = ''; onQuery?.(''); sync(); input.blur(); }
  });

  return {
    el,
    input,
    focus: () => input.focus(),
    blur: () => input.blur(),
    update({ value, placeholder: ph, hidden }) {
      if (value !== undefined && input.value !== value) { input.value = value; sync(); }
      if (ph !== undefined) input.placeholder = ph;
      if (hidden !== undefined) toggle(el, 'is-hidden', hidden);
    },
    destroy() { offInput(); offFocus(); offBlur(); offKey(); },
  };
}
