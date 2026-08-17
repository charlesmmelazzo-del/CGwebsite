import Link from "next/link";
import Image from "next/image";
import { getPublicMenus } from "@/lib/popup/menus";

export const dynamic = "force-dynamic";

const ACCENT = "#C97D5A";

function formatRun(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Every pop-up a guest can revisit — the live one, plus the closed archive. */
export default async function ArchivePage() {
  const { live, past } = await getPublicMenus();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <h1
        style={{ fontFamily: "var(--font-display, serif)" }}
        className="text-3xl sm:text-4xl text-white text-center"
      >
        Pop Ups
      </h1>
      <p className="mt-3 text-center text-xs text-white/45 leading-relaxed max-w-md mx-auto">
        Look back at what we&apos;ve poured. Voting closes when a pop-up ends, but the results
        stay up.
      </p>

      <div className="mt-12 space-y-4">
        {live && <MenuCard menu={live} isLive />}

        {past.length === 0 && !live && (
          <p className="text-center text-sm text-white/35 py-16">
            No pop-ups yet — check back soon.
          </p>
        )}

        {past.map((m) => (
          <MenuCard key={m.id} menu={m} />
        ))}
      </div>
    </div>
  );
}

function MenuCard({
  menu,
  isLive = false,
}: {
  menu: {
    id: string;
    slug: string;
    title: string;
    subtitle?: string;
    goLiveAt?: string;
    coverImageUrl?: string;
  };
  isLive?: boolean;
}) {
  const when = formatRun(menu.goLiveAt);

  return (
    <Link
      href={isLive ? "/popup" : `/popup/m/${menu.slug}`}
      style={isLive ? { borderColor: `${ACCENT}60` } : undefined}
      className={`flex items-center gap-4 sm:gap-5 p-4 rounded-xl border transition-colors group ${
        isLive ? "bg-white/[0.06]" : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-white/[0.05]">
        {menu.coverImageUrl && (
          <Image src={menu.coverImageUrl} alt="" fill unoptimized className="object-cover" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {isLive ? (
          <span
            style={{ color: ACCENT }}
            className="text-[9px] tracking-[0.25em] uppercase font-medium"
          >
            ● Now pouring
          </span>
        ) : (
          <span className="text-[9px] tracking-[0.25em] uppercase text-white/30">
            Voting closed
          </span>
        )}
        <h2
          style={{ fontFamily: "var(--font-display, serif)" }}
          className="mt-1 text-lg sm:text-xl text-white truncate"
        >
          {menu.title}
        </h2>
        {menu.subtitle && (
          <p className="text-[10px] tracking-[0.15em] uppercase text-white/40 truncate">
            {menu.subtitle}
          </p>
        )}
        {when && <p className="mt-1 text-xs text-white/30">{when}</p>}
      </div>

      <span className="text-white/25 group-hover:text-white/60 transition-colors shrink-0">→</span>
    </Link>
  );
}
