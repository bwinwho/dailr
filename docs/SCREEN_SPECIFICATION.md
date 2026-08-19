# DIALR — Screen Specification

Every screen, every state of it, and what the dock does underneath.

Reading key: **Empty / Loading / Error / Permission / Offline** are enumerated
per screen because the brief requires them and because a UI without them is a UI
that has only been designed for the demo.

---

## Global structure

```
┌───────────────────────────────────────┐
│  wallpaper (dimmed, veiled)           │
│  ┌─────────────────────────────────┐  │
│  │  screen header (title)          │  │
│  │  screen body (scrolls, masked)  │  │
│  │                                 │  │
│  │  ─── scrim (when focused) ───   │  │
│  │  bottom slot: keypad | search   │  │  ← one-handed zone
│  │  floating dock (2 rows)         │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

Layers above: sheets → modals → **call** → toasts.

The dock is present on every screen except during a call and during onboarding.
Sheets stop above it. This is structural, not a convention.

---

## 1. Onboarding

Three steps. The last two are skippable. No account, no email, no social login.

| Step | Content | Required |
|---|---|---|
| 1 | *"What should DIALR call you?"* — first name, optional surname | first name |
| 2 | Permission primer — four permissions, one sentence each, **then** the system dialog | no |
| 3 | *"Pick a look."* — eight wallpapers, live preview | no |

Copy on step 1: *"That is the whole sign-up. No account, no email."*

**Why the primer comes first:** a permission denied at a system dialog the user
did not expect is often denied permanently. One sentence of context is the
difference between `granted` and `blocked`.

**States** — no empty/error states; the only failure is a declined permission,
which lands the user in the app with permission gates on Recents and Contacts,
still able to dial.

**Dock:** hidden.

---

## 2. Dialer *(default screen)*

```
  [ suggestions — grows upward as you type ]
  [ top of mind · recent calls — when empty ]
  ─────────────────────────────────────────
  0 9 8 4 2 …                        ⌫      ← tap to copy
  AVNI  Mobile                              ← live match
  ┌───┬───┬───┐
  │ 1 │ 2 │ 3 │   keypad occupies the bottom slot
  ├───┼───┼───┤
  … 4 5 6 7 8 9 * 0 #
  ─────────────────────────────────────────
  [ CALL AVNI ]              ← dock context row
  [ ▣  ◷  ◔  ◕ ]             ← dock navigation
```

**Layout decision:** the keypad takes the slot other tabs give to search,
because the keypad *is* the search here (T9). Stacking a second search field
above it would waste the most valuable real estate on the screen.

| State | Screen | Dock |
|---|---|---|
| Empty | "Just now" (3 recents) + Top of mind | nav + **Redial <name>** suggestion |
| Typing (<3 digits) | nothing yet | nav |
| Matches a contact | ranked suggestions | **CALL AVNI** + Message |
| Matches a DIALR user | one suggestion, accent-outlined | **CALL ISHAAN** + Save |
| Unknown, ≥6 digits | one row, "Not in your contacts" | **CALL +91 …** + Add contact |
| Unknown + spam verdict | "Reported as spam" | CTA in warn tone |
| `*` or `#` present | none | **RUN CODE** (never "add contact" — a USSD string is not a person) |
| No contacts permission | suggestions unavailable; dialling still works | unchanged |

**Interactions:** one tap on the number copies it (no long press). Backspace:
tap deletes one, hold clears. Hold `0` → `+`. Hold a digit → speed dial.
Physical keyboard bound for desktop and switch access.

---

## 3. Recents

```
RECENTS
[All 432] [Missed 48] [To return 5] [Filtered 6]

┌──────────────────────────────────────┐
│ CHHETRI                        ☏  ◉  │
│ AVNI        10 minutes ago            │
│ Avni called you.                      │
│ [6M]                                  │
│ │ Red skirt — Amazon                  │
└──────────────────────────────────────┘
```

Filter chips hide themselves when their count is zero — the app never offers a
filter that would produce an empty list.

**Card expansion** (tap): a rule appears, then **Send a text · History · Remind
me · Open contact**, plus WhatsApp and History quick icons. In place. The dock
becomes **CALL AVNI**.

