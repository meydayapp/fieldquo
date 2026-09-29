// scripts/migrate-hr-documents-private.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/migrate-hr-documents-private.mjs           # dry run
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/migrate-hr-documents-private.mjs --apply   # move
//
// Moves every HR file uploaded before 2026-09-29 from a public Cloudinary URL
// to private ("authenticated") storage IN PLACE, and points its
// WorkerDocument row at the new URL. Why HR files are private, and how they
// are opened now: lib/hr/documentFile.js.
//
// ══ Run --apply only AFTER the deploy that adds /api/hr/documents/[id]/open ══
//
// Before that deploy, the screens link straight to the stored public URL; a
// file moved to private under them would 401 from the old link. After it,
// every link goes through the open route, which signs whichever type the row
// names — so moving a file changes nothing a person sees except that the old
// public URL stops working. That is the point.
//
// ══ What it does, per file ═════════════════════════════════════════════════
//
//   1. uploader.rename(id → SAME id, type "upload" → to_type "authenticated",
//      invalidate: true). The same asset, same bytes, same public_id, same
//      version; only its delivery type changes, and the CDN's cached public
//      copies are purged so the old URL stops answering from cache too.
//      Chosen over api.update(access_mode: "authenticated"), which needs
//      token-based access — a paid Cloudinary add-on this account (Free) does
//      not have — and over re-uploading, which would be a copy with the
//      public original left behind.
//   2. WorkerDocument.fileUrl: "/upload/" → "/authenticated/" in the same
//      place (authenticatedUrlFor), for exactly the rows that held the old
//      URL (updateMany on id + old fileUrl, so a row changed meanwhile is
//      left alone). No other column is written.
//
// ══ What it never does ═════════════════════════════════════════════════════
//
//   - never deletes an asset or a row (rename with overwrite: false; no
//     destroy anywhere);
//   - never touches a file outside its own company's folder, a URL it can't
//     read, or a file whose URL is ALSO stored in any other table's text
//     column (a company document or job file that happens to be the same
//     upload would break on the public surface that shows it — listed for a
//     human instead);
//   - never moves a file the dry run could not find on Cloudinary.
//
// Idempotent: a file already private is skipped; one moved on Cloudinary
// whose row update failed (a crash between the two) is found under
// "authenticated" on the next run and only its row is updated.
//
// Dry run by default: reads the database and Cloudinary's Admin API
// (one lookup per file; the Free plan allows 500 an hour) and prints what
// --apply would do. Nothing is written.
import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { parseCloudinaryFileUrl, hrFileLocation, authenticatedUrlFor, HR_DELIVERY_TYPE } from "@/lib/hr/documentFile";

const apply = process.argv.includes("--apply");
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
if (!cloudName || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error("CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set.");
  process.exit(1);
}

const rows = await db.workerDocument.findMany({
  select: { id: true, companyId: true, fileUrl: true, archivedAt: true },
  orderBy: { createdAt: "asc" },
});

const already = [];
const unreadable = [];
const foreign = [];
const byAsset = new Map(); // `${resourceType}|${publicId}` → { location, url, rowIds }
for (const r of rows) {
  const parsed = parseCloudinaryFileUrl(r.fileUrl, { cloudName });
  if (!parsed) {
    unreadable.push(r);
    continue;
  }
  if (parsed.deliveryType === HR_DELIVERY_TYPE) {
    already.push(r);
    continue;
  }
  const at = hrFileLocation(r.fileUrl, { cloudName, companyId: r.companyId });
  if (!at.ok) {
    foreign.push(r);
    continue;
  }
  const key = `${at.resourceType}|${at.publicId}`;
  const entry = byAsset.get(key) || { location: at, urls: new Set(), rowIds: [] };
  entry.urls.add(r.fileUrl);
  entry.rowIds.push(r.id);
  byAsset.set(key, entry);
}

// ── Is any candidate URL also stored outside WorkerDocument? ────────────────
// Every text column in the public schema, by exact value. JSON columns are not
// searched (a job's photo list is JSON) — a file shared that way would have
// been uploaded through another screen with another purpose, and HR uploads
// were never offered to those screens.
const sharedUrls = new Map(); // url → ["Table.column", …]
const candidateUrls = [...byAsset.values()].flatMap((e) => [...e.urls]);
if (candidateUrls.length > 0) {
  const columns = await db.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
      AND NOT (table_name = 'WorkerDocument' AND column_name = 'fileUrl')`;
  for (const { table_name: t, column_name: c } of columns) {
    const hits = await db.$queryRawUnsafe(
      `SELECT DISTINCT "${c.replace(/"/g, '""')}" AS v FROM "${t.replace(/"/g, '""')}" WHERE "${c.replace(/"/g, '""')}" = ANY($1::text[])`,
      candidateUrls,
    );
    for (const { v } of hits) sharedUrls.set(v, [...(sharedUrls.get(v) || []), `${t}.${c}`]);
  }
}

