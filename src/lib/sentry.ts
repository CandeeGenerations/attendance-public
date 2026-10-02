import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE
const release = import.meta.env.VITE_SENTRY_RELEASE

// Strip the shared token from any captured URL/query.
function redact(url: string | undefined): string | undefined {
  if (!url) return url
  return url.replace(/([?&]t(?:oken)?=)[^&#]+/gi, '$1[REDACTED]')
}

function scrubEvent<T extends Sentry.Event>(event: T): T {
  if (event.request) {
    delete event.request.data
    delete event.request.query_string
    delete event.request.cookies
    event.request.url = redact(event.request.url)
  }
  for (const b of event.breadcrumbs ?? []) {
    if ((b.category === 'fetch' || b.category === 'xhr') && typeof b.data?.url === 'string') {
      b.data.url = redact(b.data.url)
    }
    if (b.data) {
      delete b.data.input
      delete b.data.response
    }
  }
  return event
}

type StreamedSpan = Parameters<NonNullable<Sentry.BrowserOptions['beforeSendSpan']>>[0]

// v11 streams spans by default, which bypasses beforeSendTransaction, so URLs reach Sentry as
// span names and attributes instead. Apply the same redaction there.
function scrubSpan(span: StreamedSpan): StreamedSpan {
  span.name = redact(span.name) ?? span.name
  for (const [key, value] of Object.entries(span.attributes)) {
    if (typeof value === 'string') span.attributes[key] = redact(value)
  }
  return span
}

export function initSentry(): void {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: 1.0,
    // v11 collects all of these by default; keep the v10 `sendDefaultPii: false` behavior.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
    },
    ignoreErrors: ['AbortError', 'Unauthorized'],
    beforeSend: scrubEvent,
    beforeSendSpan: scrubSpan,
  })
}

export {Sentry}
