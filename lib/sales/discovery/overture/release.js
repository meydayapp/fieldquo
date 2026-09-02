// lib/sales/discovery/overture/release.js
//
// Which Overture release is current, asked rather than assumed.
//
// ══ Why this is not a constant ═════════════════════════════════════════════
//
// Overture ships monthly. `2026-08-19.0` was current when
// docs/sales-intel/MEASURE-overture-coverage.md was written and will not be in
// October. A hard-coded release would keep working — which is the problem: the
// pipeline would silently prospect from a frozen snapshot of the world, and
// the first symptom would be a rep phoning a business that closed a year ago.
//
// ══ Why it is a plain fetch and not the AWS SDK ════════════════════════════
//
// The bucket is public and anonymous. `GET /?list-type=2&delimiter=/&prefix=
// release/` is a documented S3 REST call that needs no credentials, no SDK and
// no account — the discovery audit proved that empirically before any of this
// was designed. Adding an SDK dependency to read one XML document would be a
// megabyte of bundle for a string.
//
// ══ The parse is separate from the fetch, on purpose ═══════════════════════
//
// `parseReleaseListing` is pure and takes the XML as a string, so the check
// can run it over a truncated response, an error document, a listing with no
// releases and a listing whose newest entry is a beta — none of which needs a
// network.
export const OVERTURE_BUCKET = "overturemaps-us-west-2";
export const OVERTURE_REGION = "us-west-2";
export const OVERTURE_LISTING_URL = `https://${OVERTURE_BUCKET}.s3.${OVERTURE_REGION}.amazonaws.com/?list-type=2&delimiter=/&prefix=release/`;

/** Where a release's places files live. Stamped onto every evidence row. */
export function placesPathFor(release) {
  if (!isReleaseName(release)) return null;
  return `s3://${OVERTURE_BUCKET}/release/${release}/theme=places/type=place/`;
}

/**
 * A release name: `YYYY-MM-DD.N`.
 *
 * Deliberately strict. Overture has published beta and rc prefixes in the
 * past, and "newest string" over an unfiltered listing would happily pick one
 * — a prospect stamped with a release that later disappears has provenance
 * pointing at nothing.
 */
export function isReleaseName(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}\.\d+$/.test(value);
}

/**
 * Every release name in an S3 listing document, oldest first.
 *
 * Reads `<Prefix>release/NAME/</Prefix>` out of the CommonPrefixes. A regex
 * rather than an XML parser because the document has exactly one shape, this
 * repo ships no XML parser, and the failure mode of the regex — finding
 * nothing — is the same failure mode as a parse error and is handled the same
 * way.
 *
 * @returns {{ releases: string[], truncated: boolean, rejected: string[] }}
 *          `rejected` is what was there and did not look like a release, so a
 *          screen can say "Overture published something this code does not
 *          recognise" instead of silently reporting the previous month.
 */
export function parseReleaseListing(xml) {
  const text = typeof xml === "string" ? xml : "";
  const releases = [];
  const rejected = [];

  for (const match of text.matchAll(/<Prefix>\s*release\/([^<\/]+)\/?\s*<\/Prefix>/g)) {
    const name = match[1].trim();
    if (!name) continue;
    if (isReleaseName(name)) releases.push(name);
    else rejected.push(name);
  }

  // A truncated listing is reported rather than treated as complete. S3 pages
  // at 1,000 keys and Overture is nowhere near that, so this firing at all
  // means something changed — and picking "the newest of the first page" would
  // be wrong in exactly the way that is hardest to notice.
  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(text);

  releases.sort();
  return { releases: [...new Set(releases)], truncated, rejected: [...new Set(rejected)] };
}

/** The newest release in a listing, or null. */
export function newestRelease(xml) {
  const { releases, truncated } = parseReleaseListing(xml);
  if (truncated) return null;
  return releases.length ? releases[releases.length - 1] : null;
}

/**
 * Ask the bucket what the current release is.
 *
 * Thin on purpose: fetch, hand the body to the pure parser, return what it
 * said. `fetchImpl` is injectable so the check can drive every failure — a
 * 403, an HTML error page, a timeout — without a network.
 *
 * Returns `{ release: null, error }` rather than throwing. The caller is a
 * pipeline handler, and a handler that throws on a network blip burns an
 * attempt and six hours of backoff for something that will work next tick;
 * returning the problem lets it decide.
 */
export async function fetchCurrentRelease({ fetchImpl = fetch, signal = null } = {}) {
  let response;
  try {
    response = await fetchImpl(OVERTURE_LISTING_URL, { signal, redirect: "follow" });
  } catch (err) {
    return { release: null, error: `could not reach the Overture bucket: ${err?.message || err}` };
  }

  if (!response?.ok) {
    return { release: null, error: `the Overture bucket answered ${response?.status ?? "no status"}` };
  }

  let body;
  try {
    body = await response.text();
  } catch (err) {
    return { release: null, error: `could not read the listing: ${err?.message || err}` };
  }

  const { releases, truncated, rejected } = parseReleaseListing(body);
  if (truncated) {
    return {
      release: null,
      error: "the bucket listing was truncated, so the newest release cannot be known from one page",
    };
  }
  if (!releases.length) {
    return {
      release: null,
      error: rejected.length
        ? `the bucket listed ${rejected.length} prefix(es) that do not look like releases: ${rejected.slice(0, 3).join(", ")}`
        : "the bucket listed no releases",
    };
  }

  return { release: releases[releases.length - 1], releases, error: null };
}
