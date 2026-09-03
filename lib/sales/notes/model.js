// lib/sales/notes/model.js
//
// The named interface this feature is built against, because the schema it
// needs does not exist yet.
//
// ══ Why a named interface instead of a model ═══════════════════════════════
//
// `prisma/schema.prisma` is contested. The owner wrote the last pass by hand
// (37b4e9f, "One schema pass, by hand, to unblock eight queued items") after
// the file was invalidated twice by agents sweeping each other's models, and
// this session has twelve agents running. Adding `SalesRepNote` from here
// would be the thirteenth hand on a file that has already broken twice.
//
// So everything else in lib/sales/notes/ — scope, visibility, parents, body
// sanitising, the guarded write — is written, executed and checked against
// this declaration rather than against a live delegate. The day the model
// lands, `notesAvailable()` starts returning true and every screen and route
// works with no code change.
//
// ══ What the screens do until then ═════════════════════════════════════════
//
// They say so. `notesAvailable()` is checked by every route and by both
// screens, and when it is false the screens render an explanation and NO
// controls — not a disabled editor, not a spinner, not a Save button that
// 500s. AGENTS.md's first rule is the whole reason this shape was chosen over
// shipping a compose box that throws.
//
// ══ The block to add ═══════════════════════════════════════════════════════
//
// Verbatim. scripts/check-rep-notes.mjs asserts that IF schema.prisma declares
// `model SalesRepNote`, every field this module names is present on it — so
// the two cannot drift, in either direction.
//
//   /// A sales rep's own note. The Notion-shaped surface, minus the editor
//   /// that would not install — see lib/sales/notes/body.js.
//   ///
//   /// NOT tenant data: a rep is not a member of any company, so there is no
//   /// companyId here and there must never be one. The scoping column is
//   /// salesRepId, exactly as lib/sales/scope.js argues for a rep's company
//   /// list — the fragment IS the boundary, not a filter behind one.
//   model SalesRepNote {
//     id String @id @default(cuid())
//
//     salesRepId String
//     salesRep   SalesRep @relation(fields: [salesRepId], references: [id], onDelete: Cascade)
//
//     title String @default("")
//
//     /// What `body` holds. Named rather than assumed so a richer editor can
//     /// land later without having to guess at the rows written before it.
//     body       String @default("")
//     bodyFormat String @default("text")
//
//     /// Optional parents, and ALL THREE may be null. A rep jotting during a
//     /// call has not decided what the note is about yet, and forcing a parent
//     /// would mean inventing one — the same reasoning SalesLead.prospectId
//     /// gives for staying nullable.
//     ///
//     /// SetNull rather than Cascade: deleting a lead must not delete the
//     /// rep's notes about it. What survives is the note plus parentLabel.
//     leadId     String?
//     lead       SalesLead? @relation(fields: [leadId], references: [id], onDelete: SetNull)
//     threadId   String?
//     thread     SalesThread? @relation(fields: [threadId], references: [id], onDelete: SetNull)
//     prospectId String?
//     prospect   Prospect? @relation(fields: [prospectId], references: [id], onDelete: SetNull)
//
//     /// The parent's name, frozen when the note was attached. Same reasoning
//     /// as ActivityLog.actorName: when the lead is deleted the FK goes null,
//     /// and "this was about Acme Painting" is the one fact worth keeping.
//     parentLabel String?
//
//     /// Soft. Nothing hard-deletes a note — see RETENTION below.
//     archivedAt DateTime?
//
//     createdAt DateTime @default(now())
//     updatedAt DateTime @updatedAt
//
//     @@index([salesRepId, updatedAt])
//     @@index([leadId])
//   }
//
// SalesRep, SalesLead, SalesThread and Prospect each need the back-relation
// (`repNotes SalesRepNote[]` and so on) or `prisma validate` refuses the file.

/**
 * The Prisma delegate name. One constant, so a route cannot spell it slightly
 * differently from the check that proves the route is right.
 */
export const REP_NOTE_MODEL = "salesRepNote";

/**
 * Every column this feature reads or writes.
 *
 * The check asserts this list against schema.prisma when the model exists, and
 * against the routes' own source when it does not. A field here that no route
 * touches, or a route touching a field not here, is AGENTS.md failure class #1
 * caught at build time instead of in production.
 */
export const REP_NOTE_FIELDS = [
  "id",
  "salesRepId",
  "title",
  "body",
  "bodyFormat",
  "leadId",
  "threadId",
  "prospectId",
  "parentLabel",
  "archivedAt",
  "createdAt",
  "updatedAt",
];

/**
 * How long a note is kept, and the honest answer about who decided.
 *
 * ── NOT ADDRESSED IN v1, deliberately and out loud ────────────────────────
 *
 * A rep's note about a prospect is personal information about a named human
 * who never asked to be in FieldQuo's database. lib/sales/suppression.js sets
 * the precedent that matters — three years and fourteen days, computed on the
 * calendar, stored per row as `retainUntil`, removable only by a superadmin
 * with a reason — and a note SHOULD carry the same clock.
 *
 * It does not, and this is why: a `retainUntil` column that no sweep reads is
 * failure class #1, and the sweep belongs to the cron work another agent owns
 * this session (`lib/jobs/dailyLog.js` and the 09:20 UTC retention sweep are
 * explicitly not mine to touch). Writing the column here and leaving the
 * reader to somebody else is how "saved, never applied" happens.
 *
 * So v1 keeps notes indefinitely, says so on the screen, and names the two
 * things that close it: a `retainUntil` on the model above, and a sweep beside
 * the suppression one. The privacy officer of record is
 * lib/legal/privacyOfficer.js — a deletion request arriving today is answered
 * by hand, which is a real answer and not a good one.
 */
export const RETENTION = {
  applied: false,
  statement:
    "Notes are kept until a rep archives them. FieldQuo has no automatic " +
    "deletion clock on them yet — unlike the do-not-contact list, which is " +
    "kept three years and fourteen days. If a prospect asks for their " +
    "information to be removed, that is done by hand today.",
};

/**
 * Is the note table actually there?
 *
 * Prisma generates one property per model on the client, so an ungenerated
 * model is a plain `undefined` — reading `.findMany` off it is a TypeError and
 * a 500. This is the probe that turns that into a sentence.
 *
 * Takes the client as an argument rather than importing lib/db, so
 * scripts/check-rep-notes.mjs can execute THIS file against a double instead
 * of a copy of it — the discipline lib/concurrency/staleWrite.js's header sets
 * out and for the same reason.
 */
export function notesAvailable(client) {
  const delegate = client?.[REP_NOTE_MODEL];
  return Boolean(delegate) && typeof delegate.findMany === "function";
}

/** The refusal every route returns when the table is missing. Not a 500. */
export const NOTES_UNAVAILABLE = {
  status: 503,
  body: {
    error:
      "Rep notes aren't switched on yet — the SalesRepNote table hasn't been " +
      "created. Nothing you typed was saved. See lib/sales/notes/model.js for " +
      "the exact schema block.",
    code: "notes_model_missing",
  },
};
