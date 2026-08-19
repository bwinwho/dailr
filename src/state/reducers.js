/**
 * DIALR — slice reducers.
 *
 * Rules:
 *   - Reducers are pure and return the SAME object identity when nothing
 *     changed. `subscribeTo` depends on it, and so does render performance.
 *   - No derived data is stored. Anything computable lives in selectors.js.
 *   - The three identity stores stay separate here too: deviceContacts,
 *     dialrProfiles and privateData are never merged in state, only in a
 *     selector, and only for rendering.
 */

import { createReducer, patch } from '../core/store.js';
import { A } from './actions.js';
import { defaultSettings, withPath } from './settingsSchema.js';
import { normalizeNumber } from '../core/format.js';

/* -------------------------------------------------------------------- app */

export const appInitial = {
  booted: false,
  tab: 'dialer',                       // dialer | recents | contacts | you
  previousTab: null,
  onboarding: { active: false, step: 0, data: {} },
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  permissions: {},
  permissionsChecked: false,
  isDefaultDialer: false,
  keyboardOpen: false,
  errors: {},                          // scope -> {message, code, at}
};

const TAB_ORDER = ['dialer', 'recents', 'contacts', 'you'];

export const app = createReducer(appInitial, {
  [A.APP_BOOTED]: (s, a) => patch(s, { booted: true, ...a.payload }),
  [A.APP_SET_TAB]: (s, a) => (s.tab === a.tab ? s : patch(s, { tab: a.tab, previousTab: s.tab })),
  [A.APP_SET_ONLINE]: (s, a) => patch(s, { online: a.online }),
  [A.APP_SET_PERMISSIONS]: (s, a) => patch(s, { permissions: a.permissions, permissionsChecked: true }),
  [A.APP_SET_DEFAULT_DIALER]: (s, a) => patch(s, { isDefaultDialer: a.isDefault }),
  [A.APP_SET_KEYBOARD]: (s, a) => patch(s, { keyboardOpen: a.open }),
  [A.APP_SET_ONBOARDING]: (s, a) => patch(s, {
    onboarding: { active: true, step: a.step, data: { ...s.onboarding.data, ...(a.data || {}) } },
  }),
  [A.APP_COMPLETE_ONBOARDING]: (s) => patch(s, { onboarding: { active: false, step: 0, data: {} } }),
  [A.APP_SET_ERROR]: (s, a) => {
    const next = { ...s.errors };
    if (a.error) next[a.scope] = { ...a.error, at: Date.now() };
    else delete next[a.scope];
    return patch(s, { errors: next });
  },
});

export const TABS = TAB_ORDER;

/* -------------------------------------------------------------- directory */

export const directoryInitial = {
  contacts: [], contactsStatus: 'idle', contactsError: null,
  callLog: [], callLogStatus: 'idle', callLogError: null,
  profiles: {},                         // numberKey -> DialrProfile
  profilesStatus: 'idle', profilesError: null,
  privateData: {},                      // contactKey -> PrivateRelationship
  spam: {},                             // numberKey -> SpamVerdict
  sims: [],
  me: null,
};

