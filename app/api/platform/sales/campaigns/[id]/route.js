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
import { campaignTradeLabel } from "@/lib/sales/discovery/trades";
import { researchBudget } from "@/lib/sales/pipeline/handlers/discoverBusinesses";
import {
  snapshotFileFor,
  snapshotFileForUrl,
  snapshotUrlFor,
} from "@/lib/sales/discovery/snapshotLibrary";
import { loadSnapshotLibrarySetting } from "@/lib/sales/discovery/snapshotSetting";
import { probeSnapshot } from "@/lib/sales/discovery/snapshotProbe";
import { campaignStartBlockers, territoryRegistration } from "@/lib/sales/discovery/campaignGate";
import { registeredKeys, withRegistrations } from "@/lib/sales/registrations";
import { campaignProgress, funnelProblems, funnelRows } from "@/lib/sales/discovery/funnel";
import { stalenessOf } from "@/lib/sales/discovery/normalise";
import { duplicateReason } from "@/lib/sales/discovery/dedupe";
import { enqueuePipelineTask } from "@/lib/sales/pipeline/tasks";

/**
 * The calling-rules table with FieldQuo's own certificates applied.
 *
 * Loaded per request rather than cached: a certificate expires on a date, and
 * a table cached on a warm serverless instance would go on saying "registered"
 * past midnight on the day it lapsed. The read is one indexed row per gated
 * jurisdiction and there are thirteen of them.
 */
