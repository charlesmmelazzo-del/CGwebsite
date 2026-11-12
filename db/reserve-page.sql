-- Reserve page content (title, photo, intro, FAQ) edited at /admin/reserve.
-- Single row, same pattern as site_settings. Reservation data itself lives in
-- the CG Bible; nothing about guests or bookings is stored here.
--
-- RLS on with no policies: only the server's service-role client reads or
-- writes it (see db/enable-rls.sql). Safe to run more than once.

create table if not exists reserve_page (
  id integer primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  constraint reserve_page_single_row check (id = 1)
);
alter table reserve_page enable row level security;
