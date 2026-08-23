// lib/permissions/settingsAccess.js
//
// Which settings screens a member may OPEN, and which they may CHANGE.
//
// ── This is not a second permission vocabulary ──────────────────────────────
//
// Every capability below resolves through a gate that already exists and is
// already what the API routes check:
//
//   "user:manage"     → can(role, "user:manage")            lib/permissions.js
//   "workarea:assign" → can(role, "workarea:assign")        lib/permissions.js
//   "billing"         → isBillingAdmin(role)                lib/billing/billingAdmin.js
//   "payroll"         → isPayrollAdmin(role)                here, imported by the route
//
// Nothing here invents a new permission string, and nothing here is the
// security boundary. Hiding a sidebar row is a UX fix; the route it points at
// refuses the same person whether or not the row was ever drawn. AGENTS.md is
// explicit about that, and the check script asserts the pairing rather than
// trusting this comment.
//
// ── Why "billing" and "payroll" are role predicates, not permission strings ─
//
// PERMISSIONS.owner/admin are ["*"], so any string at all would resolve true
// for them and false for a supervisor — which happens to be the right answer,
// and is exactly why it would be a trap. `can(role, "billing:manage")` would
// look like a declared permission while being a coincidence of the wildcard.
// isBillingAdmin() states the rule instead, and billingAdmin.js already
// explains why holding "user:manage" must not carry authority over the
// company's card.
//
// ── Impersonation ──────────────────────────────────────────────────────────
//
// A read-only support session (role "viewer") holds no permission at all, so
// the naive answer would hide almost every settings screen from the platform
// console. That contradicts non-negotiable #3: the console views everything and
// edits nothing. So canSee() waves impersonation through and canChange() always
// refuses it — which lands a support admin on the same read-only rendering an
// employee gets, instead of live-looking inputs whose saves the server rejects.

import { can } from "@/lib/permissions";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";

/**
 * Who may see or change payroll deductions and payslip components.
 *
 * Its own predicate rather than a reuse of isBillingAdmin: the two happen to
 * agree today (owner/admin), but they answer different questions — one is
 * "may you spend the company's money on FieldQuo", the other is "may you see
 * what lands in someone's bank account". Collapsing them would mean a future
 * change to one silently changing the other.
 *
 * app/api/settings/payroll-components/route.js imports this rather than
 * keeping the copy it used to have.
 */
export function isPayrollAdmin(role) {
  return role === "owner" || role === "admin";
}

/** capability → does this role hold it. */
const CAPABILITIES = {
  "user:manage": (role) => can(role, "user:manage"),
  "workarea:assign": (role) => can(role, "workarea:assign"),
  billing: (role) => isBillingAdmin(role),
  payroll: (role) => isPayrollAdmin(role),
  // Owner-or-admin, for screens that are neither the company's card nor
  // anyone's payslip. Two routes gate exactly on that set and on nothing else —
  // /api/activity ("Only an owner or admin can view the activity log.") and
  // /api/settings/leave-policies ("Only an owner or admin can manage leave
  // policies.") — and both used to borrow "billing" because it happened to
  // resolve the same way. That worked and read as a mistake, which is its own
  // cost: the next person to change what a billing admin is would have silently
  // changed who can read the activity log. Named for what it is instead.
  "owner-admin": (role) => role === "owner" || role === "admin",
};

export const SETTINGS_CAPABILITIES = Object.keys(CAPABILITIES);

/**
 * Settings sidebar rows that are removed for members who can do nothing on
 * them. Keyed by the row's i18n key, which is what SettingsSidebar carries as
 * data and what scripts/check-settings-access.mjs parses back out.
 *
 * Only rows where the answer is "hidden" appear here. A row that stays visible
 * because its screen carries information the member genuinely needs — Company
 * Settings, Work Areas, Custom Fields, Manage Team — is absent on purpose, and
 * renders read-only instead. That decision is recorded per page, next to the
 * rendering it produces.
 *
 * Absence is now an assertion, not an omission: check-settings-access.mjs reads
 * the endpoints each visible row's page fetches and fails if one of them
 * refuses a plain member. A row that legitimately stays visible while part of
 * it refuses belongs in SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS below, with
 * the reason written down.
 */
