/**
 * DIALR — DialPad.
 *
 * A keypad has exactly one job and everyone already knows how to use it, so
 * this component's design brief is "do not be clever". What it does add:
 *
 *   - letters under digits, because T9 search needs them to be discoverable
 *   - hold 0 for +, the universal convention
 *   - hold 1-9 for speed dial, opt-in via Settings ▸ Smart
 *   - DTMF tones and haptics, so it feels like a phone rather than a web page
 */
import { h, on } from '../../core/dom.js';
import { t9Letters } from '../../core/format.js';
import { DTMF } from '../../data/media.js';
import * as audio from '../../services/mock/audio.js';
import haptics from '../../core/haptics.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function DialPad({ onDigit, onLongPress, tones = true, hapticsOn = true }) {
  let opts = { tones, hapticsOn };
  const el = h('div.dialpad', { role: 'group', aria: { label: 'Keypad' } });
  const cleanups = [];

  for (const key of KEYS) {
    const letters = t9Letters(key);
    const sub = key === '0' ? '+' : letters;

    const btn = h('button.dialpad__key', {
      type: 'button',
      dataset: { key },
      aria: { label: letters ? `${key} ${letters.split('').join(' ')}` : key },
    },
    h('span.dialpad__digit.t-num', { text: key }),
    sub ? h('span.dialpad__letters.t-micro', { text: sub }) : null);

    let timer = null;
    let fired = false;

    cleanups.push(on(btn, 'pointerdown', (ev) => {
      ev.preventDefault();
      fired = false;
      btn.classList.add('is-down');
      if (opts.hapticsOn) haptics.fire('key');
      if (opts.tones) audio.playDtmf(DTMF[key]);
      onDigit?.(key);
      timer = setTimeout(() => {
        fired = true;
        haptics.fire('toggle');
        onLongPress?.(key);
      }, 520);
    }));

    const release = () => { clearTimeout(timer); btn.classList.remove('is-down'); };
    cleanups.push(on(btn, 'pointerup', release));
    cleanups.push(on(btn, 'pointerleave', release));
    cleanups.push(on(btn, 'pointercancel', release));
    // Keyboard parity for desktop development and switch access.
    cleanups.push(on(btn, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDigit?.(key); }
    }));

    el.appendChild(btn);
  }

  return {
    el,
    update(next) { opts = { ...opts, ...next }; },
    destroy() { for (const c of cleanups) c(); },
  };
}

/** Physical-keyboard support, so the demo is usable on a laptop. */
export function bindKeyboard(target, { onDigit, onBackspace, onCall }) {
  return on(target, 'keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (/^[0-9*#]$/.test(e.key)) { onDigit?.(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { onBackspace?.(); e.preventDefault(); }
    else if (e.key === 'Enter') { onCall?.(); e.preventDefault(); }
    else if (e.key === '+') { onDigit?.('+'); e.preventDefault(); }
  });
}
