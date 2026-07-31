import {flush, pendingCount} from '@/lib/outbox'
import {useOnline} from '@/lib/use-online'
import {useOutbox} from '@/lib/use-outbox'

// A persistent, honest answer to "did my count make it?". Silent when everything is synced;
// otherwise it says exactly where the numbers live right now.
export function SyncStatusBar() {
  const online = useOnline()
  const outbox = useOutbox()
  const waiting = pendingCount(outbox)

  if (waiting === 0 && !outbox.error) return null

  const offline = !online || Boolean(outbox.error)
  const noun = waiting === 1 ? 'count' : 'counts'

  return (
    <div
      role="status"
      className={
        offline
          ? 'flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm'
          : 'flex items-center gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm'
      }
    >
      <span
        className={
          offline
            ? 'size-2.5 shrink-0 rounded-full bg-amber-500'
            : 'size-2.5 shrink-0 rounded-full bg-primary animate-pulse'
        }
      />
      <span className="flex-1">
        {offline ? (
          <>
            <span className="font-semibold">Offline.</span>{' '}
            {waiting > 0
              ? `${waiting} ${noun} saved on this device — they’ll sync automatically.`
              : 'Counts are saved on this device.'}
          </>
        ) : (
          `Syncing ${waiting} ${noun}…`
        )}
      </span>
      {offline && waiting > 0 && (
        <button
          onClick={() => void flush()}
          className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  )
}
