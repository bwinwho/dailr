/**
 * DIALR — human language formatting.
 *
 * This module is where DIALR stops being a call log and starts being readable.
 * The rest of the app never formats a timestamp itself.
 *
 * Two registers, used in different places on purpose:
 *
 *   RELATIVE  ("46 minutes ago", "Last night", "Tuesday afternoon")
 *             Recent cards. Answers "how long ago", which is what you want
 *             when scanning.
 *
 *   DAY-PART  ("NIGHT 11 PM", "AFTERNOON 3:13 PM")
 *             History entries. Answers "when in the day", which is what you
 *             want when reconstructing a conversation.
 *
 * Pronouns: DIALR never guesses. A contact's pronouns are PRIVATE relationship
 * data the user sets themselves; unset contacts read as they/them. That is why
 * history reads "They called you" until you say otherwise — a wrong guess
 * misgenders a real person, the neutral default never does.
 */

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------------------------------------------------------- day parts */

/** night | morning | afternoon | evening — the buckets the whole UI speaks in. */
export function dayPart(date) {
  const h = date.getHours();
  if (h >= 22 || h < 5)  return 'night';
  if (h < 12)            return 'morning';
  if (h < 17)            return 'afternoon';
  if (h < 22)            return 'evening';
  return 'night';
}

export const DAY_PART_LABEL = {
  night: 'Night', morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
};

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }

/* ------------------------------------------------------------ clock strings */

/** 3:13 PM — minutes dropped when they're :00, because "3 PM" reads better. */
export function clockTime(ts, { forceMinutes = false } = {}) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return (m === 0 && !forceMinutes) ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "AFTERNOON 3:13 PM" — the history entry heading. */
export function dayPartTime(ts) {
  const d = new Date(ts);
  return `${DAY_PART_LABEL[dayPart(d)]} ${clockTime(ts)}`;
}

/** "05:12" / "1:04:09" — the live call timer. Tabular figures required. */
export function clockDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "6 minutes", "1 hr 12 min", "42 seconds" — history/Rewind prose. */
export function spokenDuration(seconds, { short = false } = {}) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 1) return short ? '0s' : 'No answer';
  if (s < 60) return short ? `${s}s` : `${s} ${plural(s, 'second', 'seconds')}`;
  const m = Math.round(s / 60);
  if (m < 60) return short ? `${m}m` : `${m} ${plural(m, 'minute', 'minutes')}`;
  const h = Math.floor(m / 60), rem = m % 60;
  if (short) return rem ? `${h}h ${rem}m` : `${h}h`;
  return rem
    ? `${h} ${plural(h, 'hr', 'hrs')} ${rem} min`
    : `${h} ${plural(h, 'hour', 'hours')}`;
}

/* --------------------------------------------------------------- relative -- */

/**
 * The Recent card timestamp. Reads like a sentence fragment, never like a log.
 * @param {number} ts
 * @param {number} [now]
 * @param {object} [opts] opts.compact -> "10 mins" style used inside tight cards
 */
export function relativeTime(ts, now = Date.now(), { compact = false } = {}) {
  const diff = now - ts;
  const then = new Date(ts), nowD = new Date(now);

  if (diff < 0) return 'Just now';
  if (diff < 45 * 1000) return 'Just now';
  if (diff < 90 * 1000) return compact ? '1 min ago' : 'A minute ago';

  if (diff < HOUR) {
    const m = Math.round(diff / MIN);
    return compact ? `${m} mins ago` : `${m} ${plural(m, 'minute', 'minutes')} ago`;
  }

  const dayDelta = daysBetween(then, nowD);

  if (dayDelta === 0) {
    if (diff < 6 * HOUR) {
      const h = Math.round(diff / HOUR);
      return h === 1 ? 'An hour ago' : `${h} hours ago`;
    }
    // Compact drops the day-part suffix ("This evening" -> "Today") — it's
    // read beside a card that already says what happened; the day-part adds
    // width without adding anything a "10 mins ago" card doesn't already
    // convey more precisely. Full form keeps it for standalone contexts.
    if (compact) return 'Today';
    return `This ${dayPart(then) === 'night' ? 'evening' : dayPart(then)}`;
  }

  if (dayDelta === 1) {
    const p = dayPart(then);
    if (p === 'night' || p === 'evening') return 'Last night';
    return compact ? 'Yesterday' : `Yesterday ${p}`;
  }

  if (dayDelta < 7) return compact ? WEEKDAYS[then.getDay()] : `${WEEKDAYS[then.getDay()]} ${dayPart(then)}`;
  if (dayDelta < 14) return 'Last week';
  if (dayDelta < 60) { const w = Math.round(dayDelta / 7); return `${w} weeks ago`; }
  if (then.getFullYear() === nowD.getFullYear()) return `${then.getDate()} ${MONTHS[then.getMonth()]}`;
  return `${MONTHS[then.getMonth()]} ${then.getFullYear()}`;
}

