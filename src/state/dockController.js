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

import { selContactsByKey } from './selectors.js';
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
    // The dialer owns its own call action now (a persistent button under the
    // keypad — see DialCallButton). The dock's job there is navigation only:
    // a context row that grows and shrinks as you type would move the keypad
    // itself, since both sit in the same bottom-anchored column. Measured at
    // 122px of keypad drift before this was nav-only; see tools/audit.mjs.
    case 'dialer':   return base;
    case 'recents':  return recentsContext(state, base);
    case 'contacts': return contactsContext(state, base);
    default:         return base;
  }
}

/* --------------------------------------------------------------- recents  */

function recentsContext(state, base) {
  const key = state.recents.expandedKey;
  // Collapsed Recents is nav-only. There used to be a secondary "N to call
  // back" chip here that filtered to state.recents.filter === 'owed' — that
  // filter option no longer exists in the bottom filter bar (Project Clean
  // Slate, only All/Missed remain), so surfacing it here would drive the UI
  // into a filter state with no visible selected segment.
  if (!key) return base;

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
  // No secondary aux pill here: it renders in the exact spot the bottom-slot
  // search bar occupies (see bottomController.js) and was covering it —
  // "easy to access search" was unreachable. The header's own add button
  // already covers "new contact".
  return base;
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
