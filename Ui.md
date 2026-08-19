# DIALR — Contacts View: Technical Summary

Reflects repo state as of commit `2d14f2c` (Phase 2 complete; Phase 3, which
removes Top of Mind, has not run). All paths relative to repo root.

---

## 1. Tech Stack & Styling

| Layer | Choice |
|---|---|
| Framework | **None.** Vanilla ES modules + a hand-rolled DOM factory (`src/core/dom.js › h()`), hyperscript-style. No React/Vue/Flutter/RN. |
| Target | Web (renders in-browser; ships into an Android WebView via `WebViewAssetLoader` — see `docs/ANDROID_INTEGRATION_MAP.md`) |
| Styling | **Plain CSS**, hand-authored, no framework (no Tailwind, no CSS-in-JS). Cascaded via `<link>` tags in `index.html`: `base/tokens.css → base/reset.css → base/typography.css → base/layout.css → components/*.css → screens/screens.css` |
| State mgmt | Custom Redux-shaped store (`src/core/store.js`) + memoised selectors (`src/state/selectors.js`) |
| Icons | **Inline SVG strings**, hand-drawn, no icon package. Single module `src/core/icons.js` (`ICONS` map, 24×24 viewBox, `stroke-width:1.7`, `stroke="currentColor"`). Injected via `h(sel, {html: icon('name')})`. |
| Build step | **None.** No bundler/transpiler; `tools/serve.mjs` is a raw static file server. |

---

## 2. Component Tree

```
src/screens/ContactsScreen.js          ContactsScreen(store, actions)  — screen root
│
├─ header (inline, not a separate file)
│   ├─ h1.screen__title "Contacts"
│   ├─ span.contacts__count            "{n} people"
│   └─ button.contacts__add            + new-contact icon button
│
├─ div.contacts__tom                   Top of Mind row  (inline fn: renderTopOfMind)
│   └─ button.contacts__tom-item × N   ⤷ src/components/primitives/Avatar.js (size:'md')
│
├─ div.contacts__dupes                 duplicate-merge suggestion (inline fn: renderDupes)
│
├─ div.contacts__state                 empty/loading/permission slot
│   ├─ src/components/primitives/States.js → PermissionState
│   ├─ src/components/primitives/States.js → Skeleton (variant:'row')
│   └─ src/components/primitives/States.js → EmptyState
│
├─ div.contacts__list                  the A–Z list (inline fn: contactRow)
│   ├─ div.contacts__letter             sticky section header, one per letter
│   └─ button.crow × N                  one row per contact
│       └─ src/components/primitives/Avatar.js (size:'sm')
│
└─ div.contacts__index                  right-edge A–Z jump rail (hidden <6 sections)

Screen-external, shared with every tab:
src/app/shell.js                        fixed layer stack (wallpaper/screens/scrim/bottom/sheets/…)
src/components/dock/SearchBar.js        mounted into #bottom-slot for this tab
src/components/dock/FloatingDock.js     mounted into #dock-slot, always present
src/state/dockController.js             decides the dock's contextual content
src/screens/SearchOverlay.js            results panel that grows above SearchBar
src/components/contacts/ContactSheet.js opened as an overlay on row tap (actions.openContact)
src/components/contacts/ContactEditor.js opened as an overlay from "+ new contact"
```

Nothing here is componentized beyond this — `ContactsScreen.js` owns the
header, Top of Mind, duplicate banner, list, and index rail directly as
closures (`renderTopOfMind`, `renderDupes`, `renderIndex`, `contactRow`)
rather than separate files. Only `Avatar`, `EmptyState`/`PermissionState`/
`Skeleton`, and the dock/search are imported components.

---

## 3. Design Tokens & Theme

Source: `src/styles/base/tokens.css`. Four-layer system — primitives (L1) →
semantic (L2, what components use) → theme-overwritten (L3, same names,
rewritten at runtime by `src/theme/themeEngine.js`) → component geometry (L4).
**Dark is default; values below are dark-mode L2.**

