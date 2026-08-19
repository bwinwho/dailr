/**
 * DIALR — UI defect audit.
 *
 * Measures rather than eyeballs. Reports:
 *   1. LAYOUT SHIFT   does the keypad move while you type?
 *   2. TRUNCATION     which text is actively clipped to an ellipsis?
 *   3. OVERLAP        which visible elements sit on top of each other?
 *   4. TARGETS        which interactive elements are under 48px?
 *   5. DENSITY        vertical rhythm between sibling blocks
 *
 * Runs at TWO viewports — 412×900 and 360×640 — because a short/narrow device
 * is where the enlarged dialer keypad (Project Clean Slate, Phase 3) is most
 * likely to overflow, and a single wide viewport can't see that.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = process.argv[2] || '/tmp/claude-0/-home-user-dailr/5159420a-1ffc-54c9-a67e-e78e8a97e22f/scratchpad/audit';
mkdirSync(OUT, { recursive: true });

const TOUCH_MIN = 48;
const VIEWPORTS = [
  { width: 412, height: 900, label: '412x900' },
  { width: 360, height: 640, label: '360x640' },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

for (const vp of VIEWPORTS) {
  await runAudit(vp);
}
await browser.close();

async function runAudit(vp) {
  const OUT_VP = `${OUT}/${vp.label}`;
  mkdirSync(OUT_VP, { recursive: true });

  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();

  const report = [];
  const log = (s) => { console.log(s); report.push(s); };

  log(`════════════════════════════════════════════════════════════`);
  log(`  VIEWPORT ${vp.label}`);
  log(`════════════════════════════════════════════════════════════`);

  // Seed "already onboarded" + granted permissions so the audit lands straight
  // on the real product surfaces. Onboarding is audited separately.
  await page.addInitScript(() => {
    localStorage.setItem('dialr:onboarded', JSON.stringify({ firstName: 'Bwin', at: Date.now() }));
  });
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  await page.waitForSelector('.dialpad', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => window.dialrApp.actions.requestPermissions());
  await page.waitForTimeout(1400);

  /* ============================ 1. LAYOUT SHIFT ============================ */
  log('\n════════ 1. DIALER LAYOUT SHIFT ════════');

  const keypadTop = () => page.evaluate(() => {
    const el = document.querySelector('.dialpad');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  });
  const numTop = () => page.evaluate(() => {
    const el = document.querySelector('.numdisp');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.round(r.top);
  });

  const shifts = [];
  let prev = await keypadTop();
  let prevNum = await numTop();
  shifts.push({ typed: '(empty)', keypadTop: prev.top, numTop: prevNum, delta: 0 });

  for (const d of ['9', '0', '0', '1', '1', '2']) {
    await page.click(`.dialpad__key[data-key="${d}"]`);
    await page.waitForTimeout(280);
    const now = await keypadTop();
    const nowNum = await numTop();
    shifts.push({
      typed: (shifts[shifts.length - 1].typed === '(empty)' ? '' : shifts[shifts.length - 1].typed) + d,
      keypadTop: now.top, numTop: nowNum,
      delta: now.top - prev.top,
    });
    prev = now; prevNum = nowNum;
  }

  let totalShift = 0;
  for (const s of shifts) {
    totalShift += Math.abs(s.delta);
    const flag = Math.abs(s.delta) > 2 ? `  ⚠ MOVED ${s.delta > 0 ? '+' : ''}${s.delta}px` : '';
    log(`  after "${s.typed.padEnd(8)}"  keypad top=${String(s.keypadTop).padStart(4)}  readout top=${String(s.numTop).padStart(4)}${flag}`);
  }
  log(`  TOTAL keypad movement while typing 6 digits: ${totalShift}px`);
  await page.screenshot({ path: `${OUT_VP}/shift-typed.png` });

  // reset
  for (let i = 0; i < 6; i++) { await page.click('.dialer__back'); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);

  /* ============================ 2. TRUNCATION ============================== */
  /** Real visibility: excludes inactive tabs (opacity 0 / visibility hidden). */
  const VIS = `(el) => el.checkVisibility
    ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
    : !!el.offsetParent`;

  const truncationProbe = () => page.evaluate(`(() => {
    const visible = ${VIS};
    const out = [];
    for (const el of document.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      // Only leaf text nodes deliberately set to ellipsis — container overflow
      // (used for swipe affordances) is not truncation.
      if (cs.textOverflow !== 'ellipsis') continue;
      if (cs.whiteSpace !== 'nowrap') continue;
      if (el.children.length > 0) continue;
      const txt = el.textContent?.trim();
      if (!txt) continue;
      if (el.scrollWidth <= el.clientWidth + 1) continue;
      out.push({
        cls: el.className?.toString().slice(0, 46),
        text: txt.slice(0, 40),
        shown: Math.round(el.clientWidth),
        needs: Math.round(el.scrollWidth),
      });
    }
    return out;
  })()`);

  const overlapProbe = () => page.evaluate(`(() => {
    const visible = ${VIS};
    const out = [];
    const cand = [...document.querySelectorAll('.rcard, .crow, .chip, .hentry, .hentry__note, .field, .settings__section, .dsug, .you__shortcut, .csheet__action, .profile__bio-line, .profile__stat')]
      .filter(visible);
    for (let i = 0; i < cand.length; i++) {
      for (let j = i + 1; j < cand.length; j++) {
        const a = cand[i], b = cand[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        if (ra.width < 4 || rb.width < 4) continue;
        const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (ox > 3 && oy > 3) {
          out.push({
            a: a.className.toString().slice(0, 30), b: b.className.toString().slice(0, 30),
            overlap: Math.round(ox) + 'x' + Math.round(oy) + 'px',
          });
        }
      }
    }
    return out.slice(0, 12);
  })()`);

  const targetProbe = () => page.evaluate(`(() => {
    const visible = ${VIS};
    const out = [];
    for (const el of document.querySelectorAll('button, [role="button"], input, a')) {
      if (!visible(el)) continue;
      if (el.closest('.contacts__index')) continue;   // accepted exception — see docs
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.height < ${TOUCH_MIN} || r.width < ${TOUCH_MIN}) {
        out.push({
          cls: el.className?.toString().slice(0, 40),
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24),
          size: Math.round(r.width) + 'x' + Math.round(r.height),
        });
      }
    }
    return out.slice(0, 14);
  })()`);

  async function auditScreen(name) {
    await page.waitForTimeout(450);
    await page.screenshot({ path: `${OUT_VP}/${name}.png` });
    const trunc = await truncationProbe();
    const over = await overlapProbe();
    const targets = await targetProbe();
    log(`\n──────── ${name} ────────`);
    if (trunc.length) {
      log(`  TRUNCATED (${trunc.length}):`);
      for (const t of trunc.slice(0, 8)) log(`    "${t.text}" — showing ${t.shown}px of ${t.needs}px  [${t.cls}]`);
    } else log('  truncation: none');
    if (over.length) {
      log(`  OVERLAPPING (${over.length}):`);
      for (const o of over.slice(0, 6)) log(`    ${o.a}  ×  ${o.b}  → ${o.overlap}`);
    } else log('  overlap: none');
    if (targets.length) {
      log(`  SMALL TARGETS (${targets.length}):`);
      for (const t of targets.slice(0, 8)) log(`    ${t.size}  "${t.label}"  [${t.cls}]`);
    } else log(`  touch targets: all ≥${TOUCH_MIN}px`);
  }

  log('\n════════ 2-4. PER-SCREEN DEFECTS ════════');

  await auditScreen('dialer-empty');

  await page.click('.dock__nav-item[data-id="recents"]');
  await auditScreen('recents');

  await page.click('.rcard');
  await auditScreen('recents-expanded');

  await page.click('.rcard__link:has-text("History")');
  await auditScreen('history');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.click('.dock__nav-item[data-id="contacts"]');
  await auditScreen('contacts');

  await page.click('.crow:has-text("Mr. Prasad")').catch(() => page.click('.crow'));
  await auditScreen('contact-sheet');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.click('.dock__nav-item[data-id="you"]');
  await auditScreen('you');

  await page.click('.you__shortcut:has-text("All settings")');
  await auditScreen('settings');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.evaluate(() => window.dialrApp.actions.demoIncoming('+919886554433'));
  await auditScreen('incoming-longname');
  await page.click('.callbtn--answer');
  await page.waitForTimeout(900);
  await auditScreen('active-call');
  await page.click('.callbtn--decline');
  await page.waitForTimeout(1200);
  await auditScreen('post-call');

  /* ============================ 5. DENSITY ================================ */
  log('\n════════ 5. VERTICAL RHYTHM (recents) ════════');
  await page.evaluate(() => window.dialrApp.actions.setTab('recents'));
  await page.waitForTimeout(500);
  const rhythm = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.rcard')].filter((e) => e.offsetParent).slice(0, 4);
    const out = [];
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      const inner = cards[i].querySelector('.rcard__id');
      const ir = inner?.getBoundingClientRect();
      out.push({
        i, height: Math.round(r.height),
        gapToNext: cards[i + 1] ? Math.round(cards[i + 1].getBoundingClientRect().top - r.bottom) : null,
        padTop: ir ? Math.round(ir.top - r.top) : null,
        nameSize: getComputedStyle(cards[i].querySelector('.rcard__name')).fontSize,
      });
    }
    return out;
  });
  for (const r of rhythm) {
    log(`  card ${r.i}: height ${r.height}px · inner pad ${r.padTop}px · gap to next ${r.gapToNext}px · name ${r.nameSize}`);
  }

  writeFileSync(`${OUT_VP}/report.txt`, report.join('\n'));
  log(`\nreport → ${OUT_VP}/report.txt`);
  await ctx.close();
}
