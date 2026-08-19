# DIALR — Frontend Architecture

How the frontend is put together, and the reasoning behind the choices that
would otherwise look arbitrary.

---

## 1. Shape of the system

```
                    ┌───────────────────────────────────────┐
                    │            index.html                 │
                    │   loads styles, boots src/app/main.js │
                    └────────────────┬──────────────────────┘
                                     │
       ┌─────────────────────────────┴─────────────────────────────┐
       │                        src/app/main.js                    │
       │   shell → restore → mount → wire events → load → render   │
       └───┬────────────┬─────────────┬────────────┬───────────────┘
           │            │             │            │
      ┌────▼────┐  ┌────▼─────┐  ┌────▼─────┐ ┌────▼──────────┐
      │ screens │  │   dock   │  │ overlays │ │   callHost    │
      └────┬────┘  └────┬─────┘  └────┬─────┘ └────┬──────────┘
           │            │             │            │
           └────────────┴──────┬──────┴────────────┘
                               │  read state / emit intents
                    ┌──────────▼───────────┐
                    │      src/state       │
                    │  store · selectors   │
                    │  dockController      │
                    │  smart (derivations) │
                    └──────────┬───────────┘
                               │ intents (src/app/actions.js)
                    ┌──────────▼───────────┐
                    │     src/services     │
                    │  12 namespaces       │
                    └──────┬────────┬──────┘
                           │        │
                  ┌────────▼──┐  ┌──▼─────────────────┐
                  │   mock    │  │ bridge → Kotlin    │
                  │ (this repo)│  │ (future Android)  │
                  └───────────┘  └────────────────────┘
```

Data flows down. Intents flow up. The only sideways channel is the event bus,
and only for *moments* (a call arrived, a reminder fired) rather than state.

---

## 2. Why no framework

DIALR is a small number of **long-lived, imperatively-updated surfaces**, not a
large tree of cheap re-renderable views:

- The active-call screen must survive every unrelated state change. Re-mounting
  it restarts the duration timer, drops the note the user is typing and steals
  focus mid-conversation.
- The dock morphs continuously between contexts. A diffing renderer fights the
  height/width transitions instead of helping them.
- An expanded recent card must not collapse because a different row updated.

So every component follows one contract:

```js
createThing(props) -> { el, update(nextProps), destroy() }
```

`el` is created once, `update` mutates in place, `destroy` releases listeners and
timers. Lists use keyed reconciliation (`core/dom.js › reconcile`) so instances
survive reordering.

The secondary reason is deployment: **zero build step**. The same files that run
in a browser are the files loaded from `assets/` by `WebViewAssetLoader`. No
bundler in the Android build, nothing to keep in sync, and a designer can edit a
stylesheet and reload.

---

## 3. State

A single store (`src/state/store.js`), Redux-shaped: `dispatch(action)` → root
reducer → subscribers. Full detail in [STATE_MODEL.md](STATE_MODEL.md).

The reason it is centralised rather than per-component is the dock. The dock is
a *global consumer of every screen's context* — the dialer's input, the recents
selection, the call state and the spam verdict all feed one surface. Scatter
that across components and you get exactly the "boolean flags everywhere"
failure the brief warns about.

Two rules the whole thing depends on:

1. **Reducers preserve object identity when nothing changed.** `subscribeTo`
   and the memoised selectors both compare with `Object.is`.
2. **No derived data is stored.** Recents grouping, callback debt, Rewind
   statistics, dock actions — all selectors, all recomputed, all memoised.

---

## 4. The three identity stores

The single most important structural decision in the product.

| Store | Owner | Lifetime | Leaves the device? |
|---|---|---|---|
| `directory.contacts` | Android Contacts Provider | device | no |
| `directory.profiles` | Firebase / DIALR | cloud | it *is* cloud |
| `directory.privateData` | the user | device | **never** |

They are never merged in state. `selectors.js › selContactViews` builds a
read-only **ContactView** projection for rendering, and that projection is never
written back.

Merging them into one mutable object is how apps end up uploading a private
nickname to a server. Keeping them apart also makes the identity hierarchy
implementable in exactly one function:

```js
resolveIdentity(state, number)   // saved name > DIALR profile > phone number
```

Every screen that shows "who is this" calls it. Nothing re-derives it.

---

## 5. Services and the native boundary

`src/services/interfaces.js` declares twelve namespaces. `src/services/index.js`
resolves each one **independently**:

```
native declares it in capabilities()  →  proxy over the bridge
otherwise                             →  the mock implementation
```

