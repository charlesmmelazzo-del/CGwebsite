import { redirect } from "next/navigation";
import Account from "@/components/passport/Account";
import Shell from "@/components/passport/Shell";
import Unavailable from "@/components/passport/Unavailable";
import { loadMe } from "@/lib/passport/page";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const s = await loadMe();
  if (s.unavailable) return <Unavailable />;
  if (!s.me) redirect("/passport");
  return <Shell tab="account"><Account me={s.me} /></Shell>;
}
