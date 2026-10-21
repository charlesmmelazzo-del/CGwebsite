import Link from "next/link";
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
 * Drafts and future-scheduled pop-ups show only an "opening soon" note — no
 * name, no menu — so a printed QR code scanned early lands somewhere sensible
 * without leaking anything. The pop-up itself is reachable only through the
 * admin sandbox until it goes live.
 */
export default async function ArchivedPopupPage({ params }: { params: { slug: string } }) {
  const menu = await getMenuBySlug(params.slug);
  if (!menu) notFound();

  const [viewer, live] = await Promise.all([getViewer(), resolveLiveMenu()]);

  // The currently live pop-up always lives at /popup — keep one canonical URL.
  if (live && live.id === menu.id) redirect("/popup");

  if (menu.status === "draft" || menu.status === "scheduled") return <OpeningSoon />;

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

function OpeningSoon() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-20">
      <p className="text-[10px] tracking-[0.3em] uppercase text-white/50 mb-4">Common Good Pop Up Zone</p>
      <h1 className="text-2xl sm:text-3xl tracking-wide text-white mb-3">This pop-up opens soon</h1>
      <p className="text-sm text-white/60 max-w-sm mb-8">
        You&rsquo;re a little early. Scan again once it&rsquo;s open, or ask anyone behind the bar.
      </p>
      <Link
        href="/popup"
        className="text-[11px] tracking-[0.2em] uppercase border border-white/30 text-white px-5 py-3 hover:bg-white hover:text-black transition-colors"
      >
        See what&rsquo;s on now
      </Link>
    </div>
  );
}
