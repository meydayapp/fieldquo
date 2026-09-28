// lib/meta/leadsFetch.js
//
// The network half of Meta lead ads: pick the credential, read the lead, work
// out which campaign it came from, hand it to the one writer.
//
// Split from lib/meta/leadsImport.js on the same line lib/meta/insightsImport.js
// draws — that file is pure so it can be executed against hostile input, and
// the fetching lives outside it. Here it is the reverse: this file is all
// I/O, and the only reason it exists as a file rather than as code in two
// routes is that the WEBHOOK and the CRON must do identical things to a lead.
// Two copies of "fetch it, attribute it, import it" would be two behaviours,
// and the copy is the one that rots (AGENTS.md failure class #4).
//
// ══ Which connection reads leads (changed 2026-09-28) ══════════════════════
//
// A company can hold TWO Meta connections, made by two different consent
// screens:
//
//   MetaAdConnection    Settings › Meta Ads, the ads flow. `ads_read` — it
//                       reads spend. Its user token was never granted the
//                       lead permissions on a Page.
//   MetaPageConnection  the "Facebook & Instagram publishing" connect, run on
//                       the Facebook Login for Business configuration that
//                       lists leads_retrieval, pages_manage_ads, pages_show_list
//                       and pages_read_engagement — and it STORES the Page
//                       access token those reads need.
//
// Everything here used to take the AD connection's user token and mint a page
// token from GET /me/accounts. On TrueFinish (2026-09-28) that answered
// "Lead forms found: 0" for a Page with a form on it: the ad token cannot see
// the Page, and /me/accounts was already measured on 2026-09-12 to return
// `[]` for a Page held through a business portfolio even when the grant names
// it (see fetchPagesByIds in lib/meta/client.js). The Page connection holds the
// token for exactly the Page the contractor picked, granted exactly the lead
// permissions, so forms discovery, the webhook fetch and the cron poll all
// read through it now — resolveLeadsCredential() below is the one place that
// decides, so the three cannot disagree.
//
// There is no fallback to the ad connection. It was checked before removing:
// production had no MetaLeadForm row in any company (read-only query,
// 2026-09-28), so no tenant depended on the /me/accounts path, and keeping it
// would be a second way to read leads that is known not to work for the one
// company using the feature.
//
// The AD token is still used for one thing: campaign attribution
// (resolveAttribution), which reads an ad with `ads_read`. When a company has
// no ad connection the page token is tried instead — best-effort either way.

import {
  getLead,
  listFormLeads,
  getAdAttribution,
  listPageLeadForms,
  META_LEADS_SCOPE,
} from "./client";
import { getConnection, getDecryptedToken } from "./connection";
import { getPageConnection, getDecryptedPageToken } from "./pageConnection";
import { importMetaLead } from "./leadsImport";

// The permissions the READS need, off the Page connection's GRANTED list.
// Deliberately META_LEADS_SCOPE and not lib/meta/pageConnect.js's full
// leadForms list: that one adds pages_manage_metadata, which the webhook
// SUBSCRIBE needs and reading does not — refusing to poll a form because the
// subscribe permission is missing would switch off the cron, which is the
// fallback for exactly that case.
const LEADS_READ_PERMISSIONS = META_LEADS_SCOPE.split(",");

/**
 * The read permissions the Page connection was NOT granted, or null when the
 * granted list is unknown (the read at connect time failed). Pure.
 */
