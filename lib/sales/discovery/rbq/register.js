// lib/sales/discovery/rbq/register.js
//
// Where Quebec's contractor-licence register lives, and what its licence
// obliges FieldQuo to do about it.
//
// ══ Resolved through CKAN, never hardcoded ═════════════════════════════════
//
// Données Québec is a CKAN instance, and a CKAN resource URL contains the
// resource's UUID. Re-publishing a dataset mints a NEW resource, and the old
// URL 404s. A hardcoded download link would therefore work until the day the
// RBQ re-published, and then fail in a way that looks like the register having
// gone away rather than having moved.
//
// So `package_show` on the DATASET id is the entry point, and the download URL
// is read out of the answer. The dataset id is stable; a resource id is not.
//
// ══ CC-BY 4.0, and where the attribution actually goes ═════════════════════
//
// `license_id: cc-by` — verified against the live API on 2026-09-03, not read
// off a wiki. Commercial use and redistribution are permitted; ATTRIBUTION IS
// A CONDITION. That is not satisfied by a comment in a source file nobody
// reads, so `RBQ_ATTRIBUTION` is rendered in two places a human actually
// looks:
//
//   1. the provider's `description`, on the campaign form, where a superadmin
//      is choosing a source — which is where trades.js's sibling comment says
//      "choosing a source is choosing a licence"; and
//   2. the "Where this came from" fact on every prospect discovered this way,
//      via lib/sales/prospectView.js — the screen a rep reads before dialling.
//
// The attribution deliberately does NOT reach a client-facing surface. Nothing
// here is ever shown to a homeowner, so the white-label rule in AGENTS.md is
// untouched: this is FieldQuo's own back office citing FieldQuo's own source.
//
// ══ Freshness ═════════════════════════════════════════════════════════════
//
// The RBQ re-publishes daily (`metadata_modified` moved within hours of the
// resource's own `last_modified` when this was written). The release name is
// therefore the resource's own last_modified DATE — see `releaseFromResource`.
// A monthly-style version string would be a fiction; a date is what the source
// actually tells us.

/** The dataset, not the resource. The resource id changes on re-publication. */
export const RBQ_DATASET_ID = "755b45d6-7aee-46df-a216-748a0191c79f";

/** CKAN's read API on Données Québec. */
export const RBQ_CKAN_BASE = "https://www.donneesquebec.ca/recherche/api/3/action";

/** The dataset's landing page, for a human following the attribution. */
export const RBQ_DATASET_URL = `https://www.donneesquebec.ca/recherche/dataset/${RBQ_DATASET_ID}`;

/**
 * The attribution CC-BY 4.0 requires, in the form the licence asks for:
 * the title, the creator, and the licence.
 *
 * One string, exported, so the two surfaces that render it cannot drift into
 * two different claims about who made this data.
 */
export const RBQ_ATTRIBUTION =
  "Contains information from the “Liste des licences actives de la Régie du bâtiment du Québec”, " +
  "published by the Régie du bâtiment du Québec on Données Québec under CC BY 4.0.";

export const RBQ_LICENCE_ID = "cc-by";
export const RBQ_LICENCE_URL = "https://creativecommons.org/licenses/by/4.0/";

/**
 * Is this a release name this build produced?
 *
 * `YYYY-MM-DD`, from the resource's last_modified. Validated rather than
 * trusted because the release is stamped onto every Prospect as provenance,
 * and a prospect carrying `sourceRelease: "undefined"` cannot be re-checked
 * against the file it came from — which is the entire point of the column.
 */
export function isRbqRelease(value) {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  // A syntactically fine date that is not a date — "2026-02-31" — would pass a
  // regex and then sort wrongly against every real release.
  const at = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

/**
 * The release a CKAN resource represents.
 *
 * Null rather than today's date when the resource says nothing. A record whose
 * vintage nobody knows must not be stamped with the date we happened to look —
 * the same rule normalise.js applies to `sourceUpdatedAt`.
 */
export function releaseFromResource(resource) {
  const raw = resource?.last_modified || resource?.created || null;
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return at.toISOString().slice(0, 10);
}

/**
 * Pick the resource to read out of a CKAN package.
 *
 * The ZIPPED CSV, by format and by the `.zip` extension, and NOT the JSON
 * sibling: both carry the same rows, and the CSV is 11 MB against the JSON's
 * 88 MB for identical content. Chosen by inspecting the resource list rather
 * than by index — CKAN does not promise an order, and "the third resource" is
 * a rule that breaks the first time somebody uploads a new fiche descriptive.
 *
 * Returns problems rather than throwing: every one of them is something a
 * human has to look at, and the extractor prints them.
 */
export function pickCsvResource(pkg) {
  const resources = Array.isArray(pkg?.resources) ? pkg.resources : [];
  if (!resources.length) return { resource: null, problems: ["The dataset lists no resources at all."] };

  const csv = resources.find(
    (r) => String(r?.format || "").toUpperCase() === "CSV" && /\.zip$/i.test(String(r?.url || "")),
  );
  if (!csv) {
    return {
      resource: null,
      problems: [
        `No zipped CSV resource on the dataset — it lists ${resources
          .map((r) => r?.format || "?")
          .join(", ")}.`,
      ],
    };
  }
  if (!csv.url) return { resource: null, problems: ["The CSV resource carries no download URL."] };
  return { resource: csv, problems: [] };
}

/**
 * Everything the extractor needs, read from CKAN in one call.
 *
 * `fetchImpl` is injected so the check can drive this against a canned answer
 * and against a malformed one — the shape overture/release.js uses.
 *
 * The LICENCE is re-read here rather than assumed. If the RBQ ever re-licensed
 * this dataset, an extractor that carried on printing a CC-BY notice would be
 * making a false claim on FieldQuo's behalf; so a licence that is not `cc-by`
 * is reported as a problem and the caller stops.
 */
export async function fetchRbqResource({ fetchImpl = fetch } = {}) {
  const url = `${RBQ_CKAN_BASE}/package_show?id=${encodeURIComponent(RBQ_DATASET_ID)}`;

  let response;
  try {
    response = await fetchImpl(url, { redirect: "follow" });
  } catch (err) {
    return { ok: false, problems: [`Could not reach Données Québec: ${err?.message || err}`] };
  }
  if (!response?.ok) {
    return { ok: false, problems: [`Données Québec answered ${response?.status ?? "no status"}.`] };
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, problems: [`Données Québec did not return JSON: ${err?.message || err}`] };
  }

  const pkg = body?.result;
  if (!pkg || typeof pkg !== "object") {
    return { ok: false, problems: ["The CKAN answer carried no `result` object."] };
  }

  const problems = [];
  if (pkg.license_id !== RBQ_LICENCE_ID) {
    problems.push(
      `The dataset now says its licence is ${JSON.stringify(pkg.license_id)}, not ${RBQ_LICENCE_ID}. ` +
        "FieldQuo's attribution notice would be a false statement, so nothing was extracted.",
    );
  }

  const { resource, problems: resourceProblems } = pickCsvResource(pkg);
  problems.push(...resourceProblems);
  if (problems.length) return { ok: false, problems };

  const release = releaseFromResource(resource);
  if (!isRbqRelease(release)) {
    return {
      ok: false,
      problems: [`The CSV resource carries no usable last_modified date, so its release is unknown.`],
    };
  }

  return {
    ok: true,
    problems: [],
    url: resource.url,
    release,
    licenceId: pkg.license_id,
    title: pkg.title || null,
    datasetUrl: RBQ_DATASET_URL,
    attribution: RBQ_ATTRIBUTION,
  };
}
