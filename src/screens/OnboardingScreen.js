/**
 * DIALR — first launch.
 *
 * The brief's hardest constraint: install, type a name, grant permissions, make
 * a call. No Gmail, no social login, no account. So this is three steps and the
 * last two are skippable.
 *
 *   1  Your name          — the only required input, and only because a dialer
 *                           that greets you by number is a bad first impression
 *   2  Permissions        — explained BEFORE the system dialog, in one sentence
 *                           each, because a blocked permission is expensive
 *   3  Look               — pick a wallpaper, or don't
 *
 * Everything else (photo, bio, links, squad) is offered later, in context.
 */
import { h, setText, toggle, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { Button } from '../components/primitives/Button.js';
import { WALLPAPERS } from '../data/media.js';
import { paletteFromMeta } from '../theme/palette.js';
import haptics from '../core/haptics.js';

const PERMISSION_COPY = [
  { id: 'contacts', icon: 'people', title: 'Your contacts', body: 'So calls show names, not numbers. They stay on this phone.' },
  { id: 'log',      icon: 'clock',  title: 'Your call history', body: 'So Recents, History and Rewind have something to show.' },
  { id: 'phone',    icon: 'phone',  title: 'Making and answering calls', body: 'The part that makes DIALR a phone.' },
  { id: 'notify',   icon: 'bell',   title: 'Notifications', body: 'For incoming calls, missed calls and callback reminders.' },
];

export function OnboardingScreen({ store, actions }) {
  let step = 0;
  let first = '';
  let last = '';
  let chosenWallpaper = 'wp_deep-green';

  const stepDots = h('div.onb__dots');
  const stage = h('div.onb__stage');
  const footer = h('div.onb__footer');

  const el = h('section.screen.screen--onboarding.is-active', { id: 'screen-onboarding' },
    h('div.onb', null,
      h('div.onb__brand.t-screen-title', { text: 'DIALR' }),
      stepDots, stage, footer));

  function renderDots() {
    stepDots.textContent = '';
    for (let i = 0; i < 3; i++) {
      stepDots.appendChild(h('span.onb__dot', { dataset: { state: i < step ? 'done' : i === step ? 'active' : 'todo' } }));
    }
  }

  /* ------------------------------------------------------------- step 1 -- */
  function renderName() {
    stage.textContent = '';
    const firstInput = h('input.onb__input.t-display-m', {
      type: 'text', placeholder: 'First name', value: first,
      autocomplete: 'given-name', enterkeyhint: 'next',
      aria: { label: 'First name' },
      on: { input: (e) => { first = e.target.value; syncFooter(); } },
    });
    const lastInput = h('input.onb__input.onb__input--sub.t-title', {
      type: 'text', placeholder: 'Surname (optional)', value: last,
      autocomplete: 'family-name', enterkeyhint: 'done',
      aria: { label: 'Surname, optional' },
      on: { input: (e) => { last = e.target.value; } },
    });

    stage.appendChild(h('div.onb__step', null,
      h('p.onb__lead.t-title-lg.u-balance', { text: 'What should DIALR call you?' }),
      h('p.onb__sub.t-body-sm.c-3', { text: 'That is the whole sign-up. No account, no email.' }),
      firstInput,
      h('div.rule.rule--full'),
      lastInput));

    setTimeout(() => firstInput.focus(), 260);
  }

  /* ------------------------------------------------------------- step 2 -- */
  function renderPermissions() {
    stage.textContent = '';
    const list = h('div.onb__perms');
    for (const p of PERMISSION_COPY) {
      list.appendChild(h('div.onb__perm', null,
        h('span.onb__perm-icon', { html: icon(p.icon) }),
        h('span.col.grow', null,
          h('span.t-body', { text: p.title }),
          h('span.t-caption', { text: p.body }))));
    }
    stage.appendChild(h('div.onb__step', null,
      h('p.onb__lead.t-title-lg.u-balance', { text: `Nice to meet you, ${first || 'there'}.` }),
      h('p.onb__sub.t-body-sm.c-3', { text: 'To work as your phone app, DIALR needs four things. Android will ask next.' }),
      list));
  }

  /* ------------------------------------------------------------- step 3 -- */
  function renderLook() {
    stage.textContent = '';
    const grid = h('div.onb__wallpapers');
    for (const w of WALLPAPERS.filter((x) => x.pack === 'dialr').slice(0, 8)) {
      grid.appendChild(h('button.onb__wallpaper', {
        type: 'button',
        dataset: { selected: String(w.id === chosenWallpaper) },
        aria: { label: w.name, pressed: String(w.id === chosenWallpaper) },
        style: { backgroundImage: `url("${w.thumbnail}")` },
        on: {
          click: () => {
            haptics.fire('select');
            chosenWallpaper = w.id;
            actions.previewTheme(w, paletteFromMeta(w.palette));
            renderLook();
          },
        },
      }, h('span.onb__wallpaper-name.t-micro', { text: w.name })));
    }
    stage.appendChild(h('div.onb__step', null,
      h('p.onb__lead.t-title-lg.u-balance', { text: 'Pick a look.' }),
      h('p.onb__sub.t-body-sm.c-3', { text: 'DIALR stays black and white. The wallpaper only lends it an accent — you can change all of this later.' }),
      grid));
  }

  /* -------------------------------------------------------------- footer -- */
  const nextBtn = Button({ label: 'Continue', variant: 'primary', block: true, onClick: () => advance() });
  const skipBtn = h('button.onb__skip.t-label', { type: 'button', text: 'Skip',
    on: { click: () => advance(true) } });

  footer.appendChild(nextBtn.el);
  footer.appendChild(skipBtn);

  function syncFooter() {
    const canGo = step !== 0 || first.trim().length > 0;
    nextBtn.update({
      disabled: !canGo,
      label: step === 0 ? 'Continue' : step === 1 ? 'Allow access' : 'Start calling',
    });
    toggle(skipBtn, 'is-hidden', step === 0);
  }

  async function advance(skipped = false) {
    haptics.fire('tap');
    if (step === 0) { step = 1; }
    else if (step === 1) {
      if (!skipped) await actions.requestPermissions();
      step = 2;
    } else {
      actions.finishOnboarding({
        firstName: first.trim(),
        surname: last.trim(),
        wallpaperId: chosenWallpaper,
      });
      return;
    }
    render();
  }

  function render() {
    renderDots();
    if (step === 0) renderName();
    else if (step === 1) renderPermissions();
    else renderLook();
    syncFooter();
  }

  render();

  return { el, update() {}, destroy() {} };
}
