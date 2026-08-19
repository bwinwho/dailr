# DIALR — frontend UI/UX architecture

A replacement Android dialer and contacts app. This repository is the **UI/UX
and frontend systems architecture**: a complete, running HTML/CSS/JS product
built on mock data, plus the contracts the future Kotlin layer implements.

> The phone functionality should be familiar and dependable.
> The experience around it should feel completely different.

There is no Android code here, by design. See
[`docs/ANDROID_INTEGRATION_MAP.md`](docs/ANDROID_INTEGRATION_MAP.md) for exactly
what Kotlin owns, what the frontend owns, and how the two talk.

---

## Run it

```bash
node tools/serve.mjs        # http://localhost:4173
```

No build step, no bundler, no dependencies. Plain ES modules, which is also how
the files are served inside the Android WebView (via `WebViewAssetLoader`).

Everything runs on the seeded mock database in `src/data/`, including calls:
**Settings ▸ Advanced ▸ Demo controls** simulates incoming calls of each
identity tier, spam, call waiting, offline, and revoked permissions.

Optional developer tools:

```bash
node tools/gen-wallpapers.mjs   # regenerate the curated wallpaper library
node tools/shoot.mjs            # scripted screenshot tour (needs playwright)
```

---

## What is actually built

| | |
|---|---|
| **Contextual floating dock** | Two rows. Navigation never leaves; context grows above it. |
| **Human-readable history** | "Last night · She called you", not arrows and timestamps. |
| **Expandable recent cards** | Action layer opens in place. Nothing navigates away. |
| **Check Rewind** | A relationship recap, computed on-device, told as a story. |
| **Call notes** | 50 characters, attached to a call, surfaced in History. |
| **Smart reminders** | Callback reminders, optionally telling the other person. |
| **Layered call protection** | Your rules → your lists → network signal. Emergency exempt. |
| **Three-store identity** | Device contact / DIALR profile / your private data, never merged. |
| **Wallpaper theming** | Monochrome by default; a wallpaper lends a restrained accent. |
| **112 settings** | Schema-driven, searchable, progressively disclosed. |
| **Full call stack** | Incoming, active, hold, second call, swap, merge, post-call. |

Smart features beyond the brief — T9 name search, callback debt, best-time-to-call,
silent hours with an urgent-caller bypass, first-time-caller tags, top-of-mind,
duplicate merge suggestions — are documented in
[`docs/SMART_FEATURES.md`](docs/SMART_FEATURES.md). Every one is off-switchable
and computed locally.

---

## Layout

```
index.html                  entry; loads styles and boots src/app/main.js
src/
  app/         boot, intents, overlay host, call host, theme controller
  core/        store, DOM layer, event bus, language formatting, icons, haptics
  state/       reducers, selectors, dock controller, settings schema, smart layer
  services/    native bridge + interfaces + mock implementations
  theme/       OKLab colour science, palette extraction, theme engine
  components/  reusable UI (primitives, dock, dialer, recents, contacts, call, profile)
  screens/     dialer, recents, contacts, you, onboarding, search
  styles/      tokens → base → components → screens
  data/        seeded mock database, media catalogue, generated avatars
assets/wallpapers/   the curated library (generated SVG)
tools/               dev server, asset generator, screenshot harness
docs/                the architecture documentation set
```

---

## Documentation

| File | What it answers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the frontend is put together, and why. |
| [ANDROID_INTEGRATION_MAP.md](docs/ANDROID_INTEGRATION_MAP.md) | **Kotlin developer starts here.** |
| [DATA_CONTRACTS.md](docs/DATA_CONTRACTS.md) | Every object shape crossing a boundary. |
| [STATE_MODEL.md](docs/STATE_MODEL.md) | Store shape, state machines, selectors. |
| [COMPONENT_MAP.md](docs/COMPONENT_MAP.md) | Every component, its props and its owner. |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, typography, motion, the rules. |
| [SCREEN_SPECIFICATION.md](docs/SCREEN_SPECIFICATION.md) | Every screen and every state of it. |
| [CUSTOMIZATION_SYSTEM.md](docs/CUSTOMIZATION_SYSTEM.md) | Theming, media, priority rules, budgets. |
| [SMART_FEATURES.md](docs/SMART_FEATURES.md) | The derived intelligence and its limits. |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | What is guaranteed and how it is enforced. |
| [OPEN_DECISIONS.md](docs/OPEN_DECISIONS.md) | Product questions deliberately left open. |

---

## Non-negotiables

Three rules the architecture actively enforces, because breaking them breaks the
product rather than just the styling:

1. **Safety colours are never themed.** Answer green, decline red and emergency
   red are re-asserted on every theme build. A wallpaper cannot recolour the
   button that hangs up a call.
2. **The identity hierarchy is implemented once.** Saved name → DIALR profile →
   phone number, in `resolveIdentity()`. No screen decides for itself who is
   calling.
3. **Cloud is an enhancement, never a dependency.** Dialling, answering,
   contacts, history, notes and local customisation all work with Firebase,
   Cloudinary and the network entirely absent.
