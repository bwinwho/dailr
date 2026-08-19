# DIALR — Data Contracts

Every object shape that crosses a boundary: native → frontend, cloud → frontend,
or store → component. If a field is not listed here, no component may depend on
it.

Conventions used below:

- `?` marks an optional field. Absent and `null` mean the same thing.
- Timestamps are **milliseconds since epoch**, in device local time.
- Durations are **seconds**, integer.
- `numberKey` is the **last 9 digits** of a phone number (see § numberKey).

---

## numberKey — the join key

```js
numberKey('+91 98420 04200')  // '842004200'
numberKey('098420 04200')     // '842004200'
numberKey('8420 04200')       // '842004200'
```

The last nine digits, digits only. This is how `+91 98…` matches `098…` matches
`98…`, which is the single most common real-world failure in call apps.

It is the primary key for: call log grouping, private relationship data, spam
verdicts, DIALR profile lookup, and identity resolution. Both sides of the
bridge must compute it identically — see
[ANDROID_INTEGRATION_MAP.md § 3.4](ANDROID_INTEGRATION_MAP.md).

Numbers shorter than nine digits (short codes, emergency numbers) use the full
string.

---

## DeviceContact

Android Contacts Provider. **Device truth. Never modified by DIALR's cloud.**

```ts
DeviceContact {
  id:           string          // provider row id
  source:       'device'
  displayName:  string
  firstName:    string
  lastName:     string          // '' when there is none, never null
  org:          string?         // company
  starred:      boolean
  numbers:      PhoneNumber[]   // at least one; exactly one has primary: true
  photoUri:     string?         // content:// or data:; NULL when no photo exists
  identityMark: string?         // frontend-generated initials mark, never a photo
  updatedAt:    number
}

PhoneNumber {
  id:      string
  value:   string               // as stored, any format
  label:   string               // 'Mobile' | 'Home' | 'Work' | 'Other' | custom
  primary: boolean
}
```

**`photoUri` must be null when no photograph exists.** Do not substitute a
generated image. The UI renders a visually distinct identity mark instead, and
the incoming-call screen depends on the distinction — the brief is explicit that
DIALR must not invent a face.

---

## DialrProfile

Firebase. **The person's own published identity.** Not device data.

```ts
DialrProfile {
  uid:             string
  handle:          string
  numberKey:       string
  firstName:       string
  surname:         string
  avatarUrl:       string?
  posterUrl:       string?      // tall imagery for profile / call background
  bio:             BioItem[]
  role:            string?      // 'Model at KODE31'
  squadMembers:    number
  profileViews:    number
  callPickupRate:  number       // 0–1
  links:           LinkType[]   // exactly the four the user chose to show
  verified:        boolean
  region:          string       // ISO country
  sign:            string?
  visibility:      'everyone' | 'dialr' | 'contacts' | 'squad' | 'nobody'
  updatedAt:       number
}

BioItem =
  | { kind: 'line',  text: string, tone?: 'accent' | 'warn' }
  | { kind: 'trait', text: string, tone?: 'accent' | 'warn' }
  | { kind: 'loves', items: string[] }

LinkType = 'whatsapp' | 'email' | 'website' | 'instagram' | 'snapchat'
         | 'telegram' | 'youtube' | 'x' | 'linkedin' | 'custom'
```

The bio is **a composition, not a paragraph** — that is what makes a profile read
as a poster rather than an account page. Each item is its own typographic object.

`visibility` is a *request*. Enforcement belongs in Firebase security rules; a
client-side check is not a privacy control.

---

## PrivateRelationship

**Yours alone.** Device-only. Never uploaded, never in the Contacts Provider,
never visible to the other person.

