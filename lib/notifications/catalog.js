// lib/notifications/catalog.js
//
// The closed vocabulary of the notification feed: what may be emitted, who is
// allowed to receive it, and which types carry money.
//
// A TABLE, not a switch, modelled on RULE_TYPES in
// app/api/settings/notification-rules/route.js and on OWNED_ID_FIELDS in
// lib/tenant/ownedIds.js — so scripts/check-notifications.mjs can import it and
// EXECUTE every rule in it rather than reading source and hoping.
//
// ══ Why the audience is declared here instead of calling hasLevel ══════════
//
// `hasLevel()` (lib/permissions/enforce.js) fails OPEN in three separate ways:
// an unknown category returns true (:47), a member with no permissions object
// returns true (:52), and a category the member's grid never mentions returns
// true (:57). That is CORRECT for gating a route — members predate the grid and
// defaulting them to "no access" would lock out working accounts — and it is
// wrong as the sole test for what goes into a feed.
//
// app/api/settings/notification-rules/route.js:35-44 already refuses to route
// through requireLevel for exactly this reason, in its own words:
//
//   > hasLevel() returns true for categories it doesn't recognise — so routing
//   > this through requireLevel would look like a permission check while
//   > enforcing nothing at all.
//
// So `satisfiesAudience` below re-derives the same ladder comparison and fails
// CLOSED at every one of those three points. A withheld notification costs
// somebody a screen refresh; a delivered one cannot be taken back, and for the
// money types the thing delivered is a price.
//
// ══ The one place "owner + admin" is written down ══════════════════════════
//
// Five hand-rolled copies of `role: { in: ["owner", "admin"] }` already exist
// (invoicePaymentNotice.js, large-quote-check, the public quote route, the
// kitchen self-quote route, monthlyDigest.js) and they have already drifted —
// two use `distinct: ["userId"]` and two do not. This file is not a sixth copy:
// it is a DECLARATION of audience per event type, and lib/notifications/
// recipients.js is the single resolver that reads it. Nothing else in the feed
// names a role.
import { PERMISSIONS, PERMISSION_CATEGORIES, PERMISSION_TOGGLES } from "@/lib/permissions";
import { UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";

/**
 * Every capability string any role actually holds.
 *
 * Derived from PERMISSIONS rather than listed, so a catalog entry naming a
 * capability that no role has ever been granted is refused instead of quietly
 * matching nobody. "*" is excluded — an audience of "whatever owners hold" is
 * not an audience, it is an absence of one.
 */
const KNOWN_CAPABILITIES = new Set(
  Object.values(PERMISSIONS)
    .flat()
    .filter((p) => p !== "*"),
);

/**
 * @typedef {object} Audience
 * @property {string} [category]    a key of PERMISSION_CATEGORIES
 * @property {string} [level]       a level value declared by that category
 * @property {string} [capability]  a coarse permission string from PERMISSIONS
 * @property {string} [toggle]      a key of PERMISSION_TOGGLES
 */

export const NOTIFICATION_TYPES = {
  // ── 1. The reason this whole feature exists ─────────────────────────────
  //
  // A refund or a chargeback lands on app/api/stripe/webhook → settleChargeEvent
  // and, before this, told NOBODY: no email, no SMS, no recordActivity, no
  // recordError. Money leaves the contractor's account, a Stripe evidence
  // deadline starts running, and the first they hear of it is whenever somebody
  // next opens the Stripe dashboard. Highest value-per-line in the audit.
  "payment.disputed": {
    label: "Chargeback or refund",
    severity: "critical",
    money: true,
    // The `payments` toggle, not a role list. Crew, Estimator and Dispatcher all
    // hold payments:false; Manager holds it and is excluded by `supervisors`
    // below, so in practice this lands on owners and admins plus anybody an
    // owner has deliberately handed payment collection to.
    audience: { toggle: "payments" },
    supervisors: false,
    // Where the row links. The Payment has no screen of its own; the invoice it
    // sits on does.
    entityType: "invoice",
    params: ["invoiceNumber", "clientName", "kind"],
  },

  // ── 2. The event the owner named first ──────────────────────────────────
  //
  // Already emails owner+admin from app/api/public/quotes/[token]/route.js. That
  // email is UNCHANGED and still sends from where it always did — the feed row
  // is the record, not a second alert. What the feed adds is a phone-shaped copy
  // that does not need a mail client open in a driveway.
  "quote.accepted": {
    label: "Quote approved",
    severity: "high",
    money: true,
    audience: { category: "quotes", level: "view_only" },
    supervisors: false,
    entityType: "quote",
    params: ["quoteNumber", "clientName"],
  },

  // ── 3. Invoice paid ─────────────────────────────────────────────────────
  //
  // Already emails, gated by the `invoice_paid` NotificationRule (default ON).
  // The feed entry is NOT gated by that rule: muting an email is a statement
  // about the inbox, not about whether the fact should be knowable. Turning the
  // email off and losing the record entirely is the trap.
  "invoice.paid": {
    label: "Invoice paid",
    severity: "high",
    money: true,
    audience: { category: "invoices", level: "view_only" },
    supervisors: false,
    entityType: "invoice",
    params: ["invoiceNumber", "clientName", "settled"],
  },

  // ── 4. New enquiry, from any of the six inbound sources ─────────────────
  //
  // ONE hook, in lib/leads/createLead.js, because every inbound source already
  // funnels through createScoredLead: the self-quote form, the kitchen designer,
  // the instant quote, the embed/public lead form, a funnel submission, the
  // client portal and the AI receptionist. Five of those told nobody at the
  // company. Response time is what wins the job.
  //
  // No money flag: a lead has a budget BAND, not a price, and the band is a
  // qualifier rather than a figure.
  "lead.created": {
    label: "New enquiry",
    severity: "normal",
    money: false,
    audience: { category: "requests", level: "view_only" },
    // Dispatchers and Managers run the board; a new enquiry is exactly the
    // operational event they are there for. This is the split described at the
    // bottom of this file.
    supervisors: true,
    entityType: "lead",
    // `source` is deliberately NOT here. It is an open vocabulary
    // (self_quote / self_quote_kitchen / instant_quote / client_portal /
    // funnel / phone_agent), every value would need its own translated label,
    // and the lead screen this row opens already shows it. A param nothing
    // renders is a stored field read by nothing — the failure class this change
    // removed from NotificationRule.channel, and it does not get to come back
    // in through the feed. `temperature` stays because it is exactly three
    // values from lib/leads/score.js and it decides what gets picked up first.
    params: ["leadName", "temperature"],
  },

  // ── 5. Somebody calling in sick ─────────────────────────────────────────
  //
  // The best-prepared event on the owner's whole list: LeaveRequest, LeavePolicy,
  // routing through lib/org/reportingLine.js, a screen at /app/time-off, and
  // recordActivity on all four transitions — notifying nobody.
  //
  // Audience is `user:manage`, not the computed approver. Two reasons, both from
  // audit §4: a sick day is usually on an auto-approving policy so there is no
  // approval to chase and the notice is purely informational ("Dana is out
  // today"), and lib/org/leaveRouting.js deliberately computes routing on every
  // READ so that a request escalated past a manager on Monday returns to them on
  // Friday. Freezing an approver into a delivery row would contradict the screen.
  // So the feed tells everyone who could act, and the row links to the screen
  // that computes the live answer.
  "leave.requested": {
    label: "Time off requested",
    severity: "normal",
    money: false,
    audience: { capability: "user:manage" },
    supervisors: true,
    entityType: "leave",
    params: ["workerName", "policyName", "days", "autoApproved"],
  },

  // ── 6. An estimate waiting for a human ──────────────────────────────────
  //
  // A quote drafted off a recorded call at 6pm, or an instant estimate the
  // homeowner has ALREADY been shown a number for, lands in /app/estimate-reviews
  // with needsReview set and sits there unseen. The homeowner is waiting on a
  // number somebody has to stand behind.
  //
  // `quote:approve-estimate` is the capability the approval route itself
  // enforces (supervisor and up), and the same one lib/permissions/nav.js gates
  // the nav row with — so the feed reaches exactly the people who can clear it.
  //
  // No money flag: the row says a draft is waiting, never what it is worth. The
  // figure is on the screen behind it, which has its own showPricing gate.
  "quote.needsReview": {
    label: "Estimate awaiting sign-off",
    severity: "high",
    money: false,
    audience: { capability: "quote:approve-estimate" },
    supervisors: true,
    entityType: "quote",
    // `fromCall`, not the raw `estimateSource`. That column is free-form by
    // design ("google_solar", "lawn_polygon", "manual", "phone_call" — its own
    // schema comment says new trades add sources without a migration), so a
    // param carrying it would need a translated label per value or would print
    // a raw token on screen. The distinction that changes what the reviewer
    // does is binary: somebody is waiting on a call back, or somebody filled in
    // a form.
    params: ["quoteNumber", "clientName", "fromCall"],
  },
};

export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES);

