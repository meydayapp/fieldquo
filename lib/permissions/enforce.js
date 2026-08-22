// lib/permissions/enforce.js
//
// Makes the granular permission grid actually mean something.
//
// The gap this closes: PERMISSION_CATEGORIES and the Manage Team editor have
// existed for a while, and Member.permissions is populated and displayed —
// but no API route ever read it. Every route checked only the coarse role, so
// a member set to "Quotes: view only" could still POST /api/quotes, because
// PERMISSIONS.employee includes "quote:create".
//
// That's worse than having no grid at all. A company can configure access,
// see it saved, and reasonably believe an employee is restricted when they
// aren't — which is a staffing decision made on a false premise.
//
// Design notes:
//
//   * Owners and admins bypass everything. PERMISSIONS.owner/admin are ["*"]
//     and the grid was never meant to constrain them.
//
//   * A member with NO permissions object falls back to their role's coarse
//     rights. Existing members predate the grid, and defaulting them to "no
//     access" would lock out working accounts on deploy.
//
//   * Levels are ordered least-to-most within each category, so "at least X"
//     is an index comparison rather than a set of hardcoded strings.

import { PERMISSION_CATEGORIES } from "@/lib/permissions";

/** Roles the grid doesn't apply to. */
// Exported so guards can assert against the SET THE ENFORCEMENT USES rather
// than a copy of it. A preset that maps onto one of these roles has its grid
// skipped entirely — which is how "Manager" came to promise "excludes payroll"
// and grant it. check-role-vocabulary.mjs asserts no preset lands here.
export const UNRESTRICTED_ROLES = new Set(["owner", "admin"]);

/**
 * Does this member have at least `level` in `category`?
 *
 * @param {object} member    { role, permissions }
 * @param {string} category  key of PERMISSION_CATEGORIES
 * @param {string} level     minimum level value required
 */
export function hasLevel(member, category, level) {
  if (!member) return false;
  if (UNRESTRICTED_ROLES.has(member.role)) return true;

  const config = PERMISSION_CATEGORIES[category];
  if (!config) return true; // unknown category — don't invent a restriction

  const permissions = member.permissions;
  // No grid configured: fall back to coarse role behaviour rather than
  // denying. See the note above about pre-existing members.
  if (!permissions || typeof permissions !== "object") return true;

  const current = permissions[category];
  if (current === undefined) return true;

  const levels = config.levels.map((l) => l.value);
  const currentIndex = levels.indexOf(current);
  const requiredIndex = levels.indexOf(level);

  if (requiredIndex === -1) return true; // asked for a level that isn't real
  if (currentIndex === -1) return false; // stored a level that isn't real

  return currentIndex >= requiredIndex;
}

/** On/off switches — showPricing, jobCosting, payments. */
export function hasToggle(member, toggle) {
  if (!member) return false;
  if (UNRESTRICTED_ROLES.has(member.role)) return true;
  const permissions = member.permissions;
  if (!permissions || typeof permissions !== "object") return true;
  if (permissions[toggle] === undefined) return true;
  return permissions[toggle] === true;
}

/**
 * Throws a 403-shaped error when the level isn't met. Mirrors
 * requirePermission's contract so route handlers catch it the same way.
 */
export function requireLevel(member, category, level, action = "do that") {
  if (!hasLevel(member, category, level)) {
    const err = new Error(
      `Your access level for ${PERMISSION_CATEGORIES[category]?.label || category} doesn't allow you to ${action}.`,
    );
    err.status = 403;
    throw err;
  }
}

export function requireToggle(member, toggle, action = "do that") {
  if (!hasToggle(member, toggle)) {
    const err = new Error(`You don't have permission to ${action}.`);
    err.status = 403;
    throw err;
  }
}

/**
 * Scope filter for categories whose levels distinguish "their own" from
 * "everyone's" — schedule, timeTracking, expenses.
 *
 * These aren't gates. "View their own schedule" doesn't mean 403 on the list
 * endpoint, it means the list should contain only their rows. Returning a
 * Prisma `where` fragment keeps that decision here rather than duplicated as
 * an if-statement in every route.
 *
 * @param ownerField  the column identifying who a row belongs to. Differs per
 *                    model — appointments use assignedToId, time entries use
 *                    workerId — so the caller names it.
 * @returns {} for full access, or { [ownerField]: userId } to narrow
 */
