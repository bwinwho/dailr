# DIALR — Customization System

Customization is a first-class subsystem, not a settings page. This document
defines what can be customised, how conflicts resolve, and the limits that keep
a user's 4K video from making the dialer unusable.

---

## 1. The governing rule

> Monochrome by default. A wallpaper lends the interface an accent. It never
> repaints it.

Three restraints follow, and they are enforced in code rather than in guidance:

1. **Text never takes chroma.** `--fg` stays pure black or white. Readability
   and the product's identity both depend on it.
2. **Surfaces take a whisper.** OKLCH chroma 0.005–0.020, scaled by mode. Enough
   that a warm wallpaper makes the cards feel warm; never enough to read as
   "coloured UI".
3. **One accent, plus at most one secondary,** and the secondary only unlocks at
   higher intensities.

---

## 2. What is customisable

| Scope | Surface | Where |
|---|---|---|
| Global | app wallpaper (and therefore the accent) | Settings ▸ Look ▸ Wallpaper |
| Global | mode: dark / light / auto | Look, and You tab |
| Global | colour intensity: off / subtle / balanced / expressive | Look |
| Global | show or hide the wallpaper image (keeping its colours) | Look |
| Global | default ringtone | Sound |
| Global | dock style, card density, oversized names, search visibility | Look |
| Per contact | call background | Contact sheet ▸ Only you see this |
| Per contact | ringtone | same |
| Per contact | preferred SIM, label, pronouns, note, saved place | same |
| Profile | avatar, poster imagery, bio composition, four links | You ▸ Edit profile |

Contact-level customisation is **private relationship data**. It lives on the
device, never syncs, and the other person never learns about it.

---

## 3. Priority resolution

Formalised in `selectors.js › resolveCallBackground` and
`themeController.js › compute`.

### Call background

```
contact-specific background        ← you chose it for this person
        ↓  (absent)
their DIALR profile poster         ← only if profile lookup is on and online
        ↓  (absent)
your global wallpaper
        ↓  (absent, or Standard style)
none — flat --bg
```

### Ringtone

```
contact ringtone  →  global ringtone  →  DIALR default
```

### Theme

```
DIALR Standard  →  monochrome, full stop. Nothing below is consulted.
        ↓  (Expressive)
wallpaper palette + intensity  →  accent + surface tint
        ↓  (achromatic wallpaper, or intensity: off)
monochrome
```

**Standard short-circuits everything.** A user who picks "DIALR Standard" gets a
pure black-and-white product regardless of what wallpaper is set, which is the
point of offering it.

---

## 4. Palette extraction

`src/theme/palette.js`. Given any image, produce an honest description of its
colour.

1. Draw to a 56×56 canvas, cover-fitted (~3k pixels, ~2 ms).
2. Convert every pixel to OKLCH.
3. Discard `L < 0.10` and `L > 0.955` — they carry no usable hue and dominate
   photographs.
4. Bucket by hue (24 bins of 15°) × lightness (5 bins), plus a neutral bucket
   for `C < 0.022`.
5. Score each bucket:
   `coverage × chromaWeight × lightnessWeight`, where `chromaWeight` favours
   genuinely chromatic pixels and `lightnessWeight` peaks around L 0.60.
6. `dominant` = highest-scoring chromatic bucket.
   `secondary` = the next one **more than 38° away in hue** and within a factor
   of the dominant's score.
7. If chromatic coverage is under 7% and mean chroma under 0.030, return
   `achromatic: true`.

### Honesty

`achromatic: true` means *this image has no usable colour*, and the app stays
black and white. A greyscale wallpaper produces no tint at any intensity. This
is verified by the two deliberately monochrome built-ins, **Void** and **Paper**.

### Built-ins skip extraction

Curated wallpapers ship a `palette` in their `MediaAsset` (computed at authoring
time, and the admin panel is expected to do the same at upload). Extraction runs
only for user-supplied media. The engine cannot tell the difference.

### Why not Android's Palette API

`androidx.palette` works in HSL/RGB and returns "vibrant/muted" swatches tuned
for Material's colour system. It gives no perceptual-lightness guarantee, so the
same swatch can be twice as visually loud on one image as another. DIALR's whole
restraint policy is built on clamping OKLCH L and C. If a native implementation
is preferred, it must return the `Palette` contract computed the same way.

---

## 5. Intensity

