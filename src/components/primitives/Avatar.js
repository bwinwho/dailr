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
 * @param {'sm'|'md'|'lg'|'xl'} [p.size]
 * @param {boolean} [p.ring]   accent ring (used for DIALR users)
 * @param {'photo'|'mono'} [p.variant]  'mono' never renders a photo, even if
 *        src is present — the monogram IS the identity mark on that surface,
 *        not a fallback for a missing one (Recents/Contacts/History policy).
 */
export function Avatar(p = {}) {
  let props = { size: 'md', variant: 'photo', ...p };
  const showPhoto = () => props.variant !== 'mono' && !!props.src;

  const img = h('img.avatar__img', {
    alt: '', loading: 'lazy', decoding: 'async',
    src: showPhoto() ? props.src : '',
  });
  const mark = h('span.avatar__initials', { text: toInitials(props.name || '?') });

  const el = h(`span.avatar.avatar--${props.size}`, {
    class: [props.ring ? 'avatar--ring' : null,
            props.variant === 'mono' ? 'avatar--mono' : null,
            showPhoto() ? 'has-photo' : 'no-photo'],
    aria: { hidden: 'true' },
  }, img, mark);

  // A broken photo must fall back to the identity mark, not an empty box.
  img.addEventListener('error', () => {
    el.classList.remove('has-photo');
    el.classList.add('no-photo');
  });

  return {
    el,
    update(next) {
      props = { ...props, ...next };
      if ((next.src !== undefined || next.variant !== undefined)) {
        // Never point the <img> at a photo on a 'mono' surface — no request
        // is made for a photograph that will never render.
        if (showPhoto()) { setAttr(img, 'src', props.src); el.classList.add('has-photo'); el.classList.remove('no-photo'); }
        else { setAttr(img, 'src', ''); el.classList.remove('has-photo'); el.classList.add('no-photo'); }
      }
      if (next.name !== undefined) setText(mark, toInitials(props.name || '?'));
      toggle(el, 'avatar--ring', !!props.ring);
      toggle(el, 'avatar--mono', props.variant === 'mono');
      for (const s of ['sm', 'md', 'lg', 'xl']) toggle(el, `avatar--${s}`, props.size === s);
    },
    destroy() {},
  };
}
