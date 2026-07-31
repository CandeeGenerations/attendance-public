import {currentWeekStart} from '@/lib/date'

// Every screen is addressable, so an usher can bookmark a service or use the back button to
// retrace their steps. The recorder token stays the first path segment, exactly as before.
const base = (token: string) => `/r/${encodeURIComponent(token)}`

export const weekRoute = (token: string, weekStart: string) => `${base(token)}/${weekStart}`

export const currentWeekRoute = (token: string) => weekRoute(token, currentWeekStart())

export const entryRoute = (token: string, weekStart: string, serviceTimeId: number) =>
  `${weekRoute(token, weekStart)}/${serviceTimeId}`
