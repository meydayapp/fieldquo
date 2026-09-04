// lib/sales/discovery/usBoard/socrata.js
//
// Resolving a US state licence board's bulk file through Socrata, and reading
// the licence terms off the answer rather than off a comment.
//
// ══ Why a resolver and not a hardcoded download URL ════════════════════════
//
// The same reason rbq/register.js resolves through CKAN. A Socrata portal's
// download URL embeds the dataset's four-by-four id, and the CSV endpoint is
// generated per request — a link copied out of a browser carries session
// parameters that expire. `/api/views/<id>.json` is the stable entry point:
// it is the dataset, not a rendering of it, and it answers with the licence,
// the attribution and the row-update timestamp in one call.
//
// The four-by-four itself IS hardcoded, in boards.js, and that is the right
// place for it — unlike CKAN, Socrata does not mint a new id on re-publication,
// so the id is as stable as the dataset is. What is NOT hardcoded is anything
// the portal can change under us: the licence, the attribution, the freshness.
//
// ══ The licence is re-read on every extraction, and can stop one ═══════════
//
// Verified live on 2026-09-03:
//
//   data.wa.gov      m8qx-ubtq  licenseId "PDDL"          Open Data Commons PDDL 1.0
//   data.oregon.gov  g77e-6bhs  licenseId "USGOV_WORKS"   Public Domain U.S. Government
//
// Neither requires attribution. That is a finding and not an excuse to omit
// one: `boards.js` still carries a source statement for every board, because
// the campaign checkbox has to say where the rows came from whatever the
// licence demands, and because a superadmin comparing a PDDL board against
// RBQ's CC-BY needs to see that the two are different obligations rather than
// two blanks.
//
// What the re-read protects is the opposite case. If Washington re-licensed
// this dataset tomorrow, an extractor that carried on printing "public domain"
// would be making a false statement on FieldQuo's behalf. So a licenceId that
// is not the one the board declares STOPS the extraction — the same refusal,
// for the same reason, as rbq/register.js's `license_id !== "cc-by"`.
//
// ══ robots.txt ════════════════════════════════════════════════════════════
//
// Checked on both hosts on 2026-09-03. Socrata's robots.txt disallows the
// faceted `/browse` URLs and `/api/odata/`, and allows `/api/views/`. It sets
// `Crawl-delay: 1`, which is exactly lib/sales/crawl/policy.js's
// MIN_CRAWL_DELAY_MS — this resolver makes one metadata request and one file
// download per extraction, from a laptop, so the delay is satisfied by the
// shape of the work rather than by a scheduler.

/** How long a Socrata id is allowed to be, and what it may contain. */
const FOUR_BY_FOUR = /^[a-z0-9]{4}-[a-z0-9]{4}$/;

/** Is this a dataset id Socrata would recognise? */
export function isSocrataId(value) {
  return typeof value === "string" && FOUR_BY_FOUR.test(value);
}

/**
 * The metadata URL for a dataset.
 *
 * `/api/views/<id>.json` rather than `/resource/<id>.json`: the latter returns
 * ROWS, and asking a 160,000-row dataset for its licence by downloading it is
 * the mistake that makes an extractor look like a scraper.
 */
export function socrataMetadataUrl(host, datasetId) {
  return `https://${host}/api/views/${encodeURIComponent(datasetId)}.json`;
}

/**
 * The bulk CSV URL for a dataset.
 *
 * `accessType=DOWNLOAD` is the whole file in one response, which is what an
 * offline extractor wants. The paged `/resource/<id>.csv?$limit=` endpoint
 * would need thousands of requests to say the same thing, and hammering a
 * public portal to reconstruct a file it already publishes whole is exactly
 * the behaviour AUDIT-compliance.md §10 asks us not to exhibit.
 */
export function socrataCsvUrl(host, datasetId) {
  return `https://${host}/api/views/${encodeURIComponent(datasetId)}/rows.csv?accessType=DOWNLOAD`;
}

/**
 * The release a Socrata dataset represents.
 *
 * `rowsUpdatedAt` is a Unix timestamp in SECONDS, and that is worth stating
 * because every other timestamp in this codebase is milliseconds — reading it
 * as milliseconds dates every US snapshot to January 1970 and makes the
 * release column sort before every other source we have.
 *
 * Null when the portal says nothing. Never today's date: a record whose
 * vintage nobody knows must not be stamped with the date we happened to look,
 * which is the rule rbq/register.js's `releaseFromResource` states and the
 * reason `Prospect.sourceRelease` is worth having at all.
 */
export function releaseFromSocrata(view) {
  const seconds = view?.rowsUpdatedAt;
  if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return null;
  const at = new Date(Number(seconds) * 1000);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD`, and a real date. Same validation, and same reason, as RBQ's. */
export function isBoardRelease(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/**
 * Everything the extractor needs about one board's dataset, in one call.
 *
 * `fetchImpl` is injected so the check can drive this against a canned answer,
 * a re-licensed one and a malformed one. Problems rather than exceptions, for
 * rbq/register.js's stated reason: each one is something a human has to look
 * at, and the campaign screen has to be able to say which.
 *
 * @param {object} board a row from boards.js
 * @param {{fetchImpl?: Function}} deps
 */
export async function fetchSocrataDataset(board, { fetchImpl = fetch } = {}) {
  const host = board?.source?.host;
  const datasetId = board?.source?.datasetId;
  if (!host || !isSocrataId(datasetId)) {
    return { ok: false, problems: [`${board?.key || "this board"} has no usable Socrata dataset id.`] };
  }

  const url = socrataMetadataUrl(host, datasetId);
  let response;
  try {
    response = await fetchImpl(url, { redirect: "follow" });
  } catch (err) {
    return { ok: false, problems: [`Could not reach ${host}: ${err?.message || err}`] };
  }
  if (!response?.ok) {
    return { ok: false, problems: [`${host} answered ${response?.status ?? "no status"}.`] };
  }

  let view;
  try {
    view = await response.json();
  } catch (err) {
    return { ok: false, problems: [`${host} did not return JSON: ${err?.message || err}`] };
  }
  if (!view || typeof view !== "object" || Array.isArray(view)) {
    return { ok: false, problems: [`${host} returned no dataset object.`] };
  }

  const problems = [];
  // The refusal that stops a false licence claim reaching a screen. See the
  // header: an extractor that keeps printing "public domain" over a dataset
  // that has been re-licensed is worse than one that stops.
  if (view.licenseId !== board.source.licenceId) {
    problems.push(
      `${board.label} now says its licence is ${JSON.stringify(view.licenseId)}, not ` +
        `${JSON.stringify(board.source.licenceId)}. FieldQuo's own statement about this source would be ` +
        "wrong, so nothing was extracted.",
    );
  }

  const release = releaseFromSocrata(view);
  if (!isBoardRelease(release)) {
    problems.push(`${board.label}'s dataset carries no usable rowsUpdatedAt, so its release is unknown.`);
  }
  if (problems.length) return { ok: false, problems };

  return {
    ok: true,
    problems: [],
    url: socrataCsvUrl(host, datasetId),
    release,
    licenceId: view.licenseId,
    licenceName: view.license?.name || null,
    licenceUrl: view.license?.termsLink || null,
    title: view.name || null,
    datasetUrl: `https://${host}/d/${datasetId}`,
    // Socrata's own attribution field, when the portal sets one. Reported so
    // the extractor can print it beside the notice boards.js carries; it is
    // NOT substituted for that notice, because a portal field that happens to
    // be empty must not silently empty a statement FieldQuo made deliberately.
    portalAttribution: view.attribution || null,
  };
}
