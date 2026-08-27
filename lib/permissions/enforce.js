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

// ── WHICH jobs, which is not the same question as how much of one ──────────
//
// The Crew preset sat at `jobs: none`, so a crew member saw no job at all. That
// was the safe landing and it made the tier unusable: the person driving to the
// address cannot see the address. The alternative on the ladder — view_only —
// showed them every job in the company, which is the hole `none` was closing.
//
// Neither is what the owner asked for: "jobs only the ones assigned to them".
// That is a SCOPE, and the levels ladder cannot express it. A rung between
// `none` and `view_only` would be a fifth answer to "how much access", and
// every route gated at view_only would then have to be re-gated at the new rung
// to let a crew member through — turning one scoping rule into thirty level
// changes, which is the shape that rots.
//
// So the level stays view_only and the LIST narrows, exactly as scopeFilter
// above narrows the schedule instead of refusing it.
//
// ── "Assigned to me" has no column ─────────────────────────────────────────
//
// Job carries no assignee. The only link between a person and a job is
// JobVisit.assignedToId (confirmed in prisma/schema.prisma — Job has
// companyId/quoteId/clientId and nothing else pointing at a User). So the
// predicate is "has a visit assigned to me", expressed as a relation filter
// rather than as a list of ids fetched first: one query, and no window where a
// visit reassigned between the two queries makes a job appear or vanish.

/**
 * Is this member confined to the jobs they are personally on?
 *
 * ── Why it is derived rather than its own dial ─────────────────────────────
 *
 * Two conditions, and both have to hold:
 *
 *   1. They may NOT create or edit jobs. Somebody who runs jobs needs the job
 *      board; narrowing it would take away the work rather than protect it.
 *   2. They may NOT open the client book (clientsProperties below full_view).
 *
 * The second is what separates Crew from Estimator, who also sits at
 * jobs:view_only and must keep seeing every job — the one their quote became is
 * usually not one they have a visit on.
 *
 * It is the same statement twice, not two unrelated dials wired together: the
 * job list IS the client book in another shape, one row per address, with the
 * client's name on each. Telling someone "you get the name and address of the
 * client you are driving to" and then handing them every address the company
 * holds through /app/jobs is the leak the clientsProperties dial exists to stop.
 *
 * The escape hatch is deliberate and visible in the editor: an owner who wants
 * a foreman to see the whole board grants them the client book, or job editing.
 * There is no hidden third setting.
 *
 * Fall-open and fall-closed follow hasLevel exactly: owners and admins, a
 * member with no grid, and a grid that never mentions jobs are all UNSCOPED —
 * a member who predates this must not silently lose their job list. A member we
 * cannot identify at all is scoped, because a scope filter that cannot tell who
 * is asking should narrow to nothing rather than to everything.
 */
export function seesOnlyAssignedJobs(member) {
  if (!member) return true;
  if (UNRESTRICTED_ROLES.has(member.role)) return false;

  const permissions = member.permissions;
  if (!permissions || typeof permissions !== "object") return false;
  // No stated jobs level is hasLevel's fall-open case, and it stays open here.
  if (permissions.jobs === undefined) return false;

  if (hasLevel(member, "jobs", "view_create_edit")) return false;
  if (hasLevel(member, "clientsProperties", "full_view")) return false;
  return true;
}

/**
 * The `where` fragment that narrows a Job query to this member's own work.
 *
 * Spread into an existing where, never used alone:
 *
 *   db.job.findFirst({ where: { id, companyId, ...assignedJobWhere(full) } })
 *
 * `{}` for everyone who sees the whole board, so the spread is a no-op and the
 * caller needs no branch. The refusing case filters on `visits` rather than on
 * `id`, so spreading it can never collide with an `id` the caller already set —
 * an overwritten id would silently widen the query, which is the wrong
 * direction for a fragment whose whole job is to narrow.
 *
 * ── A job with NO visits is assigned to nobody, and this hides it ──────────
 *
 * `some` cannot match an empty visit list, and that is the intended answer
 * rather than an accident of the operator. An unscheduled job is work the
 * office has not handed out yet: no date, no address to be at, nothing to do,
 * and it is precisely the state a job sits in while somebody decides who gets
 * it. It appears for a crew member the moment a visit is booked against them,
 * which is the moment it becomes theirs.
 *
 * @param member the row from loadEnforceableMember — it needs `userId`, which
 *               is why that select carries it.
 */
