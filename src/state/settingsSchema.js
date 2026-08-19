/**
 * DIALR — settings registry.
 *
 * Settings are DATA, not screens. Every control below is declared once and the
 * Settings UI renders itself from this list. That buys three things the brief
 * asks for and a hand-built panel cannot give you:
 *
 *   1. Search across every setting, including ones buried three levels deep.
 *   2. Defaults, persistence and reset for free — no drift between the
 *      control, the stored value and the thing that reads it.
 *   3. A settings panel that grows without becoming unmaintainable.
 *
 * ANTI-OVERWHELM RULES (these are why the app doesn't feel like a cockpit):
 *   - `tier: 1` fields are shown by default. `tier: 2` fields live behind
 *     "More" inside their group. Roughly a third of the list is tier 1.
 *   - Every field has a `hint` in plain language. If a setting cannot be
 *     explained in one sentence, the feature is wrong, not the copy.
 *   - Defaults are chosen so that a user who never opens Settings has a good
 *     product. Nothing important is off by default.
 */

export const SECTIONS = [
  { id: 'appearance', title: 'Look',            blurb: 'Theme, wallpaper, how much colour.',        icon: 'palette' },
  { id: 'calling',    title: 'Calls',           blurb: 'SIM, answering, in-call behaviour.',        icon: 'phone' },
  { id: 'identity',   title: 'You',             blurb: 'Your DIALR profile and who can see it.',    icon: 'user' },
  { id: 'recents',    title: 'Recents',         blurb: 'How your call history reads.',              icon: 'clock' },
  { id: 'smart',      title: 'Smart',           blurb: 'The quiet intelligence. All optional.',     icon: 'spark' },
  { id: 'protection', title: 'Protection',      blurb: 'Spam, blocking, repeat callers.',           icon: 'shield' },
  { id: 'replies',    title: 'Replies',         blurb: 'Quick replies and callback reminders.',     icon: 'message' },
  { id: 'sound',      title: 'Sound',           blurb: 'Ringtones, tones, vibration.',              icon: 'wave' },
  { id: 'access',     title: 'Accessibility',   blurb: 'Contrast, text size, motion.',              icon: 'access' },
  { id: 'privacy',    title: 'Privacy & data',  blurb: 'What stays on this phone.',                 icon: 'lock' },
  { id: 'advanced',   title: 'Advanced',        blurb: 'Permissions, integration, demo tools.',     icon: 'gear' },
  { id: 'about',      title: 'About',           blurb: 'Version, licences, credits.',               icon: 'info' },
];

const f = (o) => ({ tier: 1, type: 'toggle', ...o });

