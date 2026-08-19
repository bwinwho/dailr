/**
 * DIALR — mock service implementations.
 *
 * Implements every namespace in src/services/interfaces.js against the seeded
 * database. Deliberately imperfect: latency is simulated, some operations fail,
 * permissions start ungranted. A UI that only ever sees the happy path is a UI
 * with no error states, and the brief asks for all of them.
 */

import bus from '../../core/bus.js';
import { mockDb } from '../../data/mockDb.js';
import { WALLPAPERS, RINGTONES, DTMF, findMedia } from '../../data/media.js';
import { numberKey, normalizeNumber } from '../../core/format.js';
import { createCallEngine } from './callEngine.js';
import * as audio from './audio.js';
import { extractPalette, paletteFromMeta } from '../../theme/palette.js';
import { photoStandIn } from '../../data/avatars.js';

/** Simulated platform latency. Kept small enough not to make the demo annoying. */
const lag = (ms = 90) => new Promise((r) => setTimeout(r, ms + Math.random() * ms));

const EMERGENCY = new Set(['112', '911', '100', '101', '102', '108', '999', '000']);

/* ------------------------------------------------------------- persistence */

const NS = 'dialr:';
const memory = new Map();
const hasLocalStorage = (() => {
  try { const k = `${NS}__t`; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
  catch { return false; }
})();

const storageImpl = {
  async get(key) {
    await lag(10);
    if (!hasLocalStorage) return memory.has(key) ? memory.get(key) : null;
    const raw = localStorage.getItem(NS + key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  },
  async set(key, value) {
    await lag(10);
    if (!hasLocalStorage) { memory.set(key, value); return; }
    try { localStorage.setItem(NS + key, JSON.stringify(value)); }
    catch (err) { console.warn('[storage] quota or serialisation failure', err); memory.set(key, value); }
  },
  async remove(key) {
    if (!hasLocalStorage) { memory.delete(key); return; }
    localStorage.removeItem(NS + key);
  },
  async keys() {
    if (!hasLocalStorage) return [...memory.keys()];
    return Object.keys(localStorage).filter((k) => k.startsWith(NS)).map((k) => k.slice(NS.length));
  },
};

/* ------------------------------------------------------------------ build  */

export function createMockServices() {
  // Working copies so the demo can mutate without corrupting the seed.
  const contacts = mockDb.deviceContacts.map((c) => ({ ...c, numbers: c.numbers.map((n) => ({ ...n })) }));
  const log = mockDb.callLog.map((e) => ({ ...e }));
  const priv = mockDb.privateData.map((p) => ({ ...p }));
  const profiles = mockDb.dialrProfiles.map((p) => ({ ...p }));
  const spamIntel = { ...mockDb.spamIntel };
  let me = { ...mockDb.me };
  let reminders = mockDb.reminders.map((r) => ({ ...r }));
  let blocked = new Set(mockDb.blockedKeys);
  let rules = [{ id: 'r_default', kind: 'prefix', value: '140', label: 'Telemarketing prefix', enabled: true }];
  let defaultSim = 'ask';
  let permissionState = null;      // null until first status() call
  let logSeq = log.length + 1;

  /* ------------------------------------------------------------ call log -- */

  function appendLog(entry) {
    const row = {
      id: `cl_live_${logSeq++}`,
      number: entry.number,
      contactKey: entry.contactKey || numberKey(entry.number),
      startedAt: entry.startedAt,
      durationSec: entry.durationSec || 0,
      simId: entry.simId || 'sim1',
      disposition: entry.disposition,
      note: null,
      spamScore: spamIntel[numberKey(entry.number)]?.score || 0,
      viaApp: 'dialr',
    };
    log.unshift(row);
    bus.emit('callLog.changed', { added: [row] });
    return row;
  }

  /* --------------------------------------------------------------- calls -- */

  const engine = createCallEngine({
    numberKey,
    isEmergency: (n) => EMERGENCY.has(normalizeNumber(n)),
    onLog: appendLog,
  });

  const calls = {
    async place(number, opts = {}) {
      await lag(60);
      const key = numberKey(number);
      if (blocked.has(key)) {
        const err = Object.assign(new Error('Number is blocked'), { code: 'BLOCKED' });
        throw err;
      }
      if (!normalizeNumber(number)) {
        throw Object.assign(new Error('Not a dialable number'), { code: 'INVALID_NUMBER' });
      }
      return engine.place(number, opts);
    },
    answer: (id) => engine.answer(id),
    reject: (id, opts) => engine.reject(id, opts),
    hangup: (id) => engine.hangup(id),
    setHold: (id, held) => engine.setHold(id, held),
    setMute: (m) => engine.setMute(m),
    setAudioRoute: (r) => engine.setAudioRoute(r),
    async audioDevices() {
      return [
        { id: 'earpiece',  label: 'Phone',     kind: 'earpiece',  connected: true },
        { id: 'speaker',   label: 'Speaker',   kind: 'speaker',   connected: true },
        { id: 'bluetooth', label: 'Buds Pro',  kind: 'bluetooth', connected: true },
      ];
    },
    async sendDtmf(digit) { audio.playDtmf(DTMF[digit], { gain: 0.05 }); },
    addCall: (number) => engine.place(number, {}),
    swap: () => engine.swap(),
    merge: () => engine.merge(),
    separate: (id) => engine.separate(id),
    async snapshot() { return engine.snapshot(); },
    // demo-harness only — never part of the real interface
    __simulateIncoming: (number, opts) => engine.simulateIncoming(number, opts),
    __reset: () => engine.reset(),
  };

  /* ------------------------------------------------------------ contacts -- */

  const contactsSvc = {
    async list() { await lag(120); return contacts.map(clone); },
    async get(id) { await lag(40); return clone(contacts.find((c) => c.id === id)) || null; },
    async create(draft) {
      await lag(160);
      const id = `dc_new_${Date.now()}`;
      const first = draft.firstName || (draft.displayName || '').split(' ')[0] || '';
      const last = draft.lastName ?? (draft.displayName || '').split(' ').slice(1).join(' ');
      const row = {
        id, source: 'device',
        displayName: draft.displayName || [first, last].filter(Boolean).join(' '),
        firstName: first, lastName: last,
        org: draft.org || null, starred: !!draft.starred,
        numbers: (draft.numbers || []).map((n, i) => ({ id: `${id}_n${i}`, primary: i === 0, label: n.label || 'Mobile', value: n.value })),
        photoUri: draft.photoUri || null,
        identityMark: null,
        updatedAt: Date.now(),
      };
      contacts.unshift(row);
      bus.emit('contacts.changed', { added: [row] });
      return clone(row);
    },
    async update(id, p) {
      await lag(120);
      const c = contacts.find((x) => x.id === id);
      if (!c) throw Object.assign(new Error('No such contact'), { code: 'NOT_FOUND' });
      Object.assign(c, p, { updatedAt: Date.now() });
      if (p.firstName || p.lastName !== undefined) {
        c.displayName = [c.firstName, c.lastName].filter(Boolean).join(' ');
      }
      bus.emit('contacts.changed', { updated: [c] });
      return clone(c);
    },
    async remove(id) {
      await lag(120);
      const i = contacts.findIndex((c) => c.id === id);
      if (i >= 0) { const [c] = contacts.splice(i, 1); bus.emit('contacts.changed', { removed: [c] }); }
    },
    async search(q) {
      await lag(30);
      const s = q.trim().toLowerCase();
      if (!s) return [];
      return contacts.filter((c) =>
        c.displayName.toLowerCase().includes(s) ||
        c.numbers.some((n) => n.value.includes(s))).map(clone);
    },
    async openSystemEditor() { bus.emit('toast', { text: 'System contact editor is a native action.' }); },
    async merge(ids) {
      await lag(200);
      const keep = contacts.find((c) => c.id === ids[0]);
      for (const id of ids.slice(1)) {
        const other = contacts.find((c) => c.id === id);
        if (!other) continue;
        keep.numbers.push(...other.numbers.filter((n) => !keep.numbers.some((k) => numberKey(k.value) === numberKey(n.value))));
        contacts.splice(contacts.indexOf(other), 1);
      }
      bus.emit('contacts.changed', { updated: [keep] });
      return clone(keep);
    },
    // private relationship data lives beside contacts but is a separate store
    async privateData() { await lag(20); return priv.map(clone); },
    async setPrivate(contactKey, patch) {
      let row = priv.find((p) => p.contactKey === contactKey);
      if (!row) { row = { contactKey }; priv.push(row); }
      Object.assign(row, patch);
      bus.emit('private.changed', { contactKey, patch });
      return clone(row);
    },
  };

  /* ------------------------------------------------------------- callLog -- */

  const callLogSvc = {
    async list({ limit = 400, before, contactKey } = {}) {
      await lag(90);
      let rows = log;
      if (contactKey) rows = rows.filter((r) => r.contactKey === contactKey);
      if (before) rows = rows.filter((r) => r.startedAt < before);
      return rows.slice(0, limit).map(clone);
    },
    async remove(ids) {
      await lag(60);
      const set = new Set(ids);
      for (let i = log.length - 1; i >= 0; i--) if (set.has(log[i].id)) log.splice(i, 1);
      bus.emit('callLog.changed', { removed: ids });
    },
    async clearForContact(key) {
      await lag(80);
      for (let i = log.length - 1; i >= 0; i--) if (log[i].contactKey === key) log.splice(i, 1);
      bus.emit('callLog.changed', { clearedFor: key });
    },
    async clearAll() { await lag(120); log.length = 0; bus.emit('callLog.changed', { clearedAll: true }); },
    async setNote(id, note) {
      const row = log.find((r) => r.id === id);
      if (!row) throw Object.assign(new Error('No such call'), { code: 'NOT_FOUND' });
      row.note = note;
      bus.emit('callLog.changed', { updated: [row] });
    },
  };

  /* ----------------------------------------------------------------- sim -- */

  const simSvc = {
    async list() { await lag(30); return mockDb.sims.map(clone); },
    async getDefault() { return defaultSim; },
    async setDefault(id) { defaultSim = id; bus.emit('sim.changed', { defaultSim: id }); },
  };

  /* --------------------------------------------------------- permissions -- */

  const permissionsSvc = {
    async status() {
      await lag(40);
      if (!permissionState) {
        permissionState = {
          'android.permission.READ_CONTACTS': 'denied',
          'android.permission.WRITE_CONTACTS': 'denied',
          'android.permission.READ_CALL_LOG': 'denied',
          'android.permission.WRITE_CALL_LOG': 'denied',
          'android.permission.READ_PHONE_STATE': 'denied',
          'android.permission.CALL_PHONE': 'denied',
          'android.permission.ANSWER_PHONE_CALLS': 'denied',
          'android.permission.POST_NOTIFICATIONS': 'denied',
        };
      }
      return { ...permissionState };
    },
    async request(names) {
      await lag(400);
      await permissionsSvc.status();
      for (const n of names) permissionState[n] = 'granted';
      bus.emit('permissions.changed', { ...permissionState });
      return { ...permissionState };
    },
    async openAppSettings() { bus.emit('toast', { text: 'Opens Android app settings on device.' }); },
    __denyAll() {
      permissionState = Object.fromEntries(Object.keys(permissionState || {}).map((k) => [k, 'blocked']));
      bus.emit('permissions.changed', { ...permissionState });
    },
  };

  /* ------------------------------------------------------- notifications -- */

  const notificationsSvc = {
    async post(spec) { bus.emit('notification.posted', spec); },
    async cancel(id) { bus.emit('notification.cancelled', { id }); },
    async canPost() { return (await permissionsSvc.status())['android.permission.POST_NOTIFICATIONS'] === 'granted'; },
  };

  /* --------------------------------------------------------------- media -- */

  let previewStop = null;
  const mediaSvc = {
    async catalogue() { return { wallpapers: WALLPAPERS.map(clone), ringtones: RINGTONES.map(clone) }; },
    async pick({ kind = 'image' } = {}) {
      // A real picker returns a content:// URI. The demo fabricates a plausible
      // user asset so the "your media" path is fully walkable.
      await lag(500);
      if (Math.random() < 0.06) throw Object.assign(new Error('Picker cancelled'), { code: 'CANCELLED' });
      const seed = `user-${Date.now()}`;
      const url = photoStandIn(seed, null, 720, 1280);
      return {
        id: `wp_user_${Date.now()}`,
        type: kind === 'video' ? 'video' : 'image',
        source: 'user',
        category: 'wallpaper',
        pack: 'user',
        name: kind === 'video' ? 'Your video' : 'Your image',
        url, thumbnail: url,
        dimensions: { w: 720, h: 1280 },
        duration: kind === 'video' ? 6.4 : null,
        bytes: kind === 'video' ? 4_200_000 : 380_000,
        owner: 'me',
        palette: null,
        metadata: { removable: true, raw: true },
      };
    },
    async prepare(asset, budget = {}) {
      // Native does the real crop/transcode. Here we validate against the same
      // budget the Kotlin layer must enforce, so the UI's failure paths are real.
      await lag(700);
      const maxBytes = budget.maxBytes ?? (asset.type === 'video' ? 12_000_000 : 2_500_000);
      if (asset.bytes && asset.bytes > maxBytes * 4) {
        throw Object.assign(new Error('File is too large to use as a background'), { code: 'MEDIA_TOO_LARGE' });
      }
      if (asset.type === 'video' && asset.duration > (budget.maxSeconds ?? 15)) {
        throw Object.assign(new Error('Video is longer than 15 seconds'), { code: 'MEDIA_TOO_LONG' });
      }
      return { ...asset, metadata: { ...asset.metadata, raw: false, prepared: true } };
    },
    async upload(asset) {
      await lag(900);
      if (!navigator.onLine) throw Object.assign(new Error('No connection'), { code: 'OFFLINE' });
      return { ...asset, source: 'cloudinary', metadata: { ...asset.metadata, remoteId: `cld_${Date.now()}` } };
    },
    async remove() { await lag(80); },
    async playPreview(ringtoneId) {
      const rt = findMedia(ringtoneId) || RINGTONES.find((r) => r.id === ringtoneId);
      previewStop?.();
      if (!rt?.metadata?.synth) return;
      previewStop = audio.playSynth(rt.metadata.synth, { loop: true, maxMs: 4200 });
    },
    async stopPreview() { previewStop?.(); previewStop = null; audio.stop(); },
    async palette(src) {
      const builtin = WALLPAPERS.find((w) => w.url === src);
      if (builtin) return paletteFromMeta(builtin.palette);
      try { return await extractPalette(src); }
      catch { return paletteFromMeta({}); }
    },
  };

  /* ------------------------------------------------------------- profile -- */

  const profileSvc = {
    async me() { await lag(60); return clone(me); },
    async updateMe(patch) {
      await lag(220);
      if (!navigator.onLine) throw Object.assign(new Error('Profile changes need a connection'), { code: 'OFFLINE' });
      me = { ...me, ...patch };
      bus.emit('profile.updated', clone(me));
      return clone(me);
    },
    async lookup(keys) {
      await lag(240);
      if (!navigator.onLine) throw Object.assign(new Error('offline'), { code: 'OFFLINE' });
      const out = {};
      for (const k of keys) {
        const p = profiles.find((x) => x.numberKey === k);
        if (p) out[k] = clone(p);
      }
      return out;
    },
    async recordView() { await lag(20); },
    async addToSquad() { await lag(200); },
  };

  /* ---------------------------------------------------------------- spam -- */

  const spamSvc = {
    async lookup(keys) {
      await lag(70);
      const out = {};
      for (const k of keys) {
        const intel = spamIntel[k];
        out[k] = {
          numberKey: k,
          score: blocked.has(k) ? 1 : intel?.score ?? 0,
          reports: intel?.reports ?? 0,
          category: intel?.category ?? null,
          blocked: blocked.has(k),
          trusted: priv.find((p) => p.contactKey === k)?.trusted ?? false,
          source: intel ? 'dialr-network' : 'none',
        };
      }
      return out;
    },
    async report(number, category) {
      const k = numberKey(number);
      spamIntel[k] = { numberKey: k, score: Math.min(1, (spamIntel[k]?.score ?? 0.4) + 0.3),
                       reports: (spamIntel[k]?.reports ?? 0) + 1, category, source: 'you', updatedAt: Date.now() };
      bus.emit('spam.updated', { numberKey: k });
    },
    async markNotSpam(number) {
      const k = numberKey(number);
      if (spamIntel[k]) spamIntel[k] = { ...spamIntel[k], score: 0, category: null, source: 'you-cleared' };
      bus.emit('spam.updated', { numberKey: k });
    },
    async block(number) { blocked.add(numberKey(number)); bus.emit('spam.updated', { numberKey: numberKey(number) }); },
    async unblock(number) { blocked.delete(numberKey(number)); bus.emit('spam.updated', { numberKey: numberKey(number) }); },
    async blockedList() { return [...blocked]; },
    async rules() { return rules.map(clone); },
    async addRule(rule) { rules.push({ ...rule, id: `r_${Date.now()}` }); bus.emit('spam.updated', {}); },
    async removeRule(id) { rules = rules.filter((r) => r.id !== id); bus.emit('spam.updated', {}); },
  };

  /* ----------------------------------------------------------- reminders -- */

  const reminderSvc = {
    async list() { await lag(30); return reminders.map(clone); },
    async create(spec) {
      await lag(80);
      const r = {
        id: `rm_${Date.now()}`,
        number: spec.number,
        contactKey: numberKey(spec.number),
        label: spec.label,
        dueAt: spec.dueAt,
        createdAt: Date.now(),
        notifyThem: !!spec.notifyThem,
        channel: spec.channel || null,
        status: 'pending',
      };
      reminders.push(r);
      bus.emit('reminder.changed', { added: r });
      // Local alarm on device; a timer here.
      const delay = Math.max(0, r.dueAt - Date.now());
      if (delay < 60 * 60 * 1000) {
        setTimeout(() => {
          const live = reminders.find((x) => x.id === r.id && x.status === 'pending');
          if (live) { live.status = 'due'; bus.emit('reminder.due', clone(live)); }
        }, delay);
      }
      return clone(r);
    },
    async cancel(id) { reminders = reminders.filter((r) => r.id !== id); bus.emit('reminder.changed', { removed: id }); },
    async complete(id) {
      const r = reminders.find((x) => x.id === id);
      if (r) r.status = 'done';
      bus.emit('reminder.changed', { completed: id });
    },
  };

  /* ---------------------------------------------------------- telephony -- */

  const telephonySvc = {
    async isDefaultDialer() { return (await storageImpl.get('isDefaultDialer')) ?? false; },
    async requestDefaultDialer() { await lag(500); await storageImpl.set('isDefaultDialer', true); return true; },
    async deviceInfo() { return { region: 'IN', hasTelephony: true, model: 'Demo WebView', apiLevel: 0 }; },
    async isEmergencyNumber(n) { return EMERGENCY.has(normalizeNumber(n)); },
  };

  return {
    calls, contacts: contactsSvc, callLog: callLogSvc, sim: simSvc,
    permissions: permissionsSvc, notifications: notificationsSvc, media: mediaSvc,
    profile: profileSvc, storage: storageImpl, spam: spamSvc,
    reminders: reminderSvc, telephony: telephonySvc,
    __audio: audio,
  };
}

const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
