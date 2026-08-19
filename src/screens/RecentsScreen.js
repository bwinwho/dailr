/**
 * DIALR — Recents screen.
 *
 * A stack of expandable cards, not a call log. The filter bar lives in the
 * bottom slot — the thumb zone, where the search bar sits on Contacts — not
 * the header; see src/state/bottomController.js. Only two filters survive
 * (Project Clean Slate): everything / what did I miss. "To return" and
 * "Filtered" are still real states (selRecentCounts, row.owed, spam scoring
 * all still work) — they just aren't surfaced as tappable segments anymore.
 */
import { h, toggle, reconcile } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { RecentCard } from '../components/recents/RecentCard.js';
import { EmptyState, PermissionState, Skeleton, Banner } from '../components/primitives/States.js';
import { selRecents, selPermissionsOk } from '../state/selectors.js';
import { A } from '../state/actions.js';
import haptics from '../core/haptics.js';

const FILTERS = [
  { id: 'all',    icon: 'clock',       label: 'All calls' },
  { id: 'missed', icon: 'phoneMissed', label: 'Missed calls' },
];

export function RecentsScreen({ store, actions }) {
  const title = h('h1.screen__title.t-screen-title', { text: 'Recents' });
  const list = h('div.recents__list.stack');
  const cardStore = new Map();
  const stateSlot = h('div.recents__state');
  const bannerSlot = h('div.recents__banner');

  const body = h('div.screen__body', null,
    h('div.screen__inner', null, bannerSlot, stateSlot, list));

  // Search still reaches Recents-domain data (a call by number, a note by
  // text) — it just doesn't own the bottom slot permanently anymore. This
  // button opens it there; blur/Escape close it and the filter bar returns.
  const searchBtn = h('button.recents__search', {
    type: 'button', aria: { label: 'Search calls' },
    on: { click: () => { haptics.fire('tap'); store.dispatch({ type: A.SEARCH_OPEN }); } },
  }, h('span', { html: icon('search') }));

  const el = h('section.screen.screen--recents', { id: 'screen-recents', role: 'tabpanel', aria: { label: 'Recents' } },
    h('header.screen__header', null, title, searchBtn),
    body);

  /* ---- filter bar: the bottom slot for this tab ---------------------------
     Built ONCE; only state mutates. The previous version rebuilt every
     button on every store change, which is why the row flickered. Both
     segments always render — a disappearing segment would change the slot's
     size and churn --bottom-actual on every filter change. ---------------- */
  const filterBar = h('div.filterbar', { role: 'group', aria: { label: 'Filter calls' } });
  const filterBtns = new Map();
  for (const f of FILTERS) {
    const btn = h('button.filterbar__opt', {
      type: 'button', dataset: { id: f.id },
      aria: { label: f.label, pressed: 'false' },
      on: { click: () => { haptics.fire('select'); actions.setRecentsFilter(f.id); } },
    }, h('span.filterbar__icon', { html: icon(f.icon) }));
    filterBar.appendChild(btn);
    filterBtns.set(f.id, btn);
  }

  function renderFilters(state) {
    for (const f of FILTERS) {
      const btn = filterBtns.get(f.id);
      const on = state.recents.filter === f.id;
      toggle(btn, 'is-on', on);
      btn.setAttribute('aria-pressed', String(on));
    }
  }

  function update(state) {
    renderFilters(state);

    /* ---- banners: offline and degraded services ---- */
    bannerSlot.textContent = '';
    if (!state.app.online && state.settings.identity.dialrEnabled) {
      bannerSlot.appendChild(Banner({
        tone: 'neutral', iconName: 'globe',
        text: 'Offline. Calls and history work as normal; DIALR names and spam checks are paused.',
      }).el);
    }

    /* ---- permission gate ---- */
    if (state.app.permissionsChecked && !selPermissionsOk(state)) {
      list.textContent = '';
      cardStore.clear();
      stateSlot.textContent = '';
      stateSlot.appendChild(PermissionState({
        title: 'DIALR needs your call history',
        body: 'To show who called and when, DIALR reads the call log stored on this phone. It never leaves the device.',
        actionLabel: 'Allow',
        blocked: Object.values(state.app.permissions).includes('blocked'),
        onAction: () => actions.requestPermissions(),
        onSettings: () => actions.openAppSettings(),
      }).el);
      return;
    }

    /* ---- loading ---- */
    if (state.directory.callLogStatus === 'loading' && !state.directory.callLog.length) {
      stateSlot.textContent = '';
      stateSlot.appendChild(Skeleton({ variant: 'card', count: 4 }).el);
      return;
    }

    const rows = selRecents(state);

    stateSlot.textContent = '';
    if (!rows.length) {
      list.textContent = '';
      for (const inst of cardStore.values()) inst.destroy?.();
      cardStore.clear();
      stateSlot.appendChild(emptyFor(state.recents.filter, actions).el);
      return;
    }

    reconcile(list, rows, {
      key: (r) => r.id,
      store: cardStore,
      create: (row) => {
        const card = RecentCard({
          row,
          expanded: state.recents.expandedKey === row.key,
          settings: state.settings,
          onCall: (r) => actions.call(r.entry.number, r.key),
          onExpand: (r) => actions.expandRecent(r.key),
          onAction: (id, r) => actions.recentAction(id, r),
        });
        return {
          el: card.el,
          update: (r) => card.update({
            row: r,
            expanded: store.getState().recents.expandedKey === r.key,
            settings: store.getState().settings,
          }),
          destroy: card.destroy,
        };
      },
    });

    // Reconcile only calls update() on rows it already had; push the expansion
    // state to every live card so collapsing the previous one animates too.
    for (const [key, inst] of cardStore) {
      const row = rows.find((r) => r.id === key);
      if (row) inst.update(row);
    }
  }

  return { el, bottom: filterBar, update, destroy() { for (const i of cardStore.values()) i.destroy?.(); } };
}

function emptyFor(filter, actions) {
  switch (filter) {
    case 'missed':
      return EmptyState({ iconName: 'phoneMissed', title: 'Nothing missed', body: 'You are all caught up.' });
    // 'owed' and 'spam' are no longer reachable from the filter bar (only
    // All/Missed remain), but the states are kept — Settings or a future
    // surface can still land here with those filter ids.
    case 'owed':
      return EmptyState({ iconName: 'return', title: 'No calls to return', body: 'Missed calls you have not called back show up here.' });
    case 'spam':
      return EmptyState({ iconName: 'shield', title: 'Nothing filtered', body: 'Calls DIALR flags as spam will be listed here so you can check them.' });
    default:
      return EmptyState({
        iconName: 'clock', title: 'No calls yet',
        body: 'When you make or receive a call it appears here, written out in plain language.',
        actionLabel: 'Open the keypad', onAction: () => actions.setTab('dialer'),
      });
  }
}
