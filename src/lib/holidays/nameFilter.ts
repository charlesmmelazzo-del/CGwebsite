// ─── Name filter ─────────────────────────────────────────────────────────────
// Names show on everyone's phone (and on the bar-wide Daily Winners board),
// so they're checked for slurs, swearing and sexual or graphic words.
//
// The word lists below are ROT13-encoded so the source isn't a wall of slurs;
// decode() turns them back at load. Checks run on a squashed version of the
// name that undoes common dodges: spacing and punctuation ("f.u c k"),
// numbers and symbols for letters ("sh1t", "@ss"), and stretched letters
// ("fuuuck").
//
// Two lists, because short words hide inside innocent ones:
//   ANYWHERE  blocked wherever it appears inside the name.
//   WHOLE     blocked only as a whole word: "ass" blocks "Ass" and "Big Ass"
//             but not "Cassidy"; "cock" doesn't block "Cocktail".
// SAFE words are taken out before the ANYWHERE check (e.g. "therapist").
// To add a word, add its ROT13 form (any ROT13 tool) to the right list.

const decode = (w: string) => w.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

const ANYWHERE = ["nefrubyr", "nfubyr", "nffubyr", "ornare", "orfgvny", "ovngpu", "ovgpu", "oybjwbo", "obyybpx", "obbo", "ohxxnxr", "ohyyfuvg", "puvax", "pyvg", "pbpxfhpx", "phpx", "phag", "qvpxurnq", "qvpxjnq", "qvyqb", "qbhpur", "qhzonff", "rwnphy", "rerpgvba", "snttbg", "sntbg", "spx", "shpx", "trabpvq", "unaqwbo", "uragnv", "uvgyre", "ubront", "ubybpnhfg", "ubbxre", "ubeal", "vaprfg", "wnpxnff", "wvmm", "xvxr", "xvyylbhefrys", "xxx", "znfgheo", "zvys", "zbyrfg", "zbgures", "anxrq", "arpebcuvy", "avtn", "avtt", "avttn", "avttre", "avte", "avccyr", "ahqr", "betnfz", "cnrqb", "crqb", "cravf", "cuhpx", "cvff", "cbea", "chffvrf", "chffl", "chfl", "encvfg", "ergneq", "fpebghz", "frzra", "fuvg", "fvrturvy", "fxnax", "fyhg", "fbqbz", "fchax", "grfgvpy", "gvggvrf", "gvggl", "genaal", "gjng", "intvan", "jnax", "jrgonpx", "juvgrcbjre", "juber", "kkk"].map(decode);
const WHOLE = new Set(["nany", "nahf", "nefr", "nff", "onfgneq", "obare", "pbpx", "pbpxf", "pbba", "pbbaf", "penc", "phz", "qnza", "qnexvr", "qvpx", "qvpxf", "qlxr", "qlxrf", "snt", "sntf", "shx", "shxvat", "tbbx", "tbbxf", "urvy", "uryy", "ubr", "ubrf", "ubzb", "ubzbf", "wnc", "wncf", "xyna", "xabo", "xlf", "anmv", "anmvf", "arteb", "artebrf", "cevpx", "encr", "encrq", "encvat", "frk", "frkl", "fynt", "fcvp", "fcvpf", "gneq", "gubg", "gvg", "gvgf"].map(decode));
const SAFE = ["nanylfvf", "nanylfg", "nffnffva", "onopbpx", "onany", "onfrzrag", "ohggrefpbgpu", "pnany", "pvephzfgnapr", "pynffvp", "pbpxgnvy", "pbpxgnvyf", "phpxbb", "phzore", "qvpxraf", "qvpxvafba", "qbphzrag", "qencr", "rffrk", "tencr", "unapbpx", "uvgpupbpx", "zvqqyrfrk", "crnpbpx", "fpencr", "fphagubecr", "fuhggyrpbpx", "fcrrqb", "fhffrk", "fjnax", "gurencvfg", "gurencvfgf", "gubeal", "gbecrqb"].map(decode);

const LEET: Record<string, string> = { "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "+": "t", "8": "b", "9": "g", "6": "g", "2": "z" };

function letters(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0-9!|@$+]/g, (c) => LEET[c] ?? c);
}

const squash = (s: string) => s.replace(/[^a-z]/g, "");
const collapse = (s: string) => s.replace(/(.)\1+/g, "$1");

/** True when a name should be refused. */
export function isOffensiveName(name: string): boolean {
  const base = letters(name);
  const words = base.split(/[^a-z]+/).filter(Boolean);
  // Whole words: each word, and the name with its spacing removed ("a s s").
  const candidates = new Set([...words, squash(base)]);
  for (const w of Array.from(candidates)) {
    const forms = [w, collapse(w), w.replace(/s$/, ""), collapse(w).replace(/s$/, "")];
    if (forms.some((f) => WHOLE.has(f))) return true;
  }
  // Anywhere: on the squashed name, with known-innocent words taken out first.
  let joined = squash(base);
  for (const s of SAFE) joined = joined.split(s).join("");
  const variants = [joined, collapse(joined)];
  return ANYWHERE.some((bad) => variants.some((v) => v.includes(bad)));
}

export const NAME_REFUSED = "Please choose a different name.";
