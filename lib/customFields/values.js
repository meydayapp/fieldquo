// lib/customFields/values.js
//
// The ONE reader and writer of CustomFieldValue.
//
// ── Tenant scoping, twice ───────────────────────────────────────────────────
//
// CustomFieldValue is polymorphic: `entityId` is a Client id or a Job id or a
// Member id, and the row itself carries no companyId. So a value is reachable
// only through its DEFINITION (CustomField.companyId), and before a value is
// WRITTEN the entity is looked up inside the caller's company too — a caller
// who knows another tenant's client id must get "not found", not a box on
// that client. Both checks run on every call; neither trusts the other.
//
// ── Why the record routes don't write these themselves ──────────────────────
//
// Six record forms, six save routes, some with shared payload builders and
// stale-write guards of their own. Threading a `customFields` key through
// each would put the same validation in six places, and the copy nobody
// looks at is the one that rots (AGENTS.md failure class #4). One route
// (app/api/custom-fields/values) and one component (CustomFieldsBox) instead;
// the record form saves its own row, then the box saves its answers against
// that row's id. A new record gets its id from the first save and the box
// saves straight after — see useCustomFields in app/components/customFields.

import { normaliseSubmission, isEntityType } from "@/lib/customFields/validate";
import { loadPhrases } from "@/lib/i18n/phrases";

/**
 * How each entity type proves it belongs to the company, and which id its
 * answers hang off. Returns the EFFECTIVE entity id, or null when the record
 * is not this company's (or does not exist — the two are indistinguishable
 * on purpose).
 *
 * Invoices resolve to the FAMILY ROOT: amending a sent invoice creates a new
 * row (app/api/invoices/[id]/route.js, lib/invoices/family.js), and a PO
 * number keyed to the superseded row would vanish from the amended one. The
 * root id is stable for the life of the family, so the answers follow it.
 */
const ENTITY_LOOKUP = {
  client: async (db, companyId, id) =>
    (await db.client.findFirst({ where: { id, companyId }, select: { id: true } }))?.id ?? null,
  quote: async (db, companyId, id) =>
    (await db.quote.findFirst({ where: { id, companyId }, select: { id: true } }))?.id ?? null,
  job: async (db, companyId, id) =>
    (await db.job.findFirst({ where: { id, companyId }, select: { id: true } }))?.id ?? null,
  invoice: async (db, companyId, id) => {
    const row = await db.invoice.findFirst({
      where: { id, companyId },
      select: { id: true, parentInvoiceId: true },
    });
    return row ? row.parentInvoiceId || row.id : null;
  },
  // "team" is the Worker row — the person on the books, with the edit card
  // and the person file (app/app/settings/team/workers, .../people/[workerId]).
  // Member is the login/seat; a ticket expiry belongs to the person.
  team: async (db, companyId, id) =>
    (await db.worker.findFirst({ where: { id, companyId }, select: { id: true } }))?.id ?? null,
  // There is no Property model in the schema. The enum value exists; no record
  // does. A definition of this type can be listed and deleted, never filled.
  property: async () => null,
};

/** The id answers are stored under, or null when the record is not this company's. */
export async function resolveCustomFieldEntity(db, companyId, entityType, entityId) {
  if (!companyId || !isEntityType(entityType) || !entityId || typeof entityId !== "string") return null;
  return ENTITY_LOOKUP[entityType](db, companyId, entityId);
}

/**
 * Definitions for one entity type, in display order, with this record's
 * answers merged in. `entityId` may be null (a record not yet created): the
 * definitions come back with empty values so a "new" form can show the boxes.
 */
