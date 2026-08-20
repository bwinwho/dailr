/**
 * DIALR — Contacts screen.
 *
 * A real contacts app underneath the styling: sections, sticky letters, a jump
 * index, add/edit/delete. The two DIALR additions are a "pinned / your
 * favourites" row (the same row component as the A-Z list, rendered into its
 * own container so a favourite can appear both pinned and in its normal
 * alphabetical spot) and duplicate-merge suggestions, both optional.
 */
import { h, setText, toggle, reconcile } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Avatar } from '../components/primitives/Avatar.js';
import { EmptyState, PermissionState, Skeleton } from '../components/primitives/States.js';
import { selContactSections, selContactList, selPermissionsOk } from '../state/selectors.js';
import { duplicateSuggestions } from '../state/smart.js';
import { formatNumber } from '../core/format.js';
import haptics from '../core/haptics.js';

export function ContactsScreen({ store, actions }) {
  const title = h('h1.screen__title.t-screen-title', { text: 'Contacts' });
  const countLabel = h('span.contacts__count.t-micro.c-4');
  const addBtn = h('button.contacts__add', {
    type: 'button', aria: { label: 'New contact' }, html: icon('plus'),
    on: { click: () => actions.addContact() },
  });

  const pinnedRow = h('div.contacts__pinned');
  const pinnedList = h('div.contacts__pinned-list');
  const pinnedStore = new Map();
  const dupeSlot = h('div.contacts__dupes');
  const list = h('div.contacts__list');
  const indexRail = h('div.contacts__index');
  const stateSlot = h('div.contacts__state');
  const rowStore = new Map();

  const body = h('div.screen__body', null,
    h('div.screen__inner', null, pinnedRow, dupeSlot, stateSlot, list));

  pinnedRow.append(
    h('div.contacts__pinned-label.t-micro.c-4', { text: 'Pinned / your favourites' }),
    pinnedList);

  const el = h('section.screen.screen--contacts', { id: 'screen-contacts', role: 'tabpanel', aria: { label: 'Contacts' } },
    h('header.screen__header', null,
      h('div.col.g-1', null, title, countLabel),
      addBtn),
    body, indexRail);

  /**
   * Favourited contacts appear here AND again in their normal alphabetical
   * position below — a deliberate duplication (per the reference mockup), so
   * this reconciles into its own container with its own key store rather
   * than reusing `rowStore`/`list`: reconcile() only keeps one DOM node per
   * key, so sharing either with the main list would make the row vanish
   * from whichever section rendered second.
   */
  function renderPinned(state, all) {
    const people = all.filter((v) => v.favourite);
    if (!people.length || state.contactsUi.query) { toggle(pinnedRow, 'is-hidden', true); return; }
    toggle(pinnedRow, 'is-hidden', false);
    reconcile(pinnedList, people.map((v) => ({ id: v.id || v.key, view: v })), {
      key: (r) => r.id,
      store: pinnedStore,
      create: (r) => contactRow(r.view, actions),
    });
  }

  function renderDupes(state) {
    dupeSlot.textContent = '';
    if (!state.settings.smart.duplicateSuggestions || state.contactsUi.query) return;
    const dupes = duplicateSuggestions(state.directory.contacts);
    if (!dupes.length) return;
    const d = dupes[0];
    dupeSlot.appendChild(h('button.contacts__dupe', {
      type: 'button',
      on: { click: () => actions.mergeSuggestion(d) },
    },
    h('span.contacts__dupe-icon', { html: icon('merge') }),
    h('span.col.grow', null,
      h('span.t-body-sm', { text: `${d.contacts.map((c) => c.displayName).join(' and ')} share a number` }),
      h('span.t-caption', { text: 'Tap to review and merge' })),
    h('span', { html: icon('chevronR') })));
  }

  function renderIndex(sections) {
    indexRail.textContent = '';
    if (sections.length < 6) { toggle(indexRail, 'is-hidden', true); return; }
    toggle(indexRail, 'is-hidden', false);
    for (const s of sections) {
      indexRail.appendChild(h('button.contacts__index-letter.t-micro', {
        type: 'button', text: s.letter,
        on: { click: () => {
          haptics.fire('tap');
          list.querySelector(`[data-letter="${s.letter}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } },
      }));
    }
  }

  function update(state) {
    const all = selContactList(state);
    setText(countLabel, `${state.directory.contacts.length} people`);

    if (state.app.permissionsChecked && !selPermissionsOk(state)) {
      stateSlot.textContent = '';
      list.textContent = ''; rowStore.clear();
      toggle(pinnedRow, 'is-hidden', true);
      stateSlot.appendChild(PermissionState({
        title: 'DIALR needs your contacts',
        body: 'So it can show names instead of numbers. Your contacts stay on this phone.',
        actionLabel: 'Allow',
        blocked: Object.values(state.app.permissions).includes('blocked'),
        onAction: () => actions.requestPermissions(),
        onSettings: () => actions.openAppSettings(),
      }).el);
      return;
    }

    if (state.directory.contactsStatus === 'loading' && !state.directory.contacts.length) {
      stateSlot.textContent = '';
      toggle(pinnedRow, 'is-hidden', true);
      stateSlot.appendChild(Skeleton({ variant: 'row', count: 8 }).el);
      return;
    }

    renderPinned(state, all);
    renderDupes(state);

    const sections = selContactSections(state);
    stateSlot.textContent = '';

    if (!all.length) {
      list.textContent = ''; rowStore.clear();
      toggle(indexRail, 'is-hidden', true);
      stateSlot.appendChild(state.contactsUi.query
        ? EmptyState({ iconName: 'search', title: 'No matches', body: `Nothing found for “${state.contactsUi.query}”.` }).el
        : EmptyState({
            iconName: 'people', title: 'No contacts yet',
            body: 'Add someone, or call a number and save it afterwards.',
            actionLabel: 'New contact', onAction: () => actions.addContact(),
          }).el);
      return;
    }

    const rows = [];
    for (const s of sections) {
      rows.push({ kind: 'letter', id: `L_${s.letter}`, letter: s.letter });
      for (const c of s.items) rows.push({ kind: 'contact', id: c.id || c.key, view: c });
    }

    reconcile(list, rows, {
      key: (r) => r.id,
      store: rowStore,
      create: (r) => (r.kind === 'letter'
        ? { el: h('div.contacts__letter.t-micro.c-4', { text: r.letter, dataset: { letter: r.letter } }), update() {}, destroy() {} }
        : contactRow(r.view, actions)),
    });

    renderIndex(sections);
  }

  return {
    el, update,
    destroy() {
      for (const i of rowStore.values()) i.destroy?.();
      for (const i of pinnedStore.values()) i.destroy?.();
    },
  };
}

function contactRow(view, actions) {
  const av = Avatar({ size: 'sm', name: view.displayName, src: view.avatar, ring: view.isDialrUser, variant: 'mono' });
  const sub = [view.label, view.org, formatNumber(view.primaryNumber)].filter(Boolean)[0] || '';

  const callBtn = h('button.crow__call', {
    type: 'button',
    html: icon('phone'),
    aria: { label: `Call ${view.displayName}` },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); actions.call(view.primaryNumber, view.key); } },
  });

  // A <button> containing a real <button> is invalid markup — the previous
  // call action was a <span role="button"> inside .crow, which is why a tap
  // on it could double-fire the row's own click. .crow is a row (role
  // "button" for keyboard/AT users), not a <button> element, so it can hold
  // a genuine nested <button> for the call action.
  const el = h('div.crow', {
    role: 'button', tabindex: '0',
    on: {
      click: (e) => { if (!e.target.closest('button')) actions.openContact(view.key); },
      keydown: (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
          e.preventDefault(); actions.openContact(view.key);
        }
      },
    },
  },
  av.el,
  h('span.col.grow', null,
    h('span.crow__name.t-body', { text: view.displayName }),
    h('span.crow__sub.t-caption', { text: sub })),
  view.favourite ? h('span.crow__star', { html: icon('starFill') }) : null,
  callBtn);

  return {
    el,
    update(next) { av.update({ name: next.view.displayName, src: next.view.avatar }); },
    destroy() { av.destroy(); },
  };
}
