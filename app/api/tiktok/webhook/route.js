// app/api/tiktok/webhook/route.js
//
// TikTok's webhook callback, registered in the developer portal as
// https://www.fieldquo.com/api/tiktok/webhook. TikTok POSTs JSON
// `{ client_key, event, create_time, user_openid, content }` where `content`
// is itself a JSON STRING (developers.tiktok.com/doc/webhooks-events).
//
// ── Verified before anything is read ──────────────────────────────────────
//
// `TikTok-Signature: t=<ts>,s=<hex>` = HMAC-SHA256(client secret,
// `${t}.${rawBody}`), checked over the raw bytes with a constant-time compare
// and a five-minute replay window (developers.tiktok.com/doc/
// webhooks-verification; lib/tiktok/signing.js). An unsigned or stale request
// is a 401 and changes nothing. The body's client_key must also be ours.
//
// ── Idempotent, because TikTok retries ────────────────────────────────────
//
// "at least once delivery", retried with backoff for up to 72 hours
// (developers.tiktok.com/doc/webhooks-overview). Every write goes through
// lib/tiktok/specs.js statusPatch(), which never moves a finished post and
// returns nothing to write for a duplicate — so the fifth copy of
// post.publish.complete does exactly what the first did, which is nothing
// more. A database failure answers 500 so TikTok's retry is what recovers it.
//
// ── Tenancy ──────────────────────────────────────────────────────────────
//
// A publish event is matched on TikTok's publish_id AND the row's openId must
// equal the event's user_openid — a publish id alone is never enough to write
// into a company's row. authorization.removed stamps every live connection
// for that TikTok account as disconnected; the row is kept (never deleted).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tiktokClientKey, tiktokClientSecret } from "@/lib/tiktok/config";
import { verifyWebhookSignature } from "@/lib/tiktok/signing";
import { markAuthorizationRemoved } from "@/lib/tiktok/connection";
import { observationFromWebhook, statusPatch } from "@/lib/tiktok/specs";

export async function POST(request) {
  const rawBody = await request.text();
  const verdict = verifyWebhookSignature({
    header: request.headers.get("tiktok-signature"),
    rawBody,
    secret: tiktokClientSecret(),
    nowSeconds: Date.now() / 1000,
  });
  if (!verdict.ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: verdict.reason === "no_secret" ? 503 : 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!payload || payload.client_key !== tiktokClientKey()) {
    return NextResponse.json({ error: "Unknown client" }, { status: 401 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const openId = typeof payload.user_openid === "string" ? payload.user_openid : null;
  let content = {};
  if (typeof payload.content === "string") {
    try {
      content = JSON.parse(payload.content) || {};
    } catch {
      content = {};
    }
  } else if (payload.content && typeof payload.content === "object") {
    content = payload.content;
  }

  if (event === "authorization.removed") {
    const count = await markAuthorizationRemoved(openId);
    return NextResponse.json({ ok: true, disconnected: count });
  }

  const observation = observationFromWebhook(event, content);
  const publishId = content?.publish_id != null ? String(content.publish_id) : null;
  if (!observation || !publishId || !openId) {
    // An event this integration does not act on (or one missing the ids it
    // would need) — acknowledged so TikTok stops retrying it.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const row = await db.tikTokPublish.findUnique({ where: { publishId } });
  if (!row || row.openId !== openId) return NextResponse.json({ ok: true, ignored: true });

  const patch = statusPatch(row, observation);
  if (patch) {
    await db.tikTokPublish.updateMany({ where: { id: row.id, status: row.status }, data: patch });
  }
  return NextResponse.json({ ok: true, updated: Boolean(patch) });
}
