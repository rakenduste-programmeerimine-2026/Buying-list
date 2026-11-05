# Buying-list

## Keskkonnamuutujad (Supabase)

1. Kopeeri näidisfail: `cp .env.example .env.local`
2. Täida `.env.local` väärtustega Supabase Dashboardist (Project Settings → API).
3. `.env.local` on `.gitignore`-is, seda ei commitita.

`SUPABASE_SERVICE_ROLE_KEY` on ainult serveri jaoks ja ei tohi kunagi saada `NEXT_PUBLIC_` eesliidet.
