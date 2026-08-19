/**
 * DIALR — selectors.
 *
 * All derived data lives here, memoised. Two rules the whole app depends on:
 *
 * 1. THE IDENTITY HIERARCHY IS IMPLEMENTED EXACTLY ONCE.
 *
 *        local saved name  >  DIALR profile name  >  phone number
 *
 *    Screens ask `resolveIdentity()` for a name. No screen decides for itself,
 *    because the incoming-call screen getting this wrong is a real-world
 *    failure ("who is calling me?"), not a styling bug.
 *
 * 2. THE THREE STORES STAY SEPARATE IN STATE.
 *
 *    A ContactView is a *projection* built for rendering. It is never written
 *    back. Device data, cloud profile data and your own private notes about
 *    someone have different owners, different lifetimes and different privacy
 *    rules; merging them into one mutable object is how apps end up uploading
 *    a private nickname to a server.
 */

import { createSelector } from '../core/store.js';
import {
  numberKey, nameParts, initials as toInitials, pronouns as pronounSet,
  isMissed, isAnswered, isIncoming, formatNumber,
} from '../core/format.js';
import {
  callbackDebt, matchContacts, bestTimeToCall, topOfMind,
  buildRewind, numberOrigin, callsToday,
} from './smart.js';
import { findMedia } from '../data/media.js';

/* --------------------------------------------------------------- raw refs */

export const selContacts   = (s) => s.directory.contacts;
export const selProfiles   = (s) => s.directory.profiles;
export const selPrivate    = (s) => s.directory.privateData;
export const selCallLog    = (s) => s.directory.callLog;
export const selSpam       = (s) => s.directory.spam;
export const selSims       = (s) => s.directory.sims;
export const selMe         = (s) => s.directory.me;
export const selSettings   = (s) => s.settings;
export const selDialerInput= (s) => s.dialer.input;
export const selTab        = (s) => s.app.tab;
export const selCallState  = (s) => s.call;
export const selOverlays   = (s) => s.overlay.stack;
export const selTheme      = (s) => s.theme;

/* ------------------------------------------------------------ call log map */

/** contactKey -> entries, newest first. The backbone of everything derived. */
export const selLogByContact = createSelector([selCallLog], (log) => {
  const map = new Map();
  for (const e of log) {
    let arr = map.get(e.contactKey);
    if (!arr) { arr = []; map.set(e.contactKey, arr); }
    arr.push(e);
  }
  for (const arr of map.values()) arr.sort((a, b) => b.startedAt - a.startedAt);
  return map;
});

export const selDebt = createSelector([selCallLog], (log) => callbackDebt(log));

/* --------------------------------------------------------- contact views  */

/**
 * @typedef {Object} ContactView   read-only render projection
 * @property {string} key          numberKey of the primary number
 * @property {string|null} id      device contact id, null for unsaved
 * @property {'device'|'dialr'|'unknown'} source
 */
export const selContactViews = createSelector(
  [selContacts, selProfiles, selPrivate, selLogByContact, selSpam],
  (contacts, profiles, priv, logByContact, spam) => contacts.map((c) => {
    const primary = c.numbers.find((n) => n.primary) || c.numbers[0] || { value: '' };
    const key = numberKey(primary.value);
    const entries = logByContact.get(key) || [];
    const p = priv[key] || {};
    return buildView({
      key,
      id: c.id,
      source: 'device',
      displayName: c.displayName,
      firstName: c.firstName,
      surname: c.lastName,
      org: c.org,
      starred: c.starred,
      numbers: c.numbers,
      primaryNumber: primary.value,
      photoUri: c.photoUri,
      identityMark: c.identityMark,
      dialr: profiles[key] || null,
      priv: p,
      entries,
      spam: spam[key] || null,
    });
  })
);

function buildView(base) {
  const { entries } = base;
  const last = entries[0] || null;
  const parts = nameParts(base.displayName || '');
  return {
    ...base,
    firstName: base.firstName || parts.first,
    surname: base.surname || parts.surname,
    initials: toInitials(base.displayName || base.primaryNumber || '?'),
    hasPhoto: !!(base.photoUri || base.dialr?.avatarUrl),
    avatar: base.photoUri || base.dialr?.avatarUrl || null,
    pronouns: base.priv?.pronouns || null,
    label: base.priv?.label || null,
    note: base.priv?.note || null,
    savedPlace: base.priv?.savedPlace || null,
    favourite: !!base.priv?.favourite || !!base.starred,
    vip: !!base.priv?.vip,
    trusted: !!base.priv?.trusted,
    blocked: !!base.priv?.blocked || !!base.spam?.blocked,
    preferredSim: base.priv?.preferredSim || null,
    ringtoneId: base.priv?.ringtoneId || null,
    backgroundId: base.priv?.backgroundId || null,
    lastCallAt: last?.startedAt || 0,
    lastCall: last,
    callCount: entries.length,
    isDialrUser: !!base.dialr,
  };
}

