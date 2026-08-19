# DIALR — UI Revision Plan

**Status:** approved plan, not yet implemented.
**Audit tool:** `node tools/audit.mjs` — re-run after each phase to verify.

---

## 0. What the audit measured

Not opinion. Numbers, from `tools/audit.mjs` at 360px and 412px viewports.

| Defect | Measured | Target |
|---|---|---|
| **Dialer layout shift** while typing 6 digits | **122px** of keypad movement | **0px** |
| Recent card heights | 126px – 195px (69px swing) | 84px – 112px, ≤28px swing |
| Gap between cards | 8px (vs 16px internal padding) | 12px gap, 14px padding |
| Name sizes on adjacent cards | 38 / 30 / 20px, hard steps | fluid, fitted per card |
| Names clipped at 360px | `Mr. Pr…`, `+91 84710 022…` | none above 22px floor |
| Timestamp wrapping to 2nd line | **every card** at 360px | never |
| Cards visible per screen (360px) | 3 | 6–7 |
| Interactive targets under 44px | `.rcard__action` **15px**, `.profile__topaction` **15px**, filter chips 30px, `.crow__call` 40px | all ≥44px |
| Filter chips at 360px | wrap to a second row | horizontal scroll, one row |

**The `Mr. Pr…` you saw is real and reproducible:** at 360px the name element gets
178px and needs 204px.

---

## 1. Root cause

I designed for the hero case and patched outward from it.

"AVNI" at 38px looks superb. "Mr. Prasad" at 38px doesn't fit → I added size
stepping (3 buckets) → the column went ragged. Then the timestamp stopped
fitting beside the name → I made the line wrap → **every card grew a row**. Then
cards got tall → the 8px gap stopped reading as separation → it feels cramped.

Each fix created the next problem. The card needs restructuring, not another
patch.

Same pattern on the dialer: the dock's context row shares a bottom-anchored
stack with the keypad, so the dock growing a CTA moves the keypad. That is a
**structural** fault, not a tuning problem.

---

## 2. Design decisions

### D1 — The card loses two rows

Current: eyebrow / name+time / sentence / chips / note = **5 zones**, with the
avatar and call button eating 30% of a 360px screen on the right.

```
CHHETRI                      ☏  ◉
AVNI          10 mins ago
Avni called you.
[ 6M ]
▎Red skirt — Amazon
```

New: avatar **left** (anchors the scan, frees the name), everything secondary
folded into one dim meta line.

```
◉   AVNI                       10m   ☏
    She called you · 6 min
    ▎Red skirt — Amazon
```

- **Surname dropped from the card.** It survives on History, the contact sheet
  and the call screens, where there is room. On a dense list it is the
  definition of "too much going on".
- **Status becomes coloured text in the meta line, not a chip box.** `Missed
  call · call back` in warn colour. Saves a whole row per card.
- **Duration folds into the meta line** (`· 6 min`) instead of a chip.
- **One chip survives**: suspected spam, because it needs a shield icon and real
  prominence. Nothing else gets a box.
- **`Trusted` disappears from the list** — it belongs on the contact sheet and
  the incoming screen, not on every Blinkit delivery call.

Result: ~86px without a note, ~112px with. 6–7 cards per screen instead of 3.
**That is the breathing** — fewer wasted pixels inside each card, more air
between them.

### D2 — Type that actually fits

Replace the three-bucket stepping with measured fitting.

```js
fitText(el, { max: 34, min: 22 })   // shrink until scrollWidth ≤ clientWidth
```

One utility in `core/dom.js`, used by the recent card, history header, contact
sheet, profile and call screens. ~4 measurements per element, ~15 elements
visible — negligible.

Below the 22px floor, ellipsis is genuinely correct (a 40-character name has no
good answer). Above it, nothing is ever clipped again.

### D3 — The keypad is nailed down

Two independent causes, both fixed structurally:

1. **`.numdisp` reserves its match row permanently** (`min-height`), so the
   readout does not grow when a contact matches.
2. **On the Dialer, the call action moves out of the dock and into the deck** —
   a full-width Call button directly under the keypad, always present, label
   changing between `Call` (disabled) and `Call Avni`.

That second one is also just better: on a dialer the call button belongs with
the keypad. The contextual dock keeps doing its job on Recents, Contacts and
overlays, where content above does not shift.

3. **The dock's context row becomes absolutely positioned** above the nav row,
   so the dock's layout height is constant everywhere. Nothing above the dock
   can ever be moved by it again.

Suggestions while typing render in the scroll area above the deck, which is
already bottom-anchored — they grow upward and touch nothing.

### D4 — History becomes a screen

You are right that it should not be a popup. It is a destination, not a peek,
and as a sheet it was clipped at the top with no visible chrome.

