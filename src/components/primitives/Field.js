/**
 * DIALR — form controls.
 *
 * All of Settings renders from these five. Each is a labelled row rather than a
 * bare input, because a control without an always-visible label is a control
 * you have to remember the meaning of.
 */
import { h, setText, toggle, on } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import haptics from '../../core/haptics.js';

function row({ label, hint, control, dangerous, onClick, trailing }) {
  const text = h('div.field__text', null,
    h('div.field__label', { text: label }),
    hint ? h('div.field__hint.t-caption', { text: hint }) : null);
  const el = h(onClick ? 'button.field' : 'div.field', {
    type: onClick ? 'button' : null,
    class: dangerous ? 'field--danger' : null,
    on: onClick ? { click: onClick } : undefined,
  }, text, control || trailing || null);
  return { el, text };
}

export function Switch({ label, hint, value, onChange, dangerous }) {
  const knob = h('span.switch__knob');
  const track = h('button.switch', {
    type: 'button', role: 'switch',
    aria: { checked: String(!!value), label },
    on: { click: () => { haptics.fire('toggle'); onChange?.(!current); } },
  }, knob);
  let current = !!value;
  toggle(track, 'is-on', current);

  const r = row({ label, hint, control: track, dangerous });
  return {
    el: r.el,
    update({ value: v, hint: hi }) {
      if (v !== undefined) { current = !!v; toggle(track, 'is-on', current); track.setAttribute('aria-checked', String(current)); }
      if (hi !== undefined) { const n = r.el.querySelector('.field__hint'); if (n) setText(n, hi); }
    },
    destroy() {},
  };
}

export function Segment({ label, hint, value, options, onChange }) {
  const btns = options.map((o) => h('button.segment__opt', {
    type: 'button', text: o.label,
    dataset: { value: o.value },
    aria: { pressed: String(o.value === value) },
    on: { click: () => { haptics.fire('select'); onChange?.(o.value); } },
  }));
  const indicator = h('span.segment__indicator', { aria: { hidden: 'true' } });
  const group = h('div.segment', { role: 'group', aria: { label } }, indicator, ...btns);

  const optHint = h('div.field__hint.t-caption');
  const el = h('div.field.field--stack', null,
    h('div.field__text', null,
      h('div.field__label', { text: label }),
      hint ? h('div.field__hint.t-caption', { text: hint }) : null),
    group, optHint);

  const sync = (v) => {
    const i = Math.max(0, options.findIndex((o) => o.value === v));
    indicator.style.setProperty('--seg-count', String(options.length));
    indicator.style.setProperty('--seg-index', String(i));
    btns.forEach((b, bi) => b.setAttribute('aria-pressed', String(bi === i)));
    const chosen = options[i];
    setText(optHint, chosen?.hint || '');
    toggle(optHint, 'is-hidden', !chosen?.hint);
  };
  sync(value);

  return { el, update({ value: v }) { if (v !== undefined) sync(v); }, destroy() {} };
}

export function Slider({ label, hint, value, min, max, step, unit = '', format, onChange }) {
  const fmt = (v) => {
    if (format === 'percent') return `${Math.round(v * 100)}%`;
    if (format === 'scale') return `${Math.round(v * 100)}%`;
    return `${v}${unit}`;
  };
  const readout = h('span.slider__value.t-num', { text: fmt(value) });
  const input = h('input.slider__input', {
    type: 'range', min, max, step, value,
    aria: { label },
    on: {
      input: (e) => { const v = Number(e.target.value); setText(readout, fmt(v)); paint(v); },
      change: (e) => { haptics.fire('select'); onChange?.(Number(e.target.value)); },
    },
  });
  const paint = (v) => input.style.setProperty('--slider-pct', `${((v - min) / (max - min)) * 100}%`);
  paint(value);

  const el = h('div.field.field--stack', null,
    h('div.field__text.row.between', null,
      h('div', null,
        h('div.field__label', { text: label }),
        hint ? h('div.field__hint.t-caption', { text: hint }) : null),
      readout),
    h('div.slider', null, input));

  return {
    el,
    update({ value: v }) { if (v !== undefined) { input.value = v; setText(readout, fmt(v)); paint(v); } },
    destroy() {},
  };
}

