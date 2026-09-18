// lib/sales/intel/bbbApply.js
//
// A BBB profile a browser read, applied to the prospect it was read FOR —
// after the server has checked, itself, that the profile is that prospect.
//
// Shared by scripts/bbb-principal.mjs (direct, on a machine with the
// database) and POST /api/platform/sales/prospects/bbb-upload (a file
// produced elsewhere). One function, so the two cannot disagree about what
// "matched" means: the profile is shaped into a listing and put through
// lib/sales/intel/listingMatch.js against the ONE prospect the row names.
// The row carries the prospect id it was handed — that is the link back to
// the lead — and never a guess at which prospect a profile might be.
import { db as defaultDb } from "@/lib/db";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { BBB_RECHECK_DAYS, LISTING_PROSPECT_SELECT, applyBbbProfile, matchListings } from "./listingMatch";

/** parseBbbProfile() output → the neutral listing the matcher reads. */
export function profileAsListing(profile = {}) {
  return {
    source: "bbb",
    externalId: profile.url || null,
    name: profile.name || "",
    phone: profile.phone || null,
    phoneE164: normalisePhone(profile.phone || ""),
    websiteUrl: profile.website || null,
    addressLine: profile.address?.line || null,
    city: profile.address?.city || null,
    province: profile.address?.province || null,
    postalCode: profile.address?.postalCode || null,
    country: profile.address?.country || null,
    latitude: profile.location?.latitude ?? null,
    longitude: profile.location?.longitude ?? null,
  };
}

/**
 * One row: { prospectId, profile } → applied or refused, with why.
 *
 * `alreadyKnown` when the prospect already carries this profile URL and
 * was checked inside BBB_RECHECK_DAYS — nothing is re-written. A row with
 * NO profile (the script searched and found nothing that matched) stamps
 * `bbbCheckedAt` so the prospect is not searched again this season, and
 * records the top candidate on the evidence so a human can disagree.
 */
export async function applyBbbRow({ db = defaultDb, row, now = new Date() } = {}) {
  const prospectId = typeof row?.prospectId === "string" ? row.prospectId : null;
  if (!prospectId) return { outcome: "refused", reason: "no_prospect_id" };
  const prospect = await db.prospect.findUnique({ where: { id: prospectId }, select: LISTING_PROSPECT_SELECT });
  if (!prospect) return { outcome: "refused", reason: "prospect_not_found", prospectId };
  if (prospect.mergedIntoId) return { outcome: "refused", reason: "retired_into_survivor", prospectId };

  const profile = row?.profile && typeof row.profile === "object" ? row.profile : null;
  if (!profile) {
    // The script looked and found no profile that matched. Stamp it, and
    // keep the top candidate it refused where the console can see it.
    const top = row?.topCandidate && typeof row.topCandidate === "object" ? row.topCandidate : null;
    await db.$transaction(async (tx) => {
      await tx.prospect.update({ where: { id: prospectId }, data: { bbbCheckedAt: now } });
      if (top?.name) {
        await tx.prospectEvidence.create({
          data: {
            prospectId,
            type: "bbb_search",
            source: "bbb",
            sourceUrl: top.url || null,
            rawValue: `BBB search found no confident match; the top result was "${top.name}"${top.city ? ` in ${top.city}` : ""} (${top.reason || "refused"})`.slice(0, 2000),
            normalizedValue: null,
            observedAt: now,
            confidence: 0.5,
            detector: "bbb.search",
            detectorVersion: "1",
          },
        });
      }
    });
    return { outcome: "no_match", reason: row?.reason || "no_confident_match", prospectId };
  }

  const recent = prospect.bbbCheckedAt && now.getTime() - new Date(prospect.bbbCheckedAt).getTime() < BBB_RECHECK_DAYS * 24 * 60 * 60 * 1000;
  if (recent && prospect.bbbProfileUrl && profile.url && prospect.bbbProfileUrl === profile.url && !row?.force) {
    return { outcome: "already_known", prospectId, url: profile.url };
  }

  // The server's own match, against the one prospect named. The rule is
  // the Places rule (name overlap AND city/postal/phone agreement).
  const m = matchListings(prospect, [profileAsListing(profile)]);
  if (m.verdict !== "matched") {
    await db.prospect.update({ where: { id: prospectId }, data: { bbbCheckedAt: now } });
    return { outcome: "refused", reason: m.score?.reason || m.verdict, prospectId, score: m.score };
  }
  const r = await applyBbbProfile({ db, prospectId, profile, now });
  return { outcome: "matched", prospectId, url: profile.url, gained: r.gained, conflicts: r.conflicts, peopleAdded: r.peopleAdded, score: m.score };
}

/** Many rows, tallied. */
export async function applyBbbRows({ db = defaultDb, rows = [], now = new Date(), by = null } = {}) {
  const report = { asked: rows.length, matched: 0, refused: 0, noMatch: 0, alreadyKnown: 0, peopleAdded: 0, gained: {}, rows: [] };
  for (const row of rows) {
    let r;
    try {
      r = await applyBbbRow({ db, row, now });
    } catch (err) {
      r = { outcome: "refused", reason: `threw: ${err?.message || err}`, prospectId: row?.prospectId || null };
    }
    if (r.outcome === "matched") {
      report.matched += 1;
      report.peopleAdded += r.peopleAdded || 0;
      for (const g of r.gained || []) report.gained[g] = (report.gained[g] || 0) + 1;
    } else if (r.outcome === "already_known") report.alreadyKnown += 1;
    else if (r.outcome === "no_match") report.noMatch += 1;
    else report.refused += 1;
    report.rows.push(r);
  }
  if (by) console.log(`[bbb] ${by} applied ${rows.length} rows: ${report.matched} matched, ${report.refused} refused, ${report.noMatch} no match, ${report.alreadyKnown} already known`);
  return report;
}
