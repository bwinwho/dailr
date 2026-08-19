/**
 * DIALR — RecentCard.
 *
 * The product's signature object. A minimal floating card that EXPANDS in
 * place into an action layer rather than navigating away.
 *
 * Reading order is deliberate and inverted from a normal call log:
 *
 *      CHHETRI                 ← surname, small, above
 *      AVNI      10 minutes ago← given name, large; time as a sibling
 *      She called you.         ← the event, as a sentence
 *
 * You read the person first and the event second, because that is the order
 * you actually care about. Telecom metadata (arrows, durations, SIM) is
 * demoted to chips and only shown when the user asks for it.
 */
import { h, setText, toggle, on, afterTransition } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { relativeTime, callSentence, dispositionTag, spokenDuration, plural } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

export function RecentCard({ row, expanded, settings, onCall, onExpand, onAction, onSwipe }) {
  let props = { row, expanded, settings };

  /* ---- identity block --------------------------------------------------- */
  const eyebrow = h('div.rcard__eyebrow.t-eyebrow');
  const first = h('h3.rcard__name');
  const when = h('span.rcard__when.t-body-sm.c-3');
  const sentence = h('p.rcard__sentence.t-body-sm.c-2');
  const chips = h('div.rcard__chips');
  const noteLine = h('div.rcard__note.t-body-sm');

  const avatar = Avatar({ size: 'md', name: '', src: null });

  const callBtn = h('button.rcard__call', {
    type: 'button', aria: { label: 'Call' },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); onCall?.(props.row); } },
  }, h('span', { html: icon('phone') }));

  const head = h('div.rcard__head', null,
    h('div.rcard__id.grow', null,
      eyebrow,
      h('div.rcard__nameline', null, first, when),
      sentence,
      chips,
      noteLine),
    h('div.rcard__aside', null, callBtn, avatar.el));

  /* ---- expansion layer --------------------------------------------------
     Rendered once and revealed by height, so expanding does not re-create
     nodes mid-animation. */
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
      { id: 'text',    label: 'Send a text' },
      { id: 'history', label: 'History' },
      { id: 'remind',  label: 'Remind me' },
    ];
    if (row.tier === 'unknown') items.push({ id: 'save', label: 'Save number' });
    if (row.view) items.push({ id: 'profile', label: 'Open contact' });

    for (const it of items) {
      actionList.appendChild(h('button.rcard__action.t-label', {
        type: 'button', text: it.label,
        on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onAction?.(it.id, row); } },
      }));
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
   * Chips are capped at three. A card carrying five chips is a card nobody
   * reads — the cap forces the most consequential fact to win.
   */
  const CHIP_LIMIT = 3;

  function renderChips(row, settings) {
    chips.textContent = '';
    let used = 0;
    const add = (label, tone, iconName) => {
      if (used >= CHIP_LIMIT) return;
      used++;
      chips.appendChild(
        h(`span.chip.chip--${tone}`, null,
          iconName ? h('span.chip__icon', { html: icon(iconName) }) : null,
          h('span.chip__label', { text: label })));
    };

    // Priority order: safety, obligation, outcome, then metadata.
    if (row.spam && row.spam.score >= 0.75 && !row.spam.trusted) add('Likely spam', 'negative', 'shield');
    else if (row.view?.trusted) add('Trusted', 'positive', 'shieldOk');

    if (row.owed) add(row.owed.count > 1 ? `${row.owed.count} to return` : 'Call back', 'warn', 'return');

    const tag = dispositionTag(row.entry);
    if (tag) add(tag.label, tag.tone === 'negative' ? 'negative' : tag.tone === 'warn' ? 'warn' : 'neutral');

    if (settings.recents.showDuration && row.entry.durationSec > 0) {
      add(spokenDuration(row.entry.durationSec, { short: true }), 'neutral', 'clock');
    }
    if (settings.recents.showSim && row.entry.simId) add(row.entry.simId.toUpperCase(), 'neutral', 'sim');

    toggle(chips, 'is-hidden', !chips.childElementCount);

    // The note is not a chip. It is the most human thing on the card, so it
    // gets its own line and is never squeezed out by a duration badge.
    setText(noteLine, settings.recents.showNotes && row.note ? row.note : '');
    toggle(noteLine, 'is-hidden', !(settings.recents.showNotes && row.note));
  }

  function update(next = {}) {
    props = { ...props, ...next };
    const { row, settings } = props;

    setText(eyebrow, row.view?.surname || (row.tier === 'dialr' ? row.profile?.surname || '' : ''));
    toggle(eyebrow, 'is-hidden', !eyebrow.textContent);

    const headline = row.view?.firstName || (row.tier === 'dialr' ? row.profile?.firstName : null) || row.displayName;
    setText(first, headline);
    toggle(first, 'rcard__name--big', settings.appearance.bigNames);
    // Long names and raw phone numbers step down a size rather than truncating
    // to three characters — "BLIN…" tells you nothing.
    // Calibrated against the narrowest card (≈240px of usable width at 360dp).
    first.dataset.len = row.tier === 'unknown' ? 'number'
      : headline.length > 11 ? 'xlong'
      : headline.length > 6 ? 'long'
      : 'short';

    setText(when, relativeTime(row.entry.startedAt, Date.now(), { compact: true }));

    setText(sentence, settings.recents.naturalLanguage
      ? callSentence(row.entry, row.view)
      : `${row.entry.disposition.replace(/-/g, ' ')} · ${spokenDuration(row.entry.durationSec, { short: true })}`);

    renderChips(row, settings);

    avatar.update({
      // An unknown number has no initials worth showing; the Avatar renders a
      // neutral mark instead of the first two digits.
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
