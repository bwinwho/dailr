/**
 * DIALR — WallpaperPicker.
 *
 * The customization system's front door. Two things make it work:
 *
 *   LIVE PREVIEW. Selecting a wallpaper themes the entire app immediately,
 *   behind the picker, so you judge the result rather than a thumbnail. The
 *   previous theme is restored if you back out without confirming.
 *
 *   HONEST SWATCHES. Each tile shows the accent DIALR would actually derive,
 *   at the current intensity — including "none" for monochrome wallpapers.
 *   No tile promises colour the theme engine will refuse to produce.
 */
import { h, setText, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { WALLPAPERS, WALLPAPER_PACKS } from '../../data/media.js';
import { paletteFromMeta } from '../../theme/palette.js';
import { buildTheme, INTENSITY, INTENSITY_ORDER } from '../../theme/themeEngine.js';
import haptics from '../../core/haptics.js';

export function WallpaperPicker({ current, mode, intensity, showWallpaper, onPreview, onSelect, onSetting, onPickCustom, userAssets = [] }) {
  let state = { current, intensity, showWallpaper };

  const grid = h('div.wpick__grid');
  const packRow = h('div.wpick__packs');
  const note = h('div.wpick__note.t-caption');

  let activePack = 'dialr';

  /* ---- intensity control, in context ------------------------------------ */
  const intensityRow = h('div.wpick__intensity');
  const renderIntensity = () => {
    intensityRow.textContent = '';
    for (const key of INTENSITY_ORDER) {
      const lvl = INTENSITY[key];
      intensityRow.appendChild(h('button.wpick__int-opt.t-micro', {
        type: 'button', text: lvl.label,
        dataset: { selected: String(state.intensity === key) },
        aria: { pressed: String(state.intensity === key) },
        on: { click: () => { haptics.fire('select'); state.intensity = key; renderIntensity(); renderGrid(); onSetting?.('appearance.intensity', key); } },
      }));
    }
  };

  const wallToggle = h('button.wpick__toggle.t-label', {
    type: 'button',
    on: { click: () => {
      state.showWallpaper = !state.showWallpaper;
      toggle(wallToggle, 'is-on', state.showWallpaper);
      onSetting?.('appearance.showWallpaper', state.showWallpaper);
    } },
  }, h('span.wpick__toggle-box', { html: icon('check') }), h('span', { text: 'Show the image behind the app' }));

  /* ---- tiles ------------------------------------------------------------ */
  function tile(asset) {
    const palette = paletteFromMeta(asset.palette);
    const theme = buildTheme({ mode, palette, intensity: state.intensity, showWallpaper: true });
    const accent = theme.meta.hasColour ? theme.vars['--accent'] : null;

    const swatches = h('div.wpick__swatches');
    if (accent) {
      swatches.appendChild(h('span.wpick__swatch', { style: { background: accent } }));
      if (theme.vars['--accent-2'] !== accent) {
        swatches.appendChild(h('span.wpick__swatch', { style: { background: theme.vars['--accent-2'] } }));
      }
      swatches.appendChild(h('span.wpick__swatch', { style: { background: theme.vars['--surface-2'] } }));
    } else {
      swatches.appendChild(h('span.wpick__swatch.wpick__swatch--none'));
      swatches.appendChild(h('span.t-micro.c-4', { text: 'Mono' }));
    }

    const el = h('button.wpick__tile', {
      type: 'button',
      dataset: { selected: String(asset.id === state.current) },
      aria: { label: `${asset.name}${accent ? '' : ', monochrome'}`, pressed: String(asset.id === state.current) },
      on: {
        click: () => { haptics.fire('select'); state.current = asset.id; renderGrid(); onSelect?.(asset, palette); },
        pointerenter: () => onPreview?.(asset, palette),
      },
    },
    h('span.wpick__thumb', { style: { backgroundImage: `url("${asset.thumbnail}")` } }),
    h('span.wpick__meta', null,
      h('span.wpick__name.t-label', { text: asset.name }),
      swatches),
    asset.id === state.current ? h('span.wpick__check', { html: icon('check') }) : null);

    return el;
  }

  function renderGrid() {
    grid.textContent = '';
    if (activePack === 'user') {
      grid.appendChild(h('button.wpick__tile.wpick__tile--add', {
        type: 'button',
        on: { click: () => onPickCustom?.('image') },
      }, h('span.wpick__add-icon', { html: icon('image') }),
         h('span.t-label', { text: 'Choose an image' })));
      grid.appendChild(h('button.wpick__tile.wpick__tile--add', {
        type: 'button',
        on: { click: () => onPickCustom?.('video') },
      }, h('span.wpick__add-icon', { html: icon('video') }),
         h('span.t-label', { text: 'Choose a video' })));
      for (const a of userAssets) grid.appendChild(tile(a));
      setText(note, 'Large files are resized before use so the dialer stays fast. Videos are capped at 15 seconds.');
    } else {
      for (const a of WALLPAPERS.filter((w) => w.pack === activePack)) grid.appendChild(tile(a));
      const withNote = WALLPAPERS.find((w) => w.pack === activePack && w.id === state.current && w.metadata?.note);
      setText(note, withNote?.metadata?.note || 'Colours are taken from the image and kept deliberately restrained.');
    }
  }

  function renderPacks() {
    packRow.textContent = '';
    for (const p of WALLPAPER_PACKS) {
      packRow.appendChild(h('button.wpick__pack.t-label', {
        type: 'button', text: p.name,
        dataset: { selected: String(p.id === activePack) },
        on: { click: () => { activePack = p.id; renderPacks(); renderGrid(); } },
      }));
    }
  }

  const el = h('div.wpick', null,
    packRow,
    grid,
    note,
    h('div.rule.rule--full.mt-6'),
    h('div.wpick__controls', null,
      h('div.t-label.c-2', { text: 'Colour from wallpaper' }),
      intensityRow,
      wallToggle));

  renderPacks();
  renderIntensity();
  renderGrid();
  toggle(wallToggle, 'is-on', state.showWallpaper);

  return {
    el,
    update(next = {}) { state = { ...state, ...next }; renderIntensity(); renderGrid(); },
    destroy() {},
  };
}
