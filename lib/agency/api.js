// lib/agency/api.js
//
// What every /api/v1 route does, once the key has named the company
// (lib/agency/apiAuth.js). Each handler takes { db, companyId, key, … } and
// returns { status, body } — the route files are three lines around these,
// and scripts/check-agency-api.mjs calls these directly against an in-memory
// store, two companies deep.
//
// Every lead that leaves here is built by lib/agency/leadRow.js under the
// company's switches as they are at that moment. Nothing here reads a
// company id from the request.

import { buildLeadRow } from "@/lib/agency/leadRow";
import { loadLeadFacts } from "@/lib/agency/leadFacts";
import { loadMarketingResults, parseFilters } from "@/lib/agency/metricsData";
import { resolvePeriod } from "@/lib/agency/periods";
import { resolveRefQuery, isLeadRef } from "@/lib/agency/leadRef";
import { refusal } from "@/lib/agency/apiAuth";
import { EVENTS, eventsForFact, payloadFor } from "@/lib/agency/events";
import { cleanTargetUrl } from "@/lib/agency/delivery";
import { SCOPE_WRITE_LEADS, keyHasScope } from "@/lib/agency/keys";
import { matchContactAgainst } from "@/lib/contacts/matchContact";
import { canSetLeadStatus, isValidLeadStatus, isValidLostReason, LOST_REASONS, LEAD_QUOTE_EVIDENCE_SELECT } from "@/lib/leads/pipeline";
import { cleanTag, cleanClickId, fbcFor } from "@/lib/tracking/attribution";
import { cleanAdParams, compactAd } from "@/lib/tracking/adParams";
import { cleanEmail } from "@/lib/validation";
import { dialable } from "@/lib/leads/callbackRequest";

const DAY = 24 * 60 * 60 * 1000;
/** A lead list call follows leads created this far back. */
export const LIST_LOOKBACK_DAYS = 730;
export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 200;
/** An inbound lead matching one this recent is the same enquiry, not a new one. */
export const DEDUPE_WINDOW_DAYS = 180;
/** How many live hook subscriptions one key may hold. */
export const MAX_SUBSCRIPTIONS_PER_KEY = 50;

const ok = (body, status = 200) => ({ status, body });
const notFound = () => refusal(404, "not_found", "No lead with that reference at this company.");
const bad = (error, code = "invalid_request") => refusal(400, code, error);

/** The company's sharing switches and the facts a row needs. */
export async function companySharing(db, companyId) {
  const c = await db.company.findUnique({
    where: { id: companyId },
    select: { name: true, currency: true, country: true, agencyShareContacts: true, agencyShareMoney: true },
  });
  return {
    name: c?.name || null,
    shareContacts: c?.agencyShareContacts === true,
    shareMoney: c?.agencyShareMoney !== false,
    currency: c?.currency || null,
    country: c?.country || null,
  };
}

const rowOf = (fact, sharing, now) => buildLeadRow(fact, { ...sharing, now });

// ── GET /api/v1/me ──────────────────────────────────────────────────────────
export async function getMe({ db, companyId, key }) {
  const sharing = await companySharing(db, companyId);
  return ok({
    company: { name: sharing.name },
    key: { name: key.name, scopes: key.scopes },
    sharing: { contactDetails: sharing.shareContacts, jobValues: sharing.shareMoney },
    currency: sharing.shareMoney ? sharing.currency : null,
  });
}

// ── GET /api/v1/marketing/metrics and /funnel ───────────────────────────────
async function results({ db, companyId, query, now, deps }) {
  const period = resolvePeriod({ period: query.get("period"), from: query.get("from"), to: query.get("to"), now });
  if (!period.ok) return { refused: bad(period.error) };
  const filters = parseFilters({ source: query.get("source"), campaign: query.get("campaign") });
  if (!filters.ok) return { refused: bad(filters.error) };
  const compareWith = query.get("compare") === "none" ? "none" : "previous";
  const sharing = await companySharing(db, companyId);
  const data = await loadMarketingResults({ db, companyId, range: period, filters, includeMoney: sharing.shareMoney, compareWith, now, deps });
  return { data, sharing };
}

export async function getMetrics({ db, companyId, query, now = new Date(), deps = {} }) {
  const r = await results({ db, companyId, query, now, deps });
  if (r.refused) return r.refused;
  const { funnel, ...rest } = r.data;
  return ok({ ...rest, generatedAt: now.toISOString() });
}

