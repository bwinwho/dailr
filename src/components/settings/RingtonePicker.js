/**
 * DIALR — RingtonePicker.
 *
 * Tapping a ringtone plays it. That sounds obvious and almost no dialer does
 * it without an extra step. Preview stops automatically when the sheet closes
 * so nothing keeps ringing in the user's pocket.
 */
import { h, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { RINGTONES } from '../../data/media.js';
import haptics from '../../core/haptics.js';

export function RingtonePicker({ current, scopeLabel, onSelect, onPreview, onStop, onPickCustom }) {
  let selected = current;

  const list = h('div.rpick__list');

  function render() {
    list.textContent = '';
    for (const rt of RINGTONES) {
      const isSel = rt.id === selected;
      list.appendChild(h('button.rpick__item', {
        type: 'button',
        dataset: { selected: String(isSel) },
        aria: { pressed: String(isSel) },
        on: {
          click: () => {
            haptics.fire('select');
            selected = rt.id;
            render();
            onSelect?.(rt);
            if (rt.metadata?.synth) onPreview?.(rt); else onStop?.();
          },
        },
      },
      h('span.rpick__play', { html: icon(rt.id === 'rt_silent' ? 'micOff' : 'play') }),
      h('span.col.grow', null,
        h('span.rpick__name.t-body', { text: rt.name }),
        h('span.rpick__pack.t-micro.c-3', { text: rt.pack === 'kode31' ? 'KODE31 MUSIC' : 'DIALR' })),
      isSel ? h('span.rpick__check', { html: icon('check') }) : null));
    }
  }

  const el = h('div.rpick', null,
    scopeLabel ? h('p.rpick__scope.t-caption', { text: scopeLabel }) : null,
    list,
    h('button.rpick__custom.t-label', {
      type: 'button',
      on: { click: () => onPickCustom?.() },
    }, h('span', { html: icon('upload') }), h('span', { text: 'Use a sound from this phone' })));

  render();
  return { el, update({ current: c }) { if (c) { selected = c; render(); } }, destroy() { onStop?.(); } };
}
