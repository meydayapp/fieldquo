// scripts/us-tax-rates-load.mjs
//
// Loads this month's US combined sales-tax rates by ZIP into UsSalesTaxRate.
//
//   npm run us-tax:load                      # every source, upsert into DATABASE_URL
//   npm run us-tax:load -- --dry-run         # fetch, parse, count; write nothing
//   npm run us-tax:load -- --states OH,WA    # only these (PA = the Census adapter)
//   npm run us-tax:load -- --as-of 2026-10-01
//   npm run us-tax:load -- --cache /tmp/ustax  # keep the downloaded files
//
// ══ Run from the owner's Mac, monthly ═════════════════════════════════════
//
// Like scripts/maps.mjs and scripts/bbb-principal.mjs, this is not a cron
// route. The boundary files are large — Ohio's and Washington's are ~300–400
// MB each, and a full run pulls a few gigabytes — which is well past what a
// Vercel function may hold in memory or spend on one request, and there is
// no login or CAPTCHA anywhere in the path, so a laptop with a normal
// connection does the whole thing in a few minutes. The states publish new
// files on quarter boundaries (Jan/Apr/Jul/Oct) with mid-quarter corrections,
// so the first week of each month is the right time to run it.
//
// ══ What it writes, and what it never does ═════════════════════════════════
//
// One upsert per ZIP (lib/tax/usRatesLoad.js#upsertSql), keyed on the ZIP.
// Running it twice on the same files changes nothing; running it on next
// month's files updates rows in place. Nothing is deleted: a ZIP a state
// drops keeps its last row, dated, and the resolver shows that date. The
// table has no companyId and holds no tenant data — it is a copy of public
// rate files with their provenance, and the only sanctioned write to
// production this loader makes is that copy.
//
// Sources, in lib/tax/usRatesLoad.js's header: the Streamlined Sales Tax
// member states' own rate and boundary files, and the Census ZCTA→county
// crosswalk for Pennsylvania's two county surcharges.

import { unzipSync } from "fflate";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  SST_MEMBER_STATES,
  parseSstListing,
  parseSstRateFile,
  composeSstZipRates,
  composePaZipRates,
  upsertSql,
} from "@/lib/tax/usRatesLoad";

const SST_BASE = "https://www.streamlinedsalestax.org/ratesandboundry/";
const CENSUS_ZCTA_COUNTY =
  "https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const dryRun = flag("--dry-run");
const asOf = opt("--as-of") ? new Date(opt("--as-of")) : new Date();
const only = opt("--states")
  ? opt("--states").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
  : null;
const cacheDir = opt("--cache");
if (cacheDir) mkdirSync(cacheDir, { recursive: true });

const wanted = (state) => !only || only.includes(state);

async function fetchBytes(url) {
  const name = url.split("/").pop();
  const cached = cacheDir ? join(cacheDir, name) : null;
  if (cached && existsSync(cached)) return new Uint8Array(readFileSync(cached));
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (cached) writeFileSync(cached, bytes);
  return bytes;
}

/** A .csv or a .zip holding one .csv — the states use both. */
async function fetchCsvText(url) {
  const bytes = await fetchBytes(url);
  if (/\.zip$/i.test(url)) {
    const files = unzipSync(bytes);
    const csvName = Object.keys(files).find((n) => /\.csv$/i.test(n)) || Object.keys(files)[0];
    if (!csvName) throw new Error(`empty zip: ${url}`);
    return Buffer.from(files[csvName]).toString("latin1");
  }
  return Buffer.from(bytes).toString("latin1");
}

