-- Remove all RLS policies from tables in the public schema.
--
-- Context: This app accesses Supabase exclusively from the server using the
-- SERVICE ROLE key (see src/lib/supabase.ts -> getSupabaseAdmin), which bypasses
-- RLS. No client/anon-key access exists, so NO policies are needed.
--
-- Auto-generated "Service role full access" policies using `USING (true)` /
-- `WITH CHECK (true)` trip the `rls_policy_always_true` linter warning and are
-- unnecessary here. Dropping them returns tables to the correct end state:
-- RLS enabled, zero policies -> anon/authenticated denied, service role works.
--
-- Run enable-rls.sql first (or alongside) to ensure RLS stays enabled.
-- Safe to run multiple times (idempotent).

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I;', p.policyname, p.tablename);
  end loop;
end $$;
