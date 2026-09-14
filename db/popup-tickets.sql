-- ═══════════════════════════════════════════════════════════════════════════
-- Pop Up Zone — raffle-ticket high score runs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A high score only counts when it was played on a ticket. Every cocktail
-- comes with a physical raffle ticket; its serial number buys exactly one
-- "High Score Run" on one game. Free play needs no ticket and records nothing.
--
--   * popup_ticket_ranges       — serial ranges the owner enters in the admin
--                                 panel, each valid for one cocktail's game.
--   * popup_ticket_redemptions  — one row per serial ever used. The ticket is
--                                 spent the moment the run STARTS, so quitting
--                                 or reloading a bad run can't win it back.
--   * popup_game_scores.redemption_id — the ticket a score was played on. The
--                                 public boards only count scores that have one.
--
-- Additive and idempotent — safe to run more than once.
-- Run db/popup-zone.sql and db/popup-high-scores.sql first.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Serial ranges ─────────────────────────────────────────────────────────
create table if not exists public.popup_ticket_ranges (
  id            uuid        primary key default gen_random_uuid(),
  menu_id       uuid        not null references public.popup_menus(id)     on delete cascade,
  cocktail_id   uuid        not null references public.popup_cocktails(id) on delete cascade,
  start_serial  bigint      not null,
  end_serial    bigint      not null,
  -- Lets the owner pause a roll without deleting it.
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

do $$ begin
  alter table public.popup_ticket_ranges
    add constraint popup_ticket_ranges_order check (start_serial >= 0 and start_serial <= end_serial);
exception when duplicate_object then null; end $$;

create index if not exists popup_ticket_ranges_menu_idx
  on public.popup_ticket_ranges (menu_id, start_serial);


-- ─── Redemptions ───────────────────────────────────────────────────────────
create table if not exists public.popup_ticket_redemptions (
  id            uuid        primary key default gen_random_uuid(),
  menu_id       uuid        not null references public.popup_menus(id)     on delete cascade,
  cocktail_id   uuid        references public.popup_cocktails(id)          on delete set null,
  range_id      uuid        references public.popup_ticket_ranges(id)      on delete set null,
  user_id       uuid        not null references auth.users(id)             on delete cascade,
  serial        bigint      not null,
  game_key      text        not null,
  redeemed_at   timestamptz not null default now(),
  -- Set when the run's score is saved. Null means the run never finished.
  completed_at  timestamptz
);

-- The rule that makes a ticket worth one play, enforced by the database: a
-- serial can be redeemed once per pop-up, even if two phones race for it.
create unique index if not exists popup_ticket_redemptions_one_use
  on public.popup_ticket_redemptions (menu_id, serial);

create index if not exists popup_ticket_redemptions_user_idx
  on public.popup_ticket_redemptions (user_id, menu_id);


-- ─── Scores remember their ticket ──────────────────────────────────────────
alter table public.popup_game_scores
  add column if not exists redemption_id uuid
  references public.popup_ticket_redemptions(id) on delete set null;

-- One score per ticket.
create unique index if not exists popup_game_scores_one_per_ticket
  on public.popup_game_scores (redemption_id) where redemption_id is not null;


-- ─── Lock it down (matches db/enable-rls.sql) ──────────────────────────────
alter table public.popup_ticket_ranges      enable row level security;
alter table public.popup_ticket_redemptions enable row level security;