/**
 * The catalog entry for a type, or null.
 *
 * Own-property lookup rather than a bare index, for the same reason
 * `can()` in lib/permissions.js uses one: NOTIFICATION_TYPES["__proto__"]
 * returns Object.prototype, which is truthy, and every property read below
 * would then answer undefined instead of the caller getting a clean refusal.
 */
export function typeMeta(type) {
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPES, type)
    ? NOTIFICATION_TYPES[type]
    : null;
}

/**
 * Is this catalog entry's audience expressed in vocabulary that exists?
 *
 * Returns a reason string when it is not, so the refusal can be logged with
 * something a human can act on rather than a bare false.
 *
 * This is the fail-closed half. `hasLevel` treats an unrecognised category as
 * "don't invent a restriction" and returns true; here an unrecognised anything
 * means the audience cannot be computed, and an audience that cannot be
 * computed is not an audience of everybody.
 */
export function audienceProblem(audience) {
  if (!audience || typeof audience !== "object") return "no audience declared";

  const forms = ["category", "capability", "toggle"].filter((k) => k in audience);
  if (forms.length === 0) return "audience declares none of category/capability/toggle";
  if (forms.length > 1) return `audience declares more than one form: ${forms.join(", ")}`;

  if ("category" in audience) {
    const config = Object.prototype.hasOwnProperty.call(
      PERMISSION_CATEGORIES,
      audience.category,
    )
      ? PERMISSION_CATEGORIES[audience.category]
      : null;
    if (!config) return `unknown permission category "${audience.category}"`;
    const levels = config.levels.map((l) => l.value);
    if (!levels.includes(audience.level)) {
      return `category "${audience.category}" has no level "${audience.level}"`;
    }
    return null;
  }

  if ("toggle" in audience) {
    return Object.prototype.hasOwnProperty.call(PERMISSION_TOGGLES, audience.toggle)
      ? null
      : `unknown permission toggle "${audience.toggle}"`;
  }

  return KNOWN_CAPABILITIES.has(audience.capability)
    ? null
    : `unknown capability "${audience.capability}"`;
}

