/**
 * DIALR — boot.
 *
 * Order matters here:
 *   1  build the shell so nothing renders into a missing root
 *   2  restore settings and theme BEFORE the first paint, so the app never
 *      flashes the default black at someone who chose light mode
 *   3  mount screens and the dock
 *   4  wire platform events to the store
 *   5  load data (which may fail; the UI already has its states for that)
 */
import { buildShell } from './shell.js';
import { store } from '../state/store.js';
import { A } from '../state/actions.js';
import { dialr } from '../services/index.js';
import bus from '../core/bus.js';
import haptics from '../core/haptics.js';
import { createThemeController } from './themeController.js';
import { createActions } from './actions.js';
import { createOverlayHost } from './overlays.js';
import { createCallHost } from './callHost.js';
import { FloatingDock } from '../components/dock/FloatingDock.js';
import { SearchBar } from '../components/dock/SearchBar.js';
import { Toast } from '../components/primitives/Toast.js';
import { selectDockModel } from '../state/dockController.js';
import { DialerScreen } from '../screens/DialerScreen.js';
import { RecentsScreen } from '../screens/RecentsScreen.js';
import { ContactsScreen } from '../screens/ContactsScreen.js';
import { YouScreen } from '../screens/YouScreen.js';
import { OnboardingScreen } from '../screens/OnboardingScreen.js';
import { SearchOverlay } from '../screens/SearchOverlay.js';
import { bindKeyboard } from '../components/dialer/DialPad.js';
import { shouldShowPostCall } from '../components/call/PostCallSheet.js';
import { defaultSettings } from '../state/settingsSchema.js';
import { resolveIdentity, selContactsByKey } from '../state/selectors.js';
import { repeatedCallBurst, inSilentHours } from '../state/smart.js';
import { numberKey, formatNumber } from '../core/format.js';
import { toggle, h } from '../core/dom.js';

const TAB_ORDER = ['dialer', 'recents', 'contacts', 'you'];

