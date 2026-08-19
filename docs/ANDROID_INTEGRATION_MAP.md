# DIALR — Android Integration Map

**If you are the Kotlin developer, start here.**

This document defines the boundary between the HTML/JS layer in this repository
and the native Android layer you will write. It is written so you can implement
against it without reading the frontend source.

---

## 0. Ownership at a glance

| Concern | Owner |
|---|---|
| Every pixel, screen, state, animation, copy string | **Frontend** |
| Navigation, dock behaviour, overlays, sheets | **Frontend** |
| Human-readable time and call sentences | **Frontend** |
| Rewind statistics, callback debt, best-time, T9 matching | **Frontend** (from data you supply) |
| Theme, palette extraction, customisation priority | **Frontend** |
| Placing / answering / ending calls, audio routing | **Native** |
| Contacts and call-log read/write | **Native** |
| SIM enumeration and selection | **Native** |
| Runtime permissions and the default-dialer role | **Native** |
| Notifications, alarms, reminders firing | **Native** |
| Media picking, cropping, transcoding, upload | **Native** |
| Firebase identity, profile storage, spam network | **Native** |
| Ringtone playback, vibration | **Native** |

**Rule of thumb:** if it needs an Android permission, a system service or the
radio, it is native. Everything else is already built.

---

## 1. Hosting the frontend

Serve the assets over `https://appassets.androidplatform.net/` with
`WebViewAssetLoader`. Do **not** use `file:///android_asset/` — ES modules are
blocked by the file-scheme origin rules.

```kotlin
val assetLoader = WebViewAssetLoader.Builder()
    .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
    .build()

webView.webViewClient = object : WebViewClientCompat() {
    override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest) =
        assetLoader.shouldInterceptRequest(req.url)
}

webView.settings.apply {
    javaScriptEnabled = true
    domStorageEnabled = true          // the frontend persists settings in localStorage
    mediaPlaybackRequiresUserGesture = false
    setSupportZoom(false)
}

webView.addJavascriptInterface(DialrBridge(this, webView), "DialrNative")
webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
```

Also set:

- `WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)`
- edge-to-edge + `viewport-fit=cover` is already in the HTML; publish real
  `env(safe-area-inset-*)` values by keeping the WebView full-bleed
- a dark window background, so a slow first paint is black rather than white

---

## 2. Wire protocol

Three functions. Everything is a JSON **string**, because
`@JavascriptInterface` only marshals primitives reliably across WebView versions.

### 2.1 JS → Kotlin

```kotlin
@JavascriptInterface
fun invoke(payloadJson: String)      // request/response
@JavascriptInterface
fun notify(payloadJson: String)      // fire-and-forget (haptics, telemetry)
@JavascriptInterface
fun capabilities(): String           // JSON array of implemented namespaces
```

`invoke` payload:

```json
{ "id": 42, "ns": "calls", "method": "answer", "args": { "callId": "call_7" } }
```

`args` is the first argument when it is an object, otherwise
`{ "args": [ ... ] }` positionally. Prefer object arguments in your data classes.

### 2.2 Kotlin → JS

Always on the main thread, always via `evaluateJavascript`.

```kotlin
fun reply(id: Int, ok: Boolean, payload: Any?) {
    val json = gson.toJson(payload).jsEscape()
    webView.post {
        webView.evaluateJavascript("window.__dialrResult($id, $ok, $json)", null)
    }
}

fun event(type: String, payload: Any?) {
    val json = gson.toJson(payload).jsEscape()
    webView.post {
        webView.evaluateJavascript("window.__dialrEvent('$type', $json)", null)
    }
}
```

Rules:

- **Every `invoke` must be answered.** The frontend times out after 8000 ms and
  rejects with `code: "TIMEOUT"`. A silently dropped reply is the single most
  common bring-up bug.
- Errors reply with `ok = false` and a payload of
  `{ "message": "...", "code": "SOME_CODE" }`. Codes are listed in §7.
- Events are pushed, unsolicited, whenever platform state changes — never only
  in response to a call.

### 2.3 Capability negotiation

```kotlin
@JavascriptInterface
fun capabilities(): String = """["calls","contacts","callLog","sim","permissions"]"""
```

