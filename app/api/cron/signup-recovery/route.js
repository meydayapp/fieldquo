// app/api/cron/signup-recovery/route.js
//
// Every five minutes: the two letters FieldQuo writes to somebody who started
// a signup and stopped.
//
//   1. The EARLY touch — five minutes after their last activity, "your free
//      month is waiting", the way back in, and the three things FieldQuo does
//      for their trade. lib/signup/earlyNudge.js decides; the owner's number.
//   2. The RECOVERY note — twenty-four hours after a company was created with
//      no card, once. lib/signup/abandoned.js decides; unchanged.
//
// Both rules are pure and executable by scripts/check-abandoned-signup.mjs.
// This file is only responsible for being right about the queries, the claim,
// and the order of the side effects.
//
// ══ Every five minutes, which replaced mid-morning Eastern ═════════════════
//
// This ran daily at 14:30 UTC — mid-morning Eastern, chosen so a letter whose
// only job is to start a conversation lands at the top of the inbox rather
// than under everything that arrived overnight. The five-minute touch cannot
// wait for a time of day: its whole value is being in the inbox while the
// thought is still warm, so the schedule is now `*/5` (vercel.json). The
// recovery note rides on the same schedule and goes out on the first run
// after its twenty-four hours are up, whatever the hour — a day after a
// signup is, by construction, roughly the hour the person was awake and
// signing up.
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
  isReservedTestAddress,
  nudgeRecipient,
  planSignupNudges,
} from "@/lib/signup/abandoned";
import { buildSignupEarlyNudgeEmail } from "@/lib/email/signupEarlyNudgeEmail";
import {
  EARLY_TOUCH,
  RECOVERY_TOUCH,
  earlyNudgePersonFromCompany,
  earlyNudgePersonFromLead,
  planEarlyNudges,
} from "@/lib/signup/earlyNudge";
import { emailKeyOf } from "@/lib/signup/leads";

/**
 * A claim on the early touch that never turned into a letter is retried
 * after this long — a Resend hiccup must not permanently consume the one
 * letter this person is ever going to get (the recovery note's own rule).
 */
const RECLAIM_AFTER_MS = 10 * 60 * 1000;

/**
 * The record of a send, for the screen. Upserted so the recovery note — which
 * keeps Company.signupNudgeSentAt as its own claim — is visible in the same
 * table as the early touch and /platform/signups reads one list.
 */
async function logTouch({ emailKey, email, touch, person = {}, sentAt, providerId = null }) {
  await db.signupNudge
    .upsert({
      where: { emailKey_touch: { emailKey, touch } },
      create: {
        emailKey,
        email,
        touch,
        signupLeadId: person.signupLeadId || null,
        companyId: person.companyId || null,
        language: person.language || null,
        tradeKey: person.tradeKey || null,
        stepReached: person.stepReached || null,
        sentAt,
        providerId,
      },
      update: { sentAt, providerId, failedAt: null, error: null },
    })
    .catch((err) => console.error("[signup-recovery] log failed:", err?.message || err));
}

// ═══════════════════════════════════════════════════════════════════════════
// The early touch
// ═══════════════════════════════════════════════════════════════════════════

