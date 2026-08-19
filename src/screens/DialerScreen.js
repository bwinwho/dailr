/**
 * DIALR — Dialer screen.
 *
 * LAYOUT DECISION: on this tab the keypad occupies the bottom slot that other
 * tabs give to search. The keypad *is* the search here — T9 means typing digits
 * finds people by name — so stacking a second search field above it would be
 * redundant chrome in the most valuable real estate on the screen.
 *
 * Top of Mind and an empty-state recents list used to render above the
 * keypad; both are gone (Project Clean Slate — they duplicated the Recents
 * tab and were noise the user asked to remove twice). The keypad is not
 * literally centred in the viewport: that would make the deck stop being
 * bottom-anchored, which is exactly what caused the 122px layout-shift bug
 * Phase 1 fixed. Instead the deck stays pinned to the bottom slot, and with
 * nothing left above it .dialer__scroll is simply empty — so the keypad
 * already sits in a vertically centred lower field, with real emptiness
 * above it and zero jitter. Horizontal centring of the keypad and action row
 * is real (CSS margin-inline: auto).
 */
import { h, toggle, reconcile, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { NumberDisplay } from '../components/dialer/NumberDisplay.js';
import { DialPad } from '../components/dialer/DialPad.js';
import { DialCallButton, dialCallModel } from '../components/dialer/DialCallButton.js';
import { Avatar } from '../components/primitives/Avatar.js';
import { formatNumber } from '../core/format.js';
import { selDialerMatch } from '../state/selectors.js';
import haptics from '../core/haptics.js';

export function DialerScreen({ store, actions }) {
  const suggestions = h('div.dialer__suggestions');
  const suggestionStore = new Map();

  const scroll = h('div.screen__body.screen__body--nosearch.dialer__scroll', null,
    h('div.screen__inner', null, suggestions));

  const numberDisplay = NumberDisplay({
    onCopy: () => actions.toast({ text: 'Number copied', iconName: 'copy' }),
    onMatchTap: () => {
      const m = selDialerMatch(store.getState());
      if (m.primary?.view) actions.openContact(m.primary.view.key);
    },
  });

  const pad = DialPad({
    onDigit: (d) => actions.dialerAppend(d),
    onLongPress: (d) => actions.dialerLongPress(d),
  });

  const callButton = DialCallButton({
    onCall: ({ number, contactKey }) => actions.call(number, contactKey),
    onLongPress: ({ number, contactKey }) => actions.openSimPicker(number, contactKey),
  });

  /** [ add contact ] [ CALL ] [ backspace ] — icons only, one green.
   *  All three are mounted permanently; inapplicable ones fade and go
   *  disabled. Nothing here may unmount — see DialCallButton.js. */
  const addBtn = h('button.dial-action', {
    type: 'button', aria: { label: 'Save this number as a contact' },
    on: { click: () => actions.addContact(store.getState().dialer.input) },
  }, h('span', { html: icon('plus') }));

  const backBtn = h('button.dial-action.dialer__back', {
    type: 'button', aria: { label: 'Delete last digit' },
    on: { click: () => actions.dialerBackspace() },
  }, h('span', { html: icon('back') }));

  // Hold to clear — the gesture NumberDisplay used to own.
  let holdTimer = null;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  const offHoldDown = on(backBtn, 'pointerdown', () => {
    holdTimer = setTimeout(() => { haptics.fire('warn'); actions.dialerClear(); holdTimer = null; }, 480);
  });
  const offHoldUp = on(backBtn, 'pointerup', cancelHold);
  const offHoldLeave = on(backBtn, 'pointerleave', cancelHold);

  const actionRow = h('div.dialer__actions', null, addBtn, callButton.el, backBtn);

  /** The bottom slot for this tab: readout + keypad + actions, in the thumb
   *  zone. This whole block is mounted once and never leaves the layout —
   *  see DialCallButton.js for why that is the point. */
  const bottom = h('div.dialer__deck', null, numberDisplay.el, pad.el, actionRow);

  const el = h('section.screen.screen--dialer', { id: 'screen-dialer', role: 'tabpanel', aria: { label: 'Keypad' } },
    scroll);

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

    callButton.update(dialCallModel(match));

    const empty = !state.dialer.input;
    addBtn.disabled = empty || match.state === 'contact';
    backBtn.disabled = empty;
    toggle(addBtn, 'is-off', addBtn.disabled);
    toggle(backBtn, 'is-off', backBtn.disabled);

    renderSuggestions(state);
    toggle(el, 'is-typing', !!state.dialer.input);
  }

  return {
    el, bottom, update,
    destroy() {
      numberDisplay.destroy(); pad.destroy(); callButton.destroy();
      offHoldDown(); offHoldUp(); offHoldLeave();
    },
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
    variant: 'mono',
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
