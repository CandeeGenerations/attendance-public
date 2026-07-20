import App from '@/App'
import '@/index.css'
import {Sentry, initSentry} from '@/lib/sentry'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

initSentry()

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
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
