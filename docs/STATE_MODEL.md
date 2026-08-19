# DIALR — State Model

The store shape, the state machines inside it, and the selectors that turn it
into what screens render.

---

## 1. Store shape

```js
{
  app:         { booted, tab, previousTab, onboarding, online, permissions,
                 permissionsChecked, isDefaultDialer, keyboardOpen, errors },
  directory:   { contacts, contactsStatus, contactsError,
                 callLog, callLogStatus, callLogError,
                 profiles, profilesStatus, profilesError,
                 privateData, spam, sims, me },
  dialer:      { input },
  recents:     { expandedKey, filter },
  contactsUi:  { query, sort },
  search:      { open, query },
  call:        { sessions, muted, audioRoute, conference, keypadOpen,
                 noteDraft, pendingNumber, postCall, error },
  overlay:     { stack },
  theme:       { mode, resolvedMode, wallpaperId, palette, intensity,
                 showWallpaper, standard, contrast, motion, fontScale },
  settings:    { …112 fields, see settingsSchema.js },
  reminders:   Reminder[],
  toasts:      Toast[]
}
```

Two invariants the whole system depends on:

1. **Reducers return the same object identity when nothing changed.**
   `patch()` in `core/store.js` compares before spreading; `combineReducers`
   returns the previous root when no slice moved. `subscribeTo` and every
   memoised selector compare with `Object.is`.

2. **No derived data is stored.** Recents grouping, callback debt, Rewind,
   dock actions, search results — all selectors. If you find yourself adding a
   field that another field could compute, it belongs in `selectors.js`.

---

## 2. Why one store

The dock is a global consumer of every screen's context: the dialer's input, the
recents selection, the call state and the spam verdict all feed one surface.

```
dialer.input ─┐
recents.expandedKey ─┤
overlay.stack ─┼──> selectDockModel(state) ──> <FloatingDock/>
call.sessions ─┤
settings.smart ─┘
```

With per-component state this becomes prop-drilling through four screens, or a
pile of booleans — the exact failure mode the brief warns about. One store, one
pure selector, one component.

---

## 3. State machines

### 3.1 Call

The only true state machine in the app, and it is owned by the platform. The
frontend *mirrors* it from `CallSnapshot`; it never advances it locally.

```
                 place()                    answer()
       idle ──────────────> dialing ──┐   ┌──────────> active ──┐
        ▲                              │   │                     │
        │                              ▼   │                     ▼
        │                         connecting                  held ⇄ active
        │                              │                         │
        │  ring timeout / reject       ▼                         │
        └──────────────── ended <── failed                       │
        ▲                    ▲                                   │
        │  incoming          └───────────── hangup() ────────────┘
        └──── ringing ──── (auto-miss after ~26 s)
```

Multi-call topology:

```
one active + one ringing   →  answer() puts the first on hold
one active + one held      →  swap() exchanges foreground
                              merge() → conference (all sessions active)
conference                 →  separate(id) promotes one, holds the rest
                              hangup() ends every leg
```

`sessions[0]` is always the foreground call. The reducer stores the snapshot
verbatim; `selectCallScreen(state)` decides which screen to show:

| `sessions[0].state` | Surface |
|---|---|
| `ringing` | `IncomingCallScreen` |
| `dialing`, `connecting`, `active`, `held` | `ActiveCallScreen` |
| none | post-call sheet, if it earned its place |

### 3.2 Dialer

Derived, not stored — `selDialerMatch(state)` classifies `dialer.input`:

```
empty ──type──> typing ──┬──> contact   (matched a saved contact, incl. T9)
                          ├──> dialr     (a DIALR user, not saved locally)
                          ├──> unknown   (≥ 6 digits, no match)
                          └──> code      (contains * or #, e.g. USSD)
```

Each state produces a different dock CTA. `code` deliberately never offers "add
contact" — a USSD string is not a person.

### 3.3 Recents card

```
collapsed ──tap──> expanded ──tap "History"──> HistoryPanel overlay
     ▲                 │                              │
     └── tap again ────┘                     "Check Rewind" ──> Rewind overlay
```

Only one card is expanded at a time (`recents.expandedKey`), and switching tabs
collapses it. The overlay stack sits above; the dock stays live throughout.

### 3.4 Identity

Not stored. Computed per number by `resolveIdentity()`:

```
numberKey ─> in device contacts?  ─yes─> tier 'saved'
                     │no
                     ▼
             in profiles cache?   ─yes─> tier 'dialr'
                     │no
                     ▼
                                        tier 'unknown'
```

