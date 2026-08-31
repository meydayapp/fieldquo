// app/api/unsubscribe/[token]/route.js
//
// Public, token-only, no session — the other half of Client.portalToken's
// pattern applied to MarketingSubscriber. See lib/marketing/unsubscribe.js
// for the token shape and the commercial/transactional classification this
// exists to serve.
//
// Two methods, deliberately different in what they do:
//
//   GET  — read-only. Returns who this is and whether they're already
//          unsubscribed. Does NOT mutate. Email link-scanners (Outlook Safe
//          Links, corporate proxies, some antivirus) pre-fetch links in
//          delivered mail with a plain GET; if GET unsubscribed on its own,
//          every scanned inbox would silently opt itself out before a human
//          ever saw the message. The visible page (app/unsubscribe/[token])
//          calls this to render, then asks for one click before it mutates.
//
//   POST — the mutation. No body is required and none is trusted beyond the
//          token in the URL — this is also the endpoint RFC 8058's
//          List-Unsubscribe-Post header points mailbox providers at, and
//          those providers POST with no user session of their own. That's
//          the point: a Gmail/Yahoo "Unsubscribe" chip can hit this directly
//          with zero page render, which is the actual one-click bar CASL
//          asks for, while a human clicking the in-body link gets the
//          confirm-button page first.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyUnsubscribe, unsubscribeDisclosureText } from "@/lib/marketing/unsubscribe";

async function loadByToken(token) {
  if (!token || typeof token !== "string") return null;
  return db.marketingSubscriber.findUnique({
    where: { unsubscribeToken: token },
    include: { company: { select: { name: true } } },
  });
}

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { token } = await params;
  const subscriber = await loadByToken(token);
  if (!subscriber) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 404 });
  }

  return NextResponse.json({
    email: subscriber.email,
    companyName: subscriber.company?.name || "",
    alreadyUnsubscribed: subscriber.subscribed === false,
  });
}

export async function POST(request, { params }) {
  const { token } = await params;
  const subscriber = await loadByToken(token);
  if (!subscriber) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 404 });
  }

  const companyName = subscriber.company?.name || "";
  const disclosure = unsubscribeDisclosureText(companyName);
  const verdict = applyUnsubscribe({ subscriber, disclosure });

  // Only writes `subscribed`/`unsubscribedAt`/`unsubscribeDisclosure` — never
  // a delete. The row, the email, the history of what they were sent all
  // stay; only whether we may email them changes.
  await db.marketingSubscriber.update({
    where: { id: subscriber.id },
    data: verdict.data,
  });

  return NextResponse.json({
    ok: true,
    email: subscriber.email,
    companyName,
    alreadyUnsubscribed: verdict.alreadyUnsubscribed,
  });
}
