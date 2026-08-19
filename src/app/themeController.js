/**
 * DIALR — theme controller.
 *
 * Translates settings + wallpaper into a built theme and applies it. Kept apart
 * from themeEngine.js on purpose: the engine is pure colour maths that can be
 * unit-tested with no DOM, this is the stateful adapter that knows about
 * settings, the wallpaper element and preview/restore.
 */
import { buildTheme, applyTheme, INTENSITY } from '../theme/themeEngine.js';
import { paletteFromMeta } from '../theme/palette.js';
import { findMedia } from '../data/media.js';
import { A } from '../state/actions.js';

export function createThemeController({ store, shell }) {

  function resolveMode(settings) {
    if (settings.appearance.mode !== 'system') return settings.appearance.mode;
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  /** Build from current state; `override` lets the picker preview instantly. */
  function compute(override) {
    const s = store.getState();
    const settings = s.settings;
    const standard = settings.appearance.profile === 'standard';

    const asset = override?.asset || findMedia(s.theme.wallpaperId);
    const palette = override?.palette
      || s.theme.palette
      || (asset ? paletteFromMeta(asset.palette) : null);

    const mode = resolveMode(settings);
    const intensity = standard ? 'off' : settings.appearance.intensity;

    return {
      theme: buildTheme({
        mode,
        palette: standard ? null : palette,
        intensity,
        showWallpaper: !standard && settings.appearance.showWallpaper,
        contrast: settings.access.contrast,
      }),
      mode, asset, palette, standard,
    };
  }

  function paint({ theme, mode, asset, standard }) {
    applyTheme(theme);

    const root = document.documentElement;
    root.setAttribute('data-contrast', store.getState().settings.access.contrast);
    root.setAttribute('data-motion',
      store.getState().settings.access.motion === 'system' ? '' : store.getState().settings.access.motion);
    root.style.setProperty('--fs', String(store.getState().settings.access.textSize));

    const showImage = !standard && store.getState().settings.appearance.showWallpaper && asset;
    if (showImage) {
      if (shell.wallpaperImg.getAttribute('src') !== asset.url) shell.wallpaperImg.setAttribute('src', asset.url);
      shell.wallpaperImg.hidden = false;
    } else {
      shell.wallpaperImg.hidden = true;
    }

    // Colour the Android status/nav bars to match.
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = theme.vars['--bg'];

    return theme.meta;
  }

  /**
   * Re-derive and apply from current state.
   *
   * sync() is authoritative: it always recomputes from the store. A preview is
   * therefore self-cancelling — the next state change repaints the committed
   * theme. An earlier version latched a `previewing` flag here and swallowed
   * every subsequent theme change, which is exactly the class of bug a
   * "temporary override" flag invites.
   */
  function sync() {
    const computed = compute();
    const meta = paint(computed);
    const s = store.getState();
    if (s.theme.resolvedMode !== computed.mode) {
      store.dispatch({ type: A.THEME_SET, patch: { resolvedMode: computed.mode } });
    }
    return meta;
  }

  /**
   * Paint a palette without committing it — wallpaper picker hover/tap.
   * Nothing is written to the store, so any later sync() restores reality.
   */
  function preview(palette, asset) {
    paint(compute({ palette, asset }));
  }

  /** Explicitly drop a preview and repaint the committed theme. */
  const endPreview = () => sync();

  // Follow the OS when the user chose "Auto".
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  mq?.addEventListener?.('change', () => {
    if (store.getState().settings.appearance.mode === 'system') sync();
  });

  return { sync, preview, endPreview, compute, resolveMode, INTENSITY };
}