/** Section heading for grouped lists: Today / Yesterday / This week / March. */
export function dayGroupLabel(ts, now = Date.now()) {
  const d = new Date(ts), n = new Date(now);
  const delta = daysBetween(d, n);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Yesterday';
  if (delta < 7) return 'Earlier this week';
  if (delta < 30) return 'Earlier this month';
  if (d.getFullYear() === n.getFullYear()) return fullMonth(d.getMonth());
  return `${fullMonth(d.getMonth())} ${d.getFullYear()}`;
}
function fullMonth(i) {
  return ['January','February','March','April','May','June','July',
          'August','September','October','November','December'][i];
}

/* --------------------------------------------------------------- pronouns -- */

const PRONOUN_SETS = {
  'they/them': { subj: 'they', obj: 'them', poss: 'their', plural: true },
  'she/her':   { subj: 'she',  obj: 'her',  poss: 'her',   plural: false },
  'he/him':    { subj: 'he',   obj: 'him',  poss: 'his',   plural: false },
};
export const PRONOUN_OPTIONS = Object.keys(PRONOUN_SETS);

/** Falls back to they/them whenever the user hasn't said. */
export function pronouns(contact) {
  return PRONOUN_SETS[contact?.pronouns] || PRONOUN_SETS['they/them'];
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The sentence under a history entry or recent card.
 *
 *   "They called you."   "You called them."   "Missed call."   "You declined."
 *
 * @param {object} entry  CallLogEntry — see docs/DATA_CONTRACTS.md
 * @param {object} contact Contact or null
 */
export function callSentence(entry, contact) {
  const p = pronouns(contact);
  const named = contact?.firstName;
  const subject = named || cap(p.subj);
  const verbS = named ? 'called' : (p.plural ? 'called' : 'called');
  const objectOfYou = named ? named : p.obj;

  switch (entry.disposition) {
    case 'incoming-answered':  return `${subject} ${verbS} you.`;
    case 'outgoing-answered':  return `You called ${objectOfYou}.`;
    case 'incoming-missed':    return `Missed call.`;
    case 'incoming-declined':  return `You declined.`;
    case 'incoming-blocked':   return `Blocked.`;
    case 'outgoing-no-answer': return `You called ${objectOfYou}. No answer.`;
    case 'outgoing-busy':      return `${cap(objectOfYou)} was busy.`;
    case 'outgoing-failed':    return `Call failed.`;
    case 'incoming-screened':  return `Screened.`;
    case 'voicemail':          return `Voicemail.`;
    default:                   return `Call.`;
  }
}

/** One-word tag for the coloured chip beside an entry. */
export function dispositionTag(entry) {
  switch (entry.disposition) {
    case 'incoming-missed':    return { label: 'Missed',    tone: 'negative' };
    case 'incoming-declined':  return { label: 'Declined',  tone: 'neutral'  };
    case 'incoming-blocked':   return { label: 'Blocked',   tone: 'negative' };
    case 'incoming-screened':  return { label: 'Screened',  tone: 'warn'     };
    case 'outgoing-no-answer': return { label: 'No answer', tone: 'warn'     };
    case 'outgoing-busy':      return { label: 'Busy',      tone: 'warn'     };
    case 'outgoing-failed':    return { label: 'Failed',    tone: 'negative' };
    case 'voicemail':          return { label: 'Voicemail', tone: 'neutral'  };
    default:                   return null;
  }
}

export const isIncoming = (e) => e.disposition.startsWith('incoming') || e.disposition === 'voicemail';
export const isMissed   = (e) => e.disposition === 'incoming-missed';
export const isAnswered = (e) => e.disposition.endsWith('-answered');

/* ------------------------------------------------------------------ names -- */

/** Split a display name into the eyebrow/headline pair the cards render. */
export function nameParts(displayName = '') {
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', surname: '' };
  if (parts.length === 1) return { first: parts[0], surname: '' };
  return { first: parts[0], surname: parts.slice(1).join(' ') };
}

export function initials(displayName = '', max = 2) {
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, max).map((p) => p[0].toUpperCase()).join('');
}

