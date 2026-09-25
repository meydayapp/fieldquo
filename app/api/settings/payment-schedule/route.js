// app/api/settings/payment-schedule/route.js
//
// The company's structured payment schedule — Settings → Company → Payment
// schedule. Read lib/paymentSchedule/run.js's header before touching this:
// a company with no rows here gets the exact behaviour it had before this
// feature existed, and every quote accepted from the moment a valid
// template is saved here uses it.
//
// ── Why PUT replaces the whole set rather than patching one stage ──────────
//
// A schedule only means anything as a whole (its percentages have to sum to
// 100 — see lib/paymentSchedule/validate.js), so there is no partial write
// that could ever be valid on its own. Replacing all rows in one transaction
// means the company never sees (and a concurrent quote acceptance never
// reads) a schedule that's mid-edit and doesn't sum to anything.
//
// ── Why saving here also rewrites Company.paymentTerms ──────────────────────
//
// Before this feature, paymentTerms was the only truth: a free-text sentence
// lib/documents/paymentSchedule.js parses into the cosmetic cards every quote
// and invoice PDF/email already renders. That renderer is untouched — instead
// this route keeps paymentTerms IN SYNC, generating the same sentence a
// structured schedule implies (lib/paymentSchedule/engine.js's
// scheduleToText) every time a valid template is saved. So the schedule a
// homeowner sees printed on the document is the same one that just billed
// them, not a second, independently-typed description of it that could say
// something different. See app/app/settings/company/page.js, which disables
// the free-text field once a structured schedule exists and points here
// instead.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { validatePaymentScheduleInput } from "@/lib/paymentSchedule/validate";
import { scheduleToText } from "@/lib/paymentSchedule/engine";
// The generated sentence is Company.paymentTerms, printed on every document —
// so it is drafted into the other languages like a typed one.
import { scheduleAutoTranslate, schedulePhrases } from "@/lib/i18n/autoTranslateSchedule";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const stages = await db.paymentScheduleStage.findMany({
    where: { companyId: member.companyId },
    orderBy: { seq: "asc" },
  });

  return NextResponse.json({
    stages: stages.map((s) => ({
      id: s.id,
      seq: s.seq,
      label: s.label,
      trigger: s.trigger,
      percentage: Number(s.percentage),
    })),
  });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can edit the payment schedule" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const input = body?.stages;

  // An empty array is a deliberate, valid REQUEST — "turn structured billing
  // off" — handled here rather than by validatePaymentScheduleInput, which
  // treats [] as invalid input for the "please build me a schedule" case
  // (Settings' save button). Two different callers, two different meanings
  // for the same empty array; this route is the one place that has to know
  // both.
  if (Array.isArray(input) && input.length === 0) {
    await db.paymentScheduleStage.deleteMany({ where: { companyId: member.companyId } });
    await recordActivity(
      member,
      {
        action: "payment_schedule.cleared",
        entityType: "company",
        entityId: member.companyId,
        summary: "Turned off the structured payment schedule",
      },
    ).catch(() => {});
    return NextResponse.json({ stages: [], generatedText: null });
  }

  const { valid, errors, stages } = validatePaymentScheduleInput(input);
  if (!valid) {
    return NextResponse.json({ error: "invalid_schedule", details: errors }, { status: 400 });
  }

  const generatedText = scheduleToText(stages);

  // What was there before, so the response only claims a translation when
  // the wording actually changed (a percentage-only edit still changes the
  // generated sentence; a re-save of the same schedule changes nothing).
  const [beforeStages, beforeCompany] = await Promise.all([
    db.paymentScheduleStage.findMany({ where: { companyId: member.companyId }, select: { label: true } }),
    db.company.findUnique({ where: { id: member.companyId }, select: { paymentTerms: true, defaultLanguage: true } }),
  ]);

  await db.$transaction([
    db.paymentScheduleStage.deleteMany({ where: { companyId: member.companyId } }),
    db.paymentScheduleStage.createMany({
      data: stages.map((s) => ({
        companyId: member.companyId,
        seq: s.seq,
        label: s.label,
        trigger: s.trigger,
        percentage: s.percentage,
      })),
    }),
    // See the file header: this is what keeps the cosmetic PDF/email cards
    // (lib/documentSections/PaymentTermsSection.js) showing the SAME numbers
    // this schedule actually bills, instead of two schedules that can
    // disagree.
    db.company.update({
      where: { id: member.companyId },
      data: { paymentTerms: generatedText },
    }),
  ]);

  await recordActivity(
    member,
    {
      action: "payment_schedule.saved",
      entityType: "company",
      entityId: member.companyId,
      summary: `Set a ${stages.length}-stage payment schedule`,
    },
  ).catch(() => {});

  const sourceLanguage = beforeCompany?.defaultLanguage || "en";
  const terms = scheduleAutoTranslate({
    companyId: member.companyId,
    model: "company",
    fields: { paymentTerms: generatedText || "" },
    sourceLanguage,
  });
  // Each stage's own name is printed on its own too — the deposit email's
  // heading, the portal's "Deposit — $3,000 due" bar — and it is COPIED onto
  // every job's JobPaymentStage at acceptance. Drafted as phrases keyed by
  // the text (lib/i18n/phrases.js), so those copies find the translation
  // without this route knowing they exist. Every save queues every label;
  // an unchanged one costs nothing.
  const labels = stages.map((s) => s.label);
  const stageLabels = schedulePhrases({ companyId: member.companyId, ns: "paymentStage", texts: labels, sourceLanguage });

  const before = new Set(beforeStages.map((s) => s.label));
  const changed = (beforeCompany?.paymentTerms || "") !== (generatedText || "") || labels.some((l) => !before.has(l));
  const autoTranslate = changed ? oneSummary(terms, stageLabels) : null;

  return NextResponse.json({ stages, generatedText, autoTranslate });
}

// The banner takes one summary. The sentence and the labels are drafted by
// the same drafter into the same languages, and the status route reads
// company keys and phrase keys from one `keys` list — so the two summaries
// merge by concatenating their keys. The sentence is reviewable on the
// Translations page, so the merged one keeps its Review link.
function oneSummary(a, b) {
  const all = [a, b].filter(Boolean);
  if (!all.length) return null;
  const [first] = all;
  return { ...first, queued: all.some((s) => s.queued), keys: all.flatMap((s) => s.keys || []) };
}
