/**
 * DIALR — IncomingCallScreen.
 *
 * The most consequential screen in the product, and therefore the most
 * restrained. Its only job is to answer one question:
 *
 *      Do I pick this up?
 *
 * WHAT IS DELIBERATELY ABSENT: squad members, profile views, pickup rate, bio,
 * links, social anything. The brief forbids it and it is right to — those are
 * identity-performance metrics and they have no business being in front of
 * someone deciding whether to take a call.
 *
 * WHAT IS PRESENT, and why each earns its place:
 *   - the name, resolved by the identity hierarchy (saved > DIALR > number)
 *   - the photo, ONLY if a real one exists — never a generated stand-in
 *   - at most three context chips: first-time caller, calls today, spam verdict
 *   - your own last note about them, if you wrote one. One line. Private.
 *   - answer / decline / quick reply / remind me
 */
import { h, setText, toggle, on } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { formatNumber, maskNumber, clockDuration } from '../../core/format.js';
import { CallActionButton } from '../primitives/Button.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

export function IncomingCallScreen({ model, settings, onAnswer, onDecline, onQuickReply, onRemind, onSave, onBlock }) {
  let props = { model, settings };

  /* ---- background: the customization system's most visible output ------- */
  const bgImage = h('div.incall__bg-image');
  const bgVeil = h('div.incall__bg-veil');
  const bg = h('div.incall__bg', null, bgImage, bgVeil);

  /* ---- identity ---- */
  const eyebrow = h('div.incall__eyebrow.t-eyebrow');
  const name = h('h1.incall__name.t-display-l');
  const number = h('div.incall__number.t-display-s.t-num');
  const sub = h('div.incall__sub.t-label.c-2');
  const avatar = Avatar({ size: 'xl', name: '', src: null });
  const avatarWrap = h('div.incall__avatar', null, avatar.el);

  const chips = h('div.incall__chips');
  const noteLine = h('div.incall__note.t-body-sm');

  const saveBtn = h('button.incall__save', {
    type: 'button',
    on: { click: () => onSave?.() },
  }, h('span.incall__save-icon', { html: icon('plus') }),
     h('span.t-micro', { text: 'Save this number' }));

  const simTag = h('div.incall__sim.t-micro');

  /* ---- actions ---- */
  const answer = CallActionButton({ kind: 'answer', label: 'Answer', onClick: () => onAnswer?.() });
  const decline = CallActionButton({ kind: 'decline', label: 'Decline', onClick: () => onDecline?.() });

  const replyBtn = h('button.incall__minor', { type: 'button',
    on: { click: () => onQuickReply?.() } },
    h('span', { html: icon('message') }), h('span.t-micro', { text: 'Reply' }));

  const remindBtn = h('button.incall__minor', { type: 'button',
    on: { click: () => onRemind?.() } },
    h('span', { html: icon('bell') }), h('span.t-micro', { text: 'Remind me' }));

  const blockBtn = h('button.incall__minor.incall__minor--danger', { type: 'button',
    on: { click: () => onBlock?.() } },
    h('span', { html: icon('block') }), h('span.t-micro', { text: 'Block' }));

  const ringLabel = h('div.incall__state.t-micro');

  const el = h('div.incall', { role: 'dialog', 'aria-modal': 'true', aria: { label: 'Incoming call' } },
    bg,
    h('div.incall__top', null, ringLabel, simTag),
    h('div.incall__id', null,
      avatarWrap,
      eyebrow, name, number, sub,
      chips, noteLine, saveBtn),
    h('div.incall__actions', null,
      h('div.incall__minors', null, replyBtn, remindBtn, blockBtn),
      h('div.incall__major', null, decline.el, answer.el)));

  /* ---- swipe-to-answer, when the user prefers it ------------------------ */
  let sy = 0, dragging = false, dy = 0;
  const cleanups = [];
  cleanups.push(on(answer.el, 'pointerdown', (e) => {
    if (props.settings.calling.answerStyle !== 'swipe') return;
    dragging = true; sy = e.clientY; answer.el.setPointerCapture?.(e.pointerId);
  }));
  cleanups.push(on(answer.el, 'pointermove', (e) => {
    if (!dragging) return;
    dy = Math.min(0, e.clientY - sy);
    answer.el.style.transform = `translate3d(0, ${dy}px, 0)`;
  }));
  const release = () => {
    if (!dragging) return;
    dragging = false;
    answer.el.style.transform = '';
    if (dy < -70) onAnswer?.();
    dy = 0;
  };
  cleanups.push(on(answer.el, 'pointerup', release));
  cleanups.push(on(answer.el, 'pointercancel', release));

  function renderChips(m, s) {
    chips.textContent = '';
    const add = (label, tone, iconName) => chips.appendChild(
      h(`span.chip.chip--${tone}`, null,
        iconName ? h('span.chip__icon', { html: icon(iconName) }) : null,
        h('span.chip__label', { text: label })));

    if (m.spam && m.spam.score >= 0.5 && !m.spam.trusted) {
      add(m.spam.category ? `Suspected ${m.spam.category.toLowerCase()}` : 'Suspected spam', 'negative', 'shield');
    } else if (m.identity.view?.trusted) {
      add('Trusted', 'positive', 'shieldOk');
    }
    if (m.firstTime) add('First time calling', 'neutral', 'spark');
    if (m.todayCount >= 2) add(`${m.todayCount + 1} calls today`, 'warn', 'return');
    if (m.origin && m.identity.tier === 'unknown') add(m.origin, 'neutral', 'mapPin');
    if (m.identity.view?.label) add(m.identity.view.label, 'accent');

    toggle(chips, 'is-hidden', !chips.childElementCount);
  }

  function update(next = {}) {
    props = { ...props, ...next };
    const m = props.model;
    const s = props.settings;
    if (!m) return;

    const id = m.identity;

    setText(eyebrow, id.eyebrow || '');
    toggle(eyebrow, 'is-hidden', !id.eyebrow);

    setText(name, id.tier === 'unknown' ? '' : (id.first || id.name));
    toggle(name, 'is-hidden', id.tier === 'unknown');

    // Unknown callers lead with the number; known callers show it quietly, or
    // not at all when the user has switched that off.
    if (id.tier === 'unknown') {
      setText(number, formatNumber(m.session.number));
      toggle(number, 'is-hidden', false);
      number.classList.add('incall__number--lead');
    } else {
      setText(number, s.calling.showCallerNumber ? formatNumber(m.session.number) : maskNumber(m.session.number, 4));
      toggle(number, 'is-hidden', false);
      number.classList.remove('incall__number--lead');
    }

    setText(sub, id.tier === 'dialr' ? 'On DIALR · not in your contacts'
      : id.tier === 'unknown' ? 'Not in your contacts'
      : (id.sub || ''));
    toggle(sub, 'is-hidden', !sub.textContent);

    // The photo rule, enforced in one place.
    avatar.update({ name: id.name, src: id.hasPhoto ? id.avatar : null, ring: id.tier === 'dialr' });
    toggle(avatarWrap, 'is-hidden', !id.hasPhoto && id.tier === 'unknown');

    renderChips(m, s);

    setText(noteLine, m.lastNote ? `Last time: ${m.lastNote}` : '');
    toggle(noteLine, 'is-hidden', !m.lastNote);

    toggle(saveBtn, 'is-hidden', id.tier === 'saved');

    setText(simTag, m.sim ? `${m.sim.label} · SIM ${m.sim.slot}` : '');
    toggle(simTag, 'is-hidden', !m.sim);

    setText(ringLabel, m.sessions.length > 1 ? 'Call waiting' : 'Incoming call');

    // Background priority is resolved by the selector; this only paints it.
    const b = m.background;
    if (b?.url) {
      const next = `url("${b.url}")`;
      if (bgImage.style.backgroundImage !== next) bgImage.style.backgroundImage = next;
      el.dataset.bg = b.scope;
    } else {
      bgImage.style.backgroundImage = '';
      el.dataset.bg = 'none';
    }

    toggle(el, 'incall--large-actions', s.access.largeCallButtons);
    toggle(el, 'incall--swipe', s.calling.answerStyle === 'swipe');
  }

  update({});
  haptics.fire('incoming');

  return { el, update, destroy() { for (const c of cleanups) c(); avatar.destroy(); } };
}
