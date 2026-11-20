import { NextResponse, type NextRequest } from "next/server";
import * as A from "@/lib/givingTree/admin";
import { fail, readBody } from "@/lib/givingTree/http";
import { sweep, TreeError } from "@/lib/givingTree/service";
import * as store from "@/lib/givingTree/store";

export const dynamic = "force-dynamic";

/** Admin → Pop Ups → Giving Tree. Behind the admin login (middleware.ts). */
export async function GET() {
  try {
    return NextResponse.json(await A.snapshot());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const b = await readBody(req);
  const id = typeof b.id === "string" ? b.id : "";
  try {
    switch (b.action) {
      case "saveOrg":
        await A.saveOrg((b.org ?? {}) as Record<string, unknown>);
        break;
      case "deleteOrg":
        await store.remove("orgs", [id]);
        break;
      case "saveOpp":
        await A.saveOpp((b.opp ?? {}) as Record<string, unknown>);
        break;
      case "duplicateOpp":
        await A.duplicateOpp(id);
        break;
      case "setOppStatus":
        if (!["draft", "live", "closed"].includes(String(b.status))) throw new TreeError("Unknown status.");
        await store.update("opps", [id], { status: b.status as "draft" | "live" | "closed" });
        break;
      case "deleteOpp":
        await store.remove("opps", [id]);
        break;
      case "reorderOpps":
        await A.reorderOpps(Array.isArray(b.ids) ? b.ids.map(String) : []);
        break;
      case "pledge":
        await A.pledgeAction(id, String(b.op ?? ""), b);
        break;
      case "manualPledge": {
        const p = await A.manualPledge((b.pledge ?? {}) as Record<string, unknown>);
        return NextResponse.json({ ok: true, code: p.code, id: p.id });
      }
      case "findCode":
        return NextResponse.json({ id: await A.findByCode(String(b.code ?? "")) });
      case "previewImport":
        return NextResponse.json(await A.previewImport(b.data, b.forceDemo === true));
      case "commitImport":
        return NextResponse.json({ ok: true, result: await A.commitImport(b.data, b.forceDemo === true) });
      case "loadDemo":
        return NextResponse.json({ ok: true, result: await A.commitImport(A.demoSeed(), true) });
      case "wipeDemo":
        return NextResponse.json({ ok: true, result: await A.wipeDemo() });
      case "saveSettings":
        await A.saveSettings((b.settings ?? {}) as Record<string, unknown>);
        break;
      case "closeOut": {
        if (b.confirm !== "DELETE PHONES") throw new TreeError("Type DELETE PHONES to confirm.");
        return NextResponse.json({ ok: true, deleted: await A.closeOutSeason() });
      }
      case "sweep":
        return NextResponse.json({ ok: true, report: await sweep({ force: true }) });
      default:
        throw new TreeError("Unknown action.");
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
