# DIALR — Component Map

Every component, what it owns, and what it must never do.

**The contract, everywhere:**

```js
createThing(props) -> { el, update(nextProps), destroy() }
```

`el` is created once. `update` mutates in place. `destroy` releases listeners,
timers and audio. Nothing outside a component touches its subtree.

---

## Primitives — `src/components/primitives/`

| Component | Props | Owns | Never |
|---|---|---|---|
| `Button` | label, sub, icon, variant, size, block, busy, disabled, onClick | 48px minimum target, press feedback, haptics | contain business logic |
| `IconButton` | icon, label, variant, pressed, active | accessible name from `label`, optional visible caption | ship without a label |
| `CallActionButton` | kind `answer`/`decline`, large | the two largest targets in the product, fixed safety colours | be themed by a wallpaper |
| `Avatar` | src, name, size, ring, status | the photo-vs-identity-mark distinction, broken-image fallback | invent a photo when `src` is null |
| `Chip` / `ChipRow` | label, tone, icon, selected | the app's smallest unit of meaning | exceed one line |
| `Sheet` | title, content, height, dismissible, onClose | bottom-anchored panel, drag-to-dismiss, focus trap, **stops above the dock** | cover the dock |
| `Modal` | title, message, confirmLabel, dangerous | centred blocking confirmation | be used for anything non-destructive |
| `Toast` | text, tone, icon, actionLabel, duration | auto-dismiss, pause on touch, one action max | stack more than three |
| `Switch`, `Segment`, `Slider`, `TextField`, `SelectField`, `NavField`, `ChipsField`, `InfoField`, `ActionField`, `TimeField` | label, hint, value, onChange | labelled rows; the entire Settings surface renders from these | appear without a visible label |
| `EmptyState`, `ErrorState`, `PermissionState`, `Skeleton`, `Banner` | varies | plain-language explanation **plus** the single most useful next action | be a bare string |

`Sheet` is where "expand, don't interrupt" is enforced structurally: its `bottom`
is computed from the dock's measured height, so a full-height sheet still leaves
the dock visible and live.

---

## Dock — `src/components/dock/`

### `FloatingDock`

Props: a `DockModel`. Emits: `onIntent(intent)`, `onNavigate(tabId)`.

```
┌─────────────────────────────┐  context row — grows upward, max-height animated
│  ☏  CALL AVNI          [◷]  │  one primary CTA + up to two aux icons
├─────────────────────────────┤
│  ▣    ◷    ◔    ◕          │  navigation — always present, never replaced
└─────────────────────────────┘
```

**Owns:** the morph animation, badge rendering, active-tab pill.
**Never:** decides *what* to show. That is `state/dockController.js`.

Layout rationale is in the file header: swapping the dock's contents for a CTA
strands the user in whatever screen they are on, so DIALR grows a second row
instead. Navigation is compressed, never removed.

### `SearchBar`

Collapsed it is a tap target; focused it raises the global scrim and the results
panel grows upward out of it. Lives in the bottom slot on Recents and Contacts.

---

## Dialer — `src/components/dialer/`

| Component | Notes |
|---|---|
| `NumberDisplay` | **One tap copies** — no long press. Type scales down rather than truncating. Backspace: tap deletes one, hold clears. Shows the matched contact beneath. |
| `DialPad` | 12 keys, letters for T9 discoverability, DTMF tones, haptics, hold-0-for-`+`, hold-digit for speed dial. `bindKeyboard()` gives desktop and switch-access parity. |

---

## Recents — `src/components/recents/`

### `RecentCard`

The signature object. Reading order is inverted from a normal call log:

```
CHHETRI                    ← surname, small, above
AVNI      10 minutes ago   ← given name, large; time as a sibling
She called you.            ← the event, as a sentence
[ 6M ]                     ← at most three chips
│ Red skirt — Amazon       ← the note gets its own line, never a chip
```

**Owns:** in-place expansion (height-animated, children built once), swipe
right-to-call / left-to-message, name size stepping, the three-chip cap.

**Never:** navigates. Expansion happens inside the card.

The chip cap is a design rule with teeth: priority is safety → obligation →
outcome → metadata, and the fourth chip is dropped. A card carrying five chips
is a card nobody reads.

### `HistoryPanel`

Near-full-height sheet, stopping at the dock. Entries render as prose:

```
NIGHT 11 PM
6 minutes · She called you.          ┌──────────────────┐
                                     │ Red skirt—Amazon │
                                     └──────────────────┘
```

Day headings are rows in the same keyed list, so grouping does not break
reconciliation. Bottom: **Check Rewind**, hidden when there is not enough
history to make it worth opening.

### `CheckRewind`

A story, not a dashboard. One number and one sentence per panel; tap right to
advance, left to go back; progress bars at the top.

**Owns:** panel sequencing, fluid type sizing for arbitrary-length values.
**Never:** ranks the user against anyone, or shows a chart.

Which statistics appear is [OPEN_DECISIONS.md § 3](OPEN_DECISIONS.md); the
component takes them as data so changing the set is a one-line edit.

