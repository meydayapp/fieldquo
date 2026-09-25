// lib/maps/streetViewTarget.js
//
// Which property a "See the property" request is about — resolved from a
// record the caller is allowed to read, never from anything the browser
// typed. The database half of lib/maps/streetView.js.
//
// ══ The gate is each record's own GET, not a new rule ══════════════════════
//
// A caller may see the property of exactly the records whose page they can
// already open, by the same checks those routes make:
//
//   lead    requests ≥ view_only, same company       (app/api/leads/[id])
//   client  a member of the same company             (app/api/clients/[id] —
//           the address is not a restricted field; name_address_only sees it)
//   job     jobs ≥ view_only, same company, and a crew member scoped to their
//           own jobs only sees theirs (assignedJobWhere, app/api/jobs/[id])
//   quote   quotes ≥ view_only, same company         (app/api/quotes/[id])
//   token   the client-facing quote: a share token whose quote is readable by
//           the public (not a draft), or a draft previewed by a signed-in
//           member of the owning company — app/q/[token]/page.js's gate,
//           through the same two helpers, so the page and this route cannot
//           disagree about who may look.
//
// Another company's id reads as not-found in the QUERY (companyId is in the
// where clause), exactly as it does on the record's own page — never a 403
// that would confirm the id exists.
//
// ══ Where the house's coordinate comes from ═══════════════════════════════
//
// Only from a geocode already stored on a Job and still inside Google's
// 30-day window (lib/maps/streetView.js jobPoint). For a job, its own row;
// for a quote, the job it became; for a lead, the job its quote became; for
// a client, one of the client's jobs at that same address. No new geocode is
// made — see the header of lib/maps/streetView.js on why.

import { db as defaultDb } from "@/lib/db";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { canPreviewCompanyDocument } from "@/lib/quotes/previewAccess";
import { formatAddress } from "@/lib/format/address";
import { leadAddressLine } from "@/lib/leads/intakeShape";
import { addressForRecord, jobPoint, GEOCODE_CACHE_DAYS } from "./streetView";

const JOB_POINT_SELECT = {
  latitude: true,
  longitude: true,
  geocodedAt: true,
  siteLatitude: true,
  siteLongitude: true,
  siteGeocodedAt: true,
};
const CLIENT_ADDRESS_SELECT = { type: true, address: true, city: true, province: true, postalCode: true };

const GATES = {
  lead: ["requests", "see requests"],
  job: ["jobs", "see jobs"],
  quote: ["quotes", "see quotes"],
};

/** A fresh point from the job a quote became, or null. */
async function pointFromQuoteJob(db, companyId, quoteId, now) {
  if (!quoteId) return null;
  const since = new Date(now.getTime() - GEOCODE_CACHE_DAYS * 86400000);
  const job = await db.job.findFirst({
    where: {
      companyId,
      quoteId,
      OR: [{ geocodedAt: { gte: since } }, { siteGeocodedAt: { gte: since } }],
    },
    orderBy: { createdAt: "desc" },
    select: JOB_POINT_SELECT,
  });
  return jobPoint(job, now);
}

/**
 * For a staff surface. `member` is the session member from memberOrRefusal.
 *
 * @returns {{ target } | { response } | { notFound: true }} — `response` is
 *   a permission refusal to return as-is; `notFound` means the record is not
 *   this caller's (another company's id, another crew member's job);
 *   `target` is `{ address, point }`, or null when the record names no
 *   address.
 */
export async function staffStreetViewTarget({ member, kind, id, db = defaultDb, now = new Date(), gate = levelOrRefusal }) {
  if (!member?.companyId) return { notFound: true };
  const companyId = member.companyId;

  let full = null;
  if (GATES[kind]) {
    const [category, action] = GATES[kind];
    const checked = await gate(member, category, "view_only", action);
    if (checked.response) return { response: checked.response };
    full = checked.full;
  }

  const helpers = { formatAddress, leadAddressLine };

  if (kind === "lead") {
    const lead = await db.leadRequest.findFirst({
      where: { id, companyId },
      select: { intake: true, quote: { select: { id: true } } },
    });
    if (!lead) return { notFound: true };
    const address = addressForRecord("lead", lead, helpers);
    if (!address) return { target: null };
    const point = await pointFromQuoteJob(db, companyId, lead.quote?.id, now);
    return { target: { address, point } };
  }

  if (kind === "client") {
    const client = await db.client.findFirst({ where: { id, companyId }, select: CLIENT_ADDRESS_SELECT });
    if (!client) return { notFound: true };
    const address = addressForRecord("client", client, helpers);
    if (!address) return { target: null };
    // One of this client's own jobs at this very address, geocoded recently.
    // Compared on the stored strings — the job's site line is usually the
    // client's formatted line copied across by the quote.
    const since = new Date(now.getTime() - GEOCODE_CACHE_DAYS * 86400000);
    const candidates = [...new Set([address, String(client.address || "").trim()].filter(Boolean))];
    const job = await db.job.findFirst({
      where: {
        companyId,
        clientId: id,
        OR: candidates.map((a) => ({ siteAddress: { equals: a, mode: "insensitive" } })),
        AND: [{ OR: [{ geocodedAt: { gte: since } }, { siteGeocodedAt: { gte: since } }] }],
      },
      orderBy: { createdAt: "desc" },
      select: JOB_POINT_SELECT,
    });
    return { target: { address, point: jobPoint(job, now) } };
  }

  if (kind === "job") {
    const job = await db.job.findFirst({
      where: { id, companyId, ...assignedJobWhere(full) },
      select: { siteAddress: true, client: { select: CLIENT_ADDRESS_SELECT }, ...JOB_POINT_SELECT },
    });
    if (!job) return { notFound: true };
    const address = addressForRecord("job", job, helpers);
    if (!address) return { target: null };
    // The job's coordinate is of Job.siteAddress. When the address fell back
    // to the client's, the pin is not known to be of THAT string, so no heading.
    const point = job.siteAddress ? jobPoint(job, now) : null;
    return { target: { address, point } };
  }

  if (kind === "quote") {
    const quote = await db.quote.findFirst({
      where: { id, companyId },
      select: { id: true, siteAddress: true, client: { select: CLIENT_ADDRESS_SELECT } },
    });
    if (!quote) return { notFound: true };
    const address = addressForRecord("quote", quote, helpers);
    if (!address) return { target: null };
    const point = await pointFromQuoteJob(db, companyId, quote.id, now);
    return { target: { address, point } };
  }

  return { notFound: true };
}

/**
 * For the client-facing quote (/q/[token]). Same gate as the page.
 *
 * `previewCheck` is injectable so a check script can execute the draft branch
 * without a session; in the route it is canPreviewCompanyDocument.
 *
 * @returns `{ address, point, language }` or null.
 */
export async function publicStreetViewTarget({
  request,
  token,
  db = defaultDb,
  now = new Date(),
  previewCheck = canPreviewCompanyDocument,
}) {
  if (!token) return null;
  const quote = await db.quote.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      companyId: true,
      language: true,
      siteAddress: true,
      client: { select: CLIENT_ADDRESS_SELECT },
    },
  });
  if (!quote) return null;
  if (!isPubliclyReadable(quote.status)) {
    const preview = await previewCheck(request, quote.companyId);
    if (!preview) return null;
  }
  const address = addressForRecord("quote", quote, { formatAddress, leadAddressLine });
  if (!address) return null;
  const point = await pointFromQuoteJob(db, quote.companyId, quote.id, now);
  return { address, point, language: quote.language || null };
}
