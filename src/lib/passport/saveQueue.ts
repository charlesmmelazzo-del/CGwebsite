/**
 * File 04 fix: a member's taps on a cocktail or bottle page (heart, stars, note) are never lost.
 *
 * Each tap shows at once and joins a queue. The saves go to the server one after another, in the order tapped, so
 * "heart, then three stars" saves both and the server always sees them in that order. While saves are waiting, the
 * screen shows the server's last answer with every waiting tap on top; once the queue is empty it shows exactly what
 * the server saved. A save that fails is dropped with a plain message, and the taps after it still go through.
 */
export type SaveResult<S> = { ok: true; state: S | null } | { ok: false; signedOut?: boolean; error?: string };
export interface SaveJob<S> {
  patch: Partial<S>; // what the screen shows straight away
  what: string; // "your rating", for the message if it fails
  send: () => Promise<SaveResult<S>>;
}
export interface SaveQueueEvents<S> {
  view: (state: S) => void;
  error: (message: string) => void;
  signedOut: () => void;
}

export function createSaveQueue<S extends object>(initial: S, on: SaveQueueEvents<S>) {
  let confirmed = initial;
  const waiting: { job: SaveJob<S>; done: (ok: boolean) => void }[] = [];
  let running = false;
  const current = (): S => waiting.reduce<S>((m, w) => ({ ...m, ...w.job.patch }), confirmed);
  const show = () => on.view(current());

  async function pump() {
    if (running) return;
    running = true;
    while (waiting.length) {
      const w = waiting[0];
      let r: SaveResult<S>;
      try { r = await w.job.send(); } catch { r = { ok: false }; }
      waiting.shift();
      if (r.ok) {
        confirmed = r.state ? r.state : { ...confirmed, ...w.job.patch };
      } else if (r.signedOut) {
        const rest = waiting.splice(0);
        show();
        running = false;
        w.done(false);
        rest.forEach((x) => x.done(false));
        on.signedOut();
        return;
      } else {
        on.error(`Couldn't save ${w.job.what}. ${r.error || "Please try again."}`);
      }
      show();
      w.done(r.ok);
    }
    running = false;
  }

  return {
    /** Add a tap; resolves true once the server saved it, false if it failed. */
    push(job: SaveJob<S>): Promise<boolean> {
      return new Promise<boolean>((done) => {
        waiting.push({ job, done });
        show();
        void pump();
      });
    },
    /** What the screen shows now: the server's state with every waiting tap on top. */
    current,
    /** How many saves are waiting (the first one may be in flight). */
    pending: () => waiting.length,
  };
}
