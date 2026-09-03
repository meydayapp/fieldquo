// lib/sales/team.js
//
// Three tiers over one sales floor: a rep, the person they report to, and a
// FieldQuo superadmin. What each may see, and — the part that matters — what
// each may not.
//
// ══ Why the scope is ONE fragment and not a rule at every call site ════════
//
// OMniLeads answers "which campaigns may this supervisor see" by writing
// `if admin: everything else: supervisor.assigned()` by hand at roughly
// twenty-five view functions. It works, and it is exactly the failure AGENTS.md
// names — the copy is the one that rots, because it is the one nobody looks at.
// One of those call sites (its supervisor callback-reassignment endpoint)
// already disagrees with the other twenty-four and refuses an administrator.
//
// So the scope here is computed once, by visibleRepIds(), and every screen
// spreads the fragment it produces. lib/sales/scope.js's assignedCompanyWhere()
// is the shape being followed, including the part that matters most: it never
// returns "everything" by accident. `null` means every rep and is reachable
// ONLY from a superadmin viewer; every other unrecognised shape lands on the
// refusing sentinel.
//
// ══ Why "team lead" and not "supervisor" ══════════════════════════════════
//
// `supervisor` is already taken, and taken in a way that has burned this
// project once. It is a tenant Member role — a contractor's own employee —
// and lib/permissions/roleManagement.js labels it "Manager" on screen.
// scripts/check-role-vocabulary.mjs exists because two screens used two names
// for that one role and the owner reasonably concluded a member had escalated
// their own permissions. Introducing a THIRD meaning of "supervisor", inside
// FieldQuo's own staff, is how that happens again. "Team lead" collides with
// nothing.
//
// ══ A tier is derived, never stored ═══════════════════════════════════════
//
// There is no `tier` column and there must not be one. A rep is a team lead if
// somebody reports to them — that is the definition, and storing it separately
// creates a second answer that can disagree with the first. The reporting line
// itself is `SalesRep.managerId`, defined in
// lib/sales/calls/schema.pending.prisma and shaped after
// Worker.manager @relation("WorkerReports"), which leave approval already uses.

/** Viewer kinds. The first two are re-exported from the notes module's set. */
export const VIEWER_REP = "rep";
export const VIEWER_TEAM_LEAD = "team_lead";
export const VIEWER_PLATFORM = "platform";

/** The one platform role with a full view of the sales floor. */
export const FULL_VIEW_PLATFORM_ROLES = new Set(["superadmin"]);

/** The sentinel every other scope helper in this repo already uses. */
export const NO_REP = "__none__";

/**
 * When a team lead's view of their reports' notes begins.
 *
 * ══ Why a date and not just a flag ════════════════════════════════════════
 *
 * Until this ships, every rep who typed a note read this sentence above the
 * box: "Other sales reps cannot [read this] — a note is scoped to whoever
 * wrote it." A team lead is a sales rep. Turning the tier on without a
 * boundary would retroactively falsify a promise those reps relied on when
 * they decided what to write down, and a promise you can revoke backwards was
 * never a promise.
 *
 * So the notice changes and the visibility changes together, and only notes
 * written AFTER the change are in scope. Notes older than this stay
 * superadmin-only forever. That costs a team lead some history; it costs the
 * product nothing it was entitled to.
 *
 * Set to null while the tier is not live, which is what makes the whole thing
 * inert today: canReadTeamNote() refuses everything when there is no boundary.
 * The day the owner enables it, this becomes the ISO date of that day and
 * never moves again. Moving it earlier is the thing this constant exists to
 * make visible in a diff.
 */
export const TEAM_LEAD_NOTE_VISIBILITY_FROM = null;

/**
 * What a team lead may NOT see, written down rather than left as the absence
 * of code.
 *
 * The same discipline lib/sales/gate.js's REP_FORBIDDEN_WRITES and
 * lib/platform/permissions.js's SUPERADMIN_ONLY_PERMISSIONS follow: a rule
 * should be discoverable from the file, not only from what is missing.
 *
 * Each entry is a decision, so each carries its reason:
 */
