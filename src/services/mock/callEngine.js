/**
 * DIALR — mock call engine.
 *
 * A faithful-enough model of Android telecom for the UI to be designed and
 * tested against: outgoing calls take time to connect, some are declined, some
 * fail, a second call can arrive mid-conversation, calls can be held, swapped
 * and merged.
 *
 * It emits exactly the events the Kotlin layer must emit
 * (docs/ANDROID_INTEGRATION_MAP.md § Call events), so replacing this file with
 * a real bridge changes nothing above it.
 */

import bus from '../../core/bus.js';

let idSeq = 0;
const timers = new Set();

const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
const clearAllTimers = () => { for (const t of timers) clearTimeout(t); timers.clear(); };

export function createCallEngine({ numberKey, isEmergency = () => false, onLog }) {
  /** @type {CallSession[]} index 0 is always the foreground session */
  let sessions = [];
  let muted = false;
  let audioRoute = 'earpiece';
  let conference = false;

  const snapshot = () => ({
    sessions: sessions.map((s) => ({ ...s })),
    muted, audioRoute, conference,
  });

  const emit = (type, extra = {}) => bus.emit(type, { ...extra, snapshot: snapshot() });

  const find = (id) => sessions.find((s) => s.id === id);
  const foreground = () => sessions[0] || null;

  function newSession(number, direction, simId) {
    return {
      id: `call_${++idSeq}`,
      direction,
      state: direction === 'outgoing' ? 'dialing' : 'ringing',
      number,
      contactKey: numberKey(number),
      simId: simId || 'sim1',
      startedAt: Date.now(),
      connectedAt: null,
      endReason: null,
      emergency: isEmergency(number),
    };
  }

  function endSession(session, reason) {
    session.state = 'ended';
    session.endReason = reason;
    const connected = !!session.connectedAt;
    const durationSec = connected ? Math.round((Date.now() - session.connectedAt) / 1000) : 0;

    sessions = sessions.filter((s) => s.id !== session.id);
    if (!sessions.length) conference = false;
    // Promote whatever was on hold.
    if (sessions.length && sessions[0].state === 'held') sessions[0].state = 'active';

    onLog?.({
      number: session.number,
      contactKey: session.contactKey,
      startedAt: session.startedAt,
      durationSec,
      simId: session.simId,
      disposition: dispositionFor(session, reason, connected),
    });

    emit('call.ended', { callId: session.id, reason, durationSec });
    if (!sessions.length) { muted = false; audioRoute = 'earpiece'; emit('call.idle'); }
  }

  function dispositionFor(session, reason, connected) {
    if (session.direction === 'incoming') {
      if (connected) return 'incoming-answered';
      if (reason === 'declined') return 'incoming-declined';
      if (reason === 'blocked') return 'incoming-blocked';
      if (reason === 'screened') return 'incoming-screened';
      return 'incoming-missed';
    }
    if (connected) return 'outgoing-answered';
    if (reason === 'busy') return 'outgoing-busy';
    if (reason === 'failed') return 'outgoing-failed';
    return 'outgoing-no-answer';
  }

  /* ------------------------------------------------------------ outgoing -- */

  function place(number, { simId, outcome } = {}) {
    if (sessions.length >= 2) {
      return Promise.reject(Object.assign(new Error('Two calls already in progress'), { code: 'CALL_LIMIT' }));
    }
    const s = newSession(number, 'outgoing', simId);
    // A second outgoing call puts the first on hold, exactly like telecom does.
    if (sessions.length) { sessions[0].state = 'held'; sessions.unshift(s); }
    else sessions = [s];

    emit('call.outgoing', { callId: s.id, number });

    later(() => {
      if (!find(s.id)) return;
      s.state = 'connecting';
      emit('call.connecting', { callId: s.id });

      // Outcome is deterministic when the demo harness asks for one.
      const roll = outcome || pickOutcome(number);
      const delay = 900 + Math.random() * 1800;

      later(() => {
        if (!find(s.id)) return;
        if (roll === 'answered') {
          s.state = 'active';
          s.connectedAt = Date.now();
          emit('call.connected', { callId: s.id });
        } else if (roll === 'busy') {
          emit('call.failed', { callId: s.id, reason: 'busy' });
          endSession(s, 'busy');
        } else if (roll === 'failed') {
          emit('call.failed', { callId: s.id, reason: 'network' });
          endSession(s, 'failed');
        } else {
          endSession(s, 'no-answer');
        }
      }, delay);
    }, 500);

    return Promise.resolve({ callId: s.id });
  }

  function pickOutcome() {
    const r = Math.random();
    if (r < 0.78) return 'answered';
    if (r < 0.88) return 'no-answer';
    if (r < 0.96) return 'busy';
    return 'failed';
  }

  /* ------------------------------------------------------------ incoming -- */

  /** Called by the demo harness (and, on device, by the telecom callback). */
  function simulateIncoming(number, { simId = 'sim1', autoMissMs = 26000 } = {}) {
    const s = newSession(number, 'incoming', simId);
    const second = sessions.length > 0;
    if (second) sessions.push(s);            // waiting call goes behind
    else sessions = [s];

    emit(second ? 'call.secondIncoming' : 'call.incoming', { callId: s.id, number });

    later(() => {
      const live = find(s.id);
      if (live && live.state === 'ringing') endSession(live, 'missed');
    }, autoMissMs);

    return s;
  }

  function answer(callId) {
    const s = find(callId) || sessions.find((x) => x.state === 'ringing');
    if (!s) return Promise.reject(new Error('no ringing call'));
    // Answering with another call live puts that one on hold.
    for (const other of sessions) if (other !== s && other.state === 'active') other.state = 'held';
    sessions = [s, ...sessions.filter((x) => x !== s)];
    s.state = 'active';
    s.connectedAt = Date.now();
    emit('call.connected', { callId: s.id });
    return Promise.resolve();
  }

  function reject(callId, { reason = 'declined' } = {}) {
    const s = find(callId) || sessions.find((x) => x.state === 'ringing');
    if (!s) return Promise.resolve();
    endSession(s, reason);
    return Promise.resolve();
  }

  function hangup(callId) {
    const s = callId ? find(callId) : foreground();
    if (!s) return Promise.resolve();
    if (conference) {
      // Ending a conference ends every leg.
      const all = [...sessions];
      conference = false;
      for (const leg of all) endSession(leg, 'local');
      return Promise.resolve();
    }
    endSession(s, 'local');
    return Promise.resolve();
  }

  /* ------------------------------------------------------------- controls -- */

  function setHold(callId, held) {
    const s = callId ? find(callId) : foreground();
    if (!s) return Promise.resolve();
    s.state = held ? 'held' : 'active';
    emit('call.held', { callId: s.id, held });
    return Promise.resolve();
  }

  function setMute(next) { muted = !!next; emit('call.audioChanged', { muted, audioRoute }); return Promise.resolve(); }

  function setAudioRoute(route) { audioRoute = route; emit('call.audioChanged', { muted, audioRoute }); return Promise.resolve(); }

  function swap() {
    if (sessions.length < 2) return Promise.resolve();
    const [a, b] = sessions;
    sessions = [b, a, ...sessions.slice(2)];
    sessions[0].state = 'active';
    sessions[1].state = 'held';
    emit('call.swapped', {});
    return Promise.resolve();
  }

  function merge() {
    if (sessions.length < 2) return Promise.resolve();
    conference = true;
    for (const s of sessions) { s.state = 'active'; if (!s.connectedAt) s.connectedAt = Date.now(); }
    emit('call.merged', {});
    return Promise.resolve();
  }

  function separate(callId) {
    if (!conference) return Promise.resolve();
    conference = false;
    const s = find(callId) || sessions[0];
    sessions = [s, ...sessions.filter((x) => x !== s)];
    sessions.slice(1).forEach((x) => { x.state = 'held'; });
    emit('call.separated', { callId: s.id });
    return Promise.resolve();
  }

  function reset() { clearAllTimers(); sessions = []; muted = false; conference = false; audioRoute = 'earpiece'; emit('call.idle'); }

  return {
    place, answer, reject, hangup, setHold, setMute, setAudioRoute,
    swap, merge, separate, simulateIncoming, snapshot, reset,
    get sessions() { return sessions; },
  };
}