Namespaces you list are routed to you; everything else keeps using the mock. So
you can ship `calls` on day one and still have a fully working app. Verify what
resolved where in **Settings ▸ Advanced ▸ Native bridge status**.

Valid namespaces: `calls`, `contacts`, `callLog`, `sim`, `permissions`,
`notifications`, `media`, `profile`, `storage`, `spam`, `reminders`, `telephony`.

---

## 3. Feature map

Each entry below is one integration unit.

---

### 3.1 Incoming call

| | |
|---|---|
| **UI** | `IncomingCallScreen` (`src/components/call/IncomingCallScreen.js`) |
| **Frontend expects** | a `call.incoming` event carrying a `CallSnapshot` |
| **Frontend owns** | who the caller is (name hierarchy), the photo rule, spam chips, "first time calling", "3 calls today", your last note, quick replies, remind-me, background selection |
| **Native owns** | detecting the call, keeping it alive, answering, rejecting, showing the full-screen intent / heads-up |
| **Android APIs** | `InCallService`, `Call`, `Call.Callback`, `TelecomManager` |

```
JS bridge          dialr.calls.answer(callId)
                   dialr.calls.reject(callId, { replyText })
                   dialr.calls.snapshot()

Events emitted     call.incoming        { callId, number, snapshot }
                   call.secondIncoming  { callId, number, snapshot }   // call waiting
                   call.connected       { callId, snapshot }
                   call.ended           { callId, reason, durationSec, snapshot }
```

**Permissions** `ANSWER_PHONE_CALLS`, `READ_PHONE_STATE`, `READ_CONTACTS`
(for the name), `POST_NOTIFICATIONS`.

**Errors** `NO_ACTIVE_CALL`, `PERMISSION_DENIED`.

**Offline** Fully functional. Only the *DIALR profile* fallback name needs the
network; without it an unsaved caller shows the formatted number, which is the
designed third tier.

**Notes**
- `reject(callId, { replyText })` — when `replyText` is present, reject **and**
  send that SMS. The frontend does not send messages itself.
- Deliver `call.incoming` even for calls the user's own rules would silence;
  filtering is a frontend decision driven by settings, and the call must still
  appear in Recents.
- **Never suppress an emergency call**, whatever the frontend asks.

---

### 3.2 Outgoing call

| | |
|---|---|
| **UI** | dock CTA, dialer suggestions, contact sheet, recent cards |
| **Frontend owns** | emergency check ordering, blocked-number refusal, SIM prompt, optional confirmation, then the dial |
| **Native owns** | actually placing it, and reporting progress |

```
JS bridge          dialr.calls.place(number, { simId })  -> { callId }
Events             call.outgoing → call.connecting → call.connected | call.failed | call.ended
Android            TelecomManager.placeCall(uri, extras)
                   extras: PhoneAccountHandle for simId, EXTRA_START_CALL_WITH_SPEAKERPHONE
```

**Permissions** `CALL_PHONE`.

**Errors** `INVALID_NUMBER`, `BLOCKED`, `NO_SIM`, `AIRPLANE_MODE`, `CALL_LIMIT`
(two calls already live), `PERMISSION_DENIED`.

**Important:** the frontend calls `dialr.telephony.isEmergencyNumber(number)`
*before* every other check. Implement it with
`TelephonyManager.isEmergencyNumber()` and never let it fail closed — if you
cannot determine the answer, return `false` and let the call proceed.

---

### 3.3 Active call controls

| | |
|---|---|
| **UI** | `ActiveCallScreen` |
| **Native owns** | mute, audio route, hold, DTMF, add/swap/merge/separate |

```
dialr.calls.setMute(muted)
dialr.calls.setAudioRoute('earpiece' | 'speaker' | 'bluetooth' | 'wired')
dialr.calls.audioDevices()   -> [{ id, label, kind, connected }]
dialr.calls.setHold(callId, held)
dialr.calls.sendDtmf(digit)
dialr.calls.addCall(number)  -> { callId }
dialr.calls.swap()
dialr.calls.merge()
dialr.calls.separate(callId)
dialr.calls.hangup(callId)

Events   call.held { callId, held }
         call.audioChanged { muted, audioRoute }
         call.swapped / call.merged / call.separated
         call.idle                       // last call gone
```

