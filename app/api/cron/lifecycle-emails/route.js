// app/api/cron/lifecycle-emails/route.js
//
// Hourly (vercel.json "40 * * * *"): the trial sequence — feature nudges,
// "you did it" milestones, the personal day-3 note, the day-5 help articles,
// and the trial-ended letter. lib/lifecycle/plan.js decides, lib/lifecycle/
// run.js carries out one company, lib/lifecycle/emails.js writes. This file
// only chooses which companies to look at and supplies the real database,
// sender, suppression list and settings.
//
// ══ Hourly, though most companies get at most one email a day ═════════════
//
// The sequence sends inside the company's own 09:00–18:00 (Company.timezone),
// so a daily run at one UTC hour would be 5am in Vancouver and lunchtime in
// Berlin. Hourly lets every company's letter land in its own morning, and the
// trial-ended letter go out within the hour of the end rather than up to a
// day later. Most runs touch a few dozen rows and send nothing.
//
// ══ Who is looked at ══════════════════════════════════════════════════════
//
//   - a real company created since the sequence started
//     (LIFECYCLE_SEQUENCE_STARTS_AT) and within the last 32 days — the
//     milestone window plus a margin; or
//   - a company with no plan whose trial ended in the last 48 hours (the
//     trial-ended letter's whole window).
// Demos and companies FieldQuo ended are excluded in the query AND refused
// again by the plan and after the claim.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { getPlatformFrom } from "@/lib/email/platformSender";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { checkSuppression } from "@/lib/sales/suppression";
import { mailingAddress } from "@/lib/legal/mailingAddress";
import { GRACE_DAYS } from "@/lib/billing/access";
import { loadNextStepsSettings } from "@/lib/signup/nextStepsStore";
import { loadLifecycleSettings } from "@/lib/lifecycle/settingsStore";
import { runLifecycleForCompany } from "@/lib/lifecycle/run";
import { LIFECYCLE_SEQUENCE_STARTS_AT, SCHEDULE } from "@/lib/lifecycle/plan";
import { loadArticle } from "@/lib/help/content";

const BATCH = 300;
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function helpArticleText(language, slug, category) {
  const a = await loadArticle(language, category, slug);
  if (!a?.article?.title) return null;
  return { title: a.article.title, summary: a.article.summary || "", english: a.langUsed !== language };
}

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  const origin = getAppOrigin(request);
  const [settings, nextStepsSettings, platformFrom] = await Promise.all([
    loadLifecycleSettings(),
    loadNextStepsSettings(),
    getPlatformFrom(),
  ]);
  const since = new Date(Math.max(LIFECYCLE_SEQUENCE_STARTS_AT.getTime(), now.getTime() - 32 * DAY));

  const companies = await db.company.findMany({
    where: {
      isDemo: false,
      platformEndsAt: null,
      OR: [
        { createdAt: { gte: since }, OR: [{ trialEndsAt: { not: null } }, { subscription: { isNot: null } }] },
        { subscription: { is: null }, trialEndsAt: { lte: now, gte: new Date(now.getTime() - SCHEDULE.trialEndedLateHours * HOUR) } },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });

  const deps = {
    client: db,
    sendEmail,
    checkSuppression,
    mailingAddress: mailingAddress(),
    platformFrom,
    origin,
    now,
    settings,
    nextStepsSettings,
    graceDays: GRACE_DAYS,
    helpArticleText,
  };

  const counts = {};
  const note = (k) => { counts[k] = (counts[k] || 0) + 1; };
  let sent = 0;
  let addressMissing = 0;
  for (const { id } of companies) {
    try {
      const r = await runLifecycleForCompany(id, deps);
      note(r.outcome === "nothing" ? `wait:${r.reason}` : r.kind ? `${r.outcome}:${r.kind}` : r.outcome);
      if (r.outcome === "sent") sent++;
      if (r.outcome === "build_failed" && /mailing address/i.test(r.reason || "")) addressMissing++;
      else if (r.outcome === "build_failed") {
        await recordError({ area: "lifecycle-email", code: "lifecycle_build_failed", message: `Couldn't build ${r.kind}: ${r.reason}`, companyId: id }).catch(() => {});
      }
    } catch (err) {
      note("error");
      await recordError({ area: "lifecycle-email", code: "lifecycle_run_failed", message: `Lifecycle email run failed: ${err?.message}`, companyId: id }).catch(() => {});
    }
  }
  // One logged refusal per run, not one per company.
  if (addressMissing) {
    await recordError({
      area: "lifecycle-email",
      code: "lifecycle_no_mailing_address",
      message: `SALES_MAILING_ADDRESS is unset, so ${addressMissing} trial-sequence email(s) were not sent — CASL requires a mailing address in every commercial message.`,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, considered: companies.length, sent, counts });
}