export const TEAM_LEAD_CANNOT_SEE = Object.freeze([
  {
    key: "commission_amounts",
    label: "What their reps are paid",
    reason:
      "Commission is money, and money on the sales floor is superadmin-only for the same reason billing:manage is — see SUPERADMIN_ONLY_PERMISSIONS. A team lead can see that a milestone was reached, which is the coaching fact; the cents attached to it are between the rep and FieldQuo.",
  },
  {
    key: "payout_batches",
    label: "Payout batches",
    reason:
      "The ledger and its weekly close. Same reason as above, and a lead who can read a batch can work backwards to a colleague's plan.",
  },
  {
    key: "other_teams",
    label: "Reps who do not report to them",
    reason:
      "The whole point of the tier. A lead's view is their line, not the floor — the floor is the superadmin's screen.",
  },
  {
    key: "suppression_admin",
    label: "The do-not-contact list, and lifting an entry",
    reason:
      "SalesSuppression binds FieldQuo across every channel and every rep, and lib/sales/suppression.js already makes removal superadmin-only with a written reason. A team lead adds to it through a rep's disposition like anyone else; nobody below a superadmin takes anything off it.",
  },
  {
    key: "sales_line_transcripts",
    label: "Transcripts from FieldQuo's own inbound line",
    reason:
      "app/api/platform/sales-agent/route.js is superadmin-only and says why: it returns FieldQuo's exact plan prices and the full internal feature list including previews. Those are not a team lead's business, and the transcripts travel with them.",
  },
  {
    key: "attribution_correction",
    label: "Changing who a company is credited to",
    reason:
      "Attribution locks at capture. A correction writes a new row and an audit trail, and it decides who gets paid — which is why SalesAttribution is on REP_FORBIDDEN_WRITES for every rep, lead or not.",
  },
  {
    key: "notes_before_the_boundary",
    label: "Notes written before the tier existed",
    reason:
      "See TEAM_LEAD_NOTE_VISIBILITY_FROM. Those reps were told, on the compose screen, that no other rep could read them.",
  },
]);

/** Nothing on a sales floor is editable by a team lead. Written down for the same reason. */
export const TEAM_LEAD_CANNOT_DO = Object.freeze([
  {
    key: "edit_a_note",
    label: "Edit or delete a rep's note",
    reason:
      "lib/sales/notes/visibility.js already refuses this to a superadmin: “a record a manager can rewrite is not a record”. A lead is not a bigger exception than a superadmin.",
  },
  {
    key: "hand_a_prospect_to_a_named_rep",
    label: "Move a claim to a particular rep",
    reason:
      "Releasing a stuck claim back to the pool is a supervision act and is allowed. Choosing WHO gets it next is a routing act with a commission at the end of it, and the pool decides that — the same reason a rep cannot browse the pool and pick.",
  },
  {
    key: "force_a_disposition",
    label: "Change what a rep said happened on a call",
    reason:
      "A disposition is one person's account of a conversation. A lead who disagrees writes a note; they do not rewrite the account.",
  },
]);

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

/**
 * Build the viewer object every scope function below takes.
 *
 * Takes a VIEWER, not a role string, exactly as lib/sales/notes/visibility.js
 * designed for — its header says a `{ kind: "manager", repIds }` viewer should
 * "slot in beside the two that exist without any route changing", and this is
 * that viewer arriving.
 *
 * `reportIds` is the ids of the reps who report to this one, as READ FROM THE
 * DATABASE IN THIS REQUEST. Never carried over from a screen: a rep moved off
 * a lead's line at 09:00 must stop being visible to them at 09:01, which is
 * the same freshness rule all four sales gates already apply to the rep's own
 * row.
 */
