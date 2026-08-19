/**
 * DIALR — toasts.
 *
 * Anchored above the dock so they never cover it, capped at three, and always
 * dismissible. A toast may carry ONE action ("Undo") — anything more is a sheet.
 */
import { h, reflow, afterTransition } from '../../core/dom.js';
import { icon } from '../../core/icons.js';

export function Toast({ text, tone = 'neutral', iconName, actionLabel, onAction, onDismiss, duration = 4200 }) {
  const action = actionLabel
    ? h('button.toast__action.t-label', { type: 'button', text: actionLabel,
        on: { click: () => { onAction?.(); dismiss(); } } })
    : null;

  const el = h(`div.toast.toast--${tone}`, { role: 'status', 'aria-live': 'polite' },
    iconName ? h('span.toast__icon', { html: icon(iconName) }) : null,
    h('span.toast__text.t-body-sm', { text }),
    action);

  let timer = null;
  let dismissed = false;

  function show() {
    reflow(el);
    el.classList.add('is-in');
    if (duration > 0) timer = setTimeout(dismiss, duration);
  }

  async function dismiss() {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timer);
    el.classList.remove('is-in');
    el.classList.add('is-out');
    await afterTransition(el, 400);
    onDismiss?.();
    el.remove();
  }

  // Pause the countdown while the user is touching it.
  el.addEventListener('pointerenter', () => clearTimeout(timer));
  el.addEventListener('pointerleave', () => { if (duration > 0 && !dismissed) timer = setTimeout(dismiss, 1600); });

  return { el, show, dismiss, update() {}, destroy: dismiss };
}
