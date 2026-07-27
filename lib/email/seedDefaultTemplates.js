// lib/email/seedDefaultTemplates.js
//
// Unlike Products & Services (seedStandardAddOns.js), NOTHING ever
// auto-created DocumentTemplate rows — a company's Email Templates page is
// empty until someone manually clicks "+ New Template" for each type. This
// seeds one starter template per automated type (quote/instructions/receipt/
// follow-up), pre-filled with the real starter content from
// defaultSectionsFor(), and marks it Active immediately so automation has
// something to send without any manual setup. Idempotent — skips any type
// the company already has at least one template for, so re-running (or the
// existing-company backfill button) never creates duplicates.
import { db } from "@/lib/db";
import {
  defaultSectionsFor,
  defaultSubjectFor,
  TEMPLATE_TYPE_META,
} from "@/app/data/emailTemplateBlocks";

const AUTOMATED_TYPES = Object.entries(TEMPLATE_TYPE_META)
  .filter(([, meta]) => meta.group === "Automated")
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
