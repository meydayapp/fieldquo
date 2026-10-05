// lib/meta/capi/capture.js
//
// The three Conversions API events the sweep (lib/meta/capi/sweep.js) cannot
// derive later, written at the moment they happen:
//
//   1. A lead-form lead DELETED as "not a lead". The row is gone afterwards,
//      so the Disqualified stage has to be queued from what the delete knew.
//   2. A website Lead (funnel or instant estimate) from an ad click.
//   3. A website booking from an ad click.
//
// (2) and (3) need the visitor's user agent — Meta requires it on every
// website event — and it exists only in the request that submitted the form.
// It is stored nowhere else in FieldQuo, and stored here only when the
// company's switch is on and the visit came from a Meta ad click (an _fbc).
//
// Every function here is best-effort by contract: it never throws, and its
// caller runs it after the response (next/server `after`) or after the
// transaction, so a slow database or a missing settings row can never block
// or fail the contractor's action or the homeowner's form.
import { recordError } from "@/lib/platform/errorLog";
import { clientIp } from "@/lib/rateLimit";
import { hashedContact } from "./hash";
import { crmEvent, websiteEvent, cleanMetaLeadId, STAGE_WINDOW_DAYS } from "./events";
import { capiReadiness, kindReady } from "./settings";
import { enqueueEvents } from "./outbox";

const DAY_MS = 24 * 60 * 60 * 1000;

async function readyFor(prisma, companyId, kind) {
  const settings = await prisma.metaConversionSettings.findUnique({ where: { companyId } });
  if (!settings?.enabled) return null;
  const readiness = capiReadiness({ settings, pageConnection: null });
  return kindReady(readiness, kind) ? settings : null;
}

/**
 * Queue Disqualified for every Meta lead id a "not a lead" delete removed.
 * `leads` is deleteLeads' own list: [{ id, createdAt, metaLeadIds: [] }].
 * Contact details are not sent — the lead id is Meta's best key, and the row
 * they lived on was just deleted at the company's request.
 */
export async function captureDeletedNotALead(prisma, { companyId, leads = [], now = new Date() }) {
  try {
    if (!companyId || !leads.length) return { queued: 0 };
    if (!(await readyFor(prisma, companyId, "crm"))) return { queued: 0 };
    const rows = [];
    for (const l of leads) {
      const born = new Date(l.createdAt);
      if (!Number.isFinite(born.getTime()) || now.getTime() - born.getTime() > STAGE_WINDOW_DAYS * DAY_MS) continue;
      for (const id of l.metaLeadIds || []) {
        const lid = cleanMetaLeadId(id);
        if (!lid) continue;
        // One lead row can carry more than one Meta lead (a second form
        // submission folded in): each is keyed by its own Meta id.
        const key = (l.metaLeadIds.length > 1 ? `${l.id}~${lid}` : l.id);
        const payload = crmEvent({ leadId: key, metaLeadId: lid, stage: "disqualified", at: now });
        if (payload) rows.push({ kind: "crm", stage: "disqualified", eventName: payload.event_name, eventId: payload.event_id, leadId: l.id, eventTime: now, payload });
      }
    }
    return await enqueueEvents(prisma, companyId, rows, { now });
  } catch (err) {
    await recordError({ area: "meta_capi", code: "capture_delete", companyId, message: `Send lead results to Meta: could not queue Disqualified on delete — ${err?.message}` });
    return { queued: 0 };
  }
}

/**
 * The page the event happened on: the browser's Referer when it sent one
 * (Meta wants the page URL), else the site's origin. Never a query string —
 * a funnel URL can carry utm_* and click ids, and Meta has the click id in fbc
 * already.
 */
export function eventSourceUrl(request) {
  const ref = request?.headers?.get?.("referer");
  try {
    if (ref) {
      const u = new URL(ref);
      return `${u.origin}${u.pathname}`;
    }
  } catch {
    /* a malformed Referer falls through to the origin */
  }
  try {
    const u = new URL(request?.url);
    return `${u.origin}/`;
  } catch {
    return null;
  }
}

function browserFacts(request) {
  const ua = request?.headers?.get?.("user-agent") || null;
  let ip = null;
  try {
    ip = clientIp(request);
  } catch {
    ip = null;
  }
  if (ip === "unknown") ip = null;
  return { userAgent: ua, ip, url: eventSourceUrl(request) };
}

/**
 * The website Lead for a lead a public form just created. Queued only when:
 * the switch is on and the dataset is ready; the lead's visit carried a Meta
 * click (attribution.fbc); the page's Meta pixel IS the dataset the switch
 * sends to (otherwise there is no browser event to de-duplicate against and
 * the event would land on a different pixel's numbers); and the company does
 * not ask visitors for consent first — FieldQuo cannot see a visitor's answer
 * server-side, so a company that requires consent gets no server events from
 * its pages at all rather than events for visitors who said no.
 *
 * event_id is the lead id: the same id FunnelRunner / InstantQuoteFlow pass
 * as the pixel's eventID, so Meta counts the pair once.
 */
