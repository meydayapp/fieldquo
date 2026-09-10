// lib/support/escalation.js
//
// The escalation channel's decisions: may this rep raise this ticket, who does
// it land on, and which status moves are real.
//
// ══ Why every decision in here is pure ═════════════════════════════════════
//
// Same shape and the same reason as lib/sales/calls/inboundDistribution.js and
// lib/migrations/state.js: nothing here imports `db`, every function takes rows
// the caller has already read, and scripts/check-support-escalation.mjs drives
// every branch — including the ones that must REFUSE — with no database.
//
// The branch that matters is "a rep raising a ticket about a company that is
// not theirs". A rep's book is a SUBSET of tenants with no outer companyId
// filter in front of it (lib/sales/scope.js's header spells out why that makes
// it the boundary itself rather than a filter behind one), and a boundary
// asserted only by reading is a boundary nobody has tested. So the rule lives
// in decideEscalation(), which is executed, and the route ALSO narrows its
// query with assignedCompanyWhere() — deliberately twice, exactly as
// impersonation is gated twice.
//
// ══ What this file does NOT do ═════════════════════════════════════════════
//
// It never touches a company's own records. A SupportTicket is FieldQuo's note
// about a contractor's problem, in the same family as SalesAttribution, and
// non-negotiable #3 is untouched: nothing here creates, edits or deletes a
// quote, a client or an invoice.

/**
 * The complete set of ticket statuses. Three, and there is no fourth.
 *
 * `resolved` is the only "done". There is deliberately no separate `closed`:
 * two words for the same fact is how a queue acquires a hiding place, and
 * nothing in the product would ever have had to tell them apart. A ticket that
 * turns out not to be fixed is REOPENED (see TRANSITIONS) rather than replaced
 * by a second ticket that loses the first one's history.
 */
export const SUPPORT_STATUSES = ["open", "in_progress", "resolved"];

/** The statuses that still owe somebody an answer — what the queue counts. */
export const UNRESOLVED_STATUSES = ["open", "in_progress"];

export const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
};

/**
 * Priority, lowest first. Ordered so a queue can sort on the index rather than
 * on a hand-written comparator that will disagree with this list.
 */
export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"];

export const PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/**
 * What a rep who says nothing about priority means.
 *
 * This IS a default, and AGENTS.md failure class #5 says absence is not a
 * statement — so the distinction is drawn precisely: an ABSENT priority means
 * "the rep did not rank it", which for a support queue genuinely is `normal`,
 * and the form always offers the choice. A PRESENT but unrecognised value is
 * refused rather than quietly downgraded, because silently turning `critical`
 * into `normal` is the padding that rule is about.
 */
export const DEFAULT_PRIORITY = "normal";

/** "message" | "status_change" — see SupportTicketNote.kind. */
export const SUPPORT_NOTE_KINDS = ["message", "status_change"];

// Long enough for a real problem description, short enough that a paste of a
// whole log file is refused at the door rather than stored and truncated on
// every screen that renders it.
export const MAX_SUBJECT_LENGTH = 140;
export const MAX_BODY_LENGTH = 5000;
export const MAX_NOTE_LENGTH = 5000;

/** Collapse whitespace and cap. Returns "" for anything that is not text. */
function clean(raw, max) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export function sanitiseSubject(raw) {
  return clean(raw, MAX_SUBJECT_LENGTH);
}

/**
 * The body keeps its line breaks — a rep pasting three steps to reproduce
 * should not have them run into one paragraph — but loses trailing space and
 * anything past the cap.
 */
export function sanitiseBody(raw, max = MAX_BODY_LENGTH) {
  if (typeof raw !== "string") return "";
  return raw
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, max);
}

/**
 * A priority off untrusted input.
 *
 * @returns {{ priority: string|null, rejected: boolean }}
 *   `rejected` is the case the caller must refuse: somebody named a priority
 *   this product does not have. `priority: DEFAULT_PRIORITY, rejected: false`
 *   is "nobody said", which is legitimate — see DEFAULT_PRIORITY.
 */
export function normalisePriority(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { priority: DEFAULT_PRIORITY, rejected: false };
  }
  if (typeof raw !== "string") return { priority: null, rejected: true };
  const value = raw.trim().toLowerCase();
  if (!value) return { priority: DEFAULT_PRIORITY, rejected: false };
  if (!SUPPORT_PRIORITIES.includes(value)) return { priority: null, rejected: true };
  return { priority: value, rejected: false };
}

/** Shorthand for a refusal in the shape every caller returns verbatim. */
function refuse(code, message, status) {
  return { ok: false, code, error: message, status, ticket: null };
}

