"use client";

import Link from "next/link";
import { C } from "../theme";
import { Skel } from "../bits";
import { CocktailFeature } from "../Library";
import InstallHint from "../InstallHint";
import PhonePrompt from "../PhonePrompt";
import TabView from "./TabView";
import { FromTheBar, HereButtons, NewestList, SharedWithYou, SpiritOfTheDay, WelcomeAperitif, WhatsNew } from "./Slots";
import { dayLong, partyOf, reservationWord } from "@/lib/passport/shell";
import { money } from "@/lib/passport/bottles";
import type { BarMessage, BottleRequest, Cocktail, FeedCard, HouseList, Reservation, SpiritOfTheDay as Spirit, WelcomeAperitif as Aperitif } from "@/lib/passport/types";

/** What the Home view sends (api/passport/view/home). */
export interface HomeView {
  first_name: string; needs_phone: boolean; exclusives: Cocktail[]; attention: BottleRequest[]; reservations: Reservation[];
  // File 07: From the bar.
  messages?: BarMessage[]; feed?: FeedCard[]; spirit_of_the_day?: Spirit | null; welcome_aperitif?: Aperitif | null; newest_list?: HouseList | null;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <Skel w={120} h={10} /><Skel w="60%" h={30} className="mt-2" />
      <div className="mt-8 rounded-xl border p-5 space-y-2.5" style={{ borderColor: C.line }}><Skel w="40%" h={10} /><Skel w="70%" h={18} /></div>
      <div className="mt-8 rounded-xl border p-5 space-y-2.5" style={{ borderColor: C.line }}><Skel w="55%" h={22} /><Skel w="85%" h={12} /><Skel w="60%" h={12} /></div>
    </div>
  );
}

/** One thing that needs the member right now: a tappable card. */
function NowCard({ href, kicker, title, line }: { href: string; kicker: string; title: string; line?: string }) {
  return (
    <li>
      <Link href={href} scroll={false} className="flex items-center gap-3 rounded-xl border px-4 py-3.5 pp-focus pp-row" style={{ borderColor: `${C.brass}80`, background: "#1a1f14" }}>
        <span className="flex-1 min-w-0">
          <span className="block font-body text-[10px] tracking-[0.25em] uppercase" style={{ color: C.brass }}>{kicker}</span>
          <span className="block font-display text-[20px] leading-tight mt-1" style={{ color: C.text }}>{title}</span>
          {line && <span className="block font-body text-[13px] mt-0.5" style={{ color: C.muted }}>{line}</span>}
        </span>
        <span aria-hidden style={{ color: C.brass }}>→</span>
      </Link>
    </li>
  );
}

/**
 * File 06: Home (the CG button). Top to bottom, each section only when it has something in it: the welcome, (file 07) the
 * Welcome Aperitif, From the bar, Right now, What's new, the newest house list, Passport exclusives, Spirit of the Day,
 * then the place kept for Shared with you.
 */
export default function HomeTab() {
  return (
    <TabView<HomeView> name="home" skeleton={<HomeSkeleton />}>
      {(d) => {
        const ready = d.attention.filter((r) => r.status === "ready");
        const prices = d.attention.filter((r) => r.can_answer);
        const next = d.reservations[0];
        const anyNow = ready.length + prices.length + (next ? 1 : 0) > 0;
        return (
          <div>
            {d.needs_phone && <PhonePrompt />}
            <InstallHint />
            <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }} suppressHydrationWarning>{greeting()}</p>
            <h1 className="font-display text-[30px] leading-tight mt-1" style={{ color: C.text }}>Welcome, {d.first_name}</h1>
            <WelcomeAperitif aperitif={d.welcome_aperitif} />
            <HereButtons />
            <FromTheBar messages={d.messages} />
            {anyNow && (
              <section aria-labelledby="pp-now" className="mt-8">
                <h2 id="pp-now" className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>Right now</h2>
                <ul className="space-y-3">
                  {ready.map((r) => <NowCard key={`r${r.id}`} href="/passport/inbox" kicker="Ready for pickup" title={r.name} line={r.quantity > 1 ? `${r.quantity} bottles, set aside for you at the bar` : "Set aside for you at the bar"} />)}
                  {prices.map((r) => (
                    <NowCard key={`p${r.id}`} href="/passport/inbox" kicker="A price is waiting for you" title={r.name}
                      line={r.quote ? `${money(r.quote.price_cents)} a bottle, plus tax. Accept or decline in your Inbox.` : "Accept or decline in your Inbox."} />
                  ))}
                  {next && <NowCard href="/passport/events" kicker={`Your table · ${reservationWord(next.status)}`} title={dayLong(next.date)} line={`${next.time} · ${partyOf(next.party_size)}`} />}
                </ul>
              </section>
            )}
            <WhatsNew cards={d.feed} />
            <NewestList list={d.newest_list} />
            {d.exclusives.length > 0 && (
              <section aria-labelledby="pp-exclusives" className="mt-10">
                <h2 id="pp-exclusives" className="font-body text-[11px] tracking-[0.3em] uppercase mb-3" style={{ color: C.brass }}>Passport exclusives · members only</h2>
                <div className="space-y-4">{d.exclusives.map((c) => <CocktailFeature key={c.id} c={c} />)}</div>
              </section>
            )}
            <SpiritOfTheDay spirit={d.spirit_of_the_day} />
            <SharedWithYou />
          </div>
        );
      }}
    </TabView>
  );
}
