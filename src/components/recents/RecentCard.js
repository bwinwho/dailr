/**
 * DIALR — RecentCard.
 *
 * The product's signature object. A minimal floating card that EXPANDS in
 * place into an action layer rather than navigating away.
 *
 * ---------------------------------------------------------------------------
 * REBUILT THREE TIMES. First pass — see docs/UI_REVISION_PLAN.md § D1 — took
 * it from five rows down to two. Project Clean Slate removed the avatar and
 * swipe-to-reveal, replacing both with two always-visible icon buttons. This
 * pass, against the user's own reference mockups, does three more things:
 *
 *   - Splits the meta line into two: the event as a sentence, then duration
 *     on its own row with a clock glyph — collapsed shows "6m", expanded
 *     shows the full "6 minutes" once there's room for it.
 *   - The second head button is state-aware: a filter/tune glyph that
 *     expands the card when collapsed, a message glyph that sends a text
 *     once expanded (its old job — opening the card — is already done).
 *   - The expansion is two spaced link rows (History, Remind me — each with
 *     a subtitle and a chevron, same language as ContactSheet's links) in
 *     place of the old four-item text list plus a redundant icon row.
 *     "Open contact" is gone from the list — tapping the name does that now.
 *
 *      AVNI                                  10m   ☏  ▤
 *      Avni called you.
 *      🕐 6m
 *      │ Red skirt — Amazon
 * ---------------------------------------------------------------------------
 */
import { h, setText, toggle, afterTransition, fitText } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { relativeTime, callSentence, spokenDuration, isMissed } from '../../core/format.js';
import haptics from '../../core/haptics.js';

const NAME_MAX = 26;
// 14, not 16 — removing the avatar (Project Clean Slate) freed width but not
// quite enough for every saved name at 360px; tools/audit.mjs caught "Mr.
// Prasad" clipping at the old floor. Unsaved numbers below are left at their
// original floor: an unsaved number ellipsizing is an acceptable trade
// (the full number is always visible after tapping to expand the card); a
// saved contact's name is the row's identity signal and shouldn't clip.
const NAME_MIN = 14;
// Numeric glyphs run wider per character than the condensed display face, so
// an unsaved number needs a shorter range to fit the same column.
const NUMBER_MAX = 19;
const NUMBER_MIN = 14;

