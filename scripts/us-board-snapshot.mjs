// scripts/us-board-snapshot.mjs
//
// Turn a US state licence board's published file into a snapshot a discovery
// run can read.
//
//   node --import ./scripts/alias-loader.mjs scripts/us-board-snapshot.mjs --board us_ca_cslb --out ca.ndjson
//   ... --board us_wa_lni --city Seattle --out seattle.ndjson
//   ... --board us_or_ccb --limit 500 --out sample.ndjson
//   ... --board us_ca_cslb --file /path/to/MasterLicenseData.csv --out ca.ndjson
//
// The alias loader is not optional: the modules this imports use the `@/`
// specifier, which bare Node does not resolve. `npm run us-board:snapshot`
// wraps it.
//
// ══ Why this is a script and not a route ═══════════════════════════════════
//
// lib/sales/discovery/usBoard/snapshot.js's header sets it out in three parts:
// the files are whole states including 85,006 dead Washington licences, Oregon
// needs grouping a hundred-row page cannot do, and the unknown-class report is
// a claim about the whole file. Same shape, and same reasoning, as
// scripts/rbq-snapshot.mjs and scripts/overture-snapshot.mjs.
//
// ══ The CSV splitter is IMPORTED, not copied ═══════════════════════════════
//
// `splitCsvLine` lives in lib/sales/discovery/rbq/licence.js. It is an RFC 4180
// splitter with nothing Quebecois about it, and California's file needs exactly
// the same handling — 242,879 rows, quoted fields, embedded commas inside
// business names. A second copy here would be AGENTS.md's fourth failure class
// with a very specific symptom: the copy that does not handle `""` puts a
// postal code in the phone column, and nothing says so.
//
// It is imported across provider directories rather than hoisted into a shared
// module because hoisting means editing rbq/licence.js, which is shipped,
// working, and covered by its own check. Naming the oddity here is the honest
// version; a silent duplicate would not be.
//
// ══ The source statement travels with the file ═════════════════════════════
//
// The manifest carries the board's attribution, and
// lib/sales/discovery/usBoard/snapshot.js REFUSES a snapshot without it.
//
// None of the three boards' licences DEMANDS attribution — Washington is
// PDDL, Oregon is public domain, California is a plain public record. The
// discipline is kept anyway, and snapshot.js says why: a file of 219,255 phone
// numbers with no statement of where it came from is a file nobody can
// re-check, and the easiest way to produce one is to write an extractor that
// forgets.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";

import { splitCsvLine } from "../lib/sales/discovery/rbq/licence.js";
import { usBoard, usBoardKeys, boardProblems } from "../lib/sales/discovery/usBoard/boards.js";
import { isKnownClass, namespacedClass } from "../lib/sales/discovery/usBoard/classes.js";
import {
  addLicenceRow,
  classStatement,
  parseUsDate,
  rowIsActive,
  startLicence,
} from "../lib/sales/discovery/usBoard/record.js";
import { US_BOARD_SNAPSHOT_FORMAT } from "../lib/sales/discovery/usBoard/snapshot.js";
import { fetchSocrataDataset, isBoardRelease } from "../lib/sales/discovery/usBoard/socrata.js";
import { tradeForCategories } from "../lib/sales/discovery/trades.js";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

const BOARD_KEY = args.get("board");
const board = usBoard(BOARD_KEY);
if (!board) {
  console.error(`--board must be one of: ${usBoardKeys().join(", ")}`);
  process.exit(1);
}
// The declaration is checked before anything is downloaded. A board whose
// status column and allow-list disagree keeps every expired licence in the
// state, and finding that out after a 77 MB download is finding it out late.
const declarationProblems = boardProblems(board);
if (declarationProblems.length) {
  console.error(`${board.key} is misdeclared: ${declarationProblems.join(", ")}`);
  process.exit(1);
}

const OUT = args.get("out") || `${board.key}-snapshot.ndjson`;
const CITY = args.get("city") || null;
const STATE = args.get("state") || null;
const LIMIT = args.has("limit") ? Number(args.get("limit")) : null;
const LOCAL = args.get("file") || null;

