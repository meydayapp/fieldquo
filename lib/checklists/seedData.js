// lib/checklists/seedData.js
//
// The pure half of lib/checklists/seedTemplates.js: one seed (app/data/
// checklistSeeds) → the JobChecklistTemplate row it becomes. Split out so the
// check and the screenshot harness can build the exact row without importing
// the database client.
import { CHECKLIST_SEED_LANGUAGES } from "@/app/data/checklistSeeds";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";

/** Pure: the `data` for one seeded template. Exported for the check. */
export function templateDataForSeed(seed, { companyId, categoryId, language }) {
  const base = CHECKLIST_SEED_LANGUAGES.includes(language) ? language : "en";

  // Every language, the row's own included: a crew screen falls back to
  // English when the viewer's language is missing, and English must be there
  // to fall back to even for a company that works in French.
  const items = [];
  for (const section of seed.sections) {
    for (const item of section.items) {
      const i18n = {};
      for (const lang of CHECKLIST_SEED_LANGUAGES) {
        i18n[lang] = {
          label: item.label[lang],
          section: section.title[lang],
          ...(item.options && { options: item.options[lang] }),
        };
      }
      items.push({
        label: item.label[base],
        section: section.title[base],
        type: item.type,
        ...(item.required && { required: true }),
        ...(item.options && { options: item.options[base] }),
        i18n,
      });
    }
  }

  return {
    companyId,
    seedKey: seed.seedKey,
    name: seed.name[base],
    translations: Object.fromEntries(CHECKLIST_SEED_LANGUAGES.map((l) => [l, { name: seed.name[l] }])),
    phase: seed.phase,
    items: normalizeChecklistItems(items, { phase: seed.phase, forcePhase: true, keepI18n: true }),
    // The generic lists belong to no trade; a trade's own list is filed under
    // the trade that installed it, so the settings list can say which.
    categoryId: seed.trades.includes("*") ? null : categoryId || null,
    requiredToClose: seed.requiredToClose === true,
    autoAddFor: seed.autoAddFor || [],
  };
}
