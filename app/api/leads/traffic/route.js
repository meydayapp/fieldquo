// app/api/leads/traffic/route.js
//
// The company's own report on its instant estimate and lead funnels: visits,
// how far they got, where they came from, and the people who typed contact
// details and stopped. Counted from FunnelVisit rows (lib/tracking/) — first
// party, no ad platform in the loop, so the number is the same whether or not
// the visitor blocked a pixel.
//
// ── Who may read it ────────────────────────────────────────────────────────
//
// The same rung as the leads board (requests: view_only), because the partial
// list is lead-shaped: a name and a number somebody typed about a job. The
// contact fields are then removed for a member below clientsProperties
// full_view — the same second filter redactLead applies to a lead — and the
// row says so rather than rendering blanks.
//
// ── The one write ──────────────────────────────────────────────────────────
//
// Partials older than PARTIAL_EXPIRE_DAYS are FLAGGED expired here, lazily,
// rather than by a cron: a scheduled job would be a function invocation a day
// per deployment to set a flag that only matters when someone opens this
// screen. The read filters by date as well, so a failed flag write hides
// nothing it should show. Skipped under impersonation — the platform console
// reads and never writes (non-negotiable #3).

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { hasLevel } from "@/lib/permissions/enforce";
import { countSteps, reportSteps, SUBMITTED } from "@/lib/tracking/funnelSteps";
import { livePartialWhere, stalePartialWhere, PARTIAL_EXPIRE_DAYS } from "@/lib/tracking/partial";

const RANGES = new Set([7, 30, 90]);
const MAX_ROWS = 50000;

/** The words a funnel step is known by in its own builder. */
function stepLabel(step) {
  const text = step?.question || step?.headline || "";
  return typeof text === "string" && text.trim() ? text.trim().slice(0, 80) : null;
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

  const [visits, funnels, partials] = await Promise.all([
    db.funnelVisit.findMany({
      where: { companyId, startedAt: { gte: since } },
      select: { surface: true, funnelId: true, stepRank: true, completedAt: true, source: true, utmCampaign: true },
      take: MAX_ROWS,
    }),
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
  ]);

  // ── One report per surface ───────────────────────────────────────────────
  const byKey = new Map();
  for (const v of visits) {
    const key = v.surface === "funnel" ? `funnel:${v.funnelId}` : "instant_quote";
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ stepRank: v.stepRank, completed: Boolean(v.completedAt) });
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

  // ── Where they came from ─────────────────────────────────────────────────
  const sources = new Map();
  for (const v of visits) {
    const surfaceKey = v.surface === "funnel" ? `funnel:${v.funnelId}` : "instant_quote";
    const k = `${surfaceKey}\u001f${v.source}\u001f${v.utmCampaign || ""}`;
    const row = sources.get(k) || { surfaceKey, source: v.source, campaign: v.utmCampaign || null, visits: 0, submitted: 0 };
    row.visits += 1;
    if (v.completedAt) row.submitted += 1;
    sources.set(k, row);
  }
  const bySource = [...sources.values()].sort((a, b) => b.visits - a.visits || b.submitted - a.submitted).slice(0, 100);

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
    campaign: p.utmCampaign,
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
    partials: partialRows,
    partialExpireDays: PARTIAL_EXPIRE_DAYS,
    truncated: visits.length >= MAX_ROWS,
  });
}