export const directory = createReducer(directoryInitial, {
  [A.DIR_CONTACTS_LOADING]: (s) => patch(s, { contactsStatus: 'loading', contactsError: null }),
  [A.DIR_CONTACTS_LOADED]:  (s, a) => patch(s, { contacts: a.contacts, contactsStatus: 'ready' }),
  [A.DIR_CONTACTS_FAILED]:  (s, a) => patch(s, { contactsStatus: 'error', contactsError: a.error }),

  [A.DIR_LOG_LOADING]: (s) => patch(s, { callLogStatus: 'loading', callLogError: null }),
  [A.DIR_LOG_LOADED]:  (s, a) => patch(s, { callLog: a.entries, callLogStatus: 'ready' }),
  [A.DIR_LOG_FAILED]:  (s, a) => patch(s, { callLogStatus: 'error', callLogError: a.error }),
  [A.DIR_LOG_UPSERT]:  (s, a) => {
    const map = new Map(s.callLog.map((e) => [e.id, e]));
    for (const e of a.entries) map.set(e.id, e);
    return patch(s, { callLog: [...map.values()].sort((x, y) => y.startedAt - x.startedAt) });
  },
  [A.DIR_LOG_REMOVE]: (s, a) => {
    const kill = new Set(a.ids);
    return patch(s, { callLog: s.callLog.filter((e) => !kill.has(e.id)) });
  },

  [A.DIR_PROFILES_LOADED]: (s, a) => patch(s, {
    profiles: { ...s.profiles, ...a.profiles }, profilesStatus: 'ready', profilesError: null,
  }),
  [A.DIR_PROFILES_FAILED]: (s, a) => patch(s, { profilesStatus: 'error', profilesError: a.error }),

  [A.DIR_PRIVATE_LOADED]: (s, a) => patch(s, { privateData: a.privateData }),
  [A.DIR_PRIVATE_PATCH]: (s, a) => patch(s, {
    privateData: {
      ...s.privateData,
      [a.contactKey]: { ...(s.privateData[a.contactKey] || { contactKey: a.contactKey }), ...a.patch },
    },
  }),

  [A.DIR_SPAM_LOADED]: (s, a) => patch(s, { spam: { ...s.spam, ...a.spam } }),
  [A.DIR_SIMS_LOADED]: (s, a) => patch(s, { sims: a.sims }),
  [A.DIR_ME_LOADED]:   (s, a) => patch(s, { me: a.me }),
});

/* ----------------------------------------------------------------- dialer */

export const dialerInitial = { input: '' };

const MAX_DIAL_LENGTH = 24;

export const dialer = createReducer(dialerInitial, {
  [A.DIALER_INPUT]: (s, a) => patch(s, { input: normalizeNumber(a.value).slice(0, MAX_DIAL_LENGTH) }),
  [A.DIALER_APPEND]: (s, a) => (s.input.length >= MAX_DIAL_LENGTH ? s : patch(s, { input: s.input + a.digit })),
  [A.DIALER_BACKSPACE]: (s) => (s.input ? patch(s, { input: s.input.slice(0, -1) }) : s),
  [A.DIALER_CLEAR]: (s) => (s.input ? patch(s, { input: '' }) : s),
});

/* ---------------------------------------------------------------- recents */

export const recentsInitial = {
  expandedKey: null,      // which recent card is open
  filter: 'all',          // all | missed | owed | spam
};

export const recents = createReducer(recentsInitial, {
  [A.RECENTS_EXPAND]: (s, a) => patch(s, { expandedKey: s.expandedKey === a.key ? null : a.key }),
  [A.RECENTS_COLLAPSE]: (s) => (s.expandedKey ? patch(s, { expandedKey: null }) : s),
  [A.RECENTS_SET_FILTER]: (s, a) => patch(s, { filter: a.filter }),
  [A.APP_SET_TAB]: (s, a) => (a.tab === 'recents' ? s : patch(s, { expandedKey: null })),
});

/* --------------------------------------------------------------- contacts */

export const contactsInitial = { query: '', sort: 'name' };

export const contactsUi = createReducer(contactsInitial, {
  [A.CONTACTS_QUERY]: (s, a) => patch(s, { query: a.query }),
  [A.CONTACTS_SORT]: (s, a) => patch(s, { sort: a.sort }),
});

/* ----------------------------------------------------------------- search */

export const searchInitial = { open: false, query: '' };

export const search = createReducer(searchInitial, {
  [A.SEARCH_OPEN]: (s) => (s.open ? s : patch(s, { open: true })),
  [A.SEARCH_CLOSE]: (s) => (s.open || s.query ? patch(s, { open: false, query: '' }) : s),
  [A.SEARCH_QUERY]: (s, a) => patch(s, { query: a.query }),
  [A.APP_SET_TAB]: (s) => (s.open ? patch(s, { open: false, query: '' }) : s),
});

/* ------------------------------------------------------------------- call */

export const callInitial = {
  sessions: [],
  muted: false,
  audioRoute: 'earpiece',
  conference: false,
  keypadOpen: false,
  noteDraft: '',
  pendingNumber: null,     // shown while place() is in flight
  postCall: null,          // {number, contactKey, disposition, durationSec, note}
  error: null,
};

