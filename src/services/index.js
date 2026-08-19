/**
 * DIALR — service resolution.
 *
 * Builds the `dialr` object the whole app talks to. Every namespace is resolved
 * independently:
 *
 *     native implements it   ->  proxy straight through the bridge
 *     it does not            ->  fall back to the mock
 *
 * That per-namespace granularity is a deliberate bring-up affordance: the
 * Kotlin developer can land `calls` and `contacts` first and keep running the
 * real UI with mocked profiles and media, instead of needing all twelve
 * services before anything works.
 *
 * `dialr.__source` reports what resolved to what; the Settings ▸ Developer
 * panel renders it, which makes integration bugs obvious instead of mysterious.
 */

import bridge from './bridge.js';
import { SERVICE_NAMESPACES } from './interfaces.js';
import { createMockServices } from './mock/index.js';

/** Build a namespace object that forwards every call over the bridge. */
function nativeNamespace(ns, methodNames) {
  const out = {};
  for (const m of methodNames) {
    out[m] = (...args) => bridge.invoke(ns, m, argsToPayload(m, args));
  }
  return out;
}

/**
 * Positional args -> a named payload, because a JSON object survives Kotlin
 * data-class deserialisation far better than a positional array.
 */
function argsToPayload(method, args) {
  if (!args.length) return {};
  if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) return args[0];
  return { args };
}

export function createServices({ forceMock = false } = {}) {
  const mock = createMockServices();
  const nativeCaps = forceMock ? [] : bridge.capabilities();
  const source = {};
  const services = {};

  for (const ns of SERVICE_NAMESPACES) {
    const useNative = nativeCaps.includes(ns);
    source[ns] = useNative ? 'native' : 'mock';
    services[ns] = useNative
      ? nativeNamespace(ns, Object.keys(mock[ns]).filter((k) => !k.startsWith('__')))
      : mock[ns];
  }

  services.__source = source;
  services.__isNative = bridge.isNative();
  services.__mock = mock;             // demo harness reaches through this
  return services;
}

/** The app-wide instance. Import this, not createServices. */
export const dialr = createServices();
export default dialr;
