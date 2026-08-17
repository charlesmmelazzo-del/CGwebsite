-- ═══════════════════════════════════════════════════════════════════════════
-- Pop Up Zone — arcade high scores
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds what the "High Scores" pop-up needs on top of db/popup-zone.sql:
--
--   * popup_cocktails.story     — the long-form paragraph shown under the
--                                 tasting notes on a cocktail's detail card.
--   * popup_cocktails.game_key  — which mini game belongs to this cocktail.
--                                 Looked up in
--                                 src/components/popup/games/registry.ts.
--                                 Null / unknown renders a "coming soon" panel.
--
--   * popup_game_scores         — one row per play-through.
--
-- Why a table rather than reusing popup_interactions: a high score decides a
-- real $15 gift card, so it needs to be queryable, indexable and auditable —
-- not a jsonb blob in an event log. This ONE table serves every game we ever
-- add (they're distinguished by game_key), so the "a new game needs no schema
-- change" property still holds. popup_interactions stays for incidental events.
--
-- Every play is kept rather than only the personal best, so a suspicious run
-- can be looked at before paying anyone. "Best score per guest" is computed at
-- read time in src/lib/popup/scores.ts.
--
-- Additive and idempotent — safe to run more than once.
-- Run db/popup-zone.sql first.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Cocktail detail + game link ───────────────────────────────────────────
alter table public.popup_cocktails add column if not exists story    text;
alter table public.popup_cocktails add column if not exists game_key text;


-- ─── Scores ────────────────────────────────────────────────────────────────
create table if not exists public.popup_game_scores (
  id           uuid        primary key default gen_random_uuid(),
  menu_id      uuid        not null references public.popup_menus(id)     on delete cascade,
  cocktail_id  uuid        references public.popup_cocktails(id)          on delete set null,
  user_id      uuid        references auth.users(id)                      on delete cascade,
  -- Which game was played. Kept even if the cocktail is later deleted, so a
  -- historical leaderboard doesn't evaporate.
  game_key     text        not null,
  score        integer     not null default 0,
  -- Anything the game wants to record about the run: rounds survived, the
  -- BPM reached, how it ended. Useful when sanity-checking a winning score.
  detail       jsonb       not null default '{}'::jsonb,
  -- Scores set from the admin sandbox. Never counted in a public leaderboard.
  is_test      boolean     not null default false,
  created_at   timestamptz not null default now()
);

do $$ begin
  alter table public.popup_game_scores
    add constraint popup_game_scores_score_sane
    -- A ceiling that no honest run can reach, so a tampered request can't
    -- park an absurd number at the top of the board forever.
    check (score >= 0 and score <= 10000000);
exception when duplicate_object then null; end $$;

-- Leaderboard reads: "every score for this game on this pop-up, best first."
create index if not exists popup_game_scores_board_idx
  on public.popup_game_scores (menu_id, game_key, is_test, score desc);

-- "This guest's own runs", for showing them their personal best.
create index if not exists popup_game_scores_user_idx
  on public.popup_game_scores (user_id, menu_id, game_key);


-- ─── Lock it down (matches db/enable-rls.sql) ──────────────────────────────
alter table public.popup_game_scores enable row level security;