export const FIELDS = [
  /* ============================ LOOK ==================================== */
  f({ id: 'appearance.profile', section: 'appearance', group: 'Foundation', tier: 1,
      type: 'segment', label: 'Style', default: 'expressive',
      options: [
        { value: 'standard',   label: 'Standard',   hint: 'Pure black and white. Nothing is tinted.' },
        { value: 'expressive', label: 'Expressive', hint: 'Wallpaper lends the app its colour.' },
      ],
      hint: 'DIALR Standard keeps the interface monochrome no matter what wallpaper you pick.',
      keywords: 'theme standard expressive customisation off' }),

  f({ id: 'appearance.mode', section: 'appearance', group: 'Foundation', tier: 1,
      type: 'segment', label: 'Mode', default: 'dark',
      options: [
        { value: 'dark',   label: 'Dark' },
        { value: 'light',  label: 'Light' },
        { value: 'system', label: 'Auto' },
      ],
      hint: 'Auto follows your phone.', keywords: 'dark light night auto' }),

  f({ id: 'appearance.wallpaper', section: 'appearance', group: 'Foundation', tier: 1,
      type: 'nav', target: 'wallpaper-picker', label: 'Wallpaper',
      hint: 'The image behind the app. Its colours become the accent.',
      keywords: 'background image theme picture wallpaper' }),

  f({ id: 'appearance.intensity', section: 'appearance', group: 'Colour', tier: 1,
      type: 'segment', label: 'Colour from wallpaper', default: 'subtle',
      options: [
        { value: 'off',        label: 'Off' },
        { value: 'subtle',     label: 'Subtle' },
        { value: 'balanced',   label: 'Balanced' },
        { value: 'expressive', label: 'Expressive' },
      ],
      hint: 'How far the wallpaper’s colour reaches into buttons, chips and cards.',
      visibleWhen: (s) => s.appearance.profile === 'expressive',
      keywords: 'accent tint colour saturation intensity' }),

  f({ id: 'appearance.showWallpaper', section: 'appearance', group: 'Colour', tier: 1,
      label: 'Show the wallpaper', default: true,
      hint: 'Turn off to keep the colours but hide the image.',
      visibleWhen: (s) => s.appearance.profile === 'expressive', keywords: 'image visible hide' }),

  f({ id: 'appearance.tintDock', section: 'appearance', group: 'Colour', tier: 2,
      label: 'Tint the dock', default: true, hint: 'Let the dock pick up the accent too.',
      visibleWhen: (s) => s.appearance.profile === 'expressive' }),

  f({ id: 'appearance.cardDensity', section: 'appearance', group: 'Layout', tier: 1,
      type: 'segment', label: 'Card size', default: 'comfortable',
      options: [{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }],
      hint: 'Compact fits more recent calls on screen.', keywords: 'density spacing compact' }),

  f({ id: 'appearance.dockStyle', section: 'appearance', group: 'Layout', tier: 2,
      type: 'segment', label: 'Dock', default: 'floating',
      options: [{ value: 'floating', label: 'Floating' }, { value: 'anchored', label: 'Anchored' }],
      hint: 'Anchored sits flush with the bottom edge.' }),

  f({ id: 'appearance.showSearch', section: 'appearance', group: 'Layout', tier: 2,
      label: 'Search bar above the dock', default: true,
      hint: 'Hide it to reclaim the space; search stays available from the dock.' }),

  f({ id: 'appearance.bigNames', section: 'appearance', group: 'Layout', tier: 2,
      label: 'Oversized names', default: true,
      hint: 'The editorial look. Off makes names a normal size.' }),

  /* ============================ CALLS =================================== */
  f({ id: 'calling.defaultSim', section: 'calling', group: 'SIM', tier: 1,
      type: 'select', label: 'Call with', default: 'ask',
      options: [{ value: 'ask', label: 'Ask every time' }, { value: 'sim1', label: 'SIM 1' }, { value: 'sim2', label: 'SIM 2' }],
      hint: 'Used when a contact has no SIM of their own.', keywords: 'dual sim slot carrier' }),

  f({ id: 'calling.rememberSimPerContact', section: 'calling', group: 'SIM', tier: 1,
      label: 'Remember SIM per person', default: true,
      hint: 'Once you pick a SIM for someone, DIALR keeps using it.' }),

  f({ id: 'calling.confirmBeforeCall', section: 'calling', group: 'Placing calls', tier: 1,
      label: 'Confirm before calling', default: false,
      hint: 'Adds a confirmation step. Useful if you pocket-dial.' }),

  f({ id: 'calling.tapNumberToCopy', section: 'calling', group: 'Placing calls', tier: 1,
      label: 'Tap the number to copy', default: true,
      hint: 'One tap on the typed number copies it. No long press.' }),

  f({ id: 'calling.dialPadHaptics', section: 'calling', group: 'Placing calls', tier: 2,
      label: 'Vibrate on keypress', default: true }),

  f({ id: 'calling.dialPadTones', section: 'calling', group: 'Placing calls', tier: 2,
      label: 'Keypad tones', default: true }),

  f({ id: 'calling.autoSpeakerOnFlat', section: 'calling', group: 'During a call', tier: 2,
      label: 'Speaker when face-up', default: false,
      hint: 'Switches to speaker if you put the phone down mid-call.' }),

  f({ id: 'calling.vibrateOnAnswer', section: 'calling', group: 'During a call', tier: 2,
      label: 'Vibrate when they answer', default: true }),

  f({ id: 'calling.vibrateOnEnd', section: 'calling', group: 'During a call', tier: 2,
      label: 'Vibrate when the call ends', default: true }),

  f({ id: 'calling.notesEnabled', section: 'calling', group: 'During a call', tier: 1,
      label: 'Call notes', default: true,
      hint: 'A 50-character scratchpad during a call. It shows up in that person’s history.',
      keywords: 'note memo scratch' }),

  f({ id: 'calling.keepScreenOn', section: 'calling', group: 'During a call', tier: 2,
      label: 'Keep the screen on', default: false }),

  f({ id: 'calling.postCallSheet', section: 'calling', group: 'After a call', tier: 1,
      type: 'select', label: 'After a call', default: 'smart',
      options: [
        { value: 'smart',  label: 'Show when useful' },
        { value: 'always', label: 'Always show' },
        { value: 'never',  label: 'Never show' },
      ],
      hint: '"When useful" means unsaved numbers, missed calls, very short calls and calls with notes.' }),

  f({ id: 'calling.postCallSeconds', section: 'calling', group: 'After a call', tier: 2,
      type: 'slider', label: 'Dismiss after', default: 8, min: 4, max: 20, step: 1, unit: 's',
      visibleWhen: (s) => s.calling.postCallSheet !== 'never' }),

  f({ id: 'calling.answerStyle', section: 'calling', group: 'Answering', tier: 1,
      type: 'segment', label: 'Answer with', default: 'tap',
      options: [{ value: 'tap', label: 'Tap' }, { value: 'swipe', label: 'Swipe' }],
      hint: 'Swipe is harder to trigger by accident in a pocket.' }),

  f({ id: 'calling.flipToDecline', section: 'calling', group: 'Answering', tier: 2,
      label: 'Flip face-down to decline', default: false }),

  f({ id: 'calling.showCallerNumber', section: 'calling', group: 'Answering', tier: 2,
      label: 'Show the number on incoming calls', default: true,
      hint: 'Off hides the digits when you already know the name.' }),

  /* =========================== IDENTITY ================================= */
  f({ id: 'identity.profile', section: 'identity', group: 'Your profile', tier: 1,
      type: 'nav', target: 'profile-editor', label: 'Edit your profile',
      hint: 'Name, photo, bio, links.', keywords: 'name photo bio links poster' }),

  f({ id: 'identity.dialrEnabled', section: 'identity', group: 'Your profile', tier: 1,
      label: 'Be findable on DIALR', default: true,
      hint: 'Off makes DIALR a private dialer: no profile, no lookups, nothing leaves the phone.',
      keywords: 'cloud firebase offline private' }),

  f({ id: 'identity.visibility', section: 'identity', group: 'Who can see you', tier: 1,
      type: 'select', label: 'Profile visible to', default: 'contacts',
      options: [
        { value: 'everyone', label: 'Everyone' },
        { value: 'dialr',    label: 'DIALR users' },
        { value: 'contacts', label: 'People in my contacts' },
        { value: 'squad',    label: 'My squad' },
        { value: 'nobody',   label: 'Nobody' },
      ],
      visibleWhen: (s) => s.identity.dialrEnabled }),

  f({ id: 'identity.showPhotoToUnsaved', section: 'identity', group: 'Who can see you', tier: 2,
      label: 'Show my photo to people who haven’t saved me', default: true,
      visibleWhen: (s) => s.identity.dialrEnabled }),
  f({ id: 'identity.showBio', section: 'identity', group: 'Who can see you', tier: 2,
      label: 'Show my bio', default: true, visibleWhen: (s) => s.identity.dialrEnabled }),
  f({ id: 'identity.showSquad', section: 'identity', group: 'Who can see you', tier: 2,
      label: 'Show my squad count', default: true, visibleWhen: (s) => s.identity.dialrEnabled }),
  f({ id: 'identity.showViews', section: 'identity', group: 'Who can see you', tier: 2,
      label: 'Show profile views', default: false, visibleWhen: (s) => s.identity.dialrEnabled }),
  f({ id: 'identity.showPickupRate', section: 'identity', group: 'Who can see you', tier: 2,
      label: 'Show my pickup rate', default: false,
      hint: 'Off by default — it is a flattering number on a good week and an unkind one otherwise.',
      visibleWhen: (s) => s.identity.dialrEnabled }),

  f({ id: 'identity.lookupUnknown', section: 'identity', group: 'Looking others up', tier: 1,
      label: 'Identify unknown callers', default: true,
      hint: 'Checks a caller’s number against DIALR profiles. Only the number is sent.',
      visibleWhen: (s) => s.identity.dialrEnabled }),

  f({ id: 'identity.lookupOnWifiOnly', section: 'identity', group: 'Looking others up', tier: 2,
      label: 'Only on Wi-Fi', default: false,
      visibleWhen: (s) => s.identity.dialrEnabled && s.identity.lookupUnknown }),

  /* ============================ RECENTS ================================= */
  f({ id: 'recents.naturalLanguage', section: 'recents', group: 'Reading', tier: 1,
      label: 'Plain-language history', default: true,
      hint: '"She called you, 46 minutes ago" instead of arrows and timestamps.' }),

  f({ id: 'recents.grouping', section: 'recents', group: 'Reading', tier: 1,
      type: 'select', label: 'Group recents by', default: 'person',
      options: [
        { value: 'person', label: 'Person' },
        { value: 'call',   label: 'Every call' },
        { value: 'day',    label: 'Day' },
      ],
      hint: '"Person" shows each person once with their latest call.' }),

  f({ id: 'recents.showDuration', section: 'recents', group: 'Reading', tier: 2,
      label: 'Show call length', default: true }),
  f({ id: 'recents.showSim', section: 'recents', group: 'Reading', tier: 2,
      label: 'Show which SIM', default: false }),
  f({ id: 'recents.showNotes', section: 'recents', group: 'Reading', tier: 1,
      label: 'Show notes on cards', default: true }),

  f({ id: 'recents.includeBlocked', section: 'recents', group: 'What appears', tier: 2,
      label: 'Include blocked callers', default: false }),
  f({ id: 'recents.includeSpam', section: 'recents', group: 'What appears', tier: 2,
      label: 'Include suspected spam', default: true,
      hint: 'Kept on by default so you can see what was filtered.' }),

  f({ id: 'recents.rewindEnabled', section: 'recents', group: 'Rewind', tier: 1,
      label: 'Check Rewind', default: true,
      hint: 'A recap of your calling history with one person. Computed on this phone.' }),
  f({ id: 'recents.rewindMinCalls', section: 'recents', group: 'Rewind', tier: 2,
      type: 'slider', label: 'Needs at least', default: 5, min: 2, max: 30, step: 1, unit: ' calls',
      hint: 'Below this, Rewind stays hidden rather than showing a thin recap.',
      visibleWhen: (s) => s.recents.rewindEnabled }),

  f({ id: 'recents.historyLimit', section: 'recents', group: 'Storage', tier: 2,
      type: 'select', label: 'Keep history for', default: '1y',
      options: [{ value: '30d', label: '30 days' }, { value: '90d', label: '3 months' },
                { value: '1y', label: '1 year' }, { value: 'forever', label: 'Forever' }] }),

  f({ id: 'recents.clearHistory', section: 'recents', group: 'Storage', tier: 1,
      type: 'action', action: 'clear-history', label: 'Clear all call history',
      dangerous: true, hint: 'Removes it from this phone. Cannot be undone.' }),

  /* ============================= SMART ================================== */
  f({ id: 'smart.smartDock', section: 'smart', group: 'The dock', tier: 1,
      label: 'Contextual dock', default: true,
      hint: 'The dock offers the obvious next action — Call Avni, Add contact — as you type.' }),

  f({ id: 'smart.t9', section: 'smart', group: 'Dialling', tier: 1,
      label: 'Search by keypad letters', default: true,
      hint: 'Typing 2864 finds Avni. Works alongside normal number matching.' }),

  f({ id: 'smart.speedDial', section: 'smart', group: 'Dialling', tier: 2,
      label: 'Hold a digit for speed dial', default: true }),

  f({ id: 'smart.callbackDebt', section: 'smart', group: 'Nudges', tier: 1,
      label: 'Flag calls you owe back', default: true,
      hint: 'Missed calls you haven’t returned get a quiet marker until you do.' }),

  f({ id: 'smart.bestTime', section: 'smart', group: 'Nudges', tier: 1,
      label: 'Best time to call', default: true,
      hint: '"Usually answers around 9 PM", worked out from your own call history.' }),

  f({ id: 'smart.fadingContacts', section: 'smart', group: 'Nudges', tier: 2,
      label: 'Reconnect nudges', default: false,
      hint: 'Occasionally points out someone close you haven’t spoken to in a while. Off by default.' }),

  f({ id: 'smart.fadingWeeks', section: 'smart', group: 'Nudges', tier: 2,
      type: 'slider', label: 'Nudge after', default: 4, min: 2, max: 26, step: 1, unit: ' weeks',
      visibleWhen: (s) => s.smart.fadingContacts }),

  f({ id: 'smart.firstTimeCaller', section: 'smart', group: 'On the call screen', tier: 1,
      label: 'Mark first-time callers', default: true,
      hint: 'A small "first time" tag when a number has never called before.' }),

  f({ id: 'smart.repeatToday', section: 'smart', group: 'On the call screen', tier: 1,
      label: 'Show "called 3× today"', default: true }),

  f({ id: 'smart.lastNoteOnIncoming', section: 'smart', group: 'On the call screen', tier: 1,
      label: 'Show your last note', default: true,
      hint: 'One line of context while deciding whether to answer. Yours only — they never see it.' }),

  f({ id: 'smart.numberRegion', section: 'smart', group: 'On the call screen', tier: 2,
      label: 'Show where a number is from', default: true,
      hint: 'Region and carrier for numbers you don’t know. Worked out offline.' }),

  f({ id: 'smart.silentHours', section: 'smart', group: 'Silent hours', tier: 1,
      label: 'Silent hours', default: false,
      hint: 'Unknown numbers go quiet between the hours you set. Your contacts still ring.' }),
  f({ id: 'smart.silentFrom', section: 'smart', group: 'Silent hours', tier: 1,
      type: 'time', label: 'From', default: '23:00', visibleWhen: (s) => s.smart.silentHours }),
  f({ id: 'smart.silentTo', section: 'smart', group: 'Silent hours', tier: 1,
      type: 'time', label: 'Until', default: '07:00', visibleWhen: (s) => s.smart.silentHours }),
  f({ id: 'smart.silentBreakthrough', section: 'smart', group: 'Silent hours', tier: 1,
      label: 'Let urgent calls through', default: true,
      hint: 'If the same number calls three times within five minutes, it rings. Emergencies are not silenced.',
      visibleWhen: (s) => s.smart.silentHours }),

  f({ id: 'smart.topOfMind', section: 'smart', group: 'Contacts', tier: 2,
      label: 'Top of mind row', default: true,
      hint: 'The handful of people you actually call, pinned above the contact list.' }),

  f({ id: 'smart.duplicateSuggestions', section: 'smart', group: 'Contacts', tier: 2,
      label: 'Suggest duplicate merges', default: true }),

  f({ id: 'smart.swipeActions', section: 'smart', group: 'Gestures', tier: 1,
      label: 'Swipe recent cards', default: true,
      hint: 'Swipe right to call, left to message.' }),

  /* ========================== PROTECTION ================================ */
  f({ id: 'protection.enabled', section: 'protection', group: 'Spam', tier: 1,
      label: 'Call protection', default: true,
      hint: 'Layers your rules, your blocklist and DIALR’s network signal. Emergency numbers are never affected.' }),

  f({ id: 'protection.level', section: 'protection', group: 'Spam', tier: 1,
      type: 'select', label: 'How strict', default: 'balanced',
      options: [
        { value: 'lenient',  label: 'Warn only',      hint: 'Everything rings; suspected spam is labelled.' },
        { value: 'balanced', label: 'Silence likely spam', hint: 'High-confidence spam rings silently and lands in Recents.' },
        { value: 'strict',   label: 'Block likely spam',   hint: 'High-confidence spam never reaches you.' },
      ],
      visibleWhen: (s) => s.protection.enabled }),

  f({ id: 'protection.threshold', section: 'protection', group: 'Spam', tier: 2,
      type: 'slider', label: 'Confidence needed', default: 0.75, min: 0.4, max: 0.95, step: 0.05,
      format: 'percent',
      hint: 'Higher means fewer false positives and more spam getting through.',
      visibleWhen: (s) => s.protection.enabled }),

  f({ id: 'protection.useNetwork', section: 'protection', group: 'Spam', tier: 1,
      label: 'Use DIALR’s spam network', default: true,
      hint: 'Checks numbers against reports from other users. Only the number is sent, never your contacts.',
      visibleWhen: (s) => s.protection.enabled }),

  f({ id: 'protection.trustBusinesses', section: 'protection', group: 'Spam', tier: 1,
      label: 'Always allow verified businesses', default: true,
      hint: 'Deliveries, banks, clinics and anyone you have called yourself.' }),

  f({ id: 'protection.rules', section: 'protection', group: 'Your rules', tier: 1,
      type: 'nav', target: 'block-rules', label: 'Block rules',
      hint: 'Prefixes, patterns and specific numbers.' }),
  f({ id: 'protection.blocklist', section: 'protection', group: 'Your rules', tier: 1,
      type: 'nav', target: 'blocklist', label: 'Blocked numbers' }),
  f({ id: 'protection.allowlist', section: 'protection', group: 'Your rules', tier: 1,
      type: 'nav', target: 'allowlist', label: 'Always allow' }),

  f({ id: 'protection.repeatDetection', section: 'protection', group: 'Repeat callers', tier: 1,
      label: 'Notice repeated calls', default: true,
      hint: 'If someone calls again and again without you answering, DIALR offers to block them.' }),
  f({ id: 'protection.repeatCount', section: 'protection', group: 'Repeat callers', tier: 2,
      type: 'slider', label: 'After', default: 5, min: 3, max: 12, step: 1, unit: ' calls',
      visibleWhen: (s) => s.protection.repeatDetection }),
  f({ id: 'protection.repeatWindow', section: 'protection', group: 'Repeat callers', tier: 2,
      type: 'slider', label: 'Within', default: 15, min: 5, max: 120, step: 5, unit: ' min',
      visibleWhen: (s) => s.protection.repeatDetection }),

  f({ id: 'protection.screenUnknown', section: 'protection', group: 'Screening', tier: 2,
      label: 'Offer to screen unknown callers', default: true,
      hint: 'Adds a Screen button that sends a quick reply asking who is calling.' }),

  f({ id: 'protection.blockHidden', section: 'protection', group: 'Screening', tier: 2,
      label: 'Block withheld numbers', default: false }),

  /* ============================ REPLIES ================================= */
  f({ id: 'replies.one', section: 'replies', group: 'Quick replies', tier: 1,
      type: 'text', label: 'Reply 1', default: "I'll call you back.", maxLength: 90 }),
  f({ id: 'replies.two', section: 'replies', group: 'Quick replies', tier: 1,
      type: 'text', label: 'Reply 2', default: "Can't talk right now.", maxLength: 90 }),
  f({ id: 'replies.three', section: 'replies', group: 'Quick replies', tier: 1,
      type: 'text', label: 'Reply 3', default: "What's up?", maxLength: 90 }),
  f({ id: 'replies.channel', section: 'replies', group: 'Quick replies', tier: 1,
      type: 'select', label: 'Send replies via', default: 'sms',
      options: [{ value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'ask', label: 'Ask each time' }] }),

  f({ id: 'replies.reminderPresets', section: 'replies', group: 'Reminders', tier: 1,
      type: 'chips', label: 'Reminder options', default: [15, 30, 60, 180],
      options: [5, 10, 15, 30, 60, 120, 180, 360, 1440],
      unit: 'min', hint: 'Which delays appear when you set a callback reminder.' }),

  f({ id: 'replies.tellThem', section: 'replies', group: 'Reminders', tier: 1,
      type: 'select', label: 'Tell them you’ll call back', default: 'ask',
      options: [{ value: 'never', label: 'Never' }, { value: 'ask', label: 'Ask me' }, { value: 'always', label: 'Always' }],
      hint: 'Sends a message like "I’ll call you back in about 30 minutes."' }),

  f({ id: 'replies.tellThemChannel', section: 'replies', group: 'Reminders', tier: 2,
      type: 'select', label: 'Send that message via', default: 'sms',
      options: [{ value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'dialr', label: 'DIALR, if they have it' }],
      visibleWhen: (s) => s.replies.tellThem !== 'never' }),

  /* ============================= SOUND ================================== */
  f({ id: 'sound.ringtone', section: 'sound', group: 'Ringing', tier: 1,
      type: 'nav', target: 'ringtone-picker', label: 'Ringtone', hint: 'Default for everyone.' }),
  f({ id: 'sound.volumeRamp', section: 'sound', group: 'Ringing', tier: 2,
      label: 'Ramp the volume up', default: true, hint: 'Starts quiet and builds.' }),
  f({ id: 'sound.vibrateOnRing', section: 'sound', group: 'Ringing', tier: 1,
      label: 'Vibrate when ringing', default: true }),
  f({ id: 'sound.hapticsEnabled', section: 'sound', group: 'Feedback', tier: 1,
      label: 'Haptics', default: true, hint: 'The small taps throughout the interface.' }),
  f({ id: 'sound.hapticStrength', section: 'sound', group: 'Feedback', tier: 2,
      type: 'segment', label: 'Haptic strength', default: 'medium',
      options: [{ value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'strong', label: 'Strong' }],
      visibleWhen: (s) => s.sound.hapticsEnabled }),
  f({ id: 'sound.connectTone', section: 'sound', group: 'Feedback', tier: 2,
      label: 'Tone when a call connects', default: true }),
  f({ id: 'sound.endTone', section: 'sound', group: 'Feedback', tier: 2,
      label: 'Tone when a call ends', default: true }),

  /* ========================== ACCESSIBILITY ============================= */
  f({ id: 'access.textSize', section: 'access', group: 'Reading', tier: 1,
      type: 'slider', label: 'Text size', default: 1, min: 0.9, max: 1.35, step: 0.05, format: 'scale' }),
  f({ id: 'access.contrast', section: 'access', group: 'Reading', tier: 1,
      type: 'segment', label: 'Contrast', default: 'normal',
      options: [{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }],
      hint: 'High contrast also removes the wallpaper tint from surfaces.' }),
  f({ id: 'access.motion', section: 'access', group: 'Motion', tier: 1,
      type: 'segment', label: 'Motion', default: 'system',
      options: [{ value: 'system', label: 'Follow system' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }] }),
  f({ id: 'access.largeCallButtons', section: 'access', group: 'Calls', tier: 1,
      label: 'Larger answer and decline buttons', default: false }),
  f({ id: 'access.alwaysShowLabels', section: 'access', group: 'Calls', tier: 2,
      label: 'Always label icons', default: false,
      hint: 'Adds a word under every icon button.' }),

  /* ============================ PRIVACY ================================= */
  f({ id: 'privacy.localOnly', section: 'privacy', group: 'On this phone', tier: 1,
      type: 'info', label: 'Contacts, call history, notes, reminders and private labels never leave this phone.',
      hint: 'DIALR only sends a number when you have asked it to identify a caller or check for spam.' }),
  f({ id: 'privacy.analytics', section: 'privacy', group: 'Sharing', tier: 1,
      label: 'Share anonymous usage data', default: false }),
  f({ id: 'privacy.crashReports', section: 'privacy', group: 'Sharing', tier: 1,
      label: 'Send crash reports', default: true }),
  f({ id: 'privacy.contributeSpam', section: 'privacy', group: 'Sharing', tier: 1,
      label: 'Contribute my spam reports', default: true,
      hint: 'Numbers you report help other people. Nothing else is shared.' }),
  f({ id: 'privacy.exportData', section: 'privacy', group: 'Your data', tier: 1,
      type: 'action', action: 'export-data', label: 'Export my data' }),
  f({ id: 'privacy.wipeLocal', section: 'privacy', group: 'Your data', tier: 1,
      type: 'action', action: 'wipe-local', label: 'Erase DIALR data on this phone',
      dangerous: true, hint: 'Settings, notes, private labels and reminders. Your contacts and call log are untouched.' }),
  f({ id: 'privacy.deleteProfile', section: 'privacy', group: 'Your data', tier: 1,
      type: 'action', action: 'delete-profile', label: 'Delete my DIALR profile',
      dangerous: true, visibleWhen: (s) => s.identity.dialrEnabled }),

  /* =========================== ADVANCED ================================= */
  f({ id: 'advanced.permissions', section: 'advanced', group: 'System', tier: 1,
      type: 'nav', target: 'permissions', label: 'Permissions' }),
  f({ id: 'advanced.defaultDialer', section: 'advanced', group: 'System', tier: 1,
      type: 'action', action: 'default-dialer', label: 'Set DIALR as the default phone app' }),
  f({ id: 'advanced.bridgeStatus', section: 'advanced', group: 'Integration', tier: 1,
      type: 'nav', target: 'bridge-status', label: 'Native bridge status',
      hint: 'Which services are live and which are running on mock data.' }),
  f({ id: 'advanced.eventLog', section: 'advanced', group: 'Integration', tier: 2,
      type: 'nav', target: 'event-log', label: 'Event log' }),
  f({ id: 'advanced.demoPanel', section: 'advanced', group: 'Demo', tier: 1,
      type: 'nav', target: 'demo', label: 'Demo controls',
      hint: 'Simulate incoming calls, spam, offline and permission states.' }),
  f({ id: 'advanced.resetSettings', section: 'advanced', group: 'Demo', tier: 1,
      type: 'action', action: 'reset-settings', label: 'Reset all settings', dangerous: true }),

  /* ============================= ABOUT ================================== */
  f({ id: 'about.version', section: 'about', group: 'App', tier: 1,
      type: 'info', label: 'DIALR — frontend architecture preview', hint: 'Running on mock data.' }),
  f({ id: 'about.docs', section: 'about', group: 'App', tier: 1,
      type: 'nav', target: 'about-docs', label: 'How this app is built' }),
];

/* ---------------------------------------------------------------- helpers */

/** Nested defaults object, derived from the registry. Single source of truth. */
export function defaultSettings() {
  const out = {};
  for (const field of FIELDS) {
    if (field.type === 'nav' || field.type === 'action' || field.type === 'info') continue;
    setPath(out, field.id, Array.isArray(field.default) ? [...field.default] : field.default);
  }
  return out;
}

export function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Immutable set — returns a new object graph along the changed path only. */
export function withPath(obj, path, value) {
  const parts = path.split('.');
  const clone = { ...obj };
  let cur = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = { ...(cur[parts[i]] || {}) };
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return clone;
}

export const fieldsBySection = (sectionId) => FIELDS.filter((x) => x.section === sectionId);

/** Free-text search across labels, hints, keywords and section titles. */
export function searchFields(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return FIELDS
    .map((field) => {
      const section = SECTIONS.find((s) => s.id === field.section);
      const hay = [field.label, field.hint, field.keywords, field.group, section?.title]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return null;
      // Label matches rank above hint matches.
      const score = field.label.toLowerCase().includes(q) ? 2 : 1;
      return { field, section, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);
}