async function liveJurisdictions(now = new Date()) {
  const rows = await db.salesTelemarketerRegistration.findMany({
    where: { revokedAt: null },
    select: { jurisdictionKey: true, certificateNumber: true, registeredAt: true, expiresAt: true, revokedAt: true },
  });
  return withRegistrations(registeredKeys(rows, now));
}

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

  const [review, flagged, tasks, researchQueued] = await Promise.all([
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
    // How much of the research budget has been spent. Banking is cheap and
    // researching is ~7 pipeline tasks a prospect, so a campaign can go on
    // banking long after it has stopped promoting — and a screen that showed
    // only the funnel would present that as a campaign still working its rows.
    db.salesPipelineTask.count({ where: { campaignId: id, kind: "ENRICH_BUSINESS" } }),
  ]);

  const lastError = await db.salesPipelineTask.findFirst({
    where: { campaignId: id, kind: "DISCOVER_BUSINESSES", lastError: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { status: true, lastError: true, attempts: true, completedAt: true },
  });


  // The table with FieldQuo's own certificates applied, so a jurisdiction
  // registered on the console stops reading as outstanding here.
  const jurisdictions = await liveJurisdictions();
  return NextResponse.json({
    campaign: {
      ...campaign,
      // Withheld deliberately: a source config can hold a signed URL, and the
      // screen only needs to know whether it is usable and what it points at.
      // The edit form re-sends the whole value rather than reading it back.
      providerConfig: undefined,
      sourceConfigs: undefined,
      tradeLabel: campaignTradeLabel(campaign),
      progress: campaignProgress(campaign),
      // The bound on the expensive half, stated as a number rather than left to
      // be discovered when a campaign quietly stops promoting.
      research: {
        queued: researchQueued,
        target: Math.max(0, Math.floor(Number(campaign.targetCount) || 0)),
        remaining: researchBudget({ targetCount: campaign.targetCount, spent: researchQueued }),
      },
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
    //
    // BOTH gates, concatenated, never whichever fired first: a campaign with an
    // unreachable snapshot in a state FieldQuo is not registered in has two
    // problems, and a screen that named one would send somebody to fix it and
    // press the button again.
    startProblems: [
      ...startProblems(campaign, { getProvider: getDiscoveryProvider }),
      ...campaignStartBlockers(campaign.territory, { jurisdictions }).map((b) => `${b.title} ${b.fix}`),
    ],
    // The registration position where this campaign would be calling, stated
    // whether or not it blocks. "Registered" is worth seeing too — it is the
    // difference between a draft somebody has not started and a draft that
    // cannot be.
    registration: territoryRegistration(campaign.territory, { jurisdictions }),
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

  // The territory comes with it, because two of the four buttons now depend on
  // WHERE the campaign is: start is refused into a jurisdiction FieldQuo is not
  // registered to solicit in, and the snapshot is re-derived per region.
  const campaign = await db.prospectCampaign.findUnique({ where: { id }, include: { territory: true } });
  if (!campaign) return NextResponse.json({ error: "No such campaign." }, { status: 404 });

  if (action === "configure") {
    // ══ Re-DERIVED, never typed ═══════════════════════════════════════════
    //
    // This branch used to take a `providerConfig` blob off the request, which
    // made it the last place in the product where a snapshot URL could be typed
    // — and therefore the last place one could be typed WRONG. It now rebuilds
    // the URL from the base URL configured at /platform/sales/snapshots and the
    // object key the campaign already carries, and fetches it before saving. A
    // request that includes a URL is refused rather than ignored: silently
    // dropping what somebody typed is how a Save button reports success and
    // changes nothing.
    //
    // What it still does, and why the branch survives at all: fixing the
    // settings is the ONLY thing that clears a source the pipeline blocked, and
    // the thing that needs fixing after a base URL changes is exactly this.
    const sourceKey = String(body?.sourceKey ?? "").trim();
    if (!sourceKey) return bad("Which source? A campaign can draw from several, so the settings name one.");
    if (!campaignSourceKeys(campaign).includes(sourceKey)) {
      return bad(`This campaign does not draw from "${sourceKey}".`);
    }
    const provider = getDiscoveryProvider(sourceKey);
    if (!provider) return bad(`This build does not ship a source called "${sourceKey}".`);
    if (body?.providerConfig?.snapshotUrl) {
      return bad(
        "Snapshot URLs are not typed any more. This campaign's file is rebuilt from the base URL at " +
          "/platform/sales/snapshots, so change it there and press this again.",
      );
    }

    const stored = plainObject(campaign.sourceConfigs)?.[sourceKey] || {};
    // The library row this source reads. Campaigns created since the library
    // carry the key; older ones carry only the URL the create script built by
    // hand, and matching that back to a key is what lets one of those be fixed
    // rather than stranded.
    const file = snapshotFileFor(stored.snapshotFile) || snapshotFileForUrl(stored.snapshotUrl);
    if (!file) {
      return bad(
        "This campaign's snapshot is not one of the files in the library, so there is nothing to rebuild it " +
          "from. Create a new campaign for this region instead — the form picks the file for you.",
      );
    }

    const library = await loadSnapshotLibrarySetting(db);
    if (!library.configured) {
      return bad("Snapshots are not configured. Set the bucket's base URL at /platform/sales/snapshots first.");
    }

    const url = snapshotUrlFor(library.baseUrl, file.objectKey);
    const probe = await probeSnapshot(url, file);
    if (!probe.ok) {
      return NextResponse.json(
        { error: "The rebuilt snapshot URL did not serve that file, so nothing was changed.", problems: [probe.problem] },
        { status: 400 },
      );
    }

    const config = { snapshotUrl: url, snapshotFile: file.objectKey };
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

    // ══ …and where it would be calling ════════════════════════════════════
    //
    // The registration gate, re-read from lib/sales/callingRules.js on every
    // press rather than from anything stored on the campaign. Starting is the
    // moment the pipeline spending begins, and spending it banking 75,887
    // Washington licences that no rep may dial is the one outcome this gate
    // exists to prevent. The campaign stays a draft — which is what the manual
    // creation script did by hand, moved to where the button is.
    //
    // Read the whole argument in lib/sales/discovery/campaignGate.js: this is
    // NOT a second copy of the calling rules, and it is deliberately stricter
    // than the per-call warning, because a call is one call and a campaign is
    // a budget.
    const jurisdictions = await liveJurisdictions();
    for (const blocker of campaignStartBlockers(campaign.territory, { jurisdictions })) {
      problems.push(`${blocker.title} ${blocker.fix}`);
    }

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
