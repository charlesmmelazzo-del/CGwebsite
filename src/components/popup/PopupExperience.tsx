"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import RankingModal from "./RankingModal";
import { getTemplate } from "./templates/registry";
import type {
  LeaderboardEntry,
  PopupCocktail,
  PopupMenu,
  PopupViewer,
  PopupVote,
  VoteBlockReason,
  VoteResult,
} from "@/lib/popup/types";

/**
 * The stateful shell every pop-up runs inside.
 *
 * It owns the voting interaction and the network calls, then hands a template
 * the finished props described by PopupTemplateProps. Templates stay purely
 * about presentation and their own interactive gimmick — which is what makes
 * adding a trivia or video-game pop-up a single new component.
 */
export default function PopupExperience({
  menu,
  cocktails,
  viewer,
  votingOpen,
  isLive,
  voteBlockReason,
  initialBallot,
  initialResults,
  isSandbox = false,
}: {
  menu: PopupMenu;
  cocktails: PopupCocktail[];
  viewer: PopupViewer | null;
  votingOpen: boolean;
  isLive: boolean;
  voteBlockReason: VoteBlockReason | null;
  initialBallot: PopupVote[];
  initialResults: LeaderboardEntry[];
  isSandbox?: boolean;
}) {
  const router = useRouter();
  const [ballot, setBallot] = useState<PopupVote[]>(initialBallot);
  const [results, setResults] = useState<LeaderboardEntry[]>(initialResults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankingFor, setRankingFor] = useState<string[] | null>(null);

  const ballotIds = useMemo(
    () => [...ballot].sort((a, b) => a.rank - b.rank).map((v) => v.cocktailId),
    [ballot]
  );

  const submit = useCallback(
    async (ranked: string[]): Promise<VoteResult> => {
      setBusy(true);
      setError(null);
      try {
        const res =
          ranked.length === 0
            ? await fetch(
                `/api/popup/vote?menuId=${encodeURIComponent(menu.id)}${isSandbox ? "&sandbox=1" : ""}`,
                { method: "DELETE" }
              )
            : await fetch("/api/popup/vote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ menuId: menu.id, ranked, sandbox: isSandbox }),
              });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Could not save your vote.");
          return { ok: false, error: data.error, reason: data.reason };
        }

        setBallot(data.ballot ?? []);
        setResults(data.results ?? []);
        setRankingFor(null);
        return { ok: true, ballot: data.ballot ?? [] };
      } catch {
        const msg = "Network error — check your connection and try again.";
        setError(msg);
        return { ok: false, error: msg };
      } finally {
        setBusy(false);
      }
    },
    [menu.id, isSandbox]
  );

  /**
   * One-tap voting.
   *
   *   nothing picked yet        → vote for it outright
   *   tapping your current pick → withdraw it
   *   picking a second one      → open the ranking prompt
   *
   * That last branch is the rule the owner asked for: a guest never just
   * accumulates equal votes, they're asked to say which they liked more.
   */
  const toggleVote = useCallback(
    (cocktailId: string) => {
      if (!votingOpen && !isSandbox) {
        // Send them where they can fix it rather than failing silently.
        if (voteBlockReason === "not_signed_in") router.push("/popup/login?from=/popup");
        return;
      }

      const current = ballotIds;

      if (current.includes(cocktailId)) {
        if (current.length === 1) {
          void submit([]);
        } else {
          setRankingFor(current.filter((id) => id !== cocktailId));
        }
        return;
      }

      if (current.length === 0) {
        void submit([cocktailId]);
        return;
      }

      if (current.length >= menu.voteRankDepth) {
        setError(
          `You can rank up to ${menu.voteRankDepth} cocktails. Reorder or remove one to add another.`
        );
        setRankingFor(current);
        return;
      }

      setRankingFor([...current, cocktailId]);
    },
    [ballotIds, votingOpen, isSandbox, voteBlockReason, menu.voteRankDepth, submit, router]
  );

  const recordInteraction = useCallback(
    async (kind: string, payload: unknown, cocktailId?: string) => {
      try {
        await fetch("/api/popup/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ menuId: menu.id, kind, payload, cocktailId, sandbox: isSandbox }),
        });
      } catch {
        // An interactive flourish failing to log must never break the pop-up.
      }
    },
    [menu.id, isSandbox]
  );

  const Template = getTemplate(menu.templateKey).component;

  return (
    <>
      <Template
        menu={menu}
        cocktails={cocktails}
        viewer={viewer}
        votingOpen={votingOpen}
        isLive={isLive}
        voteBlockReason={voteBlockReason}
        myVotes={ballot}
        results={results}
        onVote={submit}
        toggleVote={toggleVote}
        voteBusy={busy}
        voteError={error}
        recordInteraction={recordInteraction}
        isSandbox={isSandbox}
      />

      <RankingModal
        open={rankingFor !== null}
        cocktails={cocktails}
        initialOrder={rankingFor ?? []}
        weights={menu.voteWeights}
        rankDepth={menu.voteRankDepth}
        accent={menu.accentColor ?? "#C97D5A"}
        busy={busy}
        error={error}
        onCancel={() => {
          setRankingFor(null);
          setError(null);
        }}
        onConfirm={(ranked) => void submit(ranked)}
      />
    </>
  );
}
