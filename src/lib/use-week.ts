import {type Week, type WeekRecord, fetchWeek} from '@/lib/api'
import {type UseQueryResult, useQuery} from '@tanstack/react-query'

export const weekQueryKey = (token: string, weekStart: string) => ['week', token, weekStart] as const

// The whole app's server truth for a week, on one timer.
//
// Both screens read this one query, so the pick list and the service being tallied can never
// disagree, and a second device's count shows up on this one within a few seconds. Nothing is held
// open: react-query owns the interval and clears it on unmount, `refetchIntervalInBackground`
// stays false so a hidden tab stops polling entirely, and the defaults already refetch on focus and
// on reconnect — which is what makes a laptop current the moment it is looked at. See ADR-0028.
export function useWeek(token: string, weekStart: string | null): UseQueryResult<Week> {
  return useQuery({
    queryKey: weekQueryKey(token, weekStart ?? ''),
    queryFn: () => fetchWeek(token, weekStart as string),
    enabled: Boolean(token && weekStart),
    refetchInterval: 3_000,
    // A count on screen is worth showing while the next poll is in flight.
    placeholderData: (previous) => previous,
  })
}

export function selectWeekRecord(week: Week | undefined, serviceTimeId: number): WeekRecord | undefined {
  return week?.records.find((r) => r.serviceTimeId === serviceTimeId)
}
