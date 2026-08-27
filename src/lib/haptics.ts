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
// some floor. What that floor is came out of the app itself rather than a lab test: with `tick` at
// a single 80ms and `double` at 60-90-60, the tested Android felt nothing on the up key and only a
// faint buzz on the down key. A single 80ms pulse is under its floor; 60ms pulses cleared it only
// by repeating. So every pulse here is now ≥110ms, which is where that phone starts rendering a
// solid buzz, and the two keys stay apart by count rather than by strength.
//
// The cost of overshooting is a buzz that feels slightly heavy under a counting thumb; the cost of
// undershooting is a button that feels dead. Prefer heavy.
const PATTERNS = {
  // Gap of 100ms: an ERM motor needs most of that just to spin down, and anything tighter smears
  // the two pulses into one long buzz — which would make `double` indistinguishable from `tick`.
  tick: [140],
  double: [110, 100, 110],
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