export function repViewer(salesRepId, reportIds = []) {
  const id = isNonEmptyString(salesRepId) ? salesRepId : null;
  const reports = Array.isArray(reportIds) ? reportIds.filter(isNonEmptyString) : [];
  // A rep cannot be their own report. Cheap to enforce, and it is the shape a
  // one-row cycle would take.
  const clean = [...new Set(reports.filter((r) => r !== id))];
  return {
    kind: clean.length > 0 ? VIEWER_TEAM_LEAD : VIEWER_REP,
    salesRepId: id,
    reportIds: clean,
  };
}

export function platformViewer(role) {
  return { kind: VIEWER_PLATFORM, role: isNonEmptyString(role) ? role : null };
}

/**
 * Which reps' work this viewer may read.
 *
 * @returns {string[]|null} `null` means every rep, and is reachable only from
 *          a superadmin. Everything else — including a viewer this function
 *          cannot make sense of — is a list, and the refusing list is
 *          `[NO_REP]` rather than `[]`, because an empty array is one careless
 *          `if (ids.length)` away from being read as "no filter".
 */
export function visibleRepIds(viewer) {
  if (!viewer || typeof viewer !== "object") return [NO_REP];

  if (viewer.kind === VIEWER_PLATFORM) {
    return FULL_VIEW_PLATFORM_ROLES.has(viewer.role) ? null : [NO_REP];
  }

  if (viewer.kind === VIEWER_TEAM_LEAD) {
    if (!isNonEmptyString(viewer.salesRepId)) return [NO_REP];
    const reports = Array.isArray(viewer.reportIds) ? viewer.reportIds.filter(isNonEmptyString) : [];
    // The lead sees their own work too. A board that shows a lead's five reps
    // and not the lead is a board that under-counts the team every time the
    // lead picks up a phone, which they do.
    return [...new Set([viewer.salesRepId, ...reports])];
  }

  if (viewer.kind === VIEWER_REP) {
    return isNonEmptyString(viewer.salesRepId) ? [viewer.salesRepId] : [NO_REP];
  }

  return [NO_REP];
}

/**
 * The `where` fragment for any model with a `salesRepId`.
 *
 * `{}` is returned ONLY for a superadmin, and that is the one case where "no
 * filter" is the right answer — seeing the whole floor is what the platform
 * screen is for. Every other path produces a narrowing filter, never an empty
 * object. lib/sales/scope.js's header is the long version of why that
 * asymmetry is deliberate rather than sloppy.
 */
export function repScopeWhere(viewer) {
  const ids = visibleRepIds(viewer);
  if (ids === null) return {};
  return { salesRepId: { in: ids } };
}

/** Is this viewer allowed to look at this specific rep at all? */
export function canViewRep(viewer, salesRepId) {
  if (!isNonEmptyString(salesRepId)) return false;
  const ids = visibleRepIds(viewer);
  if (ids === null) return true;
  return ids.includes(salesRepId);
}

/**
 * May this viewer read this note?
 *
 * ══ The defended answer, since it was asked for ═══════════════════════════
 *
 * **Yes — a team lead reads their direct reports' notes, and only notes
 * written after the tier existed.**
 *
 * The case for reading them: a sales note is not a diary. It is FieldQuo's
 * record of what a contractor said, written on FieldQuo's time about
 * FieldQuo's prospect, and it is the only place the reason a deal died is ever
 * written down. A lead who cannot read it can coach on outcomes and never on
 * causes, which is coaching on the scoreboard. When a rep leaves, their book
 * passes to someone; if the notes are sealed, the next rep re-learns every
 * objection by making the same call.
 *
 * The case against, which is real: candour. A rep writes differently when they
 * know their manager reads it. That cost is paid once, at the boundary, and it
 * is paid honestly — the compose screen says who can read it, in the first
 * sentence, before anything is typed. What is NOT acceptable is changing the
 * audience for notes already written under the old sentence, which is why
 * TEAM_LEAD_NOTE_VISIBILITY_FROM exists and why this function refuses
 * everything while it is null.
 *
 * What a lead still cannot do is WRITE one. canWriteNote() in
 * lib/sales/notes/visibility.js refuses every non-author including a
 * superadmin, and this changes nothing about that.
 */
