// lib/tracking/campaignReport.js
//
// A company's own ads, campaign ▸ ad set ▸ ad, measured on its own pages:
// how many visits each one brought, how many started a request and stopped,
// how many sent one, booked a visit, were quoted, said yes — and what those
// yeses were worth. The section "Your ad campaigns" on Leads › Visits &
// unfinished (app/api/leads/traffic/route.js fetches, this file counts).
//
// Pure: no database, no clock of its own. scripts/check-ad-tracking.mjs runs
// it against hostile fixtures.
//
// ══ First touch, and what each number is ═══════════════════════════════════
//
// Every number is credited to the ad on the LANDING that brought the
// visitor — the visit's own parameters, or, for a page reached from the
// company's own site, the first page's (FunnelVisit.firstVisitId). A lead
// carries that landing in LeadRequest.attribution, copied from the server's
// visit row when it was created, so the lead half of the table needs no
// visit at all.
//
//   visits      landings in the period — a visit that inherited its landing
//               is the same arrival and is not counted again
//   partials    unfinished requests still inside their window
//               (lib/tracking/partial.js): contact details typed, not sent
//   leads       LeadRequests created in the period with an attribution
//   booked      bookings made on the booking page from a visit in the
//               period, plus bookings on a lead's own quote (the instant
//               estimate's "book a visit") — confirmed or completed only,
//               each booking once
//   quotesSent  those leads whose quote was sent
//   quotesWon   … accepted
//   revenueWon  the accepted amount of those quotes (acceptedTotal, else
//               total), in the company's currency
//
// Leads are counted by the day they arrived; what became of them is
// followed to today, so a lead from last month's campaign that signs this
// week counts where it came from. Nothing here is Meta's number: Meta's own
// spend and lead-form counts are on Marketing › Spend.

import { groupAdRows } from "./adParams";
import { adIdentityOf } from "./attribution";
import { partialExpired } from "./partial";

export const CAMPAIGN_METRICS = Object.freeze(["visits", "partials", "leads", "booked", "quotesSent", "quotesWon", "revenueWon"]);

/** Booking statuses that are a booked visit; an unpaid hold or a cancellation is not. */
export const BOOKED_STATUSES = Object.freeze(["confirmed", "completed"]);

function identityFields(ad) {
  return {
    campaignId: ad.campaignId || null,
    campaignName: ad.campaignName || null,
    adsetId: ad.adsetId || null,
    adsetName: ad.adsetName || null,
    adId: ad.adId || null,
    adName: ad.adName || null,
  };
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * @param visits    FunnelVisit rows started in the period: { id, ad?,
 *                  utmSource, utmCampaign, utmContent, utmTerm,
 *                  firstVisitId?, bookingId?, contactAt, completedAt,
 *                  partialExpiredAt }
 * @param leads     LeadRequest rows created in the period that carry an
 *                  attribution: { id, attribution, quoteId }
 * @param quotes    the leads' quotes: { id, status, sentAt, acceptedAt,
 *                  total, acceptedTotal }
 * @param bookings  confirmed/completed bookings that the visits link or the
 *                  quotes carry: { id, quoteId, status }
 * @param now       the clock partials are measured against
 * @returns groupAdRows' { campaigns, untagged } over CAMPAIGN_METRICS
 */
export function buildCampaignReport({ visits = [], leads = [], quotes = [], bookings = [], now = new Date() } = {}) {
  const bookingById = new Map();
  const bookingsByQuote = new Map();
  for (const b of Array.isArray(bookings) ? bookings : []) {
    if (!b?.id || !BOOKED_STATUSES.includes(b.status)) continue;
    bookingById.set(b.id, b);
    if (b.quoteId) {
      if (!bookingsByQuote.has(b.quoteId)) bookingsByQuote.set(b.quoteId, []);
      bookingsByQuote.get(b.quoteId).push(b.id);
    }
  }
  const quoteById = new Map((Array.isArray(quotes) ? quotes : []).filter((q) => q?.id).map((q) => [q.id, q]));
  const counted = new Set();
  const rows = [];

  for (const v of Array.isArray(visits) ? visits : []) {
    if (!v) continue;
    const booked = v.bookingId && bookingById.has(v.bookingId) && !counted.has(v.bookingId) ? 1 : 0;
    if (booked) counted.add(v.bookingId);
    const live = Boolean(v.contactAt) && !v.completedAt && !partialExpired(v, now);
    rows.push({
      ...identityFields(adIdentityOf(v)),
      metrics: { visits: v.firstVisitId ? 0 : 1, partials: live ? 1 : 0, booked },
    });
  }

  for (const l of Array.isArray(leads) ? leads : []) {
    if (!l || !l.attribution || typeof l.attribution !== "object") continue;
    const q = l.quoteId ? quoteById.get(l.quoteId) : null;
    let booked = 0;
    for (const id of (q && bookingsByQuote.get(q.id)) || []) {
      if (counted.has(id)) continue;
      counted.add(id);
      booked += 1;
    }
    const sent = Boolean(q && (q.sentAt || q.status === "sent" || q.status === "accepted" || q.status === "declined"));
    const won = Boolean(q && (q.acceptedAt || q.status === "accepted"));
    rows.push({
      ...identityFields(adIdentityOf(l.attribution)),
      metrics: {
        leads: 1,
        booked,
        quotesSent: sent ? 1 : 0,
        quotesWon: won ? 1 : 0,
        revenueWon: won ? money(q.acceptedTotal ?? q.total) : 0,
      },
    });
  }

  const report = groupAdRows(rows, CAMPAIGN_METRICS, { sortKey: "visits" });
  // Cents, not float dust: 0.1 + 0.2 summed across a campaign's leads.
  const round = (node) => {
    node.metrics.revenueWon = Math.round((node.metrics.revenueWon || 0) * 100) / 100;
    (node.adsets || []).forEach(round);
    (node.ads || []).forEach(round);
  };
  report.campaigns.forEach(round);
  report.untagged.metrics.revenueWon = Math.round((report.untagged.metrics.revenueWon || 0) * 100) / 100;
  return report;
}

/** Hide what this reader may not see: null is "not shown", never 0. */
export function redactCampaignReport(report, { quotes = true, money = true } = {}) {
  const strip = (m) => ({
    ...m,
    ...(quotes ? {} : { quotesSent: null, quotesWon: null }),
    ...(quotes && money ? {} : { revenueWon: null }),
  });
  const walk = (n) => ({
    ...n,
    metrics: strip(n.metrics),
    ...(n.adsets ? { adsets: n.adsets.map(walk) } : {}),
    ...(n.ads ? { ads: n.ads.map(walk) } : {}),
  });
  return { campaigns: report.campaigns.map(walk), untagged: { ...report.untagged, metrics: strip(report.untagged.metrics) } };
}
