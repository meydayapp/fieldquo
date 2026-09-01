// app/api/marketing/designer/designs/[id]/publish/route.js
//
// POST — publish a rendered MarketingDesign asset to the company's connected
// Facebook Page and/or Instagram account, one platform at a time so a
// Facebook success and an Instagram failure never masquerade as a single
// pass/fail. GET — connection status plus this design's publish history, so
// the modal can show "already posted this today" instead of inviting a
// duplicate.
//
// This route never trusts the browser's word that a connection exists — it
// re-checks lib/social/metaConnection.js itself, same as every money amount
// in this codebase is re-priced server-side rather than taken from the
// client (AGENTS.md non-negotiable #5, the identical discipline applied to
// "are we actually allowed to do this" instead of "what does this cost").
// In this build getMetaConnection() always returns connected: false — see
// that file's own header for why, and what must change for this route to
// start actually posting.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { uploadBuffer } from "@/lib/cloudinary";
import { ratio as ratioByKey } from "@/lib/marketing/ratios";
import { validateCaption, INSTAGRAM_COMPLIANT_RATIO_KEY } from "@/lib/social/metaSpecs";
import { getMetaConnection } from "@/lib/social/metaConnection";
import { publishToInstagram, publishToFacebook, PublishRefusal } from "@/lib/social/publishDesign";
import * as metaGraphClient from "@/lib/social/metaGraphClient";

function requireMarketingManager(role) {
  // Same axis as every other write in this area — see
  // app/api/marketing/designer/designs/[id]/route.js.
  requirePermission(role, "user:manage");
}

async function loadOwned(companyId, id) {
  const design = await db.marketingDesign.findUnique({
    where: { id },
    include: { campaign: { select: { id: true, name: true } } },
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

  return NextResponse.json({
    connected: Boolean(connection?.connected),
    pageName: connection?.pageName || null,
    instagramUsername: connection?.instagramUsername || null,
    history,
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

  const caption = typeof body?.caption === "string" ? body.caption.trim() : "";
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

  const connection = await getMetaConnection(member.companyId);
  if (!connection?.connected) {
    // No upload, no Meta call — refused before anything is spent proving a
    // point the connection check already answers. This is the ONLY response
    // this route can honestly give in the current build; see
    // lib/social/metaConnection.js's header for what has to land before it
    // can be anything else.
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
  // posting to both gets one image, not two separately-encoded copies.
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
    });
  }

  const anyPublished = Object.values(results).some((r) => r.status === "published");
  await recordActivity(member, {
    action: "marketing.social_publish",
    entityType: "settings",
    entityId: design.id,
    summary: anyPublished
      ? `Published "${design.name}" to ${platforms.join(", ")}`
      : `Attempted to publish "${design.name}" to ${platforms.join(", ")}`,
    metadata: { platforms, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])) },
  }).catch(() => {});

  return NextResponse.json({ results });
}

async function publishOnePlatform({ platform, connection, imageUrl, width, height, fileSizeBytes, caption, member, design, ratioKey }) {
  const row = await db.socialPublish.create({
    data: {
      companyId: member.companyId,
      designId: design.id,
      ratioKey,
      platform,
      caption,
      imageUrl,
      status: "pending",
    },
  });

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
            client: metaGraphClient,
          })
        : await publishToFacebook({
            connection,
            imageUrl,
            caption,
            fileSizeBytes,
            client: metaGraphClient,
          });

    await db.socialPublish.update({
      where: { id: row.id },
      data: {
        status: "published",
        externalContainerId: result.containerId || null,
        externalPostId: result.postId,
        publishedAt: new Date(),
      },
    });

    return { status: "published", postId: result.postId };
  } catch (err) {
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
}
