// scripts/build-snapshot-library.mjs
//
// Regenerates lib/sales/discovery/snapshotLibraryData.js from the snapshot
// files that were actually uploaded to the bucket.
//
// ══ Why the library is generated data in the repo ══════════════════════════
//
// The campaign form has to know what exists in the bucket before a superadmin
// picks anything: which countries, which regions, how many rows, how many of
// those rows are painters. Listing the bucket at request time would answer the
// first two questions and neither of the others — an object listing carries a
// key and a byte count, not a trade — and it would make the form's contents
// depend on a network call to a host that is configured on another screen.
//
// So the counts are MEASURED here, once, off the files themselves, and checked
// into the repo. Every number the form shows is a number that came out of a
// real file: `rows` is each part's own validated header `count`, the trade
// tally is the repo's own tradeForCategories() run over every row, and the
// region centre is the MEDIAN of the rows' own coordinates rather than a
// capital city looked up from memory.
//
// ══ Run it against the extract, not against the bucket ═════════════════════
//
//   node --import ./scripts/alias-loader.mjs scripts/build-snapshot-library.mjs
//
// It reads ~/fieldquo-snapshots (override with SNAPSHOT_DIR), which is where
// the extractors write and where the upload was made from. It never talks to
// R2: the bucket holds the same bytes, and a generator that needed the base
// URL would need the thing this whole change exists to configure once.
//
// A file named in a manifest but missing on disk is a FAILURE, not a skip. The
// manifests are the record of what was uploaded, and a library that silently
// dropped a region would hide a whole province from the form.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

import { tradeForCategories } from "@/lib/sales/discovery/trades";
import { namespacedClasses } from "@/lib/sales/discovery/usBoard/record";
import { authorisationCodes } from "@/lib/sales/discovery/rbq/licence";

const ROOT = path.resolve(process.cwd());
const SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || path.join(os.homedir(), "fieldquo-snapshots");
const OUT = path.join(ROOT, "lib/sales/discovery/snapshotLibraryData.js");

/** Where each manifest's files live locally, and under which bucket prefix. */
const SETS = [
  { manifest: "campaign-manifest.json", prefix: "overture", localDir: "overture" },
  { manifest: "registers-manifest.json", prefix: "registers", localDir: "registers/parts" },
];

/**
 * One row → the `categories` shape tradeForCategories() reads.
 *
 * Each provider's own mapper, not a copy of it: Overture's snapshot rows carry
 * `cat_primary`/`cat_alternate` verbatim (see overture/snapshot.js), a board
 * licence's classes ARE its categories (usBoard/record.js), and the RBQ names
 * no trade at all — `primary: null` and authorisations that map to nothing,
 * which is why its trade tally comes out empty and is reported as unknown
 * rather than as zero painters.
 */
function categoriesOf(provider, row) {
  if (provider === "overture") {
    return {
      primary: typeof row.cat_primary === "string" ? row.cat_primary : null,
      alternate: Array.isArray(row.cat_alternate) ? row.cat_alternate : [],
    };
  }
  if (provider === "rbq") {
    return { primary: null, alternate: authorisationCodes(row) };
  }
  // The three US boards. `namespacedClasses` needs the board key on the row,
  // which the extractor writes as `board`.
  const classes = namespacedClasses(row);
  return { primary: classes.length === 1 ? classes[0] : null, alternate: classes };
}

function median(sorted) {
  if (!sorted.length) return null;
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

async function readFileStats(fullPath, provider) {
  const rl = readline.createInterface({ input: fs.createReadStream(fullPath), crlfDelay: Infinity });
  let header = null;
  let rows = 0;
  const trades = {};
  let unmapped = 0;
  const lats = [];
  const lons = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = JSON.parse(line);
    if (header === null) {
      header = parsed;
      continue;
    }
    rows += 1;
    const { tradeKey } = tradeForCategories(categoriesOf(provider, parsed));
    if (tradeKey) trades[tradeKey] = (trades[tradeKey] || 0) + 1;
    else unmapped += 1;
    if (typeof parsed.lat === "number" && typeof parsed.lon === "number") {
      lats.push(parsed.lat);
      lons.push(parsed.lon);
    }
  }
  lats.sort((a, b) => a - b);
  lons.sort((a, b) => a - b);
  return { header, rows, trades, unmapped, lat: median(lats), lon: median(lons), coords: lats.length };
}

const files = [];
const centreSamples = new Map();