| State | Content |
|---|---|
| Loading | four card-shaped skeletons |
| Empty (All) | *"No calls yet"* + "Open the keypad" |
| Empty (Missed) | *"Nothing missed — you are all caught up"* |
| Empty (To return) | *"No calls to return"* |
| Empty (Filtered) | *"Nothing filtered"* |
| No call-log permission | permission gate explaining **why**, with Allow; `blocked` shows Open settings instead |
| Offline | thin banner: calls and history work; DIALR names and spam checks paused |

**Gestures:** swipe right to call, left to message.

---

## 4. History *(overlay, near-full height, stops at the dock)*

```
HISTORY
CHHETRI
AVNI                    10 minutes ago    ☏  ◉
──────────
Send a text                          ⟨wa⟩ ⟨bell⟩
HISTORY                        CLEAR THE HISTORY
+91 98420 04200
Usually answers around 10 PM
─────────────────────────────────────────────
TODAY
NIGHT 11 PM                    ┌──────────────────┐
6 minutes · Avni called you.   │ Red skirt—Amazon │
                               └──────────────────┘
AFTERNOON 3:13 PM
You called Avni. No answer.  [NO ANSWER]
─────────────────────────────────────────────
            [ CHECK REWIND ✦ ]
```

Day headings (Today / Yesterday / Earlier this week / month) are rows in the same
keyed list. The list fades into the Rewind button rather than being sliced by it.

| State | Content |
|---|---|
| Empty | *"No history yet — calls will appear here as plain sentences, not arrows"* |
| Fewer calls than `rewindMinCalls` | Rewind button hidden |
| Clear the history | confirmation sheet; destructive, irreversible, says so |

**Dock:** **CALL AVNI** + History.

---

## 5. Check Rewind *(full-bleed overlay)*

Story format. One number, one sentence per panel. Tap right to advance, left to
go back, progress bars at the top, Escape or × to close.

Panels: time together → who calls first → your hour → longest call → typical
call → notes written (if any) → lately (trend).

**Dock:** **CALL AVNI** + Close.

---

## 6. Contacts

```
CONTACTS                                    ⊕
12 people
TOP OF MIND   ◉ ◉ ◉ ◉ ◉ ◉
[ merge suggestion, if any ]
A
  ◉ Arjun Rao        Work                  ☏
  ◉ Avni Chhetri     +91 98420 04200   ★  ☏
B
  …
```

Sticky A–Z headers, a jump rail on the right (hidden below six sections).

| State | Content |
|---|---|
| Loading | eight row skeletons |
| Empty | *"No contacts yet"* + New contact |
| Empty search | *"No matches for '…'"* |
| No permission | gate: *"So calls show names, not numbers. They stay on this phone."* |

**Dock:** nav + **New contact**; if the search query looks like a number, it
becomes **ADD CONTACT** with the number as its subtitle.

---

## 7. Contact sheet *(overlay)*

Identity, then five actions (Call · Message · WhatsApp · History · Remind), then
three labelled groups:

- **smart lines** — best time, callback debt, spam reports, lifetime totals
- **On this phone** — the numbers, tap to call, tap the icon to copy
- **Them on DIALR** — their published profile, if any
- **Only you see this** — label, pronouns, note, saved place, ringtone,
  background, preferred SIM
- destructive row — block, report, clear history, delete

Naming the private group in the UI is deliberate: a user who can see which half
is private will actually use it.

---

## 8. You

Profile poster, then appearance controls (Mode / Style / Colour), then five
shortcuts: Wallpaper · Ringtone · Quick replies · Call protection · All settings.

The **bottom slot is empty** on this tab — a profile page has no list to search.

| State | Content |
|---|---|
| DIALR profile off | banner: nothing is shared; unknown callers stay unknown |
| Offline | banner: profile changes sync when you reconnect |
| No bio yet | *"Write a few lines about yourself"* in place of the composition |

---

## 9. Settings *(overlay)*

Three layers of disclosure: **12 sections → tier-1 fields → "N more" → search**.