export async function getFunnel({ db, companyId, query, now = new Date(), deps = {} }) {
  const r = await results({ db, companyId, query, now, deps });
  if (r.refused) return r.refused;
  const d = r.data;
  return ok({ period: d.period, previousPeriod: d.previousPeriod, filters: d.filters, funnel: d.funnel, bySource: d.bySource, generatedAt: now.toISOString() });
}

// ── GET /api/v1/marketing/leads ─────────────────────────────────────────────
//
// Ordered by updatedAt then ref, oldest first, so a sync that stores
// `nextCursor` resumes exactly where it stopped. `updatedSince` (an ISO
// instant) narrows to leads that changed since then. `order=newest` returns
// the newest first instead (the Zapier sample's fallback).
const encodeCursor = (u, r) => Buffer.from(JSON.stringify({ u, r }), "utf8").toString("base64url");
function decodeCursor(c) {
  try {
    const v = JSON.parse(Buffer.from(String(c), "base64url").toString("utf8"));
    if (typeof v?.u === "string" && isLeadRef(v.r) && !Number.isNaN(new Date(v.u).getTime())) return v;
  } catch {
    /* fallthrough */
  }
  return null;
}

export async function listLeads({ db, companyId, query, now = new Date() }) {
  const since = query.get("updatedSince");
  const sinceDate = since ? new Date(since) : null;
  if (since && Number.isNaN(sinceDate.getTime())) return bad("updatedSince must be an ISO 8601 instant, e.g. 2026-10-01T00:00:00Z.");
  const cursorRaw = query.get("cursor");
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return bad("That cursor is not one this API issued.");
  const limitRaw = Number(query.get("limit") || PAGE_DEFAULT);
  const limit = Number.isFinite(limitRaw) ? Math.min(PAGE_MAX, Math.max(1, Math.floor(limitRaw))) : PAGE_DEFAULT;
  const newest = query.get("order") === "newest";

  const sharing = await companySharing(db, companyId);
  const { facts, truncated } = await loadLeadFacts({ db, companyId, where: { createdAt: { gte: new Date(now.getTime() - LIST_LOOKBACK_DAYS * DAY) } }, now });
  let list = facts.filter((f) => f.ref && (!sinceDate || (f.updatedAt && f.updatedAt >= sinceDate)));
  const key = (f) => `${f.updatedAt.toISOString()}|${f.ref}`;
  list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  if (newest) list.reverse();
  if (cursor) {
    const at = `${new Date(cursor.u).toISOString()}|${cursor.r}`;
    list = list.filter((f) => (newest ? key(f) < at : key(f) > at));
  }
  const page = list.slice(0, limit);
  const more = list.length > limit;
  const last = page[page.length - 1];
  return ok({
    leads: page.map((f) => rowOf(f, sharing, now)),
    nextCursor: more && last ? encodeCursor(last.updatedAt.toISOString(), last.ref) : null,
    truncated,
  });
}

/** The lead a ref (or an unambiguous "L-7F3A") names, as a fact — or a refusal. */
async function factByRef({ db, companyId, ref, now }) {
  const q = resolveRefQuery(ref);
  if (!q) return { refused: notFound() };
  let lead;
  if (q.ref) {
    lead = await db.leadRequest.findFirst({ where: { companyId, agencyRef: q.ref }, select: { id: true } });
  } else {
    const hits = await db.leadRequest.findMany({ where: { companyId, agencyRef: { endsWith: q.suffix } }, select: { id: true }, take: 2 });
    if (hits.length > 1) return { refused: refusal(409, "ambiguous_ref", "More than one lead ends in those four characters. Use the full reference (lr_…).") };
    lead = hits[0];
  }
  if (!lead) return { refused: notFound() };
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: lead.id }, now });
  return facts[0] ? { fact: facts[0] } : { refused: notFound() };
}

// ── GET /api/v1/marketing/leads/{ref} ───────────────────────────────────────
export async function getLead({ db, companyId, ref, now = new Date() }) {
  const r = await factByRef({ db, companyId, ref, now });
  if (r.refused) return r.refused;
  return ok({ lead: rowOf(r.fact, await companySharing(db, companyId), now) });
}