export const SETTINGS_ROW_CAPABILITY = {
  // The plan, the price and the card. An employee seeing what the company pays
  // FieldQuo is the owner's business, not theirs, and every control on the page
  // is refused by isBillingAdmin server-side anyway.
  "app.settings.accountBilling": "billing",
  // The referral link is the company's to share, but the page also lists which
  // companies were referred and how much credit was earned — other people's
  // commercial data — and only an owner/admin can actually send an invite.
  // Both halves point the same way: hide it.
  "app.settings.refer": "billing",
  // Deduction rates and tax bands. The route already answers 403 to everyone
  // else, so the row led nowhere but an error.
  "app.settings.payroll": "payroll",
  // The Activity Log is owner/admin only — /api/activity answers "Only an
  // owner or admin can view the activity log." to everyone else, and the page
  // exposes actions across every user: payments, pay-rate changes, who
  // deactivated whom. The row was still in the sidebar for a Manager, leading
  // to nothing but that refusal.
  //
  // This said "billing" and explained that isBillingAdmin happens to be
  // owner-or-admin. It now says owner-admin, which is the rule the route
  // actually states. Same set today, same rendering today; what changes is that
  // a future narrowing of who may touch the company's card can no longer
  // silently narrow who may read the activity log.
  "app.settings.activity": "owner-admin",
  // Configures the company's PUBLIC booking page — bookable visit types and
  // what a homeowner is charged to hold a slot. Nothing on it is information a
  // crew member needs; their own bookable hours live on Availability, which
  // stays visible and correctly says "your hours".
  "app.settings.bookingPage": "user:manage",
  // The Stripe connection itself, with live "Manage in Stripe" and
  // "Disconnect" buttons. QA reached this as an employee across two passes and
  // declined to click Disconnect, correctly — severing a company's payment
  // processing is not a control a crew member should be one click from. Rated
  // as billing, because that is what it is.
  "app.settings.payments": "billing",

  // ── Rows whose route already refused, added after QA walked the sidebar ──
  //
  // The first pass hid six rows and left these, which is the wrong way round:
  // every one of them was drawn for a Worker and every one led to a refusal.
  // The capability is read off the ROUTE in each case, not off the row's name —
  // scripts/check-settings-access.mjs now parses each visible row's read
  // endpoint and fails if it refuses, which is what would have caught them.

  // GET /api/settings/cabinet-rates → requirePermission(member.role,
  // "user:manage"). The whole screen is one rate card; there is no half of it a
  // crew member reads.
  "app.settings.cabinetRates": "user:manage",

  // GET /api/settings/email-domain → requirePermission(member.role,
  // "user:manage"). Verified by QA as a Worker: 403.
  "app.settings.emailDomain": "user:manage",

  // GET /api/settings/website → requirePermission(member.role, "user:manage").
  // Verified by QA as a Worker: 403. PUT/POST/DELETE were already closed.
  "app.settings.website": "user:manage",

  // GET /api/settings/voice → requirePermission(member.role, "user:manage"),
  // and so does the top-up route beside it. Verified by QA as a Worker: 403.
  "app.settings.voice": "user:manage",

  // Leave was NOT in the report either; the converse assertion found it too.
  // GET /api/settings/leave-policies refuses anyone who is not owner or admin —
  // "Only an owner or admin can manage leave policies." — with no scoped-down
  // payload for anybody else, so a supervisor got a screen built from one 403.
  // This is the company's policy set, not a person's time off: an employee's
  // own leave lives on the leave request screens, which are untouched.
  "app.settings.leave": "owner-admin",

  // Overhead was NOT in the report; the converse assertion found it. Four of
  // the five endpoints it reads refuse an employee: /api/debt and
  // /api/overhead/fixed-costs on requirePermission(member.role, "user:manage"),
  // /api/analytics/minimum-price on the showPricing toggle, /api/salaries on
  // the payroll grid — every wage in the company is on that screen. What an
  // employee got was a page assembled from four refusals. "user:manage" is the
  // gate that decides it: a supervisor holds it, and holds showPricing under
  // every preset that maps to the role.
  "app.settings.overhead": "user:manage",

  // ── Rows hidden for the WRITES, not for a refused read ──────────────────
  //
  // These three are a different case and are marked as such on purpose. GET
  // /api/settings/document-templates and GET /api/settings/follow-up-rules are
  // open to any member — an employee CAN read them, and the QA report's claim
  // that they answered 403 does not match the routes.
  //
  // They are hidden anyway because every control on the three screens (create,
  // rename, activate, delete, seed defaults) is requirePermission(member.role,
  // "user:manage") or owner/admin, and none of the three pages calls
  // useSettingsAccess — so an employee opening them gets a page of live-looking
  // buttons, every one of which answers 403. That is the dead-control failure
  // AGENTS.md names, and hiding the row is the version of the fix that lives in
  // this file.
  //
  // The better fix is the one Company Settings got: a read-only rendering, so
  // the screen keeps informing and stops pretending. If one of these pages
  // grows that, delete its line here — the row should come back visible.
  "app.settings.emailTemplates": "user:manage",
  "app.settings.pdfTemplates": "user:manage",
  "app.settings.followUps": "user:manage",
};

