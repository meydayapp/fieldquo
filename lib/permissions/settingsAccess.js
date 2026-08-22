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
  // "billing" is the right capability here despite the name: it resolves to
  // isBillingAdmin, which is owner-or-admin — exactly the set the route
  // enforces. Reusing it beats inventing a fifth capability that would say the
  // same thing and then be free to drift from it.
  "app.settings.activity": "billing",
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
