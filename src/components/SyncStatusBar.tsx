import {pendingCount} from '@/lib/outbox'
import {useOnline} from '@/lib/use-online'
import {useOutbox} from '@/lib/use-outbox'

// An honest answer to "did my count make it?", rendered as the last thing on the page so it can
// never shove the tally buttons out from under a thumb when it appears. Silent once synced.
export function SyncStatusBar() {
  const online = useOnline()
  const outbox = useOutbox()
  const waiting = pendingCount(outbox)

  if (waiting === 0 && !outbox.error) return null

  const offline = !online || Boolean(outbox.error)
  const noun = waiting === 1 ? 'count' : 'counts'

  return (
    <p role="status" className="px-1 text-center text-xs text-muted-foreground">
      {offline
        ? waiting > 0
          ? `Offline — ${waiting} ${noun} saved on this device, syncing automatically when you're back in range.`
          : 'Offline — counts are saved on this device.'
        : `Syncing ${waiting} ${noun}…`}
    </p>
  )
}
