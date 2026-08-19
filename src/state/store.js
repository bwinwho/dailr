/**
 * DIALR — assembled store.
 */
import { createStore, combineReducers } from '../core/store.js';
import {
  app, appInitial, directory, directoryInitial, dialer, dialerInitial,
  recents, recentsInitial, contactsUi, contactsInitial, search, searchInitial,
  call, callInitial, overlay, overlayInitial, theme, themeInitial,
  settings, settingsInitial, reminders, remindersInitial, toasts, toastsInitial,
} from './reducers.js';

export const initialState = {
  app: appInitial,
  directory: directoryInitial,
  dialer: dialerInitial,
  recents: recentsInitial,
  contactsUi: contactsInitial,
  search: searchInitial,
  call: callInitial,
  overlay: overlayInitial,
  theme: themeInitial,
  settings: settingsInitial,
  reminders: remindersInitial,
  toasts: toastsInitial,
};

const rootReducer = combineReducers({
  app, directory, dialer, recents, contactsUi, search,
  call, overlay, theme, settings, reminders, toasts,
});

export const store = createStore(rootReducer, initialState, { name: 'dialr' });

// Handy in the browser console during design work; harmless in production.
if (typeof window !== 'undefined') window.__dialrStore = store;

export default store;