export async function boot(root) {
  const shell = buildShell(root);
  const theme = createThemeController({ store, shell });

  /* ---------------------------------------------------- 2. restore state */
  const [savedSettings, savedTheme, onboarded] = await Promise.all([
    dialr.storage.get('settings').catch(() => null),
    dialr.storage.get('theme').catch(() => null),
    dialr.storage.get('onboarded').catch(() => null),
  ]);

  if (savedSettings) {
    // Merge over defaults so a settings file from an older build still boots.
    store.dispatch({ type: A.SETTINGS_LOADED, settings: mergeDeep(defaultSettings(), savedSettings) });
  }
  if (savedTheme?.wallpaperId) {
    store.dispatch({ type: A.THEME_SET, patch: { wallpaperId: savedTheme.wallpaperId } });
  }
  haptics.setEnabled(store.getState().settings.sound.hapticsEnabled);
  theme.sync();

  const actions = createActions({ store, services: dialr, theme });

  /* -------------------------------------------------------- 3. mount UI */
  const screens = {
    dialer: DialerScreen({ store, actions }),
    recents: RecentsScreen({ store, actions }),
    contacts: ContactsScreen({ store, actions }),
    you: YouScreen({ store, actions }),
  };
  for (const id of TAB_ORDER) shell.screens.appendChild(screens[id].el);

  const searchResults = SearchOverlay({ store, actions });
  shell.screens.appendChild(searchResults.el);

  const searchBar = SearchBar({
    onQuery: (q) => store.dispatch({ type: A.SEARCH_QUERY, query: q }),
    onFocus: () => store.dispatch({ type: A.SEARCH_OPEN }),
    onBlur: () => setTimeout(() => {
      // Let a result tap land before the panel closes.
      if (!store.getState().search.query) store.dispatch({ type: A.SEARCH_CLOSE });
    }, 180),
  });

  const dock = FloatingDock({
    onIntent: (intent) => actions.handleDockIntent(intent),
    onNavigate: (tab) => actions.setTab(tab),
  });
  shell.dockRoot.appendChild(dock.el);

  const overlays = createOverlayHost({ mount: shell.sheets, store, actions });
  const callHost = createCallHost({ mount: shell.callLayer, store, actions });

  /* ---- onboarding is a full-screen takeover, mounted only when needed --- */
  let onboardingInst = null;
  if (!onboarded) {
    store.dispatch({ type: A.APP_SET_ONBOARDING, step: 0, data: {} });
  }

  /* ---- measure the bottom interaction zone ------------------------------
     Its height is not a constant: the dialer puts a keypad there, other tabs
     put a search bar, and search can be switched off entirely. Everything that
     must clear it reads --bottom-actual, so nothing hard-codes a guess. */
  const measureBottom = () => {
    const h = shell.bottom.getBoundingClientRect().height;
    const dockH = shell.dockRoot.getBoundingClientRect().height;
    const pad = parseFloat(getComputedStyle(shell.bottom).paddingBottom) || 0;
    shell.app.style.setProperty('--bottom-actual', `${Math.round(h)}px`);
    shell.app.style.setProperty('--bottom-nodock', `${Math.round(dockH + pad)}px`);
  };
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(measureBottom);
    ro.observe(shell.bottom);
    ro.observe(shell.dockRoot);
  }
  window.addEventListener('resize', measureBottom);
  requestAnimationFrame(measureBottom);

  /* ------------------------------------------------ 4. platform wiring  */
  wirePlatformEvents({ store, actions, services: dialr });

  bindKeyboard(document, {
    onDigit: (d) => { if (store.getState().app.tab === 'dialer') actions.dialerAppend(d); },
    onBackspace: () => { if (store.getState().app.tab === 'dialer') actions.dialerBackspace(); },
    onCall: () => {
      const s = store.getState();
      if (s.app.tab === 'dialer' && s.dialer.input) actions.call(s.dialer.input);
    },
  });

  // Escape closes the deepest thing that is open.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const s = store.getState();
    if (s.overlay.stack.length) actions.popOverlay();
    else if (s.search.open) store.dispatch({ type: A.SEARCH_CLOSE });
    else if (s.recents.expandedKey) store.dispatch({ type: A.RECENTS_COLLAPSE });
  });

  // Android back button, when the WebView forwards it as a history entry.
  window.addEventListener('popstate', () => {
    const s = store.getState();
    if (s.overlay.stack.length) { actions.popOverlay(); history.pushState({ dialr: true }, ''); }
  });
  history.pushState({ dialr: true }, '');

  /* --------------------------------------------------------- 5. render */
  const toastInstances = new Map();

  function render(state) {
    /* onboarding takeover */
    if (state.app.onboarding.active) {
      if (!onboardingInst) {
        onboardingInst = OnboardingScreen({ store, actions });
        shell.screens.appendChild(onboardingInst.el);
      }
      toggle(shell.bottom, 'is-hidden', true);
      return;
    }
    if (onboardingInst) {
      onboardingInst.el.remove();
      onboardingInst.destroy?.();
      onboardingInst = null;
      toggle(shell.bottom, 'is-hidden', false);
    }

    /* tabs */
    const activeIndex = TAB_ORDER.indexOf(state.app.tab);
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const id = TAB_ORDER[i];
      const el = screens[id].el;
      toggle(el, 'is-active', i === activeIndex);
      toggle(el, 'is-left', i < activeIndex);
      toggle(el, 'is-right', i > activeIndex);
    }
    screens[state.app.tab].update(state);

    /* Bottom slot, by tab:
         dialer          the keypad — it *is* the search here (T9)
         recents/contacts the search bar
         you             nothing; a profile page has no list to search
       One slot, context-dependent content, so the thumb zone is never wasted. */
    const wantKeypad = state.app.tab === 'dialer';
    const wantSearch = !wantKeypad
      && state.app.tab !== 'you'
      && state.settings.appearance.showSearch;
    const desired = wantKeypad ? screens.dialer.bottom : wantSearch ? searchBar.el : null;
    if (shell.bottomSlot.firstChild !== desired) {
      shell.bottomSlot.textContent = '';
      if (desired) shell.bottomSlot.appendChild(desired);
    }
    searchBar.update({ value: state.search.query });

    /* dock */
    dock.update(selectDockModel(state));
    toggle(shell.app, 'dock-anchored', state.settings.appearance.dockStyle === 'anchored');

    /* scrim: raised for search, and for any overlay that is not full-bleed */
    const scrimOn = state.search.open || state.overlay.stack.length > 0;
    toggle(shell.scrim, 'is-on', scrimOn);
    toggle(shell.scrim, 'is-full', state.overlay.stack.length > 0);

    measureBottom();
    searchResults.update(state);
    overlays.render(state);
    callHost.render(state);
    renderToasts(state);
  }

  function renderToasts(state) {
    const want = new Set(state.toasts.map((t) => t.id));
    for (const [id, inst] of toastInstances) {
      if (!want.has(id)) { inst.dismiss(); toastInstances.delete(id); }
    }
    for (const t of state.toasts) {
      if (toastInstances.has(t.id)) continue;
      const inst = Toast({
        ...t,
        onDismiss: () => { store.dispatch({ type: A.TOAST_DISMISS, id: t.id }); toastInstances.delete(t.id); },
      });
      shell.toasts.appendChild(inst.el);
      inst.show();
      toastInstances.set(t.id, inst);
    }
  }

  store.subscribe(render);
  render(store.getState());

  /* --------------------------------------------------------- 6. data */
  const permissions = await dialr.permissions.status().catch(() => ({}));
  store.dispatch({ type: A.APP_SET_PERMISSIONS, permissions });
  await actions.refreshAll();

  const isDefault = await dialr.telephony.isDefaultDialer().catch(() => false);
  store.dispatch({ type: A.APP_SET_DEFAULT_DIALER, isDefault });

  return { store, actions, theme, services: dialr };
}

/* ------------------------------------------------------------ platform -- */

