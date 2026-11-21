import { notFound } from "next/navigation";
import SignUp from "@/components/passport/SignUp";
import { loadConfig } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

/** Sign-up exists but stays hidden (404) until an admin turns it on in the Bible. */
export default async function SignUpPage() {
  const config = await loadConfig();
  if (!config.signup_enabled) notFound();
  return <SignUp termsText={config.terms_text} termsVersion={config.terms_version} />;
}
