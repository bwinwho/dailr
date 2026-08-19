/**
 * DIALR — mock database.
 *
 * Deterministic by design: a seeded PRNG plus fixed offsets from "now", so the
 * demo looks identical on every reload while still reading as live data
 * ("10 minutes ago" is always genuinely 10 minutes ago).
 *
 * The shapes here are the real data contracts (docs/DATA_CONTRACTS.md). The
 * Kotlin layer will supply the same shapes from the Contacts and CallLog
 * providers; nothing in the UI knows this file exists — it is reached only
 * through src/services/mock/*.
 *
 * THREE SEPARATE IDENTITY STORES, never merged into one object:
 *
 *   deviceContacts   what Android's contact provider knows.  Device truth.
 *   dialrProfiles    what the person publishes on DIALR.     Cloud identity.
 *   privateData      what YOU wrote about them.              Yours alone.
 */

import { identityMark, photoStandIn, posterStandIn } from './avatars.js';
import { numberKey } from '../core/format.js';

/* ------------------------------------------------------------------- PRNG  */

function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x0D1A17);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const chance = (p) => rand() < p;

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const NOW = Date.now();

/* ------------------------------------------------------------------ people */

/**
 * `rhythm` drives generated history and therefore every Rewind statistic:
 *   perWeek    typical calls per week
 *   hours      hours of day this relationship happens in
 *   theyStart  probability the contact initiates
 *   answered   probability a call connects
 *   mins       [min, max] typical connected duration
 */
