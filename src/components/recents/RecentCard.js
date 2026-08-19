/**
 * DIALR — RecentCard.
 *
 * The product's signature object. A minimal floating card that EXPANDS in
 * place into an action layer rather than navigating away.
 *
 * ---------------------------------------------------------------------------
 * REBUILT TWICE. First pass — see docs/UI_REVISION_PLAN.md § D1 — took it
 * from five rows down to two:
 *
 *      ◉  AVNI                              10m   ☏
 *         She called you · 6m
 *         │ Red skirt — Amazon
 *
 * Project Clean Slate removes the avatar entirely (directive: no image
 * avatars in Recents — match the reference deck) and the swipe-to-reveal
 * gesture, replacing both the avatar's DIALR ring/spam badge and the swipe
 * with two always-visible icon buttons:
 *
 *      AVNI                                  10m   ☏  ⋯
 *      She called you · 6m
 *      │ Red skirt — Amazon
 *
 * DIALR-user status no longer marks the row at all — it's still visible on
 * the contact sheet and call screens, which is where a relationship, not a
 * list, actually needs it. Spam folds into the meta line's colour instead of
 * a chip, so exactly one dim line carries every non-name signal.
 *
 * The name is sized by measurement (core/dom.js › fitText), not by picking
 * between three hard buckets tuned for "AVNI" and going ragged on anyone
 * whose name doesn't happen to fit one of them.
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

  /* ---- head: name + time, call + more, with meta/note below ------------- */
  const first = h('h3.rcard__name');
  const when = h('span.rcard__when.t-body-sm.c-3');
  const meta = h('p.rcard__meta.t-body-sm');
  const noteLine = h('div.rcard__note.t-body-sm');

  const callBtn = h('button.rcard__act.rcard__act--primary', {
    type: 'button', aria: { label: 'Call' },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('success'); onCall?.(props.row); } },
  }, h('span', { html: icon('phone') }));

  const moreBtn = h('button.rcard__act', {
    type: 'button', aria: { label: 'More actions' },
    on: { click: (e) => { e.stopPropagation(); haptics.fire('tap'); onExpand?.(props.row); } },
  }, h('span', { html: icon('more') }));

  const acts = h('div.rcard__acts', null, callBtn, moreBtn);

  const head = h('div.rcard__head', null,
    first,
    when,
    acts,
    meta,
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
   * One dim line carries every non-name signal — the event as a sentence,
   * duration, a callback nudge, and suspected spam (there is no chip for it
   * anymore; a shield-worthy signal still reads fine in text, and one line
   * is quieter than a line plus a chip). Coloured by what actually needs
   * attention — everything else stays the same quiet secondary tone as the
   * rest of the card, which is what makes the coloured ones legible at a
   * glance.
   */
  function renderMeta(row, settings) {
    const spammy = row.spam && row.spam.score >= 0.75 && !row.spam.trusted;
    const parts = [];
    if (spammy) parts.push('Likely spam');
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
    meta.classList.add(spammy ? 'c-neg' : row.owed || missed ? 'c-warn' : 'c-2');
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

    setText(noteLine, settings.recents.showNotes && row.note ? row.note : '');
    toggle(noteLine, 'is-hidden', !(settings.recents.showNotes && row.note));

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

  return { el, update, destroy() {} };
}
