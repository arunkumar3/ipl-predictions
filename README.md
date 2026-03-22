# IPL Predict 2026 — Prediction League

A real-time prediction league for IPL 2026. Built for a friend group of 4.

## Tech Stack
- React 18 + Vite + Tailwind CSS v4
- Supabase (PostgreSQL + Realtime + Edge Functions)
- Framer Motion for animations
- Deployed on Vercel

## Setup
1. Clone the repo
2. Copy `.env.example` to `.env` and fill in Supabase credentials
3. `npm install && npm run dev`

## Supabase Setup
1. Create a Supabase project
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
3. Run `supabase/migrations/002_admin_rpc.sql` in SQL Editor
4. Run `supabase/seed.sql` to populate matches and players
5. Enable Realtime on `matches` and `predictions` tables
6. Deploy the Edge Function: `supabase functions deploy fetch-results`
7. Set up cron for auto-fetching results (see below)

## ESPN Auto-Fetch
The Edge Function at `supabase/functions/fetch-results/` polls ESPN API for match results.

### Cron Setup
1. Enable `pg_cron` and `pg_net` extensions in Supabase Dashboard
2. Run in SQL Editor:
```sql
SELECT cron.schedule(
  'fetch-ipl-results',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/fetch-results',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Adding More Matches
When BCCI announces remaining fixtures:
1. Add INSERT statements to seed.sql
2. Run the new INSERTs in Supabase SQL Editor
3. No frontend changes needed — matches load dynamically

## Manual Result Entry
Visit `/admin?key=ipl2026admin` to manually set match results.

## Pages
- `/` — Match predictions (main page)
- `/leaderboard` — Rankings with podium visualization
- `/match/:id` — Match details with all predictions
- `/stats` — Personal analytics dashboard
- `/more` — Settings, rules, sharing
- `/admin?key=ipl2026admin` — Admin panel

## Credits
Built by Shalini with Claude AI
