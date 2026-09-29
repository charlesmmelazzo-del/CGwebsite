// Copies pdf.js's worker into public/ so it's served as a plain file.
// Bundling it breaks `next build` (Terser parses the ES-module worker as a
// classic script). Runs automatically before `npm run dev` and `npm run build`,
// so the worker always matches the installed pdfjs-dist version.
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
copyFileSync(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  new URL("../public/pdf.worker.min.mjs", import.meta.url)
);
