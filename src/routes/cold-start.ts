import {currentWeekStart} from '@/lib/date'
import {useEffect, useState} from 'react'

// A phone reopens whatever URL it was last on — a bookmark, a restored tab, the installed PWA —
// and by the next service that week has passed. The first recorder screen of a fresh load snaps
// to the current week; every navigation after that (the ‹ › week links) browses freely.
let coldStart = true

// True for the first render of the screen a fresh page load lands on, and false forever after.
//
// It has to go false without unmounting: React keeps one PickScreen mounted across every :weekStart
// the ‹ › links visit, so a value captured only at mount would keep claiming to be a cold start and
// snap every week the usher picked straight back to this one. Same for EntryScreen across services.
export function useColdStart(): boolean {
  const [cold] = useState(() => coldStart)
  const [spent, setSpent] = useState(false)
  useEffect(() => {
    coldStart = false
    setSpent(true)
  }, [])
  return cold && !spent
}

// The home-screen app reopens the URL it was added from: iOS bookmarks the page you were on, and
// a static manifest can't carry a per-recorder `start_url` to override it — so an install made
// from a service page is pinned to that week forever. Inside the installed app nobody is
// following a shared link, so a cold start there always returns to this week's list.
export function isInstalledApp(): boolean {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as {standalone?: boolean}).standalone === true
    )
  } catch {
    return false
  }
}

// The week to redirect a cold load to, or null to stay on `week`.
export function useColdStartWeek(week: string | null): string | null {
  const cold = useColdStart()
  const current = currentWeekStart()
  return cold && week !== null && week !== current ? current : null
}
