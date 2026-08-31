// app/api/cron/grace-warning/route.js
//
// Daily: tell a past-due company, in plain language, that they've gone
// read-only and how long they've got.
//
// ══ The defect this closes ══════════════════════════════════════════════════
//
// See lib/billing/graceWarning.js's header for the full history:
// Subscription.graceWarnedAt has meant "the daily job that sends the grace
// warning" since before that job existed. A card fails, lib/billing/access.js
// silently drops the company into 7 days of read-only, and nothing ever told
// them — they found out by hitting a wall in their own account, which is the
// most expensive silence in the product: not one phone line, their whole
// business record.
//
// ══ Two warnings, and why ═══════════════════════════════════════════════════
//
// This sends up to two emails per grace episode — a first heads-up and a
// final notice inside the last two days — not one. The reasoning, and why
// two days is not an arbitrary number, lives in lib/billing/graceWarning.js;
// this route only executes the decision, the same "cron stays thin" split
// billNumberRent uses for rentDecision.
//
// ══ Claim, send, and REVERT on failure — same as renewal-reminders ══════════
//
// This is a time-limited notice ("you have N days left") with a database
// column whose whole job is "don't send this twice". A Resend hiccup that
// permanently marks it sent would be worse than never claiming at all: the
// company would sail through the rest of the window in silence, believing
// (falsely, because nothing checks) that they'd been told. So the claim is
// provisional — written before the send to stop a concurrent run colliding —
// and rolled back to null if the send didn't actually happen, so tomorrow's
// run (still inside the window, in most cases) tries again.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildBillingEmail } from "@/lib/email/billingEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { graceWarningDecision } from "@/lib/billing/graceWarning";

// Same shape and same reasoning as renewal-reminders' BATCH: the work per row
// is at most one email, and a company list longer than this doesn't exist
// yet. Leftovers are picked up by tomorrow's run — the query is driven by
// `status`, not a cursor, so nothing is dropped.
const BATCH = 500;

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const origin = getAppOrigin(request);

  // Only ever `past_due` — see graceWarningDecision's header for why this is
  // asked at the query level too, not just inside the pure function: a
  // cancelled or active row should never even be considered a candidate.
  const subscriptions = await db.subscription.findMany({
    where: { status: "past_due" },
    select: {
      id: true,
      companyId: true,
      status: true,
      pastDueSince: true,
      graceWarnedAt: true,
      graceFinalWarnedAt: true,
      company: { select: { id: true, name: true, email: true } },
    },
    take: BATCH,
  });

  let sent = 0;
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const sub of subscriptions) {
    const decision = graceWarningDecision({
      status: sub.status,
      pastDueSince: sub.pastDueSince,
      graceWarnedAt: sub.graceWarnedAt,
      graceFinalWarnedAt: sub.graceFinalWarnedAt,
      now,
    });

    if (decision.action !== "warn_first" && decision.action !== "warn_final") {
      note(decision.action === "skip" ? decision.reason : decision.action);
      continue;
    }

    const isFinal = decision.action === "warn_final";
    // Which column this send claims. Chosen once, used for both the claim
    // and its revert, so the two can never drift apart.
    const field = isFinal ? "graceFinalWarnedAt" : "graceWarnedAt";

    // ── Claim (provisional) ───────────────────────────────────────────────
    //
    // Guarded on the field still being null, which it always is here by
    // construction (the decision only returns warn_first/warn_final when the
    // corresponding marker is unset) — this guard is what stops a SECOND,
    // concurrent invocation of this same cron run claiming the same send.
    const claim = await db.subscription.updateMany({
      where: { id: sub.id, [field]: null },
      data: { [field]: now },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }

    const to = sub.company?.email || (await ownerEmailFor(sub.companyId));
    if (!to) {
      await db.subscription.update({ where: { id: sub.id }, data: { [field]: null } });
      await recordError({
        area: "billing-email",
        code: "grace_warning_no_recipient",
        message: `Subscription ${sub.id} is past_due and due a grace warning, but no address could be found`,
        companyId: sub.companyId,
      });
      note("no_recipient");
      continue;
    }

    const { subject, html } = buildBillingEmail({
      kind: "grace",
      companyName: sub.company?.name || "Your company",
      daysLeft: decision.daysLeft,
      finalWarning: isFinal,
      billingUrl: `${origin}/app/settings/account-billing`,
    });

    const from = await getPlatformFrom();
    // sendEmail never throws — { id } | { error } | { skipped } — so the
    // three outcomes need checking, not a try/catch (AGENTS.md recurring
    // failure class #2).
    const result = await sendEmail({ from, to, subject, html });

    if (result?.error || result?.skipped) {
      // ── Revert the claim ──────────────────────────────────────────────
      //
      // A send that didn't happen must not look like one that did, or every
      // later run this episode would skip it forever — see the file header.
      await db.subscription.update({ where: { id: sub.id }, data: { [field]: null } });
      note(result.error ? "resend_rejected" : "no_api_key");
      continue;
    }

    sent++;
  }

  return NextResponse.json({ success: true, considered: subscriptions.length, sent, ...skipped });
}
