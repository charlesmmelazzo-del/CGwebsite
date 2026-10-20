-- ═══════════════════════════════════════════════════════════════════════════
-- Marketing — email sign-ups
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Emails guests hand over to hear about future pop-ups and Common Good news —
-- first from the bartender in Cocktail Creepypastas, later from anywhere else
-- on the site. The admin Marketing page merges these with Pop Up Zone guest
-- accounts, removes duplicates, and exports a CSV for Mailchimp.
--
-- One row per address: `email` is stored trimmed and lower-cased, and the
-- unique index means signing up twice simply does nothing.
--
-- Only the server (service-role key) touches this table. RLS is on with no
-- policies, so the public anon key can neither read nor write it.
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.marketing_subscribers (
  id          uuid        primary key default gen_random_uuid(),
  email       text        not null,
  -- Where they signed up, e.g. "popup:cocktail-creepypastas".
  source      text        not null default 'site',
  created_at  timestamptz not null default now()
);

create unique index if not exists marketing_subscribers_email_key
  on public.marketing_subscribers (email);

do $$ begin
  alter table public.marketing_subscribers
    add constraint marketing_subscribers_email_lower check (email = lower(btrim(email)));
exception when duplicate_object then null; end $$;

alter table public.marketing_subscribers enable row level security;
