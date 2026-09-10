// lib/sales/notes/parents.js
//
// What a note is about — including "nothing yet", which is the common case.
//
// ══ Why a parent is optional ═══════════════════════════════════════════════
//
// A rep on a call is typing before they know what they are typing about. The
// business might already be a Prospect from discovery, or a SalesLead they
// typed in last week, or neither. Forcing a parent at creation would mean the
// rep either files it wrongly or opens a second screen first, and the second
// screen is what makes people stop taking notes.
//
// So all three foreign keys are nullable, a note with none of them is a
// scratchpad, and attaching one later is an ordinary edit. Same reasoning
// SalesLead.prospectId gives for staying nullable: a rep meeting somebody at a
// trade show has a lead with no discovery record behind it, and inventing one
// would be a fact that never happened.
//
// ══ Why exactly one, never two ═════════════════════════════════════════════
//
// A note about a lead is also, transitively, about that lead's prospect and its
// threads. Storing all three would make "notes about this lead" and "notes
// about this prospect" return overlapping sets that disagree about the total,
// and the denormalised copies would drift the moment SalesLead.prospectId
// changed. One parent, and the joins answer the rest.
//
// ══ The deleted parent ═════════════════════════════════════════════════════
//
// The relations are `onDelete: SetNull` (see lib/sales/notes/model.js), so
// deleting a lead nulls the FK and leaves the note standing. That is the right
// direction — a rep's account of a conversation does not stop being true
// because the pipeline row was tidied up — but on its own it loses the one
// thing worth keeping, which is WHO it was about.
//
// Hence `parentLabel`: the parent's name, frozen at attach time, exactly as
// ActivityLog.actorName freezes the actor's. When the FK is null and the label
// is not, `describeParent` says "Acme Painting (no longer in the pipeline)"
// rather than silently becoming a scratchpad. A note that quietly loses its
// subject is worse than one that says it lost it.

/** The parents a note may hang off, and the complete list. */
export const PARENT_KINDS = ["lead", "thread", "prospect"];

/** The FK column each kind writes. One map, so no route spells it twice. */
export const PARENT_FIELD = {
  lead: "leadId",
  thread: "threadId",
  prospect: "prospectId",
};

/** Every FK column, nulled together whenever the parent changes. */
export const PARENT_FIELDS = PARENT_KINDS.map((k) => PARENT_FIELD[k]);

export class ParentError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "bad_parent";
  }
}

/**
 * Turn what a browser sent into the three columns, or refuse.
 *
 * Returns an object that ALWAYS carries all three keys, so it can be spread
 * straight into a Prisma `data` and clear a previous parent rather than
 * leaving a stale one behind. `{ leadId: "x" }` alone would attach the note to
 * a lead while leaving prospectId pointing at whatever it pointed at before —
 * two parents, which the header rules out.
 *
 * @param {{parentKind?:string, parentId?:string, parentLabel?:string}} input
 * @returns {{leadId:string|null, threadId:string|null, prospectId:string|null,
 *            parentLabel:string|null}}
 */
export function normaliseParent(input) {
  const empty = { leadId: null, threadId: null, prospectId: null, parentLabel: null };

  const kind = input?.parentKind;
  const id = input?.parentId;

  // Nothing stated at all — a scratchpad, and the normal case.
  const kindGiven = typeof kind === "string" && kind.length > 0;
  const idGiven = typeof id === "string" && id.length > 0;
  if (!kindGiven && !idGiven) return empty;

  // Half an answer is a bug in the caller, not a scratchpad. Reading it as
  // "no parent" would silently drop an attachment the rep asked for — the
  // padding-absent-data failure, arriving as a shrug instead of a default.
  if (kindGiven !== idGiven) {
    throw new ParentError(
      "A note's parent needs both a kind and an id, or neither.",
    );
  }

  if (!PARENT_KINDS.includes(kind)) {
    throw new ParentError(
      `A note can be about a ${PARENT_KINDS.join(", a ")} — not a "${kind}".`,
    );
  }

  const label = typeof input?.parentLabel === "string" ? input.parentLabel.trim() : "";

  return {
    ...empty,
    [PARENT_FIELD[kind]]: id,
    // Frozen now. Truncated because it is display text, not an identifier, and
    // a 40KB "business name" is a payload, not a name.
    parentLabel: label ? label.slice(0, 200) : null,
  };
}

