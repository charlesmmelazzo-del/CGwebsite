import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * The single switch for NEW guest reservations on the website. When it is off
 * nobody can start a booking: the /reserve page and the booking API routes
 * answer 404, the nav link and sitemap entry disappear, and events show no
 * table bookings.
 *
 * Reservations that already exist are not affected. A guest's own link
 * (/reserve/r/<token>) and the routes behind it keep working, so they can
 * still view, change, or cancel while new bookings are paused.
 *
 * Two ways to turn it on:
 *
 *   1. The Enable / Disable switch in the admin's Reserve panel. Stored in the
 *      `reserve_page` row (key `enabled`), so it takes effect without a deploy.
 *   2. RESERVE_ENABLED=1 in the environment — forces it on for that copy of
 *      the site whatever the switch says. Staging sets this, because staging
 *      and live share one database and staging must keep working for testing
 *      while the switch (and so the live site) is off.
 *
 * The admin page for the Reserve content stays reachable either way.
 */

export function reserveForcedOn(): boolean {
  return process.env.RESERVE_ENABLED === "1";
}

// Checked on every public page render (the nav link), so remember the answer
// briefly. Saving the switch clears it, so a change shows up at once.
const TTL_MS = 15_000;
let cached: { value: boolean; at: number } | null = null;

/** The saved admin switch. Off when never set, or when the database can't be read. */
export async function getReserveSwitch(): Promise<boolean> {
  noStore();
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  let value = false;
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("reserve_page").select("data").eq("id", 1).maybeSingle();
    value = (data?.data as { enabled?: unknown } | null)?.enabled === true;
  } catch {
    value = false;
  }
  cached = { value, at: Date.now() };
  return value;
}

/** Save the admin switch, leaving the page's content untouched. */
export async function setReserveSwitch(enabled: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: row, error: readError } = await sb.from("reserve_page").select("data").eq("id", 1).maybeSingle();
  if (readError) throw new Error(readError.message);
  const data = { ...((row?.data as Record<string, unknown> | null) ?? {}), enabled };
  const { error } = await sb
    .from("reserve_page")
    .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  cached = { value: enabled, at: Date.now() };
}

export async function reserveEnabled(): Promise<boolean> {
  if (reserveForcedOn()) return true;
  return getReserveSwitch();
}