const PEOPLE = [
  {
    key: 'avni', first: 'Avni', last: 'Chhetri', number: '+919842004200',
    photo: true, photoTint: ['#3d6f66', '#1b3b3f', '#0d1416'],
    starred: true, pronouns: 'she/her', relation: null,
    dialr: {
      handle: 'avni', bio: [
        { kind: 'line', text: 'Just a pretty girl' },
        { kind: 'line', text: 'Deep green eyes', tone: 'accent' },
        { kind: 'trait', text: 'Ambivert', tone: 'warn' },
        { kind: 'loves', items: ['Mountains', 'Beaches', 'Clouds', 'KODE31'] },
      ],
      role: 'Model at KODE31', squad: 3100, views: 31200, pickup: 0.87,
      links: ['whatsapp', 'email', 'website', 'instagram'], verified: true,
      region: 'IN', sign: 'Aquarius',
    },
    rhythm: { perWeek: 5.5, hours: [21, 22, 23, 15, 16], theyStart: 0.62, answered: 0.88, mins: [3, 26] },
  },
  {
    key: 'ma', first: 'Ma', last: '', number: '+919845110023',
    photo: false, starred: true, vip: true, pronouns: 'she/her', relation: 'Mother',
    place: { label: 'Home', area: 'Indiranagar' },
    rhythm: { perWeek: 6, hours: [8, 9, 19, 20], theyStart: 0.72, answered: 0.94, mins: [4, 18] },
  },
  {
    key: 'kabir', first: 'Kabir', last: 'Sen', number: '+919845227781',
    photo: true, photoTint: ['#4a5568', '#232b38', '#0f1216'],
    relation: 'Brother', pronouns: 'he/him',
    place: { label: 'Home', area: 'Whitefield' },
    rhythm: { perWeek: 2.2, hours: [13, 14, 22, 23], theyStart: 0.44, answered: 0.72, mins: [2, 14] },
  },
  {
    key: 'dad', first: 'Dad', last: '', number: '+919845110024',
    photo: false, starred: true, pronouns: 'he/him', relation: 'Father',
    rhythm: { perWeek: 1.4, hours: [7, 8, 20], theyStart: 0.5, answered: 0.9, mins: [3, 9] },
  },
  {
    key: 'zoya', first: 'Zoya', last: 'Rahman', number: '+919833441290',
    photo: true, photoTint: ['#6b3f5e', '#33203a', '#120c15'], pronouns: 'she/her',
    dialr: {
      handle: 'zoya.r', bio: [
        { kind: 'line', text: 'Sound designer' },
        { kind: 'line', text: 'Mostly nocturnal', tone: 'accent' },
      ],
      role: 'Audio at KODE31', squad: 812, views: 4400, pickup: 0.61,
      links: ['instagram', 'website', 'telegram', 'email'], verified: false, region: 'IN',
    },
    rhythm: { perWeek: 3, hours: [23, 0, 1, 17], theyStart: 0.55, answered: 0.66, mins: [5, 40] },
  },
  {
    key: 'rohan', first: 'Rohan', last: 'Mehta', number: '+919900112233',
    photo: false, pronouns: 'he/him',
    rhythm: { perWeek: 2, hours: [12, 13, 18, 19], theyStart: 0.5, answered: 0.8, mins: [2, 11] },
  },
  {
    key: 'priya', first: 'Priya', last: 'Nair', number: '+918041229900',
    photo: true, photoTint: ['#6b6242', '#332f22', '#131210'], pronouns: 'she/her',
    org: 'Northline Studio', relation: 'Work',
    rhythm: { perWeek: 3.4, hours: [10, 11, 15, 16, 17], theyStart: 0.48, answered: 0.85, mins: [4, 22] },
  },
  {
    key: 'arjun', first: 'Arjun', last: 'Rao', number: '+919845667712',
    photo: false, pronouns: 'he/him', org: 'Northline Studio', relation: 'Work',
    rhythm: { perWeek: 1.2, hours: [11, 14, 16], theyStart: 0.35, answered: 0.7, mins: [1, 8] },
  },
  {
    key: 'neha', first: 'Neha', last: 'Kapoor', number: '+919820334455',
    photo: true, photoTint: ['#3f5a6b', '#1f2f38', '#0d1215'], pronouns: 'she/her',
    rhythm: { perWeek: 0.8, hours: [19, 20, 21], theyStart: 0.6, answered: 0.75, mins: [6, 30] },
  },
  {
    key: 'iyer', first: 'Dr. Iyer', last: '', number: '+918025551212',
    photo: false, org: 'Sunrise Clinic', business: true, trusted: true,
    rhythm: { perWeek: 0.25, hours: [10, 11, 17], theyStart: 0.3, answered: 0.8, mins: [2, 6] },
  },
  {
    key: 'landlord', first: 'Mr. Prasad', last: '', number: '+919886554433',
    photo: false, pronouns: 'he/him', relation: 'Landlord',
    rhythm: { perWeek: 0.3, hours: [11, 18], theyStart: 0.85, answered: 0.4, mins: [1, 5] },
  },
  {
    key: 'blinkit', first: 'Blinkit', last: 'Delivery', number: '+918046661000',
    photo: false, business: true, trusted: true, verifiedBusiness: true,
    rhythm: { perWeek: 2.5, hours: [12, 13, 19, 20, 21], theyStart: 0.98, answered: 0.55, mins: [0.4, 2] },
  },
];

/** People who are on DIALR but NOT in the user's device contacts. */
const UNSAVED_DIALR = [
  {
    key: 'ishaan', number: '+919812345670',
    dialr: {
      handle: 'ishaan.k', firstName: 'Ishaan', surname: 'Kulkarni',
      bio: [{ kind: 'line', text: 'Builds things at night' }],
      role: 'Engineer', squad: 240, views: 900, pickup: 0.72,
      links: ['whatsapp', 'x', 'website', 'email'], verified: false, region: 'IN',
    },
  },
];

/** Numbers with no identity at all — the third tier of the hierarchy. */
const STRANGERS = [
  { number: '+918471002299', spamScore: 0.86, reports: 1420, category: 'Fraud / KYC',   label: null },
  { number: '+918471884410', spamScore: 0.62, reports: 210,  category: 'Telemarketing', label: null },
  { number: '+912261234567', spamScore: 0.10, reports: 3,    category: null,            label: null },
];

/* ------------------------------------------------------- build the records */

const deviceContacts = [];
const dialrProfiles = [];
const privateData = [];

