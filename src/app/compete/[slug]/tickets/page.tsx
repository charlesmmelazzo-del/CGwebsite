import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getCodes, getCommonGoodLogo, getEventBySlug, getSponsors } from "@/lib/compete/data";
import { formatEventDate } from "@/lib/compete/defaults";
import { isAdminRequest } from "@/lib/compete/session";
import { qrSvg, siteOrigin } from "@/lib/compete/urls";
import PrintButton from "@/components/compete/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tickets" };

/**
 * Printable ticket sheets — ten to a US Letter page, with cut lines.
 * Each ticket carries its code and a QR code that opens the event with the
 * code already filled in. Use the browser's Print → Save as PDF for a file.
 */
export default async function TicketsPage({ params, searchParams }: { params: { slug: string }; searchParams: { tier?: string } }) {
  noStore();
  if (!(await isAdminRequest())) notFound();
  const ev = await getEventBySlug(params.slug);
  if (!ev) notFound();

  const [codes, sponsors, cgLogo] = await Promise.all([getCodes(ev.id), getSponsors(ev.id), getCommonGoodLogo()]);
  const brandLogo = (sponsors.find((s) => s.isPrimary) ?? sponsors[0])?.profile.logoUrl;
  const tierFilter = searchParams.tier ?? "all";
  const shown = codes.filter((c) => tierFilter === "all" || c.tierId === tierFilter);
  const origin = siteOrigin();
  const tierLabel = (id: string) => ev.tiers.find((t) => t.id === id)?.label ?? id;
  const qrs = await Promise.all(
    shown.map((c) => qrSvg(`${origin}/compete/${ev.slug}?code=${c.code}`, "#12110e", "#ffffff"))
  );

  const pages: number[][] = [];
  for (let i = 0; i < shown.length; i += 10) pages.push(shown.slice(i, i + 10).map((_, j) => i + j));

  return (
    <div className="min-h-screen bg-neutral-200 text-[#12110e] print:bg-white">
      <style>{`
        @page { size: letter; margin: 0.4in; }
        @media print { .no-print { display: none !important; } .sheet { box-shadow: none !important; margin: 0 !important; } }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white border-b border-neutral-300 px-6 py-4 flex flex-wrap items-center gap-4">
        <Link href={`/admin/competitions/${ev.id}`} className="text-xs tracking-[0.16em] uppercase text-neutral-500">
          ← Back to admin
        </Link>
        <div className="font-medium">{ev.name} — Tickets</div>
        <div className="flex gap-2 text-xs">
          {[{ id: "all", label: "All" }, ...ev.tiers.map((t) => ({ id: t.id, label: t.label }))].map((t) => (
            <Link
              key={t.id}
              href={`?tier=${t.id}`}
              className={`px-3 py-1.5 border ${tierFilter === t.id ? "bg-[#12110e] text-white border-[#12110e]" : "border-neutral-300"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <div className="text-xs text-neutral-500">
          {shown.length} tickets · {pages.length} page{pages.length === 1 ? "" : "s"}
        </div>
        <div className="ml-auto">
          <PrintButton />
        </div>
      </div>

      {shown.length === 0 && (
        <p className="no-print p-10 text-center text-neutral-600">No codes yet — generate them in the admin panel first.</p>
      )}

      {pages.map((idxs, p) => (
        <div
          key={p}
          className="sheet bg-white mx-auto my-8 shadow-lg grid grid-cols-2"
          style={{ width: "7.7in", height: "10.2in", gridTemplateRows: "repeat(5, 1fr)", breakAfter: "page" }}
        >
          {idxs.map((i) => {
            const c = shown[i];
            return (
              <div key={c.id} className="border border-dashed border-neutral-400 p-4 flex gap-4 items-center">
                <div className="flex-1 min-w-0 h-full flex flex-col">
                  <div className="flex items-center gap-2 h-7">
                    {/* Logos print on white, so flatten light-on-dark artwork to black. */}
                    <img src={cgLogo} alt="" className="h-full w-auto object-contain brightness-0" />
                    {brandLogo && (
                      <>
                        <span className="text-neutral-400 text-xs">×</span>
                        <img src={brandLogo} alt="" className="h-full w-auto object-contain brightness-0" />
                      </>
                    )}
                  </div>
                  <div className="mt-auto">
                    <div className="text-[9px] tracking-[0.2em] uppercase text-neutral-500">{tierLabel(c.tierId)}{c.name ? ` · ${c.name}` : ""}</div>
                    <div className="mt-1 text-lg leading-tight" style={{ fontFamily: "var(--font-display)" }}>{ev.name}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">{formatEventDate(ev.eventDate)}</div>
                    <div className="mt-2 text-[9px] text-neutral-500 leading-snug">Scan the code or visit {origin.replace(/^https?:\/\//, "")}/compete/{ev.slug}</div>
                  </div>
                </div>
                <div className="w-[1.25in] shrink-0 text-center">
                  <div className="w-full aspect-square" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
                  <div className="mt-1.5 font-mono text-base tracking-[0.25em] font-semibold">{c.code}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
