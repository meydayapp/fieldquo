// app/api/platform/sales/campaigns/[id]/route.js
//
// One campaign: its funnel, and the four buttons that actually move it.
//
// ══ Start is what ENQUEUES ═════════════════════════════════════════════════
//
// The single most important line in this file is the `enqueuePipelineTask`
// below. A "Start" button that set `status = "running"` and queued nothing
// would look exactly like a working campaign — status running, funnel at zero,
// no error anywhere — and it would sit there for ever. That is the dead
// control AGENTS.md forbids, and three features in this repo have already
// shipped unreachable for want of this one call.
//
// So starting is: check the provider can actually run, set the status, and
// queue the first page — all in one transaction, so a status of `running` with
// no task behind it is not a state the database can be in.
//
// ══ Params are Promises in Next 16 ════════════════════════════════════════
//
// `const { id } = await params`. Not decoration: reading `params.id`
// synchronously yields undefined and the route 404s on every request.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { discoveryTradeLabel } from "@/lib/sales/discovery/trades";
import { campaignProgress, funnelProblems, funnelRows } from "@/lib/sales/discovery/funnel";
import { stalenessOf } from "@/lib/sales/discovery/normalise";
import { duplicateReason } from "@/lib/sales/discovery/dedupe";
import { enqueuePipelineTask } from "@/lib/sales/pipeline/tasks";

/** How many needs-review rows one screen load carries. */
const REVIEW_PAGE = 40;

export async function GET(request, { params }) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const campaign = await db.prospectCampaign.findUnique({
    where: { id },
    include: { territory: true },
  });
  if (!campaign) return NextResponse.json({ error: "No such campaign." }, { status: 404 });

  const provider = getDiscoveryProvider(campaign.discoveryProvider);
  const described = provider ? provider.describeConfig(campaign.providerConfig || {}) : null;

  const [review, flagged, tasks] = await Promise.all([
    db.prospect.findMany({
      where: { campaignId: id, status: "needs_review" },
      orderBy: { createdAt: "asc" },
      take: REVIEW_PAGE,
      select: {
        id: true,
        businessName: true,
        phoneE164: true,
        websiteUrl: true,
        city: true,
        province: true,
        addressLine: true,
        sourceCategories: true,
        classification: true,
        classificationReason: true,
        sourceDataset: true,
        sourceRelease: true,
        sourceUpdatedAt: true,
        possibleDuplicateOfId: true,
      },
    }),
    db.prospect.count({ where: { campaignId: id, possibleDuplicateOfId: { not: null } } }),
    // What the pipeline is actually doing. Without this the screen can say
    // "running" while every task has been abandoned, which is the state a
    // superadmin most needs to see and the one a status column cannot show.
    db.salesPipelineTask.groupBy({
      by: ["status"],
      where: { campaignId: id, kind: "DISCOVER_BUSINESSES" },
      _count: { _all: true },
    }),
  ]);

  const lastError = await db.salesPipelineTask.findFirst({
    where: { campaignId: id, kind: "DISCOVER_BUSINESSES", lastError: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { status: true, lastError: true, attempts: true, completedAt: true },
  });

  return NextResponse.json({
    campaign: {
      ...campaign,
      // Withheld deliberately: a provider config can hold a signed URL, and
      // the screen only needs to know whether it is usable and what it points
      // at. The edit form re-sends the whole value rather than reading it back.
      providerConfig: undefined,
      tradeLabel: discoveryTradeLabel(campaign.tradeKey),
      progress: campaignProgress(campaign),
      funnel: funnelRows(campaign),
      funnelProblems: funnelProblems(campaign),
    },
    provider: provider
      ? { key: provider.key, label: provider.label, configFields: provider.configFields || [] }
      : null,
    // A campaign whose provider this build no longer ships is a real state and
    // it is said outright, rather than rendering a Start button that would
    // fail on click.
    providerMissing: !provider,
    config: described ? { ok: described.ok, problems: described.problems, summary: described.summary } : null,
    review: review.map((p) => ({
      ...p,
      staleness: stalenessOf(p.sourceUpdatedAt),
      duplicateNote: p.possibleDuplicateOfId ? duplicateReason(null) : null,
    })),
    reviewTotal: campaign.needsReviewCount,
    flaggedDuplicates: flagged,
    tasks: Object.fromEntries(tasks.map((t) => [t.status, t._count._all])),
    lastError: lastError || null,
  });
}

