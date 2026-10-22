-- ═══════════════════════════════════════════════════════════════════════════
-- Home for the Holidays — game rooms
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One row per game someone hosts from the Home for the Holidays pop-up. The
-- host gets a 4-digit code, friends join with it on their own phones, and
-- every phone polls this row to stay in sync.
--
-- No accounts: each player holds a random token (kept on their phone) that
-- the server matches against `players`. The tokens never leave the server in
-- a reply.
--
-- `version` is bumped on every change. A write only lands if the version it
-- read is still current, so two taps arriving together can't overwrite each
-- other (the loser is re-applied on fresh state).
--
-- Only the server (service-role key) touches this table. RLS is on with no
-- policies, so the public anon key can neither read nor write it.
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.holiday_rooms (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null,
  game_key    text        not null,
  -- lobby → playing → ended
  status      text        not null default 'lobby',
  -- [{ id, token, name, team, host, joinedAt }]
  players     jsonb       not null default '[]'::jsonb,
  -- The game's own state, owned by src/lib/holidays/games/<game>.ts
  state       jsonb,
  version     integer     not null default 0,
  menu_id     uuid,
  sandbox     boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A code belongs to one open room at a time. Ended rooms free their code.
create unique index if not exists holiday_rooms_open_code
  on public.holiday_rooms (code) where status <> 'ended';

create index if not exists holiday_rooms_updated
  on public.holiday_rooms (updated_at);

alter table public.holiday_rooms enable row level security;
