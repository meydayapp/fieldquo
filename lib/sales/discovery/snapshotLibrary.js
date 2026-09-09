// lib/sales/discovery/snapshotLibrary.js
//
// What is in the snapshot bucket, and how a campaign's snapshot URL is built.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// The campaign form used to ask for a "Snapshot URL (required)" per source and
// tell the owner to run a DuckDB extractor and host the output. The extract had
// already been run and uploaded — 80 files, 1,320,105 rows, in R2 — so the form
// was asking him to redo, by hand, a thing that was already done, and to hold
// eighty object keys in his head while doing it.
//
// The base URL of that bucket is now configured ONCE
// (PlatformSnapshotLibrary, /platform/sales/snapshots) and every campaign's URL
// is DERIVED here from base + object key. There is no second way to get one: no
// text input on any form, and no route that accepts a typed URL for a source in
// the library. That is the property scripts/check-snapshot-campaigns.mjs pins,
// because a typed URL is how a campaign ends up pointed at a file that is not
// there and produces an empty queue instead of an error.
//
// ══ Why the counts are data and not a bucket listing ═══════════════════════
//
// The owner's ask was "I pick trade painting, then it's all the companies that
// do painting" — with a number, before he commits. An object listing cannot
// answer that: it carries a key and a byte count, never a trade. So the counts
// are measured off the files by scripts/build-snapshot-library.mjs and checked
// in as snapshotLibraryData.js. Nothing here estimates, scales or extrapolates
// a count.
//
// ══ "Not known" is not zero ════════════════════════════════════════════════
//
// The RBQ register names no trade for anybody (rbq/licence.js: `primary: null`,
// and its authorisation codes map to no FieldQuo trade). Its 54,275 Quebec rows
// therefore have a trade tally of nothing at all, and reporting "0 painters in
// Quebec" off the back of that would be a lie about the biggest Canadian
// register. Every count this file returns is paired with the rows it could NOT
// speak for, and the screens print that as "not known".
//
// Pure and dependency-free apart from the generated data, so the check can run
// every function in it against hostile input without a database.
import { SNAPSHOT_FILES, SNAPSHOT_REGION_CENTRES, SNAPSHOT_LIBRARY_MEASURED_AT } from "./snapshotLibraryData";

export { SNAPSHOT_FILES, SNAPSHOT_REGION_CENTRES, SNAPSHOT_LIBRARY_MEASURED_AT };

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** "US" + "CA" → "US-CA". The one place the region code is spelled. */
export function regionCode(country, province) {
  const c = trimmed(country).toUpperCase();
  const p = trimmed(province).toUpperCase();
  return c && p ? `${c}-${p}` : "";
}

/**
 * The bucket's public base URL, normalised, or an error sentence.
 *
 * ══ Why the trailing slash is stripped and a path is allowed ══════════════
 *
 * The owner pastes what R2 shows him. That is `https://pub-<hash>.r2.dev`,
 * sometimes with a trailing slash, occasionally with a folder path if the
 * bucket is served behind a custom domain. Joining "base + '/' + key" without
 * normalising produces `…r2.dev//overture/x.ndjson`, which some origins serve
 * and some 404 — a difference nobody would find until a campaign discovered
 * nothing.
 *
 * A query string or a fragment is REFUSED rather than dropped. A signed URL
 * pasted here would be a credential in a config table with an expiry nobody
 * tracked, and silently stripping the signature would produce a base that
 * cannot fetch anything while looking exactly like one that can.
 */
export function normaliseSnapshotBase(value) {
  const raw = trimmed(value);
  if (!raw) return { baseUrl: null, error: "Paste the bucket's public base URL." };
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { baseUrl: null, error: `“${raw}” is not a URL.` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    // s3:// is the obvious paste — it is what every upload tool prints — and
    // the snapshot is fetched over HTTP, so it is worth naming.
    return {
      baseUrl: null,
      error: `Snapshots are fetched over HTTP, so ${parsed.protocol} will not work. Use the bucket's public https:// URL.`,
    };
  }
  if (parsed.search || parsed.hash) {
    return {
      baseUrl: null,
      error:
        "Paste the plain public URL, without a query string. A signed link expires, and a base URL that " +
        "expires turns every campaign behind it into a campaign that finds nothing.",
    };
  }
  const path = parsed.pathname.replace(/\/+$/, "");
  return { baseUrl: `${parsed.origin}${path}`, error: null };
}

