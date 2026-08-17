import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import PopupExperience from "@/components/popup/PopupExperience";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { getViewer } from "@/lib/popup/auth";
import { getMenuBySlug } from "@/lib/popup/menus";
import { loadExperience } from "@/lib/popup/render";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
  archived: "Archived",
};

/**
 * The sandbox: render any pop-up at any status, before the public can see it.
 *
 * Gated on the existing admin session cookie — the same one that protects
 * /admin. Votes cast here are written with is_test = true and are excluded
 * from every public tally, so the owner can walk the whole voting flow on an
 * unpublished pop-up without polluting real results.
 */
export default async function SandboxPage({ params }: { params: { slug: string } }) {
  const isAdmin = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!isAdmin) redirect(`/admin/login?from=/popup/preview/${params.slug}`);

  const menu = await getMenuBySlug(params.slug);
  if (!menu) notFound();

  const viewer = await getViewer();
  const { cocktails, votingOpen, isLive, voteBlockReason, ballot, results } = await loadExperience(
    menu,
    viewer,
    { isSandbox: true }
  );

  return (
    <>
      {/* Impossible to mistake for the real thing. */}
      <div className="sticky top-12 z-30 bg-amber-500 text-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <p className="text-[10px] tracking-[0.2em] uppercase font-semibold">
            Sandbox — not public · {STATUS_LABEL[menu.status] ?? menu.status}
          </p>
          <div className="flex items-center gap-4">
            {!viewer && (
              <Link href="/popup/login" className="text-[10px] tracking-[0.15em] uppercase underline">
                Sign in as a guest to test voting
              </Link>
            )}
            <Link
              href="/admin/popup"
              className="text-[10px] tracking-[0.15em] uppercase underline whitespace-nowrap"
            >
              ← Admin
            </Link>
          </div>
        </div>
      </div>

      <PopupExperience
        menu={menu}
        cocktails={cocktails}
        viewer={viewer}
        votingOpen={votingOpen}
        isLive={isLive}
        voteBlockReason={voteBlockReason}
        initialBallot={ballot}
        initialResults={results}
        isSandbox
      />
    </>
  );
}
