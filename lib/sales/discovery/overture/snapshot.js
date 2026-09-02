// lib/sales/discovery/overture/snapshot.js
//
// The file a discovery run actually reads, and why it is a file.
//
// ══ DuckDB CANNOT run inside a Vercel function. Stated plainly. ════════════
//
// The brief asked me to decide how DuckDB is invoked from a route or a cron,
// and to say so plainly if it cannot be. It cannot be, for four separate
// reasons, any one of which is fatal:
//
//  1. **Time.** The measured extraction — one bbox-filtered scan over the
//     release's 16 remote Parquet files — took about 60 seconds with 8 threads
//     on a laptop. No `maxDuration` is exported anywhere in this repo (see
//     docs/sales-intel/STATUS.md), so every function runs at whatever the
//     Vercel dashboard says, and the default is nowhere near 60s. A discovery
//     run that times out mid-scan produces nothing and looks like a provider
//     outage.
//  2. **Memory.** A multi-threaded Parquet scan over ~9.76 GiB of remote files
//     buffers row groups. That is sized for a workstation, not a function.
//  3. **The binary.** `@duckdb/node-api` is a native N-API addon of tens of
//     megabytes, and `httpfs` — which is what makes `s3://` work at all — is
//     an extension DuckDB downloads and verifies at RUN time into a writable
//     directory. On a lambda that is a network fetch on every cold start,
//     against a host that is not the one we are reading data from.
//  4. **It is the wrong shape anyway.** The same city is scanned once per
//     campaign, and the release only changes monthly. Re-scanning 9.76 GiB per
//     campaign to answer a question whose answer changes twelve times a year
//     is work nobody needs to do.
//
// ══ So: a periodic offline pull, then ingest from the file ═════════════════
//
// `scripts/overture-snapshot.mjs` runs DuckDB — the CLI, so nothing enters
// package.json — against the CURRENT release for one territory and trade, and
// writes an NDJSON snapshot. The operator puts that file anywhere the
// deployment can GET it, and the campaign's `providerConfig.snapshotUrl`
// points at it.
//
// The consequence, stated rather than hidden: **a campaign cannot discover
// anything until somebody has produced its snapshot.** The campaign screen
// says exactly that, the handler refuses with that sentence rather than
// reporting an empty result, and the funnel shows nothing found. A "Start"
// button that ran and found zero businesses would be the dead control
// AGENTS.md forbids.
//
// ══ The format, and why the manifest is line 1 ═════════════════════════════
//
// NDJSON. Line 1 is a manifest; every line after it is one place. A manifest
// at the TOP means the reader knows the release, the filter and the row count
// before it has read a single record — so a snapshot extracted from last
// month's release, or for the wrong city, is refused at the first line instead
// of quietly ingesting the wrong town.
//
// A single JSON array would have been simpler to validate and impossible to
// stream; a bare NDJSON with no manifest would have made the release
// unknowable, and the release is the provenance this whole feature turns on.
import { isReleaseName, placesPathFor } from "./release";

/** Bumped when the manifest's meaning changes, not when a field is added. */
export const SNAPSHOT_FORMAT = 1;

/**
 * Is this a manifest this build can read?
 *
 * Returns problems rather than throwing, because every one of them is
 * something a human has to fix by re-running the extractor and the screen has
 * to be able to say which.
 */
export function manifestProblems(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["The first line of the snapshot is not a manifest object."];
  }
  if (manifest.fieldquoSnapshot !== SNAPSHOT_FORMAT) {
    problems.push(
      `The snapshot says format ${JSON.stringify(manifest.fieldquoSnapshot)}; this build reads format ${SNAPSHOT_FORMAT}.`,
    );
  }
  if (manifest.provider !== "overture") {
    problems.push(`The snapshot was produced for provider ${JSON.stringify(manifest.provider)}, not overture.`);
  }
  if (!isReleaseName(manifest.release)) {
    problems.push(
      `The snapshot names release ${JSON.stringify(manifest.release)}, which is not a release name — provenance would be unusable.`,
    );
  }
  if (!Number.isInteger(manifest.count) || manifest.count < 0) {
    problems.push("The snapshot does not say how many rows it holds.");
  }
  return problems;
}

/**
 * Split an NDJSON body into a manifest and its rows.
 *
 * Pure, and takes the whole body as a string. A row that will not parse is
 * COUNTED and skipped, not silently dropped and not fatal: one malformed line
 * in twelve thousand should cost one business, and a snapshot that is entirely
 * malformed is then obvious from the count rather than from an exception with
 * no numbers in it.
 */
