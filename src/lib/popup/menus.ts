// ─── Pop Up Zone — menu lifecycle ────────────────────────────────────────────
//
// Which pop-up is live is RESOLVED AT READ TIME rather than flipped by a
// scheduled job. A pop-up set to `scheduled` with a future go_live_at simply
// becomes the live one on the first page load after that moment passes, and
// the previous pop-up becomes archived with voting closed.
//
// That matters because the site runs on Railway with no cron scheduler — the
// owner can set a launch date and it works, with nothing to keep running.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PopupCocktail, PopupMenu, PopupStatus } from "./types";

const DEFAULT_WEIGHTS = [3, 2, 1];

function mapMenu(r: Record<string, unknown>): PopupMenu {
  const weights = Array.isArray(r.vote_weights) ? (r.vote_weights as number[]) : DEFAULT_WEIGHTS;
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title ?? ""),
    subtitle: (r.subtitle as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    templateKey: (r.template_key as string) || "classic",
    config: (r.config as Record<string, unknown>) ?? {},
    status: (r.status as PopupStatus) ?? "draft",
    goLiveAt: (r.go_live_at as string) ?? undefined,
    archivedAt: (r.archived_at as string) ?? undefined,
    voteRankDepth: Number(r.vote_rank_depth ?? 3),
    voteWeights: weights.length ? weights : DEFAULT_WEIGHTS,
    votingEnabled: r.voting_enabled !== false,
    bgColor: (r.bg_color as string) ?? undefined,
    textColor: (r.text_color as string) ?? undefined,
    accentColor: (r.accent_color as string) ?? undefined,
    coverImageUrl: (r.cover_image_url as string) ?? undefined,
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

function mapCocktail(r: Record<string, unknown>): PopupCocktail {
  return {
    id: String(r.id),
    menuId: String(r.menu_id),
    name: String(r.name ?? ""),
    tagline: (r.tagline as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    ingredients: (r.ingredients as string) ?? undefined,
    story: (r.story as string) ?? undefined,
    imageUrl: (r.image_url as string) ?? undefined,
    gameKey: (r.game_key as string) ?? undefined,
    order: Number(r.order ?? 0),
    active: r.active !== false,
    meta: (r.meta as Record<string, unknown>) ?? {},
  };
}

export async function getAllMenus(): Promise<PopupMenu[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_menus")
      .select("*")
      .order("go_live_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    return (data ?? []).map(mapMenu);
  } catch {
    return [];
  }
}

/** The timestamp a pop-up went (or goes) live, used to order eligibility. */
function effectiveGoLive(m: PopupMenu): number {
  const raw = m.goLiveAt || m.updatedAt || m.createdAt;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

function isEligible(m: PopupMenu, now: number): boolean {
  if (m.status === "live") return true;
  if (m.status === "scheduled" && m.goLiveAt) return Date.parse(m.goLiveAt) <= now;
  return false;
}

/**
 * Pick the live pop-up from a set of menus. Pure — no I/O — so it can be
 * reasoned about and tested directly.
 *
 * The eligible pop-up with the most recent effective go-live time wins.
 * A pop-up that is already `archived` is never eligible again.
 */
export function pickLiveMenu(menus: PopupMenu[], now = Date.now()): PopupMenu | null {
  const eligible = menus.filter((m) => isEligible(m, now));
  if (!eligible.length) return null;
  return eligible.reduce((best, m) =>
    effectiveGoLive(m) > effectiveGoLive(best) ? m : best
  );
}

/**
 * Write the resolved state back so the admin list and the public site agree.
 *
 * Best-effort and idempotent: the outcome is a pure function of the data, so
 * concurrent requests converge on the same result. Failures are swallowed —
 * resolution already happened in memory, so a write error can't take the site
 * down or serve the wrong pop-up.
 */
async function persistResolvedStatuses(menus: PopupMenu[], live: PopupMenu | null) {
  const now = Date.now();
  const promotions = live && live.status !== "live" ? [live.id] : [];
  const demotions = menus
    .filter((m) => m.id !== live?.id && isEligible(m, now))
    .map((m) => m.id);

  if (!promotions.length && !demotions.length) return;

  try {
    const sb = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    await Promise.all([
      promotions.length
        ? sb.from("popup_menus").update({ status: "live", updated_at: nowIso }).in("id", promotions)
        : Promise.resolve(),
      demotions.length
        ? sb
            .from("popup_menus")
            .update({ status: "archived", archived_at: nowIso, updated_at: nowIso })
            .in("id", demotions)
        : Promise.resolve(),
    ]);
  } catch (e) {
    console.error("[popup] status sync failed", e);
  }
}

/**
 * The single source of truth for "which pop-up is showing right now".
 * Everything public — the landing page, the vote endpoint, the archive —
 * goes through this.
 */
export async function resolveLiveMenu(): Promise<PopupMenu | null> {
  const menus = await getAllMenus();
  const live = pickLiveMenu(menus);
  await persistResolvedStatuses(menus, live);
  // Reflect the resolution in what we hand back, even if the write lagged.
  return live ? { ...live, status: "live" } : null;
}

/**
 * Every pop-up a guest may browse: the live one plus everything archived.
 * Drafts and future-scheduled pop-ups are never included — those are visible
 * only through the admin sandbox.
 */
export async function getPublicMenus(): Promise<{ live: PopupMenu | null; past: PopupMenu[] }> {
  const menus = await getAllMenus();
  const live = pickLiveMenu(menus);
  await persistResolvedStatuses(menus, live);

  const now = Date.now();
  const past = menus
    .filter((m) => m.id !== live?.id)
    .filter((m) => m.status === "archived" || isEligible(m, now))
    .sort((a, b) => effectiveGoLive(b) - effectiveGoLive(a))
    .map((m) => ({ ...m, status: "archived" as PopupStatus }));

  return { live: live ? { ...live, status: "live" } : null, past };
}

export async function getMenuBySlug(slug: string): Promise<PopupMenu | null> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("popup_menus").select("*").eq("slug", slug).maybeSingle();
    return data ? mapMenu(data) : null;
  } catch {
    return null;
  }
}

export async function getMenuById(id: string): Promise<PopupMenu | null> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("popup_menus").select("*").eq("id", id).maybeSingle();
    return data ? mapMenu(data) : null;
  } catch {
    return null;
  }
}

export async function getCocktails(
  menuId: string,
  opts: { includeInactive?: boolean } = {}
): Promise<PopupCocktail[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    let q = sb.from("popup_cocktails").select("*").eq("menu_id", menuId);
    if (!opts.includeInactive) q = q.eq("active", true);
    const { data } = await q.order("order", { ascending: true });
    return (data ?? []).map(mapCocktail);
  } catch {
    return [];
  }
}

/**
 * Whether a guest may cast a vote on this pop-up.
 *
 * Voting is open ONLY on the currently resolved live pop-up. This is checked
 * again inside the vote API route — the UI hiding a button is a convenience,
 * not the enforcement.
 */
export async function isVotingOpen(menuId: string): Promise<boolean> {
  const live = await resolveLiveMenu();
  return Boolean(live && live.id === menuId && live.votingEnabled);
}

export { mapMenu, mapCocktail };