/**
 * Everything wrong with one catalog entry, as strings. Empty means it is sound.
 *
 * Exported so the check script asserts the WHOLE table on every run rather than
 * the entries somebody remembered to write a case for.
 */
export function typeProblems(type) {
  const meta = typeMeta(type);
  if (!meta) return [`"${type}" is not in the catalog`];

  const problems = [];
  const audience = audienceProblem(meta.audience);
  if (audience) problems.push(audience);

  if (typeof meta.money !== "boolean") problems.push("`money` must be declared true or false");
  if (typeof meta.supervisors !== "boolean") {
    problems.push("`supervisors` must be declared true or false");
  }
  if (!Array.isArray(meta.params)) problems.push("`params` must be an array of allowed keys");

  // A money type whose audience is a bare capability would reach anyone holding
  // that capability regardless of showPricing — the Crew hole the preset was
  // rewritten to close. requiresMoneySight below covers it at resolve time, and
  // this makes the combination impossible to declare by accident.
  if (meta.money && meta.params?.some((p) => /amount|total|price|cost|value/i.test(p))) {
    problems.push("a money type must not declare a money-shaped param — use `amount`");
  }

  return problems;
}

/**
 * Does this member qualify for this audience?
 *
 * @param member    { role, permissions } — loadEnforceableMember's shape
 * @param audience  the catalog's declaration
 * @param opts      { requiresMoneySight } — set for a `money: true` type
 *
 * Fails closed everywhere hasLevel fails open. Read the three cases below
 * against enforce.js:47-57 to see the difference.
 */
