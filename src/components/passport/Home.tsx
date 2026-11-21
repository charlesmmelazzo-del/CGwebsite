"use client";

import InstallHint from "./InstallHint";
import PhonePrompt from "./PhonePrompt";
import { C } from "./ui";
import Link from "next/link";
import type { Cocktail, Me } from "@/lib/passport/bible";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** File 01: a simple welcome. The real home screen (aperitif, news, who's here) arrives in later files. */
export default function Home({ me, featured = [] }: { me: Me; featured?: Cocktail[] }) {
  return (
    <div className="animate-fade-in">
      {me.member.needs_phone && <PhonePrompt />}
      <InstallHint />
      <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }} suppressHydrationWarning>{greeting()}</p>
      <h1 className="font-display text-[44px] leading-[1.05] mt-2">Welcome, {me.member.first_name}.</h1>
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      <p className="font-body text-[15px] leading-relaxed" style={{ color: C.muted }}>
        This is your Common Good Passport. Soon it will hold the menus, every cocktail we&rsquo;ve poured, your favorites and notes,
        and a direct line to the bar. More is coming.
      </p>
      {featured.length > 0 && (
        <Link href="/passport/menu" className="block mt-8 rounded-xl border p-5" style={{ borderColor: `${C.brass}66`, background: "#1a1f14" }}>
          <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }}>Members only</p>
          <h2 className="font-display text-2xl mt-1" style={{ color: C.text }}>This month&rsquo;s Passport cocktails</h2>
          <ul className="mt-3 space-y-1">
            {featured.map((c) => <li key={c.id} className="font-display text-lg" style={{ color: C.text }}>{c.name}{c.flavor && <span className="font-body text-sm" style={{ color: C.muted }}> · {c.flavor}</span>}</li>)}
          </ul>
          <p className="font-body text-xs mt-3" style={{ color: C.muted }}>Ask your bartender for one. →</p>
        </Link>
      )}
    </div>
  );
}
