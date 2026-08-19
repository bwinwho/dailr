/**
 * DIALR — service interface declarations.
 *
 * This file has no runtime behaviour. It is the contract that both
 * implementations honour:
 *
 *   src/services/mock/*   the browser/demo implementation (this repo)
 *   Kotlin                the Android implementation (docs/ANDROID_INTEGRATION_MAP.md)
 *
 * Anything the UI is allowed to ask the platform for appears here. If a screen
 * needs something that is not listed, that is a signal the contract needs
 * extending — not that the screen should reach for a browser API.
 */

/**
 * @typedef {Object} DialrServices
 * @property {CallService}         calls
 * @property {ContactService}      contacts
 * @property {CallLogService}      callLog
 * @property {SimService}          sim
 * @property {PermissionService}   permissions
 * @property {NotificationService} notifications
 * @property {MediaService}        media
 * @property {ProfileService}      profile
 * @property {StorageService}      storage
 * @property {SpamService}         spam
 * @property {ReminderService}     reminders
 * @property {TelephonyService}    telephony
 */

/**
 * CallService — everything that touches the radio.
 * Emits (on the app bus): call.incoming, call.outgoing, call.connecting,
 * call.connected, call.held, call.ended, call.failed, call.audioChanged,
 * call.secondIncoming, call.merged
 *
 * @typedef {Object} CallService
 * @property {(number:string, opts?:{simId?:string, video?:boolean}) => Promise<{callId:string}>} place
 * @property {(callId:string) => Promise<void>} answer
 * @property {(callId:string, opts?:{replyText?:string}) => Promise<void>} reject
 * @property {(callId:string) => Promise<void>} hangup
 * @property {(callId:string, held:boolean) => Promise<void>} setHold
 * @property {(muted:boolean) => Promise<void>} setMute
 * @property {(route:'earpiece'|'speaker'|'bluetooth'|'wired') => Promise<void>} setAudioRoute
 * @property {() => Promise<Array<{id:string,label:string,kind:string,connected:boolean}>>} audioDevices
 * @property {(digit:string) => Promise<void>} sendDtmf
 * @property {(number:string) => Promise<{callId:string}>} addCall
 * @property {() => Promise<void>} swap
 * @property {() => Promise<void>} merge
 * @property {(callId:string) => Promise<void>} separate
 * @property {() => Promise<CallSnapshot|null>} snapshot
 */

/**
 * @typedef {Object} CallSnapshot
 * @property {Array<CallSession>} sessions  ordered; index 0 is foreground
 * @property {boolean} muted
 * @property {string}  audioRoute
 * @property {boolean} conference
 */

/**
 * @typedef {Object} CallSession
 * @property {string} id
 * @property {'incoming'|'outgoing'} direction
 * @property {'ringing'|'dialing'|'connecting'|'active'|'held'|'ending'|'ended'|'failed'} state
 * @property {string} number
 * @property {string} contactKey
 * @property {string} simId
 * @property {number} startedAt      ms epoch when the session was created
 * @property {number|null} connectedAt
 * @property {string|null} endReason
 */

/**
 * ContactService — Android Contacts Provider.
 * Emits: contacts.changed
 * @typedef {Object} ContactService
 * @property {() => Promise<DeviceContact[]>} list
 * @property {(id:string) => Promise<DeviceContact|null>} get
 * @property {(draft:Partial<DeviceContact>) => Promise<DeviceContact>} create
 * @property {(id:string, patch:Partial<DeviceContact>) => Promise<DeviceContact>} update
 * @property {(id:string) => Promise<void>} remove
 * @property {(query:string) => Promise<DeviceContact[]>} search
 * @property {(id:string) => Promise<void>} openSystemEditor
 * @property {(ids:string[]) => Promise<DeviceContact>} merge
 */

/**
 * CallLogService — Android CallLog Provider.
 * Emits: callLog.changed
 * @typedef {Object} CallLogService
 * @property {(opts?:{limit?:number, before?:number, contactKey?:string}) => Promise<CallLogEntry[]>} list
 * @property {(ids:string[]) => Promise<void>} remove
 * @property {(contactKey:string) => Promise<void>} clearForContact
 * @property {() => Promise<void>} clearAll
 * @property {(id:string, note:string|null) => Promise<void>} setNote
 */

/**
 * SimService — SubscriptionManager.
 * Emits: sim.changed
 * @typedef {Object} SimService
 * @property {() => Promise<SimCard[]>} list
 * @property {() => Promise<string|'ask'>} getDefault
 * @property {(simId:string|'ask') => Promise<void>} setDefault
 */

