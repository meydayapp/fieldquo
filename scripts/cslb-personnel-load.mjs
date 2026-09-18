// scripts/cslb-personnel-load.mjs
//
// Load California CSLB's public PERSONNEL file into RegisterPersonnel, so a
// prospect's licence number answers "who owns it" with a table read.
//
//   node --env-file-if-exists=.env --import ./scripts/alias-loader.mjs scripts/cslb-personnel-load.mjs
//   ... --file /path/to/PersonnelData.csv        # a copy already downloaded
//   ... --dry-run                                 # parse and count, write nothing
//   ... --then-lookup                             # afterwards, look up every CSLB prospect not checked in 180 days
//
// ══ Why a script and not a route ══════════════════════════════════════════
//
// The file is 85 MB and CSLB's edge closes the stream at ninety seconds
// whatever the client does (measured 2026-09-17: three downloads of the
// same URL returned 85.8 MB, 55.0 MB and 13.9 MB, the shorter two cut
// mid-line). A Vercel function cannot hold that open and then write 406,161
// rows inside its own limit. The same reasoning as scripts/us-board-snapshot.mjs.
//
// ══ A truncated download is REFUSED, not loaded ═══════════════════════════
//
// Three tests, all must pass: the file ends with a newline; the last line
// parses to the header's column count; and the number of distinct licences
// is at least CSLB_MIN_LICENCES (the 2026-09-17 count less a margin). A
// file that fails any of them is written nowhere, and the message says
// which — a half file loaded would leave every licence past the cut with
// "no personnel on file", which is a claim the board never made.
//
// ══ Idempotent ════════════════════════════════════════════════════════════
//
// Rows are upserted on (provider, licenceNumber, name). A re-run of the
// same file changes nothing; a newer file adds the people it names and
// refreshes the titles of those already there. People the board has since
// dropped keep their row with the older `loadedAt` — nothing here deletes —
// and the lookup reads only a licence's latest load, so they stop reaching
// the card. ProspectPerson rows already copied from an earlier load are NOT
// touched: they carry their own `seenAt` and the card's rule reads through
// them.
import fs from "node:fs";
import readline from "node:readline";
import { Readable } from "node:stream";

import { db } from "@/lib/db";
import { splitCsvLine } from "@/lib/sales/discovery/rbq/licence";
import {
  CSLB_PERSONNEL_COLUMNS,
  CSLB_PERSONNEL_PROVIDER,
  CSLB_PERSONNEL_URL,
  PRINCIPAL_RECHECK_DAYS,
  cslbPeopleFromRow,
  lookupRegisterPeopleFor,
} from "@/lib/sales/intel/registerPeople";

/** Below this many distinct licences the file is not the file. */
export const CSLB_MIN_LICENCES = 200_000;
const UA = "Mozilla/5.0 (compatible; FieldQuoBot/1.0; +https://fieldquo.com/bot)";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1] ?? fallback;
}
const flag = (name) => process.argv.includes(name);

async function download(toPath) {
  const res = await fetch(CSLB_PERSONNEL_URL, { headers: { "user-agent": UA } });
  if (!res.ok || !res.body) throw new Error(`CSLB answered ${res.status} for the personnel file`);
  const out = fs.createWriteStream(toPath);
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(res.body)) {
    bytes += chunk.length;
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
  }
  await new Promise((r) => out.end(r));
  return bytes;
}

/** The three completeness tests. Returns null when complete, else why not. */
export function truncationProblem({ endsWithNewline, lastLineWidth, distinctLicences }) {
  if (!endsWithNewline) return "the file does not end with a newline — the download was cut mid-line";
  if (lastLineWidth !== CSLB_PERSONNEL_COLUMNS.length) return `the last line has ${lastLineWidth} columns, not ${CSLB_PERSONNEL_COLUMNS.length}`;
  if (distinctLicences < CSLB_MIN_LICENCES) return `${distinctLicences.toLocaleString()} distinct licences is below the ${CSLB_MIN_LICENCES.toLocaleString()} floor`;
  return null;
}

