// lib/sales/discovery/overture/provider.js
//
// Overture Places, as a BusinessDiscoveryProvider.
//
// ══ Why Overture and not Google ════════════════════════════════════════════
//
// Settled by the compliance audit and recorded in docs/sales-intel/STATUS.md,
// summarised here because this is the file that would otherwise be the natural
// place to "just add Google":
//
//   - The Maps Platform ToS §3.2.3(a)(iii) names copying and saving business
//     names and addresses as prohibited scraping. That is the Prospect table.
//   - §3.2.3(d)(iii) bars use in a listings or directory service. That is this
//     product.
//   - §5.2(d) permits immediate key suspension — the SAME key that powers
//     address autocomplete, the mini-maps and the Solar roof measurement in the
//     live contractor product.
//   - And it could not do the job anyway: Nearby Search caps at 20 results with
//     no pagination token at all.
//
// Overture's places theme is CDLA-Permissive-2.0 / Apache-2.0 / CC0, contains
// no OSM data, and is free and anonymous.
//
// ══ Where the rows come from ═══════════════════════════════════════════════
//
// A snapshot file. snapshot.js's header sets out at length why DuckDB cannot
// run inside a Vercel function and what runs instead.
//
// ══ What this provider will NOT do ═════════════════════════════════════════
//
// It will not report a release it did not read. `fetchPage` returns the
// release named in the snapshot's own manifest, and the campaign screen
// compares that against the bucket's current release so a superadmin can see
// "this snapshot is a release behind" — rather than the pipeline stamping
// today's release onto rows extracted in July.
import { registerDiscoveryProvider } from "../provider";
import { readSnapshot, toDiscoveredBusiness } from "./snapshot";
import { fetchCurrentRelease } from "./release";

export const OVERTURE_PROVIDER_KEY = "overture";

/** How many businesses one pipeline task ingests. */
export const PAGE_SIZE = 100;

/**
 * A snapshot, held for the life of the lambda instance.
 *
 * Per-instance, and honestly so — the same caveat lib/sales/pipeline/limits.js
 * makes about its budget. Two overlapping invocations each download the file
 * once. That is acceptable here because the file is static and a re-download
 * costs bandwidth rather than correctness; it would NOT be acceptable for
 * anything that counted.
 */
const cache = new Map();

/** Test seam: forget the cached snapshots. */
export function __clearSnapshotCache() {
  cache.clear();
}

async function loadSnapshot(url, { fetchImpl = fetch } = {}) {
  if (cache.has(url)) return cache.get(url);

  let response;
  try {
    response = await fetchImpl(url, { redirect: "follow" });
  } catch (err) {
    return { error: `could not fetch the snapshot: ${err?.message || err}` };
  }
  if (!response?.ok) {
    return { error: `the snapshot URL answered ${response?.status ?? "no status"}` };
  }

  let body;
  try {
    body = await response.text();
  } catch (err) {
    return { error: `could not read the snapshot: ${err?.message || err}` };
  }

  const parsed = readSnapshot(body);
  if (parsed.problems.length) return { error: parsed.problems.join(" ") };

  const loaded = { manifest: parsed.manifest, rows: parsed.rows, unreadable: parsed.unreadable };
  cache.set(url, loaded);
  return loaded;
}

/**
 * Does this row belong to the territory the campaign named?
 *
 * Pure and exported so the check can drive it. Every filter is OPTIONAL and
 * every one that is absent matches everything — a territory with no city is a
 * province-wide territory, not a territory that matches nothing.
 *
 * The radius is applied with `haversineKm` from lib/booking/travel.js rather
 * than a second distance function. It is pure, needs no API key, and is
 * already the distance this codebase means when it says "km away".
 */
export function inTerritory(business, territory, { haversineKm } = {}) {
  if (!territory) return true;

  const address = business?.address || {};
  const text = (value) => String(value ?? "").trim().toLowerCase();

  if (territory.country && text(address.country) !== text(territory.country)) return false;
  if (territory.province && text(address.province) !== text(territory.province)) return false;
  if (territory.city && text(address.city) !== text(territory.city)) return false;

  // `Number(null)` is 0, and 0 is finite — so a plain Number().isFinite check
  // reads a MISSING coordinate as a point on the equator. That is not a
  // theoretical nicety: it made a coordinate-less row survive the guard below
  // and get its distance measured from (0, 0). Found by mutation testing.
  const num = (value) =>
    value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

  const centerLat = num(territory.centerLat);
  const centerLng = num(territory.centerLng);
  const radiusKm = num(territory.radiusKm);
  const hasRadius = centerLat !== null && centerLng !== null && radiusKm !== null && radiusKm > 0;
  if (!hasRadius) return true;

  // A radius territory and a row with no coordinates: the row is EXCLUDED, and
  // that is the conservative direction. Including it would put a business of
  // unknown location into a queue whose whole promise is "these are near you",
  // and a rep would find out by driving.
  const lat = num(business?.latitude);
  const lng = num(business?.longitude);
  if (lat === null || lng === null) return false;
  if (typeof haversineKm !== "function") return true;
  const km = haversineKm({ lat: centerLat, lng: centerLng }, { lat, lng });
  return km !== null && km <= radiusKm;
}