It becomes a pushed full screen with its own header, **with the dock still
visible** (the brief requires that, and it is correct — you can still jump to
the keypad from someone's history).

- Real header: back arrow · name · call button.
- The fake `SEND A TEXT / HISTORY` tab pair is deleted. Replaced with a row of
  icon buttons: message · whatsapp · remind · more.
- **`CLEAR THE HISTORY` leaves the top-right.** A destructive action does not get
  prime real estate. It moves into the `⋯` menu.
- Note bubbles shrink and cap at two lines. Currently they are visually larger
  than the calls they annotate.
- `CHECK REWIND` becomes the last row of the list instead of a floating slab
  that slices the entry above it.

### D5 — Dock: icons only

No text label on the active pill. Icon + filled pill + badge. As requested.

### D6 — Deletions

| Removed | Why |
|---|---|
| **Top of mind** (dialer + contacts) | you asked; it duplicated Recents |
| **"Just now" recent list on the empty dialer** | you asked; the dialer should be a keypad |
| **`5 TO CALL BACK` dock bar** | it is a filter, and it already exists as a filter chip |
| Surname eyebrow on recent cards | see D1 |
| Duration / SIM / call-count chips on cards | folded into the meta line |
| `Trusted` chip on recent cards | wrong surface |
| The `SEND A TEXT / HISTORY` pseudo-tabs | see D4 |

Nothing here loses a capability — every one of them still exists somewhere it
belongs.

---

## 3. Screen-by-screen work

### 3.1 Dialer — `src/screens/DialerScreen.js`, `components/dialer/*`

- [ ] Delete `renderTopOfMind()` and `renderEmpty()` (the "Just now" list) entirely.
- [ ] `.numdisp` gets a fixed `min-height` covering both match/no-match states.
- [ ] Add a persistent `DialCallButton` to `dialer__deck`, below the keypad.
      Disabled + label `Call` when empty; `Call Avni` / `Call +91 …` when there
      is a target. Long-press → SIM picker.
- [ ] `dockController.dialerContext()` returns **nav only** — no primary, no
      secondary. The dialer owns its own call action now.
- [ ] Reduce `--key-size` to `clamp(52px, 17vw, 68px)` to pay for the button.
- [ ] Suggestions list stays in the scroll area; cap at 4 rows.
- [ ] **Verify: `node tools/audit.mjs` reports 0px keypad movement.**

### 3.2 Recent card — `components/recents/RecentCard.js`, `styles/components/cards.css`

- [ ] Restructure to: `[avatar] [name | time] [meta] [note?] [call]` per D1.
- [ ] Avatar moves left, 44px.
- [ ] Delete the eyebrow, the sentence row and the chip row.
- [ ] New single `.rcard__meta` line: `{relative} · {sentence} · {duration}`,
      colour-shifted by disposition (warn for missed/owed, negative for spam).
- [ ] Keep exactly one chip, spam only.
- [ ] Note: one line, clamped, keeps the left rule.
- [ ] Apply `fitText` to the name (34 → 22).
- [ ] Card padding 16 → 14; card gap 8 → 12.
- [ ] Expanded state: the four actions become **44px rows**, not 15px text links.

### 3.3 Recents screen — `src/screens/RecentsScreen.js`

- [ ] Filter chips: `min-height: 36px`, single row with horizontal scroll and an
      edge fade — never wrap.
- [ ] Remove the `owed` dock-aux entry (it is a filter chip already).

### 3.4 History — `components/recents/HistoryPanel.js` → new `src/screens/HistoryScreen.js`

- [ ] Convert from a `Sheet` overlay to a pushed screen with the dock visible.
- [ ] Header: back · name (fitted) · call.
- [ ] Action row: message · whatsapp · remind · more (44px icon buttons).
- [ ] `Clear history` into the `⋯` menu.
- [ ] Entry rows: single meta line, note bubble max 2 lines and visually
      subordinate.
- [ ] `Check Rewind` as the final list row.

### 3.5 Dock — `components/dock/FloatingDock.js`, `styles/components/dock.css`

- [ ] Remove `.dock__nav-label` entirely.
- [ ] `.dock__context` → `position: absolute; bottom: 100%` so dock layout height
      is constant.
- [ ] Re-measure `--bottom-actual` from the nav row only.

### 3.6 Contacts / Profile / Settings

- [ ] `.crow__call` 40 → 44px.
- [ ] `.profile__topaction` → 44px targets (padding, not font size).
- [ ] `.you__seg-opt` 40 → 44px.
- [ ] Profile two-column bio → single column below 380px; poster moves under it.
- [ ] Delete the Top of mind strip from Contacts.

### 3.7 Global

- [ ] `fitText` utility in `core/dom.js`.
- [ ] Audit sweep: no interactive element below 44×44.

---

## 4. Order of work

Each phase is independently verifiable and independently shippable.

| Phase | Work | Verify with |
|---|---|---|
| **1** | D3 — kill the dialer shift (deck height, dial button, dock context absolute) | audit reports **0px** movement |
| **2** | D1 + D2 — rebuild the recent card, `fitText` | card heights 84–112px, no clipping at 360px |
| **3** | D5 + D6 — icons-only dock, all deletions | visual |
| **4** | D4 — History as a screen | no overlap, nothing clipped |
| **5** | 3.6 + 3.7 — touch targets, profile reflow | audit reports **0** small targets |

Do not batch phases. Re-run `tools/audit.mjs` between each — every defect above
is measurable, so "it looks better" is not the standard.

---

## 5. What is explicitly NOT changing

So the revision does not quietly become a redesign:

- The monochrome + wallpaper-accent theme system. It works and you liked it.
- The identity hierarchy (saved > DIALR > number).
- The incoming and active call screens. They audited clean — no truncation, no
  overlap, no small targets.
- The service layer, state model and every data contract.
- The editorial type voice. It stays; it just stops breaking at 360px.
