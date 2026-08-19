/**
 * DIALR — HistoryPanel.
 *
 * The deep layer of the Recents flow. It expands to fill the screen *up to
 * the bottom zone* — the filter bar and dock stay visible and functional
 * beneath it, which is the whole point of the "expand, don't interrupt" rule
 * (see .sheet--full in primitives.css). Nothing here is a separate page.
 *
 * Mounted with a null title (overlays.js) so the wrapping Sheet's own
 * .sheet__close is the only close affordance — see ContactSheet/Settings for
 * the same pattern. This panel owns the identity header itself (eyebrow,
 * name, number) rather than duplicating it in the sheet's title bar, which
 * used to render "HISTORY" as a second, redundant header above this one.
 *
 * Entries read as prose, with a status glyph rather than a text tag:
 *
 *      ◉  NIGHT 11 PM
 *         6 minutes · She called you.        ┃ Red skirt — Amazon
 */
import { h, setText, toggle, reconcile } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  dayPartTime, spokenDuration, callSentence, isMissed, dispositionTag, dayGroupLabel,
  formatNumber, relativeTime,
} from '../../core/format.js';
import { EmptyState } from '../primitives/States.js';
import haptics from '../../core/haptics.js';

function HistoryEntry({ entry, view, settings }) {
  const statusIcon = h('span.hentry__status');
  const heading = h('h4.hentry__when.t-label');
  const meta = h('div.hentry__meta.t-body-sm.c-2');
  const note = h('div.hentry__note.t-body-sm');

  const el = h('li.hentry', null,
    statusIcon,
    h('div.hentry__main', null, heading, meta),
    note);

  function update(next) {
    const e = next.entry;
    setText(heading, dayPartTime(e.startedAt));

    const parts = [];
    if (e.durationSec > 0) parts.push(spokenDuration(e.durationSec));
    parts.push(settings.recents.naturalLanguage ? callSentence(e, next.view) : e.disposition.replace(/-/g, ' '));
    setText(meta, parts.join(' · '));

    // A status glyph, not a text tag: green for a connected call, red for
    // one that never was — dispositionTag's tone already says which.
    const negative = isMissed(e) || dispositionTag(e)?.tone === 'negative';
    statusIcon.innerHTML = icon(negative ? 'phoneMissed' : 'phoneDown');
    toggle(statusIcon, 'is-negative', negative);
    toggle(statusIcon, 'is-positive', !negative);

    setText(note, e.note || '');
    toggle(note, 'is-hidden', !e.note);
  }
  update({ entry, view });
  return { el, update, destroy() {} };
}

export function HistoryPanel({ detail, settings, onCall, onAction }) {
  let props = { detail, settings };

  const eyebrow = h('div.hpanel__eyebrow.t-eyebrow', { text: 'History' });
  const name = h('h2.hpanel__name.t-display-l');
  const when = h('span.hpanel__when.t-body-sm.c-3');
  const numberBtn = h('button.hpanel__number.tap.t-label', {
    type: 'button', aria: { label: 'Copy number' },
    on: { click: () => onAction?.('copy-number') },
  });

  // The contact card: no avatar (Project Clean Slate), four icon actions —
  // call/text/whatsapp/open-contact — monochrome, aria-label only.
  const CARD_ACTIONS = [
    { id: 'call',     ic: 'phone',    label: 'Call' },
    { id: 'text',     ic: 'message',  label: 'Send a text' },
    { id: 'whatsapp', ic: 'whatsapp', label: 'WhatsApp' },
    { id: 'profile',  ic: 'person',   label: 'Open contact' },
  ];
  const actionRow = h('div.hpanel__actions');
  for (const a of CARD_ACTIONS) {
    actionRow.appendChild(h('button.hpanel__action', {
      type: 'button', aria: { label: a.label },
      on: {
        click: () => {
          if (a.id === 'call') { haptics.fire('success'); onCall?.(); return; }
          haptics.fire('tap'); onAction?.(a.id);
        },
      },
    }, h('span', { html: icon(a.ic) })));
  }

  const clearBtn = h('button.hpanel__clear.tap.t-label', {
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
      eyebrow,
      h('div.hpanel__nameline', null, name, when),
      numberBtn),
    actionRow,
    h('div.hpanel__foot-row', null, bestTime, clearBtn),
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

    setText(name, view?.firstName || display);
    setText(when, detail.entries[0] ? relativeTime(detail.entries[0].startedAt) : '');
    setText(numberBtn, formatNumber(view?.primaryNumber || detail.number || ''));

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

  return { el, update, destroy() { for (const i of listStore.values()) i.destroy?.(); } };
}