export function readSnapshot(body) {
  const lines = String(body ?? "").split("\n");
  let manifest = null;
  const rows = [];
  let unreadable = 0;
  let started = false;

  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!started) return { manifest: null, rows: [], unreadable: 1, problems: ["The snapshot's first line is not JSON."] };
      unreadable++;
      continue;
    }
    if (!started) {
      started = true;
      manifest = parsed;
      continue;
    }
    rows.push(parsed);
  }

  if (!started) return { manifest: null, rows: [], unreadable: 0, problems: ["The snapshot is empty."] };

  const problems = manifestProblems(manifest);
  // The count is a claim the file makes about itself; disagreement means a
  // truncated download, which is exactly the failure that would otherwise look
  // like "the city only has 300 painters".
  if (!problems.length && manifest.count !== rows.length + unreadable) {
    problems.push(
      `The snapshot says it holds ${manifest.count} rows and ${rows.length + unreadable} arrived — it was truncated in transit.`,
    );
  }

  return { manifest, rows, unreadable, problems };
}

/**
 * One Overture place row, in the shape every discovery provider must emit.
 *
 * The column names are the ones the extractor's SELECT produces, which are the
 * ones in docs/sales-intel/MEASURE-overture-coverage.md §1. Kept verbatim so
 * the SQL in the doc, the SQL in the script and the reader here cannot drift
 * apart without one of them visibly breaking.
 */
export function toDiscoveredBusiness(row = {}, release = null) {
  const addresses = Array.isArray(row.addresses) ? row.addresses : [];
  const first = addresses[0] || {};
  const sources = Array.isArray(row.sources) ? row.sources : [];

  // ── The freshness bug this loop exists not to have ──────────────────────
  //
  // Found by running the real extractor against the real release, not by
  // reading. EVERY Overture row carries a second `sources` entry that Overture
  // generates for itself:
  //
  //   { property: "/properties/confidence", dataset: "Overture",
  //     resource: "confidence_calculation", update_time: "2026-08-14T19:46:07Z" }
  //
  // Its update_time is the RELEASE BUILD DATE. Taking "the newest source"
  // across all entries therefore returns the build date for every row in the
  // dataset — so "Eco Painting Plus", whose actual record was last touched in
  // September 2015, would have shown as refreshed three weeks ago. The whole
  // point of carrying this field is a rep seeing that a record is eleven years
  // old, and the naive version reports the opposite with total confidence.
  //
  // So only RECORD-level contributions count. Overture marks a derived
  // property by naming it in `property`; an entry whose `property` is empty is
  // the source of the record itself. Among those, newest wins — a row carrying
  // both a 2015 Microsoft record and a 2026 Meta one is a 2026 record.
  const isRecordSource = (source) => {
    const property = typeof source?.property === "string" ? source.property.trim() : "";
    if (property) return false;
    // Belt: a contribution whose dataset is Overture itself is something
    // Overture computed, not something anybody observed about the business.
    return String(source?.dataset || "").toLowerCase() !== "overture";
  };

  let newest = null;
  for (const source of sources) {
    if (!isRecordSource(source)) continue;
    const at = source?.update_time ? new Date(source.update_time) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (!newest || at > newest.at) newest = { at, source };
  }
  const recordSources = sources.filter(isRecordSource);

  return {
    sourceRecordId: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : null,
    categories: {
      primary: typeof row.cat_primary === "string" ? row.cat_primary : null,
      alternate: Array.isArray(row.cat_alternate) ? row.cat_alternate : [],
    },
    taxonomyHierarchy: Array.isArray(row.tax_hierarchy) ? row.tax_hierarchy : [],
    phones: Array.isArray(row.phones) ? row.phones : [],
    websites: Array.isArray(row.websites) ? row.websites : [],
    emails: Array.isArray(row.emails) ? row.emails : [],
    address: {
      line: first.freeform ?? null,
      city: first.locality ?? null,
      province: first.region ?? null,
      postalCode: first.postcode ?? null,
      country: first.country ?? null,
    },
    latitude: Number.isFinite(Number(row.lat)) ? Number(row.lat) : null,
    longitude: Number.isFinite(Number(row.lon)) ? Number(row.lon) : null,
    // VERBATIM, including null. Overture's operating_status is only ever
    // "open" or NULL — there is no closed flag — so nothing may read a null
    // here as a statement that the business is trading.
    operatingStatus: typeof row.operating_status === "string" ? row.operating_status : null,
    sourceConfidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
    // Likewise the dataset: without the filter every row would report its
    // contributor as "Overture", which is true of the confidence figure and of
    // nothing else.
    sourceDataset: newest?.source?.dataset ?? recordSources[0]?.dataset ?? null,
    // Null when no record-level source carried a time. NOT now(): a record
    // whose age nobody knows must not be shown as fresh.
    sourceUpdatedAt: newest ? newest.at.toISOString() : null,
    sourceUrl: placesPathFor(release),
  };
}
