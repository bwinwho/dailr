/**
 * DIALR — contact editor.
 *
 * Edits the DEVICE contact only. Private relationship data (label, note,
 * pronouns, place) is edited from the contact sheet instead, because it is a
 * different store with a different owner and merging the two forms would blur
 * exactly the boundary the architecture is built to keep.
 */
import { h, toggle } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { TextField } from '../primitives/Field.js';
import { Button } from '../primitives/Button.js';
import { normalizeNumber } from '../../core/format.js';

export function ContactEditor({ draft, existing, onSave, onCancel, onDelete }) {
  const state = {
    firstName: existing?.firstName || draft?.firstName || '',
    lastName: existing?.surname || draft?.lastName || '',
    org: existing?.org || '',
    numbers: existing?.numbers?.map((n) => ({ ...n }))
      || [{ value: draft?.number || '', label: 'Mobile', primary: true }],
  };

  const first = TextField({ label: 'First name', value: state.firstName, onChange: (v) => { state.firstName = v; sync(); } });
  const last = TextField({ label: 'Surname', value: state.lastName, onChange: (v) => { state.lastName = v; } });
  const org = TextField({ label: 'Company', value: state.org, onChange: (v) => { state.org = v; } });

  const numberList = h('div.ceditor__numbers');

  function renderNumbers() {
    numberList.textContent = '';
    state.numbers.forEach((n, i) => {
      const row = h('div.ceditor__number', null,
        h('input.ceditor__number-input.t-num', {
          type: 'tel', value: n.value, placeholder: 'Phone number',
          aria: { label: `Number ${i + 1}` },
          on: { input: (e) => { n.value = normalizeNumber(e.target.value); sync(); } },
        }),
        h('select.ceditor__label', {
          aria: { label: 'Number type' },
          on: { change: (e) => { n.label = e.target.value; } },
        }, ...['Mobile', 'Home', 'Work', 'Other'].map((l) =>
          h('option', { value: l, selected: n.label === l, text: l }))),
        state.numbers.length > 1
          ? h('button.ceditor__remove', {
              type: 'button', aria: { label: 'Remove number' }, html: icon('minus'),
              on: { click: () => { state.numbers.splice(i, 1); renderNumbers(); sync(); } },
            })
          : null);
      numberList.appendChild(row);
    });
    numberList.appendChild(h('button.ceditor__add.t-label', {
      type: 'button',
      on: { click: () => { state.numbers.push({ value: '', label: 'Home', primary: false }); renderNumbers(); } },
    }, h('span', { html: icon('plus') }), h('span', { text: 'Add another number' })));
  }

  const save = Button({
    label: existing ? 'Save changes' : 'Save contact', variant: 'primary', block: true,
    onClick: () => onSave?.({
      firstName: state.firstName.trim(),
      lastName: state.lastName.trim(),
      org: state.org.trim() || null,
      numbers: state.numbers.filter((n) => normalizeNumber(n.value)),
    }),
  });

  const cancel = Button({ label: 'Cancel', variant: 'ghost', block: true, onClick: () => onCancel?.() });
  const del = onDelete ? Button({ label: 'Delete contact', variant: 'danger', block: true, onClick: onDelete }) : null;

  function sync() {
    const ok = state.firstName.trim().length > 0 && state.numbers.some((n) => normalizeNumber(n.value).length >= 3);
    save.update({ disabled: !ok });
  }

  const el = h('div.ceditor', null,
    first.el, last.el, org.el,
    h('h3.csheet__group-title.t-micro.c-4', { text: 'Numbers' }),
    numberList,
    h('div.ceditor__foot', null, save.el, cancel.el, del?.el || null));

  renderNumbers();
  sync();

  return { el, update() {}, destroy() {} };
}
