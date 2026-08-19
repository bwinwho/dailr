/**
 * DIALR — ProfileView.
 *
 * "More like a personal identity poster than a boring account settings page."
 *
 * The composition is editorial: a portrait column of short declarative lines on
 * the left, statistics and imagery on the right, everything asymmetric and
 * typographically driven. It is expressive on purpose — and it is expressly NOT
 * what the incoming-call screen shows (see IncomingCallScreen.js).
 *
 * Used for both your own profile and someone else's; `mode` switches the
 * actions, never the layout.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon, LINK_ICONS, LINK_LABELS } from '../../core/icons.js';
import { compactCount, percent, formatNumber } from '../../core/format.js';
import { Avatar } from '../primitives/Avatar.js';
import haptics from '../../core/haptics.js';

export function ProfileView({ profile, settings, mode = 'self', onAction }) {
  let props = { profile, settings, mode };

  const eyebrow = h('div.profile__eyebrow.t-eyebrow');
  const name = h('h1.profile__name.t-display-l');

  const avatar = Avatar({ size: 'lg', name: '', src: null, ring: true });

  const squadValue = h('div.profile__squad-value.t-display-m.t-num');
  const squadBlock = h('div.profile__squad', null,
    h('div.profile__squad-label.t-label', { text: 'Squad\nmembers' }),
    squadValue);

  const numberRow = h('button.profile__number.tap', {
    type: 'button', on: { click: () => onAction?.('copy-number') },
  }, h('span.profile__flag', { text: '🇮🇳' }), h('span.t-title.t-num'));

  const links = h('div.profile__links');
  const bio = h('div.profile__bio');
  const stats = h('div.profile__stats');
  const poster = h('div.profile__poster');
  const tags = h('div.profile__tags');
  const roleLine = h('div.profile__role.t-micro.c-3');

  const topActions = h('div.profile__topactions');

  const el = h('div.profile', null,
    h('header.profile__head', null,
      h('div.col.grow', null, eyebrow, name),
      topActions),
    h('div.profile__card', null,
      h('div.profile__identity', null,
        avatar.el,
        h('div.col.grow.g-4', null, squadBlock, h('div.rule.rule--full'), numberRow, links)),
      h('div.profile__split', null,
        h('div.profile__col-left', null, h('div.rule'), bio),
        h('div.profile__col-right', null, roleLine, stats, poster, tags))));

  function renderLinks(p, mode) {
    links.textContent = '';
    const chosen = (p.links || []).slice(0, 4);
    for (const type of chosen) {
      links.appendChild(h('button.profile__link', {
        type: 'button', aria: { label: LINK_LABELS[type] || type },
        on: { click: () => { haptics.fire('tap'); onAction?.('open-link', type); } },
      }, h('span', { html: icon(LINK_ICONS[type] || 'link') })));
    }
    if (mode === 'self' && chosen.length < 4) {
      links.appendChild(h('button.profile__link.profile__link--add', {
        type: 'button', aria: { label: 'Add a link' },
        on: { click: () => onAction?.('edit-links') },
      }, h('span', { html: icon('plus') })));
    }
  }

  /**
   * The bio is a composition, not a paragraph: each entry is its own typographic
   * object so a profile reads like a poster.
   */
  function renderBio(p) {
    bio.textContent = '';
    for (const item of p.bio || []) {
      if (item.kind === 'line') {
        bio.appendChild(h('p.profile__bio-line.t-display-s', {
          class: item.tone ? `is-${item.tone}` : null, text: item.text,
        }));
        bio.appendChild(h('div.rule.profile__bio-rule'));
      } else if (item.kind === 'trait') {
        bio.appendChild(h('p.profile__bio-trait.t-display-s', {
          class: item.tone ? `is-${item.tone}` : null, text: item.text,
        }));
        bio.appendChild(h('div.rule.profile__bio-rule'));
      } else if (item.kind === 'loves') {
        bio.appendChild(h('div.profile__loves', null,
          h('div.t-label.profile__loves-label', { text: 'Loves' }),
          h('ul.profile__loves-list', null,
            ...item.items.map((t) => h('li.t-label', { text: t })))));
      }
    }
    if (!bio.childElementCount && props.mode === 'self') {
      bio.appendChild(h('button.profile__bio-empty.t-label', {
        type: 'button', text: 'Write a few lines about yourself',
        on: { click: () => onAction?.('edit-bio') },
      }));
    }
  }

  function renderStats(p, settings, mode) {
    stats.textContent = '';
    const own = mode === 'self';
    const show = (id) => own || settings.identity[id];

    if (show('showViews')) {
      stats.appendChild(statBlock('Profile\nviews', compactCount(p.profileViews || 0)));
    }
    if (show('showPickupRate') && typeof p.callPickupRate === 'number') {
      stats.appendChild(statBlock('Call pickup\nrate', percent(p.callPickupRate)));
    }
    toggle(stats, 'is-hidden', !stats.childElementCount);
  }

  function statBlock(label, value) {
    return h('div.profile__stat', null,
      h('div.profile__stat-label.t-label', { text: label }),
      h('div.profile__stat-value.t-display-s.t-num', { text: value }));
  }

  function renderTags(p) {
    tags.textContent = '';
    for (const t of [p.sign, p.region === 'IN' ? null : p.region].filter(Boolean)) {
      tags.appendChild(h('div.t-micro.profile__tag', { text: t }));
    }
    toggle(tags, 'is-hidden', !tags.childElementCount);
  }

  function renderTopActions(mode) {
    topActions.textContent = '';
    const items = mode === 'self'
      ? [{ id: 'edit', label: 'Edit profile', tone: 'accent' },
         { id: 'share', label: 'Share', tone: '' }]
      : [{ id: 'block', label: 'Block & report', tone: 'danger' },
         { id: 'squad', label: 'Ask to add', tone: 'positive' }];
    for (const it of items) {
      topActions.appendChild(h(`button.profile__topaction.tap.t-label.is-${it.tone || 'plain'}`, {
        type: 'button', text: it.label,
        on: { click: () => onAction?.(it.id) },
      }));
    }
  }

  function update(next = {}) {
    props = { ...props, ...next };
    const p = props.profile;
    if (!p) return;

    setText(eyebrow, p.surname || '');
    toggle(eyebrow, 'is-hidden', !p.surname);
    setText(name, p.firstName || 'You');

    avatar.update({ name: `${p.firstName || ''} ${p.surname || ''}`, src: p.avatarUrl || null });

    setText(squadValue, compactCount(p.squadMembers || 0));
    toggle(squadBlock, 'is-hidden', props.mode !== 'self' && !props.settings.identity.showSquad);

    numberRow.querySelector('.t-title').textContent = formatNumber(p.number || '', p.region || 'IN');
    toggle(numberRow, 'is-hidden', !p.number);

    setText(roleLine, p.role || '');
    toggle(roleLine, 'is-hidden', !p.role);

    poster.style.backgroundImage = p.posterUrl ? `url("${p.posterUrl}")` : '';
    toggle(poster, 'is-hidden', !p.posterUrl);

    renderLinks(p, props.mode);
    renderBio(p);
    renderStats(p, props.settings, props.mode);
    renderTags(p);
    renderTopActions(props.mode);
  }

  update({});
  return { el, update, destroy() { avatar.destroy(); } };
}
