// scripts/rbq-snapshot.mjs
//
// Turn Quebec's 341 MB licence register into a snapshot a discovery run can
// read.
//
//   node --import ./scripts/alias-loader.mjs scripts/rbq-snapshot.mjs --out rbq.ndjson
//   ... --region "Montréal" --out rbq-montreal.ndjson
//   ... --municipality Laval --limit 500 --out sample.ndjson
//   ... --file /path/to/already-unzipped.csv --release 2026-09-03 --out x.ndjson
//
// The alias loader is not optional: the modules this imports use the `@/`
// specifier, which bare Node does not resolve. Every other check in this repo
// is invoked the same way, and `npm run rbq:snapshot` wraps it.
//
// ══ Why this is a script and not a route ═══════════════════════════════════
//
// lib/sales/discovery/rbq/snapshot.js's header sets it out: 927,337 rows in
// 341 MB of CSV, streamed and grouped into 54,264 objects. That is tens of
// seconds and a few hundred megabytes of live objects, against a serverless
// function whose maxDuration this repo never sets. The same shape, and the
// same reasoning, as scripts/overture-snapshot.mjs.
//
// ══ No dependencies, including for the zip ═════════════════════════════════
//
// The published resource is a zip. Node ships zlib but no zip reader, and
// adding one to package.json for a script that runs monthly on somebody's
// laptop is not a trade worth making — so the local file header is parsed by
// hand and the single entry is piped through `inflateRaw`. Twenty lines,
// streaming, and it never materialises 341 MB in memory.
//
// ══ CC-BY travels with the file ════════════════════════════════════════════
//
// The manifest carries the attribution notice, and lib/sales/discovery/rbq/
// snapshot.js REFUSES a snapshot without it. A copy of a CC-BY dataset with
// the credit stripped off is the one thing the licence does not allow, and the
// easiest way to produce one is to write an extractor that forgets.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import { Readable } from "node:stream";

import { fetchRbqResource, RBQ_ATTRIBUTION, RBQ_DATASET_URL } from "../lib/sales/discovery/rbq/register.js";
import {
  RBQ_COLUMNS,
  addLicenceRow,
  splitCsvLine,
  startLicence,
} from "../lib/sales/discovery/rbq/licence.js";
import { RBQ_PROVIDER_KEY, RBQ_SNAPSHOT_FORMAT } from "../lib/sales/discovery/rbq/snapshot.js";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}
const OUT = args.get("out") || "rbq-snapshot.ndjson";
const REGION = args.get("region") || null;
const MUNICIPALITY = args.get("municipality") || null;
const LIMIT = args.has("limit") ? Number(args.get("limit")) : null;
const LOCAL = args.get("file") || null;

const fold = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * The single entry of a zip, as a stream.
 *
 * Only the LOCAL header is read, so this works while the body is still
 * arriving — which is the point. Method 8 is deflate and method 0 is stored;
 * anything else is refused loudly rather than producing silent garbage.
 */
async function unzipStream(response) {
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.readUInt32LE(0) !== 0x04034b50) throw new Error("that download is not a zip file");
  const method = buffer.readUInt16LE(8);
  const nameLength = buffer.readUInt16LE(26);
  const extraLength = buffer.readUInt16LE(28);
  const start = 30 + nameLength + extraLength;
  const body = buffer.subarray(start);
  if (method === 0) return Readable.from(body);
  if (method !== 8) throw new Error(`the zip uses compression method ${method}, which this script cannot read`);
  return Readable.from(body).pipe(zlib.createInflateRaw());
}

