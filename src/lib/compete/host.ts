// ─── Cocktail Competitions — the host's view of the room (server only) ───────
//
// Who has voted (by tier, judges by name) and, in the reveal, which results
// are ready and which are tied. Never scores or per-contestant vote counts:
// the host learns each winner at the same moment the room does.

import {
  computeResults,
  getCodes,
  getContestants,
  getSuperlativePicks,
  getVotes,
} from "./data";
import type { CompEvent } from "./types";

export async function getHostData(ev: CompEvent) {
  const s = ev.liveState;
  const [contestants, codes] = await Promise.all([getContestants(ev.id), getCodes(ev.id)]);
  const approved = contestants.filter((c) => c.status === "approved");

  const currentVotes = s.contestantId ? await getVotes(ev.id, s.contestantId) : [];
  const votedIds = new Set(currentVotes.map((v) => v.code_id));

  const tiers = ev.tiers.map((t) => {
    const inTier = codes.filter((c) => c.tierId === t.id);
    return {
      id: t.id,
      label: t.label,
      isJudge: t.isJudge,
      total: inTier.length,
      signedIn: inTier.filter((c) => c.claimed).length,
      voted: inTier.filter((c) => votedIds.has(c.id)).length,
      people: t.isJudge
        ? inTier.map((c, i) => ({ name: c.name || `Judge ${i + 1}`, signedIn: c.claimed, voted: votedIds.has(c.id) }))
        : undefined,
    };
  });

  let superlatives: Array<{ id: string; label: string; picks: number }> = [];
  if (s.phase === "superlatives" || s.phase === "reveal") {
    const picks = await getSuperlativePicks(ev.id);
    superlatives = ev.superlatives.map((x) => ({
      id: x.id,
      label: x.label,
      picks: picks.filter((p) => p.superlative_id === x.id).length,
    }));
  }

  let reveal: Array<{ key: string; label: string; state: "ready" | "tie" | "none" | "revealed"; tied?: string[]; picked?: string }> = [];
  if (s.phase === "reveal" || s.phase === "finished") {
    const results = await computeResults(ev, contestants);
    const done = new Set((s.revealed ?? []).map((r) => r.key));
    reveal = results.items.map((i) => ({
      key: i.key,
      label: i.label,
      state: done.has(i.key) ? "revealed" : i.leaders.length === 0 ? "none" : i.leaders.length > 1 ? "tie" : "ready",
      tied: i.leaders.length > 1 ? i.leaders : undefined,
      picked: i.leaders.length > 1 ? (s.tieBreaks ?? {})[i.key] : undefined,
    }));
  }

  return {
    event: { id: ev.id, slug: ev.slug, name: ev.name, status: ev.status, bigScreen: ev.bigScreen, accentColor: ev.accentColor },
    version: ev.liveVersion,
    state: s,
    contestants: approved.map((c) => ({
      id: c.id,
      name: c.bartender.name || c.label || "Contestant",
      bar: c.bartender.bar || "",
      cocktail: c.cocktail.name || "",
      photoUrl: c.bartender.photoUrl || "",
    })),
    tiers,
    superlatives,
    reveal,
  };
}

export type HostData = Awaited<ReturnType<typeof getHostData>>;
