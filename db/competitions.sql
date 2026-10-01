-- ═══════════════════════════════════════════════════════════════════════════
-- Cocktail Competitions — live, host-run bartender competitions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One event = one night (or nights) of bartenders presenting cocktails made
-- with a brand partner's featured spirit, while guests and judges vote live
-- from their phones.
--
--   * comp_events       — the event itself: settings, rules text, field
--                          definitions, voting categories, tiers, at-home
--                          recipes, and the LIVE state the host drives.
--   * comp_sponsors     — the brand partner (and any co-sponsors). Each has a
--                          private link to submit their own brand profile.
--   * comp_contestants  — the bartenders. Each has a private link to submit
--                          their profile and cocktail.
--   * comp_codes        — one printed ticket code per attendee, in a tier
--                          (Judges, VIP, General…). Locked to the first device
--                          that signs in with it.
--   * comp_votes        — 1–5 star scores per category, one row per code per
--                          contestant. Editable until the host closes voting.
--   * comp_superlative_votes — one pick per code per superlative.
--
-- Everything is read and written from the server with the service-role key,
-- so RLS is enabled with no policies (matches db/enable-rls.sql).
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


create table if not exists public.comp_events (
  id                   uuid        primary key default gen_random_uuid(),
  slug                 text        not null unique,
  name                 text        not null,
  featured_spirit      text        not null default '',
  event_date           date,
  start_time           text        not null default '',
  arrival_time         text        not null default '',
  location             text        not null default 'Common Good Cocktail House, Glen Ellyn',
  contact_email        text        not null default 'hello@cgcocktails.com',
  intro                text        not null default '',
  accent_color         text        not null default '#C97D5A',
  -- draft → published (on the events page) → live (host has started) →
  -- finished (winners revealed; shown under Past Competitions)
  status               text        not null default 'draft',
  is_demo              boolean     not null default false,
  contestant_deadline  timestamptz,
  partner_deadline     timestamptz,
  rules_text           text        not null default '',
  bartender_fields     jsonb       not null default '[]'::jsonb,
  cocktail_fields      jsonb       not null default '[]'::jsonb,
  score_categories     jsonb       not null default '[]'::jsonb,
  superlatives         jsonb       not null default '[]'::jsonb,
  tiers                jsonb       not null default '[]'::jsonb,
  recipes              jsonb       not null default '[]'::jsonb,
  big_screen           boolean     not null default false,
  host_token           text        not null,
  live_state           jsonb       not null default '{}'::jsonb,
  live_version         integer     not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

do $$ begin
  alter table public.comp_events
    add constraint comp_events_status_check
    check (status in ('draft', 'published', 'live', 'finished'));
exception when duplicate_object then null; end $$;


create table if not exists public.comp_sponsors (
  id            uuid        primary key default gen_random_uuid(),
  event_id      uuid        not null references public.comp_events(id) on delete cascade,
  token         text        not null unique,
  sort          integer     not null default 0,
  is_primary    boolean     not null default false,
  label         text        not null default '',
  status        text        not null default 'invited',
  admin_note    text        not null default '',
  contact       jsonb       not null default '{}'::jsonb,
  profile       jsonb       not null default '{}'::jsonb,
  -- Lets the admin let one late partner back in without moving the deadline.
  reopened      boolean     not null default false,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists comp_sponsors_event_idx on public.comp_sponsors (event_id, sort);


create table if not exists public.comp_contestants (
  id            uuid        primary key default gen_random_uuid(),
  event_id      uuid        not null references public.comp_events(id) on delete cascade,
  token         text        not null unique,
  sort          integer     not null default 0,
  label         text        not null default '',
  status        text        not null default 'invited',
  admin_note    text        not null default '',
  contact       jsonb       not null default '{}'::jsonb,
  bartender     jsonb       not null default '{}'::jsonb,
  cocktail      jsonb       not null default '{}'::jsonb,
  agreed_at     timestamptz,
  -- The exact rules text they agreed to, in case the rules are edited later.
  agreed_rules  text,
  reopened      boolean     not null default false,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists comp_contestants_event_idx on public.comp_contestants (event_id, sort);

do $$ begin
  alter table public.comp_sponsors
    add constraint comp_sponsors_status_check
    check (status in ('invited', 'submitted', 'changes_requested', 'approved'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.comp_contestants
    add constraint comp_contestants_status_check
    check (status in ('invited', 'submitted', 'changes_requested', 'approved'));
exception when duplicate_object then null; end $$;


create table if not exists public.comp_codes (
  id             uuid        primary key default gen_random_uuid(),
  event_id       uuid        not null references public.comp_events(id) on delete cascade,
  code           text        not null,
  tier_id        text        not null,
  -- A judge's name, shown in the judges' reveal. Optional for other tiers.
  name           text        not null default '',
  -- Random secret held in the claiming device's cookie. A code is locked to
  -- the first device that signs in with it; the admin can reset it.
  device_secret  text,
  claimed_at     timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists comp_codes_event_code_idx on public.comp_codes (event_id, code);
create index if not exists comp_codes_tier_idx on public.comp_codes (event_id, tier_id);


create table if not exists public.comp_votes (
  id             uuid        primary key default gen_random_uuid(),
  event_id       uuid        not null references public.comp_events(id)      on delete cascade,
  code_id        uuid        not null references public.comp_codes(id)       on delete cascade,
  contestant_id  uuid        not null references public.comp_contestants(id) on delete cascade,
  scores         jsonb       not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

create unique index if not exists comp_votes_one_per_code on public.comp_votes (code_id, contestant_id);
create index if not exists comp_votes_event_idx on public.comp_votes (event_id, contestant_id);


create table if not exists public.comp_superlative_votes (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null references public.comp_events(id)      on delete cascade,
  code_id         uuid        not null references public.comp_codes(id)       on delete cascade,
  superlative_id  text        not null,
  contestant_id   uuid        not null references public.comp_contestants(id) on delete cascade,
  updated_at      timestamptz not null default now()
);

create unique index if not exists comp_superlative_votes_one_per_code
  on public.comp_superlative_votes (code_id, superlative_id);
create index if not exists comp_superlative_votes_event_idx
  on public.comp_superlative_votes (event_id, superlative_id);


-- ─── Lock it down (matches db/enable-rls.sql) ──────────────────────────────
alter table public.comp_events            enable row level security;
alter table public.comp_sponsors          enable row level security;
alter table public.comp_contestants       enable row level security;
alter table public.comp_codes             enable row level security;
alter table public.comp_votes             enable row level security;
alter table public.comp_superlative_votes enable row level security;
