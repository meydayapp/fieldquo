// lib/email/seedDefaultTemplates.js
//
// Unlike Products & Services (seedStandardAddOns.js), NOTHING ever
// auto-created DocumentTemplate rows — a company's Email Templates page is
// empty until someone manually clicks "+ New Template" for each type. This
// seeds one starter template per automated type that something SENDS (the
// follow-up email; quote/instructions/receipt were seeded too until it was
// found that no send path reads them), pre-filled with the real starter
// content from defaultSectionsFor(), so a follow-up rule has a template to
// pick without any manual setup. Idempotent — skips any type
// the company already has at least one template for, so re-running (or the
// existing-company backfill button) never creates duplicates.
import { db } from "@/lib/db";
import {
  defaultSectionsFor,
  defaultSubjectFor,
  TEMPLATE_TYPE_META,
} from "@/app/data/emailTemplateBlocks";
import { templateLanguageOf } from "@/lib/email/templateTranslation";

// Only the automated types something SENDS — see `sentBy` in
// TEMPLATE_TYPE_META. This used to seed a quote, instructions and receipt
// template as well, each flagged Active, for three emails that never read a
// template: a starter nobody could send.
const AUTOMATED_TYPES = Object.entries(TEMPLATE_TYPE_META)
  .filter(([, meta]) => meta.group === "Automated" && meta.sentBy)
  .map(([type]) => type);

export async function seedDefaultTemplates(companyId) {
  const existing = await db.documentTemplate.findMany({
    where: { companyId, type: { in: AUTOMATED_TYPES } },
    select: { type: true },
  });
  const haveType = new Set(existing.map((t) => t.type));
  if (AUTOMATED_TYPES.every((type) => haveType.has(type))) return 0;

  // The starters are written in the company's language (2026-10-03 — they
  // were English for everyone before; lib/i18n/emailStarterCopy.js). Read
  // here rather than passed in: signup's setup stage and the backfill button
  // both call this with the company id alone, and both should get the same
  // answer. A failed read seeds English, which is what every company got
  // until now, rather than seeding nothing.
  const company = await db.company
    .findUnique({ where: { id: companyId }, select: { defaultLanguage: true } })
    .catch(() => null);
  const language = templateLanguageOf(null, company);

  let created = 0;
  for (const type of AUTOMATED_TYPES) {
    if (haveType.has(type)) continue;
    await db.documentTemplate.create({
      data: {
        companyId,
        type,
        name: `${TEMPLATE_TYPE_META[type].label} (default)`,
        subject: defaultSubjectFor(type, language),
        sections: defaultSectionsFor(type, language),
        // The language the starter is written in — what the translation
        // panel translates from (lib/email/templateTranslation.js).
        language,
        // theme stays null — inherit Company.brandColor / Company.logoUrl.
        isDefault: true,
      },
    });
    created++;
  }
  return created;
}
