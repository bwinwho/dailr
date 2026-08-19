/**
 * DIALR — derived intelligence.
 *
 * Every function here is pure, synchronous, and computed from the device's own
 * call log. Nothing is uploaded, nothing is inferred from anyone else's data,
 * and each one maps to exactly one user-visible setting under Settings ▸ Smart
 * so a person can turn off any conclusion the app draws about them.
 *
 * Design constraint: these features must stay *quiet*. A dialer that nags is
 * worse than a dialer that says nothing. So each produces at most a short
 * phrase or a single chip — never a card, never a banner, never a modal.
 */

import { isMissed, isAnswered, isIncoming, dayPart, DAY_PART_LABEL, clockTime,
         spokenDuration, plural, toT9, numberKey } from '../core/format.js';

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

/* ------------------------------------------------------------ T9 matching */

/**
 * Match typed digits against contacts by number AND by keypad letters.
 * Ranked so the answer you meant is first: number prefix beats name start,
 * name start beats a match in the middle of a name.
 *
 * @param {string} digits    what the user typed
 * @param {Array} contacts   ContactView[]
 * @param {{t9?:boolean, limit?:number}} opts
 */
export function matchContacts(digits, contacts, { t9 = true, limit = 8 } = {}) {
  const q = String(digits).replace(/\D/g, '');
  if (!q) return [];

  const out = [];
  for (const c of contacts) {
    let best = null;

    for (const num of c.numbers) {
      const plain = num.value.replace(/\D/g, '');
      if (plain.startsWith(q)) { best = rank(0, num); break; }
      if (plain.endsWith(q) && q.length >= 4) { best = better(best, rank(1, num)); }
      else if (plain.includes(q) && q.length >= 4) { best = better(best, rank(3, num)); }
    }

    if (t9 && q.length >= 2) {
      const t9name = toT9(c.displayName);
      const words = t9name.split(' ');
      if (words.some((w) => w.startsWith(q))) best = better(best, rank(1.5, c.numbers[0]));
      else if (t9name.replace(/ /g, '').includes(q)) best = better(best, rank(3.5, c.numbers[0]));
    }

    if (best) out.push({ contact: c, number: best.number, score: best.score });
  }

  return out
    .sort((a, b) => a.score - b.score || b.contact.lastCallAt - a.contact.lastCallAt)
    .slice(0, limit);

  function rank(score, number) { return { score, number }; }
  function better(a, b) { return !a || b.score < a.score ? b : a; }
}

/* ------------------------------------------------------- callback "debt" */

/**
 * Missed incoming calls you have not returned or been called back about.
 * This is the single most useful thing a call log can tell you and every
 * default dialer buries it under an arrow glyph.
 *
 * @returns {Map<string, {count:number, since:number}>} keyed by contactKey
 */
export function callbackDebt(callLog, { now = Date.now(), maxAgeDays = 14 } = {}) {
  const cutoff = now - maxAgeDays * DAY;
  const debt = new Map();
  // The log is newest-first; walk oldest-first so a later call clears a debt.
  for (let i = callLog.length - 1; i >= 0; i--) {
    const e = callLog[i];
    if (e.startedAt < cutoff) continue;
    const key = e.contactKey;
    if (isMissed(e)) {
      const cur = debt.get(key);
      debt.set(key, { count: (cur?.count || 0) + 1, since: cur?.since ?? e.startedAt });
    } else if (isAnswered(e) || e.disposition.startsWith('outgoing')) {
      debt.delete(key);           // you called back, or you spoke — settled
    }
  }
  return debt;
}

/* ------------------------------------------------------ best time to call */

/**
 * "Usually answers around 9 PM." Needs enough answered calls to mean something;
 * returns null rather than guessing from three data points.
 */
