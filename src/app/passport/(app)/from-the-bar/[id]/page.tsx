import Link from "next/link";
import { notFound } from "next/navigation";
import Unavailable from "@/components/passport/Unavailable";
import Comments from "@/components/passport/Comments";
import { BackLink } from "@/components/passport/bits";
import { C } from "@/components/passport/theme";
import { getBarMessage } from "@/lib/passport/bible";
import { messageHref } from "@/lib/passport/bar";
import { memberData } from "@/lib/passport/member";

export const dynamic = "force-dynamic";

/** File 10: one message from the bar on its own page, for its comments. Only a live message this member may see. */
export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const r = await memberData((auth) => getBarMessage(auth, id));
  if (r.notFound) notFound();
  if (!r.data) return <Unavailable />;
  const m = r.data;
  const href = messageHref(m);
  return (
    <div>
      <BackLink fallback="/passport" label="Home" />
      <p className="font-body text-[0.75rem] tracking-[0.3em] uppercase mt-2" style={{ color: C.brass }}>From the bar</p>
      <h1 className="font-display text-4xl leading-tight mt-1" style={{ color: C.text }}>{m.title}</h1>
      {m.body && <p className="font-body text-[1rem] mt-4 leading-relaxed whitespace-pre-line" style={{ color: C.text }}>{m.body}</p>}
      {href && m.link_label && <Link href={href} scroll={false} className="inline-block mt-3 min-h-[44px] py-2.5 font-body text-sm underline underline-offset-4" style={{ color: C.brass }}>{m.link_label}</Link>}
      <Comments type="message" id={m.id} />
    </div>
  );
}
