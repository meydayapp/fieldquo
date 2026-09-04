// app/api/marketing/designer/designs/[id]/approval/route.js
//
// GET    — is this asset approved, for what it says right now?
// POST   — approve it. Records who, when, and a fingerprint of exactly what
//          was approved.
// DELETE — withdraw the approval.
//
// ══ Why the approval carries a fingerprint ════════════════════════════════
//
// See lib/marketing/approvalFingerprint.js's header for the argument in full.
// The short version: a boolean `approved` survives the content changing under
// it, so a design approved on Tuesday and edited on Wednesday would still
// publish on Thursday with somebody's name on a sign-off for words they never
// read. The fingerprint turns that into a third state — `stale` — which the
// screen can explain and the publish route refuses on.
//
// ══ Why the caption lives on the design and not in the publish dialog ═════
//
// It used to be typed into PublishModal and never stored, which is precisely
// what made an approval step impossible: there was no persistent artefact to
// approve. The words are part of the asset, so they are saved with it (PATCH
// on the parent route) and fingerprinted with it here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { approvalState, designFingerprint } from "@/lib/marketing/approvalFingerprint";

async function loadOwned(companyId, id) {
  const design = await db.marketingDesign.findUnique({
    where: { id },
    include: {
      layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!design || design.companyId !== companyId) return null;
  return design;
}

/** The one shape every verb here answers in, so the screen has one thing to read. */
function stateBody(design) {
  const state = approvalState(design, design.layouts);
  return {
    state: state.state,
    approvedAt: design.approvedAt,
    approvedByName: design.approvedBy?.name || null,
    caption: design.caption || "",
    hashtags: design.hashtags || [],
    // How many ratios there are to look at. A design with no saved layout has
    // nothing to approve, and saying so is more use than an Approve button
    // that fingerprints the empty set.
    layoutCount: design.layouts.length,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(stateBody(design));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    // Same axis as publishing itself. An approval that a role could give but
    // not act on would be a signature with no consequence; an approval a role
    // could give when it may NOT publish would be a gate with a side door.
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can approve marketing content" },
      { status: err.status || 403 },
    );
  }

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!design.layouts.length) {
    return NextResponse.json(
      {
        error: "nothing_to_approve",
        message: "Open this design and save it first — there's no artwork to approve yet.",
      },
      { status: 409 },
    );
  }

  // ── The client says what it believes it is approving ─────────────────────
  //
  // Optional, and checked when present. The screen sends back the fingerprint
  // it was showing; if an autosave landed between the render and the click,
  // this refuses rather than signing off on the version that arrived after
  // the person stopped looking. Same read-then-write hazard the social
  // schedule's own cancel route guards with an atomic status check, in the
  // one place here where the thing being raced is a human's attention.
  let body = {};
  try {
    body = await request.json();
  } catch {
    // A body is optional; an unparseable one is treated as absent rather than
    // 400ing an approval over a missing Content-Type.
  }

  const current = designFingerprint({
    layouts: design.layouts,
    caption: design.caption || "",
    hashtags: design.hashtags || [],
  });

  if (typeof body?.fingerprint === "string" && body.fingerprint && body.fingerprint !== current) {
    return NextResponse.json(
      {
        error: "changed_since_review",
        message: "This design changed while you were reviewing it. Take another look, then approve.",
        current,
      },
      { status: 409 },
    );
  }

  const updated = await db.marketingDesign.update({
    where: { id },
    data: {
      approvedAt: new Date(),
      approvedById: member.userId,
      approvedFingerprint: current,
    },
    include: {
      layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
      approvedBy: { select: { name: true } },
    },
  });

  await recordActivity(member, {
    action: "marketing.design_approved",
    entityType: "settings",
    entityId: id,
    summary: `Approved "${design.name}" for posting`,
    metadata: { fingerprint: current, ratios: design.layouts.map((l) => l.ratioKey) },
  }).catch(() => {});

  return NextResponse.json(stateBody(updated));
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can approve marketing content" },
      { status: err.status || 403 },
    );
  }

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Withdrawing an approval does NOT touch a post that already went out or is
  // already queued: a SocialPublish row carries its own imageUrl and caption
  // (see that model's comment) precisely so what was approved is what ships,
  // whatever happens to the design afterwards. Cancelling a queued post is the
  // calendar's own DELETE, which is a separate decision a person makes
  // separately.
  const updated = await db.marketingDesign.update({
    where: { id },
    data: { approvedAt: null, approvedById: null, approvedFingerprint: null },
    include: {
      layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
      approvedBy: { select: { name: true } },
    },
  });

  await recordActivity(member, {
    action: "marketing.design_approval_withdrawn",
    entityType: "settings",
    entityId: id,
    summary: `Withdrew approval for "${design.name}"`,
  }).catch(() => {});

  return NextResponse.json(stateBody(updated));
}