// ── GET /api/v1/marketing/leads/search?email=&phone= (write scope) ─────────
//
// Matching uses the FULL identifier the agency already holds; the answer is
// the same privacy-safe row as everywhere else. Only "certain" matches — an
// exact email or phone (lib/contacts/matchContact.js), never a name.
export async function findLeadsByContact({ db, companyId, query, now = new Date() }) {
  const email = cleanEmail(query.get("email"));
  const phone = String(query.get("phone") || "").trim();
  if (!email && !dialable(phone)) return bad("Give an email or a phone number to search by.");
  const leads = await db.leadRequest.findMany({
    where: { companyId },
    select: { id: true, companyId: true, name: true, email: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const contact = { email: email || null, phone: dialable(phone) ? phone : null };
  const hits = [];
  // matchContactAgainst returns the single best; walk until none is left so
  // a person with three enquiries gets all three.
  let pool = leads;
  for (let i = 0; i < 20; i++) {
    const m = matchContactAgainst({ clients: pool, companyId, contact, minConfidence: "certain", onTie: "oldest" });
    if (!m.clientId || m.confidence !== "certain") break;
    hits.push(m.clientId);
    pool = pool.filter((l) => l.id !== m.clientId);
  }
  if (!hits.length) return ok({ leads: [] });
  const sharing = await companySharing(db, companyId);
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: { in: hits } }, now });
  return ok({ leads: facts.map((f) => rowOf(f, sharing, now)) });
}

