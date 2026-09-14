import { notFound, redirect } from "next/navigation";
import PopupExperience from "@/components/popup/PopupExperience";
import { getViewer } from "@/lib/popup/auth";
import { getMenuBySlug, resolveLiveMenu } from "@/lib/popup/menus";
import { loadExperience } from "@/lib/popup/render";

export const dynamic = "force-dynamic";

/**
 * A single pop-up by slug — the archive detail view.
 *
 * Scoring here is closed by construction: loadExperience asks the same
 * resolver the live page uses, and this pop-up isn't the live one, so
 * isLive comes back false. Guests see the final high score boards.
 *
 * Drafts and future-scheduled pop-ups 404 rather than leaking early — they're
 * reachable only through the admin sandbox.
 */
export default async function ArchivedPopupPage({ params }: { params: { slug: string } }) {
  const menu = await getMenuBySlug(params.slug);
  if (!menu) notFound();

  const [viewer, live] = await Promise.all([getViewer(), resolveLiveMenu()]);

  // The currently live pop-up always lives at /popup — keep one canonical URL.
  if (live && live.id === menu.id) redirect("/popup");

  if (menu.status === "draft" || menu.status === "scheduled") notFound();

  const { cocktails, isLive } = await loadExperience(menu);

  return (
    <PopupExperience
      menu={menu}
      cocktails={cocktails}
      viewer={viewer}
      isLive={isLive}
    />
  );
}
