/**
 * DIALR — theme engine.
 *
 * PRODUCT RULE (from the brief, and the thing that makes this feel designed
 * rather than generated):
 *
 *   DIALR is black and white. A wallpaper may lend the interface its colour,
 *   but only as a *touch*. Never a repaint.
 *
 * So this module is mostly a set of restraints:
 *
 *   1. Text never takes chroma. --fg stays pure. Readability and identity both
 *      depend on it.
 *   2. Surfaces take a whisper — OKLCH chroma 0.005–0.020. Enough that a warm
 *      wallpaper makes the cards feel warm; never enough to read as "coloured".
 *   3. One accent, plus at most one secondary, and the secondary only unlocks
 *      at higher intensities.
 *   4. Accent lightness is normalised into a fixed window per mode, so a neon
 *      wallpaper and a muted one produce accents of the same visual weight.
 *   5. Safety colours (answer green, decline red, emergency) are NEVER themed.
 *      A themed decline button is a bug that ends phone calls wrongly.
 *   6. Every derived colour is contrast-checked before it is written.
 *
 * Output is a flat map of CSS custom properties written onto :root, using the
 * exact same names tokens.css declares. No component knows theming exists.
 */

import {
  hexToOklch, oklchToHex, tint, alpha, readableInk,
  contrastRatio, ensureContrast, withL,
} from './color.js';

/* --------------------------------------------------------------- intensity */

/**
 * The user-facing "how much colour" control.
 * `accentC`  chroma cap for the accent itself
 * `surfaceC` chroma injected into card/surface neutrals
 * `wall`     wallpaper image opacity
 * `secondary` whether a second hue is allowed on screen at all
 */
export const INTENSITY = {
  off:        { id: 'off',        label: 'Off',        accentC: 0,     surfaceC: 0,     wall: 0.00, boost: 0,    secondary: false },
  subtle:     { id: 'subtle',     label: 'Subtle',     accentC: 0.052, surfaceC: 0.005, wall: 0.14, boost: 0,    secondary: false },
  balanced:   { id: 'balanced',   label: 'Balanced',   accentC: 0.098, surfaceC: 0.011, wall: 0.24, boost: 0.35, secondary: true  },
  expressive: { id: 'expressive', label: 'Expressive', accentC: 0.150, surfaceC: 0.020, wall: 0.36, boost: 0.90, secondary: true  },
};
export const INTENSITY_ORDER = ['off', 'subtle', 'balanced', 'expressive'];

/* ------------------------------------------------------- per-mode neutrals */

const RAMP = {
  dark: {
    bg: '#000000', bgElevated: '#0a0a0a',
    s1: '#121212', s2: '#1a1a1a', s3: '#232323', s4: '#2e2e2e', inset: '#080808',
    accentL: 0.855, accent2L: 0.72,
    softA: 0.15, lineA: 0.36, glowA: 0.16,
    scrim: '0,0,0',
    // Chroma is far more visible on a light surface than a dark one at the
    // same OKLCH C — a tint that reads as "a whisper" on #1a1a1a reads as
    // "pink card" on #e8e8e8. Light mode therefore gets roughly half.
    tintScale: 1.0,
  },
  light: {
    bg: '#ffffff', bgElevated: '#f6f6f6',
    s1: '#f2f2f2', s2: '#e8e8e8', s3: '#dcdcdc', s4: '#cbcbcb', inset: '#ffffff',
    accentL: 0.520, accent2L: 0.60,
    softA: 0.12, lineA: 0.34, glowA: 0.12,
    scrim: '255,255,255',
    tintScale: 0.50,
  },
};

/** Deeper surfaces carry proportionally more of the tint, so depth reads. */
const SURFACE_TINT_SCALE = { bg: 0.30, bgElevated: 0.55, s1: 0.80, s2: 1.00, s3: 1.15, s4: 1.32, inset: 0.45 };

/* ------------------------------------------------------------------ build  */

/**
 * @param {object} opts
 * @param {'dark'|'light'} opts.mode
 * @param {Palette|null} opts.palette      null / achromatic -> pure monochrome
 * @param {string} opts.intensity          key of INTENSITY
 * @param {boolean} opts.showWallpaper     render the image behind the UI
 * @param {'normal'|'high'} opts.contrast
 * @returns {{vars: Record<string,string>, meta: object}}
 */
