/**
 * DIALR — quick reply, reminder and SIM pickers.
 *
 * Small sheets that appear inside call flows. Each one is a single decision
 * with an obvious escape, because they interrupt a ringing phone.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { plural, clockTime } from '../../core/format.js';
import haptics from '../../core/haptics.js';

/** Three replies, editable in Settings. Nothing else — the brief is specific. */
export function QuickReplySheet({ replies, name, onSend, onCustom }) {
  const list = h('div.qreply__list');
  for (const text of replies) {
    list.appendChild(h('button.qreply__item', {
      type: 'button',
      on: { click: () => { haptics.fire('success'); onSend?.(text); } },
    }, h('span.t-body', { text })));
  }

  const el = h('div.qreply', null,
    h('p.qreply__lead.t-label.c-2', { text: name ? `Reply to ${name}` : 'Send a reply' }),
    list,
    h('button.qreply__custom.t-label', {
      type: 'button', text: 'Write something else',
      on: { click: () => onCustom?.() },
    }));

  return { el, update() {}, destroy() {} };
}

/**
 * ReminderPicker.
 *
 * Two decisions, kept apart on purpose: WHEN to be reminded, and WHETHER to
 * tell the other person. The second is opt-in per reminder because sending
 * someone an automated "I'll call you back" without meaning to is worse than
 * not calling back.
 */
export function ReminderPicker({ presets, name, tellThemDefault = 'ask', canTellThem = true, onConfirm, onCancel }) {
  let minutes = presets[1] ?? presets[0] ?? 30;
  let tellThem = tellThemDefault === 'always';

  const chips = h('div.chiprow.chiprow--wrap');
  const renderChips = () => {
    chips.textContent = '';
    for (const m of presets) {
      chips.appendChild(h('button.chip.chip--neutral', {
        type: 'button',
        dataset: { selected: String(m === minutes) },
        aria: { pressed: String(m === minutes) },
        on: { click: () => { haptics.fire('select'); minutes = m; renderChips(); syncPreview(); } },
      }, h('span.chip__label', { text: labelFor(m) })));
    }
  };

  const preview = h('div.reminder__preview.t-caption');
  const syncPreview = () => {
    const at = new Date(Date.now() + minutes * 60_000);
    setText(preview, `DIALR will remind you at ${clockTime(at.getTime(), { forceMinutes: true })}.`);
    setText(tellLabel, tellThem && name
      ? `${name} gets: “I’ll call you back in about ${labelFor(minutes)}.”`
      : 'They will not be told.');
  };

  const tellLabel = h('div.reminder__tell-label.t-caption');
  const tellSwitch = h('button.switch', {
    type: 'button', role: 'switch', aria: { checked: String(tellThem), label: 'Tell them' },
    on: { click: () => { tellThem = !tellThem; toggle(tellSwitch, 'is-on', tellThem);
                         tellSwitch.setAttribute('aria-checked', String(tellThem)); syncPreview(); } },
  }, h('span.switch__knob'));
  toggle(tellSwitch, 'is-on', tellThem);

  const el = h('div.reminder', null,
    h('p.reminder__lead.t-label.c-2', { text: name ? `Remind me to call ${name}` : 'Remind me to call back' }),
    chips,
    preview,
    canTellThem
      ? h('div.reminder__tell', null,
          h('div.col.grow', null, h('span.t-body-sm', { text: 'Let them know' }), tellLabel),
          tellSwitch)
      : null,
    h('div.reminder__actions', null,
      h('button.btn.btn--ghost.btn--md', { type: 'button', on: { click: () => onCancel?.() } },
        h('span.btn__text', null, h('span.btn__label', { text: 'Cancel' }))),
      h('button.btn.btn--primary.btn--md', { type: 'button',
        on: { click: () => { haptics.fire('success'); onConfirm?.({ minutes, tellThem }); } } },
        h('span.btn__text', null, h('span.btn__label', { text: 'Set reminder' })))));

  renderChips();
  syncPreview();
  return { el, update() {}, destroy() {} };
}

function labelFor(min) {
  if (min < 60) return `${min} min`;
  if (min < 1440) { const h_ = min / 60; return `${h_ % 1 ? h_.toFixed(1) : h_} ${plural(h_, 'hour', 'hours')}`; }
  const d = min / 1440;
  return `${d} ${plural(d, 'day', 'days')}`;
}

/** SIM chooser — shown before dialling when the default is "ask every time". */
export function SimSelector({ sims, preferred, name, onPick, onRemember }) {
  let remember = false;

  const list = h('div.simpick__list');
  for (const sim of sims) {
    list.appendChild(h('button.simpick__item', {
      type: 'button',
      dataset: { preferred: String(sim.id === preferred) },
      style: { '--sim-colour': sim.colour },
      on: { click: () => { haptics.fire('select'); onPick?.(sim.id, remember); } },
    },
    h('span.simpick__slot.t-micro', { text: `SIM ${sim.slot}` }),
    h('span.simpick__label.t-title', { text: sim.label }),
    h('span.simpick__num.t-caption.c-3', { text: sim.number }),
    sim.id === preferred ? h('span.simpick__flag.t-micro', { text: 'Usual' }) : null));
  }

  const rememberBtn = h('button.simpick__remember.t-label', {
    type: 'button',
    on: { click: () => { remember = !remember; toggle(rememberBtn, 'is-on', remember); onRemember?.(remember); } },
  }, h('span.simpick__check', { html: icon('check') }),
     h('span', { text: name ? `Always use this for ${name}` : 'Remember this choice' }));

  const el = h('div.simpick', null,
    h('p.simpick__lead.t-label.c-2', { text: 'Call with' }),
    list,
    rememberBtn);

  return { el, update() {}, destroy() {} };
}

/**
 * RepeatCallerPrompt — the "BLOCK THIS CALLER?" moment.
 * Offers a temporary block first, because most repeat-call bursts are a
 * delivery driver, not a harasser, and a permanent block is hard to undo.
 */
export function RepeatCallerPrompt({ number, burst, onAction }) {
  const el = h('div.repeat', null,
    h('div.repeat__icon', { html: icon('warn') }),
    h('h3.repeat__title.t-title', { text: 'That number keeps calling' }),
    h('p.repeat__body.t-body-sm.c-2', {
      text: `${number} has called ${burst.count} times in ${burst.spanMin} minutes without getting through.`,
    }),
    h('div.repeat__actions', null,
      ...[
        { id: 'silence', label: 'Silence for 1 hour', tone: '' },
        { id: 'block', label: 'Block this number', tone: 'is-danger' },
        { id: 'report', label: 'Block and report spam', tone: 'is-danger' },
        { id: 'ignore', label: 'Leave it alone', tone: 'is-ghost' },
      ].map((a) => h(`button.repeat__action.${a.tone || 'is-plain'}`, {
        type: 'button', text: a.label,
        on: { click: () => onAction?.(a.id) },
      }))));
  return { el, update() {}, destroy() {} };
}
