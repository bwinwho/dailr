/**
 * DIALR — micro DOM layer.
 *
 * Deliberately not a framework. DIALR's UI is a small number of long-lived,
 * imperatively-updated components (a dock that morphs, cards that expand, a
 * call screen that must never re-mount mid-call). A virtual DOM would fight
 * that; direct node ownership suits it.
 *
 * Contract for every component in this codebase:
 *
 *     createThing(props) -> { el, update(nextProps), destroy() }
 *
 * `el` is created once. `update` mutates in place. `destroy` releases
 * listeners/timers. Nothing else is allowed to touch a component's subtree.
 */

/** Tags parsed from a selector-ish string: 'button.dock__btn.is-primary#foo' */
const TAG_RE = /^([a-zA-Z0-9-]+)?(#[^.#]+)?((?:\.[^.#]+)*)$/;

/**
 * Create an element.
 * @param {string} sel  'div', 'button.cls', 'span.a.b#id'
 * @param {object|null} props  attributes; special keys below
 * @param {...(Node|string|number|null|false|Array)} children
 *
 * Special props:
 *   class / className   extra classes (string or array)
 *   style               object of CSS properties (camelCase or --custom-prop)
 *   dataset             object of data-* values
 *   text                textContent (escaped by definition — we never use innerHTML)
 *   html                innerHTML — ONLY for trusted inline SVG from src/core/icons.js
 *   on                  { click: fn, 'pointerdown': [fn, {passive:true}] }
 *   ref                 fn(el) called once with the node
 *   aria                { label: 'x', pressed: true } -> aria-label, aria-pressed
 */
export function h(sel, props, ...children) {
  const m = TAG_RE.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  if (m[2]) el.id = m[2].slice(1);
  if (m[3]) el.className = m[3].slice(1).split('.').join(' ');

  if (props) applyProps(el, props);
  appendAll(el, children);
  return el;
}

export function applyProps(el, props) {
  for (const key in props) {
    const v = props[key];
    if (v === null || v === undefined || v === false) continue;

    switch (key) {
      case 'class':
      case 'className': {
        const extra = Array.isArray(v) ? v.filter(Boolean).join(' ') : String(v);
        el.className = el.className ? `${el.className} ${extra}` : extra;
        break;
      }
      case 'style':
        if (typeof v === 'string') el.setAttribute('style', v);
        else for (const p in v) {
          if (p.startsWith('--')) el.style.setProperty(p, v[p]);
          else el.style[p] = v[p];
        }
        break;
      case 'dataset':
        for (const d in v) if (v[d] !== undefined && v[d] !== null) el.dataset[d] = v[d];
        break;
      case 'text':
        el.textContent = String(v);
        break;
      case 'html':
        el.innerHTML = v;           // trusted icon markup only — see icons.js
        break;
      case 'on':
        for (const type in v) {
          const spec = v[type];
          if (Array.isArray(spec)) el.addEventListener(type, spec[0], spec[1]);
          else el.addEventListener(type, spec);
        }
        break;
      case 'aria':
        for (const a in v) if (v[a] !== undefined && v[a] !== null) el.setAttribute(`aria-${a}`, v[a]);
        break;
      case 'ref':
        v(el);
        break;
      case 'value':
        el.value = v;
        break;
      case 'disabled':
      case 'checked':
      case 'selected':
        el[key] = !!v;
        break;
      default:
        if (v === true) el.setAttribute(key, '');
        else el.setAttribute(key, v);
    }
  }
  return el;
}

function appendAll(parent, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) { appendAll(parent, c); continue; }
    parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Append children to an existing node (same rules as h). */
export function append(parent, ...children) { appendAll(parent, children); return parent; }

/** Replace all children. */
export function fill(parent, ...children) {
  parent.textContent = '';
  appendAll(parent, children);
  return parent;
}

export const qs  = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** addEventListener that returns its own unsubscribe — used by destroy(). */
export function on(target, type, handler, opts) {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

/** Set textContent only when it actually changed (avoids layout thrash). */
export function setText(el, value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (el.textContent !== s) el.textContent = s;
}

export function toggle(el, cls, force) {
  const want = force === undefined ? !el.classList.contains(cls) : !!force;
  if (el.classList.contains(cls) !== want) el.classList.toggle(cls, want);
  return want;
}

export function setAttr(el, name, value) {
  if (value === null || value === undefined || value === false) el.removeAttribute(name);
  else if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value);
}

/**
 * Keyed list reconciliation.
 *
 * Keeps component instances alive across renders so that an expanded recent
 * card does not collapse when an unrelated item further down the list changes.
 *
 * @param {HTMLElement} container
 * @param {Array} items
 * @param {object} spec
 * @param {(item, i) => string} spec.key
 * @param {(item, i) => {el:HTMLElement, update?:Function, destroy?:Function}} spec.create
 * @param {Map} spec.store  caller-owned Map<key, instance> (persist across calls)
 */
export function reconcile(container, items, { key, create, store }) {
  const next = new Map();
  let cursor = container.firstChild;

  for (let i = 0; i < items.length; i++) {
    const k = key(items[i], i);
    let inst = store.get(k);

    if (!inst) {
      inst = create(items[i], i);
    } else if (inst.update) {
      inst.update(items[i], i);
    }
    next.set(k, inst);

    if (cursor === inst.el) {
      cursor = cursor.nextSibling;
    } else {
      container.insertBefore(inst.el, cursor);
    }
  }

  // Remove instances that vanished.
  for (const [k, inst] of store) {
    if (!next.has(k)) {
      inst.destroy?.();
      inst.el.remove();
    }
  }
  store.clear();
  for (const [k, v] of next) store.set(k, v);
  return store;
}

/** Wait for the next paint. Used to make CSS transitions actually run. */
export function nextFrame(fn) {
  return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
    fn?.(); res();
  })));
}

/** Force style recalculation so a just-added class animates instead of jumping. */
export function reflow(el) { void el.offsetHeight; }

/**
 * Resolve when a CSS transition on `el` finishes, or after `fallback` ms.
 * Necessary because transitionend never fires when --motion-scale is ~0.
 */
export function afterTransition(el, fallback = 400) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.removeEventListener('transitionend', onEnd); resolve(); };
    const onEnd = (e) => { if (e.target === el) finish(); };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, fallback);
  });
}

/** Trap focus inside a container (sheets, modals, call screen). */
export function trapFocus(container) {
  const SELECTOR = 'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  const onKey = (e) => {
    if (e.key !== 'Tab') return;
    const nodes = qsa(SELECTOR, container).filter((n) => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
