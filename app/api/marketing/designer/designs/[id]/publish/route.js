// app/api/marketing/designer/designs/[id]/publish/route.js
//
// POST — publish (or schedule) a rendered MarketingDesign asset to the
// company's connected Facebook Page and/or Instagram account, one platform
// at a time so a Facebook success and an Instagram failure never masquerade
// as a single pass/fail. GET — connection status, visibility, and this
// design's publish history, so the modal can show "already posted this
// today" instead of inviting a duplicate.
//
// This route never trusts the browser's word that a connection exists — it
// re-checks lib/social/metaConnection.js itself, same as every money amount
// in this codebase is re-priced server-side rather than taken from the
// client (AGENTS.md non-negotiable #5, the identical discipline applied to
// "are we actually allowed to do this" instead of "what does this cost").
// For a real company, getMetaConnection() still always returns
// connected: false — see that file's own header for why, and what must
// change for this route to start actually posting. For a DEMO company
// (Company.isDemo) it returns a fabricated connected:true, mock:true
// connection instead — see "mock" below.
//
// ══ Hidden until Meta approves the app (docs/SOCIAL-SCHEDULING.md) ═════════
//
// `visible` gates the whole feature for a REAL company: it is true only once
// META_APP_ID/META_APP_SECRET exist (metaAppConfigured(), lib/meta/client.js)
// — real configuration, not a hand-set flag. A demo company is always
// visible, because it never needs Meta at all. This route refuses with 403
// when !visible, same as the UI hides the Publish button entirely for that
// case (CampaignEditor.js) — both the client-side hiding AND this
// server-side refusal exist, because AGENTS.md's rule is "hiding a button is
// not access control."
//
// ══ Scheduling ══════════════════════════════════════════════════════════
//
// `scheduledFor`, when present, branches per platform:
//   - Instagram: ALWAYS queued (status "scheduled"), never touches Meta at
//     schedule time — Instagram has no native scheduling parameter, and
//     creating a container now would let it expire (24h lifetime) long
//     before a post scheduled days out ever fires. The cron
//     (app/api/cron/social-scheduled-publish/route.js) creates the
//     container AND publishes, together, at fire time.
//   - Facebook, real company: handed to Meta's own native scheduler right
//     now (POST /{page-id}/photos, published:false + scheduled_publish_time)
//     — Meta holds and fires it; this route and the cron do nothing more.
//   - Facebook, DEMO (mock) company: also queued, exactly like Instagram —
//     there is no real Meta scheduler for a mock post to hand off to.
//
// ══ Nothing publishes or schedules without a human approval ═══════════════
//
// A design must carry a live approval — approvedAt, plus a fingerprint that
// still matches the layouts and words on the row RIGHT NOW
// (lib/marketing/approvalFingerprint.js). Re-derived here, on this request,
// from the current rows; never trusted from the browser and never from an
// earlier read. The same discipline lib/migrations/state.js's canWrite()
// applies to a paid migration, for the same reason: consent given a moment
// ago about different content is not consent now.
//
// The CAPTION comes off the design, not out of the request body. A body
// carrying a different one is refused rather than silently overridden —
// otherwise what ships is not what was approved, which is the whole failure
// this gate exists to prevent, reintroduced through the one field somebody
// could still type into.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { uploadBuffer } from "@/lib/cloudinary";
import { ratio as ratioByKey } from "@/lib/marketing/ratios";
import {
  validateCaption,
  isValidFacebookScheduleTime,
  isSocialPublishingVisible,
} from "@/lib/social/metaSpecs";
import { metaAppConfigured } from "@/lib/meta/client";
import { getMetaConnection } from "@/lib/social/metaConnection";
import { approvalState } from "@/lib/marketing/approvalFingerprint";
import {
  publishToInstagram,
  publishToFacebook,
  validateInstagramSchedule,
  PublishRefusal,
} from "@/lib/social/publishDesign";
import * as metaGraphClient from "@/lib/social/metaGraphClient";
import * as mockMetaGraphClient from "@/lib/social/mockMetaGraphClient";

function requireMarketingManager(role) {
  // Same axis as every other write in this area — see
  // app/api/marketing/designer/designs/[id]/route.js.
  requirePermission(role, "user:manage");
}

async function loadOwned(companyId, id) {
  const design = await db.marketingDesign.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true } },
      // The layouts are loaded on the PUBLISH path, not only on a read,
      // because the approval fingerprint is computed over them — an approval
      // can only be re-checked against the artwork as it stands, and that
      // means reading it here rather than remembering that it once matched.
      layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!design || design.companyId !== companyId) return null;
  return design;
}