### Colour

| Token | Value (dark) | Value (light) | Used for |
|---|---|---|---|
| `--bg` | `#000000` | `#ffffff` | screen background |
| `--surface-1` | `#1a1a1a` | `#f2f2f2` | skeleton rows |
| `--surface-2` | `#232323` | `#e8e8e8` | duplicate-banner bg, crow:active |
| `--surface-3` | `#2e2e2e` | `#dcdcdc` | contacts__add button bg, crow__call bg |
| `--fg` | `#ffffff` | `#000000` | primary text, icons |
| `--fg-secondary` | `rgba(255,255,255,.74)` | `rgba(0,0,0,.70)` | — |
| `--fg-tertiary` | `rgba(255,255,255,.48)` | `rgba(0,0,0,.46)` | crow__sub, count label, index rail (default) |
| `--fg-quaternary` | `rgba(255,255,255,.28)` | `rgba(0,0,0,.26)` | contacts__index-letter |
| `--line-hairline` | `rgba(255,255,255,.07)` | `rgba(0,0,0,.07)` | crow bottom border |
| `--accent` | `#ffffff` (mono) / wallpaper-derived hue | — | index-letter:active, favourite? no — see `--warn` |
| `--warn` | `#ffb020` (fixed, never themed) | same | `crow__star` fill |

`--accent` is the only themeable colour reaching this screen (index-rail
active letter) — see `docs/CUSTOMIZATION_SYSTEM.md`. All neutrals above are
re-derived per-theme but never take chroma above a capped OKLCH C (0.005–
0.020 depending on intensity setting); text (`--fg*`) never takes chroma at
all.

### Typography

| Class | Family | Size | Weight | Case |
|---|---|---|---|---|
| `.t-screen-title` (header "Contacts") | Archivo Expanded / Roboto Flex fallback | `var(--t-display-l)` ×`--fs` | 900 | UPPERCASE |
| `.t-body` (`crow__name`) | Inter Tight | 15.5px ×`--fs` | 400 | sentence |
| `.t-caption` (`crow__sub`, count) | Inter Tight | 13px ×`--fs` | 400 | sentence |
| `.t-micro` (index letters, Top-of-Mind label/name) | Archivo (display) | 10.5px ×`--fs` | 700 | UPPERCASE, `letter-spacing: .14em` |

`--fs` is the accessibility text-scale multiplier (0.9–1.35), applied
everywhere. Fonts load from Google Fonts (`index.html`, `media="print"`
swap-on-load trick) with the Roboto Flex variable-width fallback stack so
proportions survive offline.

### Radius / geometry

| Token | Value | Used for |
|---|---|---|
| `--r-circle` | `50%` | Avatar, `contacts__add`, `crow__call` |
| `--r-md` | `16px` | `contacts__dupe` |
| `--touch-min` | `48px` | design target (see §5 for actual measured sizes) |
| `--avatar-sm` | `38px` | `crow` avatar |
| `--avatar-md` | `54px` | Top-of-Mind avatar |

---

## 4. State & Props

No local component state beyond DOM node references — everything is derived
from the global store on each `update(state)` call (`src/state/store.js`,
Redux-shaped: `dispatch → reducer → subscribers`).

**Contact data** — three separate stores, never merged at rest:
```
state.directory.contacts     DeviceContact[]        (Android Contacts Provider shape)
state.directory.privateData  { [contactKey]: PrivateRelationship }   (favourite/vip/label/etc., device-only)
state.directory.profiles     { [numberKey]: DialrProfile }           (cloud identity, optional)
```
merged **read-only** per render by `selContactViews` (`src/state/selectors.js:74`)
into a `ContactView` — this is what every row actually receives as `props.view`.
It is never written back; edits go through `actions.saveContact()` /
`actions.contactAction('edit-…')` which dispatch to the correct source store.

**Pinned/Top of Mind** is not a stored flag — it's computed each render by
`selTopOfMind` (`selectors.js:331`, backed by `state/smart.js › topOfMind()`):
frequency × recency over the call log with a ~12-day half-life. No
`isPinned` field exists on the contact record.

