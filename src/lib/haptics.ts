// Tap feedback for the tally buttons.
//
// Android/Chrome expose the Vibration API. iOS Safari does not — and never has — so the only
// way to get a real haptic there is to programmatically toggle a `<input type="checkbox" switch>`
// via its label, which Safari 17.4+ accompanies with a system haptic. The element is kept
// offscreen and aria-hidden; it exists purely as a haptic actuator.

let actuator: HTMLLabelElement | null = null

function tapIosSwitch(): void {
  if (!actuator) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.id = 'haptic-actuator'
    input.tabIndex = -1

    const label = document.createElement('label')
    label.htmlFor = input.id

    const host = document.createElement('div')
    host.setAttribute('aria-hidden', 'true')
    host.style.cssText =
      'position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    host.append(input, label)
    document.body.append(host)
    actuator = label
  }
  actuator.click()
}

// `ms` is only honoured by the Vibration API; the iOS fallback has one fixed intensity.
export function haptic(ms = 10): void {
  try {
    // `vibrate` returns false when the pattern is rejected (e.g. no user gesture yet).
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(ms)) return
  } catch {
    /* fall through to the iOS path */
  }
  try {
    tapIosSwitch()
  } catch {
    /* no haptics available — silent, this is pure enhancement */
  }
}