/* ----------------------------------------------------------------- numbers */

/** Digits only, keeping a leading +. */
export const normalizeNumber = (raw = '') => String(raw).replace(/[^\d+*#]/g, '').replace(/(?!^)\+/g, '');

/** Last-9-digit key: the only reliable way to match +91 98… against 098…. */
export function numberKey(raw = '') {
  const d = String(raw).replace(/\D/g, '');
  return d.length > 9 ? d.slice(-9) : d;
}

/**
 * Group a number for display. Region-aware but forgiving — an unrecognised
 * shape is grouped in threes rather than mangled.
 */
export function formatNumber(raw = '', region = 'IN') {
  const s = normalizeNumber(raw);
  if (!s) return '';
  if (s.startsWith('*') || s.startsWith('#')) return s;         // USSD codes untouched

  const plus = s.startsWith('+');
  let digits = plus ? s.slice(1) : s;

  if (region === 'IN') {
    if (plus && digits.startsWith('91') && digits.length >= 12) {
      const n = digits.slice(2);
      return `+91 ${n.slice(0, 5)} ${n.slice(5, 10)}${n.slice(10) ? ' ' + n.slice(10) : ''}`.trim();
    }
    if (!plus && digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    if (!plus && digits.length === 11 && digits.startsWith('0')) return `0 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  if (region === 'US') {
    if (plus && digits.startsWith('1') && digits.length === 11) digits = digits.slice(1);
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }

  const grouped = digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return plus ? `+${grouped}` : grouped;
}

/** Masks all but the last N digits — used by the "not saved" call screen. */
export function maskNumber(raw = '', reveal = 0) {
  const s = normalizeNumber(raw).replace(/^\+/, '');
  if (!s) return '';
  const shown = reveal ? s.slice(-reveal) : '';
  return 'X'.repeat(Math.max(0, s.length - reveal)) + shown;
}

/* --------------------------------------------------------- T9 letter match */

const T9 = { 2: 'abc', 3: 'def', 4: 'ghi', 5: 'jkl', 6: 'mno', 7: 'pqrs', 8: 'tuv', 9: 'wxyz' };
const LETTER_TO_DIGIT = (() => {
  const m = {};
  for (const d in T9) for (const ch of T9[d]) m[ch] = d;
  return m;
})();

/** "avni" -> "2864". Used so typing 2864 on the keypad finds Avni. */
export function toT9(text = '') {
  let out = '';
  for (const ch of String(text).toLowerCase()) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (LETTER_TO_DIGIT[ch]) out += LETTER_TO_DIGIT[ch];
    else out += ' ';                                  // word boundary marker
  }
  return out;
}

/** The letters printed under each keypad digit. */
export const t9Letters = (digit) => (T9[digit] || '').toUpperCase();

/* ------------------------------------------------------------------ misc -- */

export const plural = (n, one, many) => (Math.abs(n) === 1 ? one : many);

/** 3100 -> "3,100"; 12400 -> "12.4K"; 1240000 -> "1.2M" */
export function compactCount(n) {
  const v = Number(n) || 0;
  if (v < 10_000) return v.toLocaleString('en-US');
  if (v < 1_000_000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`.replace('.0K', 'K');
  return `${(v / 1_000_000).toFixed(1)}M`.replace('.0M', 'M');
}

export function percent(n, digits = 0) {
  return `${(Number(n) * 100).toFixed(digits)}%`;
}

export function titleCase(s = '') {
  return String(s).toLowerCase().replace(/(^|\s|-)([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

/** Clamp a call note to the product's 50-character promise. */
export const NOTE_MAX = 50;
export const clampNote = (s = '') => String(s).slice(0, NOTE_MAX);