export function bestTimeToCall(entries, { minSamples = 6 } = {}) {
  const answered = entries.filter(isAnswered);
  if (answered.length < minSamples) return null;

  const buckets = new Array(24).fill(0);
  for (const e of answered) buckets[new Date(e.startedAt).getHours()]++;

  // Smooth over ±1 hour so 8:59 and 9:01 do not compete.
  const smoothed = new Array(24);
  for (let h = 0; h < 24; h++) {
    smoothed[h] = buckets[(h + 23) % 24] * 0.5 + buckets[h] + buckets[(h + 1) % 24] * 0.5;
  }
  let bestHour = 0, bestScore = -1;
  for (let h = 0; h < 24; h++) if (smoothed[h] > bestScore) { bestScore = smoothed[h]; bestHour = h; }

  // A flat distribution is not a pattern. Compare the peak against what a
  // uniform spread would produce rather than against a fixed share, so the
  // test works the same for someone with 8 calls and someone with 800.
  const mean = smoothed.reduce((a, b) => a + b, 0) / 24;
  const lift = mean > 0 ? bestScore / mean : 0;
  if (lift < 1.9) return null;

  const d = new Date(); d.setHours(bestHour, 0, 0, 0);
  return {
    hour: bestHour,
    part: dayPart(d),
    label: `Usually answers around ${clockTime(d.getTime())}`,
    confidence: Math.min(1, (lift - 1) / 4),
    samples: answered.length,
  };
}

/* ------------------------------------------------------ repeated calling */

/**
 * Abnormal repeat calling from one number — the "BLOCK THIS CALLER?" trigger.
 * Thresholds are parameters, never constants, because the brief says they must
 * stay configurable rather than baked into the visual layer.
 */
export function repeatedCallBurst(entries, {
  count = 5, windowMin = 15, staleMin = 180, now = Date.now(),
} = {}) {
  // Unanswered incoming attempts, newest first.
  const attempts = entries
    .filter((e) => isIncoming(e) && !isAnswered(e))
    .sort((a, b) => b.startedAt - a.startedAt);
  if (attempts.length < count) return null;

  // The burst is anchored to the most recent attempt, not to "now" — that is
  // what the trigger actually means: "the last N tries came in a tight cluster".
  const newest = attempts[0];
  if (now - newest.startedAt > staleMin * MIN) return null;

  // Slide a window of `count` attempts and take the tightest cluster.
  for (let i = 0; i + count <= attempts.length; i++) {
    const window = attempts.slice(i, i + count);
    const span = window[0].startedAt - window[window.length - 1].startedAt;
    if (span <= windowMin * MIN) {
      // Extend while later attempts still fall inside the window.
      let end = i + count;
      while (end < attempts.length && window[0].startedAt - attempts[end].startedAt <= windowMin * MIN) end++;
      const all = attempts.slice(i, end);
      return {
        count: all.length,
        windowMin,
        firstAt: all[all.length - 1].startedAt,
        lastAt: all[0].startedAt,
        spanMin: Math.round((all[0].startedAt - all[all.length - 1].startedAt) / MIN),
      };
    }
  }
  return null;
}

/** "Called you 3 times today" for the incoming screen. */
export function callsToday(entries, { now = Date.now() } = {}) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return entries.filter((e) => e.startedAt >= start.getTime() && isIncoming(e)).length;
}

export const isFirstTimeCaller = (entries) => entries.length === 0;

/* --------------------------------------------------------- fading contact */

/**
 * People you clearly care about (high historical frequency) who have gone
 * quiet. Opt-in, and capped to one suggestion so it can never become a feed.
 */
export function fadingContacts(byContact, { now = Date.now(), weeks = 4, minHistory = 12 } = {}) {
  const gapMs = weeks * 7 * DAY;
  const out = [];
  for (const [key, entries] of byContact) {
    if (entries.length < minHistory) continue;
    const last = entries[0]?.startedAt ?? 0;
    const silence = now - last;
    if (silence < gapMs) continue;
    // Compare their silence against their own historical cadence, not a global
    // rule — a monthly caller who is a week late is not "fading".
    const span = (entries[0].startedAt - entries[entries.length - 1].startedAt) || 1;
    const cadence = span / entries.length;
    if (silence < cadence * 4) continue;
    out.push({ contactKey: key, lastAt: last, silenceDays: Math.floor(silence / DAY), cadenceDays: Math.round(cadence / DAY) });
  }
  return out.sort((a, b) => b.silenceDays / b.cadenceDays - a.silenceDays / a.cadenceDays).slice(0, 1);
}

/* ------------------------------------------------------------ top of mind */

