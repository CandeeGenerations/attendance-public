import {Stepper} from '@/components/Stepper'
import {Button} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {fetchRecord} from '@/lib/api'
import {dayHeading, formatTime, isWeekStart, resolveServiceDate} from '@/lib/date'
import {queueRecord, resolveRecord} from '@/lib/outbox'
import {type InputMode, readInputMode, writeInputMode} from '@/lib/prefs'
import {useOnline} from '@/lib/use-online'
import {useOutbox} from '@/lib/use-outbox'
import {useQuery} from '@tanstack/react-query'
import {useEffect, useRef, useState} from 'react'
import {Link, Navigate, useParams} from 'react-router-dom'

import {isInstalledApp, useColdStart} from './cold-start'
import {useRecorder} from './RecorderLayout'
import {currentWeekRoute, weekRoute} from './routes'

type Field = 'attendance' | 'streaming'

export function EntryScreen() {
  const {token, session} = useRecorder()
  const {weekStart, serviceTimeId} = useParams()
  const week = isWeekStart(weekStart) ? weekStart : null
  const st = session.serviceTimes.find((s) => String(s.id) === serviceTimeId)
  const date = week && st ? resolveServiceDate(week, st.dayOfWeek) : null

  // In a browser a link straight to a service keeps its week — it still spends the cold start, so
  // stepping back to the list doesn't then bounce the usher forward. The installed app has no
  // shared link to honour: it opens on the week it was added from, which is the bug.
  const staleAppLaunch = useColdStart() && isInstalledApp()

  const online = useOnline()
  const outbox = useOutbox()

  const {data: server, isLoading} = useQuery({
    queryKey: ['record', token, st?.id, date],
    queryFn: () => fetchRecord(token, st!.id, date!),
    enabled: Boolean(st && date) && !staleAppLaunch,
  })

  // The chosen input style is a property of the device, not the service — a desk volunteer on a
  // laptop keeps "Type", an usher on a phone keeps "Tally", across visits.
  const [mode, setMode] = useState<InputMode>(readInputMode)
  const chooseMode = (next: InputMode) => {
    setMode(next)
    writeInputMode(next)
  }

  const [field, setField] = useState<Field>('attendance')
  const edited = useRef(false)
  useEffect(() => {
    edited.current = false
  }, [st?.id, date])

  if (!week || staleAppLaunch) return <Navigate to={currentWeekRoute(token)} replace />
  if (!st || !date) return <Navigate to={weekRoute(token, week)} replace />

  const {attendance, streaming, pending} = resolveRecord(outbox, token, st.id, date, server)

  const apply = (next: {attendance: number | null; streaming: number | null}) => {
    edited.current = true
    queueRecord({token, serviceTimeId: st.id, date, ...next})
  }
  const applyAttendance = (n: number | null) => apply({attendance: n, streaming})
  const applyStreaming = (n: number | null) => apply({attendance, streaming: n})

  const current = field === 'attendance' ? attendance : streaming
  const setCurrent = (n: number) => (field === 'attendance' ? applyAttendance(n) : applyStreaming(n))

  return (
    <>
      <Link to={weekRoute(token, week)} className="text-muted-foreground text-sm px-1 cursor-pointer inline-block">
        ‹ Back
      </Link>
      <div className="px-1">
        <h1 className="text-2xl font-bold">{formatTime(st.time)}</h1>
        <p className="text-muted-foreground">{dayHeading(date)}</p>
      </div>

      {/* Never block the counter on the network: a queued local value is enough to keep going. */}
      {isLoading && !pending ? (
        <p className="text-muted-foreground px-1">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" selected={mode === 'tally'} onClick={() => chooseMode('tally')}>
              Tally
            </Button>
            <Button variant="outline" selected={mode === 'type'} onClick={() => chooseMode('type')}>
              Type
            </Button>
          </div>

          {mode === 'tally' ? (
            <Card className="space-y-6">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" selected={field === 'attendance'} onClick={() => setField('attendance')}>
                  Attendance
                </Button>
                <Button variant="outline" selected={field === 'streaming'} onClick={() => setField('streaming')}>
                  Streaming
                </Button>
              </div>
              <Stepper
                value={current ?? 0}
                onChange={setCurrent}
                label={field === 'attendance' ? 'Attendance' : 'Streaming'}
              />
              <div className="flex justify-around text-center pt-2 border-t">
                <ReadOut label="Attendance" value={attendance} />
                <ReadOut label="Streaming" value={streaming} />
                <ReadOut
                  label="Total"
                  value={attendance === null && streaming === null ? null : (attendance ?? 0) + (streaming ?? 0)}
                />
              </div>
            </Card>
          ) : (
            <Card className="space-y-4">
              <NumberInput label="Attendance" value={attendance} onChange={applyAttendance} />
              <NumberInput label="Streaming" value={streaming} onChange={applyStreaming} />
            </Card>
          )}

          <SaveStatus pending={pending} syncing={outbox.syncing} online={online} edited={edited.current} />
        </>
      )}
    </>
  )
}

function SaveStatus({
  pending,
  syncing,
  online,
  edited,
}: {
  pending: boolean
  syncing: boolean
  online: boolean
  edited: boolean
}) {
  return (
    <div className="text-center text-sm font-medium h-5">
      {pending ? (
        syncing ? (
          <span className="text-muted-foreground">Saving…</span>
        ) : online ? (
          <span className="text-muted-foreground">Waiting to sync…</span>
        ) : (
          <span className="text-amber-600 dark:text-amber-500">✓ Saved on this device</span>
        )
      ) : edited ? (
        <span className="text-green-600">✓ Saved automatically</span>
      ) : null}
    </div>
  )
}

function ReadOut({label, value}: {label: string; value: number | null}) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value ?? '—'}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (n: number | null) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => onChange(e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value))))}
        className="w-full h-16 px-4 text-2xl rounded-2xl bg-card border border-border focus:outline-none focus:ring-3 focus:ring-ring/40"
      />
    </label>
  )
}
