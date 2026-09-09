// lib/sales/discovery/snapshotSetting.js
//
// The stored base URL of the snapshot bucket, read the same way everywhere.
//
// Three surfaces need it — the setting screen, the campaign form and the start
// route — and each of them has to distinguish "never configured" from
// "configured". A route that read the row itself would be free to treat a
// missing row as an empty string, and an empty base builds
// `/overture/x.ndjson` as a relative URL that resolves against whatever host is
// asking. Hence one loader, one shape, and `configured` stated rather than
// inferred by each caller.
import { SNAPSHOT_FILES, SNAPSHOT_LIBRARY_MEASURED_AT, snapshotCountries } from "./snapshotLibrary";

export const SNAPSHOT_LIBRARY_SINGLETON = "singleton";

/**
 * The library row a base URL is proved against: the SMALLEST file there is.
 *
 * The probe is a ranged read either way, but an origin is free to ignore a
 * Range header — and if one does, this is the difference between downloading
 * 34 KB and downloading 63 MB to look at one line.
 */
export function probeTarget(files = SNAPSHOT_FILES) {
  return [...files].sort((a, b) => a.rows - b.rows || a.objectKey.localeCompare(b.objectKey))[0] || null;
}

/**
 * The setting, in one shape whether or not it has ever been saved.
 *
 * @param {object} db  the Prisma client, injected so the check can drive this
 *                     with a stub rather than a database.
 */
export async function loadSnapshotLibrarySetting(db) {
  const row = await db.platformSnapshotLibrary.findUnique({ where: { id: SNAPSHOT_LIBRARY_SINGLETON } });
  return {
    baseUrl: row?.baseUrl || null,
    verifiedObjectKey: row?.verifiedObjectKey || null,
    verifiedRows: row?.verifiedRows ?? null,
    verifiedAt: row?.verifiedAt ? new Date(row.verifiedAt).toISOString() : null,
    configured: Boolean(row?.baseUrl),
  };
}

/** What the bucket holds, for a screen. Measured, never estimated. */
export function librarySummary(files = SNAPSHOT_FILES) {
  const byProvider = new Map();
  for (const file of files) {
    const entry = byProvider.get(file.provider) || { provider: file.provider, files: 0, rows: 0, regions: new Set() };
    entry.files += 1;
    entry.rows += file.rows;
    entry.regions.add(`${file.country}-${file.province}`);
    byProvider.set(file.provider, entry);
  }
  return {
    measuredAt: SNAPSHOT_LIBRARY_MEASURED_AT,
    files: files.length,
    rows: files.reduce((sum, f) => sum + f.rows, 0),
    countries: snapshotCountries(),
    providers: [...byProvider.values()]
      .map((e) => ({ provider: e.provider, files: e.files, rows: e.rows, regions: e.regions.size }))
      .sort((a, b) => b.rows - a.rows),
  };
}
