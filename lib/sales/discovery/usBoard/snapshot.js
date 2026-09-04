// lib/sales/discovery/usBoard/snapshot.js
//
// The file a discovery run reads, and why the published board file is not it.
//
// ══ Size, and one thing size is not ════════════════════════════════════════
//
// rbq/snapshot.js refuses the 341 MB Quebec extract inside a function because
// streaming and grouping it takes tens of seconds against a `maxDuration` this
// repo never sets. The US files are smaller — Washington is 35 MB and Oregon
// 15 MB — so the size argument alone would be weaker here.
//
// The SHAPE argument is not weaker, and it is the one that decides:
//
//   1. Both files are the whole state. Washington's 160,923 rows include
//      85,006 licences that are expired, superseded, out of business or held
//      by somebody who has died. Filtering to the 75,917 live ones is a full
//      scan, and re-running it once per campaign page answers a question that
//      changes three times a day.
//   2. Oregon's rows are one per licence-and-endorsement, so grouping is not
//      optional and a page of a hundred rows cannot group anything — it does
//      not know whether licence 259644's second endorsement is on the next
//      page or the last one.
//   3. The unknown-class report is a claim about the WHOLE file. A serverless
//      page cannot tell "this specialty code is new" from "this specialty code
//      is rare".
//
// So `scripts/us-board-snapshot.mjs` downloads, filters, groups and writes an
// NDJSON snapshot the operator hosts anywhere this deployment can GET. The
// consequence is stated rather than hidden: a campaign cannot discover
// anything until somebody has produced its snapshot, and `describeConfig` says
// exactly that rather than reporting an empty result.
//
// ══ Same format as Overture's and the RBQ's, deliberately ══════════════════
//
// Manifest on line 1, one record per line after it. An operator who has
// produced one snapshot should not have to learn a third file format, and a
// reader that refuses at line 1 refuses before it has ingested the wrong state.
//
// ══ The manifest names the BOARD, and that is a safety property ════════════
//
// Every US board snapshot is the same shape, which is exactly what makes them
// swappable by accident: point a Washington campaign at an Oregon file and
// every field parses. `sources.js`'s header records the same collision for
// `snapshotUrl` and solved it by keying config per provider; this is the other
// half — the FILE says which board it is for, and a reader that finds the
// wrong one refuses rather than ingesting 45,483 Oregon contractors into a
// campaign whose licence notice, calling window and class vocabulary are all
// Washington's.
import { isBoardRelease } from "./socrata";
import { usBoard } from "./boards";
import { toDiscoveredBusiness } from "./record";

/** Bumped when the manifest's meaning changes, not when a field is added. */
export const US_BOARD_SNAPSHOT_FORMAT = 1;

/**
 * Is this a manifest this build can read, FOR THIS BOARD?
 *
 * `expectedBoard` is passed in rather than read off the manifest, because the
 * question the caller has is "is this the file my campaign asked for", and a
 * manifest that answers it about itself answers nothing.
 *
 * Problems rather than an exception: every one is something a human has to fix
 * by re-running the extractor, and the campaign screen has to say which.
 */
export function manifestProblems(manifest, expectedBoardKey = null) {
  const problems = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["The first line of the snapshot is not a manifest object."];
  }
  if (manifest.fieldquoSnapshot !== US_BOARD_SNAPSHOT_FORMAT) {
    problems.push(
      `The snapshot says format ${JSON.stringify(manifest.fieldquoSnapshot)}; this build reads format ${US_BOARD_SNAPSHOT_FORMAT}.`,
    );
  }
  const board = usBoard(manifest.provider);
  if (!board) {
    problems.push(
      `The snapshot was produced for provider ${JSON.stringify(manifest.provider)}, which this build does not ship.`,
    );
  } else if (expectedBoardKey && manifest.provider !== expectedBoardKey) {
    // The wrong-state ingest, refused. See the file header.
    problems.push(
      `This campaign draws from ${expectedBoardKey}, and the snapshot holds ${manifest.provider} — ` +
        "ingesting it would file another state's contractors under this source's licence and calling rules.",
    );
  }
  if (!isBoardRelease(manifest.release)) {
    problems.push(
      `The snapshot names release ${JSON.stringify(manifest.release)}, which is not a release date — provenance would be unusable.`,
    );
  }
  if (!Number.isInteger(manifest.count) || manifest.count < 0) {
    problems.push("The snapshot does not say how many licences it holds.");
  }
  // The board's own source statement, carried into the file.
  //
  // Neither shipped board's licence REQUIRES attribution — both are public
  // domain — so this is not the CC-BY refusal rbq/snapshot.js makes. It is
  // refused for a different reason: a snapshot with no statement of where it
  // came from is a file of 75,917 phone numbers with no provenance, and
  // `Prospect.sourceRelease` plus a bare provider key cannot reconstruct it.
  // The RBQ discipline is kept where the licence does not compel it, because
  // the value it protects — a rep being able to say who published this — is
  // the same either way.
  if (board && manifest.attribution !== board.licence.attribution) {
    problems.push("The snapshot carries no source statement, so a prospect from it would have no provenance.");
  }
  return problems;
}

/**
 * Split an NDJSON body into a manifest and its licences.
 *
 * A record that will not parse is COUNTED and skipped: one malformed line in
 * seventy thousand should cost one business, and a wholly malformed snapshot
 * is then obvious from the count rather than from an exception with no numbers
 * in it. Same decision, and same reason, as rbq/snapshot.js.
 */
export function readSnapshot(body, expectedBoardKey = null) {
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

  const problems = manifestProblems(manifest, expectedBoardKey);
  // The count is a claim the file makes about itself. Disagreement means a
  // truncated download — the failure that would otherwise look like
  // "Washington only has nine thousand contractors".
  if (!problems.length && manifest.count !== rows.length + unreadable) {
    problems.push(
      `The snapshot says it holds ${manifest.count} licences and ${rows.length + unreadable} arrived — it was truncated in transit.`,
    );
  }

  return { manifest, rows, unreadable, problems };
}

/** One snapshot record, in the shape every provider must emit. */
export function businessFromSnapshotRow(row, manifest) {
  return toDiscoveredBusiness(row, usBoard(manifest?.provider), {
    release: manifest?.release ?? null,
    sourceUrl: manifest?.sourceUrl ?? null,
  });
}