**Android** `InCallService.setMuted`, `setAudioRoute`, `CallAudioState`,
`Call.hold()/unhold()/playDtmfTone()`, `Call.conference(other)`,
`Call.splitFromConference()`.

**Every one of these must also emit an event.** The frontend does not assume a
control succeeded because the call returned; it re-renders from the snapshot you
push. That is what makes the UI correct when the platform overrides you (a
headset unplugged, the network dropping a leg).

**Bluetooth** enumerate real devices in `audioDevices()`; the frontend cycles
only through routes you report as `connected`.

---

### 3.4 Call log

| | |
|---|---|
| **UI** | Recents, History, Rewind, callback debt, best-time — all of it |
| **Frontend owns** | grouping, natural language, statistics, filtering |
| **Native owns** | reading and writing `CallLog.Calls` |

```
dialr.callLog.list({ limit, before, contactKey }) -> CallLogEntry[]   // newest first
dialr.callLog.remove(ids)
dialr.callLog.clearForContact(contactKey)
dialr.callLog.clearAll()
dialr.callLog.setNote(id, note | null)
Events   callLog.changed
```

**Permissions** `READ_CALL_LOG`, `WRITE_CALL_LOG`.

`CallLogEntry` shape: [DATA_CONTRACTS.md § CallLogEntry](DATA_CONTRACTS.md).
Two fields need translation work on your side:

- **`disposition`** — DIALR's vocabulary is finer than `CallLog.Calls.TYPE`.
  Map it:

  | DIALR `disposition` | Derive from |
  |---|---|
  | `incoming-answered` | `INCOMING_TYPE` and `duration > 0` |
  | `incoming-missed` | `MISSED_TYPE` |
  | `incoming-declined` | `REJECTED_TYPE` |
  | `incoming-blocked` | `BLOCKED_TYPE` |
  | `incoming-screened` | `ANSWERED_EXTERNALLY_TYPE` or your screening flag |
  | `outgoing-answered` | `OUTGOING_TYPE` and `duration > 0` |
  | `outgoing-no-answer` | `OUTGOING_TYPE` and `duration == 0` |
  | `outgoing-busy` / `outgoing-failed` | from `Call.Details` disconnect cause |
  | `voicemail` | `VOICEMAIL_TYPE` |

- **`contactKey`** — the last 9 digits of the number. It is how `+91 98…`
  matches `098…`. Compute it once and store it; do not make the frontend the
  only place that knows the rule.

- **`note`** — the CallLog provider has no note column. Keep notes in your own
  Room table keyed by call id and join them in. Notes are **device-only** and
  must never be uploaded.

---

### 3.5 Contacts

```
dialr.contacts.list()                   -> DeviceContact[]
dialr.contacts.get(id)
dialr.contacts.create(draft)            -> DeviceContact
dialr.contacts.update(id, patch)        -> DeviceContact
dialr.contacts.remove(id)
dialr.contacts.search(query)
dialr.contacts.merge(ids)               -> DeviceContact
dialr.contacts.openSystemEditor(id)
dialr.contacts.privateData()            -> PrivateRelationship[]
dialr.contacts.setPrivate(contactKey, patch)
Events   contacts.changed, private.changed
```

**Permissions** `READ_CONTACTS`, `WRITE_CONTACTS`.

**`privateData` is yours to store, not the Contacts Provider's.** Label,
pronouns, note, saved place, per-contact ringtone, per-contact background and
preferred SIM are DIALR-only and belong in your own Room database. Writing them
into contact fields would sync them to Google.

`photoUri` should be a `content://` URI the WebView can load — add
`ContactsContract` read permission to the WebView or proxy through the asset
loader. **If a contact has no photo, send `null`.** Do not send a placeholder;
the frontend deliberately renders a different, non-photographic mark.

---

### 3.6 SIM

```
dialr.sim.list()             -> SimCard[]
dialr.sim.getDefault()       -> simId | 'ask'
dialr.sim.setDefault(simId)
Events   sim.changed
```

**Android** `SubscriptionManager.getActiveSubscriptionInfoList()`,
`TelecomManager.getCallCapablePhoneAccounts()`. Map each `simId` to a
`PhoneAccountHandle` and honour it in `place()`.

