// app/api/platform/onboarding-email/route.js
//
// The "next steps" letter's two tunables — on / off, and how many hours
// after the card goes in it is sent — read by every platform admin, written
// by a superadmin. lib/signup/nextSteps.js says what each does; the cron
// (/api/cron/onboarding-next-steps) reads them on every run.
//
// Superadmin writes, for the reason the floor-settings route gives: the
// number changes what every new customer receives, and "off" silences a
// letter for the whole platform. Audit-logged with before and after.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import {
  DEFAULT_NEXT_STEPS_SETTINGS,
  NEXT_STEPS_DELAY_HOURS_MAX,
  NEXT_STEPS_DELAY_HOURS_MIN,
  NEXT_STEPS_WINDOW_HOURS,
  validateNextStepsSettings,
} from "@/lib/signup/nextSteps";
import { firstQuoteMinutesForTrade, loadNextStepsSettings, saveNextStepsSettings } from "@/lib/signup/nextStepsStore";
import { firstQuoteProof, nextStepsTradeKey } from "@/lib/signup/nextSteps";
import { getOnboardingStatus } from "@/lib/onboarding";
import { buildOnboardingNextStepsEmail } from "@/lib/email/onboardingNextStepsEmail";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { getAppOrigin } from "@/lib/appUrl";
import { INDUSTRIES as DEMO_INDUSTRIES } from "@/lib/demo/industries";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function payload() {
  // The count beside the switch: how many letters have gone out, read off
  // the column the cron writes, never estimated.
  const sentCount = await db.subscription.count({ where: { nextStepsEmailSentAt: { not: null } } }).catch(() => null);
  return {
    settings: await loadNextStepsSettings(),
    defaults: DEFAULT_NEXT_STEPS_SETTINGS,
    bounds: { min: NEXT_STEPS_DELAY_HOURS_MIN, max: NEXT_STEPS_DELAY_HOURS_MAX, windowHours: NEXT_STEPS_WINDOW_HOURS },
    sentCount,
    serverNow: new Date().toISOString(),
  };
}

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return bad("Unauthorized", 401);
  return NextResponse.json(await payload());
}

export async function PUT(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const checked = validateNextStepsSettings(body);
  if (!checked.ok) return bad(checked.error);

  const before = await loadNextStepsSettings();
  const after = await saveNextStepsSettings({ value: checked.value });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "onboarding_next_steps_email_updated",
      details: { before, after },
    },
  });

  return NextResponse.json(await payload());
}

// ── A sample, to the superadmin's own inbox ────────────────────────────────
//
// The letter goes out from a cron, two hours after a real signup, so there is
// no way to see the real thing (Resend live, the discovered sender, a real
// company's checklist) without waiting for a customer. This sends ONE copy
// to the calling superadmin's own address — never to a company, never to an
// address typed into a box — built from a named company's checklist as it
// stands, or from the first demo company when none is named. It marks
// nothing on the company: a sample is not the letter, and the cron's
// once-per record stays untouched. The subject is prefixed so it cannot be
// mistaken for the real one in the inbox.
export async function POST(request) {
  const { admin, refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  // The token carries id and role only; the address is on the row, read
  // now, so a deactivated admin's stale token cannot mail anybody.
  const me = await db.platformAdmin.findUnique({ where: { id: admin.id }, select: { email: true, active: true } });
  if (!me?.active || !me.email) return bad("Your admin account has no active email address to send the sample to.", 403);
  const to = me.email;

  const body = await request.json().catch(() => ({}));
  const language = ["en", "fr", "es"].includes(body?.language) ? body.language : null;
  const where = typeof body?.companyId === "string" && body.companyId.trim() ? { id: body.companyId.trim() } : { isDemo: true };
  const company = await db.company.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, isDemo: true, defaultLanguage: true, industries: true, demoIndustry: true, signupLead: { select: { trades: true } } },
  });
  if (!company) return bad("No such company.", 404);

  let status;
  try {
    status = await getOnboardingStatus(company.id);
  } catch (err) {
    return bad(`Could not read that company's checklist: ${err?.message}`, 500);
  }
  if (status.complete) {
    return bad(`${company.name} has finished every step, so there is no next-steps letter to build. Name a company with open steps.`, 409);
  }

  // A demo's trade is the preset it is dressed as; a real company's is its
  // industries, the way the cron reads it.
  const tradeKey =
    nextStepsTradeKey(company.industries) ||
    nextStepsTradeKey(company.signupLead?.trades) ||
    (company.isDemo && company.demoIndustry ? DEMO_INDUSTRIES[company.demoIndustry]?.pitchTrade || null : null);
  const proof = tradeKey ? firstQuoteProof(await firstQuoteMinutesForTrade(tradeKey).catch(() => [])) : null;

  let email;
  try {
    email = buildOnboardingNextStepsEmail({
      companyName: company.name,
      firstName: null,
      language: language || company.defaultLanguage,
      tradeKey,
      steps: status.steps,
      origin: getAppOrigin(request),
      proof,
    });
  } catch (err) {
    return bad(`Could not build the sample: ${err?.message}`, 500);
  }

  const from = await getPlatformFrom();
  const result = await sendEmail({ from, to, subject: `[sample] ${email.subject}`, html: email.html, text: email.text });
  if (result?.skipped) return bad("Resend is not configured on this deployment (no API key), so nothing was sent.", 503);
  if (result?.error) return bad(`Resend refused it: ${result.error}`, 502);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "onboarding_next_steps_email_sampled",
      targetCompanyId: company.id,
      details: { to, language: email.language, tradeKey, open: email.open, proof: Boolean(proof), providerId: result?.id || null },
    },
  });

  return NextResponse.json({
    sent: true,
    to,
    from,
    company: { id: company.id, name: company.name, isDemo: company.isDemo },
    subject: email.subject,
    language: email.language,
    open: email.open,
    done: email.done,
    tradeKey,
    proof,
  });
}
