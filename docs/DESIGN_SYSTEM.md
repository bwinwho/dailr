# DIALR — Design System

Tokens, typography, motion, and the rules that keep the product coherent as it
grows.

---

## 1. The premise

> DIALR is black and white. A wallpaper may lend the interface its colour, but
> only as a touch. Never a repaint.

Everything below follows from that sentence. The default product is monochrome
and editorial; colour arrives from the user's own wallpaper, heavily restrained,
and can be switched off entirely without the design falling apart.

---

## 2. Token layers

`src/styles/base/tokens.css`. Four layers, in order. Never skip one.

| Layer | Contains | Who may use it |
|---|---|---|
| **L1 primitives** | raw scales — neutral ramp, spacing, radii, durations, type sizes | nothing directly |
| **L2 semantic** | `--bg`, `--surface-1..4`, `--fg`, `--accent`, `--positive`… | components |
| **L3 themed** | the same L2 names, overwritten at runtime by the theme engine | — |
| **L4 component** | `--dock-h`, `--card-radius`, `--key-size`, `--bottom-zone` | components |

**Rule:** a component stylesheet references L2 and L4 only. Because L3 reuses
L2's names, no component ever learns that theming exists.

---

## 3. Colour

### Neutral ramp

`--n-0` … `--n-100`, pure achromatic. Dark mode maps `--bg` to `#000` (true
black — OLED, and it is the brand); light mode maps it to `#fff`. Light is a
deliberate mirror, not a tint of dark.

### Semantic roles

```
--bg  --bg-elevated  --surface-1..4  --surface-inset
--fg  --fg-secondary  --fg-tertiary  --fg-quaternary  --fg-on-accent
--line  --line-strong  --line-hairline
--accent  --accent-ink  --accent-soft  --accent-line  --accent-glow
--accent-2  --accent-2-soft
--scrim (rgb triplet)  --overlay-veil
```

### Safety colours — never themed

```
--positive   #16c65a   answer
--negative   #f5333f   decline
--warn       #ffb020
--danger     #ff5a5f
--info       #4aa8ff
--note       #ffd166
```

These are **re-asserted explicitly on every theme build**, not inherited. A
wallpaper cannot recolour the button that hangs up a call, and no future
refactor can let one leak in through an inherited value.

This is also why "DIALR Standard" (monochrome) still shows a red spam chip and a
green answer button: those are semantic, not decorative.

### Colour maths: OKLab, not HSL

All theme maths happens in OKLab/OKLCH (`src/theme/color.js`).

HSL lies about lightness: `hsl(60,100%,50%)` (yellow) and `hsl(240,100%,50%)`
(blue) are wildly different in perceived brightness. An HSL-derived accent looks
scorching on one wallpaper and invisible on the next. OKLCH is perceptually
uniform, so clamping L and C to a fixed window produces a consistent, restrained
result across every image.

Out-of-gamut colours have their **chroma reduced by binary search**, never
clipped per channel — per-channel clipping shifts hue, which is the one thing a
wallpaper theme must not do.

Everything is computed in JS and written out as plain hex, so nothing depends on
`oklch()` or `color-mix()` support in the host WebView.

### Contrast guarantees

Verified in the engine, on every build:

| Pair | Minimum | Why |
|---|---|---|
| `--fg` on `--bg` | 21:1 | pure black/white by construction |
| `--fg` on `--surface-2` | ≥ 14:1 | body text on cards |
| `--accent` on `--bg` | ≥ 3.0:1 | icons and 20px+ display text |
| `--accent-ink` on `--accent` | ≥ 4.5:1 | text on filled buttons |

An accent that fails is lifted along L until it passes, and `meta.warnings`
records that it happened.

---

## 4. Typography

Typography is the product's identity, not decoration. Three voices:

| Voice | Family | Use |
|---|---|---|
| **Display** | Archivo Expanded / Roboto Flex `wdth 112` | names, screen titles, times of day, Rewind numbers |
| **Text** | Inter Tight / Roboto Flex | everything readable |
| **Numeric** | tabular figures | durations, timers, the dial readout |

Web fonts are **progressive enhancement only**. The fallback stack is chosen so
an offline Android WebView renders the intended proportions — Roboto Flex exposes
a width axis we drive to 112–118 to match Archivo Expanded's expanded feel. No
layout depends on the font files arriving.

### Roles, not sizes

Components ask for a role. `src/styles/base/typography.css`:

```
.t-screen-title   48px  900  uppercase  -0.04em   RECENTS / HISTORY / CONTACTS
.t-display-xl/l/m/s     800  uppercase  -0.03em   names, Rewind values
.t-eyebrow        12px  700  uppercase  +0.04em   the surname above a name
.t-title / .t-title-lg  600/700                    sheet and section headings
.t-body / -sm / -lg     400                        prose
.t-label          12px  700  uppercase  +0.08em   buttons, actions, day-parts
.t-micro         10.5px 700  uppercase  +0.14em   chips, captions
.t-num                  tabular                    timers, durations, numbers
```

