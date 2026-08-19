/**
 * DIALR — SettingsPanel.
 *
 * Renders entirely from src/state/settingsSchema.js. Adding a setting means
 * adding one object to that array; this file never changes.
 *
 * Three layers of progressive disclosure keep 112 controls from feeling like
 * 112 controls:
 *
 *   1. A sectioned index — you pick a topic before you see any switches.
 *   2. Inside a section, tier-1 fields show; tier-2 hide behind "More".
 *   3. Search cuts through all of it, matching labels, hints and synonyms.
 *
 * `visibleWhen` predicates mean dependent settings simply are not there until
 * they are relevant, rather than sitting greyed out and confusing people.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import {
  SECTIONS, FIELDS, fieldsBySection, searchFields, getPath,
} from '../../state/settingsSchema.js';
import {
  Switch, Segment, Slider, TextField, SelectField, NavField,
  ChipsField, InfoField, ActionField, TimeField,
} from '../primitives/Field.js';
import haptics from '../../core/haptics.js';

export function SettingsPanel({ settings, onSet, onNav, onAction, onSelectOptions }) {
  let props = { settings };
  let view = { kind: 'index', sectionId: null, query: '' };
  const expandedGroups = new Set();

  const titleEl = h('h2.settings__title.t-screen-title');
  const backBtn = h('button.settings__back', {
    type: 'button', aria: { label: 'Back' }, html: icon('back'),
    on: { click: () => { view = { kind: 'index', sectionId: null, query: '' }; searchInput.value = ''; render(); } },
  });

  const searchInput = h('input.settings__search-input', {
    type: 'search', placeholder: 'Search settings', autocomplete: 'off',
    aria: { label: 'Search settings' },
    on: { input: (e) => { view = { kind: e.target.value.trim() ? 'search' : 'index', sectionId: null, query: e.target.value }; render(); } },
  });

  const body = h('div.settings__body.scroll');

  const el = h('div.settings', null,
    h('header.settings__head', null, backBtn, titleEl),
    h('div.settings__search', null, h('span.settings__search-icon', { html: icon('search') }), searchInput),
    body);

  /* --------------------------------------------------------- field render */

  function renderField(field) {
    const value = getPath(props.settings, field.id);
    const set = (v) => { haptics.fire('toggle'); onSet?.(field.id, v); };

    switch (field.type) {
      case 'toggle':
        return Switch({ label: field.label, hint: field.hint, value, onChange: set }).el;

      case 'segment':
        return Segment({ label: field.label, hint: field.hint, value, options: field.options, onChange: set }).el;

      case 'slider':
        return Slider({
          label: field.label, hint: field.hint, value,
          min: field.min, max: field.max, step: field.step,
          unit: field.unit, format: field.format, onChange: set,
        }).el;

      case 'text':
        return TextField({
          label: field.label, hint: field.hint, value, maxLength: field.maxLength,
          counter: !!field.maxLength, onChange: set,
        }).el;

      case 'select':
        return SelectField({
          label: field.label, hint: field.hint, value, options: field.options,
          onChange: () => onSelectOptions?.(field, value, set),
        }).el;

      case 'chips':
        return ChipsField({
          label: field.label, hint: field.hint, value, options: field.options,
          unit: field.unit, onChange: set,
        }).el;

      case 'time':
        return TimeField({ label: field.label, hint: field.hint, value, onChange: set }).el;

      case 'nav':
        return NavField({
          label: field.label, hint: field.hint,
          onClick: () => onNav?.(field.target, field),
        }).el;

      case 'action':
        return ActionField({
          label: field.label, hint: field.hint, dangerous: field.dangerous,
          onClick: () => onAction?.(field.action, field),
        }).el;

      case 'info':
      default:
        return InfoField({ label: field.label, hint: field.hint }).el;
    }
  }

  const isVisible = (field) => {
    try { return field.visibleWhen ? !!field.visibleWhen(props.settings) : true; }
    catch { return true; }
  };

  /* ------------------------------------------------------------- surfaces */

  function renderIndex() {
    setText(titleEl, 'Settings');
    toggle(backBtn, 'is-hidden', true);
    body.textContent = '';

    for (const section of SECTIONS) {
      const count = fieldsBySection(section.id).filter(isVisible).length;
      body.appendChild(h('button.settings__section', {
        type: 'button',
        on: { click: () => { view = { kind: 'section', sectionId: section.id, query: '' }; render(); } },
      },
      h('span.settings__section-icon', { html: icon(section.icon) }),
      h('span.col.grow', null,
        h('span.settings__section-title.t-title', { text: section.title }),
        h('span.settings__section-blurb.t-caption', { text: section.blurb })),
      h('span.settings__section-count.t-micro.c-4', { text: String(count) }),
      h('span.settings__chev', { html: icon('chevronR') })));
    }
  }

  function renderSection(sectionId) {
    const section = SECTIONS.find((s) => s.id === sectionId);
    setText(titleEl, section.title);
    toggle(backBtn, 'is-hidden', false);
    body.textContent = '';

    const fields = fieldsBySection(sectionId).filter(isVisible);
    const groups = [];
    for (const f of fields) {
      let g = groups.find((x) => x.name === f.group);
      if (!g) { g = { name: f.group, tier1: [], tier2: [] }; groups.push(g); }
      (f.tier === 2 ? g.tier2 : g.tier1).push(f);
    }

    for (const g of groups) {
      const wrap = h('section.settings__group');
      wrap.appendChild(h('h3.settings__group-title.t-micro.c-4', { text: g.name }));

      const inner = h('div.settings__group-inner');
      for (const f of g.tier1) inner.appendChild(renderField(f));

      if (g.tier2.length) {
        const key = `${sectionId}:${g.name}`;
        const more = h('div.settings__more', { class: expandedGroups.has(key) ? 'is-open' : null });
        for (const f of g.tier2) more.appendChild(renderField(f));

        const toggleBtn = h('button.settings__more-btn.t-label', {
          type: 'button',
          text: expandedGroups.has(key) ? 'Fewer options' : `${g.tier2.length} more`,
          on: {
            click: () => {
              if (expandedGroups.has(key)) expandedGroups.delete(key); else expandedGroups.add(key);
              render();
            },
          },
        });
        inner.appendChild(more);
        inner.appendChild(toggleBtn);
      }

      wrap.appendChild(inner);
      body.appendChild(wrap);
    }
  }

  function renderSearch(query) {
    setText(titleEl, 'Settings');
    toggle(backBtn, 'is-hidden', false);
    body.textContent = '';

    const results = searchFields(query).filter((r) => isVisible(r.field));
    if (!results.length) {
      body.appendChild(h('p.settings__noresults.t-body-sm.c-3', {
        text: `Nothing matches “${query}”.`,
      }));
      return;
    }
    for (const r of results) {
      const wrap = h('section.settings__group');
      wrap.appendChild(h('h3.settings__group-title.t-micro.c-4', { text: `${r.section.title} · ${r.field.group}` }));
      const inner = h('div.settings__group-inner');
      inner.appendChild(renderField(r.field));
      wrap.appendChild(inner);
      body.appendChild(wrap);
    }
  }

  function render() {
    if (view.kind === 'search') renderSearch(view.query);
    else if (view.kind === 'section') renderSection(view.sectionId);
    else renderIndex();
    body.scrollTop = 0;
  }

  render();

  return {
    el,
    update(next = {}) {
      props = { ...props, ...next };
      render();
    },
    openSection(id) { view = { kind: 'section', sectionId: id, query: '' }; render(); },
    destroy() {},
  };
}