/**
 * Start, pause, resume, cancel — or fix the provider settings.
 *
 * Every transition is re-checked against the row as it is NOW, not as the
 * screen last saw it. A campaign somebody else completed while this tab was
 * open must not be restarted by a stale button.
 */
export async function PATCH(request, { params }) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();

  const campaign = await db.prospectCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "No such campaign." }, { status: 404 });

  if (action === "configure") {
    const provider = getDiscoveryProvider(campaign.discoveryProvider);
    if (!provider) return bad(`This build does not ship a provider called "${campaign.discoveryProvider}".`);
    const config = body?.providerConfig && typeof body.providerConfig === "object" ? body.providerConfig : {};
    const described = provider.describeConfig(config);
    if (!described.ok) {
      return NextResponse.json({ error: "Those settings would discover nothing.", problems: described.problems }, { status: 400 });
    }
    await write(admin, campaign, { providerConfig: config }, "sales_campaign_configured", { summary: described.summary });
    return NextResponse.json({ ok: true });
  }

  if (action === "start" || action === "resume") {
    if (campaign.status === "running") return NextResponse.json({ ok: true, note: "Already running." });
    if (campaign.status === "completed") {
      return bad("This campaign has finished. Create a new one rather than restarting it — its funnel counts a single run.");
    }

    const provider = getDiscoveryProvider(campaign.discoveryProvider);
    if (!provider) return bad(`This build does not ship a provider called "${campaign.discoveryProvider}".`);
    const described = provider.describeConfig(campaign.providerConfig || {});
    if (!described.ok) {
      return NextResponse.json(
        { error: "This campaign cannot start yet.", problems: described.problems },
        { status: 400 },
      );
    }

    // Status and task together. See the header: a `running` campaign with no
    // task behind it is the failure this whole route is arranged to prevent.
    await db.$transaction(async (tx) => {
      await tx.prospectCampaign.update({
        where: { id: campaign.id },
        data: { status: "running", startedAt: campaign.startedAt || new Date(), completedAt: null },
      });
      await enqueuePipelineTask(
        {
          kind: "DISCOVER_BUSINESSES",
          campaignId: campaign.id,
          payload: { provider: provider.key },
          // Keyed on the cursor the run will start from, so a start clicked
          // twice queues one task. `enqueuePipelineTask` returns the existing
          // row on a collision rather than throwing.
          idempotencyKey: `discover:${campaign.id}:${campaign.discoveryCursor || "0"}`,
        },
        { deps: { db: tx } },
      );
      await tx.platformAuditLog.create({
        data: {
          platformAdminId: admin.id,
          action: "sales_campaign_started",
          details: { campaignId: campaign.id, name: campaign.name, from: campaign.status },
        },
      });
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "pause" || action === "cancel") {
    const status = action === "pause" ? "paused" : "cancelled";
    if (campaign.status === "completed") return bad("This campaign has already finished.");
    // The queued task is NOT deleted. The handler re-reads the campaign's
    // status before it does anything (see runDiscoverBusinesses), so a paused
    // campaign's next task completes as a no-op — and deleting rows would lose
    // the record that the work was ever queued.
    await write(admin, campaign, { status }, `sales_campaign_${status}`, {});
    return NextResponse.json({ ok: true });
  }

  return bad(`"${action}" is not something a campaign can do.`);
}

function bad(error) {
  return NextResponse.json({ error }, { status: 400 });
}

async function write(admin, campaign, data, action, details) {
  await db.$transaction(async (tx) => {
    await tx.prospectCampaign.update({ where: { id: campaign.id }, data });
    await tx.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action,
        details: { campaignId: campaign.id, name: campaign.name, ...details },
      },
    });
  });
}
