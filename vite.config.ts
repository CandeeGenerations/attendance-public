import {sentryVitePlugin} from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import {defineConfig} from 'vite'

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT_WEB ?? 'attendance-web'
const release = process.env.VITE_SENTRY_RELEASE ?? process.env.COMMIT_REF
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: 'hidden',
  },
})
