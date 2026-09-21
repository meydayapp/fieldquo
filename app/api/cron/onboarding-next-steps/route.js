// app/api/cron/onboarding-next-steps/route.js
//
// Every fifteen minutes: the "next steps" letter to each company whose card
// went in about two hours ago and whose onboarding checklist is still open.
// lib/signup/nextSteps.js decides; lib/email/onboardingNextStepsEmail.js
// writes; this file is only responsible for being right about the queries,
// the claim, and the order of the side effects.
//
// ══ Fifteen minutes ═══════════════════════════════════════════════════════
//
// The owner said "about 2 hours". An hourly run makes that two-to-three;
// fifteen minutes makes it two-to-two-and-a-quarter. The query is one index
// range on Subscription.createdAt and usually matches nothing, so the extra
// runs cost effectively nothing, and "about two hours" is closer to what he
// asked for.
//
// ══ Claim, send, revert — the renewal reminder's trade ═════════════════════
//
// The claim is an updateMany that only matches a row with BOTH columns null,
// so two overlapping runs cannot both win it. It is taken BEFORE the fresh
// reads and the send, and reverted when the letter did not go out — a Resend
// hiccup must not permanently consume the one letter this company is ever
// going to get (cron/renewal-reminders says the same about its own).
//
// ══ The last check is against a fresh read ═════════════════════════════════
//
// The checklist is re-read AFTER the claim, in a query of its own, the way
// cron/signup-recovery re-reads the subscription before its send. A company
// can tick its last step between the list query and the letter, and "we
// wrote to say three steps were open when none were" is the letter the
// owner does not want sent. That decision is recorded on the row
// (nextStepsEmailSkipped) and never revisited.
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { ownerEmailFor } from "@/lib/email/companySender";
import { buildOnboardingNextStepsEmail } from "@/lib/email/onboardingNextStepsEmail";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { getOnboardingStatus } from "@/lib/onboarding";
import {
  decideNextStepsEmail,
  firstQuoteProof,
  nextStepsDueRange,
  nextStepsTradeKey,
} from "@/lib/signup/nextSteps";
import { firstQuoteMinutesForTrade, loadNextStepsSettings } from "@/lib/signup/nextStepsStore";

// The same shape and reasoning as renewal-reminders' BATCH: a handful of
// rows match on any run; anything left over is picked up fifteen minutes
// later, still inside the window.
const BATCH = 200;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);
  const settings = await loadNextStepsSettings();
  const counts = {};
  const note = (reason) => { counts[reason] = (counts[reason] || 0) + 1; };

  if (!settings.enabled) {
    return NextResponse.json({ success: true, considered: 0, sent: 0, disabled: true, settings });
  }

  // ── Everybody who could be due, by the row that says they paid ─────────
  //
  // Demos are excluded in the query AND refused again in the decision, the
  // way every other letter to a tenant does it: a seeded demo has no real
  // card and no real inbox, and one demo1@fieldquo.com letter is a leak in
  // a dull wrapper.
  const { earliest, latest } = nextStepsDueRange({ now, delayHours: settings.delayHours });
  const subscriptions = await db.subscription.findMany({
    where: {
      createdAt: { gte: earliest, lte: latest },
      nextStepsEmailSentAt: null,
      nextStepsEmailSkipped: null,
      status: { in: ["active", "trialing"] },
      company: { isDemo: false },
    },
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      status: true,
      nextStepsEmailSentAt: true,
      nextStepsEmailSkipped: true,
      company: {
        select: {
          id: true,
          name: true,
          email: true,
          isDemo: true,
          defaultLanguage: true,
          industries: true,
          signupLead: { select: { firstName: true, trades: true } },
          members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let sent = 0;
  const from = await getPlatformFrom();

  for (const sub of subscriptions) {
    const company = sub.company;

    // ── Claim: both columns null IS the lock ───────────────────────────
    const claim = await db.subscription.updateMany({
      where: { id: sub.id, nextStepsEmailSentAt: null, nextStepsEmailSkipped: null },
      data: { nextStepsEmailSentAt: now },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }
    const revert = () => db.subscription.updateMany({ where: { id: sub.id, nextStepsEmailSentAt: now }, data: { nextStepsEmailSentAt: null } });
    const decideAgainst = (skip) =>
      db.subscription.updateMany({ where: { id: sub.id, nextStepsEmailSentAt: now }, data: { nextStepsEmailSentAt: null, nextStepsEmailSkipped: skip } });

    // ── The fresh reads the decision is made on ────────────────────────
    let onboarding = null;
    try {
      onboarding = await getOnboardingStatus(sub.companyId);
    } catch (err) {
      await revert();
      note("onboarding_read_failed");
      await recordError({ area: "onboarding-email", code: "next_steps_status_failed", message: `Could not read the checklist before the next-steps letter: ${err?.message}`, companyId: sub.companyId }).catch(() => {});
      continue;
    }
    const to = String(company?.email || "").trim() || (await ownerEmailFor(sub.companyId)) || "";

    const verdict = decideNextStepsEmail({
      subscription: { ...sub, nextStepsEmailSentAt: null },
      company: { ...company, email: to },
      onboarding,
      settings,
      now,
    });
    if (!verdict.send) {
      if (verdict.skip) await decideAgainst(verdict.skip);
      else await revert();
      note(verdict.reason);
      continue;
    }

    // ── The letter ─────────────────────────────────────────────────────
    const tradeKey = nextStepsTradeKey(company.industries) || nextStepsTradeKey(company.signupLead?.trades);
    const firstName = company.signupLead?.firstName || String(company.members?.[0]?.user?.name || "").split(" ")[0] || null;
    // Social proof from real rows only; null under the minimum sample and
    // the letter prints nothing. A failed read is the same as no sample.
    const proof = tradeKey
      ? firstQuoteProof(await firstQuoteMinutesForTrade(tradeKey).catch(() => []))
      : null;

    let email;
    try {
      email = buildOnboardingNextStepsEmail({
        companyName: company.name,
        firstName,
        language: company.defaultLanguage,
        tradeKey,
        steps: onboarding.steps,
        origin,
        proof,
      });
    } catch (err) {
      await revert();
      note("build_failed");
      await recordError({ area: "onboarding-email", code: "next_steps_build_failed", message: `Couldn't build the next-steps letter: ${err?.message}`, companyId: sub.companyId }).catch(() => {});
      continue;
    }

    // sendEmail never throws — { id } | { error } | { skipped } — so the
    // three outcomes are checked, not caught (AGENTS.md failure class #2).
    // FieldQuo's own letter to a tenant still carries the tenant, so the
    // demo interception in lib/email/resend.js has its seam.
    const result = await sendEmail({ companyId: sub.companyId, from, to, subject: email.subject, html: email.html, text: email.text });
    if (result?.skipped || result?.error) {
      await revert();
      note(result.error ? "resend_rejected" : "no_api_key");
      if (result.error) {
        await recordError({ area: "onboarding-email", code: "next_steps_send_failed", message: `Resend refused the next-steps letter: ${result.error}`, companyId: sub.companyId }).catch(() => {});
      }
      continue;
    }
    sent++;
    note("sent");
  }

  return NextResponse.json({ success: true, considered: subscriptions.length, sent, counts, settings });
}
