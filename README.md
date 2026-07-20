# attendance-public

Public-facing service-attendance entry page. Mobile-first SPA hosted on Netlify at
`https://attendance.cgen.cc`. A single shared, tokenized link (`?t=<token>`) lets ushers record
per-service **Attendance** and **Streaming** counts, which write back to Central Flock via the
`cgen-api` proxy (`/attendance-public/*` → Central Flock `/webhooks/attendance`).

## Flow

1. Pick the **Week of** (defaults to the current week).
2. **Choose your Service Time** — grouped by day of week.
3. Enter numbers — **Tally mode** (big +/- steppers, pick which count you're tallying) or
   **Type mode** (plain inputs). Existing values load for editing (upsert).

## Stack

- Vite + React 19 + TypeScript, Tailwind CSS v4 (mirrors Central Flock tokens)
- No router; week/service-time selection is in-app state. Token read from `?t=` query param.

## Env

- `VITE_CGEN_API_BASE` — base URL for cgen-api (e.g. `https://api.cgen.cc`)

## Develop

```sh
pnpm install
pnpm dev
```

Open with a token: `http://localhost:5174/?t=<ATTENDANCE_PUBLIC_TOKEN>`

## Deploy

Netlify — see `netlify.toml`. Set `VITE_CGEN_API_BASE`. The shared token is validated by cgen-api
(`ATTENDANCE_PUBLIC_TOKEN`).