```ts
PrivateRelationship {
  contactKey:   string
  label:        string?         // 'Brother', 'Landlord'
  pronouns:     string?         // 'they/them' | 'she/her' | 'he/him' — unset = they/them
  note:         string?         // free text about them, yours
  savedPlace:   SavedPlace?
  ringtoneId:   string?
  backgroundId: string?
  preferredSim: string?
  favourite:    boolean
  vip:          boolean
  trusted:      boolean         // overrides network spam verdicts
  blocked:      boolean
}

SavedPlace { label: string, area: string, mapsUri: string }
```

`savedPlace` is **your memory of where they are**, not their live location.
Nothing about it is shared or requested from them.

`pronouns` unset means they/them. DIALR never infers pronouns from a name.

---

## CallLogEntry

Android CallLog + a DIALR-only note column you keep yourself.

```ts
CallLogEntry {
  id:          string
  number:      string
  contactKey:  string
  startedAt:   number
  durationSec: number           // 0 for unanswered
  simId:       string
  disposition: Disposition
  note:        string?          // ≤ 50 chars, DEVICE ONLY
  spamScore:   number           // 0–1 at the time of the call
  viaApp:      string
}

Disposition =
  | 'incoming-answered' | 'incoming-missed' | 'incoming-declined'
  | 'incoming-blocked'  | 'incoming-screened'
  | 'outgoing-answered' | 'outgoing-no-answer' | 'outgoing-busy' | 'outgoing-failed'
  | 'voicemail'
```

`disposition` is finer-grained than `CallLog.Calls.TYPE` on purpose — it is what
lets History say "You called Avni. No answer." instead of showing an arrow. The
mapping table is in
[ANDROID_INTEGRATION_MAP.md § 3.4](ANDROID_INTEGRATION_MAP.md).

Lists are always returned **newest first**.

---

## ContactView — projection, not storage

Built by `selectors.js › selContactViews` for rendering only. **Never written
back, never persisted, never uploaded.** It is the read-model that merges the
three stores.

```ts
ContactView {
  // from DeviceContact
  key, id, source, displayName, firstName, surname, org, starred,
  numbers, primaryNumber, photoUri, identityMark

  // from DialrProfile (null when they are not a DIALR user)
  dialr: DialrProfile | null
  isDialrUser: boolean

  // from PrivateRelationship (flattened for convenience)
  pronouns, label, note, savedPlace, favourite, vip, trusted, blocked,
  preferredSim, ringtoneId, backgroundId

  // derived
  initials, hasPhoto, avatar, lastCallAt, lastCall, callCount
  spam: SpamVerdict | null
}
```

Flattening private fields here is safe **because the object is never a write
target**. Every mutation goes back to the store it came from:
`contacts.update()` for device fields, `contacts.setPrivate()` for private ones.

---

## Identity resolution result

Returned by `resolveIdentity(state, number)`. The one implementation of the
hierarchy.

```ts
Identity {
  tier:     'saved' | 'dialr' | 'unknown'
  key:      string
  number:   string
  name:     string        // display name, or the formatted number at tier 'unknown'
  first:    string?       // the large headline on cards and call screens
  eyebrow:  string?       // the small surname above it
  sub:      string?       // 'On DIALR', a private label, a region
  view:     ContactView?  // present only at tier 'saved'
  profile:  DialrProfile? // present at tiers 'saved' and 'dialr'
  avatar:   string?
  hasPhoto: boolean       // false means: render an identity mark, not a photo
}
```

**The hierarchy, in order:**

1. `saved` — the name **you** stored the number under. Always wins, even when
   the caller's DIALR profile says something else. If you saved them as "Plumber",
   that is who is calling.
2. `dialr` — their published DIALR identity, when the number is not in your
   contacts and profile lookup is enabled and online.
3. `unknown` — the formatted phone number.

---

## CallSnapshot / CallSession

The whole call state, pushed with every call event. The frontend never
reconstructs call state from deltas, so a dropped event cannot desynchronise
the UI.