/**
 * Which kind a stored note actually has, read off the row.
 *
 * Returns null for a scratchpad AND for a note whose parent was deleted — in
 * the second case `describeParent` is what carries the difference, because the
 * KIND is genuinely gone once the FK is null. There is no column that
 * remembers "this used to be a lead", and inventing one from the label would
 * be a guess.
 */
export function parentKindOf(note) {
  if (!note) return null;
  for (const kind of PARENT_KINDS) {
    if (note[PARENT_FIELD[kind]]) return kind;
  }
  return null;
}

/**
 * One sentence for the screen. Total — every note has one of four states.
 *
 * @returns {{state:"none"|"attached"|"orphaned", kind:string|null,
 *            id:string|null, label:string|null, text:string}}
 */
export function describeParent(note) {
  const kind = parentKindOf(note);
  const label = typeof note?.parentLabel === "string" && note.parentLabel ? note.parentLabel : null;

  if (kind) {
    return {
      state: "attached",
      kind,
      id: note[PARENT_FIELD[kind]],
      label,
      text: label ? `${LABEL_FOR[kind]}: ${label}` : `${LABEL_FOR[kind]} (unnamed)`,
    };
  }

  if (label) {
    return {
      state: "orphaned",
      kind: null,
      id: null,
      label,
      // Says what happened rather than pretending it did not. The record it
      // pointed at is gone; the note is not.
      text: `${label} — no longer in the pipeline`,
    };
  }

  return { state: "none", kind: null, id: null, label: null, text: "Not attached to anything" };
}

const LABEL_FOR = { lead: "Lead", thread: "Conversation", prospect: "Prospect" };

/**
 * The three kind names, as catalogue keys. Written out longhand rather than
 * built from the kind: check-translations.mjs reads source text and cannot see
 * a key assembled at runtime, so a computed one renders as its own name the
 * day somebody mistypes it. The two note screens made the same argument for
 * the same three keys, which is part of why they held copies.
 */
export const PARENT_KIND_KEYS = {
  lead: "app.salesNotes.parentKindLead",
  thread: "app.salesNotes.parentKindThread",
  prospect: "app.salesNotes.parentKindProspect",
};

/**
 * The same sentence describeParent() composes, in the reader's language.
 *
 * ── Why this takes `t` rather than importing one ──────────────────────────
 *
 * Both note screens carried a copy of this function, and both carried a
 * comment saying so: "a page module is not an importable home for a helper,
 * and the home this belongs in is lib/sales/notes/parents.js — where
 * describeParent would take `t` instead of composing English. Keep the two in
 * step." They were right, and this is that file.
 *
 * describeParent() itself is UNCHANGED and still English. It has callers with
 * no reader whose language could be consulted, and scripts/check-rep-notes.mjs
 * executes it under bare node — importing a React hook here would make this
 * module unloadable by the check and pull a client boundary into a pure file.
 * So the translator is a parameter, which is the same shape
 * lib/sales/suppression.js uses for its database client and for the same
 * reason: it keeps the function testable and keeps the dependency at the call
 * site that already has one.
 *
 * The LABEL is never translated. It is the prospect's own name, frozen at
 * attach time, and it is data.
 *
 * @param t       a translator, `t(key, values)`.
 * @param parent  what describeParent() returned, or null.
 */
export function parentSentence(t, parent) {
  if (!parent) return "";
  if (parent.state === "attached") {
    const kind = t(PARENT_KIND_KEYS[parent.kind] || PARENT_KIND_KEYS.lead);
    return parent.label
      ? t("app.salesNotes.parentNamed", { kind, label: parent.label })
      : t("app.salesNotes.parentUnnamed", { kind });
  }
  if (parent.state === "orphaned") {
    return t("app.salesNotes.parentGone", { label: parent.label });
  }
  return t("app.salesNotes.parentNone");
}