// ── Where each candidate is on Cloudinary right now ─────────────────────────
async function findAs(location, type) {
  try {
    const res = await cloudinary.api.resource(location.publicId, { resource_type: location.resourceType, type });
    return res?.public_id ? res : null;
  } catch (err) {
    const code = err?.error?.http_code ?? err?.http_code;
    if (Number(code) === 404) return null;
    throw err;
  }
}

const plan = { move: [], rowOnly: [], shared: [], missing: [], failed: [] };
for (const entry of byAsset.values()) {
  const urls = [...entry.urls];
  const sharedWith = urls.flatMap((u) => sharedUrls.get(u) || []);
  if (sharedWith.length) {
    plan.shared.push({ ...entry, sharedWith });
    continue;
  }
  try {
    if (await findAs(entry.location, "upload")) plan.move.push(entry);
    else if (await findAs(entry.location, HR_DELIVERY_TYPE)) plan.rowOnly.push(entry);
    else plan.missing.push(entry);
  } catch (err) {
    plan.failed.push({ ...entry, error: err?.error?.message || err?.message || String(err) });
  }
}

const label = (e) => `${e.location.resourceType} ${e.location.publicId} (rows: ${e.rowIds.join(", ")})`;
console.log(`WorkerDocument rows: ${rows.length}${apply ? "" : "  — DRY RUN, nothing is written (pass --apply after the open route is deployed)"}`);
console.log(`  already private:                         ${already.length}`);
console.log(`  public, to move (files / rows):          ${plan.move.length} / ${plan.move.reduce((n, e) => n + e.rowIds.length, 0)}`);
console.log(`  moved on Cloudinary, row still public:   ${plan.rowOnly.length}`);
console.log(`  public but ALSO stored elsewhere (skip): ${plan.shared.length}`);
console.log(`  not found on Cloudinary (skip):          ${plan.missing.length}`);
console.log(`  lookup failed (skip, re-run):            ${plan.failed.length}`);
console.log(`  URL outside its company's folder (skip): ${foreign.length}`);
console.log(`  URL not readable as ours (skip):         ${unreadable.length}`);
for (const e of plan.move) console.log(`  move      ${label(e)}`);
for (const e of plan.rowOnly) console.log(`  row only  ${label(e)}`);
for (const e of plan.shared) console.log(`  SHARED    ${label(e)} also in ${e.sharedWith.join(", ")}`);
for (const e of plan.missing) console.log(`  MISSING   ${label(e)}`);
for (const e of plan.failed) console.log(`  FAILED    ${label(e)} — ${e.error}`);
for (const r of foreign) console.log(`  FOREIGN   row ${r.id} (company ${r.companyId})`);
for (const r of unreadable) console.log(`  UNREADABLE row ${r.id} (company ${r.companyId})`);

if (!apply) process.exit(0);

async function pointRows(entry) {
  let n = 0;
  for (const url of entry.urls) {
    const next = authenticatedUrlFor(url, { cloudName });
    if (!next) continue;
    const res = await db.workerDocument.updateMany({ where: { id: { in: entry.rowIds }, fileUrl: url }, data: { fileUrl: next } });
    n += res.count;
  }
  return n;
}

let moved = 0;
let rowsUpdated = 0;
const errors = [];
for (const entry of plan.move) {
  try {
    await cloudinary.uploader.rename(entry.location.publicId, entry.location.publicId, {
      resource_type: entry.location.resourceType,
      type: "upload",
      to_type: HR_DELIVERY_TYPE,
      invalidate: true,
      overwrite: false,
    });
    moved++;
  } catch (err) {
    errors.push(`rename ${label(entry)}: ${err?.error?.message || err?.message || err}`);
    continue; // the row keeps its public URL, which still works — nothing half-done
  }
  try {
    rowsUpdated += await pointRows(entry);
  } catch (err) {
    errors.push(`row update ${label(entry)}: ${err?.message || err} — re-run to finish (found as "row only")`);
  }
}
for (const entry of plan.rowOnly) {
  try {
    rowsUpdated += await pointRows(entry);
  } catch (err) {
    errors.push(`row update ${label(entry)}: ${err?.message || err}`);
  }
}
console.log(`\napplied: ${moved} file(s) moved to private, ${rowsUpdated} row(s) repointed, ${errors.length} error(s)`);
for (const e of errors) console.log(`  ERROR ${e}`);
process.exit(errors.length ? 1 : 0);