for (const p of PEOPLE) {
  const id = `dc_${p.key}`;
  const display = [p.first, p.last].filter(Boolean).join(' ');
  const ckey = numberKey(p.number);

  deviceContacts.push({
    id,
    source: 'device',
    displayName: display,
    firstName: p.first,
    lastName: p.last || '',
    org: p.org || null,
    starred: !!p.starred,
    numbers: [
      { id: `${id}_n1`, value: p.number, label: p.business ? 'Work' : 'Mobile', primary: true },
      ...(p.key === 'ma' ? [{ id: `${id}_n2`, value: '+918025559900', label: 'Home', primary: false }] : []),
      ...(p.key === 'priya' ? [{ id: `${id}_n2`, value: '+919845009911', label: 'Work', primary: false }] : []),
    ],
    photoUri: p.photo ? photoStandIn(p.key, p.photoTint) : null,
    identityMark: identityMark(display, p.key),
    updatedAt: NOW - Math.floor(between(1, 200)) * DAY,
  });

  if (p.dialr) {
    dialrProfiles.push({
      uid: `u_${p.key}`,
      handle: p.dialr.handle,
      numberKey: ckey,
      firstName: p.first,
      surname: p.last || '',
      avatarUrl: p.photo ? photoStandIn(p.key, p.photoTint) : null,
      posterUrl: posterStandIn(`${p.key}-poster`, p.photoTint),
      bio: p.dialr.bio,
      role: p.dialr.role,
      squadMembers: p.dialr.squad,
      profileViews: p.dialr.views,
      callPickupRate: p.dialr.pickup,
      links: p.dialr.links,
      verified: p.dialr.verified,
      region: p.dialr.region,
      sign: p.dialr.sign || null,
      visibility: 'everyone',
      updatedAt: NOW - 3 * DAY,
    });
  }

  privateData.push({
    contactKey: ckey,
    label: p.relation || null,
    pronouns: p.pronouns || null,
    note: p.key === 'kabir' ? 'Owes me the drill' : null,
    savedPlace: p.place ? { ...p.place, mapsUri: `geo:0,0?q=${encodeURIComponent(p.place.area)}` } : null,
    ringtoneId: p.key === 'ma' ? 'rt_k31_pulse' : null,
    backgroundId: p.key === 'avni' ? 'wp_deep-green' : null,
    preferredSim: p.key === 'priya' ? 'sim2' : null,
    favourite: !!p.starred,
    vip: !!p.vip,
    trusted: !!p.trusted,
    blocked: false,
  });
}

for (const u of UNSAVED_DIALR) {
  dialrProfiles.push({
    uid: `u_${u.key}`,
    handle: u.dialr.handle,
    numberKey: numberKey(u.number),
    firstName: u.dialr.firstName,
    surname: u.dialr.surname,
    avatarUrl: photoStandIn(u.key, ['#4a4a5a', '#26262f', '#101014']),
    posterUrl: posterStandIn(`${u.key}-poster`),
    bio: u.dialr.bio,
    role: u.dialr.role,
    squadMembers: u.dialr.squad,
    profileViews: u.dialr.views,
    callPickupRate: u.dialr.pickup,
    links: u.dialr.links,
    verified: u.dialr.verified,
    region: u.dialr.region,
    visibility: 'everyone',
    updatedAt: NOW - 11 * DAY,
  });
}

/* --------------------------------------------------------------- call log  */

let seq = 0;
const callLog = [];

function addCall({ number, contactKey, at, disposition, durationSec = 0, note = null, simId = 'sim1', spamScore = 0, extra }) {
  callLog.push({
    id: `cl_${(++seq).toString().padStart(5, '0')}`,
    number,
    contactKey: contactKey ?? numberKey(number),
    startedAt: at,
    disposition,
    durationSec: Math.round(durationSec),
    simId,
    note,
    spamScore,
    viaApp: 'dialr',
    ...extra,
  });
}

/** Move a timestamp to a plausible hour for that relationship. */
function atHour(dayOffset, hour) {
  const d = new Date(NOW - dayOffset * DAY);
  d.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return d.getTime();
}

