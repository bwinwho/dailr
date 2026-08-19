/**
 * DIALR — NumberDisplay.
 *
 * The typed number, as a large editable-feeling readout. Two product rules:
 *
 *   - ONE TAP COPIES. No long press. Friction removed on purpose.
 *   - The type shrinks to fit rather than truncating; a phone number you can
 *     only see half of is useless.
 */
import { h, setText, toggle, on } from '../../core/dom.js';
import { formatNumber } from '../../core/format.js';
import haptics from '../../core/haptics.js';

export function NumberDisplay({ onCopy, onMatchTap }) {
  const value = h('button.numdisp__value.t-num', {
    type: 'button', aria: { label: 'Tap to copy the number' },
  });

  const matchName = h('span.numdisp__match-name');
  const matchMeta = h('span.numdisp__match-meta.t-micro.c-3');
  const match = h('button.numdisp__match', {
    type: 'button', on: { click: () => onMatchTap?.() },
  }, matchName, matchMeta);

  const copied = h('span.numdisp__copied.t-micro', { text: 'Copied' });

  const el = h('div.numdisp', null,
    h('div.numdisp__row', null, value, copied),
    match);

  /* one tap copies -------------------------------------------------------- */
  const offCopy = on(value, 'click', async () => {
    const raw = el.dataset.raw || '';
    if (!raw) return;
    haptics.fire('success');
    try { await navigator.clipboard.writeText(raw); }
    catch { /* clipboard blocked — the toast below still tells the truth */ }
    copied.classList.add('is-on');
    setTimeout(() => copied.classList.remove('is-on'), 1100);
    onCopy?.(raw);
  });

  /** Scale the readout down as it grows, instead of clipping it. */
  function fit(text) {
    const len = text.length;
    const scale = len <= 12 ? 1 : len <= 16 ? 0.86 : len <= 20 ? 0.72 : 0.6;
    value.style.setProperty('--num-scale', String(scale));
  }

  return {
    el,
    update({ input = '', match: m = null, region = 'IN' }) {
      const pretty = input ? formatNumber(input, region) : '';
      el.dataset.raw = input;
      setText(value, pretty);
      fit(pretty);
      toggle(el, 'is-empty', !input);

      if (m) {
        setText(matchName, m.name);
        setText(matchMeta, m.meta || '');
        toggle(matchMeta, 'is-hidden', !m.meta);
        match.dataset.tier = m.tier || 'saved';
      }
      toggle(match, 'is-on', !!m);
    },
    destroy() { offCopy(); },
  };
}
