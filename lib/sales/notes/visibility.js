// lib/sales/notes/visibility.js
//
// Who may read a rep's note, and the sentence the rep is shown before they
// write one.
//
// ══ "Vertically" — what it can honestly mean today ═════════════════════════
//
// The owner asked to see reps' notes "vertically" — up the hierarchy, a
// superadmin over everyone and a manager over their own reps. Half of that is
// buildable and half is not, and the half that is not must not be faked.
//
// **The reporting line now exists, and this still ships superadmin-only.**
// `SalesRep.managerId` landed in prisma/schema.prisma on 2026-09-03, shaped
// after `Worker.manager @relation("WorkerReports")` — which leave approval uses,
// and which is a different identity space: a Worker is a CONTRACTOR'S employee
// inside a tenant, while a SalesRep is FieldQuo staff, not a Member and not in
// any company. The two never meet; only the shape was borrowed.
//
// A column is not a tier. What is still missing is the rest of the org chart:
// nothing reads `managerId` to build a viewer, there is no screen to set one,
// and there is no answer yet to what happens to notes when a rep changes
// managers. That last one is a product decision, not an implementation detail,
// and AGENTS.md says to ask rather than pick one. So the platform screen goes
// on saying why in as many words rather than leaving the absence to be
// discovered — and lib/sales/team.js's TEAM_LEAD_NOTE_VISIBILITY_FROM, still
// null, is the single switch that keeps it that way.
//
// The shape below is the part that makes adding managers cheap later:
// `canReadNote` takes a VIEWER, not a role string, so a `{ kind: "manager",
// repIds }` viewer slots in beside the two that exist without any route
// changing. What is deliberately absent is a half-built version of it.
//
// ══ Why "admin" and "support" cannot read notes ════════════════════════════
//
// PLATFORM_PERMISSIONS has no sales permission at all, and
// app/api/platform/sales/reps/route.js's own header explains why one was not
// added: it would imply the permission map has a scoping concept it does not
// have. That route therefore tests `admin.role !== "superadmin"` directly, and
// this follows it.
//
// The stronger reason is what a note is. A support session is somebody looking
// at a live account to answer a ticket; a rep's notes about a prospect are not
// evidence in anybody's ticket. Reading them is a management act, and the
// smallest set of people who can perform it is the right one.
//
// ══ Why hasLevel() is not used, and cannot be ══════════════════════════════
//
// lib/permissions/enforce.js's hasLevel() fails OPEN in four places — an
// unknown category returns true, a member with no permissions object returns
// true, a category absent from the object returns true, and a required level
// that is not in the category's list returns true. Every one of those is
// correct for what it guards (a tenant member whose grid predates the grid),
// and every one is catastrophic here, where "I could not work out what you
// asked" must mean no.
//
// It also would not apply: hasLevel takes a tenant `member` and neither a
// SalesRep nor a PlatformAdmin is one. So this module does not import it, and
// scripts/check-rep-notes.mjs asserts that no file under lib/sales/notes/ or
// app/api/sales/notes/ does either.

/** The viewer kinds this module understands. Anything else is refused. */
export const VIEWER_REP = "rep";
export const VIEWER_PLATFORM = "platform";

/**
 * The platform role that may read another person's notes. One entry, on
 * purpose — see the header. Written as a Set so adding a second is a visible,
 * reviewable act rather than a `||`.
 */
export const NOTE_READING_PLATFORM_ROLES = new Set(["superadmin"]);

/**
 * Does a reporting line exist to scope a manager's view by?
 *
 * A fact about prisma/schema.prisma, exported rather than left implicit so the
 * platform screen can state it and scripts/check-rep-notes.mjs can assert the
 * two agree. It read `false` until 2026-09-03, when `SalesRep.managerId`
 * landed; the check that ties it to the schema block is what forced this line
 * to move on the same commit, which is exactly what it was written to do.
 */
export const HAS_REPORTING_LINE = true;

/**
 * Is the manager tier actually usable? **No**, and this is deliberately a
 * SECOND constant rather than the one above.
 *
 * The column existing and the tier working are different claims, and collapsing
 * them into one boolean is how a screen starts advertising a view nobody can
 * open. Three things are still missing and none is a query: nothing reads
 * `managerId` to build a viewer, there is no screen that SETS a manager (so
 * every row's is null), and lib/sales/team.js's TEAM_LEAD_NOTE_VISIBILITY_FROM
 * is still null — the date from which a team lead may read a report's notes,
 * which is a promise to every rep who has already typed one and therefore the
 * owner's decision, not this file's.
 *
 * Flip this only when all three are true. The screen's sentence is derived
 * from it, so flipping it early changes what the console tells a superadmin.
 */
