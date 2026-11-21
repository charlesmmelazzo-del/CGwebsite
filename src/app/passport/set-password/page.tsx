import type { Metadata } from "next";
import { Suspense } from "react";
import SetPassword from "@/components/passport/SetPassword";
import Unavailable from "@/components/passport/Unavailable";
import { loadConfig } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

// The link's code is in the address: never pass it on to other sites.
export const metadata: Metadata = { referrer: "no-referrer" };

/** Opened from a Passport email: first password (with the terms) or a reset. */
export default async function SetPasswordPage() {
  const config = await loadConfig();
  if (config.unavailable) return <Unavailable />;
  return (
    <Suspense>
      <SetPassword termsText={config.terms_text} termsVersion={config.terms_version} />
    </Suspense>
  );
}
