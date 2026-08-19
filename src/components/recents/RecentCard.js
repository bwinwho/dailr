/**
 * DIALR — RecentCard.
 *
 * The product's signature object. A minimal floating card that EXPANDS in
 * place into an action layer rather than navigating away.
 *
 * ---------------------------------------------------------------------------
 * REBUILT — see docs/UI_REVISION_PLAN.md § D1.
 *
 * The original version read:
 *
 *      CHHETRI                 ← surname
 *      AVNI      10 minutes ago← given name, large; time as a sibling
 *      She called you.         ← the event, as a sentence
 *      [ 6M ]                  ← duration chip
 *      │ Red skirt — Amazon    ← note
 *
 * five rows, most of a 360px screen eaten by three cards. Measured: 126–195px
 * per card, 8px gaps, "Mr. Prasad" and phone numbers clipped mid-word. Every
 * fix to one row broke the next, because the shape itself was wrong for
 * anything but the shortest names.
 *
 * This version is two rows, three at most:
 *
 *      ◉  AVNI                              10m   ☏
 *         She called you · 6m
 *         │ Red skirt — Amazon
 *
 * The surname is gone from the card — it survives on History, the contact
 * sheet and the call screens, where there is room for it. Duration and status
 * fold into one dim meta line instead of a chip each. Exactly one chip
 * survives: suspected spam, because it needs a shield and real prominence.
 * "Trusted" and duration chips are gone; they were never load-bearing here.
 *
 * The name is sized by measurement (core/dom.js › fitText), not by picking
 * between three hard buckets tuned for "AVNI" and going ragged on anyone
 * whose name doesn't happen to fit one of them.
 * ---------------------------------------------------------------------------
 */