Lookup is skipped entirely when `settings.identity.lookupUnknown` is off or the
device is offline — both cases fall through to `unknown`, which is a designed
tier, not an error.

---

## 4. Async status

Slices that load from a service carry an explicit status rather than inferring
emptiness:

```
idle ──> loading ──> ready
             └────> error   { message, code }
```

This is why "no contacts yet" and "couldn't read contacts" are different
screens. `contacts.length === 0` alone cannot tell them apart.

---

## 5. Selectors

`state/selectors.js`. All memoised with `createSelector` (reselect-lite).

| Selector | Returns | Used by |
|---|---|---|
| `selLogByContact` | `Map<contactKey, CallLogEntry[]>` | everything derived |
| `selContactViews` | `ContactView[]` | contacts, dialer, search |
| `selContactsByKey` | `Map<key, ContactView>` (incl. secondary numbers) | identity resolution |
| `selDebt` | `Map<key, {count, since}>` | recents chips, filters |
| `selRecents` | decorated recent rows | Recents |
| `selRecentCounts` | `{all, missed, owed, spam}` | filter chips, dock badge |
| `selDialerMatch` | dialer classification | dialer, dock |
| `selTopOfMind` | `ContactView[]` | dialer, contacts |
| `selContactList` / `selContactSections` | filtered, sorted, A–Z grouped | Contacts |
| `selSearchResults` | `{people, calls, notes}` | search overlay |
| `selectCallScreen` | full call view model | call host |
| `selectContactDetail` | contact + entries + smart derivations | contact sheet, history |
| `selectRewind` | `Rewind` | Check Rewind |
| `resolveCallBackground` | `{id, url, scope}` | call screens |
| `selectDockModel` | `DockModel` | the dock |

### Memoisation and the identity rule

`selRecents` depends on `selCallLog`, `selContactsByKey`, `selProfiles`,
`selSpam`, `selDebt`, `selSettings` and the filter. It recomputes only when one
of those changes identity. A reducer that spreads state unnecessarily silently
turns every keystroke into a full recompute of the recents list — which is
exactly why `patch()` exists.

---

## 6. Overlays

A stack, not a route. Each entry is `{ id, kind, props }`.

```js
pushOverlay('history', { contactKey, number })
```

Kinds: `history`, `rewind`, `contact`, `contact-editor`, `dialr-profile`,
`wallpaper-picker`, `ringtone-picker`, `settings`, `quick-reply`, `reminder`,
`sim`, `repeat-caller`, `options`, `demo`, `bridge-status`.

Rules:

- Changing tabs clears the stack — navigation must not leave sheets stranded.
- Escape / Android back pops one level.
- The dock reads the **top** of the stack as its most specific context, which is
  why a contact sheet's CTA is "Call Avni" regardless of the screen behind it.
- `overlays.js` builds and destroys instances; a popped overlay's `destroy()`
  runs, releasing its listeners and any audio preview.

---

## 7. Intents

Components never dispatch directly and never import services. They call
`actions.*` (`app/actions.js`), which is the only module allowed to do both.

The call path is worth reading as the canonical example, because ordering is a
product requirement rather than an implementation detail:

```
actions.call(number, contactKey)
  1. isEmergencyNumber()      → bypass everything, place immediately
  2. blocked?                 → refuse, offer Unblock, stop
  3. SIM                      → contact preference > default > ask (once, remembered)
  4. confirmBeforeCall?       → confirm
  5. placeNow()               → services.calls.place()
```

Every branch is reachable from the demo panel.

---

## 8. Events → state

`core/bus.js` carries *moments*; the store carries *state*. `wirePlatformEvents`
in `app/main.js` is the only translator.

```
native/mock ──emit──> bus ──> wirePlatformEvents ──dispatch──> store ──> render
```

Why not put call state on the bus? Because "is there a call right now" has a
current value that a newly-mounted component must be able to ask for. Why not
put "a reminder fired" in the store? Because it has no current value — it
happened once.

Every `call.*` event carries a full snapshot, so a dropped event cannot leave
the UI describing a call that ended.

---

## 9. Persistence

| Key | Contents | Where |
|---|---|---|
| `settings` | the whole settings object | `dialr.storage` → localStorage / DataStore |
| `theme` | `{ wallpaperId }` | same |
| `onboarded` | `{ firstName, surname, at }` | same |

The palette is **not** persisted — it is recomputed from the wallpaper on boot,
so changing a built-in wallpaper's palette in an update is picked up rather than
frozen into a stale cache.

Settings load is deep-merged over `defaultSettings()`, so an older stored blob
still boots after new fields are added.
