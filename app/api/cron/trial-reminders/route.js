// app/api/cron/trial-reminders/route.js
//
// Daily: tell a company on a free trial with NO plan chosen that the trial
// ends in 15, 7 or 3 days, what happens then (read-only for a week, then
// locked, nothing deleted), which plan fits their team, and where to choose
// one. The decision is lib/billing/trialReminder.js; this route only runs it,
// the same "cron stays thin" split renewal-reminders and grace-warning use.
//
// Scheduled in vercel.json beside those two (09:00 UTC). A company that HAS
// chosen a plan never appears here — the query is keyed on the absence of a
// Subscription row, which is the one thing that separates the two letters.
//
// Claim, send, and REVERT on failure — see the file header of
// lib/billing/trialReminder.js for why the stamp is provisional.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { buildTrialReminderEmail } from "@/lib/email/trialReminderEmail";
import { ownerEmailFor } from "@/lib/email/companySender";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { formatDateOnly } from "@/lib/format/companyDate";
import { GRACE_DAYS } from "@/lib/billing/access";
import { recommendedTierFor } from "@/lib/billing/recommendedTier";
import { trialReminderDecision, TRIAL_REMINDER_DAYS } from "@/lib/billing/trialReminder";

const BATCH = 500;
const DAY = 24 * 60 * 60 * 1000;

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);
  // Only trials still running and inside the widest window: the exact letter
  // is decided per row below, this just keeps the read to the rows that can
  // possibly be due.
  const horizon = new Date(now.getTime() + Math.max(...TRIAL_REMINDER_DAYS) * DAY);

  const companies = await db.company.findMany({
    where: {
      isDemo: false,
      subscription: { is: null },
      trialEndsAt: { gt: now, lte: horizon },
    },
    select: {
      id: true,
      name: true,
      email: true,
      defaultLanguage: true,
      isDemo: true,
      trialEndsAt: true,
      signupTierKey: true,
      trialReminder15At: true,
      trialReminder7At: true,
      trialReminder3At: true,
      members: { where: { active: true }, select: { role: true, permissions: true, active: true } },
    },
    take: BATCH,
  });

  let sent = 0;
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const company of companies) {
    const decision = trialReminderDecision({
      trialEndsAt: company.trialEndsAt,
      hasSubscription: false,
      isDemo: company.isDemo,
      stamps: company,
      now,
    });
    if (!decision.send) { note(decision.reason); continue; }

    const { field } = decision;
    // ── Claim (provisional) ───────────────────────────────────────────────
    // Guarded on the stamp still being null, so a second concurrent run of
    // this cron cannot claim the same letter.
    const claim = await db.company.updateMany({
      where: { id: company.id, [field]: null },
      data: { [field]: now },
    });
    if (claim.count === 0) { note("claimed_by_another_run"); continue; }
    const revert = () => db.company.update({ where: { id: company.id }, data: { [field]: null } });

    const to = company.email || (await ownerEmailFor(company.id));
    if (!to) {
      await revert();
      await recordError({
        area: "billing-email",
        code: "trial_reminder_no_recipient",
        message: `Company ${company.id} is ${decision.daysLeft} days from the end of its trial with no plan, but no address could be found`,
        companyId: company.id,
      });
      note("no_recipient");
      continue;
    }

    const { subject, html } = buildTrialReminderEmail({
      companyName: company.name,
      language: company.defaultLanguage,
      daysLeft: decision.daysLeft,
      trialEndsOn: formatDateOnly(decision.trialEndsAt),
      graceDays: GRACE_DAYS,
      recommended: recommendedTierFor(company.members),
      billingUrl: `${origin}/app/settings/account-billing${company.signupTierKey ? `?tier=${encodeURIComponent(company.signupTierKey)}` : ""}`,
    });

    const from = await getPlatformFrom();
    // sendEmail never throws — { id } | { error } | { skipped } — so the
    // three outcomes are checked, not caught (AGENTS.md failure class #2).
    const result = await sendEmail({ companyId: company.id, from, to, subject, html });
    if (result?.error || result?.skipped) {
      await revert();
      note(result.error ? "resend_rejected" : "no_api_key");
      continue;
    }
    sent++;
  }

  return NextResponse.json({ success: true, considered: companies.length, sent, ...skipped });
}
