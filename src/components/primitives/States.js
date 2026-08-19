/**
 * DIALR — empty, loading, error and permission states.
 *
 * The brief lists these as first-class requirements, so they are components,
 * not afterthought strings. Each one gives the user (a) what happened in plain
 * words and (b) the single most useful thing to do next.
 */
import { h } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
import { Button } from './Button.js';

export function EmptyState({ iconName = 'clock', title, body, actionLabel, onAction, tone = 'neutral' }) {
  const action = actionLabel ? Button({ label: actionLabel, variant: 'secondary', size: 'md', onClick: onAction }) : null;
  const el = h(`div.state.state--${tone}`, null,
    h('div.state__icon', { html: icon(iconName) }),
    h('h3.state__title.t-title', { text: title }),
    body ? h('p.state__body.t-body-sm.c-3.u-balance', { text: body }) : null,
    action ? h('div.state__action', null, action.el) : null);
  return { el, update() {}, destroy() {} };
}

export function ErrorState({ title = 'Something went wrong', body, code, onRetry }) {
  const retry = onRetry ? Button({ label: 'Try again', icon: 'refresh', variant: 'secondary', onClick: onRetry }) : null;
  const el = h('div.state.state--error', null,
    h('div.state__icon', { html: icon('warn') }),
    h('h3.state__title.t-title', { text: title }),
    body ? h('p.state__body.t-body-sm.c-3.u-balance', { text: body }) : null,
    code ? h('code.state__code.t-micro.c-4', { text: code }) : null,
    retry ? h('div.state__action', null, retry.el) : null);
  return { el, update() {}, destroy() {} };
}

/**
 * Permission gate. Explains WHY before asking, which is the difference between
 * a granted permission and a permanently blocked one.
 */
export function PermissionState({ title, body, actionLabel = 'Allow', onAction, blocked, onSettings }) {
  const primary = Button({
    label: blocked ? 'Open settings' : actionLabel,
    variant: 'primary',
    onClick: blocked ? onSettings : onAction,
  });
  const el = h('div.state.state--permission', null,
    h('div.state__icon', { html: icon('lock') }),
    h('h3.state__title.t-title', { text: title }),
    h('p.state__body.t-body-sm.c-2.u-balance', { text: body }),
    blocked ? h('p.state__body.t-caption.c-3', { text: 'You previously declined, so Android needs you to change this in settings.' }) : null,
    h('div.state__action', null, primary.el));
  return { el, update() {}, destroy() {} };
}

/** Skeleton rows — shape-matched to what is loading, never a generic spinner. */
export function Skeleton({ variant = 'card', count = 3 }) {
  const el = h('div.skeleton-group', { aria: { hidden: 'true' } });
  for (let i = 0; i < count; i++) el.appendChild(h(`div.skeleton.skeleton--${variant}`));
  return { el, update() {}, destroy() {} };
}

/** A thin, non-blocking notice — used for offline and degraded-service states. */
export function Banner({ tone = 'neutral', iconName, text, actionLabel, onAction, onDismiss }) {
  const el = h(`div.banner.banner--${tone}`, { role: 'status' },
    iconName ? h('span.banner__icon', { html: icon(iconName) }) : null,
    h('span.banner__text.t-body-sm', { text }),
    actionLabel ? h('button.banner__action.t-label', { type: 'button', text: actionLabel, on: { click: onAction } }) : null,
    onDismiss ? h('button.banner__close', { type: 'button', aria: { label: 'Dismiss' }, html: icon('close'), on: { click: onDismiss } }) : null);
  return { el, update() {}, destroy() {} };
}
