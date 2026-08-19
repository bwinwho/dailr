# DIALR — Open Product Decisions

The brief is explicit: the architect must document these rather than silently
invent answers. Each entry states what is open, what the frontend does in the
meantime, and what it would cost to change.

**Everything below is a placeholder, not a decision.** The architecture is built
so the answer can change without a rewrite.

---

## 1. What "Squad Members" actually counts

**Open.** The number is prominent on the profile and its meaning is undefined.

Candidates: people who have saved you · mutual saves · people who accepted an
"ask to add" · your own contact count.

**Frontend today:** renders `DialrProfile.squadMembers` as an opaque integer. No
component computes or interprets it.

**Why it matters:** "3,100 people have saved this person" is a privacy
disclosure derived from other people's address books. It must not be shipped
without a defined data model *and* a defined privacy model. If it is a mutual,
opt-in relationship it is a social feature; if it is a count of unilateral saves
it is surveillance.

**Cost to change:** one number and one label.

---

## 2. How Call Pickup Rate is calculated

**Open.** Over what window? Does declining count as not picking up? Are spam
calls excluded? Is it visible to others by default?

**Frontend today:** renders `callPickupRate` as a percentage, and the setting
that exposes it to others (`identity.showPickupRate`) is **off by default** — it
is a flattering number on a good week and an unkind one otherwise.

**Cost to change:** a number and a settings default.

---

## 3. Exactly what Check Rewind contains

**Open.** The current set is a defensible first pass, not a decision:

time together · who calls first · your hour · longest call · typical call ·
notes written · trend.

**Frontend today:** `buildRewind()` produces the model; `CheckRewind` renders
panels from data. Adding, removing or reordering a panel is a one-line edit.

**Deliberately excluded, and worth defending:** ranking people against each
other, "closeness scores", anything that turns a relationship into a
leaderboard. Rewind is about one relationship.

**Also open:** whether a *global* year-in-review ships. `buildGlobalRewind()`
exists and is unused.

---

## 4. How a Smart Reminder tells the other person

**Open, and the most consequential one here.** The user sets "remind me in 30
minutes" and optionally asks DIALR to tell them.

Candidates: SMS (works for everyone, costs money, can fail silently) ·
WhatsApp deep link (needs the app, breaks automation) · DIALR-to-DIALR push
(only works if they have DIALR) · notification only, no message at all.

**Frontend today:** two separate decisions — *when* and *whether to tell them* —
with the second **opt-in per reminder**. `replies.tellThemChannel` selects the
channel. Native may reject unimplemented channels with `UNSUPPORTED_CHANNEL`,
which the frontend surfaces cleanly.

**Why the split matters:** sending someone an automated "I'll call you back"
they did not expect is worse than not calling back. Never make it automatic.

---

## 5. Whether DIALR-to-DIALR calling ever uses VoIP

**Open.** Currently every call is a cellular call.

**Implication if adopted:** a second call path, a second identity model
(account-to-account rather than number-to-number), push-based signalling, and a
different set of failure states. The `CallService` interface would need a
`transport` field on `CallSession`; the UI would need to *show* which transport
is in use, since call quality and cost differ.

**Frontend today:** `CallSession` has no transport field. Adding one is
additive.

---

## 6. Call recording and transcription

**Open, and legally regional.** Recording consent law varies by jurisdiction;
some require two-party consent, some ban it outright, and Android restricts it
at the platform level.

**Frontend today:** not present. No UI, no interface method, no setting.

**Position:** this should not be added without legal review per market. If it
ships, it needs an unmissable indicator, per-call consent, and a jurisdiction
gate — not a settings toggle.

---

## 7. Which profile fields are public by default

**Partially decided, and the defaults are deliberate:**

| Field | Default visibility |
|---|---|
| Name, photo | visible to contacts |
| Bio, links | visible |
| Squad count | visible |
| Profile views | **off** |
| Pickup rate | **off** |

**Open:** whether per-field visibility should be per-audience (contacts vs
everyone vs squad) rather than a single global `visibility` plus per-field
booleans.

**Constraint:** whatever is decided, enforcement belongs in Firebase security
rules. The client-side setting is a request, not a privacy control.

---

## 8. Account recovery and device migration

**Open.** With no email and no password — which is the point of the onboarding —
what proves you are you on a new phone?