/** The cursor is an offset into the snapshot. Parsed defensively. */
export function parseCursor(cursor) {
  const n = Number.parseInt(String(cursor ?? "0"), 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export const overtureProvider = {
  key: OVERTURE_PROVIDER_KEY,
  label: "Overture Places",
  description:
    "Free, open business listings under CDLA-Permissive-2.0. Read from a snapshot extracted offline from the current Overture release — see docs/sales-intel/MEASURE-overture-coverage.md.",
  // Stated as data, not as prose in this header, because the campaign form
  // renders it against the checkbox: ticking two sources takes on two sets of
  // terms, and the obligations are not the same. CDLA-Permissive-2.0 permits
  // commercial use and imposes no attribution on what is BUILT from the data —
  // what it does require is that the licence notice travels with the data
  // whenever the data itself is passed on. That distinction is the whole
  // difference between this source and the RBQ's CC-BY, so it is spelled out
  // rather than summarised as "open licence".
  licence: {
    name: "CDLA-Permissive-2.0",
    url: "https://cdla.dev/permissive-2-0/",
    obligation:
      "No attribution is required in anything built from this data. The obligation is on the DATA: " +
      "if the rows are passed on to anyone outside FieldQuo, the licence notice and disclaimer go with " +
      "them. Prospect rows discovered here are FieldQuo's own back office and are never shown to a " +
      "homeowner, so nothing client-facing is affected.",
  },
  configFields: [
    {
      name: "snapshotUrl",
      label: "Snapshot URL",
      required: true,
      help:
        "Where this campaign's extracted rows live. Produce one with " +
        "`node scripts/overture-snapshot.mjs`, then host it anywhere this deployment can GET. " +
        "DuckDB cannot run inside a Vercel function, so there is no way to skip this step.",
    },
  ],

  describeConfig(config = {}) {
    const url = typeof config?.snapshotUrl === "string" ? config.snapshotUrl.trim() : "";
    if (!url) {
      return {
        ok: false,
        problems: ["This campaign has no snapshot URL, so there is nothing to read."],
        summary: "No snapshot",
      };
    }
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, problems: [`"${url}" is not a URL.`], summary: "No snapshot" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return {
        ok: false,
        // s3:// is the obvious paste and it is worth naming, because the
        // extractor's own output prints an s3 path and somebody will copy it.
        problems: [
          `The snapshot is fetched over HTTP, so ${parsed.protocol} will not work — upload the file somewhere it can be downloaded from.`,
        ],
        summary: "No snapshot",
      };
    }
    return { ok: true, problems: [], summary: parsed.host + parsed.pathname };
  },

  async currentRelease(deps = {}) {
    const result = await fetchCurrentRelease(deps);
    return { release: result.release, error: result.error || null, checkedAt: new Date() };
  },

  /**
   * One page of businesses.
   *
   * @param {{ territory: object|null, tradeKey: string|null, cursor: string|null,
   *           limit: number, config: object, deps: object }} args
   * @returns {{ release: string|null, businesses: object[], nextCursor: string|null,
   *             error: string|null, scanned: number }}
   */
  async fetchPage({ territory = null, cursor = null, limit = PAGE_SIZE, config = {}, deps = {} } = {}) {
    const described = this.describeConfig(config);
    if (!described.ok) {
      return { release: null, businesses: [], nextCursor: null, error: described.problems.join(" "), scanned: 0 };
    }

    const loaded = await loadSnapshot(config.snapshotUrl.trim(), deps);
    if (loaded.error) return { release: null, businesses: [], nextCursor: null, error: loaded.error, scanned: 0 };

    const release = loaded.manifest.release;
    const offset = parseCursor(cursor);
    const take = Math.max(1, Math.min(Number(limit) || PAGE_SIZE, PAGE_SIZE));

    // Scan forward from the cursor until the page is full or the file ends.
    // The territory filter runs HERE rather than at ingest so a page is a page
    // of usable businesses — filtering afterwards would make "250 per task"
    // mean "somewhere between 0 and 250", and a campaign for one small city
    // would spend a hundred tasks producing nothing.
    const businesses = [];
    let index = offset;
    for (; index < loaded.rows.length && businesses.length < take; index++) {
      const business = toDiscoveredBusiness(loaded.rows[index], release);
      if (!inTerritory(business, territory, deps)) continue;
      businesses.push(business);
    }

    return {
      release,
      businesses,
      nextCursor: index < loaded.rows.length ? String(index) : null,
      error: null,
      scanned: index - offset,
      total: loaded.rows.length,
    };
  },
};

registerDiscoveryProvider(overtureProvider);
