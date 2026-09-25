// app/api/leads/traffic/route.js
//
// The company's own report on its instant estimate, lead funnels, booking
// page and website: visits, how far they got, where they came from, which of
// its ad campaigns brought them and what those became, and the people who
// typed contact details and stopped. Counted from FunnelVisit rows
// (lib/tracking/) — first party, no ad platform in the loop, so the number
// is the same whether or not the visitor blocked a pixel.
//
// ── Who may read it ────────────────────────────────────────────────────────
//
// The same rung as the leads board (requests: view_only), because the partial
// list is lead-shaped: a name and a number somebody typed about a job. The
// contact fields are then removed for a member below clientsProperties
// full_view — the same second filter redactLead applies to a lead — and the
// row says so rather than rendering blanks.
//
// The campaign table follows those leads into quotes and money, so it takes
// the gates those screens take: quotes sent / won need quotes view_only (the
// quotes list's own floor), and revenue won needs that AND the showPricing
// toggle — the switch that removes money from everything a member reads,
// and the one every analytics screen checks (app/api/analytics/*). A hidden
// figure is sent as null with a flag, never as 0, and the page says why.
//
// ── The one write ──────────────────────────────────────────────────────────
//
// Partials older than PARTIAL_EXPIRE_DAYS are FLAGGED expired here, lazily,
// rather than by a cron: a scheduled job would be a function invocation a day
// per deployment to set a flag that only matters when someone opens this
// screen. The read filters by date as well, so a failed flag write hides
// nothing it should show. Skipped under impersonation — the platform console
// reads and never writes (non-negotiable #3).
//
// ── Before the new columns exist ───────────────────────────────────────────
//
// FunnelVisit.ad / firstVisitId / bookingId are additive and applied by hand
// after deploy (lib/tracking/visits.js explains). Until then the visit read
// is retried without them: campaigns are grouped from the utm_* columns, no
// visit counts as inherited, and bookings are counted from quotes only.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasLevel, hasToggle } from "@/lib/permissions/enforce";
import { countSteps, reportSteps, SUBMITTED } from "@/lib/tracking/funnelSteps";
import { livePartialWhere, stalePartialWhere, PARTIAL_EXPIRE_DAYS } from "@/lib/tracking/partial";
import { isMissingColumn } from "@/lib/tracking/visits";
import { BOOKED_STATUSES, buildCampaignReport, redactCampaignReport } from "@/lib/tracking/campaignReport";
import { decodeAdValue } from "@/lib/tracking/adParams";

const RANGES = new Set([7, 30, 90]);
const MAX_ROWS = 50000;

/** The words a funnel step is known by in its own builder. */
function stepLabel(step) {
  const text = step?.question || step?.headline || "";
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 80) : null;
}

const VISIT_SELECT = {
  id: true,
  surface: true,
  funnelId: true,
  stepRank: true,
  completedAt: true,
  source: true,
  utmSource: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
  contactAt: true,
  partialExpiredAt: true,
};