// --- generated history: 100 days of rhythm per person ----------------------
for (const p of PEOPLE) {
  const r = p.rhythm;
  const days = 100;
  const total = Math.round((r.perWeek * days) / 7);
  for (let i = 0; i < total; i++) {
    // Skew toward recency so the relationship reads as active, not archival.
    const dayOffset = Math.floor(Math.pow(rand(), 1.35) * days) + 2;
    const at = atHour(dayOffset, pick(r.hours));
    const incoming = chance(r.theyStart);
    const answered = chance(r.answered);

    let disposition;
    if (incoming && answered) disposition = 'incoming-answered';
    else if (incoming) disposition = chance(0.7) ? 'incoming-missed' : 'incoming-declined';
    else if (answered) disposition = 'outgoing-answered';
    else disposition = chance(0.75) ? 'outgoing-no-answer' : 'outgoing-busy';

    const durationSec = disposition.endsWith('-answered')
      ? between(r.mins[0], r.mins[1]) * 60
      : 0;

    addCall({
      number: p.number, contactKey: numberKey(p.number), at, disposition, durationSec,
      simId: p.key === 'priya' ? 'sim2' : 'sim1',
    });
  }
}

// --- hand-authored recent window -------------------------------------------
// Everything the top of the Recents list shows is authored, so the demo always
// opens on a legible, story-shaped screen instead of random noise.
const authored = [
  { p: 'avni',   at: NOW - 10 * MIN,               d: 'incoming-answered', dur: 6 * 60,  note: 'Red skirt — Amazon' },
  { p: 'blinkit',at: NOW - 52 * MIN,               d: 'incoming-answered', dur: 44 },
  { p: 'ma',     at: NOW - 2 * HOUR - 12 * MIN,    d: 'outgoing-answered', dur: 9 * 60,  note: 'Sunday lunch, 1pm' },
  { p: 'priya',  at: NOW - 4 * HOUR,               d: 'incoming-missed' },
  { p: 'kabir',  at: NOW - 6 * HOUR - 40 * MIN,    d: 'outgoing-answered', dur: 3 * 60 + 20 },
  { p: 'avni',   at: NOW - 23 * HOUR - 7 * MIN,    d: 'outgoing-no-answer' },
  { p: 'rohan',  at: NOW - 27 * HOUR,              d: 'incoming-answered', dur: 11 * 60, note: 'Bring the hard drive' },
  { p: 'landlord', at: NOW - 30 * HOUR,            d: 'incoming-missed' },
  { p: 'zoya',   at: NOW - 2 * DAY - 3 * HOUR,     d: 'incoming-answered', dur: 38 * 60 },
  { p: 'iyer',   at: NOW - 3 * DAY,                d: 'outgoing-answered', dur: 4 * 60, note: 'Reports on Friday' },
  { p: 'dad',    at: NOW - 3 * DAY - 5 * HOUR,     d: 'incoming-answered', dur: 7 * 60 },
  { p: 'neha',   at: NOW - 5 * DAY,                d: 'outgoing-answered', dur: 26 * 60 },
];
for (const a of authored) {
  const person = PEOPLE.find((x) => x.key === a.p);
  addCall({
    number: person.number, contactKey: numberKey(person.number),
    at: a.at, disposition: a.d, durationSec: a.dur || 0, note: a.note || null,
    simId: person.key === 'priya' ? 'sim2' : 'sim1',
  });
}

// Avni's authored history — the exact screen from the design references.
addCall({ number: PEOPLE[0].number, at: atHour(1, 23), disposition: 'incoming-answered', durationSec: 6 * 60,
          note: 'Book the Manali cab' });
addCall({ number: PEOPLE[0].number, at: atHour(1, 15) + 13 * MIN, disposition: 'outgoing-no-answer' });

// --- unsaved DIALR user ------------------------------------------------------
addCall({ number: UNSAVED_DIALR[0].number, at: NOW - 19 * HOUR, disposition: 'incoming-missed' });
addCall({ number: UNSAVED_DIALR[0].number, at: NOW - 8 * DAY,  disposition: 'incoming-answered', durationSec: 5 * 60 });