/**
 * The URL of one object under a configured base, or null.
 *
 * Null when there is no base or no key — never a half-built string. A campaign
 * saved with `undefined/overture/x.ndjson` would fail at fetch time with a
 * message about a host, days after the mistake was made.
 */
export function snapshotUrlFor(baseUrl, objectKey) {
  const { baseUrl: base } = normaliseSnapshotBase(baseUrl);
  const key = trimmed(objectKey).replace(/^\/+/, "");
  if (!base || !key) return null;
  return `${base}/${key}`;
}

/** One file in the library, by its object key, or null. */
export function snapshotFileFor(objectKey) {
  const key = trimmed(objectKey);
  return SNAPSHOT_FILES.find((f) => f.objectKey === key) || null;
}

/**
 * The library row a stored URL points at, or null.
 *
 * Matched on the object key being the END of the URL's path, not on the whole
 * URL: campaigns created before the base URL was a setting carry a full URL
 * that was built by hand from the same bucket, and this is what lets one of
 * those be re-derived from the current base instead of being stranded with a
 * typed URL nobody can fix.
 */
export function snapshotFileForUrl(url) {
  const raw = trimmed(url);
  if (!raw) return null;
  let path;
  try {
    path = new URL(raw).pathname;
  } catch {
    return null;
  }
  return SNAPSHOT_FILES.find((f) => path.endsWith(`/${f.objectKey}`) || path === `/${f.objectKey}`) || null;
}

/** Every provider that has a file in the bucket, in a stable order. */
export function snapshotProviderKeys() {
  return [...new Set(SNAPSHOT_FILES.map((f) => f.provider))].sort();
}

/**
 * The countries the data actually covers.
 *
 * Derived, never listed by hand. The owner's question — "is country code USA or
 * US, I don't know but I can select it because you would already know" — is
 * answered by the files themselves, and a hand-typed list would drift the first
 * time a third country is extracted.
 */