export function scopeFilter(member, category, ownerField, userId) {
  if (!member) return { [ownerField]: "__none__" };
  if (UNRESTRICTED_ROLES.has(member.role)) return {};

  const config = PERMISSION_CATEGORIES[category];
  const permissions = member.permissions;
  if (!config || !permissions || typeof permissions !== "object") return {};

  const current = permissions[category];
  if (current === undefined) return {};

  // Every "see everything" level in these categories contains "_all". That's
  // a naming convention rather than a guarantee, so it's asserted here in one
  // place instead of matching level strings across a dozen routes.
  const seesEverything = String(current).includes("_all");
  return seesEverything ? {} : { [ownerField]: userId };
}

/**
 * Loads the member with the fields enforcement needs.
 *
 * getCurrentMember returns a lightweight session shape that doesn't include
 * `permissions`, so routes doing granular checks need this. Kept separate so
 * routes that only need the coarse role don't pay for an extra query.
 */
export async function loadEnforceableMember(db, memberId) {
  // Guard the undefined case explicitly.
  //
  // getCurrentMember didn't return the Member row's `id` for a long time, so
  // every caller passed undefined and Prisma threw
  //
  //   Argument `where` of type MemberWhereUniqueInput needs at least one of
  //   `id` or `userId_companyId`
  //
  // straight into the user's face on fourteen write routes. That's fixed at
  // the source, but the failure mode was bad enough — a raw Prisma error
  // rendered in the UI — that it shouldn't be reachable from here at all.
  //
  // Returning null rather than throwing means hasLevel() sees no member and
  // denies, which is the safe direction: a permission check that can't
  // identify who is asking should refuse, not wave them through.
  if (!memberId) return null;

  return db.member.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, permissions: true, companyId: true },
  });
}

