import { notFound } from "next/navigation";
import JoinPasscode from "@/components/passport/JoinPasscode";
import Unavailable from "@/components/passport/Unavailable";
import { loadConfig } from "@/lib/passport/page";
import { joinPageOpen } from "@/lib/passport/join";
import { isJoinSlug } from "@/lib/passport/passcode";

export const dynamic = "force-dynamic";

/**
 * File 18: the invitation-card sign-up page. Its address is on the QR code printed on the cards and nowhere else:
 * not on the sign-in page (unless an admin turns on the "Sign up" button), the nav or the public site. An admin can
 * change the address in Passport settings to retire an old batch of cards; any other address is "not found".
 * The guest enters the passcode written on their card, then signs up the usual way.
 */
export default async function JoinPage({ params }: { params: { slug: string } }) {
  if (!isJoinSlug(params.slug)) notFound();
  const config = await loadConfig();
  if (config.unavailable) return <Unavailable />;
  if (config.signup_mode === "off") notFound();
  const open = await joinPageOpen(params.slug);
  if (open === "unavailable") return <Unavailable />;
  if (open !== "ok") notFound();
  return <JoinPasscode slug={params.slug} termsText={config.terms_text} termsVersion={config.terms_version} />;
}