// ── POST /api/v1/marketing/leads (write scope) ──────────────────────────────
function cleanInboundLead(body, now) {
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const str = (v, max) => (typeof v === "string" ? v.normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
  const first = str(b.firstName, 60);
  const last = str(b.lastName, 60);
  const name = str(b.name, 120) || [first, last].filter(Boolean).join(" ");
  const email = b.email ? cleanEmail(b.email) : null;
  if (b.email && !email) return { error: "That email address can't receive mail." };
  const phone = str(b.phone, 40);
  if (phone && !dialable(phone)) return { error: "That phone number has too few digits." };
  if (!email && !phone) return { error: "A lead needs an email or a phone number." };
  if (!name) return { error: "A lead needs a name." };

  let requestedVisit = null;
  if (b.requestedVisitFrom || b.requestedVisitTo) {
    const v = cleanVisitWindow({ from: b.requestedVisitFrom, to: b.requestedVisitTo }, now);
    if (v.error) return { error: v.error };
    requestedVisit = v.window;
  }

  const fbclid = cleanClickId(b.fbclid);
  const gclid = cleanClickId(b.gclid);
  const ad = cleanAdParams({
    utm_source: b.utmSource ?? b.utm_source,
    utm_medium: b.utmMedium ?? b.utm_medium,
    utm_campaign: b.utmCampaign ?? b.utm_campaign,
    utm_content: b.utmContent ?? b.utm_content,
    utm_term: b.utmTerm ?? b.utm_term,
    campaign_id: b.campaignId ?? b.campaign_id,
    campaign_name: b.campaignName ?? b.campaign_name,
    adset_id: b.adsetId ?? b.adset_id,
    adset_name: b.adsetName ?? b.adset_name,
    ad_id: b.adId ?? b.ad_id,
    ad_name: b.adName ?? b.ad_name,
    fbclid: fbclid || undefined,
  });
  // The agency's own statement of where the lead came from, cleaned by the
  // same functions that clean a landing (lib/tracking/attribution.js) — the
  // ONE place an attribution is written from a request body, because here
  // the body is an authenticated party's, scoped by its key.
  const attribution = {
    source: "agency_funnel",
    ...(cleanTag(b.utmSource ?? b.utm_source) && { utmSource: cleanTag(b.utmSource ?? b.utm_source) }),
    ...(cleanTag(b.utmMedium ?? b.utm_medium) && { utmMedium: cleanTag(b.utmMedium ?? b.utm_medium) }),
    ...(cleanTag(b.utmCampaign ?? b.utm_campaign) && { utmCampaign: cleanTag(b.utmCampaign ?? b.utm_campaign) }),
    ...(cleanTag(b.utmContent ?? b.utm_content) && { utmContent: cleanTag(b.utmContent ?? b.utm_content) }),
    ...(cleanTag(b.utmTerm ?? b.utm_term) && { utmTerm: cleanTag(b.utmTerm ?? b.utm_term) }),
    ...(gclid ? { clickNetwork: "google_ads", gclid } : fbclid ? { clickNetwork: "facebook" } : {}),
    ...(fbclid && { fbc: fbcFor(fbclid, now.getTime()) }),
    ...(compactAd(ad) && { ad: compactAd(ad) }),
    landedAt: now.toISOString(),
  };

  const service = str(b.service, 120);
  const postalCode = str(b.postalCode, 12);
  const address = str(b.address, 300);
  const message = str(b.message, 2000);
  const intake = {
    ...(service && { service }),
    ...(postalCode && { postalCode }),
    ...(address && { address }),
    ...(requestedVisit && { requestedVisit: { from: requestedVisit.from.toISOString(), to: requestedVisit.to.toISOString(), setBy: "agency" } }),
    capturedBy: "agency_funnel",
  };
  return {
    lead: {
      name,
      email,
      phone: phone || null,
      message: [message, service ? `Service: ${service}` : null].filter(Boolean).join("\n\n") || null,
      budgetBand: typeof b.budgetBand === "string" ? b.budgetBand : undefined,
      timeline: typeof b.timeline === "string" ? b.timeline : undefined,
      intake,
      attribution,
    },
  };
}

/**
 * @param deps.createLead  lib/leads/createLead.js createScoredLead — injected
 *                         so the check can run it against its own store
 */
export async function createAgencyLead({ db, companyId, key, body, now = new Date(), deps = {} }) {
  const cleaned = cleanInboundLead(body, now);
  if (cleaned.error) return bad(cleaned.error);
  const { lead } = cleaned;

  // ── Deduplicate: a recent lead with the same email or phone ──────────────
  const recent = await db.leadRequest.findMany({
    where: { companyId, createdAt: { gte: new Date(now.getTime() - DEDUPE_WINDOW_DAYS * DAY) } },
    select: { id: true, companyId: true, name: true, email: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  const contact = { email: lead.email, phone: lead.phone };
  const dupe = matchContactAgainst({ clients: recent, companyId, contact, minConfidence: "certain", onTie: "oldest" });
  const sharing = await companySharing(db, companyId);
  if (dupe.clientId && dupe.confidence === "certain") {
    const { facts } = await loadLeadFacts({ db, companyId, where: { id: dupe.clientId }, now });
    return ok({ created: false, duplicate: true, matchedOn: dupe.reasons.filter((r) => r === "email" || r === "phone"), lead: facts[0] ? rowOf(facts[0], sharing, now) : null }, 200);
  }
  // An existing client is still a new enquiry — converting the lead finds
  // that client by the same email or phone (lib/leads/convertLead.js), so no
  // second client is made. Said in the answer, so the agency knows.
  const clients = await db.client.findMany({
    where: { companyId, OR: [...(lead.email ? [{ email: lead.email }] : []), ...(lead.phone ? [{ phone: lead.phone }] : [])] },
    select: { id: true, companyId: true, name: true, email: true, phone: true, address: true, city: true, province: true, country: true, language: true, createdAt: true },
    take: 20,
  });
  const client = clients.length ? matchContactAgainst({ clients, companyId, contact, minConfidence: "certain", onTie: "oldest" }) : null;

  const create = deps.createLead || (await import("@/lib/leads/createLead")).createScoredLead;
  const created = await create({ companyId, source: "agency_funnel", ...lead });
  await recordAgencyActivity(db, { companyId, key, action: "lead.created_by_agency", entityId: created.id, summary: `${key.name} added a lead from its own funnel`, metadata: { keyId: key.id } });
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: created.id }, now });
  return ok({ created: true, duplicate: false, existingClient: Boolean(client?.clientId && client.confidence === "certain"), lead: facts[0] ? rowOf(facts[0], sharing, now) : null }, 201);
}

/** An activity-log row naming the agency key as the actor. Never throws. */
export async function recordAgencyActivity(db, { companyId, key, action, entityId, summary, metadata = {} }) {
  try {
    await db.activityLog.create({
      data: {
        companyId,
        actorName: `Marketing agency: ${key?.name || "key"}`,
        actorRole: "agency_key",
        action,
        entityType: "lead",
        entityId,
        summary,
        metadata: { ...metadata, keyId: key?.id || null },
      },
    });
  } catch (err) {
    console.error("[agency-api] activity log failed:", err?.message);
  }
}

// ── POST /api/v1/marketing/leads/{ref}/stage (write scope) ─────────────────
//
// "Move lead to stage" — the pipeline's own transitions and nothing else:
// lib/leads/pipeline.js canSetLeadStatus is the rule the board and the drawer
// obey, so Won still needs an accepted quote or work behind it, and Lost
// still needs a reason from the closed list.
export async function moveLeadStage({ db, companyId, key, ref, body, now = new Date(), deps = {} }) {
  const q = resolveRefQuery(ref);
  if (!q?.ref) return q ? refusal(400, "full_ref_required", "Moving a lead needs its full reference (lr_…).") : notFound();
  const stageRaw = typeof body?.stage === "string" ? body.stage.trim() : "";
  const stage = stageRaw === "won" ? "converted" : stageRaw;
  if (!isValidLeadStatus(stage)) return bad(`stage must be one of: new, contacted, won (or converted), lost.`);
  const lostReason = body?.lostReason ?? undefined;
  if (lostReason !== undefined && lostReason !== null && !isValidLostReason(lostReason)) {
    return bad(`lostReason must be one of: ${LOST_REASONS.join(", ")}.`);
  }
  const lead = await db.leadRequest.findFirst({
    where: { companyId, agencyRef: q.ref },
    select: { id: true, status: true, quoteId: true, lostReason: true, quote: { select: LEAD_QUOTE_EVIDENCE_SELECT } },
  });
  if (!lead) return notFound();
  const check = canSetLeadStatus(lead, stage, { lostReason });
  if (!check.ok) return refusal(409, check.code || "transition_refused", check.reason);
  if (lead.status !== stage || (stage === "lost" && lostReason && lostReason !== lead.lostReason)) {
    await db.leadRequest.update({
      where: { id: lead.id },
      data: { status: stage, lostReason: stage === "lost" ? lostReason ?? lead.lostReason : null },
    });
    await recordAgencyActivity(db, { companyId, key, action: "lead.stage_set_by_agency", entityId: lead.id, summary: `${key.name} moved the lead from ${lead.status} to ${stage}`, metadata: { from: lead.status, to: stage } });
    (deps.nudge || (await import("@/lib/agency/nudge")).nudgeAgencyEvents)(companyId);
  }
  const sharing = await companySharing(db, companyId);
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: lead.id }, now });
  return ok({ lead: facts[0] ? rowOf(facts[0], sharing, now) : null });
}