export function snapshotCountries() {
  const seen = new Map();
  for (const file of SNAPSHOT_FILES) {
    const entry = seen.get(file.country) || { code: file.country, rows: 0, files: 0, regions: new Set() };
    entry.rows += file.rows;
    entry.files += 1;
    entry.regions.add(file.province);
    seen.set(file.country, entry);
  }
  return [...seen.values()]
    .map((e) => ({ code: e.code, rows: e.rows, files: e.files, regions: e.regions.size }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Every region in the library, optionally narrowed to a country and to a set of
 * sources.
 *
 * A region with no file for the chosen sources is ABSENT rather than present
 * with a zero. A select offering "Alberta — 0" for a campaign that ticked the
 * California board is a control that appears to work.
 */
export function snapshotRegions({ country = null, providers = null } = {}) {
  const wantCountry = trimmed(country).toUpperCase();
  const wantProviders = Array.isArray(providers) && providers.length ? new Set(providers) : null;
  const seen = new Map();
  for (const file of SNAPSHOT_FILES) {
    if (wantCountry && file.country !== wantCountry) continue;
    if (wantProviders && !wantProviders.has(file.provider)) continue;
    const code = regionCode(file.country, file.province);
    const entry = seen.get(code) || {
      code,
      country: file.country,
      province: file.province,
      rows: 0,
      files: 0,
      providers: [],
      centre: SNAPSHOT_REGION_CENTRES[code] || null,
    };
    entry.rows += file.rows;
    entry.files += 1;
    if (!entry.providers.includes(file.provider)) entry.providers.push(file.provider);
    seen.set(code, entry);
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * The files a selection covers, and what is in them.
 *
 * This is the one function the form's number comes from and the one the create
 * route builds its URLs from, so the "3,188 painters" a superadmin reads and
 * the files that get ingested cannot disagree.
 *
 * @param {{providers?: string[], country?: string, province?: string,
 *          tradeKey?: string|null}} selection
 * @returns {{
 *   files: Array<object>, rows: number, fileCount: number,
 *   tradeRows: number|null,        rows whose category maps to `tradeKey`
 *   tradeUnknownRows: number,      rows in files that name no trade at all
 *   unmappedRows: number,          rows whose category maps to no FieldQuo trade
 *   providers: string[], releases: string[], problems: string[]
 * }}
 */
export function snapshotSelection({ providers = [], country = null, province = null, tradeKey = null } = {}) {
  const keys = Array.isArray(providers) ? providers.map(trimmed).filter(Boolean) : [];
  const wantCountry = trimmed(country).toUpperCase();
  const wantProvince = trimmed(province).toUpperCase();
  const trade = trimmed(tradeKey);

  const problems = [];
  if (!keys.length) problems.push("No source is ticked, so there are no files to read.");
  if (!wantCountry) problems.push("No country is chosen.");
  if (!wantProvince) problems.push("No region is chosen.");

  const files = SNAPSHOT_FILES.filter(
    (f) => keys.includes(f.provider) && f.country === wantCountry && f.province === wantProvince,
  );

  if (!problems.length && !files.length) {
    problems.push(
      `The bucket holds no snapshot for ${regionCode(wantCountry, wantProvince)} from ` +
        `${keys.join(", ")}. Pick a different region, or a source that covers this one.`,
    );
  }

  let rows = 0;
  let tradeRows = 0;
  let tradeUnknownRows = 0;
  let unmappedRows = 0;
  for (const file of files) {
    rows += file.rows;
    if (file.tradesKnown) {
      tradeRows += Number(file.trades?.[trade] || 0);
      unmappedRows += file.unmappedRows;
    } else {
      // The file names no trade for anybody. Its rows are not zero painters —
      // they are rows nothing has read a trade from, and they are reported
      // separately so no screen can add them into a count as if they were.
      tradeUnknownRows += file.rows;
    }
  }

  return {
    files,
    fileCount: files.length,
    rows,
    // Null, not 0, when no trade was asked about — "how many painters" has no
    // answer until somebody names painting.
    tradeRows: trade ? tradeRows : null,
    tradeUnknownRows,
    unmappedRows,
    providers: [...new Set(files.map((f) => f.provider))],
    releases: [...new Set(files.map((f) => f.release))].sort(),
    problems,
  };
}

/**
 * How many rows the bucket holds per jurisdiction, for a caller that knows how
 * jurisdictions are keyed.
 *
 * `keyFor` is injected rather than imported so this file stays free of the
 * calling rules — and so the one place that spells "Canada is federal, the US
 * is per state" stays lib/sales/callingRules.js's jurisdictionKey(). A second
 * copy of that rule here is how a registration list starts disagreeing with the
 * gate that uses it.
 */
export function rowsByJurisdiction(keyFor) {
  const rows = {};
  if (typeof keyFor !== "function") return rows;
  for (const file of SNAPSHOT_FILES) {
    const key = keyFor({ country: file.country, province: file.province });
    if (!key) continue;
    rows[key] = (rows[key] || 0) + file.rows;
  }
  return rows;
}

/**
 * What to call each campaign when one selection produces several.
 *
 * The FILE is named, not just a part number, because the list is scanned by
 * name and "Quebec painters (2 of 3)" does not say whether that one is the
 * Overture half or the register half — which is the difference between a row
 * that carries a website and a row that cannot.
 */
export function campaignNameForFile(base, file, total, maxLength = 120) {
  const name = trimmed(base);
  if (total <= 1) return name.slice(0, maxLength);
  const part = file?.part ? ` part ${file.part}` : "";
  return `${name} — ${file?.provider || "source"}${part}`.slice(0, maxLength);
}

/**
 * How many rows of each trade a selection holds, biggest first.
 *
 * Used to fill the trade menu with real numbers rather than to filter it: a
 * trade with no rows in this region is still LISTED, with its zero, because
 * absence from a menu reads as "this build cannot do painting".
 */
export function tradeRowsFor({ providers = [], country = null, province = null } = {}) {
  const selection = snapshotSelection({ providers, country, province });
  const tally = {};
  for (const file of selection.files) {
    if (!file.tradesKnown) continue;
    for (const [key, count] of Object.entries(file.trades || {})) {
      tally[key] = (tally[key] || 0) + count;
    }
  }
  return {
    tally,
    rows: selection.rows,
    tradeUnknownRows: selection.tradeUnknownRows,
    unmappedRows: selection.unmappedRows,
  };
}