**Permissions** `READ_PHONE_STATE`.

Single-SIM devices: return one entry. The frontend skips the picker
automatically when `sims.length < 2`.

---

### 3.7 Permissions and the dialer role

```
dialr.permissions.status()          -> { "android.permission.X": "granted"|"denied"|"blocked"|"unsupported" }
dialr.permissions.request(names)    -> same shape
dialr.permissions.openAppSettings()
dialr.telephony.isDefaultDialer()   -> boolean
dialr.telephony.requestDefaultDialer() -> boolean
Events   permissions.changed
```

`"blocked"` means "denied permanently" (`shouldShowRequestPermissionRationale`
is false after a denial). The frontend renders a different, honest state for it
that sends the user to system settings instead of re-prompting into a wall.

The onboarding flow explains each permission **before** requesting it. Do not
request anything on launch; wait for `request()`.

Default-dialer role: `RoleManager.createRequestRoleIntent(ROLE_DIALER)`
(API 29+), `TelecomManager.ACTION_CHANGE_DEFAULT_DIALER` below that.

---

### 3.8 Notifications and reminders

```
dialr.notifications.post({ id, title, body, actions, at, channel })
dialr.notifications.cancel(id)
dialr.notifications.canPost() -> boolean

dialr.reminders.list()   -> Reminder[]
dialr.reminders.create({ number, label, dueAt, notifyThem, channel }) -> Reminder
dialr.reminders.cancel(id)
dialr.reminders.complete(id)
Events   reminder.due { …Reminder }, reminder.changed
```

**Android** `AlarmManager.setExactAndAllowWhileIdle` (needs
`SCHEDULE_EXACT_ALARM` on API 31+; fall back to `setWindow` and say so),
`NotificationManager` with separate channels for calls, missed calls and
reminders.

Reminders must survive reboot — persist them and re-arm from
`BOOT_COMPLETED`.

`notifyThem: true` means the user asked DIALR to tell the other person. Send it
on the channel named by `channel` (`sms` | `whatsapp` | `dialr`). **The exact
delivery mechanism is an open product decision** — see
[OPEN_DECISIONS.md § 4](OPEN_DECISIONS.md). Until it is settled, implement `sms`
and reject the others with `UNSUPPORTED_CHANNEL`; the frontend surfaces that
cleanly.

---

### 3.9 Media and customisation

```
dialr.media.pick({ kind: 'image'|'video', aspect })  -> MediaAsset | null
dialr.media.prepare(asset, budget)                   -> MediaAsset
dialr.media.upload(asset)                            -> MediaAsset (source: 'cloudinary')
dialr.media.remove(id)
dialr.media.playPreview(ringtoneId)
dialr.media.stopPreview()
dialr.media.palette(src)                             -> Palette
Events   media.progress { id, pct }, media.ready, media.failed
```

**You own the safety work.** Budgets the frontend assumes and displays:

| | Image | Video |
|---|---|---|
| Max stored size | 2.5 MB | 12 MB |
| Max dimension | 1440 px on the long edge | 1080×1920 |
| Max duration | — | 15 s |
| Output | JPEG/WebP | H.264 MP4, no audio track |

Reject over-budget input with `MEDIA_TOO_LARGE` / `MEDIA_TOO_LONG`; the
frontend already renders those two errors specifically. Downscale and transcode
rather than refusing where you reasonably can. **A user-supplied 4K video must
never be played as the call background** — that is the failure the budget
exists to prevent.

`palette(src)` may return `null` and let the frontend extract it in JS; the
frontend handles both. If you do compute it natively (Palette API is *not*
equivalent — see [CUSTOMIZATION_SYSTEM.md](CUSTOMIZATION_SYSTEM.md)), return the
`Palette` contract exactly.

---

### 3.10 Profile (Firebase)

```
dialr.profile.me()                 -> DialrProfile
dialr.profile.updateMe(patch)      -> DialrProfile
dialr.profile.lookup(numberKeys)   -> { [numberKey]: DialrProfile }
dialr.profile.recordView(uid)
dialr.profile.addToSquad(uid)
Events   profile.updated
```

**Privacy constraints that are not negotiable:**

