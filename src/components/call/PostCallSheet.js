/**
 * DIALR — PostCallSheet.
 *
 * Appears only when there is something worth doing. "Something worth doing" is
 * derived, not guessed: an unsaved number, a missed call, a call short enough
 * to have failed, or a note you started writing. A sheet after every call is
 * noise, which is why the default setting is "show when useful".
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { spokenDuration, callSentence, relativeTime, NOTE_MAX, clampNote } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

/** Decides whether the sheet has earned its appearance. */
export function shouldShowPostCall(summary, settings) {
  const mode = settings.calling.postCallSheet;
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return (
    summary.tier === 'unknown' ||                        // unsaved number
    summary.disposition.includes('missed') ||
    summary.disposition.includes('no-answer') ||
    summary.disposition.includes('failed') ||
    summary.disposition.includes('busy') ||
    (summary.durationSec > 0 && summary.durationSec < 12) ||
    !!summary.note
  );
}

export function PostCallSheet({ summary, settings, onAction, onClose }) {
  const avatar = Avatar({ size: 'md', name: summary.name, src: summary.avatar });

  const title = h('div.postcall__name.t-title');
  const meta = h('div.postcall__meta.t-body-sm.c-2');
  const actions = h('div.postcall__actions');

  const noteInput = h('input.postcall__note', {
    type: 'text', maxlength: String(NOTE_MAX),
    placeholder: 'Add a note (50 characters)',
    value: summary.note || '',
    aria: { label: 'Call note' },
    on: { input: (e) => { e.target.value = clampNote(e.target.value); onAction?.('note', e.target.value); } },
  });

  const el = h('div.postcall', null,
    h('div.postcall__head', null, avatar.el,
      h('div.col.grow', null, title, meta),
      h('button.postcall__close', { type: 'button', aria: { label: 'Dismiss' }, html: icon('close'),
        on: { click: () => onClose?.() } })),
    actions,
    settings.calling.notesEnabled ? noteInput : null);

  function build() {
    setText(title, summary.name);
    const bits = [];
    if (summary.durationSec > 0) bits.push(spokenDuration(summary.durationSec));
    bits.push(callSentence({ disposition: summary.disposition }, summary.view));
    setText(meta, bits.join(' · '));

    actions.textContent = '';
    const items = [];

    if (summary.tier === 'unknown') items.push({ id: 'save', label: 'Save number', ic: 'plus', tone: 'accent' });
    if (summary.disposition.includes('missed') || summary.disposition.includes('no-answer')) {
      items.push({ id: 'call', label: 'Call again', ic: 'redial', tone: 'accent' });
    }
    items.push({ id: 'remind', label: 'Remind me', ic: 'bell' });
    items.push({ id: 'text', label: 'Message', ic: 'message' });
    if (summary.tier === 'unknown') items.push({ id: 'spam', label: 'Report spam', ic: 'shield', tone: 'danger' });
    if (summary.tier !== 'unknown') items.push({ id: 'history', label: 'History', ic: 'clock' });

    for (const it of items) {
      actions.appendChild(h(`button.postcall__action${it.tone ? '.is-' + it.tone : ''}`, {
        type: 'button',
        on: { click: () => { haptics.fire('tap'); onAction?.(it.id); } },
      }, h('span.postcall__action-icon', { html: icon(it.ic) }),
         h('span.t-micro', { text: it.label })));
    }
  }

  build();
  return { el, update() { build(); }, destroy() { avatar.destroy(); } };
}