async function readVisits(companyId, since) {
  const where = { companyId, startedAt: { gte: since } };
  try {
    const rows = await db.funnelVisit.findMany({
      where,
      select: { ...VISIT_SELECT, ad: true, firstVisitId: true, bookingId: true },
      take: MAX_ROWS,
    });
    return { rows, detail: true };
  } catch (err) {
    if (!isMissingColumn(err)) throw err;
    const rows = await db.funnelVisit.findMany({ where, select: VISIT_SELECT, take: MAX_ROWS });
    return { rows, detail: false };
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "requests", "view_only", "see requests");
  if (denied) return denied;

  const days = Number(new URL(request.url).searchParams.get("days"));
  const range = RANGES.has(days) ? days : 30;
  const now = new Date();
  const since = new Date(now.getTime() - range * 24 * 60 * 60 * 1000);
  const companyId = member.companyId;

  if (!member.impersonation) {
    await db.funnelVisit
      .updateMany({ where: stalePartialWhere(companyId, now), data: { partialExpiredAt: now } })
      .catch((err) => console.error("[leads/traffic] partial expiry not flagged:", err?.message));
  }

  const [{ rows: visits, detail }, funnels, partials, leads, company] = await Promise.all([
    readVisits(companyId, since),
    db.funnel.findMany({
      where: { companyId },
      select: { id: true, name: true, slug: true, status: true, steps: true },
      orderBy: { createdAt: "asc" },
    }),
    db.funnelVisit.findMany({
      where: livePartialWhere(companyId, now),
      select: {
        id: true,
        surface: true,
        funnelId: true,
        trade: true,
        stepKey: true,
        source: true,
        utmCampaign: true,
        contactName: true,
        contactEmail: true,
        contactPhone: true,
        contactAt: true,
        lastSeenAt: true,
      },
      orderBy: { contactAt: "desc" },
      take: 200,
    }),
    // Leads that arrived in the period carrying a landing (every funnel,
    // instant-estimate and website-sourced request since tracking began).
    db.leadRequest.findMany({
      where: { companyId, createdAt: { gte: since }, attribution: { not: Prisma.DbNull } },
      select: { id: true, attribution: true, quoteId: true },
      take: MAX_ROWS,
    }),
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
  ]);

  // ── What those leads and visits became ───────────────────────────────────
  const quoteIds = [...new Set(leads.map((l) => l.quoteId).filter(Boolean))];
  const visitBookingIds = [...new Set(visits.map((v) => v.bookingId).filter(Boolean))];
  const [quotes, bookings] = await Promise.all([
    quoteIds.length
      ? db.quote.findMany({
          where: { companyId, id: { in: quoteIds } },
          select: { id: true, status: true, sentAt: true, acceptedAt: true, total: true, acceptedTotal: true },
        })
      : [],
    visitBookingIds.length || quoteIds.length
      ? db.booking.findMany({
          // Booking has no companyId of its own: it is the company's through
          // its event type, the same scope the booking routes use.
          where: {
            eventType: { companyId },
            status: { in: [...BOOKED_STATUSES] },
            OR: [
              ...(visitBookingIds.length ? [{ id: { in: visitBookingIds } }] : []),
              ...(quoteIds.length ? [{ quoteId: { in: quoteIds } }] : []),
            ],
          },
          select: { id: true, quoteId: true, status: true },
        })
      : [],
  ]);
  const bookedIds = new Set(bookings.map((b) => b.id));
  const isCompleted = (v) =>
    v.surface === "booking" && detail ? Boolean(v.bookingId && bookedIds.has(v.bookingId)) : Boolean(v.completedAt);

  // ── One report per surface ───────────────────────────────────────────────
  //
  // A booking visit is "booked" only while its booking is confirmed or
  // completed — an unpaid hold that lapsed is not a booking. Before the
  // bookingId column exists, completedAt is all there is.
  const byKey = new Map();
  for (const v of visits) {
    const key = v.surface === "funnel" ? `funnel:${v.funnelId}` : v.surface;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ stepRank: v.stepRank, completed: isCompleted(v) });
  }

  const surfaces = [];
  const iq = byKey.get("instant_quote") || [];
  surfaces.push({
    key: "instant_quote",
    kind: "instant_quote",
    ...countSteps(reportSteps("instant_quote"), iq),
  });
  const funnelNames = {};
  const funnelStepLabels = {};
  for (const f of funnels) {
    funnelNames[f.id] = f.name;
    const steps = Array.isArray(f.steps) ? f.steps : [];
    const labels = {};
    for (const s of steps) if (s?.id) labels[s.id] = stepLabel(s);
    funnelStepLabels[f.id] = labels;
    const rows = byKey.get(`funnel:${f.id}`) || [];
    // An unpublished funnel with no visits in range is noise on this screen.
    if (!rows.length && f.status !== "published") continue;
    const counted = countSteps(reportSteps("funnel", steps), rows);
    surfaces.push({
      key: `funnel:${f.id}`,
      kind: "funnel",
      funnelId: f.id,
      name: f.name,
      slug: f.slug,
      ...counted,
      steps: counted.steps.map((s) => ({ ...s, label: s.key === SUBMITTED ? null : labels[s.key] || null })),
    });
  }
  // The booking page and the website: shown once they have visits. Counting
  // began when they were added, and an empty card for a page a company may
  // not use is noise.
  for (const kind of ["booking", "website"]) {
    const rows = byKey.get(kind) || [];
    if (rows.length) surfaces.push({ key: kind, kind, ...countSteps(reportSteps(kind), rows) });
  }

  // ── Where they came from ─────────────────────────────────────────────────
  //
  // Page × source. The campaign used to be a third column here, grouped by
  // the raw utm_campaign string — so "new+traffic+campaign" and "new traffic
  // campaign" were two rows. Campaigns have their own table now, grouped by
  // Meta's ids (below); this one answers "which network".
  const sources = new Map();
  for (const v of visits) {
    if (v.firstVisitId) continue; // the same arrival, already counted on the page it landed on
    const surfaceKey = v.surface === "funnel" ? `funnel:${v.funnelId}` : v.surface;
    const k = `${surfaceKey}\u001f${v.source}`;
    const row = sources.get(k) || { surfaceKey, source: v.source, visits: 0, submitted: 0 };
    row.visits += 1;
    if (isCompleted(v)) row.submitted += 1;
    sources.set(k, row);
  }
  const bySource = [...sources.values()].sort((a, b) => b.visits - a.visits || b.submitted - a.submitted).slice(0, 100);

  // ── Campaign ▸ ad set ▸ ad ───────────────────────────────────────────────
  const seesQuotes = hasLevel(full, "quotes", "view_only");
  const seesMoney = seesQuotes && hasToggle(full, "showPricing");
  const campaigns = redactCampaignReport(buildCampaignReport({ visits, leads, quotes, bookings, now }), {
    quotes: seesQuotes,
    money: seesMoney,
  });

  // ── Started, didn't finish ───────────────────────────────────────────────
  const seesContact = hasLevel(full, "clientsProperties", "full_view");
  const partialRows = partials.map((p) => ({
    id: p.id,
    surface: p.surface,
    funnelId: p.funnelId,
    funnelName: p.funnelId ? funnelNames[p.funnelId] || null : null,
    trade: p.trade,
    stepKey: p.stepKey,
    stepLabel: p.funnelId ? funnelStepLabels[p.funnelId]?.[p.stepKey] || null : null,
    source: p.source,
    // Decoded ("spring+roofs" is "spring roofs"), the same reading the
    // campaign table uses.
    campaign: decodeAdValue(p.utmCampaign),
    contactAt: p.contactAt,
    lastSeenAt: p.lastSeenAt,
    ...(seesContact
      ? { name: p.contactName, email: p.contactEmail, phone: p.contactPhone }
      : { restricted: true }),
  }));

  return NextResponse.json({
    days: range,
    since: since.toISOString(),
    surfaces,
    funnelNames,
    bySource,
    campaigns: campaigns.campaigns.slice(0, 200),
    campaignsUntagged: campaigns.untagged,
    campaignAccess: { quotes: seesQuotes, money: seesMoney },
    currency: company?.currency || null,
    partials: partialRows,
    partialExpireDays: PARTIAL_EXPIRE_DAYS,
    truncated: visits.length >= MAX_ROWS || leads.length >= MAX_ROWS,
  });
}
