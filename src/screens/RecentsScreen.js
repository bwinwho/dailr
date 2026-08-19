/**
 * DIALR — Recents screen.
 *
 * A stack of expandable cards, not a call log. Filters are chips rather than a
 * menu because there are only four and they answer real questions:
 * everything / what did I miss / who am I supposed to call back / what was junk.
 */
import { h, setText, toggle, reconcile } from '../core/dom.js';
import { RecentCard } from '../components/recents/RecentCard.js';
import { EmptyState, PermissionState, Skeleton, Banner } from '../components/primitives/States.js';
import { selRecents, selRecentCounts, selPermissionsOk } from '../state/selectors.js';

const FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'missed', label: 'Missed' },
  { id: 'owed',   label: 'To return' },
  { id: 'spam',   label: 'Filtered' },
];

export function RecentsScreen({ store, actions }) {
  const title = h('h1.screen__title.t-screen-title', { text: 'Recents' });
  const filterRow = h('div.recents__filters');
  const list = h('div.recents__list');
  const cardStore = new Map();
  const stateSlot = h('div.recents__state');
  const bannerSlot = h('div.recents__banner');

  const body = h('div.screen__body', null,
    h('div.screen__inner', null, bannerSlot, stateSlot, list));

  const el = h('section.screen.screen--recents', { id: 'screen-recents', role: 'tabpanel', aria: { label: 'Recents' } },
    h('header.screen__header', null,
      h('div.col.g-3', null, title, filterRow)),
    body);

  function renderFilters(state) {
    const counts = selRecentCounts(state);
    filterRow.textContent = '';
    for (const f of FILTERS) {
      const n = counts[f.id];
      if (f.id !== 'all' && !n) continue;          // never show an empty filter
      filterRow.appendChild(h('button.chip.chip--neutral.recents__filter', {
        type: 'button',
        dataset: { selected: String(state.recents.filter === f.id) },
        aria: { pressed: String(state.recents.filter === f.id) },
        on: { click: () => actions.setRecentsFilter(f.id) },
      },
      h('span.chip__label', { text: f.label }),
      n ? h('span.chip__count.t-num', { text: String(n) }) : null));
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
          onSwipe: (kind, r) => (kind === 'call' ? actions.call(r.entry.number, r.key) : actions.recentAction('text', r)),
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

  return { el, update, destroy() { for (const i of cardStore.values()) i.destroy?.(); } };
}

function emptyFor(filter, actions) {
  switch (filter) {
    case 'missed':
      return EmptyState({ iconName: 'phoneMissed', title: 'Nothing missed', body: 'You are all caught up.' });
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
