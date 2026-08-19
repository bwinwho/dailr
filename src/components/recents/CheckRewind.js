/**
 * DIALR — Check Rewind.
 *
 * A retrospective on one relationship. The design brief that matters:
 *
 *   "It should feel like a personal relationship recap, not a corporate
 *    analytics dashboard."
 *
 * So the rules here are editorial, not analytical:
 *   - every panel is ONE number and ONE sentence
 *   - the number is set at display scale; the label is small and quiet
 *   - panels advance like a story (tap, or swipe) instead of scrolling as a grid
 *   - nothing is ranked, scored or compared against other people
 *
 * Exactly which statistics appear is still an open product decision
 * (docs/OPEN_DECISIONS.md #3) — the set below is a defensible first pass and
 * the component takes them as data, so changing it is a one-line edit.
 */
import { h, setText, on, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { spokenDuration, relativeTime, plural } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

export function CheckRewind({ rewind, view, onClose, onCall }) {
  const panels = buildPanels(rewind, view);
  let index = 0;

  const progress = h('div.rewind__progress');
  const bars = panels.map(() => {
    const b = h('span.rewind__bar', null, h('i'));
    progress.appendChild(b);
    return b;
  });

  const kicker = h('div.rewind__kicker.t-micro');
  const value = h('div.rewind__value');
  const label = h('div.rewind__label.t-label');
  const sub = h('div.rewind__sub.t-body-sm.c-2');
  const glyph = h('div.rewind__glyph');

  const stage = h('div.rewind__stage', null, glyph, kicker, value, label, sub);

  const avatar = Avatar({ size: 'sm', name: view?.displayName || '', src: view?.avatar || null, ring: true });

  const closeBtn = h('button.rewind__close', {
    type: 'button', aria: { label: 'Close Rewind' }, html: icon('close'),
    on: { click: () => onClose?.() },
  });

  const callBtn = h('button.rewind__call.t-label', {
    type: 'button', text: `Call ${view?.firstName || 'them'}`,
    on: { click: () => onCall?.() },
  });

  const el = h('div.rewind', { role: 'dialog', 'aria-modal': 'true', aria: { label: 'Check Rewind' } },
    h('div.rewind__head', null, progress,
      h('div.rewind__who', null, avatar.el,
        h('div.col', null,
          h('span.t-micro.c-3', { text: 'Rewind' }),
          h('span.t-label', { text: view?.displayName || 'This number' })),
        closeBtn)),
    stage,
    h('div.rewind__foot', null,
      h('span.rewind__span.t-caption', { text: spanLine(rewind) }),
      callBtn));

  function render(i) {
    const p = panels[i];
    if (!p) return;
    stage.classList.remove('is-in');
    // Force the animation to restart on every advance.
    void stage.offsetWidth;
    stage.classList.add('is-in');

    glyph.innerHTML = icon(p.icon);
    setText(kicker, p.kicker);
    setText(value, p.value);
    setText(label, p.label);
    setText(sub, p.sub || '');
    toggle(sub, 'is-hidden', !p.sub);
    value.dataset.len = p.value.length > 17 ? 'long' : p.value.length > 9 ? 'mid' : 'short';

    bars.forEach((b, bi) => {
      b.dataset.state = bi < i ? 'done' : bi === i ? 'active' : 'todo';
    });
  }

  function advance(step = 1) {
    const next = index + step;
    if (next < 0) return;
    if (next >= panels.length) { onClose?.(); return; }
    index = next;
    haptics.fire('tap');
    render(index);
  }

  const offTap = on(stage, 'click', (e) => {
    const rect = stage.getBoundingClientRect();
    advance(e.clientX - rect.left < rect.width * 0.32 ? -1 : 1);
  });
  const offKey = on(document, 'keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
    if (e.key === 'Escape') onClose?.();
  });

  render(0);

  return { el, update() {}, destroy() { offTap(); offKey(); avatar.destroy(); } };
}

function spanLine(r) {
  if (!r) return '';
  const months = Math.max(1, Math.round(r.spanDays / 30));
  return r.spanDays < 45
    ? `${r.spanDays} days of calls`
    : `${months} ${plural(months, 'month', 'months')} of calls`;
}

/** Turns the Rewind model into a sequence of one-idea panels. */
function buildPanels(r, view) {
  if (!r) return [];
  const name = view?.firstName || 'them';
  const panels = [
    {
      icon: 'clock', kicker: 'Time on the phone',
      value: spokenDuration(r.totalSeconds),
      label: 'together',
      sub: `across ${r.totalCalls} ${plural(r.totalCalls, 'call', 'calls')}`,
    },
    {
      icon: 'return', kicker: 'Who reaches out',
      value: r.theyStartedShare > 0.6 ? name : r.theyStartedShare < 0.4 ? 'You do' : 'Both of you',
      label: r.theyStartedShare > 0.6 ? 'calls first, mostly' : r.theyStartedShare < 0.4 ? 'call first, mostly' : 'about evenly',
      sub: `${r.sessions} ${plural(r.sessions, 'conversation', 'conversations')}`,
    },
    {
      icon: 'spark', kicker: 'Your hour',
      value: r.headlines.find((x) => x.key === 'when')?.value || '',
      label: 'is when you talk',
      sub: r.headlines.find((x) => x.key === 'when')?.sub || '',
    },
    {
      icon: 'wave', kicker: 'The long one',
      value: r.longestCall ? spokenDuration(r.longestCall.seconds) : '—',
      label: 'longest call',
      sub: r.longestCall ? relativeTime(r.longestCall.at) : 'no answered calls yet',
    },
    {
      icon: 'phone', kicker: 'Typical',
      value: spokenDuration(r.averageSeconds),
      label: 'per call',
      sub: `${r.answeredCalls} answered · ${r.missedCalls} missed`,
    },
  ];

  if (r.notesCount > 0) {
    panels.push({
      icon: 'note', kicker: 'You wrote things down',
      value: String(r.notesCount),
      label: plural(r.notesCount, 'note from a call', 'notes from calls'),
      sub: 'Only you can see them.',
    });
  }

  panels.push({
    icon: r.trend === 'up' ? 'chevronU' : r.trend === 'down' ? 'chevronD' : 'wave',
    kicker: 'Lately',
    value: r.trend === 'up' ? 'More' : r.trend === 'down' ? 'Less' : r.trend === 'new' ? 'New' : 'Steady',
    label: r.trend === 'new' ? 'you just started talking'
      : r.trend === 'flat' ? 'about the same as before'
      : `than the month before`,
    sub: null,
  });

  return panels;
}