112 controls, rendered entirely from `settingsSchema.js`. Dependent settings are
*absent* until relevant rather than greyed out.

Sections: Look · Calls · You · Recents · Smart · Protection · Replies · Sound ·
Accessibility · Privacy & data · Advanced · About.

Destructive actions (clear history, erase local data, delete profile, reset
settings) always confirm and always state what is lost.

---

## 10. Incoming call *(full-screen, above everything)*

```
INCOMING CALL                        AIRTEL · SIM 1

                    ◉  (only if a real photo exists)
                 CHHETRI
                  AVNI
              +91 98420 04200        (quiet for saved contacts)
        [Suspected fraud] [6 calls today] [India]
          ┌─────────────────────────────┐
          │ Last time: Send quotation   │   ← yours; paper-white
          └─────────────────────────────┘
                [ + Save this number ]

        ⌸ Reply      ⏰ Remind me      ⃠ Block
        ⬤ decline                      ⬤ answer
```

**Present, and why each earns it:** name via the hierarchy; photo only if real;
at most three context chips; your last note; the four actions.

**Absent, by requirement and by judgement:** squad members, profile views, call
pickup rate, bio, links, any social statistic. Those are
identity-performance metrics and have no business in front of someone deciding
whether to take a call.

| Identity tier | Headline | Sub |
|---|---|---|
| Saved | the name **you** saved | private label / company |
| DIALR user, unsaved | their DIALR name | *"On DIALR · not in your contacts"* |
| Unknown | the formatted number, at display size | *"Not in your contacts"* + region |

Background: contact-specific → their poster → your wallpaper → none.
Answer style: tap or swipe-up (Settings ▸ Calls).

---

## 11. Active call

Identity and timer at the top, a six-control grid at the bottom, End alone
beneath it.

Controls: Mute · Keypad · Speaker/Bluetooth · Add call · Hold · **Note**.

- **Note** opens a 50-character field, saved against the call and shown in
  History.
- **Keypad** opens an in-call DTMF pad with its own readout.
- A second call raises a strip with **Swap** and **Merge**.
- Conference: every leg active; ending ends all.
- Timer derives from `connectedAt`, so it stays correct when the WebView is
  backgrounded and throttled.

| State | Content |
|---|---|
| Dialing / Connecting | *"Calling…"*, no timer yet |
| Held | *"On hold"*, Hold becomes Resume |
| Second call ringing | strip: *"<number> is calling"*, Swap only |
| Conference | *"Conference"*, Merge hidden |
| Failed | toast: *"Line was busy"* / *"Call failed — no network"* |

---

## 12. Post-call

Appears **only when it earned it**: unsaved number, missed, no answer, failed,
busy, a call under 12 seconds, or a note in progress. Dismisses after
`postCallSeconds` (default 8).

Actions are derived, not fixed: Save number (unsaved) · Call again (missed) ·
Remind me · Message · Report spam (unsaved) · History (saved), plus the note
field.

*"Show when useful"* is the default. A sheet after every call is noise.

---

## 13. Search *(overlay above the search bar)*

Grows upward out of the bar; the global scrim rises behind it. Searches
**people, numbers, calls and your notes** — the last of those is the one nobody
else offers, and it is why "what was that thing Rohan asked for" is findable.

| State | Content |
|---|---|
| Focused, empty | *"Search people, numbers, calls and your notes."* |
| No results | *"Nothing found for '…'"* |

---

## 14. Cross-cutting states

### Permission gate
Explains **why** before asking. A `blocked` permission gets different copy and
sends the user to system settings instead of re-prompting into a wall.

### Offline
A thin banner on the affected screen, never a blocking screen. Calls, contacts,
history, notes and local customisation are unaffected; DIALR names and spam
checks pause and say so.

### Loading
Shape-matched skeletons, never a spinner. Only on first load — subsequent
refreshes keep the previous content on screen.

### Error
Plain sentence, the error code in small type, and a Retry that actually retries.

### Emergency
No spam rule, silent-hours rule, block rule or confirmation ever applies to an
emergency number. The check runs first, before every other branch in
`actions.call()`.