/**
 * May this rep raise this ticket, and what should be written if so?
 *
 * @param rep      the rep row the gate read fresh this request — `{ id }` at
 *                 minimum. Never an id off the query string or the body.
 * @param company  the Company row the route just read, WITH its
 *                 `salesAttribution: { select: { salesRepId: true } }`, or
 *                 null when the scoped read found nothing.
 * @param subject  untrusted.
 * @param body     untrusted.
 * @param priority untrusted.
 *
 * @returns {{ ok: true, ticket: {companyId,salesRepId,subject,body,priority,status} }}
 *        | {{ ok: false, code: string, error: string, status: number }}
 *
 * ── Why "not yours" and "does not exist" are the same refusal ─────────────
 *
 * Distinct messages would turn this endpoint into an oracle: post a cuid, and
 * a 403 rather than a 404 confirms that a company with that id exists. A rep
 * has no business learning which ids are real outside their own book, so both
 * answer the same 404 with the same sentence. Same discipline as the notes
 * route, whose header makes the argument for prospectId.
 *
 * ── Why authorisation is decided before the text is validated ─────────────
 *
 * An empty subject about somebody else's company must not come back as "a
 * ticket needs a subject" — that answer is itself a statement about the
 * company. Scope first, always.
 */
export function decideEscalation({ rep, company, subject, body, priority } = {}) {
  if (!rep || typeof rep.id !== "string" || !rep.id) {
    return refuse("no_rep", "Sign in to the sales portal.", 401);
  }

  const attributedTo =
    company && typeof company.id === "string" && company.id
      ? company.salesAttribution?.salesRepId ?? null
      : null;

  // A company attributed to NOBODY is refused here too, and that is correct
  // rather than an oversight: the 31 tenants that predate the sales portal
  // have permanently null attribution (lib/sales/attribution.js's header), and
  // "unattributed" must never read as "everybody's".
  if (!attributedTo || attributedTo !== rep.id) {
    return refuse(
      "company_not_in_book",
      "That company isn't in your book. You can only raise a ticket about a company attributed to you.",
      404,
    );
  }

  const cleanSubject = sanitiseSubject(subject);
  if (!cleanSubject) {
    return refuse("subject_required", "Give the problem a one-line subject.", 400);
  }

  const cleanBody = sanitiseBody(body);
  if (!cleanBody) {
    return refuse(
      "body_required",
      "Describe what happened — what they did, what they expected, what they got.",
      400,
    );
  }

  const { priority: chosen, rejected } = normalisePriority(priority);
  if (rejected) {
    return refuse(
      "unknown_priority",
      `Priority must be one of: ${SUPPORT_PRIORITIES.join(", ")}.`,
      400,
    );
  }

  return {
    ok: true,
    code: null,
    error: null,
    status: 201,
    ticket: {
      companyId: company.id,
      // From the gate's fresh read of the SalesRep row, never from the body.
      salesRepId: rep.id,
      subject: cleanSubject,
      body: cleanBody,
      priority: chosen,
      status: "open",
    },
  };
}

/**
 * Who a new ticket lands on.
 *
 * The owner's brief says "assign it to Emilio, which is the owner account".
 * This resolves that by ROLE, out of PlatformAdmin rows the route has just
 * read — never by that account's literal PlatformAdmin id, which does not
 * appear anywhere in this codebase and which scripts/check-support-escalation.
 * mjs asserts does not. A hard-coded id is wrong the day a second admin
 * exists, wrong the day the database is reseeded, and wrong silently: the
 * ticket would carry a foreign key to nobody, and no screen would say so.
 *
 * Oldest superadmin first, tie-broken on id, so the answer is stable — two
 * admins created in the same millisecond must not make assignment flip between
 * requests.
 *
 * @param admins rows of `{ id, role, active, createdAt }`.
 * @returns {{ adminId: string|null, reason: "first_superadmin"|"no_superadmin" }}
 *
 * `null` is a legitimate outcome and the caller MUST still write the ticket.
 * Losing a contractor's problem because FieldQuo's own admin table is empty
 * would defeat the one thing this feature exists to do; the rep is told it is
 * unassigned instead.
 */
export function assignedAdminFor(admins) {
  const rows = Array.isArray(admins) ? admins : [];
  const candidates = rows
    .filter(
      (a) =>
        a &&
        typeof a.id === "string" &&
        a.id &&
        a.role === "superadmin" &&
        // An admin whose account was switched off is not somebody to hand a
        // ticket to. `active === true` rather than truthy: an undefined here
        // means the caller forgot to select the column, and assigning on a
        // column nobody read is exactly the class of bug this repo keeps
        // finding.
        a.active === true,
    )
    .sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime() || 0;
      const bt = new Date(b.createdAt || 0).getTime() || 0;
      if (at !== bt) return at - bt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  if (!candidates.length) return { adminId: null, reason: "no_superadmin" };
  return { adminId: candidates[0].id, reason: "first_superadmin" };
}