/** Turns a thrown permission error into a NextResponse-friendly shape. */
export function permissionErrorResponse(err) {
  return {
    body: { error: err.message || "Forbidden" },
    status: err.status || 403,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// REDACTION — the read half
//
// Everything above answers "may they do this?". None of it answers "what may
// they SEE?", and until this section existed the answer was "everything".
//
// QA found the consequence: an employee set to clientsProperties
// "name_address_only" received every client's email, phone, private notes and
// portal token from GET /api/clients, because the route had no `select` and
// Prisma returns whole rows. The dial was saved, shown back to the owner who
// set it, and filtered nothing. That is the exportable-customer-list exposure
// the dial exists to prevent, in the feature built to prevent it.
//
// A gate can be a 403. A read restriction cannot — refusing the clients list
// to someone who is allowed the names would break their job. So these shape
// the payload instead.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Fields a client record carries that are NOT name and address.
 *
 * Listed explicitly rather than derived by removing known-safe keys: a
 * denylist silently leaks every column added later, and this object gains
 * columns often. If a new field belongs to the restricted set, it has to be
 * named here — and failing to name it is visible in review, which "everything
 * except these four" is not.
 */
const CLIENT_RESTRICTED_FIELDS = [
  "email",
  "phone",
  "contactName",
  "notes",
  "portalToken",
  "language",
  "_count",
];

/**
 * Strip a client down to what the member's level allows.
 *
 * `name_address_only` is the one restricted level — every level above it is
 * "full_view" or better, which is the whole record. Anything unrecognised
 * keeps the full record, matching hasLevel's rule that an unknown value must
 * not invent a restriction.
 *
 * Returns a NEW object; never mutates the row it was handed.
 */
export function redactClient(member, client) {
  if (!client || typeof client !== "object") return client;
  if (hasLevel(member, "clientsProperties", "full_view")) return client;

  const out = { ...client };
  for (const field of CLIENT_RESTRICTED_FIELDS) delete out[field];

  // Marked so a UI can say "hidden by your access level" rather than render an
  // empty field, which reads as missing data the employee should go and fill
  // in. Absence and restriction are different statements.
  out.restricted = true;
  return out;
}

/** redactClient over a list, tolerating a non-array. */
export function redactClients(member, clients) {
  if (!Array.isArray(clients)) return clients;
  return clients.map((c) => redactClient(member, c));
}

// ── Pay rates ─────────────────────────────────────────────────────────────
//
// `payroll: view_own` was enforced on the payroll PAGES and nowhere else, so a
// Manager who could not open /app/payroll could still read every rate from
// /api/workers, /api/settings/members and /api/time-entries — and the Workers
// tab of Manage Team rendered them on screen with an Edit button on every row.
// QA changed a colleague's rate from $25 to $26 and it stuck.
//
// The payroll page being locked made the gap easy to miss: the data was simply
// reachable through a different door.

/** May this member see (and set) OTHER people's pay? */
export function canSeeAllPay(member) {
  return hasLevel(member, "payroll", "view_all");
}

/**
 * Strip a pay rate from one row unless the caller may see it.
 *
 * `ownUserId` keeps your own rate visible — "view your own payslips" means
 * exactly that, and blanking your own pay would be a different bug.
 *
 * Marked `payHidden` rather than set to null, for the same reason
 * redactClient sets `restricted`: a blank rate reads as "nobody has set one"
 * and invites someone to go and fill it in.
 */
export function redactPay(member, row, { fields = ["hourlyRate"], ownUserId } = {}) {
  if (!row || typeof row !== "object") return row;
  if (canSeeAllPay(member)) return row;

  const isSelf =
    ownUserId != null &&
    (row.userId === ownUserId || row.id === ownUserId || row.user?.id === ownUserId);
  if (isSelf) return row;

  const out = { ...row };
  let hid = false;
  for (const f of fields) {
    if (out[f] !== undefined) {
      delete out[f];
      hid = true;
    }
  }
  // Nested worker on a time entry carries the rate too — the entry itself is
  // fine to see, the rate on it is not.
  if (out.worker && typeof out.worker === "object" && out.worker.hourlyRate !== undefined) {
    out.worker = { ...out.worker };
    delete out.worker.hourlyRate;
    hid = true;
  }
  if (hid) out.payHidden = true;
  return out;
}

/** redactPay over a list, tolerating a non-array. */
export function redactPayList(member, rows, opts) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((r) => redactPay(member, r, opts));
}

/**
 * Remove a quote's public share token unless the member may send quotes.
 *
 * `shareToken` resolves to a credential-free public page showing the priced
 * document. QA confirmed an employee with quotes:view_only AND
 * showPricing:false could read the token out of GET /api/quotes and open
 * /quote/<token> logged out — sidestepping both the send flow and the pricing
 * restriction, and leaving no trace in the audit trail.
 *
 * Gated on view_create_edit rather than on showPricing, because the token is a
 * distribution capability rather than a number: whoever can send the quote can
 * already produce the link legitimately.
 */
export function redactShareToken(member, quote) {
  if (!quote || typeof quote !== "object") return quote;
  if (hasLevel(member, "quotes", "view_create_edit")) return quote;
  const out = { ...quote };
  delete out.shareToken;
  return out;
}

/**
 * Apply every read restriction that touches a quote payload.
 *
 * One entry point so a route can't remember the share token and forget the
 * nested client — which is exactly how the client object in GET /api/quotes
 * came to be leaking an email that GET /api/clients would have hidden.
 */
export function redactQuote(member, quote) {
  if (!quote || typeof quote !== "object") return quote;
  // redactShareToken returns the SAME object when the member may see the
  // token, so assigning the redacted client onto its result mutated the row
  // that was handed in — contradicting redactClient's own "never mutates"
  // docstring, and silently stripping fields from a caller's variable.
  //
  // Harmless in every current call site (each builds a per-request row and
  // discards it after serialising) and a genuine trap for the next one, which
  // is exactly when this kind of thing gets found the hard way.
  const out = { ...redactShareToken(member, quote) };
  if (out.client) out.client = redactClient(member, out.client);
  return out;
}

/** redactQuote over a list, tolerating a non-array. */
export function redactQuotes(member, quotes) {
  if (!Array.isArray(quotes)) return quotes;
  return quotes.map((q) => redactQuote(member, q));
}
