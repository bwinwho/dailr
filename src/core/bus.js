/**
 * DIALR — event bus.
 *
 * The store handles *state*. The bus handles *moments*: "the native layer says
 * a call arrived", "a toast should appear", "haptics should fire". These are
 * one-shot facts with no meaningful "current value", so they do not belong in
 * the store.
 *
 * The native bridge emits onto this bus; app-level listeners translate bus
 * events into store dispatches. That keeps the bridge ignorant of the store.
 */

const channels = new Map();
const anyListeners = new Set();

export function on(type, fn) {
  if (!channels.has(type)) channels.set(type, new Set());
  channels.get(type).add(fn);
  return () => off(type, fn);
}

export function once(type, fn) {
  const un = on(type, (payload) => { un(); fn(payload); });
  return un;
}

export function off(type, fn) {
  channels.get(type)?.delete(fn);
}

export function emit(type, payload) {
  const set = channels.get(type);
  if (set) for (const fn of Array.from(set)) {
    try { fn(payload, type); } catch (err) { console.error(`[bus] ${type} listener failed`, err); }
  }
  for (const fn of Array.from(anyListeners)) {
    try { fn(type, payload); } catch (err) { console.error('[bus] wildcard listener failed', err); }
  }
}

/** Listen to everything — used by the developer event inspector. */
export function onAny(fn) { anyListeners.add(fn); return () => anyListeners.delete(fn); }

export const bus = { on, once, off, emit, onAny };
export default bus;
