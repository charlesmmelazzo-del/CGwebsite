import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getCocktails, getMenuById } from "@/lib/popup/menus";
import { getLeaderboard, getVoterCount, weightForRank } from "@/lib/popup/voting";

interface BallotRow {
  name: string;
  email: string;
  cocktail: string;
  rank: number;
  points: number;
  votedAt: string;
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Full results for one pop-up: the standings plus every individual ballot.
 *
 * The per-guest breakdown is the point — the owner asked to be able to see who
 * voted for what, so they can follow up with guests about bringing a favorite
 * back. Admin-only; the public endpoint returns totals only.
 */
export async function GET(req: NextRequest) {
  const menuId = req.nextUrl.searchParams.get("menuId") ?? "";
  const isTest = req.nextUrl.searchParams.get("sandbox") === "1";
  const format = req.nextUrl.searchParams.get("format");

  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "Pop-up not found." }, { status: 404 });

  const cocktails = await getCocktails(menu.id, { includeInactive: true });
  const [results, voterCount] = await Promise.all([
    getLeaderboard(menu, cocktails, isTest),
    getVoterCount(menu.id, isTest),
  ]);

  let ballots: BallotRow[] = [];
  try {
    const sb = getSupabaseAdmin();

    // The cocktail embed works off a real foreign key. The profile does NOT —
    // popup_votes.user_id points at auth.users, not popup_profiles — so the
    // guest details are fetched separately and joined here.
    const { data } = await sb
      .from("popup_votes")
      .select("rank, created_at, user_id, popup_cocktails(name)")
      .eq("menu_id", menu.id)
      .eq("is_test", isTest)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as unknown as {
      rank: number;
      created_at: string;
      user_id: string;
      popup_cocktails: { name: string } | null;
    }[];

    const userIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
    const profiles = new Map<string, { first_name: string; last_name: string; email: string }>();
    if (userIds.length) {
      const { data: profileRows } = await sb
        .from("popup_profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);
      for (const p of profileRows ?? []) {
        profiles.set(String(p.id), {
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
          email: p.email ?? "",
        });
      }
    }

    ballots = rows.map((r) => {
      const p = profiles.get(String(r.user_id));
      return {
        name: [p?.first_name, p?.last_name].filter(Boolean).join(" "),
        email: p?.email ?? "",
        cocktail: r.popup_cocktails?.name ?? "—",
        rank: Number(r.rank),
        points: weightForRank(menu, Number(r.rank)),
        votedAt: r.created_at,
      };
    });
  } catch (e) {
    console.error("[GET /api/admin/popup/results]", e);
  }

  if (format === "csv") {
    const header = ["Name", "Email", "Cocktail", "Rank", "Points", "Voted At"];
    const lines = [
      header.join(","),
      ...ballots.map((b) =>
        [b.name, b.email, b.cocktail, b.rank, b.points, b.votedAt].map(csvCell).join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${menu.slug}-votes.csv"`,
      },
    });
  }

  return NextResponse.json({ menu, results, ballots, voterCount });
}