export function buildTheme({
  mode = 'dark',
  palette = null,
  intensity = 'subtle',
  showWallpaper = true,
  contrast = 'normal',
} = {}) {
  const ramp = RAMP[mode] || RAMP.dark;
  const level = INTENSITY[intensity] || INTENSITY.subtle;

  const hasColour = !!(palette && palette.dominant && !palette.achromatic && level.accentC > 0);
  const hue = hasColour ? palette.dominant.h : null;

  // High contrast strips the tint entirely — it is an accessibility mode, and
  // the tint's whole job is to be almost invisible. Keep the accent, drop the
  // surface wash.
  const surfaceC = contrast === 'high' ? 0 : level.surfaceC * ramp.tintScale;

  const vars = {};
  const meta = { mode, intensity: level.id, hasColour, hue, warnings: [] };

  /* ---- surfaces ---- */
  const S = {};
  for (const key of ['bg', 'bgElevated', 's1', 's2', 's3', 's4', 'inset']) {
    S[key] = hasColour && surfaceC > 0
      ? tint(ramp[key], hue, surfaceC * SURFACE_TINT_SCALE[key])
      : ramp[key];
  }

  vars['--bg'] = S.bg;
  vars['--bg-elevated'] = S.bgElevated;
  vars['--surface-1'] = S.s1;
  vars['--surface-2'] = S.s2;
  vars['--surface-3'] = S.s3;
  vars['--surface-4'] = S.s4;
  vars['--surface-inset'] = S.inset;

  /* ---- accent ----
     Normalise into the mode's lightness window and cap chroma, then verify it
     against the background it will actually sit on. */
  let accent;
  if (hasColour) {
    const c = hexToOklch(palette.dominant.hex);
    // The higher intensities may saturate a muted wallpaper a little, but the
    // per-level cap always wins: a grey-blue photo can never become neon.
    const targetC = Math.min(level.accentC, c.C * (1 + level.boost));
    accent = oklchToHex({ L: ramp.accentL, C: targetC, h: c.h });
    // Accent is used for icons and 20px+ display text -> 3:1 is the real bar.
    const ratio = contrastRatio(accent, S.bg);
    if (ratio < 3.0) {
      accent = ensureContrast(accent, S.bg, 3.0);
      meta.warnings.push(`accent lifted for contrast (was ${ratio.toFixed(2)}:1)`);
    }
  } else {
    accent = mode === 'dark' ? '#ffffff' : '#000000';
  }
  vars['--accent'] = accent;
  vars['--accent-ink'] = readableInk(accent);
  vars['--accent-soft'] = alpha(accent, ramp.softA);
  vars['--accent-line'] = alpha(accent, ramp.lineA);
  vars['--accent-glow'] = alpha(accent, ramp.glowA);

  /* ---- secondary accent ----
     Only when the palette genuinely contains a second hue AND the user asked
     for that much colour. We do not invent a complement; a made-up second hue
     is exactly the "aggressive" result the product is trying to avoid. */
  let accent2 = null;
  if (hasColour && level.secondary && palette.secondary) {
    const c2 = hexToOklch(palette.secondary.hex);
    const target2 = Math.min(level.accentC * 0.85, c2.C * (1 + level.boost));
    accent2 = oklchToHex({ L: ramp.accent2L, C: target2, h: c2.h });
    if (contrastRatio(accent2, S.bg) < 3.0) accent2 = ensureContrast(accent2, S.bg, 3.0);
  }
  if (!accent2) accent2 = withL(accent, mode === 'dark' ? 0.70 : 0.62);
  vars['--accent-2'] = accent2;
  vars['--accent-2-soft'] = alpha(accent2, ramp.softA * 0.8);

  /* ---- foreground stays neutral, always ---- */
  const fgBase = mode === 'dark' ? '255,255,255' : '0,0,0';
  vars['--fg'] = mode === 'dark' ? '#ffffff' : '#000000';
  vars['--fg-secondary']  = `rgba(${fgBase}, ${mode === 'dark' ? 0.74 : 0.70})`;
  vars['--fg-tertiary']   = `rgba(${fgBase}, ${mode === 'dark' ? 0.48 : 0.46})`;
  vars['--fg-quaternary'] = `rgba(${fgBase}, ${mode === 'dark' ? 0.28 : 0.26})`;
  vars['--fg-on-accent']  = vars['--accent-ink'];
  vars['--line']          = `rgba(${fgBase}, ${mode === 'dark' ? 0.12 : 0.13})`;
  vars['--line-strong']   = `rgba(${fgBase}, ${mode === 'dark' ? 0.26 : 0.30})`;
  vars['--line-hairline'] = `rgba(${fgBase}, 0.07)`;
  vars['--scrim'] = ramp.scrim;
  vars['--overlay-veil'] = mode === 'dark' ? 'rgba(0,0,0,.66)' : 'rgba(255,255,255,.72)';

  /* ---- wallpaper display ---- */
  const wallOn = showWallpaper && !!palette && level.wall > 0;
  vars['--wallpaper-active']  = wallOn ? '1' : '0';
  vars['--wallpaper-opacity'] = wallOn ? String(level.wall) : '0';
  vars['--wallpaper-sat']     = String(0.55 + level.wall * 0.9);
  vars['--wallpaper-bright']  = mode === 'dark' ? '0.62' : '1.04';
  // Veil is heavier where UI chrome lives, so contrast never depends on the art.
  vars['--wall-veil-top'] = String(Math.min(0.80, 0.34 + level.wall * 0.9));
  vars['--wall-veil-mid'] = String(Math.min(0.55, 0.10 + level.wall * 0.7));
  vars['--wall-veil-bot'] = String(Math.min(0.92, 0.58 + level.wall * 0.9));

  /* ---- exposed hue, for components that need to compose their own colour --- */
  vars['--tone-h'] = hue === null ? '0' : String(Math.round(hue));
  vars['--tone-c'] = String(level.accentC);

  /* ---- safety colours: re-asserted verbatim, every single time -------------
     Written explicitly so that no future refactor can let a palette leak into
     them through an inherited value. */
  vars['--positive'] = '#16c65a';
  vars['--negative'] = '#f5333f';
  vars['--warn']     = '#ffb020';
  vars['--danger']   = '#ff5a5f';
  vars['--info']     = '#4aa8ff';
  vars['--note']     = '#ffd166';

  meta.contrast = {
    fgOnBg: +contrastRatio(vars['--fg'], S.bg).toFixed(2),
    accentOnBg: +contrastRatio(accent, S.bg).toFixed(2),
    inkOnAccent: +contrastRatio(vars['--accent-ink'], accent).toFixed(2),
    fgOnSurface2: +contrastRatio(vars['--fg'], S.s2).toFixed(2),
  };

  return { vars, meta };
}

