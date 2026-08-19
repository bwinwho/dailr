/**
 * DIALR — ActiveCallScreen.
 *
 * Every telecom control the platform can offer, arranged so the two things you
 * reach for mid-call (mute, speaker) are the easiest to hit and END CALL is
 * unmistakable and alone.
 *
 * The DIALR addition is Notes: a 50-character scratchpad that attaches to this
 * call and later appears beside it in History. The limit is a design constraint,
 * not a technical one — it keeps history readable and keeps the feature honest
 * about what it is for.
 */
import { h, setText, toggle, on } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { clockDuration, formatNumber, NOTE_MAX, clampNote } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import { CallActionButton, IconButton } from '../primitives/Button.js';
import { DialPad } from '../dialer/DialPad.js';
import haptics from '../../core/haptics.js';

export function ActiveCallScreen({ model, settings, actions }) {
  let props = { model, settings };
  let timerId = null;

  const eyebrow = h('div.actcall__eyebrow.t-eyebrow');
  const name = h('h1.actcall__name.t-display-m');
  const status = h('div.actcall__status.t-label.c-2');
  const timer = h('div.actcall__timer.t-num');
  const avatar = Avatar({ size: 'lg', name: '', src: null });

  /* ---- second call strip ---- */
  const secondName = h('span.actcall__second-name.t-label');
  const secondState = h('span.actcall__second-state.t-micro.c-3');
  const swapBtn = h('button.actcall__second-btn.t-micro', { type: 'button', text: 'Swap',
    on: { click: () => actions.swap?.() } });
  const mergeBtn = h('button.actcall__second-btn.t-micro', { type: 'button', text: 'Merge',
    on: { click: () => actions.merge?.() } });
  const secondStrip = h('div.actcall__second', null,
    h('span.actcall__second-dot'), secondName, secondState,
    h('div.row.g-2', null, swapBtn, mergeBtn));

  /* ---- control grid ---- */
  const mute     = IconButton({ icon: 'micOff',    label: 'Mute',    variant: 'call', onClick: () => actions.toggleMute?.() });
  const keypad   = IconButton({ icon: 'keypad',    label: 'Keypad',  variant: 'call', onClick: () => actions.toggleKeypad?.() });
  const speaker  = IconButton({ icon: 'speaker',   label: 'Speaker', variant: 'call', onClick: () => actions.cycleAudio?.() });
  const addCall  = IconButton({ icon: 'addCall',   label: 'Add call',variant: 'call', onClick: () => actions.addCall?.() });
  const hold     = IconButton({ icon: 'pause',     label: 'Hold',    variant: 'call', onClick: () => actions.toggleHold?.() });
  const note     = IconButton({ icon: 'note',      label: 'Note',    variant: 'call', onClick: () => actions.toggleNote?.() });

  const grid = h('div.actcall__grid', null,
    mute.el, keypad.el, speaker.el, addCall.el, hold.el, note.el);

  /* ---- note editor ---- */
  const noteInput = h('input.actcall__note-input', {
    type: 'text', maxlength: String(NOTE_MAX), placeholder: 'Send quotation tomorrow',
    aria: { label: `Call note, ${NOTE_MAX} characters maximum` },
  });
  const noteCount = h('span.actcall__note-count.t-micro');
  const noteBox = h('div.actcall__note', { aria: { hidden: 'true' } },
    h('div.row.between.g-4', null,
      h('span.t-micro.c-3', { text: 'Note for this call' }), noteCount),
    noteInput);

  const offNote = on(noteInput, 'input', () => {
    const v = clampNote(noteInput.value);
    if (noteInput.value !== v) noteInput.value = v;
    setText(noteCount, `${v.length}/${NOTE_MAX}`);
    toggle(noteCount, 'is-full', v.length >= NOTE_MAX);
    actions.setNote?.(v);
  });

  /* ---- in-call keypad ---- */
  const dtmfReadout = h('div.actcall__dtmf.t-num');
  const pad = DialPad({
    onDigit: (d) => { actions.sendDtmf?.(d); dtmfReadout.textContent += d; },
    tones: true, hapticsOn: true,
  });
  const keypadBox = h('div.actcall__keypad', { aria: { hidden: 'true' } },
    dtmfReadout, pad.el,
    h('button.actcall__keypad-hide.t-label', { type: 'button', text: 'Hide',
      on: { click: () => actions.toggleKeypad?.(false) } }));

  const audioLabel = h('span.actcall__audio.t-micro.c-3');

  const end = CallActionButton({ kind: 'decline', label: 'End call', onClick: () => actions.hangup?.() });

  const bgImage = h('div.actcall__bg-image');

  const el = h('div.actcall', { role: 'dialog', 'aria-modal': 'true', aria: { label: 'Call in progress' } },
    h('div.actcall__bg', null, bgImage),
    h('header.actcall__head', null,
      avatar.el,
      eyebrow, name, status, timer, audioLabel),
    secondStrip,
    h('div.actcall__body', null, noteBox, keypadBox, grid),
    h('div.actcall__end', null, end.el));

  /* ---- live timer -------------------------------------------------------
     Driven from connectedAt rather than an incrementing counter, so it stays
     correct if the WebView is backgrounded and throttled. */
  function tick() {
    const s = props.model?.session;
    if (s?.connectedAt) setText(timer, clockDuration((Date.now() - s.connectedAt) / 1000));
    else setText(timer, '');
  }
  timerId = setInterval(tick, 500);

  function update(next = {}) {
    props = { ...props, ...next };
    const m = props.model;
    if (!m) return;
    const id = m.identity;
    const s = m.session;

    setText(eyebrow, id.eyebrow || '');
    toggle(eyebrow, 'is-hidden', !id.eyebrow);
    setText(name, id.first || id.name);
    avatar.update({ name: id.name, src: id.hasPhoto ? id.avatar : null, ring: id.tier === 'dialr' });

    const stateLabel = m.conference ? 'Conference'
      : s.state === 'dialing' ? 'Calling…'
      : s.state === 'connecting' ? 'Connecting…'
      : s.state === 'held' ? 'On hold'
      : s.state === 'active' ? (id.tier === 'unknown' ? formatNumber(s.number) : (id.sub || formatNumber(s.number)))
      : s.state;
    setText(status, stateLabel);
    tick();

    mute.update({ pressed: m.muted, label: m.muted ? 'Unmute' : 'Mute', icon: m.muted ? 'mic' : 'micOff' });
    speaker.update({
      pressed: m.audioRoute !== 'earpiece',
      label: m.audioRoute === 'speaker' ? 'Speaker' : m.audioRoute === 'bluetooth' ? 'Bluetooth' : 'Speaker',
      icon: m.audioRoute === 'bluetooth' ? 'bluetooth' : m.audioRoute === 'speaker' ? 'speaker' : 'earpiece',
    });
    hold.update({ pressed: s.state === 'held', label: s.state === 'held' ? 'Resume' : 'Hold', icon: s.state === 'held' ? 'play' : 'pause' });
    keypad.update({ pressed: m.keypadOpen });
    note.update({ pressed: !!m.noteDraft });
    addCall.update({ disabled: m.sessions.length > 1 });

    setText(audioLabel, m.audioRoute === 'earpiece' ? '' : `Audio: ${m.audioRoute}`);
    toggle(audioLabel, 'is-hidden', m.audioRoute === 'earpiece');

    /* second call */
    const second = m.sessions[1];
    toggle(secondStrip, 'is-on', !!second && !m.conference);
    if (second) {
      setText(secondName, second.number);
      setText(secondState, second.state === 'ringing' ? 'is calling' : 'on hold');
    }
    toggle(mergeBtn, 'is-hidden', !second || second.state === 'ringing');

    /* panels */
    toggle(keypadBox, 'is-on', m.keypadOpen);
    keypadBox.setAttribute('aria-hidden', String(!m.keypadOpen));
    if (!m.keypadOpen) dtmfReadout.textContent = '';

    const noteOpen = props.noteOpen ?? false;
    toggle(noteBox, 'is-on', noteOpen);
    noteBox.setAttribute('aria-hidden', String(!noteOpen));
    if (noteOpen && document.activeElement !== noteInput) {
      noteInput.value = m.noteDraft || '';
      setText(noteCount, `${(m.noteDraft || '').length}/${NOTE_MAX}`);
      setTimeout(() => noteInput.focus(), 60);
    }
    toggle(note.el, 'is-hidden', !props.settings.calling.notesEnabled);

    // Same background as the incoming screen, far more veiled — continuity
    // without competing with the controls.
    const bgValue = m.background?.url ? `url("${m.background.url}")` : '';
    if (bgImage.style.backgroundImage !== bgValue) bgImage.style.backgroundImage = bgValue;

    toggle(el, 'actcall--large-actions', props.settings.access.largeCallButtons);
    toggle(el, 'actcall--labels', props.settings.access.alwaysShowLabels);
  }

  update({});

  return {
    el, update,
    destroy() { clearInterval(timerId); offNote(); pad.destroy(); avatar.destroy(); },
  };
}
