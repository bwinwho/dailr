/**
 * DIALR — floating dock controller.
 *
 * The dock is not a navigation bar with special cases bolted on. It is a
 * function of application context:
 *
 *        context  ->  dock state  ->  dock actions  ->  <FloatingDock/>
 *
 * This module is the middle two arrows, and it is the ONLY place that decides
 * what the dock offers. Screens contribute context to the store; they never
 * reach into the dock. That is what stops the "dock logic duplicated in every
 * screen" failure the brief calls out.
 *
 * Two hard rules encoded here:
 *   - Navigation is never *removed*, only compressed. A dock that swaps
 *     entirely to a CTA traps the user in whatever screen they are on.
 *   - Exactly one primary action. If context suggests two, the more specific
 *     one wins and the other becomes a secondary icon.
 */

import { selDialerMatch, selRecentCounts, selContactsByKey, resolveIdentity } from './selectors.js';
import { formatNumber, nameParts } from '../core/format.js';

export const NAV_ITEMS = [
  { id: 'dialer',   icon: 'keypad',  label: 'Keypad' },
  { id: 'recents',  icon: 'clock',   label: 'Recents' },
  { id: 'contacts', icon: 'people',  label: 'Contacts' },
  { id: 'you',      icon: 'person',  label: 'You' },
];

/**
 * @typedef {Object} DockModel
 * @property {'nav'|'action'} mode
 * @property {{id,label,sub,icon,tone,intent}|null} primary
 * @property {Array<{id,icon,label,intent}>} secondary
 * @property {Array<{id,icon,label,active,badge}>} nav
 * @property {boolean} hidden
 */

export function selectDockModel(state) {
  const hidden = state.call.sessions.length > 0 || state.app.onboarding.active;

  const nav = NAV_ITEMS.map((n) => ({
    ...n,
    active: state.app.tab === n.id,
    badge: n.id === 'recents' ? missedBadge(state) : 0,
  }));

  const base = { mode: 'nav', primary: null, secondary: [], nav, hidden };
  if (hidden) return base;
  if (!state.settings.smart.smartDock) return base;

  // Overlays are the most specific context there is — a sheet about a person
  // outranks whatever the screen underneath was doing.
  const top = state.overlay.stack[state.overlay.stack.length - 1];
  if (top) {
    const fromOverlay = overlayContext(state, top);
    if (fromOverlay) return { ...base, ...fromOverlay, mode: 'action' };
  }

  switch (state.app.tab) {
    case 'dialer':   return dialerContext(state, base);
    case 'recents':  return recentsContext(state, base);
    case 'contacts': return contactsContext(state, base);
    default:         return base;
  }
}

/* ---------------------------------------------------------------- dialer  */

function dialerContext(state, base) {
  const match = selDialerMatch(state);

  switch (match.state) {
    case 'empty': {
      // Nothing typed: offer the one thing a dialer is always asked for.
      const last = state.directory.callLog[0];
      if (!last) return base;
      const id = resolveIdentity(state, last.number, { allowLookup: false });
      return {
        ...base, mode: 'nav',
        secondary: [{ id: 'redial', icon: 'redial', label: `Redial ${id.first || formatNumber(last.number)}`,
                      intent: { type: 'call', number: last.number } }],
      };
    }

    case 'contact': {
      const v = match.primary.view;
      return {
        ...base, mode: 'action',
        primary: {
          id: `call-${v.key}`,
          label: `Call ${v.firstName}`,
          sub: v.numbers.length > 1 ? labelFor(v, match.primary.number) : null,
          icon: 'phone', tone: 'accent',
          intent: { type: 'call', number: match.primary.number, contactKey: v.key },
        },
        secondary: [
          { id: 'message', icon: 'message', label: `Message ${v.firstName}`,
            intent: { type: 'message', number: match.primary.number } },
        ],
      };
    }

    case 'dialr': {
      const p = match.primary.profile;
      const name = [p.firstName, p.surname].filter(Boolean).join(' ');
      return {
        ...base, mode: 'action',
        primary: {
          id: 'call-dialr',
          label: `Call ${p.firstName}`,
          sub: 'On DIALR — not in your contacts',
          icon: 'phone', tone: 'accent',
          intent: { type: 'call', number: match.primary.number },
        },
        secondary: [
          { id: 'save', icon: 'plus', label: `Save ${name}`,
            intent: { type: 'add-contact', number: match.primary.number, suggestName: name } },
        ],
      };
    }

    case 'unknown': {
      const spammy = match.spam && match.spam.score >= 0.75;
      return {
        ...base, mode: 'action',
        primary: {
          id: 'call-unknown',
          label: `Call ${formatNumber(match.input)}`,
          sub: spammy ? 'Reported as spam' : null,
          icon: 'phone',
          tone: spammy ? 'warn' : 'accent',
          intent: { type: 'call', number: match.input },
        },
        secondary: [
          { id: 'add', icon: 'plus', label: 'Add contact',
            intent: { type: 'add-contact', number: match.input } },
        ],
      };
    }

    case 'code':
      return {
        ...base, mode: 'action',
        primary: { id: 'run-code', label: 'Run code', sub: match.input, icon: 'phone', tone: 'neutral',
                   intent: { type: 'call', number: match.input } },
      };

    default:
      return base;
  }
}

