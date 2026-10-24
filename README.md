# ZAWAR Fine Jewels — website

Launching-soon site for **zawarfinejewels.com** (with **zawarfinejewels.in** and both `www.` versions redirecting to it).

- `public/` — the site (HTML, logo film, logos, icons)
- `src/worker.js` — Cloudflare Worker: serves the site, redirects `.in`/`www` → `.com`, saves "Notify me" sign-ups to Supabase via `POST /api/notify`, serves the video in a way iPhone Safari can play
- `supabase/migrations/0001_launch_signups.sql` — the `launch_signups` table (locked down; only the Worker can write)
- `wrangler.toml` — Worker config (name `zawar-website`)

Stack: GitHub → Cloudflare Workers (auto-deploy on push to `main`) → Supabase.

## Secrets (Cloudflare → Workers & Pages → zawar-website → Settings → Variables and Secrets)

| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | Text | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase → Project Settings → API Keys → `service_role` (secret) key |

Never put the service-role key in `public/` or commit it to the repo.

## Seeing the sign-ups

Supabase → Table Editor → `launch_signups`. Export to CSV from there when it's time to send the launch announcement.

## Local preview

```
npm install
# create .dev.vars with SUPABASE_URL=... and SUPABASE_SERVICE_ROLE_KEY=...
npm run dev
```

## Fonts

Headings use Gilda Display and body text uses Jost (free Google Fonts) as stand-ins for the brand fonts Canela Text and Futura PT. When web licences for the brand fonts are available, add the font files under `public/fonts/` and update the `--serif` / `--sans` variables in `public/index.html`.
