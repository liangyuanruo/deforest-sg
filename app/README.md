# deforest.sg — app

Interactive dashboard for the [`deforest`](../README.md) analysis: which Singapore
forest the URA Master Plan 2025 zones for development. Next.js 16 (App Router, Turbopack)
+ Tailwind v4 + shadcn/ui + Mapbox GL, typed with Zod.

## Develop

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`dev`/`build` first run `scripts/sync-results.mjs`, which copies the pipeline outputs
from the repo's top-level `../results/` into `public/data/` (gitignored). `../results/`
is the single source of truth — regenerate it via `analysis/` (see the root README).

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start` — sync data, then Next.
- `pnpm sync-data` — copy `../results/*` → `public/data/` on its own.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest (pure `lib/` logic: schemas, formatting, scoring).
- `pnpm lint` — ESLint.

## Layout

- `components/Explorer.tsx` — client orchestrator: data fetch, state, composition.
- `components/MapView.tsx` — Mapbox GL map (forest / threatened / dev-zone layers).
- `components/Sidebar.tsx`, `StatsBar.tsx`, `AboutModal.tsx` — UI.
- `lib/schema.ts` (Zod), `lib/data.ts` (loaders), `lib/scoring.ts` (search/sort/filter),
  `lib/format.ts`, `lib/mapbox.ts`.

## Mapbox

Style and public token ship as env-overridable defaults in `lib/mapbox.ts`. Override with
`NEXT_PUBLIC_MAPBOX_STYLE` / `NEXT_PUBLIC_MAPBOX_TOKEN` if needed.

## Deploy

Vercel, **Root Directory = `app`**, Build Command `pnpm build`, with *Include files
outside the Root Directory* enabled so `../results` is available at build time.

> `AGENTS.md` here is written by `next dev` — this is a newer Next.js than most training
> data; read `node_modules/next/dist/docs/` before making framework changes.
