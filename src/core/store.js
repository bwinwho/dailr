/**
 * DIALR — state store.
 *
 * A small unidirectional store. Chosen over ad-hoc component state because the
 * dock is a *global* consumer of *every* screen's context: the dialer's input,
 * the recents selection, the call state and the spam verdict all feed one
 * contextual surface. Scattering that across components is exactly the
 * "boolean flags everywhere" failure the brief forbids.
 *
 *     dispatch(action) -> rootReducer -> next state -> subscribers
 *
 * Subscribers may register a selector so they only wake when their slice
 * changes (`subscribeTo`). Selector results are compared with Object.is, so
 * reducers MUST return new object identities for changed slices and preserve
 * identity for untouched ones.
 */

export function createStore(rootReducer, preloadedState, { name = 'dialr', devtools = true } = {}) {
  let state = preloadedState;
  let dispatching = false;
  const listeners = new Set();
  const history = [];              // ring buffer for the in-app debug panel
  const HISTORY_MAX = 120;

  function getState() { return state; }

  function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new Error('[store] actions must be objects with a string `type`');
    }
    if (dispatching) {
      // Reducers must stay pure; dispatching from one is a bug, not a feature.
      throw new Error(`[store] dispatch during dispatch: ${action.type}`);
    }
    const prev = state;
    try {
      dispatching = true;
      state = rootReducer(prev, action);
    } finally {
      dispatching = false;
    }

    if (devtools) {
      history.push({ t: Date.now(), type: action.type, action, changed: prev !== state });
      if (history.length > HISTORY_MAX) history.shift();
    }

    if (prev !== state) {
      for (const l of listeners) l(state, prev, action);
    }
    return action;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Subscribe to a derived value. `fn(value, prevValue)` runs immediately once
   * (so components can render their first frame from the same code path) and
   * then only when `selector(state)` changes identity.
   */
  function subscribeTo(selector, fn, { immediate = true } = {}) {
    let last = selector(state);
    if (immediate) fn(last, undefined);
    return subscribe((next) => {
      const v = selector(next);
      if (!Object.is(v, last)) { const prev = last; last = v; fn(v, prev); }
    });
  }

  /** Batch several dispatches into one notification pass. */
  function batch(fn) {
    const saved = new Set(listeners);
    listeners.clear();
    let prev = state;
    try { fn(dispatch); } finally {
      for (const l of saved) listeners.add(l);
    }
    if (prev !== state) for (const l of listeners) l(state, prev, { type: '@@batch' });
  }

  const store = { getState, dispatch, subscribe, subscribeTo, batch, history, name };
  return store;
}

/**
 * Compose slice reducers into a root reducer.
 * Preserves object identity when no slice changed — the whole subscribeTo
 * optimisation depends on this.
 */
export function combineReducers(map) {
  const keys = Object.keys(map);
  return function rootReducer(state = {}, action) {
    let changed = false;
    const next = {};
    for (const k of keys) {
      const prevSlice = state[k];
      const nextSlice = map[k](prevSlice, action, state);
      next[k] = nextSlice;
      if (nextSlice !== prevSlice) changed = true;
    }
    return changed ? next : state;
  };
}

/**
 * Reducer helper: a map of action type -> handler, with an identity default.
 * Handlers receive (sliceState, action, rootState) and return the next slice.
 */
export function createReducer(initial, handlers) {
  return function reducer(state = initial, action, root) {
    const h = handlers[action.type];
    return h ? h(state, action, root) : state;
  };
}

/** Shallow immutable merge that returns the SAME object when nothing changed. */
export function patch(obj, changes) {
  let changed = false;
  for (const k in changes) {
    if (!Object.is(obj[k], changes[k])) { changed = true; break; }
  }
  return changed ? { ...obj, ...changes } : obj;
}

/** Memoise a selector over its inputs (reselect-lite). */
export function createSelector(inputs, compute) {
  let lastArgs = null;
  let lastResult;
  return (state) => {
    const args = inputs.map((fn) => fn(state));
    if (lastArgs && args.length === lastArgs.length && args.every((a, i) => Object.is(a, lastArgs[i]))) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = compute(...args);
    return lastResult;
  };
}