export function satisfiesAudience(member, audience, { requiresMoneySight = false } = {}) {
  if (!member || typeof member.role !== "string") return false;
  // An audience nobody can validate is an audience nobody receives.
  if (audienceProblem(audience)) return false;

  const unrestricted = UNRESTRICTED_ROLES.has(member.role);

  // Money is a separate axis and it is checked FIRST, so no later `return true`
  // can skip it. Owners and admins hold showPricing by role (PERMISSIONS.owner
  // is ["*"] and hasToggle short-circuits on that set), which is why the
  // unrestricted case is spelled out here rather than inherited.
  if (requiresMoneySight && !unrestricted && !toggleGranted(member, "showPricing")) {
    return false;
  }

  if (unrestricted) return true;

  if ("capability" in audience) {
    // Coarse and role-only on purpose: the grid does not express "may run a
    // crew", PERMISSIONS does, and a member with no grid still has a role.
    const perms = Object.prototype.hasOwnProperty.call(PERMISSIONS, member.role)
      ? PERMISSIONS[member.role]
      : [];
    return Array.isArray(perms) && perms.includes(audience.capability);
  }

  if ("toggle" in audience) return toggleGranted(member, audience.toggle);

  return levelGranted(member, audience.category, audience.level);
}

/**
 * hasToggle's question, answered closed.
 *
 * hasToggle returns true when `permissions` is missing entirely and when the
 * toggle is simply absent from it. Both are "nobody has said", and for delivery
 * "nobody has said" is not a grant.
 */
function toggleGranted(member, toggle) {
  const permissions = member.permissions;
  if (!permissions || typeof permissions !== "object") return false;
  return permissions[toggle] === true;
}

/** hasLevel's ladder comparison, with every fall-through inverted. */
function levelGranted(member, category, level) {
  const config = Object.prototype.hasOwnProperty.call(PERMISSION_CATEGORIES, category)
    ? PERMISSION_CATEGORIES[category]
    : null;
  if (!config) return false;

  const permissions = member.permissions;
  if (!permissions || typeof permissions !== "object") return false;

  const current = permissions[category];
  if (typeof current !== "string") return false;

  const levels = config.levels.map((l) => l.value);
  const currentIndex = levels.indexOf(current);
  const requiredIndex = levels.indexOf(level);
  if (currentIndex === -1 || requiredIndex === -1) return false;
  return currentIndex >= requiredIndex;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPERVISORS — an open product question, answered conservatively
// ═══════════════════════════════════════════════════════════════════════════
//
// Audit §11.1: every existing notification goes to owner+admin only, and the
// owner said "managers, admins, owners" — naming managers FIRST. So supervisors
// (the role Dispatcher and Manager both map to) must be in the audience for
// something, or the feature misses the audience he asked for.
//
// The question the audit leaves open is whether they get the MONEY events.
// `supervisors: false` on the three money types is the conservative answer:
//
//   * A Manager holds showPricing and payments, so the grid alone would let
//     them through. That is a decision about what they may OPEN, made when the
//     preset was written; pushing every chargeback and every approval at them
//     unasked is a different decision, and one nobody has made yet.
//   * The direction of the mistake matters. Withholding a notification from a
//     Manager costs them a click into a screen they can already open. Sending
//     one is irreversible and puts the company's revenue in front of somebody
//     the owner may think of as running crews.
//
// It is ONE LINE per type to reverse: change `supervisors: false` to true on
// "payment.disputed", "quote.accepted" and "invoice.paid". Nothing else moves —
// the resolver reads this flag and nothing else names a role.
//
// The three operational types are already `supervisors: true`, which is the
// half of the owner's request that is not in question.
export function supervisorsIncluded(type) {
  return typeMeta(type)?.supervisors === true;
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT ALREADY EMAILS, AND WHY THE FEED SENDS NONE
// ═══════════════════════════════════════════════════════════════════════════
//
// "quote.accepted" and "invoice.paid" already email owner+admin today, and the
// kitchen-designer source of "lead.created" does too. Audit §8.4 proposes moving
// those emails behind notifyEvent so the two cannot double-send, and names that
// as "the single biggest implementation risk in the whole feature".
//
// v1 sidesteps it instead of taking it on: the feed sends NO email and NO SMS at
// all. Every existing email still sends from exactly where it always did, so
// nothing can be sent twice and nothing can stop being sent. There is no
// `alsoEmails` flag in the table above, deliberately — a flag nothing branches
// on is failure class #1, which is the same fault this change removed from
// NotificationRule.channel. When a channel step is built, this comment and the
// four call sites in the audit's §1.3 table are what it has to reconcile.