---

## Contacts — `src/components/contacts/`

### `ContactSheet`

Structured around the three-store split, and it labels the boundary out loud:

```
THEM ON DIALR    their published profile — theirs, not yours
ON THIS PHONE    the device contact — the name YOU saved
ONLY YOU SEE     label, pronouns, note, place, ringtone, background, SIM
```

Showing the boundary is the honest version of the privacy model. A user who can
see which half is private will actually use the private half.

### `ContactEditor`

Edits the **device contact only**. Private relationship data is edited from the
sheet, because merging the two forms would blur exactly the boundary the
architecture exists to keep.

---

## Call — `src/components/call/`

| Component | Notes |
|---|---|
| `IncomingCallScreen` | Answers one question: *do I pick this up?* Name (hierarchy), photo **only if real**, ≤3 context chips, your last note, answer/decline/reply/remind/block. **No squad, views, pickup rate, bio or links** — forbidden by the brief and by judgement. |
| `ActiveCallScreen` | Every telecom control, plus Notes. Timer derives from `connectedAt`. Created once per call and updated in place — re-mounting would restart the timer and drop the note being typed. |
| `PostCallSheet` | Appears only when it earned it: unsaved number, missed, very short call, or a note in progress. `shouldShowPostCall()` is exported and testable. |
| `QuickReplySheet` | Exactly three replies, editable in Settings. |
| `ReminderPicker` | Two separate decisions: *when*, and *whether to tell them*. The second is opt-in per reminder. |
| `SimSelector` | Shown when the default is "ask". Offers to remember per contact. |
| `RepeatCallerPrompt` | The "block this caller?" moment. Offers a **temporary** silence first — most bursts are a delivery driver, not a harasser. |

---

## Profile — `src/components/profile/`

### `ProfileView`

Editorial composition: bio poster in the left column, statistics and imagery in
the right. Used for both your own profile and someone else's; `mode` switches
the actions, never the layout.

**Owns:** the poster composition, the four link buttons, squad/views/pickup
display subject to visibility settings.
**Never:** appears on a call screen.

---

## Settings — `src/components/settings/`

| Component | Notes |
|---|---|
| `SettingsPanel` | Renders entirely from `settingsSchema.js`. Adding a setting means adding one object to that array; this file never changes. Three layers of disclosure: sections → tier-1 fields → "N more" → search across everything. |
| `WallpaperPicker` | Live preview themes the whole app behind the sheet. Each tile shows the accent DIALR would **actually** derive at the current intensity — including "Mono" for achromatic images. No tile promises colour the engine will refuse to produce. |
| `RingtonePicker` | Tapping plays it. Preview stops when the sheet closes so nothing keeps ringing in a pocket. |

---

## App layer — `src/app/`

| Module | Role |
|---|---|
| `shell.js` | Builds the fixed layer stack once. Nothing else creates a full-screen layer. |
| `main.js` | Boot order, render loop, platform event wiring, bottom-zone measurement. |
| `actions.js` | Every intent. The only module that talks to services. |
| `overlays.js` | Builds/destroys overlay instances from the stack. One place decides what an overlay *is*. |
| `callHost.js` | Owns the call surfaces and keeps them alive across state changes. |
| `themeController.js` | Settings + wallpaper → built theme → painted. |
| `DemoPanel.js` | The only module allowed to reach past the service interface (`services.__mock`). Does not exist once native supplies those namespaces. |
| `BridgeStatus.js` | Which namespaces resolved native vs mock, plus a live event log. |

---

## Screens — `src/screens/`

Each exports `{ el, update(state), destroy() }` and optionally `bottom` — the
element it wants in the bottom interaction slot.

| Screen | Bottom slot | Notable |
|---|---|---|
| `DialerScreen` | the keypad | The keypad **is** the search here (T9), so no second search field competes for the most valuable space on screen. |
| `RecentsScreen` | search bar | Filter chips hide themselves when their count is zero. |
| `ContactsScreen` | search bar | Sticky A–Z headers, jump rail, top-of-mind row, duplicate suggestions. |
| `YouScreen` | *nothing* | A profile page has no list to search. Profile + five shortcuts; everything else one tap away. |
| `OnboardingScreen` | — | Three steps, last two skippable. Full-screen takeover; the dock is hidden. |
| `SearchOverlay` | — | Grows upward out of the search bar. Searches people, numbers, calls **and your notes**. |

---

## Anti-duplication rules

- **One `Avatar`.** Every place a person is depicted uses it, so the
  photo/no-photo rule cannot drift.
- **One `Chip`.** Spam verdicts, SIM labels, filters and durations are all the
  same component with a different `tone`.
- **One `Sheet`.** Every bottom panel — history, contact, settings, pickers —
  shares entrance, dismissal, focus trapping and dock clearance.
- **One identity resolver.** `resolveIdentity()`. No screen decides who is
  calling.
- **One formatter module.** No component formats a timestamp itself.