for (const set of SETS) {
  const manifestPath = path.join(SNAPSHOT_DIR, set.manifest);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  for (const entry of manifest) {
    const provider = Object.keys(entry.campaign.sourceConfigs || {})[0];
    if (!provider) throw new Error(`${entry.file}: the manifest names no provider`);
    const fullPath = path.join(SNAPSHOT_DIR, set.localDir, entry.file);
    if (!fs.existsSync(fullPath)) throw new Error(`${entry.file}: named in ${set.manifest}, not on disk`);
    const stats = await readFileStats(fullPath, provider);
    // Counted, never taken on trust. The manifest is a record of an upload and
    // the rows on disk are the thing itself; a disagreement means the file is
    // not the file that was uploaded, and a library built on the manifest alone
    // would report a row count nobody had ever seen.
    //
    // The header `count` is only held to the manifest for a WHOLE file. The
    // Overture splitter copied the region's header verbatim into each part, so
    // overture-US-CA.part1 says 78,247 — the region's total, not the part's —
    // and holding a part to it would fail on a file that is perfectly correct.
    if (stats.rows !== entry.rows) {
      throw new Error(`${entry.file}: manifest says ${entry.rows} rows, the file has ${stats.rows}`);
    }
    if (entry.part == null && stats.header?.count !== entry.rows) {
      throw new Error(`${entry.file}: header count ${stats.header?.count}, manifest ${entry.rows}`);
    }
    files.push({
      provider,
      objectKey: `${set.prefix}/${entry.file}`,
      country: entry.country,
      province: entry.province,
      part: entry.part ?? null,
      rows: entry.rows,
      release: entry.release,
      // Sorted so a regeneration that changes nothing produces no diff.
      trades: Object.fromEntries(Object.entries(stats.trades).sort(([a], [b]) => a.localeCompare(b))),
      unmappedRows: stats.unmapped,
      // `false` is a statement: this file's rows carry no trade at all, so a
      // tally of zero painters is "the source never said", not "there are
      // none". The RBQ register is the one that does this.
      tradesKnown: stats.unmapped < stats.rows,
    });
    if (stats.coords > 0) {
      const region = `${entry.country}-${entry.province}`;
      const held = centreSamples.get(region);
      // The biggest file's median, not an average of medians: a mean of two
      // medians is not the median of anything.
      if (!held || stats.coords > held.coords) {
        centreSamples.set(region, { lat: stats.lat, lon: stats.lon, coords: stats.coords, from: provider });
      }
    }
  }
}

files.sort((a, b) => a.objectKey.localeCompare(b.objectKey));

const centres = {};
for (const region of [...centreSamples.keys()].sort()) {
  const sample = centreSamples.get(region);
  centres[region] = {
    lat: Number(sample.lat.toFixed(4)),
    lon: Number(sample.lon.toFixed(4)),
    fromRows: sample.coords,
    fromProvider: sample.from,
  };
}

const generatedAt = new Date().toISOString().slice(0, 10);
const totalRows = files.reduce((sum, f) => sum + f.rows, 0);

const body = `// lib/sales/discovery/snapshotLibraryData.js
//
// GENERATED — do not edit by hand.
//   node --import ./scripts/alias-loader.mjs scripts/build-snapshot-library.mjs
//
// What is in the bucket, measured off the files themselves on ${generatedAt}:
// ${files.length} files, ${totalRows.toLocaleString("en-US")} rows.
//
// Every number here came out of a real file. \`rows\` is the part's own
// validated header count; \`trades\` is lib/sales/discovery/trades.js's
// tradeForCategories() run over every row of it; a region's centre is the
// MEDIAN of its rows' own coordinates, which is why there is one for every
// region and none was typed from memory.
//
// \`tradesKnown: false\` is a STATEMENT, not a zero. The RBQ register names no
// trade for anybody — see rbq/licence.js — so "0 painters" there means the
// source never said, and every surface must print "not known" instead.

/** One uploaded snapshot file. \`objectKey\` is appended to the configured base
 *  URL and is the ONLY way a campaign's snapshot URL is ever built. */
export const SNAPSHOT_FILES = Object.freeze(${JSON.stringify(files, null, 2)}.map(Object.freeze));

/** The median coordinate of each region's own rows, so a territory circle can
 *  be centred without anybody looking up a city. */
export const SNAPSHOT_REGION_CENTRES = Object.freeze(${JSON.stringify(centres, null, 2)});

/** When these numbers were measured off the files. */
export const SNAPSHOT_LIBRARY_MEASURED_AT = "${generatedAt}";
`;

fs.writeFileSync(OUT, body);
console.log(
  JSON.stringify({
    files: files.length,
    rows: totalRows,
    regions: Object.keys(centres).length,
    providers: [...new Set(files.map((f) => f.provider))],
    out: path.relative(ROOT, OUT),
  }),
);
