/**
 * DIALR — icon set.
 *
 * Inline SVG, single stroke weight, 24×24 grid, round caps. Icons are geometry
 * only: they never carry colour, so a themed accent flows through by
 * inheritance (`stroke="currentColor"`).
 *
 * Filled variants exist only for the two call actions — answer and decline —
 * because those must read as solid targets, not outlines, at a glance.
 */

const S = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra ? ' ' + extra : ''}>${d}</svg>`;

const F = (d) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${d}</svg>`;

const PHONE_PATH = 'M6.6 3.5h2.2l1.5 3.7-1.9 1.4a12.5 12.5 0 0 0 5 5l1.4-1.9 3.7 1.5v2.2a2.1 2.1 0 0 1-2.3 2.1A16.6 16.6 0 0 1 4.5 5.8 2.1 2.1 0 0 1 6.6 3.5Z';

export const ICONS = {
  /* navigation ------------------------------------------------------------ */
  keypad:  S('<circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/>'),
  clock:   S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2v5l3.2 1.9"/>'),
  people:  S('<circle cx="9" cy="8.5" r="3.3"/><path d="M2.9 19.4a6.3 6.3 0 0 1 12.2 0"/><path d="M16.4 6.1a3.3 3.3 0 0 1 0 6.3"/><path d="M17.6 14.2a6.3 6.3 0 0 1 3.6 5.2"/>'),
  person:  S('<circle cx="12" cy="8.3" r="3.7"/><path d="M4.8 20.1a7.4 7.4 0 0 1 14.4 0"/>'),

  /* calling --------------------------------------------------------------- */
  phone:      S(`<path d="${PHONE_PATH}"/>`),
  phoneFill:  F(`<path d="${PHONE_PATH}"/>`),
  phoneDown:  F('<path d="M12 9.2c-2.7 0-5.3.6-7.6 1.7L3 13.5a1.4 1.4 0 0 0 .5 1.9l2.3 1.3a1.4 1.4 0 0 0 1.8-.4l1.2-1.6c1-.3 2.1-.5 3.2-.5s2.2.2 3.2.5l1.2 1.6a1.4 1.4 0 0 0 1.8.4l2.3-1.3a1.4 1.4 0 0 0 .5-1.9l-1.4-2.6A18.6 18.6 0 0 0 12 9.2Z"/>'),
  phoneMissed:S(`<path d="${PHONE_PATH}"/><path d="M15.5 3.5 21 9M21 3.5 15.5 9"/>`),
  redial:     S('<path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1"/><path d="M3.2 18.4v-4.6h4.6"/>'),
  micOff:     S('<path d="M9.2 5.2A2.8 2.8 0 0 1 14.8 6v3.6"/><path d="M14.8 13.4A2.8 2.8 0 0 1 9.2 12V8.6"/><path d="M5.4 11.4a6.6 6.6 0 0 0 9.6 5.9M18.6 11.4a6.6 6.6 0 0 1-.6 2.7"/><path d="M12 18.4V21"/><path d="M3.5 3.5 20.5 20.5"/>'),
  mic:        S('<rect x="9.2" y="3" width="5.6" height="11" rx="2.8"/><path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0M12 18.4V21"/>'),
  speaker:    S('<path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4Z"/><path d="M15.8 9.2a3.9 3.9 0 0 1 0 5.6M18.4 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
  earpiece:   S('<path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4Z"/><path d="M15.8 9.4a3.7 3.7 0 0 1 0 5.2"/>'),
  bluetooth:  S('<path d="m7.4 7.4 9.2 9.2L12 21V3l4.6 4.4-9.2 9.2"/>'),
  pause:      S('<path d="M9.2 5v14M14.8 5v14"/>'),
  play:       S('<path d="M7.5 4.8 18.6 12 7.5 19.2Z"/>'),
  merge:      S('<path d="M12 21V11"/><path d="M5.5 3.5 12 10l6.5-6.5"/><path d="M5.5 8.5 12 15l6.5-6.5"/>'),
  swap:       S('<path d="M4 8.5h13l-3.4-3.4M20 15.5H7l3.4 3.4"/>'),
  addCall:    S(`<path d="${PHONE_PATH}"/><path d="M18 3.2v5.4M15.3 5.9h5.4"/>`),
  grid:       S('<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>'),

  /* messaging ------------------------------------------------------------- */
  message:  S('<path d="M20.5 12.4c0 4.1-3.8 7.4-8.5 7.4a9.7 9.7 0 0 1-2.9-.4L4 21l1.4-3.9a7 7 0 0 1-1.9-4.7C3.5 8.3 7.3 5 12 5s8.5 3.3 8.5 7.4Z"/>'),
  dots:     S('<path d="M20.5 12.4c0 4.1-3.8 7.4-8.5 7.4a9.7 9.7 0 0 1-2.9-.4L4 21l1.4-3.9a7 7 0 0 1-1.9-4.7C3.5 8.3 7.3 5 12 5s8.5 3.3 8.5 7.4Z"/><circle cx="8.6" cy="12.4" r=".9" fill="currentColor" stroke="none"/><circle cx="12" cy="12.4" r=".9" fill="currentColor" stroke="none"/><circle cx="15.4" cy="12.4" r=".9" fill="currentColor" stroke="none"/>'),
  whatsapp: S('<path d="M3.4 20.6 4.9 16A8.2 8.2 0 1 1 8 19.1Z"/><path d="M8.9 9c.2 1.6 2.6 4.3 4.4 4.9.6.2 1.1-.1 1.4-.6l1.1.7c-.3.9-1.3 1.4-2.3 1.2-2.6-.5-5.4-3.4-6-6-.2-1 .3-2 1.2-2.3l.7 1.1c-.5.3-.6.7-.5 1Z"/>'),
  note:     S('<path d="M5.5 4.4h13v15.2H5.5z"/><path d="M8.6 9h6.8M8.6 12.4h6.8M8.6 15.8h4"/>'),
  bell:     S('<path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.6 1.4 5.6H5s1.4-1.6 1.4-5.6Z"/><path d="M10.2 19.2a2 2 0 0 0 3.6 0"/>'),

  /* actions --------------------------------------------------------------- */
  plus:      S('<path d="M12 4.6v14.8M4.6 12h14.8"/>'),
  minus:     S('<path d="M4.6 12h14.8"/>'),
  close:     S('<path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4"/>'),
  check:     S('<path d="M4.8 12.6 9.6 17.4 19.2 6.6"/>'),
  back:      S('<path d="M19 12H5M11 5.6 4.6 12l6.4 6.4"/>'),
  chevronR:  S('<path d="m9.4 5.6 6.4 6.4-6.4 6.4"/>'),
  chevronD:  S('<path d="m5.6 9.4 6.4 6.4 6.4-6.4"/>'),
  chevronU:  S('<path d="m5.6 14.6 6.4-6.4 6.4 6.4"/>'),
  search:    S('<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.4 15.4 4.4 4.4"/>'),
  edit:      S('<path d="M4.5 19.5h3.9L19 8.9a1.9 1.9 0 0 0 0-2.7l-1.2-1.2a1.9 1.9 0 0 0-2.7 0L4.5 15.6Z"/><path d="m14.2 6 3.8 3.8"/>'),
  trash:     S('<path d="M4.8 6.6h14.4M9.4 6.6V4.4h5.2v2.2M6.6 6.6l.9 12.2a1.4 1.4 0 0 0 1.4 1.3h6.2a1.4 1.4 0 0 0 1.4-1.3l.9-12.2"/>'),
  share:     S('<path d="M12 15.4V4"/><path d="M8.2 7.4 12 3.6l3.8 3.8"/><path d="M5 13.2v5.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-5.4"/>'),
  copy:      S('<rect x="8.4" y="8.4" width="11.2" height="11.2" rx="2"/><path d="M15.6 5.4a2 2 0 0 0-2-2H6.4a3 3 0 0 0-3 3v7.2a2 2 0 0 0 2 2"/>'),
  more:      S('<circle cx="5.4" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18.6" cy="12" r="1.5"/>'),
  filter:    S('<path d="M3.8 6.2h16.4M6.8 12h10.4M10 17.8h4"/>'),
  refresh:   S('<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.4 4v4.6h-4.6"/>'),
  external:  S('<path d="M14 4.6h5.4V10"/><path d="M19.4 4.6 11 13"/><path d="M18.2 14.2v4.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.6V8a1.8 1.8 0 0 1 1.8-1.8h4.4"/>'),
  return:    S('<path d="M4 9.5h11.5a4.5 4.5 0 1 1 0 9H9"/><path d="M7.6 5.6 3.7 9.5l3.9 3.9"/>'),

  /* status ---------------------------------------------------------------- */
  star:      S('<path d="m12 4 2.5 5.1 5.6.8-4 4 .9 5.6L12 16.9 6.9 19.5l1-5.6-4-4 5.6-.8Z"/>'),
  starFill:  F('<path d="m12 3.4 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.8l6-.9Z"/>'),
  block:     S('<circle cx="12" cy="12" r="8.4"/><path d="m6.1 6.1 11.8 11.8"/>'),
  shield:    S('<path d="M12 3.4 5 6v6c0 4 3 7.2 7 8.6 4-1.4 7-4.6 7-8.6V6Z"/>'),
  shieldOk:  S('<path d="M12 3.4 5 6v6c0 4 3 7.2 7 8.6 4-1.4 7-4.6 7-8.6V6Z"/><path d="m8.8 12 2.3 2.3 4.1-4.6"/>'),
  warn:      S('<path d="M12 4.2 21 19.8H3Z"/><path d="M12 9.8v4.2M12 16.9v.1"/>'),
  spark:     S('<path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2l-1.7-5.8L4.5 10.7 10.3 9Z"/><path d="M18.6 15.6l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7Z"/>'),
  lock:      S('<rect x="4.8" y="10.2" width="14.4" height="9.6" rx="2.2"/><path d="M8.2 10.2V7.6a3.8 3.8 0 0 1 7.6 0v2.6"/>'),
  info:      S('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.4M12 7.8v.1"/>'),
  gear:      S('<circle cx="12" cy="12" r="3"/><path d="M19.6 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z"/>'),
  palette:   S('<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2.1a4 4 0 0 0 3.8-4c0-4-3.8-7-8.5-7Z"/><circle cx="7.6" cy="11.4" r="1.1"/><circle cx="10.6" cy="7.4" r="1.1"/><circle cx="15.4" cy="8.2" r="1.1"/>'),
  wave:      S('<path d="M3.5 12h2.2M8 6.4v11.2M12 3.6v16.8M16 8.2v7.6M20.5 12h-.2"/>'),
  access:    S('<circle cx="12" cy="5.2" r="1.8"/><path d="M4.6 9.2 12 10.8l7.4-1.6"/><path d="M12 10.8v4.4l-2.4 5M12 15.2l2.4 5"/>'),
  sim:       S('<path d="M6 3.6h7.4L18 8.2v12.2H6Z"/><rect x="9" y="11.4" width="6" height="5.6" rx="1.2"/>'),
  mapPin:    S('<path d="M12 21s6.5-5.6 6.5-10.2a6.5 6.5 0 0 0-13 0C5.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.6" r="2.4"/>'),
  video:     S('<rect x="3.2" y="6.4" width="12.6" height="11.2" rx="2.4"/><path d="m15.8 11 5-2.8v7.6l-5-2.8Z"/>'),
  image:     S('<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="2.4"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="m4 16.6 4.6-4 4 3.4 3.2-2.6 4.2 3.6"/>'),
  upload:    S('<path d="M12 16V4.6"/><path d="M7.8 8.8 12 4.6l4.2 4.2"/><path d="M4.6 15.4v3.2a1.8 1.8 0 0 0 1.8 1.8h11.2a1.8 1.8 0 0 0 1.8-1.8v-3.2"/>'),
  sun:       S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>'),
  moon:      S('<path d="M20 14.4A8.6 8.6 0 0 1 9.6 4 8.6 8.6 0 1 0 20 14.4Z"/>'),
  contrast:  S('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/>'),
  drag:      S('<path d="M8 7h8M8 12h8M8 17h8"/>'),

  /* links ----------------------------------------------------------------- */
  mail:      S('<rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2.4"/><path d="m3.8 7.4 8.2 5.6 8.2-5.6"/>'),
  globe:     S('<circle cx="12" cy="12" r="8.5"/><path d="M3.6 12h16.8"/><path d="M12 3.5a13 13 0 0 1 0 17 13 13 0 0 1 0-17Z"/>'),
  instagram: S('<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/>'),
  telegram:  S('<path d="M20.6 4.4 3.8 11l4.6 1.6 1.7 5.4 2.6-3 4 3 3.9-13.6Z"/><path d="m8.4 12.6 9.4-6.6-5.1 8"/>'),
  x:         S('<path d="M4.4 4.4h3.4l11.8 15.2h-3.4Z"/><path d="M4.8 19.6 10.4 13M13.8 10.6 19.4 4.4"/>'),
  youtube:   S('<rect x="3" y="6" width="18" height="12" rx="3.6"/><path d="m10.4 9.4 5 2.6-5 2.6Z"/>'),
  linkedin:  S('<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="3"/><path d="M8 10.6v6M8 7.6v.1M12 16.6v-3.4a2 2 0 0 1 4 0v3.4M12 10.6v6"/>'),
  snapchat:  S('<path d="M12 3.6c2.8 0 4.2 2 4.2 4.6 0 1 0 1.8-.2 2.4.8.4 1.6.2 2 .6.4.6-.6 1.4-2 2 .4 1.6 2 2.6 3.4 2.8.4 0 .4.6 0 .8-1 .4-2 .4-2.4.8-.2.4-.2 1-.8 1-.8 0-1.6-.4-2.6-.4-1.4 0-2 1.4-3.6 1.4s-2.2-1.4-3.6-1.4c-1 0-1.8.4-2.6.4-.6 0-.6-.6-.8-1-.4-.4-1.4-.4-2.4-.8-.4-.2-.4-.8 0-.8 1.4-.2 3-1.2 3.4-2.8-1.4-.6-2.4-1.4-2-2 .4-.4 1.2-.2 2-.6-.2-.6-.2-1.4-.2-2.4C7.8 5.6 9.2 3.6 12 3.6Z"/>'),
  link:      S('<path d="M10.2 13.8a3.8 3.8 0 0 0 5.4 0l2.8-2.8a3.8 3.8 0 0 0-5.4-5.4l-1.4 1.4"/><path d="M13.8 10.2a3.8 3.8 0 0 0-5.4 0l-2.8 2.8a3.8 3.8 0 0 0 5.4 5.4l1.4-1.4"/>'),
};

/** Link-type -> icon, so ProfileLinks stays declarative. */
export const LINK_ICONS = {
  whatsapp: 'whatsapp', email: 'mail', website: 'globe', instagram: 'instagram',
  snapchat: 'snapchat', telegram: 'telegram', youtube: 'youtube', x: 'x',
  linkedin: 'linkedin', custom: 'link',
};

export const LINK_LABELS = {
  whatsapp: 'WhatsApp', email: 'Email', website: 'Website', instagram: 'Instagram',
  snapchat: 'Snapchat', telegram: 'Telegram', youtube: 'YouTube', x: 'X',
  linkedin: 'LinkedIn', custom: 'Link',
};

export const LINK_TYPES = Object.keys(LINK_ICONS);

/** @returns {string} trusted inline SVG markup — pass to h(..., {html}) */
export function icon(name) {
  return ICONS[name] || ICONS.info;
}
