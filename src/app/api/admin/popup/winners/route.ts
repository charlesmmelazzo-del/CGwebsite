import { NextRequest, NextResponse } from "next/server";
import { getCocktails, getMenuById } from "@/lib/popup/menus";
import { getGameWinners } from "@/lib/popup/scores";

/**
 * Top scorer per game for a pop-up, with contact details — the list the owner
 * works from when sending out the $15 gift cards.
 *
 * Admin-only (covered by the /api/admin/:path* middleware matcher). This is the
 * only endpoint that pairs a guest's email with a score; the public board shows
 * a first name and last initial and nothing else.
 */
export async function GET(req: NextRequest) {
  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const isTest = req.nextUrl.searchParams.get("sandbox") === "1";
  const format = req.nextUrl.searchParams.get("format");

  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "Pop-up not found." }, { status: 404 });

  const cocktails = await getCocktails(menu.id, { includeInactive: true });
  const winners = await getGameWinners(menu.id, cocktails, isTest);

  if (format === "csv") {
    const cell = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      ["Cocktail", "Game", "Winner", "Email", "Email Confirmed", "Score", "Achieved", "Players"].join(","),
      ...winners.map((w) =>
        [
          w.cocktailName,
          w.gameKey,
          w.winner?.name ?? "",
          w.winner?.email ?? "",
          w.winner ? (w.winner.emailVerified ? "yes" : "NO") : "",
          w.winner?.score ?? "",
          w.winner?.achievedAt ?? "",
          w.totalPlayers,
        ].map(cell).join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${menu.slug}-game-winners.csv"`,
      },
    });
  }

  return NextResponse.json({ winners, menuStatus: menu.status });
}
