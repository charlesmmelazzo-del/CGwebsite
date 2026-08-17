import Link from "next/link";
import Image from "next/image";
import type { PopupMenu } from "@/lib/popup/types";

/**
 * The door into the Pop Up Zone for someone who isn't signed in.
 *
 * The zone requires an account — that's how votes stay tied to real people and
 * how one guest can't vote a hundred times. But we show them what they're
 * joining rather than a bare login box, so the ask makes sense.
 */
export default function PopupWelcome({ menu }: { menu: PopupMenu | null }) {
  const accent = menu?.accentColor ?? "#C97D5A";

  return (
    <div className="max-w-lg mx-auto px-6 py-16 sm:py-24 text-center">
      {menu?.coverImageUrl && (
        <div className="relative w-full h-40 sm:h-52 mb-8 rounded-xl overflow-hidden">
          <Image src={menu.coverImageUrl} alt="" fill unoptimized className="object-cover" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <p className="text-[10px] tracking-[0.3em] uppercase text-white/40">
        {menu ? "Now pouring" : "Common Good"}
      </p>

      <h1
        style={{ fontFamily: "var(--font-display, serif)" }}
        className="mt-4 text-3xl sm:text-4xl text-white tracking-wide"
      >
        {menu?.title ?? "The Pop Up Zone"}
      </h1>

      <p className="mt-5 text-sm text-white/60 leading-relaxed">
        {menu
          ? "Create a free account to see the full pop-up menu, vote for your favorite cocktail, and help decide what comes back."
          : "There's no pop-up running right now. Create an account and you'll be ready the moment the next one goes live."}
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          href="/popup/signup"
          style={{ background: accent }}
          className="w-full py-3.5 rounded-lg text-[11px] tracking-[0.2em] uppercase text-black font-medium hover:opacity-90 transition-opacity"
        >
          Create an account
        </Link>
        <Link
          href="/popup/login"
          className="w-full py-3.5 rounded-lg text-[11px] tracking-[0.2em] uppercase text-white/70 border border-white/20 hover:text-white hover:border-white/40 transition-colors"
        >
          I already have one
        </Link>
      </div>

      <p className="mt-6 text-[11px] text-white/30">You must be 21 or older to join.</p>

      <Link
        href="/popup/archive"
        className="inline-block mt-8 text-[10px] tracking-[0.2em] uppercase text-white/35 hover:text-white/70 transition-colors"
      >
        Browse past pop-ups →
      </Link>
    </div>
  );
}
