import {currentWeekStart} from '@/lib/date'
import {EntryScreen} from '@/routes/EntryScreen'
import {InvalidLink, RecorderLayout} from '@/routes/RecorderLayout'
import {PickScreen} from '@/routes/PickScreen'
import {Navigate, Route, Routes} from 'react-router-dom'

// URL shape: /r/<token>/<weekStart>/<serviceTimeId>
// The recorder token stays the first segment (Netlify already rewrites /r/* to index.html), so
// deeper paths need no infra change — and the week and service are now bookmarkable and reachable
// with the browser's back/forward buttons.
export default function App() {
  return (
    <Routes>
      <Route path="/r/:token" element={<RecorderLayout />}>
        <Route index element={<Navigate to={currentWeekStart()} replace />} />
        <Route path=":weekStart" element={<PickScreen />} />
        <Route path=":weekStart/:serviceTimeId" element={<EntryScreen />} />
      </Route>
      <Route path="*" element={<InvalidLink />} />
    </Routes>
  )
}