**Favourite/starred** *is* a stored flag: `PrivateRelationship.favourite`
(device-only, set via contact-sheet action), read as `view.favourite` in
`contactRow()` to conditionally render `crow__star`.

**Search filter**: `state.contactsUi.query` (plain string, `contactsUi`
reducer). Consumed by `selContactList` (`selectors.js:344`) which filters
`selContactViews` by name/org/number-digits, then `selContactSections`
(`:364`) buckets into `{letter, items[]}` for the sticky headers. Typing
routes through `actions.setSetting`-style dispatch from the shared
`SearchBar` component into `contactsUi.query`.

**Props flow** — no prop-drilling framework; plain function arguments:
```
ContactsScreen({ store, actions })
  → update(state)                         called by the app's central render loop on every store change
    → renderTopOfMind(state)              reads selTopOfMind(state) directly
    → contactRow(view, actions)           view = one ContactView; actions = the shared intent-dispatch object (src/app/actions.js)
```
Row instances are kept alive across renders via keyed reconciliation
(`core/dom.js › reconcile`, keyed by `contactId || key`) — only `update(view)`
runs on an existing row, never a full DOM rebuild.

---

## 5. Layout Mechanics

**Container hierarchy** (outer → inner):
```
#app  (fixed layer stack, src/app/shell.js)
 └─ .app__screens
     └─ section.screen.screen--contacts        position:absolute inset:0, toggled .is-active
         ├─ header.screen__header               flex row, static
         └─ div.screen__body.scroll             flex:1, overflow-y:auto  ← THE scroll container
             └─ div.screen__inner                max-width:520px, centred
                 ├─ .contacts__tom
                 ├─ .contacts__dupes
                 ├─ .contacts__state
                 └─ .contacts__list              flat block; letters + rows interleaved
```

**Scrolling implementation**: plain **CSS overflow scroll** (`overflow-y:
auto` on `.screen__body`, `-webkit-overflow-scrolling: touch`, scrollbar
hidden). **No virtualization** — `FlatList`/`RecyclerView`-equivalent does
not exist; the full contact list is real DOM. Section headers are
`position: sticky; top: 0` (`.contacts__letter`) for the sticky A–Z effect.
List content is masked into the bottom zone via a CSS `mask-image` gradient
(`layout.css`) so it fades out under the search bar/dock rather than being
hard-clipped.

**A–Z jump rail** (`.contacts__index`): `position: absolute; right: 2px`,
independent of the scroll container; clicking a letter calls
`scrollIntoView({block:'start', behavior:'smooth'})` on the matching
`[data-letter]` node — native smooth-scroll, no scroll-library.

**Bottom navigation / search layout**: not part of the screen file at all —
composed once in `src/app/shell.js` / `src/app/main.js` and reused by every
tab:
```
.app__bottom  (position:absolute, bottom:0, flex column)
 └─ .app__bottom-inner (max-width:520px, centred)
     ├─ #bottom-slot     ← SearchBar.js mounted here for Contacts/Recents tabs (Dialer gets a keypad+call button instead)
     └─ #dock-slot       ← FloatingDock.js, always mounted, two-row: context (position:absolute, floats above nav) + nav row (fixed 64px height, --dock-h)
```
The dock's contextual row is absolutely positioned above the nav row
specifically so it can never push the tab content (fixed since Phase 1,
`docs/UI_REVISION_PLAN.md § D3`) — on Contacts it surfaces "New contact" or,
if the search query looks like a phone number, "Add contact {number}"
(`src/state/dockController.js › contactsContext`).

Row height is `min-height: 62px` (`.crow`), not tied to `--touch-min` (48px)
directly but comfortably exceeds it; `crow__call` icon button is 40×40px —
below the 44px floor the rest of the app now enforces post-Phase-2 (flagged
in `docs/UI_REVISION_PLAN.md § 3.6`, not yet fixed on this screen).
