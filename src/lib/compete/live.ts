// ─── Cocktail Competitions — the host's controls (server only) ───────────────
//
// The night, per contestant (owner's flow, 2026-10-01):
//   1. present  → everyone's main screen shows the bartender
//   2. cocktail → main screen shows the cocktail
//   3. voting   → judges' ballots open; host watches who has voted, by tier
//   4. reveal judges' scores (all at once, by name) — optional
//   5. open guest voting (alongside the judges or after) — separate button
//   6. close voting → next contestant
// Then superlatives (one pick each), then the host reveals winners one at a
// time, picking a winner wherever there's a tie.

import { computeResults, getContestants, judgeCards, saveLiveState } from "./data";
import { EMPTY_LIVE_STATE, type CompEvent, type LiveState, type LiveStep } from "./types";

export type HostAction =
  | { type: "lobby" }
  | { type: "present"; contestantId: string }
  | { type: "step"; step: LiveStep }
  | { type: "judgeVoting"; open: boolean }
  | { type: "guestVoting"; open: boolean }
  | { type: "revealJudges" }
  | { type: "hideJudges" }
  | { type: "closeVoting" }
  | { type: "reopenVoting" }
  | { type: "superlatives"; open: boolean }
  | { type: "revealPhase" }
  | { type: "tieBreak"; key: string; contestantId: string }
  | { type: "revealNext" }
  | { type: "undoReveal" }
  | { type: "finish" }
  | { type: "reset" };

export class HostError extends Error {}

export async function applyHostAction(ev: CompEvent, action: HostAction): Promise<CompEvent> {
  const s: LiveState = { ...EMPTY_LIVE_STATE, ...ev.liveState };
  const closed = new Set(s.closed ?? []);
  let status = ev.status;

  switch (action.type) {
    case "lobby":
      Object.assign(s, { phase: "lobby", contestantId: undefined, step: undefined, judgeVoting: false, guestVoting: false, judgeReveal: null });
      break;

    case "present": {
      const contestants = await getContestants(ev.id);
      if (!contestants.some((c) => c.id === action.contestantId && c.status === "approved")) {
        throw new HostError("That contestant isn’t approved yet.");
      }
      Object.assign(s, {
        phase: "contestant",
        contestantId: action.contestantId,
        step: "bartender",
        judgeVoting: false,
        guestVoting: false,
        judgeReveal: null,
      });
      break;
    }

    case "step":
      if (s.phase !== "contestant" || !s.contestantId) throw new HostError("Present a contestant first.");
      s.step = action.step;
      // Moving to the ballot opens the judges' voting automatically.
      if (action.step === "voting" && !closed.has(s.contestantId)) s.judgeVoting = true;
      break;

    case "judgeVoting":
    case "guestVoting":
      if (s.phase !== "contestant" || !s.contestantId) throw new HostError("Present a contestant first.");
      if (closed.has(s.contestantId) && action.open) closed.delete(s.contestantId);
      s.step = "voting";
      s[action.type] = action.open;
      break;

    case "revealJudges": {
      if (!s.contestantId) throw new HostError("Present a contestant first.");
      const judges = await judgeCards(ev, s.contestantId);
      s.judgeReveal = { contestantId: s.contestantId, judges };
      s.step = "voting";
      break;
    }

    case "hideJudges":
      s.judgeReveal = null;
      break;

    case "closeVoting":
      if (!s.contestantId) throw new HostError("Present a contestant first.");
      closed.add(s.contestantId);
      s.judgeVoting = false;
      s.guestVoting = false;
      break;

    case "reopenVoting":
      if (!s.contestantId) throw new HostError("Present a contestant first.");
      closed.delete(s.contestantId);
      s.step = "voting";
      s.judgeVoting = true;
      break;

    case "superlatives":
      Object.assign(s, {
        phase: "superlatives",
        contestantId: undefined,
        step: undefined,
        judgeVoting: false,
        guestVoting: false,
        judgeReveal: null,
        superlativesOpen: action.open,
      });
      break;

    case "revealPhase":
      Object.assign(s, { phase: "reveal", superlativesOpen: false, judgeVoting: false, guestVoting: false, judgeReveal: null });
      break;

    case "tieBreak":
      s.tieBreaks = { ...(s.tieBreaks ?? {}), [action.key]: action.contestantId };
      break;

    case "revealNext": {
      if (s.phase !== "reveal") throw new HostError("Close superlative voting and go to the winners first.");
      const results = await computeResults({ ...ev, liveState: s }, await getContestants(ev.id));
      const done = new Set((s.revealed ?? []).map((r) => r.key));
      const next = results.items.find((i) => !done.has(i.key));
      if (!next) throw new HostError("Every winner has been revealed.");
      if (next.leaders.length === 0) {
        // Nobody voted in this category — skip it rather than block the show.
        s.revealed = [...(s.revealed ?? []), { key: next.key, label: next.label, contestantId: "" }];
        break;
      }
      if (!next.winner) throw new HostError(`“${next.label}” is tied — pick the winner first.`);
      s.revealed = [...(s.revealed ?? []), { key: next.key, label: next.label, contestantId: next.winner }];
      break;
    }

    case "undoReveal":
      s.revealed = (s.revealed ?? []).slice(0, -1);
      break;

    case "finish":
      s.phase = "finished";
      status = "finished";
      break;

    case "reset":
      return saveLiveState(ev, { ...EMPTY_LIVE_STATE }, { status: ev.status === "draft" ? "draft" : "published" });
  }

  s.closed = Array.from(closed);
  // The first thing the host does past the lobby flips the event to live.
  if (status === "published" || status === "draft") {
    if (s.phase !== "lobby") status = "live";
  }
  return saveLiveState(ev, s, status !== ev.status ? { status } : {});
}