const fold = (v) => String(v ?? "").trim().toLowerCase();

async function resolveSource() {
  if (LOCAL) {
    return {
      stream: fs.createReadStream(LOCAL),
      sourceUrl: `file://${path.resolve(LOCAL)}`,
      // A vintage the file cannot always tell us. For a board that carries its
      // own update column the scan finds it; for one that does not, --release
      // is required rather than guessed, because a snapshot stamped with
      // today's date over last month's download is a provenance lie.
      release: args.get("release") || null,
    };
  }

  if (board.source.kind === "socrata") {
    console.log("Resolving the dataset through Socrata…");
    const resolved = await fetchSocrataDataset(board);
    if (!resolved.ok) {
      for (const p of resolved.problems) console.error(`  ${p}`);
      process.exit(1);
    }
    console.log(`  ${resolved.title}`);
    console.log(`  licence ${resolved.licenceId} (${resolved.licenceName}), release ${resolved.release}`);
    console.log(`  ${resolved.url}`);
    const response = await fetch(resolved.url, { redirect: "follow" });
    if (!response.ok) {
      console.error(`  the download answered ${response.status}`);
      process.exit(1);
    }
    return { stream: Readable.fromWeb(response.body), sourceUrl: resolved.url, release: resolved.release };
  }

  console.log(`Downloading ${board.source.url}`);
  const response = await fetch(board.source.url, { redirect: "follow" });
  if (!response.ok) {
    console.error(`  the download answered ${response.status}`);
    process.exit(1);
  }
  // Null on purpose. A direct board has no Last-Modified to read, so the
  // release comes out of the scan below — see board.source.releaseColumn.
  return { stream: Readable.fromWeb(response.body), sourceUrl: board.source.url, release: null };
}

