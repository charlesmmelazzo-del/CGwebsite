import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAllMenus, getMenuById } from "@/lib/popup/menus";

/**
 * The one place a pop-up's lifecycle changes.
 *
 * Actions:
 *   draft     — pull it back out of public view entirely
 *   schedule  — set a future launch time; it goes live on its own
 *   golive    — publish right now
 *   archive   — close it and its voting
 *
 * Going live also archives whatever was live before, so "only one pop-up is
 * live at a time" is guaranteed here rather than depending on the read-time
 * resolver to paper over an inconsistent database.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const menuId = String(body.menuId ?? "");
  const action = String(body.action ?? "");

  const menu = await getMenuById(menuId);
  if (!menu) return NextResponse.json({ error: "Pop-up not found." }, { status: 404 });

  const nowIso = new Date().toISOString();
  const sb = getSupabaseAdmin();

  try {
    switch (action) {
      case "draft": {
        await sb
          .from("popup_menus")
          .update({ status: "draft", go_live_at: null, archived_at: null, updated_at: nowIso })
          .eq("id", menuId);
        break;
      }

      case "schedule": {
        const goLiveAt = String(body.goLiveAt ?? "");
        const when = Date.parse(goLiveAt);
        if (!Number.isFinite(when)) {
          return NextResponse.json({ error: "Pick a valid launch date and time." }, { status: 400 });
        }
        if (when <= Date.now()) {
          return NextResponse.json(
            { error: "That time has already passed — use Go Live Now instead." },
            { status: 400 }
          );
        }
        await sb
          .from("popup_menus")
          .update({
            status: "scheduled",
            go_live_at: new Date(when).toISOString(),
            archived_at: null,
            updated_at: nowIso,
          })
          .eq("id", menuId);
        break;
      }

      case "golive": {
        // Archive whatever is currently live or already past its launch time.
        const all = await getAllMenus();
        const toArchive = all
          .filter((m) => m.id !== menuId)
          .filter(
            (m) =>
              m.status === "live" ||
              (m.status === "scheduled" && m.goLiveAt && Date.parse(m.goLiveAt) <= Date.now())
          )
          .map((m) => m.id);

        if (toArchive.length) {
          await sb
            .from("popup_menus")
            .update({ status: "archived", archived_at: nowIso, updated_at: nowIso })
            .in("id", toArchive);
        }

        await sb
          .from("popup_menus")
          .update({ status: "live", go_live_at: nowIso, archived_at: null, updated_at: nowIso })
          .eq("id", menuId);
        break;
      }

      case "archive": {
        await sb
          .from("popup_menus")
          .update({ status: "archived", archived_at: nowIso, updated_at: nowIso })
          .eq("id", menuId);
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const updated = await getMenuById(menuId);
    return NextResponse.json({ ok: true, menu: updated });
  } catch (e) {
    console.error("[POST /api/admin/popup/status]", e);
    return NextResponse.json({ error: "Could not update the pop-up." }, { status: 500 });
  }
}