export function assignedJobWhere(member) {
  if (!seesOnlyAssignedJobs(member)) return {};
  // A scoped member with no userId (a platform admin's synthesised row, a
  // half-loaded member) matches nothing. Same sentinel scopeFilter uses.
  return { visits: { some: { assignedToId: member?.userId || "__none__" } } };
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
    // `userId` is here for assignedJobWhere: "the jobs assigned to me" is a
    // filter on JobVisit.assignedToId, which points at User, not Member. Loaded
    // with the grid rather than passed separately so a route cannot end up
    // gated by one member and scoped by another — the same reason
    // apiGate.levelOrRefusal hands this row back.
    select: {
      id: true,
      userId: true,
      role: true,
      permissions: true,
      companyId: true,
    },
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

/**
 * A LEAD is a client who hasn't been written to the Client table yet.
 *
 * The clients, quotes, invoices, appointments and jobs routes were all
 * redacted; leads were missed entirely, and GET /api/leads returned every
 * enquiry's email, phone and stated budget to a member on name_address_only.
 * It is the same personal data one step earlier in the pipeline — and the
 * pipeline board is a screen a crew member is legitimately shown, so this
 * shapes the payload rather than refusing it.
 *
 * `name` and `message` survive. What the homeowner asked for IS the lead; a
 * board of anonymous cards would be a different, useless screen, and the
 * restriction is about reaching them, not about knowing the job exists.
 *
 * `budgetBand` goes with the contact details rather than with prices. It is
 * not the company's rate card (see lib/leads/qualifiers.js on why publishing
 * that would be non-negotiable #4) — it is what this household said it can
 * spend, which is exactly the commercial fact "name and address only" exists
 * to withhold.
 *
 * `scoreReasons` goes with it, and that is not over-caution: the stored
 * reasons are English sentences written by lib/leads/score.js, and two of them
 * are "Budget $15k+" and "Phone number provided". Keeping the reasons while
 * removing the band would hand back the band in prose. `score` and
 * `temperature` survive — hot/warm/cold is triage, not contact data.
 */
const LEAD_RESTRICTED_FIELDS = [
  "email",
  "phone",
  // The address the receptionist asked the homeowner to send photos to. It is
  // the company's own inbox rather than the client's, but it is still an
  // address on a record whose contact details are withheld, and it travels
  // with `photosRequestedAt`, which stays.
  "photosRequestedTo",
  "budgetBand",
  "scoreReasons",
];

export function redactLead(member, lead) {
  if (!lead || typeof lead !== "object") return lead;
  if (hasLevel(member, "clientsProperties", "full_view")) return lead;

  const out = { ...lead };
  for (const field of LEAD_RESTRICTED_FIELDS) delete out[field];

  // `doNotCall` is derived from the phone number the route just removed, so it
  // would announce that a number exists and that it is blocked. Nobody who
  // cannot see the number can dial it, so the flag has no reader left.
  delete out.doNotCall;

  out.restricted = true;
  return out;
}

/** redactLead over a list, tolerating a non-array. */
export function redactLeads(member, leads) {
  if (!Array.isArray(leads)) return leads;
  return leads.map((l) => redactLead(member, l));
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

// ── Money ─────────────────────────────────────────────────────────────────
//
// `showPricing: false` is the Crew preset's defining setting: that person
// carries materials and marks work complete, and does not know what the
// customer is paying. (Crew now also holds `none` on quotes, jobs, invoices
// and requests, so most of those documents no longer reach them at all — but
// the toggle still governs everyone the owner has deliberately given the
// documents to without the money, which is a configuration the editor offers.) It gated the price book, the analytics
// screens and the invoice WRITE routes — and gated nothing on the documents
// themselves. GET /api/quotes returned `total` on every quote in the company,
// GET /api/invoices returned totals and balances, and the quotes list rendered
// them. The dial was on, and the number it exists to hide was one screen away.
//
// The gate cannot be a 403 here for the same reason the client one couldn't:
// the grid says `quotes: view_only`, which is a deliberate grant of the
// document. So the money is removed from the PAYLOAD and the removal is
// declared, exactly like redactClient — a total that is simply missing reads
// as a quote nobody has priced yet.

/**
 * Money columns on a Quote.
 *
 * The accepted* trio was missing, and it is the figure that matters most: QA
 * read `acceptedTotal: "7645"` off a payload that had already declared
 * `pricingHidden: true`. `total` is what the company offered; `acceptedTotal`
 * is what the client actually agreed to once they ticked the add-ons, and it
 * is what the invoice is built from (lib/invoices/createInvoiceFromQuote.js).
 * Hiding the offer and shipping the settlement is not hiding the price.
 */
const QUOTE_MONEY_FIELDS = [
  "subtotal",
  "discount",
  "tax",
  "total",
  "acceptedSubtotal",
  "acceptedTax",
  "acceptedTotal",
];

/** Money columns on an Invoice — including what is still owed. */
const INVOICE_MONEY_FIELDS = [
  "subtotal",
  "discount",
  "tax",
  "total",
  "amountPaid",
  "amountDue",
];

/**
 * Money keys inside an untyped line-item object.
 *
 * `lineItems` is Json written by several different builders over the life of
 * this codebase (see lib/tasks/suggestFromJob.js, which says so), so the same
 * amount appears as `amount`, `rate`, `unitPrice`, `total` or `price`
 * depending on which one wrote the row. All of them are stripped rather than
 * whichever the current builder happens to emit — the older shapes are still
 * in the database.
 *
 * `quantity`, `unit` and `description` deliberately survive. "Prime and paint
 * 14 doors" is the work, not the price, and a crew member confined to
 * name-and-address still has to know how many doors.
 */
const LINE_ITEM_MONEY_FIELDS = [
  "amount",
  "rate",
  "unitPrice",
  "unitCost",
  "price",
  "total",
  "subtotal",
  "lineTotal",
  "cost",
];

/** May this member see what anything costs the customer? */
export function canSeeMoney(member) {
  return hasToggle(member, "showPricing");
}

/**
 * Money keys inside a line item's `meta` block.
 *
 * A unit-priced group (doors, drawers) writes its reasoning alongside the
 * line — see scopeGroupPayload in lib/quotes/builderPayload.js — so the review
 * page can explain WHY the rate is what it is. `baseUnitPrice` is the rate off
 * the price book before complexity, `complexityUpcharge` is what was added to
 * it. Both are money, one level deeper than the loop that was stripping
 * `rate` and `amount`, which is why QA read `baseUnitPrice: 150` out of a
 * payload whose line items had already been emptied of prices.
 *
 * Everything else in `meta` — the complexity level and its reasons, the
 * colour, the sheen, the door style — is the specification, not the price, and
 * survives for the same reason `quantity` and `description` do.
 */
const LINE_ITEM_META_MONEY_FIELDS = ["baseUnitPrice", "complexityUpcharge"];

/** One line item with every money key removed. Never mutates the input. */
function stripLineItemMoney(item) {
  if (!item || typeof item !== "object") return item;
  const out = { ...item };
  for (const f of LINE_ITEM_MONEY_FIELDS) delete out[f];
  if (out.meta && typeof out.meta === "object") {
    const meta = { ...out.meta };
    for (const f of LINE_ITEM_META_MONEY_FIELDS) delete meta[f];
    out.meta = meta;
  }
  return out;
}

function stripLineItems(items) {
  if (!Array.isArray(items)) return items;
  return items.map(stripLineItemMoney);
}

/**
 * Strip money from one document row.
 *
 * Shared by the quote and invoice entry points below rather than written
 * twice: the two field lists differ, the rule does not, and a second copy is
 * the one that misses `amountDue` when someone adds it.
 *
 * Marked `pricingHidden` for the same reason redactClient marks `restricted`
 * and redactPay marks `payHidden`. Absence and restriction are different
 * statements, and a UI reading `Number(undefined)` renders "$NaN" — which is
 * the failure mode that makes a restriction look like a broken product.
 */
function stripDocumentMoney(row, fields) {
  const out = { ...row };
  for (const f of fields) delete out[f];

  if (out.lineItems !== undefined) out.lineItems = stripLineItems(out.lineItems);

  // A quote's price lives on its scope groups as well as on its header, and
  // each group carries its own untyped lineItems. Hiding the total and leaving
  // the group subtotals is not hiding the price.
  if (Array.isArray(out.scopeGroups)) {
    out.scopeGroups = out.scopeGroups.map((g) => {
      if (!g || typeof g !== "object") return g;
      const group = { ...g };
      delete group.subtotal;
      if (group.lineItems !== undefined)
        group.lineItems = stripLineItems(group.lineItems);
      return group;
    });
  }

  // ── The instant estimator's snapshot ─────────────────────────────────────
  //
  // `estimateData` is what the homeowner was shown by the public estimator,
  // kept verbatim so a reviewer sees exactly that. It carries the range
  // (low/point/high), a per-item breakdown of amounts, and the budget the
  // homeowner stated — so the whole price survives inside a Json column while
  // the four Decimal columns beside it are being deleted. QA read
  // `estimateData.breakdown[].amount` as 6750 / 2250 / 11250 off a payload
  // already marked `pricingHidden`.
  //
  // The MEASUREMENTS stay. How many squares of roof, the satellite image, the
  // material chosen and the assumptions behind the figure are the job, not the
  // price, and they are what a crew member is looking at this record for.
  if (out.estimateData && typeof out.estimateData === "object") {
    const {
      range: _range,
      budget: _budget,
      breakdown,
      ...rest
    } = out.estimateData;
    out.estimateData = {
      ...rest,
      // Kept as rows rather than dropped: "primer coat, 3 doors" is scope, and
      // a breakdown that vanishes reads as an estimate nobody itemised.
      ...(breakdown !== undefined ? { breakdown: stripLineItems(breakdown) } : {}),
      pricingHidden: true,
    };
  }

  // Optional upsells. `amount` is the whole point of an add-on row.
  if (Array.isArray(out.addOns)) {
    out.addOns = out.addOns.map((a) =>
      a && typeof a === "object" ? stripLineItemMoney(a) : a,
    );
  }

  // Payments taken against the document. GET /api/invoices includes the whole
  // Payment rows, so the balance could be reconstructed from them even with
  // amountPaid and amountDue removed — hiding a total and shipping the
  // receipts is not hiding the total.
  if (Array.isArray(out.payments)) {
    out.payments = out.payments.map((p) =>
      p && typeof p === "object" ? stripLineItemMoney(p) : p,
    );
  }

  out.pricingHidden = true;
  return out;
}

/** Strip a quote's money unless the member may see prices. */
export function redactQuoteMoney(member, quote) {
  if (!quote || typeof quote !== "object") return quote;
  if (canSeeMoney(member)) return quote;
  return stripDocumentMoney(quote, QUOTE_MONEY_FIELDS);
}

/** Strip an invoice's money unless the member may see prices. */
export function redactInvoiceMoney(member, invoice) {
  if (!invoice || typeof invoice !== "object") return invoice;
  if (canSeeMoney(member)) return invoice;
  return stripDocumentMoney(invoice, INVOICE_MONEY_FIELDS);
}

/**
 * Apply every read restriction that touches a quote payload.
 *
 * One entry point so a route can't remember the share token and forget the
 * nested client — which is exactly how the client object in GET /api/quotes
 * came to be leaking an email that GET /api/clients would have hidden. The
 * money half joined it here for the same reason: three routes returning quotes
 * would otherwise each need to remember four column names.
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
  const out = { ...redactQuoteMoney(member, redactShareToken(member, quote)) };
  if (out.client) out.client = redactClient(member, out.client);
  return out;
}

/** redactQuote over a list, tolerating a non-array. */
export function redactQuotes(member, quotes) {
  if (!Array.isArray(quotes)) return quotes;
  return quotes.map((q) => redactQuote(member, q));
}

/**
 * The invoice equivalent — money, the nested client, and any nested quote.
 *
 * Invoices mirror quotes (see AGENTS.md on lib/documentSections); they are not
 * a lesser version of them, and neither is their redaction.
 */
export function redactInvoice(member, invoice) {
  if (!invoice || typeof invoice !== "object") return invoice;
  const out = { ...redactInvoiceMoney(member, invoice) };
  if (out.client) out.client = redactClient(member, out.client);
  if (out.quote) out.quote = redactQuote(member, out.quote);
  return out;
}

/** redactInvoice over a list, tolerating a non-array. */
export function redactInvoices(member, invoices) {
  if (!Array.isArray(invoices)) return invoices;
  return invoices.map((i) => redactInvoice(member, i));
}

/**
 * Throws a 403-shaped error when the member may not see prices.
 *
 * For the surfaces that are money and nothing else — a rendered PDF, the
 * document preview payload. There is no shape of those worth returning with
 * the numbers removed, so unlike the redactors above these refuse.
 */
export function requireMoney(member, action = "see prices") {
  requireToggle(member, "showPricing", action);
}
