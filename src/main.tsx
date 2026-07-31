import App from '@/App'
import '@/index.css'
import {Sentry, initSentry} from '@/lib/sentry'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'

initSentry()

// Keeps the app shell available offline, so a refresh, a backgrounded tab, or a cold open in a
// dead spot still lands on a working counter. Queued counts live in localStorage regardless.
//
// Registered by hand rather than via `virtual:pwa-register` to skip the workbox-window dependency
// and, more importantly, its auto-reload: the worker updates quietly in the background and the new
// build takes effect on the next load instead of yanking the page out from under someone counting.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is an enhancement — never let it break entry */
    })
  })
}

const queryClient = new QueryClient({defaultOptions: {queries: {staleTime: 30_000, retry: 1}}})

function ErrorFallback() {
  return (
    <main className="min-h-svh bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md text-center text-muted-foreground py-12">
        Something went wrong. Please refresh the page.
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
