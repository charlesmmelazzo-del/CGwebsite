-- ═══════════════════════════════════════════════════════════════════════════
-- Pop Up Zone — a ticket unlocks its game and carries three High Score Runs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Before: one raffle ticket = one High Score Run.
-- Now:    entering a ticket UNLOCKS that cocktail's game for the guest
--         (unlimited free play instead of the 90-second demo) and gives them
--         THREE High Score Runs on it.
--
--   * popup_ticket_redemptions  — still one row per serial ever entered, and
--                                 still unique per pop-up. Now means "this
--                                 guest unlocked this game with this ticket".
--                                 runs_allowed says how many runs it carries.
--   * popup_ticket_runs         — NEW. One row per High Score Run started on a
--                                 ticket. A run is spent the moment it STARTS.
--   * popup_game_scores.run_id  — the run a score was played on; one score per
--                                 run. redemption_id stays set too, so the
--                                 public boards keep working unchanged.
--
-- Additive and idempotent — safe to run more than once.
-- Run db/popup-tickets.sql first.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── How many runs a ticket carries ────────────────────────────────────────
alter table public.popup_ticket_redemptions
  add column if not exists runs_allowed smallint not null default 3;


-- ─── Runs ──────────────────────────────────────────────────────────────────
create table if not exists public.popup_ticket_runs (
  id             uuid        primary key default gen_random_uuid(),
  redemption_id  uuid        not null references public.popup_ticket_redemptions(id) on delete cascade,
  menu_id        uuid        not null references public.popup_menus(id)              on delete cascade,
  user_id        uuid        not null references auth.users(id)                      on delete cascade,
  game_key       text        not null,
  -- 1, 2 or 3. Unique per ticket, so two phones racing can't both take run 3.
  run_number     smallint    not null,
  started_at     timestamptz not null default now(),
  -- Set when the run's score is saved. Null means the run never finished.
  completed_at   timestamptz
);

create unique index if not exists popup_ticket_runs_one_number
  on public.popup_ticket_runs (redemption_id, run_number);

create index if not exists popup_ticket_runs_user_idx
  on public.popup_ticket_runs (user_id, menu_id);


-- ─── Scores remember their run ─────────────────────────────────────────────
alter table public.popup_game_scores
  add column if not exists run_id uuid
  references public.popup_ticket_runs(id) on delete set null;

create unique index if not exists popup_game_scores_one_per_run
  on public.popup_game_scores (run_id) where run_id is not null;

-- A ticket now has up to three scores, so the old one-score-per-ticket rule goes.
drop index if exists public.popup_game_scores_one_per_ticket;


-- ─── Tickets already played under the old rules ────────────────────────────
-- Each counts as its first run, so nobody gets a free extra run retroactively
-- beyond the two the new rules give them.
insert into public.popup_ticket_runs (redemption_id, menu_id, user_id, game_key, run_number, started_at, completed_at)
select r.id, r.menu_id, r.user_id, r.game_key, 1, r.redeemed_at, r.completed_at
from public.popup_ticket_redemptions r
where not exists (select 1 from public.popup_ticket_runs x where x.redemption_id = r.id);

update public.popup_game_scores s
set run_id = x.id
from public.popup_ticket_runs x
where s.redemption_id = x.redemption_id
  and x.run_number = 1
  and s.run_id is null;


-- ─── Lock it down (matches db/enable-rls.sql) ──────────────────────────────
alter table public.popup_ticket_runs enable row level security;
