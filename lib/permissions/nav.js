// lib/permissions/nav.js
//
// The nav layer of the permission grid. Pure — no database, no React — so both
// sidebars share one implementation and a check script can execute it.
//
// ── This is cosmetics, and says so ─────────────────────────────────────────
//
// Removing a row from a menu is not access control, and this file is not what
// stops anybody doing anything. lib/permissions/enforce.js is. This exists so
// an employee's sidebar stops listing eleven screens that will refuse them —
// which QA reported as reading like a broken product rather than a boundary.
//
// Mirrors lib/features/nav.js exactly, including its failure posture: an
// unknown row is SHOWN. A nav that empties itself because a map was missing is
// a far worse failure than a row leading to a page that gates itself.
import { hasLevel, hasToggle } from "./enforce";

/**
 * nav i18n key → what the grid must say for the row to be worth showing.
 *
 * Only rows a restricted member genuinely cannot use are listed. A row that
 * merely shows LESS at a lower level — the schedule, the clock — is
 * deliberately absent: view_only is a real, useful level, and hiding the
 * quotes list from someone allowed to read quotes would remove their job
 * rather than a temptation.
 *
 * The four document rows sit at exactly `view_only` for that reason. They were
 * absent entirely until the `none` rung existed, because there was no level
 * below view_only to hide them from; now that Crew sits at `none`, the row and
 * the endpoint agree. Anyone at view_only or above still sees all four.
 *
 * `toggle` rows are all-or-nothing switches; `category`/`level` rows are the
 * ladder.
 */