export async function loadCustomFields(db, companyId, entityType, entityId, { resolved = false } = {}) {
  if (!companyId || !isEntityType(entityType)) return [];
  // `resolved` is set by callers that already ran resolveCustomFieldEntity
  // (the route, the save path); everyone else gets the lookup done here so a
  // foreign id can never read another company's answers by way of a
  // definition of ours with a matching entityId.
  const storedId = entityId ? (resolved ? entityId : await resolveCustomFieldEntity(db, companyId, entityType, entityId)) : null;
  const fields = await db.customField.findMany({
    where: { companyId, entityType },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  if (fields.length === 0) return [];

  let byField = new Map();
  if (storedId) {
    const values = await db.customFieldValue.findMany({
      where: { entityId: storedId, customFieldId: { in: fields.map((f) => f.id) } },
      select: { customFieldId: true, value: true },
    });
    byField = new Map(values.map((v) => [v.customFieldId, v.value]));
  }

  return fields.map((f) => ({
    id: f.id,
    entityType: f.entityType,
    label: f.label,
    fieldType: f.fieldType,
    options: Array.isArray(f.options) ? f.options : [],
    required: f.required,
    showOnDocuments: f.showOnDocuments === true,
    value: byField.has(f.id) ? byField.get(f.id) : null,
  }));
}

/**
 * Only the answers that go on the client-facing document: definitions with
 * `showOnDocuments` on, for quote and invoice rows, with a non-empty value.
 * Returns [{ label, fieldType, value }] — what lib/documentSections prints.
 *
 * `language` — the document's language. The label ("PO number") is the
 * company's own words, drafted into the other document languages when the
 * definition is saved (app/api/custom-fields, lib/i18n/phrases.js namespace
 * customFieldLabel), and swapped in HERE rather than in each renderer: the
 * PDF, the two emails, the /q page and the portal all print what this
 * returns, so one lookup covers every copy and they cannot disagree. A label
 * with no draft yet prints as the company wrote it. Omitted → the label as
 * written (a staff screen, or a caller that does not know the language).
 *
 * The ANSWER is not translated: it is what someone typed for this one record
 * (a PO number, a date) and a drafted translation of it would be wrong more
 * often than right.
 */
export async function loadDocumentCustomFields(db, companyId, entityType, entityId, { language = null } = {}) {
  if (entityType !== "quote" && entityType !== "invoice") return [];
  const all = await loadCustomFields(db, companyId, entityType, entityId);
  const shown = all
    .filter((f) => f.showOnDocuments && f.value !== null && f.value !== "")
    .map((f) => ({ label: f.label, fieldType: f.fieldType, value: f.value }));
  if (!language || shown.length === 0) return shown;
  const tr = await loadPhrases(db, companyId, language, shown.map((f) => ({ ns: "customFieldLabel", text: f.label })));
  return translateCustomFieldLabels(shown, tr);
}

/**
 * The document facts with each label passed through `tr` (loadPhrases's
 * lookup). Pure, for the check script: a missing or empty label stays as it
 * was, and the answer is never touched.
 */
export function translateCustomFieldLabels(fields, tr) {
  if (!Array.isArray(fields)) return [];
  if (typeof tr !== "function") return fields;
  return fields.map((f) =>
    f && typeof f.label === "string" && f.label.trim() ? { ...f, label: tr("customFieldLabel", f.label) || f.label } : f,
  );
}

/**
 * Validate and upsert answers for one record.
 *
 * @param {object} db
 * @param {string} companyId
 * @param {string} entityType
 * @param {string} entityId
 * @param {Record<string, any>} submitted   { [customFieldId]: rawValue }
 * @returns {Promise<{ ok: true, fields: Array } | { ok: false, status: number, error: string, errors?: Record<string,string> }>}
 */
export async function saveCustomFieldValues(db, companyId, entityType, entityId, submitted) {
  if (!companyId || !isEntityType(entityType)) {
    return { ok: false, status: 400, error: "A valid entityType is required" };
  }
  if (!entityId || typeof entityId !== "string") {
    return { ok: false, status: 400, error: "entityId is required" };
  }
  const storedId = await resolveCustomFieldEntity(db, companyId, entityType, entityId);
  if (!storedId) return { ok: false, status: 404, error: "Not found" };

  const fields = await db.customField.findMany({
    where: { companyId, entityType },
    select: { id: true, label: true, fieldType: true, options: true, required: true },
  });
  const result = normaliseSubmission(fields, submitted);
  if (!result.ok) {
    return { ok: false, status: 400, error: "Some answers are not valid", errors: result.errors };
  }

  await db.$transaction(
    result.values.map(({ fieldId, value }) =>
      db.customFieldValue.upsert({
        where: { customFieldId_entityId: { customFieldId: fieldId, entityId: storedId } },
        create: { customFieldId: fieldId, entityId: storedId, value },
        update: { value },
      }),
    ),
  );

  return { ok: true, fields: await loadCustomFields(db, companyId, entityType, storedId, { resolved: true }) };
}
