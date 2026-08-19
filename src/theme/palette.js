/**
 * DIALR — wallpaper palette extraction.
 *
 * Given any image, produce a small, honest description of its colour:
 *
 *     { dominant, secondary, meanL, vibrancy, achromatic, swatches[] }
 *
 * "Honest" is the important word. If a wallpaper is genuinely black and white,
 * this returns `achromatic: true` and the app stays monochrome instead of
 * inventing a tint out of JPEG noise. The theme is supposed to be a *touch*.
 *
 * Built-in wallpapers ship a pre-computed palette in their MediaAsset (the
 * admin panel is expected to compute it at upload time), so extraction only
 * actually runs for user-supplied media.
 */

import { rgbToOklab, oklabToOklch, oklchToHex, hueDistance } from './color.js';

const SAMPLE = 56;          // downsample edge; 56×56 ≈ 3k pixels, ~2ms
const HUE_BINS = 24;        // 15° each
const L_BINS = 5;
const NEUTRAL_C = 0.022;    // below this we call it grey, not a colour

/** Load an image for pixel access. Rejects rather than hanging forever. */
function loadImage(src, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const timer = setTimeout(() => reject(new Error('image load timeout')), timeout);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('image load failed')); };
    img.src = src;
  });
}

function drawToPixels(img, size = SAMPLE) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');

  // Cover-fit so we sample what the user actually sees, not letterbox bars.
  const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  let sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height, sx = 0, sy = 0;
  if (ar > 1) { sw = sh; sx = ((img.naturalWidth || img.width) - sw) / 2; }
  else if (ar < 1) { sh = sw; sy = ((img.naturalHeight || img.height) - sh) / 2; }

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;   // throws SecurityError if tainted
}

/**
 * @param {string} src  image URL, blob: or data: URI
 * @returns {Promise<Palette>} see docs/DATA_CONTRACTS.md § Palette
 */
export async function extractPalette(src) {
  const img = await loadImage(src);
  const data = drawToPixels(img);
  return analysePixels(data);
}

/** Pure, testable core — separated so it can run without a DOM. */
export function analysePixels(data) {
  const bins = new Map();       // key -> { n, L, C, h, sinH, cosH }
  let total = 0, sumL = 0, sumC = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;                       // ignore transparency
    const { L, a, b } = rgbToOklab(data[i], data[i + 1], data[i + 2]);
    const { C, h } = oklabToOklch({ L, a, b });

    total++; sumL += L; sumC += C;

    // Very dark / very light pixels carry no usable hue and dominate photos.
    if (L < 0.10 || L > 0.955) continue;

    const neutral = C < NEUTRAL_C;
    const hb = neutral ? -1 : Math.floor((h / 360) * HUE_BINS) % HUE_BINS;
    const lb = Math.min(L_BINS - 1, Math.floor(L * L_BINS));
    const key = `${hb}:${lb}`;

    let bin = bins.get(key);
    if (!bin) { bin = { n: 0, L: 0, C: 0, sinH: 0, cosH: 0, neutral }; bins.set(key, bin); }
    bin.n++; bin.L += L; bin.C += C;
    const rad = (h * Math.PI) / 180;
    bin.sinH += Math.sin(rad); bin.cosH += Math.cos(rad);
  }

  if (!total) return emptyPalette();

  const meanL = sumL / total;
  const meanC = sumC / total;

  const swatches = [];
  for (const bin of bins.values()) {
    const L = bin.L / bin.n;
    const C = bin.C / bin.n;
    const h = ((Math.atan2(bin.sinH, bin.cosH) * 180) / Math.PI + 360) % 360;
    const coverage = bin.n / total;

    // Score = how much of the image it covers, biased toward colour that is
    // actually usable as an accent: mid-lightness and genuinely chromatic.
    const chromaWeight = bin.neutral ? 0.04 : Math.min(1, C / 0.13) ** 0.55;
    const lightWeight = 1 - Math.abs(L - 0.60) * 1.25;      // peak around L .60
    const score = coverage * chromaWeight * Math.max(0.05, lightWeight);

    swatches.push({ hex: oklchToHex({ L, C, h }), L, C, h, coverage, score, neutral: bin.neutral });
  }

  swatches.sort((a, b) => b.score - a.score);

  const chromatic = swatches.filter((s) => !s.neutral && s.C >= NEUTRAL_C * 1.4);
  const dominant = chromatic[0] || null;
  const secondary = dominant
    ? chromatic.find((s) => s !== dominant
        && hueDistance(s.h, dominant.h) > 38
        && s.score > dominant.score * 0.15) || null
    : null;

  // A wallpaper is achromatic if almost nothing in it carries colour. Then we
  // return no accent at all — DIALR stays black and white, as designed.
  const chromaticCoverage = chromatic.reduce((a, s) => a + s.coverage, 0);
  const achromatic = !dominant || (chromaticCoverage < 0.07 && meanC < 0.030);

  return {
    swatches: swatches.slice(0, 8),
    dominant: achromatic ? null : dominant,
    secondary: achromatic ? null : secondary,
    meanL,
    meanC,
    vibrancy: Math.min(1, meanC / 0.09),
    achromatic,
    suggestedMode: meanL > 0.62 ? 'light' : 'dark',
    source: 'extracted',
  };
}

function emptyPalette() {
  return {
    swatches: [], dominant: null, secondary: null,
    meanL: 0, meanC: 0, vibrancy: 0, achromatic: true,
    suggestedMode: 'dark', source: 'empty',
  };
}

/**
 * Build a Palette object from admin/mock metadata without touching pixels.
 * @param {{dominant?:string, secondary?:string, meanL?:number, mode?:string}} meta
 */
export function paletteFromMeta(meta = {}) {
  const toSw = (hex) => {
    if (!hex) return null;
    const { hexToOklch } = HEX_HELPERS;
    const c = hexToOklch(hex);
    return { hex, L: c.L, C: c.C, h: c.h, coverage: 0, score: 0, neutral: c.C < NEUTRAL_C };
  };
  const dominant = toSw(meta.dominant);
  const secondary = toSw(meta.secondary);
  return {
    swatches: [dominant, secondary].filter(Boolean),
    dominant, secondary,
    meanL: meta.meanL ?? 0.35,
    meanC: dominant ? dominant.C : 0,
    vibrancy: dominant ? Math.min(1, dominant.C / 0.13) : 0,
    achromatic: !dominant,
    suggestedMode: meta.mode || ((meta.meanL ?? 0.35) > 0.62 ? 'light' : 'dark'),
    source: 'meta',
  };
}

// Imported lazily to keep this module's public surface honest about its deps.
import * as HEX_HELPERS from './color.js';

export const ACHROMATIC_PALETTE = emptyPalette;
