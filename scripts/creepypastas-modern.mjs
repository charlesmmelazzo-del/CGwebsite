// ─── Cocktail Creepypastas — load the modern English versions ────────────────
//
// ChatGPT rewrites the harder-to-read tales (dialect, thee/thou, untranslated
// Latin) into modern English, a batch at a time: modern-batch-NN.json, each
//   { batch, stories: { H223: { modern_paragraphs: [...], paragraph_count, notes } } }
//
// Every story is checked against the original before it's accepted:
//   * the same number of paragraphs, so a bookmark or a mid-story switch
//     lands on the same paragraph in either version
//   * no empty paragraphs
//   * not shrunk: under 75% of the original's words, or any substantial
//     paragraph under half its original, means it was summarised — rejected
//
// Accepted stories are written to public/popup/creepypastas/modern/<id>.json
// (a folder the main import never clears) and flagged `modern: true` in the
// catalog. Re-running with the same files is harmless.
//
//   node scripts/creepypastas-modern.mjs <corpus.json> <modern-batch-01.json> [more batches...]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [corpusPath, ...batchPaths] = process.argv.slice(2);
if (!corpusPath || batchPaths.length === 0) {
  console.error("Usage: node scripts/creepypastas-modern.mjs <corpus.json> <modern-batch.json> [...]");
  process.exit(1);
}

const corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
const originals = new Map(corpus.stories.map((s) => [s.id, s]));
const words = (t) => (t.match(/\S+/g) ?? []).length;

const OUT = join("public", "popup", "creepypastas");
mkdirSync(join(OUT, "modern"), { recursive: true });

let accepted = 0;
let rejected = 0;
for (const path of batchPaths) {
  const batch = JSON.parse(readFileSync(path, "utf8"));
  for (const [id, story] of Object.entries(batch.stories ?? {})) {
    const original = originals.get(id);
    const problems = [];
    if (!original) problems.push("not a story in the corpus");
    const modern = Array.isArray(story.modern_paragraphs) ? story.modern_paragraphs : [];
    if (original) {
      const orig = original.body_paragraphs;
      if (modern.length !== orig.length) problems.push(`${modern.length} paragraphs, original has ${orig.length}`);
      if (modern.some((p) => typeof p !== "string" || !p.trim())) problems.push("empty paragraph");
      const ow = orig.reduce((n, p) => n + words(p), 0);
      const mw = modern.reduce((n, p) => n + words(String(p)), 0);
      if (mw < ow * 0.75) problems.push(`only ${Math.round((mw / ow) * 100)}% of the original's words`);
      const shrunk = orig.filter((p, i) => words(p) >= 40 && words(String(modern[i] ?? "")) < words(p) * 0.5).length;
      if (shrunk) problems.push(`${shrunk} long paragraph(s) cut to under half`);
    }
    if (problems.length) {
      rejected++;
      console.error(`✗ ${id}${original ? ` ${original.title}` : ""}: ${problems.join("; ")}`);
      continue;
    }
    writeFileSync(
      join(OUT, "modern", `${id}.json`),
      JSON.stringify({ id, contentVersion: original.content_version, paragraphs: modern })
    );
    accepted++;
    console.log(`✓ ${id} ${original.title}`);
  }
}

// Flag every story that has a modern version, from what's on disk.
const catalogPath = join(OUT, "catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
for (const card of catalog) card.modern = existsSync(join(OUT, "modern", `${card.id}.json`));
writeFileSync(catalogPath, JSON.stringify(catalog));

console.log(
  `${accepted} accepted, ${rejected} rejected · ${catalog.filter((c) => c.modern).length} stories now have a modern version`
);
if (rejected) process.exit(1);
