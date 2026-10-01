"use client";

// The host's remote control. Built for a phone or tablet held at the front of
// the room: one obvious next step at a time, with everything else close by.

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, Monitor, Smartphone, RotateCcw, Eye, EyeOff, Lock, Unlock, Trophy } from "lucide-react";
import type { HostAction } from "@/lib/compete/live";
import type { HostData } from "@/lib/compete/host";
import { accentStyle } from "./Profiles";

const STEPS = [
  { id: "bartender", label: "Bartender" },
  { id: "cocktail", label: "Cocktail" },
  { id: "voting", label: "Voting" },
] as const;

export default function HostApp({ slug, hostKey, initial }: { slug: string; hostKey: string; initial: HostData }) {
  const [d, setD] = useState<HostData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/compete/${slug}/host?key=${encodeURIComponent(hostKey)}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setD(await res.json());
  }, [slug, hostKey]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  async function act(action: HostAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/compete/${slug}/host`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: hostKey, action }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error);
      await load();
    } catch (e) {
      setError((e as Error).message || "That didn’t work.");
    } finally {
      setBusy(false);
    }
  }

  const s = d.state;
  const closed = new Set(s.closed ?? []);
  const current = d.contestants.find((c) => c.id === s.contestantId);
  const nextUp = d.contestants.find((c) => !closed.has(c.id) && c.id !== s.contestantId);
  const allClosed = d.contestants.length > 0 && d.contestants.every((c) => closed.has(c.id));
  const name = (id?: string) => d.contestants.find((c) => c.id === id)?.name ?? "—";
  const judgeTier = d.tiers.filter((t) => t.isJudge);
  const judgesVoted = judgeTier.reduce((a, t) => a + t.voted, 0);
  const judgesTotal = judgeTier.reduce((a, t) => a + t.total, 0);

  return (
    <div className="cmp" style={accentStyle(d.event.accentColor)}>
      <div className="mx-auto max-w-2xl px-4 pb-32">
        <header className="pt-6 pb-5 border-b border-[var(--cmp-line)] flex items-start justify-between gap-4">
          <div>
            <div className="cmp-label">Host Controls</div>
            <h1 className="cmp-display text-3xl mt-2">{d.event.name}</h1>
            <p className="mt-1 text-xs tracking-[0.16em] uppercase cmp-faint">Status · {d.event.status}</p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <a href={`/compete/${slug}`} target="_blank" className="text-xs tracking-[0.14em] uppercase cmp-muted flex items-center gap-1.5">
              <Smartphone size={13} /> Guest view
            </a>
            {d.event.bigScreen && (
              <a href={`/compete/${slug}/screen`} target="_blank" className="text-xs tracking-[0.14em] uppercase cmp-muted flex items-center gap-1.5">
                <Monitor size={13} /> Big screen
              </a>
            )}
          </div>
        </header>

        {error && (
          <div className="mt-4 border border-red-400/40 bg-red-400/10 text-red-200 text-sm px-4 py-3" role="alert">
            {error}
          </div>
        )}

        {/* ── Phase: lobby / contestants ── */}
        {(s.phase === "lobby" || s.phase === "contestant") && (
          <>
            {s.phase === "contestant" && current ? (
              <section className="mt-6 cmp-card p-5">
                <div className="cmp-label">On Stage</div>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <h2 className="cmp-display text-3xl">{current.name}</h2>
                  <span className="text-xs cmp-muted italic truncate">“{current.cocktail}”</span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  {STEPS.map((st, i) => {
                    const on = s.step === st.id;
                    return (
                      <button
                        key={st.id}
                        disabled={busy}
                        onClick={() => act({ type: "step", step: st.id })}
                        className="h-14 border text-xs tracking-[0.16em] uppercase flex flex-col items-center justify-center"
                        style={{
                          borderColor: on ? "var(--cmp-accent)" : "var(--cmp-line)",
                          color: on ? "var(--cmp-accent)" : "var(--cmp-muted)",
                          background: on ? "color-mix(in srgb, var(--cmp-accent) 10%, transparent)" : "transparent",
                        }}
                      >
                        <span className="text-[10px] cmp-faint">Step {i + 1}</span>
                        {st.label}
                      </button>
                    );
                  })}
                </div>

                {s.step === "bartender" && (
                  <button className="cmp-btn w-full mt-4" disabled={busy} onClick={() => act({ type: "step", step: "cocktail" })}>
                    Next: Show the Cocktail <ChevronRight size={16} />
                  </button>
                )}
                {s.step === "cocktail" && (
                  <button className="cmp-btn w-full mt-4" disabled={busy} onClick={() => act({ type: "step", step: "voting" })}>
                    Next: Open Judges’ Voting <ChevronRight size={16} />
                  </button>
                )}

                {s.step === "voting" && (
                  <div className="mt-6 space-y-5">
                    {/* Who has voted */}
                    {d.tiers.map((t) => (
                      <div key={t.id} className="border-t border-[var(--cmp-line)] pt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs tracking-[0.18em] uppercase">{t.label}</span>
                          <span className="text-xs cmp-muted tabular-nums">
                            {t.voted} voted · {t.signedIn}/{t.total} signed in
                          </span>
                        </div>
                        {t.people && (
                          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {t.people.map((p, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm">
                                <span
                                  className="w-5 h-5 rounded-full border flex items-center justify-center"
                                  style={{ borderColor: p.voted ? "var(--cmp-accent)" : "var(--cmp-line)" }}
                                >
                                  {p.voted && <Check size={12} className="text-[var(--cmp-accent)]" />}
                                </span>
                                {p.name}
                                {!p.signedIn && <span className="text-[10px] cmp-faint">(not signed in)</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}

                    {closed.has(current.id) ? (
                      <div className="border-t border-[var(--cmp-line)] pt-5 space-y-3">
                        <p className="text-sm cmp-muted flex items-center gap-2">
                          <Lock size={14} /> Voting is closed for {current.name}.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "reopenVoting" })}>
                            <Unlock size={14} /> Reopen
                          </button>
                          <button
                            className="cmp-btn-ghost"
                            disabled={busy}
                            onClick={() => act({ type: s.judgeReveal ? "hideJudges" : "revealJudges" })}
                          >
                            {s.judgeReveal ? <EyeOff size={14} /> : <Eye size={14} />} Judges
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-[var(--cmp-line)] pt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          className={s.judgeReveal ? "cmp-btn-ghost" : "cmp-btn"}
                          disabled={busy}
                          onClick={() => act({ type: s.judgeReveal ? "hideJudges" : "revealJudges" })}
                        >
                          {s.judgeReveal ? <EyeOff size={14} /> : <Eye size={14} />}
                          {s.judgeReveal ? "Hide Judges’ Scores" : `Reveal Judges’ Scores (${judgesVoted}/${judgesTotal})`}
                        </button>
                        <button
                          className={s.guestVoting ? "cmp-btn-ghost" : "cmp-btn"}
                          disabled={busy}
                          onClick={() => act({ type: "guestVoting", open: !s.guestVoting })}
                        >
                          {s.guestVoting ? "Pause Guest Voting" : "Open Guest Voting"}
                        </button>
                        {!s.judgeVoting && (
                          <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "judgeVoting", open: true })}>
                            Open Judges’ Voting
                          </button>
                        )}
                        <button
                          className="cmp-btn-ghost sm:col-span-2"
                          disabled={busy}
                          onClick={() => act({ type: "closeVoting" }, `Close all voting for ${current.name}? Guests won’t be able to change their scores.`)}
                        >
                          <Lock size={14} /> Close Voting for {current.name.split(" ")[0]}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : (
              <section className="mt-6 cmp-card p-5 text-center">
                <div className="cmp-label">Lobby</div>
                <p className="mt-3 text-sm cmp-muted">
                  Guests are browsing the brand and the lineup. Present the first contestant when you’re ready to begin.
                </p>
              </section>
            )}

            {/* Next action */}
            {(!current || closed.has(current.id)) && nextUp && (
              <button className="cmp-btn w-full mt-4 !min-h-[60px]" disabled={busy} onClick={() => act({ type: "present", contestantId: nextUp.id })}>
                Present {nextUp.name} <ChevronRight size={16} />
              </button>
            )}
            {allClosed && (
              <button className="cmp-btn w-full mt-4 !min-h-[60px]" disabled={busy} onClick={() => act({ type: "superlatives", open: true })}>
                Open Superlative Voting <ChevronRight size={16} />
              </button>
            )}

            {/* Lineup */}
            <section className="mt-8">
              <h3 className="cmp-label mb-3">Lineup</h3>
              <ul className="divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
                {d.contestants.map((c, i) => {
                  const isOn = c.id === s.contestantId;
                  const done = closed.has(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <span className="w-6 text-xs cmp-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{c.name}</span>
                        <span className="block text-xs cmp-faint truncate">
                          {c.bar} · “{c.cocktail}”
                        </span>
                      </span>
                      {done && !isOn && <span className="text-[10px] tracking-[0.16em] uppercase cmp-muted flex items-center gap-1"><Check size={12} /> Scored</span>}
                      {isOn ? (
                        <span className="cmp-label !text-[10px]">On stage</span>
                      ) : (
                        <button
                          className="text-[11px] tracking-[0.16em] uppercase border border-[var(--cmp-line)] px-3 py-2 cmp-muted hover:text-[var(--cmp-text)]"
                          disabled={busy}
                          onClick={() => act({ type: "present", contestantId: c.id })}
                        >
                          Present
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {d.contestants.length === 0 && <p className="text-sm cmp-muted mt-3">No approved contestants yet.</p>}
              {!allClosed && d.contestants.length > 0 && (
                <button className="mt-4 text-xs tracking-[0.16em] uppercase cmp-faint" disabled={busy} onClick={() => act({ type: "superlatives", open: true }, "Skip ahead to superlative voting?")}>
                  Skip to superlatives →
                </button>
              )}
            </section>
          </>
        )}

        {/* ── Phase: superlatives ── */}
        {s.phase === "superlatives" && (
          <section className="mt-6 cmp-card p-5">
            <div className="cmp-label">Superlatives</div>
            <p className="mt-2 text-sm cmp-muted">
              {s.superlativesOpen ? "Guests are making their picks. Counts show how many people have voted — not who’s winning." : "Superlative voting is paused."}
            </p>
            <ul className="mt-5 divide-y divide-[var(--cmp-line)] border-y border-[var(--cmp-line)]">
              {d.superlatives.map((x) => (
                <li key={x.id} className="py-3 flex justify-between text-sm">
                  <span>{x.label}</span>
                  <span className="cmp-muted tabular-nums">{x.picks} picks</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2">
              <button className="cmp-btn !min-h-[60px]" disabled={busy} onClick={() => act({ type: "revealPhase" }, "Close superlative voting and move to the winners?")}>
                <Trophy size={16} /> Close Voting & Go to Winners
              </button>
              <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "superlatives", open: !s.superlativesOpen })}>
                {s.superlativesOpen ? "Pause Superlative Voting" : "Resume Superlative Voting"}
              </button>
              <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "lobby" })}>
                Back to Contestants
              </button>
            </div>
          </section>
        )}

        {/* ── Phase: reveal / finished ── */}
        {(s.phase === "reveal" || s.phase === "finished") && (
          <section className="mt-6 cmp-card p-5">
            <div className="cmp-label">The Winners</div>
            <p className="mt-2 text-sm cmp-muted">
              Reveal one award at a time. You’ll see a winner’s name only when the room does — except where there’s a tie for you to break.
            </p>
            <ul className="mt-5 space-y-3">
              {d.reveal.map((r) => {
                const revealed = s.revealed?.find((x) => x.key === r.key);
                return (
                  <li key={r.key} className="border border-[var(--cmp-line)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="cmp-display text-xl">{r.label}</span>
                      <span className="text-[10px] tracking-[0.16em] uppercase cmp-muted">
                        {r.state === "revealed" ? "Revealed" : r.state === "tie" ? "Tie" : r.state === "none" ? "No votes" : "Ready"}
                      </span>
                    </div>
                    {revealed && <p className="mt-2 text-sm text-[var(--cmp-accent)]">{revealed.contestantId ? name(revealed.contestantId) : "—"}</p>}
                    {r.state === "tie" && r.tied && (
                      <div className="mt-3">
                        <p className="text-xs cmp-muted mb-2">Tied — choose the winner:</p>
                        <div className="flex flex-wrap gap-2">
                          {r.tied.map((id) => (
                            <button
                              key={id}
                              disabled={busy}
                              onClick={() => act({ type: "tieBreak", key: r.key, contestantId: id })}
                              className="px-3 py-2 border text-sm"
                              style={{
                                borderColor: r.picked === id ? "var(--cmp-accent)" : "var(--cmp-line)",
                                color: r.picked === id ? "var(--cmp-accent)" : undefined,
                              }}
                            >
                              {r.picked === id && <Check size={12} className="inline mr-1" />}
                              {name(id)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {s.phase === "reveal" && (
              <div className="mt-5 grid gap-2">
                {d.reveal.some((r) => r.state !== "revealed") ? (
                  <button className="cmp-btn !min-h-[60px]" disabled={busy} onClick={() => act({ type: "revealNext" })}>
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                    Reveal: {d.reveal.find((r) => r.state !== "revealed")?.label}
                  </button>
                ) : (
                  <button className="cmp-btn !min-h-[60px]" disabled={busy} onClick={() => act({ type: "finish" }, "Finish the event? It will move to Past Competitions on the events page.")}>
                    Finish the Event
                  </button>
                )}
                {(s.revealed?.length ?? 0) > 0 && (
                  <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "undoReveal" })}>
                    <RotateCcw size={14} /> Undo Last Reveal
                  </button>
                )}
                <button className="cmp-btn-ghost" disabled={busy} onClick={() => act({ type: "superlatives", open: true })}>
                  Back to Superlative Voting
                </button>
              </div>
            )}
            {s.phase === "finished" && <p className="mt-5 text-sm cmp-muted text-center">The event is finished. Thank you!</p>}
          </section>
        )}

        {/* Utilities */}
        <section className="mt-12 pt-6 border-t border-[var(--cmp-line)] flex flex-wrap gap-x-6 gap-y-3 text-xs tracking-[0.16em] uppercase cmp-faint">
          {s.phase !== "lobby" && (
            <button disabled={busy} onClick={() => act({ type: "lobby" })}>
              Return everyone to the lobby
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              act({ type: "reset" }, "Reset the whole show back to the lobby? Votes are kept, but every reveal and closed ballot is cleared.")
            }
          >
            Reset show
          </button>
        </section>
      </div>
    </div>
  );
}
