/**
 * DIALR — generated avatar imagery.
 *
 * The brief is explicit: "If there is no photo, do not invent one." So there
 * are exactly two kinds of avatar in this app and they look different on
 * purpose:
 *
 *   IDENTITY MARK  initials on a tinted surface. Says "no photo exists".
 *   PHOTO          a real image supplied by the contact / device / profile.
 *
 * For the mock environment we synthesise both as deterministic SVG data URIs
 * so the repo carries no binaries and the demo renders identically every run.
 * A synthesised "photo" is abstract — it never pretends to be a face.
 */

const enc = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/** FNV-1a — stable across reloads and platforms. */
export function hashString(str = '') {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/**
 * Identity mark: initials over a hue derived from the contact key, at a
 * deliberately low chroma so a wall of them stays monochrome-ish.
 */
export function identityMark(name = '?', key = name, size = 200) {
  const initials = String(name).trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  const hue = hashString(key) % 360;
  const a = `hsl(${hue} 16% 22%)`;
  const b = `hsl(${(hue + 40) % 360} 14% 12%)`;
  return enc(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
    `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="${size}" height="${size}" fill="url(#a)"/>` +
    `<text x="50%" y="50%" dy=".35em" text-anchor="middle" fill="rgba(255,255,255,.82)" ` +
    `font-family="Archivo,Roboto,system-ui,sans-serif" font-weight="800" ` +
    `font-size="${Math.round(size * 0.36)}" letter-spacing="${size * 0.01}">${initials}</text>` +
    `</svg>`
  );
}

/**
 * Stand-in "photograph": an abstract composition, never a synthetic face.
 * @param {string} key      stable seed
 * @param {[string,string,string]} [colors] override palette
 */
export function photoStandIn(key, colors, w = 400, h = 400) {
  const seed = hashString(key);
  const hue = colors ? null : seed % 360;
  const c = colors || [
    `hsl(${hue} 42% 46%)`,
    `hsl(${(hue + 34) % 360} 55% 24%)`,
    `hsl(${(hue + 320) % 360} 30% 12%)`,
  ];
  const r = (n, mod) => ((seed >> n) % mod);
  return enc(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">` +
    `<defs>` +
    `<radialGradient id="p0" cx="${25 + r(2, 40)}%" cy="${18 + r(5, 30)}%" r="78%">` +
    `<stop offset="0%" stop-color="${c[0]}"/><stop offset="100%" stop-color="${c[0]}" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="p1" cx="${60 + r(7, 30)}%" cy="${64 + r(11, 28)}%" r="72%">` +
    `<stop offset="0%" stop-color="${c[1]}"/><stop offset="100%" stop-color="${c[1]}" stop-opacity="0"/></radialGradient>` +
    `<filter id="pg"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2"/>` +
    `<feColorMatrix type="saturate" values="0"/>` +
    `<feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer></filter>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${c[2]}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#p0)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#p1)"/>` +
    `<rect width="${w}" height="${h}" filter="url(#pg)" opacity="0.07"/>` +
    `</svg>`
  );
}

/** Tall poster art for the profile / full-bleed call background. */
export const posterStandIn = (key, colors) => photoStandIn(key, colors, 720, 1280);
