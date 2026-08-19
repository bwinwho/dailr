/**
 * DIALR — action catalogue.
 *
 * One file, so the full vocabulary of things that can happen to the app is
 * readable in one sitting. Types are namespaced `slice/verb`.
 */

export const A = {
  // app ---------------------------------------------------------------------
  APP_BOOTED:            'app/booted',
  APP_SET_TAB:           'app/setTab',
  APP_SET_ONLINE:        'app/setOnline',
  APP_SET_PERMISSIONS:   'app/setPermissions',
  APP_SET_DEFAULT_DIALER:'app/setDefaultDialer',
  APP_SET_ONBOARDING:    'app/setOnboarding',
  APP_COMPLETE_ONBOARDING:'app/completeOnboarding',
  APP_SET_ERROR:         'app/setError',
  APP_SET_KEYBOARD:      'app/setKeyboardOpen',

  // directory (device + cloud + private) -------------------------------------
  DIR_CONTACTS_LOADING:  'dir/contactsLoading',
  DIR_CONTACTS_LOADED:   'dir/contactsLoaded',
  DIR_CONTACTS_FAILED:   'dir/contactsFailed',
  DIR_LOG_LOADING:       'dir/logLoading',
  DIR_LOG_LOADED:        'dir/logLoaded',
  DIR_LOG_FAILED:        'dir/logFailed',
  DIR_LOG_UPSERT:        'dir/logUpsert',
  DIR_LOG_REMOVE:        'dir/logRemove',
  DIR_PROFILES_LOADED:   'dir/profilesLoaded',
  DIR_PROFILES_FAILED:   'dir/profilesFailed',
  DIR_PRIVATE_LOADED:    'dir/privateLoaded',
  DIR_PRIVATE_PATCH:     'dir/privatePatch',
  DIR_SPAM_LOADED:       'dir/spamLoaded',
  DIR_SIMS_LOADED:       'dir/simsLoaded',
  DIR_ME_LOADED:         'dir/meLoaded',

  // dialer -------------------------------------------------------------------
  DIALER_INPUT:          'dialer/input',
  DIALER_APPEND:         'dialer/append',
  DIALER_BACKSPACE:      'dialer/backspace',
  DIALER_CLEAR:          'dialer/clear',

  // recents ------------------------------------------------------------------
  RECENTS_EXPAND:        'recents/expand',
  RECENTS_COLLAPSE:      'recents/collapse',
  RECENTS_SET_FILTER:    'recents/setFilter',
  RECENTS_OPEN_HISTORY:  'recents/openHistory',
  RECENTS_CLOSE_HISTORY: 'recents/closeHistory',

  // contacts -----------------------------------------------------------------
  CONTACTS_QUERY:        'contacts/query',
  CONTACTS_SORT:         'contacts/sort',

  // search -------------------------------------------------------------------
  SEARCH_OPEN:           'search/open',
  SEARCH_CLOSE:          'search/close',
  SEARCH_QUERY:          'search/query',

  // call ---------------------------------------------------------------------
  CALL_SNAPSHOT:         'call/snapshot',
  CALL_SET_KEYPAD:       'call/setKeypad',
  CALL_SET_NOTE_DRAFT:   'call/setNoteDraft',
  CALL_SET_POSTCALL:     'call/setPostCall',
  CALL_CLEAR_POSTCALL:   'call/clearPostCall',
  CALL_SET_ERROR:        'call/setError',
  CALL_SET_PENDING:      'call/setPending',

  // overlays -----------------------------------------------------------------
  OVERLAY_PUSH:          'overlay/push',
  OVERLAY_POP:           'overlay/pop',
  OVERLAY_REPLACE:       'overlay/replace',
  OVERLAY_CLEAR:         'overlay/clear',

  // theme --------------------------------------------------------------------
  THEME_SET:             'theme/set',
  THEME_SET_PALETTE:     'theme/setPalette',

  // settings -----------------------------------------------------------------
  SETTINGS_LOADED:       'settings/loaded',
  SETTINGS_SET:          'settings/set',
  SETTINGS_RESET:        'settings/reset',

  // reminders / toasts -------------------------------------------------------
  REMINDERS_LOADED:      'reminders/loaded',
  REMINDER_UPSERT:       'reminders/upsert',
  REMINDER_REMOVE:       'reminders/remove',
  TOAST_PUSH:            'toast/push',
  TOAST_DISMISS:         'toast/dismiss',
};

/* --------------------------------------------------------- action creators */

export const setTab            = (tab) => ({ type: A.APP_SET_TAB, tab });
export const setOnline         = (online) => ({ type: A.APP_SET_ONLINE, online });
export const setPermissions    = (permissions) => ({ type: A.APP_SET_PERMISSIONS, permissions });
export const setDefaultDialer  = (isDefault) => ({ type: A.APP_SET_DEFAULT_DIALER, isDefault });
export const setOnboarding     = (step, data) => ({ type: A.APP_SET_ONBOARDING, step, data });
export const completeOnboarding= (identity) => ({ type: A.APP_COMPLETE_ONBOARDING, identity });
export const setAppError       = (scope, error) => ({ type: A.APP_SET_ERROR, scope, error });

export const dialerInput       = (value) => ({ type: A.DIALER_INPUT, value });
export const dialerAppend      = (digit) => ({ type: A.DIALER_APPEND, digit });
export const dialerBackspace   = () => ({ type: A.DIALER_BACKSPACE });
export const dialerClear       = () => ({ type: A.DIALER_CLEAR });

export const expandRecent      = (key) => ({ type: A.RECENTS_EXPAND, key });
export const collapseRecent    = () => ({ type: A.RECENTS_COLLAPSE });
export const setRecentsFilter  = (filter) => ({ type: A.RECENTS_SET_FILTER, filter });

export const openSearch        = () => ({ type: A.SEARCH_OPEN });
export const closeSearch       = () => ({ type: A.SEARCH_CLOSE });
export const searchQuery       = (query) => ({ type: A.SEARCH_QUERY, query });

export const pushOverlay       = (kind, props = {}) => ({ type: A.OVERLAY_PUSH, kind, props });
export const popOverlay        = () => ({ type: A.OVERLAY_POP });
export const clearOverlays     = () => ({ type: A.OVERLAY_CLEAR });

export const setTheme          = (patch) => ({ type: A.THEME_SET, patch });
export const setPalette        = (palette, wallpaperId) => ({ type: A.THEME_SET_PALETTE, palette, wallpaperId });

export const setSetting        = (path, value) => ({ type: A.SETTINGS_SET, path, value });
export const resetSettings     = () => ({ type: A.SETTINGS_RESET });

export const pushToast         = (toast) => ({ type: A.TOAST_PUSH, toast: { id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...toast } });
export const dismissToast      = (id) => ({ type: A.TOAST_DISMISS, id });
