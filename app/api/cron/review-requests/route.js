// app/api/cron/review-requests/route.js
//
// Hourly: ask recently-finished customers for a review.
//
// ══ Hourly, not daily ══════════════════════════════════════════════════════
//
// The delay is configurable per company and the useful range starts at a few
// hours ("ask them this evening, while it still looks new"). A daily cron
// would round every one of those up to the next 8am, which quietly turns a
// 4-hour delay into an 18-hour one and makes the setting a lie.
//
// ══ The claim happens before the send ══════════════════════════════════════
//
// `reviewRequestedAt` is written FIRST, with a conditional update that only
// matches rows where it's still null. If two runs overlap — which they will,
// because a slow Resend call can outlast the hour — the second one updates
// zero rows and skips. Sending first and stamping after would mean a customer
// gets asked twice by a company they've already reviewed, which is the single
// most embarrassing failure this feature has.
//
// The trade is that a send failing after the claim means that customer is
// never asked. That's the right way round: not asking costs a review, asking
// twice costs the relationship.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { shouldRequestReview, clampDelay, MAX_DELAY_HOURS } from "@/lib/reviews/request";
import { buildReviewEmail } from "@/lib/reviews/reviewEmail";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";

const HOUR = 60 * 60 * 1000;

export async function GET(request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Only companies that have switched it on AND have somewhere to send people.
  // Both are checked again per-job by shouldRequestReview; narrowing here is
  // purely so a cron on an instance where nobody uses this reads three rows
  // instead of every completed job in the database.
  const companies = await db.company.findMany({
    where: { reviewRequestsEnabled: true, reviewUrl: { not: null } },
    select: {
      id: true, name: true, email: true, phone: true, website: true,
      address: true, city: true, province: true,
      logoUrl: true, brandColor: true, brandColors: true,
      defaultLanguage: true,
      reviewUrl: true, reviewDelayHours: true, reviewRequestsEnabled: true,
    },
  });

  let sent = 0;
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const company of companies) {
    // The window: finished long enough ago to be due, recently enough that we
    // haven't missed the boat. Both ends matter — without the older bound, a
    // company switching this on today would fire at every customer they've
    // ever had, which is a spam complaint and a domain-reputation problem.
    const due = new Date(now - clampDelay(company.reviewDelayHours) * HOUR);
    const floor = new Date(now - MAX_DELAY_HOURS * HOUR);

    const jobs = await db.job.findMany({
      where: {
        companyId: company.id,
        status: "completed",
        reviewRequestedAt: null,
        completedAt: { not: null, lte: due, gte: floor },
      },
      select: {
        id: true, status: true, completedAt: true, reviewRequestedAt: true,
        client: { select: { id: true, name: true, email: true, language: true } },
      },
      // A cap, so one company with a backlog can't consume the whole run and
      // starve everyone after them in the loop. The rest are picked up next
      // hour; nothing is dropped, because the query is driven by state rather
      // than by a cursor.
      take: 50,
    });

    for (const job of jobs) {
      const client = job.client;

      // Has this person unsubscribed? Looked up by email against the marketing
      // list, which is where unsubscribes already live — a review request is
      // not an invoice, nobody needs it, so "leave me alone" wins.
      let subscribed = true;
      if (client?.email) {
        const sub = await db.marketingSubscriber.findUnique({
          where: { companyId_email: { companyId: company.id, email: client.email } },
          select: { subscribed: true },
        });
        if (sub && sub.subscribed === false) subscribed = false;
      }

      const verdict = shouldRequestReview({ job, company, client, subscribed, now });
      if (!verdict.send) { note(verdict.reason); continue; }

      // ── Claim it, then send ───────────────────────────────────────────────
      const claim = await db.job.updateMany({
        where: { id: job.id, reviewRequestedAt: null },
        data: { reviewRequestedAt: now },
      });
      if (claim.count === 0) { note("Another run got there first."); continue; }

      const language = resolveClientLanguage({ client, company });
      const email = buildReviewEmail({ company, client, language });
      if (!email) { note("Couldn't build the email."); continue; }

      // sendEmail does NOT throw. It returns `{ id }`, `{ error }` or
      // `{ skipped: true }`, and the three need different answers — a
      // try/catch here would have caught nothing while every customer was
      // marked as asked.
      const result = await sendEmail({
        to: client.email,
        subject: email.subject,
        html: email.html,
        // The contractor's own domain when they have one verified, and
        // replies land in their inbox — including the "actually, something
        // was wrong" replies the email invites.
        ...(await resolveSender(company, company.id)),
      });

      if (result?.skipped) {
        // No mail provider configured, so nothing was sent and nothing COULD
        // have been. The claim is released: leaving it would mean a company
        // that switches this on before verifying their domain silently burns
        // every customer they have, one per hour, with no email going out and
        // no way to ever ask them again.
        await db.job.updateMany({ where: { id: job.id }, data: { reviewRequestedAt: null } });
        note("Email isn't configured yet.");
        continue;
      }

      if (result?.error) {
        // Ambiguous — this covers both "Resend rejected it" and "the request
        // threw after possibly being accepted". The claim STANDS, because
        // asking twice costs more than not asking. sendEmail has already
        // recorded the error durably for support.
        note("Send failed.");
        continue;
      }

      sent++;
    }
  }

  return NextResponse.json({ success: true, sent, skipped });
}
