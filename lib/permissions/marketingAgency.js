// lib/permissions/marketingAgency.js
//
// The "Marketing agency" team role: the company's marketing agency, invited as
// a team member, who may log in and work on marketing and nothing else.
// Approved by the owner 2026-10-09.
//
// ══ What it is, in the existing vocabulary ══════════════════════════════════
//
// A PRESET (lib/permissions.js PERMISSION_PRESETS.marketingAgency), on the
// `employee` tier, whose grid sits at the bottom rung of every category with
// every toggle off — and one more key in the stored grid, `marketingAgency:
// true`, which this file reads. No new MemberRole value (that would be a
// schema change for every role switch in the codebase to learn), no parallel
// permission system: the grid, the invite guard, the seat count and the access
// editor all handle it as the preset it is.
//
// ══ Why the grid alone could not say it ═══════════════════════════════════
//
// The bottom rung of every ladder is a real grant, chosen for Crew: their own
// expenses (expenses' floor), client NAMES AND ADDRESSES (clientsProperties'
// floor — GET /api/clients answers it, redacted), the company chat (no rule at
// all), their own schedule. An agency should have none of those, and the
// ladders have no rung below them. Adding `none` rungs to six categories to
// express one role would move every stored grid and every check that reads
// them. So the grid says "as little as the grid can say", and the marker says
// the rest:
//
//   * DENY BY DEFAULT on the API. lib/currentMember.js — the one function every
//     authenticated route goes through — refuses a marketing-agency member on
//     every /api path that is not in AGENCY_API_RULES below. A route written
//     next year is refused to them until somebody adds it here on purpose; that
//     is the direction a list like this has to fail in (the same argument
//     SETTINGS_ROW_CAPABILITY makes for its own deny-by-default).
//   * DENY BY DEFAULT on the pages. app/components/team/AgencyPageGate.js,
//     mounted around every /app page, renders a refusal instead of any page not
//     in AGENCY_PAGE_RULES. Cosmetic, like every page-side gate here — the API
//     refusal is the boundary — but it means no page renders and then 403s.
//   * The nav shows only AGENCY_NAV_ROWS (lib/permissions/nav.js).
//
// ══ What they can see of the leads ════════════════════════════════════════
//
// Exactly what the agency API sees: lib/agency/leadRow.js's row (first name,
// source, stage, partial postal code; contact details only while the company's
// "Share contact details" switch is on; job values only while "Share job
// values" is on). GET /api/marketing/leads builds it with buildLeadRow and
// nothing else — never the lead board, which carries contact details, notes
// and the call log.
//
// Pure — no database, no next/server — so the nav, the page gate, the API gate
// and scripts/check-marketing-agency-role.mjs all execute ONE decision.

import { can, permissionDenialMessage } from "@/lib/permissions";

/** The key in Member.permissions that marks a marketing-agency member. */
export const MARKETING_AGENCY_KEY = "marketingAgency";

/** Where a marketing-agency member lands when they open /app. */
export const MARKETING_AGENCY_HOME = "/app/marketing/results";

/**
 * Is this member confined to marketing?
 *
 * Accepts either shape a caller holds:
 *   * the session member from getCurrentMember, which carries the resolved
 *     boolean `marketingAgency` (it does not carry the grid);
 *   * { role, permissions } — PermissionProvider, loadEnforceableMember, a
 *     stored roster row.
 *
 * The owner and an administrator are never confined: they are unrestricted by
 * definition (UNRESTRICTED_ROLES in enforce.js), and an owner who could lock
 * themselves into marketing would be an account nobody can recover. Every
 * other tier with the marker IS confined — the safe reading of a marker on a
 * supervisor row is the narrow one.
 *
 * `=== true` only. A missing key, `false`, a string "true" — not confined. The
 * marker is written by the preset and by nothing a browser can widen: clamping
 * keeps it (it only ever narrows), and choosing any other preset replaces the
 * grid without it.
 */
export function isMarketingAgency(member) {
  if (!member || typeof member !== "object") return false;
  if (member.role === "owner" || member.role === "admin") return false;
  if (member.marketingAgency === true) return true;
  const p = member.permissions;
  return Boolean(p && typeof p === "object" && !Array.isArray(p) && p[MARKETING_AGENCY_KEY] === true);
}

/**
 * May this member work on funnels and read the marketing results?
 *
 * The axis those routes always gated on — `user:manage`, "may run the
 * marketing" — plus the agency. Deliberately not a grid level: the grid has no
 * marketing category, and inventing one for this would be a dial every other
 * preset then has to answer.
 */
export function canManageMarketing(member) {
  if (!member) return false;
  return can(member.role, "user:manage") || isMarketingAgency(member);
}

/**
 * requirePermission's contract for canManageMarketing: throws a 403-shaped
 * error, so a route that caught `requirePermission(member.role,
 * "user:manage")` catches this the same way, word for word.
 */
export function requireMarketingAccess(member) {
  if (canManageMarketing(member)) return;
  const err = new Error(permissionDenialMessage("user:manage"));
  err.permission = "user:manage";
  err.status = 403;
  throw err;
}

// ── Paths ──────────────────────────────────────────────────────────────────

