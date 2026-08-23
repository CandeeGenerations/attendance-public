// Tap feedback for the tally buttons.
//
// Android/Chrome expose the Vibration API. iOS Safari never has, and the workaround everyone used
// — programmatically clicking a <label> bound to an <input type="checkbox" switch> — was closed by
// Apple in iOS 26.5: a haptic now fires only when the user's finger lands on a genuine WebKit
// switch control. So iOS is handled structurally by HapticButton (which puts an invisible real
// switch under the thumb) rather than from script here.

// Two directions that must be distinguishable by feel alone. Length is the wrong axis for that:
// phones with a linear resonant actuator need ~20ms just to spin up, so a 10ms pulse is often
// silent and a 22ms one is a faint blur — the difference lands as "the buttons don't buzz". Shape
// survives any motor: one tick versus two, with a gap long enough to read as separate taps.
const PATTERNS = {
  tick: [30],
  double: [22, 60, 22],
} as const

export type HapticShape = keyof typeof PATTERNS

// Returns whether the platform accepted the request — not whether anything was felt. Chrome
// returns true even when the phone's own haptics are switched off system-wide.
export function haptic(shape: HapticShape = 'tick'): boolean {
  try {
    if (typeof navigator.vibrate !== 'function') return false
    return navigator.vibrate([...PATTERNS[shape]])
  } catch {
    /* no vibration support — pure enhancement, never let it surface */
    return false
  }
}