export function RecentCard({ row, expanded, settings, onCall, onExpand, onAction }) {
  let props = { row, expanded, settings };

  /* ---- head: name + time, call + filter/text, with meta/duration/note
     below. The name itself opens the contact — see its click handler. ---- */
  const first = h('h3.rcard__name', {
    on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onAction?.('profile', props.row); } },
  });
  const when = h('span.rcard__when.t-body-sm.c-3');
  const meta = h('p.rcard__meta.t-body-sm');
  const durationIcon = h('span.rcard__duration-icon', { html: icon('clock') });
  const durationText = h('span');
  const durationLine = h('div.rcard__duration.t-body-sm.c-3', null, durationIcon, durationText);
  const noteLine = h('div.rcard__note.t-body-sm');

  const callBtn = h('button.rcard__act.rcard__act--primary', {
    type: 'button', aria: { label: 'Call' },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); onCall?.(props.row); } },
  }, h('span', { html: icon('phone') }));

  // Filter/tune glyph while collapsed (taps it or the card body both expand);
  // once expanded, that job is done, so the same slot becomes "send a text".
  const secondBtnIcon = h('span', { html: icon('filter') });
  const secondBtn = h('button.rcard__act', {
    type: 'button', aria: { label: 'More actions' },
    on: {
      click: (e) => {
        e.stopPropagation(); haptics.fire('tap');
        if (props.expanded) onAction?.('text', props.row);
        else onExpand?.(props.row);
      },
    },
  }, secondBtnIcon);

  const acts = h('div.rcard__acts', null, callBtn, secondBtn);

  const head = h('div.rcard__head', null,
    first,
    when,
    acts,
    meta,
    durationLine,
    noteLine);

  /* ---- expansion layer --------------------------------------------------
     Rendered once and revealed by height, so expanding does not re-create
     nodes mid-animation. Two spaced link rows, not a four-item text list
     plus a redundant icon row. */
  const linkList = h('div.rcard__links');
  const expansion = h('div.rcard__expansion', { aria: { hidden: 'true' } },
    h('div.rule.rcard__rule'),
    linkList);

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

  /* ---- render ----------------------------------------------------------- */

  function renderActions(row) {
    linkList.textContent = '';
    const items = [
      { id: 'history', ic: 'clock', label: 'History', sub: 'View call history' },
      { id: 'remind',  ic: 'bell',  label: 'Remind me', sub: 'Set a reminder' },
    ];
    if (row.tier === 'unknown') items.push({ id: 'save', ic: 'plus', label: 'Save number', sub: 'Add to your contacts' });

    for (const it of items) {
      linkList.appendChild(h('button.rcard__link', {
        type: 'button',
        on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onAction?.(it.id, row); } },
      },
      h('span.rcard__link-icon', { html: icon(it.ic) }),
      h('span.col.grow', null,
        h('span.rcard__link-label.t-body', { text: it.label }),
        h('span.rcard__link-sub.t-caption.c-3', { text: it.sub })),
      h('span.rcard__link-chev', { html: icon('chevronR') })));
    }
  }

  /**
   * One dim line carries the event and any callback nudge — duration moved
   * to its own line (see renderDuration) and suspected spam has no chip
   * anymore; a shield-worthy signal still reads fine as text. Coloured by
   * what actually needs attention — everything else stays the same quiet
   * secondary tone as the rest of the card, which is what makes the
   * coloured ones legible at a glance.
   */
  function renderMeta(row, settings) {
    const spammy = row.spam && row.spam.score >= 0.75 && !row.spam.trusted;
    const parts = [];
    if (spammy) parts.push('Likely spam');
    parts.push(settings.recents.naturalLanguage
      ? callSentence(row.entry, row.view)
      : row.entry.disposition.replace(/-/g, ' '));
    if (row.owed) parts.push(row.owed.count > 1 ? `${row.owed.count} to return` : 'Call back');

    setText(meta, parts.join(' · '));

    const missed = isMissed(row.entry);
    meta.classList.remove('c-2', 'c-warn', 'c-neg');
    meta.classList.add(spammy ? 'c-neg' : row.owed || missed ? 'c-warn' : 'c-2');
  }

  /** Collapsed reads "6m"; expanded spells it out ("6 minutes") now that
   *  there's a whole extra line of room for it. */
  function renderDuration(row, settings, expanded) {
    const show = settings.recents.showDuration && row.entry.durationSec > 0;
    toggle(durationLine, 'is-hidden', !show);
    if (!show) return;
    setText(durationText, spokenDuration(row.entry.durationSec, { short: !expanded }));
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
    renderDuration(row, settings, props.expanded);

    setText(noteLine, settings.recents.showNotes && row.note ? row.note : '');
    toggle(noteLine, 'is-hidden', !(settings.recents.showNotes && row.note));

    toggle(el, 'rcard--compact', settings.appearance.cardDensity === 'compact');

    if (props.expanded !== el.classList.contains('is-expanded')) {
      if (props.expanded) {
        renderActions(row);
        secondBtnIcon.innerHTML = icon('message');
        secondBtn.setAttribute('aria-label', 'Send a text');
        el.classList.add('is-expanded');
        expansion.setAttribute('aria-hidden', 'false');
        expansion.style.height = `${expansion.scrollHeight}px`;
        afterTransition(expansion, 420).then(() => { if (el.classList.contains('is-expanded')) expansion.style.height = 'auto'; });
      } else {
        secondBtnIcon.innerHTML = icon('filter');
        secondBtn.setAttribute('aria-label', 'More actions');
        expansion.style.height = `${expansion.scrollHeight}px`;
        requestAnimationFrame(() => { expansion.style.height = '0px'; });
        el.classList.remove('is-expanded');
        expansion.setAttribute('aria-hidden', 'true');
      }
    }
  }

  update({});

  return { el, update, destroy() {} };
}
