/**
 * Generates the curated wallpaper library as standalone SVG files.
 *
 * Why generated SVG rather than shipped photography:
 *   - the repo stays text-only and diffable
 *   - every wallpaper is guaranteed to be a known, deliberate palette, which
 *     lets the theme engine be tested against real inputs
 *   - the admin panel will later replace these with Cloudinary assets using the
 *     exact same MediaAsset contract (see docs/DATA_CONTRACTS.md)
 *
 * Run:  node tools/gen-wallpapers.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../assets/wallpapers/', import.meta.url);
mkdirSync(OUT, { recursive: true });

/** blobs: [cx%, cy%, r%, colour, opacity] */
const WALLPAPERS = [
  {
    id: 'mono-void', name: 'Void', pack: 'dialr', mode: 'dark',
    base: '#000000', dominant: null, secondary: null, meanL: 0.09,
    blobs: [[22, 14, 70, '#2a2a2a', .85], [82, 78, 78, '#161616', .9], [50, 46, 55, '#0d0d0d', .8]],
    note: 'Deliberately achromatic. Proves the monochrome path.',
  },
  {
    id: 'deep-green', name: 'Deep Green', pack: 'dialr', mode: 'dark',
    base: '#04100d', dominant: '#2f8f78', secondary: '#123f5c', meanL: 0.22,
    blobs: [[24, 16, 78, '#1d6b58', .92], [78, 74, 82, '#0b3d4f', .78], [56, 44, 46, '#3fae90', .40]],
  },
  {
    id: 'ember', name: 'Ember', pack: 'dialr', mode: 'dark',
    base: '#120704', dominant: '#e0642a', secondary: '#8a1b3d', meanL: 0.24,
    blobs: [[28, 76, 80, '#8f2f10', .92], [76, 20, 74, '#5d1230', .82], [46, 52, 44, '#e0642a', .34]],
  },
  {
    id: 'sodium', name: 'Sodium', pack: 'dialr', mode: 'dark',
    base: '#0d0a04', dominant: '#e2a232', secondary: '#4a3a12', meanL: 0.20,
    blobs: [[18, 22, 68, '#6b4d10', .9], [80, 82, 86, '#2b2008', .95], [62, 34, 40, '#e2a232', .32]],
  },
  {
    id: 'cobalt', name: 'Cobalt Rain', pack: 'dialr', mode: 'dark',
    base: '#03060f', dominant: '#3f6fd8', secondary: '#1d8f9e', meanL: 0.21,
    blobs: [[30, 24, 80, '#132d6e', .95], [74, 80, 78, '#0d3a44', .85], [52, 50, 42, '#3f6fd8', .34]],
  },
  {
    id: 'ultraviolet', name: 'Ultraviolet', pack: 'dialr', mode: 'dark',
    base: '#08040f', dominant: '#8f5fe0', secondary: '#d0417a', meanL: 0.22,
    blobs: [[24, 78, 76, '#3a1668', .95], [78, 22, 78, '#5c1440', .84], [50, 48, 44, '#8f5fe0', .32]],
  },
  {
    id: 'blush', name: 'Blush', pack: 'dialr', mode: 'dark',
    base: '#100407', dominant: '#e07a8e', secondary: '#7a3f2a', meanL: 0.23,
    blobs: [[70, 22, 80, '#6b1f34', .92], [24, 80, 76, '#3d1d14', .88], [48, 46, 42, '#e07a8e', .30]],
  },
  {
    id: 'concrete', name: 'Concrete', pack: 'dialr', mode: 'dark',
    base: '#0b0d0f', dominant: '#5c7286', secondary: null, meanL: 0.19,
    blobs: [[26, 20, 78, '#22303c', .9], [80, 76, 80, '#14181c', .95], [55, 50, 44, '#5c7286', .18]],
    note: 'Low chroma on purpose — the accent stays almost grey.',
  },
  {
    id: 'bone', name: 'Bone', pack: 'dialr', mode: 'light',
    base: '#f4f1ea', dominant: '#b09a76', secondary: '#7f8f86', meanL: 0.88,
    blobs: [[24, 20, 78, '#e6dcc7', .95], [80, 78, 82, '#dfe4de', .9], [52, 48, 44, '#c9b79b', .38]],
  },
  {
    id: 'paper', name: 'Paper', pack: 'dialr', mode: 'light',
    base: '#ffffff', dominant: null, secondary: null, meanL: 0.95,
    blobs: [[26, 22, 76, '#f0f0f0', .95], [78, 80, 80, '#e7e7e7', .9]],
    note: 'Light-mode achromatic counterpart to Void.',
  },
  {
    id: 'k31-chrome', name: 'K31 Chrome', pack: 'kode31', mode: 'dark',
    base: '#0a0a0c', dominant: '#c9d1dc', secondary: '#e02b2b', meanL: 0.26,
    blobs: [[30, 26, 74, '#2a2f38', .95], [76, 74, 76, '#15171c', .9], [58, 40, 34, '#c9d1dc', .26],
            [18, 88, 30, '#e02b2b', .28]],
  },
  {
    id: 'k31-signal', name: 'K31 Signal', pack: 'kode31', mode: 'dark',
    base: '#040a08', dominant: '#25e08f', secondary: '#0f4a6e', meanL: 0.20,
    blobs: [[22, 74, 78, '#0c4a30', .95], [80, 24, 74, '#08324a', .86], [50, 50, 40, '#25e08f', .30]],
  },
];

const svg = (w) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920" preserveAspectRatio="xMidYMid slice">
  <defs>
${w.blobs.map((b, i) => `    <radialGradient id="g${i}" cx="${b[0]}%" cy="${b[1]}%" r="${b[2]}%">
      <stop offset="0%" stop-color="${b[3]}" stop-opacity="${b[4]}"/>
      <stop offset="60%" stop-color="${b[3]}" stop-opacity="${(b[4] * 0.35).toFixed(3)}"/>
      <stop offset="100%" stop-color="${b[3]}" stop-opacity="0"/>
    </radialGradient>`).join('\n')}
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.42"/></feComponentTransfer>
    </filter>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.30"/>
      <stop offset="45%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.42"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="${w.base}"/>
${w.blobs.map((_, i) => `  <rect width="1080" height="1920" fill="url(#g${i})"/>`).join('\n')}
  <rect width="1080" height="1920" fill="url(#vig)"/>
  <rect width="1080" height="1920" filter="url(#grain)" opacity="0.055" style="mix-blend-mode:overlay"/>
</svg>
`;

const manifest = [];
for (const w of WALLPAPERS) {
  const file = `${w.id}.svg`;
  writeFileSync(new URL(file, OUT), svg(w), 'utf8');
  manifest.push({
    id: w.id, name: w.name, pack: w.pack, file,
    palette: { dominant: w.dominant, secondary: w.secondary, meanL: w.meanL, mode: w.mode },
    note: w.note || null,
  });
}
writeFileSync(new URL('manifest.json', OUT), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`generated ${manifest.length} wallpapers -> assets/wallpapers/`);
