/**
 * DIALR — avatar.
 *
 * Encodes the product's rule about photographs: a contact either HAS one or
 * does not, and the two states must be visually distinct. A missing photo
 * renders as an initials mark with a different treatment — never as a
 * face-shaped placeholder that implies a photo exists.
 */
import { h, setText, toggle, setAttr } from '../../core/dom.js';
import { initials as toInitials } from '../../core/format.js';

/**
 * @param {object} p
 * @param {string} [p.src]     photo URL; absent -> identity mark
 * @param {string} p.name
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [p.size]
 * @param {boolean} [p.ring]   accent ring (used for DIALR users)
 * @param {'none'|'live'|'missed'|'spam'} [p.status]
 */
export function Avatar(p = {}) {
  let props = { size: 'md', ...p };

  const img = h('img.avatar__img', {
    alt: '', loading: 'lazy', decoding: 'async',
    src: props.src || '',
  });
  const mark = h('span.avatar__initials', { text: toInitials(props.name || '?') });
  const badge = h('span.avatar__badge');

  const el = h(`span.avatar.avatar--${props.size}`, {
    class: [props.ring ? 'avatar--ring' : null, props.src ? 'has-photo' : 'no-photo'],
    dataset: { status: props.status || 'none' },
    aria: { hidden: 'true' },
  }, img, mark, badge);

  // A broken photo must fall back to the identity mark, not an empty box.
  img.addEventListener('error', () => {
    el.classList.remove('has-photo');
    el.classList.add('no-photo');
  });

  return {
    el,
    update(next) {
      props = { ...props, ...next };
      if (next.src !== undefined) {
        if (props.src) { setAttr(img, 'src', props.src); el.classList.add('has-photo'); el.classList.remove('no-photo'); }
        else { el.classList.remove('has-photo'); el.classList.add('no-photo'); }
      }
      if (next.name !== undefined) setText(mark, toInitials(props.name || '?'));
      toggle(el, 'avatar--ring', !!props.ring);
      el.dataset.status = props.status || 'none';
      for (const s of ['xs', 'sm', 'md', 'lg', 'xl']) toggle(el, `avatar--${s}`, props.size === s);
    },
    destroy() {},
  };
}