export const NAV_REQUIREMENTS = {
  // ── The four document lists ─────────────────────────────────────────────
  //
  // Gated at the bottom rung of each ladder, so this hides the row from
  // exactly one audience: somebody explicitly set to "No access". The GET
  // routes behind them refuse at the same level (see the requireLevel calls in
  // app/api/quotes, /invoices, /jobs and /leads), so this is the cosmetic half
  // of a real boundary rather than the boundary itself.
  //
  // "app.nav.requests" is the leads screen — leads ARE the requests grid, as
  // the quick-add entry below has said since this file was written.
  "app.nav.quotes": { category: "quotes", level: "view_only" },
  "app.nav.jobs": { category: "jobs", level: "view_only" },
  "app.nav.invoices": { category: "invoices", level: "view_only" },
  "app.nav.requests": { category: "requests", level: "view_only" },

  // The floor of "safety" is report_own, not none — see lib/permissions.js.
  // This hides the row from exactly the one audience explicitly set to "No
  // access"; everyone else, including a Crew member who can only see their
  // own reports, still gets the row.
  "app.nav.safety": { category: "safety", level: "report_own" },

  // Recurring work sold as a package — a standing instruction to raise an
  // invoice, priced per visit. Gated with invoices for that reason.
  "app.nav.plans": { category: "invoices", level: "view_only" },

  // ── The client BOOK, which is not the same as a client's address ────────
  //
  // Crew hold clientsProperties:name_address_only because they have to drive
  // to the site. That is an address ON THEIR WORK, not a licence to page
  // through the company's customer list — which is the company's most
  // portable asset and the one an employee can walk out with.
  //
  // full_view rather than name_address_only, so the row survives for the
  // Worker preset (full_view) and disappears for Crew. Deliberately NOT
  // matched by a refusal on GET /api/clients: name_address_only is a real
  // level there and the redactor exists precisely to serve it to the pickers
  // and the job page. This hides the destination, not the data.
  "app.nav.clients": { category: "clientsProperties", level: "full_view" },

  // The warranty call list. Same dial and same rung as the client book above,
  // and for the same reason: it is the whole installed base with a client name
  // and a phone number beside each row, which is the customer list in another
  // shape. GET /api/equipment/expiring refuses at exactly this level, so the
  // row and the endpoint agree.
  "app.nav.clientEquipment": { category: "clientsProperties", level: "full_view" },

  // The vans. A role rule rather than a grid one, matching what
  // GET /api/fleet actually requires (`user:manage`, via lib/fleet/access.js)
  // — a plate and an insurance renewal are operations, the same class of
  // company record as the roster. What the van COST is a second, stricter gate
  // inside the payload (the cost-basis read), so a supervisor sees the screen
  // without seeing the truck loan.
  "app.nav.fleet": { role: ["owner", "admin", "supervisor"] },

  // Money screens. Nothing on them survives showPricing:false — a revenue
  // dashboard with the revenue removed is not a smaller dashboard.
  "app.nav.insights": { toggle: "showPricing" },

  // The KPI dashboard's own API gate (app/api/analytics/kpis/route.js) is the
  // union of six checks — quotes/jobs/invoices/requests view_only, showPricing,
  // jobCosting — and this can only test one. jobCosting is the strictest of the
  // six and the one that actually separates the presets: Crew, Estimator and
  // Dispatcher all lack it and Manager/owner/admin all hold it, the same split
  // app/api/analytics/estimate-accuracy/route.js's own table describes. Gating
  // on it undershoots rather than overshoots — a role with jobCosting but not
  // one of the other five dials still sees the row and gets a real 403, which
  // is a smaller failure than hiding the row from someone the API would answer.
  "app.nav.kpis": { toggle: "jobCosting" },

  // The company expense roll-up: burn rate, runway, spend by category. A
  // member confined to their own expenses has no use for it, and QA found the
  // aggregate half was never scoped.
  "app.nav.expenses": { category: "expenses", level: "view_record_edit_all" },

  // Suppliers, purchase orders and stock. Same rung as the expense roll-up
  // above, and for the same reason: there is no such thing as "my own"
  // purchase order, so the level below ("their own") cannot express this area
  // at all. Every route behind the row requires the identical level — see
  // lib/purchasing/access.js, which is where the constant lives so the gate
  // and this row cannot drift apart.
  "app.nav.purchasing": { category: "expenses", level: "view_record_edit_all" },

  // Approving an instant estimate is supervisor-and-up, enforced server-side.
  // An employee opening this finds a list of Approve buttons that are all
  // disabled, which reads as the product being broken.
  "app.nav.estimateReviews": { role: ["owner", "admin", "supervisor"] },

  // Timesheet review and payout runs. Both refuse an employee at the API;
  // both were reachable and rendered enabled controls.
  "app.nav.timesheets": { category: "timeTracking", level: "view_record_edit_all" },

  // Roster, invitations, licence headroom, the owner's email address.
  "app.nav.team": { role: ["owner", "admin", "supervisor"] },

  // The whole team's availability and what's booked against it — the same
  // audience as the roster above, and gated the same way. GET
  // /api/team/schedules refuses on `can(member.role, "user:view")`, which only
  // owner, admin and supervisor hold, so the row's only function for a crew
  // member was a red banner on an otherwise empty page.
  //
  // Deliberately a role rule rather than the `schedule` category: that ladder
  // is about a member's OWN calendar (Crew sit at view_complete_own and keep
  // /app/scheduler and /app/clock), and gating this row on edit_all would hide
  // it from a supervisor whose grid says "their own" while the endpoint behind
  // it still answers them — a row missing from someone it works for.
  "app.nav.teamSchedule": { role: ["owner", "admin", "supervisor"] },

  // ── Three rows whose endpoints answered anyone, until they didn't ────────
  //
  // These were not on this list because the routes behind them had no gate at
  // all, so nothing refused and the rows never LOOKED wrong. Gating the routes
  // is what turned each of them into the "renders, then shows a red panel"
  // failure this file exists to remove — so the rows have to land in the same
  // change as the gates, not after it.
  //
  // Marketing and funnels take the coarse axis, matching the `user:manage`
  // their own routes now require.
  "app.nav.marketing": { role: ["owner", "admin", "supervisor"] },
  // The designer's own API routes gate on the same user:manage permission as
  // every other marketing-management route (app/api/marketing/designer/
  // designs) — same axis as the row above, so the two never disagree about
  // who gets in.
  "app.nav.marketingDesigner": { role: ["owner", "admin", "supervisor"] },
  "app.nav.funnels": { role: ["owner", "admin", "supervisor"] },
  // The receptionist row takes the grid instead, because the call log is CLIENT
  // contact data — caller numbers and recordings — and `clientsProperties` is
  // the dial that already governs it: LEAD_RESTRICTED_FIELDS strips a lead's
  // phone at exactly this level. Role would have been the wrong axis and the
  // wrong answer: it would refuse the Estimator, who is role `employee` with
  // clientsProperties full_edit, and who is precisely the person whose job is
  // to ring the missed call back.
  "app.nav.receptionist": { category: "clientsProperties", level: "full_view" },

  // ── Rows that led straight to a refusal ────────────────────────────────
  //
  // The first trimming pass removed rows that worked and left these, which is
  // the wrong way round. QA called it: "the trimming pass removed several
  // links that worked while leaving these three that do not."

  // The plan and the card. Blocked server-side and rendered as a no-access
  // panel — so the row's only function was to lead somewhere refusing.
  "app.nav.plan": { role: ["owner", "admin"] },

  // Same: the refer page is a no-access panel for everyone else, and the page
  // itself already decided that.
  "app.nav.refer": { role: ["owner", "admin"] },

  // The quick-add shortcut into the quote builder. Someone at quotes:view_only
  // could compose an entire quote and lose the lot to a 403 on save, which is
  // the worst version of this failure — it costs the person their work, not
  // just a click.
  "app.quickAdd.quote": { category: "quotes", level: "view_create_edit" },
  // The same reasoning as the quote entry above, and the same odds: /api/invoices
  // requires BOTH invoices/view_create_edit and the showPricing toggle, so a
  // Worker composing an invoice loses it to a 403 at the end. Job creation is
  // gated on its own grid level too.
  //
  // QA found all three still offered under "+ Create" — the gate existed for
  // one of them and the menu carried five.
  "app.quickAdd.invoice": { category: "invoices", level: "view_create_edit" },
  "app.quickAdd.job": { category: "jobs", level: "view_create_edit" },
  // Leads are the requests grid. A Worker on "view only" was offered the
  // control that creates one.
  "app.quickAdd.request": { category: "requests", level: "view_create_edit" },
  // POST /api/clients requires clientsProperties "full_edit" — the level
  // ABOVE name_address_only. Offering "New client" to someone who can only see
  // a name and an address is the same broken promise as the rest of this menu.
  "app.quickAdd.client": { category: "clientsProperties", level: "full_edit" },
};

