/**
 * DIALR — buttons.
 *
 * Every interactive control in the app comes from here, which is how the
 * 48px minimum touch target and the "critical actions are always obvious"
 * accessibility rule get enforced once instead of remembered thirty times.
 */
import { h, setText, toggle, setAttr } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import haptics from '../../core/haptics.js';

/**
 * @param {object} p
 * @param {string} p.label
 * @param {string} [p.sub]        second line, smaller
 * @param {string} [p.icon]
 * @param {'primary'|'secondary'|'ghost'|'danger'|'positive'} [p.variant]
 * @param {'sm'|'md'|'lg'} [p.size]
 * @param {boolean} [p.block]     full width
 * @param {string} [p.haptic]
 */
export function Button(p = {}) {
  let props = { variant: 'primary', size: 'md', haptic: 'tap', ...p };

  const iconEl = props.icon ? h('span.btn__icon', { html: icon(props.icon) }) : null;
  const labelEl = h('span.btn__label', { text: props.label || '' });
  const subEl = props.sub ? h('span.btn__sub', { text: props.sub }) : null;
  const textWrap = h('span.btn__text', null, labelEl, subEl);

  const el = h(`button.btn.btn--${props.variant}.btn--${props.size}`, {
    type: 'button',
    class: props.block ? 'btn--block' : null,
    disabled: !!props.disabled,
    aria: { label: props.ariaLabel || undefined, busy: props.busy || undefined },
    on: {
      click: (e) => {
        if (props.disabled || props.busy) return;
        haptics.fire(props.haptic);
        props.onClick?.(e);
      },
    },
  }, iconEl, textWrap);

  return {
    el,
    update(next) {
      props = { ...props, ...next };
      setText(labelEl, props.label || '');
      if (subEl) { setText(subEl, props.sub || ''); toggle(subEl, 'is-hidden', !props.sub); }
      if (iconEl && next.icon !== undefined) iconEl.innerHTML = icon(props.icon);
      el.disabled = !!props.disabled;
      toggle(el, 'is-busy', !!props.busy);
      for (const v of ['primary', 'secondary', 'ghost', 'danger', 'positive']) {
        toggle(el, `btn--${v}`, props.variant === v);
      }
    },
    destroy() {},
  };
}

/**
 * A circular icon-only control. `label` is mandatory — it becomes the
 * accessible name, and optionally a visible caption when the user has turned
 * on "always label icons".
 */
export function IconButton(p = {}) {
  let props = { size: 'md', variant: 'surface', haptic: 'tap', ...p };

  const glyph = h('span.iconbtn__glyph', { html: icon(props.icon) });
  const caption = h('span.iconbtn__caption.t-micro', { text: props.label || '' });

  const el = h(`button.iconbtn.iconbtn--${props.size}.iconbtn--${props.variant}`, {
    type: 'button',
    disabled: !!props.disabled,
    aria: { label: props.label, pressed: props.pressed === undefined ? undefined : String(!!props.pressed) },
    dataset: { active: props.active ? 'true' : 'false' },
    on: {
      click: (e) => {
        if (props.disabled) return;
        haptics.fire(props.haptic);
        props.onClick?.(e);
      },
    },
  }, glyph, caption);

  return {
    el,
    update(next) {
      props = { ...props, ...next };
      if (next.icon !== undefined) glyph.innerHTML = icon(props.icon);
      setText(caption, props.label || '');
      setAttr(el, 'aria-label', props.label);
      if (props.pressed !== undefined) setAttr(el, 'aria-pressed', String(!!props.pressed));
      el.dataset.active = props.active ? 'true' : 'false';
      el.disabled = !!props.disabled;
      toggle(el, 'is-on', !!props.pressed);
    },
    destroy() {},
  };
}

/** The two call actions. Deliberately the largest targets in the product. */
export function CallActionButton({ kind = 'answer', label, onClick, large = false }) {
  const el = h(`button.callbtn.callbtn--${kind}`, {
    type: 'button',
    class: large ? 'callbtn--large' : null,
    aria: { label: label || (kind === 'answer' ? 'Answer' : 'Decline') },
    on: { click: (e) => { haptics.fire(kind === 'answer' ? 'answer' : 'hangup'); onClick?.(e); } },
  }, h('span.callbtn__glyph', { html: icon(kind === 'answer' ? 'phoneFill' : 'phoneDown') }));
  return { el, update() {}, destroy() {} };
}
