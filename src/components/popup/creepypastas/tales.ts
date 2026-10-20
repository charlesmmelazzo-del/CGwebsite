// ─── Cocktail Creepypastas — the story collection ────────────────────────────
//
// 150 public-domain tales, imported by scripts/creepypastas-import.mjs from the
// corpus ChatGPT assembled (story text verified against the original sources).
// The catalog — titles, lengths, scare levels and the bartender's lines about
// each — is one static file; each story's text is its own file, fetched only
// when someone starts reading it.

export type TimeId = "five_to_ten" | "ten_to_twenty" | "all_the_time";
export type ScareId = "gentle" | "spooky" | "intense";

export interface TaleCard {
  id: string;
  title: string;
  author: string;
  year: number | null;
  sourceUrl: string;
  /** The corpus's length group: its conservative telling-time estimate. */
  time: TimeId;
  /** Silent reading time at ~225 words a minute. */
  readMinutes: number;
  underFive: boolean;
  /** 1 (a little shiver) to 5 (truly unsettling). */
  scare: number;
  advisories: string[];
  premise: string;
  host: {
    introduction: string;
    teaser: string;
    offerQuestion: string;
    acceptLabel: string;
    declineLabel: string;
    bridge: string;
    callback: string;
    callbackShort: string;
  };
  contentVersion: string;
}

export interface TaleText {
  id: string;
  contentVersion: string;
  /** In order. A newline inside one keeps a verse or letter's layout. */
  paragraphs: string[];
}

const BASE = "/popup/creepypastas";

export const TIME_CHOICES: { id: TimeId; label: string }[] = [
  { id: "five_to_ten", label: "5–10 minutes" },
  { id: "ten_to_twenty", label: "10–20 minutes" },
  { id: "all_the_time", label: "I've got all the time in the world" },
];

export const SCARE_CHOICES: { id: ScareId; label: string; levels: number[] }[] = [
  { id: "gentle", label: "A gentle shiver", levels: [1, 2] },
  { id: "spooky", label: "A proper chill", levels: [3] },
  { id: "intense", label: "The darkest tales", levels: [4, 5] },
];

let catalogPromise: Promise<TaleCard[]> | null = null;

/** The whole catalog, fetched once per page load. */
export function loadCatalog(): Promise<TaleCard[]> {
  catalogPromise ??= fetch(`${BASE}/catalog.json`).then((r) => {
    if (!r.ok) throw new Error(`catalog ${r.status}`);
    return r.json();
  });
  // A failed fetch shouldn't be remembered forever — let the next try refetch.
  catalogPromise.catch(() => (catalogPromise = null));
  return catalogPromise;
}

export async function loadTale(id: string): Promise<TaleText> {
  if (!/^H\d{3}$/.test(id)) throw new Error("bad tale id");
  const r = await fetch(`${BASE}/tales/${id}.json`);
  if (!r.ok) throw new Error(`tale ${r.status}`);
  return r.json();
}

/**
 * The tales that fit a guest's choices. "All the time in the world" is no
 * limit at all — any length — as the corpus intends.
 */
export function matching(catalog: TaleCard[], time: TimeId, scare: ScareId): TaleCard[] {
  const levels = SCARE_CHOICES.find((s) => s.id === scare)?.levels ?? [];
  return catalog.filter((t) => (time === "all_the_time" || t.time === time) && levels.includes(t.scare));
}

export type Pick =
  | { kind: "tale"; tale: TaleCard }
  /** Nothing in the collection fits these choices at all. */
  | { kind: "none" }
  /** Everything that fits, this guest has already finished. */
  | { kind: "allHeard" }
  /** Unheard tales fit, but every one has been offered this visit. */
  | { kind: "allOffered" };

/**
 * Choose the next tale to pitch: something that fits, that they haven't
 * finished, and that hasn't been offered yet this visit — at random, so two
 * guests at the same table don't hear the same pitch.
 *
 * Exhaustion is reported rather than quietly widened: the brief says never
 * switch someone to a scarier or much longer tale without asking.
 */
export function pickTale(
  catalog: TaleCard[],
  time: TimeId,
  scare: ScareId,
  finished: ReadonlySet<string>,
  offered: ReadonlySet<string>,
  random: () => number = Math.random
): Pick {
  const pool = matching(catalog, time, scare);
  if (pool.length === 0) return { kind: "none" };
  const unheard = pool.filter((t) => !finished.has(t.id));
  if (unheard.length === 0) return { kind: "allHeard" };
  const fresh = unheard.filter((t) => !offered.has(t.id));
  if (fresh.length === 0) return { kind: "allOffered" };
  return { kind: "tale", tale: fresh[Math.floor(random() * fresh.length)] };
}

/** Any tale that fits, heard or not — for "hear a favourite again". */
export function pickAny(
  catalog: TaleCard[],
  time: TimeId,
  scare: ScareId,
  random: () => number = Math.random
): TaleCard | null {
  const pool = matching(catalog, time, scare);
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}
