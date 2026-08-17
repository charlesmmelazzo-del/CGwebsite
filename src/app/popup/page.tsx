import Link from "next/link";
import PopupExperience from "@/components/popup/PopupExperience";
import PopupWelcome from "@/components/popup/PopupWelcome";
import { getViewer } from "@/lib/popup/auth";
import { getPublicMenus } from "@/lib/popup/menus";
import { loadExperience } from "@/lib/popup/render";

export const dynamic = "force-dynamic";

/**
 * The front door. A signed-in guest lands straight on whatever pop-up is
 * currently live — no menu of menus in between, which is what the owner asked
 * for. Everyone else gets the welcome/sign-up screen.
 */
export default async function PopupHomePage() {
  const [viewer, { live }] = await Promise.all([getViewer(), getPublicMenus()]);

  if (!viewer) return <PopupWelcome menu={live} />;

  if (!live) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/40">Between pop-ups</p>
        <h1
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="mt-4 text-3xl text-white"
        >
          Nothing pouring right now
        </h1>
        <p className="mt-5 text-sm text-white/55 leading-relaxed">
          We&apos;re working on the next one. You&apos;ll see it here the moment it goes live.
        </p>
        <Link
          href="/popup/archive"
          className="inline-block mt-8 text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white transition-colors"
        >
          Look back at past pop-ups →
        </Link>
      </div>
    );
  }

  const { cocktails, votingOpen, isLive, voteBlockReason, ballot, results } = await loadExperience(
    live,
    viewer
  );

  return (
    <PopupExperience
      menu={live}
      cocktails={cocktails}
      viewer={viewer}
      votingOpen={votingOpen}
      isLive={isLive}
      voteBlockReason={voteBlockReason}
      initialBallot={ballot}
      initialResults={results}
    />
  );
}
