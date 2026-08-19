/**
 * DIALR — native bridge status.
 *
 * Shows, per namespace, whether the running app is talking to Kotlin or to the
 * mock. During Android bring-up this is the fastest way to answer "is my
 * @JavascriptInterface actually wired up?" — and it doubles as living
 * documentation of the integration surface.
 */
import { h, setText } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { dialr } from '../services/index.js';
import bridge from '../services/bridge.js';
import { SERVICE_NAMESPACES } from '../services/interfaces.js';
import bus from '../core/bus.js';

export function BridgeStatus({ store }) {
  const summary = h('div.bridge__summary.t-body-sm');
  const table = h('div.bridge__table');
  const log = h('div.bridge__log.scroll');

  const el = h('div.bridge', null,
    summary,
    h('h3.csheet__group-title.t-micro.c-4', { text: 'Services' }),
    table,
    h('h3.csheet__group-title.t-micro.c-4', { text: 'Recent events' }),
    log);

  const nativeCount = Object.values(dialr.__source).filter((v) => v === 'native').length;
  setText(summary, bridge.isNative()
    ? `Running inside the Android WebView. ${nativeCount} of ${SERVICE_NAMESPACES.length} services are native.`
    : 'Running in a browser. Every service is using the mock implementation, and the whole UI works anyway — that is the point.');

  for (const ns of SERVICE_NAMESPACES) {
    const src = dialr.__source[ns];
    table.appendChild(h('div.bridge__row', { dataset: { src } },
      h('span.bridge__dot'),
      h('span.t-body-sm.grow', { text: `dialr.${ns}` }),
      h('span.t-micro', { text: src === 'native' ? 'Native' : 'Mock' })));
  }

  const entries = [];
  const off = bus.onAny((type, payload) => {
    entries.unshift({ t: Date.now(), type, payload });
    if (entries.length > 40) entries.pop();
    renderLog();
  });

  function renderLog() {
    log.textContent = '';
    if (!entries.length) {
      log.appendChild(h('p.t-caption.c-4', { text: 'Nothing yet. Trigger a call from Demo controls.' }));
      return;
    }
    for (const e of entries) {
      log.appendChild(h('div.bridge__log-row', null,
        h('span.t-micro.c-4.t-num', { text: new Date(e.t).toLocaleTimeString('en-GB', { hour12: false }) }),
        h('span.t-micro', { text: e.type })));
    }
  }
  renderLog();

  return { el, update() {}, destroy() { off(); } };
}
