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

  let created = 0;
  for (const type of AUTOMATED_TYPES) {
    if (haveType.has(type)) continue;
    await db.documentTemplate.create({
      data: {
        companyId,
        type,
        name: `${TEMPLATE_TYPE_META[type].label} (default)`,
        subject: defaultSubjectFor(type),
        sections: defaultSectionsFor(type),
        // theme stays null — inherit Company.brandColor / Company.logoUrl.
        isDefault: true,
      },
    });
    created++;
  }
  return created;
}
