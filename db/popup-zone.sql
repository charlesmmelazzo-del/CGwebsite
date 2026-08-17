-- ═══════════════════════════════════════════════════════════════════════════
-- Common Good Pop Up Zone
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A members-only area (linked only from the footer) where guests sign in, view
-- the current pop-up cocktail menu, and vote on their favorites.
--
-- Design notes:
--
--   * Guest accounts live in Supabase Auth (auth.users). popup_profiles holds
--     the extra fields we collect — name and date of birth — keyed 1:1 on the
--     auth user id. This is completely separate from the ADMIN_PASSWORD login
--     that protects /admin.
--
--   * popup_menus.status + go_live_at are resolved AT READ TIME (see
--     src/lib/popup/menus.ts -> resolveLiveMenu). A menu scheduled for a future
--     time becomes live on the first page load after that time passes, so
--     scheduled launches need no cron job.
--
--   * popup_interactions is a deliberately generic event log. Future pop-up
--     templates (trivia rounds, per-cocktail mini games) record their results
--     here via a `kind` + jsonb `payload`, so new interactive formats never
--     require a schema change.
--
--   * RLS is enabled with NO policies, matching db/enable-rls.sql. All access
--     is server-side through the service-role client, which bypasses RLS. This
--     means the anon key cannot read or write these tables directly.
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Pop-up menus ──────────────────────────────────────────────────────────
create table if not exists public.popup_menus (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        not null unique,
  title            text        not null,
  subtitle         text,
  description      text,

  -- Which experience template renders this pop-up. Looked up in
  -- src/components/popup/templates/registry.ts; falls back to 'classic'.
  template_key     text        not null default 'classic',
  -- Free-form per-template settings. Shape is owned by the template.
  config           jsonb       not null default '{}'::jsonb,

  status           text        not null default 'draft',
  go_live_at       timestamptz,
  archived_at      timestamptz,

  -- Voting rules, editable per pop-up from the admin panel.
  -- vote_weights[i] is the point value of a rank-i vote.
  vote_rank_depth  smallint    not null default 3,
  vote_weights     integer[]   not null default '{3,2,1}',
  voting_enabled   boolean     not null default true,

  -- Presentation
  bg_color         text,
  text_color       text,
  accent_color     text,
  cover_image_url  text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Columns added after the first release go here as `add column if not exists`.
alter table public.popup_menus add column if not exists voting_enabled boolean not null default true;
alter table public.popup_menus add column if not exists cover_image_url text;

do $$ begin
  alter table public.popup_menus
    add constraint popup_menus_status_check
    check (status in ('draft', 'scheduled', 'live', 'archived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.popup_menus
    add constraint popup_menus_rank_depth_check
    check (vote_rank_depth between 1 and 10);
exception when duplicate_object then null; end $$;

-- A scheduled pop-up is meaningless without a launch time.
do $$ begin
  alter table public.popup_menus
    add constraint popup_menus_scheduled_needs_time
    check (status <> 'scheduled' or go_live_at is not null);
exception when duplicate_object then null; end $$;

create index if not exists popup_menus_status_idx  on public.popup_menus (status);
create index if not exists popup_menus_golive_idx  on public.popup_menus (go_live_at desc nulls last);


-- ─── Cocktails within a pop-up ─────────────────────────────────────────────
create table if not exists public.popup_cocktails (
  id            uuid        primary key default gen_random_uuid(),
  menu_id       uuid        not null references public.popup_menus(id) on delete cascade,
  name          text        not null,
  tagline       text,
  description   text,
  ingredients   text,
  image_url     text,
  "order"       integer     not null default 0,
  active        boolean     not null default true,
  -- Template-specific payload: trivia question + answers, mini-game config, etc.
  meta          jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists popup_cocktails_menu_idx on public.popup_cocktails (menu_id, "order");


-- ─── Guest profiles (1:1 with auth.users) ──────────────────────────────────
create table if not exists public.popup_profiles (
  id             uuid        primary key references auth.users(id) on delete cascade,
  email          text,
  first_name     text,
  last_name      text,
  date_of_birth  date,
  -- Set true only when the server computed age >= 21 from date_of_birth.
  -- Never written from client input.
  age_verified   boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);


-- ─── Votes ─────────────────────────────────────────────────────────────────
-- One row per (guest, cocktail) pick. rank 1 = favorite.
create table if not exists public.popup_votes (
  id           uuid        primary key default gen_random_uuid(),
  menu_id      uuid        not null references public.popup_menus(id)    on delete cascade,
  user_id      uuid        not null references auth.users(id)            on delete cascade,
  cocktail_id  uuid        not null references public.popup_cocktails(id) on delete cascade,
  rank         smallint    not null default 1,
  -- Votes cast from the admin sandbox. Excluded from every public result.
  is_test      boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  alter table public.popup_votes
    add constraint popup_votes_rank_positive check (rank >= 1);
exception when duplicate_object then null; end $$;

-- ── The two rules that make the ballot honest, enforced by the database ────
-- These hold even if the application layer is ever wrong.

-- A guest cannot vote for the same cocktail twice on the same pop-up.
create unique index if not exists popup_votes_one_per_cocktail
  on public.popup_votes (menu_id, user_id, cocktail_id, is_test);

-- A guest cannot put two cocktails in the same rank slot.
create unique index if not exists popup_votes_one_per_rank
  on public.popup_votes (menu_id, user_id, rank, is_test);

create index if not exists popup_votes_menu_idx on public.popup_votes (menu_id, is_test);


-- ─── Interaction log (extensibility hook) ──────────────────────────────────
-- Every future interactive element writes here instead of getting its own table.
--   kind    e.g. 'trivia_answer', 'game_score', 'card_flip'
--   payload whatever that element needs to record
create table if not exists public.popup_interactions (
  id           uuid        primary key default gen_random_uuid(),
  menu_id      uuid        not null references public.popup_menus(id)     on delete cascade,
  cocktail_id  uuid        references public.popup_cocktails(id)          on delete cascade,
  user_id      uuid        references auth.users(id)                      on delete cascade,
  kind         text        not null,
  payload      jsonb       not null default '{}'::jsonb,
  is_test      boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists popup_interactions_menu_idx on public.popup_interactions (menu_id, kind, created_at desc);
create index if not exists popup_interactions_user_idx on public.popup_interactions (user_id, menu_id);


-- ─── Lock everything down ──────────────────────────────────────────────────
-- RLS on, no policies: the anon/authenticated roles get zero direct access.
-- The server's service-role client bypasses RLS, so the app is unaffected.
alter table public.popup_menus        enable row level security;
alter table public.popup_cocktails    enable row level security;
alter table public.popup_profiles     enable row level security;
alter table public.popup_votes        enable row level security;
alter table public.popup_interactions enable row level security;
