-- Admin panel users: extra sign-ins for staff, created by the main admin at
-- /admin/users (General Settings → Users).
--
-- The main admin is NOT stored here — that sign-in is still the ADMIN_PASSWORD
-- environment variable, so it can never be locked out or deleted from the panel.
--
-- Passwords are stored as salted scrypt hashes, never as text. Bumping
-- session_version signs that user out everywhere (done on a password reset);
-- deleting the row revokes access immediately.
--
-- RLS on with no policies: only the server's service-role client reads or
-- writes it (see db/enable-rls.sql). Safe to run more than once.

create table if not exists public.admin_users (
  id              uuid        primary key default gen_random_uuid(),
  username        text        not null,
  name            text        not null default '',
  password_hash   text        not null,
  session_version integer     not null default 1,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

create unique index if not exists admin_users_username
  on public.admin_users (lower(username));

alter table public.admin_users enable row level security;