```ts
CallSnapshot {
  sessions:   CallSession[]   // ordered; index 0 is foreground
  muted:      boolean
  audioRoute: 'earpiece' | 'speaker' | 'bluetooth' | 'wired'
  conference: boolean
}

CallSession {
  id:          string
  direction:   'incoming' | 'outgoing'
  state:       'ringing' | 'dialing' | 'connecting' | 'active' | 'held'
             | 'ending' | 'ended' | 'failed'
  number:      string
  contactKey:  string
  simId:       string
  startedAt:   number
  connectedAt: number?        // null until media is established
  endReason:   string?
  emergency:   boolean
}
```

`connectedAt` drives the on-screen timer. It is a timestamp rather than a tick
count specifically so the duration stays correct when the WebView is
backgrounded and its timers are throttled.

---

## SpamVerdict

```ts
SpamVerdict {
  numberKey: string
  score:     number    // 0–1 confidence. NOT a boolean.
  reports:   number
  category:  string?   // 'Fraud / KYC', 'Telemarketing'
  blocked:   boolean   // on the user's own blocklist
  trusted:   boolean   // user allowlist, or a business they called first
  source:    'dialr-network' | 'you' | 'you-cleared' | 'business' | 'none'
}
```

`score` is a gradient because the frontend needs to distinguish *label it* from
*silence it* from *block it*, driven by `settings.protection.level` and
`threshold`. A boolean collapses three different user experiences into one.

`trusted: true` overrides any network score. Emergency numbers are exempt from
the entire system, upstream of this object.

---

## MediaAsset

One shape for every source: built-in, KODE31 pack, user gallery, Cloudinary.
The UI never learns where a file came from.

```ts
MediaAsset {
  id:         string
  type:       'image' | 'video' | 'audio'
  source:     'builtin' | 'kode31' | 'user' | 'cloudinary'
  category:   'wallpaper' | 'call-bg' | 'poster' | 'ringtone' | 'avatar'
  pack:       string
  name:       string
  url:        string?
  thumbnail:  string?
  dimensions: { w: number, h: number }?
  duration:   number?      // seconds, video/audio
  durationSec:number?      // ringtones
  bytes:      number?
  owner:      string
  palette:    PaletteMeta? // supplied by the publisher; null triggers extraction
  metadata:   object       // { note?, removable?, synth?, remoteId? }
}

PaletteMeta {
  dominant:  string | null   // hex; null means genuinely achromatic
  secondary: string | null
  meanL:     number          // 0–1 mean OKLab lightness
  mode:      'dark' | 'light'
}
```

`palette.dominant === null` is meaningful, not missing: it says *this image has
no usable colour*, and DIALR stays monochrome rather than inventing a tint from
JPEG noise.

---

## Palette — extraction result

Produced by `theme/palette.js`, consumed by `theme/themeEngine.js`.

```ts
Palette {
  swatches:      Swatch[]      // top 8 by score
  dominant:      Swatch | null
  secondary:     Swatch | null // null unless a genuinely different hue exists
  meanL:         number
  meanC:         number
  vibrancy:      number        // 0–1
  achromatic:    boolean       // true -> the app stays black and white
  suggestedMode: 'dark' | 'light'
  source:        'extracted' | 'meta' | 'empty'
}

Swatch { hex, L, C, h, coverage, score, neutral }
```

`L`, `C`, `h` are OKLCH. `h` is degrees 0–360.

---

## Reminder

```ts
Reminder {
  id:         string
  number:     string
  contactKey: string
  label:      string        // 'Call Avni'
  dueAt:      number
  createdAt:  number
  notifyThem: boolean       // the user asked DIALR to tell the other person
  channel:    'sms' | 'whatsapp' | 'dialr' | null
  status:     'pending' | 'due' | 'done'
}
```

`notifyThem` defaults to false and is asked per reminder. Sending someone an
automated "I'll call you back" they did not expect is worse than not calling
back — the delivery mechanism itself is
[OPEN_DECISIONS.md § 4](OPEN_DECISIONS.md).