/**
 * A pathname as the allowlists compare it: no query, no fragment, repeated
 * slashes collapsed (a "//api/quotes" must not slip past a "/api/" test), no
 * trailing slash. Percent-escapes are NOT decoded: "/api/fun%6Eels" matches no
 * rule and is refused, which is the direction an ambiguous path should go.
 */
export function normalisePath(pathname) {
  let s = typeof pathname === "string" ? pathname : "";
  s = s.split("?")[0].split("#")[0];
  s = s.replace(/\/{2,}/g, "/");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

function matches(rule, path) {
  if (path === rule.path) return true;
  return rule.prefix === true && path.startsWith(`${rule.path}/`);
}

/**
 * Every API path a marketing-agency member may call. Anything else is refused
 * by lib/currentMember.js before the route runs.
 *
 * `methods` narrows a rule where the route also does things the agency must
 * not (the role route's PATCH re-grades people; its GET only says who YOU are).
 */
export const AGENCY_API_RULES = Object.freeze([
  // The funnel builder: list, create, AI-generate, edit, delete, analytics.
  // The public funnel routes sit under the same prefix and take no member.
  Object.freeze({ path: "/api/funnels", prefix: true }),
  // Marketing results — money only while "Share job values" is on.
  Object.freeze({ path: "/api/marketing/results", methods: Object.freeze(["GET"]) }),
  // The marketing leads, as lib/agency/leadRow.js builds them.
  Object.freeze({ path: "/api/marketing/leads", methods: Object.freeze(["GET"]) }),
  // Their own interface language. The route's company-default half asks
  // user:manage itself, which the agency does not hold.
  Object.freeze({ path: "/api/settings/language", methods: Object.freeze(["GET", "PATCH"]) }),
  Object.freeze({ path: "/api/me/language" }),
  // "Who am I" — the rail asks it on every page.
  Object.freeze({ path: "/api/settings/members/self/role", methods: Object.freeze(["GET"]) }),
  // Their own activity stamp, page-view beacon and dismissed hints. None
  // returns company data.
  Object.freeze({ path: "/api/presence" }),
  Object.freeze({ path: "/api/track" }),
  Object.freeze({ path: "/api/ui-state" }),
]);

/** May a marketing-agency member call this API path with this method? */
export function agencyApiAllowed(pathname, method = "GET") {
  const path = normalisePath(pathname);
  const verb = String(method || "GET").toUpperCase();
  return AGENCY_API_RULES.some(
    (rule) => matches(rule, path) && (!rule.methods || rule.methods.includes(verb) || (verb === "HEAD" && rule.methods.includes("GET"))),
  );
}

/**
 * Every /app page a marketing-agency member may open.
 *
 * /app/settings is the settings INDEX, which lists only Language for them
 * (lib/permissions/settingsAccess.js); /app/more is the list of the rows the
 * rail filtered for them, which for them is Funnels.
 */
export const AGENCY_PAGE_RULES = Object.freeze([
  Object.freeze({ path: "/app/funnels", prefix: true }),
  Object.freeze({ path: "/app/marketing/results" }),
  Object.freeze({ path: "/app/marketing/leads" }),
  Object.freeze({ path: "/app/settings" }),
  Object.freeze({ path: "/app/settings/language" }),
  Object.freeze({ path: "/app/more" }),
]);

/** May a marketing-agency member open this /app page? */
export function agencyPageAllowed(pathname) {
  const path = normalisePath(pathname);
  return AGENCY_PAGE_RULES.some((rule) => matches(rule, path));
}

/**
 * What the page gate does for this member on this path:
 *   { action: "allow" }              — not an agency member, or a page of theirs
 *   { action: "redirect", path }     — /app itself, the dashboard they have no
 *                                      use for: their home instead
 *   { action: "refuse" }             — anything else
 *
 * A missing pathname for an agency member is refused: a gate that cannot tell
 * where it is should not wave the narrowest role through.
 */
export function agencyPageDecision(member, pathname) {
  if (!isMarketingAgency(member)) return { action: "allow" };
  const path = normalisePath(pathname);
  if (!path) return { action: "refuse" };
  if (path === "/app") return { action: "redirect", path: MARKETING_AGENCY_HOME };
  return agencyPageAllowed(path) ? { action: "allow" } : { action: "refuse" };
}

/**
 * The nav rows a marketing-agency member is shown — rail, More, phone sheet,
 * search, the Create menu (nothing) and the account rows. lib/permissions/nav.js
 * consults this before any other rule, so a row added to the rail next year is
 * hidden from them until it is added here.
 */
export const AGENCY_NAV_ROWS = Object.freeze([
  "app.nav.marketingResults",
  "app.nav.marketingLeads",
  "app.nav.funnels",
  "app.nav.settings",
]);

/**
 * The rail rows that exist for the agency alone. Everybody else reaches the
 * same two screens from the Marketing hub (/app/marketing), so they are hidden
 * from everybody else — owners included — and the owner's rail is unchanged.
 */
export const AGENCY_ONLY_NAV_ROWS = Object.freeze(["app.nav.marketingResults", "app.nav.marketingLeads"]);

/** The settings rows a marketing-agency member is shown. */
export const AGENCY_SETTINGS_ROWS = Object.freeze(["app.settings.language"]);

/** The sentence an out-of-scope API call is refused with. */
export const AGENCY_API_REFUSAL =
  "This account is set up for marketing only — funnels, marketing results and marketing leads. Ask the company for anything else.";
