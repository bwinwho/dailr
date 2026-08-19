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
import haptics from '../../core/haptics.js';

/** History and Remind are navigations, not peer actions of Call/Text/
 *  WhatsApp — they open something else, they don't act on this number. Both
 *  ids are already handled unchanged in app/actions.js. */
const LINKS = [
  { id: 'history', ic: 'clock', label: 'History' },
  { id: 'remind',  ic: 'bell',  label: 'Remind me' },
];

export function ContactSheet({ detail, settings, number, onAction }) {
  let props = { detail, settings, number };

  // No avatar (Project Clean Slate — Recents/Contacts/History/ContactSheet
  // never show a photo). The name is the head.
  const eyebrow = h('div.csheet__eyebrow.t-eyebrow');
  const name = h('h2.csheet__name.t-display-m');
  const sub = h('div.csheet__sub.t-label.c-3');

  const actionRow = h('div.csheet__actions');
  const links = h('div.csheet__links');
  const numbers = h('div.csheet__numbers');
  const smart = h('div.csheet__smart');
  const dialrBlock = h('div.csheet__dialr');
  const privateBlock = h('div.csheet__private');
  const dangerBlock = h('div.csheet__danger');

  const el = h('div.csheet', null,
    h('div.csheet__head', null, eyebrow, name, sub),
    actionRow,
    links,
    smart,
    h('div.csheet__group', null,
      h('h3.csheet__group-title.t-micro.c-4', { text: 'On this phone' }),
      numbers),
    dialrBlock,
    privateBlock,
    dangerBlock);

  // Icon only — call/text/whatsapp are peer actions on this number. WhatsApp
  // stays monochrome (stroke, currentColor — see icons.js) here; brand green
  // is reserved for ProfileView.
  const ACTIONS = [
    { id: 'call',     ic: 'phone',    label: 'Call',    tone: 'accent' },
    { id: 'text',     ic: 'message',  label: 'Message' },
    { id: 'whatsapp', ic: 'whatsapp', label: 'WhatsApp' },
  ];

  function renderActions() {
    actionRow.textContent = '';
    for (const a of ACTIONS) {
      actionRow.appendChild(h(`button.csheet__action${a.tone ? '.is-accent' : ''}`, {
        type: 'button', aria: { label: a.label },
        on: { click: () => { haptics.fire('tap'); onAction?.(a.id); } },
      }, h('span.csheet__action-icon', { html: icon(a.ic) })));
    }
  }

  function renderLinks() {
    links.textContent = '';
    for (const l of LINKS) {
      links.appendChild(h('button.csheet__link', {
        type: 'button',
        on: { click: () => { haptics.fire('tap'); onAction?.(l.id); } },
      },
      h('span.csheet__link-icon', { html: icon(l.ic) }),
      h('span.csheet__link-label.t-body', { text: l.label }),
      h('span.csheet__link-chev', { html: icon('chevronR') })));
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
      // A row with two independent actions (tap to call, tap the copy icon
      // to copy) is two sibling buttons, not a button nested inside a
      // button — the previous span-with-role="button" markup was invalid
      // and is why copy sometimes fired the row's own click too.
      numbers.appendChild(h('div.csheet__number', null,
        h('button.csheet__number-main', {
          type: 'button',
          on: { click: () => onAction?.('call-number', n.value) },
        },
        h('span.col.grow', null,
          h('span.t-body.t-num', { text: formatNumber(n.value) }),
          h('span.t-caption', { text: n.label || 'Mobile' }))),
        h('button.csheet__number-copy', {
          type: 'button', aria: { label: 'Copy number' },
          html: icon('copy'),
          on: { click: () => onAction?.('copy-number', n.value) },
        })));
    }
    if (!d.view) {
      numbers.appendChild(h('button.csheet__addcontact.tap.t-label', {
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
      // A real class, not a positional svg:last-child selector — the latter
      // silently breaks the moment a row gains any other trailing element.
      h('span.csheet__row-chev', { html: icon('chevronR') })));
    }

    if (v?.savedPlace) {
      privateBlock.appendChild(h('button.csheet__navigate.tap.t-label', {
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
      dangerBlock.appendChild(h('button.csheet__danger-row.tap.t-label', {
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

    renderActions();
    renderLinks();
    renderSmart(d);
    renderNumbers(d);
    renderDialr(d, props.settings);
    renderPrivate(d);
    renderDanger(d);
  }

  update({});
  return { el, update, destroy() {} };
}