Candidates: SMS OTP to the same number · a recovery code shown once · silent
re-verification via the SIM.

**Frontend today:** onboarding takes a name and nothing else. No recovery flow
exists.

**Constraint:** whatever is chosen must not break the promise on step 1
("no account, no email"). A recovery flow that appears at first launch has
undone the onboarding.

---

## 9. Contact synchronisation strategy

**Open.** Does DIALR read contacts live from the provider on every launch, cache
them, or observe changes?

**Frontend today:** `contacts.list()` on boot, plus a refresh on
`contacts.changed`. Native decides whether that is a query or a cache.

**Open sub-question:** whether private relationship data survives a contact
being deleted and re-added. It is keyed by `numberKey`, so it currently would —
which may or may not be desirable.

---

## 10. Spam intelligence source

**Open.** Own reports only, a third-party database, a carrier feed, or a hybrid.

**Frontend today:** `SpamService` returns a `SpamVerdict` with `score`,
`reports`, `category` and `source`. The frontend never assumes where the signal
came from, and `source` is displayed so a user can see whether a verdict is the
network's or their own.

**Constraint already encoded:** the score is a 0–1 gradient, not a boolean,
because the UI needs to distinguish label / silence / block. Any provider must
supply confidence, not a verdict.

---

## 11. Business verification

**Open.** How does a business prove it is Blinkit and not someone spoofing
Blinkit?

**Frontend today:** `verifiedBusiness` exists in mock data and `trusted` in
`SpamVerdict`. The UI shows a "Trusted" chip. There is no verification pipeline
behind it.

**Risk if unresolved:** a "Trusted" badge that can be spoofed is worse than no
badge, because it launders a scam call.

---

## 12. Final typography

**Decided in intent, open in licence.** The system targets Archivo Expanded
(display) and Inter Tight (text), with Roboto Flex's width axis as the offline
fallback so proportions survive.

**Open:** licensing for bundling in an Android app, and whether a custom or
licensed display face replaces Archivo. The system is role-based
(`--font-display`, `--font-text`, `--font-num`), so swapping a family is three
token edits.

---

## 13. Final colour system

**Decided in structure, open in specifics.** Monochrome foundation, wallpaper
accent, four intensity levels, safety colours fixed. What remains open:

- the exact chroma caps per intensity (currently 0.052 / 0.098 / 0.150)
- whether "Balanced" or "Subtle" should be the default (currently Subtle)
- whether the secondary accent should unlock at Balanced or only at Expressive

All three are single numbers in `INTENSITY` in `themeEngine.js`.

---

## 14. Final animation language

**Decided in structure, open in taste.** Durations and easings are tokens; the
vocabulary (dock morph, card expand, sheet rise, Rewind advance) is implemented.

**Open:** whether the dock should morph with a spring or a decelerate curve, and
whether card expansion should stagger its contents. Both are token edits.

---

## 15. Final navigation arrangement

**Decided provisionally:** four tabs — Dialer, Recents, Contacts, You — with the
dock's context row carrying actions.

**Open:** whether Contacts and Recents should merge into one "People" surface,
which would free a slot. The dock reads `NAV_ITEMS` from `dockController.js`, so
changing the arrangement is a data edit, not a refactor.

---

## 16. V1 / V2 boundary

**Open.** A defensible V1, offered as a proposal rather than a decision:

**V1 — a dialer people would switch to**
dialer, recents, contacts, call screens, history, notes, quick replies,
reminders, blocking + basic protection, wallpaper theming, settings

**V2 — the DIALR layer**
profiles, squad, Check Rewind, DIALR identity lookup, spam network,
KODE31 packs, custom media, reconnect nudges

The architecture supports shipping V1 with `identity.dialrEnabled` defaulting to
off, which turns DIALR into an excellent private dialer with no cloud at all —
and is worth considering as a genuine product position rather than a fallback.

---

## How to close one of these

1. Write the decision into this file with a date and a rationale.
2. Update the affected contract in [DATA_CONTRACTS.md](DATA_CONTRACTS.md).
3. If it changes what the frontend renders, update
   [SCREEN_SPECIFICATION.md](SCREEN_SPECIFICATION.md).
4. If it needs native work, add it to
   [ANDROID_INTEGRATION_MAP.md](ANDROID_INTEGRATION_MAP.md).

Do not close one by changing code alone. Every item here is a product decision,
and the code is downstream of it.