/** Frequency × recency, so someone you called twice today outranks a monthly call. */
export function topOfMind(byContact, { now = Date.now(), limit = 6, days = 45 } = {}) {
  const scores = [];
  for (const [key, entries] of byContact) {
    let score = 0;
    for (const e of entries) {
      const ageDays = (now - e.startedAt) / DAY;
      if (ageDays > days) break;
      const weight = Math.exp(-ageDays / 12);              // ~12-day half-life
      score += weight * (isAnswered(e) ? 1.4 : 0.6);
    }
    if (score > 0.35) scores.push({ contactKey: key, score });
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* --------------------------------------------------------------- duplicates */

/** Contacts whose numbers overlap — offered as a merge suggestion, never auto. */
export function duplicateSuggestions(contacts) {
  const byKey = new Map();
  for (const c of contacts) {
    for (const n of c.numbers) {
      const k = numberKey(n.value);
      if (!k) continue;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(c);
    }
  }
  const seen = new Set();
  const out = [];
  for (const [, list] of byKey) {
    if (list.length < 2) continue;
    const ids = list.map((c) => c.id).sort().join('|');
    if (seen.has(ids)) continue;
    seen.add(ids);
    out.push({ contacts: list, reason: 'same number' });
  }
  return out;
}

/* ------------------------------------------------------------ silent hours */

/** Is `now` inside a possibly-overnight window like 23:00 → 07:00? */
export function inSilentHours(from, to, now = new Date()) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = String(from).split(':').map(Number);
  const [th, tm] = String(to).split(':').map(Number);
  const f = fh * 60 + fm, t = th * 60 + tm;
  return f <= t ? mins >= f && mins < t : mins >= f || mins < t;
}

/* ---------------------------------------------------------- number region */

const REGION_PREFIX = [
  ['+9180', 'Bengaluru'], ['+9111', 'Delhi'], ['+9122', 'Mumbai'], ['+9144', 'Chennai'],
  ['+9133', 'Kolkata'], ['+9140', 'Hyderabad'], ['+9120', 'Pune'], ['+9179', 'Ahmedabad'],
  ['+91', 'India'], ['+1', 'US / Canada'], ['+44', 'United Kingdom'], ['+61', 'Australia'],
  ['+971', 'UAE'], ['+65', 'Singapore'], ['+977', 'Nepal'],
];

/** Offline, prefix-table only. Never a network call just to label a number. */
export function numberOrigin(number) {
  const s = String(number).replace(/[^\d+]/g, '');
  if (!s.startsWith('+')) return null;
  for (const [prefix, label] of REGION_PREFIX) if (s.startsWith(prefix)) return label;
  return null;
}

/* ------------------------------------------------------------ Check Rewind */

/**
 * The relationship recap. Reads as a story about two people, not a dashboard —
 * so every stat below has to earn its place by being *sayable out loud*.
 *
 * @param {CallLogEntry[]} entries newest-first, one contact
 */
export function buildRewind(entries, contact, { now = Date.now() } = {}) {
  if (!entries.length) return null;

  const answered = entries.filter(isAnswered);
  const incoming = entries.filter(isIncoming);
  const outgoing = entries.filter((e) => !isIncoming(e));
  const missed = entries.filter(isMissed);

  const totalSec = answered.reduce((a, e) => a + e.durationSec, 0);
  const longest = answered.reduce((a, e) => (e.durationSec > (a?.durationSec ?? 0) ? e : a), null);
  const first = entries[entries.length - 1];
  const last = entries[0];

  // Who reaches out first — measured over conversation "sessions" (a gap of
  // 6h+ starts a new one), because 4 redials in a row is one attempt, not four.
  let sessions = 0, theyStarted = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const prev = entries[i + 1];
    if (!prev || e.startedAt - prev.startedAt > 6 * HOUR) {
      sessions++;
      if (isIncoming(e)) theyStarted++;
    }
  }

  const byDay = new Array(7).fill(0);
  const byHour = new Array(24).fill(0);
  for (const e of entries) {
    const d = new Date(e.startedAt);
    byDay[d.getDay()]++;
    byHour[d.getHours()]++;
  }
  const busiestDay = byDay.indexOf(Math.max(...byDay));
  const busiestHour = byHour.indexOf(Math.max(...byHour));

  // Trend: last 30 days vs the 30 before it.
  const recent = entries.filter((e) => now - e.startedAt <= 30 * DAY).length;
  const prior = entries.filter((e) => now - e.startedAt > 30 * DAY && now - e.startedAt <= 60 * DAY).length;
  const trend = prior === 0 ? (recent ? 'new' : 'flat')
    : recent > prior * 1.25 ? 'up' : recent < prior * 0.75 ? 'down' : 'flat';

  const spanDays = Math.max(1, Math.round((last.startedAt - first.startedAt) / DAY));
  const notes = entries.filter((e) => e.note).length;

  const name = contact?.firstName || 'them';

  return {
    contactKey: entries[0].contactKey,
    spanDays,
    firstAt: first.startedAt,
    lastAt: last.startedAt,
    totalCalls: entries.length,
    answeredCalls: answered.length,
    missedCalls: missed.length,
    totalSeconds: totalSec,
    averageSeconds: answered.length ? Math.round(totalSec / answered.length) : 0,
    longestCall: longest ? { seconds: longest.durationSec, at: longest.startedAt } : null,
    incomingCount: incoming.length,
    outgoingCount: outgoing.length,
    balance: entries.length ? outgoing.length / entries.length : 0.5,
    sessions,
    theyStartedShare: sessions ? theyStarted / sessions : 0.5,
    busiestDay,
    busiestHour,
    trend,
    notesCount: notes,
    /** Short, human sentences the Rewind screen renders as its headlines. */
    headlines: [
      { key: 'time',    label: 'Time together',
        value: spokenDuration(totalSec), sub: `across ${entries.length} ${plural(entries.length, 'call', 'calls')}` },
      { key: 'starter', label: 'Usually calls first',
        value: sessions === 0 ? '—'
          : theyStarted / sessions > 0.6 ? name
          : theyStarted / sessions < 0.4 ? 'You'
          : 'Evenly split',
        sub: `${sessions} ${plural(sessions, 'conversation', 'conversations')}` },
      { key: 'when',    label: 'Most likely',
        value: `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][busiestDay]}, ${DAY_PART_LABEL[hourPart(busiestHour)].toLowerCase()}`,
        sub: `around ${clockTime(hourStamp(busiestHour))}` },
      { key: 'longest', label: 'Longest call',
        value: longest ? spokenDuration(longest.durationSec) : '—',
        sub: longest ? relDay(longest.startedAt, now) : 'no answered calls yet' },
      { key: 'average', label: 'Typical call',
        value: answered.length ? spokenDuration(Math.round(totalSec / answered.length)) : '—',
        sub: `${answered.length} answered` },
      { key: 'missed',  label: 'Missed',
        value: String(missed.length),
        sub: missed.length ? `${Math.round((missed.length / entries.length) * 100)}% of calls` : 'none' },
    ],
  };
}

