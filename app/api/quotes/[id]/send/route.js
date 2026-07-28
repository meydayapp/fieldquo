// app/api/quotes/[id]/send/route.js
//
// Actually emails the quote to the client.
//
// ── What was here before ────────────────────────────────────────────────────
//
// Nothing. The "Send" button called PATCH { status: "sent" }, which changed a
// word on screen and then hid the button because the status was no longer
// draft. Every signal the user had said the quote went out. No email was ever
// constructed, no send was ever attempted, and no error was ever possible —
// because nothing was tried.
//
// ── Rules this route holds to ───────────────────────────────────────────────
//
//  1. sentAt is written AFTER Resend accepts the message, never before. A
//     timestamp that records an intention rather than an event is worse than
//     no timestamp: it's a claim the company will repeat to a client.
//  2. A failed send returns a real error and leaves the status alone. The
//     quote stays a draft, the Send button stays visible, and the person can
//     try again — rather than being left with a "sent" quote and an empty
//     inbox.
//  3. The share token is minted here if it doesn't exist, so sending always
//     produces a working link. The old follow-up cron emailed `/q/undefined`
//     for exactly this reason.
export const runtime = "nodejs";

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { getAppOrigin } from "@/lib/appUrl";
import { sendEmail, senderFor, SENDER_SELECT } from "@/lib/email/resend";
import { buildQuoteEmail } from "@/lib/email/quoteEmail";

export async function POST(request, { params }) {
  const { id } = await params;

  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Emailing a client is the same weight as editing the quote — it puts a
  // priced offer in front of someone on the company's behalf.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "quotes", "view_create_edit", "send quotes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const isFollowUp = body?.kind === "follow_up";

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    include: { client: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = quote.client?.email?.trim();
  if (!to) {
    return NextResponse.json(
      {
        error: `${quote.client?.name || "This client"} has no email address on file. Add one on their client record, then send.`,
      },
      { status: 400 },
    );
  }

  // A follow-up on something never sent is just a confusing first contact.
  if (isFollowUp && !quote.sentAt) {
    return NextResponse.json(
      { error: "This quote hasn't been sent yet — send it first." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      ...SENDER_SELECT,
      logoUrl: true,
      brandColor: true,
      phone: true,
    },
  });

  // Mint the link if this quote has never been shared. Doing it here rather
  // than expecting the caller to have pressed "Get approved" first means the
  // email can never contain a dead URL.
  let shareToken = quote.shareToken;
  if (!shareToken) {
    shareToken = randomBytes(32).toString("base64url");
    await db.quote.update({ where: { id: quote.id }, data: { shareToken } });
  }

  const url = `${getAppOrigin(request)}/q/${shareToken}`;
  const { from, replyTo } = senderFor(company || {});

  const { subject, html, text } = buildQuoteEmail({
    quote,
    client: quote.client,
    company: company || {},
    url,
    kind: isFollowUp ? "follow_up" : "quote",
  });

  const result = await sendEmail({ to, subject, html, text, from, replyTo });

  // sendEmail returns { skipped } rather than throwing when RESEND_API_KEY is
  // absent. Treating that as success is how a deployment with no mail
  // configured ends up with a database full of quotes marked sent.
  if (result?.skipped) {
    return NextResponse.json(
      {
        error:
          "Email isn't configured on this deployment yet — RESEND_API_KEY is missing, so nothing was sent.",
      },
      { status: 503 },
    );
  }

  if (result?.error) {
    return NextResponse.json(
      { error: explainSendError(result.error, from) },
      { status: 502 },
    );
  }

  // Only now. See rule 1.
  const updated = await db.quote.update({
    where: { id: quote.id },
    data: isFollowUp
      ? {
          followUpSentAt: new Date(),
          followUpCount: { increment: 1 },
        }
      : {
          sentAt: new Date(),
          sentToEmail: to,
          // A quote already accepted or declined shouldn't be dragged back to
          // "sent" by someone re-emailing a copy of it.
          ...(quote.status === "draft" ? { status: "sent" } : {}),
        },
    select: {
      status: true,
      sentAt: true,
      sentToEmail: true,
      followUpSentAt: true,
      followUpCount: true,
    },
  });

  return NextResponse.json({ ...updated, to, messageId: result?.id || null });
}

/**
 * Resend's failures are mostly configuration, and each has a different fix.
 *
 * The one that will bite hardest in practice is the unverified-domain case:
 * until a domain is verified, Resend's shared `onboarding@resend.dev` sender
 * only delivers to the address on the Resend account itself. Mail to anyone
 * else is accepted by the API and silently dropped — which looks exactly like
 * a working send that never arrives.
 */
function explainSendError(error, from) {
  const message =
    typeof error === "string" ? error : error?.message || "Send failed";

  if (/domain is not verified|not verified/i.test(message)) {
    return (
      `Resend won't send from ${from} because that domain isn't verified. ` +
      "Either verify it under Settings → Email Domain, or set EMAIL_FROM to a domain that is."
    );
  }

  if (/testing emails|own email address|can only send/i.test(message)) {
    return (
      "Resend is in test mode: until a domain is verified it only delivers to " +
      "the address that owns the Resend account. Verify a domain under " +
      "Settings → Email Domain to send to clients."
    );
  }

  if (/api key|unauthorized|invalid.*key/i.test(message)) {
    return "Resend rejected the API key. Check RESEND_API_KEY in your Vercel settings.";
  }

  if (/rate|too many/i.test(message)) {
    return "Resend is rate-limiting sends right now. Wait a moment and try again.";
  }

  return `The email couldn't be sent. ${message}`;
}