export const selContactsByKey = createSelector([selContactViews], (views) => {
  const m = new Map();
  for (const v of views) {
    m.set(v.key, v);
    // Secondary numbers resolve to the same person.
    for (const n of v.numbers) m.set(numberKey(n.value), v);
  }
  return m;
});

/* -------------------------------------------------------- identity resolve */

/**
 * THE hierarchy. Returns a stable shape whatever tier resolves.
 *
 * @returns {{tier:'saved'|'dialr'|'unknown', name:string, eyebrow:string|null,
 *            sub:string|null, view:ContactView|null, profile:object|null,
 *            avatar:string|null, hasPhoto:boolean, number:string, key:string}}
 */
export function resolveIdentity(state, number, { allowLookup = true } = {}) {
  const key = numberKey(number);
  const byKey = selContactsByKey(state);
  const saved = byKey.get(key);

  if (saved) {
    return {
      tier: 'saved',
      key, number,
      name: saved.displayName,
      eyebrow: saved.surname || null,
      first: saved.firstName,
      sub: saved.label || saved.org || null,
      view: saved,
      profile: saved.dialr || null,
      avatar: saved.photoUri || (saved.dialr?.avatarUrl ?? null),
      hasPhoto: !!(saved.photoUri || saved.dialr?.avatarUrl),
    };
  }

  const profile = allowLookup ? selProfiles(state)[key] : null;
  if (profile) {
    const display = [profile.firstName, profile.surname].filter(Boolean).join(' ');
    return {
      tier: 'dialr',
      key, number,
      name: display,
      eyebrow: profile.surname || null,
      first: profile.firstName,
      sub: 'On DIALR',
      view: null,
      profile,
      avatar: profile.avatarUrl || null,
      hasPhoto: !!profile.avatarUrl,
    };
  }

  return {
    tier: 'unknown',
    key, number,
    name: formatNumber(number),
    eyebrow: null,
    first: null,
    sub: numberOrigin(number),
    view: null,
    profile: null,
    avatar: null,
    hasPhoto: false,
  };
}

/* ------------------------------------------------------------- recent list */

/**
 * Recents, grouped per the user's setting, decorated with everything a card
 * renders: the sentence, the debt marker, spam verdict, note and SIM.
 */
export const selRecents = createSelector(
  [selCallLog, selContactsByKey, selProfiles, selSpam, selDebt, selSettings, (s) => s.recents.filter],
  (log, byKey, profiles, spam, debt, settings, filter) => {
    const grouping = settings.recents.grouping;
    const includeBlocked = settings.recents.includeBlocked;
    const includeSpam = settings.recents.includeSpam;

    const rows = [];
    const seen = new Set();

    for (const entry of log) {
      const key = entry.contactKey;
      const view = byKey.get(key) || null;
      const verdict = spam[key] || null;

      if (!includeBlocked && (view?.blocked || verdict?.blocked)) continue;
      if (!includeSpam && verdict && verdict.score >= 0.75 && !verdict.trusted) continue;

      if (grouping === 'person') {
        if (seen.has(key)) continue;
        seen.add(key);
      }

      const profile = profiles[key] || null;
      // Suspected spam is never a social obligation. Flagging "3 to return" on
      // a scam number is the app telling the user to do the wrong thing.
      const spammy = verdict && verdict.score >= 0.6 && !verdict.trusted;
      const owed = spammy ? null : (debt.get(key) || null);

      rows.push({
        id: grouping === 'person' ? `p_${key}` : entry.id,
        key,
        entry,
        view,
        profile,
        spam: verdict,
        owed,
        pronouns: pronounSet(view),
        displayName: view?.displayName
          || (profile ? [profile.firstName, profile.surname].filter(Boolean).join(' ') : null)
          || formatNumber(entry.number),
        tier: view ? 'saved' : profile ? 'dialr' : 'unknown',
        note: entry.note || null,
        // A person row counts every call, a call row counts one.
        siblingCount: grouping === 'person' ? 0 : 1,
      });
    }

    if (grouping === 'person') {
      const counts = new Map();
      for (const e of log) counts.set(e.contactKey, (counts.get(e.contactKey) || 0) + 1);
      for (const r of rows) r.siblingCount = counts.get(r.key) || 1;
    }

    switch (filter) {
      case 'missed': return rows.filter((r) => isMissed(r.entry));
      case 'owed':   return rows.filter((r) => r.owed);
      case 'spam':   return rows.filter((r) => r.spam && r.spam.score >= 0.5);
      default:       return rows;
    }
  }
);