export async function captureWebsiteLead(prisma, { companyId, leadId, pixelId = null, request, now = new Date() }) {
  try {
    if (!companyId || !leadId) return { queued: 0, reason: "missing" };
    const settings = await readyFor(prisma, companyId, "website");
    if (!settings) return { queued: 0, reason: "not_ready" };
    const [lead, company] = await Promise.all([
      prisma.leadRequest.findFirst({
        where: { id: leadId, companyId },
        select: { id: true, email: true, phone: true, createdAt: true, attribution: true },
      }),
      prisma.company.findUnique({ where: { id: companyId }, select: { country: true, pixelConsentRequired: true, metaPixelId: true } }),
    ]);
    if (!lead) return { queued: 0, reason: "no_lead" };
    if (company?.pixelConsentRequired) return { queued: 0, reason: "consent_required" };
    const fbc = lead.attribution && typeof lead.attribution === "object" ? lead.attribution.fbc : null;
    if (!fbc) return { queued: 0, reason: "no_click" };
    const pagePixel = pixelId || company?.metaPixelId || null;
    if (!pagePixel || String(pagePixel) !== String(settings.datasetId)) return { queued: 0, reason: "different_pixel" };
    const facts = browserFacts(request);
    const payload = websiteEvent({
      eventId: lead.id,
      stage: "lead",
      at: now,
      eventSourceUrl: facts.url,
      userAgent: facts.userAgent,
      ip: facts.ip,
      fbc,
      contact: hashedContact({ email: lead.email, phone: lead.phone, country: company?.country }),
    });
    if (!payload) return { queued: 0, reason: "no_user_agent" };
    return await enqueueEvents(prisma, companyId, [{ kind: "website", stage: "lead", eventName: payload.event_name, eventId: payload.event_id, leadId: lead.id, eventTime: now, payload }], { now });
  } catch (err) {
    await recordError({ area: "meta_capi", code: "capture_website_lead", companyId, message: `Send lead results to Meta: could not queue a website Lead — ${err?.message}`, detail: { leadId } });
    return { queued: 0, reason: "error" };
  }
}

/**
 * The website Schedule for a booking confirmed from an ad-click visit. The
 * visit is the one the booking page linked (FunnelVisit.bookingId); its fbc
 * is the click. event_id is the booking id — the id InstantQuoteFlow passes
 * as the pixel's eventID on the estimate's embedded booking.
 */
export async function captureWebsiteBooking(prisma, { companyId, bookingId, request, now = new Date() }) {
  try {
    if (!companyId || !bookingId) return { queued: 0, reason: "missing" };
    const settings = await readyFor(prisma, companyId, "website");
    if (!settings) return { queued: 0, reason: "not_ready" };
    const [visit, booking, company] = await Promise.all([
      prisma.funnelVisit.findFirst({ where: { companyId, bookingId }, select: { fbc: true } }),
      prisma.booking.findFirst({
        where: { id: bookingId, eventType: { companyId } },
        select: { id: true, clientEmail: true, clientPhone: true, status: true },
      }),
      prisma.company.findUnique({ where: { id: companyId }, select: { country: true, pixelConsentRequired: true, metaPixelId: true } }),
    ]);
    if (!booking || !["confirmed", "completed"].includes(booking.status)) return { queued: 0, reason: "not_confirmed" };
    if (company?.pixelConsentRequired) return { queued: 0, reason: "consent_required" };
    if (!visit?.fbc) return { queued: 0, reason: "no_click" };
    if (!company?.metaPixelId || String(company.metaPixelId) !== String(settings.datasetId)) return { queued: 0, reason: "different_pixel" };
    const facts = browserFacts(request);
    const payload = websiteEvent({
      eventId: booking.id,
      stage: "schedule",
      at: now,
      eventSourceUrl: facts.url,
      userAgent: facts.userAgent,
      ip: facts.ip,
      fbc: visit.fbc,
      contact: hashedContact({ email: booking.clientEmail, phone: booking.clientPhone, country: company?.country }),
    });
    if (!payload) return { queued: 0, reason: "no_user_agent" };
    return await enqueueEvents(prisma, companyId, [{ kind: "website", stage: "schedule", eventName: payload.event_name, eventId: payload.event_id, eventTime: now, payload }], { now });
  } catch (err) {
    await recordError({ area: "meta_capi", code: "capture_website_booking", companyId, message: `Send lead results to Meta: could not queue a website Schedule — ${err?.message}`, detail: { bookingId } });
    return { queued: 0, reason: "error" };
  }
}
