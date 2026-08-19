/**
 * DIALR — intents.
 *
 * Everything the UI can *do*, in one place. Components emit intents; this
 * module talks to services and dispatches to the store. No component imports a
 * service directly, which is why swapping mocks for the Kotlin bridge is a
 * configuration change rather than a refactor.
 *
 * The call-placing path is the one worth reading closely: it enforces the
 * product's ordering — emergency numbers bypass everything, blocked numbers
 * stop, the SIM question is asked once and remembered, and the actual dial is
 * the last thing that happens.
 */
import { A, pushToast, dismissToast } from '../state/actions.js';
import { withPath, getPath, defaultSettings } from '../state/settingsSchema.js';
import { selContactsByKey, resolveIdentity, selectContactDetail } from '../state/selectors.js';
import { repeatedCallBurst, inSilentHours } from '../state/smart.js';
import { numberKey, formatNumber, clampNote, nameParts } from '../core/format.js';
import { paletteFromMeta } from '../theme/palette.js';
import { findMedia, WALLPAPERS } from '../data/media.js';
import haptics from '../core/haptics.js';
import bus from '../core/bus.js';

const SETTINGS_KEY = 'settings';
const THEME_KEY = 'theme';
const ONBOARD_KEY = 'onboarded';

export function createActions({ store, services, theme }) {
  const dispatch = store.dispatch;
  const state = () => store.getState();
  let userWallpapers = [];
  let pendingSim = null;

  /* ============================== plumbing ============================== */

  const toast = (spec) => dispatch(pushToast(spec));

  const fail = (err, fallback = 'Something went wrong') => {
    console.error('[dialr]', err);
    toast({ text: err?.message || fallback, tone: 'negative', iconName: 'warn' });
  };

  async function persistSettings() {
    try { await services.storage.set(SETTINGS_KEY, state().settings); }
    catch (e) { console.warn('[settings] not persisted', e); }
  }

  async function persistTheme() {
    const t = state().theme;
    try { await services.storage.set(THEME_KEY, { wallpaperId: t.wallpaperId }); }
    catch { /* non-fatal */ }
  }

  /* ============================ navigation ============================== */

  const setTab = (tab) => { dispatch({ type: A.APP_SET_TAB, tab }); };
  const pushOverlay = (kind, props = {}) => dispatch({ type: A.OVERLAY_PUSH, kind, props });
  const popOverlay = () => {
    // Leaving the wallpaper picker must not strand a hover preview on screen.
    const top = state().overlay.stack[state().overlay.stack.length - 1];
    dispatch({ type: A.OVERLAY_POP });
    if (top?.kind === 'wallpaper-picker') theme.sync();
  };
  const clearOverlays = () => { dispatch({ type: A.OVERLAY_CLEAR }); theme.sync(); };

  /* ============================== dialer ================================ */

  const dialerAppend = (d) => dispatch({ type: A.DIALER_APPEND, digit: d });
  const dialerBackspace = () => dispatch({ type: A.DIALER_BACKSPACE });
  const dialerClear = () => dispatch({ type: A.DIALER_CLEAR });
  const dialerSet = (v) => dispatch({ type: A.DIALER_INPUT, value: v });

  function dialerLongPress(digit) {
    const s = state();
    if (digit === '0') {
      // Replace the trailing 0 with +, the universal convention.
      dispatch({ type: A.DIALER_INPUT, value: `${s.dialer.input.slice(0, -1)}+` });
      return;
    }
    if (!s.settings.smart.speedDial) return;
    toast({ text: `Hold ${digit} to speed-dial — assign someone in Contacts.`, iconName: 'spark' });
  }

  /* =============================== calling ============================== */

  /**
   * The single entry point for placing a call. Order matters and is enforced
   * here rather than in any screen.
   */
  async function call(number, contactKey, opts = {}) {
    if (!number) return;
    const s = state();

    // 1. Emergency numbers bypass every rule DIALR has. Non-negotiable.
    const emergency = await services.telephony.isEmergencyNumber(number).catch(() => false);
    if (emergency) return placeNow(number, { simId: undefined, emergency: true });

    // 2. Blocked numbers do not silently dial.
    const key = contactKey || numberKey(number);
    const verdict = s.directory.spam[key];
    if (verdict?.blocked) {
      toast({
        text: `${formatNumber(number)} is blocked`, tone: 'warn', iconName: 'block',
        actionLabel: 'Unblock', onAction: () => unblockNumber(number),
      });
      return;
    }

    // 3. Which SIM? Contact preference beats the global default; "ask" prompts
    //    once and can be remembered for this person.
    const view = selContactsByKey(s).get(key);
    const preferred = (s.settings.calling.rememberSimPerContact && view?.preferredSim) || null;
    const fallbackSim = s.settings.calling.defaultSim;
    let simId = opts.simId || preferred || (fallbackSim === 'ask' ? null : fallbackSim);

    if (!simId && s.directory.sims.length > 1) {
      pendingSim = { number, contactKey: key, name: view?.firstName };
      pushOverlay('sim', { number, contactKey: key, name: view?.firstName, preferred: fallbackSim });
      return;
    }

    // 4. Optional confirmation, for people who pocket-dial.
    if (s.settings.calling.confirmBeforeCall && !opts.confirmed) {
      const name = view?.displayName || formatNumber(number);
      pushOverlay('options', {
        title: `Call ${name}?`,
        options: [{ value: 'yes', label: 'Call now' }, { value: 'no', label: 'Not now' }],
        onPick: (v) => { if (v === 'yes') call(number, key, { ...opts, confirmed: true, simId }); },
      });
      return;
    }

    placeNow(number, { simId });
  }

  async function placeNow(number, { simId, emergency } = {}) {
    dispatch({ type: A.CALL_SET_PENDING, number });
    clearOverlays();
    try {
      await services.calls.place(number, { simId });
      haptics.fire('tap');
    } catch (err) {
      dispatch({ type: A.CALL_SET_PENDING, number: null });
      if (err.code === 'BLOCKED') toast({ text: 'That number is blocked.', tone: 'warn', iconName: 'block' });
      else if (err.code === 'INVALID_NUMBER') toast({ text: 'That is not a number DIALR can dial.', tone: 'warn', iconName: 'warn' });
      else fail(err, 'The call could not be placed');
    }
  }

  function pickSim(simId, remember, props) {
    popOverlay();
    if (remember && props.contactKey) {
      services.contacts.setPrivate(props.contactKey, { preferredSim: simId }).catch(() => {});
      dispatch({ type: A.DIR_PRIVATE_PATCH, contactKey: props.contactKey, patch: { preferredSim: simId } });
    }
    const p = pendingSim || props;
    pendingSim = null;
    placeNow(p.number, { simId });
  }

  const answer = (id) => services.calls.answer(id).catch(fail);
  const hangup = (id) => services.calls.hangup(id).catch(fail);
  const decline = (id) => services.calls.reject(id).catch(fail);
  const toggleMute = () => services.calls.setMute(!state().call.muted).catch(fail);
  const toggleHold = (id) => {
    const s = state().call.sessions.find((x) => x.id === id);
    return services.calls.setHold(id, s?.state !== 'held').catch(fail);
  };
  const sendDtmf = (d) => services.calls.sendDtmf(d).catch(() => {});
  const swapCalls = () => services.calls.swap().catch(fail);
  const mergeCalls = () => services.calls.merge().catch(fail);
  const toggleKeypad = (v) => dispatch({ type: A.CALL_SET_KEYPAD, open: v === undefined ? !state().call.keypadOpen : v });
  const setNoteDraft = (t) => dispatch({ type: A.CALL_SET_NOTE_DRAFT, text: clampNote(t) });

  async function cycleAudio() {
    const order = ['earpiece', 'speaker', 'bluetooth'];
    const devices = await services.calls.audioDevices().catch(() => []);
    const available = order.filter((r) => devices.some((d) => d.id === r && d.connected));
    const cur = state().call.audioRoute;
    const next = available[(available.indexOf(cur) + 1) % available.length] || 'speaker';
    services.calls.setAudioRoute(next).catch(fail);
  }

  function addCallFlow() {
    // Put the current call on hold implicitly by opening the keypad on a new
    // dial; the engine handles the hold when the second call is placed.
    clearOverlays();
    setTab('dialer');
    toast({ text: 'Dial the second number, then press call.', iconName: 'addCall' });
  }

  const clearPostCall = () => dispatch({ type: A.CALL_CLEAR_POSTCALL });

  /* ========================== overlays / flows ========================== */

  function openContact(contactKey, number) {
    const view = selContactsByKey(state()).get(contactKey);
    pushOverlay('contact', { contactKey, number: number || view?.primaryNumber });
  }

  function openHistory(contactKey, number) {
    pushOverlay('history', { contactKey, number });
  }

  function openRewind(contactKey, number) {
    pushOverlay('rewind', { contactKey, number });
  }

  function addContact(number, draft) {
    pushOverlay('contact-editor', { draft: { number, ...(draft || {}) } });
  }

  function openQuickReply(number, identity) {
    pushOverlay('quick-reply', { number, name: identity?.first || null, callId: state().call.sessions[0]?.id });
  }

  function openReminder(number, identity, opts = {}) {
    pushOverlay('reminder', { number, name: identity?.first || null, ...opts });
  }

  async function sendQuickReply(text, props) {
    popOverlay();
    if (props.callId) await services.calls.reject(props.callId, { replyText: text }).catch(() => {});
    // Sending the message itself is a native intent — SMS or WhatsApp.
    toast({ text: `Sent: “${text}”`, iconName: 'message' });
    bus.emit('reply.sent', { number: props.number, text });
  }

  function customReply(props) {
    popOverlay();
    toast({ text: 'Opens your messaging app on device.', iconName: 'message' });
    bus.emit('reply.custom', { number: props.number });
  }

  async function createReminder({ minutes, tellThem }, props) {
    popOverlay();
    if (props.declineFirst && state().call.sessions[0]) {
      await services.calls.reject(state().call.sessions[0].id).catch(() => {});
    }
    try {
      const name = props.name || formatNumber(props.number);
      const r = await services.reminders.create({
        number: props.number,
        label: `Call ${name}`,
        dueAt: Date.now() + minutes * 60_000,
        notifyThem: tellThem,
        channel: state().settings.replies.tellThemChannel,
      });
      dispatch({ type: A.REMINDER_UPSERT, reminder: r });
      toast({
        text: `Reminder set for ${minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}`,
        iconName: 'bell',
        actionLabel: 'Undo',
        onAction: () => { services.reminders.cancel(r.id); dispatch({ type: A.REMINDER_REMOVE, id: r.id }); },
      });
      if (tellThem) bus.emit('reply.sent', { number: props.number, text: `I’ll call you back in about ${minutes} minutes.` });
    } catch (e) { fail(e, 'Reminder could not be set'); }
  }

  /* ============================ recents/cards =========================== */

  const expandRecent = (key) => dispatch({ type: A.RECENTS_EXPAND, key });
  const setRecentsFilter = (filter) => dispatch({ type: A.RECENTS_SET_FILTER, filter });

  function recentAction(id, row) {
    const key = row.key;
    const number = row.entry.number;
    switch (id) {
      case 'history': return openHistory(key, number);
      case 'text': toast({ text: 'Opens your messaging app on device.', iconName: 'message' }); return;
      case 'whatsapp': toast({ text: 'Opens WhatsApp on device.', iconName: 'whatsapp' }); return;
      case 'remind': return openReminder(number, { first: row.view?.firstName });
      case 'save': return addContact(number);
      case 'profile': return openContact(key, number);
      default: return undefined;
    }
  }

  function historyAction(id, contactKey, number) {
    switch (id) {
      case 'rewind': return openRewind(contactKey, number);
      case 'text': toast({ text: 'Opens your messaging app on device.', iconName: 'message' }); return;
      case 'whatsapp': toast({ text: 'Opens WhatsApp on device.', iconName: 'whatsapp' }); return;
      case 'remind': return openReminder(number, { first: selContactsByKey(state()).get(contactKey)?.firstName });
      case 'copy-number': return copy(number);
      case 'clear-history': return confirmClearHistory(contactKey);
      default: return undefined;
    }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast({ text: 'Copied', iconName: 'copy' }); }
    catch { toast({ text: 'Could not copy — clipboard blocked.', tone: 'warn' }); }
  }

  function confirmClearHistory(contactKey) {
    pushOverlay('options', {
      title: 'Clear this history?',
      options: [
        { value: 'yes', label: 'Clear it', hint: 'Removes these calls from this phone. Cannot be undone.' },
        { value: 'no', label: 'Keep it' },
      ],
      onPick: async (v) => {
        if (v !== 'yes') return;
        await services.callLog.clearForContact(contactKey).catch(fail);
        await refreshCallLog();
        clearOverlays();
        toast({ text: 'History cleared', iconName: 'trash' });
      },
    });
  }

  /* ============================== contacts ============================== */

  async function saveContact(data, props) {
    try {
      if (props.contactKey) {
        const existing = selContactsByKey(state()).get(props.contactKey);
        await services.contacts.update(existing.id, data);
        toast({ text: 'Contact updated', iconName: 'check' });
      } else {
        await services.contacts.create({ ...data, displayName: [data.firstName, data.lastName].filter(Boolean).join(' ') });
        toast({ text: 'Contact saved', iconName: 'check' });
      }
      popOverlay();
      await refreshContacts();
    } catch (e) { fail(e, 'Contact could not be saved'); }
  }

  async function deleteContact(contactKey) {
    const view = selContactsByKey(state()).get(contactKey);
    if (!view?.id) return;
    pushOverlay('options', {
      title: `Delete ${view.displayName}?`,
      options: [
        { value: 'yes', label: 'Delete', hint: 'Removes them from this phone’s contacts.' },
        { value: 'no', label: 'Cancel' },
      ],
      onPick: async (v) => {
        if (v !== 'yes') return;
        await services.contacts.remove(view.id).catch(fail);
        clearOverlays();
        await refreshContacts();
        toast({ text: 'Contact deleted', iconName: 'trash' });
      },
    });
  }

  function mergeSuggestion(dupe) {
    pushOverlay('options', {
      title: 'Merge these contacts?',
      options: [
        { value: 'yes', label: `Merge into ${dupe.contacts[0].displayName}` },
        { value: 'no', label: 'Keep both' },
      ],
      onPick: async (v) => {
        if (v !== 'yes') return;
        await services.contacts.merge(dupe.contacts.map((c) => c.id)).catch(fail);
        await refreshContacts();
        toast({ text: 'Contacts merged', iconName: 'merge' });
      },
    });
  }

  async function contactAction(id, contactKey, arg, number) {
    const detail = selectContactDetail(state(), contactKey);
    const view = detail.view;
    const num = arg || view?.primaryNumber || number;

    switch (id) {
      case 'call': return call(num, contactKey);
      case 'call-number': return call(arg, contactKey);
      case 'copy-number': return copy(arg || num);
      case 'history': return openHistory(contactKey, num);
      case 'remind': return openReminder(num, { first: view?.firstName });
      case 'text': case 'whatsapp':
        toast({ text: id === 'text' ? 'Opens your messaging app on device.' : 'Opens WhatsApp on device.', iconName: id === 'text' ? 'message' : 'whatsapp' });
        return;
      case 'save': return addContact(num);
      case 'open-dialr-profile': return pushOverlay('dialr-profile', { contactKey, number: num });
      case 'edit-ringtone': return pushOverlay('ringtone-picker', { contactKey, name: view?.firstName });
      case 'edit-background': return pushOverlay('wallpaper-picker', { contactKey, name: view?.firstName });
      case 'edit-pronouns': return editPronouns(contactKey, view);
      case 'edit-label': return editPrivateText(contactKey, 'label', 'Label', view?.label);
      case 'edit-note': return editPrivateText(contactKey, 'note', 'Private note', view?.note);
      case 'edit-place': return editPrivateText(contactKey, 'placeLabel', 'Saved place', view?.savedPlace?.label);
      case 'edit-sim': return editPreferredSim(contactKey, view);
      case 'navigate': toast({ text: 'Opens your maps app on device.', iconName: 'mapPin' }); return;
      case 'block': return blockNumber(num);
      case 'unblock': return unblockNumber(num);
      case 'report': return reportSpam(num);
      case 'not-spam': return markNotSpam(num);
      case 'clear-history': return confirmClearHistory(contactKey);
      case 'delete': return deleteContact(contactKey);
      default: return undefined;
    }
  }

  function editPronouns(contactKey, view) {
    pushOverlay('options', {
      title: 'Refer to them as',
      value: view?.pronouns || 'they/them',
      options: [
        { value: 'they/them', label: 'they / them', hint: 'The default. DIALR never guesses.' },
        { value: 'she/her', label: 'she / her' },
        { value: 'he/him', label: 'he / him' },
      ],
      onPick: (v) => setPrivate(contactKey, { pronouns: v }),
    });
  }

  function editPreferredSim(contactKey, view) {
    pushOverlay('options', {
      title: 'Always call with',
      value: view?.preferredSim || 'ask',
      options: [
        { value: 'ask', label: 'Ask every time' },
        ...state().directory.sims.map((s) => ({ value: s.id, label: `${s.label} · SIM ${s.slot}` })),
      ],
      onPick: (v) => setPrivate(contactKey, { preferredSim: v === 'ask' ? null : v }),
    });
  }

  function editPrivateText(contactKey, field, title, current) {
    pushOverlay('options', {
      title,
      kind: 'text',
      value: current || '',
      options: field === 'label'
        ? ['Brother', 'Sister', 'Mother', 'Father', 'Partner', 'Work', 'Landlord', 'Doctor']
            .map((l) => ({ value: l, label: l }))
        : [],
      onPick: (v) => {
        if (field === 'placeLabel') setPrivate(contactKey, { savedPlace: { label: v, area: v, mapsUri: `geo:0,0?q=${encodeURIComponent(v)}` } });
        else setPrivate(contactKey, { [field]: v });
      },
    });
  }

  async function setPrivate(contactKey, patch) {
    dispatch({ type: A.DIR_PRIVATE_PATCH, contactKey, patch });
    popOverlay();
    try { await services.contacts.setPrivate(contactKey, patch); }
    catch (e) { fail(e, 'Could not save'); }
  }

  /* ============================= protection ============================= */

  async function blockNumber(number, opts = {}) {
    if (opts.declineFirst && state().call.sessions[0]) {
      await services.calls.reject(state().call.sessions[0].id, { reason: 'blocked' }).catch(() => {});
    }
    await services.spam.block(number).catch(fail);
    await refreshSpam([numberKey(number)]);
    toast({
      text: `${formatNumber(number)} blocked`, iconName: 'block',
      actionLabel: 'Undo', onAction: () => unblockNumber(number),
    });
  }

  async function unblockNumber(number) {
    await services.spam.unblock(number).catch(fail);
    await refreshSpam([numberKey(number)]);
    toast({ text: 'Unblocked', iconName: 'check' });
  }

  async function reportSpam(number, category = 'Unwanted') {
    await services.spam.report(number, category).catch(fail);
    await refreshSpam([numberKey(number)]);
    toast({ text: 'Reported. Thanks — it helps other people too.', iconName: 'shield' });
  }

  async function markNotSpam(number) {
    await services.spam.markNotSpam(number).catch(fail);
    await refreshSpam([numberKey(number)]);
    toast({ text: 'Marked as not spam', iconName: 'shieldOk' });
  }

  async function repeatCallerAction(id, props) {
    popOverlay();
    switch (id) {
      case 'silence': toast({ text: 'Silenced for an hour.', iconName: 'micOff' }); return;
      case 'block': return blockNumber(props.number);
      case 'report': await blockNumber(props.number); return reportSpam(props.number, 'Repeat caller');
      default: return undefined;
    }
  }

  /* ============================== profile =============================== */

  function profileAction(id, arg, props) {
    switch (id) {
      case 'edit': toast({ text: 'Profile editing is the next screen to build out.', iconName: 'edit' }); return;
      case 'edit-bio': toast({ text: 'Bio composition editor — see docs/SCREEN_SPECIFICATION.md.', iconName: 'edit' }); return;
      case 'edit-links': toast({ text: 'Pick any four links to show.', iconName: 'link' }); return;
      case 'share': toast({ text: 'Shares your DIALR profile link.', iconName: 'share' }); return;
      case 'copy-number': return copy(state().directory.me?.number || '');
      case 'open-link': toast({ text: `Opens ${arg}.`, iconName: 'external' }); return;
      case 'block': return blockNumber(props?.number || '');
      case 'squad': toast({ text: 'Squad request sent.', iconName: 'people' }); return;
      default: return undefined;
    }
  }

  function youShortcut(id) {
    switch (id) {
      case 'wallpaper': return pushOverlay('wallpaper-picker', {});
      case 'ringtone': return pushOverlay('ringtone-picker', {});
      case 'replies': return pushOverlay('settings', { section: 'replies' });
      case 'protection': return pushOverlay('settings', { section: 'protection' });
      case 'settings': return pushOverlay('settings', {});
      default: return undefined;
    }
  }

  /* ============================== settings ============================== */

  function setSetting(path, value) {
    dispatch({ type: A.SETTINGS_SET, path, value });
    persistSettings();
    theme.sync();                      // appearance/access settings feed theme
    if (path === 'sound.hapticsEnabled') haptics.setEnabled(value);
  }

  function settingsNav(target, field) {
    switch (target) {
      case 'wallpaper-picker': return pushOverlay('wallpaper-picker', {});
      case 'ringtone-picker': return pushOverlay('ringtone-picker', {});
      case 'demo': return pushOverlay('demo', {});
      case 'bridge-status': return pushOverlay('bridge-status', {});
      case 'permissions': return pushOverlay('options', {
        title: 'Permissions',
        options: Object.entries(state().app.permissions).map(([k, v]) => ({
          value: k, label: k.split('.').pop().replace(/_/g, ' ').toLowerCase(), hint: v,
        })),
        onPick: () => requestPermissions(),
      });
      default:
        toast({ text: `${field?.label || target} — specified in docs/SCREEN_SPECIFICATION.md.`, iconName: 'info' });
        return undefined;
    }
  }

  async function settingsAction(id) {
    switch (id) {
      case 'clear-history':
        return pushOverlay('options', {
          title: 'Clear all call history?',
          options: [{ value: 'yes', label: 'Clear everything', hint: 'Cannot be undone.' }, { value: 'no', label: 'Cancel' }],
          onPick: async (v) => {
            if (v !== 'yes') return;
            await services.callLog.clearAll().catch(fail);
            await refreshCallLog();
            toast({ text: 'Call history cleared', iconName: 'trash' });
          },
        });
      case 'reset-settings':
        dispatch({ type: A.SETTINGS_RESET });
        persistSettings(); theme.sync();
        toast({ text: 'Settings reset', iconName: 'refresh' });
        return undefined;
      case 'default-dialer': {
        const ok = await services.telephony.requestDefaultDialer().catch(() => false);
        dispatch({ type: A.APP_SET_DEFAULT_DIALER, isDefault: ok });
        toast({ text: ok ? 'DIALR is now your phone app' : 'Not changed', iconName: ok ? 'check' : 'info' });
        return undefined;
      }
      case 'export-data':
        toast({ text: 'Writes a JSON export to your downloads on device.', iconName: 'share' });
        return undefined;
      case 'wipe-local':
        return pushOverlay('options', {
          title: 'Erase DIALR data?',
          options: [
            { value: 'yes', label: 'Erase', hint: 'Settings, theme, notes and private labels. Contacts and call log stay.' },
            { value: 'no', label: 'Cancel' },
          ],
          onPick: async (v) => { if (v === 'yes') await demoWipe(); },
        });
      default:
        toast({ text: 'Not wired in this preview.', iconName: 'info' });
        return undefined;
    }
  }

  function chooseOption(field, value, set) {
    pushOverlay('options', {
      title: field.label,
      value,
      options: field.options,
      onPick: (v) => set(v),
    });
  }

  /* =============================== theme ================================ */

  function previewTheme(asset, palette) {
    theme.preview(palette, asset);
  }

  async function selectWallpaper(asset, palette) {
    dispatch({ type: A.THEME_SET_PALETTE, palette, wallpaperId: asset.id });
    dispatch({ type: A.THEME_SET, patch: { wallpaperId: asset.id } });
    theme.sync();
    persistTheme();
    if (asset.source === 'user' && !userWallpapers.some((w) => w.id === asset.id)) userWallpapers.push(asset);
    toast({ text: `${asset.name} applied`, iconName: 'palette' });
  }

  async function pickCustomWallpaper(kind) {
    try {
      const raw = await services.media.pick({ kind });
      if (!raw) return;
      const prepared = await services.media.prepare(raw, { maxBytes: 2_500_000, maxSeconds: 15 });
      const palette = await services.media.palette(prepared.url);
      userWallpapers.push({ ...prepared, palette: { dominant: palette.dominant?.hex || null, secondary: palette.secondary?.hex || null, meanL: palette.meanL, mode: palette.suggestedMode } });
      await selectWallpaper(prepared, palette);
    } catch (e) {
      if (e.code === 'CANCELLED') return;
      if (e.code === 'MEDIA_TOO_LARGE') return fail(e, 'That file is too large');
      if (e.code === 'MEDIA_TOO_LONG') return fail(e, 'Videos are capped at 15 seconds');
      fail(e, 'That media could not be used');
    }
  }

  const getUserWallpapers = () => userWallpapers;

  function selectRingtone(rt, contactKey) {
    if (contactKey) {
      setPrivate(contactKey, { ringtoneId: rt.id });
      return;
    }
    setSetting('sound.ringtone', rt.id);
  }
  const previewRingtone = (rt) => services.media.playPreview(rt.id).catch(() => {});
  const stopRingtonePreview = () => services.media.stopPreview().catch(() => {});

  /* ============================ permissions ============================= */

  async function requestPermissions() {
    const need = Object.keys(state().app.permissions);
    const list = need.length ? need : [
      'android.permission.READ_CONTACTS', 'android.permission.READ_CALL_LOG',
      'android.permission.CALL_PHONE', 'android.permission.POST_NOTIFICATIONS',
    ];
    const result = await services.permissions.request(list).catch(() => null);
    if (result) {
      dispatch({ type: A.APP_SET_PERMISSIONS, permissions: result });
      await refreshAll();
    }
  }
  const openAppSettings = () => services.permissions.openAppSettings();

  /* ============================== data load ============================= */

  async function refreshContacts() {
    dispatch({ type: A.DIR_CONTACTS_LOADING });
    try {
      const [contacts, priv] = await Promise.all([
        services.contacts.list(),
        services.contacts.privateData?.() ?? Promise.resolve([]),
      ]);
      dispatch({ type: A.DIR_CONTACTS_LOADED, contacts });
      dispatch({ type: A.DIR_PRIVATE_LOADED, privateData: Object.fromEntries(priv.map((p) => [p.contactKey, p])) });
      lookupProfiles(contacts);
    } catch (e) {
      dispatch({ type: A.DIR_CONTACTS_FAILED, error: { message: e.message, code: e.code } });
    }
  }

  async function refreshCallLog() {
    dispatch({ type: A.DIR_LOG_LOADING });
    try {
      const entries = await services.callLog.list({ limit: 500 });
      dispatch({ type: A.DIR_LOG_LOADED, entries });
      const keys = [...new Set(entries.map((e) => e.contactKey))];
      refreshSpam(keys);
      lookupProfilesByKeys(keys);
    } catch (e) {
      dispatch({ type: A.DIR_LOG_FAILED, error: { message: e.message, code: e.code } });
    }
  }

  async function refreshSpam(keys) {
    if (!keys?.length) return;
    if (!state().settings.protection.enabled) return;
    try {
      const spam = await services.spam.lookup(keys);
      dispatch({ type: A.DIR_SPAM_LOADED, spam });
    } catch { /* protection degrades silently — calls still work */ }
  }

  async function lookupProfiles(contacts) {
    const keys = contacts.map((c) => numberKey((c.numbers.find((n) => n.primary) || c.numbers[0] || {}).value)).filter(Boolean);
    return lookupProfilesByKeys(keys);
  }

  async function lookupProfilesByKeys(keys) {
    const s = state();
    if (!s.settings.identity.dialrEnabled || !s.settings.identity.lookupUnknown) return;
    if (!s.app.online) { dispatch({ type: A.DIR_PROFILES_FAILED, error: { code: 'OFFLINE' } }); return; }
    try {
      const profiles = await services.profile.lookup([...new Set(keys)]);
      dispatch({ type: A.DIR_PROFILES_LOADED, profiles });
    } catch (e) {
      dispatch({ type: A.DIR_PROFILES_FAILED, error: { message: e.message, code: e.code } });
    }
  }

  async function refreshAll() {
    await Promise.all([refreshContacts(), refreshCallLog()]);
    const [sims, me, reminders] = await Promise.all([
      services.sim.list().catch(() => []),
      services.profile.me().catch(() => null),
      services.reminders.list().catch(() => []),
    ]);
    dispatch({ type: A.DIR_SIMS_LOADED, sims });
    if (me) dispatch({ type: A.DIR_ME_LOADED, me });
    dispatch({ type: A.REMINDERS_LOADED, reminders });
  }

  /* ============================ onboarding ============================== */

  async function finishOnboarding({ firstName, surname, wallpaperId }) {
    const me = { ...(state().directory.me || {}), firstName, surname };
    dispatch({ type: A.DIR_ME_LOADED, me });
    const asset = findMedia(wallpaperId) || WALLPAPERS[1];
    dispatch({ type: A.THEME_SET_PALETTE, palette: paletteFromMeta(asset.palette), wallpaperId: asset.id });
    theme.sync();
    await services.storage.set(ONBOARD_KEY, { firstName, surname, at: Date.now() }).catch(() => {});
    persistTheme();
    dispatch({ type: A.APP_COMPLETE_ONBOARDING });
    toast({ text: `Ready when you are, ${firstName}.`, iconName: 'check' });
  }

  /* ============================ demo harness ============================ */

  function demoIncoming(number) {
    clearOverlays();
    services.__mock?.calls.__simulateIncoming(number);
  }

  async function demoSecondCall() {
    clearOverlays();
    const s = state();
    if (!s.call.sessions.length) {
      await services.calls.place(s.directory.contacts[0].numbers[0].value, {});
      setTimeout(() => services.__mock?.calls.__simulateIncoming('+919845227781'), 3200);
    } else {
      services.__mock?.calls.__simulateIncoming('+919845227781');
    }
  }

  function demoRepeatBurst(number) {
    clearOverlays();
    const entries = state().directory.callLog.filter((e) => e.contactKey === numberKey(number));
    const burst = repeatedCallBurst(entries, {
      count: state().settings.protection.repeatCount,
      windowMin: 60,
      staleMin: 24 * 60,
    }) || { count: 5, windowMin: 15, spanMin: 12, firstAt: Date.now(), lastAt: Date.now() };
    pushOverlay('repeat-caller', { number, burst });
  }

  function demoReminderDue() {
    const r = state().reminders[0];
    if (!r) { toast({ text: 'No reminders set. Create one from a recent card.', iconName: 'bell' }); return; }
    bus.emit('reminder.due', r);
  }

  function demoToggleOffline() {
    const next = !state().app.online;
    dispatch({ type: A.APP_SET_ONLINE, online: next });
    toast({ text: next ? 'Back online' : 'Simulating offline', iconName: 'globe' });
    if (next) refreshAll();
  }

  function demoRevokePermissions() {
    services.__mock?.permissions.__denyAll();
    clearOverlays();
  }

  async function demoReplayOnboarding() {
    await services.storage.remove(ONBOARD_KEY).catch(() => {});
    clearOverlays();
    dispatch({ type: A.APP_SET_ONBOARDING, step: 0, data: {} });
  }

  async function demoWipe() {
    for (const k of await services.storage.keys()) await services.storage.remove(k);
    dispatch({ type: A.SETTINGS_RESET });
    theme.sync();
    clearOverlays();
    toast({ text: 'Local DIALR data erased', iconName: 'trash' });
  }

  /* ============================== dock ================================== */

  function handleDockIntent(intent) {
    if (!intent) return;
    switch (intent.type) {
      case 'call': return call(intent.number, intent.contactKey);
      case 'message': toast({ text: 'Opens your messaging app on device.', iconName: 'message' }); return;
      case 'add-contact': return addContact(intent.number, intent.suggestName ? { firstName: nameParts(intent.suggestName).first, lastName: nameParts(intent.suggestName).surname } : null);
      case 'open-history': return openHistory(intent.contactKey);
      case 'filter-recents': setTab('recents'); return setRecentsFilter(intent.filter);
      case 'close-overlay': return popOverlay();
      default: return undefined;
    }
  }

  return {
    // navigation
    setTab, pushOverlay, popOverlay, clearOverlays,
    // dialer
    dialerAppend, dialerBackspace, dialerClear, dialerSet, dialerLongPress,
    // calling
    call, answer, hangup, decline, toggleMute, toggleHold, cycleAudio, sendDtmf,
    swapCalls, mergeCalls, toggleKeypad, setNoteDraft, addCallFlow, clearPostCall, pickSim,
    // flows
    openContact, openHistory, openRewind, addContact, openQuickReply, openReminder,
    sendQuickReply, customReply, createReminder, recentAction, historyAction,
    contactAction, saveContact, deleteContact, mergeSuggestion, expandRecent, setRecentsFilter,
    profileAction, youShortcut, copy,
    // protection
    blockNumber, unblockNumber, reportSpam, markNotSpam, repeatCallerAction,
    // settings & theme
    setSetting, settingsNav, settingsAction, chooseOption,
    previewTheme, selectWallpaper, pickCustomWallpaper, getUserWallpapers,
    selectRingtone, previewRingtone, stopRingtonePreview,
    // system
    requestPermissions, openAppSettings, refreshAll, refreshContacts, refreshCallLog, refreshSpam,
    finishOnboarding,
    // demo
    demoIncoming, demoSecondCall, demoRepeatBurst, demoReminderDue,
    demoToggleOffline, demoRevokePermissions, demoReplayOnboarding, demoWipe,
    // misc
    toast, handleDockIntent, persistSettings,
  };
}