// A generous but real ceiling on the decoded image, checked BEFORE the
// base64 string is even parsed into a Buffer — an unbounded
// Buffer.from(hugeString, "base64") is a way to let one request hold a lot
// of memory for no reason; Instagram's own 8MB cap (lib/social/metaSpecs.js)
// makes anything past a few MB pointless to accept anyway.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

const PLATFORMS = new Set(["facebook", "instagram"]);

// The only two failures a demo operator can ask the mock client to produce —
// see lib/social/mockMetaGraphClient.js's header. Anything else in the body
// is ignored, and NOTHING here is ever honored for a real (non-mock)
// connection: see the `isMock ? simulateFailure : null` gate below.
const SIMULATABLE_FAILURES = new Set(["rate_limited", "container_error"]);

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [connection, history] = await Promise.all([
    getMetaConnection(member.companyId),
    db.socialPublish.findMany({
      where: { designId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const appConfigured = metaAppConfigured();
  const visible = isSocialPublishingVisible({ isDemo: connection.mock, appConfigured });

  return NextResponse.json({
    visible,
    appConfigured,
    mock: Boolean(connection.mock),
    connected: Boolean(connection?.connected),
    pageName: connection?.pageName || null,
    instagramUsername: connection?.instagramUsername || null,
    history,
    // The approval, computed the same way POST computes it, so the dialog
    // shows exactly the state the server will act on rather than its own
    // guess at it.
    approval: {
      state: approvalState(design, design.layouts).state,
      approvedAt: design.approvedAt,
      approvedByName: design.approvedBy?.name || null,
    },
    // The words that would go out. Read-only on the publish screen: the place
    // to change them is the design, which withdraws the approval — see
    // app/api/marketing/designer/designs/[id]/route.js's PATCH.
    caption: design.caption || "",
    hashtags: design.hashtags || [],
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requireMarketingManager(member.role);
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can publish marketing content" },
      { status: err.status || 403 },
    );
  }

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The hide-until-approved gate, enforced here too ──────────────────────
  //
  // CampaignEditor.js doesn't render the Publish button at all for a real
  // company until metaAppConfigured() is true (see that file). This is the
  // server-side half — a hidden button is not access control, and a direct
  // POST must refuse the identical way the UI never offers it. One
  // connection fetch here, reused for the rest of this request instead of
  // queried twice.
  const connection = await getMetaConnection(member.companyId);
  const visible = isSocialPublishingVisible({ isDemo: connection.mock, appConfigured: metaAppConfigured() });
  if (!visible) {
    return NextResponse.json(
      {
        error: "not_available",
        message: "Instagram and Facebook publishing isn't available on this deployment yet.",
      },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ratioKey =
    typeof body?.ratioKey === "string" && ratioByKey(body.ratioKey) ? body.ratioKey : null;
  if (!ratioKey) {
    return NextResponse.json({ error: "A valid ratioKey is required." }, { status: 400 });
  }

  const platforms = Array.isArray(body?.platforms)
    ? [...new Set(body.platforms.filter((p) => PLATFORMS.has(p)))]
    : [];
  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "Choose at least one platform: facebook, instagram." },
      { status: 400 },
    );
  }

  // ── The approval gate ───────────────────────────────────────────────────
  //
  // Before the image is decoded, before anything is uploaded, and long before
  // Meta is called: an unapproved asset is not publishable, and neither is one
  // whose artwork or words changed after it was approved. Recomputed from the
  // rows loaded on THIS request.
  const approval = approvalState(design, design.layouts);
  if (!approval.ok) {
    return NextResponse.json(
      {
        error: approval.state === "stale" ? "approval_stale" : "not_approved",
        message:
          approval.state === "stale"
            ? "This design changed after it was approved. Review it and approve it again before posting."
            : "This design hasn't been approved yet. Review it and approve it before posting.",
        approval: { state: approval.state },
      },
      { status: 409 },
    );
  }

  // ── The caption is the design's, not the request's ──────────────────────
  //
  // A body carrying a different caption is REFUSED, not quietly overridden:
  // a silent override would post the approved words to a person who believes
  // they sent different ones, and a silent acceptance would post words nobody
  // approved. Refusing says which of the two happened. An absent caption in
  // the body is fine — that is a caller that already agrees.
  const caption = design.caption ? design.caption.trim() : "";
  if (typeof body?.caption === "string" && body.caption.trim() !== caption) {
    return NextResponse.json(
      {
        error: "approval_stale",
        message: "The caption changed since this was approved. Save it on the design and approve it again.",
        approval: { state: "stale" },
      },
      { status: 409 },
    );
  }

  const captionCheck = validateCaption(caption);
  // Instagram's own limits are the tighter of the two and are enforced here
  // for BOTH platforms when Instagram is one of the targets, so one caption
  // reads the same on both — see metaSpecs.js's own comment on this choice.
  if (platforms.includes("instagram") && !captionCheck.ok) {
    return NextResponse.json(
      { error: "invalid_caption", errors: captionCheck.errors, counts: captionCheck.counts },
      { status: 400 },
    );
  }

  // ── scheduledFor: absent/null/"" means publish now ───────────────────────
  //
  // Parsed with the platform-agnostic bare `new Date(...)` constructor —
  // never manual offset arithmetic — specifically so a DST transition
  // between "now" and the chosen moment can't shift the boundary by an
  // hour: epoch milliseconds (what Date stores and compares) have no
  // timezone to fall out of step with. The browser sends an ISO string with
  // its own offset baked in (see PublishModal.js), so this reconstructs the
  // exact instant the contractor picked, in whatever timezone they're in.
  let scheduledFor = null;
  if (body?.scheduledFor !== undefined && body?.scheduledFor !== null && body?.scheduledFor !== "") {
    const parsed = new Date(body.scheduledFor);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "invalid_schedule", message: "That isn't a valid date and time." },
        { status: 400 },
      );
    }
    scheduledFor = parsed;
  }

  // Demo-only, and only ever honored per-platform below when that
  // platform's connection is the mock — see SIMULATABLE_FAILURES above.
  const simulateFailure = SIMULATABLE_FAILURES.has(body?.simulateFailure) ? body.simulateFailure : null;

  const dataUrl = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  if (!base64) {
    return NextResponse.json({ error: "An image is required." }, { status: 400 });
  }
  // Rough pre-check on the encoded length before paying for the decode —
  // base64 runs ~4/3 the size of the decoded bytes.
  if (base64.length > (MAX_UPLOAD_BYTES * 4) / 3) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return NextResponse.json({ error: "Couldn't read the image data." }, { status: 400 });
  }
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  }

  if (!connection?.connected) {
    // No upload, no Meta call — refused before anything is spent proving a
    // point the connection check already answers. For a real company this
    // is the ONLY response this route can honestly give today; see
    // lib/social/metaConnection.js's header for what has to land before it
    // can be anything else. A demo company never reaches this branch —
    // getMetaConnection() always returns connected:true for one.
    return NextResponse.json(
      {
        error: "not_connected",
        message:
          "Instagram and Facebook publishing isn't connected yet for this company.",
      },
      { status: 409 },
    );
  }

  // Uploaded once, reused for every requested platform — a contractor
  // posting to both gets one image, not two separately-encoded copies. Also
  // reused by a SCHEDULED post: the image is rendered and uploaded now, at
  // schedule time, precisely so a scheduled row's fire time (days later,
  // possibly after the design itself is edited or deleted) still has the
  // exact pixels that were previewed and confirmed.
  let uploaded;
  try {
    uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${member.companyId}/social`,
      resourceType: "image",
    });
  } catch (err) {
    console.error("[marketing/designer/publish] upload failed", err?.message);
    return NextResponse.json({ error: "Couldn't upload the image. Nothing was posted." }, { status: 502 });
  }

  const results = {};
  for (const platform of platforms) {
    // eslint-disable-next-line no-await-in-loop
    results[platform] = await publishOnePlatform({
      platform,
      connection,
      imageUrl: uploaded.secure_url,
      width: uploaded.width,
      height: uploaded.height,
      fileSizeBytes: uploaded.bytes,
      caption,
      member,
      design,
      ratioKey,
      scheduledFor,
      simulateFailure,
    });
  }

  const anyPublished = Object.values(results).some((r) => r.status === "published");
  const anyScheduled = Object.values(results).some((r) => r.status === "scheduled");
  await recordActivity(member, {
    action: scheduledFor ? "marketing.social_schedule" : "marketing.social_publish",
    entityType: "settings",
    entityId: design.id,
    summary: anyPublished
      ? `Published "${design.name}" to ${platforms.join(", ")}`
      : anyScheduled
        ? `Scheduled "${design.name}" for ${platforms.join(", ")} at ${scheduledFor?.toISOString()}`
        : `Attempted to publish "${design.name}" to ${platforms.join(", ")}`,
    metadata: { platforms, scheduledFor, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])) },
  }).catch(() => {});

  return NextResponse.json({ results });
}

// Maps validateInstagramSchedule()'s/the Facebook window check's error
// vocabulary onto the SAME per-platform result codes an immediate publish
// already returns (invalid_caption, invalid_image) plus the one new one
// (invalid_schedule) — so the modal doesn't need a second failure shape to
// render just because the request was a schedule instead of a publish.
const CAPTION_ERROR_CODES = new Set(["empty", "too_long", "too_many_hashtags", "too_many_mentions"]);
const IMAGE_ERROR_CODES = new Set(["no_dimensions", "aspect_ratio", "file_too_large"]);

function scheduleFailureFrom(errors) {
  if (errors.some((e) => CAPTION_ERROR_CODES.has(e))) {
    return new PublishRefusal("invalid_caption", "Fix the caption before scheduling.", { errors });
  }
  if (errors.some((e) => IMAGE_ERROR_CODES.has(e))) {
    return new PublishRefusal("invalid_image", "This image doesn't meet Instagram's requirements.", { errors });
  }
  return new PublishRefusal("invalid_schedule", "Choose a valid date and time to schedule this post.", { errors });
}

async function publishOnePlatform({
  platform,
  connection,
  imageUrl,
  width,
  height,
  fileSizeBytes,
  caption,
  member,
  design,
  ratioKey,
  scheduledFor,
  simulateFailure,
}) {
  const isMock = Boolean(connection.mock);
  const client = isMock ? mockMetaGraphClient : metaGraphClient;
  // Never honored for a real connection — a real company posting this field
  // in the body is simply ignored, same as any other unrecognised input.
  const effectiveSimulateFailure = isMock ? simulateFailure : null;

  const row = await db.socialPublish.create({
    data: {
      companyId: member.companyId,
      designId: design.id,
      ratioKey,
      platform,
      caption,
      imageUrl,
      width,
      height,
      isMock,
      scheduledFor: scheduledFor || null,
      status: "pending",
    },
  });

  // Instagram is ALWAYS queued when scheduled — it has no native scheduling
  // parameter, and creating a container now would leave it to expire before
  // a distant scheduledFor ever arrives. A demo (mock) connection queues
  // Facebook too, for the reason this file's header explains: there is no
  // real Meta scheduler standing behind a fabricated connection to hand a
  // post to. Both cases below reuse validateInstagramSchedule()'s exact
  // window/caption/image logic — or, for Facebook, the identical
  // isValidFacebookScheduleTime() a real Facebook schedule is about to be
  // held to a few lines further down — WITHOUT ever calling `client`.
  const queueOnly = Boolean(scheduledFor) && (platform === "instagram" || isMock);
  if (queueOnly) {
    const check =
      platform === "instagram"
        ? validateInstagramSchedule({ caption, width, height, fileSizeBytes, scheduledFor, now: new Date() })
        : {
            ok: isValidFacebookScheduleTime(scheduledFor),
            errors: isValidFacebookScheduleTime(scheduledFor) ? [] : ["invalid_schedule"],
          };

    if (!check.ok) {
      return failRow(row, scheduleFailureFrom(check.errors), platform);
    }

    await db.socialPublish.update({ where: { id: row.id }, data: { status: "scheduled" } });
    return { status: "scheduled", scheduledFor };
  }

  // Everything else: an immediate publish on either platform, OR a REAL
  // Facebook schedule — Meta's own /{page-id}/photos endpoint holds that one
  // for us the instant this call succeeds, so nothing further has to touch
  // it (the scheduling cron explicitly skips real, non-mock Facebook rows —
  // see app/api/cron/social-scheduled-publish/route.js).
  try {
    const result =
      platform === "instagram"
        ? await publishToInstagram({
            connection,
            imageUrl,
            caption,
            width,
            height,
            fileSizeBytes,
            client,
            simulateFailure: effectiveSimulateFailure,
          })
        : await publishToFacebook({
            connection,
            imageUrl,
            caption,
            fileSizeBytes,
            scheduledPublishTime: scheduledFor || undefined,
            client,
            simulateFailure: effectiveSimulateFailure,
          });

    await db.socialPublish.update({
      where: { id: row.id },
      data: {
        // "published" or, for a real Facebook schedule, "scheduled" — never
        // hardcoded "published" here, which used to be the bug: before this
        // was wired to a UI, a scheduled Facebook result's `status` field
        // was silently overwritten to "published" the instant the *native
        // scheduling call itself* succeeded, which is not the same fact.
        status: result.status,
        externalContainerId: result.containerId || null,
        externalPostId: result.postId,
        publishedAt: result.status === "published" ? new Date() : null,
      },
    });

    return { status: result.status, postId: result.postId, scheduledFor: scheduledFor || null };
  } catch (err) {
    return failRow(row, err, platform);
  }
}

async function failRow(row, err, platform) {
  if (err instanceof PublishRefusal) {
    const status = err.code === "rate_limited" ? "rate_limited" : "failed";
    await db.socialPublish.update({
      where: { id: row.id },
      data: { status, errorMessage: err.message, externalContainerId: err.containerId || null },
    });
    return { status, code: err.code, message: err.message, rate: err.rate };
  }

  console.error("[marketing/designer/publish]", platform, err);
  await db.socialPublish.update({
    where: { id: row.id },
    data: { status: "failed", errorMessage: "Unexpected error" },
  });
  return { status: "failed", code: "unexpected", message: "Something went wrong. Nothing was posted." };
}
