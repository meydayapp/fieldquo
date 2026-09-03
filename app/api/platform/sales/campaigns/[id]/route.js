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
import {
  campaignSourceKeys,
  cursorFingerprint,
  describeSources,
  mergeSourceState,
  sourceStateFor,
  startProblems,
} from "@/lib/sales/discovery/sources";
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

  // Every source this campaign named, each with its own licence, its own
  // settings and its own position. One combined verdict would hide which of
  // three sources is the one that cannot run.
  const sources = describeSources(campaign, { getProvider: getDiscoveryProvider });

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
      // Withheld deliberately: a source config can hold a signed URL, and the
      // screen only needs to know whether it is usable and what it points at.
      // The edit form re-sends the whole value rather than reading it back.
      providerConfig: undefined,
      sourceConfigs: undefined,
      tradeLabel: discoveryTradeLabel(campaign.tradeKey),
      progress: campaignProgress(campaign),
      funnel: funnelRows(campaign),
      funnelProblems: funnelProblems(campaign),
      sourceKeys: campaignSourceKeys(campaign),
    },
    // One entry per source the campaign named, in the order it named them.
    // A source this build no longer ships appears here with registered:false
    // rather than being dropped from the list — a screen that showed two
    // sources where a superadmin ticked three has rewritten what they asked
    // for.
    sources: sources.map((s) => ({
      key: s.key,
      label: s.label,
      registered: s.registered,
      licence: s.licence,
      unavailable: s.unavailable,
      configFields: getDiscoveryProvider(s.key)?.configFields || [],
      config: { ok: s.configOk, problems: s.problems, summary: s.summary },
      state: s.state,
    })),
    // Why Start is not offered, in sentences. Empty means it can start.
    startProblems: startProblems(campaign, { getProvider: getDiscoveryProvider }),
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
    // ONE source's settings, named. A body that changed "the config" would
    // have to guess which of three sources it meant, and both shipped sources
    // have a field called `snapshotUrl` — so the guess would silently write
    // one source's snapshot URL onto another.
    const sourceKey = String(body?.sourceKey ?? "").trim();
    if (!sourceKey) return bad("Which source? A campaign can draw from several, so the settings name one.");
    if (!campaignSourceKeys(campaign).includes(sourceKey)) {
      return bad(`This campaign does not draw from "${sourceKey}".`);
    }
    const provider = getDiscoveryProvider(sourceKey);
    if (!provider) return bad(`This build does not ship a source called "${sourceKey}".`);
    const config = body?.providerConfig && typeof body.providerConfig === "object" ? body.providerConfig : {};
    const described = provider.describeConfig(config);
    if (!described.ok) {
      return NextResponse.json({ error: "Those settings would discover nothing.", problems: described.problems }, { status: 400 });
    }
    // Fixing the settings is the ONLY thing that can clear a source the
    // pipeline blocked for a settings problem, so it clears it here. Leaving
    // the block set would give a superadmin a Save button that reports success
    // and changes nothing about whether the source ever runs again.
    const state = sourceStateFor(campaign, sourceKey);
    await write(
      admin,
      campaign,
      {
        sourceConfigs: { ...(plainObject(campaign.sourceConfigs) || {}), [sourceKey]: config },
        sourceState: mergeSourceState(campaign, {
          [sourceKey]: { ...state, blocked: null, failures: 0, lastError: null, lastErrorAt: null },
        }),
      },
      "sales_campaign_configured",
      { sourceKey, summary: described.summary, unblocked: Boolean(state.blocked) },
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "start" || action === "resume") {
    if (campaign.status === "running") return NextResponse.json({ ok: true, note: "Already running." });
    if (campaign.status === "completed") {
      return bad("This campaign has finished. Create a new one rather than restarting it — its funnel counts a single run.");
    }

    // Every source, re-checked against the row as it is NOW. A campaign saved
    // when a source was runnable must not start after that source withdrew
    // itself, and one unusable source among three is still a Start button that
    // would half-work.
    const problems = startProblems(campaign, { getProvider: getDiscoveryProvider });
    if (problems.length) {
      return NextResponse.json({ error: "This campaign cannot start yet.", problems }, { status: 400 });
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
          // No `provider` here any more. resolveProvider() reads it to pick a
          // rate-limit budget, and a task that reads several sources cannot
          // honestly claim to spend one of them — so it falls back to
          // PROVIDER_BY_KIND's "discovery" budget, which is the one sized for
          // this stage.
          payload: { sources: campaignSourceKeys(campaign) },
          // Keyed on where every source will start from, so a start clicked
          // twice queues one task. `enqueuePipelineTask` returns the existing
          // row on a collision rather than throwing.
          idempotencyKey: `discover:${campaign.id}:${cursorFingerprint(campaign)}`,
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

/** A stored JSON column that is really an object, or null. `typeof null` is
 *  "object" and an array spreads into numeric keys, so both are excluded. */
function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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
