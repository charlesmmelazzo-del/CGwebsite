-- ═══════════════════════════════════════════════════════════════════════════
-- Menu + Coffee: PDF menus
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Lets a menu tab show an uploaded printed menu (e.g. 4.25x11 cards with many
-- cocktails per page) instead of individual cocktail cards.
--
--   kind       'cocktails' (the original behaviour) or 'pdf'
--   pdf_url    the original PDF in the images bucket, offered as a download
--   pdf_pages  [{ url, width, height }] — each page rendered to a WebP in the
--              admin at upload time, so guests never need a PDF viewer
--
-- coffee_menus gets the same pdf_url / pdf_pages pair: a coffee menu shows
-- its PDF pages when it has them, otherwise its image as before.
--
-- Additive and idempotent — safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

alter table menu_tabs add column if not exists kind text not null default 'cocktails';
alter table menu_tabs add column if not exists pdf_url text;
alter table menu_tabs add column if not exists pdf_pages jsonb;

alter table coffee_menus add column if not exists pdf_url text;
alter table coffee_menus add column if not exists pdf_pages jsonb;
