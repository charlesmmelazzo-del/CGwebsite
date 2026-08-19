-- ─────────────────────────────────────────────────────────────────────────────
-- Pop Up Zone — Tiki Wars progression
--
-- The first stateful thing in the arcade. Behind the Stick and Top Shelf are
-- pure client-side: a run happens in memory and one number is posted at the
-- end. Tiki Wars keeps money, armor, luck and a running score ACROSS runs, so
-- it needs a save file per guest.
--
-- Why scoped to a menu (a pop-up) rather than global: a returning regular who
-- maxed out at one pop-up would otherwise arrive at the next one with 100% luck
-- and full armor, and no new guest could touch the leaderboard. Every pop-up
-- starts everyone level.
--
-- What does NOT live here: health, guns and helpers, which reset every stage.
-- See docs/tiki-wars.md for the full persistence table.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.popup_tiki_progress (
  user_id      uuid        not null references auth.users(id)          on delete cascade,
  menu_id      uuid        not null references public.popup_menus(id)  on delete cascade,

  money        integer     not null default 0,
  -- 0..10 slots. Absorbs a whole hit each and does NOT refill on its own —
  -- it has to be re-bought in the shop.
  armor        integer     not null default 0,
  -- 0..100 in steps of 10. Raises the frequency and strength of good gates.
  luck         integer     not null default 0,
  -- Deepest stage reached, which sets the difficulty floor for the next run so
  -- a maxed guest cannot farm trivial early waves for free points.
  best_stage   integer     not null default 1,
  -- Cumulative across every run at this pop-up. This is the leaderboard number.
  total_score  integer     not null default 0,
  runs         integer     not null default 0,

  updated_at   timestamptz not null default now(),

  primary key (user_id, menu_id)
);

do $$ begin
  alter table public.popup_tiki_progress
    add constraint popup_tiki_progress_sane
    check (
      money       >= 0
      and armor   between 0 and 10
      and luck    between 0 and 100
      and best_stage >= 1
      -- Mirrors the cap on popup_game_scores. Clamped by the API, never
      -- rejected, so a great run is never silently lost.
      and total_score between 0 and 10000000
      and runs    >= 0
    );
exception when duplicate_object then null; end $$;

-- ─── Lock it down (matches db/enable-rls.sql) ──────────────────────────────
-- No policies: reads and writes go through the service role in the API route,
-- which is the only place that knows which guest is asking.
alter table public.popup_tiki_progress enable row level security;
