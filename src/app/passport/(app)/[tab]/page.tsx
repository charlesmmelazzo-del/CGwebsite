import { notFound, redirect } from "next/navigation";

/** Addresses of the old bottom bar that no longer have a screen of their own (file 06): Messages is the Inbox. */
const MOVED: Record<string, string> = { messages: "/passport/inbox" };

export default function OldTabRoute({ params }: { params: { tab: string } }) {
  const to = MOVED[params.tab];
  if (!to) notFound();
  redirect(to);
}
