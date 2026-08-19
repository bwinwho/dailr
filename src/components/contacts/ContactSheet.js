/**
 * DIALR — ContactSheet.
 *
 * The expanded contact layer. Structured around the product's three-store
 * identity split, and it says so out loud:
 *
 *   THEM ON DIALR    their published profile — theirs, not yours
 *   ON THIS PHONE    the device contact — the name YOU saved
 *   ONLY YOU SEE     your label, note, saved place, ringtone, SIM
 *
 * Showing the boundary in the UI is the honest version of the privacy model.
 * A user who can see which half is private will actually use the private half.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatNumber, relativeTime, PRONOUN_OPTIONS, spokenDuration } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

export function ContactSheet({ detail, settings, number, onAction }) {
  let props = { detail, settings, number };

  const eyebrow = h('div.csheet__eyebrow.t-eyebrow');
  const name = h('h2.csheet__name.t-display-m');
  const sub = h('div.csheet__sub.t-label.c-3');
  const avatar = Avatar({ size: 'lg', name: '', src: null });

  const actionRow = h('div.csheet__actions');
  const numbers = h('div.csheet__numbers');
  const smart = h('div.csheet__smart');
  const dialrBlock = h('div.csheet__dialr');
  const privateBlock = h('div.csheet__private');
  const dangerBlock = h('div.csheet__danger');

  const el = h('div.csheet', null,
    h('div.csheet__head', null, avatar.el,
      h('div.col.grow', null, eyebrow, name, sub)),
    actionRow,
    smart,
    h('div.csheet__group', null,
      h('h3.csheet__group-title.t-micro.c-4', { text: 'On this phone' }),
      numbers),
    dialrBlock,
    privateBlock,
    dangerBlock);

  const ACTIONS = [
    { id: 'call',     ic: 'phone',    label: 'Call',    tone: 'accent' },
    { id: 'text',     ic: 'message',  label: 'Message' },
    { id: 'whatsapp', ic: 'whatsapp', label: 'WhatsApp' },
    { id: 'history',  ic: 'clock',    label: 'History' },
    { id: 'remind',   ic: 'bell',     label: 'Remind' },
  ];

  function renderActions() {
    actionRow.textContent = '';
    for (const a of ACTIONS) {
      actionRow.appendChild(h(`button.csheet__action${a.tone ? '.is-accent' : ''}`, {
        type: 'button', aria: { label: a.label },
        on: { click: () => { haptics.fire('tap'); onAction?.(a.id); } },
      }, h('span.csheet__action-icon', { html: icon(a.ic) }),
         h('span.t-micro', { text: a.label })));
    }
  }

  function renderSmart(d) {
    smart.textContent = '';
    const bits = [];
    if (d.bestTime) bits.push({ ic: 'spark', text: d.bestTime.label });
    if (d.debt) bits.push({ ic: 'return', text: `You have not called back since ${relativeTime(d.debt.since)}`, tone: 'warn' });
    if (d.spam?.score >= 0.5 && !d.view?.trusted) {
      bits.push({ ic: 'shield', text: `Reported by ${d.spam.reports} people${d.spam.category ? ` — ${d.spam.category}` : ''}`, tone: 'negative' });
    }
    const last = d.entries[0];
    if (last) {
      bits.push({
        ic: 'clock',
        text: `${d.entries.length} calls · ${spokenDuration(d.entries.reduce((a, e) => a + e.durationSec, 0))} total`,
      });
    }
    for (const b of bits) {
      smart.appendChild(h(`div.csheet__smart-line${b.tone ? '.is-' + b.tone : ''}`, null,
        h('span', { html: icon(b.ic) }),
        h('span.t-body-sm', { text: b.text })));
    }
    toggle(smart, 'is-hidden', !bits.length);
  }

  function renderNumbers(d) {
    numbers.textContent = '';
    const list = d.view?.numbers?.length ? d.view.numbers : [{ value: props.number, label: 'Number', primary: true }];
    for (const n of list) {
      numbers.appendChild(h('button.csheet__number', {
        type: 'button',
        on: { click: () => onAction?.('call-number', n.value) },
      },
      h('span.col.grow', null,
        h('span.t-body.t-num', { text: formatNumber(n.value) }),
        h('span.t-caption', { text: n.label || 'Mobile' })),
      h('span.csheet__number-copy', {
        html: icon('copy'),
        on: { click: (e) => { e.stopPropagation(); onAction?.('copy-number', n.value); } },
      })));
    }
    if (!d.view) {
      numbers.appendChild(h('button.csheet__addcontact.t-label', {
        type: 'button', text: 'Save this number to contacts',
        on: { click: () => onAction?.('save') },
      }));
    }
  }

  function renderDialr(d, settings) {
    dialrBlock.textContent = '';
    if (!d.profile || !settings.identity.dialrEnabled) { toggle(dialrBlock, 'is-hidden', true); return; }
    toggle(dialrBlock, 'is-hidden', false);
    const p = d.profile;
    dialrBlock.appendChild(h('h3.csheet__group-title.t-micro.c-4', { text: 'Them on DIALR' }));
    dialrBlock.appendChild(h('button.csheet__dialr-card', {
      type: 'button',
      on: { click: () => onAction?.('open-dialr-profile') },
    },
    h('span.col.grow', null,
      h('span.t-body', { text: [p.firstName, p.surname].filter(Boolean).join(' ') }),
      h('span.t-caption', { text: p.role || `@${p.handle}` })),
    p.verified ? h('span.csheet__verified', { html: icon('shieldOk') }) : null,
    h('span', { html: icon('chevronR') })));
  }

  function renderPrivate(d) {
    privateBlock.textContent = '';
    const v = d.view;
    privateBlock.appendChild(h('h3.csheet__group-title.t-micro.c-4', { text: 'Only you see this' }));

    const rows = [
      { id: 'label',    label: 'Label',        value: v?.label || 'Add one', icon: 'edit' },
      { id: 'pronouns', label: 'Refer to them as', value: v?.pronouns || 'they/them', icon: 'person' },
      { id: 'note',     label: 'Note',         value: v?.note || 'Add a note', icon: 'note' },
      { id: 'place',    label: 'Saved place',  value: v?.savedPlace ? `${v.savedPlace.label} · ${v.savedPlace.area}` : 'Add a place', icon: 'mapPin' },
      { id: 'ringtone', label: 'Ringtone',     value: v?.ringtoneId ? 'Custom' : 'Default', icon: 'wave' },
      { id: 'background', label: 'Call background', value: v?.backgroundId ? 'Custom' : 'Default', icon: 'image' },
      { id: 'sim',      label: 'Call with',    value: v?.preferredSim ? v.preferredSim.toUpperCase() : 'Ask', icon: 'sim' },
    ];

    for (const r of rows) {
      privateBlock.appendChild(h('button.csheet__private-row', {
        type: 'button',
        on: { click: () => onAction?.(`edit-${r.id}`) },
      },
      h('span.csheet__private-icon', { html: icon(r.icon) }),
      h('span.col.grow', null,
        h('span.t-body-sm', { text: r.label }),
        h('span.t-caption', { text: r.value })),
      h('span', { html: icon('chevronR') })));
    }

    if (v?.savedPlace) {
      privateBlock.appendChild(h('button.csheet__navigate.t-label', {
        type: 'button',
        on: { click: () => onAction?.('navigate') },
      }, h('span', { html: icon('mapPin') }), h('span', { text: `Navigate to ${v.savedPlace.label}` })));
    }
  }

  function renderDanger(d) {
    dangerBlock.textContent = '';
    const blocked = d.view?.blocked || d.spam?.blocked;
    const items = [
      { id: blocked ? 'unblock' : 'block', label: blocked ? 'Unblock this number' : 'Block this number' },
      { id: d.spam?.score >= 0.5 ? 'not-spam' : 'report', label: d.spam?.score >= 0.5 ? 'Not spam' : 'Report as spam' },
      { id: 'clear-history', label: 'Clear history with this person' },
    ];
    if (d.view) items.push({ id: 'delete', label: 'Delete contact' });
    for (const it of items) {
      dangerBlock.appendChild(h('button.csheet__danger-row.t-label', {
        type: 'button', text: it.label,
        on: { click: () => onAction?.(it.id) },
      }));
    }
  }

  function update(next = {}) {
    props = { ...props, ...next };
    const d = props.detail;
    const v = d.view;
    const p = d.profile;

    const display = v?.displayName
      || (p ? [p.firstName, p.surname].filter(Boolean).join(' ') : null)
      || formatNumber(props.number || '');

    setText(eyebrow, v?.surname || p?.surname || '');
    toggle(eyebrow, 'is-hidden', !eyebrow.textContent);
    setText(name, v?.firstName || display);
    setText(sub, v?.label || v?.org || (p ? 'On DIALR' : 'Not in your contacts'));

    avatar.update({ name: display, src: v?.avatar || p?.avatarUrl || null, ring: !!p });

    renderActions();
    renderSmart(d);
    renderNumbers(d);
    renderDialr(d, props.settings);
    renderPrivate(d);
    renderDanger(d);
  }

  update({});
  return { el, update, destroy() { avatar.destroy(); } };
}
