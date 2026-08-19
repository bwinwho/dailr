/**
 * DIALR — You screen.
 *
 * Your profile as a poster, with the small number of controls people actually
 * change often (theme, wallpaper, ringtone) surfaced directly, and everything
 * else one tap away in Settings. This is the anti-overwhelm split: the tab
 * shows identity plus five shortcuts, not a wall of preferences.
 */
import { h, setText, toggle } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { ProfileView } from '../components/profile/ProfileView.js';
import { Banner } from '../components/primitives/States.js';
import { INTENSITY, INTENSITY_ORDER } from '../theme/themeEngine.js';
import { findMedia } from '../data/media.js';
import { compactCount } from '../core/format.js';
import haptics from '../core/haptics.js';

export function YouScreen({ store, actions }) {
  const profile = ProfileView({
    profile: null,
    settings: store.getState().settings,
    mode: 'self',
    onAction: (id, arg) => actions.profileAction(id, arg),
  });

  const shortcuts = h('div.you__shortcuts');
  const modeRow = h('div.you__moderow');
  const bannerSlot = h('div.you__banner');

  const body = h('div.screen__body', null,
    h('div.screen__inner', null, bannerSlot, profile.el, modeRow, shortcuts));

  const el = h('section.screen.screen--you', { id: 'screen-you', role: 'tabpanel', aria: { label: 'You' } }, body);

  function renderModeRow(state) {
    modeRow.textContent = '';
    const s = state.settings;

    const seg = (label, options, value, onPick) => {
      const wrap = h('div.you__seg', null, h('span.you__seg-label.t-micro.c-4', { text: label }));
      const group = h('div.you__seg-opts');
      for (const o of options) {
        group.appendChild(h('button.you__seg-opt.t-micro', {
          type: 'button', text: o.label,
          dataset: { selected: String(o.value === value) },
          aria: { pressed: String(o.value === value) },
          on: { click: () => { haptics.fire('select'); onPick(o.value); } },
        }));
      }
      wrap.appendChild(group);
      return wrap;
    };

    modeRow.appendChild(seg('Appearance',
      [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'Auto' }],
      s.appearance.mode, (v) => actions.setSetting('appearance.mode', v)));

    modeRow.appendChild(seg('Style',
      [{ value: 'standard', label: 'Standard' }, { value: 'expressive', label: 'Expressive' }],
      s.appearance.profile, (v) => actions.setSetting('appearance.profile', v)));

    if (s.appearance.profile === 'expressive') {
      modeRow.appendChild(seg('Colour',
        INTENSITY_ORDER.map((k) => ({ value: k, label: INTENSITY[k].label })),
        s.appearance.intensity, (v) => actions.setSetting('appearance.intensity', v)));
    }
  }

  function renderShortcuts(state) {
    shortcuts.textContent = '';
    const wp = findMedia(state.theme.wallpaperId);
    const rt = findMedia(state.settings.sound.ringtone || 'rt_dialr_default');

    const items = [
      { id: 'wallpaper', ic: 'image',   label: 'Wallpaper',      value: wp?.name || 'None' },
      { id: 'ringtone',  ic: 'wave',    label: 'Ringtone',       value: rt?.name || 'DIALR' },
      { id: 'replies',   ic: 'message', label: 'Quick replies',  value: '3 saved' },
      { id: 'protection',ic: 'shield',  label: 'Call protection',value: state.settings.protection.enabled ? 'On' : 'Off' },
      { id: 'settings',  ic: 'gear',    label: 'All settings',   value: '' },
    ];

    for (const it of items) {
      shortcuts.appendChild(h('button.you__shortcut', {
        type: 'button',
        on: { click: () => actions.youShortcut(it.id) },
      },
      h('span.you__shortcut-icon', { html: icon(it.ic) }),
      h('span.you__shortcut-label.t-body', { text: it.label }),
      h('span.you__shortcut-value.t-caption', { text: it.value }),
      h('span.you__shortcut-chev', { html: icon('chevronR') })));
    }
  }

  function update(state) {
    const me = state.directory.me;
    if (me) {
      profile.update({
        profile: { ...me, region: me.region || 'IN' },
        settings: state.settings,
        mode: 'self',
      });
    }

    bannerSlot.textContent = '';
    if (!state.settings.identity.dialrEnabled) {
      bannerSlot.appendChild(Banner({
        tone: 'neutral', iconName: 'lock',
        text: 'DIALR profile is off. Nothing about you is shared, and unknown callers stay unknown.',
        actionLabel: 'Turn on', onAction: () => actions.setSetting('identity.dialrEnabled', true),
      }).el);
    } else if (!state.app.online) {
      bannerSlot.appendChild(Banner({
        tone: 'neutral', iconName: 'globe',
        text: 'Offline — profile changes will sync when you reconnect.',
      }).el);
    }

    renderModeRow(state);
    renderShortcuts(state);
  }

  return { el, update, destroy() { profile.destroy(); } };
}