// --- strangers & spam --------------------------------------------------------
addCall({ number: STRANGERS[0].number, at: NOW - 78 * MIN, disposition: 'incoming-screened', spamScore: 0.86 });
addCall({ number: STRANGERS[0].number, at: NOW - 84 * MIN, disposition: 'incoming-missed',   spamScore: 0.86 });
addCall({ number: STRANGERS[0].number, at: NOW - 91 * MIN, disposition: 'incoming-missed',   spamScore: 0.86 });
addCall({ number: STRANGERS[0].number, at: NOW - 96 * MIN, disposition: 'incoming-missed',   spamScore: 0.86 });
addCall({ number: STRANGERS[0].number, at: NOW - 99 * MIN, disposition: 'incoming-declined', spamScore: 0.86 });
addCall({ number: STRANGERS[1].number, at: NOW - 2 * DAY - 2 * HOUR, disposition: 'incoming-declined', spamScore: 0.62 });
addCall({ number: STRANGERS[2].number, at: NOW - 4 * DAY, disposition: 'incoming-answered', durationSec: 96 });

callLog.sort((a, b) => b.startedAt - a.startedAt);

/* ------------------------------------------------------------------- spam  */

const spamIntel = {};
for (const s of STRANGERS) {
  spamIntel[numberKey(s.number)] = {
    numberKey: numberKey(s.number),
    score: s.spamScore,
    reports: s.reports,
    category: s.category,
    source: 'dialr-network',
    updatedAt: NOW - 6 * HOUR,
  };
}

/* ------------------------------------------------------------------- self  */

const me = {
  firstName: 'Bwin',
  surname: 'Rai',
  handle: 'bwin',
  numberKey: numberKey('+919810000001'),
  number: '+919810000001',
  avatarUrl: photoStandIn('me', ['#5d5d68', '#2a2a31', '#101013']),
  posterUrl: posterStandIn('me-poster', ['#5d5d68', '#2a2a31', '#101013']),
  bio: [
    { kind: 'line', text: 'Runs on filter coffee' },
    { kind: 'line', text: 'Answers on the first ring', tone: 'accent' },
    { kind: 'trait', text: 'Introvert', tone: 'warn' },
    { kind: 'loves', items: ['Bikes', 'Rain', 'KODE31'] },
  ],
  role: null,
  squadMembers: 148,
  profileViews: 1260,
  callPickupRate: 0.79,
  links: ['whatsapp', 'instagram', 'email', 'website'],
  linkValues: {
    whatsapp: '+919810000001',
    instagram: '@bwin',
    email: 'ohlordbwin@example.com',
    website: 'bwin.rai',
    telegram: '@bwin',
    x: '@bwin',
    snapchat: 'bwinr',
    youtube: '@bwin',
    linkedin: 'in/bwin',
    custom: '',
  },
  verified: false,
  region: 'IN',
  createdAt: NOW - 210 * DAY,
};

/* ------------------------------------------------------------------- SIMs  */

const sims = [
  { id: 'sim1', slot: 1, label: 'Airtel', number: '+919810000001', carrier: 'Airtel', colour: '#e8474b', active: true },
  { id: 'sim2', slot: 2, label: 'Jio',    number: '+919810000002', carrier: 'Jio',    colour: '#1f6fd0', active: true },
];

/* -------------------------------------------------------------- reminders  */

const reminders = [
  { id: 'rm_1', contactKey: numberKey(PEOPLE[6].number), number: PEOPLE[6].number,
    label: 'Call Priya', dueAt: NOW + 26 * MIN, createdAt: NOW - 4 * MIN,
    notifyThem: false, status: 'pending' },
];

/* ------------------------------------------------------------ quick reply  */

const quickReplies = [
  { id: 'qr1', text: "I'll call you back." },
  { id: 'qr2', text: "Can't talk right now." },
  { id: 'qr3', text: "What's up?" },
];

export const mockDb = {
  generatedAt: NOW,
  me,
  deviceContacts,
  dialrProfiles,
  privateData,
  callLog,
  spamIntel,
  sims,
  reminders,
  quickReplies,
  blockedKeys: [],
  strangers: STRANGERS,
};

export default mockDb;
