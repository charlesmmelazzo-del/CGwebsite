import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PopupExperience from "@/components/popup/PopupExperience";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getViewer } from "@/lib/popup/auth";
import { getMenuBySlug } from "@/lib/popup/menus";
import { loadExperience } from "@/lib/popup/render";

export const dynamic = "force-dynamic";

/**
 * The sandbox: render any pop-up at any status, before the public can see it.
 *
 * Gated on the existing admin session cookie — the same one that protects
 * /admin — except on the staging site, where staff can open it from a link.
 * Game scores and other sandbox writes still need the admin session.
 * Scores set here are written with is_test = true and are excluded
 * from every public board, and no ticket is needed, so the owner can play
 * every game on an unpublished pop-up without polluting real results.
 */
export default async function SandboxPage({ params }: { params: { slug: string } }) {
  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  // On the staging site (the only one with PREVIEW_PASSWORD set) anyone with
  // the link can open the sandbox, so the owner can hand it to staff to test.
  // On the live site it stays admin-only: drafts aren't public there.
  const isStaging = Boolean(process.env.PREVIEW_PASSWORD);
  if (!isAdmin && !isStaging) redirect(`/admin/login?from=/popup/preview/${params.slug}`);

  const menu = await getMenuBySlug(params.slug);
  if (!menu) notFound();

  const viewer = await getViewer();
  const { cocktails, isLive } = await loadExperience(menu, { isSandbox: true });

  // No banner here: an extra strip pushed the pop-up below the fold. The
  // Pop Up Zone bar shows a "Sandbox" button on this route instead (see PopupBar).
  return (
    <PopupExperience menu={menu} cocktails={cocktails} viewer={viewer} isLive={isLive} isSandbox />
  );
}
