// lib/sales/discovery/snapshotCache.js
//
// The in-memory cache of parsed discovery snapshots, BOUNDED.
//
// ══ Why a bound, and why one cache for three providers ═════════════════════
//
// Overture, the RBQ register and the US licence boards each read a snapshot
// file whole — the provider's own header explains why DuckDB cannot run on
// Vercel — and each kept the parsed rows in a module-level Map keyed by URL so
// a warm function does not re-download 60 MB for the next 100-row page. Three
// copies of the same twelve lines, and all three had no eviction.
//
// That was fine with one campaign. With eighty (918k Overture rows in 70 files,
// 402k licences in 10 more), the queue hands a warm function one page of one
// campaign, then one of another: oldest task first, across every campaign.
// Over a day the same instance touches every URL, keeps every parse, and the
// largest part alone is 63 MB of text and 50,000 objects. The end of that is
// an out-of-memory kill mid-drain — leased tasks reclaimed, nothing corrupt,
// and an error that reads exactly like "the snapshot host is down".
//
// So: one cache, bounded by ROWS rather than by entry count, because a part
// is 4,000 rows or 50,000 and the bound is about memory, not about how many
// files happen to be open. Least-recently-used goes first. The budget is a
// few of the largest parts — enough that a campaign's next page usually
// finds its snapshot still warm, small enough that the worst case fits a
// function with room to spare. A miss costs a re-download (bandwidth, which
// R2 does not charge for) and a parse; it never costs correctness.
//
// Pure. scripts/check-snapshot-cache.mjs executes it.

export const DEFAULT_MAX_ROWS = 120_000;

/**
 * @param {object} [opts]
 * @param {number} [opts.maxRows]  total rows held across every entry
 */
export function boundedSnapshotCache({ maxRows = DEFAULT_MAX_ROWS } = {}) {
  const budget = Number.isFinite(maxRows) && maxRows > 0 ? maxRows : DEFAULT_MAX_ROWS;
  // Map preserves insertion order; re-inserting on read makes it an LRU.
  const entries = new Map();
  let held = 0;

  function get(key) {
    if (!entries.has(key)) return undefined;
    const e = entries.get(key);
    entries.delete(key);
    entries.set(key, e);
    return e.value;
  }

  function set(key, value, rows) {
    const size = Number.isFinite(rows) && rows >= 0 ? rows : Array.isArray(value?.rows) ? value.rows.length : 0;
    if (entries.has(key)) {
      held -= entries.get(key).rows;
      entries.delete(key);
    }
    // A single snapshot larger than the whole budget is still cached — alone.
    // Refusing it would re-download the biggest file on every page, which is
    // the one case the cache exists for.
    while (held + size > budget && entries.size > 0) {
      const oldest = entries.keys().next().value;
      held -= entries.get(oldest).rows;
      entries.delete(oldest);
    }
    entries.set(key, { value, rows: size });
    held += size;
    return value;
  }

  function clear() {
    entries.clear();
    held = 0;
  }

  return {
    get,
    set,
    clear,
    has: (key) => entries.has(key),
    get size() { return entries.size; },
    get rows() { return held; },
    get maxRows() { return budget; },
  };
}