export function TextField({ label, hint, value, placeholder, maxLength, onChange, multiline, counter }) {
  const count = h('span.textfield__count.t-micro.c-3');
  const input = h(multiline ? 'textarea.textfield__input' : 'input.textfield__input', {
    value: value ?? '', placeholder: placeholder || '', maxlength: maxLength || undefined,
    rows: multiline ? 2 : undefined, aria: { label },
    on: {
      input: (e) => { updateCount(e.target.value); onChange?.(e.target.value); },
    },
  });
  const updateCount = (v) => {
    if (!maxLength || !counter) return;
    setText(count, `${v.length}/${maxLength}`);
    toggle(count, 'is-full', v.length >= maxLength);
  };
  updateCount(value ?? '');

  const el = h('div.field.field--stack', null,
    h('div.field__text.row.between', null,
      h('div', null,
        h('div.field__label', { text: label }),
        hint ? h('div.field__hint.t-caption', { text: hint }) : null),
      counter ? count : null),
    h('div.textfield', null, input));

  return {
    el, input,
    update({ value: v }) { if (v !== undefined && input.value !== v) { input.value = v; updateCount(v); } },
    destroy() {},
  };
}

export function SelectField({ label, hint, value, options, onChange }) {
  const current = h('span.select__value', { text: options.find((o) => o.value === value)?.label || '' });
  const el = h('button.field.field--nav', {
    type: 'button',
    on: { click: () => onChange?.(options, current) },
  },
  h('div.field__text', null,
    h('div.field__label', { text: label }),
    hint ? h('div.field__hint.t-caption', { text: hint }) : null),
  h('span.field__trailing', null, current, h('span.field__chev', { html: icon('chevronR') })));

  return {
    el,
    update({ value: v }) { if (v !== undefined) setText(current, options.find((o) => o.value === v)?.label || ''); },
    destroy() {},
  };
}

export function NavField({ label, hint, valueText, iconName, onClick, dangerous }) {
  const val = h('span.select__value', { text: valueText || '' });
  const el = h('button.field.field--nav', {
    type: 'button', class: dangerous ? 'field--danger' : null,
    on: { click: onClick },
  },
  iconName ? h('span.field__icon', { html: icon(iconName) }) : null,
  h('div.field__text', null,
    h('div.field__label', { text: label }),
    hint ? h('div.field__hint.t-caption', { text: hint }) : null),
  h('span.field__trailing', null, val, h('span.field__chev', { html: icon('chevronR') })));
  return { el, update({ valueText: v }) { if (v !== undefined) setText(val, v); }, destroy() {} };
}

export function ChipsField({ label, hint, value = [], options = [], unit = '', onChange }) {
  const wrap = h('div.chiprow.chiprow--wrap');
  const render = (sel) => {
    wrap.textContent = '';
    for (const o of options) {
      const on_ = sel.includes(o);
      wrap.appendChild(h('button.chip.chip--neutral', {
        type: 'button', dataset: { selected: String(on_) },
        aria: { pressed: String(on_) },
        on: { click: () => {
          haptics.fire('select');
          const next = on_ ? sel.filter((x) => x !== o) : [...sel, o].sort((a, b) => a - b);
          if (next.length) { render(next); onChange?.(next); }
        } },
      }, h('span.chip__label', { text: `${o}${unit ? ' ' + unit : ''}` })));
    }
  };
  render(value);
  const el = h('div.field.field--stack', null,
    h('div.field__text', null,
      h('div.field__label', { text: label }),
      hint ? h('div.field__hint.t-caption', { text: hint }) : null),
    wrap);
  return { el, update({ value: v }) { if (v) render(v); }, destroy() {} };
}

export function InfoField({ label, hint }) {
  const el = h('div.field.field--info', null,
    h('div.field__text', null,
      h('div.field__label.t-body-sm', { text: label }),
      hint ? h('div.field__hint.t-caption', { text: hint }) : null));
  return { el, update() {}, destroy() {} };
}

export function ActionField({ label, hint, dangerous, onClick }) {
  const el = h('button.field.field--action', {
    type: 'button', class: dangerous ? 'field--danger' : null,
    on: { click: onClick },
  }, h('div.field__text', null,
    h('div.field__label', { text: label }),
    hint ? h('div.field__hint.t-caption', { text: hint }) : null));
  return { el, update() {}, destroy() {} };
}

export function TimeField({ label, hint, value, onChange }) {
  const input = h('input.timefield__input', {
    type: 'time', value, aria: { label },
    on: { change: (e) => onChange?.(e.target.value) },
  });
  const el = h('div.field', null,
    h('div.field__text', null,
      h('div.field__label', { text: label }),
      hint ? h('div.field__hint.t-caption', { text: hint }) : null),
    h('div.timefield', null, input));
  return { el, update({ value: v }) { if (v !== undefined) input.value = v; }, destroy() {} };
}

export { row as fieldRow };
