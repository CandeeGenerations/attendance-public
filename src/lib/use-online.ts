import {useSyncExternalStore} from 'react'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

// `navigator.onLine` only proves the radio is up, not that the API is reachable — the outbox's
// own failure state is the authority on whether saves are landing. This drives copy, not logic.
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
