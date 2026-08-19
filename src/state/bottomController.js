/**
 * DIALR — bottom-slot controller.
 *
 * Mirrors dockController.js: one function decides which component owns the
 * thumb zone, so that policy lives in exactly one place rather than as a
 * conditional inline in the render loop (src/app/main.js).
 *
 *        state  ->  selectBottomSlot  ->  slot id  ->  main.js maps id to node
 *
 * Slot ids: 'keypad' (Dialer's deck), 'search' (the shared SearchBar),
 * 'recents-filters' (Recents' All/Missed bar), or null (nothing — You has no
 * list to search).
 */
export function selectBottomSlot(state) {
  if (state.app.onboarding.active) return null;
  switch (state.app.tab) {
    case 'dialer':
      return 'keypad';
    case 'recents':
      // Search stays reachable from Recents — it is the only way to find a
      // call by number or a note by text — it just stops owning the slot
      // permanently. A header button opens it; blur/Escape close it and the
      // filter bar returns.
      return state.search.open && state.settings.appearance.showSearch
        ? 'search' : 'recents-filters';
    case 'contacts':
      return state.settings.appearance.showSearch ? 'search' : null;
    default:
      return null;   // 'you' — a profile page has no list to search
  }
}
