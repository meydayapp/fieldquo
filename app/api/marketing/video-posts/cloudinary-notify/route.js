// app/api/marketing/video-posts/cloudinary-notify/route.js
//
// Cloudinary posts here when a video post's clip has finished uploading and
// its incoming transformation (1080p, 9:16 when chosen, trimmed at 2:30) has
// run. The URL is SIGNED into each upload (`notification_url`, built by
// app/api/marketing/video-posts/route.js) — nothing else in the product posts
// here, and nothing the body says is trusted before the signature is:
//
//   - X-Cld-Signature over (raw body + X-Cld-Timestamp + our API secret),
//     refused when stale (lib/marketing/videoUpload.js verifyNotification);
//   - the public_id must be one a video post of ours is waiting for — the
//     company comes from OUR row, never from the payload;
//   - the arrival itself goes through the same settleArrival the video
//     screen's own lookup uses, so the two landing together count the clip
//     once.
//
// Answers 200 to anything it recognises and cannot use (a post already
// settled, an id that isn't ours) — a 5xx would only make Cloudinary retry
// something that will never succeed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationFailure, verifyNotification } from "@/lib/marketing/videoUpload";
import { settleArrival } from "@/lib/marketing/videoPostServer";
import { arrivalFailurePatch } from "@/lib/marketing/videoArchive";
import { recordError } from "@/lib/platform/errorLog";

export async function POST(request) {
  const raw = await request.text();
  const ok = verifyNotification({
    body: raw,
    timestamp: request.headers.get("x-cld-timestamp"),
    signature: request.headers.get("x-cld-signature"),
    secret: process.env.CLOUDINARY_API_SECRET,
  });
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true, ignored: "not_json" });
  }

  const publicId = typeof payload?.public_id === "string" ? payload.public_id : "";
  if (!publicId) return NextResponse.json({ received: true, ignored: "no_public_id" });
  const post = await db.videoPost.findFirst({ where: { videoPublicId: publicId } });
  if (!post) return NextResponse.json({ received: true, ignored: "unknown_clip" });
  if (!["uploading", "processing"].includes(post.uploadState)) {
    return NextResponse.json({ received: true, ignored: "already_settled" });
  }

  const failure = notificationFailure(payload);
  if (failure) {
    // A restore from the archive that Cloudinary could not take leaves the
    // post archived (its R2 copy is untouched) rather than failed.
    await db.videoPost.updateMany({
      where: { id: post.id, uploadState: { in: ["uploading", "processing"] } },
      data: arrivalFailurePatch(post, "cloudinary_failed"),
    });
    await recordError({
      area: "video-posts",
      code: "cloudinary_upload_failed",
      message: `Cloudinary could not prepare a video post's clip: ${failure}`,
      companyId: post.companyId,
      detail: { videoPostId: post.id },
    }).catch(() => {});
    return NextResponse.json({ received: true, settled: "failed" });
  }

  try {
    const result = await settleArrival(post, payload);
    return NextResponse.json({ received: true, settled: result.settled ? "ready" : "noop", code: result.code || null });
  } catch (err) {
    // A database blip — let Cloudinary retry; the screen's lookup is the backstop.
    console.error("[video-posts/notify] settle failed:", err?.message);
    return NextResponse.json({ error: "settle failed" }, { status: 500 });
  }
}
