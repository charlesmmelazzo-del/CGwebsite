-- ═══════════════════════════════════════════════════════════════════════════
-- Coffee 01: the coffee page's menu, live from Toast
-- ═══════════════════════════════════════════════════════════════════════════
--
-- coffee_menus.live   per tab: which Toast sections / items it shows, renamed
--                     headings, note lines, hidden sections / items, order,
--                     and the "Show PDF instead" switch (see src/lib/coffee/live.ts).
--
-- coffee_menu_feed    the last good copy of the Bible's guest-safe Coffee Shop
--                     feed (names, descriptions, prices only), so the page
--                     never goes blank if the Bible can't be reached. Single row.
--
-- RLS on with no policies: only the server's service-role client reads or
-- writes them (see db/enable-rls.sql). Additive and idempotent — safe to run
-- more than once.
-- ═══════════════════════════════════════════════════════════════════════════

alter table coffee_menus add column if not exists live jsonb;

create table if not exists coffee_menu_feed (
  id integer primary key default 1,
  data jsonb not null default '{}'::jsonb,
  hash text,
  saved_at timestamptz default now(),
  constraint coffee_menu_feed_single_row check (id = 1)
);
alter table coffee_menu_feed enable row level security;
