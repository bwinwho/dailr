/**
 * DIALR — FloatingDock.
 *
 * A persistent, context-aware interaction surface. Not a tab bar.
 *
 * LAYOUT DECISION (the important one):
 *
 *   The dock has two rows. Navigation lives in the lower row and never leaves.
 *   Context appears in an upper row that grows *upward* out of the dock.
 *
 *        ┌─────────────────────────────┐   ← context row: CALL AVNI
 *        ├─────────────────────────────┤     (or a slim suggestion chip)
 *        │  ▣    ◷    ◔    ◕          │   ← navigation: always present
 *        └─────────────────────────────┘
 *
 *   The obvious alternative — swapping the dock's contents for the CTA — was
 *   rejected: it strands the user in whatever screen they are on, and the brief
 *   is explicit that the dock must remain a reliable anchor. Growing upward
 *   also matches the app's core rule, EXPAND DON'T INTERRUPT, and keeps every
 *   target inside the one-handed zone.
 *
 * The dock renders a DockModel and emits intents. It contains zero knowledge of
 * screens — see src/state/dockController.js for where the model comes from.
 */

import { h, setText, toggle, reflow } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import haptics from '../../core/haptics.js';

export function FloatingDock({ onIntent, onNavigate }) {
  let model = null;

  /* ---- context row ---- */
  const ctaIcon = h('span.dock__cta-icon');
  const ctaLabel = h('span.dock__cta-label');
  const ctaSub = h('span.dock__cta-sub.t-micro');
  const cta = h('button.dock__cta', {
    type: 'button',
    on: { click: () => { if (model?.primary) { haptics.fire('success'); onIntent?.(model.primary.intent); } } },
  }, ctaIcon, h('span.dock__cta-text', null, ctaLabel, ctaSub));

  const auxRow = h('div.dock__aux');
  const contextRow = h('div.dock__context', { aria: { hidden: 'true' } }, cta, auxRow);

  /* ---- navigation row ---- */
  const navRow = h('nav.dock__nav', { aria: { label: 'Main' } });
  const navItems = new Map();

  const el = h('div.dock', { dataset: { mode: 'nav' } }, contextRow, navRow);

  function buildNav(items) {
    navRow.textContent = '';
    navItems.clear();
    for (const item of items) {
      const glyph = h('span.dock__nav-icon', { html: icon(item.icon) });
      const label = h('span.dock__nav-label.t-micro', { text: item.label });
      const badge = h('span.dock__nav-badge.t-micro');
      const btn = h('button.dock__nav-item', {
        type: 'button',
        dataset: { id: item.id },
        aria: { label: item.label, current: item.active ? 'page' : undefined },
        on: { click: () => { haptics.fire('select'); onNavigate?.(item.id); } },
      }, glyph, label, badge);
      navRow.appendChild(btn);
      navItems.set(item.id, { btn, badge, label });
    }
  }

  function renderAux(items) {
    auxRow.textContent = '';
    for (const a of items.slice(0, 2)) {
      auxRow.appendChild(h('button.dock__aux-btn', {
        type: 'button', aria: { label: a.label },
        on: { click: () => { haptics.fire('tap'); onIntent?.(a.intent); } },
      },
      h('span.dock__aux-icon', { html: icon(a.icon) }),
      h('span.dock__aux-label.t-micro', { text: a.label })));
    }
  }

  function update(next) {
    const prev = model;
    model = next;

    toggle(el, 'is-hidden', !!model.hidden);
    if (model.hidden) return;

    /* navigation */
    if (!prev || prev.nav.length !== model.nav.length
        || prev.nav.some((n, i) => n.id !== model.nav[i].id)) {
      buildNav(model.nav);
    }
    for (const item of model.nav) {
      const inst = navItems.get(item.id);
      if (!inst) continue;
      toggle(inst.btn, 'is-active', item.active);
      inst.btn.setAttribute('aria-current', item.active ? 'page' : 'false');
      setText(inst.badge, item.badge > 0 ? String(Math.min(99, item.badge)) : '');
      toggle(inst.badge, 'is-on', item.badge > 0);
    }

    /* context row */
    const hasPrimary = !!model.primary;
    const hasAux = model.secondary?.length > 0;
    const showContext = hasPrimary || hasAux;

    if (hasPrimary) {
      const p = model.primary;
      ctaIcon.innerHTML = icon(p.icon || 'phone');
      setText(ctaLabel, p.label);
      setText(ctaSub, p.sub || '');
      toggle(ctaSub, 'is-hidden', !p.sub);
      cta.dataset.tone = p.tone || 'accent';
      cta.setAttribute('aria-label', p.sub ? `${p.label}, ${p.sub}` : p.label);
    }
    toggle(cta, 'is-hidden', !hasPrimary);

    renderAux(hasAux ? model.secondary : []);
    toggle(auxRow, 'is-hidden', !hasAux);

    el.dataset.mode = model.mode;
    contextRow.setAttribute('aria-hidden', showContext ? 'false' : 'true');

    // Animate the height change: the row grows from zero rather than popping.
    if (showContext !== el.classList.contains('has-context')) {
      if (showContext) {
        el.classList.add('has-context');
        reflow(contextRow);
        haptics.fire('tap');
      } else {
        el.classList.remove('has-context');
      }
    }
  }

  return { el, update, destroy() {} };
}