export const MANAGER_TIER_LIVE = false;

/**
 * May this viewer read this note?
 *
 * Pure, total, and fails closed on every shape it does not recognise —
 * including `null`, a viewer with no kind, a rep viewer with no id, and a note
 * with no author. Executed against all of those in
 * scripts/check-rep-notes.mjs.
 *
 * @param {{kind:string, salesRepId?:string, role?:string}|null} viewer
 * @param {{salesRepId?:string}|null} note
 */
export function canReadNote(viewer, note) {
  if (!viewer || typeof viewer !== "object") return false;
  if (!note || typeof note !== "object") return false;

  if (viewer.kind === VIEWER_PLATFORM) {
    // A role that is not a non-empty string is not "some other role", it is a
    // caller that could not tell us who is asking.
    if (typeof viewer.role !== "string" || viewer.role.length === 0) return false;
    return NOTE_READING_PLATFORM_ROLES.has(viewer.role);
  }

  if (viewer.kind === VIEWER_REP) {
    const mine = viewer.salesRepId;
    const author = note.salesRepId;
    // Both halves have to be real strings. Two undefineds compare equal, and
    // "no viewer may read the note with no author" is a rule that has to be
    // written down because the language will not enforce it.
    if (typeof mine !== "string" || mine.length === 0) return false;
    if (typeof author !== "string" || author.length === 0) return false;
    return mine === author;
  }

  return false;
}

/**
 * The `where` fragment a listing runs under.
 *
 * Never `{}` for a rep — the reasoning lib/sales/scope.js gives at length: an
 * empty object turns "I could not work out who is asking" into "show them
 * everything", and there is no outer tenant filter behind this to catch it.
 * `__none__` is the sentinel the rest of the codebase already uses and no cuid
 * can equal it.
 *
 * `{}` IS correct for a superadmin, and only for a superadmin, because seeing
 * every rep's notes is exactly what the platform screen is for. Any other
 * platform role gets the refusing filter rather than an empty one.
 */
export function noteReaderWhere(viewer) {
  if (viewer?.kind === VIEWER_PLATFORM && NOTE_READING_PLATFORM_ROLES.has(viewer.role)) {
    return {};
  }
  if (viewer?.kind === VIEWER_REP && typeof viewer.salesRepId === "string" && viewer.salesRepId) {
    return { salesRepId: viewer.salesRepId };
  }
  return { salesRepId: "__none__" };
}

/**
 * Who may WRITE a note. Narrower than reading, and not symmetrical.
 *
 * A superadmin reads every note and may edit none of them. That is
 * non-negotiable #3's shape — the console views everything and edits nothing —
 * applied to FieldQuo's own staff for the same reason it applies to a
 * customer's quote: a note is somebody's account of what a prospect said, and
 * a record a manager can silently rewrite is not a record.
 */
export function canWriteNote(viewer, note) {
  if (viewer?.kind !== VIEWER_REP) return false;
  return canReadNote(viewer, note);
}

/**
 * The sentence a rep sees ABOVE the editor, before they type anything.
 *
 * ── This is the whole trust decision, in one string ───────────────────────
 *
 * There is no private mode, and offering one would be a lie. A FieldQuo
 * superadmin has the database. A row flagged `private` that the person holding
 * the connection string can still read is a label with nothing behind it —
 * precisely the dead control AGENTS.md opens with, except that the thing it
 * fails to do is protect somebody's candour. The safer answer is the one
 * taken: everything a rep writes here is readable by a superadmin, said
 * plainly, once, where they cannot miss it.
 *
 * The second sentence is not decoration. "A manager can read this" and "the
 * rep sitting next to me can read this" are very different feelings about the
 * same box, and only one of them is true.
 */
export const VISIBILITY_NOTICE = {
  headline: "FieldQuo superadmins can read every note you write here.",
  detail:
    "Other sales reps cannot — a note is scoped to whoever wrote it. There is " +
    "no private mode, because a superadmin has the database and a private " +
    "label they could read past would be a promise FieldQuo cannot keep.",
};

/**
 * What the PLATFORM screen says about what it is.
 *
 * A surveillance surface should say what it is on the surface itself, not only
 * in the code that built it. The second sentence is the manager gap, stated
 * where somebody looking for it will be.
 */
export const PLATFORM_NOTICE = {
  headline: "Every sales rep's notes. Read-only.",
  detail:
    "Reps are told on their own compose screen that superadmins can read " +
    "this. Nothing here can edit or delete a note — a record a manager can " +
    "rewrite is not a record. There is no manager tier yet: SalesRep now has a " +
    "reporting line, but nothing fills it in, so scoping a view to “my reps” " +
    "would show an empty team. Superadmins see all reps; nobody else sees any.",
};
