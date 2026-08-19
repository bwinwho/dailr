/**
 * DIALR — Dialer screen.
 *
 * LAYOUT DECISION: on this tab the keypad occupies the bottom slot that other
 * tabs give to search. The keypad *is* the search here — T9 means typing digits
 * finds people by name — so stacking a second search field above it would be
 * redundant chrome in the most valuable real estate on the screen.
 *
 * Everything above the keypad grows upward as you type: suggestions first,
 * then the number readout, then the keypad, then the dock. One-handed the
 * whole way down.
 */
import { h, setText, toggle, reconcile } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { NumberDisplay } from '../components/dialer/NumberDisplay.js';
import { DialPad } from '../components/dialer/DialPad.js';
import { Avatar } from '../components/primitives/Avatar.js';
import { EmptyState } from '../components/primitives/States.js';
import { formatNumber, relativeTime, callSentence } from '../core/format.js';
import { selDialerMatch, selTopOfMind, selRecents } from '../state/selectors.js';
import haptics from '../core/haptics.js';

export function DialerScreen({ store, actions }) {
  const suggestions = h('div.dialer__suggestions');
  const suggestionStore = new Map();
  const topOfMind = h('div.dialer__topofmind');
  const emptySlot = h('div.dialer__empty');

  const scroll = h('div.screen__body.screen__body--nosearch.dialer__scroll', null,
    h('div.screen__inner', null, emptySlot, topOfMind, suggestions));

  const numberDisplay = NumberDisplay({
    onCopy: () => actions.toast({ text: 'Number copied', iconName: 'copy' }),
    onBackspace: () => actions.dialerBackspace(),
    onClear: () => actions.dialerClear(),
    onMatchTap: () => {
      const m = selDialerMatch(store.getState());
      if (m.primary?.view) actions.openContact(m.primary.view.key);
    },
  });

  const pad = DialPad({
    onDigit: (d) => actions.dialerAppend(d),
    onLongPress: (d) => actions.dialerLongPress(d),
  });

  /** The bottom slot for this tab: readout + keypad, in the thumb zone. */
  const bottom = h('div.dialer__deck', null, numberDisplay.el, pad.el);

  const el = h('section.screen.screen--dialer', { id: 'screen-dialer', role: 'tabpanel', aria: { label: 'Keypad' } },
    scroll);

  function renderTopOfMind(state) {
    const people = selTopOfMind(state);
    topOfMind.textContent = '';
    if (!people.length || state.dialer.input) { toggle(topOfMind, 'is-hidden', true); return; }
    toggle(topOfMind, 'is-hidden', false);

    topOfMind.appendChild(h('div.dialer__tom-label.t-micro.c-4', { text: 'Top of mind' }));
    const row = h('div.dialer__tom-row');
    for (const p of people) {
      const av = Avatar({ size: 'md', name: p.displayName, src: p.avatar, ring: p.isDialrUser });
      row.appendChild(h('button.dialer__tom-item', {
        type: 'button', aria: { label: `Call ${p.displayName}` },
        on: { click: () => { haptics.fire('success'); actions.call(p.primaryNumber, p.key); } },
      }, av.el, h('span.dialer__tom-name.t-micro', { text: p.firstName })));
    }
    topOfMind.appendChild(row);
  }

  function renderSuggestions(state) {
    const match = selDialerMatch(state);
    const rows = [];

    if (match.state === 'contact') {
      for (const m of match.matches) {
        rows.push({ id: `c_${m.contact.key}_${m.number.value}`, kind: 'contact', contact: m.contact, number: m.number });
      }
    } else if (match.state === 'dialr') {
      rows.push({ id: `d_${match.primary.number}`, kind: 'dialr', profile: match.primary.profile, number: match.primary.number });
    } else if (match.state === 'unknown') {
      rows.push({ id: `u_${match.input}`, kind: 'unknown', number: match.input, spam: match.spam });
    }

    reconcile(suggestions, rows, {
      key: (r) => r.id,
      store: suggestionStore,
      create: (r) => createSuggestion(r, actions),
    });
    toggle(suggestions, 'is-hidden', !rows.length);
  }

  function renderEmpty(state) {
    emptySlot.textContent = '';
    if (state.dialer.input) { toggle(emptySlot, 'is-hidden', true); return; }

    const recents = selRecents(state).slice(0, 3);
    if (!recents.length) {
      toggle(emptySlot, 'is-hidden', false);
      emptySlot.appendChild(EmptyState({
        iconName: 'keypad',
        title: 'Start typing',
        body: 'Numbers or names — the keypad letters search your contacts too.',
      }).el);
      return;
    }

    toggle(emptySlot, 'is-hidden', false);
    emptySlot.appendChild(h('div.dialer__recent-label.t-micro.c-4', { text: 'Just now' }));
    const list = h('div.dialer__recent-list');
    for (const r of recents) {
      list.appendChild(h('button.dialer__recent', {
        type: 'button',
        on: { click: () => actions.call(r.entry.number, r.key) },
      },
      h('span.col.grow', null,
        h('span.dialer__recent-name.t-body', { text: r.displayName }),
        h('span.t-caption', { text: `${relativeTime(r.entry.startedAt, Date.now(), { compact: true })} · ${callSentence(r.entry, r.view)}` })),
      h('span.dialer__recent-icon', { html: icon('phone') })));
    }
    emptySlot.appendChild(list);
  }

  function update(state) {
    const match = selDialerMatch(state);
    const primary = match.matches[0];

    numberDisplay.update({
      input: state.dialer.input,
      match: primary
        ? { name: primary.contact.displayName, meta: primary.contact.label || primary.number.label, tier: 'saved' }
        : match.state === 'dialr'
          ? { name: [match.primary.profile.firstName, match.primary.profile.surname].filter(Boolean).join(' '), meta: 'On DIALR', tier: 'dialr' }
          : null,
    });

    pad.update({
      tones: state.settings.calling.dialPadTones,
      hapticsOn: state.settings.calling.dialPadHaptics,
    });

    renderEmpty(state);
    renderTopOfMind(state);
    renderSuggestions(state);
    toggle(el, 'is-typing', !!state.dialer.input);
  }

  return {
    el, bottom, update,
    destroy() { numberDisplay.destroy(); pad.destroy(); },
  };
}