Per-namespace granularity is a deliberate bring-up affordance: Kotlin can land
`calls` and `contacts` first and keep running the real UI on mocked profiles and
media. `dialr.__source` reports the resolution and Settings ▸ Advanced ▸ Native
bridge status renders it.

No component imports a service. Components emit intents; `src/app/actions.js`
is the only module that talks to services. That is why swapping mock for native
is configuration, not refactoring.

Wire protocol and per-feature responsibilities:
[ANDROID_INTEGRATION_MAP.md](ANDROID_INTEGRATION_MAP.md).

---

## 6. The layer stack

The shell (`src/app/shell.js`) builds a fixed set of roots, once:

```
wallpaper → screens → scrim → search+dock → sheets → modals → call → toasts
```

Nothing in the app creates its own full-screen layer; it mounts into one of
these. That keeps the z-index ladder in `tokens.css` a designed hierarchy rather
than an arms race, and it is what makes "the dock is always visible" true by
construction — sheets are positioned to stop above it.

### The measured bottom zone

The bottom interaction zone is not a constant height: the dialer puts a keypad
there, other tabs put a search bar, the You tab puts nothing. A `ResizeObserver`
publishes `--bottom-actual`, and everything that must clear the zone (screen
padding, scroll masks, toasts, sheets, search results, the contacts index rail)
reads that variable. Nothing hard-codes a guess.

---

## 7. Theming

Two modules, split on purpose:

- `src/theme/themeEngine.js` — **pure**. OKLab maths, restraint policy, contrast
  guards. Runs with no DOM; unit-testable in Node.
- `src/app/themeController.js` — **stateful**. Knows about settings, the
  wallpaper element, `prefers-color-scheme`, and preview/commit.

The engine's output is a flat map of CSS custom properties using the same names
`tokens.css` declares, so **no component knows theming exists**.

Full rules, including why safety colours are re-asserted on every build:
[CUSTOMIZATION_SYSTEM.md](CUSTOMIZATION_SYSTEM.md) and
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

## 8. The dock as a function of context

```
context  →  dock state  →  dock actions  →  <FloatingDock/>
```

`src/state/dockController.js` is a pure selector: state in, `DockModel` out. It
is the only module that decides what the dock offers. Screens contribute context
to the store; they never reach into the dock.

Two rules encoded there:

- **Navigation is never removed, only compressed.** A dock that swaps entirely
  to a CTA strands the user in whatever screen they are on. DIALR's dock grows
  a second row upward instead.
- **Exactly one primary action.** If context suggests two, the more specific one
  wins and the other becomes a secondary icon.

---

## 9. Offline and failure

Cloud is an enhancement. Concretely:

| Subsystem | Cloud down | Behaviour |
|---|---|---|
| Dial / answer / hang up | — | unaffected; never touches the network |
| Contacts, call log, notes | — | device-local, unaffected |
| DIALR name for an unknown caller | Firebase | falls through to the phone number |
| Spam verdict | network | protection degrades silently; calls still ring |
| Wallpapers, ringtones | Cloudinary | built-ins are local files |
| Profile edits | Firebase | rejected with `OFFLINE`, surfaced as a banner |

Every one of those paths has a rendered state — see
[SCREEN_SPECIFICATION.md](SCREEN_SPECIFICATION.md) § States.

---

## 10. Performance notes

- `contain: strict` on the app shell; screens are `position: absolute` siblings
  toggled by class, so switching tabs does not reflow the document.
- `setText`/`setAttr` write only on actual change — the dock and the call timer
  update several times a second.
- The call duration timer derives from `connectedAt` rather than incrementing a
  counter, so it stays correct when the WebView is backgrounded and throttled.
- Palette extraction downsamples to 56×56 (~3k pixels, ~2 ms) and is skipped
  entirely for built-in wallpapers, which ship a pre-computed palette.
- Wallpaper images render at low opacity behind a gradient veil, so content
  contrast never depends on decoding finishing.

---

## 11. Testing posture

- `tools/shoot.mjs` drives a scripted tour through onboarding, every tab, card
  expansion, History, Rewind, Settings, the wallpaper picker, three incoming-call
  identity tiers, an active call with keypad and notes, post-call, light mode and
  monochrome mode — failing on any console error or page exception.
- The pure modules (`core/format.js`, `theme/color.js`, `theme/palette.js`,
  `state/smart.js`, `theme/themeEngine.js`) have no DOM dependency and are
  directly executable in Node, which is how the colour and language behaviour
  was calibrated.