function hourPart(h) { const d = new Date(); d.setHours(h, 0, 0, 0); return dayPart(d); }
function hourStamp(h) { const d = new Date(); d.setHours(h, 0, 0, 0); return d.getTime(); }
function relDay(ts, now) {
  const days = Math.round((now - ts) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} ${plural(months, 'month', 'months')} ago`;
}

/* ---------------------------------------------------------- global rewind */

/** "Your year on DIALR" — the same idea across every contact. */
export function buildGlobalRewind(callLog, contactsByKey, { now = Date.now(), days = 365 } = {}) {
  const since = now - days * DAY;
  const entries = callLog.filter((e) => e.startedAt >= since);
  if (entries.length < 10) return null;

  const answered = entries.filter(isAnswered);
  const totalSec = answered.reduce((a, e) => a + e.durationSec, 0);

  const perContact = new Map();
  for (const e of entries) {
    const cur = perContact.get(e.contactKey) || { calls: 0, seconds: 0 };
    cur.calls++; cur.seconds += e.durationSec;
    perContact.set(e.contactKey, cur);
  }
  const ranked = [...perContact.entries()]
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .slice(0, 5)
    .map(([key, v]) => ({ contactKey: key, contact: contactsByKey.get(key) || null, ...v }));

  const byHour = new Array(24).fill(0);
  for (const e of entries) byHour[new Date(e.startedAt).getHours()]++;

  return {
    days,
    totalCalls: entries.length,
    totalSeconds: totalSec,
    peopleSpokenTo: perContact.size,
    top: ranked,
    peakHour: byHour.indexOf(Math.max(...byHour)),
    missedCount: entries.filter(isMissed).length,
  };
}
