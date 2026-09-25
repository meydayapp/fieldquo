// app/api/cron/onboarding-next-steps/route.js
//
// Every fifteen minutes: the "finish setting up" letter to each company that
// signed up about two hours ago and whose onboarding checklist is still open
// — on its card-free trial (every new signup since 2026-09-24) or, for the
// older checkout path, with a live Subscription row.
// lib/signup/nextSteps.js decides; lib/email/onboardingNextStepsEmail.js
// writes; this file is only responsible for being right about the queries,
// the claim, and the order of the side effects.
//
// ══ Fifteen minutes ═══════════════════════════════════════════════════════
//
// The owner said "about 2 hours". An hourly run makes that two-to-three;
// fifteen minutes makes it two-to-two-and-a-quarter. The query is one index
// range on Company.createdAt and usually matches nothing, so the extra runs
// cost effectively nothing, and "about two hours" is closer to what he asked
// for.
//
// ══ Claim, send, revert — the renewal reminder's trade ═════════════════════
//
// The claim is an updateMany on the COMPANY that only matches with BOTH of its
// columns null, so two overlapping runs cannot both win it — and, because it
// is the one row per company whichever path the company is on, a trial
// company that chooses a plan cannot be claimed again through its new
// Subscription row (lib/signup/nextSteps.js, "One letter per COMPANY"). It is
// taken BEFORE the fresh reads and the send, and reverted when the letter did
// not go out — a Resend hiccup must not permanently consume the one letter
// this company is ever going to get (cron/renewal-reminders says the same
// about its own).
//
// ══ The last check is against a fresh read ═════════════════════════════════
//
// The company, its Subscription, the checklist, the additional set-up steps
// and the do-not-contact list are all re-read AFTER the claim, the way
// cron/signup-recovery re-reads before its send. A company can tick its last
// step, or choose a plan, or ask not to be written to, between the list query
// and the letter. The decision is recorded on the company
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
import { loadSetupSnapshot } from "@/lib/setupStepsSnapshot";
import { remainingSteps, stepsFor } from "@/lib/setupSteps";
import { checkSuppression } from "@/lib/sales/suppression";
import { isReservedTestAddress } from "@/lib/signup/abandoned";
import {
  decideNextStepsEmail,
  firstQuoteProof,
  nextStepsDueRange,
  nextStepsTradeKey,
  nextStepsTrialEndsAt,
} from "@/lib/signup/nextSteps";
import { firstQuoteMinutesForTrade, loadNextStepsSettings } from "@/lib/signup/nextStepsStore";

// The same shape and reasoning as renewal-reminders' BATCH: a handful of
// rows match on any run; anything left over is picked up fifteen minutes
// later, still inside the window.
const BATCH = 200;