// ── POST /api/v1/marketing/leads/{ref}/requested-visit (write scope) ───────
//
// "Update appointment request" — the window the visit is ASKED for, stored on
// the lead (intake.requestedVisit, shown on the lead drawer). It never
// touches an Appointment: a booked visit's time, crew and assignee are the
// company's, so once a visit is booked this answers 409.
export function cleanVisitWindow({ from, to }, now = new Date()) {
  const f = new Date(from);
  const t = new Date(to);
  if (!from || !to || Number.isNaN(f.getTime()) || Number.isNaN(t.getTime()) || !String(from).includes("T") || !String(to).includes("T")) {
    return { error: "requestedVisitFrom and requestedVisitTo must be ISO 8601 instants." };
  }
  if (t <= f) return { error: "The window must end after it starts." };
  if (f.getTime() < now.getTime() - 60 * 60 * 1000) return { error: "The window must not start in the past." };
  if (f.getTime() > now.getTime() + 365 * DAY) return { error: "The window must start within a year." };
  if (t.getTime() - f.getTime() > 14 * DAY) return { error: "The window can be at most 14 days long." };
  return { window: { from: f, to: t } };
}

export async function updateRequestedVisit({ db, companyId, key, ref, body, now = new Date(), deps = {} }) {
  const q = resolveRefQuery(ref);
  if (!q?.ref) return q ? refusal(400, "full_ref_required", "Updating a lead needs its full reference (lr_…).") : notFound();
  const v = cleanVisitWindow({ from: body?.from ?? body?.requestedVisitFrom, to: body?.to ?? body?.requestedVisitTo }, now);
  if (v.error) return bad(v.error);
  const lead = await db.leadRequest.findFirst({ where: { companyId, agencyRef: q.ref }, select: { id: true, intake: true } });
  if (!lead) return notFound();
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: lead.id }, now });
  const fact = facts[0];
  if (fact?.appointment && fact.appointment.status !== "cancelled") {
    return refusal(409, "visit_already_booked", "A visit is already booked for this lead. The company changes booked visits; ask them.");
  }
  const intake = lead.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? lead.intake : {};
  await db.leadRequest.update({
    where: { id: lead.id },
    data: { intake: { ...intake, requestedVisit: { from: v.window.from.toISOString(), to: v.window.to.toISOString(), setBy: "agency", at: now.toISOString() } } },
  });
  await recordAgencyActivity(db, { companyId, key, action: "lead.visit_window_set_by_agency", entityId: lead.id, summary: `${key.name} asked for a visit between ${v.window.from.toISOString()} and ${v.window.to.toISOString()}`, metadata: { from: v.window.from.toISOString(), to: v.window.to.toISOString() } });
  (deps.nudge || (await import("@/lib/agency/nudge")).nudgeAgencyEvents)(companyId);
  const again = await loadLeadFacts({ db, companyId, where: { id: lead.id }, now });
  return ok({ lead: again.facts[0] ? rowOf(again.facts[0], await companySharing(db, companyId), now) : null });
}