function createSuggestion(r, actions) {
  const name = r.kind === 'contact' ? r.contact.displayName
    : r.kind === 'dialr' ? [r.profile.firstName, r.profile.surname].filter(Boolean).join(' ')
    : formatNumber(r.number);

  const av = Avatar({
    size: 'sm',
    name,
    src: r.kind === 'contact' ? r.contact.avatar : r.kind === 'dialr' ? r.profile.avatarUrl : null,
    ring: r.kind === 'dialr',
  });

  const meta = r.kind === 'contact' ? formatNumber(r.number.value)
    : r.kind === 'dialr' ? 'On DIALR — not in your contacts'
    : r.spam?.score >= 0.5 ? 'Reported as spam' : 'Not in your contacts';

  const el = h('button.dsug', {
    type: 'button',
    dataset: { kind: r.kind },
    on: {
      click: () => {
        const number = r.kind === 'contact' ? r.number.value : r.number;
        actions.call(number, r.kind === 'contact' ? r.contact.key : undefined);
      },
    },
  },
  av.el,
  h('span.col.grow', null,
    h('span.dsug__name.t-body', { text: name }),
    h('span.dsug__meta.t-caption', { text: meta })),
  r.kind === 'unknown'
    ? h('span.dsug__add', {
        html: icon('plus'),
        on: { click: (e) => { e.stopPropagation(); actions.addContact(r.number); } },
      })
    : h('span.dsug__go', { html: icon('phone') }));

  return { el, update() {}, destroy() { av.destroy(); } };
}
