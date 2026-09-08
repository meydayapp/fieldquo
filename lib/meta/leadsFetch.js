// lib/meta/leadsFetch.js
//
// The network half of Meta lead ads: get a page token, read the lead, work
// out which campaign it came from, hand it to the one writer.
//
// Split from lib/meta/leadsImport.js on the same line lib/meta/insightsImport.js
// draws — that file is pure so it can be executed against hostile input, and
// the fetching lives outside it. Here it is the reverse: this file is all
// I/O, and the only reason it exists as a file rather than as code in two
// routes is that the WEBHOOK and the CRON must do identical things to a lead.
// Two copies of "fetch it, attribute it, import it" would be two behaviours,
// and the copy is the one that rots (AGENTS.md failure class #4).

import {
  listPages,
  getLead,
  listFormLeads,
  getAdAttribution,
  listPageLeadForms,
} from "./client";
import { getDecryptedToken } from "./connection";
import { importMetaLead } from "./leadsImport";

/**
 * The PAGE access token for one Page, minted from the stored user token.
 *
 * Meta's leadgen read will not accept the user token FieldQuo stores; it wants
 * a token scoped to the Page. GET /me/accounts returns one per Page the person
 * administers, which is the whole reason `pages_show_list` is in
 * META_LEADS_SCOPE.
 *
 * `cache` is an optional Map, passed by the cron so that polling twelve forms
 * on one Page costs one /me/accounts call rather than twelve. Deliberately
 * per-run and in memory: a page token at REST would be a second credential to
 * encrypt, rotate, expire and leak, and the user token can always mint
 * another.
 *
 * @returns {{ ok: true, token } | { ok: false, kind, message }}
 */
export async function pageTokenFor({ accessToken, pageId, cache }) {
  if (cache?.has(pageId)) return { ok: true, token: cache.get(pageId) };

  const res = await listPages({ accessToken });
  if (!res.ok) return res;

  const pages = Array.isArray(res.data?.data) ? res.data.data : [];
  for (const p of pages) {
    if (p?.id && p?.access_token && cache) cache.set(String(p.id), p.access_token);
  }
  const match = pages.find((p) => String(p?.id) === String(pageId));
  if (!match?.access_token) {
    // The person who connected no longer administers this Page, or never did.
    // A "not_found", not an auth error: reconnecting will not conjure access
    // to somebody else's Page, and telling a contractor to reconnect for it
    // would send them through Facebook's consent screen for nothing.
    return { ok: false, kind: "not_found", message: `No page access token for page ${pageId}.` };
  }
  return { ok: true, token: match.access_token };
}

/**
 * Ad id -> { campaignId, campaignName }, or null.
 *
 * Runs with the AD ACCOUNT token (ads_read — already granted), not the page
 * token, so campaign attribution does not depend on the permission still
 * pending. Best-effort by contract: every failure returns null and the lead
 * lands with no campaign, because a lead without its campaign is still a lead
 * somebody has to ring. Nothing is guessed from the form name or the ad name.
 */
export async function resolveAttribution({ accessToken, adId }) {
  if (!adId) return null;
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
 * read out of the payload. See that function's header.
 */
export async function ingestLeadgenId({ companyId, connection, pageId, formId, leadgenId }) {
  let userToken;
  try {
    userToken = getDecryptedToken(connection);
  } catch {
    // A corrupted row after a key rotation. Distinct from an expired Meta
    // token — see lib/meta/tokenCrypto.js — and not retryable by Meta, so the
    // caller should NOT ask for a redelivery of something that will fail the
    // same way every time.
    return { status: "error", retryable: false, reason: "token_unreadable" };
  }

  const pageToken = await pageTokenFor({ accessToken: userToken, pageId });
  if (!pageToken.ok) {
    return {
      status: "error",
      // Rate limiting is the one failure worth another delivery attempt; an
      // auth or not-found error will fail identically on every retry, and
      // asking Meta to hammer it is worse than recording the loss.
      retryable: pageToken.kind === "rate_limited",
      reason: pageToken.kind,
      message: pageToken.message,
    };
  }

  const leadRes = await getLead({ pageAccessToken: pageToken.token, leadgenId });
  if (!leadRes.ok) {
    return {
      status: "error",
      retryable: leadRes.kind === "rate_limited" || leadRes.kind === "unknown_error",
      reason: leadRes.kind,
      message: leadRes.message,
    };
  }

  const lead = leadRes.data || {};
  const attribution = await resolveAttribution({ accessToken: userToken, adId: lead.ad_id });

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
export async function pollForm({ companyId, userToken, form, pageTokenCache }) {
  const out = { created: 0, duplicates: 0, skipped: 0, errors: [], newestCreatedTime: null };

  const pageToken = await pageTokenFor({
    accessToken: userToken,
    pageId: form.pageId,
    cache: pageTokenCache,
  });
  if (!pageToken.ok) {
    out.errors.push(`page ${form.pageId}: ${pageToken.message}`);
    return out;
  }

  // No cursor means this form has never been polled. Meta's own default
  // window is used rather than a start date FieldQuo invents: reaching back
  // over the whole history of a form would notify a contractor about hundreds
  // of people who enquired years ago and have long since hired somebody.
  const since = form.cursorLeadCreatedAt
    ? Math.floor(new Date(form.cursorLeadCreatedAt).getTime() / 1000)
    : null;

  const res = await listFormLeads({
    pageAccessToken: pageToken.token,
    formId: form.formId,
    sinceUnixSeconds: since,
  });
  if (!res.ok) {
    out.errors.push(`form ${form.formId}: ${res.message}`);
    return out;
  }

  for (const lead of Array.isArray(res.data?.data) ? res.data.data : []) {
    const attribution = await resolveAttribution({ accessToken: userToken, adId: lead?.ad_id });
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
 * The Page's lead forms, as Meta reports them right now — what the settings
 * panel's "refresh" reads so a contractor sees the forms they actually built
 * rather than a list somebody typed.
 *
 * Returns the raw rows; deciding what to store is the route's job.
 */
export async function fetchPageForms({ userToken, pageId, pageTokenCache }) {
  const pageToken = await pageTokenFor({ accessToken: userToken, pageId, cache: pageTokenCache });
  if (!pageToken.ok) return pageToken;
  return listPageLeadForms({ pageAccessToken: pageToken.token, pageId });
}

/** The Pages this connection can see — the picker's list. Tokens are stripped. */
export async function fetchPages({ userToken }) {
  const res = await listPages({ accessToken: userToken });
  if (!res.ok) return res;
  // The access_token on each row NEVER leaves the server. Returning the raw
  // response to a settings screen would hand a browser a working Page
  // credential, which is the kind of leak that only shows up in a log.
  const pages = (Array.isArray(res.data?.data) ? res.data.data : []).map((p) => ({
    id: String(p?.id ?? ""),
    name: p?.name ? String(p.name) : null,
  }));
  return { ok: true, data: pages.filter((p) => p.id) };
}
