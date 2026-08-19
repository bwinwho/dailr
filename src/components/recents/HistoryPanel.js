/**
 * DIALR — HistoryPanel.
 *
 * The deep layer of the Recents flow. It expands to fill the screen *up to the
 * dock* — the dock stays visible and functional, which is the whole point of
 * the "expand, don't interrupt" rule. Nothing here is a separate page.
 *
 * Entries read as prose:
 *
 *      NIGHT 11 PM
 *      6 minutes · She called you.                    ┌──────────────────┐
 *                                                     │ Red skirt—Amazon │
 *                                                     └──────────────────┘
 */
import { h, setText, toggle, reconcile } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  dayPartTime, spokenDuration, callSentence, dispositionTag, dayGroupLabel,
  formatNumber, relativeTime,
} from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import { EmptyState } from '../primitives/States.js';
import haptics from '../../core/haptics.js';

function HistoryEntry({ entry, view, settings }) {
  const heading = h('h4.hentry__when.t-label');
  const meta = h('div.hentry__meta.t-body-sm.c-2');
  const tag = h('span.hentry__tag.t-micro');
  const note = h('div.hentry__note.t-body-sm');

  const el = h('li.hentry', null,
    h('div.hentry__main', null, heading, meta, tag),
    note);

  function update(next) {
    const e = next.entry;
    setText(heading, dayPartTime(e.startedAt));

    const parts = [];
    if (e.durationSec > 0) parts.push(spokenDuration(e.durationSec));
    parts.push(settings.recents.naturalLanguage ? callSentence(e, next.view) : e.disposition.replace(/-/g, ' '));
    setText(meta, parts.join(' · '));

    const t = dispositionTag(e);
    setText(tag, t?.label || '');
    toggle(tag, 'is-hidden', !t);
    if (t) tag.dataset.tone = t.tone;

    setText(note, e.note || '');
    toggle(note, 'is-hidden', !e.note);
  }
  update({ entry, view });
  return { el, update, destroy() {} };
}

export function HistoryPanel({ detail, settings, onCall, onAction, onClose }) {
  let props = { detail, settings };

  const eyebrow = h('div.hpanel__eyebrow.t-eyebrow');
  const name = h('h2.hpanel__name.t-display-l');
  const when = h('span.hpanel__when.t-body-sm.c-3');
  const numberBtn = h('button.hpanel__number.t-label', {
    type: 'button', aria: { label: 'Copy number' },
    on: { click: () => onAction?.('copy-number') },
  });

  const avatar = Avatar({ size: 'md', name: '', src: null });
  const callBtn = h('button.hpanel__call', {
    type: 'button', aria: { label: 'Call' }, on: { click: () => { haptics.fire('success'); onCall?.(); } },
  }, h('span', { html: icon('phone') }));

  const tabs = h('div.hpanel__tabs', null,
    h('button.hpanel__tab.t-label', { type: 'button', text: 'Send a text',
      on: { click: () => onAction?.('text') } }),
    h('button.hpanel__tab.t-label.is-active', { type: 'button', text: 'History' }));

  const quick = h('div.hpanel__quick', null,
    h('button.hpanel__quick-btn', { type: 'button', aria: { label: 'WhatsApp' },
      html: icon('whatsapp'), on: { click: () => onAction?.('whatsapp') } }),
    h('button.hpanel__quick-btn', { type: 'button', aria: { label: 'Set a reminder' },
      html: icon('bell'), on: { click: () => onAction?.('remind') } }));

  const clearBtn = h('button.hpanel__clear.t-label', {
    type: 'button', text: 'Clear the history',
    on: { click: () => onAction?.('clear-history') },
  });

  const bestTime = h('div.hpanel__besttime.t-caption');
  const list = h('ul.hpanel__list', { role: 'list' });
  const listStore = new Map();
  const emptySlot = h('div.hpanel__empty');

  const rewindBtn = h('button.hpanel__rewind', {
    type: 'button',
    on: { click: () => { haptics.fire('expand'); onAction?.('rewind'); } },
  }, h('span.t-label', { text: 'Check Rewind' }), h('span.hpanel__rewind-icon', { html: icon('spark') }));

  const el = h('div.hpanel', null,
    h('header.hpanel__head', null,
      h('div.hpanel__id.grow', null,
        eyebrow,
        h('div.hpanel__nameline', null, name, when)),
      h('div.hpanel__aside', null, callBtn, avatar.el)),
    h('div.rule.hpanel__rule'),
    h('div.hpanel__controls', null,
      h('div.col.g-2.grow', null, tabs, numberBtn),
      h('div.col.g-4', null, quick, clearBtn)),
    bestTime,
    h('div.rule.rule--full.mt-4'),
    h('div.hpanel__scroll.scroll', null, list, emptySlot),
    h('div.hpanel__foot', null, rewindBtn));

  function update(next = {}) {
    props = { ...props, ...next };
    const { detail, settings } = props;
    const view = detail.view;
    const profile = detail.profile;

    const display = view?.displayName
      || (profile ? [profile.firstName, profile.surname].filter(Boolean).join(' ') : null)
      || formatNumber(detail.number || '');

    setText(eyebrow, view?.surname || profile?.surname || '');
    toggle(eyebrow, 'is-hidden', !eyebrow.textContent);
    setText(name, view?.firstName || display);
    setText(when, detail.entries[0] ? relativeTime(detail.entries[0].startedAt) : '');
    setText(numberBtn, formatNumber(view?.primaryNumber || detail.number || ''));

    avatar.update({
      name: display,
      src: view?.avatar || profile?.avatarUrl || null,
      ring: !!profile,
    });

    setText(bestTime, detail.bestTime?.label || '');
    toggle(bestTime, 'is-hidden', !detail.bestTime);

    // Group entries under day headings without breaking keyed reconciliation:
    // headings are rows in the same list.
    const rows = [];
    let lastGroup = null;
    for (const e of detail.entries) {
      const g = dayGroupLabel(e.startedAt);
      if (g !== lastGroup) { rows.push({ kind: 'group', id: `g_${g}_${e.id}`, label: g }); lastGroup = g; }
      rows.push({ kind: 'entry', id: e.id, entry: e });
    }

    reconcile(list, rows, {
      key: (r) => r.id,
      store: listStore,
      create: (r) => {
        if (r.kind === 'group') {
          const el2 = h('li.hpanel__group.t-micro.c-4', { text: r.label });
          return { el: el2, update() {}, destroy() {} };
        }
        const inst = HistoryEntry({ entry: r.entry, view, settings });
        return { el: inst.el, update: (row) => inst.update({ entry: row.entry, view }), destroy: inst.destroy };
      },
    });

    emptySlot.textContent = '';
    if (!detail.entries.length) {
      emptySlot.appendChild(EmptyState({
        iconName: 'clock',
        title: 'No history yet',
        body: 'Calls with this person will appear here as plain sentences, not arrows.',
      }).el);
    }

    toggle(rewindBtn, 'is-hidden', !detail.rewindAvailable);
  }

  update({});

  return { el, update, destroy() { avatar.destroy(); for (const i of listStore.values()) i.destroy?.(); }, close: onClose };
}
