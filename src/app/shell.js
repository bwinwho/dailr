/**
 * DIALR — application shell.
 *
 * Builds the fixed layer stack once. Everything else in the app mounts into one
 * of these roots; nothing creates its own full-screen layer, which is what
 * keeps z-index a designed ladder (tokens.css) instead of an arms race.
 */
import { h } from '../core/dom.js';

export function buildShell(root) {
  const wallpaperImg = h('img.app__wallpaper-img', { alt: '', 'aria-hidden': 'true' });
  const wallpaper = h('div.app__wallpaper', null, wallpaperImg);

  const screens = h('main.app__screens', { id: 'screens' });
  const scrim = h('div.app__scrim', { id: 'scrim', 'aria-hidden': 'true' });

  const bottomSlot = h('div.app__bottom-slot', { id: 'bottom-slot' });
  const dockRoot = h('div.app__dock-slot', { id: 'dock-slot' });
  const bottom = h('div.app__bottom', { id: 'bottom' },
    h('div.app__bottom-inner', null, bottomSlot, dockRoot));

  const sheets = h('div.app__sheets', { id: 'sheets' });
  const modals = h('div.app__modals', { id: 'modals' });
  const callLayer = h('div.app__call', { id: 'call-layer' });
  const toasts = h('div.app__toasts', { id: 'toasts', 'aria-live': 'polite' });

  const app = h('div.app', { id: 'app' },
    wallpaper, screens, scrim, bottom, sheets, modals, callLayer, toasts);

  root.textContent = '';
  root.appendChild(app);

  return { app, wallpaper, wallpaperImg, screens, scrim, bottom, bottomSlot, dockRoot, sheets, modals, callLayer, toasts };
}