export function missingLeadsReadPermissions(grantedScopes) {
  if (!grantedScopes) return null;
  const have = new Set(
    String(grantedScopes)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return LEADS_READ_PERMISSIONS.filter((p) => !have.has(p));
}

/**
 * Meta's Leads Access Manager refusal, told apart from every other failure.
 *
 * When a business portfolio turns on Leads Access Manager, only the people
 * and CRMs assigned there may read a Page's leads — every other app is
 * refused even with `leads_retrieval` granted (Meta: "If the Page admin did
 * not customize leads and has not granted access permission with the Leads
 * Access Manager, then all Page admins will have leads access permission" —
 * developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving,
 * read 2026-09-28). The refusal carries no code of its own that Meta
 * documents; what is reported in the wild is a message naming it ("CRM
 * access has been revoked from Lead Access Manager"). So it is recognised by
 * the message, and anything that does not name lead access keeps its
 * original kind — a guess in the other direction would send a contractor to
 * Business Suite for a token that simply expired.
 *
 * Pure. Takes a `{ ok:false, kind, message }` and returns the same shape,
 * with kind "leads_access" when it matches.
 */
const LEADS_ACCESS_RE = /leads?\s+access/i;
export function classifyLeadsFailure(res) {
  if (!res || res.ok) return res;
  if (LEADS_ACCESS_RE.test(String(res.message || ""))) return { ...res, kind: "leads_access" };
  return res;
}

/**
 * The credential that reads this company's lead forms and leads.
 *
 * @returns {Promise<
 *   | { ok: true, pageId, pageName, pageToken, attributionToken }
 *   | { ok: false, reason: "no_page_connection" }
 *   | { ok: false, reason: "token_unreadable", pageId, pageName }
 *   | { ok: false, reason: "permission_missing", missing, pageId, pageName }
 * >}
 *
 * The token never leaves the server: callers that answer a browser use
 * pageId/pageName only.
 */
export async function resolveLeadsCredential(companyId) {
  const page = await getPageConnection(companyId);
  if (!page) return { ok: false, reason: "no_page_connection" };
  const where = { pageId: String(page.pageId), pageName: page.pageName || null };

  let pageToken = null;
  try {
    pageToken = getDecryptedPageToken(page);
  } catch {
    pageToken = null;
  }
  // A live row whose ciphertext will not open (key rotation) — distinct from
  // an expired Meta token, and fixed only by reconnecting the Page.
  if (!pageToken) return { ok: false, reason: "token_unreadable", ...where };

  // Refused up front only when Meta's GRANTED list is known and short. An
  // unknown list is attempted: Meta's own answer is then the truth, and
  // refusing on "we don't know" would block a connection that may work.
  const missing = missingLeadsReadPermissions(page.scopes);
  if (missing && missing.length) return { ok: false, reason: "permission_missing", missing, ...where };

  // Campaign attribution reads the AD with ads_read. The ad connection's
  // token when there is one; otherwise the page token, whose grant also
  // lists ads_read on the Pages configuration. Best-effort: a failure is a
  // lead with no campaign, never a lost lead.
  let attributionToken = pageToken;
  const ad = await getConnection(companyId).catch(() => null);
  if (ad) {
    try {
      attributionToken = getDecryptedToken(ad) || pageToken;
    } catch {
      attributionToken = pageToken;
    }
  }

  return { ok: true, ...where, pageToken, attributionToken };
}

/**
 * Ad id -> { campaignId, campaignName }, or null.
 *
 * Best-effort by contract: every failure returns null and the lead lands with
 * no campaign, because a lead without its campaign is still a lead somebody
 * has to ring. Nothing is guessed from the form name or the ad name.
 */
export async function resolveAttribution({ accessToken, adId }) {
  if (!adId || !accessToken) return null;
  const res = await getAdAttribution({ accessToken, adId });
  if (!res.ok) {
    console.warn(`[meta/leads] campaign lookup failed for ad ${adId}: ${res.message}`);
    return null;
  }
  const campaign = res.data?.campaign;
  if (!campaign?.id) return null;
  return { campaignId: String(campaign.id), campaignName: campaign.name ? String(campaign.name) : null };
}

/**
 * The WEBHOOK path: one leadgen id -> one lead.
 *
 * The webhook payload carries an id and nothing else usable — no name, no
 * email, no answers — so this fetch is not an optional enrichment. It IS the
 * lead. A failure here is reported to the caller so the route can answer Meta
 * with a non-2xx and get the delivery retried, which is the whole point of
 * Meta's retry policy.
 *
 * `companyId` is resolved by the CALLER from FieldQuo's own MetaLeadForm rows
 * (lib/meta/leadsImport.js's resolveCompanyForPage) and passed in — never
 * read out of the payload. `credential` is resolveLeadsCredential()'s ok
 * answer for that company.
 */
export async function ingestLeadgenId({ companyId, credential, pageId, formId, leadgenId }) {
  // The stored token belongs to ONE Page. A delivery for another Page this
  // company once registered forms on cannot be read with it, and every retry
  // would fail the same way — so not retryable, and named.
  if (String(pageId) !== String(credential.pageId)) {
    return {
      status: "error",
      retryable: false,
      reason: "page_mismatch",
      message: `Lead is on page ${pageId}; the connected Page is ${credential.pageId}.`,
    };
  }

  const leadRes = classifyLeadsFailure(
    await getLead({ pageAccessToken: credential.pageToken, leadgenId }),
  );
  if (!leadRes.ok) {
    return {
      status: "error",
      // Rate limiting and an unexplained Graph failure are worth another
      // delivery; an auth, not-found or leads-access refusal fails the same
      // way on every retry and needs a person, not Meta hammering the route.
      retryable: leadRes.kind === "rate_limited" || leadRes.kind === "unknown_error",
      reason: leadRes.kind,
      message: leadRes.message,
    };
  }

  const lead = leadRes.data || {};
  const attribution = await resolveAttribution({
    accessToken: credential.attributionToken,
    adId: lead.ad_id,
  });

  return importMetaLead({
    companyId,
    lead,
    // The form id off the LEAD, falling back to the webhook's own — they agree
    // in every normal delivery, and preferring the fetched object means the
    // stored link matches what Meta says the lead belongs to rather than what
    // the request claimed.
    formId: lead.form_id || formId,
    attribution,
    path: "webhook",
  });
}

/**
 * The CRON path: everything new on one form since its cursor.
 *
 * ══ Why this exists at all ═════════════════════════════════════════════════
 *
 * Meta's webhook is lossy. Its own documentation says a delivery can be
 * dropped, and a dropped one is a homeowner who filled in a form, waited, and
 * was never called — the single worst outcome this product has. So every
 * active form is re-read on a schedule, and the two paths overlap on purpose.
 * They cannot produce duplicates: both end at importMetaLead(), which is
 * idempotent on the leadgen id.
 *
 * @returns {{ created, duplicates, skipped, errors, newestCreatedTime }}
 */
export async function pollForm({ companyId, credential, form }) {
  const out = { created: 0, duplicates: 0, skipped: 0, errors: [], newestCreatedTime: null };

  if (String(form.pageId) !== String(credential.pageId)) {
    out.errors.push(`form ${form.formId}: page ${form.pageId} is not the connected Page (${credential.pageId})`);
    return out;
  }

  // No cursor means this form has never been polled. Meta's own default
  // window is used rather than a start date FieldQuo invents: reaching back
  // over the whole history of a form would notify a contractor about hundreds
  // of people who enquired years ago and have long since hired somebody.
  const since = form.cursorLeadCreatedAt
    ? Math.floor(new Date(form.cursorLeadCreatedAt).getTime() / 1000)
    : null;

  const res = classifyLeadsFailure(
    await listFormLeads({
      pageAccessToken: credential.pageToken,
      formId: form.formId,
      sinceUnixSeconds: since,
    }),
  );
  if (!res.ok) {
    out.errors.push(`form ${form.formId}: ${res.kind}: ${res.message}`);
    return out;
  }

  for (const lead of Array.isArray(res.data?.data) ? res.data.data : []) {
    const attribution = await resolveAttribution({
      accessToken: credential.attributionToken,
      adId: lead?.ad_id,
    });
    let result;
    try {
      result = await importMetaLead({
        companyId,
        lead,
        formId: lead?.form_id || form.formId,
        attribution,
        path: "cron",
      });
    } catch (err) {
      // One bad lead must not abandon the rest of the page — and must not
      // advance the cursor past itself, which is why the created_time below
      // is only recorded for leads that were actually dealt with.
      out.errors.push(`lead ${lead?.id}: ${err?.message || String(err)}`);
      continue;
    }

    if (result.status === "created") out.created += 1;
    else if (result.status === "duplicate") out.duplicates += 1;
    else out.skipped += 1;

    const t = lead?.created_time ? new Date(lead.created_time) : null;
    if (t && !Number.isNaN(t.getTime()) && (!out.newestCreatedTime || t > out.newestCreatedTime)) {
      out.newestCreatedTime = t;
    }
  }

  return out;
}

/**
 * The connected Page's lead forms, as Meta reports them right now — what the
 * settings panel's "Find my lead forms" reads so a contractor sees the forms
 * they actually built rather than a list somebody typed.
 *
 * Returns the raw rows (or a classified failure); deciding what to store is
 * the route's job.
 */
export async function fetchPageForms({ credential }) {
  return classifyLeadsFailure(
    await listPageLeadForms({ pageAccessToken: credential.pageToken, pageId: credential.pageId }),
  );
}
