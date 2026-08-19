# DIALR — Accessibility

The design is visually ambitious. That is not a licence to be inaccessible, and
critical phone actions must be obvious to everyone.

---

## Guarantees

| Guarantee | How it is enforced |
|---|---|
| Minimum 48px touch target | `--touch-min` on every `Button`, `IconButton`, field row and dock item |
| Text contrast ≥ 14:1 on surfaces | `--fg` is pure black/white; the theme engine never gives text chroma |
| Accent contrast ≥ 3:1 on background | verified per theme build; lifted along L if it fails |
| Ink on accent ≥ 4.5:1 | `readableInk()` picks black or white per accent |
| Text scaling 90–135% | `--fs` multiplies every type token from one variable |
| Reduced motion | `--motion-scale` → 0.001 disables every transition at once |
| Focus visible | 2px accent outline, 3px offset, on `:focus-visible` only |
| Screen reader names | every icon-only control has a mandatory `label` |

---

## Contrast

Text never takes chroma — `--fg` stays `#ffffff` or `#000000`. This is why the
wallpaper tint cannot degrade readability no matter how strong the image.

Surfaces carry OKLCH chroma of at most 0.020 (halved again in light mode), which
moves lightness by less than 1%.

**High contrast** (Settings ▸ Accessibility) does three things:

- collapses `--fg-secondary` and `--fg-tertiary` into `--fg`
- promotes hairlines to `--line-strong`
- **removes the wallpaper tint from surfaces entirely** — the tint's whole job
  is to be almost invisible, which is the opposite of what this mode wants

Wallpaper images render at 14–36% opacity behind a gradient veil that is heavier
where UI chrome sits, so content contrast never depends on the artwork.

---

## Motion

One variable:

```css
--motion-scale: 1;              /* every duration multiplies by this */
[data-motion="reduced"] { --motion-scale: 0.001; }
@media (prefers-reduced-motion: reduce) {
  :root:not([data-motion="full"]) { --motion-scale: 0.001; }
}
```

The system preference is honoured unless the user explicitly chose "Full".

Specifically disabled under reduced motion: the answer-button pulse, the Rewind
panel entrance, skeleton shimmer, and the swipe-to-answer hint.

`afterTransition()` in `core/dom.js` has a timeout fallback, because
`transitionend` never fires when durations are effectively zero — without it,
sheets would never finish closing under reduced motion.

---

## Touch and reach

- Everything primary lives in the bottom third. Search sits above the dock;
  expanded views grow **upward** from the interaction zone rather than forcing a
  reach to the top.
- Answer and decline are the largest targets in the product (78px, 96px with
  "Larger answer and decline buttons").
- Swipe gestures are additive — every swipe action has a tapped equivalent.
- Drag-to-dismiss on sheets starts only from the grabber or header, so the body
  still scrolls normally.

---

## Screen readers

- `IconButton` requires `label`; it becomes `aria-label`, and optionally a
  visible caption via Accessibility ▸ Always label icons.
- Toggle states use `aria-pressed` / `aria-checked`; the dock's active tab uses
  `aria-current="page"`.
- Sheets are `role="dialog"`; destructive confirmations are `role="alertdialog"`
  with `aria-modal`. Both trap focus and restore it on close.
- Toasts are `role="status"` with `aria-live="polite"` — announced, never
  interrupting.
- Decorative elements (avatars beside a name, dock indicator, progress bars) are
  `aria-hidden`.
- Icons are `aria-hidden focusable="false"`; the accessible name always comes
  from text.

---

## Keyboard and switch access

Full parity, which matters for switch access on Android as much as for desktop
development:

| Key | Action |
|---|---|
| `0-9`, `*`, `#`, `+` | dial (on the Dialer tab) |
| `Backspace` | delete a digit |
| `Enter` | place the call |
| `Escape` | close the deepest open thing — overlay → search → expanded card |
| `Tab` / `Shift+Tab` | cycle, trapped inside sheets and modals |
| `←` / `→` / `Space` | navigate Rewind panels |

---

## Language

- History and Recents use sentences, not symbol decoding. *"Missed call"* rather
  than a red arrow whose meaning must be learned.
- Every setting has a one-sentence explanation in plain language. If a setting
  cannot be explained in one sentence, the feature is wrong, not the copy.
- Errors say what happened and what to do next.
- **Pronouns are never inferred.** Unset contacts read as they/them; the user
  sets them per contact in the private data group.

---

## Colour is never the only signal

| Meaning | Colour | Also |
|---|---|---|
| Answer / decline | green / red | different icons, fixed positions |
| Missed | warn | the word *"Missed"* on the chip |
| Spam | negative | the word *"Likely spam"* + shield icon |
| Trusted | positive | the word *"Trusted"* + shield-check icon |
| Selected filter | inverted fill | `aria-pressed` |
| Active tab | inverted pill | visible label appears + `aria-current` |

---

## Known gaps

Stated rather than glossed:

- **RTL** is not implemented. The layout uses physical properties in places
  (`left`/`right`, `translateX`). Converting to logical properties is a
  contained pass and is not done.
- **Localisation** — all copy is English and inline. Relative-time and call
  sentences are generated in `core/format.js`, which is the right place to add
  an ICU-style layer, but there is no locale plumbing.
- **Font scaling above 135%** is not handled; Android's largest accessibility
  sizes would need a reflow pass on the card headline.
- **TalkBack** has not been tested on a device — the semantics above are correct
  by construction, but nothing beats a real screen reader on real hardware.