---

## SimCard

```ts
SimCard {
  id:      string          // maps to a PhoneAccountHandle natively
  slot:    number          // 1-based
  label:   string          // carrier or user label
  number:  string?
  carrier: string
  colour:  string          // hex, for the SIM chip in the picker
  active:  boolean
}
```

---

## DockModel

Produced by `state/dockController.js`, consumed only by `FloatingDock`.

```ts
DockModel {
  mode:      'nav' | 'action'
  primary:   DockAction | null    // at most ONE
  secondary: DockAction[]         // rendered as icon buttons, max 2
  nav:       NavItem[]
  hidden:    boolean              // true during a call and during onboarding
}

DockAction {
  id: string, label: string, sub?: string, icon: string,
  tone?: 'accent' | 'warn' | 'neutral',
  intent: Intent
}

NavItem { id, icon, label, active: boolean, badge: number }

Intent =
  | { type: 'call',           number, contactKey? }
  | { type: 'message',        number }
  | { type: 'add-contact',    number?, suggestName? }
  | { type: 'open-history',   contactKey }
  | { type: 'filter-recents', filter }
  | { type: 'close-overlay' }
```

`primary` is at most one action by contract. If context suggests two, the more
specific wins and the other is demoted to `secondary`.

---

## Rewind

Produced by `state/smart.js › buildRewind`. Entirely local.

```ts
Rewind {
  contactKey, spanDays, firstAt, lastAt,
  totalCalls, answeredCalls, missedCalls,
  totalSeconds, averageSeconds,
  longestCall: { seconds, at } | null,
  incomingCount, outgoingCount, balance,       // balance = outgoing / total
  sessions,                                     // conversations, 6h+ gap = new one
  theyStartedShare,                             // 0–1
  busiestDay,                                   // 0–6, Sunday = 0
  busiestHour,                                  // 0–23
  trend: 'up' | 'down' | 'flat' | 'new',
  notesCount,
  headlines: { key, label, value, sub }[]
}
```

`sessions` counts **conversations, not calls** — four redials in a row are one
attempt, not four. That is why "who calls first" is honest rather than a
redial-count artefact.

---

## Settings

A nested object derived from `state/settingsSchema.js › defaultSettings()`.
The schema is the single source of truth for defaults, types, options and
visibility. Sections:

```
appearance  profile mode wallpaper intensity showWallpaper tintDock
            cardDensity dockStyle showSearch bigNames
calling     defaultSim rememberSimPerContact confirmBeforeCall tapNumberToCopy
            dialPadHaptics dialPadTones autoSpeakerOnFlat vibrateOnAnswer
            vibrateOnEnd notesEnabled keepScreenOn postCallSheet postCallSeconds
            answerStyle flipToDecline showCallerNumber
identity    profile dialrEnabled visibility showPhotoToUnsaved showBio showSquad
            showViews showPickupRate lookupUnknown lookupOnWifiOnly
recents     naturalLanguage grouping showDuration showSim showNotes
            includeBlocked includeSpam rewindEnabled rewindMinCalls historyLimit
smart       smartDock t9 speedDial callbackDebt bestTime fadingContacts
            fadingWeeks firstTimeCaller repeatToday lastNoteOnIncoming
            numberRegion silentHours silentFrom silentTo silentBreakthrough
            topOfMind duplicateSuggestions swipeActions
protection  enabled level threshold useNetwork trustBusinesses repeatDetection
            repeatCount repeatWindow screenUnknown blockHidden
replies     one two three channel reminderPresets tellThem tellThemChannel
sound       ringtone volumeRamp vibrateOnRing hapticsEnabled hapticStrength
            connectTone endTone
access      textSize contrast motion largeCallButtons alwaysShowLabels
privacy     analytics crashReports contributeSpam
```

Persisted under storage key `settings`. On load it is deep-merged over
`defaultSettings()`, so a settings blob written by an older build still boots.
