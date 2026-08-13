// Copy the analysis pipeline outputs from the repo's top-level results/ into
// public/data/ so the app can serve them as static assets. Run automatically by the
// `dev` and `build` scripts. results/ is the single source of truth; public/data/ is a
// gitignored build artifact — never edit it or commit it.
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = join(here, "..", "..", "results");
const outDir = join(here, "..", "public", "data");

const FILES = [
  "threatened_forests.geojson",
  "forest_all.geojson",
  "development_zones.geojson",
  "deforested.geojson",
  "summary.json",
];

if (!existsSync(resultsDir)) {
  console.warn(
    `[sync-results] results/ not found at ${resultsDir} — skipping. ` +
      `Run the analysis pipeline first (see analysis/README.md).`
  );
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
let copied = 0;
for (const file of FILES) {
  const src = join(resultsDir, file);
  if (!existsSync(src)) {
    console.warn(`[sync-results] missing ${file} in results/ — skipped.`);
    continue;
  }
  copyFileSync(src, join(outDir, file));
  copied += 1;
}
console.log(`[sync-results] copied ${copied}/${FILES.length} file(s) -> public/data/`);