Every size multiplies by `--fs` (0.9–1.35), so Accessibility ▸ Text size scales
the entire product from one variable.

### Type rules

- **A name is never truncated before the timestamp wraps.** Cards step the name
  down through three sizes, then let the timestamp drop to its own line. "BLIN…"
  tells the user nothing.
- **A raw number leaves display type entirely.** Unknown callers render in
  tabular numerals at title size — a phone number is data, not a name.
- **Rewind values are fluid** (`clamp`), because the text is arbitrary and three
  fixed steps still leave cases that wrap badly.

---

## 5. Spacing, radius, elevation

- Spacing: 4pt base with 2pt half-steps, `--sp-0` … `--sp-13`.
- Radius: `--r-xs` 6 → `--r-2xl` 34 → `--r-pill`. Cards use `--r-lg` 22; the
  dock and sheets use `--r-2xl` 34.
- Elevation: five shadow steps plus `--sh-dock`. Light mode redefines them
  softer — a dark-mode shadow on white looks like dirt.

---

## 6. Motion

```
--d-instant  90ms    key presses
--d-fast    150ms    hovers, small toggles
--d-base    240ms    default
--d-slow    380ms    card expansion, sheet entrance, dock morph
--d-xslow   620ms    wallpaper cross-fade

--e-standard  cubic-bezier(.2,.8,.2,1)     emphasised deceleration
--e-enter     cubic-bezier(.05,.7,.1,1)
--e-exit      cubic-bezier(.3,0,.8,.15)
--e-spring    cubic-bezier(.16,1.16,.3,1)  dock morph, card expand
```

Every duration multiplies by `--motion-scale`, so reduced motion is **one
variable**, not a hundred media queries. `[data-motion="reduced"]` sets it to
0.001; `prefers-reduced-motion` applies unless the user explicitly chose "Full".

Motion is used for: dock transitions, card expansion, history expansion, call
transitions, scrim, media and theme changes. It is not used for decoration.

---

## 7. The scrim

Not a flat modal wash. A **bottom-weighted gradient** that lifts search and the
dock off the content without hiding it:

```css
linear-gradient(to top,
  rgba(var(--scrim), .80)  0%,
  rgba(var(--scrim), .58) 26%,
  rgba(var(--scrim), 0)   62%);
```

Content also dissolves into the bottom zone via a `mask-image` on every scrolling
body, so a card is never sliced by the search bar. Overlays escalate to
`is-full` — a flat wash plus blur — because a sheet genuinely is a foreground
context.

---

## 8. Geometry and the one-handed zone

```
--dock-h 64   --dock-inset-b 14   --search-h 52   --search-gap 10
--touch-min 48        never render an interactive target smaller
--key-size clamp(58px, 19vw, 76px)
```

`--bottom-actual` is **measured at runtime** by a `ResizeObserver`, because the
bottom zone's height is not constant: keypad on the dialer, search bar on
Recents and Contacts, nothing on You. Screen padding, scroll masks, toasts,
sheets, search results and the contacts index rail all read it. Nothing
hard-codes a guess.

---

## 9. Depth

One z-index ladder, declared once in tokens:

```
wallpaper 0 · screen 10 · header 15 · scrim 40 · search 50 · dock 60
sheet 70 · modal 80 · call 90 · toast 100 · dev 110
```

Nothing invents a z-index. Components mount into a shell root
(`src/app/shell.js`) rather than creating their own layer.

---

## 10. Iconography

24×24 grid, 1.7px stroke, round caps, `stroke="currentColor"` — icons carry no
colour so a themed accent flows through by inheritance.

Filled variants exist for exactly two icons: answer and decline. Those must read
as solid targets at a glance, not outlines.

---

## 11. Component conventions

- **Circles** for people and actions: avatars, call buttons, quick actions.
- **Pills** for containers: dock, search, CTA, chips.
- **Cards** float on the background with generous internal padding; they do not
  use borders to separate — space and elevation do that.
- **Short rules** (the 116px white line) separate sections inside cards, echoing
  the editorial references.
- **Notes are paper-white** wherever they appear — history bubbles, the incoming
  call line. White-on-dark says "this is yours, handwritten", and it is the one
  place the mono palette is used as a material rather than a colour.

---

## 12. Adding to the system

1. Does an existing token express it? Use it.
2. Is it a new *meaning*? Add an L2 semantic token and map it per mode.
3. Is it a one-off value? It is not a token. Put it in the component stylesheet.
4. Is it a colour that must never change? Add it to the fixed block **and** to
   the explicit re-assertion in `themeEngine.js`, or a wallpaper will eventually
   recolour it.