async function runEarlyTouch({ now, origin, address, from }) {
  const counts = {};
  const note = (reason) => { counts[reason] = (counts[reason] || 0) + 1; };

  // ── Everybody who could be owed the letter, both kinds of row ───────────
  //
  // Unfiltered by quiet time: the address rule needs a person's lead and
  // company both present to pick the later one.
  const [leads, companies] = await Promise.all([
    db.signupLead.findMany({
      where: { completedCompanyId: null },
      select: {
        id: true, email: true, firstName: true, companyName: true, language: true, trades: true, stepReached: true,
        lastSeenAt: true, completedCompanyId: true, resumeToken: true, promotedLeadId: true,
        prospect: { select: { assignedRepId: true, claimExpiresAt: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: BATCH,
    }),
    db.company.findMany({
      where: { isDemo: false, ...incompleteSignupWhere() },
      select: {
        id: true, name: true, email: true, isDemo: true, createdAt: true, defaultLanguage: true, industries: true, trialEndsAt: true,
        subscription: { select: { id: true } },
        salesAttribution: { select: { salesRepId: true } },
        signupLead: { select: { id: true, firstName: true, language: true, trades: true, stepReached: true, lastSeenAt: true } },
        signupProspects: { select: { assignedRepId: true, claimExpiresAt: true } },
        members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: BATCH,
    }),
  ]);

  const heldKeys = new Set();
  const live = (p) => p?.assignedRepId && (!p.claimExpiresAt || p.claimExpiresAt > now);
  const people = [];
  // A reserved test domain (example.com) is a test run through the funnel,
  // never a person: dropped here, at the point of sending, and counted.
  for (const l of leads) {
    if (isReservedTestAddress(l.email)) { note("reserved_test_domain"); continue; }
    people.push(earlyNudgePersonFromLead(l));
    if (l.promotedLeadId || live(l.prospect)) heldKeys.add(emailKeyOf(l.email));
  }
  for (const c of companies) {
    if (isReservedTestAddress(c.email)) { note("reserved_test_domain"); continue; }
    people.push(earlyNudgePersonFromCompany(c, { ownerName: c.members?.[0]?.user?.name || null }));
    if (c.salesAttribution?.salesRepId || c.signupProspects.some(live)) heldKeys.add(emailKeyOf(c.email));
  }

  // The do-not-contact list, read in the request that sends.
  const addresses = [...new Set(people.map((p) => nudgeRecipient(p?.email)).filter(Boolean))];
  const suppressedAddresses = new Set();
  for (const email of addresses) {
    const verdict = await checkSuppression(db, { channel: "email", email });
    if (verdict.suppressed) suppressedAddresses.add(email);
  }

  // Already written to — the log is the record, keyed on the person.
  const keys = [...new Set(people.map((p) => emailKeyOf(p?.email)).filter(Boolean))];
  const sentRows = keys.length
    ? await db.signupNudge.findMany({ where: { emailKey: { in: keys }, touch: EARLY_TOUCH, sentAt: { not: null } }, select: { emailKey: true } })
    : [];
  const sentKeys = new Set(sentRows.map((r) => r.emailKey));

  const { sends, skipped } = planEarlyNudges({ people, suppressedAddresses, sentKeys, heldKeys, now });
  for (const sk of skipped) note(sk.reason);

  if (sends.length && !address) {
    await recordError({
      area: "signup",
      code: "signup_nudge_no_mailing_address",
      message: `SALES_MAILING_ADDRESS is unset, so ${sends.length} five-minute signup follow-up(s) were not sent — CASL requires a mailing address in every commercial message.`,
    });
    return { considered: people.length, sent: 0, counts, blocked: "no_mailing_address" };
  }

  let sent = 0;
  for (const send of sends) {
    const { person, to, emailKey } = send;
    const token = randomBytes(32).toString("base64url");

    // ── Claim: the unique on (emailKey, touch) IS the lock ──────────────
    let claim;
    try {
      claim = await db.signupNudge.create({
        data: {
          emailKey, email: to, touch: EARLY_TOUCH,
          signupLeadId: person.signupLeadId, companyId: person.companyId,
          language: person.language, tradeKey: person.tradeKey, stepReached: person.stepReached,
          optOutToken: token, claimedAt: now,
        },
        select: { id: true },
      });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
      // Somebody holds the claim. A stale failed claim is retried; a live or
      // sent one is left alone.
      const held = await db.signupNudge.findUnique({ where: { emailKey_touch: { emailKey, touch: EARLY_TOUCH } }, select: { id: true, sentAt: true, claimedAt: true } });
      if (!held || held.sentAt || now.getTime() - new Date(held.claimedAt).getTime() < RECLAIM_AFTER_MS) { note("claimed_by_another_run"); continue; }
      const retaken = await db.signupNudge.updateMany({
        where: { id: held.id, sentAt: null, claimedAt: held.claimedAt },
        data: { claimedAt: now, optOutToken: token, failedAt: null, error: null, signupLeadId: person.signupLeadId, companyId: person.companyId },
      });
      if (retaken.count === 0) { note("claimed_by_another_run"); continue; }
      claim = held;
    }
    const failed = (reason, error) =>
      db.signupNudge.updateMany({ where: { id: claim.id, sentAt: null }, data: { failedAt: now, error: String(error || reason).slice(0, 500) } }).then(() => note(reason));

    // ── The assertion, against a read taken after the claim ─────────────
    //
    // A person can finish between the list and the send; "we wrote to a
    // paying customer to come back and pay" is the worst outcome here.
    if (person.kind === "lead") {
      const freshLead = await db.signupLead.findUnique({ where: { id: person.signupLeadId }, select: { completedCompanyId: true } });
      if (!freshLead || freshLead.completedCompanyId) { await failed("completed_before_send"); continue; }
    } else {
      const freshCompany = await db.company.findUnique({ where: { id: person.companyId }, select: { isDemo: true, trialEndsAt: true, subscription: { select: { id: true } } } });
      if (!freshCompany || freshCompany.isDemo || freshCompany.subscription || freshCompany.trialEndsAt) { await failed("completed_before_send"); continue; }
    }

    let email;
    try {
      email = buildSignupEarlyNudgeEmail({
        firstName: person.firstName,
        companyName: person.companyName,
        language: person.language,
        tradeKey: person.tradeKey,
        // A lead has no login: the resume token opens /signup with their
        // form filled in. A company has one: Account & Billing restarts
        // checkout, for the reason the recovery note gives.
        resumeUrl: person.kind === "lead" && person.resumeToken
          ? `${origin}/signup?resume=${encodeURIComponent(person.resumeToken)}`
          : `${origin}/app/settings/account-billing`,
        optOutUrl: `${origin}/no-contact/${token}`,
        mailingAddress: address,
      });
    } catch (err) {
      await failed("build_failed", err?.message);
      await recordError({ area: "signup", code: "signup_nudge_build_failed", message: `Couldn't build the five-minute signup follow-up: ${err?.message}`, companyId: person.companyId || undefined });
      continue;
    }

    // sendEmail never throws — { id } | { error } | { skipped } — all three
    // outcomes handled, as the recovery loop below does.
    const result = await sendEmail({ companyId: person.companyId || undefined, from, to, subject: email.subject, html: email.html, text: email.text });
    if (result?.skipped || result?.error) {
      await failed(result.error ? "resend_rejected" : "no_api_key", result.error);
      continue;
    }
    await db.signupNudge.updateMany({ where: { id: claim.id }, data: { sentAt: now, providerId: result.id || null, failedAt: null, error: null } });
    sent++;
  }
  return { considered: people.length, sent, counts };
}

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
  const earlyAddress = mailingAddress();
  const earlyFrom = await getPlatformFrom();
  const early = await runEarlyTouch({ now, origin, address: earlyAddress, from: earlyFrom });

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

  const companies = rows
    .map((c) => ({ ...c, memberCount: c._count.members }))
    // The same reserved-domain refusal the early touch applies: a test row
    // is not written to, and is not stamped either.
    .filter((c) => !isReservedTestAddress(c.email));

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

  // ── The companies a rep is already on ───────────────────────────────────
  //
  // A welcome-call or stalled row the owner handed to a rep
  // (lib/signup/salesFloor.js) means the rep's own intro email and call are
  // the follow-up; this letter stays unsent while the lease is live.
  const heldRows = await db.prospect.findMany({
    where: { companyId: { in: companies.map((c) => c.id) }, assignedRepId: { not: null }, OR: [{ claimExpiresAt: null }, { claimExpiresAt: { gt: now } }] },
    select: { companyId: true },
  });
  const heldCompanyIds = new Set(heldRows.map((r) => r.companyId));

  const { sends, skipped } = planSignupNudges({ companies, suppressedAddresses, heldCompanyIds, now });

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
      early,
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
    // The screen's record — the same table the early touch writes.
    await logTouch({
      emailKey: emailKeyOf(send.to), email: send.to, touch: RECOVERY_TOUCH,
      person: { companyId: company.id, language: company.defaultLanguage, stepReached: "checkout" },
      sentAt: now, providerId: result.id || null,
    });
  }

  return NextResponse.json({ success: true, considered: companies.length, sent, ...counts, early });
}