async function parseFile(path) {
  const stat = fs.statSync(path);
  const tail = Buffer.alloc(1);
  const fd = fs.openSync(path, "r");
  fs.readSync(fd, tail, 0, 1, stat.size - 1);
  fs.closeSync(fd);
  const endsWithNewline = tail.toString() === "\n";

  const people = new Map(); // licence|name → row
  const licences = new Set();
  let header = null;
  let rows = 0;
  let lastLineWidth = 0;
  let badWidth = 0;
  let release = null;
  const rl = readline.createInterface({ input: fs.createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.replace(/\r$/, "");
    if (!header) {
      header = splitCsvLine(line).map((h) => h.trim());
      const expected = CSLB_PERSONNEL_COLUMNS.join(",");
      if (header.join(",") !== expected) throw new Error(`Header differs from the personnel file's:\n  got  ${header.join(",")}\n  want ${expected}`);
      continue;
    }
    if (!line) continue;
    const cols = splitCsvLine(line);
    lastLineWidth = cols.length;
    rows += 1;
    if (cols.length !== CSLB_PERSONNEL_COLUMNS.length) {
      badWidth += 1;
      continue;
    }
    licences.add(cols[0].trim());
    for (const person of cslbPeopleFromRow(cols)) {
      const key = `${person.licenceNumber}|${person.name}`;
      const prev = people.get(key);
      if (prev) {
        // The same person twice on one licence (a second REC-TP row): union
        // the titles rather than keep one row's worth.
        prev.titles = [...new Set([...prev.titles, ...person.titles])];
        prev.classes = [...new Set([...prev.classes, ...person.classes])];
      } else people.set(key, person);
      if (person.lastUpdated && (!release || person.lastUpdated > release)) release = person.lastUpdated;
    }
  }
  return { rows, badWidth, people, licences: licences.size, endsWithNewline, lastLineWidth, release: release ? release.toISOString().slice(0, 10) : null };
}

async function main() {
  const dryRun = flag("--dry-run");
  let file = arg("--file");
  const started = Date.now();
  if (!file) {
    file = `/tmp/cslb-personnel-${Date.now()}.csv`;
    process.stdout.write(`Downloading ${CSLB_PERSONNEL_URL} …\n`);
    const bytes = await download(file);
    process.stdout.write(`  ${bytes.toLocaleString()} bytes in ${((Date.now() - started) / 1000).toFixed(0)}s → ${file}\n`);
  }
  const parsed = await parseFile(file);
  process.stdout.write(`Parsed ${parsed.rows.toLocaleString()} rows, ${parsed.licences.toLocaleString()} licences, ${parsed.people.size.toLocaleString()} current people, release ${parsed.release}\n`);
  if (parsed.badWidth) process.stdout.write(`  ${parsed.badWidth} rows of the wrong width were skipped\n`);
  const problem = truncationProblem(parsed);
  if (problem) {
    process.stderr.write(`REFUSED — ${problem}. Nothing was written. Re-run on a faster connection or pass --file with a complete copy.\n`);
    process.exit(2);
  }
  if (dryRun) {
    process.stdout.write("Dry run: nothing written.\n");
    return;
  }

  const loadedAt = new Date();
  const list = [...parsed.people.values()];
  // One INSERT … ON CONFLICT per batch, through jsonb_to_recordset, rather
  // than one upsert per person: 334,374 round trips to Neon is hours, and a
  // $transaction of five hundred upserts overruns the interactive
  // transaction's five-second limit (measured on the first run). The
  // conflict target is the model's unique key, so a re-run of the same file
  // is a no-op update and a newer file refreshes titles in place.
  const BATCH = 2000;
  let written = 0;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH).map((p) => ({
      licenceNumber: p.licenceNumber,
      name: p.name,
      givenName: p.givenName,
      titles: p.titles,
      classes: p.classes,
      associatedAt: p.associatedAt ? p.associatedAt.toISOString() : null,
    }));
    await db.$executeRaw`
      INSERT INTO "RegisterPersonnel" ("id", "provider", "licenceNumber", "name", "givenName", "titles", "classes", "associatedAt", "release", "loadedAt")
      SELECT gen_random_uuid()::text, ${CSLB_PERSONNEL_PROVIDER}, x."licenceNumber", x."name", x."givenName", x."titles", x."classes", x."associatedAt", ${parsed.release}, ${loadedAt}
      FROM jsonb_to_recordset(${JSON.stringify(slice)}::jsonb)
        AS x("licenceNumber" text, "name" text, "givenName" text, "titles" text[], "classes" text[], "associatedAt" timestamptz)
      ON CONFLICT ("provider", "licenceNumber", "name") DO UPDATE SET
        "givenName" = EXCLUDED."givenName",
        "titles" = EXCLUDED."titles",
        "classes" = EXCLUDED."classes",
        "associatedAt" = EXCLUDED."associatedAt",
        "release" = EXCLUDED."release",
        "loadedAt" = EXCLUDED."loadedAt"`;
    written += slice.length;
    if (written % 20_000 < BATCH || written === list.length) process.stdout.write(`  ${written.toLocaleString()} / ${list.length.toLocaleString()} upserted\n`);
  }
  // People the board no longer lists: rows from an earlier load this one did
  // not refresh. NOT deleted — nothing in this repo deletes data — they keep
  // their older `loadedAt`, and lookupRegisterPeople reads only the rows of
  // a licence's LATEST load, so a dropped person stops reaching the card
  // without a row being destroyed.
  const stale = await db.registerPersonnel.count({
    where: { provider: CSLB_PERSONNEL_PROVIDER, loadedAt: { lt: loadedAt } },
  });
  process.stdout.write(`Loaded. ${written.toLocaleString()} people current, ${stale} earlier rows no longer on the file (kept, superseded), ${((Date.now() - started) / 1000).toFixed(0)}s.\n`);

  if (flag("--then-lookup")) {
    const since = new Date(Date.now() - PRINCIPAL_RECHECK_DAYS * 24 * 60 * 60 * 1000);
    const rows = await db.prospect.findMany({
      where: { sourceProvider: CSLB_PERSONNEL_PROVIDER, mergedIntoId: null, OR: [{ principalCheckedAt: null }, { principalCheckedAt: { lt: since } }] },
      select: { id: true },
    });
    process.stdout.write(`Looking up ${rows.length.toLocaleString()} CSLB prospects …\n`);
    let done = 0;
    const totals = { found: 0, added: 0 };
    for (let i = 0; i < rows.length; i += 200) {
      const r = await lookupRegisterPeopleFor({ db, ids: rows.slice(i, i + 200).map((x) => x.id), force: true });
      totals.found += r.found;
      totals.added += r.added;
      done += Math.min(200, rows.length - i);
      if (done % 5_000 === 0 || done === rows.length) process.stdout.write(`  ${done.toLocaleString()} looked up, ${totals.found.toLocaleString()} with a name, ${totals.added.toLocaleString()} people added\n`);
    }
  }
}

main()
  .catch((err) => {
    process.stderr.write(`${err?.stack || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect?.());
