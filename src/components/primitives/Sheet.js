/**
 * DIALR — sheets and modals.
 *
 * "EXPAND, DON'T INTERRUPT" in code: a Sheet grows upward from the bottom
 * interaction zone and stops short of the dock, which stays visible and live.
 * A Modal is the exception — reserved for destructive confirmations, where
 * interrupting is the point.
 */
import { h, on, trapFocus, reflow, afterTransition } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import haptics from '../../core/haptics.js';

/**
 * @param {object} p
 * @param {string} [p.title]
 * @param {Node}   p.content
 * @param {'peek'|'half'|'tall'|'full'} [p.height]  full still stops at the dock
 * @param {boolean} [p.dismissible]
 * @param {Function} [p.onClose]
 */
export function Sheet(p = {}) {
  const props = { height: 'half', dismissible: true, ...p };

  const grabber = h('div.sheet__grabber', { aria: { hidden: 'true' } });
  // Always render the title slot, even when empty, so space-between keeps the
  // close button on the right instead of collapsing it to the left.
  const titleEl = h('h2.sheet__title.t-label.c-2', { text: props.title || '' });
  const closeBtn = props.dismissible
    ? h('button.sheet__close', { type: 'button', aria: { label: 'Close' },
        html: icon('close'), on: { click: () => close() } })
    : null;

  const head = (titleEl || closeBtn) ? h('header.sheet__head', null, titleEl, closeBtn) : null;
  const body = h('div.sheet__body.scroll', null, props.content);

  const panel = h(`section.sheet.sheet--${props.height}`, {
    role: 'dialog', 'aria-modal': 'false', tabindex: '-1',
    aria: { label: props.title || 'Details' },
  }, grabber, head, body);

  const backdrop = h('div.sheet__backdrop', { on: { click: () => props.dismissible && close() } });
  const el = h('div.sheet__layer', null, backdrop, panel);

  let releaseFocus = null;
  let closing = false;

  /* ---- drag-to-dismiss: the gesture users expect from a bottom sheet ---- */
  let startY = 0, currentY = 0, dragging = false;
  const offDown = on(panel, 'pointerdown', (e) => {
    if (!props.dismissible) return;
    // Only start a drag from the grabber/header, so the body still scrolls.
    if (!(e.target.closest('.sheet__grabber') || e.target.closest('.sheet__head'))) return;
    dragging = true; startY = e.clientY; currentY = 0;
    panel.setPointerCapture?.(e.pointerId);
    panel.style.transition = 'none';
  });
  const offMove = on(panel, 'pointermove', (e) => {
    if (!dragging) return;
    currentY = Math.max(0, e.clientY - startY);
    panel.style.transform = `translate3d(0, ${currentY}px, 0)`;
    backdrop.style.opacity = String(Math.max(0, 1 - currentY / 320));
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    panel.style.transform = '';
    backdrop.style.opacity = '';
    if (currentY > 110) close();
  };
  const offUp = on(panel, 'pointerup', endDrag);
  const offCancel = on(panel, 'pointercancel', endDrag);

  const offKey = on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && props.dismissible) { e.stopPropagation(); close(); }
  });

  async function open() {
    reflow(el);
    el.classList.add('is-open');
    releaseFocus = trapFocus(panel);
    panel.focus({ preventScroll: true });
    haptics.fire('expand');
  }

  async function close() {
    if (closing) return;
    closing = true;
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    await afterTransition(panel, 420);
    props.onClose?.();
    destroy();
  }

  function destroy() {
    releaseFocus?.();
    offDown(); offMove(); offUp(); offCancel(); offKey();
    el.remove();
  }

  return { el, panel, body, open, close, destroy, update() {} };
}

/**
 * Modal: centred, blocking, for destructive confirmation only.
 * @param {{title, message, confirmLabel, cancelLabel, dangerous, onConfirm, onCancel}} p
 */
export function Modal(p = {}) {
  const props = { confirmLabel: 'Confirm', cancelLabel: 'Cancel', ...p };

  const confirm = h('button.modal__btn.modal__btn--confirm', {
    type: 'button', class: props.dangerous ? 'is-danger' : null, text: props.confirmLabel,
    on: { click: () => { haptics.fire(props.dangerous ? 'warn' : 'success'); props.onConfirm?.(); close(); } },
  });
  const cancel = h('button.modal__btn', {
    type: 'button', text: props.cancelLabel,
    on: { click: () => { props.onCancel?.(); close(); } },
  });

  const panel = h('div.modal', { role: 'alertdialog', 'aria-modal': 'true', tabindex: '-1' },
    h('h2.modal__title.t-title', { text: props.title || '' }),
    props.message ? h('p.modal__msg.t-body-sm.c-2', { text: props.message }) : null,
    h('div.modal__actions', null, cancel, confirm));

  const el = h('div.modal__layer', null,
    h('div.modal__backdrop', { on: { click: () => { props.onCancel?.(); close(); } } }), panel);

  let releaseFocus = null;
  const offKey = on(document, 'keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); props.onCancel?.(); close(); }
  });

  function open() {
    reflow(el);
    el.classList.add('is-open');
    releaseFocus = trapFocus(panel);
    cancel.focus({ preventScroll: true });
  }
  async function close() {
    el.classList.remove('is-open');
    await afterTransition(panel, 320);
    releaseFocus?.(); offKey(); el.remove();
  }

  return { el, open, close, update() {}, destroy: close };
}