import { h, setText, toggle, on, afterTransition, fitText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { relativeTime, callSentence, spokenDuration, isMissed } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

const NAME_MAX = 26;
const NAME_MIN = 16;
// Numeric glyphs run wider per character than the condensed display face, so
// an unsaved number needs a shorter range to fit the same column.
const NUMBER_MAX = 19;
const NUMBER_MIN = 14;

export function RecentCard({ row, expanded, settings, onCall, onExpand, onAction, onSwipe }) {
  let props = { row, expanded, settings };

  /* ---- head: avatar | name + time | call, with meta/note below ---------- */
  const first = h('h3.rcard__name');
  const when = h('span.rcard__when.t-body-sm.c-3');
  const meta = h('p.rcard__meta.t-body-sm');
  const chipSlot = h('div.rcard__chip');
  const noteLine = h('div.rcard__note.t-body-sm');

  // 'sm' (38px), matching every other dense list row in the app (Contacts'
  // .crow uses the same size). 'md' (54px) sets a hard floor on every row's
  // height regardless of how little text is in it — on a 3-line card with a
  // note that alone was ~20px of the difference between the measured height
  // and the plan's target.
  const avatar = Avatar({ size: 'sm', name: '', src: null });

  const callBtn = h('button.rcard__call', {
    type: 'button', aria: { label: 'Call' },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); onCall?.(props.row); } },
  }, h('span', { html: icon('phone') }));

  const head = h('div.rcard__head', null,
    avatar.el,
    first,
    when,
    callBtn,
    meta,
    chipSlot,
    noteLine);

  /* ---- expansion layer --------------------------------------------------
     Rendered once and revealed by height, so expanding does not re-create
     nodes mid-animation. Actions are full 44px rows now, not text links. */
  const actionList = h('div.rcard__actions');
  const quickIcons = h('div.rcard__quick');
  const expansion = h('div.rcard__expansion', { aria: { hidden: 'true' } },
    h('div.rule.rcard__rule'),
    h('div.rcard__expansion-inner', null, actionList, quickIcons));

  const el = h('article.rcard', {
    dataset: { tier: row.tier },
    on: {
      click: (e) => {
        if (e.target.closest('button')) return;
        haptics.fire('expand');
        onExpand?.(props.row);
      },
      keydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand?.(props.row); }
      },
    },
    tabindex: '0', role: 'button',
  }, head, expansion);

  /* ---- swipe: right calls, left messages -------------------------------- */
  let sx = 0, sy = 0, dx = 0, swiping = false, locked = null;
  const cleanups = [];

  cleanups.push(on(el, 'pointerdown', (e) => {
    if (!props.settings.smart.swipeActions || e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY; dx = 0; swiping = true; locked = null;
    el.style.transition = 'none';
  }));
  cleanups.push(on(el, 'pointermove', (e) => {
    if (!swiping) return;
    const mx = e.clientX - sx, my = e.clientY - sy;
    if (!locked) {
      if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) { swiping = false; el.style.transition = ''; return; }
      if (Math.abs(mx) > 12) locked = 'x';
      else return;
    }
    dx = Math.max(-140, Math.min(140, mx));
    el.style.transform = `translate3d(${dx}px,0,0)`;
    toggle(el, 'is-swipe-call', dx > 60);
    toggle(el, 'is-swipe-msg', dx < -60);
  }));
  const endSwipe = () => {
    if (!swiping) return;
    swiping = false;
    el.style.transition = '';
    el.style.transform = '';
    el.classList.remove('is-swipe-call', 'is-swipe-msg');
    if (dx > 90) { haptics.fire('success'); onSwipe?.('call', props.row); }
    else if (dx < -90) { haptics.fire('tap'); onSwipe?.('message', props.row); }
    dx = 0;
  };
  cleanups.push(on(el, 'pointerup', endSwipe));
  cleanups.push(on(el, 'pointercancel', endSwipe));

  /* ---- render ----------------------------------------------------------- */

  function renderActions(row) {
    actionList.textContent = '';
    quickIcons.textContent = '';

    const items = [
      { id: 'text', ic: 'message', label: 'Send a text' },
      { id: 'history', ic: 'clock', label: 'History' },
      { id: 'remind', ic: 'bell', label: 'Remind me' },
    ];
    if (row.tier === 'unknown') items.push({ id: 'save', ic: 'plus', label: 'Save number' });
    if (row.view) items.push({ id: 'profile', ic: 'person', label: 'Open contact' });

    for (const it of items) {
      actionList.appendChild(h('button.rcard__action', {
        type: 'button',
        on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onAction?.(it.id, row); } },
      },
      h('span.rcard__action-icon', { html: icon(it.ic) }),
      h('span.t-body', { text: it.label })));
    }

    const quick = [
      { id: 'whatsapp', ic: 'whatsapp', label: 'WhatsApp' },
      { id: 'history',  ic: 'clock',    label: 'History' },
    ];
    for (const q of quick) {
      quickIcons.appendChild(h('button.rcard__quick-btn', {
        type: 'button', aria: { label: q.label },
        on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onAction?.(q.id, row); } },
      }, h('span', { html: icon(q.ic) })));
    }
  }

  /**
   * One dim line: the event as a sentence, plus duration, plus a callback
   * nudge when one applies. Coloured by what actually needs attention —
   * everything else stays the same quiet secondary tone as the rest of the
   * card, which is what makes the coloured ones legible at a glance.
   */
  function renderMeta(row, settings) {
    const parts = [];
    parts.push(settings.recents.naturalLanguage
      ? callSentence(row.entry, row.view)
      : row.entry.disposition.replace(/-/g, ' '));

    if (settings.recents.showDuration && row.entry.durationSec > 0) {
      parts.push(spokenDuration(row.entry.durationSec, { short: true }));
    }
    if (row.owed) parts.push(row.owed.count > 1 ? `${row.owed.count} to return` : 'Call back');

    setText(meta, parts.join(' · '));

    const missed = isMissed(row.entry);
    meta.classList.remove('c-2', 'c-warn', 'c-neg');
    meta.classList.add(row.owed || missed ? 'c-warn' : 'c-2');
  }

  /** At most one chip: suspected spam. Everything else lives in the meta line. */
  function renderChip(row) {
    chipSlot.textContent = '';
    const spammy = row.spam && row.spam.score >= 0.75 && !row.spam.trusted;
    toggle(chipSlot, 'is-hidden', !spammy);
    if (!spammy) return;
    chipSlot.appendChild(h('span.chip.chip--negative', null,
      h('span.chip__icon', { html: icon('shield') }),
      h('span.chip__label', { text: 'Likely spam' })));
  }

  function update(next = {}) {
    props = { ...props, ...next };
    const { row, settings } = props;

    const headline = row.view?.firstName
      || (row.tier === 'dialr' ? row.profile?.firstName : null)
      || row.displayName;

    setText(first, headline);
    // A raw phone number is data, not a name — it leaves display type
    // entirely (numeric font, no uppercase) but is still measured to fit,
    // just with its own range: digits run wider per glyph than the
    // condensed display face.
    const isNumber = row.tier === 'unknown';
    toggle(first, 'rcard__name--number', isNumber);
    fitText(first, isNumber ? { max: NUMBER_MAX, min: NUMBER_MIN } : { max: NAME_MAX, min: NAME_MIN });

    setText(when, relativeTime(row.entry.startedAt, Date.now(), { compact: true }));

    renderMeta(row, settings);
    renderChip(row);

    setText(noteLine, settings.recents.showNotes && row.note ? row.note : '');
    toggle(noteLine, 'is-hidden', !(settings.recents.showNotes && row.note));

    avatar.update({
      name: row.tier === 'unknown' ? '#' : row.displayName,
      src: row.view?.avatar || row.profile?.avatarUrl || null,
      ring: row.tier === 'dialr' || !!row.view?.isDialrUser,
      status: row.spam?.score >= 0.75 ? 'spam' : row.owed ? 'missed' : 'none',
    });

    toggle(el, 'rcard--compact', settings.appearance.cardDensity === 'compact');

    if (props.expanded !== el.classList.contains('is-expanded')) {
      if (props.expanded) {
        renderActions(row);
        el.classList.add('is-expanded');
        expansion.setAttribute('aria-hidden', 'false');
        expansion.style.height = `${expansion.scrollHeight}px`;
        afterTransition(expansion, 420).then(() => { if (el.classList.contains('is-expanded')) expansion.style.height = 'auto'; });
      } else {
        expansion.style.height = `${expansion.scrollHeight}px`;
        requestAnimationFrame(() => { expansion.style.height = '0px'; });
        el.classList.remove('is-expanded');
        expansion.setAttribute('aria-hidden', 'true');
      }
    }
  }

  update({});

  return { el, update, destroy() { for (const c of cleanups) c(); avatar.destroy(); } };
}
