# SongStage

Worship song projection and arrangement for churches.

## Layout

- `/app` — Next.js 15 app (production target)
- `/prototype` — Vite + TS prototype (OnSong parser, transposition, master/projector via BroadcastChannel)
- `/supabase/migrations` — SQL migrations

## v1 setup

1. Create a Supabase project at supabase.com (free tier). Project name: `songstage`. Region: West EU or Central EU.
2. In Supabase SQL editor, run `supabase/migrations/0001_init.sql`.
3. Copy `app/.env.local.example` → `app/.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Settings → API).
4. ```sh
   cd app && npm install && npm run dev
   ```
5. Open http://localhost:3000.

## Prototype

Standalone playground for OnSong rendering + transposition + master/projector sync.

```sh
cd prototype && npm install && npm run dev
```