/**
 * PermissionService — runtime permissions + special roles.
 * Emits: permissions.changed
 * @typedef {Object} PermissionService
 * @property {() => Promise<Record<string,'granted'|'denied'|'blocked'|'unsupported'>>} status
 * @property {(names:string[]) => Promise<Record<string,string>>} request
 * @property {() => Promise<void>} openAppSettings
 */

/**
 * NotificationService.
 * Emits: notification.action
 * @typedef {Object} NotificationService
 * @property {(spec:{id:string,title:string,body:string,actions?:Array,at?:number,channel?:string}) => Promise<void>} post
 * @property {(id:string) => Promise<void>} cancel
 * @property {() => Promise<boolean>} canPost
 */

/**
 * MediaService — pick, normalise and play media. The UI never handles a raw
 * file: it asks for a MediaAsset and gets one back, already cropped, resized
 * and within budget (see docs/CUSTOMIZATION_SYSTEM.md § Media budgets).
 * Emits: media.progress, media.ready, media.failed
 * @typedef {Object} MediaService
 * @property {(opts?:{aspect?:number, kind?:'image'|'video'|'any'}) => Promise<MediaAsset|null>} pick
 * @property {(asset:MediaAsset, budget:MediaBudget) => Promise<MediaAsset>} prepare
 * @property {(asset:MediaAsset) => Promise<MediaAsset>} upload
 * @property {(id:string) => Promise<void>} remove
 * @property {(ringtoneId:string) => Promise<void>} playPreview
 * @property {() => Promise<void>} stopPreview
 * @property {(src:string) => Promise<Palette>} palette
 */

/**
 * ProfileService — Firebase-backed DIALR identity.
 * Emits: profile.updated, profile.lookupResult
 * @typedef {Object} ProfileService
 * @property {() => Promise<DialrProfile>} me
 * @property {(patch:Partial<DialrProfile>) => Promise<DialrProfile>} updateMe
 * @property {(numberKeys:string[]) => Promise<Record<string,DialrProfile>>} lookup
 * @property {(uid:string) => Promise<void>} recordView
 * @property {(uid:string) => Promise<void>} addToSquad
 */

/**
 * StorageService — device-local key/value. Never leaves the phone.
 * @typedef {Object} StorageService
 * @property {(key:string) => Promise<any>} get
 * @property {(key:string, value:any) => Promise<void>} set
 * @property {(key:string) => Promise<void>} remove
 * @property {() => Promise<string[]>} keys
 */

/**
 * SpamService — layered call protection (docs/SCREEN_SPECIFICATION.md § Protection).
 * Emits: spam.updated
 * @typedef {Object} SpamService
 * @property {(numberKeys:string[]) => Promise<Record<string,SpamVerdict>>} lookup
 * @property {(number:string, category:string) => Promise<void>} report
 * @property {(number:string) => Promise<void>} markNotSpam
 * @property {(number:string) => Promise<void>} block
 * @property {(number:string) => Promise<void>} unblock
 * @property {() => Promise<string[]>} blockedList
 * @property {() => Promise<BlockRule[]>} rules
 * @property {(rule:BlockRule) => Promise<void>} addRule
 * @property {(id:string) => Promise<void>} removeRule
 */

/**
 * ReminderService — local, alarm-backed callbacks.
 * Emits: reminder.due, reminder.changed
 * @typedef {Object} ReminderService
 * @property {() => Promise<Reminder[]>} list
 * @property {(spec:{number:string, label:string, dueAt:number, notifyThem?:boolean, channel?:string}) => Promise<Reminder>} create
 * @property {(id:string) => Promise<void>} cancel
 * @property {(id:string) => Promise<void>} complete
 */

/**
 * TelephonyService — device/role facts.
 * @typedef {Object} TelephonyService
 * @property {() => Promise<boolean>} isDefaultDialer
 * @property {() => Promise<boolean>} requestDefaultDialer
 * @property {() => Promise<{region:string, hasTelephony:boolean, model:string, apiLevel:number}>} deviceInfo
 * @property {(number:string) => Promise<boolean>} isEmergencyNumber
 */

export const SERVICE_NAMESPACES = [
  'calls', 'contacts', 'callLog', 'sim', 'permissions', 'notifications',
  'media', 'profile', 'storage', 'spam', 'reminders', 'telephony',
];

/** Permissions DIALR asks for, in the order the onboarding primer explains them. */
export const REQUIRED_PERMISSIONS = [
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_PHONE_STATE',
  'android.permission.CALL_PHONE',
  'android.permission.ANSWER_PHONE_CALLS',
  'android.permission.POST_NOTIFICATIONS',
];

export const OPTIONAL_PERMISSIONS = [
  'android.permission.SEND_SMS',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.SCHEDULE_EXACT_ALARM',
];