function wirePlatformEvents({ store, actions, services }) {
  const snapshot = (payload) => {
    if (payload?.snapshot) store.dispatch({ type: A.CALL_SNAPSHOT, snapshot: payload.snapshot });
  };

  for (const type of ['call.incoming', 'call.secondIncoming', 'call.outgoing', 'call.connecting',
                      'call.connected', 'call.held', 'call.audioChanged', 'call.swapped',
                      'call.merged', 'call.separated', 'call.idle']) {
    bus.on(type, snapshot);
  }

  bus.on('call.incoming', (p) => {
    haptics.fire('incoming');
    maybeRepeatPrompt(store, actions, p?.number);
    maybeSilentHours(store, actions, p);
  });

  bus.on('call.connected', () => {
    if (store.getState().settings.calling.vibrateOnAnswer) haptics.fire('answer');
  });

  bus.on('call.ended', async (payload) => {
    snapshot(payload);
    if (store.getState().settings.calling.vibrateOnEnd) haptics.fire('hangup');

    // The log row is written by the engine; pull it back and offer follow-ups.
    await actions.refreshCallLog();
    const state = store.getState();
    const entry = state.directory.callLog[0];
    if (!entry) return;

    const identity = resolveIdentity(state, entry.number, { allowLookup: state.settings.identity.lookupUnknown });
    const summary = {
      number: entry.number,
      contactKey: entry.contactKey,
      name: identity.name,
      avatar: identity.hasPhoto ? identity.avatar : null,
      view: identity.view,
      tier: identity.tier,
      disposition: entry.disposition,
      durationSec: entry.durationSec,
      note: state.call.noteDraft || null,
      callLogId: entry.id,
    };

    if (summary.note) services.callLog.setNote(entry.id, summary.note).catch(() => {});

    if (shouldShowPostCall(summary, state.settings)) {
      store.dispatch({ type: A.CALL_SET_POSTCALL, postCall: summary });
      const ms = state.settings.calling.postCallSeconds * 1000;
      setTimeout(() => {
        const s = store.getState();
        if (s.call.postCall?.callLogId === entry.id) store.dispatch({ type: A.CALL_CLEAR_POSTCALL });
      }, ms);
    }
  });

  bus.on('call.failed', (p) => {
    const reason = p?.reason === 'busy' ? 'Line was busy'
      : p?.reason === 'network' ? 'Call failed — no network'
      : 'Call failed';
    actions.toast({ text: reason, tone: 'warn', iconName: 'warn' });
  });

  bus.on('callLog.changed', () => actions.refreshCallLog());
  bus.on('contacts.changed', () => actions.refreshContacts());
  bus.on('permissions.changed', (p) => store.dispatch({ type: A.APP_SET_PERMISSIONS, permissions: p }));
  bus.on('spam.updated', () => {
    const keys = [...new Set(store.getState().directory.callLog.map((e) => e.contactKey))];
    actions.refreshSpam(keys);
  });

  bus.on('reminder.due', (r) => {
    store.dispatch({ type: A.REMINDER_UPSERT, reminder: { ...r, status: 'due' } });
    actions.toast({
      text: r.label, iconName: 'bell', duration: 12000,
      actionLabel: 'Call now',
      onAction: () => { actions.call(r.number, r.contactKey); services.reminders.complete(r.id); },
    });
    haptics.fire('warn');
  });

  bus.on('toast', (spec) => actions.toast(spec));

  window.addEventListener('online', () => { store.dispatch({ type: A.APP_SET_ONLINE, online: true }); actions.refreshAll(); });
  window.addEventListener('offline', () => store.dispatch({ type: A.APP_SET_ONLINE, online: false }));
}

/** "Someone has called five times in fifteen minutes" — offer a way out. */
function maybeRepeatPrompt(store, actions, number) {
  const s = store.getState();
  if (!number || !s.settings.protection.repeatDetection) return;
  const key = numberKey(number);
  if (selContactsByKey(s).get(key)) return;             // known people are not "repeat callers"
  const entries = s.directory.callLog.filter((e) => e.contactKey === key);
  const burst = repeatedCallBurst(entries, {
    count: s.settings.protection.repeatCount,
    windowMin: s.settings.protection.repeatWindow,
  });
  if (burst) actions.pushOverlay('repeat-caller', { number, burst });
}

/** Silent hours only ever *silences*; it never blocks and never hides. */
function maybeSilentHours(store, actions, payload) {
  const s = store.getState();
  if (!s.settings.smart.silentHours) return;
  if (!inSilentHours(s.settings.smart.silentFrom, s.settings.smart.silentTo)) return;
  const key = numberKey(payload?.number || '');
  if (selContactsByKey(s).get(key)) return;             // contacts always ring
  actions.toast({ text: 'Silenced — unknown number during your quiet hours', iconName: 'micOff' });
}

/* ------------------------------------------------------------- helpers -- */

function mergeDeep(base, patch) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k in patch) {
    const v = patch[k];
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object')
      ? mergeDeep(base[k], v)
      : v;
  }
  return out;
}
