-- ═══════════════════════════════════════════════════════════════════════════
-- The Giving Tree (Christmas pop-up)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Three levels: organization → opportunity → pledge, plus one settings row.
-- See docs/giving-tree-spec.md and src/lib/givingTree.
--
--   * Every table has is_demo. Demo rows are only ever served to the admin
--     sandbox (/popup/preview/christmas), and the pop-up cannot go live or be
--     scheduled while any demo row exists (api/admin/popup/status).
--
--   * Pledges made from the sandbox are always is_demo, so "Wipe demo data"
--     clears test pledges too.
--
--   * No raw IP address is stored: ip_hash is a salted SHA-256.
--
--   * RLS is on with no policies, matching db/enable-rls.sql. Only the server
--     (service-role key) reads or writes these tables.
--
-- Also creates the Christmas pop-up itself as a DRAFT with three placeholder
-- recipe cards. A draft is invisible to the public; nothing here makes
-- anything live.
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Organizations ─────────────────────────────────────────────────────────
create table if not exists public.giving_tree_orgs (
  id                    uuid        primary key default gen_random_uuid(),
  slug                  text        not null unique,
  name                  text        not null,
  description           text,
  logo_url              text,
  -- Public contact details: each shown on Our Partners only when filled in.
  website               text,
  public_phone          text,
  public_email          text,
  public_address        text,
  -- When true the address is never shown publicly, even if one is stored.
  hide_address          boolean     not null default false,
  social_links          jsonb       not null default '[]'::jsonb,
  -- Admin only.
  public_contact_note   text,
  admin_contact_name    text,
  admin_contact_email   text,
  show_on_partners      boolean     not null default true,
  sort_order            integer     not null default 0,
  is_demo               boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);


-- ─── Opportunities ─────────────────────────────────────────────────────────
create table if not exists public.giving_tree_opportunities (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null references public.giving_tree_orgs(id) on delete cascade,
  type                  text        not null,            -- volunteer | gift | cash
  title                 text        not null,
  description           text,
  details               text,                            -- policies, shown before confirming
  status                text        not null default 'draft',  -- draft | live | closed
  deadline              date,
  spots                 integer     not null default 1,
  tree_zone             text,                            -- volunteer | gift | cash (defaults to type)
  tree_x                real,                            -- 0–100 across the tree, null = auto
  tree_y                real,                            -- 0–100 down the tree, null = auto
  sort_order            integer     not null default 0,
  -- Volunteer
  hours_mode            text,                            -- fixed | choose
  hours_fixed           real,
  hours_min             real,
  hours_max             real,
  event_date            date,
  start_time            text,                            -- HH:MM, Central
  end_time              text,
  location              text,
  requirements          text,
  -- Gift
  dropoff_instructions  text,
  -- Cash
  goal_amount           numeric(12,2),
  give_url              text,
  confirmed_raised      numeric(12,2),
  confirmed_as_of       date,
  is_demo               boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

do $$ begin
  alter table public.giving_tree_opportunities
    add constraint giving_tree_opp_type_check check (type in ('volunteer', 'gift', 'cash'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.giving_tree_opportunities
    add constraint giving_tree_opp_status_check check (status in ('draft', 'live', 'closed'));
exception when duplicate_object then null; end $$;

create index if not exists giving_tree_opp_org_idx on public.giving_tree_opportunities (org_id);


-- ─── Pledges ───────────────────────────────────────────────────────────────
create table if not exists public.giving_tree_pledges (
  id                    uuid        primary key default gen_random_uuid(),
  opportunity_id        uuid        not null references public.giving_tree_opportunities(id) on delete cascade,
  code                  text        not null unique,     -- 6 chars, no look-alikes
  manage_token          text        not null unique,     -- long random, for the self-service link
  name                  text        not null,
  email                 text,                            -- required on the web; optional for manual
  phone                 text,                            -- volunteer only; deleted at season close
  display_mode          text        not null default 'named',  -- named | anonymous
  display_name          text,
  note                  text,
  show_gift             boolean     not null default true,
  show_amount           boolean     not null default true,
  hours                 real,
  amount                numeric(12,2),
  status                text        not null default 'pledged',
  hold                  text        not null default 'none',
  hidden                boolean     not null default false,
  due_date              date,
  reminder_at           timestamptz,
  reminder_sent_at      timestamptz,
  guest_response        text,                            -- still_on_it | more_time
  extended_once         boolean     not null default false,
  released_at           timestamptz,
  release_reason        text,                            -- guest | auto | admin
  overdue_flagged_at    timestamptz,
  received_at           timestamptz,
  delivered_at          timestamptz,
  ornament              text        not null default 'to_write',  -- to_write | hung
  hung_at               timestamptz,
  source                text        not null default 'web',       -- web | manual
  consent_share         boolean     not null default false,
  consent_at            timestamptz,
  ip_hash               text,
  is_demo               boolean     not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

do $$ begin
  alter table public.giving_tree_pledges
    add constraint giving_tree_pledge_status_check
    check (status in ('pledged', 'received', 'delivered', 'released', 'not_received'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.giving_tree_pledges
    add constraint giving_tree_pledge_hold_check
    check (hold in ('none', 'held_moderation', 'held_amount', 'denied'));
exception when duplicate_object then null; end $$;

create index if not exists giving_tree_pledges_opp_idx   on public.giving_tree_pledges (opportunity_id);
create index if not exists giving_tree_pledges_email_idx on public.giving_tree_pledges (lower(email));


-- ─── Settings (one row) ────────────────────────────────────────────────────
create table if not exists public.giving_tree_settings (
  id          integer     primary key default 1,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint giving_tree_settings_one_row check (id = 1)
);
insert into public.giving_tree_settings (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;


-- ─── Row level security: on, no policies (server-only access) ──────────────
alter table public.giving_tree_orgs          enable row level security;
alter table public.giving_tree_opportunities enable row level security;
alter table public.giving_tree_pledges       enable row level security;
alter table public.giving_tree_settings      enable row level security;


-- ─── The Christmas pop-up, as a DRAFT ──────────────────────────────────────
-- Draft = not public, no launch date. Open it at /popup/preview/christmas.
-- Going live is done by hand in Admin → Pop Ups, and is refused while any
-- demo data exists.
insert into public.popup_menus (slug, title, subtitle, template_key, status)
values ('christmas', 'The Giving Tree', 'Christmas at Common Good', 'giving-tree', 'draft')
on conflict (slug) do nothing;

-- Placeholder recipe cards (the Christmas menu isn't chosen yet). Only added
-- when the pop-up has no cocktails, so re-running never duplicates them.
insert into public.popup_cocktails (menu_id, name, tagline, "order", active, meta)
select m.id, v.name, 'Placeholder until the Christmas menu is set', v.ord, true,
       jsonb_build_object('recipePdfUrl', '/popup/giving-tree/placeholder-recipe.pdf')
from public.popup_menus m
cross join (values ('Christmas cocktail one', 0), ('Christmas cocktail two', 1), ('Christmas cocktail three', 2)) as v(name, ord)
where m.slug = 'christmas'
  and not exists (select 1 from public.popup_cocktails c where c.menu_id = m.id);
