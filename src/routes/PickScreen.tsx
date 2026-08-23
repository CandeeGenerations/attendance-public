import {buttonClasses} from '@/components/ui/Button'
import {Card} from '@/components/ui/Card'
import {fetchRecord} from '@/lib/api'
import {addDays, dayHeading, formatTime, isWeekStart, resolveServiceDate, weekLabel} from '@/lib/date'
import {resolveRecord} from '@/lib/outbox'
import {useOutbox} from '@/lib/use-outbox'
import {useQueries} from '@tanstack/react-query'
import {useMemo} from 'react'
import {Link, Navigate, useParams} from 'react-router-dom'

import {useColdStartWeek} from './cold-start'
import {useRecorder} from './RecorderLayout'
import {currentWeekRoute, entryRoute, weekRoute} from './routes'

export function PickScreen() {
  const {token, session} = useRecorder()
  const {weekStart} = useParams()
  const week = isWeekStart(weekStart) ? weekStart : null
  const snapToWeek = useColdStartWeek(week)
  const outbox = useOutbox()

  // Group by dayOfWeek, preserving sort order within a day.
  const groups = useMemo(() => {
    const byDay = new Map<number, typeof session.serviceTimes>()
    for (const st of session.serviceTimes) {
      const arr = byDay.get(st.dayOfWeek) ?? []
      arr.push(st)
      byDay.set(st.dayOfWeek, arr)
    }
    return [...byDay.entries()].sort((a, b) => a[0] - b[0])
  }, [session])

  // Existing totals per service time for this week (shared cache with EntryScreen).
  const results = useQueries({
    // Nothing to fetch for a week we're about to redirect away from.
    queries:
      week && !snapToWeek
        ? session.serviceTimes.map((st) => {
            const date = resolveServiceDate(week, st.dayOfWeek)
            return {queryKey: ['record', token, st.id, date], queryFn: () => fetchRecord(token, st.id, date)}
          })
        : [],
  })

  if (!week) return <Navigate to={currentWeekRoute(token)} replace />
  // A bookmark or a restored tab opens on a week that has since passed; a fresh load starts here.
  if (snapToWeek) return <Navigate to={weekRoute(token, snapToWeek)} replace />

  const totalById = new Map<number, number | null>()
  session.serviceTimes.forEach((st, i) => {
    // Queued local edits outrank server values, so an offline tally still shows in this list.
    const {attendance, streaming} = resolveRecord(
      outbox,
      token,
      st.id,
      resolveServiceDate(week, st.dayOfWeek),
      results[i]?.data,
    )
    totalById.set(st.id, attendance === null && streaming === null ? null : (attendance ?? 0) + (streaming ?? 0))
  })

  return (
    <>
      <Card className="!p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 text-center">Week of</p>
        <div className="flex items-center justify-between gap-2">
          <Link
            to={weekRoute(token, addDays(week, -7))}
            aria-label="previous week"
            className={buttonClasses({variant: 'outline', className: '!w-14 !h-12 text-xl'})}
          >
            ‹
          </Link>
          <span className="font-semibold text-lg">{weekLabel(week)}</span>
          <Link
            to={weekRoute(token, addDays(week, 7))}
            aria-label="next week"
            className={buttonClasses({variant: 'outline', className: '!w-14 !h-12 text-xl'})}
          >
            ›
          </Link>
        </div>
      </Card>

      <h1 className="text-2xl font-bold px-1">Choose your Service Time</h1>

      {groups.map(([day, list]) => (
        <div key={day} className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">
            {dayHeading(resolveServiceDate(week, day))}
          </p>
          <Card className="!p-0 divide-y overflow-hidden">
            {list.map((st) => {
              const total = totalById.get(st.id)
              return (
                <Link
                  key={st.id}
                  to={entryRoute(token, week, st.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted active:bg-muted/80 cursor-pointer"
                >
                  <span className="text-lg font-medium">{formatTime(st.time)}</span>
                  <span className="flex items-center gap-3">
                    {total != null && (
                      <span className="text-base font-semibold tabular-nums text-muted-foreground">{total}</span>
                    )}
                    <span className="text-muted-foreground text-xl">›</span>
                  </span>
                </Link>
              )
            })}
          </Card>
        </div>
      ))}
    </>
  )
}
