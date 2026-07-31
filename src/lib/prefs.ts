// Device-level preferences. Every access is guarded: a quota error or a locked-down
// privacy-mode browser must never break attendance entry.
export type InputMode = 'tally' | 'type'

const INPUT_MODE_KEY = 'attendance:input-mode:v1'

export function readInputMode(): InputMode {
  try {
    return localStorage.getItem(INPUT_MODE_KEY) === 'type' ? 'type' : 'tally'
  } catch {
    return 'tally'
  }
}

export function writeInputMode(mode: InputMode): void {
  try {
    localStorage.setItem(INPUT_MODE_KEY, mode)
  } catch {
    /* non-fatal — the choice just won't stick */
  }
}
