import {currentWeekStart} from '@/lib/date'
import {useEffect, useState} from 'react'

// A phone reopens whatever URL it was last on — a bookmark, a restored tab, the installed PWA —
// and by the next service that week has passed. The first recorder screen of a fresh load snaps
// to the current week; every navigation after that (the ‹ › week links) browses freely.
let coldStart = true

// True only for the screen that a fresh page load lands on. Every recorder screen calls this so
// the cold start is spent by whichever one mounts first, not by the pick screen alone.
export function useColdStart(): boolean {
  const [cold] = useState(() => coldStart)
  useEffect(() => {
    coldStart = false
  }, [])
  return cold
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
