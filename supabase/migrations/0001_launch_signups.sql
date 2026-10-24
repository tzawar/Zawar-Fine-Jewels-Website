-- ZAWAR Fine Jewels — launch "notify me" sign-ups
-- Run once in Supabase → SQL Editor (or via the Supabase GitHub integration).

create table if not exists public.launch_signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text not null default 'launching-soon',
  country     text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint launch_signups_email_format check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  constraint launch_signups_email_lower  check (email = lower(email))
);

-- One row per email address
create unique index if not exists launch_signups_email_key on public.launch_signups (email);
create index if not exists launch_signups_created_at_idx on public.launch_signups (created_at desc);

-- Lock the table down: nobody can read or write it from the browser.
-- Only the website's Worker (using the service_role key) can insert.
alter table public.launch_signups enable row level security;
revoke all on public.launch_signups from anon, authenticated;

comment on table public.launch_signups is 'Emails collected from the zawarfinejewels.com launching-soon page';
