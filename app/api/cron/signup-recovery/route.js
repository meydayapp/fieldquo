// app/api/cron/signup-recovery/route.js
//
// Daily: write once to somebody who started a FieldQuo signup and never
// reached the end of Stripe Checkout.
//
// The rule, the delay, the window and the CASL classification all live in
// lib/signup/abandoned.js, which is pure and therefore executable by
// scripts/check-abandoned-signup.mjs. This file is only responsible for being
// right about the queries, the claim, and the order of the side effects.
//
// ══ Mid-morning Eastern, not 09:00 UTC ═════════════════════════════════════
//
// Every other daily cron here fires at 05:00–10:00 UTC, which is the middle of
// the night for the market this product sells into. That is fine for a rent
// charge or a reconciliation; it is wrong for a letter whose only job is to
// start a conversation. 14:30 UTC is mid-morning Eastern year-round and lands
// at the top of the inbox rather than under everything that arrived since.
//
// ══ Claim, send, revert — the renewal-reminders trade, not review-requests' ═
//
// cron/review-requests claims before sending and accepts that a failed send is
// never retried, because asking twice is worse than not asking once. That is
// the wrong trade here for the same reason cron/renewal-reminders gives: the
// stamp is what makes "exactly once" true, so a Resend hiccup must not
// permanently consume the one letter this person is ever going to get. The
// claim is provisional and rolled back when the send did not happen.
//
// ══ The last check is against a fresh read ═════════════════════════════════
//
// lib/migrations/state.js's canWrite() is the model: the gate runs on rows read
// in the request that performs the action, never on a verdict computed
// earlier. A person can complete checkout between this cron's list query and
// its send, and "we emailed a paying customer to ask why they never paid" is
// the single worst outcome available here. So the subscription is re-read
// immediately before the send, in a query of its own.
export const runtime = "nodejs";

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildSignupRecoveryEmail } from "@/lib/email/signupRecoveryEmail";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { checkSuppression } from "@/lib/sales/suppression";
import { mailingAddress } from "@/lib/legal/mailingAddress";
import {
  incompleteSignupWhere,
  nudgeRecipient,
  planSignupNudges,
} from "@/lib/signup/abandoned";

