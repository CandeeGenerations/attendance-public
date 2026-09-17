import {sentryVitePlugin} from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import {defineConfig, loadEnv} from 'vite'
import {VitePWA} from 'vite-plugin-pwa'

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT_WEB ?? 'attendance-web'
const release = process.env.VITE_SENTRY_RELEASE ?? process.env.COMMIT_REF
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg)

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default defineConfig(({mode}) => {
  // Workbox bakes this into the generated service worker. A RegExp route for a cross-origin
  // request must match from the start of the full URL, so the API origin can't be inferred at
  // runtime — it comes from the same env var the client uses.
  const apiBase = (loadEnv(mode, process.cwd(), '').VITE_CGEN_API_BASE ?? '').replace(/\/$/, '')
  const apiPattern = new RegExp(`^${escapeRe(apiBase)}/attendance-public/`)

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // main.tsx registers the worker itself; icons + manifest already live in public/favicons.
        injectRegister: false,
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // GET only (workbox's default) — saves are POSTs and must never be served from a
              // cache. A stale session/service list beats a blank screen on a cold open out of
              // range; queued local edits always render on top of whatever this returns.
              urlPattern: apiPattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'attendance-api',
                networkTimeoutSeconds: 5,
                expiration: {maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30},
                cacheableResponse: {statuses: [200]},
              },
            },
          ],
        },
      }),
      sentryEnabled &&
        sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuthToken,
          release: release ? {name: release} : undefined,
          sourcemaps: {assets: './dist/**'},
        }),
    ],
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      sourcemap: 'hidden',
    },
  }
})
