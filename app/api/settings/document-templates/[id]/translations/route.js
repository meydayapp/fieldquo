// app/api/settings/document-templates/[id]/translations/route.js
//
// The Translations panel of one email template (lib/email/templateTranslation.js).
//
//   GET   → which language the template is written in, one row per other
//           language (status, current or out of date, what the last draft
//           cost and who paid), an estimate per language with who WOULD pay,
//           and how many of the company's clients read each language.
//   POST  { language, full? } → draft that language now (Translate / Update;
//           `full` = Regenerate every string). The only route that sends a
//           template to a model, and only when a person presses the button.
//
// Next 16: `params` is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai/provider";
import { payerFor } from "@/lib/ai/featurePayer";
import { balanceFor, POOLS } from "@/lib/voice/credits";
import {
  absorbedThisMonth,
  translationVerdict,
  EMAIL_TRANSLATION_FEATURE,
  PER_VERSION_ABSORB_MAX_MICROS,
  MONTHLY_ABSORB_CAP_MICROS,
} from "@/lib/ai/emailTranslationMeter";
import { extractStrings, templateLanguageOf, translatableChars, MAX_TRANSLATABLE_CHARS } from "@/lib/email/templateTranslation";
import { draftTemplateTranslation, startManualTranslation, summariseTranslations } from "@/lib/email/templateTranslationStore";
import { templateTypeIsSent } from "@/app/data/emailTemplateBlocks";
import { isPdfTemplate } from "@/lib/documents/templateKind";

async function loadOwned(id, companyId) {
  // Tenant-scoped in the query, never checked afterwards.
  return db.documentTemplate.findFirst({ where: { id: String(id), companyId, documentKind: null } });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const template = await loadOwned(id, member.companyId);
  if (!template || isPdfTemplate(template.type)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // `ready`: the TemplateTranslation table exists. Until its SQL is applied the
  // read fails, and the panel hides itself rather than drawing buttons that
  // would all fail (sends are unaffected — translationsForSend never throws).
  let ready = true;
  const [company, rows, clientLanguages, payer] = await Promise.all([
    db.company.findUnique({ where: { id: member.companyId }, select: { id: true, defaultLanguage: true } }),
    db.templateTranslation
      .findMany({ where: { templateId: template.id, companyId: member.companyId } })
      .catch((err) => {
        console.error("[email translation] table unreadable:", err?.message);
        ready = false;
        return [];
      }),
    db.client
      .groupBy({ by: ["language"], where: { companyId: member.companyId }, _count: { _all: true } })
      .catch(() => []),
    payerFor(EMAIL_TRANSLATION_FEATURE),
  ]);

  const sourceLanguage = templateLanguageOf(template, company);
  const strings = extractStrings(template);
  const languages = summariseTranslations({ template, company, rows });

  // Who would pay for each draft, decided by the same pure rule the meter
  // applies at the moment of the call — so the panel's promise and the
  // charge cannot disagree. Read once for the whole panel.
  let balanceCents = 0;
  let absorbedMicros = 0;
  if (payer !== "fieldquo") {
    [balanceCents, absorbedMicros] = await Promise.all([
      balanceFor(member.companyId, db, POOLS.AI).catch(() => 0),
      absorbedThisMonth(db, member.companyId).catch(() => MONTHLY_ABSORB_CAP_MICROS),
    ]);
  }
  for (const l of languages) {
    l.wouldBill =
      payer === "fieldquo"
        ? { billing: "fieldquo", allowed: true, code: null, needCents: 0 }
        : (({ allowed, billing, code, needCents }) => ({ allowed, billing, code, needCents }))(
            translationVerdict({ balanceCents, estimateMicros: l.estimateMicros, absorbedThisMonthMicros: absorbedMicros }),
          );
  }

  // How many clients read each language — a client with none set is written
  // to in the company's default (lib/i18n/clientLanguage.js).
  const readers = {};
  for (const g of clientLanguages || []) {
    const lang = g.language || company?.defaultLanguage || "en";
    readers[lang] = (readers[lang] || 0) + (g._count?._all || 0);
  }

  return NextResponse.json({
    templateId: template.id,
    ready,
    sent: templateTypeIsSent(template.type),
    sourceLanguage,
    strings: strings.length,
    chars: translatableChars(strings),
    maxChars: MAX_TRANSLATABLE_CHARS,
    aiAvailable: isAiConfigured(),
    payer,
    perVersionAbsorbMaxMicros: PER_VERSION_ABSORB_MAX_MICROS,
    monthlyAbsorbCapMicros: MONTHLY_ABSORB_CAP_MICROS,
    absorbedThisMonthMicros: absorbedMicros,
    aiCreditCents: balanceCents,
    readers,
    languages,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners/admins can manage email templates", code: "forbidden" }, { status: 403 });
  }

  const template = await loadOwned(id, member.companyId);
  if (!template || isPdfTemplate(template.type)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { id: true, defaultLanguage: true },
  });

  // `manual`: "Write it yourself" — an empty draft, no model, no cost.
  const result =
    body?.manual === true
      ? await startManualTranslation({ template, company, language: body?.language })
      : await draftTemplateTranslation({
          template,
          company,
          language: body?.language,
          full: body?.full === true,
          userId: member.userId || null,
        });

  if (!result.ok) {
    const status =
      result.code === "bad_language" || result.code === "same_language" || result.code === "nothing_to_translate" || result.code === "too_long"
        ? 400
        : result.code === "ai_unavailable" || result.code === "platform_paused"
          ? 503
          : result.code === "needs_credit_large" || result.code === "needs_credit_monthly"
            ? 402
            : 502;
    return NextResponse.json(
      {
        error: result.reason || result.code,
        code: result.code,
        estimateMicros: result.estimateMicros ?? null,
        costMicros: result.paid?.costMicros ?? 0,
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    language: result.row.language,
    status: result.row.status,
    problems: result.problems,
    reused: result.reused,
    costMicros: result.paid?.costMicros || 0,
    billing: result.paid?.billing || null,
    chargedCents: result.paid?.chargedCents || 0,
  });
}
