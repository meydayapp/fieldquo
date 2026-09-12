// lib/notify/pushSubscriptionRoute.js
//
// The push-subscription route, written once and mounted three times:
//
//   app/api/notifications/push-subscription   an /app member   (memberOrRefusal)
//   app/api/sales/push-subscription           a sales rep      (requireOutreachRep)
//   app/api/platform/push-subscription        a platform admin (getCurrentPlatformAdmin)
//
// Three mounts rather than one route with a `surface` parameter because
// middleware.js gates the three prefixes with three different sessions —
// a rep's cookie cannot reach /api/notifications and an /app session
// cannot reach /api/sales — and because each surface's gate is the thing
// that decides who the person IS. The route never learns the identity from
// the body; the gate hands it a single owner column and everything below
// scopes to that column.
//
// ══ Verbs ═════════════════════════════════════════════════════════════════
//
//   GET     { configured, publicKey, live }   — is push set up here, the
//           public VAPID key to subscribe with (null when not), and how many
//           live subscriptions this person has across their browsers.
//   POST    { endpoint, keys: { p256dh, auth } }  — store this browser's
//           subscription for this person. Upsert on endpoint: an endpoint is
//           one browser, and if another account on the same machine had it,
//           it is re-owned, not duplicated. Clears disabledAt.
//   POST    { test: true }  — send a test push to every live subscription
//           this person has, so "Send a test notification" proves the whole
//           path and not just the in-tab half. Answers with the sender's
//           counts.
//   DELETE  { endpoint }  — disabledAt = now on this person's row for that
//           endpoint. Never deletes: the row is the record.
//
// Impersonation (read-only support sessions) reaches the /app mount with a
// member whose userId is null; the owner resolver refuses that — a support
// agent must not subscribe THEIR browser to a customer's events.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pushConfig, sendToSubscriptions } from "@/lib/notify/push";
import { ownerData, parseSubscription } from "@/lib/notify/pushSubscription";

/**
 * @param {(request) => Promise<{ owner?: object, refusal?: { status, body } }>} resolveOwner
 * @param {{ testPayload: (language) => object }} [options]
 */
export function pushSubscriptionHandlers(resolveOwner, options = {}) {
  const testPayload = options.testPayload || (() => ({
    title: "FieldQuo",
    body: "Notifications are working in this browser.",
    tag: "fq-test",
    url: options.testUrl || "/",
  }));

  async function gate(request) {
    const { owner, refusal } = await resolveOwner(request);
    if (refusal) return { response: NextResponse.json(refusal.body, { status: refusal.status }) };
    const data = ownerData(owner);
    if (!data) return { response: NextResponse.json({ error: "No account to subscribe for." }, { status: 403 }) };
    return { data };
  }

  /** The WHERE that scopes every read and write to the signed-in person. */
  const mine = (data) => Object.fromEntries(Object.entries(data).filter(([, v]) => v));

  async function GET(request) {
    const { data, response } = await gate(request);
    if (response) return response;
    const config = pushConfig();
    const live = config.configured
      ? await db.pushSubscription.count({ where: { ...mine(data), disabledAt: null } })
      : 0;
    return NextResponse.json({ configured: config.configured, publicKey: config.publicKey, live });
  }

  async function POST(request) {
    const { data, response } = await gate(request);
    if (response) return response;
    const config = pushConfig();
    if (!config.configured) {
      return NextResponse.json({ error: "Push notifications are not set up on this deployment." }, { status: 409 });
    }
    let body = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
    }

    if (body?.test === true) {
      const rows = await db.pushSubscription.findMany({
        where: { ...mine(data), disabledAt: null },
        select: { id: true, endpoint: true, keysP256dh: true, keysAuth: true },
      });
      const result = await sendToSubscriptions(
        rows.map((r) => ({ ...r, language: body.language || "en" })),
        testPayload,
      );
      return NextResponse.json({ ok: true, ...result });
    }

    const sub = parseSubscription(body);
    if (!sub) return NextResponse.json({ error: "That is not a push subscription." }, { status: 400 });
    const userAgent = String(request.headers.get("user-agent") || "").slice(0, 300) || null;
    await db.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { ...sub, ...data, userAgent },
      update: { keysP256dh: sub.keysP256dh, keysAuth: sub.keysAuth, ...data, userAgent, disabledAt: null },
    });
    return NextResponse.json({ ok: true });
  }

  async function DELETE(request) {
    const { data, response } = await gate(request);
    if (response) return response;
    let body = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const endpoint = String(body?.endpoint || "").trim();
    // With no endpoint (the browser lost its subscription before the
    // person switched off) every live row of theirs is disabled — the
    // switch means "stop", and a row for a browser they cannot name any
    // more is exactly the one that should stop.
    const where = endpoint ? { ...mine(data), endpoint } : { ...mine(data), disabledAt: null };
    const result = await db.pushSubscription.updateMany({ where, data: { disabledAt: new Date() } });
    return NextResponse.json({ ok: true, disabled: result.count });
  }

  return { GET, POST, DELETE };
}