async function main() {
  const { stream, sourceUrl, release: resolvedRelease } = await resolveSource();

  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  const byLicence = new Map();
  let rows = 0;
  let badWidth = 0;
  let inactive = 0;
  let filteredOut = 0;
  let releaseFromData = null;
  const unknownClasses = new Map();

  for await (const line of rl) {
    if (!line) continue;
    if (!header) {
      header = splitCsvLine(line);
      const wanted = Object.values(board.columns).filter((c) => typeof c === "string" && c);
      const missing = wanted.filter((c) => !header.includes(c));
      if (missing.length) {
        // The board changed its columns. Loud, because the quiet alternative
        // is a snapshot of 219,255 businesses with no phone numbers in it.
        console.error(`The file no longer carries: ${missing.join(", ")}`);
        process.exit(1);
      }
      continue;
    }

    const fields = splitCsvLine(line);
    // A row whose width disagrees with the header has shifted columns, and
    // reading it would put a ZIP code in the phone field. Counted and skipped,
    // so a systemic parse failure shows up as a number rather than as garbage.
    if (fields.length !== header.length) {
      badWidth++;
      continue;
    }
    rows++;
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i];

    // The release, for a board that publishes none. Taken over EVERY row,
    // including the inactive ones and the filtered ones, because it is a fact
    // about the file rather than about the subset kept.
    if (board.source.releaseColumn) {
      const at = parseUsDate(row[board.source.releaseColumn]);
      if (at && (!releaseFromData || at > releaseFromData)) releaseFromData = at;
    }

    if (!rowIsActive(board, row)) {
      inactive++;
      continue;
    }
    if (STATE && fold(row[board.columns.province]) !== fold(STATE)) {
      filteredOut++;
      continue;
    }
    if (CITY && fold(row[board.columns.city]) !== fold(CITY)) {
      filteredOut++;
      continue;
    }

    // Class tokens the shipped vocabulary has never seen. A board that adds a
    // specialty then shows up as a NUMBER here rather than as silence — which
    // is the half of the "does this category exist" problem that a static
    // check cannot close.
    for (const token of [board.classToken(row), ...board.extraClassTokens(row)]) {
      if (token && !isKnownClass(board.key, token)) {
        unknownClasses.set(token, (unknownClasses.get(token) || 0) + 1);
      }
    }

    const id = String(row[board.columns.id] ?? "").trim();
    if (!id) continue;
    const existing = byLicence.get(id);
    if (existing) addLicenceRow(board, existing, row);
    else if (LIMIT === null || byLicence.size < LIMIT) {
      byLicence.set(id, addLicenceRow(board, startLicence(board, row), row));
    }
  }

  const licences = [...byLicence.values()];

  const release = resolvedRelease || releaseFromData;
  if (!isBoardRelease(release)) {
    console.error(
      "This file carries no usable release date. A snapshot stamped with the day it was extracted " +
        "would be a provenance lie, so nothing was written. Pass --release YYYY-MM-DD if you know it.",
    );
    process.exit(1);
  }

  const manifest = {
    fieldquoSnapshot: US_BOARD_SNAPSHOT_FORMAT,
    provider: board.key,
    release,
    count: licences.length,
    sourceUrl,
    datasetUrl: board.datasetUrl,
    // Refused by the reader when absent — see snapshot.js's manifestProblems.
    attribution: board.licence.attribution,
    filter: { state: STATE, city: CITY, limit: LIMIT },
    rowsRead: rows,
    extractedAt: new Date().toISOString(),
  };

  const out = fs.createWriteStream(OUT);
  out.write(`${JSON.stringify(manifest)}\n`);
  for (const licence of licences) out.write(`${JSON.stringify(licence)}\n`);
  await new Promise((resolve) => out.end(resolve));

  // ── What the operator is told, and why each number is here ──────────────
  //
  // The fill rates are measured on the licences actually written, not on the
  // file, because that is what the campaign will read. The trade counts run
  // the SHIPPED tradeForCategories over the SHIPPED namespacing, so the number
  // printed here is the number the pipeline will produce — not a second
  // estimate of it that can drift.
  const withPhone = licences.filter((l) => l.phone).length;
  const withEmail = licences.filter((l) => l.email).length;
  const withAddress = licences.filter((l) => l.line1).length;
  const pct = (n) => (licences.length ? `${((n / licences.length) * 100).toFixed(2)}%` : "—");

  let decisive = 0;
  const byTrade = new Map();
  for (const licence of licences) {
    const alternate = (licence.classes || []).map((t) => namespacedClass(board.key, t)).sort();
    const primary = alternate.length === 1 ? alternate[0] : null;
    const { tradeKey } = tradeForCategories({ primary, alternate });
    if (!tradeKey) continue;
    decisive++;
    byTrade.set(tradeKey, (byTrade.get(tradeKey) || 0) + 1);
  }

  console.log(`\n${rows} rows read → ${licences.length} licences`);
  if (inactive) console.log(`  ${inactive} rows the board does not call active`);
  if (filteredOut) console.log(`  ${filteredOut} rows outside the filter`);
  if (badWidth) console.log(`  ${badWidth} rows whose column count disagreed with the header`);
  console.log(`  phone   ${withPhone} (${pct(withPhone)})`);
  console.log(`  email   ${withEmail} (${pct(withEmail)})`);
  console.log(`  address ${withAddress} (${pct(withAddress)})`);
  console.log(`  trade from the licence class ${decisive} (${pct(decisive)})`);
  for (const [trade, n] of [...byTrade].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(7)}  ${trade}`);
  }
  if (unknownClasses.size) {
    // Not a failure. It is the board adding a specialty, and the point of
    // saying so is that the alternative is 400 licences silently reaching no
    // trade for a reason nobody can see.
    console.log(`\n  ${unknownClasses.size} class code(s) this build has never seen:`);
    for (const [token, n] of [...unknownClasses].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${String(n).padStart(7)}  ${token}  — add it to lib/sales/discovery/usBoard/classes.js`);
    }
  }
  const sample = licences.find((l) => (l.classes || []).length);
  if (sample) console.log(`\n  e.g. ${sample.name} — ${classStatement(sample)}`);
  console.log(`\nWrote ${OUT}. Host it somewhere the deployment can GET, and put that URL on the campaign.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
