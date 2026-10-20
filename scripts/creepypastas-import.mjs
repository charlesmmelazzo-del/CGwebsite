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
//   node scripts/creepypastas-import.mjs <corpus.json> [<voice-pass.json>]
//
// The optional voice pass is ChatGPT's rewrite of the bartender's lines in his
// ghoulish voice: { host_dialogue, story_host_lines }. Its general lines
// replace the corpus's moment by moment, and its per-story lines replace each
// story's host fields. Story text always comes from the corpus.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [src, voicePath] = process.argv.slice(2);
if (!src) {
  console.error("Usage: node scripts/creepypastas-import.mjs <corpus.json> [<voice-pass.json>]");
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(src, "utf8"));
const voice = voicePath ? JSON.parse(readFileSync(voicePath, "utf8")) : null;
const HOST_FIELDS = [
  "patron_introduction",
  "teaser",
  "offer_question",
  "accept_label",
  "decline_label",
  "narration_bridge",
  "returning_guest_callback",
  "return_callback_short",
];
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
  const host = { ...s.host };
  const rewrite = voice?.story_host_lines?.[s.id];
  if (voice && !rewrite) throw new Error(`Voice pass has no lines for ${s.id}`);
  for (const f of HOST_FIELDS) {
    if (rewrite?.[f] && String(rewrite[f]).trim()) host[f] = rewrite[f];
  }
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
      introduction: host.patron_introduction,
      teaser: host.teaser,
      offerQuestion: host.offer_question,
      acceptLabel: host.accept_label,
      declineLabel: host.decline_label,
      bridge: host.narration_bridge,
      callback: host.returning_guest_callback,
      callbackShort: host.return_callback_short,
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
const allDialogue = { ...corpus.host_dialogue, ...(voice?.host_dialogue ?? {}) };
for (const [key, value] of Object.entries(allDialogue)) {
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
console.log(
  `${index.length} stories`,
  byTime,
  `· ${Object.keys(dialogue).length} dialogue moments`,
  voice ? "· voice pass applied" : ""
);
