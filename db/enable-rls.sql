-- Enable Row-Level Security on every table in the public schema.
--
-- Context: This app accesses Supabase exclusively from the server using the
-- SERVICE ROLE key (see src/lib/supabase.ts -> getSupabaseAdmin). The service
-- role bypasses RLS, so enabling RLS does NOT affect the website or admin panel.
--
-- With RLS enabled and NO policies added, the anonymous/authenticated API roles
-- get zero access to these tables through Supabase's auto-generated REST API,
-- which closes the "RLS Disabled in Public" security-advisor errors.
--
-- Safe to run multiple times (idempotent).

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', t.tablename);
  end loop;
end $$;