export const selRecentCounts = createSelector([selCallLog, selDebt, selSpam], (log, debt, spam) => ({
  all: log.length,
  missed: log.filter(isMissed).length,
  owed: debt.size,
  spam: log.filter((e) => (spam[e.contactKey]?.score ?? e.spamScore ?? 0) >= 0.5).length,
}));

/* ----------------------------------------------------------- dialer match */

/**
 * What the dialer currently believes the typed digits mean. This is the input
 * to the contextual dock, so it deliberately returns ONE primary intent plus
 * the alternatives, rather than a bag of possibilities.
 */
export const selDialerMatch = createSelector(
  [selDialerInput, selContactViews, selProfiles, selSpam, selSettings],
  (input, views, profiles, spam, settings) => {
    if (!input) return { state: 'empty', input: '', matches: [], primary: null };

    const digits = input.replace(/\D/g, '');
    if (input.includes('*') || input.includes('#')) {
      return { state: 'code', input, matches: [], primary: null };
    }

    const matches = matchContacts(digits, views, { t9: settings.smart.t9 });
    const key = numberKey(input);
    const exactProfile = profiles[key] || null;
    const verdict = spam[key] || null;

    if (matches.length) {
      return {
        state: 'contact',
        input,
        matches,
        primary: { kind: 'contact', view: matches[0].contact, number: matches[0].number.value },
        spam: verdict,
      };
    }
    if (exactProfile && digits.length >= 8) {
      return {
        state: 'dialr',
        input,
        matches: [],
        primary: { kind: 'dialr', profile: exactProfile, number: input },
        spam: verdict,
      };
    }
    if (digits.length < 3) return { state: 'typing', input, matches: [], primary: null };

    return {
      state: digits.length >= 6 ? 'unknown' : 'typing',
      input,
      matches: [],
      primary: digits.length >= 6 ? { kind: 'unknown', number: input } : null,
      spam: verdict,
    };
  }
);

/* ------------------------------------------------------------- top of mind */

export const selTopOfMind = createSelector(
  [selLogByContact, selContactsByKey, selSettings],
  (byContact, byKey, settings) => {
    if (!settings.smart.topOfMind) return [];
    return topOfMind(byContact)
      .map((t) => byKey.get(t.contactKey))
      .filter(Boolean)
      .slice(0, 6);
  }
);

/* --------------------------------------------------------------- contacts */

export const selContactList = createSelector(
  [selContactViews, (s) => s.contactsUi.query, (s) => s.contactsUi.sort],
  (views, query, sort) => {
    const q = query.trim().toLowerCase();
    let rows = views;
    if (q) {
      const digits = q.replace(/\D/g, '');
      rows = views.filter((v) =>
        v.displayName.toLowerCase().includes(q) ||
        (v.org || '').toLowerCase().includes(q) ||
        (digits && v.numbers.some((n) => n.value.replace(/\D/g, '').includes(digits))));
    }
    const sorted = rows.slice();
    if (sort === 'recent') sorted.sort((a, b) => b.lastCallAt - a.lastCallAt);
    else sorted.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    return sorted;
  }
);

/** A→Z index for the sticky section headers. */
export const selContactSections = createSelector([selContactList], (rows) => {
  const out = [];
  let current = null;
  for (const r of rows) {
    const ch = (r.displayName[0] || '#').toUpperCase();
    const letter = /[A-Z]/.test(ch) ? ch : '#';
    if (letter !== current) { current = letter; out.push({ letter, items: [] }); }
    out[out.length - 1].items.push(r);
  }
  return out;
});

/* ----------------------------------------------------------------- search */

