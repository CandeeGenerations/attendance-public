// Tap feedback for the tally buttons.
//
// Android/Chrome expose the Vibration API. iOS Safari never has, and the workaround everyone used
// — programmatically clicking a <label> bound to an <input type="checkbox" switch> — was closed by
// Apple in iOS 26.5: a haptic now fires only when the user's finger lands on a genuine WebKit
// switch control. So iOS is handled structurally by HapticButton (which puts an invisible real
// switch under the thumb) rather than from script here.

export function haptic(ms = 10): void {
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {
    /* no vibration support — pure enhancement, never let it surface */
  }
}