/**
 * Should this nav row be shown to this member?
 *
 * @param navKey  the row's i18n key
 * @param member  { role, permissions } — or null, which shows everything
 */
export function navRowAllowed(navKey, member) {
  const req = NAV_REQUIREMENTS[navKey];
  if (!req) return true;          // no rule — the common case
  if (!member) return true;       // provider missing; see the header

  // Owners and admins hold everything; the grid was never meant to bind them.
  if (member.role === "owner" || member.role === "admin") return true;

  if (req.role) return req.role.includes(member.role);
  if (req.toggle) return hasToggle(member, req.toggle);
  if (req.category) return hasLevel(member, req.category, req.level);
  return true;
}

/**
 * Drop disallowed rows from a group list, keeping every other property intact.
 *
 * Groups that lose all their items are dropped too — a header with nothing
 * under it announces "something used to be here", which is the trace hiding
 * the rows was meant to avoid.
 */
export function filterNavGroupsByPermission(groups, member) {
  if (!Array.isArray(groups)) return groups;
  return groups
    .map((group) => ({
      ...group,
      items: (group.items || []).filter((item) => navRowAllowed(item.key, member)),
    }))
    .filter((group) => (group.items || []).length > 0);
}

/** The flat-list variant, for the bottom rail and the search corpus. */
export function filterNavItemsByPermission(items, member) {
  if (!Array.isArray(items)) return items;
  return items.filter((item) => navRowAllowed(item.key, member));
}
