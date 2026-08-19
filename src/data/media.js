/**
 * DIALR — media catalogue (curated content).
 *
 * Every asset here is a MediaAsset (docs/DATA_CONTRACTS.md § MediaAsset). The
 * UI never learns where a file came from — built-in, user gallery, Cloudinary
 * or a KODE31 pack all arrive in this one shape.
 *
 * `palette` is supplied by the publisher. Built-ins carry it because the values
 * are known at authoring time; user uploads get it from live extraction
 * (src/theme/palette.js). Either way the theme engine sees the same object.
 */

const A = 'assets/wallpapers';

/** @returns {MediaAsset} */
const wp = (id, name, pack, dominant, secondary, meanL, mode, note) => ({
  id: `wp_${id}`,
  type: 'image',
  source: pack === 'kode31' ? 'kode31' : 'builtin',
  category: 'wallpaper',
  pack,
  name,
  url: `${A}/${id}.svg`,
  thumbnail: `${A}/${id}.svg`,
  dimensions: { w: 1080, h: 1920 },
  duration: null,
  bytes: null,
  owner: 'dialr',
  palette: { dominant, secondary, meanL, mode },
  metadata: { note: note || null, removable: false },
});

/**
 * The curated library. ~8–10 was the brief; twelve gives two per pack plus the
 * two deliberate monochromes that prove the "no invented colour" rule.
 */
export const WALLPAPERS = [
  wp('mono-void',   'Void',        'dialr',  null,      null,      0.09, 'dark',  'Pure monochrome. No tint at any intensity.'),
  wp('deep-green',  'Deep Green',  'dialr',  '#2f8f78', '#123f5c', 0.22, 'dark'),
  wp('ember',       'Ember',       'dialr',  '#e0642a', '#8a1b3d', 0.24, 'dark'),
  wp('sodium',      'Sodium',      'dialr',  '#e2a232', '#4a3a12', 0.20, 'dark'),
  wp('cobalt',      'Cobalt Rain', 'dialr',  '#3f6fd8', '#1d8f9e', 0.21, 'dark'),
  wp('ultraviolet', 'Ultraviolet', 'dialr',  '#8f5fe0', '#d0417a', 0.22, 'dark'),
  wp('blush',       'Blush',       'dialr',  '#e07a8e', '#7a3f2a', 0.23, 'dark'),
  wp('concrete',    'Concrete',    'dialr',  '#5c7286', null,      0.19, 'dark',  'Barely chromatic — the accent stays near grey.'),
  wp('bone',        'Bone',        'dialr',  '#b09a76', '#7f8f86', 0.88, 'light'),
  wp('paper',       'Paper',       'dialr',  null,      null,      0.95, 'light', 'Light-mode monochrome.'),
  wp('k31-chrome',  'K31 Chrome',  'kode31', '#c9d1dc', '#e02b2b', 0.26, 'dark'),
  wp('k31-signal',  'K31 Signal',  'kode31', '#25e08f', '#0f4a6e', 0.20, 'dark'),
];

export const WALLPAPER_PACKS = [
  { id: 'dialr',  name: 'DIALR',        blurb: 'The house set.' },
  { id: 'kode31', name: 'KODE31 MUSIC', blurb: 'Visuals from the label.' },
  { id: 'user',   name: 'Yours',        blurb: 'Images and video from this phone.' },
];

/* -------------------------------------------------------------- ringtones  */

/**
 * Ringtones are described, not shipped: `synth` is a tiny score the mock media
 * service renders with WebAudio so previews genuinely play in the browser demo.
 * On Android these ids map to bundled audio files instead — the UI is unchanged
 * because it only ever sees {id, name, pack, durationSec}.
 */
const rt = (id, name, pack, durationSec, synth, isDefault = false) => ({
  id: `rt_${id}`, type: 'audio', source: pack === 'kode31' ? 'kode31' : 'builtin',
  category: 'ringtone', pack, name, url: null, durationSec, isDefault,
  metadata: { synth },
});

export const RINGTONES = [
  rt('dialr_default', 'DIALR',      'dialr',  4.0, { wave: 'sine',     notes: [659, 0, 659, 0, 784, 0, 659, 0], tempo: 320, gain: 0.16 }, true),
  rt('pulse',         'Pulse',      'dialr',  3.2, { wave: 'triangle', notes: [440, 440, 0, 440, 0, 0], tempo: 260, gain: 0.14 }),
  rt('low',           'Low',        'dialr',  4.0, { wave: 'sine',     notes: [196, 0, 220, 0, 196, 0], tempo: 420, gain: 0.20 }),
  rt('glass',         'Glass',      'dialr',  3.6, { wave: 'sine',     notes: [1046, 0, 1318, 0, 1568, 0, 0, 0], tempo: 220, gain: 0.10 }),
  rt('k31_pulse',     'K31 Pulse',  'kode31', 4.4, { wave: 'square',   notes: [110, 0, 110, 165, 0, 110, 0, 0], tempo: 200, gain: 0.09 }),
  rt('k31_signal',    'K31 Signal', 'kode31', 4.0, { wave: 'sawtooth', notes: [330, 392, 0, 330, 262, 0], tempo: 240, gain: 0.07 }),
  rt('silent',        'Silent',     'dialr',  0.0, null),
];

/* --------------------------------------------------------- call sound FX  */

export const CALL_SOUNDS = [
  { id: 'sfx_connect', name: 'Connect',   synth: { wave: 'sine', notes: [880, 1320], tempo: 90,  gain: 0.06 } },
  { id: 'sfx_end',     name: 'End',       synth: { wave: 'sine', notes: [520, 392],  tempo: 110, gain: 0.06 } },
  { id: 'sfx_key',     name: 'Keypress',  synth: { wave: 'sine', notes: [1200],      tempo: 40,  gain: 0.03 } },
];

/** DTMF pairs, so the keypad sounds like a phone rather than a UI. */
export const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477],
  4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477],
  '*': [941, 1209], 0: [941, 1336], '#': [941, 1477],
};

export const findMedia = (id) =>
  WALLPAPERS.find((m) => m.id === id) || RINGTONES.find((m) => m.id === id) || null;

export const wallpapersByPack = (pack) => WALLPAPERS.filter((w) => w.pack === pack);
