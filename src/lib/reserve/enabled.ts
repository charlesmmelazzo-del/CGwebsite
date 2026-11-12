/**
 * The single switch for guest reservations on the website.
 *
 * Staging and live run the same code against the same database, so the whole
 * feature (pages, API routes, nav link, sitemap entry) is hidden unless
 * RESERVE_ENABLED is exactly "1". Set it on the staging service only until launch.
 * The admin page for the Reserve content stays reachable either way.
 */
export function reserveEnabled(): boolean {
  return process.env.RESERVE_ENABLED === "1";
}