/**
 * Rows that STAY VISIBLE even though their read endpoint can refuse.
 *
 * The sidebar gets `{ role, impersonation }` from app/app/settings/layout.js
 * and nothing else. Every capability above is therefore a question about a
 * ROLE. These two rows are gated on the granular grid instead — a per-member
 * value that lives on Member.permissions and is not in scope of this provider —
 * so there is no honest capability to give them:
 *
 *   * a role-shaped guess would hide the price book from a Manager who holds
 *     showPricing, which is exactly the person who needs it; and
 *   * a grid-shaped rule evaluated against an access object that carries no
 *     permissions falls open (see hasToggle/hasLevel), i.e. it would be a rule
 *     that reads as enforcement and enforces nothing — the thing this whole
 *     sweep exists to remove.
 *
 * So they are listed, with the reason, and the check script asserts the list is
 * the ONLY way a refusing row stays visible. To close them properly the
 * settings layout has to load the enforceable member (lib/permissions/enforce.js
 * loadEnforceableMember) and pass `permissions` into SettingsAccessProvider;
 * then these move out of here and into a grid rule shaped like NAV_REQUIREMENTS
 * in lib/permissions/nav.js.
 *
 * Value = why, for the reader and for the failure message.
 */
export const SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS = {
  // GET /api/products (and /export) → requireToggle(full, "showPricing").
  // A price book is prices, so the route refuses rather than redacting; but
  // showPricing is a per-member switch an owner sets deliberately, and the
  // employees who hold it read this screen legitimately.
  "app.settings.products":
    "read is gated on the showPricing toggle, not on a role",
  // GET /api/expenses/summary → hasLevel(full, "expenses",
  // "view_record_edit_all"). The main rail already hides this exact page under
  // "app.nav.expenses" with that grid rule (lib/permissions/nav.js), so the two
  // menus disagree about one page — knowingly, until the provider carries the
  // grid. The half a restricted member CAN use is real: GET /api/expenses
  // scopes to their own rows and POST accepts their own expense, so the screen
  // still records the receipt in their van.
  "app.settings.expenseTracking":
    "the company roll-up needs expenses:view_record_edit_all; recording your own works",
};

/** Does this role hold a capability? Unknown capability → no restriction. */
export function holdsCapability(role, capability) {
  const check = CAPABILITIES[capability];
  if (!check) return true;
  return check(role);
}

/**
 * @param access  { role, impersonation } — the shape SettingsAccessProvider carries
 */
export function canSee(access, capability) {
  if (!access) return false;
  if (access.impersonation) return true; // non-negotiable #3: view everything
  return holdsCapability(access.role, capability);
}

export function canChange(access, capability) {
  if (!access) return false;
  if (access.impersonation) return false; // …edit nothing
  return holdsCapability(access.role, capability);
}

/** Should this settings sidebar row be drawn? */
export function canSeeSettingsRow(access, navKey) {
  const capability = SETTINGS_ROW_CAPABILITY[navKey];
  if (!capability) return true;
  return canSee(access, capability);
}

/**
 * Drop hidden rows from the settings sidebar's group list.
 *
 * Mirrors filterNavGroups in lib/features/nav.js deliberately — same shape,
 * same "a group left with nothing disappears" rule — because a heading over
 * empty space announces that something was taken away.
 *
 * A null `access` (the provider missing, or still resolving) leaves the menu
 * intact. Same reasoning as the feature flags: a nav that empties itself when a
 * lookup fails looks like the account broke, and every row behind it is gated
 * server-side regardless.
 */
export function filterSettingsGroups(groups, access) {
  if (!Array.isArray(groups)) return [];
  if (!access) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((i) => canSeeSettingsRow(access, i.key)),
    }))
    .filter((g) => g.items.length > 0);
}
