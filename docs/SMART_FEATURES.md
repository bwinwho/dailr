# DIALR — Smart Features

The derived intelligence, what each one is allowed to conclude, and where it
stops.

---

## Ground rules

Every feature here obeys all five:

1. **Local.** Computed on the device from the device's own call log. Nothing is
   uploaded, nothing is inferred from anyone else's data.
2. **Quiet.** At most a short phrase or a single chip. Never a card, never a
   banner, never a modal. A dialer that nags is worse than a dialer that says
   nothing.
3. **Off-switchable.** Each maps to exactly one setting under Settings ▸ Smart,
   in plain language.
4. **Honest.** Returns nothing rather than guessing. Thin data produces no
   claim, not a weak one.
5. **Never in the way of a call.** No feature can delay, block or reorder the
   act of dialling or answering.

Implementation: `src/state/smart.js` — pure functions, no DOM, directly
executable in Node.

---

## From the brief

### Contextual dock
`smart.smartDock` · `state/dockController.js`

The dock offers the obvious next action as context changes: **CALL AVNI** when
the typed number matches her, **ADD CONTACT** when it does not, **HISTORY** when
a card is expanded. Navigation is compressed, never removed.

### Human-readable history
`recents.naturalLanguage` · `core/format.js`

Two registers, used deliberately:

- **Relative** on Recents — *"46 minutes ago"*, *"Last night"*, *"Tuesday
  afternoon"*. Answers "how long ago", which is what you want when scanning.
- **Day-part** in History — *"NIGHT 11 PM"*, *"AFTERNOON 3:13 PM"*. Answers
  "when in the day", which is what you want when reconstructing a conversation.

**Pronouns are never guessed.** A contact's pronouns are private relationship
data the user sets. Unset reads as they/them, so history says *"They called
you"* until you say otherwise. A wrong guess misgenders a real person; the
neutral default never does.

### Check Rewind
`recents.rewindEnabled`, `recents.rewindMinCalls` · `smart.js › buildRewind`

A relationship recap, told as a story: one number and one sentence per panel.

The statistic worth calling out is **"who calls first"**. It is measured over
*conversations* — a gap of 6h+ starts a new one — not over calls. Four redials
in a row are one attempt, not four, so the answer is honest rather than a
redial-count artefact.

Hidden below `rewindMinCalls` (default 5). A thin recap is worse than none.

### Call notes
`calling.notesEnabled` · 50-character limit

A scratchpad during a call, surfaced beside that call in History. The limit is a
design constraint, not a technical one: it keeps history readable and keeps the
feature honest about what it is for. Notes are **device-only** and never
uploaded.

### Smart reminders
`replies.reminderPresets`, `replies.tellThem`

Two separate decisions: *when* to be reminded, and *whether to tell the other
person*. The second is opt-in per reminder, because sending someone an automated
"I'll call you back" they did not expect is worse than not calling back.
Delivery mechanism is [OPEN_DECISIONS.md § 4](OPEN_DECISIONS.md).