export const selSearchResults = createSelector(
  [(s) => s.search.query, selContactViews, selCallLog, selContactsByKey, selSettings],
  (query, views, log, byKey, settings) => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return { people: [], calls: [], notes: [], empty: true };

    const digits = q.replace(/\D/g, '');
    const people = matchContacts(digits || '', views, { t9: settings.smart.t9, limit: 6 }).map((m) => m.contact);
    const byName = views.filter((v) =>
      v.displayName.toLowerCase().includes(q) && !people.includes(v)).slice(0, 6);

    const notes = log
      .filter((e) => e.note && e.note.toLowerCase().includes(q))
      .slice(0, 6)
      .map((e) => ({ entry: e, view: byKey.get(e.contactKey) || null }));

    const calls = digits.length >= 3
      ? log.filter((e) => e.number.replace(/\D/g, '').includes(digits)).slice(0, 6)
        .map((e) => ({ entry: e, view: byKey.get(e.contactKey) || null }))
      : [];

    const all = [...people, ...byName];
    return { people: all, calls, notes, empty: !all.length && !calls.length && !notes.length };
  }
);

/* -------------------------------------------------------------- call view */

/** Everything the incoming/active call screens need, resolved once. */
export function selectCallScreen(state) {
  const c = state.call;
  const session = c.sessions[0] || null;
  if (!session) return null;

  const identity = resolveIdentity(state, session.number, {
    allowLookup: state.settings.identity.lookupUnknown,
  });
  const entries = selLogByContact(state).get(identity.key) || [];
  const spam = state.directory.spam[identity.key] || null;
  const sim = state.directory.sims.find((s) => s.id === session.simId) || null;

  const smart = state.settings.smart;
  const priorEntries = entries.filter((e) => e.id !== session.id);
  const lastNote = smart.lastNoteOnIncoming
    ? priorEntries.find((e) => e.note)?.note || null
    : null;

  return {
    session,
    sessions: c.sessions,
    identity,
    sim,
    spam,
    muted: c.muted,
    audioRoute: c.audioRoute,
    conference: c.conference,
    keypadOpen: c.keypadOpen,
    noteDraft: c.noteDraft,
    firstTime: smart.firstTimeCaller && priorEntries.length === 0,
    todayCount: smart.repeatToday ? callsToday(priorEntries) : 0,
    lastNote,
    origin: smart.numberRegion ? numberOrigin(session.number) : null,
    background: resolveCallBackground(state, identity),
  };
}

/**
 * Customization priority, formalised in docs/CUSTOMIZATION_SYSTEM.md:
 *
 *     contact-specific  →  their DIALR poster  →  your global wallpaper  →  none
 *
 * Always returns a usable `url`; the call screens must never have to look an
 * asset id up themselves.
 */
export function resolveCallBackground(state, identity) {
  const t = state.theme;
  if (state.settings.appearance.profile === 'standard') return null;

  const contactBg = identity.view?.backgroundId || null;
  if (contactBg) {
    const asset = findMedia(contactBg);
    if (asset) return { id: contactBg, url: asset.url, scope: 'contact' };
  }
  if (identity.profile?.posterUrl && state.settings.identity.lookupUnknown) {
    return { id: null, url: identity.profile.posterUrl, scope: 'profile' };
  }
  if (t.wallpaperId) {
    const asset = findMedia(t.wallpaperId);
    if (asset) return { id: t.wallpaperId, url: asset.url, scope: 'global' };
  }
  return null;
}

/* ------------------------------------------------------------ per-contact */

export function selectContactDetail(state, contactKey) {
  const view = selContactsByKey(state).get(contactKey) || null;
  const entries = selLogByContact(state).get(contactKey) || [];
  const settings = state.settings;
  return {
    view,
    entries,
    profile: view?.dialr || state.directory.profiles[contactKey] || null,
    spam: state.directory.spam[contactKey] || null,
    debt: selDebt(state).get(contactKey) || null,
    bestTime: settings.smart.bestTime ? bestTimeToCall(entries) : null,
    rewindAvailable: settings.recents.rewindEnabled && entries.length >= settings.recents.rewindMinCalls,
  };
}

export function selectRewind(state, contactKey) {
  const entries = selLogByContact(state).get(contactKey) || [];
  const view = selContactsByKey(state).get(contactKey) || null;
  return buildRewind(entries, view);
}

/* ------------------------------------------------------------------ misc */

export const selPermissionsOk = createSelector([(s) => s.app.permissions], (p) => {
  const need = ['android.permission.READ_CONTACTS', 'android.permission.READ_CALL_LOG', 'android.permission.CALL_PHONE'];
  return need.every((n) => p[n] === 'granted');
});

export const selHasCall = (s) => s.call.sessions.length > 0;
export const selIncomingSession = (s) => s.call.sessions.find((x) => x.state === 'ringing') || null;

export { isMissed, isAnswered, isIncoming };