// Everything the decision and the letter read about a company. One select,
// used by the list query and the fresh read after the claim, so the two
// cannot drift apart. `subscription` is ALWAYS selected: the decision throws
// on undefined rather than reading "not loaded" as "no plan yet".
const COMPANY_SELECT = {
  id: true,
  name: true,
  email: true,
  isDemo: true,
  createdAt: true,
  trialEndsAt: true,
  defaultLanguage: true,
  industries: true,
  nextStepsEmailSentAt: true,
  nextStepsEmailSkipped: true,
  subscription: { select: { id: true, status: true, nextStepsEmailSentAt: true, nextStepsEmailSkipped: true } },
  signupLead: { select: { firstName: true, trades: true } },
  members: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true } } } },
};

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

  // ── Everybody who could be due, by when the company was created ────────
  //
  // Demos are excluded in the query AND refused again in the decision, the
  // way every other letter to a tenant does it: a seeded demo has no real
  // card and no real inbox, and one demo1@fieldquo.com letter is a leak in
  // a dull wrapper. The two branches of the OR are the two ways a real
  // company is in: the card-free trial, and a live card-backed Subscription
  // that was not stamped under the old per-Subscription record.
  const { earliest, latest } = nextStepsDueRange({ now, delayHours: settings.delayHours });
  const companies = await db.company.findMany({
    where: {
      isDemo: false,
      createdAt: { gte: earliest, lte: latest },
      nextStepsEmailSentAt: null,
      nextStepsEmailSkipped: null,
      OR: [
        { subscription: { is: null }, trialEndsAt: { not: null } },
        {
          subscription: {
            is: {
              status: { in: ["active", "trialing"] },
              nextStepsEmailSentAt: null,
              nextStepsEmailSkipped: null,
            },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  let sent = 0;
  const from = await getPlatformFrom();

  for (const { id: companyId } of companies) {
    // ── Claim: both columns null IS the lock ───────────────────────────
    const claim = await db.company.updateMany({
      where: { id: companyId, nextStepsEmailSentAt: null, nextStepsEmailSkipped: null },
      data: { nextStepsEmailSentAt: now },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }
    const revert = () => db.company.updateMany({ where: { id: companyId, nextStepsEmailSentAt: now }, data: { nextStepsEmailSentAt: null } });
    const decideAgainst = (skip) =>
      db.company.updateMany({ where: { id: companyId, nextStepsEmailSentAt: now }, data: { nextStepsEmailSentAt: null, nextStepsEmailSkipped: skip } });

    // ── The fresh reads the decision is made on ────────────────────────
    let company;
    let onboarding;
    let setupSteps;
    try {
      company = await db.company.findUnique({ where: { id: companyId }, select: COMPANY_SELECT });
      onboarding = await getOnboardingStatus(companyId);
      // The additional set-up steps still on the card: the same pure
      // decision the dashboard card runs, on the same snapshot it reads.
      setupSteps = remainingSteps(stepsFor(await loadSetupSnapshot(companyId)));
    } catch (err) {
      // Revert, not record: the letter is still owed, and the window gives
      // the next run three days to read what this one could not. A letter
      // with the set-up section silently missing would be the one letter.
      await revert();
      note("read_failed");
      await recordError({ area: "onboarding-email", code: "next_steps_status_failed", message: `Could not read the company, checklist or set-up steps before the next-steps letter: ${err?.message}`, companyId }).catch(() => {});
      continue;
    }
    if (!company) { note("company_gone"); continue; }
    const to = String(company.email || "").trim() || (await ownerEmailFor(companyId)) || "";

    // A reserved test domain (example.com, .test …) is nobody's inbox — the
    // refusal signup-recovery makes at the point of sending, recorded here so
    // the console says why.
    if (to && isReservedTestAddress(to)) {
      await decideAgainst("test_address");
      note("reserved_test_domain");
      continue;
    }

    // The do-not-contact list, read in the request that sends — never
    // cached (lib/sales/suppression.js). A failed read fails CLOSED: no
    // letter this run, nothing recorded, asked again in fifteen minutes.
    let suppressed = false;
    if (to) {
      try {
        suppressed = Boolean((await checkSuppression(db, { channel: "email", email: to }))?.suppressed);
      } catch (err) {
        await revert();
        note("suppression_read_failed");
        await recordError({ area: "onboarding-email", code: "next_steps_suppression_failed", message: `Could not read the do-not-contact list before the next-steps letter: ${err?.message}`, companyId }).catch(() => {});
        continue;
      }
    }

    const verdict = decideNextStepsEmail({
      subscription: company.subscription ?? null,
      // The claim above is this run's own stamp; the decision is about
      // whether anybody ELSE wrote the letter.
      company: { ...company, email: to, nextStepsEmailSentAt: null },
      onboarding,
      suppressed,
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
        setupSteps,
        trialEndsAt: nextStepsTrialEndsAt({ company, subscription: company.subscription ?? null, now }),
        origin,
        proof,
      });
    } catch (err) {
      await revert();
      note("build_failed");
      await recordError({ area: "onboarding-email", code: "next_steps_build_failed", message: `Couldn't build the next-steps letter: ${err?.message}`, companyId }).catch(() => {});
      continue;
    }

    // sendEmail never throws — { id } | { error } | { skipped } — so the
    // three outcomes are checked, not caught (AGENTS.md failure class #2).
    // FieldQuo's own letter to a tenant still carries the tenant, so the
    // demo interception in lib/email/resend.js has its seam.
    const result = await sendEmail({ companyId, from, to, subject: email.subject, html: email.html, text: email.text });
    if (result?.skipped || result?.error) {
      await revert();
      note(result.error ? "resend_rejected" : "no_api_key");
      if (result.error) {
        await recordError({ area: "onboarding-email", code: "next_steps_send_failed", message: `Resend refused the next-steps letter: ${result.error}`, companyId }).catch(() => {});
      }
      continue;
    }
    sent++;
    note(company.subscription ? "sent_card" : "sent_trial");
  }

  return NextResponse.json({ success: true, considered: companies.length, sent, counts, settings });
}