// ── POST /api/v1/hooks/subscribe · DELETE /api/v1/hooks/{id} ────────────────
export async function subscribeHook({ db, companyId, key, body, now = new Date() }) {
  const event = typeof body?.event === "string" ? body.event.trim() : "";
  if (!EVENTS.includes(event)) return bad(`event must be one of: ${EVENTS.join(", ")}.`);
  const targetUrl = cleanTargetUrl(body?.targetUrl ?? body?.target_url ?? body?.hookUrl);
  if (!targetUrl) return bad("targetUrl must be a public https URL.");
  const live = await db.agencyHookSubscription.count({ where: { keyId: key.id, endedAt: null } });
  if (live >= MAX_SUBSCRIPTIONS_PER_KEY) return refusal(409, "too_many_subscriptions", `A key may hold at most ${MAX_SUBSCRIPTIONS_PER_KEY} live subscriptions.`);
  const sub = await db.agencyHookSubscription.create({
    data: { companyId, keyId: key.id, event, targetUrl, createdAt: now },
    select: { id: true, event: true, targetUrl: true, createdAt: true },
  });
  return ok({ id: sub.id, event: sub.event, targetUrl: sub.targetUrl, createdAt: new Date(sub.createdAt).toISOString() }, 201);
}

export async function unsubscribeHook({ db, companyId, key, id, now = new Date() }) {
  // Scoped by the key's company AND the key itself: an agency cannot end a
  // subscription another agency (another key) made at the same company.
  const res = await db.agencyHookSubscription.updateMany({
    where: { id: String(id || ""), companyId, keyId: key.id, endedAt: null },
    data: { endedAt: now, endedReason: "unsubscribed" },
  });
  if (!res.count) {
    const ended = await db.agencyHookSubscription.findFirst({ where: { id: String(id || ""), companyId, keyId: key.id }, select: { id: true } });
    if (!ended) return refusal(404, "not_found", "No subscription with that id for this key.");
  }
  await db.agencyHookDelivery.updateMany({ where: { subscriptionId: String(id), status: "pending" }, data: { status: "cancelled", lastError: "unsubscribed" } });
  return ok({ id: String(id), ended: true });
}

// ── GET /api/v1/hooks/samples/{event} — Zapier's perform-list fallback ─────
//
// The latest real events of that type at this company, as a hook would have
// delivered them; when there are none yet, the events the most recent leads'
// current state implies, built the same way. Never invented data.
export async function hookSamples({ db, companyId, event, query, now = new Date() }) {
  if (!EVENTS.includes(event)) return refusal(404, "not_found", `No event called "${event}". Events: ${EVENTS.join(", ")}.`);
  const limit = Math.min(10, Math.max(1, Number(query?.get?.("limit")) || 3));
  const sharing = await companySharing(db, companyId);
  const stored = await db.agencyEvent.findMany({
    where: { companyId, event },
    select: { id: true, event: true, leadId: true, occurredAt: true, facts: true },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  let items = stored;
  if (!items.length && event !== "lead.stage_changed") {
    const { facts } = await loadLeadFacts({ db, companyId, where: {}, now, take: 25 });
    items = facts
      .flatMap((f) => eventsForFact(f, now).filter((e) => e.event === event).map((e) => ({ id: `sample_${e.dedupeKey}`, event: e.event, leadId: f.id, occurredAt: e.occurredAt, facts: e.facts })))
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit);
  }
  if (!items.length) return ok([]);
  const { facts } = await loadLeadFacts({ db, companyId, where: { id: { in: [...new Set(items.map((i) => i.leadId))] } }, now });
  const byId = new Map(facts.map((f) => [f.id, f]));
  return ok(items.filter((i) => byId.has(i.leadId)).map((i) => payloadFor(i, rowOf(byId.get(i.leadId), sharing, now), sharing)));
}

/** Does this key carry the write scope? Re-exported for the routes' docs. */
export const canWriteLeads = (key) => keyHasScope(key, SCOPE_WRITE_LEADS);
