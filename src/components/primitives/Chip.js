/**
 * DIALR — chips: the app's smallest unit of meaning.
 * Used for spam verdicts, "first time", SIM labels, filters and note previews.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

/**
 * @param {object} p
 * @param {'neutral'|'accent'|'positive'|'warn'|'negative'|'note'} [p.tone]
 * @param {boolean} [p.selectable]
 */
export function Chip(p = {}) {
  let props = { tone: 'neutral', ...p };

  const glyph = props.icon ? h('span.chip__icon', { html: icon(props.icon) }) : null;
  const label = h('span.chip__label', { text: props.label || '' });

  const el = h(props.onClick ? 'button.chip' : 'span.chip', {
    class: `chip--${props.tone}`,
    type: props.onClick ? 'button' : null,
    dataset: { selected: props.selected ? 'true' : 'false' },
    aria: props.onClick ? { pressed: props.selectable ? String(!!props.selected) : undefined } : undefined,
    on: props.onClick ? { click: (e) => props.onClick(e) } : undefined,
  }, glyph, label);

  return {
    el,
    update(next) {
      props = { ...props, ...next };
      setText(label, props.label || '');
      if (glyph && next.icon !== undefined) glyph.innerHTML = icon(props.icon);
      for (const t of ['neutral', 'accent', 'positive', 'warn', 'negative', 'note']) {
        toggle(el, `chip--${t}`, props.tone === t);
      }
      el.dataset.selected = props.selected ? 'true' : 'false';
    },
    destroy() {},
  };
}

/** Convenience: build a row of chips from plain descriptors. */
export function ChipRow(items = []) {
  const el = h('div.chiprow');
  const instances = items.map((it) => { const c = Chip(it); el.appendChild(c.el); return c; });
  return {
    el,
    update(next = []) {
      // Chip rows are short; a rebuild is cheaper than reconciliation here.
      el.textContent = '';
      instances.length = 0;
      for (const it of next) { const c = Chip(it); instances.push(c); el.appendChild(c.el); }
    },
    destroy() {},
  };
}
