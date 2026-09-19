// lib/email/documentEmailCopies.js
//
// Loading and storing a company's wording copies of its document emails.
// What a slot MEANS is lib/email/documentEmailWording.js; this is the only
// file that reads or writes the rows.
//
// A copy is a DocumentTemplate row with `documentKind` and `language` set
// (schema comment on DocumentTemplate). One per (company, kind, language),
// which the unique index enforces. `isDefault` is "Use this": the send paths
// read a copy only while it is true. The original is never a row.

import {
  documentEmailKind,
  originalWording,
  sectionsFromSlots,
  slotsFromSections,
  chooseWording,
  COPY_LANGUAGES,
  WORDING_SLOTS,
} from "./documentEmailWording.js";

const COPY_SELECT = {
  id: true,
  documentKind: true,
  language: true,
  isDefault: true,
  sections: true,
  sentMode: true,
  canvas: true,
  updatedAt: true,
};

/**
 * The wording a send should use for one document, resolved from the
 * document's language: the active copy in that language, else the original.
 * Never throws — a failed read means the original goes out, which is what
 * went out before copies existed.
 */
export async function loadDocumentWording(db, { companyId, kind, language }) {
  if (!companyId || !documentEmailKind(kind)) return chooseWording({ copy: null });
  try {
    const copy = await db.documentTemplate.findFirst({
      where: { companyId, documentKind: kind, language: language || "en" },
      select: COPY_SELECT,
    });
    return chooseWording({ copy });
  } catch (err) {
    console.error("[document emails] wording read failed:", err?.message);
    return chooseWording({ copy: null });
  }
}

/** Every copy the company has, for the settings page. */
export async function listDocumentEmailCopies(db, companyId) {
  const rows = await db.documentTemplate.findMany({
    where: { companyId, documentKind: { not: null } },
    select: COPY_SELECT,
    orderBy: [{ documentKind: "asc" }, { language: "asc" }],
  });
  return rows.map(shapeCopy);
}

export function shapeCopy(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.documentKind,
    language: row.language,
    active: Boolean(row.isDefault),
    slots: slotsFromSections(row.sections) || originalWording(row.documentKind, row.language),
    sentMode: row.sentMode === "canvas" ? "canvas" : "blocks",
    hasCanvas: Boolean(row.canvas),
    canvas: row.canvas || null,
    updatedAt: row.updatedAt,
  };
}

/**
 * "Customise": a copy seeded from the original's slots, in one language.
 * Not switched on — the company reads it, edits it, and presses "Use this".
 * Idempotent: an existing copy is returned untouched, so pressing Customise
 * twice never overwrites an edit.
 */
export async function ensureDocumentEmailCopy(db, { companyId, kind, language }) {
  const meta = documentEmailKind(kind);
  if (!meta) throw new Error(`Unknown document email: ${kind}`);
  if (!COPY_LANGUAGES.includes(language)) throw new Error(`A copy can be written in ${COPY_LANGUAGES.join(", ")} — not ${language}`);
  const existing = await db.documentTemplate.findFirst({
    where: { companyId, documentKind: kind, language },
    select: COPY_SELECT,
  });
  if (existing) return shapeCopy(existing);
  const created = await db.documentTemplate.create({
    data: {
      companyId,
      type: meta.type,
      name: `${kind} email (${language})`,
      documentKind: kind,
      language,
      isDefault: false,
      sections: sectionsFromSlots(originalWording(kind, language)),
      sentMode: "blocks",
    },
    select: COPY_SELECT,
  });
  return shapeCopy(created);
}

/**
 * Edit a copy. Only the five slots, the switch, the mode and the canvas are
 * writable; `type`, `documentKind` and `language` never change after
 * creation — a copy cannot be moved to another language, because its words
 * are in this one.
 *
 * `reset: true` re-copies the original's wording into the slots (and leaves
 * the canvas and the switch alone — "Reset to original" is about words).
 * Switching `sentMode` never clears the other body.
 */
export async function updateDocumentEmailCopy(db, copy, patch = {}) {
  const data = {};
  if (patch.reset === true) {
    data.sections = sectionsFromSlots(originalWording(copy.documentKind, copy.language));
  } else if (patch.slots && typeof patch.slots === "object") {
    const current = slotsFromSections(copy.sections) || originalWording(copy.documentKind, copy.language);
    const next = { ...current };
    for (const slot of WORDING_SLOTS) {
      if (typeof patch.slots[slot] === "string") next[slot] = patch.slots[slot].slice(0, 2000);
    }
    data.sections = sectionsFromSlots(next);
  }
  if (typeof patch.active === "boolean") data.isDefault = patch.active;
  if (patch.sentMode === "blocks" || patch.sentMode === "canvas") data.sentMode = patch.sentMode;
  if (patch.canvas !== undefined) data.canvas = patch.canvas;
  const updated = await db.documentTemplate.update({
    where: { id: copy.id },
    data,
    select: COPY_SELECT,
  });
  return shapeCopy(updated);
}