export function canReadTeamNote(viewer, note, { from = TEAM_LEAD_NOTE_VISIBILITY_FROM } = {}) {
  if (viewer?.kind !== VIEWER_TEAM_LEAD) return false;
  if (!note || typeof note !== "object") return false;
  if (!isNonEmptyString(note.salesRepId)) return false;

  // Their own note is theirs by the ordinary rule, not by this one.
  if (note.salesRepId === viewer.salesRepId) return true;

  const reports = Array.isArray(viewer.reportIds) ? viewer.reportIds : [];
  if (!reports.includes(note.salesRepId)) return false;

  const boundary = from instanceof Date ? from : from ? new Date(from) : null;
  if (!boundary || Number.isNaN(boundary.getTime())) return false;

  const created = note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
  if (Number.isNaN(created.getTime())) return false;

  return created.getTime() >= boundary.getTime();
}

/**
 * The sentence a rep sees above the note editor.
 *
 * Two versions, and which one is shown is COMPUTED from whether the tier is
 * actually live — never asserted. The exact mistake
 * lib/sales/playbook/store.js's header records: a hard-coded notice goes stale
 * the day the behaviour changes and leaves a check asserting the wrong thing.
 */
export function noteVisibilityNotice({ hasTeamLead = false, from = TEAM_LEAD_NOTE_VISIBILITY_FROM } = {}) {
  const live = Boolean(from) && hasTeamLead;
  if (!live) {
    return {
      headline: "FieldQuo superadmins can read every note you write here.",
      detail:
        "Other sales reps cannot — a note is scoped to whoever wrote it. There is " +
        "no private mode, because a superadmin has the database and a private " +
        "label they could read past would be a promise FieldQuo cannot keep.",
    };
  }
  return {
    headline: "Your team lead and FieldQuo superadmins can read every note you write here.",
    detail:
      "Reps who are not your team lead cannot. There is no private mode, because " +
      "a superadmin has the database and a private label they could read past " +
      "would be a promise FieldQuo cannot keep. Notes you wrote before your team " +
      "lead was given this view stay between you and the superadmins.",
  };
}

/**
 * Would setting `managerId` on `repId` create a cycle?
 *
 * The database cannot answer this: a self-referencing nullable FK is perfectly
 * happy with A reporting to B reporting to A, and the first thing that walks
 * the chain hangs. So it is answered here, from rows the caller has read, and
 * executed against the shapes that matter — self, a two-link loop, a long
 * chain, a chain with a missing link.
 *
 * @param managerById a Map or plain object of repId -> managerId, as it is
 *                    BEFORE the proposed change.
 */
export function wouldCycle(repId, managerId, managerById) {
  if (!isNonEmptyString(repId) || !isNonEmptyString(managerId)) return false;
  if (repId === managerId) return true;

  const get = (id) =>
    managerById instanceof Map ? managerById.get(id) : managerById?.[id];

  const seen = new Set([repId]);
  let cursor = managerId;
  // Bounded by the number of reps, so a corrupt map cannot spin. The bound is
  // the map's own size plus one: any walk longer than that has repeated a node.
  const limit =
    (managerById instanceof Map ? managerById.size : Object.keys(managerById || {}).length) + 1;

  for (let i = 0; i < limit; i++) {
    if (!isNonEmptyString(cursor)) return false;
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = get(cursor);
  }
  // Ran past the bound without terminating: something is looping even if this
  // walk did not name it. Refused rather than allowed — the failure direction
  // for a graph question is always "no".
  return true;
}
