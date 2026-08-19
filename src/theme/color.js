/**
 * DIALR — colour science.
 *
 * All theme maths happens in OKLab/OKLCH, never in HSL. The reason is the
 * product requirement: a wallpaper-derived accent must feel like the *same
 * amount of colour* whatever hue it is. HSL lies about that — hsl(60,100%,50%)
 * (yellow) and hsl(240,100%,50%) (blue) are wildly different in perceived
 * lightness, so an HSL-derived theme looks scorching on one wallpaper and
 * invisible on the next. OKLCH is perceptually uniform, so clamping L and C to
 * a fixed window produces a consistent, restrained result across every image.
 *
 * Everything is computed in JS and written out as plain hex, so nothing depends
 * on oklch()/color-mix() support in the host Android WebView.
 */

/* ------------------------------------------------------------------ parsing */

export function hexToRgb(hex) {
  let s = String(hex).trim().replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/* --------------------------------------------------------- transfer curves */

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/* ------------------------------------------------------------------ OKLab  */

/** sRGB 0-255 -> OKLab {L,a,b} (L is 0..1) */
export function rgbToOklab(r, g, b) {
  const R = srgbToLinear(r / 255), G = srgbToLinear(g / 255), B = srgbToLinear(b / 255);

  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;

  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
}

/** OKLab -> sRGB 0-255 (unclamped flag reports out-of-gamut) */
export function oklabToRgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;

  const R =  4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  const sr = linearToSrgb(R), sg = linearToSrgb(G), sb = linearToSrgb(B);
  const inGamut = sr >= -0.0015 && sr <= 1.0015 && sg >= -0.0015 && sg <= 1.0015 && sb >= -0.0015 && sb <= 1.0015;

  return {
    r: Math.max(0, Math.min(255, sr * 255)),
    g: Math.max(0, Math.min(255, sg * 255)),
    b: Math.max(0, Math.min(255, sb * 255)),
    inGamut,
  };
}

/* ------------------------------------------------------------------ OKLCH  */

export function oklabToOklch({ L, a, b }) {
  return {
    L,
    C: Math.sqrt(a * a + b * b),
    h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  };
}

export function oklchToOklab({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  return { L, a: Math.cos(rad) * C, b: Math.sin(rad) * C };
}

export const hexToOklch = (hex) => { const { r, g, b } = hexToRgb(hex); return oklabToOklch(rgbToOklab(r, g, b)); };

/**
 * OKLCH -> hex with gamut mapping. Out-of-gamut colours have their chroma
 * reduced (binary search) rather than being clipped per-channel, which would
 * shift the hue — the one thing a wallpaper theme must not do.
 */
export function oklchToHex({ L, C, h }) {
  const Lc = Math.max(0, Math.min(1, L));
  let lo = 0, hi = Math.max(0, C), best = 0;

  if (oklabToRgb(oklchToOklab({ L: Lc, C: hi, h })).inGamut) {
    best = hi;
  } else {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (oklabToRgb(oklchToOklab({ L: Lc, C: mid, h })).inGamut) { best = mid; lo = mid; }
      else hi = mid;
    }
  }
  const { r, g, b } = oklabToRgb(oklchToOklab({ L: Lc, C: best, h }));
  return rgbToHex(r, g, b);
}

/* -------------------------------------------------------------- operations */

/** Perceptual mix. t=0 -> a, t=1 -> b. Hue travels the short way round. */
export function mixOklch(aHex, bHex, t) {
  const A = hexToOklch(aHex), B = hexToOklch(bHex);
  let dh = B.h - A.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  // A neutral endpoint has no meaningful hue; borrow the other one's.
  const hA = A.C < 0.004 ? B.h : A.h;
  const hB = B.C < 0.004 ? A.h : B.h;
  let d = hB - hA;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return oklchToHex({
    L: A.L + (B.L - A.L) * t,
    C: A.C + (B.C - A.C) * t,
    h: (hA + d * t + 360) % 360,
  });
}

/** Push a neutral colour a whisper toward a hue. The core of surface tinting. */
export function tint(baseHex, hue, chroma) {
  const { L } = hexToOklch(baseHex);
  return oklchToHex({ L, C: chroma, h: hue });
}

export const withL = (hex, L) => { const c = hexToOklch(hex); return oklchToHex({ ...c, L }); };
export const withC = (hex, C) => { const c = hexToOklch(hex); return oklchToHex({ ...c, C }); };
export const clampC = (hex, max) => { const c = hexToOklch(hex); return oklchToHex({ ...c, C: Math.min(c.C, max) }); };

/** rgba() string from a hex + alpha — used for soft fills and glows. */
export function alpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`;
}

/* --------------------------------------------------------------- contrast  */

function relLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbToLinear(r / 255), G = srgbToLinear(g / 255), B = srgbToLinear(b / 255);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(aHex, bHex) {
  const la = relLuminance(aHex), lb = relLuminance(bHex);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick whichever of black/white is legible on `hex`. */
export function readableInk(hex) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? '#ffffff' : '#000000';
}

/**
 * Raise or lower L until `fg` clears `min` contrast against `bg`.
 * Returns the original colour if the target is unreachable (never loops).
 */
export function ensureContrast(fgHex, bgHex, min = 4.5, { direction = 'auto' } = {}) {
  if (contrastRatio(fgHex, bgHex) >= min) return fgHex;

  const c = hexToOklch(fgHex);
  const bgL = hexToOklch(bgHex).L;
  const up = direction === 'auto' ? bgL < 0.5 : direction === 'lighter';

  let best = fgHex, bestRatio = contrastRatio(fgHex, bgHex);
  for (let i = 1; i <= 22; i++) {
    const L = up ? Math.min(1, c.L + i * 0.03) : Math.max(0, c.L - i * 0.03);
    const cand = oklchToHex({ ...c, L });
    const ratio = contrastRatio(cand, bgHex);
    if (ratio > bestRatio) { bestRatio = ratio; best = cand; }
    if (ratio >= min) return cand;
    if (L === 0 || L === 1) break;
  }
  return best;
}

/** Shortest distance between two hues, in degrees (0-180). */
export function hueDistance(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}