- `lookup()` sends **only** number keys, never names, never the contact list.
- Respect the caller's visibility setting server-side. `identity.visibility` in
  settings is a *request*; enforcement belongs in Firebase rules.
- When `identity.dialrEnabled` is false the frontend never calls this. Do not
  add a background sync that ignores that.
- Reject writes with `OFFLINE` when there is no connection rather than queueing
  silently — the frontend shows a banner and the user can retry.

---

### 3.11 Spam and call protection

```
dialr.spam.lookup(numberKeys)  -> { [numberKey]: SpamVerdict }
dialr.spam.report(number, category)
dialr.spam.markNotSpam(number)
dialr.spam.block(number) / unblock(number) / blockedList()
dialr.spam.rules() / addRule(rule) / removeRule(id)
Events   spam.updated
```

The frontend decides *what to do* with a verdict (warn / silence / block) from
`settings.protection.level` and `threshold`. You supply the signal.

**Hard rules:**
- Never apply any rule to an emergency number.
- A number in the user's own allowlist, or one the user has called themselves,
  overrides a network verdict. Set `trusted: true` on those.
- Blocking is local (`BlockedNumberContract` where available) and must not
  require the network.
- `score` is 0–1 confidence, not a boolean. The frontend needs the gradient to
  distinguish "label it" from "silence it".

---

### 3.12 Storage

```
dialr.storage.get(key) / set(key, value) / remove(key) / keys()
```

Device-local key/value. Currently `settings`, `theme`, `onboarded`. Back it with
`EncryptedSharedPreferences` or DataStore. **This data never leaves the phone.**

If you do not implement this namespace the frontend uses `localStorage`, which
works fine inside the WebView as long as `domStorageEnabled = true`.

---

## 4. Event catalogue

Push these whenever the underlying state changes, not only on request.

| Event | Payload | Emit when |
|---|---|---|
| `call.incoming` | `{ callId, number, snapshot }` | a call starts ringing |
| `call.secondIncoming` | same | a call arrives during a call |
| `call.outgoing` | `{ callId, number, snapshot }` | dialling started |
| `call.connecting` | `{ callId, snapshot }` | routing/ringing at the far end |
| `call.connected` | `{ callId, snapshot }` | media established |
| `call.held` | `{ callId, held, snapshot }` | hold state changed |
| `call.audioChanged` | `{ muted, audioRoute, snapshot }` | mute or route changed |
| `call.swapped` / `call.merged` / `call.separated` | `{ snapshot }` | multi-call topology changed |
| `call.failed` | `{ callId, reason }` | busy, network, rejected |
| `call.ended` | `{ callId, reason, durationSec, snapshot }` | any call finished |
| `call.idle` | `{ snapshot }` | last call cleared |
| `callLog.changed` | `{}` | provider changed |
| `contacts.changed` | `{}` | provider changed |
| `private.changed` | `{ contactKey, patch }` | private data written |
| `sim.changed` | `{ defaultSim }` | SIM swapped / default changed |
| `permissions.changed` | full status map | any grant changed |
| `spam.updated` | `{ numberKey }` | verdict or list changed |
| `reminder.due` | `Reminder` | an alarm fired |
| `reminder.changed` | `{ added \| removed \| completed }` | list mutated |
| `profile.updated` | `DialrProfile` | own profile changed |
| `media.progress` | `{ id, pct }` | during prepare/upload |
| `notification.action` | `{ id, action, payload }` | user tapped a notification action |
| `toast` | `{ text, tone, iconName }` | you want to surface a message |

`snapshot` is a full `CallSnapshot` (see [DATA_CONTRACTS.md](DATA_CONTRACTS.md)).
Sending the whole snapshot with every call event is deliberate: the frontend
never reconstructs call state from deltas, so a dropped event cannot desynchronise
the UI.

---

## 5. Threading and lifecycle

- `@JavascriptInterface` methods run on a **binder thread**. Never touch the
  WebView from there — always `webView.post { … }`.
- `evaluateJavascript` must be main thread.
- Do long work off the main thread and reply when done; the frontend is async
  everywhere and shows loading states.
