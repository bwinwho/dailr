/**
 * DIALR — native bridge transport.
 *
 * The single place in the frontend that knows Android exists.
 *
 * WIRE PROTOCOL (see docs/ANDROID_INTEGRATION_MAP.md for the full contract)
 *
 *   JS -> Kotlin   window.DialrNative.invoke(payloadJson)
 *                  payload = { id, ns, method, args }
 *
 *   Kotlin -> JS   window.__dialrResult(id, ok, payloadJson)     // reply
 *                  window.__dialrEvent(type, payloadJson)        // push event
 *
 * Everything is JSON strings, because Android's @JavascriptInterface only
 * marshals primitives reliably across WebView versions.
 *
 * Design decisions worth keeping:
 *
 *   - Per-namespace capability detection. During Kotlin bring-up the native
 *     side can implement `calls` while `profile` is still mocked; the app runs
 *     either way. That is what `capabilities()` is for.
 *   - Every request times out. A dialer that hangs because a bridge call never
 *     returned is worse than one that reports an error.
 *   - Events land on the app bus, not the store. Translating events into state
 *     is the app's job, not the transport's.
 */

import bus from '../core/bus.js';

const DEFAULT_TIMEOUT = 8000;

let nextId = 1;
const pending = new Map();

/** The Kotlin-injected object, if we are running inside the Android WebView. */
function nativeObject() {
  return (typeof window !== 'undefined' && window.DialrNative) || null;
}

export function isNative() { return !!nativeObject(); }

/**
 * Namespaces the native layer claims to implement.
 * Kotlin sets `window.DialrNative.capabilities` to a JSON array string.
 */
export function capabilities() {
  const n = nativeObject();
  if (!n) return [];
  try {
    const raw = typeof n.capabilities === 'function' ? n.capabilities() : n.capabilities;
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/* --------------------------------------------------- native -> JS callbacks */

if (typeof window !== 'undefined') {
  window.__dialrResult = (id, ok, payloadJson) => {
    const entry = pending.get(id);
    if (!entry) return;                       // late reply after timeout — drop
    pending.delete(id);
    clearTimeout(entry.timer);
    let payload = null;
    try { payload = payloadJson ? JSON.parse(payloadJson) : null; } catch { payload = payloadJson; }
    if (ok) entry.resolve(payload);
    else entry.reject(Object.assign(new BridgeError(payload?.message || 'native error'), payload || {}));
  };

  window.__dialrEvent = (type, payloadJson) => {
    let payload = null;
    try { payload = payloadJson ? JSON.parse(payloadJson) : null; } catch { payload = payloadJson; }
    bus.emit(type, payload);
    bus.emit('native:event', { type, payload });
  };
}

export class BridgeError extends Error {
  constructor(message, code = 'BRIDGE_ERROR', detail = null) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Invoke a native method.
 * @returns {Promise<any>} rejects with BridgeError on timeout / native failure
 */
export function invoke(ns, method, args = {}, { timeout = DEFAULT_TIMEOUT } = {}) {
  const n = nativeObject();
  if (!n || typeof n.invoke !== 'function') {
    return Promise.reject(new BridgeError(`no native bridge for ${ns}.${method}`, 'NO_BRIDGE'));
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new BridgeError(`${ns}.${method} timed out after ${timeout}ms`, 'TIMEOUT'));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    try {
      n.invoke(JSON.stringify({ id, ns, method, args }));
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      reject(new BridgeError(err.message || 'invoke threw', 'INVOKE_FAILED'));
    }
  });
}

/** Fire-and-forget: telemetry, haptics, log lines. Never awaited. */
export function notify(ns, method, args = {}) {
  const n = nativeObject();
  if (!n || typeof n.notify !== 'function') return false;
  try { n.notify(JSON.stringify({ ns, method, args })); return true; } catch { return false; }
}

export const bridge = { isNative, capabilities, invoke, notify, BridgeError };
export default bridge;
