-- Weekly recurring events.
--
-- A recurring event is stored as a SINGLE row. The site expands it at read time
-- into the next `recurrence_count` occurrences (see src/lib/recurrence.ts), so a
-- weekly event never turns into hundreds of rows in the events table.
--
--   recurrence       'none' (default) or 'weekly'
--   recurrence_day   0 = Sunday … 6 = Saturday
--   recurrence_count how many upcoming occurrences to show at once
--
-- start_date is the date the series begins; visible_until (if set) is the date
-- the series stops repeating.
--
-- Additive and idempotent — safe to run more than once.

alter table public.events add column if not exists recurrence       text     not null default 'none';
alter table public.events add column if not exists recurrence_day   smallint;
alter table public.events add column if not exists recurrence_count smallint;

-- Keep the data honest.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_recurrence_check'
  ) then
    alter table public.events
      add constraint events_recurrence_check
      check (recurrence in ('none', 'weekly'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'events_recurrence_day_check'
  ) then
    alter table public.events
      add constraint events_recurrence_day_check
      check (recurrence_day is null or recurrence_day between 0 and 6);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'events_recurrence_count_check'
  ) then
    alter table public.events
      add constraint events_recurrence_count_check
      check (recurrence_count is null or recurrence_count between 1 and 12);
  end if;
end $$;

-- Backfill any pre-existing rows that predate the default.
update public.events set recurrence = 'none' where recurrence is null;
