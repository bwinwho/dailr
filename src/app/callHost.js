/**
 * DIALR — call layer host.
 *
 * Owns the full-screen call surfaces and, critically, keeps them ALIVE across
 * state changes. The active-call screen is created once per call and updated in
 * place; re-creating it would restart the timer, drop the note draft and steal
 * focus mid-conversation.
 */
import { h, reflow, afterTransition } from '../core/dom.js';
import { IncomingCallScreen } from '../components/call/IncomingCallScreen.js';
import { ActiveCallScreen } from '../components/call/ActiveCallScreen.js';
import { PostCallSheet } from '../components/call/PostCallSheet.js';
import { selectCallScreen } from '../state/selectors.js';

export function createCallHost({ mount, store, actions }) {
  let current = null;         // { kind, callId, inst, el }
  let post = null;
  let noteOpen = false;

  function teardown() {
    if (!current) return;
    const dying = current;
    current = null;
    dying.el.classList.add('is-leaving');
    afterTransition(dying.el, 400).then(() => { dying.inst.destroy?.(); dying.el.remove(); });
  }

  function mountScreen(kind, inst, callId) {
    teardown();
    const el = h(`div.calllayer.calllayer--${kind}`, null, inst.el);
    mount.appendChild(el);
    reflow(el);
    el.classList.add('is-in');
    current = { kind, callId, inst, el };
  }

  function render(state) {
    const model = selectCallScreen(state);

    /* ---------------------------------------------------------- no call -- */
    if (!model) {
      teardown();
      noteOpen = false;
      renderPostCall(state);
      return;
    }
    renderPostCall(state);

    const s = model.session;
    const wantKind = s.state === 'ringing' ? 'incoming' : 'active';

    if (current && current.callId === s.id && current.kind === wantKind) {
      current.inst.update({ model, settings: state.settings, noteOpen });
      return;
    }

    if (wantKind === 'incoming') {
      const inst = IncomingCallScreen({
        model, settings: state.settings,
        onAnswer: () => actions.answer(s.id),
        onDecline: () => actions.decline(s.id),
        onQuickReply: () => actions.openQuickReply(s.number, model.identity),
        onRemind: () => actions.openReminder(s.number, model.identity, { declineFirst: true }),
        onSave: () => actions.addContact(s.number),
        onBlock: () => actions.blockNumber(s.number, { declineFirst: true }),
      });
      mountScreen('incoming', inst, s.id);
    } else {
      const inst = ActiveCallScreen({
        model, settings: state.settings,
        actions: {
          hangup: () => actions.hangup(s.id),
          toggleMute: () => actions.toggleMute(),
          toggleHold: () => actions.toggleHold(s.id),
          cycleAudio: () => actions.cycleAudio(),
          toggleKeypad: (v) => actions.toggleKeypad(v),
          toggleNote: () => { noteOpen = !noteOpen; current?.inst.update({ model, settings: store.getState().settings, noteOpen }); },
          setNote: (t) => actions.setNoteDraft(t),
          sendDtmf: (d) => actions.sendDtmf(d),
          addCall: () => actions.addCallFlow(),
          swap: () => actions.swapCalls(),
          merge: () => actions.mergeCalls(),
        },
      });
      inst.update({ model, settings: state.settings, noteOpen });
      mountScreen('active', inst, s.id);
    }
  }

  function renderPostCall(state) {
    const summary = state.call.postCall;
    if (!summary) {
      if (post) { post.el.classList.remove('is-in'); const dying = post; post = null;
                  afterTransition(dying.el, 340).then(() => { dying.inst.destroy?.(); dying.el.remove(); }); }
      return;
    }
    if (post) { post.inst.update({ summary }); return; }

    const inst = PostCallSheet({
      summary, settings: state.settings,
      onAction: (id, arg) => actions.postCallAction(id, summary, arg),
      onClose: () => actions.clearPostCall(),
    });
    const el = h('div.postcall__layer', null, inst.el);
    mount.appendChild(el);
    reflow(el);
    el.classList.add('is-in');
    post = { inst, el };
  }

  return { render };
}