The user-facing "how much colour" control.

| Level | Accent chroma cap | Surface chroma | Wallpaper opacity | Boost | Second hue |
|---|---|---|---|---|---|
| Off | 0 | 0 | 0 | — | no |
| **Subtle** *(default)* | 0.052 | 0.005 | 0.14 | 0 | no |
| Balanced | 0.098 | 0.011 | 0.24 | ×1.35 | yes |
| Expressive | 0.150 | 0.020 | 0.36 | ×1.90 | yes |

**Boost** lets higher levels saturate a muted wallpaper a little, but the
per-level cap always wins: a grey-blue photo can never become neon. Without it
the slider does nothing on muted images, which reads as broken.

**Mode scaling.** Surface chroma is multiplied by `tintScale`: 1.0 in dark,
**0.50 in light**. The same OKLCH chroma is far more visible at high lightness —
a tint that whispers on `#1a1a1a` shouts on `#e8e8e8`.

**High contrast** sets surface chroma to zero entirely. It is an accessibility
mode, and the tint's whole job is to be almost invisible.

---

## 6. Wallpaper library

12 curated assets in two packs (`src/data/media.js`, generated by
`tools/gen-wallpapers.mjs`):

| Pack | Assets |
|---|---|
| DIALR | Void*, Deep Green, Ember, Sodium, Cobalt Rain, Ultraviolet, Blush, Concrete†, Bone, Paper* |
| KODE31 MUSIC | K31 Chrome, K31 Signal |
| Yours | anything from the device |

\* deliberately achromatic — proves the monochrome path
† deliberately low-chroma — the accent stays near grey

They are generated SVG (mesh gradients plus film grain), so the repository stays
text-only and every wallpaper is a known, deliberate palette that the theme
engine can be tested against. The admin panel will later replace them with
Cloudinary assets through the **same `MediaAsset` contract**.

---

## 7. Media budgets

Native enforces these; the frontend renders the failures.

| | Image | Video |
|---|---|---|
| Max stored size | 2.5 MB | 12 MB |
| Max dimension | 1440px long edge | 1080×1920 |
| Max duration | — | 15 s |
| Output | JPEG / WebP | H.264 MP4, **no audio track** |

Over-budget input is rejected with `MEDIA_TOO_LARGE` / `MEDIA_TOO_LONG`, both of
which the frontend renders specifically rather than generically. Downscale and
transcode where you reasonably can rather than refusing.

**A user-supplied 4K video must never be played as the call background.** That
is the failure the budget exists to prevent, and it is the reason `prepare()` is
a separate step from `pick()`.

Video backgrounds additionally:

- pause when the screen is off or the app is backgrounded
- fall back to their first frame when battery saver is on
- never carry audio — a call background must not fight call audio

---

## 8. Live preview

The wallpaper picker themes the **entire app behind the sheet** as you tap, so
you judge the result rather than a thumbnail.

`themeController.sync()` is authoritative: it always recomputes from the store.
A preview is therefore self-cancelling — the next state change repaints the
committed theme, and `popOverlay()` calls `sync()` explicitly when the picker
closes.

> An earlier version latched a `previewing` flag inside `sync()` and swallowed
> every subsequent theme change — light mode silently stopped working. Recorded
> here because "temporary override flag" is a tempting and wrong shape.

Each tile also shows the accent DIALR would **actually** derive at the current
intensity, including "Mono" for achromatic images. No tile promises colour the
engine will refuse to produce.

---

## 9. Admin-supplied content

The system is designed so an administrator can add content without a client
release:

- New wallpapers, ringtones and visual packs are `MediaAsset` records.
- `pack` groups them; the picker renders whatever packs exist.
- `palette` is supplied by the publisher — compute it at upload.
- `metadata.note` surfaces an authoring note under the grid.
- KODE31 packs are ordinary packs with `source: 'kode31'`.

Nothing in the UI enumerates known pack names.

---

## 10. Offline behaviour

| Asset | Offline |
|---|---|
| Built-in wallpapers and ringtones | local files; unaffected |
| Previously applied user media | cached locally; unaffected |
| New Cloudinary uploads | fail with `OFFLINE`; the local copy still applies |
| A contact's DIALR poster | unavailable; falls through to your global wallpaper |

Customisation never blocks calling. The wallpaper is decoration on top of a
phone, and it degrades in that order.