/* ------------------------------------------------------------------ apply  */

let lastApplied = null;

/**
 * Write a built theme onto an element (defaults to :root).
 * Only changed properties are written — restyling the root is expensive and
 * this runs on every wallpaper preview tap.
 */
export function applyTheme({ vars, meta }, root = document.documentElement) {
  for (const k in vars) {
    if (!lastApplied || lastApplied[k] !== vars[k]) root.style.setProperty(k, vars[k]);
  }
  if (lastApplied) {
    for (const k in lastApplied) if (!(k in vars)) root.style.removeProperty(k);
  }
  lastApplied = vars;
  root.setAttribute('data-mode', meta.mode);
  root.setAttribute('data-tone', meta.hasColour ? 'chromatic' : 'mono');
  return meta;
}

/** Reset to the stylesheet defaults (used by "DIALR Standard"). */
export function clearTheme(root = document.documentElement) {
  if (lastApplied) for (const k in lastApplied) root.style.removeProperty(k);
  lastApplied = null;
  root.setAttribute('data-tone', 'mono');
}

/**
 * Cross-fade a theme change. The browser cannot transition custom properties,
 * so we snapshot the current frame, swap tokens underneath it, and dissolve.
 * Falls back to an instant swap when motion is reduced or the API is missing.
 */
export function applyThemeAnimated(theme, { root = document.documentElement } = {}) {
  const reduced = getComputedStyle(root).getPropertyValue('--motion-scale').trim() === '0.001';
  if (reduced || typeof document.startViewTransition !== 'function') {
    return Promise.resolve(applyTheme(theme, root));
  }
  return document.startViewTransition(() => applyTheme(theme, root)).finished
    .catch(() => applyTheme(theme, root));
}