async function loadSst() {
  const [ratesHtml, boundaryHtml] = await Promise.all([
    fetch(`${SST_BASE}Rates/`).then((r) => r.text()),
    fetch(`${SST_BASE}Boundary/`).then((r) => r.text()),
  ]);
  const rateFiles = parseSstListing(ratesHtml, "R", `${SST_BASE}Rates/`);
  const boundaryFiles = parseSstListing(boundaryHtml, "B", `${SST_BASE}Boundary/`);

  const all = [];
  const report = [];
  for (const state of SST_MEMBER_STATES) {
    if (!wanted(state)) continue;
    const rf = rateFiles[state];
    const bf = boundaryFiles[state];
    if (!rf || !bf) {
      report.push({ state, error: `no ${!rf ? "rate" : "boundary"} file listed` });
      continue;
    }
    try {
      const [rateText, boundaryText] = await Promise.all([fetchCsvText(rf.url), fetchCsvText(bf.url)]);
      const rates = parseSstRateFile(rateText);
      const source = `Streamlined Sales Tax rate file ${rf.name} (${rf.fileDate}) and boundary file ${bf.name} (${bf.fileDate}), published by the ${state} tax authority`;
      const { rows, stats } = composeSstZipRates(boundaryText, rates, {
        state,
        asOf,
        source,
        fetchedAt: new Date(),
      });
      report.push({
        state,
        rows: rows.length,
        spans: rows.filter((r) => r.zipSpansRates).length,
        rateFile: rf.name,
        boundaryFile: bf.name,
        unmatched: stats.unmatchedCodes.length,
      });
      all.push(...rows);
    } catch (err) {
      report.push({ state, error: err.message });
    }
  }
  return { rows: all, report };
}

async function loadPa() {
  const text = Buffer.from(await fetchBytes(CENSUS_ZCTA_COUNTY)).toString("utf8");
  const source =
    "Pennsylvania Department of Revenue — 6% state, +1% Allegheny County, +2% Philadelphia; ZIP→county from the U.S. Census Bureau 2020 ZCTA-to-county relationship file (tab20_zcta520_county20_natl.txt)";
  const { rows } = composePaZipRates(text, { asOf, source, fetchedAt: new Date() });
  return { rows, report: [{ state: "PA", rows: rows.length, spans: rows.filter((r) => r.zipSpansRates).length }] };
}

async function writeRows(rows) {
  const { db } = await import("@/lib/db");
  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { sql, params } = upsertSql(batch);
    await db.$executeRawUnsafe(sql, ...params);
    written += batch.length;
    process.stdout.write(`\r  upserted ${written}/${rows.length}`);
  }
  process.stdout.write("\n");
  const count = await db.usSalesTaxRate.count();
  await db.$disconnect();
  return count;
}

(async () => {
  console.log(`US sales-tax rates by ZIP — as of ${asOf.toISOString().slice(0, 10)}${dryRun ? " (dry run)" : ""}\n`);

  const sst = await loadSst();
  const pa = wanted("PA") ? await loadPa() : { rows: [], report: [] };

  for (const r of [...sst.report, ...pa.report]) {
    if (r.error) console.log(`  ${r.state}  FAILED  ${r.error}`);
    else
      console.log(
        `  ${r.state}  ${String(r.rows).padStart(5)} ZIPs` +
          (r.spans ? `  (${r.spans} span districts)` : "") +
          (r.rateFile ? `  ${r.rateFile} + ${r.boundaryFile}` : "") +
          (r.unmatched ? `  ${r.unmatched} unmatched codes` : ""),
      );
  }

  const rows = [...sst.rows, ...pa.rows];
  const failed = [...sst.report, ...pa.report].filter((r) => r.error);
  console.log(`\n  ${rows.length} rows from ${new Set(rows.map((r) => r.state)).size} states`);

  if (dryRun) {
    console.log("  dry run — nothing written");
  } else if (!process.env.DATABASE_URL) {
    console.log("  no DATABASE_URL — nothing written");
    process.exitCode = 1;
  } else {
    const total = await writeRows(rows);
    console.log(`  UsSalesTaxRate now holds ${total} rows`);
  }
  if (failed.length) {
    console.log(`\n  ${failed.length} state(s) failed — their rows are unchanged from the last run`);
    process.exitCode = 1;
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
