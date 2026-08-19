/**
 * DIALR — overlay host.
 *
 * Renders the overlay stack from state. One place decides what an overlay
 * *is*, which keeps every sheet consistent: same entrance, same dismissal, same
 * relationship to the dock (it never covers it).
 */
import { h } from '../core/dom.js';
import { Sheet } from '../components/primitives/Sheet.js';
import { HistoryPanel } from '../components/recents/HistoryPanel.js';
import { CheckRewind } from '../components/recents/CheckRewind.js';
import { ContactSheet } from '../components/contacts/ContactSheet.js';
import { ContactEditor } from '../components/contacts/ContactEditor.js';
import { ProfileView } from '../components/profile/ProfileView.js';
import { WallpaperPicker } from '../components/settings/WallpaperPicker.js';
import { RingtonePicker } from '../components/settings/RingtonePicker.js';
import { SettingsPanel } from '../components/settings/SettingsPanel.js';
import { QuickReplySheet, ReminderPicker, SimSelector, RepeatCallerPrompt } from '../components/call/Pickers.js';
import { DemoPanel } from './DemoPanel.js';
import { BridgeStatus } from './BridgeStatus.js';
import { selectContactDetail, selectRewind, selContactsByKey } from '../state/selectors.js';

export function createOverlayHost({ mount, store, actions }) {
  /** id -> { sheet, inner } */
  const live = new Map();

  function build(entry, state) {
    const { kind, props } = entry;

    switch (kind) {
      case 'history': {
        const detail = selectContactDetail(state, props.contactKey);
        const inner = HistoryPanel({
          detail: { ...detail, number: props.number },
          settings: state.settings,
          onCall: () => actions.call(detail.view?.primaryNumber || props.number, props.contactKey),
          onAction: (id) => actions.historyAction(id, props.contactKey, props.number),
        });
        // null title: HistoryPanel owns its own header (eyebrow "History" +
        // name + number) — a wrapper title here used to render as a second,
        // redundant header above it. See ContactSheet/Settings for the same
        // null-title pattern; the wrapper's .sheet__close is still the one
        // close affordance.
        return sheetWrap(null, inner, 'full', entry);
      }

      case 'rewind': {
        const rewind = selectRewind(state, props.contactKey);
        const view = selContactsByKey(state).get(props.contactKey) || null;
        const inner = CheckRewind({
          rewind, view,
          onClose: () => actions.popOverlay(),
          onCall: () => actions.call(view?.primaryNumber || props.number, props.contactKey),
        });
        // Rewind is a full-bleed story surface, not a sheet.
        const el = h('div.overlay.overlay--rewind', null, inner.el);
        return {
          el, inner,
          open() { requestAnimationFrame(() => el.classList.add('is-open')); },
          close: () => actions.popOverlay(),
          destroy() { inner.destroy(); el.remove(); },
        };
      }

      case 'contact': {
        const detail = selectContactDetail(state, props.contactKey);
        const inner = ContactSheet({
          detail, settings: state.settings, number: props.number,
          onAction: (id, arg) => actions.contactAction(id, props.contactKey, arg, props.number),
        });
        return sheetWrap(null, inner, 'tall', entry);
      }

      case 'contact-editor': {
        const inner = ContactEditor({
          draft: props.draft || null,
          existing: props.contactKey ? selContactsByKey(state).get(props.contactKey) : null,
          onSave: (data) => actions.saveContact(data, props),
          onCancel: () => actions.popOverlay(),
          onDelete: props.contactKey ? () => actions.deleteContact(props.contactKey) : null,
        });
        return sheetWrap(props.contactKey ? 'Edit contact' : 'New contact', inner, 'tall', entry);
      }

      case 'dialr-profile': {
        const profile = state.directory.profiles[props.contactKey];
        if (!profile) return null;
        const inner = ProfileView({
          profile: { ...profile, number: props.number },
          settings: state.settings, mode: 'other',
          onAction: (id, arg) => actions.profileAction(id, arg, props),
        });
        return sheetWrap(null, inner, 'full', entry);
      }

      case 'wallpaper-picker': {
        const inner = WallpaperPicker({
          current: state.theme.wallpaperId,
          mode: state.theme.resolvedMode,
          intensity: state.settings.appearance.intensity,
          showWallpaper: state.settings.appearance.showWallpaper,
          userAssets: actions.getUserWallpapers(),
          onPreview: (asset, palette) => actions.previewTheme(asset, palette),
          onSelect: (asset, palette) => actions.selectWallpaper(asset, palette),
          onSetting: (path, v) => actions.setSetting(path, v),
          onPickCustom: (kind) => actions.pickCustomWallpaper(kind),
        });
        return sheetWrap('Wallpaper', inner, 'tall', entry);
      }

      case 'ringtone-picker': {
        const inner = RingtonePicker({
          current: props.contactKey
            ? (selContactsByKey(state).get(props.contactKey)?.ringtoneId || state.settings.sound.ringtone)
            : state.settings.sound.ringtone,
          scopeLabel: props.contactKey ? `Only for ${props.name}` : 'Default for everyone',
          onSelect: (rt) => actions.selectRingtone(rt, props.contactKey),
          onPreview: (rt) => actions.previewRingtone(rt),
          onStop: () => actions.stopRingtonePreview(),
          onPickCustom: () => actions.toast({ text: 'Picking a device sound is a native action.', iconName: 'info' }),
        });
        return sheetWrap('Ringtone', inner, 'tall', entry);
      }

      case 'settings': {
        const inner = SettingsPanel({
          settings: state.settings,
          onSet: (path, v) => actions.setSetting(path, v),
          onNav: (target, field) => actions.settingsNav(target, field),
          onAction: (id, field) => actions.settingsAction(id, field),
          onSelectOptions: (field, value, set) => actions.chooseOption(field, value, set),
        });
        if (props.section) inner.openSection(props.section);
        return sheetWrap(null, inner, 'full', entry);
      }

      case 'quick-reply': {
        const inner = QuickReplySheet({
          replies: [state.settings.replies.one, state.settings.replies.two, state.settings.replies.three],
          name: props.name,
          onSend: (text) => actions.sendQuickReply(text, props),
          onCustom: () => actions.customReply(props),
        });
        return sheetWrap('Quick reply', inner, 'peek', entry);
      }

      case 'reminder': {
        const inner = ReminderPicker({
          presets: state.settings.replies.reminderPresets,
          name: props.name,
          tellThemDefault: state.settings.replies.tellThem,
          canTellThem: state.settings.replies.tellThem !== 'never',
          onConfirm: (r) => actions.createReminder(r, props),
          onCancel: () => actions.popOverlay(),
        });
        return sheetWrap('Remind me', inner, 'peek', entry);
      }

      case 'sim': {
        const inner = SimSelector({
          sims: state.directory.sims,
          preferred: props.preferred,
          name: props.name,
          onPick: (simId, remember) => actions.pickSim(simId, remember, props),
        });
        return sheetWrap('Call with', inner, 'peek', entry);
      }

      case 'repeat-caller': {
        const inner = RepeatCallerPrompt({
          number: props.number, burst: props.burst,
          onAction: (id) => actions.repeatCallerAction(id, props),
        });
        return sheetWrap(null, inner, 'peek', entry);
      }

      case 'options': {
        const inner = OptionList(props, actions);
        return sheetWrap(props.title, inner, 'peek', entry);
      }

      case 'demo': {
        const inner = DemoPanel({ store, actions });
        return sheetWrap('Demo controls', inner, 'tall', entry);
      }

      case 'bridge-status': {
        const inner = BridgeStatus({ store });
        return sheetWrap('Native bridge', inner, 'tall', entry);
      }

      default:
        return null;
    }
  }

  function sheetWrap(title, inner, height, entry) {
    const sheet = Sheet({
      title, content: inner.el, height,
      onClose: () => {
        // Only pop if this sheet is still the top of the stack — a programmatic
        // pop already removed it.
        const stack = store.getState().overlay.stack;
        if (stack.length && stack[stack.length - 1].id === entry.id) actions.popOverlay();
      },
    });
    return { el: sheet.el, inner, open: sheet.open, close: sheet.close, destroy: sheet.destroy };
  }

  function render(state) {
    const stack = state.overlay.stack;
    const wanted = new Set(stack.map((e) => e.id));

    // Remove overlays that left the stack.
    for (const [id, rec] of live) {
      if (!wanted.has(id)) { rec.destroy?.(); live.delete(id); }
    }

    // Add new ones.
    for (const entry of stack) {
      if (live.has(entry.id)) {
        live.get(entry.id).inner?.update?.({ settings: state.settings });
        continue;
      }
      const built = build(entry, state);
      if (!built) continue;
      mount.appendChild(built.el);
      built.open?.();
      live.set(entry.id, built);
    }
  }

  return { render };
}

/** Generic single-choice list, used by SelectField in Settings. */
function OptionList({ options, value, onPick }, actions) {
  const el = h('div.optlist');
  for (const o of options) {
    el.appendChild(h('button.optlist__item', {
      type: 'button',
      dataset: { selected: String(o.value === value) },
      on: { click: () => { onPick?.(o.value); actions.popOverlay(); } },
    },
    h('span.col.grow', null,
      h('span.t-body', { text: o.label }),
      o.hint ? h('span.t-caption', { text: o.hint }) : null)));
  }
  return { el, update() {}, destroy() {} };
}