export const call = createReducer(callInitial, {
  [A.CALL_SNAPSHOT]: (s, a) => {
    const snap = a.snapshot || { sessions: [], muted: false, audioRoute: 'earpiece', conference: false };
    const wasLive = s.sessions.length > 0;
    const nowLive = snap.sessions.length > 0;
    return patch(s, {
      sessions: snap.sessions,
      muted: snap.muted,
      audioRoute: snap.audioRoute,
      conference: snap.conference,
      // Reset per-call UI when the last call clears.
      keypadOpen: nowLive ? s.keypadOpen : false,
      noteDraft: nowLive ? s.noteDraft : '',
      pendingNumber: nowLive ? null : s.pendingNumber,
      error: wasLive && !nowLive ? null : s.error,
    });
  },
  [A.CALL_SET_KEYPAD]: (s, a) => patch(s, { keypadOpen: a.open }),
  [A.CALL_SET_NOTE_DRAFT]: (s, a) => patch(s, { noteDraft: a.text }),
  [A.CALL_SET_POSTCALL]: (s, a) => patch(s, { postCall: a.postCall }),
  [A.CALL_CLEAR_POSTCALL]: (s) => (s.postCall ? patch(s, { postCall: null }) : s),
  [A.CALL_SET_ERROR]: (s, a) => patch(s, { error: a.error }),
  [A.CALL_SET_PENDING]: (s, a) => patch(s, { pendingNumber: a.number }),
});

/* ---------------------------------------------------------------- overlay */

export const overlayInitial = { stack: [] };

export const overlay = createReducer(overlayInitial, {
  [A.OVERLAY_PUSH]: (s, a) => patch(s, {
    stack: [...s.stack, { id: `ov_${Date.now()}_${s.stack.length}`, kind: a.kind, props: a.props }],
  }),
  [A.OVERLAY_POP]: (s) => (s.stack.length ? patch(s, { stack: s.stack.slice(0, -1) }) : s),
  [A.OVERLAY_REPLACE]: (s, a) => patch(s, {
    stack: [...s.stack.slice(0, -1), { id: `ov_${Date.now()}`, kind: a.kind, props: a.props }],
  }),
  [A.OVERLAY_CLEAR]: (s) => (s.stack.length ? patch(s, { stack: [] }) : s),
  // Changing tab is a navigation event: it must not leave sheets stranded.
  [A.APP_SET_TAB]: (s) => (s.stack.length ? patch(s, { stack: [] }) : s),
});

/* ------------------------------------------------------------------ theme */

export const themeInitial = {
  mode: 'dark',
  resolvedMode: 'dark',
  wallpaperId: 'wp_deep-green',
  palette: null,
  intensity: 'subtle',
  showWallpaper: true,
  standard: false,
  contrast: 'normal',
  motion: 'system',
  fontScale: 1,
};

export const theme = createReducer(themeInitial, {
  [A.THEME_SET]: (s, a) => patch(s, a.patch),
  [A.THEME_SET_PALETTE]: (s, a) => patch(s, { palette: a.palette, wallpaperId: a.wallpaperId ?? s.wallpaperId }),
});

/* --------------------------------------------------------------- settings */

export const settingsInitial = defaultSettings();

export const settings = createReducer(settingsInitial, {
  [A.SETTINGS_LOADED]: (_s, a) => a.settings,
  [A.SETTINGS_SET]: (s, a) => withPath(s, a.path, a.value),
  [A.SETTINGS_RESET]: () => defaultSettings(),
});

/* -------------------------------------------------------- reminders/toasts */

export const remindersInitial = [];

export const reminders = createReducer(remindersInitial, {
  [A.REMINDERS_LOADED]: (_s, a) => a.reminders,
  [A.REMINDER_UPSERT]: (s, a) => {
    const i = s.findIndex((r) => r.id === a.reminder.id);
    if (i < 0) return [...s, a.reminder];
    const next = s.slice(); next[i] = a.reminder; return next;
  },
  [A.REMINDER_REMOVE]: (s, a) => s.filter((r) => r.id !== a.id),
});

export const toastsInitial = [];

export const toasts = createReducer(toastsInitial, {
  [A.TOAST_PUSH]: (s, a) => [...s.slice(-2), a.toast],   // never more than three
  [A.TOAST_DISMISS]: (s, a) => s.filter((t) => t.id !== a.id),
});