### Layered call protection
`protection.*` · see [§ Protection](#protection)

### Repeated call detection
`protection.repeatDetection`, `repeatCount`, `repeatWindow`

Thresholds are parameters, never constants, exactly as the brief requires.

`repeatedCallBurst()` anchors to the **most recent attempt**, not to "now", and
slides a window over the last N unanswered incoming attempts. "The last five
tries came in a tight cluster" is the real signal; "five calls in the last
fifteen minutes measured from this instant" misses the burst that ended two
minutes ago.

Known contacts are exempt — your mother calling four times is not a repeat
caller, it is an emergency.

The prompt offers **temporary silence first**. Most bursts are a delivery driver,
not a harasser, and a permanent block is hard to undo.

---

## Added beyond the brief

Each earns its place by answering a question the default dialer leaves you to
work out yourself.

### T9 name search
`smart.t9` — *typing 2864 finds Avni*

Ranked so the answer you meant is first: number prefix beats name start, name
start beats a match mid-name. Works alongside normal number matching, never
instead of it. The keypad letters are printed under the digits so the feature is
discoverable rather than hidden.

### Callback debt
`smart.callbackDebt` — *"3 to return"*

Missed incoming calls you have not returned. Cleared the moment you call back or
speak to them. Surfaces as a chip on the card and as a **To return** filter.

The single most useful thing a call log can tell you, and every default dialer
buries it under an arrow glyph.

**Spam is never a social obligation.** A number with a verdict ≥ 0.6 that you
have not marked trusted is excluded — flagging "3 to return" on a scam number is
the app telling you to do the wrong thing.

### Best time to call
`smart.bestTime` — *"Usually answers around 9 PM"*

Hour-of-day histogram over answered calls, smoothed ±1 hour so 8:59 and 9:01 do
not compete.

Calibration matters: the test is the peak against **what a uniform spread would
produce** (`lift ≥ 1.9`), not a fixed share. A fixed share works for someone with
8 calls and fails for someone with 800. Needs ≥ 6 answered calls; below that,
and for genuinely flat distributions, it returns `null` and nothing renders.

### Silent hours
`smart.silentHours`, `silentFrom`, `silentTo`, `silentBreakthrough`

Unknown numbers go quiet between the hours you set. **Your contacts still ring.**

The breakthrough rule matters more than the feature: if the same number calls
three times within five minutes, it rings anyway. Emergencies come from numbers
you have never saved. This only ever *silences* — it never blocks and never
hides a call from Recents.

### First-time caller / calls today
`smart.firstTimeCaller`, `smart.repeatToday`

Two facts on the incoming screen that change the answer/don't-answer decision:
this number has never called before, or it has already called three times today.

### Your last note, on the incoming screen
`smart.lastNoteOnIncoming` — *"Last time: Send quotation"*

One line of context while deciding whether to answer. Rendered paper-white
because it is **yours** — they never see it, and the treatment says so.

This is the one piece of extra information the incoming screen carries, and it
passes the test the brief sets: it helps you decide whether to pick up. Squad
counts and pickup rates do not, which is why they are forbidden there.

### Number origin
`smart.numberRegion` — *"Bengaluru"*, *"US / Canada"*

Prefix table lookup, entirely offline. Never a network call just to label a
number.

### Top of mind
`smart.topOfMind`

Frequency × recency with a ~12-day half-life, so someone you called twice today
outranks a monthly call. Six people, pinned above the contact list and on the
empty dialer.

### Duplicate merge suggestions
`smart.duplicateSuggestions`

Contacts sharing a number, offered as a merge — **never applied automatically**.

### Reconnect nudges
`smart.fadingContacts` — **off by default**

People you clearly care about (high historical frequency) who have gone quiet.
Compared against **their own cadence**, not a global rule: a monthly caller a
week late is not fading. Capped at one suggestion so it can never become a feed.

Off by default because it is the one feature here that could feel like
surveillance rather than help.

### Swipe actions
`smart.swipeActions` — swipe a recent card right to call, left to message.

### Speed dial
`smart.speedDial` — hold a digit. Hold `0` for `+` regardless.

---

## Protection

Layered, in this order:

```
1. Emergency numbers          ── exempt from everything, always
2. Your allowlist / trusted   ── overrides any network verdict
3. Your block rules & list    ── prefixes, patterns, specific numbers
4. DIALR network signal       ── reports, frequency, classification
5. Nothing matched           ── it rings
```

`score` is 0–1 confidence, not a boolean, because the frontend needs the
gradient to distinguish three different user experiences:

| `protection.level` | Behaviour at/above `threshold` |
|---|---|
| Warn only | everything rings; suspected spam is labelled |
| Silence likely spam *(default)* | rings silently, still appears in Recents |
| Block likely spam | never reaches you |

**Never blindly classify by prefix.** The brief is explicit and it is right: a
prefix rule is a user rule (`protection.rules`), not an intelligence signal.

Businesses you have called yourself are automatically trusted
(`protection.trustBusinesses`) — you called your bank, so your bank may call
back.

Protection degrades silently. If the spam service is unreachable, calls still
ring; they simply arrive unlabelled.

---

## What is deliberately absent

- **No scoring or ranking of people.** No "closeness score", no leaderboard.
- **No cross-contact comparison in Rewind.** It is about one relationship.
- **No sentiment, transcription or content analysis.** DIALR sees metadata only.
- **No behavioural nudging toward more calling.** Reconnect nudges are opt-in,
  capped at one, and framed as a reminder rather than a metric.
- **No dark patterns in protection.** Blocking is one tap and reversible; "Not
  spam" is always offered next to "Report".