function labelFor(view, number) {
  const n = view.numbers.find((x) => x.value === number);
  return n?.label || null;
}

/* --------------------------------------------------------------- recents  */

function recentsContext(state, base) {
  const key = state.recents.expandedKey;
  if (!key) {
    const counts = selRecentCounts(state);
    const secondary = [];
    if (counts.owed) {
      secondary.push({ id: 'owed', icon: 'return', label: `${counts.owed} to call back`,
                       intent: { type: 'filter-recents', filter: 'owed' } });
    }
    return { ...base, secondary };
  }

  const view = selContactsByKey(state).get(key);
  const name = view?.firstName || nameParts(state.recents.expandedName || '').first || 'back';
  return {
    ...base, mode: 'action',
    primary: {
      id: `call-${key}`, label: `Call ${name}`, sub: null, icon: 'phone', tone: 'accent',
      intent: { type: 'call', number: view?.primaryNumber || key, contactKey: key },
    },
    secondary: [
      { id: 'history', icon: 'clock', label: 'History', intent: { type: 'open-history', contactKey: key } },
    ],
  };
}

/* -------------------------------------------------------------- contacts  */

function contactsContext(state, base) {
  const q = state.contactsUi.query.trim();
  const looksNumeric = q.length >= 6 && /^[\d+\s()-]+$/.test(q);
  if (looksNumeric) {
    return {
      ...base, mode: 'action',
      primary: { id: 'add-typed', label: 'Add contact', sub: formatNumber(q), icon: 'plus', tone: 'accent',
                 intent: { type: 'add-contact', number: q } },
    };
  }
  return {
    ...base,
    secondary: [{ id: 'new-contact', icon: 'plus', label: 'New contact', intent: { type: 'add-contact' } }],
  };
}

/* --------------------------------------------------------------- overlays */

function overlayContext(state, top) {
  const key = top.props?.contactKey;
  if (!key) return null;
  const view = selContactsByKey(state).get(key);
  const number = view?.primaryNumber || top.props?.number;
  if (!number) return null;

  const name = view?.firstName || top.props?.name || 'back';

  if (top.kind === 'rewind') {
    return {
      primary: { id: 'rewind-call', label: `Call ${name}`, icon: 'phone', tone: 'accent',
                 intent: { type: 'call', number, contactKey: key } },
      secondary: [{ id: 'close', icon: 'close', label: 'Close', intent: { type: 'close-overlay' } }],
    };
  }

  return {
    primary: { id: 'sheet-call', label: `Call ${name}`, icon: 'phone', tone: 'accent',
               intent: { type: 'call', number, contactKey: key } },
    secondary: [{ id: 'message', icon: 'message', label: `Message ${name}`,
                  intent: { type: 'message', number } }],
  };
}

/* ------------------------------------------------------------------ badge */

function missedBadge(state) {
  const since = Date.now() - 24 * 3600_000;
  return state.directory.callLog.filter((e) => e.disposition === 'incoming-missed' && e.startedAt >= since).length;
}
