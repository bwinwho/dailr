/**
 * DIALR — haptics.
 *
 * Vibration is part of the product's feel, so it goes through one module with
 * named intents rather than magic millisecond arrays scattered around.
 * On Android the same intents map to HapticFeedbackConstants / VibrationEffect.
 */
import { notify } from '../services/bridge.js';

const PATTERNS = {
  tap:      [8],
  key:      [10],
  select:   [12],
  toggle:   [6, 24, 10],
  expand:   [14],
  success:  [10, 40, 18],
  warn:     [22, 60, 22],
  error:    [30, 50, 30, 50, 30],
  answer:   [16, 30, 26],
  hangup:   [26],
  incoming: [0, 420, 220, 420],
};

let enabled = true;
export function setEnabled(v) { enabled = !!v; }

export function fire(intent = 'tap') {
  if (!enabled) return;
  // Prefer the native implementation — it respects system haptic settings.
  if (notify('haptics', 'fire', { intent })) return;
  const p = PATTERNS[intent] || PATTERNS.tap;
  try { navigator.vibrate?.(p); } catch { /* unsupported */ }
}

export const haptics = { fire, setEnabled, PATTERNS };
export default haptics;