- While the app is backgrounded during a call, `evaluateJavascript` still runs
  but WebView timers are throttled. This is why the call timer is derived from
  `connectedAt` rather than incremented — do not "fix" it by pushing ticks.
- On `onDestroy`, stop pushing events. Late `__dialrEvent` calls into a
  destroyed WebView will crash.

---

## 6. Bringing it up, in order

1. **Nothing.** Load the WebView with no bridge. The whole app runs on mocks.
   If this does not work, it is an asset-loading problem, not an integration one.
2. **`telephony`** — `deviceInfo`, `isEmergencyNumber`, `isDefaultDialer`.
   Smallest possible surface; proves the wire protocol both ways.
3. **`permissions`** — then real gates appear in Recents and Contacts.
4. **`contacts` + `callLog`** — the app fills with the user's real life. Most of
   the product is now genuinely working.
5. **`calls`** — the hard one. Test: outgoing answered, outgoing no-answer,
   incoming answered, incoming missed, incoming declined with quick reply,
   call waiting, swap, merge, mute, speaker, Bluetooth, DTMF.
6. **`sim`** — dual-SIM.
7. **`notifications` + `reminders`** — including reboot survival.
8. **`spam`**, **`profile`**, **`media`** — the cloud tier. Verify the app still
   works with all three switched off.

At each step, **Settings ▸ Advanced ▸ Native bridge status** shows exactly what
resolved to native and what is still mocked, and the event log below it shows
every event crossing the boundary.

---

## 7. Error codes

Reply `ok = false` with `{ message, code }`. The frontend renders these
specifically; anything else falls back to a generic error toast.

| Code | Meaning |
|---|---|
| `PERMISSION_DENIED` | permission missing; frontend re-checks status |
| `NOT_FOUND` | no such contact / call / asset |
| `INVALID_NUMBER` | not dialable |
| `BLOCKED` | number is on the blocklist |
| `NO_SIM` | no active subscription |
| `AIRPLANE_MODE` | radio unavailable |
| `CALL_LIMIT` | two calls already in progress |
| `NO_ACTIVE_CALL` | control sent with nothing live |
| `OFFLINE` | needs the network and has none |
| `MEDIA_TOO_LARGE` / `MEDIA_TOO_LONG` | over budget (§3.9) |
| `UNSUPPORTED_FORMAT` | cannot decode |
| `UNSUPPORTED_CHANNEL` | reminder channel not implemented |
| `CANCELLED` | user backed out of a picker |
| `TIMEOUT` | generated frontend-side after 8 s |
| `BRIDGE_ERROR` | anything else |

---

## 8. Permission matrix

| Permission | Needed for | If denied |
|---|---|---|
| `READ_CONTACTS` | names instead of numbers | Contacts tab shows a permission gate; calling still works |
| `WRITE_CONTACTS` | add / edit / delete | editor disabled, explained inline |
| `READ_CALL_LOG` | Recents, History, Rewind | Recents shows a permission gate |
| `WRITE_CALL_LOG` | clearing history | clear actions disabled |
| `READ_PHONE_STATE` | SIM info, call state | single-SIM assumed |
| `CALL_PHONE` | outgoing calls | dial fails with `PERMISSION_DENIED` |
| `ANSWER_PHONE_CALLS` | answering in-app | falls back to the system UI |
| `POST_NOTIFICATIONS` | call + reminder notifications | reminders become in-app only |
| `SEND_SMS` *(optional)* | quick replies, reminder messages | frontend hands off to the SMS app |
| `READ_MEDIA_IMAGES/VIDEO` *(optional)* | custom backgrounds | only built-ins offered |
| `SCHEDULE_EXACT_ALARM` *(optional)* | precise reminders | inexact window, disclosed |

---

## 9. What NOT to build

These are already done. Reimplementing them natively will fight the frontend.

- Any screen, layout, transition or empty state
- Relative-time or day-part strings ("Last night", "Afternoon 3:13 PM")
- Call sentences ("They called you") — including pronoun handling
- Rewind statistics, callback debt, best-time, top-of-mind, T9 matching
- Deciding what the dock shows
- Theme colours, palette restraint, contrast checking
- Whether the post-call sheet should appear
- Which spam verdict becomes a warning vs a silence vs a block

Supply data and capabilities. The experience is already built on top of them.