async function main() {
  let source;
  let release;
  let sourceUrl;

  if (LOCAL) {
    // A vintage the file itself cannot tell us. Refused rather than guessed:
    // a snapshot stamped with today's date over last month's CSV is a
    // provenance lie, and provenance is the whole reason for the column.
    release = args.get("release");
    if (!release) {
      console.error("--file needs --release YYYY-MM-DD; the CSV does not carry its own publication date.");
      process.exit(1);
    }
    sourceUrl = `file://${path.resolve(LOCAL)}`;
    source = fs.createReadStream(LOCAL);
    console.log(`Reading ${LOCAL} as release ${release}`);
  } else {
    console.log("Resolving the resource through CKAN…");
    const resolved = await fetchRbqResource();
    if (!resolved.ok) {
      for (const p of resolved.problems) console.error(`  ${p}`);
      process.exit(1);
    }
    release = resolved.release;
    sourceUrl = resolved.url;
    console.log(`  ${resolved.title}`);
    console.log(`  licence ${resolved.licenceId}, release ${release}`);
    console.log(`  ${sourceUrl}`);
    const response = await fetch(sourceUrl, { redirect: "follow" });
    if (!response.ok) {
      console.error(`  the download answered ${response.status}`);
      process.exit(1);
    }
    source = await unzipStream(response);
  }

  const rl = readline.createInterface({ input: source, crlfDelay: Infinity });
  let header = null;
  const byLicence = new Map();
  let rows = 0;
  let badWidth = 0;
  let filteredOut = 0;

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = splitCsvLine(line);
      const missing = Object.values(RBQ_COLUMNS).filter((c) => !header.includes(c));
      if (missing.length) {
        // The register changed its columns. Loud, because the alternative is a
        // snapshot of 54,264 businesses with no phone numbers in it.
        console.error(`The extract no longer carries: ${missing.join(", ")}`);
        process.exit(1);
      }
      continue;
    }
    const fields = splitCsvLine(line);
    // A row whose width disagrees with the header is a row whose columns have
    // shifted; reading it would put a postal code in the phone column. Counted
    // and skipped, so a systemic parse failure shows as a number.
    if (fields.length !== header.length) {
      badWidth++;
      continue;
    }
    rows++;
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i];

    if (REGION && fold(row[RBQ_COLUMNS.region]) !== fold(REGION)) {
      filteredOut++;
      continue;
    }
    if (MUNICIPALITY && fold(row[RBQ_COLUMNS.municipality]) !== fold(MUNICIPALITY)) {
      filteredOut++;
      continue;
    }

    const id = row[RBQ_COLUMNS.licence];
    if (!id) continue;
    const existing = byLicence.get(id);
    if (existing) addLicenceRow(existing, row);
    else if (LIMIT === null || byLicence.size < LIMIT) byLicence.set(id, addLicenceRow(startLicence(row), row));
  }

  const licences = [...byLicence.values()];
  const manifest = {
    fieldquoSnapshot: RBQ_SNAPSHOT_FORMAT,
    provider: RBQ_PROVIDER_KEY,
    release,
    count: licences.length,
    sourceUrl,
    datasetUrl: RBQ_DATASET_URL,
    // Refused by the reader when absent — see snapshot.js's manifestProblems.
    attribution: RBQ_ATTRIBUTION,
    filter: { region: REGION, municipality: MUNICIPALITY, limit: LIMIT },
    rowsRead: rows,
    extractedAt: new Date().toISOString(),
  };

  const out = fs.createWriteStream(OUT);
  out.write(`${JSON.stringify(manifest)}\n`);
  for (const licence of licences) out.write(`${JSON.stringify(licence)}\n`);
  await new Promise((resolve) => out.end(resolve));

  const withPhone = licences.filter((l) => l.phone).length;
  const withEmail = licences.filter((l) => l.email).length;
  const withAddress = licences.filter((l) => l.address).length;
  const pct = (n) => (licences.length ? `${((n / licences.length) * 100).toFixed(1)}%` : "—");

  console.log(`\n${rows} rows read → ${licences.length} licences`);
  if (filteredOut) console.log(`  ${filteredOut} rows outside the filter`);
  if (badWidth) console.log(`  ${badWidth} rows whose column count disagreed with the header`);
  console.log(`  phone   ${withPhone} (${pct(withPhone)})`);
  console.log(`  email   ${withEmail} (${pct(withEmail)})`);
  console.log(`  address ${withAddress} (${pct(withAddress)})`);
  console.log(`\nWrote ${OUT}. Host it somewhere the deployment can GET, and put that URL on the campaign.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
