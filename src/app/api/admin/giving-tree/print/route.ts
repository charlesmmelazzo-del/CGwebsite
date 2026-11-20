import { NextResponse } from "next/server";
import { snapshot } from "@/lib/givingTree/admin";
import { fail } from "@/lib/givingTree/http";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Ornaments to write, as a printable page (9.8): every pledge not yet hung on
 * the wall, released ones included. ?demo=1 includes demo/sandbox pledges.
 */
export async function GET(req: Request) {
  try {
    const demo = new URL(req.url).searchParams.get("demo") === "1";
    const s = await snapshot();
    const rows = s.pledges
      .filter((p) => p.ornament === "to_write" && p.hold === "none" && !p.hidden && (demo || !p.isDemo))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const cards = rows
      .map((p) => `<div class="o"><div class="n">${esc(p.label)}</div>${p.note ? `<div class="t">“${esc(p.note)}”</div>` : ""}${p.showGift && p.gave ? `<div class="g">${esc(p.gave)}</div>` : ""}<div class="c">${esc(p.code)}</div></div>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ornaments to write</title>
<style>body{font-family:Georgia,serif;margin:16px;color:#111}h1{font-size:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}.o{border:1px dashed #999;border-radius:8px;padding:12px;break-inside:avoid}.n{font-size:18px;font-weight:bold}.t{margin-top:6px;font-style:italic}.g{margin-top:6px;font-size:13px}.c{margin-top:8px;font:12px monospace;color:#777}button{font:inherit;padding:8px 14px}@media print{button,.hint{display:none}}</style></head>
<body><h1>Ornaments to write (${rows.length})</h1><p class="hint">Mark them as hung in the admin once they're on the wall.</p><button onclick="window.print()">Print</button><div class="grid">${cards || "<p>Nothing to write right now.</p>"}</div></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
