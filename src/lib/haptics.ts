// Tap feedback for the tally buttons.
//
// Android/Chrome expose the Vibration API. iOS Safari never has, and the workaround everyone used
// — programmatically clicking a <label> bound to an <input type="checkbox" switch> — was closed by
// Apple in iOS 26.5: a haptic now fires only when the user's finger lands on a genuine WebKit
// switch control. So iOS is handled structurally by HapticButton (which puts an invisible real
// switch under the thumb) rather than from script here.

// Two directions that must be distinguishable by feel alone, on hardware that varies wildly.
//
// Shape carries the distinction — one buzz versus two, with a gap long enough to read as separate
// — because length can't: a phone with a weak or turned-down actuator renders nothing at all below
// some floor. One tested Android felt a 200ms buzz and nothing at 30ms, so these are far longer
// than they need to be on a phone that would have managed 30. The cost of overshooting is a buzz
// that feels slightly heavy; the cost of undershooting is a button that feels dead.
const PATTERNS = {
  tick: [80],
  double: [60, 90, 60],
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