/**
 * Every legal status edge. Anything not listed is refused.
 *
 *   open        -> in_progress | resolved
 *   in_progress -> open | resolved
 *   resolved    -> open
 *
 * `in_progress -> open` is "I picked this up and I am putting it back", which
 * a shared queue needs or a ticket somebody opened by accident stays theirs
 * forever.
 *
 * `resolved -> open` is the reopen, and it exists so a problem that comes back
 * keeps its thread. It goes to `open` and NOT straight to `in_progress`: a
 * reopened ticket belongs in the queue where it will be seen again, and
 * landing it directly in "somebody is on it" would be a claim nobody made.
 */
const TRANSITIONS = {
  open: ["in_progress", "resolved"],
  in_progress: ["open", "resolved"],
  resolved: ["open"],
};

export function canTransition(from, to) {
  return Array.isArray(TRANSITIONS[from]) && TRANSITIONS[from].includes(to);
}

/**
 * What a status change should write, or why it is refused.
 *
 * @param ticket the row read fresh in the SAME request that writes — the
 *               status a caller remembered from an earlier request is exactly
 *               the value this must not trust (the argument lib/migrations/
 *               state.js's canWrite() makes at greater cost).
 * @param to     untrusted.
 * @param now    injectable, so the resolvedAt stamp is executable.
 *
 * @returns {{ ok: true, from, to, data: { status, resolvedAt } }}
 *        | {{ ok: false, code, error, status }}
 *
 * `resolvedAt` is set on the way in and CLEARED on the way out. A reopened
 * ticket that kept its old stamp would report a date on which it demonstrably
 * was not fixed, and the resolution-time figure on the console would count it.
 */
export function decideStatusChange({ ticket, to, now = new Date() } = {}) {
  if (!ticket || typeof ticket.status !== "string") {
    return { ok: false, code: "not_found", error: "That ticket doesn't exist.", status: 404 };
  }
  if (typeof to !== "string" || !SUPPORT_STATUSES.includes(to)) {
    return {
      ok: false,
      code: "unknown_status",
      error: `Status must be one of: ${SUPPORT_STATUSES.join(", ")}.`,
      status: 400,
    };
  }
  // Refused rather than treated as a no-op success. Two people working the
  // queue would otherwise both be told they moved it, and on `resolved` the
  // second click would re-stamp resolvedAt to a later time than the fix.
  if (ticket.status === to) {
    return {
      ok: false,
      code: "already_in_status",
      error: `This ticket is already ${STATUS_LABELS[to].toLowerCase()}.`,
      status: 409,
    };
  }
  if (!canTransition(ticket.status, to)) {
    return {
      ok: false,
      code: "illegal_transition",
      error: `A ${STATUS_LABELS[ticket.status].toLowerCase()} ticket cannot go straight to ${STATUS_LABELS[to].toLowerCase()}.`,
      status: 409,
    };
  }
  return {
    ok: true,
    code: null,
    error: null,
    status: 200,
    from: ticket.status,
    to,
    data: { status: to, resolvedAt: to === "resolved" ? now : null },
  };
}

/**
 * The sentence a status change leaves on the thread.
 *
 * Written as a note rather than derived on render, because the thread is the
 * rep's only view of progress and it has to survive a later rename of the
 * labels — a note that re-derives its own wording is a note that changes what
 * it said.
 */
export function statusChangeSentence({ from, to, actorName = null } = {}) {
  const who = actorName ? `${actorName} moved` : "Moved";
  return `${who} this from ${STATUS_LABELS[from] || from} to ${STATUS_LABELS[to] || to}.`;
}

/**
 * The notes a REP may see.
 *
 * `internal` is written by the platform screen and filtered here — the pair is
 * the whole point of the column. An internal note that reached the rep would
 * be worse than not having the flag at all, because the screen promises it.
 */
export function repVisibleNotes(notes) {
  return (Array.isArray(notes) ? notes : []).filter((n) => n && n.internal !== true);
}

/**
 * One line for a rep about where their ticket stands, so escalating is not a
 * black hole.
 *
 * Says the truth about an UNASSIGNED ticket rather than hiding it: a rep whose
 * escalation landed on nobody needs to know to ring somebody, and a screen that
 * showed "Open" either way would be the reassuring lie.
 */
export function repStatusLine(ticket) {
  if (!ticket) return "";
  if (ticket.status === "resolved") return "Resolved by FieldQuo support.";
  if (ticket.status === "in_progress") return "FieldQuo support is on it.";
  if (!ticket.assignedAdminId) {
    return "Recorded, but not assigned to anyone yet — no FieldQuo superadmin account was available. Chase this one by hand.";
  }
  return "Waiting on FieldQuo support.";
}
