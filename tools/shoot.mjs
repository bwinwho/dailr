/**
 * Screenshot + console-error harness. Drives the running app through a
 * scripted tour so regressions are visible, not inferred.
 *   node tools/shoot.mjs [outdir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/claude-0/-home-user-dailr/5159420a-1ffc-54c9-a67e-e78e8a97e22f/scratchpad/shots';
mkdirSync(OUT, { recursive: true });
const URL_BASE = 'http://localhost:4173/';

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 900 },
  deviceScaleFactor: 2,
  isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => {
  const u = r.url();
  if (u.includes('fonts.g')) return;              // offline font fetch is expected
  problems.push(`requestfailed: ${u} — ${r.failure()?.errorText}`);
});

const shot = async (name) => { await page.waitForTimeout(420); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('  •', name); };

await page.goto(URL_BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

console.log('tour:');
await shot('01-onboarding-name');

await page.fill('.onb__input', 'Bwin');
await page.click('.onb__footer .btn--primary');
await shot('02-onboarding-permissions');
await page.click('.onb__footer .btn--primary');
await page.waitForTimeout(700);
await shot('03-onboarding-look');
await page.click('.onb__footer .btn--primary');
await page.waitForTimeout(900);
await shot('04-dialer-empty');

// type a number that matches Avni by T9 letters
for (const d of ['2', '8', '6', '4']) { await page.click(`.dialpad__key[data-key="${d}"]`); await page.waitForTimeout(90); }
await shot('05-dialer-t9-match');

// clear, then type a real prefix
await page.click('.dialer__back'); await page.click('.dialer__back');
await page.click('.dialer__back'); await page.click('.dialer__back');
for (const d of ['9','8','4','2','0','0','4']) { await page.click(`.dialpad__key[data-key="${d}"]`); await page.waitForTimeout(60); }
await shot('06-dialer-number-match');

await page.click('.dock__nav-item[data-id="recents"]');
await page.waitForTimeout(500);
await shot('07-recents');

await page.click('.rcard');
await page.waitForTimeout(560);
await shot('08-recents-expanded');

await page.click('.rcard__link:has-text("History")');
await page.waitForTimeout(700);
await shot('09-history');

await page.click('.hpanel__rewind');
await page.waitForTimeout(760);
await shot('10-rewind-1');
await page.click('.rewind__stage', { position: { x: 300, y: 400 } });
await page.waitForTimeout(500);
await shot('11-rewind-2');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.click('.dock__nav-item[data-id="contacts"]');
await page.waitForTimeout(500);
await shot('12-contacts');

await page.click('.dock__nav-item[data-id="you"]');
await page.waitForTimeout(600);
await shot('13-you-profile');

await page.click('.you__shortcut:has-text("All settings")');
await page.waitForTimeout(700);
await shot('14-settings-index');
await page.click('.settings__section:has-text("Smart")');
await page.waitForTimeout(450);
await shot('15-settings-smart');
await page.fill('.settings__search-input', 'spam');
await page.waitForTimeout(400);
await shot('16-settings-search');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// wallpaper picker
await page.click('.you__shortcut:has-text("Wallpaper")');
await page.waitForTimeout(700);
await shot('17-wallpaper-picker');
await page.click('.wpick__tile:nth-child(3)');
await page.waitForTimeout(700);
await shot('18-wallpaper-applied');
await page.click('.wpick__int-opt:has-text("Expressive")');
await page.waitForTimeout(600);
await shot('19-intensity-full');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// incoming call via demo panel
await page.evaluate(() => window.dialrApp.actions.demoIncoming('+919842004200'));
await page.waitForTimeout(900);
await shot('20-incoming-saved');
await page.click('.callbtn--answer');
await page.waitForTimeout(1000);
await shot('21-active-call');
await page.click('.iconbtn--call:has-text("Keypad")');
await page.waitForTimeout(500);
await shot('22-active-keypad');
await page.click('.actcall__keypad-hide');
await page.click('.iconbtn--call:has-text("Note")');
await page.waitForTimeout(400);
await page.fill('.actcall__note-input', 'Bring the hard drive');
await shot('23-active-note');
await page.click('.callbtn--decline');
await page.waitForTimeout(1300);
await shot('24-post-call');

// unknown + spam incoming
await page.evaluate(() => window.dialrApp.actions.demoIncoming('+918471002299'));
await page.waitForTimeout(1000);
await shot('25-incoming-spam');
await page.click('.callbtn--decline');
await page.waitForTimeout(900);

await page.evaluate(() => window.dialrApp.actions.demoIncoming('+919812345670'));
await page.waitForTimeout(1000);
await shot('26-incoming-dialr-unsaved');
await page.click('.callbtn--decline');
await page.waitForTimeout(900);

// light mode
await page.evaluate(() => window.dialrApp.actions.setSetting('appearance.mode', 'light'));
await page.waitForTimeout(700);
await page.evaluate(() => window.dialrApp.actions.setTab('recents'));
await page.waitForTimeout(500);
await shot('27-light-recents');

// standard (mono) mode
await page.evaluate(() => { window.dialrApp.actions.setSetting('appearance.mode','dark'); window.dialrApp.actions.setSetting('appearance.profile','standard'); });
await page.waitForTimeout(700);
await shot('28-standard-mono');

console.log(`\n${problems.length} problem(s)`);
problems.slice(0, 40).forEach((p) => console.log('  ✗', p));

await browser.close();
