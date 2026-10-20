// ─── Cocktail Creepypastas — import the tales corpus ─────────────────────────
//
// Turns ChatGPT's corpus file (one ~4 MB JSON with every story, its source
// record and the bartender's dialogue) into the content the site serves:
//
//   public/popup/creepypastas/catalog.json  every story's card: title, author,
//                                           length, scare level, the bartender's
//                                           lines about it — no story text
//   public/popup/creepypastas/tales/*.json  one story's text each, fetched only
//                                           when a guest starts reading it
//   src/components/popup/creepypastas/dialogue.json
//                                           the bartender's general lines
//
// Stories are public-domain and public on the page anyway, so they're served
// as plain static files: cached, and nothing to run on the server.
//
// Only guest-facing content is kept. Screening notes, exclusions and rights
// records stay in the corpus file, which is the record of where it all came from.
//
//   node scripts/creepypastas-import.mjs ~/Downloads/Common_Good_Spooky_Tales_Corpus.json

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("Usage: node scripts/creepypastas-import.mjs <corpus.json>");
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(src, "utf8"));
const out = join("public", "popup", "creepypastas");
rmSync(join(out, "tales"), { recursive: true, force: true });
mkdirSync(join(out, "tales"), { recursive: true });

/** Words per minute for SILENT reading — guests read these, nobody narrates. */
const READ_WPM = 225;

const index = [];
for (const s of corpus.stories) {
  if (!s.guest_eligible) continue;
  if (!/^H\d{3}$/.test(s.id)) throw new Error(`Unexpected story id ${s.id}`);
  if (!Array.isArray(s.body_paragraphs) || s.body_paragraphs.length === 0) {
    throw new Error(`${s.id} has no text`);
  }

  const words = s.timing.story_word_count;
  index.push({
    id: s.id,
    title: s.title,
    author: s.author_credit,
    year: s.source.publication_year_as_catalogued ?? null,
    sourceUrl: s.source.catalog_url,
    // The corpus sorts lengths by a conservative telling pace; keep its buckets
    // so the bartender's promises about length stay consistent with its notes.
    time: s.primary_time_category,
    readMinutes: Math.max(1, Math.round(words / READ_WPM)),
    underFive: Boolean(s.timing.under_five_minutes_at_menu_pace),
    scare: s.scare_level,
    advisories: s.content_advisories ?? [],
    premise: s.premise,
    host: {
      introduction: s.host.patron_introduction,
      teaser: s.host.teaser,
      offerQuestion: s.host.offer_question,
      acceptLabel: s.host.accept_label,
      declineLabel: s.host.decline_label,
      bridge: s.host.narration_bridge,
      callback: s.host.returning_guest_callback,
      callbackShort: s.host.return_callback_short,
    },
    contentVersion: s.content_version,
  });

  writeFileSync(
    join(out, "tales", `${s.id}.json`),
    JSON.stringify({ id: s.id, contentVersion: s.content_version, paragraphs: s.body_paragraphs })
  );
}

// The bartender's general lines: one array of alternatives per moment.
const dialogue = {};
for (const [key, value] of Object.entries(corpus.host_dialogue)) {
  if (!Array.isArray(value)) continue;
  dialogue[key] = value.map((d) => ({
    id: d.dialogue_id,
    // Fresh welcomes are several bubbles in a row; everything else is one.
    lines: d.lines ?? [d.text],
    ...(d.choices ? { choices: d.choices.map((c) => (typeof c === "string" ? c : c.label)) } : {}),
  }));
}

writeFileSync(join(out, "catalog.json"), JSON.stringify(index));
writeFileSync(
  join("src", "components", "popup", "creepypastas", "dialogue.json"),
  JSON.stringify(dialogue, null, 1)
);

const byTime = index.reduce((m, s) => ((m[s.time] = (m[s.time] ?? 0) + 1), m), {});
console.log(`${index.length} stories`, byTime, `· ${Object.keys(dialogue).length} dialogue moments`);
