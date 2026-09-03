// lib/sales/discovery/rbq/snapshot.js
//
// The file a discovery run reads, and why the 341 MB original is not it.
//
// ══ The register cannot be read inside a function, and the reason is size ══
//
// overture/snapshot.js's header sets out four reasons DuckDB cannot run on
// Vercel. Only one of them applies here, and it applies harder:
//
//   The published extract is a 10.8 MB zip that inflates to 341 MB of CSV
//   holding 927,337 rows. Streaming and grouping it takes tens of seconds and
//   holds 54,264 partially-built objects in memory. No `maxDuration` is
//   exported anywhere in this repo, so every function runs at whatever the
//   Vercel dashboard says — and a discovery run that dies mid-scan produces
//   nothing while looking exactly like a provider outage.
//
// And it is the wrong shape anyway. The whole province is re-scanned once per
// campaign to answer a question that changes once a day.
//
// So `scripts/rbq-snapshot.mjs` streams the real file offline, groups it, and
// writes an NDJSON snapshot the operator hosts anywhere this deployment can
// GET. The consequence is stated rather than hidden: a campaign cannot
// discover anything until somebody has produced its snapshot, and
// `describeConfig` says exactly that rather than reporting an empty result.
//
// ══ Same format as Overture's, deliberately ════════════════════════════════
//
// Manifest on line 1, one record per line after it. Not because the two
// sources are alike — they are not — but because an operator who has produced
// one snapshot should not have to learn a second file format, and a reader
// that refuses at line 1 refuses before it has ingested the wrong province.
//
// The manifest carries the ATTRIBUTION as well as the release. CC-BY travels
// with the data, and a snapshot file sitting in a bucket with no notice in it
// is a copy of the dataset with the licence stripped off.
import { isRbqRelease, RBQ_ATTRIBUTION } from "./register";
import { toDiscoveredBusiness } from "./licence";

/** Bumped when the manifest's meaning changes, not when a field is added. */
export const RBQ_SNAPSHOT_FORMAT = 1;

export const RBQ_PROVIDER_KEY = "rbq";

/**
 * Is this a manifest this build can read?
 *
 * Problems rather than an exception, for the reason overture/snapshot.js
 * gives: every one is something a human has to fix by re-running the
 * extractor, and the campaign screen has to be able to say which.
 */
export function manifestProblems(manifest) {
  const problems = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["The first line of the snapshot is not a manifest object."];
  }
  if (manifest.fieldquoSnapshot !== RBQ_SNAPSHOT_FORMAT) {
    problems.push(
      `The snapshot says format ${JSON.stringify(manifest.fieldquoSnapshot)}; this build reads format ${RBQ_SNAPSHOT_FORMAT}.`,
    );
  }
  if (manifest.provider !== RBQ_PROVIDER_KEY) {
    problems.push(
      `The snapshot was produced for provider ${JSON.stringify(manifest.provider)}, not ${RBQ_PROVIDER_KEY}.`,
    );
  }
  if (!isRbqRelease(manifest.release)) {
    problems.push(
      `The snapshot names release ${JSON.stringify(manifest.release)}, which is not a release date — provenance would be unusable.`,
    );
  }
  if (!Number.isInteger(manifest.count) || manifest.count < 0) {
    problems.push("The snapshot does not say how many licences it holds.");
  }
  // A snapshot with the notice stripped out is a redistribution of a CC-BY
  // dataset with the attribution removed, which is the one thing the licence
  // does not permit. Refused rather than repaired: silently re-adding the
  // notice would make a file that had lost it look like one that never did.
  if (manifest.attribution !== RBQ_ATTRIBUTION) {
    problems.push("The snapshot carries no CC-BY attribution notice, so it must not be ingested.");
  }
  return problems;
}

/**
 * Split an NDJSON body into a manifest and its licences.
 *
 * A record that will not parse is COUNTED and skipped: one malformed line in
 * fifty thousand should cost one business, and a wholly malformed snapshot is
 * then obvious from the count rather than from an exception with no numbers in
 * it.
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
      if (!started) {
        return { manifest: null, rows: [], unreadable: 1, problems: ["The snapshot's first line is not JSON."] };
      }
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
  // The count is a claim the file makes about itself. Disagreement means a
  // truncated download — the failure that would otherwise look like "Quebec
  // only has nine thousand contractors".
  if (!problems.length && manifest.count !== rows.length + unreadable) {
    problems.push(
      `The snapshot says it holds ${manifest.count} licences and ${rows.length + unreadable} arrived — it was truncated in transit.`,
    );
  }

  return { manifest, rows, unreadable, problems };
}

/** One snapshot record, in the shape every provider must emit. */
export function businessFromSnapshotRow(row, manifest) {
  return toDiscoveredBusiness(row, {
    release: manifest?.release ?? null,
    sourceUrl: manifest?.sourceUrl ?? null,
  });
}
