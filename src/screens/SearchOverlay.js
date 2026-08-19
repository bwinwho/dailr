/**
 * DIALR — search results.
 *
 * Grows upward out of the search bar so the input stays under your thumb and
 * the results appear where your eyes already are. The scrim behind it separates
 * search and dock from the content without hiding it — depth, not a modal.
 */
import { h, setText, toggle } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Avatar } from '../components/primitives/Avatar.js';
import { formatNumber, relativeTime, dayPartTime } from '../core/format.js';
import { selSearchResults } from '../state/selectors.js';
import haptics from '../core/haptics.js';

export function SearchOverlay({ store, actions }) {
  const list = h('div.searchres__list.scroll');
  const empty = h('div.searchres__empty.t-body-sm.c-3');
  const el = h('div.searchres', { role: 'region', aria: { label: 'Search results' } }, list, empty);

  function section(label) {
    return h('div.searchres__section.t-micro.c-4', { text: label });
  }

  function personRow(view) {
    const av = Avatar({ size: 'sm', name: view.displayName, src: view.avatar, ring: view.isDialrUser });
    // .searchres__row is a row (role "button"), not a <button> element, so it
    // can hold a genuine nested <button> for the call action — a <button>
    // inside a <button> is invalid markup and was silently double-firing.
    return h('div.searchres__row', {
      role: 'button', tabindex: '0',
      on: {
        click: (e) => { if (!e.target.closest('button')) actions.openContact(view.key); },
        keydown: (e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
            e.preventDefault(); actions.openContact(view.key);
          }
        },
      },
    }, av.el,
    h('span.col.grow', null,
      h('span.t-body', { text: view.displayName }),
      h('span.t-caption', { text: [view.label, formatNumber(view.primaryNumber)].filter(Boolean).join(' · ') })),
    h('button.searchres__call', {
      type: 'button', aria: { label: `Call ${view.displayName}` },
      html: icon('phone'),
      on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); actions.call(view.primaryNumber, view.key); } },
    }));
  }

  function callRow({ entry, view }) {
    return h('button.searchres__row', {
      type: 'button',
      on: { click: () => actions.openHistory(entry.contactKey, entry.number) },
    },
    h('span.searchres__glyph', { html: icon('clock') }),
    h('span.col.grow', null,
      h('span.t-body', { text: view?.displayName || formatNumber(entry.number) }),
      h('span.t-caption', { text: relativeTime(entry.startedAt) })));
  }

  function noteRow({ entry, view }) {
    return h('button.searchres__row', {
      type: 'button',
      on: { click: () => actions.openHistory(entry.contactKey, entry.number) },
    },
    h('span.searchres__glyph', { html: icon('note') }),
    h('span.col.grow', null,
      h('span.t-body', { text: entry.note }),
      h('span.t-caption', { text: `${view?.displayName || formatNumber(entry.number)} · ${dayPartTime(entry.startedAt)}` })));
  }

  function update(state) {
    const open = state.search.open;
    toggle(el, 'is-open', open);
    if (!open) return;

    const r = selSearchResults(state);
    list.textContent = '';

    if (!state.search.query) {
      setText(empty, 'Search people, numbers, calls and your notes.');
      toggle(empty, 'is-hidden', false);
      return;
    }
    if (r.empty) {
      setText(empty, `Nothing found for “${state.search.query}”.`);
      toggle(empty, 'is-hidden', false);
      return;
    }
    toggle(empty, 'is-hidden', true);

    if (r.people.length) {
      list.appendChild(section('People'));
      for (const p of r.people) list.appendChild(personRow(p));
    }
    if (r.notes.length) {
      list.appendChild(section('Notes'));
      for (const n of r.notes) list.appendChild(noteRow(n));
    }
    if (r.calls.length) {
      list.appendChild(section('Calls'));
      for (const c of r.calls) list.appendChild(callRow(c));
    }
  }

  return { el, update, destroy() {} };
}
