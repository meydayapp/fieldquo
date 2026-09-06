// scripts/check-snapshot-cache.mjs
//
//   npm run check:snapshot-cache
//
// Executes lib/sales/discovery/snapshotCache.js — the bounded LRU every
// discovery provider keeps its parsed snapshot in — and pins the three
// providers to it. Three unbounded Maps were the previous state; with eighty
// campaigns that is an out-of-memory kill dressed as a provider outage.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { boundedSnapshotCache, DEFAULT_MAX_ROWS } from "../lib/sales/discovery/snapshotCache.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const snap = (n) => ({ rows: new Array(n).fill(0), manifest: {} });

// ── Behaviour ──────────────────────────────────────────────────────────────
{
  const c = boundedSnapshotCache({ maxRows: 100 });
  ok("a miss is undefined, not null and not a throw", c.get("a") === undefined);
  c.set("a", snap(40));
  ok("a hit returns the same object", c.get("a").rows.length === 40 && c.size === 1 && c.rows === 40);
  c.set("b", snap(40));
  ok("two under budget both stay", c.size === 2 && c.rows === 80);
  c.get("a"); // a is now most recently used
  c.set("c", snap(40));
  ok("over budget, the LEAST recently used goes — b, because a was just read",
    c.has("a") && !c.has("b") && c.has("c") && c.rows === 80, { a: c.has("a"), b: c.has("b"), c: c.has("c"), rows: c.rows });
  c.set("a", snap(10));
  ok("re-setting a key replaces its size rather than double-counting", c.rows === 50 && c.size === 2, c.rows);
  c.set("huge", snap(1000));
  ok("a snapshot larger than the whole budget is cached ALONE rather than refused",
    c.has("huge") && c.size === 1 && c.rows === 1000, { size: c.size, rows: c.rows });
  c.clear();
  ok("clear empties everything", c.size === 0 && c.rows === 0 && c.get("huge") === undefined);
}
{
  const c = boundedSnapshotCache();
  ok("the default budget is a few of the largest 50,000-row parts", c.maxRows === DEFAULT_MAX_ROWS && DEFAULT_MAX_ROWS >= 100_000 && DEFAULT_MAX_ROWS <= 200_000, c.maxRows);
  ok("a nonsense budget falls back to the default", boundedSnapshotCache({ maxRows: -5 }).maxRows === DEFAULT_MAX_ROWS && boundedSnapshotCache({ maxRows: "x" }).maxRows === DEFAULT_MAX_ROWS);
  c.set("k", { rows: new Array(7).fill(1) });
  ok("size is read off the value's rows when not given", c.rows === 7);
  c.set("j", { manifest: {} });
  ok("a value with no rows array counts as zero, not NaN", c.rows === 7 && c.size === 2);
}
{
  // The failure this exists for: eighty parts touched in turn must not
  // accumulate. Simulated at the real part size.
  const c = boundedSnapshotCache();
  for (let i = 0; i < 80; i += 1) c.set(`part${i}`, snap(50_000), 50_000);
  ok("eighty 50,000-row parts in turn hold at most the budget", c.rows <= DEFAULT_MAX_ROWS && c.size <= 3, { size: c.size, rows: c.rows });
  ok("...and the most recent are the ones kept", c.has("part79") && c.has("part78") && !c.has("part0"));
}

// ── The three providers use it ─────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
for (const [file, seam] of [
  ["lib/sales/discovery/overture/provider.js", "__clearSnapshotCache"],
  ["lib/sales/discovery/rbq/provider.js", "__clearRbqSnapshotCache"],
  ["lib/sales/discovery/usBoard/provider.js", "__clearUsBoardSnapshotCache"],
]) {
  const src = read(file);
  ok(`${file} imports the bounded cache`, /import \{ boundedSnapshotCache \} from "(\.\.\/snapshotCache|@\/lib\/sales\/discovery\/snapshotCache)"/.test(src));
  ok(`${file} builds its cache from it, not from new Map()`, /const cache = boundedSnapshotCache\(\);/.test(src) && !/const cache = new Map\(\);/.test(src));
  ok(`${file} records the row count on set`, /cache\.set\([^,]+, loaded, parsed\.rows\.length\)/.test(src));
  ok(`${file} keeps its test seam`, new RegExp(`export function ${seam}\\(\\) \\{\\s*cache\\.clear\\(\\);`).test(src));
}

console.log(`\ncheck-snapshot-cache: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
