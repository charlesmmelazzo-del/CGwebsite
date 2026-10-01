import { getCommonGoodLogo } from "@/lib/compete/data";
import { buildShowcaseEvent } from "@/lib/compete/showcase";
import Showcase from "@/components/compete/Showcase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Partner Preview",
  // Unlisted: shared by link with prospective brand partners only.
  robots: { index: false, follow: false },
};

/**
 * /compete/showcase — the tap-through tour for prospective brand partners.
 * Not linked from anywhere on the site. Fully simulated: no database, nothing saved.
 */
export default async function ShowcasePage() {
  return <Showcase ev={buildShowcaseEvent(await getCommonGoodLogo())} />;
}
