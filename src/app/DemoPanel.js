/**
 * DIALR — demo harness.
 *
 * Lets a designer or reviewer reach every state the UI is architected for
 * without a phone: incoming calls of each identity tier, a spam burst, a second
 * call, offline, blocked permissions, a reminder firing.
 *
 * It talks to `services.__mock` deliberately — this panel is the ONE place
 * allowed to reach past the service interface, and it does not exist once the
 * native bridge is supplying those namespaces.
 */
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { mockDb } from '../data/mockDb.js';

export function DemoPanel({ store, actions }) {
  const el = h('div.demo');

  function group(title, items) {
    const wrap = h('section.demo__group', null,
      h('h3.demo__title.t-micro.c-4', { text: title }));
    for (const it of items) {
      wrap.appendChild(h('button.demo__btn', {
        type: 'button',
        on: { click: it.run },
      },
      h('span.demo__btn-icon', { html: icon(it.ic || 'spark') }),
      h('span.col.grow', null,
        h('span.t-body-sm', { text: it.label }),
        it.hint ? h('span.t-caption', { text: it.hint }) : null)));
    }
    el.appendChild(wrap);
  }

  const avni = mockDb.deviceContacts.find((c) => c.firstName === 'Avni');
  const spam = mockDb.strangers[0];
  const unsavedDialr = '+919812345670';

  group('Incoming calls', [
    { ic: 'phone', label: 'Saved contact calls', hint: 'Avni — local name wins over her DIALR profile',
      run: () => actions.demoIncoming(avni.numbers[0].value) },
    { ic: 'person', label: 'DIALR user, not saved', hint: 'Identity falls through to the DIALR profile',
      run: () => actions.demoIncoming(unsavedDialr) },
    { ic: 'info', label: 'Completely unknown number', hint: 'Number only, no invented photo',
      run: () => actions.demoIncoming('+919000012345') },
    { ic: 'shield', label: 'Suspected spam calls', hint: `${spam.category}, ${spam.reports} reports`,
      run: () => actions.demoIncoming(spam.number) },
    { ic: 'addCall', label: 'Second call while on a call', hint: 'Call waiting, swap and merge',
      run: () => actions.demoSecondCall() },
  ]);

  group('Protection', [
    { ic: 'warn', label: 'Trigger repeat-caller prompt', run: () => actions.demoRepeatBurst(spam.number) },
    { ic: 'bell', label: 'Fire a callback reminder now', run: () => actions.demoReminderDue() },
  ]);

  group('Conditions', [
    { ic: 'globe', label: 'Toggle offline', hint: 'Cloud lookups degrade, calling does not',
      run: () => actions.demoToggleOffline() },
    { ic: 'lock', label: 'Revoke permissions', hint: 'Shows the permission gates',
      run: () => actions.demoRevokePermissions() },
    { ic: 'check', label: 'Grant permissions', run: () => actions.requestPermissions() },
    { ic: 'refresh', label: 'Replay onboarding', run: () => actions.demoReplayOnboarding() },
  ]);

  group('Data', [
    { ic: 'trash', label: 'Reset all local DIALR data', hint: 'Settings, theme and private notes',
      run: () => actions.demoWipe() },
  ]);

  return { el, update() {}, destroy() {} };
}
