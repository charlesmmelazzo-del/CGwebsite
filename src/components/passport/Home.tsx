"use client";

import InstallHint from "./InstallHint";
import { C } from "./ui";
import type { Me } from "@/lib/passport/bible";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** File 01: a simple welcome. The real home screen (aperitif, news, who's here) arrives in later files. */
export default function Home({ me }: { me: Me }) {
  return (
    <div className="animate-fade-in">
      <InstallHint />
      <p className="font-body text-[11px] tracking-[0.3em] uppercase" style={{ color: C.brass }} suppressHydrationWarning>{greeting()}</p>
      <h1 className="font-display text-[44px] leading-[1.05] mt-2">Welcome, {me.member.first_name}.</h1>
      <div className="w-14 h-px my-6" style={{ background: C.brass, opacity: 0.6 }} />
      <p className="font-body text-[15px] leading-relaxed" style={{ color: C.muted }}>
        This is your Common Good Passport. Soon it will hold the menus, every cocktail we&rsquo;ve poured, your favorites and notes,
        and a direct line to the bar. More is coming.
      </p>
    </div>
  );
}