// Same shape and same reasoning as renewal-reminders' BATCH: the work per row
// is at most one suppression read and one email, the query is driven by state
// rather than a cursor, and anything left over is picked up tomorrow. Twenty
// rows match today.
const BATCH = 500;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);

  // ── The whole population, not just the due ones ─────────────────────────
  //
  // Deliberately unfiltered by age or by signupNudgeSentAt. The address rule
  // in planSignupNudges needs every company sharing an inbox to be present —
  // four of the five "sunset" rows are one person, and a query that fetched
  // only the due ones would have found four due companies and sent four
  // letters. Refusals are counted below, so an over-wide query is visible in
  // the response rather than silent.
  const rows = await db.company.findMany({
    where: { isDemo: false, ...incompleteSignupWhere() },
    select: {
      id: true,
      name: true,
      email: true,
      isDemo: true,
      createdAt: true,
      defaultLanguage: true,
      signupNudgeSentAt: true,
      subscription: { select: { id: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: BATCH,
  });

  const companies = rows.map((c) => ({ ...c, memberCount: c._count.members }));

  // ── The do-not-contact list, read now, once per address ─────────────────
  //
  // Re-read in the request that sends, which is the rule lib/sales/suppression
  // states and the reason it refuses to cache a verdict: an opt-out that
  // arrived overnight has to win.
  const addresses = [
    ...new Set(companies.map((c) => nudgeRecipient(c.email)).filter(Boolean)),
  ];
  const suppressedAddresses = new Set();
  for (const email of addresses) {
    const verdict = await checkSuppression(db, { channel: "email", email });
    if (verdict.suppressed) suppressedAddresses.add(email);
  }

  const { sends, skipped } = planSignupNudges({ companies, suppressedAddresses, now });

  const counts = {};
  const note = (reason) => { counts[reason] = (counts[reason] || 0) + 1; };
  for (const s of skipped) note(s.reason);

  // Read once. An unset SALES_MAILING_ADDRESS makes buildSignupRecoveryEmail
  // throw, which is the right answer — but it should be one logged refusal for
  // the run, not one per recipient.
  const address = mailingAddress();
  if (sends.length && !address) {
    await recordError({
      area: "signup",
      code: "signup_recovery_no_mailing_address",
      message:
        `SALES_MAILING_ADDRESS is unset, so ${sends.length} signup-recovery ` +
        "email(s) were not sent — CASL requires a mailing address in every " +
        "commercial message.",
    });
    return NextResponse.json({
      success: true,
      considered: companies.length,
      sent: 0,
      ...counts,
      blocked: "no_mailing_address",
    });
  }

  const from = await getPlatformFrom();
  let sent = 0;

  for (const send of sends) {
    const company = send.company;
    const token = randomBytes(32).toString("base64url");

    // ── Claim, provisionally ────────────────────────────────────────────
    //
    // Guarded on signupNudgeSentAt still being null so a concurrent run (or a
    // retried invocation) cannot produce a second letter. `updateMany` rather
    // than `update` precisely so the guard is part of the write.
    const claim = await db.company.updateMany({
      where: { id: company.id, signupNudgeSentAt: null },
      data: { signupNudgeSentAt: now, signupNudgeOptOutToken: token },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }

    // The siblings at the same address. Stamped so tomorrow's run does not
    // find them unwritten-to and send the second letter; NOT given a token,
    // because no link in any email points at them.
    const siblingIds = send.stampCompanyIds.filter((id) => id !== company.id);
    if (siblingIds.length) {
      await db.company.updateMany({
        where: { id: { in: siblingIds }, signupNudgeSentAt: null },
        data: { signupNudgeSentAt: now },
      });
    }

    const revert = () =>
      db.company.updateMany({
        where: { id: { in: send.stampCompanyIds } },
        data: { signupNudgeSentAt: null, signupNudgeOptOutToken: null },
      });

    // ── The assertion, against a read taken after the claim ─────────────
    //
    // Not a re-statement of decideSignupNudge — a second, fresher answer to the
    // only question that must never be wrong. Anything but "still no
    // subscription, still not a demo" reverts and sends nothing.
    const fresh = await db.company.findUnique({
      where: { id: company.id },
      select: { isDemo: true, subscription: { select: { id: true } } },
    });
    if (!fresh || fresh.isDemo || fresh.subscription) {
      await revert();
      note("completed_before_send");
      continue;
    }

    let email;
    try {
      email = buildSignupRecoveryEmail({
        companyName: company.name,
        language: company.defaultLanguage,
        // Account & Billing, never /signup: by the time anyone can abandon
        // checkout the company, the membership and the org all exist, and
        // /signup would greet them as a signed-in owner and offer to set up an
        // ADDITIONAL business. See the cancelUrl note in
        // app/api/companies/route.js.
        finishUrl: `${origin}/app/settings/account-billing`,
        helpUrl: `${origin}/contact`,
        optOutUrl: `${origin}/no-contact/${token}`,
        mailingAddress: address,
      });
    } catch (err) {
      await revert();
      await recordError({
        area: "signup",
        code: "signup_recovery_build_failed",
        message: `Couldn't build the signup-recovery email: ${err?.message}`,
        companyId: company.id,
      });
      note("build_failed");
      continue;
    }

    // sendEmail never throws — { id } | { error } | { skipped } — so all three
    // outcomes are checked rather than wrapped in a try/catch (AGENTS.md
    // recurring failure class #2).
    const result = await sendEmail({
      companyId: company.id,
      from,
      to: send.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (result?.error || result?.skipped) {
      await revert();
      note(result.error ? "resend_rejected" : "no_api_key");
      continue;
    }

    sent++;
  }

  return NextResponse.json({ success: true, considered: companies.length, sent, ...counts });
}
