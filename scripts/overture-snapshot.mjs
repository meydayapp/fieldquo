#!/usr/bin/env node
// scripts/overture-snapshot.mjs
//
// Extract one campaign's worth of Overture places into a snapshot the pipeline
// can ingest.
//
// ══ This runs on a WORKSTATION, not on Vercel ══════════════════════════════
//
// lib/sales/discovery/overture/snapshot.js's header sets out the four reasons
// DuckDB cannot run inside a serverless function — time, memory, a native
// addon of tens of megabytes, and an extension it downloads at run time. This
// is the other half of that decision: the pull happens offline, monthly-ish,
// and the pipeline reads the file.
//
// ══ Nothing enters package.json ════════════════════════════════════════════
//
// It shells out to the `duckdb` CLI rather than depending on
// `@duckdb/node-api`. A native addon in package.json would be installed on
// every Vercel build, for a tool that never runs there, and would count
// against the function size limit for nothing.
//
//   brew install duckdb        # macOS
//   # or https://duckdb.org/docs/installation/
//
// ══ Usage ══════════════════════════════════════════════════════════════════
//
//   npm run overture:snapshot -- \
//     --out ottawa-painting.ndjson \
//     --bbox -76.40,45.10,-75.20,45.60 \
//     --trade painting
//
//   --bbox     minLon,minLat,maxLon,maxLat. REQUIRED: it is what prunes row
//              groups, and without it this scans 9.76 GiB instead of 32 MB.
//   --trade    a DISCOVERY_TRADES key. Omit for every mapped trade.
//   --release  pin a release. Omit and the current one is looked up.
//
// The `--import ./scripts/alias-loader.mjs` in the npm script is not optional:
// this file imports product modules that themselves use the "@/" alias, which
// bare node does not resolve. Running it as plain `node scripts/...` fails on
// the first import, which is a clearer failure than a copied constant that
// silently drifts from lib/sales/discovery/trades.js.
//
// Then upload the file somewhere the deployment can GET, and paste that URL
// into the campaign's Snapshot URL field.
import { spawnSync } from "node:child_process";
import { createWriteStream, readFileSync, unlinkSync } from "node:fs";
import { fetchCurrentRelease } from "../lib/sales/discovery/overture/release.js";
import { DISCOVERY_TRADES, mappedSourceCategories } from "../lib/sales/discovery/trades.js";
import { SNAPSHOT_FORMAT } from "../lib/sales/discovery/overture/snapshot.js";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function die(message) {
  console.error(`overture-snapshot: ${message}`);
  process.exit(1);
}

const out = arg("out");
const bbox = arg("bbox");
const trade = arg("trade");
if (!out) die("--out is required");
if (!bbox) die("--bbox minLon,minLat,maxLon,maxLat is required — without it this scans the whole planet");

const bounds = bbox.split(",").map(Number);
if (bounds.length !== 4 || bounds.some((n) => !Number.isFinite(n))) {
  die(`--bbox must be four numbers, got "${bbox}"`);
}
const [minLon, minLat, maxLon, maxLat] = bounds;

if (trade && !DISCOVERY_TRADES[trade]) {
  die(`--trade "${trade}" is not a discovery trade. Known: ${Object.keys(DISCOVERY_TRADES).sort().join(", ")}`);
}

// The categories to pull. Scoped to what the trade map recognises, because a
// category nothing maps is a row the ingest would count as unusable anyway.
const categories = trade ? DISCOVERY_TRADES[trade].sourceCategories : mappedSourceCategories();
const quoted = categories.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");

let release = arg("release");
if (!release) {
  const found = await fetchCurrentRelease({});
  if (found.error) die(`could not determine the current release: ${found.error}`);
  release = found.release;
}
console.error(`overture-snapshot: release ${release}, ${categories.length} categor(y|ies)`);

const version = spawnSync("duckdb", ["--version"], { encoding: "utf8" });
if (version.error) die("the `duckdb` CLI is not on PATH — see https://duckdb.org/docs/installation/");

const temp = `${out}.rows.json`;
const sql = `
INSTALL httpfs; LOAD httpfs;
SET s3_region='us-west-2';
SET preserve_insertion_order=false;

COPY (
  SELECT id,
         names.primary                AS name,
         categories.primary           AS cat_primary,
         categories.alternate         AS cat_alternate,
         taxonomy.hierarchy           AS tax_hierarchy,
         confidence,
         operating_status,
         phones, websites, emails,
         addresses,
         sources,
         bbox.xmin AS lon, bbox.ymin AS lat
  FROM read_parquet('s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*.parquet')
  WHERE bbox.xmin BETWEEN ${minLon} AND ${maxLon}
    AND bbox.ymin BETWEEN ${minLat} AND ${maxLat}
    AND ( categories.primary IN (${quoted})
       OR list_has_any(categories.alternate, [${quoted}]) )
) TO '${temp}' (FORMAT json);
`;

console.error("overture-snapshot: scanning the release — this takes about a minute");
const run = spawnSync("duckdb", ["-c", sql], { stdio: ["ignore", "inherit", "inherit"] });
if (run.status !== 0) die(`duckdb exited ${run.status}`);

// ── Wrap the rows in a manifest ─────────────────────────────────────────────
//
// The manifest goes FIRST so the reader knows the release, the filter and the
// row count before it has parsed a single record — a snapshot extracted from
// last month's release is then refused at line 1 rather than ingested.
const rows = readFileSync(temp, "utf8").split("\n").filter((l) => l.trim());
const stream = createWriteStream(out);
stream.write(
  `${JSON.stringify({
    fieldquoSnapshot: SNAPSHOT_FORMAT,
    provider: "overture",
    release,
    extractedAt: new Date().toISOString(),
    filter: { bbox: { minLon, minLat, maxLon, maxLat }, trade: trade || null, categories },
    count: rows.length,
  })}\n`,
);
for (const row of rows) stream.write(`${row}\n`);
stream.end();
await new Promise((resolve) => stream.on("close", resolve));
unlinkSync(temp);

console.error(`overture-snapshot: wrote ${out} — ${rows.length} rows, release ${release}`);
