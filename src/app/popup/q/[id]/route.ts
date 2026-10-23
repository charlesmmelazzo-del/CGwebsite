import { NextResponse } from "next/server";
import { getMenuById, resolveLiveMenu } from "@/lib/popup/menus";
import { siteOrigin } from "@/lib/compete/urls";

export const dynamic = "force-dynamic";

/**
 * Where a pop-up's printed QR code points. Keyed by the menu's id, not its
 * slug, so renaming the pop-up never breaks a menu that's already printed.
 *
 *   live            → /popup (the canonical home of whatever is on now)
 *   draft/scheduled → /popup/m/<slug>, which says it opens soon
 *   archived        → /popup/m/<slug>, the archive page
 *   unknown         → /popup
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Not req.url: behind Railway's proxy that's the internal localhost:8080.
  const origin = siteOrigin();
  const to = (path: string) => NextResponse.redirect(new URL(path, origin), 307);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return to("/popup");

  const [menu, live] = await Promise.all([getMenuById(params.id), resolveLiveMenu()]);
  if (!menu) return to("/popup");
  if (live && live.id === menu.id) return to("/popup");
  return to(`/popup/m/${encodeURIComponent(menu.slug)}`);
}
