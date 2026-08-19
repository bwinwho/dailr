/**
 * DIALR — DialCallButton.
 *
 * The persistent call action for the Dialer tab. Lives under the keypad, in
 * the deck, rather than in the dock's context row.
 *
 * WHY IT MOVED HERE (see docs/UI_REVISION_PLAN.md § D3):
 * The dock and the keypad both live in the same bottom-anchored column. When
 * the dock grew a context row for "CALL AVNI", that row's height pushed
 * everything above it — including the keypad — upward. Measured at 122px of
 * drift while typing six digits. A control that appears and disappears based
 * on what you've typed cannot live next to what you're typing.
 *
 * This button is mounted exactly once and never removed from the layout; only
 * its label, tone and disabled state change. That is what makes it stationary.
 *
 * It renders as a circular icon button, no visible text — the visible "Call
 * AVNI · Mobile" line lives in NumberDisplay's .numdisp__match row instead,
 * which is already reserved-height so it can't shift anything either. label/
 * sub still exist (from dialCallModel) and feed aria-label only.
 */
import { h, toggle, on } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatNumber } from '../../core/format.js';
import haptics from '../../core/haptics.js';

const LONG_PRESS_MS = 480;

export function DialCallButton({ onCall, onLongPress }) {
  let target = null;   // { number, contactKey } | null

  const el = h('button.dialcall', {
    type: 'button', disabled: true,
    dataset: { tone: 'accent' },
    aria: { label: 'Call' },
  }, h('span', { html: icon('phoneFill') }));

  let holdTimer = null;
  let longPressed = false;

  const offDown = on(el, 'pointerdown', () => {
    if (!target) return;
    longPressed = false;
    holdTimer = setTimeout(() => {
      longPressed = true;
      haptics.fire('toggle');
      onLongPress?.(target);
    }, LONG_PRESS_MS);
  });
  const clearHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  const offUp = on(el, 'pointerup', clearHold);
  const offLeave = on(el, 'pointerleave', clearHold);
  const offCancel = on(el, 'pointercancel', clearHold);

  const offClick = on(el, 'click', () => {
    if (longPressed || !target) { longPressed = false; return; }
    haptics.fire('success');
    onCall?.(target);
  });

  function update({ state, label: l, sub: s, tone, disabled, number, contactKey }) {
    target = disabled ? null : { number, contactKey };
    el.disabled = !!disabled;
    el.dataset.tone = tone || 'accent';
    el.setAttribute('aria-label', s ? `${l}, ${s}` : (l || 'Call'));
  }

  return { el, update, destroy() { offDown(); offUp(); offLeave(); offCancel(); offClick(); } };
}

/** Derives the button's label/target from the dialer match — one place. */
export function dialCallModel(match) {
  if (!match || match.state === 'empty' || match.state === 'typing') {
    return { label: 'Call', disabled: true };
  }
  if (match.state === 'contact') {
    const v = match.primary.view;
    const num = match.primary.number;
    return {
      label: `Call ${v.firstName}`,
      sub: v.numbers.length > 1 ? (v.numbers.find((n) => n.value === num)?.label || null) : null,
      tone: 'accent', number: num, contactKey: v.key,
    };
  }
  if (match.state === 'dialr') {
    const p = match.primary.profile;
    return {
      label: `Call ${p.firstName}`,
      sub: 'On DIALR — not in your contacts',
      tone: 'accent', number: match.primary.number, contactKey: null,
    };
  }
  if (match.state === 'unknown') {
    const spammy = match.spam && match.spam.score >= 0.75;
    return {
      label: `Call ${formatNumber(match.input)}`,
      sub: spammy ? 'Reported as spam' : null,
      tone: spammy ? 'warn' : 'accent', number: match.input, contactKey: null,
    };
  }
  if (match.state === 'code') {
    return { label: 'Run code', sub: match.input, tone: 'neutral', number: match.input, contactKey: null };
  }
  return { label: 'Call', disabled: true };
}
